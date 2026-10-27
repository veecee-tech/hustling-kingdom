import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { DatabaseService } from '../database/database.module.js';
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const sql = await readFile(
    new URL('../../prisma/seed-jobs.sql', import.meta.url),
    'utf8',
  );
  await app.get(DatabaseService).client.$executeRawUnsafe(sql);
  console.log(
    JSON.stringify({ jobs: await app.get(DatabaseService).client.job.count() }),
  );
} finally {
  await app.close();
}
