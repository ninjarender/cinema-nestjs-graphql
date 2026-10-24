import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShowingsCoreModule } from '../showings/core.module.js';
import { HallsController } from './halls.controller.js';
import { HallsService } from './halls.service.js';
import { Hall, HallSchema } from './schemas/hall.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Hall.name, schema: HallSchema }]),
    ShowingsCoreModule,
  ],
  controllers: [HallsController],
  providers: [HallsService],
  exports: [HallsService],
})
export class HallsModule {}
