/**
 * Resend Webhook Handler
 *
 * Recebe eventos do Resend API e processa:
 * - email.sent → status 'sent'
 * - email.delivered → status 'delivered'
 * - email.opened → status 'read'
 * - email.bounced → status 'failed'
 * - email.complained → status 'failed'
 * - email.received → INBOUND (resposta do lead) → contacto + negócio + timeline
 *
 * Rotas:
 * - `POST /functions/v1/messaging-webhook-resend/<channel_id>` → Eventos do webhook
 * - `POST /functions/v1/messaging-webhook-resend/<channel_id>?source=worker` → inbound
 *   vindo de um Cloudflare Email Worker (auth por segredo partilhado `inboundSecret`).
 *
 * Autenticação:
 * - Resend (status + Resend Inbound): Svix headers (svix-id/svix-timestamp/svix-signature)
 *   verificados por HMAC-SHA256 contra `credentials.webhookSecret`.
 * - Cloudflare Email Worker: header `x-inbound-secret` comparado com
 *   `credentials.inboundSecret` (timing-safe). Não usa Svix.
 *
 * INBOUND (MSG-3 / task_3ebe04f0): as respostas dos leads aos emails do João passam
 * a entrar no CRM (hoje caem só na caixa via Cloudflare Email Routing), para a IA ter
 * a conversa dos dois lados. Nunca fabrica lead: só associa a contacto/negócio já
 * existentes (contacto≠lead). Idempotente e nunca devolve 5xx em erro lógico.
 *
 * @see https://resend.com/docs/webhooks
 * @see https://resend.com/docs/dashboard/receiving/introduction
 */
import { createClient } from "npm:@supabase/supabase-js@2";

// =============================================================================
// TYPES
// =============================================================================

interface ResendInboundData {
  email_id: string;
  from: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  created_at?: string;
  message_id?: string;
  // Preenchidos pelo Cloudflare Email Worker (Resend Inbound não os traz no webhook):
  text?: string;
  html?: string;
  in_reply_to?: string;
  references?: string;
  headers?: unknown;
}

interface ResendWebhookPayload {
  type:
    | "email.sent"
    | "email.delivered"
    | "email.delivery_delayed"
    | "email.complained"
    | "email.bounced"
    | "email.opened"
    | "email.clicked"
    | "email.received";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounce?: {
      message: string;
    };
    click?: {
      link: string;
      timestamp: string;
      userAgent: string;
    };
  } & ResendInboundData;
}

// =============================================================================
// HELPERS
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, svix-id, svix-timestamp, svix-signature, x-inbound-secret",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function getChannelIdFromPath(req: Request): string | null {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.findIndex((p) => p === "messaging-webhook-resend");
  if (idx === -1) return null;
  return parts[idx + 1] ?? null;
}

/**
 * Map Resend event type to our internal message status.
 */
function mapEventToStatus(eventType: string): "sent" | "delivered" | "read" | "failed" | null {
  switch (eventType) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
    case "email.clicked":
      return "read";
    case "email.bounced":
    case "email.complained":
      return "failed";
    case "email.delivery_delayed":
      return null; // Don't change status, just log
    default:
      return null;
  }
}

/**
 * Generate stable event ID for deduplication.
 */
function generateStableEventId(payload: ResendWebhookPayload): string {
  return `resend_${payload.data.email_id}_${payload.type}`;
}

// =============================================================================
// SVIX SIGNATURE VERIFICATION
// =============================================================================

/** Maximum allowed age for webhook timestamps (5 minutes). */
const SVIX_TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Decode a Svix webhook signing secret.
 * Svix secrets are base64-encoded and prefixed with "whsec_".
 */
