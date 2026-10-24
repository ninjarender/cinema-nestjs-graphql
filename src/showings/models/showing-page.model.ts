import { Field, Int, ObjectType } from '@nestjs/graphql';
import { type PopulatedShowing, Showing } from '../schemas/showing.schema.js';

@ObjectType()
export class ShowingPage {
  @Field(() => [Showing])
  items: PopulatedShowing[];

  @Field(() => Int, { description: 'Кількість сеансів за фільтрами' })
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}
