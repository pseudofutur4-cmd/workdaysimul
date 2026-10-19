CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON AuditEvent BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON AuditEvent BEGIN SELECT RAISE(ABORT, 'Audit events are immutable'); END;
