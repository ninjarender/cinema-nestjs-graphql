import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsDate, IsInt, IsMongoId, IsPositive } from 'class-validator';
import { OBJECT_ID_FORMAT } from '../../common/pipes/parse-object-id.pipe.js';

@InputType()
export class CreateShowingInput {
  // Скаляр ID не гарантує ObjectId: формат перевіряється тут, до звернення до бази
  @Field(() => ID)
  @IsMongoId({ message: `filmId must be an ${OBJECT_ID_FORMAT}` })
  filmId: string;

  @Field(() => ID)
  @IsMongoId({ message: `hallId must be an ${OBJECT_ID_FORMAT}` })
  hallId: string;

  // Формат ISO 8601 перевіряє скаляр DateTime (common/scalars) ще до резолвера
  @Field({ description: 'Дата й час початку в ISO 8601, у майбутньому' })
  @IsDate({ message: 'startsAt must be a valid ISO 8601 date-time' })
  startsAt: Date;

  @Field(() => Int, { description: 'Ціна квитка в копійках, ціле додатне' })
  @IsInt()
  @IsPositive()
  price: number;
}
