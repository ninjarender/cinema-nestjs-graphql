import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type FilmDocument = HydratedDocument<Film>;

/** Той самий клас описує і документ Mongoose, і GraphQL-тип Film (тема 15). */
@ObjectType()
@Schema()
export class Film {
  // Ім'я поля задано явно: інакше в схемі з'явилося б _id (шпаргалка ДЗ, 4.1)
  @Field(() => ID, { name: 'id' })
  _id: Types.ObjectId;

  @Field()
  @Prop({ required: true, trim: true, maxlength: 255 })
  title: string;

  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  durationMinutes: number;

  @Field(() => Int)
  @Prop({ required: true })
  releaseYear: number;
}

export const FilmSchema = SchemaFactory.createForClass(Film);
