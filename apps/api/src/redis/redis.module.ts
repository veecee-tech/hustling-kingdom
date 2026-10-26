import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { AppConfig } from '../config/config.module.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  constructor(@Inject(AppConfig) config: AppConfig) {
    this.client = new Redis(config.values.redisUrl, {
      lazyConnect: true,
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    // Connection failures are surfaced by readiness/startup without logging connection URLs.
    this.client.on('error', () => {});
  }
  async onModuleInit(): Promise<void> {
    await this.client.connect();
    await this.ping();
  }
  async ping(): Promise<void> {
    await this.client.ping();
  }
  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
