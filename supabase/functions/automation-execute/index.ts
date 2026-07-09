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
import {
  runGraph,
  findStartNode,
  nextTarget,
  createInitialState,
  serializeState,
  deserializeState,
  wakeDueSuspends,
  type AutomationDefinition,
  type AutomationNode,
  type AtomOutput,
  type RunnerDeps,
  type RunnerState,
  type SerializedRunState,
} from "../_shared/runner.ts";

interface NodeExecContext {
  supabase: SupabaseClient;
  executionId: string;
  automationId: string;
  organizationId: string;
  nodeId: string;
  config: Record<string, unknown>;
  // Config crua (sem render Liquid). Usada por átomos que precisam do valor real
  // e não da versão stringificada, ex: logic.loop a resolver um array.
  rawConfig: Record<string, unknown>;
  // Scope completo (baseContext + variáveis acumuladas + item/index do loop).
  scope: Record<string, unknown>;
  variables: Record<string, { output: unknown }>;
  triggerEvent?: { type: string; payload: unknown };
  log: (level: string, message: string) => Promise<void>;
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

/**
 * Resolve um valor para um array REAL (sem stringificar via Liquid). Aceita:
 *  - um array literal já presente na config;
 *  - uma expressão Liquid de um único bind "{{ contact.deals }}" (avaliada com
 *    evalValue para devolver o valor real);
 *  - uma string JSON de array.
 * Devolve [] se nada resolver para array.
 */
async function resolveToArray(raw: unknown, scope: Record<string, unknown>): Promise<unknown[]> {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const expr = raw.trim();
    const single = expr.match(/^\{\{\s*([\s\S]+?)\s*\}\}$/);
    if (single) {
      try {
        const v = await liquid.evalValue(single[1], scope);
        if (Array.isArray(v)) return v;
        if (v !== null && v !== undefined) return [v];
      } catch { /* cai para JSON abaixo */ }
    }
    try {
      const v = JSON.parse(expr);
      if (Array.isArray(v)) return v;
    } catch { /* não é JSON */ }
  }
  return [];
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

  // action.send_email — envia via canal Resend connected da org (messaging_channels).
  // Paridade com lib/automation-engine/plugins/actions/send-email.ts (incl. RGPD:
  // opt-out + rodapé de anular subscrição/política — lógica espelhada de
  // lib/messaging/emailCompliance.ts; mexer lá = mexer aqui).
  "action.send_email": async (ctx) => {
    const to = String(ctx.config.to ?? "").trim();
    const subject = String(ctx.config.subject ?? "").trim();
    const text = String(ctx.config.text ?? "").trim();
    const html = ctx.config.html ? String(ctx.config.html) : undefined;
    const replyToOverride = (ctx.config.reply_to as string | undefined) || null;
    const overrideChannelId = (ctx.config.channel_id as string | undefined) || null;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !EMAIL_RE.test(to)) throw new Error(`to (email) inválido: ${to}`);
    if (!subject) throw new Error("subject é obrigatório");
    if (!text) throw new Error("text é obrigatório");

    // RGPD (MKT-SEQUENCES Fatia 1): contacto com opt-out nunca recebe.
    const { data: optedOut, error: optErr } = await ctx.supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", ctx.organizationId)
      .eq("email_opt_out", true)
      .ilike("email", to.replace(/[\\%_]/g, (m) => `\\${m}`))
      .limit(1);
    if (optErr) throw new Error(`Falha a verificar opt-out: ${optErr.message}`);
    if (optedOut && optedOut.length > 0) {
      return { ok: false, skipped: "opt_out", to, checked_at: new Date().toISOString() };
    }

    let q = ctx.supabase
      .from("messaging_channels")
      .select("id, credentials, provider, channel_type, status")
      .eq("organization_id", ctx.organizationId)
      .eq("provider", "resend")
      .eq("channel_type", "email")
      .is("deleted_at", null);
    q = overrideChannelId ? q.eq("id", overrideChannelId) : q.eq("status", "connected");
    const { data: emailChannels, error: emErr } = await q.order("updated_at", { ascending: false }).limit(1);
    if (emErr) throw new Error(`Falha a ler messaging_channels: ${emErr.message}`);
    const channel = emailChannels?.[0] as { id: string; credentials: Record<string, unknown> } | undefined;
    if (!channel) {
      throw new Error(
        overrideChannelId
          ? `Canal ${overrideChannelId} não encontrado ou não é Resend email`
          : "Sem canal Resend connected. Configura em Definições, Integrações (requer DKIM/SPF em joaofilipefonseca.pt).",
      );
    }
    const creds = (channel.credentials || {}) as { apiKey?: string; fromName?: string; fromEmail?: string; replyTo?: string };
    if (!creds.apiKey || !creds.fromEmail) throw new Error("Credenciais Resend incompletas (apiKey e fromEmail obrigatórios)");
    // from_name opcional sobrepõe o nome do canal (ex: marca pessoal sem agência).
    const fromNameOverride = (ctx.config.from_name as string | undefined)?.trim() || null;
    const effectiveFromName = fromNameOverride ?? creds.fromName;
    const fromHeader = effectiveFromName ? `${effectiveFromName} <${creds.fromEmail}>` : creds.fromEmail;
    const replyTo = replyToOverride || creds.replyTo;

