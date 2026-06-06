# 11 — Audit Logs

Audit logs are **compliance records**. They are immutable, append-only, and cannot be modified by anyone — including administrators.

## 11.1 Immutability guarantees

Three layers of defense:

1. **Application layer**
   - No `UPDATE` or `DELETE` SQL is ever written for the `audit_logs` table.
   - The `AuditService` exposes only `log()` (INSERT) and `query()` (SELECT). No other methods exist.
   - A code review checklist explicitly flags any audit-log mutation attempt.

2. **Database layer**
   - A trigger on `audit_logs` raises an exception on `UPDATE` or `DELETE`:
     ```sql
     CREATE OR REPLACE FUNCTION audit_logs_no_modify()
     RETURNS TRIGGER AS $$
     BEGIN
       RAISE EXCEPTION 'Audit logs are immutable';
     END;
     $$ LANGUAGE plpgsql;

     CREATE TRIGGER audit_logs_no_update
       BEFORE UPDATE ON audit_logs
       FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();

     CREATE TRIGGER audit_logs_no_delete
       BEFORE DELETE ON audit_logs
       FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();
     ```
   - The application database user does **not** own the `audit_logs` table; a separate `audit_writer` role does. The app's DB role has `INSERT` and `SELECT` but not `UPDATE` or `DELETE` on the table.

3. **Migration discipline**
   - Migration files include a verification step that confirms the triggers exist.
   - If a trigger is ever missing, the migration fails.

## 11.2 Schema

See [07-DATA-MODEL.md](../02-architecture/07-DATA-MODEL.md) §7.2 AuditLog. Key fields:

- `id` (uuid)
- `actorId` (FK → User; nullable for system events)
- `action` (text; e.g., `RFQ_PUBLISHED`)
- `entityType` (text; e.g., `RFQ`)
- `entityId` (uuid)
- `metadata` (jsonb; event-specific payload)
- `ipAddress` (inet)
- `userAgent` (text)
- `createdAt` (timestamptz, default now())

**There is no `updatedAt` and no `deletedAt`.** There never will be.

## 11.3 Event catalog

The full list of audited actions. Every critical action must produce **exactly one** audit log entry. See [modules/M10-AUDIT-LOGS.md](../modules/M10-AUDIT-LOGS.md) for the implementation.

### Vendor events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `VENDOR_CREATED` | Admin creates a vendor | `{ vendorCompanyId, legalName, category }` |
| `VENDOR_UPDATED` | Admin edits vendor | `{ vendorCompanyId, changedFields: [...] }` |
| `VENDOR_ACTIVATED` | Admin activates a PENDING vendor | `{ vendorCompanyId }` |
| `VENDOR_BLOCKED` | Admin blocks a vendor | `{ vendorCompanyId, reason? }` |
| `VENDOR_INACTIVATED` | Admin deactivates a vendor | `{ vendorCompanyId }` |

### User events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `USER_CREATED` | Signup | `{ userId, email, requestedRole }` |
| `USER_ACTIVATED` | Admin activates user | `{ userId, role }` |
| `USER_SUSPENDED` | Admin suspends user | `{ userId }` |
| `USER_DEACTIVATED` | Admin deactivates user | `{ userId }` |
| `USER_ROLE_CHANGED` | Admin changes role | `{ userId, from, to }` |
| `LOGIN_SUCCESS` | Successful login | `{ userId }` |
| `LOGIN_FAILED` | Failed login | `{ email, reason }` |

### RFQ events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `RFQ_CREATED` | Officer creates RFQ | `{ rfqId, rfqNumber }` |
| `RFQ_UPDATED` | Officer edits DRAFT RFQ | `{ rfqId, changedFields }` |
| `RFQ_PUBLISHED` | Officer publishes RFQ | `{ rfqId, vendorIds, deadline }` |
| `RFQ_CLOSED` | Officer closes RFQ | `{ rfqId, autoRejectedQuotationIds }` |
| `RFQ_CANCELLED` | Officer cancels RFQ | `{ rfqId, reason? }` |

