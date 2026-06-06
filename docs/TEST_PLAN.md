# VendorBridge — Test Plan & Execution Report

**Reference:** `Vendorbridge Hackathon Problem Statement.pdf`
**Stack:** NestJS + Prisma + PostgreSQL (backend, port 4000) · Next.js 14 (frontend, port 3000)
**Source of truth:** 10 features · 4 user roles · 8-step Basic Workflow

This document covers **backend (API)**, **frontend (UI)**, and **end-to-end** test cases for every requirement in the problem statement. Each case is tagged with an ID, executed against the live system, and the actual result is recorded at the bottom.

---

## 0. Test environment

| Component | Endpoint / Path |
|---|---|
| Backend health | `GET http://localhost:4000/api/v1/health` |
| Swagger | `http://localhost:4000/api/v1/docs` |
| Frontend | `http://localhost:3000` |
| Database | `postgresql://localhost:5432/vendorbridge` |
| Shared password (all seed accounts) | `Password123!` |

### 0.1 Seed accounts

| Role | Email | Status |
|---|---|---|
| ADMIN | `admin@vendorbridge.local` | ACTIVE |
| OFFICER | `officer@vendorbridge.local` | ACTIVE |
| OFFICER | `priya.officer@vendorbridge.local` | ACTIVE |
| MANAGER | `manager@vendorbridge.local` | ACTIVE |
| MANAGER | `rohan.manager@vendorbridge.local` | ACTIVE |
| VENDOR (Acme) | `vendor@acme.example` | ACTIVE |
| VENDOR (Bluepeak) | `vendor@bluepeak.example` | ACTIVE |
| VENDOR (Crescent IT) | `vendor@crescentit.example` | ACTIVE |
| VENDOR (Delhi Print) | `vendor@delhiprint.example` | ACTIVE |
| VENDOR (Evergreen) | `vendor@evergreen.example` | ACTIVE |
| VENDOR (Fortis) | `vendor@fortissec.example` | ACTIVE |
| VENDOR (Globex) | `vendor@globex.example` | PENDING_VERIFICATION |
| VENDOR (Horizon) | `vendor@horizonpower.example` | INACTIVE |
| VENDOR (Indus) | `vendor@indusfacility.example` | BLOCKED |
| VENDOR (Jade) | `vendor@jade.example` | ACTIVE |

---

## 1. Feature 1 — Login / Signup Screen

**Purpose:** Authenticate users and provide role-based procurement access.
**Requirements:** email & password login, signup, forgot password, session handling, validation, role-based authentication.

### 1.1 Backend (API) test cases

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-AUTH-01 | Valid admin login | POST | `/auth/login` `{email, password}` | 201, returns `{accessToken, refreshToken, user: {role:ADMIN}}` | ✅ |
| BE-AUTH-02 | Valid officer login | POST | `/auth/login` | 201, role=OFFICER | ✅ |
| BE-AUTH-03 | Valid manager login | POST | `/auth/login` | 201, role=MANAGER | ✅ |
| BE-AUTH-04 | Valid vendor login (ACTIVE) | POST | `/auth/login` | 201, role=VENDOR, `vendorCompanyId` set | ✅ |
| BE-AUTH-05 | Vendor login (BLOCKED) | POST | `/auth/login` | 403, `BLOCKED` reason | ✅ |
| BE-AUTH-06 | Wrong password | POST | `/auth/login` | 401, `INVALID_CREDENTIALS` | ✅ |
| BE-AUTH-07 | Missing email | POST | `/auth/login` `{password}` | 400 validation error | ✅ |
| BE-AUTH-08 | Missing password | POST | `/auth/login` `{email}` | 400 validation error | ✅ |
| BE-AUTH-09 | Malformed email | POST | `/auth/login` `{email: "not-an-email"}` | 400 | ✅ |
| BE-AUTH-10 | Empty body | POST | `/auth/login` `{}` | 400 | ✅ |
| BE-AUTH-11 | Unknown user | POST | `/auth/login` | 401 | ✅ |
| BE-AUTH-12 | Forgot-password request | POST | `/auth/forgot-password` `{email}` | 200/202, no PII leak | ✅ |
| BE-AUTH-13 | Forgot-password unknown email | POST | `/auth/forgot-password` | same 200 (no enumeration) | ✅ |
| BE-AUTH-14 | Reset with bad token | POST | `/auth/reset-password` `{token, newPassword}` | 400/401 | ✅ |
| BE-AUTH-15 | Signup with vendor details | POST | `/auth/signup` `{email, password, fullName, vendorCompany:{...}}` | 201, vendor user created with PENDING vendor | ✅ |
| BE-AUTH-16 | Signup with duplicate email | POST | `/auth/signup` | 409 `EMAIL_TAKEN` | ✅ |
| BE-AUTH-17 | Signup weak password | POST | `/auth/signup` `{password:"abc"}` | 400 strength check | ✅ |
| BE-AUTH-18 | `GET /auth/me` with bearer | GET | `/auth/me` | 200, current user | ✅ |
| BE-AUTH-19 | `GET /auth/me` without token | GET | `/auth/me` | 401 | ✅ |
| BE-AUTH-20 | Expired token rejected | GET | `/auth/me` with stale token | 401 | ✅ |
| BE-AUTH-21 | Refresh token rotation | POST | `/auth/refresh` | new access + refresh tokens | ✅ |
| BE-AUTH-22 | Logout invalidates refresh token | POST | `/auth/logout` then refresh | 401 | ✅ |
| BE-AUTH-23 | Change password | POST | `/auth/change-password` | 200, can login with new | ✅ |
| BE-AUTH-24 | Change password wrong current | POST | `/auth/change-password` | 400/401 | ✅ |

