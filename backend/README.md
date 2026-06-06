# VendorBridge — Backend (NestJS + Prisma + PostgreSQL)

> Procurement & Vendor Management ERP — backend API. Source of truth for auth, RBAC, workflow state machines, immutable audit logs, and notifications.

## Stack

- **Runtime**: Node.js 20+ / pnpm 9+
- **Framework**: NestJS 10 (TypeScript, strict)
- **ORM**: Prisma 5 + PostgreSQL 16 (extensions: `citext`, `pgcrypto`)
- **Auth**: JWT RS256 access tokens (15m) + httpOnly refresh cookies (7d, single-use rotation) + argon2id
- **Validation**: Zod (via `ZodValidationPipe`) + class-validator
- **Files**: Cloudinary (polymorphic `FileAsset`)
- **PDFs**: pdfkit
- **Logging**: nestjs-pino
- **Rate limit**: @nestjs/throttler
- **Cron**: @nestjs/schedule (invoice overdue sweep)

## Folder layout

```
backend/
├─ prisma/
│  ├─ schema.prisma                  # all entities, enums, indexes
│  ├─ migrations/audit_immutability/ # SQL: trigger + role lockdown
│  └─ seed.ts                        # demo data
├─ src/
│  ├─ config/                        # typed env loader (Zod-validated)
│  ├─ prisma/                        # PrismaService (global)
│  ├─ common/                        # decorators, guards, pipes, filters,
│  │                                 # interceptors, exceptions, utils
│  ├─ modules/
│  │  ├─ auth/             (M01)    # signup, login, refresh, logout,
│  │  │                             # forgot/reset, me, change-password
│  │  ├─ users/            (M02)    # CRUD + role/status (last-admin guard)
│  │  ├─ vendors/          (M03)    # lifecycle, search, vendor self-view
│  │  ├─ rfq/              (M04)    # draft/edit/publish/close/cancel
│  │  ├─ quotations/       (M05)    # submit/edit/shortlist/reject/compare
│  │  ├─ approvals/        (M06)    # approve/reject + SoD + atomic PO+Invoice
│  │  ├─ purchase-orders/  (M07)    # lifecycle + PDF
│  │  ├─ invoices/         (M08)    # lifecycle + PDF + email + overdue cron
│  │  ├─ notifications/    (M09)    # in-app + pluggable channels
│  │  ├─ audit-logs/       (M10)    # log() + query() + CSV
│  │  ├─ reports/          (M11)    # dashboard, spend, monthly trend
│  │  └─ files/            (M12)    # Cloudinary upload + ownership checks
│  ├─ health/                       # /health (DB ping)
│  ├─ app.module.ts
│  └─ main.ts
├─ scripts/
│  ├─ generate-keys.ts              # RS256 keypair
│  └─ verify-audit-immutability.ts  # proof probe
├─ keys/                            # gitignored
├─ docker-compose.yml               # local Postgres
├─ database/init/01-extensions-and-roles.sql
├─ .env.example
└─ package.json
```

## First-time setup

```bash
# 1. install deps
cd backend
pnpm install

# 2. start Postgres (uses docker-compose)
docker compose up -d

# 3. copy env, generate JWT keys
cp .env.example .env
pnpm keygen

# 4. apply schema + immutability migration
pnpm prisma:migrate:dev        # creates dev migration
# OR in CI / one-off:
#   pnpm prisma:format
#   pnpm prisma:migrate:deploy

# 5. seed demo data
pnpm prisma:seed

# 6. run
pnpm start:dev                 # http://localhost:4000/api/v1
```

Demo logins (password `Password123!`):

| Role    | Email                              |
|---------|------------------------------------|
| ADMIN   | `admin@vendorbridge.local`         |
| OFFICER | `officer@vendorbridge.local`       |
| MANAGER | `manager@vendorbridge.local`       |
| VENDOR  | `vendor@acme.example`              |
| VENDOR  | `vendor@bluepeak.example`          |

