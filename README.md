# VendorBridge — Documentation Index

Welcome to the VendorBridge documentation. This is the canonical reference for engineers, reviewers, and AI agents working on the project.

## Project at a glance

VendorBridge is a **workflow-driven Procurement & Vendor Management ERP** — not a CRUD app. The integrity of the procurement workflow is the highest priority. Every feature must respect the state machines, business rules, audit logging, and role permissions defined here.

**Core flow:**
`Vendor → RFQ → Quotation → Approval → Purchase Order → Invoice → Audit Log → Reports & Analytics`

No step may be skipped.

---

## How to read these docs

1. **Start with [01-PRODUCT-VISION.md](01-PRODUCT-VISION.md)** — understand *what* we are building and *why*.
2. **Read [02-USER-ROLES.md](02-USER-ROLES.md)** and **[09-WORKFLOWS.md](09-WORKFLOWS.md)** — the domain.
3. **Read [04-ARCHITECTURE.md](04-ARCHITECTURE.md)**, **[06-MODULE-STRUCTURE.md](06-MODULE-STRUCTURE.md)**, and **[07-DATA-MODEL.md](07-DATA-MODEL.md)** — the system shape.
4. **Read [10-BUSINESS-RULES.md](10-BUSINESS-RULES.md)**, **[11-AUDIT-LOGS.md](11-AUDIT-LOGS.md)**, and **[12-NOTIFICATIONS.md](12-NOTIFICATIONS.md)** — the rules.
5. **Drill into [doc/modules/](modules/)** for per-module contracts, endpoints, and schemas.

---

## Top-level documents

| # | Document | Purpose |
|---|----------|---------|
| 01 | [PRODUCT-VISION](01-PRODUCT-VISION.md) | Problem, vision, scope, non-goals |
| 02 | [USER-ROLES](02-USER-ROLES.md) | 4 roles, capabilities, RBAC matrix |
| 03 | [SCREENS](03-SCREENS.md) | All 10 screens from the spec |
| 04 | [ARCHITECTURE](04-ARCHITECTURE.md) | System architecture, request flow, topology |
| 05 | [TECH-STACK](05-TECH-STACK.md) | Every technology + justification |
| 06 | [MODULE-STRUCTURE](06-MODULE-STRUCTURE.md) | Feature-based module layout, folder conventions |
| 07 | [DATA-MODEL](07-DATA-MODEL.md) | ER diagram, entity descriptions, indexes |
| 08 | [API-STANDARDS](08-API-STANDARDS.md) | URL conventions, response format, error catalog |
| 09 | [WORKFLOWS](09-WORKFLOWS.md) | All state machines, transition rules |
| 10 | [BUSINESS-RULES](10-BUSINESS-RULES.md) | All validation and workflow rules |
| 11 | [AUDIT-LOGS](11-AUDIT-LOGS.md) | Audit log immutability spec, event catalog |
| 12 | [NOTIFICATIONS](12-NOTIFICATIONS.md) | In-app notification design, future channels |
| 13 | [SECURITY](13-SECURITY.md) | Auth, RBAC, ownership checks, threat model |
| 14 | [FRONTEND](14-FRONTEND.md) | Next.js architecture, routing, data fetching |
| 15 | [DESIGN-SYSTEM](15-DESIGN-SYSTEM.md) | shadcn/ui, theming, component patterns |
| 16 | [SETUP](16-SETUP.md) | Local dev environment, env vars, run commands |
| 17 | [DEPLOYMENT](17-DEPLOYMENT.md) | Build, deploy, environment strategy |
| 18 | [TESTING](18-TESTING.md) | Test strategy, layers, coverage expectations |
| 19 | [CODING-STANDARDS](19-CODING-STANDARDS.md) | TypeScript, NestJS, naming, patterns |
| 20 | [ROADMAP](20-ROADMAP.md) | Phased delivery plan, success criteria |

## Module specifications

Each module spec is a self-contained contract: purpose, entities, endpoints, state transitions, permissions, validation, audit events, notifications, edge cases.

| # | Module | Spec |
|---|--------|------|
| M01 | Authentication | [modules/M01-AUTH.md](modules/M01-AUTH.md) |
| M02 | Users & Roles | [modules/M02-USERS.md](modules/M02-USERS.md) |
| M03 | Vendors | [modules/M03-VENDORS.md](modules/M03-VENDORS.md) |
| M04 | RFQ | [modules/M04-RFQ.md](modules/M04-RFQ.md) |
| M05 | Quotations | [modules/M05-QUOTATIONS.md](modules/M05-QUOTATIONS.md) |
| M06 | Approvals | [modules/M06-APPROVALS.md](modules/M06-APPROVALS.md) |
| M07 | Purchase Orders | [modules/M07-PURCHASE-ORDERS.md](modules/M07-PURCHASE-ORDERS.md) |
| M08 | Invoices | [modules/M08-INVOICES.md](modules/M08-INVOICES.md) |
| M09 | Notifications | [modules/M09-NOTIFICATIONS.md](modules/M09-NOTIFICATIONS.md) |
| M10 | Audit Logs | [modules/M10-AUDIT-LOGS.md](modules/M10-AUDIT-LOGS.md) |
| M11 | Reports & Analytics | [modules/M11-REPORTS.md](modules/M11-REPORTS.md) |
| M12 | File Uploads | [modules/M12-FILE-UPLOADS.md](modules/M12-FILE-UPLOADS.md) |

---

## Authoritative source files

- [`AGENTS.md`](../AGENTS.md) — Project context, lifecycles, business rules (canonical)
- [`Rules.md`](../Rules.md) — Engineering rules and standards (canonical)
- [`Vendorbridge Hackathon Problem Statement.pdf`](../Vendorbridge%20Hackathon%20Problem%20Statement.pdf) — Original problem statement
- [`UI_Wireframes/`](../UI_Wireframes/) — UI reference wireframes (10 screens)

If any doc conflicts with `AGENTS.md` or `Rules.md`, **the canonical files win** and the doc must be updated.

---

## Conventions for documentation

- All schemas are described in `snake_case` for DB columns, `camelCase` for TypeScript.
- API endpoints use kebab-case for path segments, snake_case for query parameters is **not** allowed — use `camelCase` for query params to stay idiomatic with the frontend.
- Every state transition is named consistently across docs: `PUBLISH_RFQ`, `APPROVE_QUOTATION`, etc.
- "Pending verification" is the initial VendorCompany state; "Active" is the only state that can submit quotations.
