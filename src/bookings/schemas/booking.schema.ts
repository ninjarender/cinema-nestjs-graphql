import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

/**
 * Заброньоване місце: копія { row, seat } з масиву seats сеансу.
 * Окремий GraphQL-тип: у Seat поле isBooked обов'язкове, а тут його немає.
 */
@ObjectType()
@Schema({ _id: false })
export class BookedSeat {
  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  row: number;

  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  seat: number;
}

export const BookedSeatSchema = SchemaFactory.createForClass(BookedSeat);

/**
 * Бронювання — вкладений документ сеансу (масив showing.bookings), окремої колекції немає.
 * _id генерується в коді перед записом: він потрібен і в seats.bookingId, і в самому бронюванні.
 *
 * isAbstract: клас дає поля, але сам у схему не потрапляє. GraphQL-тип Booking — це BookingView,
 * який додає showingId: у збереженому документі його немає, бо бронювання лежить усередині сеансу.
 */
@ObjectType({ isAbstract: true })
@Schema()
export class Booking {
  @Field(() => ID, { name: 'id' })
  _id: Types.ObjectId;

  // Дублюють seats сеансу, щоб віддати бронювання без перебору всіх місць.
  // Джерело істини про зайнятість — seats сеансу.
  @Field(() => [BookedSeat])
  @Prop({ type: [BookedSeatSchema], required: true })
  seats: BookedSeat[];

  @Field(() => Int)
  @Prop({ required: true, min: 1 })
  totalPrice: number;

  @Field()
  @Prop({ required: true })
  createdAt: Date;
}

export const BookingSchema = SchemaFactory.createForClass(Booking);
