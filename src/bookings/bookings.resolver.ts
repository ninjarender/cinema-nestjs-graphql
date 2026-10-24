import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { BookingsService } from './bookings.service.js';
import { CreateBookingArgs } from './dto/create-booking.args.js';
import { BookingView } from './models/booking-view.model.js';

@Resolver(() => BookingView)
export class BookingsResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @Query(() => [BookingView], {
    description: 'Бронювання, зібрані з усіх сеансів',
  })
  async bookings(): Promise<BookingView[]> {
    return this.bookingsService.findAll();
  }

  @Mutation(() => BookingView, {
    description:
      'Займає всі місця одним оновленням сеансу; якщо хоч одне зайняте — CONFLICT і не бронюється жодне',
  })
  async createBooking(
    @Args() { showingId, seats }: CreateBookingArgs,
  ): Promise<BookingView> {
    return this.bookingsService.create(showingId, seats);
  }

  @Mutation(() => Boolean, {
    description: 'Звільняє місця й видаляє запис тим самим оновленням сеансу',
  })
  async cancelBooking(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<boolean> {
    await this.bookingsService.remove(id);
    return true;
  }
}