    // RGPD: rodapé com anular subscrição (HMAC do Vault) + política de privacidade.
    let unsubscribeUrl: string | null = null;
    const { data: unsubSecret } = await ctx.supabase.rpc("get_email_unsubscribe_secret");
    if (typeof unsubSecret === "string" && unsubSecret.length > 0) {
      const encUn = new TextEncoder();
      const hmacKey = await crypto.subtle.importKey(
        "raw", encUn.encode(unsubSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC", hmacKey, encUn.encode(`${ctx.organizationId}:${to.toLowerCase()}`),
      );
      const tokenHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
      const unsubBase = Deno.env.get("CRM_APP_BASE_URL") ?? "https://crm.joaofilipefonseca.pt";
      const u = new URL("/unsubscribe", unsubBase);
      u.searchParams.set("o", ctx.organizationId);
      u.searchParams.set("e", to.toLowerCase());
      u.searchParams.set("t", tokenHex);
      unsubscribeUrl = u.toString();
    }
    const { data: orgPrivacy } = await ctx.supabase
      .from("organization_settings")
      .select("privacy_policy_url")
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    const privacyPolicyUrl = (orgPrivacy as { privacy_policy_url?: string | null } | null)?.privacy_policy_url
      || "https://joaofilipefonseca.pt/privacidade";
    const senderName = creds.fromName || creds.fromEmail;
    const reason = `Recebeu este email porque partilhou o seu contacto com ${senderName}.`;
    const textFooterLines = ["", "", "____________________", "", reason];
    if (unsubscribeUrl) textFooterLines.push(`Anular subscrição: ${unsubscribeUrl}`);
    textFooterLines.push(`Política de privacidade: ${privacyPolicyUrl}`);
    const footeredText = `${text}${textFooterLines.join("\n")}`;
    let footeredHtml: string | undefined;
    if (html) {
      const links = [
        unsubscribeUrl
          ? `<a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Anular subscrição</a>`
          : null,
        `<a href="${privacyPolicyUrl}" style="color:#64748b;text-decoration:underline;">Política de privacidade</a>`,
      ].filter(Boolean).join(" &nbsp;·&nbsp; ");
      footeredHtml = `${html}<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;`
        + `font-size:12px;line-height:1.6;color:#64748b;font-family:Arial,Helvetica,sans-serif;">`
        + `<p style="margin:0 0 6px;">${reason}</p><p style="margin:0;">${links}</p></div>`;
    }

    const emailBody: Record<string, unknown> = { from: fromHeader, to: [to], subject, text: footeredText };
    if (footeredHtml) emailBody.html = footeredHtml;
    if (replyTo) emailBody.reply_to = replyTo;
    if (unsubscribeUrl) emailBody.headers = { "List-Unsubscribe": `<${unsubscribeUrl}>` };
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${creds.apiKey}` },
      body: JSON.stringify(emailBody),
    });
    const emailJson = await emailRes.json().catch(() => ({})) as { id?: string; error?: { message?: string }; message?: string; statusCode?: number };
    if (!emailRes.ok || emailJson.error || (emailJson.statusCode && emailJson.statusCode >= 400)) {
      const errMsg = emailJson.error?.message || emailJson.message || `Resend API ${emailRes.status}`;
      throw new Error(`Email envio falhou: ${errMsg}`);
    }
    return { ok: true, external_message_id: emailJson.id || "", sent_at: new Date().toISOString(), channel_id: channel.id };
  },

  // action.send_whatsapp — envia texto via canal WhatsApp Meta Cloud connected da org.
  // Paridade com lib/automation-engine/plugins/actions/send-whatsapp.ts.
  "action.send_whatsapp": async (ctx) => {
    const to = String(ctx.config.to ?? "").replace(/\D/g, "");
    const text = String(ctx.config.text ?? "").trim();
    const overrideChannelId = (ctx.config.channel_id as string | undefined) || null;
    if (!to) throw new Error("to (telefone) é obrigatório");
    if (!text) throw new Error("text é obrigatório");

    let q = ctx.supabase
      .from("messaging_channels")
      .select("id, credentials, provider, channel_type, status")
      .eq("organization_id", ctx.organizationId)
      .eq("provider", "meta_cloud")
      .eq("channel_type", "whatsapp")
      .is("deleted_at", null);
    q = overrideChannelId ? q.eq("id", overrideChannelId) : q.eq("status", "connected");
    const { data: waChannels, error: waErr } = await q.order("updated_at", { ascending: false }).limit(1);
    if (waErr) throw new Error(`Falha a ler messaging_channels: ${waErr.message}`);
    const waChannel = waChannels?.[0] as { id: string; credentials: Record<string, unknown> } | undefined;
    if (!waChannel) {
      throw new Error(
        overrideChannelId
          ? `Canal ${overrideChannelId} não encontrado ou não é Meta Cloud WhatsApp`
          : "Sem canal WhatsApp Meta Cloud connected. Configura em Definições, Integrações.",
      );
    }
    const waCreds = (waChannel.credentials || {}) as { phoneNumberId?: string; accessToken?: string; apiVersion?: string };
    if (!waCreds.phoneNumberId || !waCreds.accessToken) throw new Error("Credenciais Meta Cloud incompletas (phoneNumberId e accessToken obrigatórios)");
    const apiVersion = waCreds.apiVersion || "v21.0";
    const waRes = await fetch(`https://graph.facebook.com/${apiVersion}/${waCreds.phoneNumberId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${waCreds.accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body: text },
      }),
    });
    const waJson = await waRes.json().catch(() => ({})) as { messages?: { id: string }[]; error?: { message: string } };
    if (!waRes.ok || waJson.error) {
      const errMsg = waJson.error?.message || `Meta API ${waRes.status}`;
      throw new Error(`WhatsApp envio falhou: ${errMsg}`);
    }
    return { ok: true, external_message_id: waJson.messages?.[0]?.id || "", sent_at: new Date().toISOString(), channel_id: waChannel.id };
  },

  "logic.loop": async (ctx) => {
    // Resolve o array a iterar a partir da config crua (não stringificada).
    const items = await resolveToArray(ctx.rawConfig.items, ctx.scope);
    const maxIter = Number(ctx.config.max_iterations ?? 100);
    const parallel = ctx.config.parallel === true || ctx.config.parallel === "true";
    const limited = items.slice(0, Number.isFinite(maxIter) && maxIter > 0 ? maxIter : 100);
    // _loop sinaliza ao runner para gerir as iterações (handleLoop).
    return {
      _loop: true,
      items_resolved: limited,
      max_iterations: Number.isFinite(maxIter) && maxIter > 0 ? maxIter : 100,
      parallel,
      count: limited.length,
    };
  },

  "logic.wait_fixed": async (ctx) => {
    const seconds = Number(ctx.config.seconds ?? 0);
    if (seconds < 1) return { waited_seconds: 0 };
    const resumeAt = new Date(Date.now() + seconds * 1000).toISOString();
    return { _suspend: true, _resumeAt: resumeAt, waited_seconds: seconds };
  },

  "action.modify_contact": async (ctx) => {
    const contactId = String(ctx.config.contact_id ?? "");
    if (!contactId) throw new Error('contact_id em falta. Usa "{{ contact.id }}".');
    const patch: Record<string, unknown> = {};
    if (typeof ctx.config.stage === "string" && ctx.config.stage) patch.stage = ctx.config.stage;
    if (typeof ctx.config.status === "string" && ctx.config.status) patch.status = ctx.config.status;
    if (typeof ctx.config.notes === "string") patch.notes = ctx.config.notes;
    if (typeof ctx.config.append_notes === "string" && ctx.config.append_notes) {
      const { data: row } = await ctx.supabase.from("contacts").select("notes").eq("id", contactId).eq("organization_id", ctx.organizationId).maybeSingle();
      const existing = (row?.notes as string | null) ?? "";
      patch.notes = existing ? `${existing}\n${ctx.config.append_notes}` : String(ctx.config.append_notes);
    }
    if (Object.keys(patch).length === 0) throw new Error("nenhum campo para actualizar");
    const { data, error } = await ctx.supabase.from("contacts").update(patch).eq("id", contactId).eq("organization_id", ctx.organizationId).select("id").maybeSingle();
    if (error) throw new Error(`supabase: ${error.message}`);
    if (!data) throw new Error("contacto não encontrado nesta organização");
    return { contact_id: contactId, updated_fields: Object.keys(patch) };
  },

  "action.modify_deal": async (ctx) => {
    const dealId = String(ctx.config.deal_id ?? "");
    if (!dealId) throw new Error('deal_id em falta. Usa "{{ deal.id }}".');
    const patch: Record<string, unknown> = {};
    if (typeof ctx.config.status === "string" && ctx.config.status) patch.status = ctx.config.status;
    if (typeof ctx.config.priority === "string" && ctx.config.priority) patch.priority = ctx.config.priority;
    if (ctx.config.value !== undefined && ctx.config.value !== null && ctx.config.value !== "") {
      const v = Number(ctx.config.value);
      if (!Number.isFinite(v)) throw new Error("value tem de ser número");
      patch.value = v;
    }
    if (Array.isArray(ctx.config.tags)) patch.tags = (ctx.config.tags as unknown[]).map(String);
    if (typeof ctx.config.append_tag === "string" && ctx.config.append_tag) {
      const { data: row } = await ctx.supabase.from("deals").select("tags").eq("id", dealId).eq("organization_id", ctx.organizationId).maybeSingle();
      const existing = Array.isArray(row?.tags) ? (row.tags as string[]) : [];
      const tag = String(ctx.config.append_tag);
      patch.tags = existing.includes(tag) ? existing : [...existing, tag];
    }
    if (Object.keys(patch).length === 0) throw new Error("nenhum campo para actualizar");
    const { data, error } = await ctx.supabase.from("deals").update(patch).eq("id", dealId).eq("organization_id", ctx.organizationId).select("id").maybeSingle();
    if (error) throw new Error(`supabase: ${error.message}`);
    if (!data) throw new Error("deal não encontrado nesta organização");
    return { deal_id: dealId, updated_fields: Object.keys(patch) };
  },

  "action.create_task": async (ctx) => {
    const title = String(ctx.config.title ?? "").trim();
    if (!title) throw new Error("title é obrigatório");
    let date: string;
    if (typeof ctx.config.due_at === "string" && ctx.config.due_at) {
      date = new Date(ctx.config.due_at).toISOString();
    } else {
      const hours = Number(ctx.config.due_in_hours ?? 24);
      date = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    }
    const payload: Record<string, unknown> = {
      organization_id: ctx.organizationId,
      title,
      description: typeof ctx.config.description === "string" ? ctx.config.description : null,
      type: typeof ctx.config.type === "string" && ctx.config.type ? ctx.config.type : "follow_up",
      date,
      completed: false,
    };
    const cid = String(ctx.config.contact_id ?? "");
    const did = String(ctx.config.deal_id ?? "");
    if (cid) payload.contact_id = cid;
    if (did) payload.deal_id = did;
    if (!cid && !did) throw new Error('preciso de contact_id ou deal_id (usa "{{ contact.id }}" / "{{ deal.id }}")');
    const { data, error } = await ctx.supabase.from("activities").insert(payload).select("id").single();
    if (error) throw new Error(`supabase: ${error.message}`);
    return { activity_id: data.id, date };
  },

  // action.record_activity — regista um toque em deal_activities (a "verdade única"
  // dos toques, que alimenta a timeline unificada e o deal_state_signals). Com
  // actor='automation' a timeline mostra o badge 🤖. Idempotente: se já existe uma
  // actividade deste tipo para o negócio, devolve _halt (não repete a automação).
  "action.record_activity": async (ctx) => {
    const dealId = String(ctx.config.deal_id ?? "").trim();
    const contactId = String(ctx.config.contact_id ?? "").trim();
    const type = String(ctx.config.type ?? "note").trim() || "note";
    const actor = String(ctx.config.actor ?? "automation").trim() || "automation";
    const description = ctx.config.description != null ? String(ctx.config.description) : null;
    const dedupe = ctx.config.idempotency === true || ctx.config.idempotency === "true";
    if (!dealId && !contactId) throw new Error("record_activity precisa de deal_id ou contact_id");

    // Idempotência (pré-verificação): já respondemos a este negócio?
    if (dedupe && dealId) {
      const { data: existing } = await ctx.supabase
        .from("deal_activities")
        .select("id")
        .eq("organization_id", ctx.organizationId)
        .eq("deal_id", dealId)
        .eq("type", type)
        .limit(1)
        .maybeSingle();
      if (existing) return { _halt: true, skipped: "already_recorded", deal_id: dealId };
    }

    const { data, error } = await ctx.supabase
      .from("deal_activities")
      .insert({
        organization_id: ctx.organizationId,
        deal_id: dealId || null,
        contact_id: contactId || null,
        type,
        actor,
        description,
        metadata: { via: "automation-coracao" },
      })
      .select("id")
      .maybeSingle();

    if (error) {
      // Corrida: o índice único disparou → outra execução já registou. Não repete.
      if ((error as { code?: string }).code === "23505") return { _halt: true, skipped: "unique_conflict", deal_id: dealId };
      throw new Error(`record_activity: ${error.message}`);
    }
    return { activity_id: data?.id ?? null, recorded_at: new Date().toISOString(), deal_id: dealId || null, contact_id: contactId || null };
  },

  "action.run_ai": async (ctx) => {
    const prompt = String(ctx.config.prompt ?? "").trim();
    if (!prompt) throw new Error("prompt é obrigatório");
    const appBase = Deno.env.get("CRM_APP_BASE_URL") ?? "https://crm.joaofilipefonseca.pt";
    const serviceKey = Deno.env.get("CRM_SUPABASE_SECRET_KEY") ?? Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!serviceKey) throw new Error("service_role key em falta no Edge Function env");

    const body: Record<string, unknown> = { prompt, organization_id: ctx.organizationId };
    if (typeof ctx.config.system === "string" && ctx.config.system) body.system = ctx.config.system;
    if (typeof ctx.config.feature === "string" && ctx.config.feature) body.feature = ctx.config.feature;
    if (typeof ctx.config.temperature === "number") body.temperature = ctx.config.temperature;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(`${appBase}/api/ai/automation-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({})) as { text?: string; model_used?: string; fallback_used?: boolean; error?: string };
      if (!res.ok) throw new Error(`run_ai HTTP ${res.status}: ${data.error ?? "unknown"}`);
      if (!data.text) throw new Error("run_ai sem texto");
      return { text: data.text, model_used: data.model_used ?? "?", fallback_used: data.fallback_used ?? false };
    } finally { clearTimeout(timer); }
  },

  "logic.human_approval": async (ctx) => {
    const message = String(ctx.config.message ?? "").trim();
    if (!message) throw new Error("message é obrigatório");
    const approveLabel = String(ctx.config.approve_label ?? "✅ Aprovar");
    const rejectLabel = String(ctx.config.reject_label ?? "❌ Rejeitar");
    const editLabel = typeof ctx.config.edit_label === "string" && ctx.config.edit_label ? String(ctx.config.edit_label) : null;
    const timeoutHours = Number(ctx.config.timeout_hours ?? 24);

    const { data: settings } = await ctx.supabase
      .from("organization_settings")
      .select("telegram_crm_bot_token, telegram_crm_chat_id")
      .eq("organization_id", ctx.organizationId)
      .single();
    if (!settings?.telegram_crm_bot_token || !settings?.telegram_crm_chat_id) {
      throw new Error("telegram_crm_bot_token/chat_id em falta em organization_settings");
    }

    // Token único para esta aprovação
    const token = crypto.randomUUID().replace(/-/g, "");
    const inlineKeyboard: Array<Array<{ text: string; callback_data: string }>> = [[
      { text: approveLabel, callback_data: `approved:${token}` },
      { text: rejectLabel, callback_data: `rejected:${token}` },
    ]];
    if (editLabel) inlineKeyboard.push([{ text: editLabel, callback_data: `edited:${token}` }]);

    const res = await fetch(`https://api.telegram.org/bot${settings.telegram_crm_bot_token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: settings.telegram_crm_chat_id,
        text: `🙋 <b>Aprovação pedida</b>\n\n${message}`,
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: inlineKeyboard },
      }),
    });
    const json = await res.json().catch(() => ({})) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!res.ok || !json.ok) throw new Error(`Telegram erro: ${json.description ?? res.status}`);

    const resumeAt = new Date(Date.now() + timeoutHours * 3600 * 1000).toISOString();
    return {
      _suspend: true,
      _resumeAt: resumeAt,
      _approval_token: token,
      _branch_taken: "timeout", // valor inicial; sobreposto se humano decidir antes do timeout
      message_id: json.result?.message_id ?? 0,
      sent_at: new Date().toISOString(),
    };
  },

  "logic.switch": async (ctx) => {
    const expression = String(ctx.config.expression ?? "").trim().toLowerCase();
    const rawCases = Array.isArray(ctx.config.cases) ? (ctx.config.cases as unknown[]) : [];
    const cases = rawCases.map((v) => String(v ?? "").trim().toLowerCase());
    const idx = cases.indexOf(expression);
    if (idx === -1) return { matched_case: null, matched_index: -1, _branch_taken: "default" };
    return { matched_case: rawCases[idx], matched_index: idx, _branch_taken: `case_${idx}` };
  },

  "logic.filter": async (ctx) => {
    const op = String(ctx.config.operator ?? "eq");
    const left = ctx.config.left;
    const right = ctx.config.right;
    const cmp = (l: unknown, o: string, r: unknown): boolean => {
      switch (o) {
        case "eq": return String(l ?? "") === String(r ?? "");
        case "neq": return String(l ?? "") !== String(r ?? "");
        case "gt": return Number(l) > Number(r);
        case "gte": return Number(l) >= Number(r);
        case "lt": return Number(l) < Number(r);
        case "lte": return Number(l) <= Number(r);
        case "contains": return String(l ?? "").toLowerCase().includes(String(r ?? "").toLowerCase());
        case "starts_with": return String(l ?? "").toLowerCase().startsWith(String(r ?? "").toLowerCase());
        case "ends_with": return String(l ?? "").toLowerCase().endsWith(String(r ?? "").toLowerCase());
        case "in": {
          const arr = Array.isArray(r) ? (r as unknown[]).map((x) => String(x)) : String(r ?? "").split(",").map((s) => s.trim());
          return arr.includes(String(l ?? ""));
        }
        case "is_empty": return l === null || l === undefined || String(l).trim() === "";
        case "is_not_empty": return !(l === null || l === undefined || String(l).trim() === "");
        default: throw new Error(`operador desconhecido: ${o}`);
      }
    };
    const passed = cmp(left, op, right);
    if (!passed) return { passed: false, _branch_taken: "stop", _halt: true };
    return { passed: true, _branch_taken: "pass" };
  },

  "logic.wait_humanized": async (ctx) => {
    const minS = Math.max(1, Number(ctx.config.min_seconds ?? 60));
    const maxS = Math.max(minS, Number(ctx.config.max_seconds ?? minS));
    const span = maxS - minS;
    const randomS = span === 0 ? minS : minS + Math.floor(Math.random() * (span + 1));
    const lisbonParts = (d: Date) => {
      const fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Lisbon", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
      });
      const parts = fmt.formatToParts(d);
      const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
      return { weekday, hour };
    };
    const inside = (d: Date) => {
      const { weekday, hour } = lisbonParts(d);
      if (weekday === "Sun") return false;
      if (weekday === "Sat") return hour >= 9 && hour < 13;
      return hour >= 8 && hour < 21;
    };
    const stepMs = 15 * 60 * 1000;
    const now = Date.now();
    const target = new Date(now + randomS * 1000);
    let final = target;
    if (!inside(final)) {
      for (let i = 0; i < 14 * 24 * 4; i += 1) {
        final = new Date(final.getTime() + stepMs);
        if (inside(final)) break;
      }
    }
    const shifted = final.getTime() !== target.getTime();
    const waitedSeconds = Math.round((final.getTime() - now) / 1000);
    return {
      _suspend: true,
      _resumeAt: final.toISOString(),
      waited_seconds: waitedSeconds,
      shifted,
      original_resume_at: target.toISOString(),
    };
  },

  "data.set_variable": async (ctx) => {
    return { value: ctx.config.value ?? null };
  },

  "data.format_text": async (ctx) => {
    return { text: String(ctx.config.template ?? "") };
  },

  "logic.condition": async (ctx) => {
    const op = String(ctx.config.operator ?? "eq");
    const left = ctx.config.left;
    const right = ctx.config.right;
    const cmp = (l: unknown, o: string, r: unknown): boolean => {
      switch (o) {
        case "eq": return String(l ?? "") === String(r ?? "");
        case "neq": return String(l ?? "") !== String(r ?? "");
        case "gt": return Number(l) > Number(r);
        case "gte": return Number(l) >= Number(r);
        case "lt": return Number(l) < Number(r);
        case "lte": return Number(l) <= Number(r);
        case "contains": return String(l ?? "").toLowerCase().includes(String(r ?? "").toLowerCase());
        case "starts_with": return String(l ?? "").toLowerCase().startsWith(String(r ?? "").toLowerCase());
        case "ends_with": return String(l ?? "").toLowerCase().endsWith(String(r ?? "").toLowerCase());
        case "in": {
          const arr = Array.isArray(r) ? (r as unknown[]).map((x) => String(x)) : String(r ?? "").split(",").map((s) => s.trim());
          return arr.includes(String(l ?? ""));
        }
        case "is_empty": return l === null || l === undefined || String(l).trim() === "";
        case "is_not_empty": return !(l === null || l === undefined || String(l).trim() === "");
        default: throw new Error(`operador desconhecido: ${o}`);
      }
    };
    const result = cmp(left, op, right);
    return { result, _branch_taken: result ? "true" : "false" };
  },
};

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

