# 03 — Screens & UX

This document maps the 10 screens from the problem statement to the modules, permissions, and key UX flows. UI references live in [`UI_Wireframes/`](../UI_Wireframes/).

## 3.1 Screen inventory

| # | Screen | Primary user | Module | Wireframe |
|---|--------|--------------|--------|-----------|
| 1 | Login / Signup | All | Auth | [Login-SignUp.png](../UI_Wireframes/Login-SignUp.png) |
| 2 | Dashboard | All | Dashboard (cross-module) | [mian_landing_page.png](../UI_Wireframes/mian_landing_page.png) |
| 3 | Vendor Management | Admin, Officer, Manager | Vendors | [vendor_page.png](../UI_Wireframes/vendor_page.png) |
| 4 | RFQ Creation | Officer, Admin | RFQ | [rfq_page.png](../UI_Wireframes/rfq_page.png) |
| 5 | Vendor Quotation | Vendor | Quotations | [quotation_image.png](../UI_Wireframes/quotation_image.png) |
| 6 | Quotation Comparison | Officer, Manager | Quotations | [comparision_page.png](../UI_Wireframes/comparision_page.png) |
| 7 | Approval Workflow | Manager, Officer | Approvals | [approval_worfow_page.png](../UI_Wireframes/approval_worfow_page.png) |
| 8 | PO & Invoice | Officer, Manager, Admin | Purchase Orders + Invoices | [P&O_page.png](../UI_Wireframes/P&O_page.png) |
| 9 | Activity Logs & Notifications | All (own only for vendors) | Audit + Notifications | [activity_page.png](../UI_Wireframes/activity_page.png) |
| 10 | Reports & Analytics | Admin, Officer, Manager | Reports | [reports_page.png](../UI_Wireframes/reports_page.png) |

---

## 3.2 Screen 1 — Login / Signup

**Purpose:** Authenticate users and onboard new accounts (including new vendors).

**Key elements**
- Email + password login.
- Signup form (creates an `INACTIVE` user + `PENDING_VERIFICATION` VendorCompany if role is `VENDOR`).
- Forgot password flow → email token (out of scope to actually send in v1, but token API is implemented; in v1 a console-logged reset link is acceptable for the hackathon).
- Form validation with React Hook Form + Zod.
- Role-based redirect after login (vendor → vendor portal, others → dashboard).

**Module spec:** [modules/M01-AUTH.md](modules/M01-AUTH.md)

---

## 3.3 Screen 2 — Dashboard

**Purpose:** Quick situational awareness for the current user.

**Widgets (role-aware)**
- **All users**: pending approvals count (for officer/manager), active RFQs count, recent POs, recent invoices.
- **Vendor**: their own active RFQs and recent POs.
- **Analytics cards**: month-to-date spend, open invoices, overdue invoices, vendor count.
- **Quick action buttons** (role-aware):
  - Officer: "Create RFQ", "Compare Quotations"
  - Manager: "Review Approvals"
  - Vendor: "Submit Quotation"
  - Admin: "Manage Users", "Manage Vendors"

**Implementation note:** Dashboard is a read-only cross-module aggregation view. No business logic lives here.

**Module spec:** Cross-module (uses RFQ, Approval, PO, Invoice services for counts and recent items).

---

## 3.4 Screen 3 — Vendor Management

**Purpose:** Maintain vendor master data.

**Key elements**
- Vendor list table with: name, category, status, GST, contact, created date.
- Status badges: `Pending Verification`, `Active`, `Inactive`, `Blocked`.
- **Search & filtering**: by name, category, status, GST.
- **Create / Edit vendor** (Admin only).
- **Activate / Block** buttons (Admin only, with confirmation modal).
- **Vendor documents** (Cloudinary): GST certificate, PAN, agreement — viewable as links.
- For vendor users: read-only view of **own** vendor profile, with limited editable fields (contact phone, address).

**Module spec:** [modules/M03-VENDORS.md](modules/M03-VENDORS.md)

---

## 3.5 Screen 4 — RFQ Creation

**Purpose:** Initiate a procurement workflow.

**Key elements**
- RFQ title, description.
- Product/service line items (description, quantity, unit, target price).
- Attachments (Cloudinary).
- Deadline picker (must be in the future, server-validated).
- Vendor assignment (multi-select from active vendors).
- **Save as Draft** or **Publish** action.
- After publish: vendors are notified in-app.

**Module spec:** [modules/M04-RFQ.md](modules/M04-RFQ.md)

---

## 3.6 Screen 5 — Vendor Quotation

**Purpose:** Allow vendors to respond to RFQs.

**Key elements**
- List of RFQs the vendor is invited to (filtered by ownership, only `PUBLISHED` and before deadline).
- Per-RFQ: line items pre-filled from RFQ, vendor enters unit price and delivery date.
- **Pricing details**: per-line price, total, notes.
- **Delivery timeline**: estimated delivery date.
- **Notes/comments**: free-text.
- **Submit** action. Before submit, vendor can save and edit freely.
- **Edit** action: only enabled when `rfq.deadline > now`.
- After deadline: form is read-only with a "deadline passed" banner.

