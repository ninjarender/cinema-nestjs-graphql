import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { EnvironmentVariables } from './config/environment-variables.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService<EnvironmentVariables, true>);
  await app.listen(config.get('PORT', { infer: true }));
  Logger.log(`GraphQL: ${await app.getUrl()}/graphql`, 'Bootstrap');
}
await bootstrap();
