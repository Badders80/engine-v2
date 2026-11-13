-- probe-00031.sql
-- expect: 5
-- Checkout acceptance is recorded once and gates the Stripe binding.

\set ON_ERROR_STOP on

begin;

create temp table probe_results (
  n serial,
  check_name text,
  passed boolean,
  detail text
) on commit drop;

create temp table acceptance_fixture (
  accepted_checkout_id uuid not null,
  unaccepted_checkout_id uuid not null
) on commit drop;

insert into public.parties (id, display_name, bio) values
  ('e1111111-1111-4111-8111-111111111111', 'Acceptance Trainer', 'Acceptance trainer bio.'),
  ('e2222222-2222-4222-8222-222222222222', 'Acceptance Owner', 'Acceptance owner profile.');

insert into public.party_roles (party_id, role) values
  ('e1111111-1111-4111-8111-111111111111', 'trainer'),
  ('e2222222-2222-4222-8222-222222222222', 'owner');

insert into public.horses
  (id, slug, legal_name, foaling_date, sex, colour, sire_name, dam_name,
   registered, about_horse, racing_outlook_and_pedigree, race_expectation,
   image_count)
values
  ('e3333333-3333-4333-8333-333333333333', 'acceptance-probe', 'Acceptance Probe',
   '2022-10-02', 'Filly', 'Brown', 'Super Seth', 'Warrior Queen', true,
   'Acceptance probe horse.', 'Acceptance probe pedigree.', 'Acceptance probe plan.', 0);

insert into auth.users (id, email, raw_user_meta_data) values
  ('e4444444-4444-4444-8444-444444444444', 'acceptance@example.co.nz',
   '{"full_name": "Acceptance Buyer"}'::jsonb);

update public.accounts set kyc_status = 'verified'
 where id = 'e4444444-4444-4444-8444-444444444444';

insert into public.dsls
  (id, horse_id, trainer_id, owner_id, end_date, term_start, payment_model,
   close_style, status, published, wholesale_monthly_per_percent, investor_split,
   listed_stake, min_stake, step, stake_remaining, distribution_schedule,
   narrative_signoff, narrative_approved_at, narrative_approved_hash)
values
  ('e5555555-5555-4555-8555-555555555555',
   'e3333333-3333-4333-8333-333333333333',
   'e1111111-1111-4111-8111-111111111111',
   'e2222222-2222-4222-8222-222222222222',
   '2028-06-30', null, 'subscription_float', 'fourteen_day', 'available', true,
   70, 75, 10, 1, 1, 10, 'Quarterly',
   '{"horse.about_horse": true, "horse.racing_outlook_and_pedigree": true,
     "horse.race_expectation": true, "trainer.bio": true}'::jsonb,
   now(), 'acceptance-probe-hash');

select (public.reserve_checkout_stake(
  'e5555555-5555-4555-8555-555555555555',
  'e4444444-4444-4444-8444-444444444444',
  'Acceptance Buyer', 'acceptance@example.co.nz', 'Acceptance Probe',
  1, 380, '2026-12-01', 'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as accepted_checkout_id \gset

select (public.reserve_checkout_stake(
  'e5555555-5555-4555-8555-555555555555',
  'e4444444-4444-4444-8444-444444444444',
  'Acceptance Buyer', 'acceptance@example.co.nz', 'Acceptance Probe',
  1, 380, '2026-12-01', 'pds markdown', 'sa markdown', 'pds-hash', 'sa-hash', 600
)).id as unaccepted_checkout_id \gset

insert into acceptance_fixture values (
  :'accepted_checkout_id'::uuid,
  :'unaccepted_checkout_id'::uuid
);

select public.record_checkout_acceptance(
  :'accepted_checkout_id'::uuid,
  '["I am at least 18 years of age.", "I will complete identity verification before payment.", "I will provide proof of address when requested by the Syndicate Manager."]'::jsonb,
  'Acceptance Buyer'
) as accepted_checkout \gset

insert into probe_results (check_name, passed, detail)
select 'acceptance evidence is stored with hashes and timestamps',
       (select pds_accepted_at is not null
           and sa_accepted_at is not null
           and acceptance_recorded_at is not null
           and typed_signature = 'Acceptance Buyer'
           and jsonb_array_length(declarations_accepted) = 3
          from public.checkout_sessions
         where id = :'accepted_checkout_id'::uuid),
       'PDS/SA timestamps, declarations and typed signature present';

do $$
declare
  v_id uuid;
begin
  select accepted_checkout_id into v_id from acceptance_fixture;
  begin
    perform public.record_checkout_acceptance(
      v_id,
      '["second attempt"]'::jsonb,
      'Acceptance Buyer'
    );
    insert into probe_results (check_name, passed, detail)
    values ('a second acceptance is refused', false, 'second write unexpectedly succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('a second acceptance is refused', true, sqlerrm);
  end;
end
$$;

do $$
declare
  v_id uuid;
begin
  select accepted_checkout_id into v_id from acceptance_fixture;
  begin
    update public.checkout_sessions
       set typed_signature = 'Changed Name'
     where id = v_id;
    insert into probe_results (check_name, passed, detail)
    values ('acceptance evidence is immutable', false, 'mutation unexpectedly succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('acceptance evidence is immutable', true, sqlerrm);
  end;
end
$$;

do $$
declare
  v_id uuid;
begin
  select unaccepted_checkout_id into v_id from acceptance_fixture;
  begin
    update public.checkout_sessions
       set stripe_session_id = 'cs_probe_without_acceptance'
     where id = v_id;
    insert into probe_results (check_name, passed, detail)
    values ('Stripe cannot bind before acceptance', false, 'binding unexpectedly succeeded');
  exception when others then
    insert into probe_results (check_name, passed, detail)
    values ('Stripe cannot bind before acceptance', true, sqlerrm);
  end;
end
$$;

insert into probe_results (check_name, passed, detail)
select 'acceptance function is service-role only',
       has_function_privilege('service_role', 'public.record_checkout_acceptance(uuid,jsonb,text)', 'EXECUTE')
       and not has_function_privilege('authenticated', 'public.record_checkout_acceptance(uuid,jsonb,text)', 'EXECUTE'),
       'service_role execute; authenticated denied';

select n, check_name, passed, detail from probe_results order by n;
rollback;
