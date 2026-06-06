# 10 — Business Rules

This document consolidates **every business rule** the system enforces. Rules are sourced from the problem statement, `AGENTS.md`, and clarifications. Each rule has a unique code (`BR-001`, `BR-002`, …) for traceability in code, tests, and audit logs.

## 10.1 RFQ rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-001 | RFQ must have at least one vendor before publish. | RFQ service, DB CHECK |
| BR-002 | RFQ must have at least one line item before publish. | RFQ service |
| BR-003 | RFQ deadline must be in the future at creation and at publish. | RFQ service |
| BR-004 | Only the creator (or admin) can edit a DRAFT RFQ. | RFQ service |
| BR-005 | A DRAFT RFQ can be edited freely; a PUBLISHED RFQ is read-only except for status transitions. | RFQ service |
| BR-006 | A published RFQ cannot revert to DRAFT. | Workflow function |
| BR-007 | Cancelling a published RFQ auto-rejects all open quotations. | RFQ service (transaction) |
| BR-008 | Closing a published RFQ auto-rejects remaining open quotations. | RFQ service (transaction) |
| BR-009 | RFQ deadline is immutable after publish (in v1; could be relaxed with audit). | RFQ service |
| BR-010 | A vendor with status `PENDING_VERIFICATION`, `INACTIVE`, or `BLOCKED` cannot be assigned to a new RFQ. | RFQ service |

## 10.2 Quotation rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-020 | A vendor can submit only one quotation per RFQ. (Unique constraint.) | DB unique + service |
| BR-021 | A vendor can submit a quotation only if the RFQ is `PUBLISHED`. | Quotation service |
| BR-022 | A vendor can submit a quotation only if the RFQ deadline is in the future. | Quotation service |
| BR-023 | A vendor can submit a quotation only if their VendorCompany is `ACTIVE`. | Quotation service |
| BR-024 | A vendor can edit a quotation only while its status is `SUBMITTED` AND `editableUntil > now()`. | Quotation service |
| BR-025 | Total amount is computed from line items and stored on the quotation. | Service computes |
| BR-026 | A quotation cannot be unsubmitted; once submitted, it stays in the lifecycle. | Workflow function |
| BR-027 | Only one quotation per RFQ can be `SHORTLISTED` at any time. | DB partial unique index + service |
| BR-028 | Selecting a new shortlist auto-rejects the previous shortlist (if any) with note "Superseded". | Quotation service (transaction) |

## 10.3 Approval rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-030 | An approval is created automatically when an officer shortlists a quotation. | Quotation service |
| BR-031 | The approver cannot be the same user who shortlisted. (SoD.) | Approval service |
| BR-032 | Only one active (`PENDING` or `APPROVED`) approval per RFQ. | DB partial unique index |
| BR-033 | Rejection requires a non-empty `remarks` field (min 5 chars). | Approval service (Zod + service) |
| BR-034 | An approval is terminal on approve or reject; no further transitions. | Workflow function |
| BR-035 | On approval, a PO and Invoice are generated in the same transaction. | Approval service (transaction) |
| BR-036 | On rejection, the corresponding quotation is rejected. The officer may shortlist another, creating a new approval. | Approval service |

## 10.4 Purchase Order rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-040 | A PO is generated only on approval. | Service guard |
| BR-041 | A PO has a unique, auto-generated PO number. Format: `PO-YYYY-NNNN` per year. | Service |
| BR-042 | A PO has exactly one associated accepted quotation. | DB unique on `quotationId` |
| BR-043 | A PO can be marked `SENT` only from `GENERATED`. | Workflow function |
| BR-044 | A PO can be marked `DELIVERED` only from `SENT`. | Workflow function |
| BR-045 | A vendor can mark only their own PO as delivered. | Ownership check |
| BR-046 | A `DELIVERED` PO is immutable. | Workflow function (no transitions out) |

