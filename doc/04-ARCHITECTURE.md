# 04 — System Architecture

## 4.1 Goals

The architecture must be:

- **Modular** — features can be added or removed without touching unrelated code.
- **Scalable** — horizontal scale for the API, read replicas for the DB.
- **Maintainable** — a new engineer can navigate the codebase using only the folder structure.
- **Predictable** — same patterns repeated across modules (controller → service → repository).
- **AI-friendly** — clear, explicit, and well-documented so AI agents can continue work without confusion.

## 4.2 High-level topology

```
┌──────────────────────────────────────────────────────────────────┐
│                          BROWSER (Vendor Portal / Internal)      │
│              Next.js 15 (App Router) + TypeScript + shadcn/ui    │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTPS / JSON
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       NestJS API (REST)                          │
│  Feature-based modules: auth, users, vendors, rfq, quotation,     │
│  approval, purchase-order, invoice, notification, audit, report   │
│  Cross-cutting: RBAC guard, validation pipe, error filter,       │
│  transaction interceptor, audit interceptor                      │
└────────────┬───────────────────────────┬─────────────────────────┘
             │                           │
             ▼                           ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │   PostgreSQL         │    │   Cloudinary         │
   │   (Prisma ORM)       │    │   (file metadata +   │
   │                      │    │    URLs only in DB)  │
   └──────────────────────┘    └──────────────────────┘
```

## 4.3 Request lifecycle

```
HTTP Request
  → Global Validation Pipe (Zod / class-validator)
  → JWT Auth Guard (extract & verify token, attach req.user)
  → Roles Guard (check role vs @Roles() decorator)
  → Ownership Check (service-level for vendor data)
  → Controller (thin — validates DTO, delegates)
  → Service (business logic, state transitions, audit, notification)
    → Repository / Prisma (persistence)
    → DB transaction (for state changes — see Rules §Transaction Rules)
  → Global Exception Filter (formats error response)
  → JSON response (consistent envelope)
```

## 4.4 Layered structure

```
HTTP
  │
  ▼
[Controller]  — receives request, validates DTO, authorizes, delegates
  │
  ▼
[Service]     — owns business logic, workflow transitions, transactions
  │              emits audit + notifications
  │
  ▼
[Repository]  — owns Prisma queries, no business logic
  │
  ▼
[Prisma Client] → PostgreSQL
```

Rules:

- Controllers **never** contain business logic.
- Services **never** call HTTP-related concerns.
- Repositories **never** decide which fields to expose — they return DTOs.
- Prisma is the only ORM. No raw SQL unless absolutely necessary and reviewed.

## 4.5 Module boundaries

Each feature module owns:

```
modules/<feature>/
  ├── controllers/         # HTTP layer
  ├── services/            # Business logic
  ├── repositories/        # Prisma access
  ├── dto/                 # Request/response shapes
  ├── validators/          # Zod schemas (shared with frontend if needed)
  ├── types/               # TS types and enums
  ├── constants.ts         # State names, event names
  ├── <feature>.module.ts  # Nest module definition
  ├── tests/               # Unit + integration tests
  └── README.md            # Module doc
```

Modules **may depend on**:

- `prisma` (shared)
- `common/` (shared utilities — guards, pipes, filters, decorators)
- Other modules via their **public service** (not their repository or controller).

Modules **must not depend on** another module's controller or repository.

## 4.6 Cross-cutting concerns

| Concern | Implementation |
|---------|----------------|
| Auth | `JwtAuthGuard` reads `Authorization: Bearer <token>`, attaches `req.user` |
| RBAC | `RolesGuard` + `@Roles('ADMIN', ...)` decorator |
| Ownership | `OwnershipService.findOwnedBy(user, entityType, id)` |
| Validation | Global `ValidationPipe` with class-validator + Zod for ad-hoc |
| Errors | Global `HttpExceptionFilter` returns consistent error envelope |
| Transactions | `Transactional` decorator or explicit `prisma.$transaction` in services that mutate state |
| Audit | `AuditService.log(event)` called explicitly from services (no interceptor magic) |
| Notifications | `NotificationService.emit(event)` called explicitly from services |
| Logging | `nestjs-pino` structured JSON logs, request-scoped child logger |
| Config | `@nestjs/config` with Zod-validated env schema (see [16-SETUP.md](16-SETUP.md)) |

