# 07 — Data Model

The Prisma schema is the **single source of truth** for the database. This document provides a textual ER diagram, entity descriptions, and indexing strategy. For the exact schema, see `apps/api/prisma/schema.prisma`.

## 7.1 Entity overview

```
User ─┬─< UserRole (M:N) >─ Role
      └─1:1 VendorUser ─1:1──> VendorCompany
                └─< RFQVendor (M:N) >── RFQ
                                          │
VendorCompany ─< Quotation ────────────────┘
                       │
                       └──< Approval ─> User (manager)
                                          │
                                          ▼
                                   PurchaseOrder ─> VendorCompany
                                          │
                                          ▼
                                      Invoice
                                          │
                                          ▼
                                   PaymentEvent

Notification ─> User
AuditLog     ─> User
FileAsset    ─> Owner (polymorphic: RFQ / VendorCompany / etc.)
```

## 7.2 Entities

### User

Identity record for everyone who logs in (admin, officer, manager, vendor user).

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| email | citext | unique, lower-cased |
| passwordHash | text | argon2id |
| fullName | text | |
| phone | text | nullable |
| status | enum | `INACTIVE`, `ACTIVE`, `SUSPENDED`, `DEACTIVATED` |
| vendorCompanyId | uuid? | FK → VendorCompany, nullable. Set only if this is a vendor user. |
| createdAt, updatedAt | timestamptz | |

Indexes: `email (unique)`, `vendorCompanyId`, `status`.

### Role

Static roles. Stored in a `roles` table for FK integrity and to allow future per-role config.

- `ADMIN`
- `PROCUREMENT_OFFICER`
- `MANAGER`
- `VENDOR`

A user can have multiple roles in principle (e.g., an officer who is also a manager), but in practice a user has exactly one role in v1. Schema allows M:N to keep the door open.

### VendorCompany

A vendor is a company, not a user. The vendor's employees are `User` records linked via `vendorCompanyId`.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| legalName | text | |
| displayName | text | |
| gstNumber | text? | optional GSTIN |
| panNumber | text? | optional PAN |
| category | text | e.g., "IT", "Stationery" |
| address | jsonb | structured address |
| contactEmail | text | |
| contactPhone | text | |
| status | enum | `PENDING_VERIFICATION`, `ACTIVE`, `INACTIVE`, `BLOCKED` |
| rating | numeric(3,2) | 0.00–5.00, default 0, updated by reports |
| createdAt, updatedAt | timestamptz | |

Indexes: `status`, `category`, `gstNumber`, `legalName` (trigram for search).

### RFQ (Request For Quotation)

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| rfqNumber | text | auto-generated, unique, e.g., `RFQ-2026-0001` |
| title | text | |
| description | text | |
| status | enum | `DRAFT`, `PUBLISHED`, `CLOSED`, `CANCELLED` |
| deadline | timestamptz | must be > now() at creation/publish |
| createdById | uuid | FK → User |
| publishedAt | timestamptz? | |
| closedAt | timestamptz? | |
| cancelledAt | timestamptz? | |
| createdAt, updatedAt | timestamptz | |

Indexes: `status`, `createdById`, partial index `deadline WHERE status = 'PUBLISHED'`, `rfqNumber (unique)`.

### RFQLineItem

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| rfqId | uuid | FK → RFQ |
| description | text | |
| quantity | numeric(12,2) | |
| unit | text | e.g., "pcs", "kg" |
| targetUnitPrice | numeric(14,2)? | optional |

Indexes: `rfqId`.

### RFQVendor (M:N)

| Field | Type | Notes |
|-------|------|-------|
| rfqId | uuid | FK |
| vendorCompanyId | uuid | FK |
| invitedAt | timestamptz | |

PK: `(rfqId, vendorCompanyId)`. Index: `vendorCompanyId` (for vendor portal lookups).

### Quotation

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| quotationNumber | text | unique, auto, e.g., `QUO-2026-0001-3` (rfq-vendor index) |
| rfqId | uuid | FK |
| vendorCompanyId | uuid | FK |
| submittedById | uuid | FK → User (the vendor user who submitted) |
| status | enum | `SUBMITTED`, `SHORTLISTED`, `ACCEPTED`, `REJECTED` |
| totalAmount | numeric(14,2) | computed from line items |
| estimatedDeliveryDate | date | |
| notes | text | |
| editableUntil | timestamptz | denormalized: same as RFQ.deadline. Set at submission. |
| createdAt, updatedAt | timestamptz | |

