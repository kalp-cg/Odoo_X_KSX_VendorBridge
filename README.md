# VendorBridge

**Procurement & Vendor Management ERP**

A workflow-driven ERP for digitizing the full procurement cycle — from vendor registration to invoice payment — with structured workflows, role-based access, immutable audit logs, and real-time tracking.

**Core flow:** `Vendor → RFQ → Quotation → Approval → Purchase Order → Invoice → Audit Log → Reports`

No workflow step may be skipped.

---

## Quick start

```bash
# Install
pnpm install

# Copy env templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Start local Postgres
docker compose up -d postgres

# Apply migrations
pnpm --filter @vb/api prisma migrate deploy

# Start dev (API + web in parallel)
pnpm dev
```

API at `http://localhost:4000`, web at `http://localhost:3000`. See [doc/05-engineering/16-SETUP.md](doc/05-engineering/16-SETUP.md) for full setup.

---

## Documentation

All project documentation lives in [`doc/`](doc/). The structure is:

```
doc/
├── 01-product/         product, domain, roles, screens, workflows, business rules
├── 02-architecture/    system architecture, tech stack, modules, data model, API
├── 03-platform/        audit logs, notifications, security
├── 04-frontend/        Next.js + shadcn/ui
├── 05-engineering/     setup, deployment, testing, coding standards
├── 06-planning/        roadmap and phases
└── modules/            M01–M12 per-module contracts
```

### Where to start

1. **[Product Vision](doc/01-product/01-PRODUCT-VISION.md)** — what we are building and why
2. **[User Roles & Permissions](doc/01-product/02-USER-ROLES.md)** + **[Workflows](doc/01-product/09-WORKFLOWS.md)** — the domain
3. **[Architecture](doc/02-architecture/04-ARCHITECTURE.md)** + **[Data Model](doc/02-architecture/07-DATA-MODEL.md)** — the system shape
4. **[Business Rules](doc/01-product/10-BUSINESS-RULES.md)** + **[Audit Logs](doc/03-platform/11-AUDIT-LOGS.md)** — the rules

### Full document index

#### Product & Domain

| # | Document | Purpose |
|---|----------|---------|
| 01 | [PRODUCT-VISION](doc/01-product/01-PRODUCT-VISION.md) | Problem, vision, scope, non-goals |
| 02 | [USER-ROLES](doc/01-product/02-USER-ROLES.md) | 4 roles, capabilities, RBAC matrix |
| 03 | [SCREENS](doc/01-product/03-SCREENS.md) | All 10 screens from the spec |
| 09 | [WORKFLOWS](doc/01-product/09-WORKFLOWS.md) | All state machines, transition rules |
| 10 | [BUSINESS-RULES](doc/01-product/10-BUSINESS-RULES.md) | All validation and workflow rules (BR-001 …) |

#### Architecture

| # | Document | Purpose |
|---|----------|---------|
| 04 | [ARCHITECTURE](doc/02-architecture/04-ARCHITECTURE.md) | System architecture, request flow, topology |
| 05 | [TECH-STACK](doc/02-architecture/05-TECH-STACK.md) | Every technology + justification |
| 06 | [MODULE-STRUCTURE](doc/02-architecture/06-MODULE-STRUCTURE.md) | Feature-based module layout, folder conventions |
| 07 | [DATA-MODEL](doc/02-architecture/07-DATA-MODEL.md) | ER diagram, entity descriptions, indexes |
| 08 | [API-STANDARDS](doc/02-architecture/08-API-STANDARDS.md) | URL conventions, response format, error catalog |

#### Platform (cross-cutting)

| # | Document | Purpose |
|---|----------|---------|
| 11 | [AUDIT-LOGS](doc/03-platform/11-AUDIT-LOGS.md) | Audit log immutability spec, event catalog |
| 12 | [NOTIFICATIONS](doc/03-platform/12-NOTIFICATIONS.md) | In-app notification design, future channels |
| 13 | [SECURITY](doc/03-platform/13-SECURITY.md) | Auth, RBAC, ownership checks, threat model |

#### Frontend

| # | Document | Purpose |
|---|----------|---------|
| 14 | [FRONTEND](doc/04-frontend/14-FRONTEND.md) | Next.js architecture, routing, data fetching |
| 15 | [DESIGN-SYSTEM](doc/04-frontend/15-DESIGN-SYSTEM.md) | shadcn/ui, theming, component patterns |

