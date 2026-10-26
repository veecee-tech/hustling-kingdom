import 'reflect-metadata';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  Body,
  Controller,
  Get,
  Module,
  Post,
  type INestApplication,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import request from 'supertest';
import { AppConfig } from '../src/config/config.module.js';
import { DatabaseService } from '../src/database/database.module.js';
import { RedisService } from '../src/redis/redis.module.js';
import { HealthController } from '../src/health/health.module.js';
import { setupApplication } from '../src/setup.js';

class Input {
  @IsString() label!: string;
}
@Controller('test-only')
class ProbeController {
  @Post() echo(@Body() body: Input) {
    return { label: body.label };
  }
  @Get('failure') failure() {
    throw new Error('postgresql://secret:password@internal/private/file');
  }
}
// esbuild does not emit design metadata; production TypeScript does.
Reflect.defineMetadata(
  'design:paramtypes',
  [Input],
  ProbeController.prototype,
  'echo',
);
@Module({
  controllers: [HealthController, ProbeController],
  providers: [
    {
      provide: AppConfig,
      useValue: { values: { webOrigin: 'http://localhost:5173' } },
    },
    { provide: DatabaseService, useValue: { ping: vi.fn() } },
    { provide: RedisService, useValue: { ping: vi.fn() } },
  ],
})
class TestModule {}

let app: INestApplication;
async function boot() {
  const module = await Test.createTestingModule({
    imports: [TestModule],
  }).compile();
  app = module.createNestApplication();
  setupApplication(app);
  await app.init();
  return app;
}
afterEach(async () => {
  if (app) await app.close();
  vi.restoreAllMocks();
});

describe('HTTP application foundation (dependencies mocked)', () => {
  it('boots, serves liveness, and replaces untrusted request IDs', async () => {
    await boot();
    const first = await request(app.getHttpServer())
      .get('/health/live')
      .set('x-request-id', 'attacker');
    const second = await request(app.getHttpServer()).get('/health/live');
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ status: 'ok' });
    expect(first.headers['x-request-id']).toMatch(/^req_[a-f0-9-]+$/);
    expect(first.headers['x-request-id']).not.toBe(
      second.headers['x-request-id'],
    );
  });
  it('returns 503 for either unavailable dependency without leaking errors', async () => {
    await boot();
    for (const dependency of [DatabaseService, RedisService]) {
      vi.spyOn(app.get(dependency), 'ping').mockRejectedValueOnce(
        new Error('private password'),
      );
      const result = await request(app.getHttpServer()).get('/health/ready');
      expect(result.status).toBe(503);
      expect(result.body.error.code).toBe('SERVICE_UNAVAILABLE');
      expect(JSON.stringify(result.body)).not.toContain('password');
    }
    expect(
      (await request(app.getHttpServer()).get('/health/ready')).status,
    ).toBe(200);
  });
  it('prefixes API routes, validates input and rejects mass assignment', async () => {
    await boot();
    expect(
      (
        await request(app.getHttpServer())
          .post('/test-only')
          .send({ label: 'safe' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app.getHttpServer())
          .post('/api/v1/test-only')
          .send({ label: 'safe' })
      ).status,
    ).toBe(201);
    for (const body of [{ label: 'safe', admin: true }, { label: 5 }]) {
      const result = await request(app.getHttpServer())
        .post('/api/v1/test-only')
        .send(body);
      expect(result.status).toBe(400);
      expect(result.body.error.code).toBe('VALIDATION_ERROR');
    }
  });
  it('sanitizes internal errors, advertises only allowed CORS and documents actual health endpoints', async () => {
    await boot();
    const result = await request(app.getHttpServer())
      .get('/api/v1/test-only/failure')
      .set('Origin', 'https://untrusted.example');
    expect(result.status).toBe(500);
    expect(result.body.error.message).toBe('An unexpected error occurred.');
    expect(result.body.error.requestId).toBe(result.headers['x-request-id']);
    expect(result.headers['access-control-allow-origin']).not.toBe(
      'https://untrusted.example',
    );
    expect(result.headers['x-content-type-options']).toBe('nosniff');
    const spec = await request(app.getHttpServer()).get('/api/v1/docs-json');
    expect(spec.status).toBe(200);
    expect(spec.body.paths['/health/live']).toBeDefined();
  });
});
