# M07 — Purchase Orders

> Source of truth for Purchase Orders. See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.6 and [10-BUSINESS-RULES.md](../10-BUSINESS-RULES.md) §10.4.

## M07.1 Purpose

- Generate a Purchase Order automatically on approval of a quotation.
- Track PO lifecycle: GENERATED → SENT → DELIVERED.
- Provide a print-ready, downloadable PO.
- Mirror PO state to vendors and officers.

## M07.2 Scope

**In scope**:
- Auto-generation of PO on approval (in approval transaction).
- Manual status transitions (send, mark delivered).
- Print and PDF.
- Vendor can mark their own PO as delivered.
- Search and filter.
- Audit + notifications.

**Out of scope**:
- PO amendments / revisions (planned v1.1 — would create a new "PO version" linked to the original).
- Partial deliveries.
- Goods Received Notes (planned v2).
- Multi-currency.

## M07.3 Entities

- `PurchaseOrder`
- `POLineItem`
- Indirect: `Quotation`, `RFQ`, `VendorCompany`, `Approval`.

## M07.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/purchase-orders` | ADMIN, OFFICER, MANAGER (all); VENDOR (own) | Paginated |
| GET | `/api/v1/purchase-orders/:id` | ADMIN, OFFICER, MANAGER (any); VENDOR (own) | Detail |
| GET | `/api/v1/purchase-orders/:id/pdf` | ADMIN, OFFICER, MANAGER, VENDOR (own) | Server-rendered PDF |
| POST | `/api/v1/purchase-orders/:id/send` | ADMIN, OFFICER | GENERATED → SENT |
| POST | `/api/v1/purchase-orders/:id/mark-delivered` | ADMIN, OFFICER, VENDOR (own) | SENT → DELIVERED |
| GET | `/api/v1/purchase-orders/:id/print` | any auth (with ownership) | Logs a print event; returns a print-friendly HTML or 204 |

**Note**: there is no `POST /purchase-orders` endpoint in v1. POs are created automatically on approval. (Manual creation by admin is planned v1.1.)

## M07.5 Service layer

```
purchase-orders/
├── purchase-orders.module.ts
├── controllers/
│   ├── purchase-orders.controller.ts
│   └── purchase-order-pdf.controller.ts
├── services/
│   ├── purchase-orders.service.ts           # list, get
│   ├── purchase-order-generate.service.ts   # called from approval service
│   ├── purchase-order-send.service.ts
│   ├── purchase-order-deliver.service.ts
│   ├── purchase-order-pdf.service.ts
│   └── po-number.service.ts                  # auto-numbering
├── repositories/
│   └── purchase-orders.repository.ts
├── workflow.ts                                # status state machine
├── dto/
│   ├── list-pos.dto.ts
│   ├── po-response.dto.ts
│   └── po-line-item.dto.ts
└── tests/
```

## M07.6 Workflow

```
GENERATED ──send──▶ SENT
SENT ──markDelivered──▶ DELIVERED
```

State machine function: `assertPoTransition(from, to)`.

| From | To | Allowed |
|------|----|---------|
| GENERATED | SENT | ✅ (ADMIN, OFFICER) |
| SENT | DELIVERED | ✅ (ADMIN, OFFICER, VENDOR-own) |
| GENERATED | DELIVERED | ❌ (must go through SENT) |
| DELIVERED | * | ❌ (terminal) |
| SENT | GENERATED | ❌ (no revert) |
| GENERATED | * (other) | ❌ |

## M07.7 Auto-numbering

`poNumber` format: `PO-YYYY-NNNN` (per calendar year, monotonic).

Same pattern as RFQ numbering (see [M04-RFQ.md](M04-RFQ.md) §M04.8) — a `counters` table.

## M07.8 Generation (on approval)

Called from the approval service inside the approval transaction.

