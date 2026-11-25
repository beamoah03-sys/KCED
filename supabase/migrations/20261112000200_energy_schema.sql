-- =============================================================================
-- KCED energy layer (Phase II)
--
-- Buildings, meters, meter readings, utility bills, power outages and
-- generator fuel logs, plus reporting views. This is what turns the
-- maintenance portal into a central energy database.
-- =============================================================================

create type public.building_category as enum
  ('academic', 'administrative', 'residential', 'health', 'commercial',
   'sports', 'utility', 'other');
create type public.meter_utility as enum ('grid', 'generator', 'solar', 'other');
create type public.meter_kind as enum ('prepaid', 'postpaid', 'smart', 'sub_meter');
create type public.reading_source as enum ('manual', 'import', 'api');
create type public.outage_cause as enum ('ecg_supply', 'internal_fault', 'planned', 'unknown');
create type public.fuel_log_kind as enum ('delivery', 'consumption');

-- ---------------------------------------------------------------------------
-- buildings
-- ---------------------------------------------------------------------------
create table public.buildings (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name            text not null,
  jurisdiction_id integer not null references public.jurisdictions (id),
  category        public.building_category not null default 'other',
  floor_area_m2   numeric(12, 2) check (floor_area_m2 is null or floor_area_m2 > 0),
  occupants       integer check (occupants is null or occupants >= 0),
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  notes           text,
  created_by      uuid default auth.uid() references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index buildings_jurisdiction_idx on public.buildings (jurisdiction_id);
create trigger buildings_updated_at before update on public.buildings
  for each row execute function public.set_updated_at();

alter table public.assets
  add constraint assets_building_fk foreign key (building_id)
  references public.buildings (id) on delete set null;
create index assets_building_idx on public.assets (building_id);

alter table public.service_requests
  add constraint service_requests_building_fk foreign key (building_id)
  references public.buildings (id) on delete set null;

-- ---------------------------------------------------------------------------
-- meters
-- ---------------------------------------------------------------------------
create table public.meters (
  id                 uuid primary key default gen_random_uuid(),
  meter_number       text not null unique,
  building_id        uuid not null references public.buildings (id) on delete restrict,
  jurisdiction_id    integer not null references public.jurisdictions (id),
  utility            public.meter_utility not null default 'grid',
  kind               public.meter_kind not null default 'postpaid',
  ecg_account_number text,
  -- CT ratio / multiplier applied to register differences.
  multiplier         numeric(10, 3) not null default 1 check (multiplier > 0),
  parent_meter_id    uuid references public.meters (id) on delete set null,
  asset_id           uuid references public.assets (id) on delete set null,
  installed_on       date,
  is_active          boolean not null default true,
  notes              text,
  created_by         uuid default auth.uid() references public.users (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint meters_not_own_parent check (parent_meter_id is null or parent_meter_id <> id)
);
create index meters_building_idx on public.meters (building_id);
create index meters_jurisdiction_idx on public.meters (jurisdiction_id);
create trigger meters_updated_at before update on public.meters
  for each row execute function public.set_updated_at();

-- A meter's jurisdiction always follows its building.
create or replace function public.meters_inherit_jurisdiction()
returns trigger language plpgsql as $$
begin
  select jurisdiction_id into new.jurisdiction_id from public.buildings where id = new.building_id;
  return new;
end;
$$;
create trigger meters_inherit_jurisdiction before insert or update of building_id on public.meters
  for each row execute function public.meters_inherit_jurisdiction();

-- ---------------------------------------------------------------------------
-- meter_readings: cumulative register values (kWh)
-- ---------------------------------------------------------------------------
create table public.meter_readings (
  id          uuid primary key default gen_random_uuid(),
  meter_id    uuid not null references public.meters (id) on delete cascade,
  reading_at  timestamptz not null default now(),
  reading_kwh numeric(14, 2) not null check (reading_kwh >= 0),
  source      public.reading_source not null default 'manual',
  photo_path  text,
  notes       text,
  recorded_by uuid default auth.uid() references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint meter_readings_unique unique (meter_id, reading_at),
  constraint meter_readings_not_future check (reading_at <= now() + interval '1 day')
);
create index meter_readings_meter_time_idx on public.meter_readings (meter_id, reading_at desc);

-- A register normally only goes up. Allow a drop only with a note (meter
-- replaced or reset), so typos are caught at the source.
create or replace function public.meter_readings_check_monotonic()
returns trigger language plpgsql as $$
declare
  prev numeric;
begin
  select reading_kwh into prev
  from public.meter_readings
  where meter_id = new.meter_id and reading_at < new.reading_at
  order by reading_at desc limit 1;

  if prev is not null and new.reading_kwh < prev and coalesce(trim(new.notes), '') = '' then
    raise exception 'Reading % kWh is lower than the previous reading (% kWh). Add a note if the meter was replaced or reset.',
      new.reading_kwh, prev using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger meter_readings_check_monotonic before insert or update on public.meter_readings
  for each row execute function public.meter_readings_check_monotonic();

-- Consumption between consecutive readings, scaled by the multiplier.
-- A negative step (meter reset/replacement) counts as zero.
create or replace view public.meter_consumption
with (security_invoker = true) as
select
  r.id,
  r.meter_id,
  m.building_id,
  m.jurisdiction_id,
  m.utility,
  lag(r.reading_at) over w as period_start,
  r.reading_at as period_end,
  greatest(r.reading_kwh - lag(r.reading_kwh) over w, 0) * m.multiplier as consumption_kwh
from public.meter_readings r
join public.meters m on m.id = r.meter_id
window w as (partition by r.meter_id order by r.reading_at);

-- Monthly consumption per building, attributed to the month a period ends in.
create or replace view public.building_monthly_energy
with (security_invoker = true) as
select
  c.building_id,
  c.jurisdiction_id,
  c.utility,
  date_trunc('month', c.period_end)::date as month,
  sum(c.consumption_kwh)::numeric(14, 2) as consumption_kwh
from public.meter_consumption c
where c.period_start is not null
group by 1, 2, 3, 4;

-- ---------------------------------------------------------------------------
-- tariffs and bills
-- ---------------------------------------------------------------------------
create table public.tariffs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  effective_from date not null,
  rate_ghs_per_kwh numeric(10, 4) not null check (rate_ghs_per_kwh >= 0),
  service_charge_ghs numeric(10, 2) not null default 0,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (name, effective_from)
);

create table public.bills (
  id              uuid primary key default gen_random_uuid(),
  meter_id        uuid references public.meters (id) on delete set null,
  building_id     uuid references public.buildings (id) on delete set null,
  jurisdiction_id integer not null references public.jurisdictions (id),
  account_number  text,
  period_start    date not null,
  period_end      date not null,
  consumption_kwh numeric(14, 2) check (consumption_kwh is null or consumption_kwh >= 0),
  max_demand_kva  numeric(10, 2) check (max_demand_kva is null or max_demand_kva >= 0),
  amount_ghs      numeric(14, 2) not null check (amount_ghs >= 0),
  due_date        date,
  paid_at         date,
  document_path   text,
  notes           text,
  created_by      uuid default auth.uid() references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint bills_period_order check (period_end >= period_start)
);
create index bills_period_idx on public.bills (period_end desc);
create index bills_jurisdiction_idx on public.bills (jurisdiction_id);
create trigger bills_updated_at before update on public.bills
  for each row execute function public.set_updated_at();

-- Bills take building and jurisdiction from their meter when one is given.
create or replace function public.bills_fill_from_meter()
returns trigger language plpgsql as $$
begin
  if new.meter_id is not null then
    select building_id, jurisdiction_id, coalesce(new.account_number, ecg_account_number)
      into new.building_id, new.jurisdiction_id, new.account_number
      from public.meters where id = new.meter_id;
  elsif new.building_id is not null then
    select jurisdiction_id into new.jurisdiction_id from public.buildings where id = new.building_id;
  end if;
  return new;
end;
$$;
create trigger bills_fill_from_meter before insert or update on public.bills
  for each row execute function public.bills_fill_from_meter();

-- ---------------------------------------------------------------------------
-- outages: power supply interruptions
-- ---------------------------------------------------------------------------
create table public.outages (
  id               uuid primary key default gen_random_uuid(),
  jurisdiction_id  integer not null references public.jurisdictions (id),
  building_id      uuid references public.buildings (id) on delete set null,
  started_at       timestamptz not null,
  ended_at         timestamptz,
  cause            public.outage_cause not null default 'unknown',
  generator_used   boolean not null default false,
  generator_hours  numeric(8, 2) check (generator_hours is null or generator_hours >= 0),
  description      text,
  reported_by      uuid default auth.uid() references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint outages_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index outages_started_idx on public.outages (started_at desc);
create index outages_jurisdiction_idx on public.outages (jurisdiction_id);
create trigger outages_updated_at before update on public.outages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- generator fuel logs
-- ---------------------------------------------------------------------------
create table public.fuel_logs (
  id              uuid primary key default gen_random_uuid(),
  asset_id        uuid not null references public.assets (id) on delete cascade,
  jurisdiction_id integer not null references public.jurisdictions (id),
  kind            public.fuel_log_kind not null default 'delivery',
  logged_at       timestamptz not null default now(),
  litres          numeric(10, 2) not null check (litres > 0),
  cost_ghs        numeric(12, 2) check (cost_ghs is null or cost_ghs >= 0),
  run_hours_meter numeric(10, 1) check (run_hours_meter is null or run_hours_meter >= 0),
  notes           text,
  recorded_by     uuid default auth.uid() references public.users (id) on delete set null,
  created_at      timestamptz not null default now()
);
create index fuel_logs_asset_idx on public.fuel_logs (asset_id, logged_at desc);

create or replace function public.fuel_logs_check_generator()
returns trigger language plpgsql as $$
declare
  t public.asset_type;
begin
  select asset_type, jurisdiction_id into t, new.jurisdiction_id from public.assets where id = new.asset_id;
  if t is distinct from 'generator' then
    raise exception 'Fuel can only be logged against a generator asset.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger fuel_logs_check_generator before insert or update on public.fuel_logs
  for each row execute function public.fuel_logs_check_generator();

-- ---------------------------------------------------------------------------
-- Activity for the energy tables
-- ---------------------------------------------------------------------------
create or replace function public.log_energy_activity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'buildings' then
    perform public.log_activity('building', new.id::text, 'created', new.name, new.code, new.jurisdiction_id);
  elsif tg_table_name = 'meters' then
    perform public.log_activity('meter', new.id::text, 'created', new.meter_number, new.utility::text, new.jurisdiction_id);
  elsif tg_table_name = 'bills' then
    perform public.log_activity('bill', new.id::text, 'created',
      coalesce(new.account_number, 'Bill'), 'GHS ' || new.amount_ghs::text, new.jurisdiction_id);
  elsif tg_table_name = 'outages' then
    perform public.log_activity('outage', new.id::text, 'created',
      'Power outage', new.cause::text, new.jurisdiction_id);
  end if;
  return new;
end;
$$;
create trigger building_activity after insert on public.buildings
  for each row execute function public.log_energy_activity();
create trigger meter_activity after insert on public.meters
  for each row execute function public.log_energy_activity();
create trigger bill_activity after insert on public.bills
  for each row execute function public.log_energy_activity();
create trigger outage_activity after insert on public.outages
  for each row execute function public.log_energy_activity();

-- ---------------------------------------------------------------------------
-- Reporting views
-- ---------------------------------------------------------------------------

-- Monthly cost per building (bills attributed to the month their period ends).
create or replace view public.building_monthly_cost
with (security_invoker = true) as
select
  b.building_id,
  b.jurisdiction_id,
  date_trunc('month', b.period_end)::date as month,
  sum(b.amount_ghs)::numeric(14, 2) as amount_ghs,
  sum(b.consumption_kwh)::numeric(14, 2) as billed_kwh
from public.bills b
group by 1, 2, 3;

-- Outage duration in hours (open outages count up to now).
create or replace view public.outage_durations
with (security_invoker = true) as
select
  o.*,
  round(extract(epoch from (coalesce(o.ended_at, now()) - o.started_at)) / 3600.0, 2) as duration_hours
from public.outages o;
