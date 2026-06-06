# M01 — Authentication

> Source of truth for everything auth-related. See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.8 (User lifecycle), [13-SECURITY.md](../13-SECURITY.md), and the user-related rules in [10-BUSINESS-RULES.md](../10-BUSINESS-RULES.md).

## M01.1 Purpose

- Authenticate users via email + password.
- Issue short-lived access tokens and long-lived refresh tokens.
- Handle signup, password reset, and session refresh.
- Establish the user's identity for downstream authorization.

## M01.2 Scope

**In scope**:
- Signup (public; creates an `INACTIVE` user).
- Login (returns access token; sets refresh cookie).
- Refresh (rotates refresh token; returns new access token).
- Logout (revokes refresh token).
- Forgot password (issues reset token).
- Reset password (consumes reset token).
- Me (current user info).
- Account lockout after 5 failed attempts.

**Out of scope**:
- Multi-factor authentication (planned v2).
- SSO / SAML / OIDC (planned v2).
- Social login.
- Email enumeration prevention beyond rate limiting.
- Account recovery via security questions (we use email only).

## M01.3 Entities (touch points)

- `User` (id, email, passwordHash, fullName, status, role, vendorCompanyId?).
- `Role`, `UserRole`.
- `RefreshToken` (optional table; in v1 we store a hashed refresh token in a separate table for revocation).

```prisma
model RefreshToken {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  tokenHash   String   // SHA-256 of the token
  expiresAt   DateTime @db.Timestamptz
  revokedAt   DateTime? @db.Timestamptz
  replacedBy  String?  @db.Uuid  // for rotation chain
  createdAt   DateTime @default(now()) @db.Timestamptz
  ip          String?  @db.Inet
  userAgent   String?

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
}
```

## M01.4 Endpoints

| Method | Path | Auth | Body | Returns |
|--------|------|------|------|---------|
| POST | `/api/v1/auth/signup` | public | `{ email, password, fullName, phone?, requestedRole: 'VENDOR', vendorLegalName, vendorCategory, vendorContactEmail, vendorGstNumber? }` | `{ success: true, data: { userId, status: 'INACTIVE' } }` |
| POST | `/api/v1/auth/login` | public | `{ email, password }` | `{ success: true, data: { accessToken, user } }` + Set-Cookie refresh |
| POST | `/api/v1/auth/refresh` | cookie | empty | `{ success: true, data: { accessToken } }` + rotated cookie |
| POST | `/api/v1/auth/logout` | cookie | empty | `{ success: true }` + clears cookie |
| POST | `/api/v1/auth/forgot-password` | public | `{ email }` | `{ success: true }` (always, to avoid enumeration) |
| POST | `/api/v1/auth/reset-password` | public | `{ token, newPassword }` | `{ success: true }` |
| GET  | `/api/v1/auth/me` | jwt | - | `{ success: true, data: { user } }` |

### Notes
- For `requestedRole: 'VENDOR'`, signup also creates a `VendorCompany` in `PENDING_VERIFICATION`. For internal roles (Officer, Manager), signup is the same except the `VendorCompany` is not created and Admin must assign the role.
- For v1, signup for internal roles is accepted but **stays INACTIVE without a role** until Admin assigns one. Vendors wait for Admin verification.

## M01.5 Service layer

```
auth/
├── auth.module.ts
├── controllers/
│   └── auth.controller.ts
├── services/
│   ├── auth.service.ts            # login, refresh, logout
│   ├── signup.service.ts          # signup with role-specific creation
│   ├── password.service.ts        # hash, verify, reset
│   └── token.service.ts           # issue access + refresh, verify access
├── strategies/
│   ├── jwt.strategy.ts            # passport JWT strategy
│   └── local.strategy.ts          # for login (email + password)
├── guards/
│   ├── jwt-auth.guard.ts          # global, attached to controllers
│   └── (RolesGuard lives in common/)
├── dto/
│   ├── signup.dto.ts
│   ├── login.dto.ts
│   ├── refresh.dto.ts
│   ├── forgot-password.dto.ts
│   └── reset-password.dto.ts
├── constants.ts                   # token TTLs, lockout policy
└── tests/
    ├── auth.service.spec.ts
    ├── token.service.spec.ts
    └── auth.controller.spec.ts
```

## M01.6 State transitions

