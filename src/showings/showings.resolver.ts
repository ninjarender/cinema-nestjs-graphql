import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { Film, type FilmDocument } from '../films/schemas/film.schema.js';
import { Hall, type HallDocument } from '../halls/schemas/hall.schema.js';
import { CreateShowingInput } from './dto/create-showing.input.js';
import { ShowingsArgs } from './dto/showings.args.js';
import { ShowingPage } from './models/showing-page.model.js';
import { type PopulatedShowing, Showing } from './schemas/showing.schema.js';
import { ShowingsService } from './showings.service.js';

/**
 * ⚠️ @Parent() типізовано аліасом типу, а не класом: глобальний ValidationPipe діє й на
 * параметри резолверів полів, і з класом у метаданих спробував би перетворити документ Mongoose.
 */
@Resolver(() => Showing)
export class ShowingsResolver {
  constructor(private readonly showingsService: ShowingsService) {}

  @Query(() => ShowingPage)
  async showings(@Args() args: ShowingsArgs): Promise<ShowingPage> {
    return this.showingsService.findAll(args);
  }

  @Query(() => Showing, { nullable: true })
  async showing(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<PopulatedShowing | null> {
    return this.showingsService.findById(id);
  }

  @Mutation(() => Showing)
  async createShowing(
    @Args('input') input: CreateShowingInput,
  ): Promise<PopulatedShowing> {
    return this.showingsService.create(input);
  }

  // Сервіс уже підставив документ через populate — резолвер поля до бази не звертається
  @ResolveField(() => Film)
  film(@Parent() showing: PopulatedShowing): FilmDocument {
    return showing.film;
  }

  @ResolveField(() => Hall)
  hall(@Parent() showing: PopulatedShowing): HallDocument {
    return showing.hall;
  }
}
