import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';

type PrismaKnownError = {
  name: string;
  code: string;
  meta?: {
    target?: string[] | string;
    column_name?: string;
    field_name?: string;
    // Prisma 7 driver adapters (@prisma/adapter-pg) report it here instead
    driverAdapterError?: {
      cause?: { constraint?: { fields?: string[]; index?: string } };
    };
  };
};

const isPrismaKnownError = (e: unknown): e is PrismaKnownError =>
  !!e &&
  typeof e === 'object' &&
  (e as PrismaKnownError).name === 'PrismaClientKnownRequestError' &&
  typeof (e as PrismaKnownError).code === 'string';

const fieldOf = (e: PrismaKnownError): string => {
  const constraint = e.meta?.driverAdapterError?.cause?.constraint;
  const target =
    constraint?.fields ??
    e.meta?.target ??
    e.meta?.column_name ??
    e.meta?.field_name;
  return (Array.isArray(target) ? target.join(', ') : target) || 'value';
};

/**
 * Database errors a client caused (duplicate, missing row, too-long value,
 * broken reference) become the right 4xx with a translated message, instead
 * of a 500. Used by GlobalExceptionFilter for every module; services can
 * still throw their own, more specific errors first.
 */
export function mapPrismaError(exception: unknown): HttpException | null {
  if (!isPrismaKnownError(exception)) return null;
  const msg = ErrorMessageHelper.getMultiLanguageMessageWithReplace;
  switch (exception.code) {
    case 'P2002': // unique constraint (e.g. two requests racing on the same name)
      return new ConflictException(
        msg('DUPLICATE_ENTRY', { field: fieldOf(exception) }),
      );
    case 'P2025': // record to update/delete not found
      return new NotFoundException(
        ErrorMessageHelper.getMultiLanguageMessage('RECORD_NOT_FOUND'),
      );
    case 'P2000': // value too long for the column
      return new UnprocessableEntityException(
        msg('VALUE_TOO_LONG', { field: fieldOf(exception) }),
      );
    case 'P2003': // foreign key: related record missing or still referenced
      return new ConflictException(
        ErrorMessageHelper.getMultiLanguageMessage('INVALID_REFERENCE'),
      );
    case 'P2023': // malformed value, e.g. an invalid UUID
      return new BadRequestException(
        ErrorMessageHelper.getMultiLanguageMessage('INVALID_VALUE'),
      );
    default:
      return null;
  }
}
