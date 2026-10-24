import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { FilmsController } from './films.controller.js';
import { FilmsService } from './films.service.js';
import { Film, FilmSchema } from './schemas/film.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Film.name, schema: FilmSchema }]),
    ShowingsCoreModule,
  ],
  controllers: [FilmsController],
  providers: [FilmsService],
  exports: [FilmsService],
})
export class FilmsModule {}
