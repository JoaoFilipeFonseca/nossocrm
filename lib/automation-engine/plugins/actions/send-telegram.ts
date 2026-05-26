// ============================================================================
// action.send_telegram — envia mensagem para o bot Telegram do CRM
// ============================================================================
// Sprint 1.1, commit 2 de 3.
//
// Usa o bot CRM (organization_settings.telegram_crm_bot_token) e por defeito
// envia para organization_settings.telegram_crm_chat_id, com override opcional
// no config (chat_id).
//
// O parse_mode é HTML por defeito (igual a lib/notifications/telegram.ts).
//
// O Sprint 1.0 do executor não tem LiquidJS, por isso text é literal. Sprint
// 1.2 permite {{contact.first_name}} etc.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionSendTelegram: AtomDefinition = {
  id: 'action.send_telegram',
  category: 'action',
  name: 'Enviar Telegram',
  icon: '📨',
  description: 'Envia mensagem para o teu bot Telegram. Usa o token do CRM e chat por defeito da organização.',

  configSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Mensagem a enviar (suporta HTML).' },
      chat_id: { type: 'string', description: 'Opcional, sobrepõe o telegram_crm_chat_id default.' },
      parse_mode: { type: 'string', enum: ['HTML', 'MarkdownV2', 'none'], default: 'HTML' },
    },
    required: ['text'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      message_id: { type: 'integer' },
      sent_at: { type: 'string' },
    },
  },

  retry: { maxAttempts: 2, backoffMs: 500 },
  timeoutMs: 15000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const text = String(context.config.text ?? '');
    if (!text) throw new Error('text é obrigatório');

    const { data: settings, error: sErr } = await context.supabase
      .from('organization_settings')
      .select('telegram_crm_bot_token, telegram_crm_chat_id')
      .eq('organization_id', context.organizationId)
      .single();

    if (sErr || !settings?.telegram_crm_bot_token) {
      throw new Error('telegram_crm_bot_token em falta em organization_settings');
    }

    const chatId = String(context.config.chat_id ?? settings.telegram_crm_chat_id ?? '');
    if (!chatId) {
      throw new Error('telegram_crm_chat_id em falta (passa chat_id no config ou configura na BD)');
    }

    const parseMode = String(context.config.parse_mode ?? 'HTML');
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (parseMode !== 'none') {
      payload.parse_mode = parseMode;
    }

    const res = await fetch(
      `https://api.telegram.org/bot${settings.telegram_crm_bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: { message_id?: number };
      description?: string;
    };

    if (!res.ok || !json.ok) {
      throw new Error(`Telegram API erro ${res.status}: ${json.description ?? 'unknown'}`);
    }

    return {
      ok: true,
      message_id: json.result?.message_id ?? 0,
      sent_at: new Date().toISOString(),
    };
  },
};
