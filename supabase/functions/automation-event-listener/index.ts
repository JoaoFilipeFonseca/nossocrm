/**
 * automation-event-listener — processa eventos pendentes e despoleta automações
 *
 * Sprint 1.0, commits 3+4 de 5.
 *
 * Auth (duas vias aceites):
 *   - Authorization Bearer === SUPABASE_SERVICE_ROLE_KEY (invocação manual)
 *   - X-Cron-Secret === get_automation_cron_secret() (chamada pelo pg_cron)
 *
 * verify_jwt=false na configuração porque o pg_cron não tem JWT para
 * apresentar. A validação dura é feita aqui no corpo da função.
 *
 * O cron secret é lido via RPC get_automation_cron_secret (service_role only)
 * e cacheado em memória entre invocações (warm starts).
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const BATCH_SIZE = 50;
const PARALLEL_LIMIT = 5;

let cachedCronSecret: string | null = null;

async function loadCronSecret(supabase: SupabaseClient): Promise<string | null> {
  if (cachedCronSecret) return cachedCronSecret;
  const { data, error } = await supabase.rpc("get_automation_cron_secret");
  if (error || !data) return null;
  cachedCronSecret = data as string;
  return cachedCronSecret;
}

interface AutomationEventRow {
  id: string;
  organization_id: string;
  event_type: string;
  payload: Record<string, unknown>;
}

interface TriggerMatch {
  automation_id: string;
  organization_id: string;
}

async function findMatchingAutomations(
  supabase: SupabaseClient,
  orgId: string,
  eventType: string,
): Promise<TriggerMatch[]> {
  const { data, error } = await supabase
    .from("automation_triggers")
    .select("automation_id, organization_id, config, automations!inner(status)")
    .eq("organization_id", orgId)
    .eq("trigger_type", "event")
    .eq("is_active", true)
    .eq("automations.status", "active");

  if (error || !data) return [];

  const matches: TriggerMatch[] = [];
  for (const row of data as Array<{
    automation_id: string;
    organization_id: string;
    config: { events?: string[] } | null;
  }>) {
    const events = row.config?.events ?? [];
    if (events.includes(eventType)) {
      matches.push({ automation_id: row.automation_id, organization_id: row.organization_id });
    }
  }
  return matches;
}

async function invokeExecute(
  supabaseUrl: string,
  serviceKey: string,
  automationId: string,
  organizationId: string,
  triggerEvent: { type: string; payload: unknown },
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${supabaseUrl}/functions/v1/automation-execute`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        automation_id: automationId,
        organization_id: organizationId,
        trigger_event: triggerEvent,
      }),
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : String(e) };
  }
}

async function runInChunks<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map(fn));
    results.push(...chunkResults);
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const serviceKey =
    Deno.env.get("CRM_SUPABASE_SECRET_KEY") ??
    Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";
  const supabaseUrl =
    Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKey || !supabaseUrl) {
    return new Response("Server misconfigured", { status: 500 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const headerCronSecret = req.headers.get("x-cron-secret") ?? "";

  const supabase = createClient(supabaseUrl, serviceKey);

  const isService = auth === `Bearer ${serviceKey}`;
  let isCron = false;
  if (!isService && headerCronSecret) {
    const expected = await loadCronSecret(supabase);
    if (expected && headerCronSecret === expected) {
      isCron = true;
    }
  }

  if (!isService && !isCron) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: events, error: evErr } = await supabase
    .from("automation_events")
    .select("id, organization_id, event_type, payload")
    .eq("processed", false)
    .order("occurred_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (evErr) {
    return new Response(JSON.stringify({ error: "failed to fetch events", details: evErr }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventRows = (events ?? []) as AutomationEventRow[];
  if (eventRows.length === 0) {
    return new Response(JSON.stringify({ processed: 0, matched: 0, invocations: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let totalMatches = 0;
  let totalInvocations = 0;
  const invocationPromises: Promise<unknown>[] = [];

  for (const event of eventRows) {
    const matches = await findMatchingAutomations(supabase, event.organization_id, event.event_type);
    totalMatches += matches.length;

    for (const match of matches) {
      totalInvocations += 1;
      invocationPromises.push(
        invokeExecute(supabaseUrl, serviceKey, match.automation_id, match.organization_id, {
          type: event.event_type,
          payload: event.payload,
        }),
      );
    }
  }

  await runInChunks(invocationPromises, PARALLEL_LIMIT, (p) => p);

  const eventIds = eventRows.map((e) => e.id);
  await supabase
    .from("automation_events")
    .update({ processed: true, processed_at: new Date().toISOString() })
    .in("id", eventIds);

  return new Response(
    JSON.stringify({
      processed: eventRows.length,
      matched: totalMatches,
      invocations: totalInvocations,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
