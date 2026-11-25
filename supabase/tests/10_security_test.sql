-- =============================================================================
-- Security and behaviour tests for the KCED database.
-- Run with scripts/test-db.sh (plain Postgres + 00_supabase_stub.sql).
-- Every check raises an exception on failure, so psql exits non-zero.
-- =============================================================================
\set ON_ERROR_STOP 1

-- Fixed ids --------------------------------------------------------------------
\set admin_id   '''00000000-0000-0000-0000-00000000000a'''
\set mgr_coe    '''00000000-0000-0000-0000-0000000000b1'''
\set mgr_cos    '''00000000-0000-0000-0000-0000000000b2'''
\set tech_coe   '''00000000-0000-0000-0000-0000000000c1'''
\set tech_cos   '''00000000-0000-0000-0000-0000000000c2'''
\set tech_yard  '''00000000-0000-0000-0000-0000000000c3'''

-- Fixtures (as superuser = service role path) ------------------------------------
insert into auth.users (id, email) values
  (:admin_id,  'admin@test.knust'),
  (:mgr_coe,   'mgr.coe@test.knust'),
  (:mgr_cos,   'mgr.cos@test.knust'),
  (:tech_coe,  'tech.coe@test.knust'),
  (:tech_cos,  'tech.cos@test.knust'),
  (:tech_yard, 'tech.yard@test.knust');

do $$
begin
  assert (select count(*) from public.users) = 6, 'auth trigger should create 6 profiles';
  assert (select bool_and(status = 'invited') from public.users), 'new profiles start invited';
end $$;

update public.users set role = 'admin', status = 'active', phone = '0240000001' where email = 'admin@test.knust';
update public.users set role = 'manager', status = 'active', phone = '0240000002',
  jurisdiction_id = (select id from jurisdictions where code = 'COE') where email = 'mgr.coe@test.knust';
update public.users set role = 'manager', status = 'active', phone = '0240000003',
  jurisdiction_id = (select id from jurisdictions where code = 'COS') where email = 'mgr.cos@test.knust';
update public.users set role = 'technician', status = 'active', phone = '0240000004',
  jurisdiction_id = (select id from jurisdictions where code = 'COE') where email = 'tech.coe@test.knust';
update public.users set role = 'technician', status = 'active', phone = '0240000005',
  jurisdiction_id = (select id from jurisdictions where code = 'COS') where email = 'tech.cos@test.knust';
update public.users set role = 'technician', status = 'active', phone = '0240000006',
  jurisdiction_id = (select id from jurisdictions where code = 'MY') where email = 'tech.yard@test.knust';

-- 1. Anonymous public submission ---------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);
select set_config('request.jwt.claim.role', 'anon', false);
set role anon;

insert into public.service_requests (issue, description, location, reporter, reporter_contact, jurisdiction_id, status)
values ('Socket sparking', 'Room 12 socket sparks', 'Petroleum Building', 'Ama', '+233241234567',
        (select id from jurisdictions where code = 'COE'), 'resolved');

do $$
declare n integer;
begin
  -- Supabase grants anon SELECT by default (then RLS returns 0 rows); plain
  -- Postgres has no grant (permission denied). Both mean "cannot read".
  begin
    select count(*) into n from public.service_requests;
    assert n = 0, 'anon must not read service requests';
  exception when insufficient_privilege then null;
  end;
end $$;

do $$
begin
  begin
    insert into public.service_requests (issue, description, location, reporter, reporter_contact)
    values ('x', 'x', 'x', 'x', '0241234567');
    raise exception 'TEST FAILED: bad phone format accepted';
  exception when check_violation then null;
  end;
end $$;

