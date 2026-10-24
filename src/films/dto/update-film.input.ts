import { InputType, PartialType } from '@nestjs/graphql';
import { CreateFilmInput } from './create-film.input.js';

/**
 * PartialType з @nestjs/graphql, а не з @nestjs/swagger: поля стають необов'язковими і в схемі.
 * skipNullProperties: false — пропущене поле не змінюється, а явний null перевіряється
 * правилами CreateFilmInput і дає BAD_USER_INPUT (інакше дійшов би до бази й зламав required).
 */
@InputType()
export class UpdateFilmInput extends PartialType(CreateFilmInput, {
  skipNullProperties: false,
}) {}
