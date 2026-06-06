# M03 — Vendors

> Source of truth for vendor management. See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.2 (VendorCompany lifecycle) and [10-BUSINESS-RULES.md](../10-BUSINESS-RULES.md) §10.6.

## M03.1 Purpose

- Manage vendor company master data (legal info, GST, contacts, category).
- Track vendor lifecycle (PENDING_VERIFICATION → ACTIVE → INACTIVE / BLOCKED).
- Allow vendors to maintain their own profile (limited).
- Store vendor documents (GST cert, PAN, agreements) via Cloudinary.
- Provide search and filtering.

## M03.2 Scope

**In scope**:
- Admin: full CRUD, status transitions, document management.
- Vendor user: view own profile, edit limited fields (contact phone, address).
- Public signup that creates a `VendorCompany` in `PENDING_VERIFICATION`.
- Search by name / GST / category.
- Status filtering.
- Pagination.

**Out of scope**:
- KYC document verification (we store metadata, the admin manually verifies).
- Vendor self-rating.
- Vendor portal self-onboarding wizard beyond signup.
- Bulk import.

## M03.3 Entities

- `VendorCompany` (see [07-DATA-MODEL.md](../07-DATA-MODEL.md) §7.2).
- `User` (linked via `vendorCompanyId`).
- `FileAsset` (polymorphic — owned by VENDOR_COMPANY).

## M03.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/vendor-companies` | ADMIN, OFFICER, MANAGER (all); VENDOR (own only) | Paginated, filterable |
| GET | `/api/v1/vendor-companies/:id` | ADMIN, OFFICER, MANAGER (any); VENDOR (own only) | Detail with documents |
| POST | `/api/v1/vendor-companies` | ADMIN | Create a vendor (without user account) |
| PATCH | `/api/v1/vendor-companies/:id` | ADMIN (all fields); VENDOR (own, limited fields) | |
| POST | `/api/v1/vendor-companies/:id/activate` | ADMIN | PENDING_VERIFICATION → ACTIVE |
| POST | `/api/v1/vendor-companies/:id/deactivate` | ADMIN | ACTIVE → INACTIVE |
| POST | `/api/v1/vendor-companies/:id/block` | ADMIN | ACTIVE → BLOCKED |
| POST | `/api/v1/vendor-companies/:id/unblock` | ADMIN | BLOCKED → ACTIVE |
| GET | `/api/v1/vendor-companies/:id/documents` | ADMIN, VENDOR (own) | List documents |
| POST | `/api/v1/vendor-companies/:id/documents` | ADMIN, VENDOR (own) | Upload (multipart) |

## M03.5 Service layer

```
vendors/
├── vendors.module.ts
├── controllers/
│   └── vendors.controller.ts
├── services/
│   ├── vendors.service.ts            # CRUD
│   ├── vendor-status.service.ts      # lifecycle transitions
│   ├── vendor-search.service.ts      # search/filter (uses pg trigram)
│   └── vendor-documents.service.ts   # file upload orchestration
├── repositories/
│   └── vendors.repository.ts
├── dto/
│   ├── create-vendor.dto.ts
│   ├── update-vendor.dto.ts
│   ├── list-vendors.dto.ts
│   ├── vendor-response.dto.ts
│   └── document-upload.dto.ts
├── workflow.ts                       # status transitions
└── tests/
```

## M03.6 Workflow

```
PENDING_VERIFICATION ──activate──▶ ACTIVE
ACTIVE ──deactivate──▶ INACTIVE
ACTIVE ──block──▶ BLOCKED
INACTIVE ──reactivate──▶ ACTIVE
BLOCKED ──unblock──▶ ACTIVE
```

State machine function: `assertVendorTransition(from, to)`.

