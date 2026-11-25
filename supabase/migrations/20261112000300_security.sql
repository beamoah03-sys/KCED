-- =============================================================================
-- KCED security: role helpers, guard triggers and Row Level Security
--
-- The browser talks to Postgres directly with the public (anon) key, so these
-- policies ARE the security boundary. The UI checks only hide buttons.
--
-- Role model
--   admin       everything, everywhere
--   manager     everything inside their own jurisdiction
--   technician  read their jurisdiction + work assigned to them; update the
--               work orders they lead and the assets those orders touch;
--               record meter readings, fuel logs and outages
--   anon        submit a service request; read jurisdictions/buildings for
--               the public form (tracking goes through an Edge Function)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so they can read users without recursing into
-- the users policies). All are STABLE so Postgres caches them per statement.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid() and status = 'active';
$$;

create or replace function public.current_user_jurisdiction()
returns integer
language sql stable security definer set search_path = public
as $$
  select jurisdiction_id from public.users where id = auth.uid() and status = 'active';
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_active_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_user_role() is not null;
$$;

-- Admin, or a manager of the given jurisdiction.
create or replace function public.can_manage(p_jurisdiction integer)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or (public.current_user_role() = 'manager'
          and p_jurisdiction is not null
          and p_jurisdiction = public.current_user_jurisdiction());
$$;

-- Admin, or any active staff member of the given jurisdiction.
create or replace function public.in_my_jurisdiction(p_jurisdiction integer)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_admin()
      or (public.is_active_staff()
          and p_jurisdiction is not null
          and p_jurisdiction = public.current_user_jurisdiction());
$$;

-- The current user leads an unfinished work order on this asset.
create or replace function public.has_open_assignment(p_asset uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.work_orders
    where asset_id = p_asset
      and lead_technician_id = auth.uid()
      and status <> 'completed'
  );
$$;

-- The current user leads any work order on this asset (open or not).
create or replace function public.has_any_assignment_on_asset(p_asset uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.work_orders
    where asset_id = p_asset and lead_technician_id = auth.uid()
  );
$$;

