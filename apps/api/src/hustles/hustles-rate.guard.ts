import {
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Principal } from '../auth/auth.guards.js';
import { RedisService } from '../redis/redis.module.js';
import { PublicHttpError } from '../common/error.filter.js';
@Injectable()
export class HustlesRateGuard implements CanActivate {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { principal: Principal }>();
    let count: number;
    try {
      count = Number(
        await this.redis.client.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
          1,
          `hustles:rate:${req.principal.user.id}`,
        ),
      );
    } catch {
      throw new PublicHttpError(
        503,
        'SERVICE_UNAVAILABLE',
        'Underground opportunities are temporarily unavailable.',
      );
    }
    if (count > 60)
      throw new PublicHttpError(
        429,
        'RATE_LIMITED',
        'Too many attempts. Please wait a moment.',
      );
    return true;
  }
}
