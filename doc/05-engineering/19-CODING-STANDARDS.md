# 19 — Coding Standards

These standards are derived from `Rules.md` and industry best practices. They are enforced by ESLint, Prettier, and code review.

## 19.1 TypeScript

- **Strict mode** is on. `tsconfig.json` extends `@tsconfig/strictest`.
- **No `any`**. Use `unknown` and narrow with type guards.
- **No `// @ts-ignore`**. Use `// @ts-expect-error` with a comment explaining why.
- **Prefer `type` over `interface`** for object types. Use `interface` only for declaration merging.
- **Prefer `as const`** over enums for closed sets; or use TS `enum` if Prisma generates them and we need to align.
- **Exhaustive switches** with `never`:

```ts
switch (status) {
  case 'DRAFT': ...
  case 'PUBLISHED': ...
  default: {
    const _exhaustive: never = status;
    throw new Error(`Unhandled status: ${_exhaustive}`);
  }
}
```

## 19.2 Naming

| Thing | Convention | Example |
|-------|------------|---------|
| Variables, functions | `camelCase` | `currentUser`, `getRfqById` |
| Classes, types, React components | `PascalCase` | `RfqService`, `RfqForm` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE` |
| Enums (TS) | `PascalCase` for type, `UPPER_SNAKE_CASE` for members | `RfqStatus.PUBLISHED` |
| Booleans | `is`, `has`, `should` prefix | `isActive`, `hasAccess` |
| Async functions | `verb` form | `fetchRfq`, `publishRfq` |
| Event handlers | `on` + `Subject` + `Verb` | `onRfqPublished` |
| React component files | `kebab-case.tsx` | `rfq-form.tsx` |
| Hooks | `use*` | `useRfq` |
| Test files | `<unit>.spec.ts` or `<unit>.test.ts` | `rfq.service.spec.ts` |
| DB columns | `snake_case` | `rfq_number` |
| API paths | `kebab-case` | `/api/v1/purchase-orders` |
| API query params | `camelCase` | `?sortBy=createdAt` |

## 19.3 NestJS specifics

- **One module per feature** under `apps/api/src/modules/<feature>/`.
- **Controllers are thin** — they receive a request, validate the DTO, call the service, return the response. No business logic.
- **Services own business logic**, including state transitions and DB transactions.
- **Repositories** own Prisma queries. They take a `PrismaClient` (or transaction client) as a constructor dep.
- **Use `@Param()`, `@Body()`, `@Query()` decorators** with DTO classes.
- **Decorators**:
  - `@Controller('path')`
  - `@UseGuards(JwtAuthGuard, RolesGuard)`
  - `@Roles('MANAGER')`
  - `@HttpCode(HttpStatus.OK)` for non-201 responses
  - `@ApiOperation()`, `@ApiResponse()` from `@nestjs/swagger` (optional)
- **DTOs are classes with class-validator decorators.** Or Zod schemas piped through `ZodValidationPipe`.
- **No `any` return types on service methods.** Always annotate.
- **No `console.log`.** Use `Logger` from `@nestjs/common` or `nestjs-pino`.

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/rfqs')
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @Post(':id/publish')
  @Roles('PROCUREMENT_OFFICER', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  async publish(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const rfq = await this.rfqService.publish(id, user);
    return { success: true, message: 'RFQ published', data: rfq };
  }
}
```

## 19.4 React / Next.js specifics

- **Components are functions, not classes.**
- **No `useEffect` for data fetching.** Use TanStack Query.
- **No inline `style` attributes** except in shadcn-generated files.
- **No `dangerouslySetInnerHTML`** without DOMPurify.
- **No `any` props.** Type props explicitly.
- **Memoize** only when there's a measured performance issue. Add a comment explaining the reason.
- **Server components by default.** Add `'use client'` only when needed (state, effects, browser APIs).
- **Hooks rules** are strict — no conditional hooks, no hooks inside loops.

## 19.5 Error handling

