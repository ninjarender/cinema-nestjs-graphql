import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { BookingsModule } from './bookings/bookings.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import {
  EnvironmentVariables,
  validate,
} from './config/environment-variables.js';
import { FilmsModule } from './films/films.module.js';
import { HallsModule } from './halls/halls.module.js';
import { ShowingsModule } from './showings/showings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        uri: config.getOrThrow('MONGODB_URI', { infer: true }), // немає змінної → старт зупиняється
      }),
    }),
    FilmsModule,
    HallsModule,
    ShowingsModule,
    BookingsModule,
  ],
  providers: [
    // Глобальні складові зареєстровані провайдерами, а не в main.ts,
    // тому тестовий застосунок отримує їх разом із модулем (тема 13).
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // поля, яких немає в DTO, до сервісу не потрапляють
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
