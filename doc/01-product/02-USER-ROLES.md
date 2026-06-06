# 02 — User Roles & Permissions

VendorBridge has **4 user roles**. Permissions are enforced **server-side** (backend is the source of truth) and mirrored on the frontend only for UX convenience.

## 2.1 Role catalogue

### Admin

**Responsibilities**
- Manage users (create, deactivate, change role).
- Manage vendors (verify, activate, block).
- Manage system settings (categories, tax rate defaults, email templates).
- View all procurement analytics.
- Full read access across the system.

**Distinguishing traits**
- The only role that can activate or block a `VendorCompany`.
- The only role that can change another user's role.
- Even Admin **cannot modify audit logs** — see [11-AUDIT-LOGS.md](../03-platform/11-AUDIT-LOGS.md).

---

### Procurement Officer

**Responsibilities**
- Create, edit, and publish RFQs.
- Assign vendors to RFQs.
- Compare quotations.
- **Shortlist** one quotation per RFQ and submit it for Manager approval.
- Generate Purchase Orders (after approval) and Invoices.
- Print and email invoices.

**Distinguishing traits**
- The only role that can create RFQs and shortlist quotations.
- **Cannot approve** their own shortlist — Manager must approve (Separation of Duties).

---

### Manager (Approver)

**Responsibilities**
- Review procurement requests.
- Approve or reject shortlisted quotations.
- Provide **mandatory remarks** on rejection.
- Monitor workflow progress.

**Distinguishing traits**
- The only role that can transition an `Approval` from `PENDING` to `APPROVED` or `REJECTED`.
- A Manager cannot shortlist a quotation. They only see what the Officer has shortlisted.

---

### Vendor (Vendor User)

**Responsibilities**
- View RFQs assigned to their `VendorCompany`.
- Submit quotations (with pricing, delivery timeline, notes).
- Edit their own quotations **only before the RFQ deadline**.
- Track the status of their quotations.
- View their own Purchase Orders.

**Distinguishing traits**
- **Strict ownership isolation.** A vendor user can only access data belonging to their own `VendorCompany`.
- A vendor user **cannot** see other vendors' quotations, even on the same RFQ.
- A vendor user **cannot** see pricing comparison or internal-only fields.

## 2.2 Permission matrix

Legend: ✅ = allowed, ❌ = not allowed, 🔒 = allowed but restricted (see notes).

