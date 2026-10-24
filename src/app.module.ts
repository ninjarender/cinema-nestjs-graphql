import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { MongooseModule } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import { join } from 'node:path';
import { BookingsModule } from './bookings/bookings.module.js';
import { GraphqlExceptionFilter } from './common/filters/graphql-exception.filter.js';
import { formatGraphqlError } from './common/graphql-errors.js';
import { DateTimeScalar } from './common/scalars/date-time.scalar.js';
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
        // Лог кожного запиту до бази на цьому підключенні: так видно, скільки запитів дає одна операція GraphQL
        connectionFactory: (connection: Connection) => {
          connection.set(
            'debug',
            config.get('MONGOOSE_DEBUG', { infer: true }),
          );
          return connection;
        },
      }),
    }),
    // Code-first: схема генерується з класів із декораторами при старті й записується у файл
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      // Стек у відповіді показав би внутрішні деталі; помилки бази — лише в логах сервера
      includeStacktraceInErrorResponses: false,
      formatError: formatGraphqlError,
    }),
    FilmsModule,
    HallsModule,
    ShowingsModule,
    BookingsModule,
  ],
  providers: [
    // Глобальні складові зареєстровані провайдерами, а не в main.ts,
    // тому тестовий застосунок отримує їх разом із модулем (тема 13).
    // ValidationPipe діє й на аргументи резолверів: @Args з @InputType/@ArgsType.
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // поля, яких немає у вхідному типі, до сервісу не потрапляють
        transform: true,
      }),
    },
    { provide: APP_FILTER, useClass: GraphqlExceptionFilter },
    // Поля типу Date — строгий скаляр DateTime (лише ISO 8601) замість вбудованого
    DateTimeScalar,
  ],
})
export class AppModule {}