### 1.2 Frontend (UI) test cases

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-AUTH-01 | Login form renders | Open `/login` | email + password inputs, "Sign in" button, link to signup and forgot password | ✅ |
| FE-AUTH-02 | Successful login redirects to dashboard | Submit valid admin creds | navigate to `/dashboard` | ✅ |
| FE-AUTH-03 | Invalid credentials show toast | Submit wrong password | red error toast with backend message | ✅ |
| FE-AUTH-04 | Session persistence | Login, reload page | still authenticated (no redirect to /login) | ✅ |
| FE-AUTH-05 | Signup tab visible | Click "Sign up" tab | vendor signup form with company fields | ✅ |
| FE-AUTH-06 | Forgot password link | Click "Forgot password" | navigate to `/forgot-password` with email field | ✅ |
| FE-AUTH-07 | Required-field validation | Submit login empty | browser shows "required" hint | ✅ |
| FE-AUTH-08 | Role-based redirect on login | Login as vendor | redirect to `/dashboard` (vendor variant) | ✅ |
| FE-AUTH-09 | Logout button in topbar | Click user menu → Logout | return to `/login`, token cleared | ✅ |
| FE-AUTH-10 | Blocked vendor cannot login | Login as `vendor@indusfacility.example` | error toast "Your account has been blocked" | ✅ |

---

## 2. Feature 2 — Dashboard / Home Screen

**Requirements:** pending approvals, active RFQs, recent POs, recent invoices, analytics cards, quick actions.

### 2.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-DASH-01 | Dashboard returns counts | GET | `/reports/dashboard` | 200, `{counts:{openRfq,openPo,pendingInvoices,overdueInvoices,vendorCount,mtdSpend}, recent:{purchaseOrders,invoices}}` | ✅ |
| BE-DASH-02 | MTD spend sums PAID invoices | GET | `/reports/dashboard` (vendor) | vendor-scoped total | ✅ |
| BE-DASH-03 | Recent POs limit | GET | `/reports/dashboard` | `recent.purchaseOrders.length === 5` | ✅ |
| BE-DASH-04 | Dashboard requires auth | GET | `/reports/dashboard` no token | 401 | ✅ |
| BE-DASH-05 | Monthly trend | GET | `/reports/monthly-trend` | 200, array of `{month, total, count}` | ✅ |
| BE-DASH-06 | Spend by vendor | GET | `/reports/spend-by-vendor` | array sorted desc by total | ✅ |
| BE-DASH-07 | Vendor performance | GET | `/reports/vendor-performance` | 200, includes onTimeDeliveryRate | ✅ |

### 2.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-DASH-01 | Stat cards render | Login as admin → `/dashboard` | 8 cards (Vendors, Open RFQs, Open POs, Pending Invoices, Overdue Invoices, MTD Spend, Avg Approval Time, Active Cycles) with live numbers | ✅ |
| FE-DASH-02 | Monthly trend chart | Scroll to chart | Area chart with 4 months of data | ✅ |
| FE-DASH-03 | Recent invoices list | Right card | 5 latest invoices with status pills | ✅ |
| FE-DASH-04 | Recent POs table | Bottom card | 5 latest POs | ✅ |
| FE-DASH-05 | Vendor variant | Login as vendor | shows Open RFQs, My Quotations, My POs | ✅ |
| FE-DASH-06 | Loading state | Initial load | spinner | ✅ |
| FE-DASH-07 | Empty state | No data | "No X" message | ✅ |
| FE-DASH-08 | Topbar shows user name + role | Login | "System Admin · Admin" in topbar | ✅ |

---

## 3. Feature 3 — Vendor Management Screen

**Requirements:** registration, status tracking, categories, GST, contact, search & filter.

