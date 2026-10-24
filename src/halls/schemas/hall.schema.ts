import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

/** Порівняння рядків без урахування регістру (strength 2) за правилами української мови. */
export const CASE_INSENSITIVE = { locale: 'uk', strength: 2 };

export type HallDocument = HydratedDocument<Hall>;

/** Перелік місць у документі залу не зберігається — обчислюється з rows × seatsPerRow. */
@Schema()
export class Hall {
  // Унікальний індекс без урахування регістру: "Зал 1" і "зал 1" — одна назва.
  // Тому й два одночасні POST /halls з різним регістром не створять двох залів.
  @Prop({
    required: true,
    trim: true,
    maxlength: 100,
    index: { unique: true, collation: CASE_INSENSITIVE },
  })
  name: string;

  @Prop({ required: true, min: 1 })
  rows: number;

  @Prop({ required: true, min: 1 })
  seatsPerRow: number;
}

export const HallSchema = SchemaFactory.createForClass(Hall);
