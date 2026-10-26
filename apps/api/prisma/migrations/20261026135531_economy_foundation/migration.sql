BEGIN;
-- CreateEnum
CREATE TYPE "WalletAccount" AS ENUM ('CASH', 'BANK');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('STARTING_CASH', 'STARTING_BANK', 'CASH_DEPOSIT', 'CASH_WITHDRAWAL', 'SYSTEM_CREDIT', 'SYSTEM_DEBIT');

-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('COMPLETED');

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "cash_balance" BIGINT NOT NULL DEFAULT 0,
    "bank_balance" BIGINT NOT NULL DEFAULT 0,
    "version" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "character_id" UUID NOT NULL,
    "account" "WalletAccount" NOT NULL,
    "transaction_type" "WalletTransactionType" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balance_before" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "sequence" BIGINT NOT NULL DEFAULT 0,
    "reference_type" VARCHAR(64),
    "reference_id" UUID,
    "idempotency_key" VARCHAR(128),
    "correlation_id" VARCHAR(80),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "operation" VARCHAR(80) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'COMPLETED',
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "resource_type" VARCHAR(64),
    "resource_id" UUID,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_character_id_key" ON "wallets"("character_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_id_character_id_key" ON "wallets"("id", "character_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_wallet_id_account_sequence_idx" ON "wallet_transactions"("wallet_id", "account", "sequence" DESC);

