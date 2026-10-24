import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiObjectIdParam } from '../common/decorators/api-object-id-param.decorator.js';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { BookingsService } from './bookings.service.js';
import { BookingView, SeatAvailability } from './dto/booking-view.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';

/**
 * Маршрути бронювань і зайнятості місць.
 * Частина з них вкладена в /showings/:id, бо стосується конкретного сеансу,
 * але дані про зайнятість належать саме бронюванням.
 */
@ApiTags('bookings')
@Controller()
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  @ApiOkResponse({
    type: [BookingView],
    description: 'Бронювання, зібрані з усіх сеансів',
  })
  async findAll(): Promise<BookingView[]> {
    return this.bookingsService.findAll();
  }

  @Delete('bookings/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiObjectIdParam('Id бронювання')
  @ApiNoContentResponse({
    description: 'Бронювання скасовано, місця звільнено',
  })
  @ApiNotFoundResponse({ description: 'Бронювання не знайдено' })
  async remove(@Param('id', ParseObjectIdPipe) id: string): Promise<void> {
    await this.bookingsService.remove(id);
  }

  @Post('showings/:id/bookings')
  @ApiObjectIdParam(
    'Id сеансу',
    'id не є ObjectId; seats порожній або елемент без row/seat; місце повторюється; місця немає в залі',
  )
  @ApiCreatedResponse({ type: BookingView })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  @ApiConflictResponse({
    description:
      'Хоча б одне місце вже заброньоване; документ сеансу не змінюється, жодне місце не бронюється',
  })
  async create(
    @Param('id', ParseObjectIdPipe) showingId: string,
    @Body() dto: CreateBookingDto,
  ): Promise<BookingView> {
    return this.bookingsService.create(showingId, dto);
  }

  @Get('showings/:id/bookings')
  @ApiObjectIdParam('Id сеансу')
  @ApiOkResponse({ type: [BookingView] })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  async findByShowing(
    @Param('id', ParseObjectIdPipe) showingId: string,
  ): Promise<BookingView[]> {
    return this.bookingsService.findByShowing(showingId);
  }

  @Get('showings/:id/seats')
  @ApiObjectIdParam('Id сеансу')
  @ApiOkResponse({
    type: [SeatAvailability],
    description: 'Усі місця залу сеансу з ознакою зайнятості',
  })
  @ApiNotFoundResponse({ description: 'Сеанс не знайдено' })
  async getSeats(
    @Param('id', ParseObjectIdPipe) showingId: string,
  ): Promise<SeatAvailability[]> {
    return this.bookingsService.getSeatsForShowing(showingId);
  }
}
