# M10 — Audit Logs

> Implementation of the audit log subsystem. See [11-AUDIT-LOGS.md](../11-AUDIT-LOGS.md) for the system spec, immutability guarantees, and event catalog.

## M10.1 Purpose

- Provide a single, append-only, immutable record of every critical business action.
- Enforce immutability at three layers: application (no UPDATE/DELETE code), DB (triggers), and DB role (revoked privileges).
- Expose a query API for the audit log UI and CSV export.
- Be called by every business service at the right moment (in transaction).

## M10.2 Scope

**In scope**:
- `AuditService.log(tx, event)` — the only public method for writing.
- `AuditService.query(filters)` — the only public method for reading.
- DB triggers preventing UPDATE / DELETE.
- Migration that creates the triggers and verifies them.
- Query endpoint with filters.
- CSV export.

**Out of scope**:
- Real-time streaming of audit events.
- Audit log archival to cold storage (planned v2).
- Cross-system audit correlation (planned v2).

## M10.3 Entities

- `AuditLog` (see [07-DATA-MODEL.md](../07-DATA-MODEL.md) §7.2).

## M10.4 Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| GET | `/api/v1/audit-logs` | ADMIN, OFFICER, MANAGER (with role-specific filters) | Paginated, filterable. Vendors have no access. |
| GET | `/api/v1/audit-logs/export` | ADMIN | CSV download |

### Filters

- `?entityType=RFQ&entityId=...`
- `?actorId=...`
- `?action=RFQ_PUBLISHED`
- `?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z`
- `?page=1&pageSize=50` (max 200)
- `?sortBy=createdAt&sortOrder=desc` (default: newest first)

### Role-specific visibility

- **ADMIN**: sees everything.
- **OFFICER**: sees their own actions + actions on RFQs/quotations/POs/invoices they created.
- **MANAGER**: sees approval-related actions (APPROVAL_*) + their own actions.
- **VENDOR**: no access (no UI, no API).

These filters are applied at the service layer; the controller only validates the DTO.

## M10.5 Service layer

```
audit-logs/
├── audit-logs.module.ts
├── controllers/
│   └── audit-logs.controller.ts
├── services/
│   ├── audit.service.ts              # public API: log, query
│   ├── audit-query.service.ts        # builds filter expressions
│   ├── audit-export.service.ts       # CSV generation
│   └── audit-context.ts              # request context (ip, userAgent, requestId)
├── repositories/
│   └── audit-logs.repository.ts
├── dto/
│   ├── list-audit-logs.dto.ts
│   └── audit-log-response.dto.ts
├── constants.ts                       # all action names
└── tests/
```

## M10.6 Public API

```ts
// audit.service.ts
export class AuditService {
  /**
   * In-transaction write. The `tx` argument is the Prisma transaction client
   * from the business operation. The audit row is committed atomically.
   * If this throws, the business transaction rolls back.
   */
  async log(tx: TxClient, event: AuditEvent): Promise<AuditLog> { ... }

  /** Read with filters. */
  async query(user: User, filters: AuditFilters): Promise<Paginated<AuditLog>> { ... }

  /** CSV export. */
  async exportCsv(user: User, filters: AuditFilters): Promise<Stream> { ... }
}

export type AuditEvent = {
  action: string;                // e.g., 'RFQ_PUBLISHED'
  entityType: string;            // e.g., 'RFQ'
  entityId: string;
  actorId?: string | null;       // null for system events
  metadata?: Record<string, unknown>;
};
```

### AuditContext

The service uses a request-scoped `AuditContext` to capture IP, user agent, and request ID:

```ts
// audit-context.ts
export class AuditContext {
  static fromRequest(req: Request): AuditContext {
    return new AuditContext(
      req.ip,
      req.headers['user-agent'],
      req.headers['x-request-id'],
    );
  }
}
```

The `log` method reads this from `REQUEST` scope (NestJS) and attaches to the row.

## M10.7 Action catalog

The full action catalog is in [11-AUDIT-LOGS.md](../11-AUDIT-LOGS.md) §11.3. The constant table is in `audit-logs/constants.ts`:

```ts
export const AUDIT_ACTIONS = {
  // Vendor
  VENDOR_CREATED: 'VENDOR_CREATED',
  VENDOR_UPDATED: 'VENDOR_UPDATED',
  VENDOR_ACTIVATED: 'VENDOR_ACTIVATED',
  VENDOR_BLOCKED: 'VENDOR_BLOCKED',
  VENDOR_INACTIVATED: 'VENDOR_INACTIVATED',
  // ... etc
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];
```

Each business service imports the relevant action and passes it to `audit.log()`. The TypeScript type ensures typos are caught at compile time.

## M10.8 Immutability enforcement

### 1. Application layer

- The `AuditService` class has **no** `update`, `delete`, or `softDelete` methods. Lint rule forbids adding them.
- Code review checklist flags any new `auditLogs.update` or `auditLogs.delete` in any other file.
- A grep-based CI check: `! grep -rE 'auditLogs\.(update|delete|upsert)' apps/api/src/` (excluding the seed script in dev).