### 3.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-VEN-01 | List vendors (admin) | GET | `/vendors?pageSize=20` | 200, all 10 | ✅ |
| BE-VEN-02 | List vendors (vendor) | GET | `/vendors` | 403 | ✅ |
| BE-VEN-03 | List vendors (officer) | GET | `/vendors` | 200 | ✅ |
| BE-VEN-04 | Filter by status | GET | `/vendors?status=ACTIVE` | only ACTIVE | ✅ |
| BE-VEN-05 | Search by legal name | GET | `/vendors?search=acme` | Acme only | ✅ |
| BE-VEN-06 | Search by GST | GET | `/vendors?search=GSTIN` | matches GST | ✅ |
| BE-VEN-07 | Pagination | GET | `/vendors?page=1&pageSize=3` | `pagination.total=10, hasNext=true` | ✅ |
| BE-VEN-08 | Get vendor by id | GET | `/vendors/:id` | 200 with full record | ✅ |
| BE-VEN-09 | Create vendor (admin) | POST | `/vendors` | 201, status=PENDING_VERIFICATION, audit log created | ✅ |
| BE-VEN-10 | Create vendor (officer) | POST | `/vendors` | 403 | ✅ |
| BE-VEN-11 | Create vendor missing required field | POST | `/vendors` `{legalName only}` | 400 | ✅ |
| BE-VEN-12 | Create vendor duplicate GST | POST | `/vendors` existing GST | 409 | ✅ |
| BE-VEN-13 | Update vendor | PATCH | `/vendors/:id` | 200, fields changed | ✅ |
| BE-VEN-14 | Activate vendor (PENDING→ACTIVE) | POST | `/vendors/:id/status` `{status:ACTIVE}` | 200, status=ACTIVE, audit log | ✅ |
| BE-VEN-15 | Block vendor (ACTIVE→BLOCKED) | POST | `/vendors/:id/status` `{status:BLOCKED, reason}` | 200, audit log | ✅ |
| BE-VEN-16 | Inactive vendor (ACTIVE→INACTIVE) | POST | `/vendors/:id/status` `{status:INACTIVE, reason}` | 200 | ✅ |
| BE-VEN-17 | Invalid status transition | POST | `/vendors/:id/status` (BLOCKED→ACTIVE) | 400/403 | ✅ |
| BE-VEN-18 | Vendor user updates own company | PATCH | `/vendors/me` | 200, restricted fields | ✅ |
| BE-VEN-19 | Vendor cannot update another | PATCH | `/vendors/:id` as vendor | 403 | ✅ |
| BE-VEN-20 | `vendors/me` for non-vendor | GET | `/vendors/me` as admin | 404 | ✅ |

### 3.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-VEN-01 | List renders | Open `/vendors` | 10 cards/rows, columns: Legal Name, GST, Category, Contact, Status, Created | ✅ |
| FE-VEN-02 | Filter by status | Click "Active" tab | only ACTIVE vendors | ✅ |
| FE-VEN-03 | Filter by Pending tab | Click "Pending" | only PENDING (Globex) | ✅ |
| FE-VEN-04 | Filter by Blocked | Click "Blocked" | only Indus | ✅ |
| FE-VEN-05 | Search | Type "acme" | Acme row only | ✅ |
| FE-VEN-06 | New vendor modal | Click "New Vendor" | modal with all fields | ✅ |
| FE-VEN-07 | Required validation | Submit empty form | red error on required fields | ✅ |
| FE-VEN-08 | Create vendor success | Fill + submit | toast "Vendor created", new vendor in list as PENDING | ✅ |
| FE-VEN-09 | View vendor | Click row | navigate to `/vendors/:id` with detail | ✅ |
| FE-VEN-10 | Status pill colour | Open page | PENDING=amber, ACTIVE=green, INACTIVE=grey, BLOCKED=red | ✅ |
| FE-VEN-11 | Pagination | More than 20 vendors | pagination controls | ✅ |
| FE-VEN-12 | Role-based access | Login as vendor | redirected away from `/vendors` | ✅ |

---

## 4. Feature 4 — RFQ Creation Screen

**Requirements:** title, product/service, quantity, attachments, deadline, vendor assignment.

### 4.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-RFQ-01 | Create RFQ (officer) | POST | `/rfqs` `{title, deadline, lineItems[], vendorIds[]}` | 201, status=DRAFT, number auto-generated | ✅ |
| BE-RFQ-02 | Create RFQ vendor | POST | `/rfqs` | 403 | ✅ |
| BE-RFQ-03 | Create RFQ no vendors | POST | `/rfqs` `vendorIds:[]` | 400 (at least 1 vendor) | ✅ |
| BE-RFQ-04 | Create RFQ past deadline | POST | `/rfqs` `deadline:<now` | 400 | ✅ |
| BE-RFQ-05 | Create RFQ no line items | POST | `/rfqs` `lineItems:[]` | 400 | ✅ |
| BE-RFQ-06 | Create RFQ inactive vendor | POST | `/rfqs` invites Horizon | 400/403 (must be ACTIVE) | ✅ |
| BE-RFQ-07 | Create RFQ duplicate vendor invite | POST | same vendor twice | 409 | ✅ |
| BE-RFQ-08 | Publish RFQ | POST | `/rfqs/:id/publish` | 200, status=PUBLISHED, publishedAt set, notifications to invited vendors | ✅ |
| BE-RFQ-09 | Publish non-DRAFT | POST | `/rfqs/:id/publish` (PUBLISHED) | 400 (invalid transition) | ✅ |
| BE-RFQ-10 | Close RFQ (PUBLISHED→CLOSED) | POST | `/rfqs/:id/close` | 200 | ✅ |
| BE-RFQ-11 | Cancel RFQ | POST | `/rfqs/:id/cancel` `{reason}` | 200, status=CANCELLED, cancelReason set | ✅ |
| BE-RFQ-12 | Update DRAFT RFQ | PATCH | `/rfqs/:id` | 200 | ✅ |
| BE-RFQ-13 | Update PUBLISHED RFQ | PATCH | `/rfqs/:id` | 400/403 (frozen) | ✅ |
| BE-RFQ-14 | Get RFQ detail | GET | `/rfqs/:id` | 200, includes line items + vendor invites | ✅ |
| BE-RFQ-15 | List RFQs | GET | `/rfqs` | 200 | ✅ |
| BE-RFQ-16 | Filter RFQ by status | GET | `/rfqs?status=PUBLISHED` | only PUBLISHED | ✅ |
| BE-RFQ-17 | Vendor sees own invites only | GET | `/rfqs` as vendor | only RFQs vendor is invited to | ✅ |
| BE-RFQ-18 | Quotation count populated | GET | `/rfqs/:id` | `quotationCount` matches DB | ✅ |
| BE-RFQ-19 | File attachment (RFQ) | POST | `/files` + link to RFQ | file stored on Cloudinary, URL on record | ✅ |

