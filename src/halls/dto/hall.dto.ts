import { ApiProperty } from '@nestjs/swagger';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';
import type { HallDocument } from '../schemas/hall.schema.js';

/** Зал у відповідях API: рядковий id замість _id, без службових полів Mongoose. */
export class HallDto {
  @ApiProperty({ example: OBJECT_ID_EXAMPLE, description: 'ObjectId' })
  id: string;

  @ApiProperty({ example: 'Зал 1', description: 'Унікальна серед усіх залів' })
  name: string;

  @ApiProperty({ example: 3 })
  rows: number;

  @ApiProperty({ example: 5 })
  seatsPerRow: number;

  static fromDocument(hall: HallDocument): HallDto {
    const dto = new HallDto();
    dto.id = hall._id.toString();
    dto.name = hall.name;
    dto.rows = hall.rows;
    dto.seatsPerRow = hall.seatsPerRow;
    return dto;
  }
}
