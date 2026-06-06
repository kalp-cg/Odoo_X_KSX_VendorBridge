import { SetMetadata } from '@nestjs/common';

/** Marks a route to skip the global request-id (e.g. health checks). */
export const SKIP_REQID_KEY = 'vb:skip-reqid';
export const SkipRequestId = () => SetMetadata(SKIP_REQID_KEY, true);
