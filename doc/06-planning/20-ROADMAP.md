# 20 — Roadmap & Phased Delivery

VendorBridge is delivered in **phases**. Each phase is independently demoable and adds user-visible value. We will not start a phase until the previous phase's success criteria are met.

## 20.1 Phase overview

| Phase | Name | Goal | Demo-able? |
|-------|------|------|-----------|
| 0 | Foundation | Repo, infra, auth, users, roles | Login as admin/officer/manager/vendor |
| 1 | Vendors | Vendor CRUD, vendor portal skeleton | Admin can onboard a vendor; vendor can log in |
| 2 | RFQ | RFQ CRUD, publish, vendor assignment | Officer publishes RFQ; vendor sees it |
| 3 | Quotations | Submit, edit, lock, compare, shortlist | Officer can compare; vendor can submit |
| 4 | Approvals | Approval workflow with SoD | Manager approves; PO + invoice generated |
| 5 | PO & Invoice | PO and invoice lifecycle, PDF, print, email | Full procurement cycle works |
| 6 | Notifications & Audit | Activity logs, in-app notifications, audit log UI | Compliance trail visible |
| 7 | Reports & Polish | Reports, analytics, UX polish, mobile QA | Demo-ready |
| 8 | Hardening | E2E tests, security audit, performance | Production-ready |

## 20.2 Phase 0 — Foundation

**Goal**: a working monorepo with auth, role-based access, and the database schema in place.

**Scope**:
- Monorepo setup (pnpm workspaces).
- Prisma schema for `User`, `Role`, `VendorCompany`.
- Auth module: signup, login, refresh, password reset (token only; email send stubbed in v1).
- RBAC guard + role assignment on user activation.
- Frontend route groups + middleware.
- Login, signup, forgot-password screens.
- Admin can create users, activate them, and assign roles.
- Health check endpoint.

**Success criteria**:
- Admin signs up another user; user logs in with the right role.
- JWT auth works; refresh-token rotation works.
- Rate limiting on auth endpoints.
- Lint, typecheck, basic unit tests all pass.

**Module specs involved**: [M01-AUTH](../modules/M01-AUTH.md), [M02-USERS](../modules/M02-USERS.md).

---

## 20.3 Phase 1 — Vendors

**Goal**: vendor master data is complete and the vendor portal is live.

**Scope**:
- Vendor CRUD (admin).
- Vendor status lifecycle (PENDING_VERIFICATION → ACTIVE → INACTIVE / BLOCKED).
- Vendor categories, GST, contact details.
- Vendor document upload (Cloudinary).
- Vendor signup creates a VendorCompany in PENDING_VERIFICATION.
- Admin activates vendor → user becomes ACTIVE.
- Vendor portal layout and navigation (no business actions yet).

**Success criteria**:
- Admin can create, edit, block, and unblock vendors.
- Vendor signs up → admin verifies → vendor logs in → sees vendor portal.
- Vendor can view and edit limited fields of their own profile.
- Search and filter vendors works (server-side, paginated).
- Vendor can upload GST/PAN docs.

**Module specs involved**: [M03-VENDORS](../modules/M03-VENDORS.md), [M12-FILE-UPLOADS](../modules/M12-FILE-UPLOADS.md).

---

## 20.4 Phase 2 — RFQ

**Goal**: officers can create and publish RFQs; vendors see them.

**Scope**:
- RFQ CRUD (officer).
- RFQ line items.
- Deadline validation.
- Vendor assignment.
- Publish / close / cancel transitions.
- In-app notification to assigned vendors on publish.
- Vendor portal: list of assigned RFQs, detail view.
- Audit log entries for every RFQ action.

**Success criteria**:
- Officer creates a multi-line-item RFQ, assigns 3 vendors, and publishes.
- The 3 vendors receive an in-app notification.
- Each vendor sees the RFQ in their portal with a countdown to deadline.
- Officer can close or cancel; auto-reject of quotations (placeholder for Phase 3).
- RFQ list is filterable by status, vendor, date.

**Module specs involved**: [M04-RFQ](../modules/M04-RFQ.md), [M09-NOTIFICATIONS](../modules/M09-NOTIFICATIONS.md), [M10-AUDIT-LOGS](../modules/M10-AUDIT-LOGS.md).

---

## 20.5 Phase 3 — Quotations

**Goal**: vendors submit quotations; officers compare and shortlist.

**Scope**:
- Vendor creates, edits (before deadline), and submits a quotation.
- Auto-lock at deadline.
- Comparison screen (side-by-side, lowest price highlighted).
- Shortlist action creates an Approval(PENDING).
- Quotation status transitions (SUBMITTED → SHORTLISTED/REJECTED).
- Audit + notifications.

**Success criteria**:
- Vendor submits a quotation on a published RFQ; officer sees it.
- Vendor edits the quotation before deadline; changes persist.
- After deadline, the form is read-only with a banner.
- Officer sees a comparison; the lowest is highlighted.
- Officer shortlists one; a pending Approval is created; manager is notified.
- A second shortlist supersedes the first; old shortlist is auto-rejected.

**Module specs involved**: [M05-QUOTATIONS](../modules/M05-QUOTATIONS.md), [M06-APPROVALS](../modules/M06-APPROVALS.md).

---

## 20.6 Phase 4 — Approvals

**Goal**: manager approves; PO + Invoice generated automatically.

**Scope**:
- Manager approval queue.
- Approve / Reject actions; reject requires remarks.
- SoD enforcement.
- On approval: PO + Invoice generated in the same transaction.
- Audit + notifications.