## 10.5 Invoice rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-050 | An invoice is generated for a PO at most once. (Unique `purchaseOrderId`.) | DB unique |
| BR-051 | An invoice has a unique, auto-generated invoice number. Format: `INV-YYYY-NNNN`. | Service |
| BR-052 | The invoice tax rate is snapshotted from PO configuration at generation. | Service |
| BR-053 | `taxAmount = subtotal * (taxRate / 100)`. | Service (server-computed) |
| BR-054 | `totalAmount = subtotal + taxAmount`. | Service (server-computed) |
| BR-055 | `dueDate` is set at invoice creation (default 30 days from issue). | Service |
| BR-056 | An invoice moves to `OVERDUE` automatically when `dueDate < now()` and status is `PENDING`. | System job + on-read check |
| BR-057 | `PAID` is terminal. | Workflow function |
| BR-058 | Sending an email is a separate event; it does not change invoice status. | Service |
| BR-059 | A vendor can only view their own invoices. | Ownership check |
| BR-060 | A vendor cannot mark invoices as `PAID` or `OVERDUE`; only officer/admin can. | RBAC + service |

## 10.6 Vendor rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-070 | Only `ACTIVE` vendors can be assigned to a new RFQ. | RFQ service |
| BR-071 | Only `ACTIVE` vendors can submit quotations. | Quotation service |
| BR-072 | Vendor status transitions are admin-only. | RBAC |
| BR-073 | Blocking a vendor does not affect their in-flight quotations (they remain submittable until deadline). | Service |
| BR-074 | A vendor can view only their own RFQs, quotations, POs, and invoices. | Ownership check |
| BR-075 | GST number, if provided, must be a valid GSTIN format (15 chars, alphanumeric). | Validation |

## 10.7 User rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-080 | Email must be unique across users. | DB unique |
| BR-081 | Password minimum length: 8 characters. Must include at least one letter and one number. | Auth service |
| BR-082 | An `INACTIVE` user cannot log in. | Auth service |
| BR-083 | A `SUSPENDED` user cannot log in. | Auth service |
| BR-084 | Admin cannot self-elevate to bypass audit (admin cannot modify audit logs). | DB triggers |
| BR-085 | Only admin can change another user's role. | RBAC |

## 10.8 Audit & notification rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-090 | Every critical action writes exactly one audit log entry. | Service (mandatory call) |
| BR-091 | Audit logs are append-only. UPDATE/DELETE/SOFT-DELETE forbidden. | DB triggers + no app code |
| BR-092 | Notification failures must not block business operations. | Notification service (try/catch + log) |
| BR-093 | Notifications are created in the same transaction as the business event when possible; otherwise, asynchronously with at-least-once delivery guarantee. | Service |

## 10.9 Reporting rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-100 | Reports derive data from RFQ, Quotation, PurchaseOrder, Invoice. | Service (joins) |
| BR-101 | Vendor performance metrics (rating, on-time delivery) are computed on read, not stored. | Service |
| BR-102 | A vendor can only see reports scoped to their own data. | Ownership filter |
| BR-103 | Date range is required for trend reports. | DTO validation |

## 10.10 Cross-cutting rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-110 | All state transitions happen inside a DB transaction. | Service |
| BR-111 | Audit log write is in the same transaction as the state change (atomicity). | Service |
| BR-112 | Notification creation is best-effort and in-transaction when possible; on failure, log and continue. | Service |
| BR-113 | Every external input is validated server-side. | Zod + class-validator |
| BR-114 | Frontend permissions are convenience only; backend is the source of truth. | Architecture |
| BR-115 | Error responses never leak stack traces, SQL, or internal structure. | Global filter |

## 10.11 Rule traceability

Each rule has:

- A unique `BR-xxx` code referenced in:
  - Unit tests (test name includes the code)
  - Integration tests (test name includes the code)
  - Code comments (e.g., `// BR-001`)
  - Audit metadata (when the rule is enforced as a side effect of a logged event)

When a rule is changed, every reference must be updated.
