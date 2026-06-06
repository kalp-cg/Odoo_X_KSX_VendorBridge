# M08 — Invoices

> Source of truth for Invoices. See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.7 and [10-BUSINESS-RULES.md](../10-BUSINESS-RULES.md) §10.5.

## M08.1 Purpose

- Generate an invoice automatically on PO creation.
- Apply a single tax rate (snapshot from config).
- Track invoice lifecycle: PENDING → PAID / OVERDUE.
- Provide print-ready and downloadable PDF.
- Send invoice via email (in v1, persist the email event; in v1.1, actually send).

## M08.2 Scope

**In scope**:
- Auto-generation of invoice on PO creation.
- Mark paid / overdue.
- Print, PDF download, email send (with audit).
- Vendor view (own invoices only).
- Search and filter.
- Auto-mark overdue (daily job + on-read check).

**Out of scope**:
- Multi-line taxes (CGST/SGST/IGST) — v1 uses a single tax rate.
- Discounts, credits, debit notes.
- Recurring invoices.
- Multi-currency.
- Payment gateway integration (we track status, not money flow).

## M08.3 Entities

- `Invoice`
- `InvoiceLineItem`
- `PaymentEvent` (append-only history of status changes).

## M08.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/invoices` | ADMIN, OFFICER, MANAGER (all); VENDOR (own) | Paginated, filterable |
| GET | `/api/v1/invoices/:id` | ADMIN, OFFICER, MANAGER (any); VENDOR (own) | Detail with line items, PO ref |
| GET | `/api/v1/invoices/:id/pdf` | ADMIN, OFFICER, MANAGER, VENDOR (own) | Server-rendered PDF |
| POST | `/api/v1/invoices/:id/print` | any auth (with ownership) | Logs a print event; returns 204 |
| POST | `/api/v1/invoices/:id/email` | ADMIN, OFFICER | Sends an email with the PDF (or logs in v1) |
| POST | `/api/v1/invoices/:id/mark-paid` | ADMIN, OFFICER | PENDING/OVERDUE → PAID |
| POST | `/api/v1/invoices/:id/mark-overdue` | ADMIN, OFFICER (or system) | PENDING → OVERDUE |

**Note**: there is no `POST /invoices` endpoint in v1. Invoices are auto-generated on PO creation (which itself is on approval). The explicit `mark-overdue` exists for manual override and for the daily job.

## M08.5 Service layer

```
invoices/
├── invoices.module.ts
├── controllers/
│   ├── invoices.controller.ts
│   ├── invoice-pdf.controller.ts
│   └── invoice-email.controller.ts
├── services/
│   ├── invoices.service.ts                  # list, get
│   ├── invoice-generate.service.ts          # called from PO/approval
│   ├── invoice-payment.service.ts           # mark paid/overdue
│   ├── invoice-overdue-job.service.ts       # daily cron
│   ├── invoice-pdf.service.ts
│   ├── invoice-email.service.ts             # pluggable
│   ├── invoice-totals.service.ts            # subtotal/tax/total math
│   └── invoice-number.service.ts            # auto-numbering
├── repositories/
│   └── invoices.repository.ts
├── workflow.ts                                # status state machine
├── dto/
│   ├── list-invoices.dto.ts
│   ├── mark-paid.dto.ts                      # optional paidAt, paymentReference
│   ├── mark-overdue.dto.ts
│   ├── email-invoice.dto.ts                  # optional recipient override
│   └── invoice-response.dto.ts
└── tests/
```

## M08.6 Workflow

```
PENDING ──markPaid──▶ PAID  (terminal)
PENDING ──(system/manual)──▶ OVERDUE
OVERDUE ──markPaid──▶ PAID  (terminal)
```

State machine function: `assertInvoiceTransition(from, to)`.

| From | To | Allowed |
|------|----|---------|
| PENDING | PAID | ✅ (ADMIN, OFFICER) |
| PENDING | OVERDUE | ✅ (system or ADMIN/OFFICER) |
| OVERDUE | PAID | ✅ (ADMIN, OFFICER) |
| PAID | * | ❌ (terminal) |
| * | PENDING | ❌ (no revert) |

## M08.7 Auto-numbering

`invoiceNumber` format: `INV-YYYY-NNNN` (per calendar year, monotonic). Same pattern as PO numbering.

## M08.8 Generation (on PO)

Called from the approval service (which also calls the PO generator) in the same transaction. The flow is:

1. Approval approved.
2. `PurchaseOrderService.generate(quotationId)` → returns PO.
3. `InvoiceService.generateFromPo(poId)` → returns Invoice.

The invoice service:

1. Generates `invoiceNumber`.
2. Reads the PO (line items, total, tax rate).
3. Inserts `Invoice`:
   - `purchaseOrderId` (unique — one invoice per PO).
   - `vendorCompanyId` (from PO).
   - `status = PENDING`.
   - `subtotal` = sum of line totals from PO.
   - `taxRate` = snapshot from PO.
   - `taxAmount` = `subtotal * (taxRate / 100)`.
   - `totalAmount` = `subtotal + taxAmount`.
   - `dueDate` = today + 30 days (configurable).
4. Inserts `InvoiceLineItem` rows (mirroring `POLineItem`).
5. Returns the invoice.

The whole flow is in **one transaction** with the approval transition.