| From | To | Allowed | Rule |
|------|----|---------|------|
| PENDING_VERIFICATION | ACTIVE | ✅ | activate |
| ACTIVE | INACTIVE | ✅ | deactivate |
| ACTIVE | BLOCKED | ✅ | block |
| INACTIVE | ACTIVE | ✅ | reactivate |
| BLOCKED | ACTIVE | ✅ | unblock |
| PENDING_VERIFICATION | INACTIVE | ❌ | use activate first |
| ACTIVE | PENDING_VERIFICATION | ❌ | not allowed |
| INACTIVE | BLOCKED | ❌ | not allowed |
| * | DELETED | ❌ | not allowed (we don't delete) |

## M03.7 Validation rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-070 | Only ACTIVE vendors can be assigned to a new RFQ | RFQ service |
| BR-071 | Only ACTIVE vendors can submit quotations | Quotation service |
| BR-072 | Status transitions are admin-only | RBAC |
| BR-073 | Blocking a vendor does not affect in-flight quotations | Service |
| BR-074 | Vendor can view only own RFQs/quotations/POs/invoices | Ownership check |
| BR-075 | GST number format (15-char GSTIN) | Zod regex |

## M03.8 Self-edit fields (vendor portal)

A vendor user can edit:
- `contactPhone`
- `address`
- (admin-only: legalName, displayName, gstNumber, panNumber, category, contactEmail)

Editing `contactEmail` triggers re-verification (status returns to `PENDING_VERIFICATION`). This is a v1.1 feature; in v1, contactEmail is admin-only.

## M03.9 Search and filtering

- `?q=` searches `legalName`, `displayName`, `gstNumber`, `contactEmail` (pg trigram).
- `?status=ACTIVE` filters by status.
- `?category=IT` filters by category.
- `?sortBy=legalName|createdAt|rating&sortOrder=asc|desc`.
- `?page=1&pageSize=20`.

For vendor users, the result is always `id = own.vendorCompanyId` regardless of filters (ownership enforced at the service layer).

## M03.10 Documents

- Supported file types: PDF, JPG, PNG.
- Max size: 10 MB per file.
- Multiple files per vendor.
- Stored in Cloudinary under `vendorbridge/vendor/<vendorCompanyId>/<fileId>`.
- DB stores metadata (id, ownerType=VENDOR_COMPANY, ownerId, cloudinaryPublicId, url, fileName, mimeType, sizeBytes).

See [modules/M12-FILE-UPLOADS.md](M12-FILE-UPLOADS.md).

## M03.11 Audit events

| Event | Trigger |
|-------|---------|
| `VENDOR_CREATED` | Admin or signup |
| `VENDOR_UPDATED` | Edit (admin or vendor) |
| `VENDOR_ACTIVATED` | activate |
| `VENDOR_BLOCKED` | block |
| `VENDOR_UNBLOCKED` | unblock |
| `VENDOR_INACTIVATED` | deactivate |
| `VENDOR_REACTIVATED` | reactivate |
| `VENDOR_DOCUMENT_UPLOADED` | Document added |
| `VENDOR_DOCUMENT_DELETED` | Document removed |

## M03.12 Notifications

- On `VENDOR_ACTIVATED`: in-app to all vendor users of that company.
- On `VENDOR_BLOCKED` / `INACTIVATED`: in-app (and email in v1.1).
- On document upload: in-app to admin.

## M03.13 Edge cases

| Scenario | Behavior |
|----------|----------|
| Block a vendor with active RFQs | Allowed. Their quotations remain submittable until RFQ deadline. New RFQs cannot include them. |
| Delete a vendor | Not supported. Use `INACTIVE` or `BLOCKED`. |
| Edit a `PENDING_VERIFICATION` vendor's GST | Allowed. Status is not changed. |
| Vendor with no users | Allowed. Admin can add users later via invite (v1.1) or vendor users self-signup. |
| GST format invalid | 400 `VALIDATION_FAILED` |
| Two vendors with the same legal name | Allowed (no unique constraint on `legalName`). GSTIN, when present, is unique. |
| Vendor user edits own profile but their `vendorCompanyId` is missing | 403 `OWNERSHIP_DENIED` |
| Concurrent block + edit | Last write wins; both audited. Block is final. |

## M03.14 Future (not in v1)

- KYC verification flow with admin review queue.
- Vendor portal self-onboarding wizard with checklist.
- Vendor performance dashboard.
- Vendor merge (combine duplicates).
- Vendor tags and custom fields.
