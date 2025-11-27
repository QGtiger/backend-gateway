import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null
      ) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message || message;
      } else {
        message = exception.message || message;
      }
    } else if (exception instanceof Error) {
      message = exception.message || message;
      this.logger.error(`未处理的异常: ${exception.message}`, exception.stack);
    }

    const errorResponse = {
      success: false,
      code: status,
      message: message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    this.logger.error(
      `HTTP ${status} Error: ${message} - Path: ${request.url}`,
    );

    // HTTP 状态码统一为 200，实际状态码通过响应体中的 code 字段表示
    response.status(HttpStatus.OK).json(errorResponse);
  }
}