function decodeSvixSecret(secret: string): Uint8Array {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  // Deno has atob built-in; convert base64 → Uint8Array
  const binaryStr = atob(raw);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

/**
 * Timing-safe comparison of two Uint8Arrays.
 * Uses crypto.subtle.timingSafeEqual when available (Deno 1.38+),
 * otherwise falls back to a constant-time XOR loop.
 */
async function timingSafeEqual(a: Uint8Array, b: Uint8Array): Promise<boolean> {
  if (a.length !== b.length) return false;
  // Deno exposes crypto.subtle.timingSafeEqual since 1.38
  if (typeof (crypto.subtle as Record<string, unknown>).timingSafeEqual === "function") {
    return (crypto.subtle as unknown as { timingSafeEqual: (a: BufferSource, b: BufferSource) => boolean }).timingSafeEqual(a, b);
  }
  // Fallback: constant-time XOR comparison
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** Timing-safe compare of two strings (UTF-8). */
async function timingSafeEqualStr(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(a), enc.encode(b));
}

/**
 * Verify Svix webhook signature.
 */
async function verifySvixSignature(
  rawBody: string,
  headers: { svixId: string; svixTimestamp: string; svixSignature: string },
  secret: string
): Promise<boolean> {
  const { svixId, svixTimestamp, svixSignature } = headers;

  // 1. Validate timestamp is not too old (replay attack prevention)
  const timestampSeconds = parseInt(svixTimestamp, 10);
  if (isNaN(timestampSeconds)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SVIX_TIMESTAMP_TOLERANCE_SECONDS) {
    return false;
  }

  // 2. Compute expected signature: HMAC-SHA256(secret, "${svixId}.${svixTimestamp}.${rawBody}")
  const secretBytes = decodeSvixSecret(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const signatureBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(signPayload))
  );

  // 3. Encode expected signature as base64
  const expectedB64 = btoa(String.fromCharCode(...signatureBytes));

  // 4. Parse provided signatures (format: "v1,<base64>" — may contain multiple)
  const providedSignatures = svixSignature.split(" ");
  for (const sig of providedSignatures) {
    const parts = sig.split(",");
    // Only support v1 signatures
    if (parts[0] !== "v1" || !parts[1]) continue;

    const providedB64 = parts[1];

    // Decode both to Uint8Array for timing-safe comparison
    const expectedBytes = encoder.encode(expectedB64);
    const providedBytes = encoder.encode(providedB64);

    if (await timingSafeEqual(expectedBytes, providedBytes)) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// INBOUND — helpers
// =============================================================================

/** Extrai o endereço "puro" de um cabeçalho From ("Nome <a@b.pt>" → "a@b.pt"). */
function extractEmailAddress(raw: string | undefined | null): string {
  if (!raw) return "";
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return addr;
}

/** Escapa % _ \ para usar num ilike literal. */
function escapeLike(v: string): string {
  return v.replace(/([\\%_])/g, "\\$1");
}

/**
 * A partir de In-Reply-To / References devolve candidatos de id do email original
 * enviado por nós (o Resend costuma usar o id do email no Message-ID). Para cada
 * token: guarda o conteúdo dentro de <> e também a parte antes do '@'.
 */
function parseRefIds(inReplyTo?: string | null, references?: string | null): string[] {
  const out = new Set<string>();
  const push = (tokenRaw: string) => {
    let t = tokenRaw.trim();
    if (!t) return;
    t = t.replace(/^</, "").replace(/>$/, "");
    if (!t) return;
    out.add(t);
    const at = t.indexOf("@");
    if (at > 0) out.add(t.slice(0, at));
  };
  for (const src of [inReplyTo, references]) {
    if (!src) continue;
    for (const tok of src.split(/[\s,]+/)) push(tok);
  }
  return [...out];
}

/** Lê um header (case-insensitive) de estruturas array [{name,value}] ou objecto. */
function getHeaderValue(headers: unknown, name: string): string | null {
  const lower = name.toLowerCase();
  if (!headers) return null;
  if (Array.isArray(headers)) {
    for (const h of headers) {
      const hn = (h?.name ?? h?.key ?? "").toString().toLowerCase();
      if (hn === lower) return (h?.value ?? "").toString();
    }
    return null;
  }
  if (typeof headers === "object") {
    for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
      if (k.toLowerCase() === lower) return v == null ? null : String(v);
    }
  }
  return null;
}

/**
 * Best-effort: busca o corpo + headers de um email recebido à API do Resend.
 * Só é preciso no caminho "Resend Inbound" (o webhook traz só metadados). Se
 * falhar, devolve null e o inbound é gravado só com o assunto.
 */
async function fetchReceivedEmail(
  apiKey: string,
  emailId: string,
): Promise<{ text?: string; html?: string; headers?: unknown } | null> {
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      console.warn(`[Webhook/Resend] Received API ${res.status} para ${emailId}`);
      return null;
    }
    const body = await res.json().catch(() => null);
    if (!body || typeof body !== "object") return null;
    return {
      text: (body as Record<string, unknown>).text as string | undefined,
      html: (body as Record<string, unknown>).html as string | undefined,
      headers: (body as Record<string, unknown>).headers,
    };
  } catch (e) {
    console.warn("[Webhook/Resend] fetchReceivedEmail falhou:", e);
    return null;
  }
}

