import { createHash } from 'node:crypto';
import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';
import { AppConfig } from '../config/config.module.js';
import { RedisService } from '../redis/redis.module.js';
import { PublicHttpError } from '../common/error.filter.js';
import type { UserRole } from '../generated/prisma/client.js';

export type Principal = Awaited<ReturnType<AuthService['authenticate']>>;
type AuthRequest = Request & { principal?: Principal };

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const header = req.headers.authorization;
    if (!header || !/^Bearer \S+$/.test(header))
      throw new PublicHttpError(
        401,
        'UNAUTHORIZED',
        'Authentication required.',
      );
    req.principal = await this.auth.authenticate(header.slice(7));
    return true;
  }
}
export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Principal =>
    context.switchToHttp().getRequest<AuthRequest>().principal!,
);
export const Roles = (...roles: UserRole[]) => SetMetadata('auth:roles', roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>('auth:roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    const principal = context
      .switchToHttp()
      .getRequest<AuthRequest>().principal;
    if (!principal || !roles?.includes(principal.user.role))
      throw new PublicHttpError(403, 'FORBIDDEN', 'Request forbidden.');
    return true;
  }
}

@Injectable()
export class AuthCsrfGuard implements CanActivate {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (
      req.headers.origin !== this.config.values.webOrigin ||
      req.headers['x-hk-client'] !== 'web'
    )
      throw new PublicHttpError(
        403,
        'FORBIDDEN',
        'Request origin is not allowed.',
      );
    return true;
  }
}

@Injectable()
export class AuthRateGuard implements CanActivate {
  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(AppConfig) private readonly config: AppConfig,
  ) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    // Express does not trust forwarded IP headers. Deployment must preserve a
    // deliberate proxy trust boundary before enabling trusted-proxy support.
    const ip = createHash('sha256')
      .update(req.ip ?? req.socket.remoteAddress ?? 'unknown')
      .digest('hex');
    const key = `auth:rate:${context.getHandler().name}:${ip}`;
    let count: number;
    try {
      count = Number(
        await this.redis.client.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          key,
          this.config.values.authRateWindowSeconds,
        ),
      );
    } catch {
      throw new PublicHttpError(
        503,
        'SERVICE_UNAVAILABLE',
        'Service unavailable.',
      );
    }
    if (count > this.config.values.authRateLimit)
      throw new PublicHttpError(
        429,
        'RATE_LIMITED',
        'Too many attempts. Please try again later.',
      );
    return true;
  }
}