**Module spec:** [modules/M05-QUOTATIONS.md](modules/M05-QUOTATIONS.md)

---

## 3.7 Screen 6 — Quotation Comparison

**Purpose:** Help the procurement officer select the best quotation.

**Key elements**
- Side-by-side table of all `SUBMITTED` and `SHORTLISTED` quotations on an RFQ.
- Columns: vendor, total price (lowest highlighted), delivery date, rating, status.
- Sorting by price, delivery date, rating.
- **Shortlist** action: officer marks one quotation as `SHORTLISTED` and triggers an approval.
- If already shortlisted: shows "Recommended for approval" with link to the approval record.

**Module spec:** [modules/M05-QUOTATIONS.md](modules/M05-QUOTATIONS.md), [modules/M06-APPROVALS.md](modules/M06-APPROVALS.md)

---

## 3.8 Screen 7 — Approval Workflow

**Purpose:** Structured procurement approval with SoD.

**Key elements**
- Approval queue (for Managers) with: RFQ, vendor, total, requested by, time waiting.
- Approval detail view: full RFQ + shortlisted quotation.
- **Approve** action: 1-click confirm.
- **Reject** action: requires a non-empty remarks field (modal with textarea, validated).
- **Approval timeline**: created → approved/rejected timestamps.
- **Workflow state transitions** clearly shown (badge + history).
- Officers see read-only state of their submitted approvals.

**Module spec:** [modules/M06-APPROVALS.md](modules/M06-APPROVALS.md)

---

## 3.9 Screen 8 — PO & Invoice Generation

**Purpose:** Convert approved quotation into PO + invoice; print and email.

**Key elements**
- PO detail: auto-generated PO number, vendor info, line items, total, status.
- **Generate PO** action (auto on approval; manual re-print also available).
- **Mark Sent** action.
- **Mark Delivered** action (officer or vendor).
- From a PO: **Generate Invoice** (auto on PO creation, or explicit).
- Invoice detail: PO reference, line items, **single tax rate** (%), tax amount, grand total, status.
- **Download as PDF** action (server-rendered).
- **Print** action (browser print dialog).
- **Send via email** action (in v1: persists the email event; in v1.1: actually sends — see [modules/M08-INVOICES.md](modules/M08-INVOICES.md)).
- Status badges: `Pending`, `Paid`, `Overdue`.

**Module spec:** [modules/M07-PURCHASE-ORDERS.md](modules/M07-PURCHASE-ORDERS.md), [modules/M08-INVOICES.md](modules/M08-INVOICES.md)

---

## 3.10 Screen 9 — Activity Logs & Notifications

**Purpose:** Inform users about procurement updates and provide audit trail.

**Key elements**
- **Notifications panel** (top-right bell): list of unread/seen notifications with timestamps.
- **Activity timeline**: chronological list of the user's relevant events (RFQ published, quotation submitted, approval requested, PO generated, invoice emailed).
- **Audit logs table** (Admin, Officer, Manager): full immutable log with filters by entity type, action, user, date range.
- **Mark as read** action on notifications.

**Module spec:** [modules/M09-NOTIFICATIONS.md](modules/M09-NOTIFICATIONS.md), [modules/M10-AUDIT-LOGS.md](modules/M10-AUDIT-LOGS.md)

---

## 3.11 Screen 10 — Reports & Analytics

**Purpose:** Procurement insights and trends.

**Key elements**
- **Vendor performance**: on-time delivery %, average quotation price, win rate.
- **Procurement statistics**: total spend, count of POs, count of invoices.
- **Spending summaries**: by vendor, by category, by month.
- **Monthly procurement trends**: line/bar chart.
- **Exportable reports** (CSV, PDF).
- Date range picker for all reports.
- For vendors: scoped to their own data only.

**Module spec:** [modules/M11-REPORTS.md](modules/M11-REPORTS.md)

---

## 3.12 UX principles

1. **One primary action per screen.** The most important action is the most prominent.
2. **Workflow state is always visible.** Badges and progress indicators show where in the lifecycle the entity is.
3. **Read-only when read-only.** When a deadline passes or a state is terminal, inputs are disabled and a banner explains why.
4. **No dead ends.** Every error has a path forward. Every empty state has a CTA.
5. **Mobile-first tables.** Tables collapse to cards on small screens via shadcn/ui + Tailwind responsive utilities.
6. **Optimistic UI** for low-risk actions (mark notification read). **Confirmed reload** for high-risk state transitions (approve, reject, publish, mark paid).

## 3.13 Accessibility

- All interactive elements are keyboard-reachable.
- Color is never the only indicator (status badges always include text).
- ARIA labels on icon-only buttons.
- Contrast ratios meet WCAG AA.
- Form errors are associated with their fields and announced.
