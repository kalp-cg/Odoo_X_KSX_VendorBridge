import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE_TRANSITION'
  | 'BUSINESS_RULE_VIOLATION'
  | 'OWNERSHIP_DENIED'
  | 'RATE_LIMITED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class ApiException extends HttpException {
  constructor(status: HttpStatus, body: ErrorBody) {
    super(body, status);
  }
}

export const badRequest = (message: string, details?: Record<string, unknown>): ApiException =>
  new ApiException(HttpStatus.BAD_REQUEST, { code: 'BAD_REQUEST', message, details });
export const validationError = (message: string, details?: Record<string, unknown>): ApiException =>
  new ApiException(HttpStatus.BAD_REQUEST, { code: 'VALIDATION_ERROR', message, details });
export const unauthenticated = (message = 'Authentication required'): ApiException =>
  new ApiException(HttpStatus.UNAUTHORIZED, { code: 'UNAUTHENTICATED', message });
export const forbidden = (message = 'You do not have permission to perform this action'): ApiException =>
  new ApiException(HttpStatus.FORBIDDEN, { code: 'FORBIDDEN', message });
export const notFound = (message = 'Resource not found'): ApiException =>
  new ApiException(HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message });
export const conflict = (message: string, details?: Record<string, unknown>): ApiException =>
  new ApiException(HttpStatus.CONFLICT, { code: 'CONFLICT', message, details });
export const invalidTransition = (message: string, details?: Record<string, unknown>): ApiException =>
  new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, { code: 'INVALID_STATE_TRANSITION', message, details });
export const businessRule = (message: string, details?: Record<string, unknown>): ApiException =>
  new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, { code: 'BUSINESS_RULE_VIOLATION', message, details });
export const ownershipDenied = (message = 'You do not own this resource'): ApiException =>
  new ApiException(HttpStatus.FORBIDDEN, { code: 'OWNERSHIP_DENIED', message });
export const rateLimited = (message = 'Too many requests'): ApiException =>
  new ApiException(HttpStatus.TOO_MANY_REQUESTS, { code: 'RATE_LIMITED', message });
export const fileTooLarge = (message = 'File exceeds maximum allowed size'): ApiException =>
  new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, { code: 'FILE_TOO_LARGE', message });
export const unsupportedMedia = (message: string): ApiException =>
  new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, { code: 'UNSUPPORTED_MEDIA_TYPE', message });
