# M02 — Users & Roles

> Source of truth for user management and role assignment. See [02-USER-ROLES.md](../02-USER-ROLES.md) for the canonical role definitions and permissions matrix.

## M02.1 Purpose

- Manage user accounts and their roles.
- Support admin operations: create, activate, suspend, deactivate, change role.
- Provide user lookup for admin and audit purposes.

## M02.2 Scope

**In scope**:
- Admin can list, create, edit (name, phone), activate, suspend, deactivate, and change role of users.
- Users can view and edit their own profile (limited fields).
- A user must always have at least one role.
- An `INACTIVE` user cannot log in.

**Out of scope**:
- Self-service role change.
- Bulk user import.
- SSO / SAML.
- Detailed activity-per-user reporting (covered by audit log + reports).

## M02.3 Entities

- `User` (see [07-DATA-MODEL.md](../07-DATA-MODEL.md) §7.2).
- `Role`, `UserRole` (M:N — but in v1, one role per user).
- `VendorCompany` (read-only reference).

## M02.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/users` | ADMIN, OFFICER, MANAGER | List; vendor users cannot list. Officer/Manager see only internal users (non-VENDOR). |
| GET | `/api/v1/users/:id` | ADMIN, OFFICER, MANAGER (officer/manager only for non-vendor users) | Detail |
| POST | `/api/v1/users` | ADMIN | Create a user (alternative to self-signup for internal roles). |
| PATCH | `/api/v1/users/:id` | ADMIN (all fields), USER (own profile, limited fields) | |
| POST | `/api/v1/users/:id/activate` | ADMIN | INACTIVE/SUSPENDED → ACTIVE. Requires role assignment. |
| POST | `/api/v1/users/:id/suspend` | ADMIN | ACTIVE → SUSPENDED |
| POST | `/api/v1/users/:id/deactivate` | ADMIN | ACTIVE → DEACTIVATED (terminal) |
| POST | `/api/v1/users/:id/change-role` | ADMIN | Body: `{ role: 'PROCUREMENT_OFFICER' \| 'MANAGER' \| 'ADMIN' \| 'VENDOR', vendorCompanyId?: string }` |
| GET | `/api/v1/users/me` | any auth | Current user detail. |
| PATCH | `/api/v1/users/me` | any auth | Edit own fullName, phone. |

## M02.5 Service layer

```
users/
├── users.module.ts
├── controllers/
│   └── users.controller.ts
├── services/
│   ├── users.service.ts          # CRUD, list, profile
│   ├── user-status.service.ts    # activate/suspend/deactivate transitions
│   └── user-role.service.ts      # role assignment with invariants
├── repositories/
│   └── users.repository.ts
├── dto/
│   ├── create-user.dto.ts
│   ├── update-user.dto.ts
│   ├── change-role.dto.ts
│   ├── list-users.dto.ts
│   └── user-response.dto.ts
└── tests/
```

## M02.6 Workflow

See [09-WORKFLOWS.md](../09-WORKFLOWS.md) §9.8. Key invariants:

- A user is created in `INACTIVE` state.
- A user cannot log in until `ACTIVE`.
- `DEACTIVATED` is terminal.
- Role change requires the user to be `INACTIVE` or `ACTIVE` (not `SUSPENDED` / `DEACTIVATED`).
- Changing a vendor user to a non-vendor role: explicitly removes `vendorCompanyId`. Audit-logged.
- Changing a non-vendor to vendor: requires `vendorCompanyId`. If the user had signed up without one, admin must specify.

## M02.7 Validation rules

| Code | Rule | Enforced in |
|------|------|-------------|
| BR-080 | Email is unique | DB unique |
| BR-085 | Only admin can change role | RBAC + service |
| BR-082 | INACTIVE cannot log in | Auth service |
| BR-083 | SUSPENDED cannot log in | Auth service |
| — | A user with role VENDOR must have `vendorCompanyId` | Service |
| — | A user with role not VENDOR must NOT have `vendorCompanyId` | Service |
| — | Cannot deactivate yourself | Service guard |
| — | Cannot remove your own admin role (last admin protection) | Service guard |
| — | Full name 2–100 chars; phone optional, E.164-ish | Zod |

## M02.8 Self-profile update

A user can update only:
- `fullName`
- `phone`
- (v2) `password` (out of v1)

All other fields are admin-only.

## M02.9 Audit events

| Event | Trigger |
|-------|---------|
| `USER_CREATED` | Admin creates user OR signup |
| `USER_UPDATED` | Admin edits user fields |
| `USER_ACTIVATED` | Status ACTIVE |
| `USER_SUSPENDED` | Status SUSPENDED |
| `USER_DEACTIVATED` | Status DEACTIVATED |
| `USER_ROLE_CHANGED` | Role changed |

## M02.10 Notifications

- On activation: in-app notification ("Your account is active. You can now log in."). Email is not sent in v1.
- On suspension: in-app notification ("Your account has been suspended. Contact admin."). Email planned v1.1.
- On role change: in-app notification.

## M02.11 Edge cases

| Scenario | Behavior |
|----------|----------|
| Admin tries to deactivate themselves | 403 `SELF_DEACTIVATION_DENIED` |
| Admin removes their own admin role while being the last admin | 409 `LAST_ADMIN` |
| Admin tries to set role to VENDOR without `vendorCompanyId` | 400 `VENDOR_COMPANY_REQUIRED` |
| Admin tries to set non-VENDOR role with `vendorCompanyId` | 400 `VENDOR_COMPANY_NOT_ALLOWED` |
| Suspending a user who is currently logged in | Refresh tokens are revoked. Active access token expires in ≤ 15 min. |
| Activating a user with no role assigned | 422 `ROLE_REQUIRED` (must `change-role` first or in the same call) |
| Listing users with role=VENDOR for an officer | Not allowed; officer sees only internal users |
| Concurrent role change (two admins) | Last write wins with audit trail. The losing one is in the audit log. |

## M02.12 Future (not in v1)

- Bulk import (CSV).
- "Impersonate user" for support.
- Custom roles (e.g., regional manager).
- Department / org unit grouping.
- Profile photo upload.
