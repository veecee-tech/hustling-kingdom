import { Inject, Injectable } from '@nestjs/common';
import { SignJWT, jwtVerify } from 'jose';
import { AppConfig } from '../config/config.module.js';
import { PublicHttpError } from '../common/error.filter.js';

const issuer = 'hustling-kingdom';
const audience = 'hustling-kingdom-api';

@Injectable()
export class TokenService {
  constructor(@Inject(AppConfig) private readonly config: AppConfig) {}
  private get key(): Uint8Array {
    return new TextEncoder().encode(this.config.values.accessSecret);
  }
  issue(userId: string, familyId: string): Promise<string> {
    return new SignJWT({ sid: familyId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(
        Math.floor(Date.now() / 1000) + this.config.values.accessTtlSeconds,
      )
      .sign(this.key);
  }
  async verify(token: string): Promise<{ userId: string; familyId: string }> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer,
        audience,
        requiredClaims: ['sub', 'sid', 'exp', 'iat'],
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(payload.sub) ||
        !/^[a-f0-9-]{36}$/.test(payload.sid)
      )
        throw new Error();
      return { userId: payload.sub, familyId: payload.sid };
    } catch {
      throw new PublicHttpError(
        401,
        'UNAUTHORIZED',
        'Authentication required.',
      );
    }
  }
}
