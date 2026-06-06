import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  path: string;
  method: string;
  timestamp: string;
  requestId?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = (req as any).id as string | undefined;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ErrorBody['error'] = { code: 'INTERNAL_ERROR', message: 'Internal server error' };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        body = { code: this.codeForStatus(status), message: resp };
      } else if (typeof resp === 'object' && resp !== null) {
        const obj = resp as Record<string, unknown>;
        if (obj.code && obj.message) {
          body = { code: String(obj.code), message: String(obj.message), details: obj.details as any };
        } else if (obj.message) {
          body = {
            code: this.codeForStatus(status),
            message: Array.isArray(obj.message) ? obj.message.join('; ') : String(obj.message),
          };
        }
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      body = {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed validation',
        details: { issues: exception.issues },
      };
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status, body } = this.handlePrisma(exception));
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      body = { code: 'VALIDATION_ERROR', message: 'Invalid Prisma operation' };
    }

    if (status >= 500) {
      this.logger.error(`${req.method} ${req.url} -> ${status} ${body.message}`, exception instanceof Error ? exception.stack : String(exception));
    } else {
      this.logger.warn(`${req.method} ${req.url} -> ${status} ${body.code}: ${body.message}`);
    }

    res.status(status).json({
      error: body,
      path: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    } satisfies ErrorBody);
  }

  private codeForStatus(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHENTICATED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 413: return 'FILE_TOO_LARGE';
      case 415: return 'UNSUPPORTED_MEDIA_TYPE';
      case 422: return 'BUSINESS_RULE_VIOLATION';
      case 429: return 'RATE_LIMITED';
      default: return 'INTERNAL_ERROR';
    }
  }

  private handlePrisma(e: Prisma.PrismaClientKnownRequestError): { status: number; body: ErrorBody['error'] } {
    switch (e.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          body: { code: 'CONFLICT', message: 'A record with the same unique value already exists', details: { target: e.meta?.target } },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          body: { code: 'NOT_FOUND', message: 'Related record not found' },
        };
      case 'P2003':
        return {
          status: HttpStatus.CONFLICT,
          body: { code: 'CONFLICT', message: 'Foreign key constraint violation' },
        };
      default:
        return { status: HttpStatus.BAD_REQUEST, body: { code: 'BAD_REQUEST', message: e.message } };
    }
  }
}
