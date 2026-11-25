/**
 * Typed access to the VITE_* environment variables (see .env.example).
 *
 * Phase I's .env.example named VITE_SUPABASE_ANON_KEY while the code read
 * VITE_SUPABASE_PUBLISHABLE_KEY; both names are accepted now.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as
  string | undefined;

export const envMissing: string[] = [!url && "VITE_SUPABASE_URL", !key && "VITE_SUPABASE_ANON_KEY"].filter(
  Boolean,
) as string[];

if (envMissing.length > 0) {
  console.error(
    `Missing environment variables: ${envMissing.join(", ")}. Copy .env.example to .env.local and fill them in.`,
  );
}

export const env = {
  // Placeholders keep the client constructible so the page can show a
  // helpful message instead of a blank screen.
  supabaseUrl: url ?? "http://localhost:54321",
  supabaseAnonKey: key ?? "missing-anon-key",
  mapboxToken: (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) ?? "",
  contactEmail: (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ?? "",
  securityPhone: (import.meta.env.VITE_SECURITY_PHONE as string | undefined) ?? "",
};
