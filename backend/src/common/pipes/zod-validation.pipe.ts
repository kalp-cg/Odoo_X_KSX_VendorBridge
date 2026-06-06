import { BadRequestException, type ArgumentMetadata, type PipeTransform, Injectable } from '@nestjs/common';
import { ZodError, type ZodSchema } from 'zod';

@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed validation',
        details: this.formatIssues(result.error),
      });
    }
    return result.data;
  }

  private formatIssues(err: ZodError): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.') || '_root';
      if (!out[path]) out[path] = [];
      out[path].push(issue.message);
    }
    return out;
  }
}
