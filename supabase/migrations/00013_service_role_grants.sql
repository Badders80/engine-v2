-- 00013_service_role_grants.sql
-- The operator surface needs table privileges, not just RLS bypass.
--
-- Found 2026-10-23 by saving a horse through `/dsl/new` against the local
-- stack: the save failed with `horses: permission denied for table horses`.
--
-- `service_role` has `rolbypassrls = true`, but bypassing row level security
-- does not grant table privileges. Supabase configures default privileges on
-- schema public for `postgres`, and that set grants service_role only
-- `REFERENCES, TRIGGER, TRUNCATE` — the same shape that made anon reads fail
-- with 42501 in 00009. No earlier migration granted the engine's role the
-- four DML privileges, and every engine test runs against an in-memory store,
-- so nothing executed a real write.
--
-- The engine is the operator surface and the webhook writer. It reads and
-- writes all six tables. This grant is the whole of its permission; RLS still
-- applies to anon and authenticated through their own policies.

grant select, insert, update, delete
  on public.trainers,
     public.owners,
     public.horses,
     public.dsls,
     public.accounts,
     public.sales
  to service_role;
