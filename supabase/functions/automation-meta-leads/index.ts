/**
 * automation-meta-leads — Webhook de Lead Ads do Meta (Facebook/Instagram)
 *
 * Épico Meta Ads, Fase A, Commit 3.
 *
 * Rotas:
 *  - GET  /functions/v1/automation-meta-leads  → verificação (hub.challenge).
 *  - POST /functions/v1/automation-meta-leads  → evento `leadgen`.
 *
 * Segurança:
 *  - GET: `hub.verify_token` tem de bater com o verify token guardado na
 *    metadata de uma integração Meta activa (handshake ao nível da app).
 *  - POST: `X-Hub-Signature-256` validado por HMAC-SHA256 com o App Secret
 *    (lido do Vault). Sem assinatura válida → 401.
 *
 * Processamento (sempre devolve 200 em erro lógico, para a Meta não repetir):
 *  1. Por cada lead: lê o token de utilizador do Vault, deriva o token da
 *     Página, e busca os dados do formulário via Graph API (field_data +
 *     linhagem do anúncio).
 *  2. Cria `lead` + `contacto` com `attribution` (linhagem) e as respostas.
 *  3. Encaminha por campanha (`meta_lead_routing`): cria o negócio no board+etapa
 *     definidos para a campanha do anúncio. Sem destino, fica só o contacto.
 *  3b. Alerta Telegram de lead nova (regra inegociável) com nome/anúncio/destino.
 *  4. Publica o evento `lead.meta_ads` (idempotente por leadgen_id) para o
 *     motor de automações do CRM.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

const GRAPH_VERSION = "v21.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;
const APP_URL = "https://crm-joao.vercel.app";

// Alerta Telegram de lead nova (regra: Telegram só para leads novas). Best-effort.
async function notifyTelegram(token: string, chatId: string, htmlText: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: htmlText, parse_mode: "HTML", disable_web_page_preview: true }),
    });
  } catch (_e) { /* não bloqueia a recepção */ }
}

function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Signature-256, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
function text(status: number, body: string) {
  return new Response(body, { status, headers: { "Content-Type": "text/plain", ...corsHeaders } });
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
interface LeadgenChange {
  field: string;
  value: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    ad_id?: string;
    adgroup_id?: string;
    campaign_id?: string;
    created_time?: number;
  };
}
interface LeadgenEntry {
  id: string;
  time?: number;
  changes?: LeadgenChange[];
}
interface LeadgenPayload {
  object: string;
  entry?: LeadgenEntry[];
}
interface GraphLead {
  id: string;
  created_time?: string;
  field_data?: { name: string; values: string[] }[];
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  platform?: string;
}

