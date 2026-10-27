import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { AppConfig } from '../config/config.module.js';
import { DatabaseService } from '../database/database.module.js';
// Operator-owned deterministic browser fixtures. No HTTP control or production switch.
if (new AppConfig().values.nodeEnv !== 'test')
  throw new Error('Hustle browser fixtures require NODE_ENV=test.');
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: false,
});
try {
  const db = app.get(DatabaseService);
  const profiles = (disaster: boolean) => ({
    BIG_WIN: { weight: 0, xp: 30 },
    SUCCESS: { weight: disaster ? 0 : 10000, xp: 20 },
    PARTIAL_SUCCESS: { weight: 0, xp: 12 },
    FAILURE: { weight: 0, xp: 4 },
    DISASTER: { weight: disaster ? 10000 : 0, xp: 2 },
  });
  const fixtures = [
    {
      id: '66ee0000-0000-4000-8000-000000000001',
      code: 'E2E_STREET_SUCCESS',
      name: 'Old Town Chance',
      tier: 1,
      entryCost: 0n,
      rewardMin: 40000n,
      rewardMax: 40000n,
      disasterLoss: 2000n,
      requiredSkillLevel: 1,
      outcomeProfile: profiles(false),
    },
    {
      id: '66ee0000-0000-4000-8000-000000000002',
      code: 'E2E_STREET_HIGHER',
      name: 'Mainland Opening',
      tier: 2,
      entryCost: 10000n,
      rewardMin: 100000n,
      rewardMax: 100000n,
      disasterLoss: 15000n,
      requiredSkillLevel: 2,
      outcomeProfile: profiles(false),
    },
    {
      id: '66ee0000-0000-4000-8000-000000000003',
      code: 'E2E_STREET_DISASTER',
      name: 'Backstreet Risk',
      tier: 1,
      entryCost: 1000n,
      rewardMin: 20000n,
      rewardMax: 80000n,
      disasterLoss: 2000n,
      requiredSkillLevel: 1,
      outcomeProfile: profiles(true),
    },
  ];
  if (process.argv.includes('--disable'))
    await db.client.hustle.updateMany({
      where: { code: { in: fixtures.map((f) => f.code) }, testOnly: true },
      data: { isActive: false },
    });
  else if (process.argv.includes('--prepare'))
    for (const fixture of fixtures) {
      const data = {
        ...fixture,
        description:
          'A fictional opportunity for deterministic browser verification.',
        locationLabel: 'Old Town',
        riskLabel: 'MEDIUM',
        energyCost: 15,
        requiredSkillId: '55000000-0000-4000-8000-000000000006',
        cooldownSeconds: 0,
        testOnly: true,
        isActive: true,
        sortOrder: -10,
      };
      await db.client.hustle.upsert({
        where: { code: fixture.code },
        create: data,
        update: data,
      });
    }
  else throw new Error('Supply --prepare or --disable.');
  console.log(
    'Browser hustle fixtures updated. They are inaccessible outside test mode.',
  );
} finally {
  await app.close();
}