### 2. Database triggers

Migration `audit_immutability`:

```sql
CREATE OR REPLACE FUNCTION audit_logs_no_modify()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable (operation: %)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();

CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();
```

### 3. DB role privileges

The application connects as a non-superuser role (`vb_app`). This role has:

```sql
GRANT SELECT, INSERT ON audit_logs TO vb_app;
-- No UPDATE, no DELETE.
```

A separate role `vb_audit_writer` has full privileges but is not used by the app. It exists only for forensic recovery (which is itself out of scope in v1).

The migration script verifies the grants.

### 4. CI verification

```ts
// apps/api/scripts/verify-audit-immutability.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check triggers
  const triggers = await prisma.$queryRaw`
    SELECT trigger_name FROM information_schema.triggers
    WHERE event_object_table = 'audit_logs'
  `;
  if (triggers.length < 2) throw new Error('Audit immutability triggers missing');

  // Try an UPDATE (should fail)
  try {
    await prisma.$executeRaw`UPDATE audit_logs SET metadata = '{}'::jsonb WHERE id = (SELECT id FROM audit_logs LIMIT 1)`;
    throw new Error('Audit log UPDATE did not fail — immutability is broken');
  } catch (e) {
    if (!String(e).includes('immutable')) throw e;
  }

  // Try a DELETE (should fail)
  try {
    await prisma.$executeRaw`DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1)`;
    throw new Error('Audit log DELETE did not fail — immutability is broken');
  } catch (e) {
    if (!String(e).includes('immutable')) throw e;
  }

  console.log('Audit immutability verified');
}
```

This script runs in CI and as a pre-deploy check.

## M10.9 Calling audit from business services

Pattern:

```ts
// rfq.service.ts (in publish method)
await this.prisma.$transaction(async (tx) => {
  // ... validate, transition, etc.
  const updated = await tx.rfq.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: now } });

  await this.audit.log(tx, {
    action: 'RFQ_PUBLISHED',
    entityType: 'RFQ',
    entityId: updated.id,
    actorId: user.id,
    metadata: { vendorIds, deadline: updated.deadline },
  });

  return updated;
});
```

The `audit.log` method takes the transaction client so the write is atomic with the business change.

## M10.10 Querying

The query service builds a Prisma `where` from the filters:

```ts
async query(user: User, filters: AuditFilters) {
  const where: Prisma.AuditLogWhereInput = {};
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.entityId) where.entityId = filters.entityId;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.action) where.action = filters.action;
  if (filters.from || filters.to) {
    where.createdAt = {};
    if (filters.from) where.createdAt.gte = filters.from;
    if (filters.to) where.createdAt.lte = filters.to;
  }

  // Role scoping
  if (user.role === 'OFFICER') {
    where.OR = [
      { actorId: user.id },
      { entityType: 'RFQ', entity: { createdById: user.id } },
    ];
  } else if (user.role === 'MANAGER') {
    where.OR = [
      { actorId: user.id },
      { action: { startsWith: 'APPROVAL_' } },
    ];
  } else if (user.role === 'VENDOR') {
    throw new ForbiddenException();
  }

  return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip });
}
```

## M10.11 CSV export

`GET /api/v1/audit-logs/export` returns `text/csv` with columns:

```
id, createdAt, actorId, actorEmail, action, entityType, entityId, metadata, ipAddress, userAgent
```

Streamed for large exports.

## M10.12 Audit events list

The list is in [11-AUDIT-LOGS.md](../11-AUDIT-LOGS.md) §11.3. New actions must be:

- Added to `AUDIT_ACTIONS` constant.
- Documented in the catalog.
- Referenced by a business rule code (BR-xxx) where applicable.
- Tested (one test per action that verifies a row is written with correct fields).

## M10.13 Edge cases

| Scenario | Behavior |
|----------|----------|
| Business service calls `audit.log` outside a transaction | The log entry is written immediately. The business op is not transactional with the log. The `audit.log` method is designed to be called with a tx client. |
| `audit.log` throws (e.g., DB error) | The business transaction rolls back. |
| Audit row insert succeeds but a downstream call in the same tx fails | The whole tx rolls back, including the audit row. |
| Two business services emit the same audit event for the same action | Allowed (multiple rows for the same logical action are fine). |
| `metadata` contains a huge blob | No hard limit in v1. CI lint warns if metadata > 10KB. |
| `actorId` is null (system event) | Allowed. E.g., the daily overdue job. |
| Audit log table grows huge | In v1, single table. In v2, monthly partitions. For hackathon, OK to ~10M rows. |
| Admin tries to PATCH/DELETE via direct SQL | Blocked by DB role and trigger. |
| Vendor tries to access the endpoint | 403 `PERMISSION_DENIED` |
| Filter by `actorEmail` (not id) | Not supported in v1. Admin can find users via the users endpoint. |

## M10.14 Future (not in v1)

- Streaming audit events to an external SIEM.
- Cold-storage archival (S3 / Glacier).
- Audit log integrity proofs (hash chain).
- Cross-tenant audit correlation.
- Audit log retention policies (v1 keeps everything forever).
