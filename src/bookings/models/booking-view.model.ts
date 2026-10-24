import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { Types } from 'mongoose';
import { Booking } from '../schemas/booking.schema.js';

/**
 * GraphQL-тип Booking: збережені поля вкладеного бронювання + id сеансу,
 * у документі якого воно лежить (сам вкладений документ цього id не містить).
 */
@ObjectType('Booking')
export class BookingView extends Booking {
  @Field(() => ID, { description: 'Сеанс, у якому лежить бронювання' })
  showingId: Types.ObjectId;

  static fromBooking(booking: Booking, showingId: Types.ObjectId): BookingView {
    const view = new BookingView();
    view._id = booking._id;
    view.showingId = showingId;
    view.seats = booking.seats
      .map(({ row, seat }) => ({ row, seat }))
      .sort((a, b) => a.row - b.row || a.seat - b.seat);
    view.totalPrice = booking.totalPrice;
    view.createdAt = booking.createdAt;
    return view;
  }
}
