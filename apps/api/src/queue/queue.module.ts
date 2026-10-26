import {
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import { AppConfig } from '../config/config.module.js';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  readonly infrastructure: Queue;
  constructor(@Inject(AppConfig) config: AppConfig) {
    const url = new URL(config.values.redisUrl);
    this.infrastructure = new Queue('infrastructure', {
      connection: {
        host: url.hostname,
        port: Number(url.port || 6379),
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
        db: Number(url.pathname.slice(1) || 0),
        tls: url.protocol === 'rediss:' ? {} : undefined,
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
      },
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 100 },
    });
    this.infrastructure.on('error', () => {});
  }
  async onModuleInit(): Promise<void> {
    await this.infrastructure.waitUntilReady();
  }
  async onModuleDestroy(): Promise<void> {
    await this.infrastructure.close();
  }
}

@Module({ providers: [QueueService], exports: [QueueService] })
export class QueueModule {}
