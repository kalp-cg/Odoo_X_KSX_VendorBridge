# 13 — Security

Security is a first-class concern. VendorBridge handles procurement data, vendor tax information, and approval decisions — all of which are sensitive.

## 13.1 Security principles

1. **Backend is the source of truth.** Frontend permissions are a UX convenience, not a security boundary.
2. **Defense in depth.** Authn + authz at API + ownership check in service + DB constraints.
3. **Fail closed.** When in doubt, deny access. Default-deny > default-allow.
4. **Least privilege.** Users (and roles) have the minimum permissions needed.
5. **Audit everything that matters.** See [11-AUDIT-LOGS.md](11-AUDIT-LOGS.md).
6. **Never trust the client.** Validate every input server-side.

## 13.2 Authentication

- **Mechanism**: JWT-based.
- **Access token**: 15-minute TTL, signed with RS256 (asymmetric — public key can be verified without the signing key).
- **Refresh token**: 7-day TTL, httpOnly + Secure + SameSite=Strict cookie, single-use rotation, stored hashed in the DB.
- **Algorithm**: argon2id for password hashing. Salt included in hash.
- **Token claims**:
  - `sub` — user id
  - `roles` — array of role names
  - `vendorCompanyId` — set if the user is a vendor user
  - `iat`, `exp`, `iss`, `aud`

## 13.3 Authorization (RBAC)

- Implemented as `JwtAuthGuard` + `RolesGuard` + `@Roles()` decorator.
- `RolesGuard` checks the JWT roles against the decorator. If the route requires `MANAGER` and the user is `OFFICER`, request is denied with 403.
- A custom `OwnershipGuard` is used for routes that access a single resource (e.g., `GET /vendor-companies/:id`). It checks the user owns the resource (or is an admin/officer/manager with broader access).
- Per-record ownership (e.g., "vendor can only see their own quotations") is enforced in the **service layer**, not in guards. The service uses `OwnershipService.findOwnedBy(user, entity, id)` to load the resource after checking ownership.

## 13.4 Ownership pattern

```ts
// In a service
async getQuotation(user: User, id: string) {
  const quotation = await this.prisma.quotation.findUnique({ where: { id } });
  if (!quotation) throw new NotFoundException();

  if (user.hasRole('VENDOR') && quotation.vendorCompanyId !== user.vendorCompanyId) {
    throw new ForbiddenException('OWNERSHIP_DENIED');
  }
  return quotation;
}
```

For list endpoints, the same filter is applied at the query level:

```ts
async listQuotations(user: User, filters: QuotationFilters) {
  const where = { ...filters };
  if (user.hasRole('VENDOR')) {
    where.vendorCompanyId = user.vendorCompanyId;
  }
  return this.prisma.quotation.findMany({ where });
}
```

## 13.5 Input validation

- **Backend**: NestJS `ValidationPipe` with `class-validator` decorators on DTOs. Ad-hoc Zod schemas for complex cases.
- **Frontend**: Zod + React Hook Form. The same Zod schema is shared (in `packages/shared`).
- **URL params**: parsed through `ParseUUIDPipe` (UUIDs only).
- **Query strings**: validated with Zod.
- **Headers**: trust only `Authorization`, `X-Request-Id`, `Idempotency-Key`. Other headers are ignored.

## 13.6 Threat model

| Threat | Mitigation |
|--------|------------|
| **Credential stuffing** | Rate limit login (10/min/IP). Account lockout after 5 failed attempts (15-min cooldown). |
| **JWT theft** | Short TTL (15 min). Refresh token rotation. httpOnly cookies. |
| **Privilege escalation** | RBAC enforced at guard + service. No client-side role checks trusted. |
| **IDOR (Insecure Direct Object Reference)** | Ownership check in service. Vendor user can only access own resources. |
| **SQL injection** | Prisma uses parameterized queries exclusively. No raw SQL. |
| **XSS** | React escapes by default. No `dangerouslySetInnerHTML` without sanitization. CSP headers. |
| **CSRF** | SameSite=Strict cookies. Custom header on mutations (`X-Requested-With`). Bearer tokens are not auto-attached by browsers. |
| **Clickjacking** | `X-Frame-Options: DENY`. CSP `frame-ancestors 'none'`. |
| **File upload abuse** | Cloudinary-side validation: max size, mime type allow-list, no executable types. Server-side metadata validation. |
| **Email enumeration on signup** | Signup always returns the same generic response; the actual existence is checked later via email confirmation (v1.1). |
| **Mass assignment** | DTOs explicitly enumerate allowed fields. `class-transformer`'s `@Expose` / `@Exclude` used. |
| **Audit log tampering** | DB triggers + DB role with no UPDATE/DELETE on `audit_logs`. |
| **Email/PDF injection in invoice** | All user inputs sanitized. PDF rendered server-side from typed data, not raw HTML. |
| **Replayed approvals** | `Idempotency-Key` header. State transition checks current status. |
| **DOS via large lists** | Pagination enforced (default 20, max 100). DB indexes on filtered columns. |
| **Insider threat (admin abuse)** | Admin actions are audited. Audit log immutable. Sensitive actions (delete, role change) require re-auth (future v2). |

## 13.7 HTTP security headers

Set by a NestJS middleware on all responses:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Content-Security-Policy: default-src 'self'; img-src 'self' https://res.cloudinary.com data:; ...
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

CSP is tuned per route (e.g., the invoice PDF route allows inline styles for the PDF renderer).

## 13.8 CORS

- Allowlist: only the frontend origin(s) in env.
- In dev: `http://localhost:3000`.
- In prod: the deployed frontend URL.
- Credentials: true (for refresh-token cookies).
- Methods: GET, POST, PATCH, DELETE, OPTIONS.
- Headers: Authorization, Content-Type, X-Request-Id, Idempotency-Key.

## 13.9 Secrets management

- All secrets in env vars. Never in code or git.
- `.env` is gitignored. `.env.example` is committed with placeholders.
- Production secrets in the hosting platform's secret manager (Vercel env, Render env, etc.).
- Database password rotated quarterly (production).
- JWT signing keys: RS256, key pair generated per environment, private key only on the API.

## 13.10 Logging and PII

- Logs may include user IDs and email (for traceability) but never passwords, tokens, or sensitive tax info.
- Logs are structured JSON (`nestjs-pino`).
- Request logs include: method, path, status, duration, request id, user id (if authed), IP.
- Body logging is **off by default** for write endpoints. Enable per-route with a `@LogBody()` decorator for debugging.
- Logs are retained 30 days (production). In dev, console only.

## 13.11 Account lockout

- 5 consecutive failed logins → 15-minute cooldown.
- The counter resets on successful login.
- The cooldown is per email, not per IP (to prevent targeted lockouts of legitimate users).
- Admin can manually unlock.

## 13.12 Vendor data isolation (multi-tenant-lite)

- Every vendor-scoped query includes `where.vendorCompanyId = currentUser.vendorCompanyId` for vendor users.
- There is no admin override that lets a vendor see other vendors' data.
- Officer and manager can see all vendors' data (within the single buyer org).
- The `OwnershipService` is the **only** place that builds these filters; service code must use the helper, not hand-roll the where clause.

## 13.13 What is NOT in v1

- Multi-factor authentication.
- SSO / SAML / OIDC.
- IP allowlists.
- Hardware key support.
- Detailed session management UI (list devices, revoke).
- Field-level encryption of tax data.
- GDPR data subject access endpoints (planned v2).

These are documented as future work but explicitly out of scope for the hackathon.
