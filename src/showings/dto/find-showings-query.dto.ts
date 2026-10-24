import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';
import { OBJECT_ID_FORMAT } from '../../common/pipes/parse-object-id.pipe.js';

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export class FindShowingsQueryDto {
  @ApiPropertyOptional({
    example: OBJECT_ID_EXAMPLE,
    description: `Залишає сеанси лише цього фільму; ${OBJECT_ID_FORMAT}`,
  })
  @IsOptional()
  @IsMongoId({ message: `filmId must be an ${OBJECT_ID_FORMAT}` })
  filmId?: string;

  @ApiPropertyOptional({
    example: '2026-11-20',
    description:
      'Залишає сеанси, що починаються цієї доби (UTC), формат YYYY-MM-DD',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true },
    { message: 'date must be a valid calendar date' },
  )
  date?: string;

  @ApiPropertyOptional({
    description: 'Номер сторінки',
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Розмір сторінки',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100) // стеля, інакше limit=100000 = вся таблиця
  limit: number = 20;

  @ApiPropertyOptional({
    enum: SORT_ORDERS,
    default: 'asc',
    description: 'Порядок за часом початку; при рівному часі — за _id',
  })
  @IsOptional()
  @IsIn(SORT_ORDERS)
  sort: SortOrder = 'asc';
}