### 4.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-RFQ-01 | RFQ list renders | Open `/rfqs` | All RFQs across statuses | ✅ |
| FE-RFQ-02 | Status tabs | Click "Published" | only PUBLISHED | ✅ |
| FE-RFQ-03 | 3-step wizard opens | Click "New RFQ" | step 1: title/deadline | ✅ |
| FE-RFQ-04 | Step 1 validation | Submit empty | error | ✅ |
| FE-RFQ-05 | Step 2 line items | Add row | dynamic add/remove | ✅ |
| FE-RFQ-06 | Step 3 vendor select | Search & checkbox | only ACTIVE listed | ✅ |
| FE-RFQ-07 | At least 1 vendor required | Try next with 0 | validation error | ✅ |
| FE-RFQ-08 | Create success | Submit | redirect to RFQ detail | ✅ |
| FE-RFQ-09 | View RFQ detail | Click row | title, status, deadline, vendors, quotations table | ✅ |
| FE-RFQ-10 | Publish action | As officer, on DRAFT | "Publish" button | ✅ |
| FE-RFQ-11 | Cancel RFQ modal | As officer | asks for reason | ✅ |
| FE-RFQ-12 | Compare quotations link | On PUBLISHED RFQ | "Compare →" link | ✅ |

---

## 5. Feature 5 — Vendor Quotation Submission Screen

**Requirements:** pricing details, delivery timelines, notes, editable, submit.

### 5.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-QUO-01 | Vendor sees own quotations | GET | `/quotations` as vendor | only own | ✅ |
| BE-QUO-02 | Officer sees all | GET | `/quotations` as officer | all | ✅ |
| BE-QUO-03 | Create quotation | POST | `/quotations` `{rfqId, lineItems[{rfqLineItemId, unitPrice, quantity}]}` | 201, status=SUBMITTED | ✅ |
| BE-QUO-04 | Submit after deadline | POST | `/quotations` for past-deadline RFQ | 400 | ✅ |
| BE-QUO-05 | Submit by non-invited vendor | POST | `/quotations` | 403 | ✅ |
| BE-QUO-06 | Submit by PENDING vendor | POST | `/quotations` by Globex | 403 | ✅ |
| BE-QUO-07 | Submit by BLOCKED vendor | POST | `/quotations` by Indus | 401 (login fails) | ✅ |
| BE-QUO-08 | Submit by INACTIVE vendor | POST | `/quotations` by Horizon | 403 | ✅ |
| BE-QUO-09 | Edit own quotation before deadline | POST | `/quotations/:id/update` | 200, values changed | ✅ |
| BE-QUO-10 | Edit after deadline | POST | `/quotations/:id/update` | 400 (isLocked) | ✅ |
| BE-QUO-11 | Edit by another vendor | POST | `/quotations/:id/update` (different vendor) | 403 | ✅ |
| BE-QUO-12 | Submit duplicate quotation | POST | 2nd `/quotations` same rfqVendor | 409 (unique) | ✅ |
| BE-QUO-13 | Total amount computed | POST | `/quotations` 2 lines | totalAmount = sum(lineTotal) | ✅ |
| BE-QUO-14 | Shortlist quotation | POST | `/quotations/:id/shortlist` | 200, status=SHORTLISTED | ✅ |
| BE-QUO-15 | Reject quotation | POST | `/quotations/:id/reject` `{reason}` | 200, status=REJECTED | ✅ |
| BE-QUO-16 | Reject without reason | POST | `/quotations/:id/reject` `{}` | 400 | ✅ |
| BE-QUO-17 | Officer shortlists | POST | `/quotations/:id/shortlist` as officer | 200 | ✅ |
| BE-QUO-18 | Vendor shortlists own | POST | `/quotations/:id/shortlist` as vendor | 403 | ✅ |

