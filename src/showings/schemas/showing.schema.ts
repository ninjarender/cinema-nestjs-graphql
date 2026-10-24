import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument, Types } from 'mongoose';
import {
  Booking,
  BookingSchema,
} from '../../bookings/schemas/booking.schema.js';
import { Film } from '../../films/schemas/film.schema.js';
import { Hall } from '../../halls/schemas/hall.schema.js';

export type ShowingDocument = HydratedDocument<Showing>;

/** Місце залу на конкретному сеансі. */
@Schema({ _id: false })
export class Seat {
  @Prop({ required: true, min: 1 })
  row: number;

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
 */
@Schema()
export class Showing {
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

  @Prop({ required: true })
  startsAt: Date;

  @Prop({ required: true, min: 1 }) // у копійках
  price: number;

  // Заповнюється при створенні сеансу: rows × seatsPerRow елементів
  @Prop({ type: [SeatSchema], default: [] })
  seats: Seat[];

  @Prop({ type: [BookingSchema], default: [] })
  bookings: Booking[];
}

export const ShowingSchema = SchemaFactory.createForClass(Showing);

// Розклад: фільтр за фільмом і сортування за часом початку, потім за _id
ShowingSchema.index({ film: 1, startsAt: 1, _id: 1 });
ShowingSchema.index({ startsAt: 1, _id: 1 });
// Перевірка залу перед видаленням і пошук сеансу за вкладеним бронюванням (DELETE /bookings/:id)
ShowingSchema.index({ hall: 1 });
ShowingSchema.index({ 'bookings._id': 1 });
