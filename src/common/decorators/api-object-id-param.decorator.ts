import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiParam } from '@nestjs/swagger';
import {
  OBJECT_ID_FORMAT,
  OBJECT_ID_PATTERN,
} from '../pipes/parse-object-id.pipe.js';

export const OBJECT_ID_EXAMPLE = '665f1c2b8e4a3d1f9c0b7a21';

/**
 * Swagger: параметр маршруту `:id` у форматі ObjectId і відповідь 400 на інший формат.
 * Маршрути з іншими причинами 400 передають повний опис другим аргументом.
 */
export function ApiObjectIdParam(
  description: string,
  badRequestDescription = 'id не є ObjectId',
) {
  return applyDecorators(
    ApiParam({
      name: 'id',
      description: `${description}; ${OBJECT_ID_FORMAT}`,
      example: OBJECT_ID_EXAMPLE,
      schema: { type: 'string', pattern: OBJECT_ID_PATTERN.source },
    }),
    ApiBadRequestResponse({ description: badRequestDescription }),
  );
}
