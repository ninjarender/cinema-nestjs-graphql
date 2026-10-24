import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { Showing, ShowingSchema } from '../showings/schemas/showing.schema.js';
import { BookingsResolver } from './bookings.resolver.js';
import { BookingsService } from './bookings.service.js';
import { ShowingBookingsResolver } from './showing-bookings.resolver.js';

/**
 * Окремої колекції бронювань немає: вони лежать у документах сеансів,
 * тому модуль працює з моделлю Showing.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Showing.name, schema: ShowingSchema }]),
    ShowingsCoreModule,
  ],
  providers: [BookingsService, BookingsResolver, ShowingBookingsResolver],
})
export class BookingsModule {}
