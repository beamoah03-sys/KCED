# 0003 — Store cumulative meter readings, derive consumption

**Date:** 2026-11-12 · **Status:** accepted

## Context
Staff read meters by hand at irregular intervals; later, smart meters will send data automatically.

## Decision
Store the cumulative register value (`meter_readings.reading_kwh`) with its timestamp, and compute consumption as the difference between consecutive readings × the meter multiplier (`meter_consumption` view). A falling register requires a note and counts as zero.

## Consequences
- A missed reading does not lose energy: the next reading covers the gap.
- Typos are caught early (a reading below the previous one is rejected without a note).
- Monthly figures attribute a period to the month it ends in; with roughly monthly readings this is accurate enough for reporting. Daily data from smart meters can use the same tables.
