-- 00025_checkout_grants.sql
-- Chunk 4, Phase B. One pre-existing grant gap, found by driving the real
-- purchase path against the local stack.
--
-- `00013_service_role_grants.sql` granted `service_role` on the tables that
-- existed then. `00016_checkout_sessions.sql` created a new table afterwards
-- and granted nothing, so the engine's service-role client could call the
-- SECURITY DEFINER functions but could not SELECT or UPDATE the row they read
-- and write. A SECURITY DEFINER function needs no grant on its body's tables;
-- the webhook's `findCheckoutSessionByStripeSessionId` and
-- `attachStripeSession` talk to the table directly and do.
--
-- The privileges are SELECT, INSERT and UPDATE only. Nothing deletes a
-- checkout row: a hold is released or expired, never removed.

grant select, insert, update on public.checkout_sessions to service_role;

comment on table public.checkout_sessions is
  'One Checkout attempt. service_role reads and writes it; no DELETE is granted.';
