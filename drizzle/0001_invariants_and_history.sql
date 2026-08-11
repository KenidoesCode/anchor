-- Invariants and history that cannot be expressed in Drizzle schema.
-- See DECISIONS ADR-0002 (version invariants) and ADR-0013 (certification history).

-- 1. System-versioned certification history (ADR-0013).
--    Every insert/update is snapshotted; an in-place expiry correction closes the
--    current snapshot and opens a new one, so it never rewrites the past.
--    (Hard deletes are impossible: the history FK to certification blocks them,
--    which is intended — soft delete only. So only INSERT and UPDATE are handled.)
CREATE OR REPLACE FUNCTION certification_history_track() RETURNS trigger AS $$
DECLARE
  ts timestamptz := clock_timestamp();
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    UPDATE certification_history SET sys_to = ts
      WHERE certification_id = NEW.id AND sys_to IS NULL;
  END IF;
  INSERT INTO certification_history (
    certification_id, person_id, certification_type_id, registration_number,
    issue_date, expiry_date, scope_limitations, supersedes_certification_id,
    cert_deleted_at, operation, sys_from, sys_to)
  VALUES (
    NEW.id, NEW.person_id, NEW.certification_type_id, NEW.registration_number,
    NEW.issue_date, NEW.expiry_date, NEW.scope_limitations, NEW.supersedes_certification_id,
    NEW.deleted_at, lower(TG_OP)::history_operation, ts, NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER certification_history_trg
  AFTER INSERT OR UPDATE ON certification
  FOR EACH ROW EXECUTE FUNCTION certification_history_track();
--> statement-breakpoint

-- 2. Non-overlapping requirement-version validity per role (ADR-0002).
--    (Trigger rather than an EXCLUDE/gist constraint: portable to any Postgres
--    and to the in-process test engine, which lacks btree_gist.)
CREATE OR REPLACE FUNCTION rrv_no_overlap() RETURNS trigger AS $$
BEGIN
  IF NEW.deleted_at IS NULL AND EXISTS (
    SELECT 1 FROM role_requirement_version x
    WHERE x.role_id = NEW.role_id
      AND x.id <> NEW.id
      AND x.deleted_at IS NULL
      AND daterange(x.valid_from, x.valid_to, '[]')
          && daterange(NEW.valid_from, NEW.valid_to, '[]')
  ) THEN
    RAISE EXCEPTION 'role % already has a requirement version overlapping [%, %]',
      NEW.role_id, NEW.valid_from, COALESCE(NEW.valid_to::text, 'open');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER rrv_no_overlap_trg
  BEFORE INSERT OR UPDATE ON role_requirement_version
  FOR EACH ROW EXECUTE FUNCTION rrv_no_overlap();
--> statement-breakpoint

-- 3. A requirement version's contents are immutable once any assignment pins it
--    (ADR-0002/0003). Closing the version (setting valid_to on the version row)
--    is still allowed — only editing its groups/items is blocked.
CREATE OR REPLACE FUNCTION requirement_group_immutable() RETURNS trigger AS $$
DECLARE
  v uuid := COALESCE(OLD.requirement_version_id, NEW.requirement_version_id);
BEGIN
  IF EXISTS (SELECT 1 FROM assignment a WHERE a.requirement_version_id = v) THEN
    RAISE EXCEPTION 'requirement version % is pinned by an assignment; its contents are immutable', v;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER requirement_group_immutable_trg
  BEFORE UPDATE OR DELETE ON requirement_group
  FOR EACH ROW EXECUTE FUNCTION requirement_group_immutable();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION requirement_item_immutable() RETURNS trigger AS $$
DECLARE
  v uuid;
BEGIN
  SELECT g.requirement_version_id INTO v
    FROM requirement_group g WHERE g.id = COALESCE(OLD.group_id, NEW.group_id);
  IF v IS NOT NULL AND EXISTS (SELECT 1 FROM assignment a WHERE a.requirement_version_id = v) THEN
    RAISE EXCEPTION 'requirement version % is pinned by an assignment; its items are immutable', v;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER requirement_item_immutable_trg
  BEFORE UPDATE OR DELETE ON requirement_item
  FOR EACH ROW EXECUTE FUNCTION requirement_item_immutable();
