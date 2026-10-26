import 'reflect-metadata';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { RedisService } from '../src/redis/redis.module.js';
import { QueueService } from '../src/queue/queue.module.js';
import { setupApplication } from '../src/setup.js';

let app: INestApplication | undefined;
beforeAll(async () => {
  const module = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  app = module.createNestApplication();
  setupApplication(app);
  await app.init();
});
afterAll(async () => {
  await app?.close();
});
it('boots the real application with PostgreSQL, Redis and BullMQ', async () => {
  if (!app) throw new Error('Application did not start.');
  await app.get(DatabaseService).ping();
  await app.get(RedisService).ping();
  const queue = app.get(QueueService).infrastructure;
  const job = await queue.add(
    'connection-verification',
    {},
    { removeOnComplete: true, removeOnFail: true },
  );
  expect(await queue.getJob(job.id ?? '')).toBeDefined();
  await job.remove();
  for (const path of ['/health/live', '/health/ready']) {
    const result = await request(app.getHttpServer()).get(path);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'ok' });
  }
  const spec = await request(app.getHttpServer()).get('/api/v1/docs-json');
  expect(Object.keys(spec.body.paths).sort()).toEqual([
    '/health/live',
    '/health/ready',
  ]);
});