// deno-lint-ignore no-explicit-any
type Supa = any;

/**
 * Regista a corrida da automação de sistema 'email-inbound' (para /automacoes
 * mostrar a "Última corrida" real). Best-effort — nunca trava.
 */
async function recordAutomationRun(supabase: Supa, ok: boolean, errorText?: string | null): Promise<void> {
  try {
    const { data: cur } = await supabase
      .from("system_automations")
      .select("run_count, fail_count")
      .eq("key", "email-inbound")
      .maybeSingle();
    await supabase
      .from("system_automations")
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: ok,
        last_run_error: errorText ?? null,
        run_count: (cur?.run_count ?? 0) + 1,
        fail_count: (cur?.fail_count ?? 0) + (ok ? 0 : 1),
      })
      .eq("key", "email-inbound");
  } catch (_e) {
    // best-effort
  }
}

interface InboundResult {
  matched: boolean;
  contact_id: string | null;
  deal_id: string | null;
  nurture_reply: boolean;
  conversation_id: string | null;
  via: string;
}

/**
 * Processa uma resposta de email (inbound). Associa a contacto/negócio já
 * existentes (NUNCA cria lead), grava a mensagem na conversa e a resposta na
 * timeline do negócio. Idempotência garantida a montante por
 * messaging_webhook_events + índice único de external_id.
 */
