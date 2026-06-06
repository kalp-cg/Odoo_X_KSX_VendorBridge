/**
 * Bootstrap the local Postgres database for VendorBridge.
 *  1. Connect to the default `postgres` database as superuser
 *  2. CREATE DATABASE vendorbridge (idempotent)
 *  3. Connect to `vendorbridge` and install extensions (citext, pgcrypto)
 *  4. Create the restricted vb_app role + grants
 */
import { Client } from 'pg';

const SUPERUSER_URL =
  process.env.SUPERUSER_URL ||
  'postgresql://postgres:Kalpan%402007@localhost:5432/postgres';

const DB_NAME = 'vendorbridge';
const APP_USER = 'vb_app';
const APP_PASSWORD = 'vb_app_pwd';

async function ensureDatabase(): Promise<void> {
  const c = new Client({ connectionString: SUPERUSER_URL });
  await c.connect();
  const exists = await c.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS exists',
    [DB_NAME],
  );
  if (exists.rows[0].exists) {
    console.log(`  • Database "${DB_NAME}" already exists`);
  } else {
    // CREATE DATABASE cannot run inside a transaction; pg client default is auto-commit.
    await c.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`  • Created database "${DB_NAME}"`);
  }
  await c.end();
}

function buildAppUrl(): string {
  const u = new URL(SUPERUSER_URL);
  u.pathname = `/${DB_NAME}`;
  return u.toString();
}

async function installExtensions(): Promise<void> {
  const c = new Client({ connectionString: buildAppUrl() });
  await c.connect();
  await c.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  await c.query('CREATE EXTENSION IF NOT EXISTS "citext"');
  console.log('  • Extensions installed: pgcrypto, citext');
  await c.end();
}

async function ensureAppRole(): Promise<void> {
  const c = new Client({ connectionString: buildAppUrl() });
  await c.connect();
  const exists = await c.query<{ exists: boolean }>(
    'SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists',
    [APP_USER],
  );
  if (!exists.rows[0].exists) {
    await c.query(`CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}'`);
    console.log(`  • Created role "${APP_USER}"`);
  } else {
    await c.query(`ALTER ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD}'`);
    console.log(`  • Role "${APP_USER}" already exists (password refreshed)`);
  }
  await c.query(`GRANT CONNECT ON DATABASE "${DB_NAME}" TO ${APP_USER}`);
  await c.query(`GRANT USAGE ON SCHEMA public TO ${APP_USER}`);
  await c.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER}`,
  );
  await c.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER}`,
  );
  console.log(`  • Granted default privileges to "${APP_USER}"`);
  await c.end();
}

async function main(): Promise<void> {
  console.log('Bootstrapping VendorBridge database...');
  await ensureDatabase();
  await installExtensions();
  await ensureAppRole();
  console.log('Done.');
  console.log('');
  console.log('Next steps:');
  console.log('  1. pnpm prisma:format');
  console.log('  2. pnpm exec prisma db push   (or: pnpm prisma:migrate:dev)');
  console.log('  3. pnpm exec prisma db execute --file prisma/migrations/audit_immutability/migration.sql --schema prisma/schema.prisma');
  console.log('  4. pnpm prisma:seed');
  console.log('  5. pnpm verify:audit');
  console.log('  6. pnpm start:dev');
}

main().catch((e) => {
  console.error('Bootstrap failed:', e.message);
  process.exit(1);
});
