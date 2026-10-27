import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
@Injectable()
export class RandomService {
  // Uniform rejection sampling over Node's cryptographically secure random bytes.
  below(upper: bigint): bigint {
    if (upper < 1n || upper > 9223372036854775808n)
      throw new RangeError('Invalid random range.');
    if (upper === 1n) return 0n;
    const bits = (upper - 1n).toString(2).length;
    const bytes = Math.ceil(bits / 8),
      mask = (1n << BigInt(bits)) - 1n;
    for (;;) {
      const value = BigInt(`0x${randomBytes(bytes).toString('hex')}`) & mask;
      if (value < upper) return value;
    }
  }
}
