import { Field, InputType, Int } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

@InputType()
export class CreateHallInput {
  @Field({ description: 'Унікальна без урахування регістру' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // дублює maxlength схеми → BAD_USER_INPUT, а не ValidationError Mongoose
  name: string;

  @Field(() => Int, { description: 'Від 1 до 100' })
  @IsInt()
  @IsPositive()
  @Max(100)
  rows: number;

  @Field(() => Int, { description: 'Від 1 до 100' })
  @IsInt()
  @IsPositive()
  @Max(100)
  seatsPerRow: number;
}
