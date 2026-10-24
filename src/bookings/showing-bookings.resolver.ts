import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  Showing,
  type ShowingDocument,
} from '../showings/schemas/showing.schema.js';
import { BookingsService } from './bookings.service.js';
import { BookingView } from './models/booking-view.model.js';

/**
 * Поле Showing.bookings. Резолвер живе в модулі бронювань, бо форму бронювання
 * у відповіді (з showingId) задає саме він; тип Showing при цьому той самий.
 * @Parent() — аліас типу, а не клас (див. ShowingsResolver).
 */
@Resolver(() => Showing)
export class ShowingBookingsResolver {
  constructor(private readonly bookingsService: BookingsService) {}

  @ResolveField(() => [BookingView])
  bookings(@Parent() showing: ShowingDocument): BookingView[] {
    return this.bookingsService.listForShowing(showing);
  }
}
