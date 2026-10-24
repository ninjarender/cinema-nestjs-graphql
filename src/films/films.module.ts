import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { FilmsResolver } from './films.resolver.js';
import { FilmsService } from './films.service.js';
import { Film, FilmSchema } from './schemas/film.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Film.name, schema: FilmSchema }]),
    ShowingsCoreModule,
  ],
  providers: [FilmsService, FilmsResolver],
  exports: [FilmsService],
})
export class FilmsModule {}