// ---------------------------------------------------------------------------
// Assinatura HMAC-SHA256 (mesmo padrão de messaging-webhook-meta)
// ---------------------------------------------------------------------------
async function verifySignature(payload: string, signature: string, appSecret: string): Promise<boolean> {
  const [algorithm, expectedHash] = signature.split("=");
  if (algorithm !== "sha256" || !expectedHash) return false;
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      encoder.encode(appSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const buf = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (computed.length !== expectedHash.length) return false;
    let mismatch = 0;
    for (let i = 0; i < computed.length; i++) mismatch |= computed.charCodeAt(i) ^ expectedHash.charCodeAt(i);
    return mismatch === 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Extrai nome/email/telefone das respostas do formulário
// ---------------------------------------------------------------------------
function parseFieldData(fieldData: { name: string; values: string[] }[] = []) {
  const answers: Record<string, string> = {};
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;

  for (const f of fieldData) {
    const value = (f.values?.[0] ?? "").trim();
    answers[f.name] = value;
    const key = f.name.toLowerCase();
    if (!email && (key === "email" || key.includes("email"))) email = value;
    else if (!phone && (key === "phone_number" || key.includes("phone") || key.includes("telefone") || key.includes("telemovel") || key.includes("telemóvel"))) phone = value;
    else if (!name && (key === "full_name" || key === "name" || key.includes("nome"))) name = value;
  }
  return { answers, name, email, phone };
}

function buildAttribution(change: LeadgenChange["value"], lead: GraphLead) {
  return {
    source: "meta_ads",
    platform: lead.platform ?? null,
    campaign_id: lead.campaign_id ?? change.campaign_id ?? null,
    campaign_name: lead.campaign_name ?? null,
    adset_id: lead.adset_id ?? change.adgroup_id ?? null,
    adset_name: lead.adset_name ?? null,
    ad_id: lead.ad_id ?? change.ad_id ?? null,
    ad_name: lead.ad_name ?? null,
    form_id: lead.form_id ?? change.form_id ?? null,
    leadgen_id: lead.id,
    page_id: change.page_id ?? null,
    captured_at: lead.created_time ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Graph API: token da Página + dados do lead
// ---------------------------------------------------------------------------
async function getPageToken(pageId: string, userToken: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${pageId}?fields=access_token&access_token=${encodeURIComponent(userToken)}`);
  const data = await res.json().catch(() => ({}));
  return (data?.access_token as string) ?? null;
}
async function fetchLead(leadgenId: string, pageToken: string): Promise<GraphLead | null> {
  const fields = "field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,platform,created_time";
  const res = await fetch(`${GRAPH}/${leadgenId}?fields=${fields}&access_token=${encodeURIComponent(pageToken)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.id) {
    console.error("[meta-leads] fetchLead falhou:", JSON.stringify(data?.error ?? data));
    return null;
  }
  return data as GraphLead;
}

// ---------------------------------------------------------------------------
type Db = ReturnType<typeof createClient>;

async function processLead(supabase: Db, appSecret: string, change: LeadgenChange["value"]) {
  const leadgenId = change.leadgen_id;
  const pageId = change.page_id;
  if (!leadgenId || !pageId) return;

  // Integração Meta cuja Página subscrita coincide com a do evento.
  const { data: integ } = await supabase
    .from("automation_integrations")
    .select("id, organization_id, metadata, status")
    .eq("provider", "meta")
    .eq("status", "active")
    .filter("metadata->>subscribed_page_id", "eq", pageId)
    .maybeSingle();

  if (!integ) {
    console.error(`[meta-leads] Sem integração activa para a Página ${pageId}`);
    return;
  }
  const orgId = integ.organization_id as string;
  const tokenName = (integ.metadata as Record<string, unknown>)?.token_secret_name as string | undefined;
  if (!tokenName) {
    console.error("[meta-leads] Integração sem token_secret_name");
    return;
  }

  // Idempotência: já processámos esta lead?
  const { data: dup } = await supabase
    .from("leads")
    .select("id")
    .eq("organization_id", orgId)
    .filter("attribution->>leadgen_id", "eq", leadgenId)
    .maybeSingle();
  if (dup) {
    console.log(`[meta-leads] Lead ${leadgenId} já processada, a ignorar.`);
    return;
  }

  // Token de utilizador (Vault) -> token de Página -> dados do lead.
  const { data: userToken, error: tokErr } = await supabase.rpc("meta_oauth_read_token", { p_name: tokenName });
  if (tokErr || !userToken) {
    console.error("[meta-leads] Falha ao ler token do Vault:", tokErr?.message);
    return;
  }
  const pageToken = await getPageToken(pageId, userToken as string);
  if (!pageToken) {
    console.error("[meta-leads] Não foi possível obter o token da Página.");
    return;
  }
  const lead = await fetchLead(leadgenId, pageToken);
  if (!lead) return;

  const { answers, name, email, phone } = parseFieldData(lead.field_data);
  const attribution = buildAttribution(change, lead);
  const leadName = name || email || phone || "Lead Meta Ads";
  const answersText = Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join("\n");
  const notes = `Lead do Meta Ads.\nAnúncio: ${attribution.ad_name ?? attribution.ad_id ?? "—"}\nCampanha: ${attribution.campaign_name ?? "—"}\n\nRespostas:\n${answersText}`;

  // 1) lead
  const { data: newLead, error: leadErr } = await supabase
    .from("leads")
    .insert({
      organization_id: orgId,
      name: leadName,
      email: email,
      source: "meta_ads",
      status: "NEW",
      notes,
      attribution,
    })
    .select("id")
    .single();
  if (leadErr) {
    console.error("[meta-leads] Erro ao criar lead:", leadErr.message);
    return;
  }

  // 2) contacto (reaproveita existente por email/telefone)
  let contactId: string | null = null;
  if (email || phone) {
    const orFilters: string[] = [];
    if (email) orFilters.push(`email.eq.${email}`);
    if (phone) orFilters.push(`phone.eq.${phone}`);
    const { data: existing } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .or(orFilters.join(","))
      .is("deleted_at", null)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    contactId = existing?.id ?? null;
  }
  if (!contactId) {
    const { data: newContact, error: contactErr } = await supabase
      .from("contacts")
      .insert({
        organization_id: orgId,
        name: leadName,
        email,
        phone,
        source: "meta_ads",
        notes,
        attribution,
      })
      .select("id")
      .single();
    if (contactErr) {
      console.error("[meta-leads] Erro ao criar contacto:", contactErr.message);
    } else {
      contactId = newContact.id;
    }
  } else {
    // Backfill da atribuição se o contacto ainda não a tiver.
    await supabase
      .from("contacts")
      .update({ attribution })
      .eq("id", contactId)
      .is("attribution", null);
  }

  if (contactId) {
    await supabase.from("leads").update({ converted_to_contact_id: contactId }).eq("id", newLead.id);
  }

  // 3) negócio via encaminhamento por campanha (meta_lead_routing).
  // A campanha define o intuito (comprador/vendedor/arrendamento) e aponta o
  // board+etapa. Sem regra para a campanha, fica só o contacto e o Telegram
  // avisa "campanha sem destino" para o João atribuir.
  let boardName: string | null = null;
  let routed = false;
  const campaignId = attribution.campaign_id;
  if (contactId && campaignId) {
    const { data: routing } = await supabase
      .from("meta_lead_routing")
      .select("board_id, stage_id, boards(name)")
      .eq("organization_id", orgId)
      .eq("campaign_id", campaignId)
      .maybeSingle();
    if (routing?.board_id) {
      boardName = (routing.boards as { name?: string } | null)?.name ?? null;
      let stageId = routing.stage_id as string | null;
      if (!stageId) {
        const { data: firstStage } = await supabase
          .from("board_stages")
          .select("id")
          .eq("board_id", routing.board_id)
          .order("order", { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = firstStage?.id ?? null;
      }
      if (stageId) {
        const { error: dealErr } = await supabase.from("deals").insert({
          organization_id: orgId,
          board_id: routing.board_id,
          stage_id: stageId,
          status: "open",
          contact_id: contactId,
          title: `${leadName} - Meta Ads`,
          value: 0,
          attribution,
        });
        if (dealErr) {
          console.error("[meta-leads] Erro ao criar negócio:", dealErr.message);
        } else {
          routed = true;
        }
      }
    }
  }

  // 3b) Alerta Telegram de lead nova (regra inegociável).
  const { data: orgSettings } = await supabase
    .from("organization_settings")
    .select("telegram_crm_bot_token, telegram_crm_chat_id")
    .eq("organization_id", orgId)
    .maybeSingle();
  const tgToken = orgSettings?.telegram_crm_bot_token as string | undefined;
  const tgChat = orgSettings?.telegram_crm_chat_id as string | undefined;
  if (tgToken && tgChat) {
    const destinoLinha = routed
      ? `🎯 Destino: <b>${esc(boardName ?? "board")}</b>`
      : `⚠️ <b>Campanha sem destino</b> — atribui o board em /anuncios`;
    const contacto = [phone ? `📞 ${esc(phone)}` : null, email ? `✉️ ${esc(email)}` : null].filter(Boolean).join("  ");
    const texto =
      `🟢 <b>Lead nova — Meta Ads</b>\n` +
      `👤 <b>${esc(leadName)}</b>\n` +
      (contacto ? `${contacto}\n` : "") +
      `📣 Anúncio: <b>${esc(attribution.ad_name ?? attribution.ad_id ?? "—")}</b>\n` +
      `📦 Campanha: ${esc(attribution.campaign_name ?? "—")}\n` +
      `${destinoLinha}\n\n` +
      `Abrir: ${APP_URL}/boards`;
    await notifyTelegram(tgToken, tgChat, texto);
  }

  // 4) evento para o motor de automações (idempotente por leadgen_id)
  await supabase.rpc("publish_event", {
    p_event_type: "lead.meta_ads",
    p_payload: {
      lead_id: newLead.id,
      contact_id: contactId,
      attribution,
      answers,
      name: leadName,
      email,
      phone,
    },
    p_organization_id: orgId,
    p_source: "meta_leadgen_webhook",
    p_idempotency_key: `lead.meta_ads:${leadgenId}`,
  });

  console.log(`[meta-leads] Lead ${leadgenId} processada (lead ${newLead.id}, contacto ${contactId}).`);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("CRM_SUPABASE_SECRET_KEY") ??
    Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Supabase não configurado no runtime" });
  const supabase = createClient(supabaseUrl, serviceKey);

  // -------- GET: verificação do webhook --------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode !== "subscribe" || !token) return json(400, { error: "Pedido de verificação inválido" });

    const { data: match } = await supabase
      .from("automation_integrations")
      .select("id")
      .eq("provider", "meta")
      .filter("metadata->>webhook_verify_token", "eq", token)
      .limit(1)
      .maybeSingle();
    if (!match) return json(403, { error: "Verify token inválido" });
    return text(200, challenge ?? "");
  }

  if (req.method !== "POST") return json(405, { error: "Método não permitido" });

  // -------- POST: evento leadgen --------
  const rawBody = await req.text();

  // App Secret do Vault para validar a assinatura.
  const { data: creds } = await supabase.rpc("get_meta_app_credentials");
  const credRow = Array.isArray(creds) ? creds[0] : creds;
  const appSecret = credRow?.app_secret as string | undefined;
  if (!appSecret) {
    console.error("[meta-leads] App Secret ausente no Vault");
    // 200 para a Meta não martelar com retries; erro de config nosso.
    return json(200, { ok: false, error: "config" });
  }
  const signature = req.headers.get("X-Hub-Signature-256") ?? "";
  if (!signature || !(await verifySignature(rawBody, signature, appSecret))) {
    return json(401, { error: "Assinatura inválida" });
  }

  let payload: LeadgenPayload;
  try {
    payload = JSON.parse(rawBody) as LeadgenPayload;
  } catch {
    return json(200, { ok: false, error: "json_invalido" });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "leadgen") continue;
        await processLead(supabase, appSecret, change.value);
      }
    }
  } catch (e) {
    console.error("[meta-leads] Erro de processamento:", e instanceof Error ? e.message : e);
  }

  // Sempre 200 (regra: webhooks nunca 5xx em erro lógico).
  return json(200, { ok: true });
});
