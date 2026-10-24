import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FilmsModule } from '../films/films.module.js';
import { HallsModule } from '../halls/halls.module.js';
import { Showing, ShowingSchema } from './schemas/showing.schema.js';
import { SeatsResolver } from './seats.resolver.js';
import { ShowingsResolver } from './showings.resolver.js';
import { ShowingsService } from './showings.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Showing.name, schema: ShowingSchema }]),
    FilmsModule,
    HallsModule,
  ],
  providers: [ShowingsService, ShowingsResolver, SeatsResolver],
})
export class ShowingsModule {}
