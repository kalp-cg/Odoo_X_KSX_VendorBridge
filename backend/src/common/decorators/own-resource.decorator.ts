import { SetMetadata } from '@nestjs/common';

/** Marks an endpoint as owning a specific resource (used by OwnershipGuard). */
export const OWN_RESOURCE_KEY = 'vb:ownResource';
export interface OwnResourceMeta {
  /** Param name that holds the resource id (e.g. 'id'). */
  idParam?: string;
  /** Prisma delegate name (e.g. 'rfq', 'quotation'). Service must implement `findOwner(id)`. */
  delegate: string;
}
export const OwnResource = (meta: OwnResourceMeta) => SetMetadata(OWN_RESOURCE_KEY, meta);
