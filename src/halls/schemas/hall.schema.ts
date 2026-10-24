import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/** Порівняння рядків без урахування регістру (strength 2) за правилами української мови. */
export const CASE_INSENSITIVE = { locale: 'uk', strength: 2 };

export type HallDocument = HydratedDocument<Hall>;

/**
 * Перелік місць у документі залу не зберігається — обчислюється з rows × seatsPerRow.
 * Поля seats у GraphQL-типі Hall немає: зайнятість має сенс лише в межах сеансу (Showing.seats).
 */
@ObjectType()
@Schema()
export class Hall {
  @Field(() => ID, { name: 'id' })
  _id: Types.ObjectId;

  // Унікальний індекс без урахування регістру: "Зал 1" і "зал 1" — одна назва.
  // Тому й два одночасні createHall з різним регістром не створять двох залів.
  @Field()
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
    index: { unique: true, collation: CASE_INSENSITIVE },
  })
  name: string;

  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  rows: number;

  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  seatsPerRow: number;
}

export const HallSchema = SchemaFactory.createForClass(Hall);
