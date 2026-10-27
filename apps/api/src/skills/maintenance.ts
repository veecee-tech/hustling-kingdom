import 'reflect-metadata';
import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { DatabaseService } from '../database/database.module.js';
import { SkillsService } from './skills.service.js';
import { levelFromXp } from '@hk/game-rules';
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const db = app.get(DatabaseService);
  if (process.argv.includes('--seed')) {
    for (const file of ['seed-skills.sql', 'configure-job-skills.sql'])
      await db.client.$executeRawUnsafe(
        await readFile(
          new URL(`../../prisma/${file}`, import.meta.url),
          'utf8',
        ),
      );
    console.log(
      JSON.stringify({
        skills: await db.client.skill.count({ where: { isActive: true } }),
      }),
    );
  } else if (process.argv.includes('--backfill'))
    console.log(JSON.stringify(await app.get(SkillsService).backfill()));
  else {
    const states = await db.client.characterSkill.findMany({
      include: { skill: true },
    });
    const inconsistencies = states.filter(
      (state) => levelFromXp(state.xp, state.skill.maxLevel) !== state.level,
    ).length;
    console.log(JSON.stringify({ checked: states.length, inconsistencies }));
    if (inconsistencies) process.exitCode = 1;
  }
} finally {
  await app.close();
}
