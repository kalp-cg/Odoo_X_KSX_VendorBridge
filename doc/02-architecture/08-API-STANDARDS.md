# 08 — API Standards

All APIs are REST, versioned, and follow consistent conventions. This document is the source of truth for any endpoint design.

## 8.1 URL conventions

- Base path: `/api/v1`
- Resource names: plural nouns, kebab-case for multi-word.
  - ✅ `/api/v1/vendor-companies`
  - ✅ `/api/v1/purchase-orders`
  - ❌ `/api/v1/vendorCompany`
- Resource hierarchy is reflected in paths when natural:
  - `/api/v1/rfqs/:rfqId/quotations`
  - `/api/v1/quotations/:quotationId/approval`
- Actions on a resource (state transitions) use verbs on the resource:
  - `POST /api/v1/rfqs/:id/publish`
  - `POST /api/v1/quotations/:id/shortlist`
  - `POST /api/v1/approvals/:id/approve`
  - `POST /api/v1/approvals/:id/reject`
  - `POST /api/v1/invoices/:id/email`
  - `POST /api/v1/invoices/:id/mark-paid`
- No verbs in standard CRUD paths.
- IDs are UUIDs.

## 8.2 HTTP methods

| Method | Use |
|--------|-----|
| GET | Read (idempotent) |
| POST | Create or non-idempotent action |
| PATCH | Partial update |
| PUT | Full replacement (used rarely) |
| DELETE | Hard delete (used only where business rules permit) |

## 8.3 Query parameters

- camelCase: `?status=ACTIVE&createdAfter=2026-01-01`
- Pagination: `?page=1&pageSize=20` (1-indexed) OR `?cursor=...&limit=20` for cursor-based (used for large lists like audit logs).
- Sorting: `?sortBy=createdAt&sortOrder=desc`
- Filtering: short, named, well-typed (no JSON blobs).
- Search: `?q=term` for text search (uses pg trigram where possible).

## 8.4 Request body

- JSON.
- Content-Type: `application/json; charset=utf-8`.
- Field names: camelCase.
- All fields documented in the OpenAPI spec (generated from Zod schemas via `zod-to-openapi` or `@nestjs/swagger`).

## 8.5 Response envelope (mandatory)

**Success:**

```json
{
  "success": true,
  "message": "RFQ published",
  "data": { /* payload */ }
}
```