**Success criteria**:
- Manager sees the pending approval in the queue.
- Manager approves → Quotation = ACCEPTED, PO = GENERATED, Invoice = PENDING, all in one transaction.
- Manager rejects with remarks → Quotation = REJECTED, officer can shortlist another.
- The user who shortlisted cannot be the approver (SoD enforced).
- Manager who is not the shortlister can approve.

**Module specs involved**: [M06-APPROVALS](../modules/M06-APPROVALS.md), [M07-PURCHASE-ORDERS](../modules/M07-PURCHASE-ORDERS.md), [M08-INVOICES](../modules/M08-INVOICES.md).

---

## 20.7 Phase 5 — PO & Invoice

**Goal**: PO and Invoice lifecycles are complete; print, PDF, and email work.

**Scope**:
- PO: GENERATED → SENT → DELIVERED.
- Invoice: PENDING → PAID / OVERDUE.
- Server-rendered invoice PDF (`@react-pdf/renderer`).
- Browser print (CSS @media print).
- Email send (in v1, console-log the email; in v1.1, actually send).
- Vendor can mark their own PO as delivered.

**Success criteria**:
- Officer marks PO sent → vendor sees status change.
- Officer or vendor marks delivered → status updates.
- Officer marks invoice paid → terminal.
- Invoice PDF download works server-side.
- Print dialog produces a clean invoice layout.
- Email send logs (or actually sends) a message with a PDF attachment.
- Vendor can only see their own PO/Invoice.

**Module specs involved**: [M07-PURCHASE-ORDERS](../modules/M07-PURCHASE-ORDERS.md), [M08-INVOICES](../modules/M08-INVOICES.md), [M12-FILE-UPLOADS](../modules/M12-FILE-UPLOADS.md).

---

## 20.8 Phase 6 — Notifications & Audit

**Goal**: the activity and compliance views are complete.

**Scope**:
- Notification panel in the topbar (bell + dropdown).
- Mark as read (single, all).
- Activity timeline (per-user view of their events).
- Audit log UI (admin/officer/manager): filter by entity, action, user, date.
- CSV export of audit logs.

**Success criteria**:
- User sees unread notifications in the topbar with a badge.
- Clicking a notification marks it read and navigates.
- Audit log shows every critical event with the actor and metadata.
- CSV export contains all matching entries.

**Module specs involved**: [M09-NOTIFICATIONS](../modules/M09-NOTIFICATIONS.md), [M10-AUDIT-LOGS](../modules/M10-AUDIT-LOGS.md).

---

## 20.9 Phase 7 — Reports & Polish

**Goal**: reports work, the UX is polished, and mobile is solid.

**Scope**:
- Vendor performance report (rating, on-time delivery, win rate).
- Spend report (by vendor, by category, by month).
- Monthly procurement trend chart.
- Date-range filters.
- CSV / PDF export.
- Mobile QA pass on all 10 screens.
- Accessibility audit (WCAG AA).
- Empty states, error states, loading states on every screen.
- Final UI polish per wireframes.

**Success criteria**:
- Admin can see a vendor performance ranking.
- Manager can see monthly spend and trend.
- All reports respect vendor ownership filters.
- All screens work on a 375px-wide viewport.
- Lighthouse score > 90 for accessibility on the main pages.

**Module specs involved**: [M11-REPORTS](../modules/M11-REPORTS.md).

---

## 20.10 Phase 8 — Hardening

**Goal**: production-ready.

**Scope**:
- E2E test suite covering the full happy path.
- Security audit (OWASP top 10).
- Performance: query analysis, N+1 elimination, caching.
- Observability: structured logs, error tracking, health check.
- Deployment to production.
- Backup and restore validation.
- Documentation pass (final review of all docs).

**Success criteria**:
- All critical user journeys pass in E2E.
- `pnpm audit` shows no high-severity issues.
- API p95 latency < 300 ms for reads, < 800 ms for writes.
- Production deploy succeeds; smoke test passes.
- A new engineer can onboard using only the docs.

---

## 20.11 Out of scope for v1 (post-hackathon)

- Multi-tenant support.
- Email/SMS/push notifications (in-app only for v1).
- Real payment processing.
- Multi-currency, FX.
- Mobile native apps.
- SSO / SAML.
- Multi-factor authentication.
- Soft-delete with archive.
- Custom approval chains (multi-step approval).
- Vendor self-onboarding with KYC document verification.
- Multi-language support.

## 20.12 Definition of Done (per phase)

A phase is "done" when:

- [ ] All features in the phase scope are implemented and pass tests.
- [ ] Audit + notifications are wired in (per BR-090, BR-092).
- [ ] Lint, typecheck, unit, and integration tests pass.
- [ ] Manual smoke test described in the PR is performed.
- [ ] Documentation (this folder, relevant module specs) is updated.
- [ ] At least one team member has reviewed and approved.
- [ ] The demo video / walkthrough is recorded (if required).

## 20.13 How to use this doc

- **Before starting a phase**, re-read its scope and success criteria.
- **When blocked**, decide: is the blocker a new task, a new phase, or out of scope? Document the decision here.
- **After each phase**, update this doc with what was actually delivered vs. planned. Track drift.

## 20.14 Timeline (hackathon)

The hackathon is short; phases 0–5 are the must-haves for demo. Phases 6–7 are the polish. Phase 8 is post-hackathon.

Suggested ordering for a 3–4 person team over the hackathon duration:

| Day | Focus | Phases |
|-----|-------|--------|
| 1 | Foundation + Auth | Phase 0 |
| 2 | Vendors + RFQ | Phases 1 + 2 |
| 3 | Quotations + Approvals | Phases 3 + 4 |
| 4 | PO + Invoice + polish | Phases 5 + 6 |
| 5 (if available) | Reports + hardening | Phases 7 + 8 |
