import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import type { Response } from 'express';

interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

/**
 * Wraps successful POST/GET responses in { data, meta } envelope.
 * Controllers may bypass by returning a value that already has `data`.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiEnvelope<T> | T> {
  intercept(_ctx: ExecutionContext, next: CallHandler<T>): Observable<ApiEnvelope<T> | T> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && 'data' in (value as object) && 'pagination' in (value as object)) {
          // already a paged payload — keep as-is
          return value as unknown as T;
        }
        return { data: value } as ApiEnvelope<T>;
      }),
    );
  }
}
