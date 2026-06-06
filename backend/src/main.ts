import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  const config = app.get(ConfigService);
  const port = config.get<number>('APP_PORT') ?? 4000;
  const prefix = config.get<string>('APP_GLOBAL_PREFIX') ?? 'api/v1';
  const origins = (config.get<string>('APP_CORS_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  // BigInt-safe JSON.stringify (audit_log.id is BigInt autoincrement)
  (BigInt.prototype as any).toJSON = function () {
    return this.toString();
  };
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });
  app.setGlobalPrefix(prefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  // OpenAPI / Swagger
  const swagger = new DocumentBuilder()
    .setTitle('VendorBridge API')
    .setDescription('Procurement & Vendor Management ERP — REST API')
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
  const doc = SwaggerModule.createDocument(app, swagger);
  SwaggerModule.setup(`${prefix}/docs`, app, doc, { swaggerOptions: { persistAuthorization: true } });

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`🚀 VendorBridge API ready at http://localhost:${port}/${prefix}`);
  logger.log(`📘 Swagger UI:             http://localhost:${port}/${prefix}/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error', err);
  process.exit(1);
});
