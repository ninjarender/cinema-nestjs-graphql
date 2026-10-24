import { CustomScalar, Scalar } from '@nestjs/graphql';
import { isISO8601 } from 'class-validator';
import { Kind, type ValueNode } from 'graphql';

const ISO_OPTIONS = { strict: true, strictSeparator: true };

function parseDateTime(value: unknown): Date {
  if (typeof value !== 'string' || !isISO8601(value, ISO_OPTIONS)) {
    throw new TypeError(
      'DateTime must be an ISO 8601 string, e.g. 2026-11-20T18:30:00Z',
    );
  }
  return new Date(value);
}

/**
 * Скаляр DateTime для полів типу Date замість вбудованого в @nestjs/graphql.
 * Вбудований робить new Date(value) з будь-якого значення: "12/25/2030", число мілісекунд
 * чи "May 2 2030 18:30" (за часовим поясом сервера) пройшли б як дата.
 * Тут, як у DTO ДЗ_3, приймається лише рядок ISO 8601.
 */
@Scalar('DateTime', () => Date)
export class DateTimeScalar implements CustomScalar<string, Date> {
  description =
    'Дата й час у форматі ISO 8601, наприклад 2026-11-20T18:30:00Z; у відповідях — UTC';

  parseValue(value: unknown): Date {
    return parseDateTime(value);
  }

  serialize(value: unknown): string {
    if (!(value instanceof Date)) {
      throw new TypeError('DateTime cannot represent a non-Date value');
    }
    return value.toISOString();
  }

  parseLiteral(ast: ValueNode): Date {
    return parseDateTime(ast.kind === Kind.STRING ? ast.value : undefined);
  }
}
