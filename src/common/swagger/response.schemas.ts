import { applyDecorators, HttpStatus, Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';

/**
 * Mirrors the pagination block returned for a Paginated result
 * in src/utils/response.utils.ts.
 */
export class PaginationMetaDto {
  @ApiProperty({ example: 42, description: 'Total number of matching rows' })
  totalCount: number;

  @ApiProperty({ example: 1, description: 'Current page number' })
  currentPage: number;

  @ApiProperty({
    example: 1,
    description: 'Index of the first row on this page',
  })
  lowestNumber: number;

  @ApiProperty({
    example: 10,
    description: 'Index of the last row on this page',
  })
  highestNumber: number;
}

/** Shared envelope options for a single success response. */
interface SuccessResponseOptions {
  description?: string;
  status?: HttpStatus;
  /** Wrap `data` in an array (e.g. list endpoints that don't paginate). */
  isArray?: boolean;
}

/**
 * Documents the ResponseInterceptor success envelope:
 * { code, status: 'success', message, data }
 */
export function ApiSuccessResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: SuccessResponseOptions = {},
) {
  const {
    description = 'Request completed successfully',
    status = HttpStatus.OK,
    isArray = false,
  } = options;

  return applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        properties: {
          code: { type: 'number', example: status },
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Data retrieved successfully' },
          data: isArray
            ? { type: 'array', items: { $ref: getSchemaPath(model) } }
            : { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
}

/**
 * Documents the ResponseInterceptor success envelope with `data: null` for
 * endpoints that don't return a resource body (delete, restore w/o payload).
 */
export function ApiSuccessNoDataResponse(
  options: {
    description?: string;
    status?: HttpStatus;
  } = {},
) {
  const {
    description = 'Request completed successfully',
    status = HttpStatus.OK,
  } = options;

  return ApiResponse({
    status,
    description,
    schema: {
      properties: {
        code: { type: 'number', example: status },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Data deleted successfully' },
        data: { nullable: true, example: null },
      },
    },
  });
}

/**
 * Documents the paginated ResponseInterceptor envelope (`new Paginated(...)`)
 * envelope: { code, status: 'success', message, pagination, data: [...] }
 */
export function ApiSuccessPaginationResponse<TModel extends Type<unknown>>(
  model: TModel,
  options: { description?: string } = {},
) {
  const { description = 'Paginated list retrieved successfully' } = options;

  return applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiResponse({
      status: HttpStatus.OK,
      description,
      schema: {
        properties: {
          code: { type: 'number', example: HttpStatus.OK },
          status: { type: 'string', example: 'success' },
          message: { type: 'string', example: 'Data retrieved successfully' },
          pagination: { $ref: getSchemaPath(PaginationMetaDto) },
          data: { type: 'array', items: { $ref: getSchemaPath(model) } },
        },
      },
    }),
  );
}

/**
 * Documents the GlobalExceptionFilter error envelope for a given HTTP
 * status: { code, status: 'errors', message, data: null }
 */
export function ApiErrorResponse(
  status: HttpStatus,
  description: string,
  example: unknown,
) {
  return ApiResponse({
    status,
    description,
    schema: {
      properties: {
        code: { type: 'number', example: status },
        status: { type: 'string', example: 'errors' },
        message: {
          oneOf: [{ type: 'string' }, { type: 'object' }],
          example,
        },
        data: { nullable: true, example: null },
      },
    },
  });
}

/**
 * Common error responses shared by every route behind AdminAuthGuard:
 * 400 (domain/business errors, e.g. access denied or not found),
 * 401 (missing/expired token), 500 (unexpected server error).
 * Call with `includeValidation: true` on endpoints that accept a body
 * validated by TranslatedValidationPipe to also document 422.
 */
export function ApiCommonErrorResponses(
  options: { includeValidation?: boolean } = {},
) {
  const decorators = [
    ApiErrorResponse(
      HttpStatus.BAD_REQUEST,
      'Business rule violation (e.g. access denied, record not found)',
      {
        en: 'Sorry, you are unauthorized for View List in Banner Management module',
        id: 'Maaf, Anda tidak memiliki izin untuk View List di modul Banner Management',
      },
    ),
    ApiErrorResponse(
      HttpStatus.UNAUTHORIZED,
      'Missing, invalid, or expired access token',
      {
        en: 'Your session has expired. Please login again',
        id: 'Sesi Anda telah berakhir. Silakan masuk kembali',
      },
    ),
    ApiErrorResponse(
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Unexpected server error',
      {
        en: 'Internal server error occurred',
        id: 'Terjadi kesalahan pada server',
      },
    ),
  ];

  if (options.includeValidation) {
    decorators.push(
      ApiErrorResponse(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'Request body failed validation',
        {
          statusCode: 422,
          message: 'Validation failed',
          errors: {
            fullname: {
              en: 'Fullname is required',
              id: 'Nama lengkap wajib diisi',
            },
          },
        },
      ),
    );
  }

  return applyDecorators(...decorators);
}
