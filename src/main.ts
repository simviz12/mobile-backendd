import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { GlobalExceptionFilter } from './shared/errors/global-exception.filter.js';
import { LoggingInterceptor } from './shared/logging/logging.interceptor.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import YAML from 'yaml';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Enable CORS for development & mobile LAN connectivity
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter and logging
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger OpenAPI Documentation
  const config = new DocumentBuilder()
    .setTitle('Guardian Mobile API')
    .setDescription('Remote Anti-Theft Protection System for Android Phones')
    .setVersion('0.0.1')
    .addTag('Health', 'System and database health monitoring')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Export openapi.yaml to the project root
  try {
    const yamlString = YAML.stringify(document);
    writeFileSync(join(process.cwd(), 'openapi.yaml'), yamlString, 'utf8');
    logger.log('openapi.yaml exported successfully to repo root');
  } catch (err) {
    logger.warn(`Failed to export openapi.yaml: ${(err as Error).message}`);
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  // Listen on 0.0.0.0 for LAN and adb reverse compatibility
  await app.listen(port, '0.0.0.0');
  logger.log(`Guardian Mobile API running on http://0.0.0.0:${port}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/docs`);
}

bootstrap();
