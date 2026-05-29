/**
 * automation-resume — retoma execuções suspensas cujo resume_at já chegou
 *
 * Sprint 1.2, commit 3 de 4.
 *
 * Estratégia:
 *  1. SELECT automation_schedules WHERE status='pending' AND scheduled_for <= NOW()
 *     LIMIT 50 ORDER BY scheduled_for ASC.
 *  2. Para cada schedule, marca 'fired' (idempotência) e invoca
 *     automation-execute em modo resume com { execution_id, organization_id }.
 *  3. Retorno: { fired, invocations }.
 *
 * Auth dual:
 *  - Authorization Bearer === SUPABASE_SERVICE_ROLE_KEY (invocação manual)
 *  - X-Cron-Secret === get_automation_cron_secret() (chamada pelo pg_cron)
 *
 * verify_jwt=false (igual ao event-listener) porque pg_cron não tem JWT.
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

async function invokeExecuteResume(
  supabaseUrl: string,
  serviceKey: string,
  executionId: string,
  organizationId: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const url = `${supabaseUrl}/functions/v1/automation-execute`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ execution_id: executionId, organization_id: organizationId }),
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
  if (req.method !== "POST" && req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

  const serviceKey = Deno.env.get("CRM_SUPABASE_SECRET_KEY") ?? Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  if (!serviceKey || !supabaseUrl) return new Response("Server misconfigured", { status: 500 });

  const auth = req.headers.get("authorization") ?? "";
  const headerCronSecret = req.headers.get("x-cron-secret") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  const isService = auth === `Bearer ${serviceKey}`;
  let isCron = false;
  if (!isService && headerCronSecret) {
    const expected = await loadCronSecret(supabase);
    if (expected && headerCronSecret === expected) isCron = true;
  }
  if (!isService && !isCron) return new Response("Unauthorized", { status: 401 });

  // 1. SELECT schedules due
  const { data: schedules, error: sErr } = await supabase
    .from("automation_schedules")
    .select("id, execution_id, organization_id")
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(BATCH_SIZE);

  if (sErr) return new Response(JSON.stringify({ error: "failed to fetch schedules", details: sErr }), { status: 500, headers: { "Content-Type": "application/json" } });

  const rows = (schedules ?? []) as Array<{ id: string; execution_id: string; organization_id: string }>;
  if (rows.length === 0) return new Response(JSON.stringify({ fired: 0, invocations: 0 }), { status: 200, headers: { "Content-Type": "application/json" } });

  // 2. Marca 'fired' imediatamente (idempotência: se cron correr duplicado, segundo verifica status)
  const ids = rows.map((r) => r.id);
  await supabase.from("automation_schedules").update({ status: "fired", fired_at: new Date().toISOString() }).in("id", ids);

  // 3. Dedupe por execution_id: uma execução pode ter vários ramos suspensos
  //    (várias schedules). O runner multi-frame retoma todos os ramos devidos
  //    numa só invocação, por isso basta invocar automation-execute 1x por
  //    execução (o claim CAS protege contra resumes concorrentes na mesma row).
  const byExecution = new Map<string, { execution_id: string; organization_id: string }>();
  for (const row of rows) {
    if (!byExecution.has(row.execution_id)) {
      byExecution.set(row.execution_id, { execution_id: row.execution_id, organization_id: row.organization_id });
    }
  }
  const executions = [...byExecution.values()];

  // 4. Invoca automation-execute em paralelo (uma vez por execução)
  const invocations: Array<{ execution_id: string; ok: boolean; status: number; body: string }> = [];
  await runInChunks(executions, PARALLEL_LIMIT, async (e) => {
    const r = await invokeExecuteResume(supabaseUrl, serviceKey, e.execution_id, e.organization_id);
    invocations.push({ execution_id: e.execution_id, ...r });
    return r;
  });

  return new Response(JSON.stringify({ fired: rows.length, invocations: invocations.length, results: invocations.map((i) => ({ execution_id: i.execution_id, ok: i.ok, status: i.status })) }), { status: 200, headers: { "Content-Type": "application/json" } });
});
