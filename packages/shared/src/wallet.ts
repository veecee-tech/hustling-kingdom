export interface WalletSummary {
  cash: string;
  bank: string;
  total: string;
  version: string;
}
export type WalletAccount = 'CASH' | 'BANK';
export type WalletTransactionType =
  | 'STARTING_CASH'
  | 'STARTING_BANK'
  | 'CASH_DEPOSIT'
  | 'CASH_WITHDRAWAL'
  | 'SYSTEM_CREDIT'
  | 'SYSTEM_DEBIT';
export interface WalletEntry {
  id: string;
  account: WalletAccount;
  transactionType: WalletTransactionType;
  direction: 'CREDIT' | 'DEBIT';
  amount: string;
  balanceAfter: string;
  createdAt: string;
}
export interface WalletHistory {
  items: WalletEntry[];
  nextCursor: string | null;
}
