import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import {
  RequestMethod,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';
import { API_PREFIX, REQUEST_ID_HEADER } from '@hk/config';
import { AppConfig } from './config/config.module.js';
import { ApiErrorFilter, PublicHttpError } from './common/error.filter.js';
import { requestContext, StructuredLogger } from './common/logging.js';
import { RealtimeAdapter } from './realtime/realtime.module.js';

export function setupApplication(app: INestApplication): void {
  const config = app.get(AppConfig).values;
  const logger = new StructuredLogger();
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = `req_${randomUUID()}`;
    res.setHeader(REQUEST_ID_HEADER, requestId);
    requestContext.run({ requestId }, () => {
      res.on('finish', () =>
        requestContext.run({ requestId }, () =>
          logger.log(`${req.method} ${res.statusCode}`, 'Http'),
        ),
      );
      next();
    });
  });
  app.use(helmet());
  app.enableCors({
    origin: config.webOrigin,
    exposedHeaders: [REQUEST_ID_HEADER],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      REQUEST_ID_HEADER,
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      exceptionFactory: () =>
        new PublicHttpError(
          400,
          'VALIDATION_ERROR',
          'Request validation failed.',
        ),
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  app.useWebSocketAdapter(new RealtimeAdapter(app, config.webOrigin));
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Hustling Kingdom API')
      .setDescription('Phase 0 infrastructure endpoints. No gameplay API yet.')
      .setVersion('0.0.0')
      .build(),
  );
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
}
