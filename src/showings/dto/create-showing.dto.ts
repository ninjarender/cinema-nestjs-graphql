import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsInt, IsMongoId, IsPositive } from 'class-validator';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';
import { OBJECT_ID_FORMAT } from '../../common/pipes/parse-object-id.pipe.js';

export class CreateShowingDto {
  @ApiProperty({ example: OBJECT_ID_EXAMPLE, description: OBJECT_ID_FORMAT })
  @IsMongoId({ message: `filmId must be an ${OBJECT_ID_FORMAT}` })
  filmId: string;

  @ApiProperty({
    example: '665f1c2b8e4a3d1f9c0b7a22',
    description: OBJECT_ID_FORMAT,
  })
  @IsMongoId({ message: `hallId must be an ${OBJECT_ID_FORMAT}` })
  hallId: string;

  @ApiProperty({
    example: '2026-11-20T18:30:00Z',
    description: 'Дата й час початку в ISO 8601, у майбутньому',
  })
  @IsISO8601({ strict: true, strictSeparator: true })
  startsAt: string;

  @ApiProperty({
    example: 12500,
    description: 'Ціна квитка в копійках, ціле додатне',
  })
  @IsInt()
  @IsPositive()
  price: number;
}
