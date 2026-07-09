// ============================================================================
// action.send_email — envia email via canal Resend configurado da organizacao
// ============================================================================
// Sprint 32 c4. Tickets 1.5 + 1.8 do automation-engine sprint plan.
//
// Le credenciais de messaging_channels (provider='resend', channel_type='email',
// status='connected') e invoca Resend API directamente
// (POST https://api.resend.com/emails).
//
// Config:
//   - to (string): destinatario (email)
//   - subject (string)
//   - text (string): corpo plain text
//   - html (string, opcional): corpo HTML alternativo
//   - reply_to (string, opcional): override do reply-to do canal
//   - channel_id (string, opcional): UUID de messaging_channels; default = 1o
//     canal Resend connected da org
//
// Pre-requisito: dominio configurado no Resend com DKIM/SPF em
// joaofilipefonseca.pt (bloqueio externo conhecido). Sem canal, atomo falha
// com mensagem clara.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';
import {
  appendComplianceFooter,
  buildUnsubscribeUrl,
  DEFAULT_PRIVACY_POLICY_URL,
  escapeIlike,
  unsubscribeToken,
} from '@/lib/messaging/emailCompliance';

const APP_BASE_URL = process.env.APP_URL || 'https://crm.joaofilipefonseca.pt';

interface ResendCreds {
  apiKey?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

interface ResendSendResponse {
  id?: string;
  from?: string;
  to?: string[];
  created_at?: string;
  error?: { name?: string; message?: string };
  name?: string;
  message?: string;
  statusCode?: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actionSendEmail: AtomDefinition = {
  id: 'action.send_email',
  category: 'action',
  name: 'Enviar Email',
  icon: '📧',
  description: 'Envia email via canal Resend configurado da organização.',

  configSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Endereço de email destinatário.' },
      subject: { type: 'string', description: 'Assunto do email.' },
      text: { type: 'string', description: 'Corpo plain text. Suporta LiquidJS resolvido a montante.' },
      html: { type: 'string', description: 'Corpo HTML opcional.' },
      reply_to: { type: 'string', description: 'Reply-To opcional, sobrepõe o default do canal.' },
      channel_id: {
        type: 'string',
        description: 'Opcional. UUID do messaging_channels. Default = 1º canal Resend connected.',
      },
    },
    required: ['to', 'subject', 'text'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      ok: { type: 'boolean' },
      external_message_id: { type: 'string' },
      sent_at: { type: 'string' },
      channel_id: { type: 'string' },
    },
  },

  retry: { maxAttempts: 2, backoffMs: 800 },
  timeoutMs: 20000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const to = String(context.config.to ?? '').trim();
    const subject = String(context.config.subject ?? '').trim();
    const text = String(context.config.text ?? '').trim();
    const html = context.config.html ? String(context.config.html) : undefined;
    const replyToOverride = (context.config.reply_to as string | undefined) || null;
    const fromNameOverride = (context.config.from_name as string | undefined)?.trim() || null;
    const overrideChannelId = (context.config.channel_id as string | undefined) || null;

    if (!to || !EMAIL_REGEX.test(to)) throw new Error(`to (email) inválido: ${to}`);
    if (!subject) throw new Error('subject é obrigatório');
    if (!text) throw new Error('text é obrigatório');

    // RGPD (MKT-SEQUENCES Fatia 1): contacto com opt-out nunca recebe.
    // Não é erro — a automação continua; devolve skipped para auditoria.
    const { data: optedOut, error: optErr } = await context.supabase
      .from('contacts')
      .select('id')
      .eq('organization_id', context.organizationId)
      .eq('email_opt_out', true)
      .ilike('email', escapeIlike(to))
      .limit(1);
    if (optErr) throw new Error(`Falha a verificar opt-out: ${optErr.message}`);
    if (optedOut && optedOut.length > 0) {
      return { ok: false, skipped: 'opt_out', to, checked_at: new Date().toISOString() };
    }

    // Carregar canal: override OU 1º Resend connected
    let channelQuery = context.supabase
      .from('messaging_channels')
      .select('id, credentials, provider, channel_type, status')
      .eq('organization_id', context.organizationId)
      .eq('provider', 'resend')
      .eq('channel_type', 'email')
      .is('deleted_at', null);

    if (overrideChannelId) {
      channelQuery = channelQuery.eq('id', overrideChannelId);
    } else {
      channelQuery = channelQuery.eq('status', 'connected');
    }

    const { data: channels, error: chErr } = await channelQuery.order('updated_at', { ascending: false }).limit(1);
    if (chErr) throw new Error(`Falha a ler messaging_channels: ${chErr.message}`);

    const channel = channels?.[0];
    if (!channel) {
      throw new Error(
        overrideChannelId
          ? `Canal ${overrideChannelId} não encontrado ou não é Resend email`
          : 'Sem canal Resend connected. Configurar em /settings/integracoes#channels (requer DKIM/SPF em joaofilipefonseca.pt)',
      );
    }

    const creds = (channel.credentials || {}) as ResendCreds;
    if (!creds.apiKey || !creds.fromEmail) {
      throw new Error('Credenciais Resend incompletas (apiKey + fromEmail obrigatórios)');
    }

    const effectiveFromName = fromNameOverride ?? creds.fromName;
    const fromHeader = effectiveFromName ? `${effectiveFromName} <${creds.fromEmail}>` : creds.fromEmail;
    const replyTo = replyToOverride || creds.replyTo;

    // RGPD: rodapé com anular subscrição (token HMAC) + política de privacidade.
    let unsubscribeUrl: string | null = null;
    const { data: unsubSecret } = await context.supabase.rpc('get_email_unsubscribe_secret');
    if (typeof unsubSecret === 'string' && unsubSecret.length > 0) {
      const token = await unsubscribeToken(context.organizationId, to, unsubSecret);
      unsubscribeUrl = buildUnsubscribeUrl(APP_BASE_URL, context.organizationId, to, token);
    }
    const { data: orgSettings } = await context.supabase
      .from('organization_settings')
      .select('privacy_policy_url')
      .eq('organization_id', context.organizationId)
      .maybeSingle();
    const privacyPolicyUrl =
      (orgSettings as { privacy_policy_url?: string | null } | null)?.privacy_policy_url || DEFAULT_PRIVACY_POLICY_URL;
    const footered = appendComplianceFooter({
      text,
      html,
      senderName: creds.fromName || creds.fromEmail,
      unsubscribeUrl,
      privacyPolicyUrl,
    });

    const body: Record<string, unknown> = {
      from: fromHeader,
      to: [to],
      subject,
      text: footered.text,
    };
    if (footered.html) body.html = footered.html;
    if (replyTo) body.reply_to = replyTo;
    if (unsubscribeUrl) body.headers = { 'List-Unsubscribe': `<${unsubscribeUrl}>` };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => ({}))) as ResendSendResponse;

    if (!res.ok || json.error || (json.statusCode && json.statusCode >= 400)) {
      const errMsg = json.error?.message || json.message || `Resend API ${res.status}`;
      throw new Error(`Email envio falhou: ${errMsg}`);
    }

    return {
      ok: true,
      external_message_id: json.id || '',
      sent_at: new Date().toISOString(),
      channel_id: channel.id,
    };
  },
};
