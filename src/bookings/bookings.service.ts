import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SeatPosition } from '../halls/dto/hall-with-seats.dto.js';
import { hallHasSeat } from '../halls/hall-seats.js';
import { Hall } from '../halls/schemas/hall.schema.js';
import { Showing } from '../showings/schemas/showing.schema.js';
import { ShowingsCoreService } from '../showings/showings-core.service.js';
import { BookingView, SeatAvailability } from './dto/booking-view.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

const seatKey = ({ row, seat }: SeatPosition): string => `${row}:${seat}`;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Showing.name)
    private readonly showingModel: Model<Showing>,
    private readonly showingsCore: ShowingsCoreService,
  ) {}

  /** Бронювання лежать у документах сеансів — збираємо їх з усіх сеансів. */
  async findAll(): Promise<BookingView[]> {
    const showings = await this.showingModel.find(
      { 'bookings.0': { $exists: true } },
      'bookings',
    );
    return showings
      .flatMap((showing) =>
        showing.bookings.map((booking) =>
          BookingView.fromBooking(booking, showing._id),
        ),
      )
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      );
  }

  async findByShowing(showingId: string): Promise<BookingView[]> {
    const showing = await this.showingsCore.findOne(showingId, 'bookings');
    return showing.bookings.map((booking) =>
      BookingView.fromBooking(booking, showing._id),
    );
  }

  async create(showingId: string, dto: CreateBookingDto): Promise<BookingView> {
    // Існування сеансу й межі залу — ДО оновлення: фільтр оновлення не розрізняє
    // неіснуюче місце й зайняте, і місце поза залом дало б 409 замість 400.
    // Повтори місць у масиві відхиляє CreateBookingDto (@ArrayUnique) ще раніше.
    const showing = await this.showingsCore
      .findOne(showingId, 'hall price')
      .then((found) =>
        found.populate<{ hall: Hall }>('hall', 'name rows seatsPerRow'),
      );
    const { hall } = showing;

    const outsideHall = dto.seats.filter((seat) => !hallHasSeat(hall, seat));
    if (outsideHall.length > 0) {
      throw new BadRequestException(
        `У залі "${hall.name}" (${hall.rows} рядів × ${hall.seatsPerRow} місць) немає місць: ${this.formatSeats(outsideHall)}`,
      );
    }

    const seats = dto.seats.map(({ row, seat }) => ({ row, seat }));
    const booking = {
      _id: new Types.ObjectId(), // ДО оновлення: потрібен і в $set, і в $push, і у відповіді
      seats,
      totalPrice: showing.price * seats.length,
      createdAt: new Date(),
    };

    // Одне оновлення одного документа — неподільне. Фільтр вимагає, щоб КОЖНЕ місце
    // було вільним; якщо хоч одне зайняте, документ не змінюється взагалі.
    const result = await this.showingModel.updateOne(
      {
        _id: showing._id,
        $and: seats.map(({ row, seat }) => ({
          seats: { $elemMatch: { row, seat, bookingId: null } },
        })),
      },
      {
        $set: { 'seats.$[target].bookingId': booking._id },
        $push: { bookings: booking },
      },
      {
        arrayFilters: [
          {
            $or: seats.map(({ row, seat }) => ({
              'target.row': row,
              'target.seat': seat,
            })),
          },
        ],
      },
    );

    // Сеанс існує, межі й унікальність перевірені — 0 означає лише конфлікт.
    // modifiedCount не годиться: він 0 і тоді, коли документ знайдено, але нічого не змінилось.
    if (result.matchedCount === 0) {
      throw await this.seatsTakenConflict(showingId, seats);
    }
    return BookingView.fromBooking(booking, showing._id);
  }

  async getSeatsForShowing(showingId: string): Promise<SeatAvailability[]> {
    const showing = await this.showingsCore.findOne(showingId, 'seats');
    return showing.seats.map(({ row, seat, bookingId }) => ({
      row,
      seat,
      isBooked: bookingId !== null,
    }));
  }

  async remove(id: string): Promise<void> {
    // Id бронювання не містить посилання на сеанс: шукаємо сеанс за вкладеним елементом.
    // Звільнення місць і видалення запису — одним оновленням.
    const bookingId = new Types.ObjectId(id);
    const result = await this.showingModel.updateOne(
      { 'bookings._id': bookingId },
      {
        $set: { 'seats.$[target].bookingId': null },
        $pull: { bookings: { _id: bookingId } },
      },
      { arrayFilters: [{ 'target.bookingId': bookingId }] },
    );
    if (result.matchedCount === 0) {
      this.logger.warn(`Бронювання з id ${id} не знайдено`);
      throw new NotFoundException(`Бронювання з id ${id} не знайдено`);
    }
  }

  /**
   * 409 зі списком зайнятих місць. Читання тут лише для тексту помилки:
   * рішення про конфлікт уже ухвалило атомарне оновлення.
   */
  private async seatsTakenConflict(
    showingId: string,
    requested: SeatPosition[],
  ): Promise<ConflictException> {
    const showing = await this.showingModel.findById(showingId, 'seats');
    const booked = new Set(
      (showing?.seats ?? [])
        .filter(({ bookingId }) => bookingId !== null)
        .map(seatKey),
    );
    const taken = requested.filter((seat) => booked.has(seatKey(seat)));
    const details = taken.length > 0 ? `: ${this.formatSeats(taken)}` : '';

    this.logger.warn(`Конфлікт бронювання на сеансі ${showingId}${details}`);
    return new ConflictException(
      `Місця вже заброньовані на цьому сеансі${details}`,
    );
  }

  private formatSeats(seats: SeatPosition[]): string {
    return seats.map(({ row, seat }) => `ряд ${row} місце ${seat}`).join(', ');
  }
}
