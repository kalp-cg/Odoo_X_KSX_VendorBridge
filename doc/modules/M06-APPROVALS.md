# M06 — Approvals

> Source of truth for the approval workflow and SoD enforcement. See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.5 and [10-BUSINESS-RULES.md](../10-BUSINESS-RULES.md) §10.3.

## M06.1 Purpose

- Implement the manager approval gate.
- Enforce Separation of Duties: the officer who shortlists cannot be the manager who approves.
- On approval, atomically transition the quotation to `ACCEPTED`, generate a Purchase Order, and generate an Invoice.
- On rejection, transition the quotation to `REJECTED` and allow the officer to shortlist another.

## M06.2 Scope

**In scope**:
- Approval queue (list of pending approvals for managers).
- Approve action (with SoD check).
- Reject action (with mandatory remarks).
- Auto-creation of PO and Invoice on approval (in the same transaction).
- Audit + notifications.

**Out of scope**:
- Multi-step approvals (planned v2; v1 has a single approver per shortlist).
- Approval delegation.
- Approval on behalf of someone else.
- Auto-approval rules.

## M06.3 Entities

- `Approval`
- Indirectly: `Quotation`, `PurchaseOrder`, `Invoice` (created as side effects).

## M06.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/approvals` | ADMIN, OFFICER, MANAGER | List; managers see pending+history; officers/admins see all |
| GET | `/api/v1/approvals/:id` | ADMIN, OFFICER, MANAGER | Detail with RFQ + quotation context |
| POST | `/api/v1/approvals/:id/approve` | MANAGER | Approve. SoD: user ≠ shortlister. |
| POST | `/api/v1/approvals/:id/reject` | MANAGER | Reject. Remarks required. SoD: user ≠ shortlister. |

