import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { map, Observable } from 'rxjs';
import { MODULE_NAME_KEY } from 'src/common/decorators/permission.decorator';
import {
  RAW_RESPONSE_KEY,
  RESPONSE_MESSAGE_KEY,
} from 'src/common/decorators/response-message.decorator';
import { SUCCESS_MESSAGES } from 'src/common/constants/success-messages';
import { SuccessMessageHelper } from 'src/common/helpers/success-message.helper';
import { Paginated } from 'src/common/http/paginated';

// Wraps whatever a handler returns in the standard success envelope:
//   { code, status: 'success', message, data } (+ pagination for Paginated)
// The HTTP status comes from @HttpCode (200 by default), the message from
// @ResponseMessage. Handlers that take @Res() write their own response, and
// @RawResponse() routes return their value as-is.
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse<Response>();

    // Lets the exception filter tag error logs with the RBAC module.
    request.moduleName = this.reflector.get<string>(
      MODULE_NAME_KEY,
      context.getClass(),
    );

    if (this.reflector.get<boolean>(RAW_RESPONSE_KEY, context.getHandler())) {
      return next.handle();
    }

    const messageKey =
      this.reflector.get<keyof typeof SUCCESS_MESSAGES>(
        RESPONSE_MESSAGE_KEY,
        context.getHandler(),
      ) ?? 'DEFAULT_MESSAGE';

    return next.handle().pipe(
      map((result) => {
        if (response.headersSent) return result;

        const envelope = {
          code: response.statusCode,
          status: 'success',
          message: SuccessMessageHelper.getMultiLanguageMessage(messageKey),
        };

        return result instanceof Paginated
          ? { ...envelope, pagination: result.pagination, data: result.data }
          : { ...envelope, data: result ?? null };
      }),
    );
  }
}