// ----------------------------------------------------------------------------
// now — contexto temporal em Europa/Lisboa para os templates ({{ now.* }}).
// call_phrase = quando o João pode ligar, em linguagem natural, respeitando a
// janela de chamadas (seg-sex 09h-20h, sáb 09h-13h) e NUNCA prometendo Domingo.
// ----------------------------------------------------------------------------
function computeNow(): Record<string, unknown> {
  const d = new Date();
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const wdShort = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const wd = wdMap[wdShort] ?? 1;
  // Janela de chamadas: domingo nunca; sábado 09-13; seg-sex 09-20.
  const windowFor = (day: number): { start: number; end: number } | null =>
    day === 0 ? null : day === 6 ? { start: 9, end: 13 } : { start: 9, end: 20 };
  const nowMinutes = hour * 60 + minute;
  const todayWin = windowFor(wd);
  const inWindow = !!todayWin && nowMinutes >= todayWin.start * 60 && nowMinutes < todayWin.end * 60;
  const namesPt = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  let callPhrase = "ainda hoje";
  if (!inWindow) {
    let found = false;
    for (let i = 0; i < 8 && !found; i += 1) {
      const day = (wd + i) % 7;
      const win = windowFor(day);
      if (!win) continue;
      if (i === 0) {
        if (nowMinutes < win.start * 60) { callPhrase = "hoje de manhã"; found = true; }
        // janela de hoje já passou: continua para o próximo dia com janela
      } else {
        callPhrase = i === 1 ? "amanhã de manhã" : `na ${namesPt[day]} de manhã`;
        found = true;
      }
    }
    if (!found) callPhrase = "assim que possível";
  }
  return { iso: d.toISOString(), hour, weekday: wd, is_call_window: inWindow, call_phrase: callPhrase };
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
  let startNodeId: string | null;
  let contactId: string | null = null;
  let dealId: string | null = null;
  let imovelId: string | null = null;
  // Estado já reidratado (modo resume com run_state multi-frame). Quando definido,
  // o runner usa o frontier serializado em vez de um startNodeId.
  let preparedState: RunnerState | null = null;
  const nowIso = new Date().toISOString();

  if (body.execution_id) {
    // ----- Modo resume -----
    // Claim por compare-and-set: só um resume avança (waiting -> running). Evita
    // que duas schedules da mesma execução se sobreponham no run_state.
    const { data: exec, error: eErr } = await supabase
      .from("automation_executions")
      .update({ status: "running", resume_at: null })
      .eq("id", body.execution_id)
      .eq("organization_id", body.organization_id)
      .eq("status", "waiting")
      .select("id, organization_id, automation_id, variables, run_state, resume_node_id, trigger_event, contact_id, deal_id, imovel_id")
      .maybeSingle();
    if (eErr) return new Response(JSON.stringify({ error: "resume claim failed", details: eErr }), { status: 500, headers: { "Content-Type": "application/json" } });
    if (!exec) {
      // Já reclamada por outro resume, ou não está em waiting. Sai sem mexer.
      return new Response(JSON.stringify({ skipped: "already claimed or not waiting", execution_id: body.execution_id }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const { data: auto, error: aErr } = await supabase.from("automations").select("id, definition, version, organization_id").eq("id", exec.automation_id).single();
    if (aErr || !auto) return new Response(JSON.stringify({ error: "automation not found for execution" }), { status: 404, headers: { "Content-Type": "application/json" } });

    executionId = exec.id;
    automation = auto as typeof automation;
    variables = (exec.variables as typeof variables) ?? {};
    triggerEvent = (exec.trigger_event as typeof triggerEvent) ?? undefined;
    contactId = exec.contact_id as string | null;
    dealId = exec.deal_id as string | null;
    imovelId = exec.imovel_id as string | null;

    if (exec.run_state) {
      // ----- Resume multi-frame: reidrata o frontier e acorda os ramos devidos -----
      preparedState = deserializeState(exec.run_state as SerializedRunState);
      wakeDueSuspends(automation.definition, preparedState, nowIso);
      startNodeId = null;
    } else {
      // ----- Resume legacy (execuções criadas antes do run_state) -----
      const lastBranch = (variables[exec.resume_node_id ?? ""] as { output?: { _branch_taken?: string } } | undefined)?.output?._branch_taken;
      startNodeId = exec.resume_node_id
        ? nextTarget(automation.definition, exec.resume_node_id, lastBranch)
        : (findStartNode(automation.definition)?.id ?? null);
    }
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
    // Eventos sintéticos (ex: lead.captured) trazem os ids explícitos no payload.
    // Preenche o que a heurística de prefixo não apanhou, para carregar contact/deal
    // no template context ({{ contact.email }}, {{ deal.title }}, etc.).
    if (!contactId && typeof payload.contact_id === "string") contactId = payload.contact_id;
    if (!dealId && typeof payload.deal_id === "string") dealId = payload.deal_id;

    const startNode = findStartNode(automation.definition);
    if (!startNode) return new Response(JSON.stringify({ error: "no trigger node" }), { status: 400, headers: { "Content-Type": "application/json" } });
    startNodeId = startNode.id;

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

  // ----- Execução via runner partilhado -----
  const startedAt = Date.now();

  // Contexto base do template (igual ao antigo buildVariables): contact/deal/imovel/trigger.
  const baseContext: Record<string, unknown> = {
    contact: baseRefs.contact ?? {},
    deal: baseRefs.deal ?? {},
    imovel: baseRefs.imovel ?? {},
    trigger: triggerEvent ?? {},
    now: computeNow(),
  };

  // Estado do runner. Resume multi-frame usa o estado já reidratado; senão cria
  // um estado novo e reaproveita as variáveis acumuladas (resume legacy/normal).
  const state = preparedState ?? createInitialState(startNodeId ?? "");
  if (!preparedState) state.variables = variables;

  // runNode: resolve a config, persiste o node_execution e devolve o output.
  // Lança em caso de átomo desconhecido ou erro do átomo (o runner trata como falha).
  const runNode = async (node: AutomationNode, vars: Record<string, unknown>): Promise<AtomOutput> => {
    const nodeStart = Date.now();
    const atomFn = ATOMS[node.atom];

    let resolvedConfig: Record<string, unknown>;
    try {
      resolvedConfig = await resolveConfig(node.config, vars);
    } catch (e) {
      resolvedConfig = node.config;
      console.error("resolveConfig falhou:", e);
    }

    if (!atomFn) {
      const errMsg = `unknown atom: ${node.atom}`;
      await supabase.from("automation_node_executions").insert({
        execution_id: executionId, organization_id: automation.organization_id, node_id: node.id, atom_id: node.atom,
        status: "failed", input: { config: resolvedConfig }, error: errMsg, completed_at: new Date().toISOString(), duration_ms: Date.now() - nodeStart,
      });
      throw new Error(errMsg);
    }

    const { data: nodeExec } = await supabase.from("automation_node_executions").insert({
      execution_id: executionId, organization_id: automation.organization_id, node_id: node.id, atom_id: node.atom,
      status: "running", input: { config: resolvedConfig },
    }).select("id").single();

    const ctx: NodeExecContext = {
      supabase, executionId, automationId: automation.id, organizationId: automation.organization_id, nodeId: node.id,
      config: resolvedConfig, rawConfig: node.config, scope: vars, variables: state.variables, triggerEvent,
      log: async (level: string, message: string) => {
        await supabase.from("automation_node_executions").insert({
          execution_id: executionId, organization_id: automation.organization_id, node_id: `${node.id}.log`, atom_id: "system.log",
          status: "completed", output: { level, message }, completed_at: new Date().toISOString(),
        });
      },
    };

    try {
      const output = await atomFn(ctx);
      if (nodeExec?.id) {
        await supabase.from("automation_node_executions").update({
          status: "completed", output, completed_at: new Date().toISOString(), duration_ms: Date.now() - nodeStart,
        }).eq("id", nodeExec.id);
      }
      return output;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (nodeExec?.id) {
        await supabase.from("automation_node_executions").update({
          status: "failed", error: errMsg, completed_at: new Date().toISOString(), duration_ms: Date.now() - nodeStart,
        }).eq("id", nodeExec.id);
      }
      throw e;
    }
  };

  const deps: RunnerDeps = { baseContext, runNode };
  // Corre o runner quando há trabalho: arranque normal (startNodeId) ou resume
  // (preparedState — mesmo com frontier vazio, para reavaliar ramos suspensos).
  const outcome = (startNodeId || preparedState)
    ? await runGraph(automation.definition, startNodeId ? { startNodeId, state, deps } : { state, deps })
    : { result: { kind: "done" as const }, state };

  variables = outcome.state.variables;
  const count = outcome.state.iterationCount;
  const durationMs = Date.now() - startedAt;

  // ----- Final -----
  if (outcome.result.kind === "suspended") {
    const suspends = outcome.result.suspends;
    const earliest = suspends.reduce((min, s) => (s.resumeAt < min ? s.resumeAt : min), suspends[0].resumeAt);
    const approval = suspends.find((s) => s.approvalToken)?.approvalToken ?? null;
    const firstNode = suspends[0].nodeId;
    await supabase.from("automation_executions").update({
      status: "waiting", current_node_id: firstNode, resume_node_id: firstNode, resume_at: earliest,
      variables, run_state: serializeState(state), pending_approval_token: approval,
    }).eq("id", executionId);
    // Mantém as schedules em sincronia com run_state.suspended: cancela as
    // pendentes antigas e insere uma por ramo ainda suspenso.
    await supabase.from("automation_schedules").update({ status: "cancelled" }).eq("execution_id", executionId).eq("status", "pending");
    await supabase.from("automation_schedules").insert(
      suspends.map((s) => ({
        execution_id: executionId, organization_id: automation.organization_id,
        scheduled_for: s.resumeAt, resume_node_id: s.nodeId, frame_id: s.frameId, status: "pending",
      })),
    );
    return new Response(JSON.stringify({
      execution_id: executionId, status: "waiting", resume_at: earliest, suspended: suspends.length, nodes_executed: count,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const errorMessage = outcome.result.kind === "error" ? outcome.result.message : null;
  const errorNodeId = outcome.result.kind === "error" ? outcome.result.nodeId : null;
  const finalStatus = errorMessage ? "failed" : "completed";
  await supabase.from("automation_executions").update({
    status: finalStatus, completed_at: new Date().toISOString(), duration_ms: durationMs,
    variables, error_message: errorMessage, error_node_id: errorNodeId, run_state: null,
  }).eq("id", executionId);

  return new Response(JSON.stringify({
    execution_id: executionId, status: finalStatus, duration_ms: durationMs, nodes_executed: count, error: errorMessage,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
});