Swagger UI: <http://localhost:4000/api/v1/docs>

## API conventions

- Base: `/api/v1`
- Plural noun resources: `/rfqs`, `/quotations`, `/purchase-orders`, `/invoices`, `/vendors`, `/users`, `/files`, `/notifications`, `/audit-logs`, `/approvals`, `/reports`
- Action verbs on resources: `/rfqs/:id/publish`, `/quotations/:id/shortlist`, `/approvals/:id/approve`
- Auth: `Authorization: Bearer <accessToken>`; refresh in httpOnly cookie `vb_refresh`
- Errors: `{ error: { code, message, details? }, path, method, timestamp, requestId }`
- Pagination: `?page=1&pageSize=20`; response `{ data, pagination: { page, pageSize, total, totalPages, hasNext, hasPrev } }`
- Date/amount: ISO 8601 strings, decimals as numbers

## Workflow integrity

State transitions are enforced in the service layer inside a Prisma transaction. The audit log entry and notifications are written in the **same transaction** as the business change. The order of states is:

```
DRAFT → PUBLISHED → CLOSED        (RFQ)
       PUBLISHED → CANCELLED
SUBMITTED → SHORTLISTED → ACCEPTED  (Quotation)
SUBMITTED → REJECTED
SHORTLISTED → REJECTED
PENDING → APPROVED                  (Approval — terminal)
PENDING → REJECTED                  (terminal)
GENERATED → SENT → DELIVERED        (PO)
PENDING → PAID                      (Invoice — terminal)
PENDING → OVERDUE                   (Invoice)
```

## Audit log immutability (3 layers)

1. **App**: `AuditService` only exposes `log()` and `query()`.
2. **DB trigger**: `prisma/migrations/audit_immutability/migration.sql` installs a `BEFORE UPDATE/DELETE/TRUNCATE` trigger that raises.
3. **DB role**: the same migration revokes `UPDATE/DELETE/TRUNCATE` on `audit_logs` from the runtime role `vb_app`.

Proof probe:

```bash
pnpm verify:audit
```

Expected output: all three operations are blocked, and `vb_app` has no UPDATE on `audit_logs`.

## Notifications

In-app DB rows are the only required channel in v1. The dispatcher is pluggable (`EmailService` today logs to console when `SMTP_ENABLED=false`); a future SMTP/webhook/SMS transport can be added without touching callers. Notification failures are caught and logged — they never roll back the parent business operation.

## File uploads

- Cloudinary is the source of truth; the database stores only `publicId`, URLs, format, bytes, mime, checksum, and polymorphic owner FK.
- `POST /files/upload` (multipart/form-data) with `ownerType` ∈ {`USER`, `VENDOR`, `RFQ`, `QUOTATION`, `PURCHASE_ORDER`, `INVOICE`, `APPROVAL`} and optional `ownerId`.
- Vendors can only upload to their own vendor company or user profile.

## Reports

- `GET /api/v1/reports/dashboard` — counts + recent
- `GET /api/v1/reports/spend-by-vendor` — totals grouped by vendor
- `GET /api/v1/reports/monthly-trend` — last 12 months
- `GET /api/v1/reports/vendor-performance` — staff-only
- `*.csv` endpoints for export (UTF-8 BOM, Excel-friendly)

## Tests & verification

- Unit tests live next to source as `*.spec.ts`.
- E2E tests in `test/` use the `jest-e2e` config.
- `pnpm typecheck` and `pnpm build` are the canonical gates.

## Linting & formatting

- ESLint with `@typescript-eslint` strict rules (`no-explicit-any: error`).
- Prettier defaults.
- `pnpm lint`, `pnpm format`.

## Deployment notes

- Multi-stage Dockerfile (not included in v1; build with `pnpm build`, run `node dist/main.js`).
- The runtime container should use a read-restricted DB role (`vb_app`); the owner role is reserved for migrations.
- Health check: `GET /api/v1/health`.
- Graceful shutdown via `app.enableShutdownHooks()`.
