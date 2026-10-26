import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';
import { randomBytes } from 'node:crypto';

@Injectable()
export class PasswordService {
  private readonly dummyHash = this.hash(randomBytes(32).toString('base64url'));
  hash(password: string): Promise<string> {
    return hash(password, {
      type: argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }
  async matches(password: string, stored?: string): Promise<boolean> {
    // Unknown identities still pay the same password-verification cost.
    const valid = await verify(stored ?? (await this.dummyHash), password);
    return stored !== undefined && valid;
  }
}