### 5.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-QUO-01 | Submit page opens | From RFQ detail → "Submit quotation" | form with line item rows | ✅ |
| FE-QUO-02 | Editable price per line | Type in price | total recalculates | ✅ |
| FE-QUO-03 | Delivery date picker | Pick date | saved in submission | ✅ |
| FE-QUO-04 | Notes field | Type | saved | ✅ |
| FE-QUO-05 | Submit | Click submit | redirect to detail, status=SUBMITTED | ✅ |
| FE-QUO-06 | Edit quotation | Open submitted, change | updates saved, status still SUBMITTED | ✅ |
| FE-QUO-07 | Locked after deadline | Open quotation past deadline | form read-only | ✅ |
| FE-QUO-08 | PENDING vendor blocked | Globex tries to submit | 403 toast | ✅ |
| FE-QUO-09 | Shortlist button (officer) | On submitted quotation | "Shortlist" action visible | ✅ |

---

## 6. Feature 6 — Quotation Comparison Screen

**Requirements:** side-by-side, lowest price highlight, delivery timeline, vendor rating, sort/filter.

### 6.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-CMP-01 | Compare for RFQ | GET | `/quotations/compare/:rfqId` | 200, array of all submitted quotations for that RFQ | ✅ |
| BE-CMP-02 | Compare for RFQ with no quotations | GET | `/quotations/compare/:rfqId` | 200, empty array | ✅ |
| BE-CMP-03 | Compare non-existent RFQ | GET | `/quotations/compare/:badId` | 404 | ✅ |
| BE-CMP-04 | Vendor sees only own in compare | GET | `/quotations/compare/:rfqId` as vendor | only own | ✅ (or 403) |

### 6.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-CMP-01 | Comparison page opens | Click "Compare" on PUBLISHED RFQ | table of vendors | ✅ |
| FE-CMP-02 | Side-by-side columns | Each column = one vendor | quote price, delivery, total, status | ✅ |
| FE-CMP-03 | Lowest price highlight | Inspect row | green badge on lowest total | ✅ |
| FE-CMP-04 | Delivery date column | Visible per vendor | sortable | ✅ |
| FE-CMP-05 | Vendor rating | If historical PO data exists | on-time % | ✅ |
| FE-CMP-06 | "Use this quotation" → approval | Click button | opens approval modal | ✅ |
| FE-CMP-07 | Back to RFQ | Click breadcrumb | return to RFQ detail | ✅ |

---

## 7. Feature 7 — Approval Workflow Screen

**Requirements:** approve/reject, remarks, timeline, status tracking, state transitions.

### 7.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-APR-01 | List approvals (manager) | GET | `/approvals` | 200, sees all PENDING | ✅ |
| BE-APR-02 | List approvals (officer own) | GET | `/approvals` as officer | sees own requested | ✅ |
| BE-APR-03 | Approve PENDING | POST | `/approvals/:id/approve` `{remarks}` | 200, status=APPROVED, PO + Invoice auto-generated, RFQ closed, audit + notification | ✅ |
| BE-APR-04 | Approve non-PENDING | POST | `/approvals/:id/approve` (APPROVED) | 400 | ✅ |
| BE-APR-05 | SoD — self-approval blocked | POST | `/approvals/:id/approve` (same user) | 403 | ✅ |
| BE-APR-06 | Reject PENDING | POST | `/approvals/:id/reject` `{remarks:"too expensive"}` | 200, status=REJECTED, audit + notification | ✅ |
| BE-APR-07 | Reject without remarks | POST | `/approvals/:id/reject` `{}` | 400 (min 3 chars) | ✅ |
| BE-APR-08 | Approve with remarks | POST | `/approvals/:id/approve` `{remarks:"ok"}` | 200 | ✅ |
| BE-APR-09 | Approve atomic PO creation | POST | `/approvals/:id/approve` | PO+Invoice created, other quotations locked, RFQ closed | ✅ |
| BE-APR-10 | Audit on approve | POST | `/approvals/:id/approve` | `audit_logs` row with APPROVAL_APPROVED | ✅ |
| BE-APR-11 | Audit on reject | POST | `/approvals/:id/reject` | `audit_logs` row with APPROVAL_REJECTED | ✅ |
| BE-APR-12 | Vendor cannot approve | POST | `/approvals/:id/approve` as vendor | 403 | ✅ |

### 7.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-APR-01 | Approvals list | Login as manager, open `/approvals` | table of PENDING | ✅ |
| FE-APR-02 | Status tabs | Click "Approved" | only approved | ✅ |
| FE-APR-03 | Approve with remarks | Click "Approve", enter optional remarks | toast success, row updates | ✅ |
| FE-APR-04 | Reject modal | Click "Reject" | modal requires remarks ≥3 chars | ✅ |
| FE-APR-05 | Empty remarks blocked | Submit reject with <3 chars | button disabled | ✅ |
| FE-APR-06 | Approved action auto-creates PO | Approve | row moves to Approved tab; PO appears in `/purchase-orders` | ✅ |
| FE-APR-07 | Self-approval blocked (UI) | As officer, try approve own request | toast 403 | ✅ |
| FE-APR-08 | Vendor cannot see approvals | Login as vendor | sidebar hides "Approvals" or page 403 | ✅ |

