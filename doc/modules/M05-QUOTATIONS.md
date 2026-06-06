# M05 — Quotations

> Source of truth for vendor quotations and the comparison screen. See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.4 and [10-BUSINESS-RULES.md](../10-BUSINESS-RULES.md) §10.2.

## M05.1 Purpose

- Allow vendors to submit and edit quotations on assigned RFQs.
- Lock quotations automatically at the RFQ deadline.
- Provide a side-by-side comparison view for procurement officers.
- Support shortlisting, which feeds the approval workflow.

## M05.2 Scope

**In scope**:
- Vendor: create, edit (before deadline), and submit a quotation.
- Officer / admin: view, compare, shortlist, reject.
- Auto-lock at RFQ deadline.
- Auto-supersede a previous shortlist when a new one is selected.
- Side-by-side comparison with lowest-price highlight.
- Total amount computation.

**Out of scope**:
- Multi-currency.
- Discounts / taxes per line item.
- Partial quotations (vendor must quote all lines).
- Versioning (we keep the latest state; v1.1 may keep history).

## M05.3 Entities

- `Quotation`
- `QuotationLineItem`
- Indirectly: `RFQ`, `RFQLineItem` (read-only references).

## M05.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/rfqs/:rfqId/quotations` | ADMIN, OFFICER, MANAGER (all); VENDOR (own only) | List for an RFQ |
| GET | `/api/v1/quotations` | ADMIN, OFFICER, MANAGER; VENDOR (own only) | All quotations; filters |
| GET | `/api/v1/quotations/:id` | ADMIN, OFFICER, MANAGER (any); VENDOR (own) | Detail |
| POST | `/api/v1/rfqs/:rfqId/quotations` | VENDOR (own RFQ, ACTIVE) | Create draft. The initial state is `SUBMITTED` (no Draft state in v1). |
| PATCH | `/api/v1/quotations/:id` | VENDOR (own, before deadline, status=SUBMITTED) | Edit |
| POST | `/api/v1/quotations/:id/shortlist` | ADMIN, OFFICER | SUBMITTED → SHORTLISTED. Auto-creates Approval(PENDING). Supersedes prior shortlist. |
| POST | `/api/v1/quotations/:id/reject` | ADMIN, OFFICER | SUBMITTED or SHORTLISTED → REJECTED. Body: `{ reason }`. |
| GET | `/api/v1/rfqs/:rfqId/comparison` | ADMIN, OFFICER, MANAGER | Side-by-side comparison |
| POST | `/api/v1/quotations/:id/withdraw-shortlist` | ADMIN only | SHORTLISTED → SUBMITTED. Escape hatch. (Rare.) |

## M05.5 Service layer

```
quotations/
├── quotations.module.ts
├── controllers/
│   ├── quotations.controller.ts
│   └── quotation-comparison.controller.ts
├── services/
│   ├── quotations.service.ts             # CRUD
│   ├── quotation-edit.service.ts         # edit-with-deadline-check
│   ├── quotation-shortlist.service.ts    # shortlist + supersede + approval create
│   ├── quotation-reject.service.ts
│   ├── quotation-comparison.service.ts
│   └── quotation-totals.service.ts       # line item + total math
├── repositories/
│   └── quotations.repository.ts
├── workflow.ts                            # status state machine
├── dto/
│   ├── create-quotation.dto.ts
│   ├── update-quotation.dto.ts
│   ├── list-quotations.dto.ts
│   ├── shortlist-quotation.dto.ts
│   ├── reject-quotation.dto.ts
│   ├── comparison-response.dto.ts
│   └── quotation-line-item.dto.ts
└── tests/
```

## M05.6 Workflow

```
[editable] SUBMITTED ──shortlist──▶ SHORTLISTED ──(on approval)──▶ ACCEPTED
       │                              │
       │ reject                       │ reject
       ▼                              ▼
   REJECTED                       REJECTED
```

Note: there is **no Draft state**. A quotation is `SUBMITTED` from creation, and is editable while `SUBMITTED` AND `editableUntil > now()`.

State machine function: `assertQuotationTransition(from, to)`.

| From | To | Allowed |
|------|----|---------|
| SUBMITTED | SHORTLISTED | ✅ |
| SUBMITTED | REJECTED | ✅ |
| SHORTLISTED | ACCEPTED | ✅ (only via approval) |
| SHORTLISTED | REJECTED | ✅ (only via approval reject or manual) |
| SHORTLISTED | SUBMITTED | ✅ (admin withdraw-shortlist) |
| ACCEPTED | * | ❌ (terminal) |
| REJECTED | * | ❌ (terminal) |

## M05.7 Edit lock

`PATCH /api/v1/quotations/:id` is allowed only if:

