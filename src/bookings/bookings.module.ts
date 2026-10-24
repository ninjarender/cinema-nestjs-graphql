import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { Showing, ShowingSchema } from '../showings/schemas/showing.schema.js';
import { BookingsController } from './bookings.controller.js';
import { BookingsService } from './bookings.service.js';

/**
 * Окремої колекції бронювань немає: вони лежать у документах сеансів,
 * тому модуль працює з моделлю Showing.
 */
@Module({
  imports: [
    MongooseModule.forFeature([{ name: Showing.name, schema: ShowingSchema }]),
    ShowingsCoreModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
