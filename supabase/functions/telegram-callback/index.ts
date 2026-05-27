/**
 * telegram-callback — recebe callback_query do bot Telegram CRM.
 *
 * Sprint 4.1, commit 1.
 *
 * Usado pelo átomo `logic.human_approval`. Quando o João carrega num botão
 * inline (Aprovar / Rejeitar / Editar), o Telegram faz POST para esta função.
 *
 * Fluxo:
 *  1. valida secret (path /telegram-callback?secret=... protege contra spam)
 *  2. extrai callback_query.data formato "<decision>:<token>"
 *  3. procura automation_executions onde pending_approval_token = token e status='waiting'
 *  4. grava em variables a decisão + acknowledge no Telegram (answerCallbackQuery)
 *  5. edita a mensagem original para remover botões e mostrar o resultado
 *  6. POST para automation-resume com execution_id
 *
 * Sem JWT (verify_jwt=false) porque é webhook público; segurança via secret na URL.
 */
import { createClient } from "npm:@supabase/supabase-js@2";

interface TelegramUpdate {
  callback_query?: {
    id: string;
    from: { id: number; username?: string; first_name?: string };
    message?: { message_id: number; chat: { id: number }; text?: string };
    data?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("OK", { status: 200 });

  // Validação do secret na URL (?secret=...)
  const url = new URL(req.url);
  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  const providedSecret = url.searchParams.get("secret") ?? req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!expectedSecret || providedSecret !== expectedSecret) {
    // Não devolve 401 — Telegram interpreta como falha e faz retry. Devolve 200 silencioso.
    console.warn("[telegram-callback] secret mismatch", providedSecret.slice(0, 4));
    return new Response("ok", { status: 200 });
  }

  const supabaseUrl = Deno.env.get("CRM_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("CRM_SUPABASE_SECRET_KEY") ?? Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || !supabaseUrl) {
    console.error("[telegram-callback] missing supabase env");
    return new Response("ok", { status: 200 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  let update: TelegramUpdate;
  try { update = await req.json(); } catch { return new Response("ok", { status: 200 }); }

  const cb = update.callback_query;
  if (!cb || !cb.data) return new Response("ok", { status: 200 });

  // Formato esperado: "<decision>:<token>" onde decision ∈ {approved, rejected, edited}
  const [decision, token] = cb.data.split(":");
  if (!decision || !token || !["approved", "rejected", "edited"].includes(decision)) {
    console.warn("[telegram-callback] callback_data inválida:", cb.data);
    return new Response("ok", { status: 200 });
  }

  // Lookup da execution suspensa
  const { data: exec, error: execErr } = await supabase
    .from("automation_executions")
    .select("id, organization_id, status, variables, resume_node_id")
    .eq("pending_approval_token", token)
    .eq("status", "waiting")
    .maybeSingle();

  if (execErr || !exec) {
    console.warn("[telegram-callback] execution não encontrada para token", token.slice(0, 8), execErr?.message);
    // Acknowledge ao Telegram para evitar spinner infinito
    await ackCallback(supabase, exec?.organization_id ?? null, cb.id, "Já processado ou expirado");
    return new Response("ok", { status: 200 });
  }

  // Grava a decisão nas variables (o nó suspenso lê isto no resume)
  const variables = (exec.variables ?? {}) as Record<string, { output: Record<string, unknown> }>;
  const nodeId = exec.resume_node_id ?? "";
  const prev = variables[nodeId]?.output ?? {};
  variables[nodeId] = {
    output: {
      ...prev,
      _branch_taken: decision,
      _human_approval: {
        decision,
        decided_at: new Date().toISOString(),
        by: cb.from.username ?? cb.from.first_name ?? `user:${cb.from.id}`,
      },
    },
  };

  // Limpa o token + marca para retomar IMEDIATAMENTE
  await supabase.from("automation_executions").update({
    pending_approval_token: null,
    resume_at: new Date().toISOString(),
    variables,
    status: "waiting", // cron resume vai apanhar
  }).eq("id", exec.id);

  // Garante schedule entry para cron resume apanhar (idempotent: cancela anteriores)
  await supabase.from("automation_schedules").update({ status: "cancelled" })
    .eq("execution_id", exec.id).eq("status", "pending");
  await supabase.from("automation_schedules").insert({
    execution_id: exec.id,
    organization_id: exec.organization_id,
    scheduled_for: new Date().toISOString(),
    resume_node_id: nodeId,
    status: "pending",
  });

  // Acknowledge Telegram + edita mensagem para remover botões
  await ackCallback(supabase, exec.organization_id, cb.id, decisionLabel(decision));
  if (cb.message) {
    await editMessage(supabase, exec.organization_id, cb.message.chat.id, cb.message.message_id, cb.message.text, decision, cb.from);
  }

  return new Response("ok", { status: 200 });
});

function decisionLabel(decision: string): string {
  switch (decision) {
    case "approved": return "✅ Aprovado";
    case "rejected": return "❌ Rejeitado";
    case "edited": return "✎ Marcado para editar";
    default: return decision;
  }
}

async function ackCallback(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string | null,
  callbackQueryId: string,
  text: string,
) {
  if (!organizationId) return;
  const { data: settings } = await supabase
    .from("organization_settings")
    .select("telegram_crm_bot_token")
    .eq("organization_id", organizationId)
    .single();
  const token = settings?.telegram_crm_bot_token;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
  }).catch(() => {});
}

async function editMessage(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string,
  chatId: number,
  messageId: number,
  originalText: string | undefined,
  decision: string,
  from: { username?: string; first_name?: string; id: number },
) {
  const { data: settings } = await supabase
    .from("organization_settings")
    .select("telegram_crm_bot_token")
    .eq("organization_id", organizationId)
    .single();
  const token = settings?.telegram_crm_bot_token;
  if (!token) return;
  const who = from.username ?? from.first_name ?? `user:${from.id}`;
  const newText = `${originalText ?? ""}\n\n<b>${decisionLabel(decision)}</b> por ${who} a ${new Date().toLocaleString("pt-PT")}`;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: newText,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] }, // remove botões
    }),
  }).catch(() => {});
}
