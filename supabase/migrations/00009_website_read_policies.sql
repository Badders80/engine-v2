-- 00009_website_read_policies.sql
-- PLAN.md step 6b-i. Every table is deny-by-default, so before this file an anon
-- read returns [] and raises no error — an empty site and a broken one are
-- indistinguishable from the client. These six policies are the whole of what
-- the website is allowed to read.
--
-- Four predicate shapes across six tables, per PLAN.md:277-280:
--
--   trainers, owners, horses   for select using (true)
--   dsls                       for select using (published = true)
--   accounts                   for select using (auth.uid() = id)
--   sales                      for select using (auth.uid() = user_id)
--
-- No `to` clause anywhere: the ruling writes the shapes without one, and an
-- unnamed policy already defaults to `to public`, which covers anon and
-- authenticated. service_role bypasses row level security outright, so the
-- distinction is moot in practice.
--
-- horses_read_public grants every column of every horse, registered or not, to
-- anon. That is deliberate and it is safe for exactly one reason: the website
-- never queries horses directly. `published` lives only on dsls, so the site
-- reads dsls and joins outward; a direct from('horses') would leak unpublished
-- and unregistered rows. scripts/assert-read-policies.sh fails the build if
-- that stops being true.
--
-- THE GRANTS ARE NOT OPTIONAL, and this was found the hard way. Supabase
-- configures default privileges on schema public twice: once for
-- `supabase_admin` and once for `postgres`. The `postgres` set grants anon and
-- authenticated only `Dxtm` — truncate, references, trigger, maintain. It does
-- NOT grant `r`. Every table in this series was created by `postgres`, so an anon
-- read fails with 42501 "permission denied for table dsls" before a policy is
-- ever consulted. A policy with no grant is inert.
--
-- So the grant is part of making the ruling real, not a separate concern. The
-- four public tables go to anon as well as authenticated. accounts and sales go
-- to authenticated only: no visitor path reads them, and a logged-out reader has
-- no rows to see under either policy, so granting anon would buy nothing and
-- rely on the policy alone for a surface nothing calls.
--
-- This file still adds policies and privileges only. The six tables enable row
-- level security in their own migrations and that is not repeated here.

grant select on public.trainers to anon, authenticated;
grant select on public.owners to anon, authenticated;
grant select on public.horses to anon, authenticated;
grant select on public.dsls to anon, authenticated;
grant select on public.accounts to authenticated;
grant select on public.sales to authenticated;

create policy trainers_read_public
  on public.trainers
  for select
  using (true);

create policy owners_read_public
  on public.owners
  for select
  using (true);

create policy horses_read_public
  on public.horses
  for select
  using (true);

create policy dsls_read_published
  on public.dsls
  for select
  using (published = true);

create policy accounts_read_own
  on public.accounts
  for select
  using (auth.uid() = id);

create policy sales_read_own
  on public.sales
  for select
  using (auth.uid() = user_id);
