# VendorBridge Project Context

## Project Overview

VendorBridge is a Procurement & Vendor Management ERP.

The purpose of the system is to digitize and automate procurement workflows between organizations and vendors.

This is NOT a CRUD application.

This is a workflow-driven ERP system.

Workflow integrity is the highest priority.

---

# Core Procurement Workflow

Vendor
↓
RFQ
↓
Quotation
↓
Approval
↓
Purchase Order
↓
Invoice
↓
Audit Log
↓
Reports & Analytics

No workflow step may be skipped.

---

# User Roles

## Admin

Responsibilities:

* Manage users
* Manage vendors
* View reports
* Manage system settings

Permissions:

* Full Access

---

## Procurement Officer

Responsibilities:

* Create RFQs
* Manage RFQs
* Compare quotations
* Select vendors
* Generate purchase orders
* Generate invoices

---

## Vendor

Responsibilities:

* View RFQs
* Submit quotations
* Track RFQ status
* View purchase orders

Access limited to own records.

---

## Manager

Responsibilities:

* Review procurement requests
* Approve requests
* Reject requests
* Monitor workflow progress

---

# Core Entities

Users

Roles

Vendors

RFQs

Quotations

Approvals

PurchaseOrders

Invoices

AuditLogs

Notifications

---

# Vendor Lifecycle

Pending Verification
→ Active

Active
→ Inactive

Active
→ Blocked

---

# RFQ Lifecycle

Draft
→ Published

Published
→ Closed

Published
→ Cancelled

Invalid transitions must be blocked.

---

# Quotation Lifecycle

Submitted
→ Shortlisted

Shortlisted
→ Accepted

Submitted
→ Rejected

Shortlisted
→ Rejected

Invalid transitions must be blocked.

---

# Approval Lifecycle

Pending
→ Approved

Pending
→ Rejected

Approved and Rejected states are terminal.

---

# Purchase Order Lifecycle

Generated
→ Sent

Sent
→ Delivered

Invalid transitions must be blocked.

---

# Invoice Lifecycle

Pending
→ Paid

Pending
→ Overdue

Paid is terminal.

Invalid transitions must be blocked.

---

# ERP Business Rules

RFQ must have at least one vendor.

RFQ deadline must be in the future.

Quotation cannot be submitted after deadline.

Vendor can edit quotation before deadline.

Vendor cannot edit quotation after deadline.

Approval requires submitted quotation.

Purchase Order requires approved quotation.

Invoice requires purchase order.

Reports must use actual procurement data.

Workflow rules cannot be bypassed.

---

# Approval Rules

Managers may:

* Approve
* Reject

Managers must provide remarks when rejecting.

Every approval action must create:

* Audit Log Entry
* Workflow Update

---

# Audit Log Rules

Audit logs are immutable.

Allowed:

INSERT

Not Allowed:

UPDATE

DELETE

SOFT DELETE

Even administrators cannot modify audit records.

Audit logs are compliance records.

Every critical action must generate an audit log.

Examples:

* Vendor Created
* Vendor Updated
* RFQ Created
* RFQ Published
* Quotation Submitted
* Quotation Updated
* Approval Approved
* Approval Rejected
* Purchase Order Generated
* Invoice Generated

---

# Notification Rules

Current version uses database-based in-app notifications only.

Future integrations such as:

* Email
* SMS
* Push Notifications
* Webhooks

must remain optional and loosely coupled.

Notification failures must never block business operations.

---

# Reporting Rules

Reports must derive data from:

* RFQs
* Quotations
* Purchase Orders
* Invoices

Avoid duplicated analytics storage unless required for performance.

---

# File Upload Rules

Cloudinary is the source of truth for uploaded files.

Supported uploads:

* RFQ Attachments
* Vendor Documents
* Procurement Documents

Store only metadata and URLs in PostgreSQL.

Do not store files directly in the database.

---

# Success Criteria

The project is successful when:

* Vendor Management works
* RFQ Workflow works
* Quotation Workflow works
* Approval Workflow works
* Purchase Order Workflow works
* Invoice Workflow works
* Audit Logs are immutable
* Permissions are enforced correctly
* Reports are accurate
* Workflow integrity is maintained

Workflow correctness is more important than UI polish.