**Note**: there is no `POST /approvals` endpoint. Approvals are created automatically when an officer shortlists a quotation (in the quotation module's transaction). See [M05-QUOTATIONS.md](M05-QUOTATIONS.md) §M05.9.

## M06.5 Service layer

```
approvals/
├── approvals.module.ts
├── controllers/
│   └── approvals.controller.ts
├── services/
│   ├── approvals.service.ts           # list, get
│   ├── approval-approve.service.ts    # approve workflow + side effects
│   ├── approval-reject.service.ts     # reject workflow
│   └── approval-validator.service.ts  # SoD + status checks
├── repositories/
│   └── approvals.repository.ts
├── workflow.ts                         # status state machine
├── dto/
│   ├── list-approvals.dto.ts
│   ├── approve.dto.ts                  # optional remarks on approval
│   ├── reject.dto.ts                   # remarks required
│   └── approval-response.dto.ts
└── tests/
```

## M06.6 Workflow

```
PENDING ──approve──▶ APPROVED  (terminal)
PENDING ──reject───▶ REJECTED   (terminal, requires remarks)
```

State machine function: `assertApprovalTransition(from, to)`.

| From | To | Allowed |
|------|----|---------|
| PENDING | APPROVED | ✅ (MANAGER, not shortlister) |
| PENDING | REJECTED | ✅ (MANAGER, not shortlister, remarks required) |
| APPROVED | * | ❌ (terminal) |
| REJECTED | * | ❌ (terminal) |

## M06.7 Approval lifecycle (full)

1. **Officer shortlists a quotation** → `Approval(PENDING)` is created in the quotation service's transaction. The approval references the RFQ, the quotation, the shortlister (officer), and has `status = PENDING`.
2. **Manager sees the approval** in their queue.
3. **Manager approves** (transaction):
   - SoD check: `approverId !== shortlistedById`.
   - Update `Approval.status = APPROVED`, set `approverId`, `decidedAt`.
   - Update `Quotation.status = ACCEPTED`.
   - **Generate PurchaseOrder** with auto `poNumber`, copy line items from quotation, set `status = GENERATED`.
   - **Generate Invoice** from PO: copy line items, compute tax, set `status = PENDING`, `dueDate = today + 30 days`.
   - Audit: `APPROVAL_APPROVED`, `QUOTATION_ACCEPTED` (part of APPROVAL_APPROVED metadata), `PO_GENERATED`, `INVOICE_GENERATED`.
   - Notifications: officer, vendor, admin.
4. **Manager rejects** (transaction):
   - SoD check.
   - Remarks required (≥ 5 chars).
   - Update `Approval.status = REJECTED`, set `approverId`, `decidedAt`, `remarks`.
   - Update `Quotation.status = REJECTED`.
   - Audit: `APPROVAL_REJECTED`, `QUOTATION_REJECTED`.
   - Notification: officer (with remarks).
   - The officer can then shortlist another quotation, which creates a new `Approval(PENDING)`.

## M06.8 Validation rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-030 | Approval created on shortlist | Quotation service |
| BR-031 | Approver ≠ shortlister (SoD) | Approval service |
| BR-032 | One active approval per RFQ | DB partial unique + service |
| BR-033 | Reject requires non-empty remarks (≥ 5 chars) | Zod + service |
| BR-034 | Approved/Rejected are terminal | Workflow function |
| BR-035 | PO + Invoice generated on approval, in same transaction | Approval service |
| BR-036 | On reject, quotation is rejected; officer can shortlist another | Approval + Quotation service |

## M06.9 SoD enforcement

```ts
// pseudocode
if (approval.shortlistedById === currentUser.id) {
  throw new WorkflowException('SoD_VIOLATION', 'You cannot approve your own shortlist');
}
```

This is enforced in the service layer, not in the guard. The guard checks role; the service checks SoD.

Edge cases:

- A manager who is also an officer (if allowed) is still subject to SoD.
- An admin (who is not the shortlister) can approve on behalf of a manager? **No, in v1 only `MANAGER` role can approve.** Admin can only view.

## M06.10 Approval queue UX

For managers, the queue is:

- Pending: list of `PENDING` approvals.
- History: list of `APPROVED` and `REJECTED` approvals.

Filters: `?from=2026-01-01&to=...&status=PENDING&shortlistedById=...&myActions=true`.

The "my actions" filter shows only approvals where `approverId = currentUser.id` (i.e., this manager's history). For pending, it's all PENDING.

## M06.11 Approve payload

```ts
// POST /api/v1/approvals/:id/approve
// Body: { remarks?: string }   // optional on approval
```

Remarks on approval are optional. They are stored on the approval row and appear in the audit metadata.

## M06.12 Reject payload

```ts
// POST /api/v1/approvals/:id/reject
// Body: { remarks: string }    // required, min 5 chars
```

Remarks are stored on the approval row, in the audit metadata, and in the notification body.

## M06.13 Side effects — PO and Invoice creation

On approval, the service creates a PurchaseOrder and Invoice in the same transaction as the approval transition. This is atomic.

- The PO's line items are copied from the accepted quotation.
- The PO's `taxRate` defaults to the system setting (`config.invoice.defaultTaxRate`, default 0 in v1; can be set in admin settings). The tax rate is a single percentage applied to the subtotal.
- The Invoice mirrors the PO.
- See [M07-PURCHASE-ORDERS.md](M07-PURCHASE-ORDERS.md) and [M08-INVOICES.md](M08-INVOICES.md) for details.

## M06.14 Audit events

| Event | Trigger |
|-------|---------|
| `APPROVAL_REQUESTED` | Auto-create on shortlist |
| `APPROVAL_APPROVED` | Manager approves |
| `APPROVAL_REJECTED` | Manager rejects |
| `QUOTATION_ACCEPTED` | Part of approval (audit metadata) |
| `QUOTATION_REJECTED` | Part of approval reject |
| `PO_GENERATED` | Auto on approval |
| `INVOICE_GENERATED` | Auto on approval |

## M06.15 Notifications

- `APPROVAL_REQUESTED` → all managers.
- `APPROVAL_APPROVED` → officer (shortlister), vendor, admin.
- `APPROVAL_REJECTED` → officer (shortlister), with remarks in the body. Vendor and admin are **not** notified on rejection (internal-only).

## M06.16 Edge cases

| Scenario | Behavior |
|----------|----------|
| Manager approves a non-PENDING approval | 409 `WORKFLOW_INVALID_TRANSITION` |
| Manager approves their own shortlist | 409 `SoD_VIOLATION` |
| Manager rejects without remarks | 400 `VALIDATION_FAILED` (Zod) |
| Manager rejects with 4-char remarks | 400 `VALIDATION_FAILED` |
| Officer views approval queue | Sees all approvals but cannot act on them |
| Manager views a different RFQ's approval (e.g., for an RFQ they are not assigned to) | Allowed. Managers can see all approvals. |
| Concurrent approval and rejection | DB row-level lock; second one fails with 409 |
| PO generation fails (e.g., tax rate invalid) | Whole transaction rolls back. Approval stays `PENDING`. |
| Invoice generation fails | Same as above. |
| Manager is the only approver, but they're the shortlister | 409 `SoD_VIOLATION`. The officer must withdraw the shortlist (admin only) and shortlist another quotation, OR admin must perform an out-of-band action (v1.1: admin override with double-confirm). |
| Approval exists, but the underlying quotation was somehow directly mutated (e.g., by a buggy script) | Approval references the quotation id; the transaction re-reads the quotation to confirm status. If it's not `SHORTLISTED`, fail. |

## M06.17 Future (not in v1)

- Multi-step approvals (L1 manager, L2 director, etc.).
- Approval delegation (a manager can delegate their queue to another user for a date range).
- Approval rules engine (auto-approve if total < $X).
- Manager-level approval limits (e.g., manager can approve up to $10k; above requires director).
- "Resubmit" — officer edits a shortlist after rejection (without going through the full shortlist action).
- Slack / email integration for the approval queue.
