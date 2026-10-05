require('dotenv').config();

const bcrypt = require('bcrypt');
const { Pool } = require('pg');

async function seedSuperadmin() {
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password || password === 'replace-with-a-strong-password') {
    throw new Error('Set a strong SUPERADMIN_PASSWORD in .env before seeding.');
  }

  if (process.env.DB_ENABLED !== 'true') {
    throw new Error('Set DB_ENABLED=true in .env before seeding.');
  }

  const credentialName = process.env.SUPERADMIN_IDENTIFIER ?? 'superadmin';
  const mobile = process.env.SUPERADMIN_MOBILE ?? '9000000000';
  const passwordHash = await bcrypt.hash(password, 12);
  const pool = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'CasinoGameDB',
  });

  try {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        `INSERT INTO "Users"
           (name, mobile, type, agent_id, unique_id, password, password_hash, is_active)
         VALUES ('Super Admin', $1, 'superadmin', NULL, $2, NULL, $3, TRUE)
         ON CONFLICT (mobile) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             agent_id = NULL,
             unique_id = EXCLUDED.unique_id,
             password = NULL,
             password_hash = EXCLUDED.password_hash,
             is_active = TRUE,
             updated_at = CURRENT_TIMESTAMP
         WHERE "Users".type = 'superadmin'`,
        [mobile, credentialName, passwordHash],
      );

      if (userResult.rowCount !== 1) {
        throw new Error(
          `Mobile "${mobile}" already belongs to a non-superadmin user.`,
        );
      }

      await client.query(
        `INSERT INTO "SystemCredentials" ("CredentialName", "PasswordHash", "IsActive")
         VALUES ($1, $2, TRUE)
         ON CONFLICT ("CredentialName") DO UPDATE
         SET "PasswordHash" = EXCLUDED."PasswordHash",
             "IsActive" = TRUE,
             "UpdatedAt" = CURRENT_TIMESTAMP`,
        [credentialName, passwordHash],
      );

      await client.query('COMMIT');
      console.log(
        `Superadmin user "${mobile}" and credential "${credentialName}" created or updated.`,
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

seedSuperadmin().catch((error) => {
  console.error('Failed to seed superadmin credential:', error.message);
  process.exitCode = 1;
});