### Quotation events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `QUOTATION_CREATED` | Vendor saves initial quotation | `{ quotationId, rfqId, vendorCompanyId }` |
| `QUOTATION_UPDATED` | Vendor edits quotation | `{ quotationId, changedFields }` |
| `QUOTATION_SUBMITTED` | Vendor submits (locks editing) | `{ quotationId }` |
| `QUOTATION_SHORTLISTED` | Officer shortlists | `{ quotationId, officerId }` |
| `QUOTATION_REJECTED` | Officer or system rejects | `{ quotationId, reason }` |

### Approval events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `APPROVAL_REQUESTED` | Shortlist creates approval | `{ approvalId, rfqId, officerId }` |
| `APPROVAL_APPROVED` | Manager approves | `{ approvalId, managerId }` |
| `APPROVAL_REJECTED` | Manager rejects | `{ approvalId, managerId, remarks }` |

### Purchase Order events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `PO_GENERATED` | Auto on approval | `{ poId, poNumber, rfqId, vendorCompanyId, totalAmount }` |
| `PO_SENT` | Officer marks sent | `{ poId }` |
| `PO_DELIVERED` | Officer or vendor marks delivered | `{ poId, markedBy }` |

### Invoice events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `INVOICE_GENERATED` | Auto on PO | `{ invoiceId, invoiceNumber, poId, totalAmount }` |
| `INVOICE_EMAILED` | Officer sends email | `{ invoiceId, recipient }` |
| `INVOICE_PRINTED` | Officer prints | `{ invoiceId }` |
| `INVOICE_PAID` | Officer marks paid | `{ invoiceId, paidAt }` |
| `INVOICE_OVERDUE` | System marks overdue | `{ invoiceId }` |

### Authentication events

| Action | Trigger | Metadata |
|--------|---------|----------|
| `PASSWORD_RESET_REQUESTED` | Forgot password | `{ email }` |
| `PASSWORD_RESET_COMPLETED` | Reset token used | `{ userId }` |
| `TOKEN_REFRESHED` | Refresh token used | `{ userId }` |

## 11.4 How to log

In a service:

```ts
await this.prisma.$transaction(async (tx) => {
  // ... do the business work
  await this.audit.log(tx, {
    action: 'RFQ_PUBLISHED',
    entityType: 'RFQ',
    entityId: rfq.id,
    actorId: user.id,
    metadata: { vendorIds, deadline },
    request: { ip: req.ip, userAgent: req.headers['user-agent'] },
  });
});
```

The `audit.log` method takes the transaction client so the audit row is part of the same transaction. If the audit write fails, the business operation rolls back. **This is by design** — a critical action without an audit record is incomplete.

## 11.5 Querying audit logs

- Endpoint: `GET /api/v1/audit-logs`
- Query params: `entityType`, `entityId`, `actorId`, `action`, `from`, `to`, `page`, `pageSize`.
- All non-admin roles see audit logs filtered by relevance (officer sees their own actions, manager sees approval actions, vendor sees only their own entity actions).
- Vendors cannot access the audit log endpoint at all (no UI, no API access).
- Response includes a `meta` block with the query that was used.

## 11.6 Retention

- Permanent. No purging.
- A `monthly_partitions` table is used in production for performance. In v1 (hackathon), a single table is fine up to ~10M rows.
- For the hackathon, no archival strategy is required.

## 11.7 What is NOT in audit logs

- Read events (GETs) are **not** audited. Only state changes and security events.
- System heartbeats and cron jobs are not audited (unless they cause a state change).
- Login successes are not audited (only failures are). Successful logins are visible in access logs (not in `audit_logs`).

## 11.8 Compliance and exports

- Audit logs can be exported as CSV by Admin.
- Compliance exports include the full metadata blob and a checksum for integrity verification (future).
- For the hackathon, a simple CSV download is sufficient.