## 4.7 Frontend architecture

```
Next.js 15 App Router
  ├── app/                      # Routes
  │   ├── (auth)/login, signup
  │   ├── (internal)/dashboard, rfq, vendors, ...
  │   ├── (vendor)/vendor-portal/...
  │   └── api/                  # BFF endpoints (rare, mostly for file streaming)
  ├── components/
  │   ├── ui/                   # shadcn/ui primitives
  │   ├── forms/                # Reusable form components
  │   ├── tables/               # TanStack Table wrappers
  │   └── feature/              # Feature-specific components
  ├── lib/
  │   ├── api/                  # Typed API client (Zod schemas)
  │   ├── auth/                 # Token storage, refresh
  │   └── hooks/                # Custom React hooks
  ├── stores/                   # Zustand stores for client state
  └── styles/                   # Tailwind config, globals
```

State management: **TanStack Query** for server state (data fetching, cache, invalidation). **Zustand** for ephemeral UI state. Forms with **React Hook Form + Zod**.

Routing: route groups for `auth`, `internal` (officer/manager/admin), `vendor` (vendor portal). Middleware enforces role-based access on the route group level.

## 4.8 Deployment topology

For the hackathon:

- **Frontend** — Vercel (or any Next.js host).
- **Backend** — single NestJS instance on Render / Railway / Fly.io.
- **Database** — managed PostgreSQL (Neon, Supabase, or RDS).
- **Files** — Cloudinary (free tier).
- **Secrets** — env vars in hosting platform.

For production (future):

- Frontend behind CDN (Vercel Edge / CloudFront).
- Backend behind load balancer, multiple instances.
- PostgreSQL primary + read replicas.
- Cloudinary production tier.
- Separate staging environment.

## 4.9 Data flow examples

### 4.9.1 Officer publishes an RFQ

```
Browser (POST /api/rfqs/:id/publish)
  → JwtAuthGuard → RolesGuard (OFFICER, ADMIN)
  → RfqController.publish(id)
  → RfqService.publish(id, user)
      → DB transaction:
          - validate state == DRAFT
          - validate vendors count >= 1
          - validate deadline > now
          - update status → PUBLISHED
          - audit.log("RFQ_PUBLISHED", { rfqId, userId })
          - notification.emit to each assigned vendor ("RFQ_PUBLISHED")
      → return updated RFQ
  → Response: { success: true, data: rfq }
```

### 4.9.2 Manager approves a shortlisted quotation

```
Browser (POST /api/approvals/:id/approve)
  → JwtAuthGuard → RolesGuard (MANAGER)
  → ApprovalController.approve(id, { remarks? })
  → ApprovalService.approve(id, user, dto)
      → DB transaction:
          - load approval; must be PENDING
          - ensure user is not the same as the one who shortlisted (SoD)
          - update approval → APPROVED
          - update quotation → ACCEPTED
          - generate PO (auto PO number, line items from quotation)
            - update PO status → GENERATED
            - audit.log("PO_GENERATED")
          - generate Invoice from PO
            - audit.log("INVOICE_GENERATED")
          - audit.log("APPROVAL_APPROVED")
          - notification.emit to officer, vendor, admin
      → return approval + PO + invoice
  → Response
```

## 4.10 Non-functional targets

| Concern | Target |
|---------|--------|
| API p95 latency | < 300 ms for read endpoints, < 800 ms for write |
| Availability | 99% (hackathon), 99.9% (production) |
| Audit retention | Permanent (immutable) |
| Data backup | Daily (production) |
| Concurrent users | 50 (hackathon), 1000+ (production) |
| Browser support | Last 2 versions of Chrome, Edge, Firefox, Safari |

## 4.11 What is intentionally NOT in the architecture

- **No microservices.** A single NestJS monolith is the right call for this scale. Splitting now would add operational cost with no benefit.
- **No GraphQL.** REST + Zod-typed client is sufficient and easier for a hackathon team.
- **No message queue.** Notifications and audit logs are synchronous within the request transaction. They are designed to be migrated to a queue later.
- **No Redis** in v1. Cache can be added later if needed.
- **No real-time updates** (websockets) in v1. Polling / on-focus refetch is sufficient.
