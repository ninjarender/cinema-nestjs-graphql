import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsMongoId,
  IsPositive,
  ValidateNested,
} from 'class-validator';
import { OBJECT_ID_FORMAT } from '../../common/pipes/parse-object-id.pipe.js';

@InputType()
export class SeatInput {
  @Field(() => Int, { description: 'Номер ряду, ціле додатне' })
  @IsInt()
  @IsPositive()
  row: number;

  @Field(() => Int, { description: 'Номер місця в ряду, ціле додатне' })
  @IsInt()
  @IsPositive()
  seat: number;
}

/**
 * Аргументи createBooking(showingId, seats) одним класом: окремий @Args('seats') з типом
 * масиву ValidationPipe пропустив би без перевірки, а тут спрацьовують усі правила.
 */
@ArgsType()
export class CreateBookingArgs {
  @Field(() => ID)
  @IsMongoId({ message: `showingId must be an ${OBJECT_ID_FORMAT}` })
  showingId: string;

  @Field(() => [SeatInput], {
    description: 'Непорожній масив місць без повторів',
  })
  @IsArray()
  @ArrayNotEmpty()
  // До звернення до бази: фільтр із двома однаковими умовами задовольнило б одне вільне місце
  @ArrayUnique((seat: SeatInput) => `${seat?.row}:${seat?.seat}`, {
    message: 'seats must not contain the same seat twice',
  })
  @ValidateNested({ each: true })
  @Type(() => SeatInput)
  seats: SeatInput[];
}
