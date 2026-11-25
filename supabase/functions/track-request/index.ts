// track-request: public lookup of a service request by its number.
//
// Returns only what the reporter needs (number, status, dates). No names,
// phone numbers or descriptions leave the database.
//
// Request:  POST { requestNumber }
// Response: { data: { requestNumber, status, createdAt, updatedAt, workOrderStatus } | null }

import { createClient } from "@supabase/supabase-js";
import { corsHeaders, json } from "../_shared/cors.ts";

const NUMBER_RE = /^[A-Za-z0-9-]{3,30}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  let requestNumber = "";
  try {
    requestNumber = String((await req.json()).requestNumber ?? "").trim().toUpperCase();
  } catch {
    return json(req, { error: "Invalid request body." }, 400);
  }
  if (!NUMBER_RE.test(requestNumber)) return json(req, { data: null });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin
    .from("service_requests")
    .select("request_number, status, created_at, updated_at, work_orders(status)")
    .eq("request_number", requestNumber)
    .maybeSingle();

  if (error) return json(req, { error: "Lookup failed. Please try again." }, 500);
  if (!data) return json(req, { data: null });

  const workOrders = (data.work_orders ?? []) as { status: string }[];
  return json(req, {
    data: {
      requestNumber: data.request_number,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      workOrderStatus: workOrders[0]?.status ?? null,
    },
  });
});
