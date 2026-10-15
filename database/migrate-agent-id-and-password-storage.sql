-- Move Users.agent_id from the Agent's custom UniqueId to its database ID.
-- Existing ownership is translated through the Agent row before the old column is replaced.
DO $$
DECLARE
  agent_id_type TEXT;
  orphan_count INTEGER;
BEGIN
  SELECT data_type INTO agent_id_type
  FROM information_schema.columns
  WHERE table_name = 'Users' AND column_name = 'agent_id';

  IF agent_id_type IS DISTINCT FROM 'integer' THEN
    ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS agent_id_new INTEGER;

    UPDATE "Users" assigned
    SET agent_id_new = agent.id
    FROM "Users" agent
    WHERE assigned.agent_id = agent.unique_id
      AND agent.type = 'agent';

    SELECT COUNT(*) INTO orphan_count
    FROM "Users"
    WHERE agent_id IS NOT NULL AND agent_id_new IS NULL;

    IF orphan_count > 0 THEN
      RAISE EXCEPTION 'Cannot migrate agent_id: % existing ownership values do not reference an Agent', orphan_count;
    END IF;

    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS fk_users_agent_id_users_unique_id;
    ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS fk_users_agent_id_users_id;
    DROP INDEX IF EXISTS ix_users_agent_id;
    ALTER TABLE "Users" DROP COLUMN agent_id;
    ALTER TABLE "Users" RENAME COLUMN agent_id_new TO agent_id;
  END IF;

  ALTER TABLE "Users" DROP CONSTRAINT IF EXISTS fk_users_agent_id_users_unique_id;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_agent_id_users_id') THEN
    ALTER TABLE "Users"
      ADD CONSTRAINT fk_users_agent_id_users_id
      FOREIGN KEY (agent_id) REFERENCES "Users" (id) ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS ix_users_agent_id ON "Users" (agent_id);
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index index_info
    WHERE index_info.indrelid = '"Users"'::regclass
      AND index_info.indisunique
      AND index_info.indnatts = 1
      AND index_info.indkey[0] = (
        SELECT attribute.attnum
        FROM pg_attribute attribute
        WHERE attribute.attrelid = '"Users"'::regclass
          AND attribute.attname = 'unique_id'
      )
  ) THEN
    CREATE UNIQUE INDEX ux_users_unique_id ON "Users" (unique_id);
  END IF;
  -- The current entity stores bcrypt hashes instead of plaintext passwords.
  -- Keep this nullable for existing rows; only newly created/reset accounts
  -- can be populated because the old plaintext values are intentionally removed.
  ALTER TABLE "Users" ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
  ALTER TABLE "Users" DROP COLUMN IF EXISTS password;
END $$;
