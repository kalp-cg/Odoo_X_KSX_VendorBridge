# 06 — Module Structure

## 6.1 Top-level folder layout (monorepo)

```
vendorbridge/
├── apps/
│   ├── api/                # NestJS backend
│   └── web/                # Next.js frontend
├── packages/
│   ├── shared/             # Shared Zod schemas, types, constants
│   ├── ui/                 # Shared React components (optional, if used)
│   └── eslint-config/      # Shared ESLint config
├── doc/                    # This documentation folder
├── prisma/                 # Prisma schema and migrations (or in apps/api/prisma)
├── scripts/                # Dev/ops scripts
├── .github/                # GitHub Actions workflows
├── docker-compose.yml      # Local dev (Postgres, etc.)
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

**Why a monorepo:** a single source of truth for types and Zod schemas (frontend and backend), atomic refactors, one CI pipeline, one deploy. Tooling: **pnpm workspaces** for speed and disk efficiency.

If a monorepo is too heavy for the hackathon, a single repo with two top-level folders (`apps/api`, `apps/web`, `packages/shared`) imported via TypeScript path aliases is also acceptable. Document the decision in [20-ROADMAP.md](../06-planning/20-ROADMAP.md).

## 6.2 Backend module layout (NestJS)

```
apps/api/src/
├── main.ts                          # bootstrap
├── app.module.ts                    # root module
├── prisma/                          # PrismaService (global)
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── common/                          # cross-cutting
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── ownership.guard.ts
│   ├── pipes/
│   │   ├── zod-validation.pipe.ts
│   │   └── parse-uuid.pipe.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── interceptors/
│   │   └── logging.interceptor.ts
│   ├── exceptions/                  # domain exceptions
│   │   ├── workflow.exception.ts
│   │   ├── ownership.exception.ts
│   │   └── business-rule.exception.ts
│   ├── constants/
│   │   ├── roles.ts
│   │   └── error-codes.ts
│   └── utils/
│       ├── pagination.util.ts
│       └── date.util.ts
├── modules/
│   ├── auth/
│   ├── users/
│   ├── vendors/
│   ├── rfq/
│   ├── quotations/
│   ├── approvals/
│   ├── purchase-orders/
│   ├── invoices/
│   ├── notifications/
│   ├── audit-logs/
│   ├── reports/
│   ├── file-uploads/
│   └── dashboard/                   # read-only aggregations
└── config/
    ├── env.schema.ts                # Zod-validated env
    └── configuration.ts
```

### Per-module internal layout

```
modules/<feature>/
├── <feature>.module.ts              # Nest module definition
├── controllers/
│   └── <feature>.controller.ts
├── services/
│   ├── <feature>.service.ts         # public business logic
│   └── <feature>.workflow.ts        # state machine (if applicable)
├── repositories/
│   └── <feature>.repository.ts
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── <feature>-response.dto.ts
├── types/
│   └── <feature>.types.ts
├── constants.ts                     # state names, event names
├── exceptions/
│   └── <feature>.exceptions.ts
└── tests/
    ├── <feature>.service.spec.ts
    └── <feature>.controller.spec.ts
