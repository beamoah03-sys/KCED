/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** Phase I name for the anon key; still accepted. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_MAPBOX_TOKEN?: string;
  readonly VITE_CONTACT_EMAIL?: string;
  readonly VITE_SECURITY_PHONE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
