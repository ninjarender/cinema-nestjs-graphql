import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/** Заброньоване місце: копія { row, seat } з масиву seats сеансу. */
@Schema({ _id: false })
export class BookedSeat {
  @Prop({ required: true, min: 1 })
  row: number;

  @Prop({ required: true, min: 1 })
  seat: number;
}

export const BookedSeatSchema = SchemaFactory.createForClass(BookedSeat);

/**
 * Бронювання — вкладений документ сеансу (масив showing.bookings), окремої колекції немає.
 * _id генерується в коді перед записом: він потрібен і в seats.bookingId, і в самому бронюванні.
 */
@Schema()
export class Booking {
  _id: Types.ObjectId;

  // Дублюють seats сеансу, щоб віддати бронювання без перебору всіх місць.
  // Джерело істини про зайнятість — seats сеансу.
  @Prop({ type: [BookedSeatSchema], required: true })
  seats: BookedSeat[];

  @Prop({ required: true, min: 1 })
  totalPrice: number;

  @Prop({ required: true })
  createdAt: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
