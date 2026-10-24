import { ArgsType, Field, ID, Int, registerEnumType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { OBJECT_ID_FORMAT } from '../../common/pipes/parse-object-id.pipe.js';

/** Імена в схемі — ASC/DESC, значення в коді — ті, що приймає sort() Mongoose. */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

registerEnumType(SortOrder, {
  name: 'SortOrder',
  description: 'Порядок за часом початку сеансу',
});

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

/**
 * Аргументи query showings одним класом (@ArgsType), а не окремими скалярами:
 * так їх перевіряє class-validator через глобальний ValidationPipe.
 * Явний null у будь-якому аргументі означає те саме, що й пропущений аргумент.
 */
@ArgsType()
export class ShowingsArgs {
  @Field(() => ID, {
    nullable: true,
    description: 'Залишає сеанси лише цього фільму',
  })
  @Transform(({ value }: { value: unknown }) => value ?? undefined)
  @IsOptional()
  @IsMongoId({ message: `filmId must be an ${OBJECT_ID_FORMAT}` })
  filmId?: string;

  @Field({
    nullable: true,
    description:
      'Залишає сеанси, що починаються цієї доби (UTC), формат YYYY-MM-DD',
  })
  @Transform(({ value }: { value: unknown }) => value ?? undefined)
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  @IsISO8601(
    { strict: true },
    { message: 'date must be a valid calendar date' },
  )
  date?: string;

  @Field(() => Int, { nullable: true, defaultValue: DEFAULT_PAGE })
  @Transform(({ value }: { value: unknown }) => value ?? DEFAULT_PAGE)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_PAGE;

  @Field(() => Int, {
    nullable: true,
    defaultValue: DEFAULT_LIMIT,
    description: 'Від 1 до 100',
  })
  @Transform(({ value }: { value: unknown }) => value ?? DEFAULT_LIMIT)
  @IsInt()
  @Min(1)
  @Max(100) // стеля, інакше limit: 100000 = уся колекція
  limit: number = DEFAULT_LIMIT;

  @Field(() => SortOrder, {
    nullable: true,
    defaultValue: SortOrder.ASC,
    description: 'При рівному часі — за id',
  })
  @Transform(({ value }: { value: unknown }) => value ?? SortOrder.ASC)
  @IsEnum(SortOrder)
  sort: SortOrder = SortOrder.ASC;
}