Constraints: unique `(rfqId, vendorCompanyId)` — one quotation per vendor per RFQ.
Indexes: `rfqId`, `vendorCompanyId`, `status`, `(rfqId, status)`.

### QuotationLineItem

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| quotationId | uuid | FK |
| rfqLineItemId | uuid | FK → RFQLineItem (links to the RFQ's line) |
| unitPrice | numeric(14,2) | |
| quantity | numeric(12,2) | copied from RFQ line, editable |
| lineTotal | numeric(14,2) | computed |

Indexes: `quotationId`.

### Approval

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| rfqId | uuid | FK |
| quotationId | uuid | FK |
| shortlistedById | uuid | FK → User (officer) |
| approverId | uuid? | FK → User (manager) — null until acted on |
| status | enum | `PENDING`, `APPROVED`, `REJECTED` |
| remarks | text | **mandatory if REJECTED** |
| createdAt | timestamptz | |
| decidedAt | timestamptz? | |

Constraints: unique `(rfqId)` — only one active approval per RFQ at a time. A new approval can be created if a previous one is rejected (then the officer can shortlist another). To support this, we use a unique partial index `(rfqId) WHERE status IN ('PENDING', 'APPROVED')`.
Indexes: `status`, `quotationId`, `shortlistedById`, `approverId`.

### PurchaseOrder

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| poNumber | text | unique, auto, e.g., `PO-2026-0001` |
| rfqId | uuid | FK |
| quotationId | uuid | FK (the accepted one) |
| approvalId | uuid | FK |
| vendorCompanyId | uuid | FK |
| status | enum | `GENERATED`, `SENT`, `DELIVERED` |
| totalAmount | numeric(14,2) | from quotation |
| taxRate | numeric(5,2) | snapshot at PO time |
| sentAt | timestamptz? | |
| deliveredAt | timestamptz? | |
| createdAt, updatedAt | timestamptz | |

Indexes: `poNumber (unique)`, `status`, `vendorCompanyId`, `rfqId`.

### POLineItem

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| purchaseOrderId | uuid | FK |
| description | text | |
| quantity | numeric(12,2) | |
| unitPrice | numeric(14,2) | |
| lineTotal | numeric(14,2) | |

### Invoice

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| invoiceNumber | text | unique, auto, e.g., `INV-2026-0001` |
| purchaseOrderId | uuid | FK (unique — 1 PO = 1 Invoice) |
| vendorCompanyId | uuid | FK |
| status | enum | `PENDING`, `PAID`, `OVERDUE` |
| subtotal | numeric(14,2) | |
| taxRate | numeric(5,2) | from PO |
| taxAmount | numeric(14,2) | computed |
| totalAmount | numeric(14,2) | subtotal + tax |
| dueDate | date | |
| paidAt | timestamptz? | |
| emailedAt | timestamptz? | last email send timestamp |
| createdAt, updatedAt | timestamptz | |

Indexes: `invoiceNumber (unique)`, `status`, `vendorCompanyId`, `dueDate`.

### InvoiceLineItem

Mirror of POLineItem, snapshotted at invoice generation.

### PaymentEvent

Append-only log of payment status changes for the invoice.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| invoiceId | uuid | FK |
| fromStatus | enum | |
| toStatus | enum | |
| changedById | uuid | FK → User |
| changedAt | timestamptz | |
| note | text? | |

### Notification

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| userId | uuid | FK → User (recipient) |
| type | enum | `RFQ_PUBLISHED`, `QUOTATION_SUBMITTED`, `APPROVAL_REQUESTED`, `APPROVAL_APPROVED`, `APPROVAL_REJECTED`, `PO_GENERATED`, `PO_SENT`, `INVOICE_GENERATED`, `INVOICE_PAID` |
| title | text | |
| body | text | |
| link | text | e.g., `/rfq/abc-123` |
| readAt | timestamptz? | |
| createdAt | timestamptz | |

Indexes: `(userId, readAt)`, `createdAt`.

### AuditLog

Immutable. See [11-AUDIT-LOGS.md](../03-platform/11-AUDIT-LOGS.md).

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| actorId | uuid? | FK → User. Null for system actions. |
| action | text | e.g., `RFQ_PUBLISHED` |
| entityType | text | e.g., `RFQ` |
| entityId | uuid | |
| metadata | jsonb | event-specific payload |
| ipAddress | inet? | |
| userAgent | text? | |
| createdAt | timestamptz | default now() |

**No updatedAt. No deletedAt. No isDeleted. INSERT only.** Enforced by:
- DB triggers that REVOKE UPDATE/DELETE on this table from all roles except a dedicated `audit_writer` role used by the app.
- App-level check: no UPDATE/DELETE calls in any code path.
- Migration scripts verify the trigger is in place.

Indexes: `(entityType, entityId)`, `(actorId, createdAt DESC)`, `createdAt`.

### FileAsset

Polymorphic metadata for files stored in Cloudinary.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| ownerType | enum | `RFQ`, `VENDOR_COMPANY`, `PURCHASE_ORDER`, `INVOICE` |
| ownerId | uuid | |
| cloudinaryPublicId | text | |
| url | text | |
| resourceType | text | `image`, `raw`, `video` |
| fileName | text | original |
| mimeType | text | |
| sizeBytes | bigint | |
| uploadedById | uuid | FK → User |
| createdAt | timestamptz | |

Indexes: `(ownerType, ownerId)`.

## 7.3 Enums (Prisma)

```prisma
enum UserStatus { INACTIVE ACTIVE SUSPENDED DEACTIVATED }
enum RoleName { ADMIN PROCUREMENT_OFFICER MANAGER VENDOR }
enum VendorStatus { PENDING_VERIFICATION ACTIVE INACTIVE BLOCKED }
enum RFQStatus { DRAFT PUBLISHED CLOSED CANCELLED }
enum QuotationStatus { SUBMITTED SHORTLISTED ACCEPTED REJECTED }
enum ApprovalStatus { PENDING APPROVED REJECTED }
enum POStatus { GENERATED SENT DELIVERED }
enum InvoiceStatus { PENDING PAID OVERDUE }
enum NotificationType { RFQ_PUBLISHED QUOTATION_SUBMITTED APPROVAL_REQUESTED APPROVAL_APPROVED APPROVAL_REJECTED PO_GENERATED PO_SENT INVOICE_GENERATED INVOICE_PAID }
enum FileOwnerType { RFQ VENDOR_COMPANY PURCHASE_ORDER INVOICE }
```

## 7.4 Naming conventions

- Tables: plural snake_case → `users`, `vendor_companies`, `rfqs`, `rfq_line_items`, `quotations`, `quotation_line_items`, `approvals`, `purchase_orders`, `po_line_items`, `invoices`, `invoice_line_items`, `payment_events`, `notifications`, `audit_logs`, `file_assets`, `roles`, `user_roles`, `rfq_vendors`.
- Columns: snake_case.
- Primary keys: `id` (uuid v4, default `gen_random_uuid()`).
- Timestamps: `created_at`, `updated_at` (where applicable). For audit_logs, only `created_at`.
- Foreign keys: `<entity>_id`.

## 7.5 Indexes — summary

- All FKs are indexed.
- All status enums are indexed (workflow queries).
- All unique business numbers (`rfqNumber`, `poNumber`, `invoiceNumber`, `quotationNumber`) are unique.
- Composite indexes for hot paths:
  - `(rfqId, status)` on quotations
  - `(userId, readAt)` on notifications
  - `(actorId, createdAt DESC)` on audit logs
- Partial indexes:
  - `audit_logs(createdAt DESC) WHERE 1=1` (always queried)
  - `rfqs(deadline) WHERE status = 'PUBLISHED'` (deadline-locking job)
  - `approvals(rfqId) WHERE status IN ('PENDING', 'APPROVED')` (SoD enforcement)

## 7.6 Migrations

- All schema changes go through Prisma Migrate. Never edit the DB directly.
- Migration review checklist (per Rules.md):
  1. Schema updated.
  2. Migration file generated.
  3. Migration reviewed for data loss.
  4. Documentation updated (this file and the relevant module spec).
  5. Forward-only migration. No `prisma migrate reset` in production.

## 7.7 Future schema considerations (not in v1)

- `tenants` table for multi-tenancy.
- `currencies` and FX rates (currently single currency).
- `contracts` for framework agreements.
- `grns` (Goods Received Notes) and `inspection_results`.
- `payments` table for actual payment records (currently only status).
- Soft-delete pattern with `archivedAt` (NOT for audit logs).
