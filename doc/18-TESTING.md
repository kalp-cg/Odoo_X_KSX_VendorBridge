# 18 — Testing Strategy

Workflow correctness is the highest priority. Testing is how we earn the right to call a feature "done".

## 18.1 Test pyramid

```
       E2E (Playwright)              ← critical user journeys
      ─────────────────────
     Integration (Supertest)         ← API endpoints, full Nest app
    ────────────────────────────
   Unit (Jest)                       ← services, workflows, utilities
  ─────────────────────────────────
```

- **Unit** tests are the foundation. They are fast, deterministic, and cover every workflow function and business rule.
- **Integration** tests run the full NestJS app against a real (test) Postgres and exercise the HTTP API.
- **E2E** tests (optional in v1) drive the browser through the critical user journeys.

## 18.2 Test layers in detail

### Unit tests

- **Coverage target**: 80% for services and workflow functions. 100% for state machines (every transition tested).
- **Tools**: Jest.
- **Mocks**: Prisma is mocked at the repository layer, not the client. We use `prisma-mock` or hand-rolled mocks.
- **What we test**:
  - State transitions (every valid + invalid combination).
  - Business rules (BR-xxx referenced in test name).
  - Service logic with mocked repos.
  - Zod schema parsing (positive + negative).
  - Utility functions (date math, ID generation, formatting).
- **What we don't test**: React components here (use component tests instead).

### Integration tests

- **Tool**: Supertest + Jest. A `test/app.ts` helper boots the full NestJS app with a test database.
- **DB**: a separate Postgres database, reset between tests (transactional rollback or truncate).
- **What we test**:
  - Each HTTP endpoint with success and failure cases.
  - Auth + RBAC at the controller layer.
  - Database constraints (FK, unique, CHECK).
  - Audit log immutability (try to UPDATE/DELETE in the test, expect failure).
  - Notifications being created on business events.
  - Workflow transitions end-to-end.

### E2E tests

- **Tool**: Playwright.
- **Scope (v1.1, not required for hackathon submission)**:
  - Officer creates RFQ → vendor submits quotation → officer shortlists → manager approves → PO + invoice generated.
  - Vendor can only see their own data.
  - Approval rejected → officer can shortlist another.
  - Audit log immutable (UI shows entries, no edit buttons).
- **CI**: run on every PR to `main`.

## 18.3 Test data

- **Factories**: a `test/factories/` directory with helpers like `makeUser(overrides)`, `makeVendor()`, `makeRfq()`. They create in-memory objects and persist them via a test Prisma client.
- **Fixtures**: JSON files for stable reference data (statuses, etc.).
- **Seed**: a separate test seed that creates a known set of users/vendors/RFQs for the smoke test.

## 18.4 Per-feature test checklist

Before marking a feature done, verify the following are tested:

- [ ] Happy path (BR-xxx referenced).
- [ ] Edge case 1: minimal valid input.
- [ ] Edge case 2: maximal valid input.
- [ ] Validation: missing required field, invalid format, out-of-range.
- [ ] Auth: unauthenticated → 401.
- [ ] Auth: wrong role → 403.
- [ ] Ownership: another tenant's resource → 403.
- [ ] Workflow: invalid state transition → 409.
- [ ] Business rule: BR-xxx violated → 422 / 409.
- [ ] Audit: log entry written with correct fields.
- [ ] Notification: notification row created (or email queued).
- [ ] Concurrency: two simultaneous requests (e.g., two managers approving at once) — only one wins.

## 18.5 Test naming

Test names are sentences: `it('BR-001: rejects publishing an RFQ with no vendors', ...)`.

Use the rule code (BR-xxx) when the test corresponds to a documented rule. This makes rule coverage auditable.

## 18.6 Test execution

```bash
# Unit only (fast, no DB)
pnpm test

# Integration (requires test DB)
pnpm test:integration

# E2E (requires running app)
pnpm test:e2e

# All
pnpm test:all

# Watch mode
pnpm test:watch

# Coverage
pnpm test -- --coverage
```

CI runs `lint`, `typecheck`, `test`, `test:integration` on every PR. E2E is run on merges to `main` (slower).

## 18.7 CI pipeline (`.github/workflows/ci.yml`)

```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: vb
          POSTGRES_PASSWORD: vb
          POSTGRES_DB: vendorbridge_test
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 5s
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm test:integration
      - run: pnpm build
```

## 18.8 Coverage thresholds

Configured in `jest.config.ts`:

```ts
coverageThreshold: {
  global: { lines: 70, functions: 70, branches: 60 },
  './apps/api/src/modules/**/services/': { lines: 85 },
  './apps/api/src/modules/**/workflow*': { lines: 100 },
  './apps/api/src/common/': { lines: 80 },
}
```

Failing coverage fails CI.

## 18.9 Property-based testing (future)

For state machines, use `fast-check` to generate random transition sequences and verify invariants:

```ts
// pseudocode
fc.assert(fc.property(rfqStateSequence(), (seq) => {
  // apply seq; verify terminal states are reachable only via valid paths
}));
```

For v1, exhaustive unit tests of every transition are sufficient.

## 18.10 Load testing (future)

- k6 scripts in `tests/load/`.
- Run monthly to catch regressions.
- Target: 50 concurrent users with p95 < 500 ms for read endpoints.

## 18.11 Security testing

- `pnpm audit` on every CI run.
- OWASP ZAP baseline scan monthly (manual, not in CI in v1).
- Snyk or Dependabot for dependency CVEs.

## 18.12 Mutation testing (future)

- `stryker` for the most critical services (auth, approval, invoice).
- Verifies that our tests would fail if the implementation changed.

## 18.13 Manual QA checklist (per release)

- [ ] Sign up as a new vendor → admin activates → vendor can log in.
- [ ] Officer creates RFQ → publishes → vendors notified.
- [ ] Vendor submits quotation → officer sees it in comparison.
- [ ] Officer shortlists → manager sees in queue → approves → PO + invoice generated.
- [ ] Vendor sees PO + invoice.
- [ ] Manager rejects → officer shortlists another → eventually approves.
- [ ] RFQ cancel → all quotations auto-rejected.
- [ ] Audit log shows every action.
- [ ] No way to UPDATE/DELETE an audit log entry.
- [ ] Mobile screens are usable.
- [ ] Print and PDF download work.
- [ ] Email send (or console log) works.
