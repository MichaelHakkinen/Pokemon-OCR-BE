import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
import { ErrorLogService } from 'src/common/services/error-log.service';
import { mapPrismaError } from './prisma-error.mapper';

// Single place errors become responses. Handlers, guards and pipes just
// throw; this writes the standard error envelope
//   { code, status: 'errors', message, data: null }
// and records 5xx / unexpected errors in the error log.
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly errorLog: ErrorLogService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { moduleName?: string }>();

    // A handler that streamed part of a file before failing can't be given a
    // JSON body any more; just make sure the connection is closed.
    if (res.headersSent) {
      res.end();
      return;
    }

    // Client-caused database errors (duplicate, not found, too long, ...)
    // become 4xx instead of a 500.
    const error = mapPrismaError(exception) ?? exception;

    const isHttp = error instanceof HttpException;
    const status = isHttp
      ? error.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    if (status >= 500) {
      this.logger.error(error);
      void this.errorLog.logFromRequest(req, error, {
        moduleName: req.moduleName,
        targetId: req.params?.id as string | undefined,
      });
    }

    res.status(status).json({
      code: status,
      status: 'errors',
      // Unexpected errors get a generic message so internals never leak.
      message: isHttp
        ? error.getResponse()
        : ErrorMessageHelper.getMultiLanguageMessage('INTERNAL_SERVER_ERROR'),
      data: null,
    });
  }
}
