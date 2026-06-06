import { ZodSchema } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/** Helper to construct a ZodValidationPipe inline at the @Body() decorator. */
export const zodPipe = <T>(schema: ZodSchema<T>): ZodValidationPipe<T> => new ZodValidationPipe(schema);