do $$
declare num text;
begin
  num := public.submit_service_request('Streetlight off', 'Dark near the library', 'Library road', 'Yaw',
    '+233241112223', (select id from jurisdictions where code = 'COS'), 'urgent',
    array['requests/2026-11/0b6a2f0e-1111-4c5e-9d1b-2a3f4e5d6c7b.jpg']);
  assert num ~ '^SR-\d{4}-\d{5}$', 'RPC returns the request number';
  begin
    perform public.submit_service_request('x', 'x', 'x', 'x', '+233241112224', null, 'normal',
      array['../../etc/passwd']);
    raise exception 'TEST FAILED: bad image path accepted';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;

reset role;
do $$
begin
  assert (select status from service_requests where issue = 'Socket sparking') = 'submitted',
    'anon cannot choose a status';
  assert (select request_number from service_requests where issue = 'Socket sparking') ~ '^SR-\d{4}-\d{5}$',
    'request number is generated';
end $$;

-- 2. Rate limit: 5 per phone per hour ---------------------------------------------------
set role anon;
insert into public.service_requests (issue, description, location, reporter, reporter_contact)
select 'Spam ' || g, 'd', 'l', 'r', '+233200000000' from generate_series(1, 5) g;
do $$
begin
  begin
    insert into public.service_requests (issue, description, location, reporter, reporter_contact)
    values ('Spam 6', 'd', 'l', 'r', '+233200000000');
    raise exception 'TEST FAILED: rate limit not enforced';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
end $$;
reset role;

-- 3. Manager scope -------------------------------------------------------------------------
select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;

insert into public.work_orders (title, jurisdiction_id, lead_technician_id, service_request_id)
values ('Fix sparking socket', (select id from jurisdictions where code = 'COE'),
        '00000000-0000-0000-0000-0000000000c1',
        (select id from service_requests where issue = 'Socket sparking'));

do $$
begin
  assert (select count(*) from public.service_requests) = 1,
    'COE manager sees only COE requests (spam rows have no jurisdiction)';
  begin
    insert into public.work_orders (title, jurisdiction_id)
    values ('Not mine', (select id from jurisdictions where code = 'COS'));
    raise exception 'TEST FAILED: manager created a work order in another jurisdiction';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.work_orders (title, jurisdiction_id, lead_technician_id)
    values ('Wrong tech', (select id from jurisdictions where code = 'COE'),
            '00000000-0000-0000-0000-0000000000c2');
    raise exception 'TEST FAILED: technician from another jurisdiction accepted as lead';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
  -- Maintenance-yard technicians can be assigned anywhere.
  insert into public.work_orders (title, jurisdiction_id, lead_technician_id)
  values ('Yard tech job', (select id from jurisdictions where code = 'COE'),
          '00000000-0000-0000-0000-0000000000c3');
end $$;

reset role;
do $$
begin
  assert (select status from service_requests where issue = 'Socket sparking') = 'assigned',
    'creating a work order marks its request assigned';
end $$;

-- 4. Manager cannot promote to admin or touch other jurisdictions --------------------------
set role authenticated;
do $$
begin
  begin
    update public.users set role = 'admin' where email = 'tech.coe@test.knust';
    raise exception 'TEST FAILED: manager promoted a user to admin';
  exception when insufficient_privilege then null;
  end;
  update public.users set role = 'manager' where email = 'tech.cos@test.knust';
  assert not found, 'manager cannot update users outside their jurisdiction (filtered by RLS)';
end $$;
reset role;

-- 5. Technician rules ------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
do $$
declare wo uuid;
begin
  begin
    insert into public.work_orders (title, jurisdiction_id)
    values ('Tech made this', (select id from jurisdictions where code = 'COE'));
    raise exception 'TEST FAILED: technician created a work order';
  exception when insufficient_privilege then null;
  end;

  select id into wo from public.work_orders where title = 'Fix sparking socket';
  begin
    update public.work_orders set title = 'Renamed' where id = wo;
    raise exception 'TEST FAILED: technician renamed a work order';
  exception when insufficient_privilege then null;
  end;

  update public.work_orders set status = 'in progress' where id = wo;
  update public.work_orders set status = 'completed', completion_notes = 'Replaced socket' where id = wo;

  begin
    update public.users set role = 'manager' where id = auth.uid();
    raise exception 'TEST FAILED: technician changed own role';
  exception when insufficient_privilege then null;
  end;
  update public.users set full_name = 'Kofi Mensah' where id = auth.uid();

  begin
    delete from public.work_orders where id = wo;
    if found then raise exception 'TEST FAILED: technician deleted a work order'; end if;
  end;
