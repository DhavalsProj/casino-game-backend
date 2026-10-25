ALTER TABLE wallet_request_actions
    ADD COLUMN IF NOT EXISTS balance_before NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS balance_after NUMERIC(15,2);

-- Recover legacy rejection snapshots from the nearest ledger balance when available.
WITH legacy_rejections AS (
    SELECT action.id,
           COALESCE(
               (SELECT t.balance_after
                FROM transactions t
                WHERE t.wallet_id = wr.wallet_id AND t.created_at <= action.created_at
                ORDER BY t.created_at DESC, t.id DESC LIMIT 1),
               (SELECT t.balance_before
                FROM transactions t
                WHERE t.wallet_id = wr.wallet_id AND t.created_at > action.created_at
                ORDER BY t.created_at, t.id LIMIT 1),
               (SELECT w.balance FROM wallets w WHERE w.id = wr.wallet_id)
           ) AS balance_at_rejection
    FROM wallet_request_actions action
    JOIN wallet_requests wr ON wr.id = action.request_id
    WHERE action.action = 'REJECTED'
      AND (action.balance_before IS NULL OR action.balance_after IS NULL)
)
UPDATE wallet_request_actions action
SET balance_before = COALESCE(action.balance_before, legacy.balance_at_rejection),
    balance_after = COALESCE(action.balance_after, legacy.balance_at_rejection)
FROM legacy_rejections legacy
WHERE action.id = legacy.id;
