/**
 * automation-execute — executor de uma automação
 *
 * Sprint 1.0, commit 2 de 5.
 *
 * Recebe { automation_id, trigger_event, organization_id } e:
 *   1. Lê a automação em automations.definition.
 *   2. Insere linha em automation_executions (status='running').
 *   3. Percorre nós a partir do trigger, executando cada um.
 *   4. Para cada nó, insere em automation_node_executions com input/output.
 *   5. Marca a execução completed/failed no fim.
 *
 * Sprint 1.0 só suporta fluxos lineares (1 saída por nó). Branching e
 * loops entram no Sprint 4 (logic.condition, logic.switch, logic.loop).
 *
 * Átomos suportados nesta versão (inline):
 *   - trigger.event
 *   - action.log
 *
 * Sprint 1.3 substitui o registry inline por auto-discovery a partir
 * de /lib/automation-engine/plugins (via partilha de código Deno-Next).
 *
 * Autenticação: aceita apenas chamadas com header Authorization Bearer
 * igual ao SUPABASE_SERVICE_ROLE_KEY. Não há acesso público.
 */
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

// ----------------------------------------------------------------------------
// Tipos mínimos (Deno-side, espelham lib/automation-engine/types.ts)
// ----------------------------------------------------------------------------
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
  automation_id: string;
  organization_id: string;
  trigger_event?: { type: string; payload: unknown };
  is_test?: boolean;
}

// ----------------------------------------------------------------------------
// Registry inline de átomos (Sprint 1.0)
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
        method,
        headers,
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!res.ok || !json.ok) throw new Error(`Telegram API erro ${res.status}: ${json.description ?? "unknown"}`);
    return { ok: true, message_id: json.result?.message_id ?? 0, sent_at: new Date().toISOString() };
  },
};

// ----------------------------------------------------------------------------
// Util: encontra nó trigger e segue edges em sequência
// ----------------------------------------------------------------------------
function findStartNode(def: AutomationDefinition): AutomationNode | null {
  // Trigger = nó sem edges incoming. Versão Sprint 1.0 simplificada.
  const targets = new Set(def.edges.map((e) => e.target));
  return def.nodes.find((n) => !targets.has(n.id)) ?? null;
}

function nextNode(
  def: AutomationDefinition,
  currentId: string,
): AutomationNode | null {
  const edge = def.edges.find((e) => e.source === currentId);
  if (!edge) return null;
  return def.nodes.find((n) => n.id === edge.target) ?? null;
}

// ----------------------------------------------------------------------------
// Handler principal
// ----------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const serviceKey =
    Deno.env.get("CRM_SUPABASE_SECRET_KEY") ??
    Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    "";
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: ExecuteRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.automation_id || !body.organization_id) {
    return new Response("Missing automation_id or organization_id", { status: 400 });
  }

  const supabaseUrl =
    Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // 1. Carrega automação
  const { data: automation, error: autoErr } = await supabase
    .from("automations")
    .select("id, definition, version, organization_id, status")
    .eq("id", body.automation_id)
    .single();

  if (autoErr || !automation) {
    return new Response(JSON.stringify({ error: "automation not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (automation.organization_id !== body.organization_id) {
    return new Response(JSON.stringify({ error: "org mismatch" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const definition = automation.definition as AutomationDefinition;
  const startNode = findStartNode(definition);
  if (!startNode) {
    return new Response(JSON.stringify({ error: "no trigger node" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Cria automation_executions
  const { data: execution, error: execErr } = await supabase
    .from("automation_executions")
    .insert({
      automation_id: automation.id,
      organization_id: automation.organization_id,
      automation_version: automation.version,
      status: "running",
      trigger_event: body.trigger_event ?? null,
      trigger_type: body.trigger_event?.type ?? "manual",
      is_test: body.is_test ?? false,
    })
    .select("id")
    .single();

  if (execErr || !execution) {
    return new Response(JSON.stringify({ error: "failed to create execution", details: execErr }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const executionId = execution.id as string;
  const variables: Record<string, { output: unknown }> = {};
  const startedAt = Date.now();

  // 3. Percorre nós
  let current: AutomationNode | null = startNode;
  let errorMessage: string | null = null;
  let errorNodeId: string | null = null;
  const safetyLimit = 50; // protecção contra loops infinitos antes do Sprint 4
  let count = 0;

  while (current && count < safetyLimit) {
    count += 1;
    const node: AutomationNode = current;
    const atomFn = ATOMS[node.atom];
    const nodeStart = Date.now();

    if (!atomFn) {
      const errMsg = `unknown atom: ${node.atom}`;
      await supabase.from("automation_node_executions").insert({
        execution_id: executionId,
        organization_id: automation.organization_id,
        node_id: node.id,
        atom_id: node.atom,
        status: "failed",
        input: { config: node.config },
        error: errMsg,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - nodeStart,
      });
      errorMessage = errMsg;
      errorNodeId = node.id;
      break;
    }

    // Insere row pending antes da execução (para Realtime mostrar)
    const { data: nodeExec } = await supabase
      .from("automation_node_executions")
      .insert({
        execution_id: executionId,
        organization_id: automation.organization_id,
        node_id: node.id,
        atom_id: node.atom,
        status: "running",
        input: { config: node.config },
      })
      .select("id")
      .single();

    const ctx: NodeExecContext = {
      supabase,
      executionId,
      automationId: automation.id,
      organizationId: automation.organization_id,
      nodeId: node.id,
      config: node.config,
      variables,
      triggerEvent: body.trigger_event,
      log: async (level: string, message: string) => {
        // Log entra como linha extra em node_executions com atom_id 'system.log'.
        await supabase.from("automation_node_executions").insert({
          execution_id: executionId,
          organization_id: automation.organization_id,
          node_id: `${node.id}.log`,
          atom_id: "system.log",
          status: "completed",
          output: { level, message },
          completed_at: new Date().toISOString(),
        });
      },
    };

    try {
      const output = await atomFn(ctx);
      variables[node.id] = { output };

      if (nodeExec?.id) {
        await supabase
          .from("automation_node_executions")
          .update({
            status: "completed",
            output,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - nodeStart,
          })
          .eq("id", nodeExec.id);
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (nodeExec?.id) {
        await supabase
          .from("automation_node_executions")
          .update({
            status: "failed",
            error: errMsg,
            completed_at: new Date().toISOString(),
            duration_ms: Date.now() - nodeStart,
          })
          .eq("id", nodeExec.id);
      }
      errorMessage = errMsg;
      errorNodeId = node.id;
      break;
    }

    current = nextNode(definition, node.id);
  }

  // 4. Marca execução final
  const durationMs = Date.now() - startedAt;
  const finalStatus = errorMessage ? "failed" : "completed";

  await supabase
    .from("automation_executions")
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      duration_ms: durationMs,
      variables,
      error_message: errorMessage,
      error_node_id: errorNodeId,
    })
    .eq("id", executionId);

  return new Response(
    JSON.stringify({
      execution_id: executionId,
      status: finalStatus,
      duration_ms: durationMs,
      nodes_executed: count,
      error: errorMessage,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