end $$;
reset role;

do $$
begin
  assert (select completed_at is not null from work_orders where title = 'Fix sparking socket'),
    'completed_at is set automatically';
  assert (select status from service_requests where issue = 'Socket sparking') = 'resolved',
    'completing the work order resolves the request';
  assert (select full_name from users where email = 'tech.coe@test.knust') = 'Kofi Mensah',
    'users can edit their own name';
end $$;

-- 6. Overdue is derived from the deadline -----------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);   -- back to the service path
insert into public.work_orders (title, jurisdiction_id, deadline)
values ('Late job', (select id from jurisdictions where code = 'COE'), now() - interval '1 day');
do $$
begin
  assert (select status from work_orders where title = 'Late job') = 'overdue', 'past deadline -> overdue';
  update work_orders set deadline = now() + interval '2 days' where title = 'Late job';
  assert (select status from work_orders where title = 'Late job') = 'pending', 'extended deadline -> pending';
end $$;

-- 7. Email change from auth is mirrored even inside the user's own session ---------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
update auth.users set email = 'kofi.new@test.knust' where id = '00000000-0000-0000-0000-0000000000c1';
do $$
begin
  assert (select email from users where id = '00000000-0000-0000-0000-0000000000c1') = 'kofi.new@test.knust',
    'auth email change is mirrored into users';
end $$;

-- 8. Energy: readings, consumption, permissions ------------------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
insert into public.meters (meter_number, building_id, utility, kind, multiplier)
values ('ECG-0001', (select id from buildings where code = 'COE-PB'), 'grid', 'postpaid', 2);
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
insert into public.meter_readings (meter_id, reading_at, reading_kwh)
select id, v.at, v.kwh
from public.meters, (values ('2026-09-30'::timestamptz, 1000), ('2026-10-31'::timestamptz, 1500),
                            ('2026-11-10'::timestamptz, 1600)) as v(at, kwh)
where meter_number = 'ECG-0001';
do $$
begin
  begin
    insert into public.meter_readings (meter_id, reading_at, reading_kwh)
    select id, '2026-11-11', 10 from public.meters where meter_number = 'ECG-0001';
    raise exception 'TEST FAILED: falling register accepted without a note';
  exception when raise_exception then
    if sqlerrm like 'TEST FAILED%' then raise; end if;
  end;
  assert (select consumption_kwh from building_monthly_energy where month = '2026-10-01') = 1000,
    'October consumption = (1500-1000) x multiplier 2';
  begin
    insert into public.meters (meter_number, building_id) values ('X-1', (select id from buildings where code = 'COE-PB'));
    raise exception 'TEST FAILED: technician created a meter';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 9. COS technician cannot record readings on a COE meter ---------------------------------------
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', false);
set role authenticated;
do $$
begin
  begin
    insert into public.meter_readings (meter_id, reading_at, reading_kwh)
    select id, '2026-11-12', 1700 from public.meters where meter_number = 'ECG-0001';
    raise exception 'TEST FAILED: reading recorded outside own jurisdiction';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- 10. Suspended users lose access ----------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);
update public.users set status = 'suspended' where email = 'mgr.cos@test.knust';
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', false);
set role authenticated;
do $$
begin
  assert (select count(*) from public.work_orders) = 0, 'suspended users see no work orders';
  assert (select count(*) from public.users) = 1, 'suspended users see only themselves';
end $$;
reset role;

select 'ALL DATABASE TESTS PASSED' as result;
