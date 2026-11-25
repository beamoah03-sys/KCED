-- =============================================================================
-- Development seed data. Loaded by `supabase db reset` (local only).
--
-- The jurisdiction list below is a STARTING POINT. Replace it with the real
-- list the Phase I project uses (export it from the live `jurisdictions`
-- table: Table editor -> jurisdictions -> Export to CSV).
-- =============================================================================

insert into public.jurisdictions (name, code, sort_order, is_maintenance_yard) values
  ('Maintenance Yard',            'MY',   1, true),
  ('College of Engineering',      'COE',  2, false),
  ('College of Science',          'COS',  3, false),
  ('College of Health Sciences',  'CHS',  4, false),
  ('College of Agriculture',      'CANR', 5, false),
  ('College of Art and Built Env','CABE', 6, false),
  ('College of Humanities',       'CHSS', 7, false),
  ('Halls of Residence',          'HALLS',8, false),
  ('Central Administration',      'ADMIN',9, false),
  ('Commercial Area',             'COMM', 10, false)
on conflict (code) do nothing;

insert into public.buildings (code, name, jurisdiction_id, category, floor_area_m2, occupants, latitude, longitude)
select v.code, v.name, j.id, v.category::public.building_category, v.area, v.occ, v.lat, v.lng
from (values
  ('COE-PB',   'Engineering Petroleum Building', 'COE',   'academic',       6500, 1200, 6.6750, -1.5672),
  ('COS-NB',   'Science New Block',              'COS',   'academic',       5200, 1500, 6.6731, -1.5660),
  ('ADMIN-GB', 'Great Hall',                     'ADMIN', 'administrative', 3800,  400, 6.6745, -1.5716),
  ('HALL-UH',  'Unity Hall',                     'HALLS', 'residential',   14000, 2500, 6.6788, -1.5662),
  ('MY-WS',    'Maintenance Yard Workshop',      'MY',    'utility',        1200,   80, 6.6703, -1.5745)
) as v(code, name, jcode, category, area, occ, lat, lng)
join public.jurisdictions j on j.code = v.jcode
on conflict (code) do nothing;

insert into public.tariffs (name, effective_from, rate_ghs_per_kwh, service_charge_ghs, notes)
values ('Example non-residential tariff', '2026-07-01', 2.1500, 0,
        'Placeholder. Enter the current PURC-approved tariff before using cost reports.')
on conflict do nothing;

-- Staff accounts are created through the app (Users -> Invite) or with
-- scripts/create-admin.sql after you sign up the first admin in Supabase Auth.
