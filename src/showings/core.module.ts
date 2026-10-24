import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Showing, ShowingSchema } from './schemas/showing.schema.js';
import { ShowingsCoreService } from './showings-core.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Showing.name, schema: ShowingSchema }]),
  ],
  providers: [ShowingsCoreService],
  exports: [ShowingsCoreService],
})
export class ShowingsCoreModule {}
