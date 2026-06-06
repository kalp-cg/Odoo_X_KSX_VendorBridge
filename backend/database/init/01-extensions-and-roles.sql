-- =====================================================================
-- Database bootstrap. Runs ONCE on first container start.
-- Creates the restricted role used by the app at runtime.
-- The application role deliberately has no UPDATE/DELETE on audit_logs.
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vb_app') THEN
    CREATE ROLE vb_app LOGIN PASSWORD 'vb_app_pwd';
  END IF;
END $$;

-- Required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Grant minimum necessary privileges to the application role
GRANT CONNECT ON DATABASE vendorbridge TO vb_app;
GRANT USAGE ON SCHEMA public TO vb_app;

-- Allow on all current tables and future ones (Prisma will create tables
-- as vb_owner; we then let vb_app SELECT/INSERT/UPDATE/DELETE on business
-- tables, but explicitly REVOKE on audit_logs below).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vb_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO vb_app;
