export function formatMoney(value: string): string {
  if (!/^-?\d+$/.test(value)) return 'HK₦—';
  return `HK₦${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(BigInt(value))}`;
}
export const entryLabels = {
  STARTING_CASH: 'Your starting cash',
  STARTING_BANK: 'Your starting bank balance',
  CASH_DEPOSIT: 'Cash moved to bank',
  CASH_WITHDRAWAL: 'Bank moved to cash',
  SYSTEM_CREDIT: 'Game credit',
  JOB_SALARY: 'Job salary',
  SYSTEM_DEBIT: 'Game expense',
} as const;
