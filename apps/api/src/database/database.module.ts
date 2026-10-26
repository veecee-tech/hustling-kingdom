import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { AppConfig } from '../config/config.module.js';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient;
  constructor(@Inject(AppConfig) config: AppConfig) {
    this.client = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: config.values.databaseUrl,
        connectionTimeoutMillis: 2000,
        query_timeout: 2000,
        max: 10,
      }),
    });
  }
  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    await this.ping();
  }
  async ping(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }
  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}

@Global()
@Module({ providers: [DatabaseService], exports: [DatabaseService] })
export class DatabaseModule {}
