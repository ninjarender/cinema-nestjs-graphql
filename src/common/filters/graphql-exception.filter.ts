import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import {
  GqlArgumentsHost,
  type GqlContextType,
  GqlExceptionFilter,
} from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { internalServerError } from '../graphql-errors.js';

/** Код у errors[].extensions.code, за яким клієнт розрізняє помилки. */
const CODE_BY_STATUS: Partial<Record<HttpStatus, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_USER_INPUT',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
};
/** Решта помилок клієнта (4xx без власного коду) — не збій сервера. */
const CLIENT_ERROR_CODE = 'BAD_REQUEST';

/**
 * Замість HTTP-фільтра з REST-версії: у GraphQL відповідь формує сервер (200 + масив errors),
 * тож фільтр не пише в response, а повертає GraphQLError з кодом (тема 15, крок 7).
 *
 * Сервіси й pipes кидають ті самі винятки Nest, що й раніше (NotFoundException,
 * ConflictException, BadRequestException від ValidationPipe і ParseObjectIdPipe),
 * а код помилки визначає HTTP-статус винятку (5xx — це вже збій сервера).
 * Решта помилок (зокрема бази даних) у відповідь не потрапляє: лише в лог.
 *
 * Фільтр глобальний, тож його отримують і звичайні HTTP-запити поза GraphQL
 * (GET / → 404, битий JSON у тілі → 400). Їм потрібна HTTP-відповідь, тому вони
 * йдуть у стандартний обробник Nest (BaseExceptionFilter), інакше запит завис би.
 */
@Catch()
export class GraphqlExceptionFilter
  extends BaseExceptionFilter
  implements GqlExceptionFilter
{
  private readonly logger = new Logger(GraphqlExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): GraphQLError | void {
    if (host.getType<GqlContextType>() !== 'graphql') {
      return super.catch(exception, host);
    }

    const field = GqlArgumentsHost.create(host).getInfo<{ fieldName: string }>()
      ?.fieldName;

    if (exception instanceof GraphQLError) {
      return exception;
    }
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      const code =
        CODE_BY_STATUS[exception.getStatus() as HttpStatus] ??
        CLIENT_ERROR_CODE;
      const message = this.messageOf(exception);
      this.logger.warn(`${field} -> ${code}: ${message}`);
      return new GraphQLError(message, { extensions: { code } });
    }

    this.logger.error(
      `${field} -> INTERNAL_SERVER_ERROR`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return internalServerError();
  }

  /** ValidationPipe кладе в message масив рядків, решта винятків — рядок. */
  private messageOf(exception: HttpException): string {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    const message = (response as { message?: string | string[] }).message;
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    return message ?? exception.message;
  }
}
