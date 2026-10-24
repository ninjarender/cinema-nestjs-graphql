import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Seat } from './schemas/showing.schema.js';

/** Місце сеансу, як воно лежить у документі (аліас типу, а не клас — див. ShowingsResolver). */
type StoredSeat = Pick<Seat, 'bookingId'>;

/**
 * Резолвер обчислює значення одного поля: isBooked у документі не зберігається,
 * джерело істини — bookingId (null — вільне).
 */
@Resolver(() => Seat)
export class SeatsResolver {
  @ResolveField(() => Boolean)
  isBooked(@Parent() seat: StoredSeat): boolean {
    return seat.bookingId !== null;
  }
}
