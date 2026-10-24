import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

export const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
export const OBJECT_ID_FORMAT =
  'ObjectId — рядок із 24 шістнадцяткових символів (0-9, a-f)';

/**
 * Перевіряє формат ObjectId ще до звернення до бази:
 * без нього Mongoose кинув би CastError, і клієнт отримав би 500 замість 400.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!OBJECT_ID_PATTERN.test(value)) {
      throw new BadRequestException(
        `Ідентифікатор ${value} має неправильний формат: очікується ${OBJECT_ID_FORMAT}`,
      );
    }
    return value.toLowerCase(); // нормалізація: MongoDB видає id у нижньому регістрі
  }
}
