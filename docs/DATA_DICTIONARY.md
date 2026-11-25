# Data dictionary

All tables are in the `public` schema. Times are `timestamptz` (stored in UTC; Ghana is UTC+0). Money is in Ghana cedis (GHS). Energy is in kWh.

## Reference

### jurisdictions
| Column | Type | Meaning |
| --- | --- | --- |
| id | integer | Primary key |
| name, code | text | e.g. "College of Engineering", `COE` (2–12 capitals/digits) |
| sort_order | integer | Order in pickers |
| is_maintenance_yard | boolean | Technicians here can be assigned to work in any jurisdiction |

### users
Profile for each staff login (`id` = `auth.users.id`).
| Column | Meaning |
| --- | --- |
| email | Mirrored from Auth; change it through the app's email-change flow |
| full_name, phone, avatar_url | Self-editable |
| role | `admin`, `manager`, `technician` |
| status | `invited` (has not finished setup), `active`, `suspended` (no access) |
| jurisdiction_id | Required for everyone except admins once active |
| invited_by | Who sent the invite |

## Maintenance

### service_requests
| Column | Meaning |
| --- | --- |
| request_number | `SR-YYYY-NNNNN`, given to the reporter |
| issue, description, location | What and where |
| reporter, reporter_contact | Name and `+233XXXXXXXXX` phone (personal data — see RUNBOOK on retention) |
| urgency | `low`, `normal`, `urgent`, `emergency` |
| submitted_images | Storage paths (`requests/…`) or legacy Phase I URLs; max 5 |
| status | `submitted` → `assigned` → `in progress` → `resolved`; or `cancelled`. Kept in step with the work order automatically |
| jurisdiction_id, building_id | Where |

### work_orders
| Column | Meaning |
| --- | --- |
| work_order_number | `WO-YYYY-NNNNN` |
| title (≤100), description, category | `repair`, `maintenance`, `installation`, `inspection` |
| status | `pending`, `overdue` (pending past deadline, automatic), `in progress`, `completed` |
| deadline, completed_at, completion_notes | `completed_at` is set automatically |
| lead_technician_id | Active technician in the same jurisdiction or a maintenance yard |
| service_request_id | At most one work order per request |
| asset_id | The equipment worked on |
| labour_hours, cost_ghs | For cost tracking (optional) |

### assets
| Column | Meaning |
| --- | --- |
| asset_code | Unique; suggested format `KNUST-<AREA>-<TYPE>-<NNN>` |
| asset_type | `generator`, `transformer`, `lift`, `solar_pv`, `streetlight`, `air_conditioner` |
| location | Free text or `"lat, lng"` (kept for the mobile app) |
| latitude, longitude | Filled automatically from a `"lat, lng"` location |
| condition | `good`, `fair`, `poor`, `critical` |
| operational_status | `working`, `faulty`, `under_repair`, `offline` |
| last_maintenance, next_maintenance | Dates; next ≥ last |
| specifications | JSON; keys per type are defined in `src/features/asset/asset-specs-config.ts` |
| retired_at | Set when decommissioned; retired assets are hidden by default |
| building_id | Building the asset serves |

### activity_log
Written only by triggers. `entity_type`, `entity_id`, `action` (`created`, `status_changed`…), `title`, `detail`, `jurisdiction_id`, `actor_id` (who did it), `created_at`.

## Energy

### buildings
`code` (unique, e.g. `COE-PB`), `name`, `jurisdiction_id`, `category` (`academic`, `administrative`, `residential`, `health`, `commercial`, `sports`, `utility`, `other`), `floor_area_m2` (needed for kWh/m²), `occupants`, `latitude`, `longitude`, `notes`.

### meters
| Column | Meaning |
| --- | --- |
| meter_number | Unique, as printed on the meter |
| building_id | Required; `jurisdiction_id` is copied from the building |
| utility | `grid` (ECG), `generator`, `solar`, `other` |
| kind | `prepaid`, `postpaid`, `smart`, `sub_meter` |
| ecg_account_number | Links bills to the meter |
| multiplier | CT ratio; consumption = register difference × multiplier |
| parent_meter_id | For sub-meters under a main meter |
| asset_id | Optional link to the generator/PV asset it measures |
| is_active, installed_on, notes | |

### meter_readings
`meter_id`, `reading_at`, `reading_kwh` (cumulative register value), `source` (`manual`, `import`, `api`), `photo_path`, `notes`, `recorded_by`. One reading per meter per timestamp. A reading lower than the previous one needs a note (meter replaced/reset).

### tariffs
`name`, `effective_from`, `rate_ghs_per_kwh`, `service_charge_ghs`. Admin-maintained; for cost estimates.

### bills
`meter_id` (building and jurisdiction are copied from it), `account_number`, `period_start`, `period_end`, `consumption_kwh`, `max_demand_kva`, `amount_ghs`, `due_date`, `paid_at`, `document_path`, `notes`.

### outages
`jurisdiction_id`, `building_id` (optional), `started_at`, `ended_at` (empty while ongoing), `cause` (`ecg_supply`, `internal_fault`, `planned`, `unknown`), `generator_used`, `generator_hours`, `description`, `reported_by`.

### fuel_logs
`asset_id` (must be a generator), `kind` (`delivery`, `consumption`), `logged_at`, `litres`, `cost_ghs`, `run_hours_meter`, `notes`. *(Table and security are in place; the screen is a Phase II next step.)*

## Views (read-only, respect RLS)

| View | Columns |
| --- | --- |
| meter_consumption | Per reading: meter, building, utility, period_start, period_end, consumption_kwh |
| building_monthly_energy | building_id, jurisdiction_id, utility, month, consumption_kwh |
| building_monthly_cost | building_id, jurisdiction_id, month, amount_ghs, billed_kwh |
| outage_durations | Every outage column + duration_hours |

## Storage buckets

| Bucket | Public? | Limit | Used for |
| --- | --- | --- | --- |
| service-request-images | No | 5 MB, images | Public request photos |
| asset-photos | No | 5 MB, images | Nameplates, equipment |
| energy-documents | No | 10 MB, images/PDF | Scanned bills, reading photos |
| avatars | Yes | 2 MB, images | Profile pictures (`<user id>/…`) |
