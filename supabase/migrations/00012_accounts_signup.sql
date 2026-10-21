-- 00012_accounts_signup.sql
-- PLAN.md step 8 (`PLAN.md:24`, `:316`) and `00006_accounts.sql`.
--
-- Signup collects full name and creates the one `public.accounts` row from
-- `auth.users` (`id`, `full_name`, `email`, `kyc_status = 'unverified'`).
-- Checkout reads that row and never creates a second profile.

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  resolved_name := coalesce(
    nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'name'), '')
  );

  if resolved_name is null then
    raise exception 'signup requires full_name in user metadata'
      using errcode = '23502';
  end if;

  if new.email is null or btrim(new.email) = '' then
    raise exception 'signup requires email on auth.users'
      using errcode = '23502';
  end if;

  insert into public.accounts (id, full_name, email, kyc_status)
  values (new.id, resolved_name, btrim(new.email), 'unverified'::public.kyc_status)
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_auth_user_created();
