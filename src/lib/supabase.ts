import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * The single Supabase client for the app. The anon (publishable) key is safe
 * in the browser: Row Level Security in `supabase/migrations` decides what
 * each user can read and write.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/** Supabase/PostgREST returns at most this many rows per request. */
export const PAGE_SIZE = 1000;

interface RangeResult<T> {
  data: T[] | null;
  error: unknown;
}

/**
 * Fetch every row of a query by paging through it with `.range()`.
 *
 * Phase I fetched whole tables in one request, which silently stopped at the
 * server's 1,000-row limit. Pass a function that builds the (ordered) query
 * for a given range; it is called until a short page comes back.
 *
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase.from("assets").select("*").order("created_at").range(from, to));
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<RangeResult<T>>,
  { pageSize = PAGE_SIZE, maxRows = 50_000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

/** Turn a Supabase/PostgREST error into a message fit for a toast. */
export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  const e = error as { message?: string; code?: string };
  // Our database triggers raise readable messages with code P0001/42501.
  if (e.code === "P0001" || e.code === "42501") return e.message ?? fallback;
  if (e.code === "23505") return "That value is already in use.";
  if (e.code === "23514") return "Some values are not valid. Check the form and try again.";
  if (e.code === "PGRST301" || e.message?.includes("JWT")) return "Your session has expired. Please sign in again.";
  return e.message ?? fallback;
}
