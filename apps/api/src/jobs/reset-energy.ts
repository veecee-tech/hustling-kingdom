import 'reflect-metadata';
import { requireDevelopmentReset } from '@hk/game-rules';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AppConfig } from '../config/config.module.js';
import { DatabaseService } from '../database/database.module.js';
// Reject production before opening database/Redis connections.
requireDevelopmentReset(new AppConfig().values.nodeEnv);
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  requireDevelopmentReset(app.get(AppConfig).values.nodeEnv);
  const id = process.argv[2];
  if (
    !id ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error('Supply one local character UUID.');
  const db = app.get(DatabaseService);
  await db.client.$transaction(async (tx) => {
    const character = await tx.character.findUniqueOrThrow({ where: { id } });
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${character.userId}::uuid FOR UPDATE`;
    await tx.characterStats.update({
      where: { characterId: id },
      data: { energy: 100 },
    });
  });
  console.log('Development-only energy reset completed. No money changed.');
} finally {
  await app.close();
}
