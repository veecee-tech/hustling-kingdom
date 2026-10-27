import { expect, it } from 'vitest';
import { RandomService } from '../src/hustles/random.service.js';
it('uses bounded secure integer draws without floating-point money', () => {
  const random = new RandomService();
  expect(random.below(1n)).toBe(0n);
  for (const upper of [2n, 10000n, 100000001n, 9223372036854775808n])
    for (let n = 0; n < 20; n++) {
      const value = random.below(upper);
      expect(value >= 0n && value < upper).toBe(true);
    }
  expect(() => random.below(0n)).toThrow();
  expect(() => random.below(9223372036854775809n)).toThrow();
});
