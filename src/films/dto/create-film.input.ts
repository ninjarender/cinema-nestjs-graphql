import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** DTO з ДЗ_3, що став вхідним типом: правила class-validator лишилися ті самі. */
@InputType()
export class CreateFilmInput {
  @Field()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255) // дублює maxlength схеми → BAD_USER_INPUT, а не ValidationError Mongoose
  title: string;

  @Field(() => Int, { description: 'Тривалість у хвилинах, ціле додатне' })
  @IsInt()
  @IsPositive()
  durationMinutes: number;

  @Field(() => Int, { description: 'Від 1888 до 2100' })
  @IsInt()
  @Min(1888)
  @Max(2100)
  releaseYear: number;
}