- The current user is a vendor user linked to the quotation's vendor.
- The quotation's status is `SUBMITTED`.
- `quotation.editableUntil > now()` (which equals the RFQ's deadline at submission time).
- The vendor company is `ACTIVE`.

If any fails, return 409 `DEADLINE_PASSED` or 403 `OWNERSHIP_DENIED` or 409 `WORKFLOW_INVALID_TRANSITION`.

## M05.8 Submission

`POST /api/v1/rfqs/:rfqId/quotations` creates a new quotation:

- `rfqId` from path.
- `vendorCompanyId` from authenticated vendor user.
- `submittedById` = current user.
- `status` = `SUBMITTED`.
- `editableUntil` = `rfq.deadline`.
- `totalAmount` = sum of `(unitPrice * quantity)` over line items.
- One quotation per `(rfqId, vendorCompanyId)` (unique constraint). Second attempt → 409 `DUPLICATE_ENTRY`.

Validation:

- All RFQ line items must be quoted (BR-020 implied: must cover all lines).
- Each line: `unitPrice ≥ 0`, `quantity > 0`.
- `estimatedDeliveryDate` required, must be a future date.
- `notes` optional, max 1000 chars.

## M05.9 Shortlist

`POST /api/v1/quotations/:id/shortlist`:

- Transitions: quotation `SUBMITTED` → `SHORTLISTED`.
- If there was a prior `SHORTLISTED` quotation for the same RFQ, it transitions to `REJECTED` with reason `SUPERSEDED`.
- Creates an `Approval(PENDING)` tied to this quotation and the RFQ.
- Audit: `QUOTATION_SHORTLISTED`, `APPROVAL_REQUESTED`, `QUOTATION_REJECTED` (if superseded).
- Notification: to all managers (`APPROVAL_REQUESTED`).

Only one `SHORTLISTED` quotation per RFQ at a time (enforced via DB partial unique index `(rfqId) WHERE status = 'SHORTLISTED'`).

## M05.10 Comparison

`GET /api/v1/rfqs/:rfqId/comparison` returns:

```ts
{
  rfq: { id, title, deadline, status, ... },
  quotations: [
    {
      id,
      vendor: { id, name, rating, status },
      totalAmount,
      estimatedDeliveryDate,
      status,                    // SUBMITTED | SHORTLISTED | REJECTED | ACCEPTED
      isLowest: boolean,         // computed
      isFastest: boolean,        // computed
      lineItems: [...]
    }
  ],
  summary: {
    quotationCount: number,
    lowestTotal: number,
    fastestDeliveryDate: string,
  }
}
```

Computed fields:

- `isLowest`: true if this is the lowest total among `SUBMITTED` and `SHORTLISTED` quotations.
- `isFastest`: true if this has the earliest `estimatedDeliveryDate` among the same set.

Officer can click "Shortlist" on any quotation from this view (uses the same `shortlist` endpoint).

## M05.11 Total amount

Computed in the service:

```ts
totalAmount = sum(unitPrice * quantity) for each line item
```

Stored on the quotation. Recomputed on every PATCH and on creation.

## M05.12 Audit events

| Event | Trigger |
|-------|---------|
| `QUOTATION_CREATED` | Initial create |
| `QUOTATION_UPDATED` | Edit (any field) |
| `QUOTATION_SUBMITTED` | (Implicit at create; no separate event in v1. Audit `CREATED` instead.) |
| `QUOTATION_SHORTLISTED` | Shortlist action |
| `QUOTATION_REJECTED` | Manual reject or supersession |

## M05.13 Notifications

- `QUOTATION_SUBMITTED` → all officers and admins ("New quotation on RFQ X").
- `QUOTATION_SHORTLISTED` → all managers ("Approval requested on RFQ X").
- `QUOTATION_REJECTED` → vendor user who submitted the rejected quotation.
- `QUOTATION_SUPERSEDED` → vendor user of the superseded quotation (same channel as REJECTED with different reason).

## M05.14 Edge cases

| Scenario | Behavior |
|----------|----------|
| Vendor edits quotation after deadline | 409 `DEADLINE_PASSED` |
| Vendor edits quotation from another vendor | 403 `OWNERSHIP_DENIED` |
| Vendor edits a SHORTLISTED quotation | 409 `WORKFLOW_INVALID_TRANSITION` (shortlisted = locked) |
| Officer shortlists when a shortlist already exists | Old shortlist auto-rejected as `SUPERSEDED`; new one SHORTLISTED. |
| Officer shortlists a quotation on a CLOSED RFQ | 409 `WORKFLOW_INVALID_TRANSITION` |
| Two officers shortlist simultaneously | DB partial unique index serializes; second gets 409. |
| Vendor company is BLOCKED at edit time | 403 `VENDOR_INACTIVE` |
| Total amount mismatch (sum doesn't match stored) | Service recomputes; throws if mismatch (data integrity). |
| Officer views a vendor-portal-only field | 403 `FIELD_FORBIDDEN` |
| Vendor views another's quotation via direct ID | 403 `OWNERSHIP_DENIED` |

## M05.15 Future (not in v1)

- Quotation versions / history.
- Discounts and per-line taxes.
- Partial quotations (quote only some lines).
- Alternate offers (vendor offers two options per line).
- Negotiation / counter-offer messages.
- Multi-currency.
