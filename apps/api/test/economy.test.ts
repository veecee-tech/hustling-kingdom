import { describe, expect, it } from 'vitest';
import {
  balanceAfter,
  MAX_MONEY,
  parseAmount,
  requireKey,
  STARTING_FUNDS,
} from '../src/economy/economy.rules.js';
describe('integer money rules', () => {
  it('keeps approved starting funds and arbitrary precision', () => {
    expect(STARTING_FUNDS.CASH + STARTING_FUNDS.BANK).toBe(20000n);
    expect(parseAmount('9007199254740993')).toBe(9007199254740993n);
    expect(parseAmount(MAX_MONEY.toString())).toBe(MAX_MONEY);
    expect(balanceAfter(5000n, 5000n, 'DEBIT')).toBe(0n);
  });
  it.each([
    0,
    1,
    1.5,
    null,
    '',
    '0',
    '-1',
    '01',
    ' 1',
    '1 ',
    '1.5',
    '1e3',
    '9223372036854775808',
    '9'.repeat(100),
  ])('rejects invalid amounts %#', (input) =>
    expect(() => parseAmount(input)).toThrow(),
  );
  it('rejects overspend, overflow, zero and negative operations', () => {
    expect(() => balanceAfter(1n, 2n, 'DEBIT')).toThrow();
    expect(() => balanceAfter(MAX_MONEY, 1n, 'CREDIT')).toThrow();
    expect(() => balanceAfter(100n, 0n, 'CREDIT')).toThrow();
    expect(() => balanceAfter(100n, -1n, 'DEBIT')).toThrow();
    expect(() => requireKey('bad')).toThrow();
    expect(requireKey('valid-key-123')).toBe('valid-key-123');
  });
});
