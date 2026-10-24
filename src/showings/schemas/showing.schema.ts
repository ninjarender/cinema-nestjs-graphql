import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import {
  Booking,
  BookingSchema,
} from '../../bookings/schemas/booking.schema.js';
import { Film, FilmDocument } from '../../films/schemas/film.schema.js';
import { Hall, HallDocument } from '../../halls/schemas/hall.schema.js';

export type ShowingDocument = HydratedDocument<Showing>;

/** Сеанс після populate('film') і populate('hall'): замість ObjectId — документи. */
export type PopulatedShowing = Omit<ShowingDocument, 'film' | 'hall'> & {
  film: FilmDocument;
  hall: HallDocument;
};

/**
 * Місце залу на конкретному сеансі.
 * У GraphQL-типі Seat замість bookingId — обчислюване isBooked (SeatsResolver).
 */
@ObjectType()
@Schema({ _id: false })
export class Seat {
  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  row: number;

  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  seat: number;

  // Посилання на елемент bookings; null — місце вільне
  @Prop({ type: mongoose.Schema.Types.ObjectId, default: null })
  bookingId: Types.ObjectId | null;
}

export const SeatSchema = SchemaFactory.createForClass(Seat);

/**
 * Сеанс разом зі своїми місцями й бронюваннями: бронювання змінює лише цей документ,
 * а оновлення одного документа в MongoDB неподільне — транзакція не потрібна.
 *
 * Поля film, hall і bookings у GraphQL-тип додають резолвери полів (@ResolveField):
 * у документі це ObjectId і вкладені записи без showingId, а клієнт отримує об'єкти.
 */
@ObjectType()
@Schema()
export class Showing {
  @Field(() => ID, { name: 'id' })
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Film.name,
    required: true,
  })
  film: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: Hall.name,
    required: true,
  })
  hall: Types.ObjectId;

  @Field()
  @Prop({ required: true })
  startsAt: Date;

  @Field(() => Int, { description: 'Ціна квитка в копійках' })
  @Prop({ required: true, min: 1 })
  price: number;

  // Заповнюється при створенні сеансу: rows × seatsPerRow елементів
  @Field(() => [Seat], {
    description: 'Місця залу зі станом на цьому сеансі',
  })
  @Prop({ type: [SeatSchema], default: [] })
  seats: Seat[];

  @Prop({ type: [BookingSchema], default: [] })
  bookings: Booking[];
}

export const ShowingSchema = SchemaFactory.createForClass(Showing);

// Розклад: фільтр за фільмом і сортування за часом початку, потім за _id
ShowingSchema.index({ film: 1, startsAt: 1, _id: 1 });
ShowingSchema.index({ startsAt: 1, _id: 1 });
// Перевірка залу перед видаленням і пошук сеансу за вкладеним бронюванням (cancelBooking)
ShowingSchema.index({ hall: 1 });
ShowingSchema.index({ 'bookings._id': 1 });