async function processInboundEmail(
  supabase: Supa,
  channel: { id: string; organization_id: string; business_unit_id?: string | null; credentials: Record<string, unknown> },
  data: ResendInboundData,
): Promise<InboundResult> {
  const orgId = channel.organization_id;
  const fromEmail = extractEmailAddress(data.from);
  const subject = (data.subject || "(sem assunto)").trim();
  const emailId = data.email_id;

  // --- corpo + headers ------------------------------------------------------
  let text = typeof data.text === "string" ? data.text : undefined;
  let html = typeof data.html === "string" ? data.html : undefined;
  let inReplyTo = typeof data.in_reply_to === "string" ? data.in_reply_to : null;
  let references = typeof data.references === "string" ? data.references : null;
  let messageId = typeof data.message_id === "string" ? data.message_id : null;

  // Caminho "Resend Inbound": webhook só traz metadados → buscar à Received API.
  if (!text && !html) {
    const apiKey = (channel.credentials?.apiKey as string | undefined) || "";
    if (apiKey && emailId) {
      const full = await fetchReceivedEmail(apiKey, emailId);
      if (full) {
        text = full.text ?? text;
        html = full.html ?? html;
        inReplyTo = inReplyTo ?? getHeaderValue(full.headers, "in-reply-to");
        references = references ?? getHeaderValue(full.headers, "references");
        messageId = messageId ?? getHeaderValue(full.headers, "message-id");
      }
    }
  }

  const bodyText = (text && text.trim()) ||
    (html ? html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "") ||
    "";
  const preview = bodyText ? bodyText.slice(0, 140) : "(corpo não obtido)";
  // external_id do inbound: o Message-ID próprio (globalmente único) com fallback ao email_id.
  const externalId = messageId ? messageId.replace(/^</, "").replace(/>$/, "") : `resend_in_${emailId}`;

  // --- 1) associação por In-Reply-To (o mais preciso) -----------------------
  let contactId: string | null = null;
  let dealId: string | null = null;
  let nurtureReply = false;
  let conversationId: string | null = null;
  let via = "sender";

  const candidates = parseRefIds(inReplyTo, references);
  if (candidates.length > 0) {
    // 1a) nurture_emails.external_message_id → dá contacto E negócio exactos
    const { data: nur } = await supabase
      .from("nurture_emails")
      .select("id, contact_id, deal_id")
      .eq("organization_id", orgId)
      .in("external_message_id", candidates)
      .limit(1)
      .maybeSingle();
    if (nur) {
      contactId = nur.contact_id ?? null;
      dealId = nur.deal_id ?? null;
      nurtureReply = true;
      via = "in-reply-to:nurture";
      // interromper/assinalar resposta no nurture (idempotente)
      await supabase
        .from("nurture_emails")
        .update({ replied_at: new Date().toISOString() })
        .eq("id", nur.id)
        .is("replied_at", null);
    } else {
      // 1b) messaging_messages.external_id → dá a conversa (e o contacto dela)
      const { data: mm } = await supabase
        .from("messaging_messages")
        .select("conversation_id, messaging_conversations!inner(id, contact_id, channel_id)")
        .in("external_id", candidates)
        .limit(1)
        .maybeSingle();
      const conv = mm?.messaging_conversations as { id: string; contact_id: string | null } | undefined;
      if (conv) {
        conversationId = conv.id;
        contactId = conv.contact_id ?? null;
        via = "in-reply-to:message";
      }
    }
  }

  // --- 2) fallback: remetente → contacto ------------------------------------
  if (!contactId && fromEmail) {
    const { data: c } = await supabase
      .from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("email", escapeLike(fromEmail))
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (c) contactId = c.id;
  }

  // --- 3) negócio: o do In-Reply-To ou o negócio aberto mais recente --------
  if (!dealId && contactId) {
    const { data: d } = await supabase
      .from("deals")
      .select("id")
      .eq("organization_id", orgId)
      .eq("contact_id", contactId)
      .eq("status", "open")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (d) dealId = d.id;
  }

  // --- 4) conversa (reutiliza a do In-Reply-To ou por email do remetente) ---
  if (!conversationId) {
    const { data: existingConv } = await supabase
      .from("messaging_conversations")
      .select("id, contact_id")
      .eq("channel_id", channel.id)
      .eq("external_contact_id", fromEmail)
      .limit(1)
      .maybeSingle();
    if (existingConv) {
      conversationId = existingConv.id;
      if (!contactId && existingConv.contact_id) contactId = existingConv.contact_id;
    }
  }
  if (!conversationId) {
    const { data: newConv, error: convErr } = await supabase
      .from("messaging_conversations")
      .insert({
        organization_id: orgId,
        channel_id: channel.id,
        business_unit_id: channel.business_unit_id ?? null,
        external_contact_id: fromEmail || `resend_in_${emailId}`,
        external_contact_name: data.from || fromEmail,
        contact_id: contactId,
        status: "open",
        priority: "normal",
        metadata: { source: "email-inbound", unmatched: !contactId },
      })
      .select("id")
      .single();
    if (convErr) throw new Error(`criar conversa: ${convErr.message}`);
    conversationId = newConv.id;
  }

  // --- 5) mensagem inbound na conversa (idempotente por external_id) --------
  const { error: msgErr } = await supabase.from("messaging_messages").insert({
    conversation_id: conversationId,
    external_id: externalId,
    direction: "inbound",
    content_type: "text",
    content: { type: "text", text: bodyText || `[${subject}]`, subject, html: html ?? null },
    status: "delivered",
    delivered_at: new Date().toISOString(),
    sender_name: data.from || fromEmail,
    metadata: {
      source: "email-inbound",
      resend_email_id: emailId,
      message_id: messageId,
      in_reply_to: inReplyTo,
      subject,
      from: data.from,
      has_body: !!bodyText,
    },
  });
  if (msgErr && !msgErr.message.toLowerCase().includes("duplicate")) {
    throw new Error(`inserir mensagem: ${msgErr.message}`);
  }

  await supabase
    .from("messaging_conversations")
    .update({
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      last_message_direction: "inbound",
      status: "open",
    })
    .eq("id", conversationId);

  // --- 6) timeline do negócio/contacto --------------------------------------
  // Só grava se houver contacto ou negócio (evita actividade totalmente órfã).
  if (contactId || dealId) {
    await supabase.from("deal_activities").insert({
      organization_id: orgId,
      deal_id: dealId,
      contact_id: contactId,
      type: "email_inbound",
      actor: "system",
      description: `📧 Resposta do cliente por email — ${subject}${preview ? `\n${preview}` : ""}`,
      metadata: {
        source: "email-inbound",
        resend_email_id: emailId,
        message_id: messageId,
        in_reply_to: inReplyTo,
        via,
        from: data.from,
        subject,
        conversation_id: conversationId,
      },
    });
  }

  return {
    matched: !!(contactId || dealId),
    contact_id: contactId,
    deal_id: dealId,
    nurture_reply: nurtureReply,
    conversation_id: conversationId,
    via,
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only POST allowed
  if (req.method !== "POST") {
    return json(405, { error: "Método não permitido" });
  }

  const channelId = getChannelIdFromPath(req);
  if (!channelId) {
    return json(404, { error: "channel_id ausente na URL" });
  }

  const url = new URL(req.url);
  const isWorkerInbound = url.searchParams.get("source") === "worker";

  // Read raw body BEFORE parsing JSON — needed for signature verification
  const rawBody = await req.text();

  // Setup Supabase client
  const supabaseUrl =
    Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL");
  const serviceKey =
    Deno.env.get("CRM_SUPABASE_SECRET_KEY") ??
    Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: "Supabase não configurado no runtime" });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch channel to verify it exists
  const { data: channel, error: channelErr } = await supabase
    .from("messaging_channels")
    .select("id, organization_id, business_unit_id, credentials")
    .eq("id", channelId)
    .eq("channel_type", "email")
    .is("deleted_at", null)
    .maybeSingle();

  if (channelErr) {
    return json(500, { error: "Erro ao buscar canal", details: channelErr.message });
  }

  if (!channel) {
    return json(404, { error: "Canal não encontrado" });
  }

  const credentials = (channel.credentials ?? {}) as Record<string, string>;

  // =========================================================================
  // AUTENTICAÇÃO
  // =========================================================================
  if (isWorkerInbound) {
    // Cloudflare Email Worker — segredo partilhado (timing-safe).
    const inboundSecret = credentials.inboundSecret;
    const provided = req.headers.get("x-inbound-secret");
    if (!inboundSecret) {
      console.warn(`[Webhook/Resend] inboundSecret não configurado para ${channelId} — rejeitar worker`);
      return json(401, { error: "inboundSecret não configurado para este canal" });
    }
    if (!provided || !(await timingSafeEqualStr(inboundSecret, provided))) {
      console.warn(`[Webhook/Resend] x-inbound-secret inválido para ${channelId}`);
      return json(401, { error: "Segredo de inbound inválido" });
    }
  } else {
    // Resend (status + Resend Inbound) — Svix.
    const webhookSecret = credentials.webhookSecret;
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (webhookSecret) {
      if (!svixId || !svixTimestamp || !svixSignature) {
        console.warn(`[Webhook/Resend] Missing Svix headers for channel ${channelId}`);
        return json(401, { error: "Svix headers ausentes" });
      }
      const isValid = await verifySvixSignature(rawBody, { svixId, svixTimestamp, svixSignature }, webhookSecret);
      if (!isValid) {
        console.warn(`[Webhook/Resend] Invalid Svix signature for channel ${channelId}`);
        return json(401, { error: "Assinatura Svix inválida" });
      }
    } else {
      // Default-deny: rejeita pedidos não autenticados quando não há secret.
      console.warn(`[Webhook/Resend] No webhookSecret configured for channel ${channelId} — rejecting request`);
      return json(401, { error: "Webhook secret não configurado para este canal" });
    }
  }

  // Parse payload from raw body
  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return json(400, { error: "JSON inválido" });
  }

  // Validate payload structure
  if (!payload.type || !payload.data?.email_id) {
    return json(400, { error: "Payload inválido: type ou data.email_id ausente" });
  }

  // Generate stable event ID for deduplication
  const externalEventId = generateStableEventId(payload);

  // Log webhook event for audit and deduplication
  const { error: eventInsertErr } = await supabase
    .from("messaging_webhook_events")
    .insert({
      channel_id: channelId,
      event_type: payload.type,
      external_event_id: externalEventId,
      payload: payload as unknown as Record<string, unknown>,
      processed: false,
    });

  // If duplicate (already processed), return early with success
  if (eventInsertErr?.message?.toLowerCase().includes("duplicate")) {
    console.log(`[Webhook/Resend] Duplicate event ignored: ${externalEventId}`);
    return json(200, { ok: true, duplicate: true, event_id: externalEventId });
  }

  if (eventInsertErr) {
    console.error("[Webhook/Resend] Error logging webhook event:", eventInsertErr);
  }

  // =========================================================================
  // INBOUND (email.received) — resposta do lead entra no CRM
  // =========================================================================
  if (payload.type === "email.received") {
    // ON/OFF via /automacoes (a edge respeita o enabled da automação de sistema).
    let enabled = true;
    try {
      const { data: sys } = await supabase
        .from("system_automations")
        .select("enabled")
        .eq("key", "email-inbound")
        .maybeSingle();
      if (sys && sys.enabled === false) enabled = false;
    } catch (_e) {
      // fail-open: se não conseguir ler, processa na mesma
    }

    if (!enabled) {
      await supabase
        .from("messaging_webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString(), error: "skipped: disabled" })
        .eq("channel_id", channelId)
        .eq("external_event_id", externalEventId);
      return json(200, { ok: true, skipped: "disabled" });
    }

    try {
      const result = await processInboundEmail(supabase, channel, payload.data);
      await recordAutomationRun(supabase, true, null);
      await supabase
        .from("messaging_webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("external_event_id", externalEventId);
      console.log(`[Webhook/Resend] Inbound processado (${result.via}): contact=${result.contact_id} deal=${result.deal_id}`);
      return json(200, { ok: true, event_type: payload.type, inbound: result });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      console.error("[Webhook/Resend] Inbound processing error:", msg);
      await recordAutomationRun(supabase, false, msg);
      await supabase
        .from("messaging_webhook_events")
        .update({ processed: true, processed_at: new Date().toISOString(), error: msg })
        .eq("channel_id", channelId)
        .eq("external_event_id", externalEventId);
      // Nunca 5xx em erro lógico — evita retry storms do Resend.
      return json(200, { ok: false, error: "Inbound processing error", details: msg });
    }
  }

  // =========================================================================
  // STATUS EVENTS (sent/delivered/opened/bounced/…)
  // =========================================================================
  try {
    const emailId = payload.data.email_id;
    const timestamp = new Date(payload.created_at).toISOString();
    const newStatus = mapEventToStatus(payload.type);

    if (newStatus) {
      // Get error info for failed status
      const errorCode = newStatus === "failed" ? payload.type.replace("email.", "").toUpperCase() : null;
      const errorMessage = newStatus === "failed"
        ? (payload.data.bounce?.message || (payload.type === "email.complained" ? "Recipient marked email as spam" : "Email failed"))
        : null;

      // Use RPC for atomic, idempotent status update
      const { data: result, error } = await supabase.rpc("update_message_status_if_newer", {
        p_external_id: emailId,
        p_new_status: newStatus,
        p_timestamp: timestamp,
        p_error_code: errorCode,
        p_error_message: errorMessage,
      });

      if (error) {
        console.error("[Webhook/Resend] Status update RPC error:", error);
      } else if (result?.updated) {
        console.log(`[Webhook/Resend] Status updated: ${emailId} → ${newStatus}`);
      } else {
        console.log(`[Webhook/Resend] Status skipped (${result?.reason}): ${emailId} → ${newStatus}`);
      }
    } else {
      // Just log informational events
      console.log(`[Webhook/Resend] Informational event: ${payload.type} for ${emailId}`);
    }

    // Log click events for analytics
    if (payload.type === "email.clicked" && payload.data.click) {
      console.log(`[Webhook/Resend] Link clicked: ${payload.data.click.link}`);
    }

    // BRIEF 7 — movimento de nurture: quem abriu/clicou um email de nurture sobe
    // ao topo da Power List do dia seguinte. Casa pelo external_message_id (o id
    // devolvido pelo Resend, guardado na linha da fila). Idempotente (só grava
    // quando ainda está a null). Um clique implica também abertura.
    if (payload.type === "email.opened" || payload.type === "email.clicked") {
      try {
        await supabase
          .from("nurture_emails")
          .update({ opened_at: timestamp })
          .eq("external_message_id", emailId)
          .is("opened_at", null);
        if (payload.type === "email.clicked") {
          await supabase
            .from("nurture_emails")
            .update({ clicked_at: timestamp })
            .eq("external_message_id", emailId)
            .is("clicked_at", null);
        }
      } catch (e) {
        console.error("[Webhook/Resend] nurture movement update falhou:", e);
      }
    }

    // Mark event as processed
    await supabase
      .from("messaging_webhook_events")
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq("channel_id", channelId)
      .eq("external_event_id", externalEventId);

    return json(200, { ok: true, event_type: payload.type });
  } catch (error) {
    console.error("[Webhook/Resend] Processing error:", error);

    // Log error in webhook event
    await supabase
      .from("messaging_webhook_events")
      .update({
        processed: true,
        processed_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("channel_id", channelId)
      .eq("external_event_id", externalEventId);

    // Return 200 to prevent Resend from retrying
    return json(200, {
      ok: false,
      error: "Processing error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
