-- Row-level security: the SECOND layer (PRD §10.1). Server-side RBAC is the
-- primary control; these policies ensure a query cannot return rows outside the
-- caller's scope even if application logic is bypassed.
--
-- Policies are PERMISSIVE-BY-DEFAULT when the session GUCs are unset (so a
-- connection that has not called withActor() is not silently blanked), and
-- RESTRICT only when a scoped role is present. The app sets app.actor_id /
-- app.user_role per request via withActor() (src/server/rls.ts). RLS is not
-- FORCEd, so the table owner/superuser bypasses it — production connects as a
-- non-owner application role for the policies to take effect.
--
-- Scope enforced here: a deployed_officer or client_user may read only their own
-- person/certification rows. Internal staff roles are unrestricted. Broader
-- per-module scoping (auditors → assigned audits, client tenant isolation) is
-- added with the modules that introduce those tables.

ALTER TABLE "person" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "person_scope_select" ON "person" FOR SELECT USING (
  (
    current_setting('app.user_role', true) IS DISTINCT FROM 'deployed_officer'
    AND current_setting('app.user_role', true) IS DISTINCT FROM 'client_user'
  )
  OR "id"::text = current_setting('app.actor_id', true)
);
--> statement-breakpoint
ALTER TABLE "certification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "certification_scope_select" ON "certification" FOR SELECT USING (
  (
    current_setting('app.user_role', true) IS DISTINCT FROM 'deployed_officer'
    AND current_setting('app.user_role', true) IS DISTINCT FROM 'client_user'
  )
  OR "person_id"::text = current_setting('app.actor_id', true)
);
