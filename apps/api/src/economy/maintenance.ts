import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { EconomyService } from './economy.service.js';
import { DatabaseService } from '../database/database.module.js';
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const economy = app.get(EconomyService);
  if (process.argv.includes('--backfill'))
    console.log(JSON.stringify({ initialized: await economy.backfill() }));
  else {
    let checked = 0;
    let mismatches = 0;
    let cursor: string | undefined;
    const db = app.get(DatabaseService);
    for (;;) {
      const rows = await db.client.character.findMany({
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true },
      });
      if (!rows.length) break;
      for (const row of rows) {
        checked++;
        try {
          if (!(await economy.reconcile(row.id)).ok) mismatches++;
        } catch {
          mismatches++;
        }
      }
      cursor = rows.at(-1)!.id;
    }
    console.log(JSON.stringify({ checked, mismatches }));
    if (mismatches) process.exitCode = 1;
  }
} finally {
  await app.close();
}
