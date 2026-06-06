-- =====================================================================
-- Audit log immutability — three independent layers of defence.
--  1. Application: AuditService only exposes `log()` and `query()`.
--  2. PostgreSQL trigger: rejects any UPDATE/DELETE/TRUNCATE.
--  3. PostgreSQL role: vb_app has no UPDATE/DELETE on audit_logs.
-- =====================================================================

-- 2. Trigger function: raises on any modification attempt.
CREATE OR REPLACE FUNCTION audit_logs_no_modify()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs is immutable. % on row id=% is not permitted. '
    'Audit records are compliance evidence and cannot be modified or removed.',
    TG_OP, COALESCE(OLD.id::text, NEW.id::text)
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
BEFORE UPDATE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
BEFORE DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_no_modify();

DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_no_modify();

-- 3. Lock down privileges on audit_logs for the runtime application role.
-- Owner (vb_owner, used for migrations/seeding) keeps full access; the
-- runtime role (vb_app) only has INSERT and SELECT.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vb_app') THEN
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM vb_app;
    GRANT  INSERT, SELECT          ON audit_logs TO   vb_app;
    GRANT  USAGE, SELECT           ON SEQUENCE audit_logs_id_seq TO vb_app;
  END IF;
END $$;
