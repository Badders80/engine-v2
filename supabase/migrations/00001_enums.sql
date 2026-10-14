-- 00001_enums.sql
-- The four Tier 1 enums. Names and members are fixed by PLAN.md step 2 and
-- OUTCOME.md § DSL. No member is added here that those files do not name.

create type public.payment_model as enum ('subscription_float', 'upfront');

create type public.close_style as enum ('fourteen_day', 'three_x_remaining');

create type public.status as enum ('coming_soon', 'available', 'fully_allocated', 'completed');

create type public.kyc_status as enum ('unverified', 'pending', 'verified', 'failed');
