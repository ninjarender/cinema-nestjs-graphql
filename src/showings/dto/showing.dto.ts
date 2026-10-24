import { ApiProperty } from '@nestjs/swagger';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';
import type { ShowingDocument } from '../schemas/showing.schema.js';

/** Створений сеанс: ідентифікатори фільму й залу, без seats і bookings. */
export class ShowingDto {
  @ApiProperty({ example: OBJECT_ID_EXAMPLE, description: 'ObjectId' })
  id: string;

  @ApiProperty({ example: '665f1c2b8e4a3d1f9c0b7a22', description: 'ObjectId' })
  filmId: string;

  @ApiProperty({ example: '665f1c2b8e4a3d1f9c0b7a23', description: 'ObjectId' })
  hallId: string;

  @ApiProperty({
    example: '2026-11-20T18:30:00.000Z',
    description: 'Початок сеансу, ISO 8601 в UTC',
  })
  startsAt: Date;

  @ApiProperty({ example: 12500, description: 'Ціна квитка в копійках' })
  price: number;

  static fromDocument(showing: ShowingDocument): ShowingDto {
    const dto = new ShowingDto();
    dto.id = showing._id.toString();
    dto.filmId = showing.film.toString();
    dto.hallId = showing.hall.toString();
    dto.startsAt = showing.startsAt;
    dto.price = showing.price;
    return dto;
  }
}
