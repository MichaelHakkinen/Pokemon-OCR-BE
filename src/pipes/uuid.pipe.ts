import {
  ArgumentMetadata,
  Injectable,
  Optional,
  PipeTransform,
  UnprocessableEntityException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import { VALIDATION_MESSAGES } from '../common/constants/validation-messages';
import { FIELD_NAMES } from '../common/constants/field-names';

export interface UuidPipeOptions {
  // Let a missing/empty value through as-is (for optional query params).
  optional?: boolean;
  // Literal values accepted in addition to UUIDs, e.g. 'null' for "root".
  allow?: string[];
}

// Rejects malformed ids before they reach Prisma, which would otherwise fail
// with a 500. Errors use the same 422 shape as TranslatedValidationPipe, so
// clients handle a bad :id like any other invalid field.
@Injectable()
export class UuidPipe implements PipeTransform<string, string> {
  // @Optional so Nest can create it from the bare class (@Param('id', UuidPipe))
  constructor(@Optional() private readonly options: UuidPipeOptions = {}) {}

  transform(value: string, metadata: ArgumentMetadata): string {
    if (
      this.options.optional &&
      (value === undefined || value === null || value === '')
    ) {
      return value;
    }
    if (this.options.allow?.includes(value)) return value;
    if (typeof value === 'string' && isUUID(value)) return value;

    const field = metadata.data ?? 'id';
    const name = FIELD_NAMES[field];
    const message = VALIDATION_MESSAGES.IS_UUID;
    throw new UnprocessableEntityException({
      statusCode: 422,
      message: 'Validation failed',
      errors: {
        [field]: {
          en: message.en.replace('$property', name?.en ?? field),
          id: message.id.replace('$property', name?.id ?? field),
        },
      },
    });
  }
}
