# 01 — Product Vision

## 1.1 Problem

Procurement operations in most organizations are still managed with a mix of emails, spreadsheets, phone calls, and disconnected tools. This causes:

- **Lost quotations** — vendors send PDFs over email, prices get stale, no audit trail.
- **No comparison** — procurement officers eyeball multiple quotes in different formats.
- **Approval chaos** — approvals happen in chat threads, no remarks, no timeline.
- **Manual PO + invoicing** — purchase orders and invoices are typed into Word/Excel and emailed.
- **No tracking** — leadership has no real-time view of procurement activity or spend.
- **Compliance gaps** — no immutable record of who approved what, when, and why.

## 1.2 Vision

VendorBridge is a **centralized, workflow-driven ERP** that digitizes the entire procurement cycle — from vendor registration to invoice payment — with:

- Structured workflows (state machines) that **cannot be bypassed**.
- Role-based access for every action.
- Immutable audit logs of every critical event.
- Real-time dashboards and reports.
- Vendor portal with strict ownership isolation.
- Print-ready invoices and email delivery.

The system emphasizes **workflow correctness over UI polish**. A working state machine beats a beautiful screen that lets users skip steps.

## 1.3 Scope (in)

The system supports:

1. **Vendor management** — registration, status lifecycle (Pending Verification → Active → Inactive / Blocked), categories, GST details, contact info, search & filtering.
2. **RFQ lifecycle** — Draft → Published → Closed / Cancelled. Each RFQ assigns at least one vendor and has a future deadline.
3. **Quotation submission** — Vendors submit pricing, delivery timeline, and notes. Quotations are editable until the RFQ deadline, then locked.
4. **Quotation comparison** — Side-by-side view with lowest-price highlight, delivery-time comparison, vendor rating.
5. **Approval workflow** — Officer shortlists one quotation; Manager approves or rejects (with mandatory remarks on rejection). Separation of duties enforced.
6. **Purchase Order generation** — Auto-generated PO number on approval. Status moves Generated → Sent → Delivered.
7. **Invoice generation** — From the approved PO. Generic single tax rate. Status: Pending → Paid / Overdue. PDF download, print, and email.
8. **Notifications** — In-app notifications for RFQ invitations, approval alerts, invoice updates.
9. **Audit logs** — Immutable, append-only log of every critical action.
10. **Reports & analytics** — Vendor performance, spend, monthly trends, exportable.

## 1.4 Scope (out)

The following are explicitly **out of scope** for this version:

- Multi-tenant SaaS (single buyer organization only).
- Real payment processing / payment gateway integration (invoices track status, no money moves).
- Inventory or warehouse management.
- HR, payroll, accounting ledgers.
- Vendor onboarding self-service with KYC document verification (we store metadata, not legal verification).
- Email/SMS/push notifications as first-class channels (future, loosely coupled).
- Mobile native apps (responsive web only).
- Public API for third-party integrations.

## 1.5 Tenancy and access model

- **Single buyer organization** runs the system.
- **Vendors are external companies** with one or more employee user accounts.
- All vendor-side data is filtered by ownership: a vendor user only sees their own vendor company's RFQs, quotations, and POs.
- A **Public signup → Admin approval** flow applies to both internal users (Procurement Officer, Manager) and vendor users. Admin activates the account and assigns the role.

## 1.6 Cardinality

- **1 RFQ = 1 winner** — only one quotation is accepted per RFQ.
- **1 RFQ = 1 PO** — exactly one Purchase Order per accepted RFQ.
- **1 PO = 1 Invoice** — exactly one Invoice per Purchase Order.

## 1.7 Success criteria

The project is successful when:

- Vendor Management works end-to-end.
- RFQ → Quotation → Approval → PO → Invoice flow works without any manual workarounds.
- Audit logs are immutable and contain every critical event.
- Permissions are enforced server-side and verified by tests.
- Reports are derived from live operational data.
- Workflow integrity is provable: invalid transitions are blocked at the API and DB level.

## 1.8 Non-negotiable principles

1. **Workflow integrity over UI polish.**
2. **Backend is the source of truth.** Frontend permissions are convenience only.
3. **Audit logs are append-only.** No UPDATE, no DELETE, no soft delete — ever.
4. **Notifications never block business operations.** A failed notification must not roll back a successful PO.
5. **Fail loud, fail safe.** Errors are logged and traceable; never swallow exceptions silently.
6. **Design for failure before success.** Edge cases and failure scenarios are first-class concerns.

## 1.9 Glossary

| Term | Definition |
|------|------------|
| **Vendor** | An external company that provides goods/services. Has one or more linked user accounts. |
| **Vendor Company** | The legal entity record. Has its own lifecycle. |
| **RFQ** | Request For Quotation. A procurement request sent to one or more vendors. |
| **Quotation** | A vendor's response to an RFQ: price, delivery timeline, notes. |
| **Approval** | A manager's decision on a recommended (shortlisted) quotation. |
| **PO** | Purchase Order. The legal commitment to buy. |
| **Invoice** | A bill issued against a PO. Tracks payment status. |
| **Shortlist** | The procurement officer's selection of one quotation to recommend for approval. |
| **SoD** | Separation of Duties. The officer who recommends cannot be the manager who approves. |
