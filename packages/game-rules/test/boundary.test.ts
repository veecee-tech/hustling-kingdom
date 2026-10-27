import { expect, it } from 'vitest';
import { calculateJobPay } from '../src/index.js';
it('loads deterministic work rules without application infrastructure', () => {
  expect(calculateJobPay(8000n)).toBe(8000n);
});
