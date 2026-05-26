/**
 * automation-execute — executor de uma automação
 *
 * Sprint 1.2 v4. Acrescenta:
 *  - LiquidJS resolveConfig antes de invocar cada átomo
 *  - atom logic.wait_fixed (devolve _suspend:true + _resumeAt)
 *  - tratamento de _suspend: persiste estado, insere automation_schedules
 *    e devolve status='waiting'
 *  - modo resume: body { execution_id, organization_id } carrega execução
 *    existente, retoma a partir do nó seguinte ao resume_node_id, mantém
 *    variables acumuladas
 *
 * Sprint 1.0+1.1 mantém: trigger.event, action.log, action.http_request,
 * action.send_telegram.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Liquid } from "npm:liquidjs@10";

type AtomOutput = Record<string, unknown>;

interface NodeExecContext {
  supabase: SupabaseClient;
  executionId: string;
  automationId: string;
  organizationId: string;
  nodeId: string;
  config: Record<string, unknown>;
  variables: Record<string, { output: unknown }>;
  triggerEvent?: { type: string; payload: unknown };
  log: (level: string, message: string) => Promise<void>;
}

interface AutomationNode {
  id: string;
  atom: string;
  position?: { x: number; y: number };
  config: Record<string, unknown>;
}

interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface AutomationDefinition {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

interface ExecuteRequest {
  // Modo normal
  automation_id?: string;
  trigger_event?: { type: string; payload: unknown };
  is_test?: boolean;
  // Modo resume
  execution_id?: string;
  // Comum
  organization_id: string;
}

// ----------------------------------------------------------------------------
// LiquidJS
// ----------------------------------------------------------------------------
const liquid = new Liquid({ cache: true, strictVariables: false, strictFilters: false });
liquid.registerFilter("money", (v: unknown): string => {
  const n = typeof v === "number" ? v : Number(v);
  if (!isFinite(n)) return String(v ?? "");
  return n.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
});

async function resolveValue(value: unknown, vars: Record<string, unknown>): Promise<unknown> {
  if (typeof value === "string") {
    try { return await liquid.parseAndRender(value, vars); } catch { return value; }
  }
  if (Array.isArray(value)) return Promise.all(value.map((v) => resolveValue(v, vars)));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await resolveValue(v, vars);
    }
    return out;
  }
  return value;
}

async function resolveConfig(config: Record<string, unknown>, vars: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) out[k] = await resolveValue(v, vars);
  return out;
}

// ----------------------------------------------------------------------------
// Átomos inline
// ----------------------------------------------------------------------------
type AtomExecFn = (ctx: NodeExecContext) => Promise<AtomOutput>;

const ATOMS: Record<string, AtomExecFn> = {
  "trigger.event": async (ctx) => ({
    event_type: ctx.triggerEvent?.type ?? "unknown",
    payload: ctx.triggerEvent?.payload ?? {},
  }),

  "action.log": async (ctx) => {
    const message = String(ctx.config.message ?? "");
    const level = String(ctx.config.level ?? "info");
    await ctx.log(level, message);
    return { message, level, logged_at: new Date().toISOString() };
  },

  "action.http_request": async (ctx) => {
    const method = String(ctx.config.method ?? "GET").toUpperCase();
    const url = String(ctx.config.url ?? "");
    if (!url) throw new Error("url é obrigatório");
    const headers = (ctx.config.headers as Record<string, string> | undefined) ?? {};
    const body = ctx.config.body as string | undefined;
    const timeoutMs = Number(ctx.config.timeout_ms ?? 10000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method, headers,
        body: method === "GET" || method === "DELETE" ? undefined : body,
        signal: controller.signal,
      });
      const text = await res.text();
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { responseHeaders[k] = v; });
      return { status: res.status, ok: res.ok, body: text, response_headers: responseHeaders };
    } finally {
      clearTimeout(timer);
    }
  },

  "action.send_telegram": async (ctx) => {
    const text = String(ctx.config.text ?? "");
    if (!text) throw new Error("text é obrigatório");
    const { data: settings, error: sErr } = await ctx.supabase
      .from("organization_settings")
      .select("telegram_crm_bot_token, telegram_crm_chat_id")
      .eq("organization_id", ctx.organizationId)
      .single();
    if (sErr || !settings?.telegram_crm_bot_token) {
      throw new Error("telegram_crm_bot_token em falta em organization_settings");
    }
    const chatId = String(ctx.config.chat_id ?? settings.telegram_crm_chat_id ?? "");
    if (!chatId) throw new Error("telegram_crm_chat_id em falta");
    const parseMode = String(ctx.config.parse_mode ?? "HTML");
    const payload: Record<string, unknown> = { chat_id: chatId, text };
    if (parseMode !== "none") payload.parse_mode = parseMode;
    const res = await fetch(`https://api.telegram.org/bot${settings.telegram_crm_bot_token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!res.ok || !json.ok) throw new Error(`Telegram API erro ${res.status}: ${json.description ?? "unknown"}`);
    return { ok: true, message_id: json.result?.message_id ?? 0, sent_at: new Date().toISOString() };
  },

  "logic.wait_fixed": async (ctx) => {
    const seconds = Number(ctx.config.seconds ?? 0);
    if (seconds < 1) return { waited_seconds: 0 };
    const resumeAt = new Date(Date.now() + seconds * 1000).toISOString();
    return { _suspend: true, _resumeAt: resumeAt, waited_seconds: seconds };
  },
};

// ----------------------------------------------------------------------------
// Helpers de grafo
// ----------------------------------------------------------------------------
function findStartNode(def: AutomationDefinition): AutomationNode | null {
  const targets = new Set(def.edges.map((e) => e.target));
  return def.nodes.find((n) => !targets.has(n.id)) ?? null;
}

function nextNode(def: AutomationDefinition, currentId: string): AutomationNode | null {
  const edge = def.edges.find((e) => e.source === currentId);
  if (!edge) return null;
  return def.nodes.find((n) => n.id === edge.target) ?? null;
}

// ----------------------------------------------------------------------------
// Helpers de variáveis
// ----------------------------------------------------------------------------
async function loadContactDealImovel(
  supabase: SupabaseClient,
  contactId: string | null,
  dealId: string | null,
  imovelId: string | null,
): Promise<{ contact: unknown; deal: unknown; imovel: unknown }> {
  const [contact, deal, imovel] = await Promise.all([
    contactId ? supabase.from("contacts").select("*").eq("id", contactId).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    dealId ? supabase.from("deals").select("*").eq("id", dealId).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    imovelId ? supabase.from("imoveis").select("*").eq("id", imovelId).maybeSingle().then((r) => r.data) : Promise.resolve(null),
  ]);
  return { contact, deal, imovel };
}

function buildVariables(
  base: { contact: unknown; deal: unknown; imovel: unknown },
  triggerEvent: { type: string; payload: unknown } | undefined,
  accumulated: Record<string, { output: unknown }>,
): Record<string, unknown> {
  return {
    contact: base.contact ?? {},
    deal: base.deal ?? {},
    imovel: base.imovel ?? {},
    trigger: triggerEvent ?? {},
    ...accumulated,
  };
}

// ----------------------------------------------------------------------------
// Handler
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const auth = req.headers.get("authorization") ?? "";
  const serviceKey = Deno.env.get("CRM_SUPABASE_SECRET_KEY") ?? Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) return new Response("Unauthorized", { status: 401 });

  let body: ExecuteRequest;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!body.organization_id) return new Response("Missing organization_id", { status: 400 });
  if (!body.automation_id && !body.execution_id) return new Response("Missing automation_id or execution_id", { status: 400 });

  const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // ----- Resolve execution + automation -----
  let executionId: string;
  let automation: { id: string; definition: AutomationDefinition; version: number; organization_id: string };
  let variables: Record<string, { output: unknown }> = {};
  let triggerEvent: { type: string; payload: unknown } | undefined;
  let startNode: AutomationNode | null;
  let contactId: string | null = null;
  let dealId: string | null = null;
  let imovelId: string | null = null;

  if (body.execution_id) {
    // ----- Modo resume -----
    const { data: exec, error: eErr } = await supabase
      .from("automation_executions")
      .select("id, organization_id, automation_id, variables, resume_node_id, trigger_event, contact_id, deal_id, imovel_id")
      .eq("id", body.execution_id)
      .single();
    if (eErr || !exec) return new Response(JSON.stringify({ error: "execution not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    if (exec.organization_id !== body.organization_id) return new Response(JSON.stringify({ error: "org mismatch" }), { status: 403, headers: { "Content-Type": "application/json" } });

    const { data: auto, error: aErr } = await supabase.from("automations").select("id, definition, version, organization_id").eq("id", exec.automation_id).single();
    if (aErr || !auto) return new Response(JSON.stringify({ error: "automation not found for execution" }), { status: 404, headers: { "Content-Type": "application/json" } });

    executionId = exec.id;
    automation = auto as typeof automation;
    variables = (exec.variables as typeof variables) ?? {};
    triggerEvent = (exec.trigger_event as typeof triggerEvent) ?? undefined;
    contactId = exec.contact_id as string | null;
    dealId = exec.deal_id as string | null;
    imovelId = exec.imovel_id as string | null;
    startNode = exec.resume_node_id ? nextNode(automation.definition, exec.resume_node_id) : findStartNode(automation.definition);

    await supabase.from("automation_executions").update({ status: "running", resume_at: null }).eq("id", executionId);
  } else {
    // ----- Modo normal: cria execução -----
    const { data: auto, error: aErr } = await supabase.from("automations").select("id, definition, version, organization_id, status").eq("id", body.automation_id!).single();
    if (aErr || !auto) return new Response(JSON.stringify({ error: "automation not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    if (auto.organization_id !== body.organization_id) return new Response(JSON.stringify({ error: "org mismatch" }), { status: 403, headers: { "Content-Type": "application/json" } });

    automation = auto as typeof automation;
    triggerEvent = body.trigger_event;
    // Tenta extrair contact/deal/imovel id do trigger payload (convenção: payload tem chave id)
    const payload = (body.trigger_event?.payload ?? {}) as Record<string, unknown>;
    if (typeof payload.id === "string") {
      // Tipos de evento naming. Heurística simples: contact.* -> contact_id, deal.* -> deal_id, imovel.* -> imovel_id
      const evtType = body.trigger_event?.type ?? "";
      if (evtType.startsWith("contact.")) contactId = payload.id;
      else if (evtType.startsWith("deal.")) dealId = payload.id;
      else if (evtType.startsWith("imovel.")) imovelId = payload.id;
    }

    startNode = findStartNode(automation.definition);
    if (!startNode) return new Response(JSON.stringify({ error: "no trigger node" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const { data: execution, error: execErr } = await supabase.from("automation_executions").insert({
      automation_id: automation.id,
      organization_id: automation.organization_id,
      automation_version: automation.version,
      status: "running",
      trigger_event: body.trigger_event ?? null,
      trigger_type: body.trigger_event?.type ?? "manual",
      contact_id: contactId,
      deal_id: dealId,
      imovel_id: imovelId,
      is_test: body.is_test ?? false,
    }).select("id").single();
    if (execErr || !execution) return new Response(JSON.stringify({ error: "failed to create execution", details: execErr }), { status: 500, headers: { "Content-Type": "application/json" } });
    executionId = execution.id as string;
  }

  // ----- Carrega contact/deal/imovel para o template context -----
  const baseRefs = await loadContactDealImovel(supabase, contactId, dealId, imovelId);

  // ----- Loop de execução -----
  const startedAt = Date.now();
  let current: AutomationNode | null = startNode;
  let errorMessage: string | null = null;
  let errorNodeId: string | null = null;
  let suspended = false;
  let resumeAt: string | null = null;
  const safetyLimit = 50;
  let count = 0;

  while (current && count < safetyLimit) {
    count += 1;
    const node: AutomationNode = current;
    const atomFn = ATOMS[node.atom];
    const nodeStart = Date.now();

    if (!atomFn) {
      const errMsg = `unknown atom: ${node.atom}`;
      await supabase.from("automation_node_executions").insert({
        execution_id: executionId, organization_id: automation.organization_id, node_id: node.id, atom_id: node.atom,
        status: "failed", input: { config: node.config }, error: errMsg, completed_at: new Date().toISOString(), duration_ms: Date.now() - nodeStart,
      });
      errorMessage = errMsg; errorNodeId = node.id; break;
    }

    // Resolve config via LiquidJS antes de passar ao átomo
    const vars = buildVariables(baseRefs, triggerEvent, variables);
    let resolvedConfig: Record<string, unknown>;
    try {
      resolvedConfig = await resolveConfig(node.config, vars);
    } catch (e) {
      resolvedConfig = node.config;
      console.error("resolveConfig falhou:", e);
    }

    const { data: nodeExec } = await supabase.from("automation_node_executions").insert({
      execution_id: executionId, organization_id: automation.organization_id, node_id: node.id, atom_id: node.atom,
      status: "running", input: { config: resolvedConfig },
    }).select("id").single();

    const ctx: NodeExecContext = {
      supabase, executionId, automationId: automation.id, organizationId: automation.organization_id, nodeId: node.id,
      config: resolvedConfig, variables, triggerEvent,
      log: async (level: string, message: string) => {
        await supabase.from("automation_node_executions").insert({
          execution_id: executionId, organization_id: automation.organization_id, node_id: `${node.id}.log`, atom_id: "system.log",
          status: "completed", output: { level, message }, completed_at: new Date().toISOString(),
        });
      },
    };

    try {
      const output = await atomFn(ctx);
      variables[node.id] = { output };

      if (nodeExec?.id) {
        await supabase.from("automation_node_executions").update({
          status: "completed", output, completed_at: new Date().toISOString(), duration_ms: Date.now() - nodeStart,
        }).eq("id", nodeExec.id);
      }

      // Detecta _suspend
      const out = output as { _suspend?: boolean; _resumeAt?: string };
      if (out?._suspend === true && out._resumeAt) {
        suspended = true;
        resumeAt = out._resumeAt;
        await supabase.from("automation_executions").update({
          status: "waiting", current_node_id: node.id, resume_node_id: node.id, resume_at: resumeAt, variables,
        }).eq("id", executionId);
        await supabase.from("automation_schedules").insert({
          execution_id: executionId, organization_id: automation.organization_id, scheduled_for: resumeAt,
          resume_node_id: node.id, status: "pending",
        });
        break;
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (nodeExec?.id) {
        await supabase.from("automation_node_executions").update({
          status: "failed", error: errMsg, completed_at: new Date().toISOString(), duration_ms: Date.now() - nodeStart,
        }).eq("id", nodeExec.id);
      }
      errorMessage = errMsg; errorNodeId = node.id; break;
    }

    current = nextNode(automation.definition, node.id);
  }

  // ----- Final -----
  const durationMs = Date.now() - startedAt;

  if (suspended) {
    return new Response(JSON.stringify({
      execution_id: executionId, status: "waiting", resume_at: resumeAt, nodes_executed: count,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const finalStatus = errorMessage ? "failed" : "completed";
  await supabase.from("automation_executions").update({
    status: finalStatus, completed_at: new Date().toISOString(), duration_ms: durationMs,
    variables, error_message: errorMessage, error_node_id: errorNodeId,
  }).eq("id", executionId);

  return new Response(JSON.stringify({
    execution_id: executionId, status: finalStatus, duration_ms: durationMs, nodes_executed: count, error: errorMessage,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
