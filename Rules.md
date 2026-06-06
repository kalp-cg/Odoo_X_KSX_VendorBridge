# VendorBridge Engineering Rules & Standards

## Core Principle

Before implementing any feature, bug fix, refactor, optimization, migration, workflow change, or database modification:

1. Understand the complete requirement.
2. Understand the business workflow.
3. Analyze affected modules.
4. Analyze affected roles.
5. Analyze database impact.
6. Analyze workflow impact.
7. Analyze audit log impact.
8. Analyze notification impact.
9. Create an implementation plan.
10. Identify edge cases.
11. Identify failure scenarios.
12. Define recovery strategies.
13. Only then begin implementation.

Never start coding immediately.

---

# Engineering Mindset

Think like:

* Product Owner
* ERP Consultant
* Senior Software Engineer
* Security Engineer
* QA Engineer
* Database Engineer
* Performance Engineer
* End User

Before implementation ask:

* Why is this feature needed?
* Which workflow does it affect?
* Which roles are affected?
* What existing modules are affected?
* What can break?
* What happens if API fails?
* What happens if database fails?
* What happens if file upload fails?
* What happens if user retries the same action?
* What happens with invalid input?
* What happens under high load?
* What happens on mobile devices?
* What happens with large datasets?

Always design for failure before success.

---

# Technology Stack

Frontend

* Next.js 15
* TypeScript
* Tailwind CSS
* shadcn/ui
* React Hook Form
* Zod
* TanStack Table

Backend

* NestJS
* Prisma ORM

Database

* PostgreSQL

Infrastructure

* Cloudinary

---

# Architecture Rules

Follow feature-based architecture.

Do not organize code by technical type.

Organize by business domain.

Bad:

src/controllers
src/services
src/repositories

Good:

src/modules/vendor
src/modules/rfq
src/modules/quotation
src/modules/approval
src/modules/purchase-order
src/modules/invoice
src/modules/report

Each feature owns:

* Controllers
* Services
* DTOs
* Validators
* Types
* Constants
* Tests
* Documentation

Architecture must remain:

* Modular
* Scalable
* Maintainable
* Predictable
* AI Friendly

---

# NestJS Standards

Controllers must:

* Receive requests
* Validate requests
* Authorize requests
* Delegate work

Controllers must never contain business logic.

Services own business logic.

Repositories own persistence logic.

Business workflows must live in services.

---

# Prisma Standards

Prisma schema is the source of truth.

Every schema change requires:

1. Schema update
2. Migration creation
3. Migration review
4. Documentation update

Never bypass Prisma.

Never manually modify production schema.

---

# API Standards

All APIs must be:

* Consistent
* Predictable
* Versionable
* Documented

Success Response:

{
"success": true,
"message": "...",
"data": {}
}

Failure Response:

{
"success": false,
"message": "...",
"errors": []
}

Response structures must remain consistent across all endpoints.

---

# Validation Rules

Validate:

* Request Body
* Query Parameters
* URL Parameters
* Headers
* External Inputs

Frontend validation is optional convenience.

Backend validation is mandatory.

Use:

Frontend:

* React Hook Form
* Zod

Backend:

* DTO Validation

Never trust client input.

---

# Error Handling

Every feature must handle:

* Validation Errors
* Authentication Errors
* Authorization Errors
* Workflow Errors
* Business Rule Violations
* Database Errors
* Transaction Failures
* Network Errors
* File Upload Errors
* Unexpected Exceptions

Errors must:

* Be logged
* Be traceable
* Return meaningful messages
* Never expose internal details

---

# Database Rules

Always consider:

* Foreign Keys
* Constraints
* Indexes
* Query Performance
* Data Integrity
* Future Growth

Avoid unnecessary complexity.

Database design must be understandable without external documentation.

---

# Transaction Rules

The following operations must use database transactions:

* Approval Processing
* Purchase Order Generation
* Invoice Generation
* Workflow State Changes

Business operations must either:

* Fully succeed
  or
* Fully rollback

Partial success is not allowed.

---

# Performance Rules

Always consider:

* Query Performance
* API Performance
* Memory Usage
* CPU Usage
* Network Usage

Avoid:

* N+1 Queries
* Duplicate Requests
* Unnecessary Database Calls
* Expensive Loops
* Large Payloads

Design for scalability.

---

# Security Rules

Always enforce:

* JWT Authentication
* Role Based Access Control
* Ownership Checks
* Input Validation

Never trust frontend permissions.

Backend is the source of truth.

Never expose:

* Passwords
* Tokens
* Secrets
* Stack Traces
* Internal Errors

---

# Frontend Rules

If design references are provided:

Implement them as accurately as possible.

Respect:

* Layout
* Typography
* Spacing
* Component Structure
* UX Flow

Do not redesign without reason.

---

# UI Standards

Primary UI System:

* shadcn/ui

Preferred Components:

* DataTable
* Dialog
* Sheet
* Card
* Tabs
* Dropdown Menu
* Form
* Badge

Maintain consistency across the application.

---

# Forms

All forms must use:

* React Hook Form
* Zod

Never create unmanaged forms.

---

# Responsiveness

Every screen must support:

* Mobile
* Tablet
* Laptop
* Desktop

Responsiveness is mandatory.

---

# Documentation Rules

Documentation is mandatory.

Code changes are incomplete if documentation is not updated.

Whenever changing:

* Features
* APIs
* Database Schema
* Architecture
* Business Rules
* Workflows
* Permissions
* Environment Variables

Relevant documentation must be updated.

---

# Testing Mindset

Before completing any implementation verify:

* Happy Path
* Edge Cases
* Invalid Inputs
* Failure Scenarios
* Security Scenarios
* Permission Scenarios
* Workflow Scenarios

Implementation is not complete until failure scenarios are reviewed.

---

# Final Rule

Before marking any task complete verify:

1. Requirements satisfied.
2. Workflow integrity preserved.
3. Validation implemented.
4. Error handling implemented.
5. Permissions verified.
6. Audit logs verified.
7. Documentation updated.
8. Future developers can understand the implementation.
9. Future AI agents can continue development without confusion.

Only then consider the task complete.
