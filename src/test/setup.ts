import "@testing-library/jest-dom/vitest";

// Tests never talk to a real Supabase project: src/lib/env.ts falls back to
// placeholder values when VITE_SUPABASE_* are not set.