```

## 6.3 Frontend module layout (Next.js)

```
apps/web/
├── app/                              # App Router
│   ├── layout.tsx                    # root layout
│   ├── page.tsx                      # landing → redirect to dashboard or login
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── forgot-password/page.tsx
│   ├── (internal)/                   # officer / manager / admin
│   │   ├── layout.tsx                # role-aware nav
│   │   ├── dashboard/page.tsx
│   │   ├── vendors/
│   │   │   ├── page.tsx              # list
│   │   │   ├── new/page.tsx          # create
│   │   │   └── [id]/page.tsx         # detail
│   │   ├── rfq/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       ├── edit/page.tsx
│   │   │       └── compare/page.tsx
│   │   ├── approvals/
│   │   │   ├── page.tsx              # queue
│   │   │   └── [id]/page.tsx
│   │   ├── purchase-orders/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── invoices/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── activity/page.tsx         # audit + notifications
│   │   └── reports/page.tsx
│   ├── (vendor)/                     # vendor portal
│   │   ├── layout.tsx                # vendor-specific nav
│   │   ├── dashboard/page.tsx
│   │   ├── rfqs/page.tsx
│   │   ├── rfqs/[id]/page.tsx
│   │   ├── rfqs/[id]/quotation/page.tsx
│   │   ├── purchase-orders/page.tsx
│   │   └── activity/page.tsx
│   └── api/                          # BFF endpoints (rare)
│       └── invoices/[id]/pdf/route.ts
├── components/
│   ├── ui/                           # shadcn/ui generated
│   ├── forms/                        # reusable form atoms
│   ├── tables/                       # DataTable wrapper, filters
│   ├── layouts/
│   │   ├── app-shell.tsx
│   │   ├── sidebar.tsx
│   │   └── topbar.tsx
│   └── feature/                      # feature-specific
│       ├── rfq/
│       ├── quotation/
│       ├── approval/
│       └── ...
├── lib/
│   ├── api/
│   │   ├── client.ts                 # fetch wrapper with auth
│   │   ├── auth.ts
│   │   ├── vendors.ts
│   │   ├── rfq.ts
│   │   └── ...
│   ├── auth/
│   │   ├── token.ts                  # access token in memory
│   │   └── session.ts                # session provider
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-rfq.ts
│   │   └── ...
│   └── utils/
│       ├── format.ts
│       ├── date.ts
│       └── download.ts
├── stores/                           # Zustand
│   ├── notification-store.ts
│   └── ui-store.ts
├── middleware.ts                     # role-based route guard
├── styles/
│   └── globals.css
├── tailwind.config.ts
├── next.config.mjs
└── tsconfig.json
```

## 6.4 Shared package

```
packages/shared/
├── src/
│   ├── schemas/                      # Zod schemas (DTOs)
│   │   ├── auth.ts
│   │   ├── vendor.ts
│   │   ├── rfq.ts
│   │   └── ...
│   ├── types/                        # TS types derived from Zod
│   ├── enums/                        # Role, RFQStatus, etc.
│   └── constants/
└── package.json
```

The same Zod schema is used:

- On the frontend (React Hook Form resolver + client-side validation)
- On the backend (Zod validation pipe)
- In the API client (typed responses)

This eliminates the "schema drift" problem.

## 6.5 File naming conventions

- `kebab-case` for files and folders.
- `PascalCase` for classes and React components.
- `camelCase` for variables, functions, methods.
- `UPPER_SNAKE_CASE` for constants and enum members.
- DB columns: `snake_case` (mapped via Prisma).
- API URL segments: `kebab-case`.
- API query params: `camelCase`.

## 6.6 What goes where — quick rules

| Concern | Lives in |
|---------|----------|
| DTO validation | `dto/` + Zod schema in `packages/shared` |
| Auth check | `common/guards/jwt-auth.guard.ts` |
| Role check | `common/guards/roles.guard.ts` + `@Roles()` decorator |
| Ownership check | `common/services/ownership.service.ts` (called from feature services) |
| State machine | `modules/<feature>/services/<feature>.workflow.ts` |
| Audit log write | `modules/audit-logs/services/audit.service.ts` (called from feature services) |
| Notification emit | `modules/notifications/services/notification.service.ts` (called from feature services) |
| DB query | `modules/<feature>/repositories/<feature>.repository.ts` |
| Business rule | `modules/<feature>/services/<feature>.service.ts` |
| Error → HTTP | `common/filters/http-exception.filter.ts` |
| Frontend form | `components/feature/<feature>/<feature>-form.tsx` |
| Frontend list | `components/feature/<feature>/<feature>-list.tsx` |