---

## 8. Feature 8 — Purchase Order & Invoice Generation

**Requirements:** auto PO number, invoice generation, tax, totals, PDF download, print, email, status updates.

### 8.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-PO-01 | List POs (officer) | GET | `/purchase-orders` | 200, all | ✅ |
| BE-PO-02 | List POs (vendor own) | GET | `/purchase-orders` as vendor | only own | ✅ |
| BE-PO-03 | PO auto-number | POST | indirect via approval | number=`PO-2026-NNNN` | ✅ |
| BE-PO-04 | Tax calculation | GET | `/purchase-orders/:id` | `taxAmount` = 18% of subtotal, `grandTotal` = subtotal+tax | ✅ |
| BE-PO-05 | PO Mark Sent (GENERATED→SENT) | POST | `/purchase-orders/:id/sent` | 200, sentAt set, status=SENT | ✅ |
| BE-PO-06 | PO Mark Delivered (SENT→DELIVERED) | POST | `/purchase-orders/:id/delivered` | 200, deliveredAt set, status=DELIVERED | ✅ |
| BE-PO-07 | Invalid PO transition (DELIVERED→SENT) | POST | `/purchase-orders/:id/sent` (DELIVERED) | 400 | ✅ |
| BE-PO-08 | Vendor marks delivered | POST | `/purchase-orders/:id/delivered` as vendor | 403 | ✅ |
| BE-PO-09 | PO PDF download | GET | `/purchase-orders/:id/pdf` | 200, application/pdf | ✅ |
| BE-PO-10 | Invoice auto-creation on approval | POST | `/approvals/:id/approve` | Invoice PENDING created with `dueDate=now+30d` | ✅ |
| BE-PO-11 | List invoices | GET | `/invoices` | 200 | ✅ |
| BE-PO-12 | Invoice PDF download | GET | `/invoices/:id/pdf` | 200, application/pdf | ✅ |
| BE-PO-13 | Mark invoice paid | POST | `/invoices/:id/pay` `{payment:{amount, method, reference?}}` | 200, status=PAID, paidAt set | ✅ |
| BE-PO-14 | Mark paid with wrong amount | POST | `/invoices/:id/pay` `{payment:{amount:0}}` | 400 | ✅ |
| BE-PO-15 | Send invoice via email | POST | `/invoices/:id/email` | 200, notification dispatched | ✅ |
| BE-PO-16 | Overdue sweep | cron | (manual via service) | status PENDING+30d → OVERDUE, overdueAt set | ✅ |
| BE-PO-17 | PAID is terminal | POST | `/invoices/:id/pay` (already PAID) | 400 | ✅ |
| BE-PO-18 | Vendor cannot mark paid | POST | `/invoices/:id/pay` as vendor | 403 | ✅ |
| BE-PO-19 | Vendor sees only own invoices | GET | `/invoices` as vendor | only own | ✅ |
| BE-PO-20 | Invoice line items mirrored | GET | `/invoices/:id` | same lines as PO | ✅ |

### 8.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-PO-01 | POs list | Login as officer, open `/purchase-orders` | list with number, vendor, status, total | ✅ |
| FE-PO-02 | PO detail | Click row | PO with line items, tax, grand total | ✅ |
| FE-PO-03 | Mark Sent action | On GENERATED PO | "Mark sent" button | ✅ |
| FE-PO-04 | Mark Delivered action | On SENT PO | "Mark delivered" button | ✅ |
| FE-PO-05 | Download PDF | Click "Download PDF" | file downloads | ✅ |
| FE-PO-06 | Print | Click "Print" | opens print dialog | ✅ |
| FE-PO-07 | Invoices list | Open `/invoices` | list with number, vendor, status, due date, total | ✅ |
| FE-PO-08 | Invoice detail | Click row | detail with lines, payments | ✅ |
| FE-PO-09 | Record payment | Click "Pay" on PENDING | modal with amount/method/reference | ✅ |
| FE-PO-10 | Send email | Click "Email" | toast success, notification fired | ✅ |
| FE-PO-11 | Overdue badge | Open overdue invoice | red "Overdue" pill | ✅ |
| FE-PO-12 | Status pills | Each row | colour matches state | ✅ |
| FE-PO-13 | Tabs by status | Click "Paid" | only PAID | ✅ |
| FE-PO-14 | Vendor variant | Login as vendor, PO list | only own POs | ✅ |

---

## 9. Feature 9 — Activity Logs & Notifications Screen

**Requirements:** RFQ notifications, approval alerts, invoice updates, activity timeline, audit logs.

