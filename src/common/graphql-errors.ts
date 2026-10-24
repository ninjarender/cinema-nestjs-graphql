import { Logger } from '@nestjs/common';
import { unwrapResolverError } from '@apollo/server/errors';
import { GraphQLError, type GraphQLFormattedError } from 'graphql';

const INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR';

const logger = new Logger('GraphQLError');

/** Загальна помилка без деталей: що саме зламалось, видно лише в логах сервера. */
export function internalServerError(): GraphQLError {
  return new GraphQLError('Internal server error', {
    extensions: { code: INTERNAL_SERVER_ERROR },
  });
}

/**
 * formatError сервера Apollo — остання межа перед відповіддю.
 *
 * Помилки кореневих резолверів уже перетворив GraphqlExceptionFilter. Але фільтри не діють
 * на резолвери полів (@ResolveField) і на помилки виконання самого GraphQL
 * (наприклад, null у полі з !): вони приходять сюди з текстом оригінальної помилки.
 * Такий текст може містити деталі бази, тож його замінюємо на загальний, а оригінал — у лог.
 */
export function formatGraphqlError(
  formatted: GraphQLFormattedError,
  error: unknown,
): GraphQLFormattedError {
  if (formatted.extensions?.code !== INTERNAL_SERVER_ERROR) {
    return formatted; // розбір, валідація запиту, BAD_USER_INPUT, NOT_FOUND, CONFLICT
  }

  const original = unwrapResolverError(error);
  if (!(original instanceof GraphQLError)) {
    logger.error(
      `${formatted.path?.join('.') ?? 'operation'} -> ${INTERNAL_SERVER_ERROR}`,
      original instanceof Error ? original.stack : String(original),
    );
  }
  return {
    message: internalServerError().message,
    locations: formatted.locations,
    path: formatted.path,
    extensions: { code: INTERNAL_SERVER_ERROR },
  };
}