**Failure:**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "code": "FIELD_REQUIRED", "field": "deadline", "message": "Deadline is required" }
  ]
}
```

**Paginated:**

```json
{
  "success": true,
  "message": "OK",
  "data": [ /* items */ ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

The `success` field is **always** boolean and **always** present. Clients can branch on it.

## 8.6 HTTP status codes

| Code | Meaning |
|------|---------|
| 200 | OK (GET, PATCH) |
| 201 | Created (POST) |
| 204 | No content (DELETE) |
| 400 | Bad request (validation error) |
| 401 | Unauthenticated |
| 403 | Forbidden (RBAC or ownership) |
| 404 | Not found |
| 409 | Conflict (workflow / business rule violation) |
| 422 | Unprocessable entity (semantic validation, e.g., deadline in past) |
| 429 | Too many requests (rate limit) |
| 500 | Server error |

**Workflow errors → 409** (e.g., trying to publish a CLOSED RFQ).
**Validation errors → 400** (shape).
**Business rule violations → 422** (semantic, e.g., RFQ has no vendors).

## 8.7 Error catalog (codes)

| Code | HTTP | Meaning |
|------|------|---------|
| `AUTH_REQUIRED` | 401 | No/invalid token |
| `AUTH_EXPIRED` | 401 | Token expired |
| `PERMISSION_DENIED` | 403 | Role not allowed |
| `OWNERSHIP_DENIED` | 403 | Resource not owned by user |
| `NOT_FOUND` | 404 | Entity not found |
| `VALIDATION_FAILED` | 400 | DTO validation |
| `BUSINESS_RULE_VIOLATION` | 422 | Domain rule broken |
| `WORKFLOW_INVALID_TRANSITION` | 409 | State transition not allowed |
| `DEADLINE_PASSED` | 422 | Quotation past RFQ deadline |
| `DUPLICATE_ENTRY` | 409 | Unique constraint |
| `RATE_LIMITED` | 429 | Throttled |
| `INTERNAL_ERROR` | 500 | Unhandled |

The `code` field in the error response is one of these strings, machine-readable.

## 8.8 Headers

- `Authorization: Bearer <jwt>` for all non-public endpoints.
- `X-Request-Id: <uuid>` (optional client-supplied, generated if absent; echoed in response for tracing).
- `Idempotency-Key: <uuid>` for POST endpoints that are not safe to retry (e.g., approval, payment status change). Keys are remembered for 24h.

## 8.9 Versioning

- URL-based: `/api/v1/...`.
- Breaking changes require `/v2`. Non-breaking additions are added to the same version.
- Deprecated endpoints include a `Deprecation` and `Sunset` header per RFC 8594.

## 8.10 Authentication

- JWT in `Authorization` header.
- Access token: 15-minute TTL, signed with RS256, contains `sub`, `roles`, `vendorCompanyId?`, `iat`, `exp`.
- Refresh token: 7-day TTL, httpOnly + secure cookie, single-use rotation.
- Password reset token: 1-hour TTL, single-use, returned in response in v1 (email integration is pluggable for v1.1).

See [modules/M01-AUTH.md](../modules/M01-AUTH.md) for the full auth flow.

## 8.11 Rate limiting

| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 10/minute/IP |
| `POST /auth/signup` | 5/hour/IP |
| `POST /auth/forgot-password` | 3/hour/email |
| `POST /invoices/:id/email` | 30/hour/user |
| All other endpoints | 120/minute/user |

Implemented via `@nestjs/throttler`.

## 8.12 OpenAPI / Swagger

- Generated automatically from Zod schemas.
- Served at `/api/docs` (dev only, behind a feature flag in prod).
- Each module spec links to its endpoints.

## 8.13 Example endpoints

```
GET    /api/v1/vendor-companies
GET    /api/v1/vendor-companies/:id
POST   /api/v1/vendor-companies            (admin)
PATCH  /api/v1/vendor-companies/:id        (admin or vendor-owner limited)
POST   /api/v1/vendor-companies/:id/activate   (admin)
POST   /api/v1/vendor-companies/:id/block     (admin)

GET    /api/v1/rfqs
POST   /api/v1/rfqs
GET    /api/v1/rfqs/:id
PATCH  /api/v1/rfqs/:id
POST   /api/v1/rfqs/:id/publish
POST   /api/v1/rfqs/:id/close
POST   /api/v1/rfqs/:id/cancel
GET    /api/v1/rfqs/:id/quotations
POST   /api/v1/rfqs/:id/quotations         (vendor)

GET    /api/v1/quotations
GET    /api/v1/quotations/:id
PATCH  /api/v1/quotations/:id              (vendor, before deadline)
POST   /api/v1/quotations/:id/submit
POST   /api/v1/quotations/:id/shortlist    (officer)
GET    /api/v1/rfqs/:id/comparison

POST   /api/v1/quotations/:id/approval     (officer — creates approval)
GET    /api/v1/approvals
GET    /api/v1/approvals/:id
POST   /api/v1/approvals/:id/approve       (manager)
POST   /api/v1/approvals/:id/reject        (manager, remarks required)

GET    /api/v1/purchase-orders
GET    /api/v1/purchase-orders/:id
POST   /api/v1/purchase-orders/:id/send
POST   /api/v1/purchase-orders/:id/mark-delivered

GET    /api/v1/invoices
GET    /api/v1/invoices/:id
GET    /api/v1/invoices/:id/pdf
POST   /api/v1/invoices/:id/email
POST   /api/v1/invoices/:id/print          (logs an event)
POST   /api/v1/invoices/:id/mark-paid
POST   /api/v1/invoices/:id/mark-overdue

GET    /api/v1/notifications
POST   /api/v1/notifications/:id/read
POST   /api/v1/notifications/read-all

GET    /api/v1/audit-logs                  (admin/officer/manager)

GET    /api/v1/reports/vendor-performance
GET    /api/v1/reports/spend
GET    /api/v1/reports/monthly-trend
GET    /api/v1/reports/export

POST   /api/v1/files/upload                (multipart)
```

## 8.14 What is NOT in the API

- No GraphQL.
- No batch endpoints in v1 (use multiple parallel calls; bounded by client).
- No `/search` mega-endpoint. Use the list endpoint with `?q=`.
- No file downloads via presigned URLs from the API. Files are served via Cloudinary URLs.