- **Never swallow exceptions.** If you must catch, log and rethrow.
- **Use the global filter** for HTTP responses. Throw typed exceptions, not `Error`.
- **Domain exceptions** (defined in `common/exceptions/`):
  - `WorkflowInvalidTransitionException`
  - `OwnershipDeniedException`
  - `BusinessRuleViolationException`
  - `EntityNotFoundException`
- The global filter maps these to the right HTTP code and error code.

```ts
if (!canTransition(rfq.status, 'PUBLISHED')) {
  throw new WorkflowInvalidTransitionException('RFQ', rfq.status, 'PUBLISHED');
}
```

## 19.6 Transactions

- **Use `prisma.$transaction(async (tx) => { ... })`** for any operation that mutates state.
- Pass `tx` to the repository and audit service methods — they accept a `PrismaClient | TransactionClient`.
- **Never call `await` between DB operations outside a transaction** when they depend on each other.

## 19.7 Async / await

- **No unhandled promise rejections.** Every `await` is in a try/catch or in a function that returns a rejected promise to a handler.
- **No floating promises** — `pnpm lint` enforces `@typescript-eslint/no-floating-promises`.
- **`Promise.all` over `forEach`** for parallel I/O.

## 19.8 Imports

- **Use the workspace alias** for cross-module imports:
  - `@vb/shared` → `packages/shared/src`
  - `@vb/api/common` → `apps/api/src/common`
  - `@vb/api/modules/<feature>` → `apps/api/src/modules/<feature>`
- **Order**: external → workspace → relative. ESLint enforces.
- **No deep imports** of internal packages.

## 19.9 Comments

- **No comments** that say what the code does (the code should be self-explanatory).
- **Allowed**: business rule references (`// BR-001`), TODOs with an owner and ticket (`// TODO(vb-123):`), and explanations of *why* something non-obvious is done.
- **No commented-out code.** Delete it; git remembers.

## 19.10 Git

- **Branch names**: `feat/<short-desc>`, `fix/<short-desc>`, `chore/<short-desc>`, `docs/<short-desc>`.
- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `perf:`).
- **PRs**: small, focused, with a clear description and a test plan.
- **Squash-merge** to keep `main` history clean.

## 19.11 Logging

- Use `Logger` from `@nestjs/common` or `nestjs-pino` with structured fields.
- **No `console.log`/`console.error` in committed code.**
- Log levels:
  - `error` — failed business operation
  - `warn` — recoverable issue (e.g., notification failed)
  - `info` — significant state change (e.g., RFQ published)
  - `debug` — dev-only

## 19.12 Security in code

- **No `eval`**, no `Function` constructor, no `new Function`.
- **No regex from user input** (ReDoS).
- **No string concatenation for SQL** (Prisma does this; never use `prisma.$queryRaw` with template strings).
- **No secrets in code or logs.**

## 19.13 Performance

- **No N+1 queries.** Use `include` / `select` to fetch related rows.
- **Pagination on every list endpoint.** Default 20, max 100.
- **Indexes on every filtered and joined column** (see [07-DATA-MODEL.md](../02-architecture/07-DATA-MODEL.md)).
- **No `await` in loops for independent operations** — use `Promise.all`.

## 19.14 Dependency policy

- **No new dependencies without review.** Each new dep adds supply-chain risk.
- **Pin versions** in `package.json`.
- **Run `pnpm audit` in CI.** High-severity findings block the build.
- **No deprecated packages.**

## 19.15 Review checklist

Every PR must pass this checklist before merge:

- [ ] Lint passes.
- [ ] Typecheck passes.
- [ ] Tests added/updated; coverage thresholds met.
- [ ] Docs updated (if feature/API/schema changed).
- [ ] No `console.log` left behind.
- [ ] No `any` introduced.
- [ ] No new `TODO` without a ticket.
- [ ] No new dependency added (or, if added, justified in the PR).
- [ ] Migration is forward-only.
- [ ] Audit log + notification calls are present (if state changed).
- [ ] Manual smoke test described in the PR.
- [ ] At least one reviewer approved.