Inputs:
- `quotationId` (the accepted quotation).
- `approvalId`.
- `rfqId`.
- `vendorCompanyId`.
- Line items: copied from `quotation.lineItems`.
- `taxRate`: read from system config (`config.invoice.defaultTaxRate`, default 0). Snapshotted onto the PO.
- `totalAmount`: sum of line totals (no tax on the PO row; tax is computed on the invoice).

The service:

1. Generates `poNumber`.
2. Inserts `PurchaseOrder` with `status = GENERATED`.
3. Inserts `POLineItem` rows.
4. Returns the PO id.
5. The approval service then calls the invoice generator (see [M08-INVOICES.md](M08-INVOICES.md)) in the same transaction.

## M07.9 Send (GENERATED → SENT)

- Allowed only for ADMIN or OFFICER.
- Updates `status = SENT`, sets `sentAt = now()`.
- Triggers notification to vendor (`PO_SENT`).
- Audit: `PO_SENT`.
- Idempotent: re-sending a SENT PO is a no-op (returns 200, does not re-audit, does not re-notify).

## M07.10 Mark delivered (SENT → DELIVERED)

- Allowed for ADMIN, OFFICER, or VENDOR (own PO only).
- Updates `status = DELIVERED`, sets `deliveredAt = now()`.
- Audit: `PO_DELIVERED`. Metadata includes `markedByRole`.
- Notification to officer and admin.

## M07.11 PDF

Server-rendered with `@react-pdf/renderer` (in Node, on the API).

The PDF includes:
- Header: company logo (configurable), VendorBridge title, PO number.
- Vendor info: legalName, address, GSTIN.
- Buyer info: company info from config.
- PO metadata: rfqNumber, quotationNumber, approvalId, issue date, delivery date.
- Line items table: description, quantity, unit, unit price, line total.
- Subtotal, tax rate, tax amount, total.
- Notes / terms (configurable).
- Signature lines (placeholder).

Returned as `application/pdf` with `Content-Disposition: inline; filename="PO-XXXX.pdf"`.

## M07.12 Print

`GET /api/v1/purchase-orders/:id/print` returns:

- 204 No Content + an audit log entry (`PO_PRINTED`).

The actual print is handled by the browser print dialog from the PO detail screen. The endpoint exists for audit traceability.

## M07.13 Audit events

| Event | Trigger |
|-------|---------|
| `PO_GENERATED` | Auto on approval |
| `PO_SENT` | Send action |
| `PO_DELIVERED` | Mark delivered |
| `PO_PRINTED` | Print endpoint called |

## M07.14 Notifications

- `PO_GENERATED` → officer, vendor, admin.
- `PO_SENT` → vendor.
- `PO_DELIVERED` → officer, admin.

## M07.15 Edge cases

| Scenario | Behavior |
|----------|----------|
| Mark delivered on a GENERATED PO | 409 `WORKFLOW_INVALID_TRANSITION` |
| Mark delivered twice | Second is a no-op (returns 200, no audit). |
| Mark sent twice | Same — idempotent. |
| Vendor tries to mark another's PO delivered | 403 `OWNERSHIP_DENIED` |
| PO PDF generation fails | Returns 500; the PO itself is unaffected. (PDF is a view, not state.) |
| Tax rate changes after generation | The PO and Invoice are unaffected; they snapshot the rate at generation. |
| PO has no line items | Impossible — generated from a quotation, which requires ≥1 line item. |
| Approval rolled back after PO generation | The transaction rolls back; nothing is created. |
| Concurrent send + mark delivered | First wins; second gets 409. |
| Two officers try to mark the same PO delivered simultaneously | First wins; second is a no-op (already DELIVERED). |
| PO referenced in dispute (v1.1) | Out of v1 scope. |

## M07.16 Future (not in v1)

- PO amendments (versioned POs).
- Partial deliveries.
- GRN (Goods Received Note) integration.
- PO comments / activity per PO.
- Email the PO to vendor (in addition to in-app notification).
- Print history.
