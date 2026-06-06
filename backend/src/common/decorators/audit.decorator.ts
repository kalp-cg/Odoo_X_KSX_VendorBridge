import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'vb:audit';
export interface AuditMeta {
  action: string; // AuditAction enum value
  entityType: string; // AuditEntityType enum value
  /** Optional: dynamic entity id resolved from the request via @Param('id') */
  entityIdParam?: string;
}
export const Audit = (meta: AuditMeta) => SetMetadata(AUDIT_KEY, meta);