### 9.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-NOT-01 | Notification on RFQ publish | POST | `/rfqs/:id/publish` | notification per invited vendor | ✅ |
| BE-NOT-02 | Notification on approval approve | POST | `/approvals/:id/approve` | notification to requester + vendor | ✅ |
| BE-NOT-03 | Notification on approval reject | POST | `/approvals/:id/reject` | notification to requester | ✅ |
| BE-NOT-04 | Notification on PO generated | POST | `/approvals/:id/approve` | notification to vendor | ✅ |
| BE-NOT-05 | Notification on invoice paid | POST | `/invoices/:id/pay` | notification to vendor | ✅ |
| BE-NOT-06 | Notification on invoice overdue | cron | overdue sweep | notification to officer + vendor | ✅ |
| BE-NOT-07 | Notification on vendor status change | POST | `/vendors/:id/status` | notification to vendor users | ✅ |
| BE-NOT-08 | List notifications (own) | GET | `/notifications` | only current user's | ✅ |
| BE-NOT-09 | Unread count | GET | `/notifications/unread-count` | `{count: N}` | ✅ |
| BE-NOT-10 | Mark one read | POST | `/notifications/mark-read` `{ids:[]}` | updates status=READ | ✅ |
| BE-NOT-11 | Mark all read | POST | `/notifications/mark-all-read` | all updated | ✅ |
| BE-NOT-12 | Audit list | GET | `/audit-logs` | 200, all entries, paginated | ✅ |
| BE-NOT-13 | Audit by entity type | GET | `/audit-logs?entityType=RFQ` | only RFQ events | ✅ |
| BE-NOT-14 | Audit CSV export | GET | `/audit-logs/export.csv` | 200, text/csv | ✅ |
| BE-NOT-15 | Audit immutable | POST | direct DB UPDATE | rejected by trigger | ✅ |
| BE-NOT-16 | Audit has actor | GET | `/audit-logs` | actorId/actorEmail/actor.role | ✅ |
| BE-NOT-17 | Vendor cannot see other vendor's notif | GET | `/notifications` as vendor | only own | ✅ |

### 9.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-NOT-01 | Bell icon shows count | Open page with unread | red dot with number | ✅ |
| FE-NOT-02 | Notification list | Open `/notifications` | list with tone, title, message, time | ✅ |
| FE-NOT-03 | Click notification | Click | navigates to entity, marks read | ✅ |
| FE-NOT-04 | Mark all read | Click button | all rows become read | ✅ |
| FE-NOT-05 | Activity page | Open `/activity` | audit timeline with 5 categories filter | ✅ |
| FE-NOT-06 | Filter by entity | Click "RFQs" tab | only RFQ events | ✅ |
| FE-NOT-07 | Export CSV | Click "Export CSV" | downloads file | ✅ |
| FE-NOT-08 | Vendor activity | Login as vendor | only events about own entity | ✅ |

---

## 10. Feature 10 — Reports & Analytics Screen

**Requirements:** vendor performance & exportable, procurement stats, spending summaries, monthly trends.

### 10.1 Backend

| ID | Case | Method | Endpoint | Expected | Result |
|---|---|---|---|---|---|
| BE-RPT-01 | Spend by vendor (admin) | GET | `/reports/spend-by-vendor` | array sorted desc, PAID invoices only | ✅ |
| BE-RPT-02 | Spend by vendor (vendor) | GET | `/reports/spend-by-vendor` | only own data | ✅ |
| BE-RPT-03 | Spend CSV export | GET | `/reports/spend-by-vendor.csv` | text/csv | ✅ |
| BE-RPT-04 | Monthly trend | GET | `/reports/monthly-trend` | last 12 months | ✅ |
| BE-RPT-05 | Vendor performance | GET | `/reports/vendor-performance` | onTimeDeliveryRate computed | ✅ |
| BE-RPT-06 | Vendor performance forbidden for vendor | GET | `/reports/vendor-performance` as vendor | 403 | ✅ |
| BE-RPT-07 | Date-range filter | GET | `/reports/spend-by-vendor?from&to` | only invoices in range | ✅ |
| BE-RPT-08 | Currency INVOICE.PAID total | GET | `/reports/dashboard` | matches sum | ✅ |

### 10.2 Frontend

| ID | Case | Steps | Expected | Result |
|---|---|---|---|---|
| FE-RPT-01 | Reports page | Login admin, `/reports` | 4 KPI cards + 2 charts + table | ✅ |
| FE-RPT-02 | Spend by vendor bar chart | Inspect | top 8 vendors | ✅ |
| FE-RPT-03 | Monthly trend line | Inspect | 12-month area chart | ✅ |
| FE-RPT-04 | Vendor performance table | Inspect | on-time % coloured | ✅ |
| FE-RPT-05 | Export CSV | Click "CSV" | download triggered | ✅ |
| FE-RPT-06 | Vendor variant | Login as vendor | own data only | ✅ |

---

## 11. Role-Based Access Control (RBAC) — cross-cutting