## M08.9 Mark paid

`POST /api/v1/invoices/:id/mark-paid`:

- Body: `{ paidAt?: string (ISO date), paymentReference?: string, note?: string }`.
- Status transition: `PENDING` → `PAID` or `OVERDUE` → `PAID`.
- Sets `paidAt` (default: now).
- Inserts a `PaymentEvent` row.
- Audit: `INVOICE_PAID`.
- Notification: officer, vendor, admin.
- Idempotent: re-marking a PAID invoice returns 200, no audit, no notification.

## M08.10 Mark overdue

`POST /api/v1/invoices/:id/mark-overdue`:

- Status transition: `PENDING` → `OVERDUE`.
- Inserts a `PaymentEvent` row.
- Audit: `INVOICE_OVERDUE`.
- Notification: officer, admin.

A **daily job** runs at 00:00 server time:

```sql
UPDATE invoices
SET status = 'OVERDUE', updated_at = now()
WHERE status = 'PENDING' AND due_date < current_date;
```

This is best-effort. Additionally, an **on-read check** flips `PENDING → OVERDUE` when the invoice is loaded and `dueDate < today` and `status = PENDING`. Defense in depth.

The job and the on-read check both write a `PaymentEvent` and an audit log entry, but with a dedup mechanism (do nothing if the latest event already moved to OVERDUE) to avoid duplicate notifications.

## M08.11 PDF

Server-rendered with `@react-pdf/renderer`.

The PDF includes:
- Header: VendorBridge branding, "INVOICE" title, invoice number.
- Vendor (seller) info: legalName, address, GSTIN.
- Buyer info: from config.
- Bill-to: same as buyer in v1.
- Invoice metadata: invoice number, PO number, RFQ number, issue date, due date.
- Line items table: description, quantity, unit, unit price, line total.
- Subtotal.
- Tax: rate %, amount.
- Total.
- Payment status badge.
- Notes / bank details (configurable).
- Signature line.

Returned as `application/pdf` with `Content-Disposition: inline; filename="INV-XXXX.pdf"`.

## M08.12 Email

`POST /api/v1/invoices/:id/email`:

- Body: `{ recipient?: string }`. If absent, sends to the vendor's `contactEmail`.
- Renders the PDF.
- Sends via the configured `EMAIL_PROVIDER`:
  - `console` (v1): logs the email subject, recipient, and a marker; persists `emailedAt` on the invoice.
  - `sendgrid` / `ses` (v1.1): actually sends with PDF attachment.
- Sets `emailedAt = now()` on the invoice.
- Audit: `INVOICE_EMAILED`.
- Idempotent at the audit level: re-sending within 60 seconds is a no-op (no audit, no `emailedAt` update). Beyond 60 seconds, a new email is sent (with a new audit entry).
- Returns: `{ success: true, data: { emailedAt, recipient, provider } }`.

**Failure handling**: if the email send fails, the response is 200 with a warning field (e.g., `data.warning: 'Email not sent; logged for retry'`). The business operation succeeds.

## M08.13 Print

`POST /api/v1/invoices/:id/print`:

- Returns 204.
- Audit: `INVOICE_PRINTED`.
- The actual print is via `window.print()` on the frontend with CSS `@media print`.

## M08.14 Audit events

| Event | Trigger |
|-------|---------|
| `INVOICE_GENERATED` | Auto on PO |
| `INVOICE_PAID` | Mark paid |
| `INVOICE_OVERDUE` | System job or manual |
| `INVOICE_EMAILED` | Email action |
| `INVOICE_PRINTED` | Print endpoint |

## M08.15 Notifications

- `INVOICE_GENERATED` → officer, vendor, admin.
- `INVOICE_PAID` → officer, vendor, admin.
- `INVOICE_OVERDUE` → officer, admin (NOT vendor — internal escalation).
- `INVOICE_EMAILED` → none (action confirmation only; the email itself is the notification).

## M08.16 Edge cases

| Scenario | Behavior |
|----------|----------|
| Mark paid on a PAID invoice | 200, no audit, no notification |
| Mark paid twice in quick succession | First wins; second is a no-op |
| Mark overdue on an OVERDUE invoice | 200, no audit (idempotent) |
| Mark overdue on a PAID invoice | 409 `WORKFLOW_INVALID_TRANSITION` |
| Email send fails (SMTP down) | 200 with `warning` field; `emailedAt` not set; the dispatcher retries later |
| PDF download fails | 500; the invoice state is unaffected |
| Tax rate changes after generation | Invoice is unaffected (snapshot) |
| Vendor tries to mark another's invoice paid | 403 `OWNERSHIP_DENIED` |
| Vendor views invoice after status changes to PAID | Allowed; vendor can see payment status |
| Invoice for a deleted PO | Not possible — PO is never deleted. |
| Concurrent mark paid + mark overdue | First wins; second is a no-op (already PAID / OVERDUE). |
| `dueDate` in the past at creation | Allowed (admin override). Status will be flipped to OVERDUE on the next job tick. |

## M08.17 Future (not in v1)

- Multi-line taxes (GST split).
- Discounts and credit / debit notes.
- Partial payments.
- Payment gateway integration (Stripe, Razorpay).
- Recurring invoices.
- Customer portal (in v1, vendor can view but cannot "pay" the invoice).
- Multi-currency.