create or replace function public.has_assignment_on_request(p_request uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.work_orders
    where service_request_id = p_request and lead_technician_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Guard: who may change which columns on users
-- ---------------------------------------------------------------------------
create or replace function public.users_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role public.user_role := public.current_user_role();
  actor_jurisdiction integer := public.current_user_jurisdiction();
  is_self boolean := new.id = auth.uid();
begin
  -- Email/name mirrored from auth.users by handle_auth_user_updated().
  if coalesce(current_setting('kced.sync_from_auth', true), '') = 'on' then
    return new;
  end if;

  -- Service role (Edge Functions, SQL editor) and admins may change anything,
  -- except that nobody may demote or suspend themselves by accident.
  if auth.uid() is null or actor_role = 'admin' then
    if is_self and (new.role <> old.role or new.status = 'suspended') then
      raise exception 'You cannot change your own role or suspend yourself.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.id <> old.id or new.email <> old.email then
    raise exception 'Email is managed by the authentication service.' using errcode = '42501';
  end if;

  if is_self then
    -- Self-service: name, phone, avatar; and finishing account setup.
    if new.role <> old.role or new.jurisdiction_id is distinct from old.jurisdiction_id then
      raise exception 'You cannot change your own role or jurisdiction.' using errcode = '42501';
    end if;
    if new.status <> old.status
       and not (old.status = 'invited' and new.status = 'active' and new.phone is not null) then
      raise exception 'You cannot change your own status.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Managers: users in their jurisdiction, never admins, never promote to admin,
  -- never move someone to another jurisdiction.
  if actor_role = 'manager' then
    if old.jurisdiction_id is distinct from actor_jurisdiction
       or new.jurisdiction_id is distinct from actor_jurisdiction then
      raise exception 'Managers can only manage users in their own jurisdiction.' using errcode = '42501';
    end if;
    if old.role = 'admin' or new.role = 'admin' then
      raise exception 'Only admins can manage admin accounts.' using errcode = '42501';
    end if;
    if new.full_name is distinct from old.full_name or new.phone is distinct from old.phone
       or new.avatar_url is distinct from old.avatar_url then
      raise exception 'Managers can change role and status only.' using errcode = '42501';
    end if;
    return new;
  end if;

  raise exception 'Not allowed.' using errcode = '42501';
end;
$$;
create trigger users_guard before update on public.users
  for each row execute function public.users_guard();

-- ---------------------------------------------------------------------------
-- Guard: technicians may only progress the work orders they lead
-- ---------------------------------------------------------------------------
create or replace function public.work_orders_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.can_manage(old.jurisdiction_id) then
    -- Managers may not move an order out of their own jurisdiction.
    if auth.uid() is not null and not public.can_manage(new.jurisdiction_id) then
      raise exception 'You cannot move a work order to another jurisdiction.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Technician path (RLS already limits rows to orders they lead).
  if new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.category is distinct from old.category
     or new.jurisdiction_id is distinct from old.jurisdiction_id
     or new.lead_technician_id is distinct from old.lead_technician_id
     or new.deadline is distinct from old.deadline
     or new.service_request_id is distinct from old.service_request_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Technicians can update status, completion notes, hours, cost and the linked asset only.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger work_orders_guard before update on public.work_orders
  for each row execute function public.work_orders_guard();

-- Only active technicians can lead a work order, and only within their
-- jurisdiction unless they belong to a maintenance yard.
create or replace function public.work_orders_check_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  lead record;
begin
  if new.lead_technician_id is null then
    return new;
  end if;
  select u.role, u.status, u.jurisdiction_id, coalesce(j.is_maintenance_yard, false) as yard
    into lead
    from public.users u left join public.jurisdictions j on j.id = u.jurisdiction_id
   where u.id = new.lead_technician_id;

  if lead.role is distinct from 'technician' or lead.status is distinct from 'active' then
    raise exception 'The lead technician must be an active technician.' using errcode = 'P0001';
  end if;
  if lead.jurisdiction_id is distinct from new.jurisdiction_id and not lead.yard then
    raise exception 'That technician works in another jurisdiction.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger work_orders_check_lead before insert or update of lead_technician_id, jurisdiction_id
  on public.work_orders for each row execute function public.work_orders_check_lead();

-- ---------------------------------------------------------------------------
-- Guard: technicians editing an asset cannot move or re-code it
-- ---------------------------------------------------------------------------
create or replace function public.assets_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.can_manage(old.jurisdiction_id) then
    if auth.uid() is not null and not public.can_manage(new.jurisdiction_id) then
      raise exception 'You cannot move an asset to another jurisdiction.' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.asset_code is distinct from old.asset_code
     or new.asset_type is distinct from old.asset_type
     or new.jurisdiction_id is distinct from old.jurisdiction_id
     or new.retired_at is distinct from old.retired_at then
    raise exception 'Technicians cannot change an asset''s code, type, jurisdiction or retire it.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger assets_guard before update on public.assets
  for each row execute function public.assets_guard();

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.jurisdictions    enable row level security;
alter table public.users            enable row level security;
alter table public.assets           enable row level security;
alter table public.service_requests enable row level security;
alter table public.work_orders      enable row level security;
alter table public.activity_log     enable row level security;
alter table public.buildings        enable row level security;
alter table public.meters           enable row level security;
alter table public.meter_readings   enable row level security;
alter table public.tariffs          enable row level security;
alter table public.bills            enable row level security;
alter table public.outages          enable row level security;
alter table public.fuel_logs        enable row level security;

-- jurisdictions ---------------------------------------------------------------
create policy "Anyone can read jurisdictions"
  on public.jurisdictions for select to anon, authenticated using (true);
create policy "Admins manage jurisdictions"
  on public.jurisdictions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- users -----------------------------------------------------------------------
-- Staff can see the staff directory (needed to show technician names on work
-- orders across jurisdictions). Invited/suspended users see only themselves.
create policy "Staff read the directory"
  on public.users for select to authenticated
  using (id = auth.uid() or public.is_active_staff());
create policy "Users update themselves; admins and managers manage users"
  on public.users for update to authenticated
  using (id = auth.uid() or public.is_admin()
         or (public.current_user_role() = 'manager' and jurisdiction_id = public.current_user_jurisdiction()))
  with check (true);  -- column-level rules live in users_guard()
create policy "Admins delete users"
  on public.users for delete to authenticated using (public.is_admin());
-- No insert policy: rows come from the auth trigger / invite-user function.

-- service_requests ------------------------------------------------------------
create policy "Public can submit requests"
  on public.service_requests for insert to anon, authenticated
  with check (status = 'submitted');
create policy "Staff read requests in scope"
  on public.service_requests for select to authenticated
  using (public.in_my_jurisdiction(jurisdiction_id) or public.has_assignment_on_request(id));
create policy "Managers update requests"
  on public.service_requests for update to authenticated
  using (public.can_manage(jurisdiction_id)) with check (public.can_manage(jurisdiction_id));
create policy "Admins delete requests"
  on public.service_requests for delete to authenticated using (public.is_admin());

-- work_orders -----------------------------------------------------------------
create policy "Staff read work orders in scope"
  on public.work_orders for select to authenticated
  using (public.in_my_jurisdiction(jurisdiction_id) or lead_technician_id = auth.uid());
create policy "Managers create work orders"
  on public.work_orders for insert to authenticated
  with check (public.can_manage(jurisdiction_id));
create policy "Managers and lead technicians update work orders"
  on public.work_orders for update to authenticated
  using (public.can_manage(jurisdiction_id) or lead_technician_id = auth.uid())
  with check (public.can_manage(jurisdiction_id) or lead_technician_id = auth.uid());
create policy "Managers delete work orders"
  on public.work_orders for delete to authenticated using (public.can_manage(jurisdiction_id));

-- assets ----------------------------------------------------------------------
create policy "Staff read assets in scope"
  on public.assets for select to authenticated
  using (public.in_my_jurisdiction(jurisdiction_id) or public.has_any_assignment_on_asset(id));
create policy "Managers create assets"
  on public.assets for insert to authenticated with check (public.can_manage(jurisdiction_id));
create policy "Managers and assigned technicians update assets"
  on public.assets for update to authenticated
  using (public.can_manage(jurisdiction_id) or public.has_open_assignment(id))
  with check (public.can_manage(jurisdiction_id) or public.has_open_assignment(id));
create policy "Admins delete assets"
  on public.assets for delete to authenticated using (public.is_admin());

-- activity_log ----------------------------------------------------------------
create policy "Staff read activity in scope"
  on public.activity_log for select to authenticated
  using (public.is_admin() or (public.is_active_staff()
         and (jurisdiction_id is null or jurisdiction_id = public.current_user_jurisdiction())));
-- No write policies: only SECURITY DEFINER triggers write here.

-- buildings -------------------------------------------------------------------
create policy "Anyone can read buildings"
  on public.buildings for select to anon, authenticated using (true);
create policy "Managers manage buildings"
  on public.buildings for all to authenticated
  using (public.can_manage(jurisdiction_id)) with check (public.can_manage(jurisdiction_id));

-- meters ----------------------------------------------------------------------
create policy "Staff read meters"
  on public.meters for select to authenticated using (public.is_active_staff());
create policy "Managers manage meters"
  on public.meters for all to authenticated
  using (public.can_manage(jurisdiction_id)) with check (public.can_manage(jurisdiction_id));

-- meter_readings --------------------------------------------------------------
create policy "Staff read readings"
  on public.meter_readings for select to authenticated using (public.is_active_staff());
create policy "Staff record readings in their jurisdiction"
  on public.meter_readings for insert to authenticated
  with check (exists (select 1 from public.meters m
                      where m.id = meter_id and public.in_my_jurisdiction(m.jurisdiction_id)));
create policy "Managers correct readings"
  on public.meter_readings for update to authenticated
  using (exists (select 1 from public.meters m where m.id = meter_id and public.can_manage(m.jurisdiction_id)))
  with check (exists (select 1 from public.meters m where m.id = meter_id and public.can_manage(m.jurisdiction_id)));
create policy "Managers delete readings"
  on public.meter_readings for delete to authenticated
  using (exists (select 1 from public.meters m where m.id = meter_id and public.can_manage(m.jurisdiction_id)));

-- tariffs ---------------------------------------------------------------------
create policy "Staff read tariffs"
  on public.tariffs for select to authenticated using (public.is_active_staff());
create policy "Admins manage tariffs"
  on public.tariffs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- bills -----------------------------------------------------------------------
create policy "Staff read bills in scope"
  on public.bills for select to authenticated using (public.in_my_jurisdiction(jurisdiction_id));
create policy "Managers manage bills"
  on public.bills for all to authenticated
  using (public.can_manage(jurisdiction_id)) with check (public.can_manage(jurisdiction_id));

-- outages ---------------------------------------------------------------------
create policy "Staff read outages"
  on public.outages for select to authenticated using (public.is_active_staff());
create policy "Staff log outages in their jurisdiction"
  on public.outages for insert to authenticated with check (public.in_my_jurisdiction(jurisdiction_id));
create policy "Staff close outages in their jurisdiction"
  on public.outages for update to authenticated
  using (public.in_my_jurisdiction(jurisdiction_id)) with check (public.in_my_jurisdiction(jurisdiction_id));
create policy "Managers delete outages"
  on public.outages for delete to authenticated using (public.can_manage(jurisdiction_id));

-- fuel_logs -------------------------------------------------------------------
create policy "Staff read fuel logs in scope"
  on public.fuel_logs for select to authenticated using (public.in_my_jurisdiction(jurisdiction_id));
create policy "Staff record fuel in their jurisdiction"
  on public.fuel_logs for insert to authenticated with check (public.in_my_jurisdiction(jurisdiction_id));
create policy "Managers correct fuel logs"
  on public.fuel_logs for update to authenticated
  using (public.can_manage(jurisdiction_id)) with check (public.can_manage(jurisdiction_id));
create policy "Managers delete fuel logs"
  on public.fuel_logs for delete to authenticated using (public.can_manage(jurisdiction_id));

-- ---------------------------------------------------------------------------
-- Grants. Supabase grants table access to anon/authenticated by default;
-- RLS above narrows it. Sequences and helper functions need explicit grants.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.jurisdictions, public.buildings to anon;
grant insert on public.service_requests to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on function
  public.current_user_role(), public.current_user_jurisdiction(), public.is_admin(),
  public.is_active_staff(), public.can_manage(integer), public.in_my_jurisdiction(integer),
  public.has_open_assignment(uuid), public.has_any_assignment_on_asset(uuid),
  public.has_assignment_on_request(uuid)
  to authenticated;
revoke execute on function public.mark_overdue_work_orders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public submission RPC: inserts a request and returns its number, so the
-- reporter can track it (anon cannot SELECT the row back).
-- ---------------------------------------------------------------------------
create or replace function public.submit_service_request(
  p_issue text,
  p_description text,
  p_location text,
  p_reporter text,
  p_reporter_contact text,
  p_jurisdiction_id integer,
  p_urgency public.request_urgency default 'normal',
  p_images text[] default '{}'
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  new_number text;
begin
  -- Only paths inside the public upload folder are accepted.
  if exists (select 1 from unnest(coalesce(p_images, '{}')) img where img !~ '^requests/[0-9-]+/[A-Za-z0-9-]+\.[a-z0-9]+$') then
    raise exception 'Invalid image reference.' using errcode = 'P0001';
  end if;

  insert into public.service_requests
    (issue, description, location, reporter, reporter_contact, jurisdiction_id, urgency, submitted_images)
  values
    (trim(p_issue), trim(p_description), trim(p_location), trim(p_reporter), p_reporter_contact,
     p_jurisdiction_id, coalesce(p_urgency, 'normal'), coalesce(p_images, '{}'))
  returning request_number into new_number;
  return new_number;
end;
$$;
grant execute on function public.submit_service_request(text, text, text, text, text, integer, public.request_urgency, text[])
  to anon, authenticated;
