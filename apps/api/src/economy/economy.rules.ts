import { PublicHttpError } from '../common/error.filter.js';
export const STARTING_FUNDS = { CASH: 15000n, BANK: 5000n } as const;
export const MAX_MONEY = 9223372036854775807n;
export function parseAmount(input: unknown): bigint {
  if (
    typeof input !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(input) ||
    BigInt(input) > MAX_MONEY
  )
    throw new PublicHttpError(
      400,
      'INVALID_AMOUNT',
      'Enter a positive whole amount within the supported range.',
    );
  return BigInt(input);
}
export function requireKey(key: string | undefined): string {
  if (!key || !/^[A-Za-z0-9_-]{8,128}$/.test(key))
    throw new PublicHttpError(
      400,
      'VALIDATION_ERROR',
      'A valid Idempotency-Key is required.',
    );
  return key;
}
export function balanceAfter(
  before: bigint,
  amount: bigint,
  direction: 'CREDIT' | 'DEBIT',
): bigint {
  if (amount <= 0n || amount > MAX_MONEY)
    throw new PublicHttpError(400, 'INVALID_AMOUNT', 'Invalid amount.');
  const after = direction === 'CREDIT' ? before + amount : before - amount;
  if (after < 0n)
    throw new PublicHttpError(
      409,
      'INSUFFICIENT_FUNDS',
      'You do not have enough game money for this move.',
    );
  if (after > MAX_MONEY)
    throw new PublicHttpError(
      409,
      'TRANSACTION_CONFLICT',
      'The account limit would be exceeded.',
    );
  return after;
}