-- CreateIndex
CREATE INDEX "wallet_transactions_character_id_created_at_idx" ON "wallet_transactions"("character_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_wallet_id_sequence_key" ON "wallet_transactions"("wallet_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_user_id_operation_key_key" ON "idempotency_records"("user_id", "operation", "key");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_character_id_fkey" FOREIGN KEY ("wallet_id", "character_id") REFERENCES "wallets"("id", "character_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PostgreSQL is the final accounting boundary. Application roles must not own
-- these tables/functions or have ALTER/TRUNCATE privileges in production.
ALTER TABLE wallets ADD CONSTRAINT wallet_nonnegative CHECK (cash_balance >= 0 AND bank_balance >= 0 AND version >= 0);
ALTER TABLE wallet_transactions ADD CONSTRAINT ledger_values CHECK (
 amount > 0 AND balance_before >= 0 AND balance_after >= 0 AND sequence > 0
 AND balance_after::numeric = balance_before::numeric + CASE direction WHEN 'CREDIT' THEN amount::numeric ELSE -amount::numeric END
);
CREATE UNIQUE INDEX starting_funding_once ON wallet_transactions(wallet_id, transaction_type)
 WHERE transaction_type IN ('STARTING_CASH', 'STARTING_BANK');
CREATE FUNCTION reject_economic_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Economic history is immutable' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER immutable_ledger BEFORE UPDATE OR DELETE ON wallet_transactions
 FOR EACH ROW EXECUTE FUNCTION reject_economic_history_change();
CREATE TRIGGER immutable_ledger_truncate BEFORE TRUNCATE ON wallet_transactions
 FOR EACH STATEMENT EXECUTE FUNCTION reject_economic_history_change();
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON idempotency_records
 FOR EACH ROW EXECUTE FUNCTION reject_economic_history_change();

CREATE FUNCTION wallet_must_start_empty() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.cash_balance <> 0 OR NEW.bank_balance <> 0 OR NEW.version <> 0 THEN
  RAISE EXCEPTION 'Wallet must start empty' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER wallet_empty_insert BEFORE INSERT ON wallets FOR EACH ROW EXECUTE FUNCTION wallet_must_start_empty();

CREATE FUNCTION apply_wallet_ledger_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE w wallets%ROWTYPE; expected bigint; last_version bigint;
BEGIN
 SELECT * INTO STRICT w FROM wallets WHERE id = NEW.wallet_id FOR UPDATE;
 IF w.character_id <> NEW.character_id THEN RAISE EXCEPTION 'Ledger ownership mismatch' USING ERRCODE='23514'; END IF;
 SELECT COALESCE(MAX(sequence),0) INTO last_version FROM wallet_transactions WHERE wallet_id=w.id;
 SELECT balance_after INTO expected FROM wallet_transactions WHERE wallet_id=w.id AND account=NEW.account ORDER BY sequence DESC LIMIT 1;
 expected := COALESCE(expected,0);
 IF w.version <> last_version OR expected <> (CASE NEW.account WHEN 'CASH' THEN w.cash_balance ELSE w.bank_balance END) OR NEW.balance_before <> expected THEN
  RAISE EXCEPTION 'Ledger chain mismatch' USING ERRCODE='23514';
 END IF;
 IF NEW.transaction_type='STARTING_CASH' AND (NEW.account<>'CASH' OR NEW.direction<>'CREDIT' OR NEW.amount<>15000 OR expected<>0) THEN RAISE EXCEPTION 'Invalid starting cash' USING ERRCODE='23514'; END IF;
 IF NEW.transaction_type='STARTING_BANK' AND (NEW.account<>'BANK' OR NEW.direction<>'CREDIT' OR NEW.amount<>5000 OR expected<>0) THEN RAISE EXCEPTION 'Invalid starting bank' USING ERRCODE='23514'; END IF;
 IF NEW.transaction_type='SYSTEM_CREDIT' AND NEW.direction<>'CREDIT' OR NEW.transaction_type='SYSTEM_DEBIT' AND NEW.direction<>'DEBIT' THEN RAISE EXCEPTION 'Invalid direction' USING ERRCODE='23514'; END IF;
 NEW.sequence := w.version+1;
 IF NEW.balance_after::numeric <> NEW.balance_before::numeric + (CASE NEW.direction WHEN 'CREDIT' THEN NEW.amount::numeric ELSE -NEW.amount::numeric END) THEN RAISE EXCEPTION 'Invalid ledger arithmetic' USING ERRCODE='23514'; END IF;
 UPDATE wallets SET cash_balance = CASE NEW.account WHEN 'CASH' THEN NEW.balance_after ELSE cash_balance END,
 bank_balance = CASE NEW.account WHEN 'BANK' THEN NEW.balance_after ELSE bank_balance END,
 version=NEW.sequence, updated_at=clock_timestamp() WHERE id=w.id;
 RETURN NEW;
END;
$$;
CREATE TRIGGER apply_ledger BEFORE INSERT ON wallet_transactions FOR EACH ROW EXECUTE FUNCTION apply_wallet_ledger_entry();

CREATE FUNCTION verify_wallet_accounting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE w wallets%ROWTYPE; cash bigint; bank bigint; v bigint;
BEGIN
 SELECT * INTO w FROM wallets WHERE id=NEW.id;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT balance_after INTO cash FROM wallet_transactions WHERE wallet_id=w.id AND account='CASH' ORDER BY sequence DESC LIMIT 1;
 SELECT balance_after INTO bank FROM wallet_transactions WHERE wallet_id=w.id AND account='BANK' ORDER BY sequence DESC LIMIT 1;
 SELECT COALESCE(MAX(sequence),0) INTO v FROM wallet_transactions WHERE wallet_id=w.id;
 IF w.cash_balance <> COALESCE(cash,0) OR w.bank_balance <> COALESCE(bank,0) OR w.version<>v
 OR (SELECT count(*) FROM wallet_transactions WHERE wallet_id=w.id AND transaction_type IN ('STARTING_CASH','STARTING_BANK'))<>2 THEN
  RAISE EXCEPTION 'Wallet must reconcile and be funded exactly once' USING ERRCODE='23514';
 END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER wallet_accounting AFTER INSERT OR UPDATE ON wallets
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_wallet_accounting();

CREATE FUNCTION verify_transfer_pair() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n bigint; accounts bigint; net numeric;
BEGIN
 IF NEW.transaction_type NOT IN ('CASH_DEPOSIT','CASH_WITHDRAWAL') THEN RETURN NULL; END IF;
 IF NEW.idempotency_key IS NULL OR NEW.correlation_id IS NULL THEN RAISE EXCEPTION 'Transfer requires correlation' USING ERRCODE='23514'; END IF;
 IF (NEW.transaction_type='CASH_DEPOSIT' AND NEW.direction='DEBIT' AND NEW.account<>'CASH')
 OR (NEW.transaction_type='CASH_DEPOSIT' AND NEW.direction='CREDIT' AND NEW.account<>'BANK')
 OR (NEW.transaction_type='CASH_WITHDRAWAL' AND NEW.direction='DEBIT' AND NEW.account<>'BANK')
 OR (NEW.transaction_type='CASH_WITHDRAWAL' AND NEW.direction='CREDIT' AND NEW.account<>'CASH') THEN RAISE EXCEPTION 'Invalid transfer account' USING ERRCODE='23514'; END IF;
 SELECT count(*),count(DISTINCT account),sum(CASE direction WHEN 'CREDIT' THEN amount::numeric ELSE -amount::numeric END)
 INTO n,accounts,net FROM wallet_transactions WHERE wallet_id=NEW.wallet_id AND transaction_type=NEW.transaction_type AND idempotency_key=NEW.idempotency_key AND correlation_id=NEW.correlation_id;
 IF n<>2 OR accounts<>2 OR net<>0 THEN RAISE EXCEPTION 'Transfer requires two balanced sides' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER transfer_pair AFTER INSERT ON wallet_transactions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_transfer_pair();

COMMIT;
