BEGIN;

DO $$
DECLARE
    column_mapping RECORD;
BEGIN
    FOR column_mapping IN
        SELECT *
        FROM (VALUES
            ('Users', 'Id', 'id'),
            ('Users', 'Name', 'name'),
            ('Users', 'Mobile', 'mobile'),
            ('Users', 'Type', 'type'),
            ('Users', 'AgentId', 'agent_id'),
            ('Users', 'UniqueId', 'unique_id'),
            ('Users', 'Password', 'password'),
            ('Users', 'PasswordHash', 'password_hash'),
            ('Users', 'IsActive', 'is_active'),
            ('Users', 'CreatedAt', 'created_at'),
            ('Users', 'UpdatedAt', 'updated_at'),
            ('SystemCredentials', 'Id', 'id'),
            ('LoginAudit', 'Id', 'id'),
            ('LoginAudit', 'UserId', 'user_id'),
            ('LoginAudit', 'UniqueId', 'unique_id'),
            ('LoginAudit', 'LoginType', 'login_type'),
            ('LoginAudit', 'LoginStatus', 'login_status'),
            ('LoginAudit', 'IpAddress', 'ip_address'),
            ('LoginAudit', 'UserAgent', 'user_agent'),
            ('LoginAudit', 'CreatedAt', 'created_at')
        ) AS mappings(table_name, old_name, new_name)
    LOOP
        IF to_regclass(format('public.%I', column_mapping.table_name)) IS NOT NULL
           AND EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = column_mapping.table_name
                 AND column_name = column_mapping.old_name
           )
           AND NOT EXISTS (
               SELECT 1
               FROM information_schema.columns
               WHERE table_schema = 'public'
                 AND table_name = column_mapping.table_name
                 AND column_name = column_mapping.new_name
           )
        THEN
            EXECUTE format(
                'ALTER TABLE public.%I RENAME COLUMN %I TO %I',
                column_mapping.table_name,
                column_mapping.old_name,
                column_mapping.new_name
            );
        END IF;
    END LOOP;
END
$$;

COMMIT;