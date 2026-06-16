-- audit_logs is append-only (docs/12, docs/17 §5): block UPDATE and DELETE at the
-- database level so corrections must be posted as new rows, not edits. The same
-- guard protects stock_ledger once that table exists (Stage 3).

CREATE OR REPLACE FUNCTION pmtis_block_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION pmtis_block_mutation();
