import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilmsModule } from '../films/films.module.js';
import { HallsModule } from '../halls/halls.module.js';
import { ShowingsCoreModule } from './core.module.js';
import { Showing, ShowingSchema } from './schemas/showing.schema.js';
import { ShowingsController } from './showings.controller.js';
import { ShowingsService } from './showings.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Showing.name, schema: ShowingSchema }]),
    ShowingsCoreModule,
    FilmsModule,
    HallsModule,
  ],
  controllers: [ShowingsController],
  providers: [ShowingsService],
})
export class ShowingsModule {}
