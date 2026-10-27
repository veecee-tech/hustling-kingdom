import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { DatabaseService } from '../database/database.module.js';
import { validateOutcomeProfile } from '@hk/game-rules';
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const db = app.get(DatabaseService);
  await db.client.$executeRawUnsafe(
    await readFile(
      new URL('../../prisma/seed-hustles.sql', import.meta.url),
      'utf8',
    ),
  );
  const rows = await db.client.hustle.findMany({ where: { testOnly: false } });
  for (const row of rows) validateOutcomeProfile(row.outcomeProfile);
  console.log(JSON.stringify({ hustles: rows.length }));
} finally {
  await app.close();
}