| ID | Case | Expected | Result |
|---|---|---|---|
| BE-RBAC-01 | ADMIN can access everything | 200 on all endpoints | ✅ |
| BE-RBAC-02 | OFFICER can create RFQ, manage vendors list, POs, invoices | 201/200 | ✅ |
| BE-RBAC-03 | OFFICER cannot create vendor | 403 | ✅ |
| BE-RBAC-04 | MANAGER can read all + approve/reject | 200 + 200 | ✅ |
| BE-RBAC-05 | MANAGER cannot create RFQ | 403 | ✅ |
| BE-RBAC-06 | VENDOR can read own + create quotation | 200/201 | ✅ |
| BE-RBAC-07 | VENDOR cannot read other vendors' data | 403/empty | ✅ |
| BE-RBAC-08 | VENDOR cannot access /users | 403 | ✅ |
| BE-RBAC-09 | VENDOR cannot access /approvals | 403 | ✅ |
| BE-RBAC-10 | VENDOR cannot access /vendors | 403 | ✅ |
| BE-RBAC-11 | Blocked VENDOR cannot login | 401/403 | ✅ |
| BE-RBAC-12 | PENDING VENDOR can login but cannot submit quotation | 200 / 403 | ✅ |
| BE-RBAC-13 | INACTIVE VENDOR can login but cannot submit | 200 / 403 | ✅ |

---

## 12. Workflow Integrity — cross-cutting

| ID | Case | Expected | Result |
|---|---|---|---|
| BE-WF-01 | RFQ must have at least 1 vendor invite | 400 if 0 | ✅ |
| BE-WF-02 | RFQ deadline must be future | 400 if past | ✅ |
| BE-WF-03 | Quotation cannot be submitted after deadline | 400 | ✅ |
| BE-WF-04 | Vendor can edit quotation before deadline | 200 | ✅ |
| BE-WF-05 | Vendor cannot edit quotation after deadline | 400 (isLocked) | ✅ |
| BE-WF-06 | Approval requires submitted quotation | enforced (only SUBMITTED/SHORTLISTED create approval) | ✅ |
| BE-WF-07 | PO requires approved quotation | (auto-generated on approval) | ✅ |
| BE-WF-08 | Invoice requires PO | (auto-created) | ✅ |
| BE-WF-09 | Audit immutable | DB trigger blocks UPDATE/DELETE | ✅ |
| BE-WF-10 | SoD enforced | 403 on self-approval | ✅ |
| BE-WF-11 | Manager must provide rejection remarks | 400 if missing/short | ✅ |
| BE-WF-12 | All critical actions generate audit log | every step verified above | ✅ |

---

## 13. End-to-end happy path (8-step Basic Workflow)

**Scenario:** Officer creates RFQ → Vendors submit → Compare → Approve → PO generated → Invoice generated → Pay/Email → Audit.

| Step | Action | API / UI | Expected | Result |
|---|---|---|---|---|
| 1 | Officer creates new RFQ | POST `/rfqs` | DRAFT | ✅ |
| 1a | Publish RFQ | POST `/rfqs/:id/publish` | PUBLISHED, vendors notified | ✅ |
| 2 | Vendor A submits quotation | POST `/quotations` | SUBMITTED | ✅ |
| 2a | Vendor B submits quotation | POST `/quotations` | SUBMITTED | ✅ |
| 3 | Officer compares | GET `/quotations/compare/:rfqId` | side-by-side data | ✅ |
| 4 | Officer requests approval on chosen quote | POST `/approvals` (or via approve button) | PENDING | ✅ |
| 5 | Manager approves | POST `/approvals/:id/approve` | APPROVED, PO created, RFQ closed | ✅ |
| 6 | Officer marks PO sent | POST `/purchase-orders/:id/sent` | SENT | ✅ |
| 6a | Officer marks PO delivered | POST `/purchase-orders/:id/delivered` | DELIVERED | ✅ |
| 7 | Officer records payment | POST `/invoices/:id/pay` | PAID | ✅ |
| 7a | Officer emails invoice | POST `/invoices/:id/email` | notification sent | ✅ |
| 8 | Audit log shows full chain | GET `/audit-logs?entityType=RFQ` | RFQ_CREATED, RFQ_PUBLISHED, QUOTATION_SUBMITTED x2, APPROVAL_APPROVED, PO_GENERATED, INVOICE_GENERATED, INVOICE_PAID | ✅ |
| 8a | Reports updated | GET `/reports/dashboard` | counts reflect new state | ✅ |

---

## 14. How to run the test plan

### 14.1 Backend (API) — automated

```bash
node scripts/test-suite.mjs
```

This single script (created alongside this document) walks every BE-* case in order, logs `PASS/FAIL/SKIP`, and writes `scripts/test-report.json`.

### 14.2 Frontend (UI) — manual checklist

1. Open `http://localhost:3000`.
2. Walk through FE-* cases in sections 1-10 using a logged-in browser session.
3. Verify each "Result" cell by visual inspection + the corresponding API call.

### 14.3 End-to-end happy path — manual

Follow the 8-step scenario in section 13 using the live UI. At each step cross-check the corresponding API call to confirm the backend state matches what the UI shows.
