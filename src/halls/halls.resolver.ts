import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe.js';
import { CreateHallInput } from './dto/create-hall.input.js';
import { HallsService } from './halls.service.js';
import { Hall, HallDocument } from './schemas/hall.schema.js';

@Resolver(() => Hall)
export class HallsResolver {
  constructor(private readonly hallsService: HallsService) {}

  @Query(() => [Hall])
  async halls(): Promise<HallDocument[]> {
    return this.hallsService.findAll();
  }

  @Query(() => Hall, { nullable: true })
  async hall(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<HallDocument | null> {
    return this.hallsService.findById(id);
  }

  @Mutation(() => Hall)
  async createHall(
    @Args('input') input: CreateHallInput,
  ): Promise<HallDocument> {
    return this.hallsService.create(input);
  }

  @Mutation(() => Boolean)
  async deleteHall(
    @Args('id', { type: () => ID }, ParseObjectIdPipe) id: string,
  ): Promise<boolean> {
    await this.hallsService.remove(id);
    return true;
  }
}
