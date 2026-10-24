import { ApiProperty } from '@nestjs/swagger';
import type { Types } from 'mongoose';
import { OBJECT_ID_EXAMPLE } from '../../common/decorators/api-object-id-param.decorator.js';
import { SeatPosition } from '../../halls/dto/hall-with-seats.dto.js';
import type { Booking } from '../schemas/booking.schema.js';

/** Бронювання у відповідях API: місця — масив { row, seat }, як у ДЗ_1. */
export class BookingView {
  @ApiProperty({ example: OBJECT_ID_EXAMPLE, description: 'ObjectId' })
  id: string;

  @ApiProperty({
    example: '665f1c2b8e4a3d1f9c0b7a24',
    description: 'ObjectId сеансу',
  })
  showingId: string;

  @ApiProperty({ type: [SeatPosition] })
  seats: SeatPosition[];

  @ApiProperty({
    example: 25000,
    description: 'Ціна сеансу × кількість місць, у копійках',
  })
  totalPrice: number;

  @ApiProperty({ example: '2026-11-20T12:00:00.000Z' })
  createdAt: Date;

  static fromBooking(booking: Booking, showingId: Types.ObjectId): BookingView {
    const view = new BookingView();
    view.id = booking._id.toString();
    view.showingId = showingId.toString();
    view.seats = booking.seats
      .map(({ row, seat }) => ({ row, seat }))
      .sort((a, b) => a.row - b.row || a.seat - b.seat);
    view.totalPrice = booking.totalPrice;
    view.createdAt = booking.createdAt;
    return view;
  }
}

export class SeatAvailability extends SeatPosition {
  @ApiProperty({ example: false })
  isBooked: boolean;
}
