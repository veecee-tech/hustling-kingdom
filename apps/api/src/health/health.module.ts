import { Controller, Get, Inject, Module } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DatabaseService } from '../database/database.module.js';
import { RedisService } from '../redis/redis.module.js';
import { PublicHttpError } from '../common/error.filter.js';
import {
  ErrorEnvelopeDto,
  requestIdResponseHeaders,
} from '../common/error.dto.js';

export class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';
}

@ApiTags('Operations')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}
  @Get('live')
  @ApiOkResponse({
    type: HealthDto,
    description: 'Process is alive.',
    headers: requestIdResponseHeaders,
  })
  live(): HealthDto {
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOkResponse({
    type: HealthDto,
    description: 'PostgreSQL and Redis are reachable.',
    headers: requestIdResponseHeaders,
  })
  @ApiResponse({
    status: 503,
    type: ErrorEnvelopeDto,
    headers: requestIdResponseHeaders,
    description:
      'A required dependency is unavailable; standard error envelope.',
  })
  async ready(): Promise<HealthDto> {
    const checks = await Promise.allSettled([
      this.database.ping(),
      this.redis.ping(),
    ]);
    if (checks.some((check) => check.status === 'rejected'))
      throw new PublicHttpError(
        503,
        'SERVICE_UNAVAILABLE',
        'Service unavailable.',
      );
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
