-- Adds a temporary winnings balance and separates ledger snapshots by bucket.
-- Safe to run more than once.

ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS temporary_winning_balance numeric(15,2) NOT NULL DEFAULT 0
  CHECK (temporary_winning_balance >= 0);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS balance_bucket varchar(30) NOT NULL DEFAULT 'MAIN'
  CHECK (balance_bucket IN ('MAIN', 'TEMPORARY_WINNING'));
