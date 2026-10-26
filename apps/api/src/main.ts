import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AppConfig } from './config/config.module.js';
import { StructuredLogger } from './common/logging.js';
import { setupApplication } from './setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(),
    abortOnError: false,
  });
  try {
    setupApplication(app);
    app.enableShutdownHooks();
    await app.listen(app.get(AppConfig).values.port, '0.0.0.0');
  } catch (error) {
    await app.close();
    throw error;
  }
}
bootstrap().catch((error: unknown) => {
  const logger = new StructuredLogger();
  logger.warn(
    'Startup failed. Check environment configuration and required dependencies.',
    'Bootstrap',
  );
  logger.error(error, undefined, 'Bootstrap');
  process.exitCode = 1;
});
