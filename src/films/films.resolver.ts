import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CreateFilmInput } from './dto/create-film.input.js';
import { UpdateFilmInput } from './dto/update-film.input.js';
import { FilmsService } from './films.service.js';
import { Film, FilmDocument } from './schemas/film.schema.js';

/** Замість FilmsController: приймає операції GraphQL і викликає той самий сервіс. */
@Resolver(() => Film)
export class FilmsResolver {
  constructor(private readonly filmsService: FilmsService) {}

  @Query(() => [Film])
  async films(): Promise<FilmDocument[]> {
    return this.filmsService.findAll();
  }

  @Query(() => Film, { nullable: true })
  async film(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<FilmDocument | null> {
    return this.filmsService.findById(id);
  }

  @Mutation(() => Film)
  async createFilm(
    @Args('input') input: CreateFilmInput,
  ): Promise<FilmDocument> {
    return this.filmsService.create(input);
  }

  @Mutation(() => Film)
  async updateFilm(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
    @Args('input') input: UpdateFilmInput,
  ): Promise<FilmDocument> {
    return this.filmsService.update(id, input);
  }

  @Mutation(() => Boolean)
  async deleteFilm(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<boolean> {
    await this.filmsService.remove(id);
    return true;
  }
}
