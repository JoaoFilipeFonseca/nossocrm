// ============================================================================
// action.send_whatsapp — envia texto via canal WhatsApp configurado da org
// ============================================================================
// Sprint 32 c2. Ticket 3.1 do automation-engine sprint plan.
//
// Le credenciais de messaging_channels (provider='meta_cloud', status='connected')
// e invoca Meta Graph API directamente. Para mensagens fora da janela 24h
// (templates HSM), criar atomo separado action.send_whatsapp_template no futuro.
//
// Config:
//   - to (string, E.164 sem '+' ou com): destinatario
//   - text (string): corpo da mensagem (suporta LiquidJS {{...}} resolvido a montante)
//   - channel_id (string, opcional): UUID do messaging_channels a usar. Se omitido,
//     usa o primeiro canal Meta Cloud 'connected' da organizacao.
//
// NOTA: pre-requisito plano produto = Meta Business Manager + WhatsApp Cloud
// API setup. Se nao houver canal configurado, atomo falha com erro claro.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

interface MetaCloudCreds {
  phoneNumberId?: string;
  accessToken?: string;
  apiVersion?: string;
}

interface MetaSendResponse {
  messaging_product?: 'whatsapp';
  messages?: { id: string }[];
  error?: { message: string; code: number; type?: string };
}

export const actionSendWhatsapp: AtomDefinition = {
  id: 'action.send_whatsapp',
  category: 'action',
  name: 'Enviar WhatsApp',
  icon: '💬',
  description: 'Envia mensagem WhatsApp via canal Meta Cloud configurado da organização.',

  configSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Telefone destinatário em formato E.164 (ex: 351912345678).' },
      text: { type: 'string', description: 'Corpo da mensagem. Suporta LiquidJS {{contact.first_name}} resolvido a montante.' },
      channel_id: {
        type: 'string',
        description: 'Opcional. UUID do messaging_channels. Se omitido, usa o primeiro canal Meta Cloud connected.',
      },
    },
    required: ['to', 'text'],
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
    const to = String(context.config.to ?? '').replace(/\D/g, '');
    const text = String(context.config.text ?? '').trim();
    const overrideChannelId = (context.config.channel_id as string | undefined) || null;

    if (!to) throw new Error('to (telefone) é obrigatório');
    if (!text) throw new Error('text é obrigatório');

    // Procurar canal: override ou primeiro Meta Cloud connected da org
    let channelQuery = context.supabase
      .from('messaging_channels')
      .select('id, credentials, provider, channel_type, status')
      .eq('organization_id', context.organizationId)
      .eq('provider', 'meta_cloud')
      .eq('channel_type', 'whatsapp')
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
          ? `Canal ${overrideChannelId} não encontrado ou não é Meta Cloud WhatsApp`
          : 'Sem canal WhatsApp Meta Cloud connected. Configurar em /settings/integracoes#channels',
      );
    }

    const creds = (channel.credentials || {}) as MetaCloudCreds;
    if (!creds.phoneNumberId || !creds.accessToken) {
      throw new Error('Credenciais Meta Cloud incompletas (phoneNumberId + accessToken obrigatórios)');
    }

    const apiVersion = creds.apiVersion || 'v21.0';
    const url = `https://graph.facebook.com/${apiVersion}/${creds.phoneNumberId}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
    });

    const json = (await res.json().catch(() => ({}))) as MetaSendResponse;

    if (!res.ok || json.error) {
      const errMsg = json.error?.message || `Meta API ${res.status}`;
      throw new Error(`WhatsApp envio falhou: ${errMsg}`);
    }

    const messageId = json.messages?.[0]?.id || '';

    return {
      ok: true,
      external_message_id: messageId,
      sent_at: new Date().toISOString(),
      channel_id: channel.id,
    };
  },
};