| Capability | Admin | Procurement Officer | Manager | Vendor |
|---|:---:|:---:|:---:|:---:|
| **Users** | | | | |
| Create user | ✅ | ❌ | ❌ | ❌ |
| Activate / deactivate user | ✅ | ❌ | ❌ | ❌ |
| Change user role | ✅ | ❌ | ❌ | ❌ |
| List all users | ✅ | 🔒 (officers, managers only) | 🔒 (officers only) | ❌ |
| **Vendors** | | | | |
| Create vendor company | ✅ | ❌ | ❌ | ❌ |
| Verify (activate) vendor | ✅ | ❌ | ❌ | ❌ |
| Block / unblock vendor | ✅ | ❌ | ❌ | ❌ |
| List vendors | ✅ | ✅ | ✅ | 🔒 (own only) |
| Edit vendor profile | ✅ | ❌ | ❌ | 🔒 (own only, limited fields) |
| **RFQ** | | | | |
| Create RFQ | ✅ | ✅ | ❌ | ❌ |
| Edit RFQ (Draft) | ✅ | ✅ | ❌ | ❌ |
| Publish RFQ | ✅ | ✅ | ❌ | ❌ |
| Close / cancel RFQ | ✅ | ✅ | ❌ | ❌ |
| View RFQ | ✅ | ✅ | ✅ | 🔒 (assigned to own vendor only) |
| **Quotations** | | | | |
| Submit quotation | ❌ | ❌ | ❌ | ✅ (for own vendor, before deadline) |
| Edit quotation | ❌ | ❌ | ❌ | ✅ (own, before deadline) |
| View single quotation | ✅ | ✅ | ✅ | 🔒 (own only) |
| View comparison | ✅ | ✅ | ✅ | ❌ |
| Shortlist quotation | ✅ | ✅ | ❌ | ❌ |
| **Approvals** | | | | |
| Approve / reject | ❌ | ❌ | ✅ | ❌ |
| View approval queue | ✅ | ✅ | ✅ | ❌ |
| **Purchase Orders** | | | | |
| Generate PO | ✅ | ✅ (auto on approval) | ❌ | ❌ |
| View PO | ✅ | ✅ | ✅ | 🔒 (own only) |
| Mark PO Sent | ✅ | ✅ | ❌ | ❌ |
| Mark PO Delivered | ✅ | ✅ | ❌ | ✅ (own) |
| **Invoices** | | | | |
| Generate invoice | ✅ | ✅ (auto on PO) | ❌ | ❌ |
| View invoice | ✅ | ✅ | ✅ | 🔒 (own only) |
| Print invoice | ✅ | ✅ | ✅ | 🔒 (own only) |
| Email invoice | ✅ | ✅ | ❌ | ❌ |
| Mark Paid / Overdue | ✅ | ✅ | ❌ | ❌ |
| **Notifications** | | | | |
| Receive notifications | ✅ | ✅ | ✅ | ✅ |
| **Audit logs** | | | | |
| View audit logs | ✅ | ✅ | ✅ | ❌ |
| Modify audit logs | ❌ | ❌ | ❌ | ❌ |
| **Reports** | | | | |
| View all reports | ✅ | ✅ | ✅ | 🔒 (own vendor reports only) |
| Export reports | ✅ | ✅ | ✅ | ❌ |

## 2.3 Separation of Duties (SoD)

The following rules enforce SoD and are **enforced in the service layer**, not just in the UI:

- The user who **shortlists** a quotation **cannot be the same user** who **approves** it.
- The user who **publishes** an RFQ **cannot be the same user** who **submits a quotation** for it (vendor users are external anyway, so this is structural).
- The user who **generates a PO** is the same as the one who **shortlisted** (this is fine — PO is mechanical from the approved quotation). The PO is generated **inside the same transaction as the approval transition**, so the manager's approval is the gate.

## 2.4 Role assignment lifecycle

1. **Signup** — Anyone can sign up. Default state: `INACTIVE`. No role assigned yet.
2. **Admin review** — Admin reviews signup and either:
   - **Approves** → assigns role (e.g., `PROCUREMENT_OFFICER`, `MANAGER`, or links to a `VendorCompany` as `VENDOR`).
   - **Rejects** → account stays `INACTIVE` and is never visible in operational lists.
3. **For vendors specifically** — when a vendor user signs up, the system creates a `VendorCompany` in `PENDING_VERIFICATION` state. Admin must verify the vendor (tax docs, etc.) before activating. The first vendor user becomes the vendor company's primary contact.

## 2.5 Authentication and authorization

- **Authentication**: JWT-based. Access token (short-lived) + refresh token (long-lived, httpOnly cookie).
- **Authorization**: RBAC check at the controller level via a `@Roles()` decorator and a `RolesGuard`. Ownership check (vendor isolation) is enforced in the service layer via a `findOwnedBy()` helper — controllers do not directly query by id.
- **Multi-factor**: out of scope for v1.
- See [13-SECURITY.md](../03-platform/13-SECURITY.md) and [modules/M01-AUTH.md](../modules/M01-AUTH.md) for details.

## 2.6 Account states

A user account can be in one of these states:

- `INACTIVE` — just signed up, awaiting admin approval. Cannot log in.
- `ACTIVE` — approved by admin, can log in and use the system.
- `SUSPENDED` — temporarily blocked by admin (e.g., investigation). Cannot log in.
- `DEACTIVATED` — soft-removed. Cannot log in. Records preserved for audit.

Admin transitions account states. The user cannot self-deactivate.
