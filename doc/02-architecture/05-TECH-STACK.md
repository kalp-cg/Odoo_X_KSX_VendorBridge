# 05 — Technology Stack

Every technology in the stack is justified below. The stack is deliberately boring and proven — appropriate for a workflow-driven ERP where reliability matters more than novelty.

## 5.1 Frontend

| Technology | Version | Why |
|------------|---------|-----|
| **Next.js** | 15 | App Router for nested layouts and route groups (auth / internal / vendor), file-based routing, image optimization, and first-class TypeScript support. SSR + CSR hybrid for dashboards. |
| **TypeScript** | 5.x | Static typing catches a large class of bugs at compile time. Required for AI-friendly code. |
| **Tailwind CSS** | 3.x | Utility-first CSS that scales with shadcn/ui. No runtime overhead, easy to audit. |
| **shadcn/ui** | latest | Owned source, not a black-box library. Radix-based primitives with Tailwind styling. Accessible by default. |
| **React Hook Form** | 7.x | Performant, uncontrolled-by-default form state. Pairs with Zod for type-safe validation. |
| **Zod** | 3.x | Schema validation shared between client and server. Single source of truth for input shape. |
| **TanStack Table** | 8.x | Headless table for vendor/RFQ/PO list screens. Sorting, filtering, pagination, virtualization. |
| **TanStack Query** | 5.x | Server state management: cache, refetch, invalidation. Removes a huge class of fetch bugs. |
| **Zustand** | 4.x | Tiny client-state store for UI state (modals, filters in URL). |
| **Recharts** | 2.x | Declarative charts for the Reports screen. Sufficient for the required chart types. |
| **date-fns** | 3.x | Tree-shakable date library. |
| **react-to-print** | latest | Browser print dialog for invoices. |
| **@react-pdf/renderer** | 3.x | Server-rendered PDF generation for invoice downloads. |

## 5.2 Backend

| Technology | Version | Why |
|------------|---------|-----|
| **NestJS** | 10.x | Opinionated Node.js framework with first-class TypeScript, dependency injection, and a modular structure that maps perfectly to our feature-based architecture. Decorators for guards, pipes, interceptors. |
| **Prisma** | 5.x | Type-safe ORM with migrations, schema as source of truth, generated types. The only DB access path. |
| **class-validator** | 0.14.x | DTO validation with decorators. Pairs with NestJS's `ValidationPipe`. |
| **class-transformer** | 0.5.x | DTO transformation. |
| **@nestjs/jwt** | 10.x | JWT issuance and verification. |
| **@nestjs/passport** | 10.x | Passport strategies (JWT, local). |
| **bcrypt** | 5.x | Password hashing. |
| **argon2** | 0.31.x | Modern alternative to bcrypt for password hashing. Argon2id is preferred. |
| **@nestjs/throttler** | 5.x | Rate limiting (login, signup, password reset). |
| **@nestjs/config** | 3.x | Typed configuration from env vars. |
| **nestjs-pino** | 4.x | Structured JSON logging with request correlation ids. |
| **@sendgrid/mail** (or nodemailer) | latest | Email sending for password reset and invoice email. Pluggable. |
| **cloudinary** | 2.x | Cloudinary SDK for file uploads. |
| **uuid** | 9.x | Public IDs (e.g., PO numbers) when needed. |
| **Zod** | 3.x | Validation for ad-hoc payloads (e.g., Zod-validated env, request body in custom pipes). |

### Why NestJS over Express/Fastify directly

- The project has **clear module boundaries** (vendors, RFQ, etc.) — NestJS's module system enforces this.
- **Decorators** for auth, validation, and roles make cross-cutting concerns readable.
- Built-in DI makes services **testable** with simple mocks.
- The team's familiarity with Angular-style frameworks makes onboarding faster.

## 5.3 Database

| Technology | Version | Why |
|------------|---------|-----|
| **PostgreSQL** | 16 | Strong consistency, JSON support, generated columns, and partial indexes for state-machine queries. The right choice for a workflow-driven ERP. |

### Why PostgreSQL over MySQL/MongoDB

- **Transactional integrity** is non-negotiable for state transitions. PostgreSQL's MVCC and FK enforcement are best-in-class.
- **Partial indexes** like `CREATE INDEX ... ON rfqs (deadline) WHERE status = 'PUBLISHED'` are powerful for workflow queries.
- **CHECK constraints** enforce state machines at the DB level (defense in depth).
- MongoDB is rejected: the data is highly relational and benefits from FK integrity.

## 5.4 Infrastructure

| Technology | Why |
|------------|-----|
| **Cloudinary** | Source of truth for files (RFQ attachments, vendor docs). CDN-backed, transformations, signed URLs. Free tier sufficient for hackathon. |
| **Vercel** (frontend) | Zero-config Next.js hosting, preview deployments, env var management. |
| **Render / Railway / Fly.io** (backend) | Managed Node hosting with PostgreSQL add-on. |
| **GitHub Actions** | CI for lint, typecheck, test, and build. |
| **Neon / Supabase** (DB) | Managed PostgreSQL with branching (great for preview environments). |

## 5.5 Development & quality

| Tool | Purpose |
|------|---------|
| **ESLint** | Linting (TypeScript, NestJS, Next.js configs). |
| **Prettier** | Formatting. |
| **Husky** | Git hooks (pre-commit lint, pre-push test). |
| **lint-staged** | Run linters on staged files only. |
| **Jest** | Unit + integration tests. |
| **Supertest** | HTTP integration tests against the NestJS app. |
| **Playwright** | End-to-end tests (optional in v1, recommended in v2). |
| **TypeScript** | `tsc --noEmit` in CI. |

## 5.6 What is explicitly NOT used

- **No microservices.** Monolith is the right call at this scale.
- **No GraphQL.** REST + Zod-typed client is sufficient.
- **No Redis** in v1.
- **No message queue** in v1 (notifications and audit are synchronous within the request transaction; designed to be migrated to a queue later).
- **No real-time** (WebSockets) in v1.
- **No ORM other than Prisma.** Raw SQL is permitted only after review.
- **No state-management library beyond TanStack Query + Zustand.** No Redux, no MobX.

## 5.7 Versioning policy

- All dependencies are pinned in `package.json` with exact versions (no `^` for production deps in the lockfile).
- Major version upgrades require an ADR (Architecture Decision Record) and a migration plan.
- Security patches are applied within 7 days of disclosure.
