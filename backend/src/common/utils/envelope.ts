/**
 * Standard JSON response envelope for collection endpoints.
 * For single resources the controller may return the object directly.
 */
export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}
