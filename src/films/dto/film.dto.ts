import { ApiProperty } from '@nestjs/swagger';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';
import type { FilmDocument } from '../schemas/film.schema.js';

/** Фільм у відповідях API: рядковий id замість _id, без службових полів Mongoose. */
export class FilmDto {
  @ApiProperty({ example: OBJECT_ID_EXAMPLE, description: 'ObjectId' })
  id: string;

  @ApiProperty({ example: 'Тіні забутих предків' })
  title: string;

  @ApiProperty({ example: 97, description: 'Тривалість у хвилинах' })
  durationMinutes: number;

  @ApiProperty({ example: 1965 })
  releaseYear: number;

  static fromDocument(film: FilmDocument): FilmDto {
    const dto = new FilmDto();
    dto.id = film._id.toString();
    dto.title = film.title;
    dto.durationMinutes = film.durationMinutes;
    dto.releaseYear = film.releaseYear;
    return dto;
  }
}