#### Engineering & Operations

| # | Document | Purpose |
|---|----------|---------|
| 16 | [SETUP](doc/05-engineering/16-SETUP.md) | Local dev environment, env vars, run commands |
| 17 | [DEPLOYMENT](doc/05-engineering/17-DEPLOYMENT.md) | Build, deploy, environment strategy |
| 18 | [TESTING](doc/05-engineering/18-TESTING.md) | Test strategy, layers, coverage expectations |
| 19 | [CODING-STANDARDS](doc/05-engineering/19-CODING-STANDARDS.md) | TypeScript, NestJS, naming, patterns |

#### Planning

| # | Document | Purpose |
|---|----------|---------|
| 20 | [ROADMAP](doc/06-planning/20-ROADMAP.md) | Phased delivery plan, success criteria |

#### Module specifications

Each module spec is a self-contained contract: purpose, entities, endpoints, state transitions, permissions, validation, audit events, notifications, edge cases.

| # | Module | Spec |
|---|--------|------|
| M01 | Authentication | [modules/M01-AUTH.md](doc/modules/M01-AUTH.md) |
| M02 | Users & Roles | [modules/M02-USERS.md](doc/modules/M02-USERS.md) |
| M03 | Vendors | [modules/M03-VENDORS.md](doc/modules/M03-VENDORS.md) |
| M04 | RFQ | [modules/M04-RFQ.md](doc/modules/M04-RFQ.md) |
| M05 | Quotations | [modules/M05-QUOTATIONS.md](doc/modules/M05-QUOTATIONS.md) |
| M06 | Approvals | [modules/M06-APPROVALS.md](doc/modules/M06-APPROVALS.md) |
| M07 | Purchase Orders | [modules/M07-PURCHASE-ORDERS.md](doc/modules/M07-PURCHASE-ORDERS.md) |
| M08 | Invoices | [modules/M08-INVOICES.md](doc/modules/M08-INVOICES.md) |
| M09 | Notifications | [modules/M09-NOTIFICATIONS.md](doc/modules/M09-NOTIFICATIONS.md) |
| M10 | Audit Logs | [modules/M10-AUDIT-LOGS.md](doc/modules/M10-AUDIT-LOGS.md) |
| M11 | Reports & Analytics | [modules/M11-REPORTS.md](doc/modules/M11-REPORTS.md) |
| M12 | File Uploads | [modules/M12-FILE-UPLOADS.md](doc/modules/M12-FILE-UPLOADS.md) |

---

## Authoritative source files

These are the **canonical** sources. If any doc conflicts with them, **the source files win** and the doc must be updated.

- [`AGENTS.md`](./AGENTS.md) — Project context, lifecycles, business rules
- [`Rules.md`](./Rules.md) — Engineering rules and standards
- [`Vendorbridge Hackathon Problem Statement.pdf`](./Vendorbridge%20Hackathon%20Problem%20Statement.pdf) — Original problem statement
- [`UI_Wireframes/`](./UI_Wireframes/) — UI reference wireframes (10 screens)

---

## Tech stack at a glance

- **Frontend**: Next.js 15, TypeScript, Tailwind, shadcn/ui, React Hook Form, Zod, TanStack Table, TanStack Query
- **Backend**: NestJS 10, Prisma 5, JWT (RS256), argon2id, class-validator
- **Database**: PostgreSQL 16
- **Files**: Cloudinary
- **Tooling**: pnpm workspaces, monorepo, Jest, Supertest, ESLint, Prettier, Husky

Full justification in [doc/02-architecture/05-TECH-STACK.md](doc/02-architecture/05-TECH-STACK.md).

---

## Conventions

- DB columns use `snake_case`; TypeScript uses `camelCase`.
- API path segments use `kebab-case`; query params use `camelCase`.
- Every state transition has a stable name: `PUBLISH_RFQ`, `APPROVE_QUOTATION`, `MARK_INVOICE_PAID`, etc.
- All business rules have codes (`BR-001` …) referenced from tests and code comments.
- All audit events are cataloged in [doc/03-platform/11-AUDIT-LOGS.md](doc/03-platform/11-AUDIT-LOGS.md).
- Workflow integrity over UI polish.