User status transitions are described in [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.8. Auth module enforces:

- A user with `INACTIVE`, `SUSPENDED`, or `DEACTIVATED` cannot log in → 403 `AUTH_NOT_ACTIVE`.
- After 5 consecutive failed logins: 15-minute lockout (tracked in a `FailedLoginAttempt` table or in-memory in v1, persisted in v1.1).

## M01.7 Token strategy

### Access token (JWT, RS256)

- **TTL**: 15 minutes.
- **Claims**:
  - `sub`: user id.
  - `email`: user email.
  - `roles`: array of role names.
  - `vendorCompanyId`: present only for vendor users.
  - `iat`, `exp`, `iss: 'vendorbridge'`, `aud: 'vendorbridge-api'`.
- Sent in `Authorization: Bearer <token>` header.

### Refresh token (opaque, random 32 bytes base64url)

- **TTL**: 7 days.
- Stored as SHA-256 hash in `RefreshToken` table.
- Set as `httpOnly; Secure; SameSite=Strict; Path=/api/v1/auth` cookie.
- **Rotation**: on every refresh, a new token is issued and the old one is marked `revokedAt` with `replacedBy` pointing at the new one. Reuse of a revoked token revokes the entire chain (theft detection).

### Password reset token

- 32 bytes base64url, 1-hour TTL.
- Stored as SHA-256 hash in `PasswordResetToken` table (similar to refresh).
- In v1, the API returns the token in the response (development convenience). In v1.1, it's emailed (see [12-NOTIFICATIONS.md](../12-NOTIFICATIONS.md)).

## M01.8 Password policy

- Minimum 8 characters.
- At least one letter and one number.
- Argon2id hash, parameters: memory=64MB, time=3, parallelism=4.
- No composition rules beyond the above (NIST 800-63B guidance).
- Passwords are never logged, never returned in responses, never stored in plain text.

## M01.9 Rate limits

| Endpoint | Limit |
|----------|-------|
| `POST /auth/login` | 10/minute/IP, 5/minute/email (whichever hits first) |
| `POST /auth/signup` | 5/hour/IP |
| `POST /auth/forgot-password` | 3/hour/email |
| `POST /auth/reset-password` | 10/hour/IP |
| `POST /auth/refresh` | 30/minute/IP |

Implemented via `@nestjs/throttler`. See [08-API-STANDARDS.md](../08-API-STANDARDS.md) §8.11.

## M01.10 Validation

All inputs validated with Zod (shared schema in `packages/shared/src/schemas/auth.ts`).

```ts
// shared/src/schemas/auth.ts
export const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128).regex(/[A-Za-z]/).regex(/\d/),
  fullName: z.string().min(2).max(100),
  phone: z.string().regex(/^\+?[0-9\-\s]{7,20}$/).optional(),
  // For vendors:
  requestedRole: z.literal('VENDOR').default('VENDOR'),
  vendorLegalName: z.string().min(2).max(200),
  vendorCategory: z.string().min(2).max(100),
  vendorContactEmail: z.string().email().max(255),
  vendorGstNumber: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).optional(),
});
```

## M01.11 Audit events

| Event | Trigger | Actor |
|-------|---------|-------|
| `USER_CREATED` | Signup success | system (actorId = new user) |
| `LOGIN_SUCCESS` | Successful login | the user |
| `LOGIN_FAILED` | Failed login (bad creds) | null (no actor) |
| `LOGIN_LOCKED` | Account lockout triggered | null |
| `PASSWORD_RESET_REQUESTED` | Forgot password | null (no actor; email in metadata) |
| `PASSWORD_RESET_COMPLETED` | Reset successful | the user |
| `TOKEN_REFRESHED` | Refresh token used | the user |
| `LOGOUT` | Logout | the user |

## M01.12 Notifications

- Forgot password: in v1, the API returns the token in the response. The frontend renders a "reset link" with the token for dev. In v1.1, an email is sent.
- Login failures do **not** trigger a notification (avoid spam and enumeration).
- Suspicious activity (e.g., refresh-token theft detected via reuse) does NOT notify the user in v1 (planned v2).

## M01.13 Edge cases

| Scenario | Behavior |
|----------|----------|
| Login with `INACTIVE` user | 403 `USER_INACTIVE` |
| Login with `SUSPENDED` user | 403 `USER_SUSPENDED` |
| Login with `DEACTIVATED` user | 403 `USER_DEACTIVATED` |
| Login with wrong password 5x | 429 `RATE_LIMITED` + 15-min lockout. Counter resets on success. |
| Refresh with revoked token | 401 `AUTH_REVOKED`. If reuse detected, revoke the entire chain. |
| Refresh with expired token | 401 `AUTH_EXPIRED` |
| Forgot password for non-existent email | Return 200 (no enumeration). Internally do not write a token row. |
| Reset password with invalid token | 400 `INVALID_TOKEN` |
| Reset password with expired token | 400 `TOKEN_EXPIRED` |
| Signup with existing email | 409 `EMAIL_TAKEN` |
| Concurrent signup with same email | Unique DB constraint enforces. The second one fails with 409. |
| Password change while logged in | Out of scope for v1; in v1.1, add a `POST /auth/change-password` endpoint. |
| Lost refresh token (cookie cleared) | User must log in again. |

## M01.14 Security checklist (per Rules §Security Rules)

- ✅ JWT authentication.
- ✅ Role-based access control (RolesGuard).
- ✅ Ownership checks (for vendor data — see other modules).
- ✅ Input validation.
- ✅ Frontend permissions are convenience only.
- ✅ Backend is the source of truth.
- ✅ No password / token / secret / stack trace in responses.

## M01.15 Future considerations (not in v1)

- Multi-factor auth (TOTP).
- Refresh token theft detection → force re-login.
- Account recovery via backup email.
- "Active sessions" UI.
- Soft delete with archive.
- Account merge for duplicate signups.
