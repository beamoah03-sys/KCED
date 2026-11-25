// invite-user: lets admins and managers invite staff by email.
//
// Rules (enforced here, on the server):
//   - caller must be an active admin or manager
//   - admins choose any role and jurisdiction (non-admins need a jurisdiction)
//   - managers can invite technicians only, always into their own jurisdiction
//
// Request:  POST { email, role?, jurisdiction_id? }  with the caller's JWT
// Response: { ok: true, userId } or { error }
//
// Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// (set automatically by Supabase) and SITE_URL (where invite links land).

import { createClient } from "@supabase/supabase-js";
import { corsHeaders, json } from "../_shared/cors.ts";

const ROLES = ["admin", "manager", "technician"] as const;
type Role = (typeof ROLES)[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:5173";

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json(req, { error: "You are not signed in." }, 401);

  // Who is calling? Use their JWT so RLS applies to this lookup.
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await asCaller.auth.getUser();
  if (userError || !user) return json(req, { error: "Your session has expired. Sign in again." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: caller } = await admin
    .from("users")
    .select("id, role, status, jurisdiction_id")
    .eq("id", user.id)
    .single();
  if (!caller || caller.status !== "active" || !["admin", "manager"].includes(caller.role)) {
    return json(req, { error: "Only admins and managers can invite users." }, 403);
  }

  let body: { email?: string; role?: string; jurisdiction_id?: number };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid request body." }, 400);
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return json(req, { error: "Enter a valid email address." }, 400);

  let role: Role;
  let jurisdictionId: number | null;
  if (caller.role === "admin") {
    role = (ROLES as readonly string[]).includes(body.role ?? "") ? (body.role as Role) : "technician";
    jurisdictionId = role === "admin" ? null : Number(body.jurisdiction_id) || null;
    if (role !== "admin" && !jurisdictionId) {
      return json(req, { error: "Choose a jurisdiction for this user." }, 400);
    }
  } else {
    role = "technician";
    jurisdictionId = caller.jurisdiction_id;
  }

  // Refuse to re-invite someone who already has an active account.
  const { data: existing } = await admin.from("users").select("id, status").eq("email", email).maybeSingle();
  if (existing && existing.status !== "invited") {
    return json(req, { error: "This person already has an account." }, 409);
  }

  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${siteUrl}/account-setup`,
  });
  if (inviteError || !invited?.user) {
    return json(req, { error: inviteError?.message ?? "Could not send the invite." }, 400);
  }

  // The auth trigger created the profile row; now set role and jurisdiction.
  const { error: profileError } = await admin
    .from("users")
    .update({ role, jurisdiction_id: jurisdictionId, invited_by: caller.id, status: "invited" })
    .eq("id", invited.user.id);
  if (profileError) return json(req, { error: profileError.message }, 500);

  return json(req, { ok: true, userId: invited.user.id });
});
