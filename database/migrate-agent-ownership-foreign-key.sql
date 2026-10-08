-- Preserve User.AgentId ownership references and prevent deleting an Agent
-- while assigned users still reference its unique ID.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Users" assigned_user
        LEFT JOIN "Users" agent ON agent.unique_id = assigned_user.agent_id
        WHERE assigned_user.agent_id IS NOT NULL
          AND (agent.id IS NULL OR agent.type <> 'agent')
    ) THEN
        RAISE EXCEPTION 'Cannot add agent ownership constraint: Users.agent_id contains orphaned or non-agent references';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_users_agent_id_users_unique_id'
    ) THEN
        ALTER TABLE "Users"
            ADD CONSTRAINT fk_users_agent_id_users_unique_id
            FOREIGN KEY (agent_id) REFERENCES "Users" (unique_id)
            ON DELETE RESTRICT;
    END IF;
END $$;