import { Injectable, type ArgumentMetadata, type PipeTransform, BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class ParseUuidPipe implements PipeTransform<string, string> {
  transform(value: string, _metadata: ArgumentMetadata): string {
    if (!isUUID(value, '4') && !isUUID(value, 'all')) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Path parameter must be a valid UUID',
        details: { value },
      });
    }
    return value;
  }
}
