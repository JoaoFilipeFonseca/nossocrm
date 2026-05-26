// ============================================================================
// example-atom-send-whatsapp.ts — Plugin completo de envio WhatsApp
// ============================================================================
// Localização final: /lib/automation-engine/plugins/actions/send-whatsapp.ts
//
// Este plugin demonstra o padrão completo:
//   1. Estrutura AtomDefinition
//   2. configSchema rico (gera UI no builder)
//   3. outputSchema (para nós seguintes referenciarem variáveis)
//   4. Reutilização da Edge Function messaging-webhook-meta existente
//   5. Registo de activity em deal_activities
//   6. Tratamento de erros descritivo
//   7. Idempotência
// ============================================================================

import type { AtomDefinition, ExecutionContext } from '../../types';

const plugin: AtomDefinition = {
  // --------------------------------------------------------------------------
  // IDENTIFICAÇÃO
  // --------------------------------------------------------------------------
  id: 'action.send_whatsapp',
  category: 'action',
  name: 'Enviar WhatsApp',
  icon: '💬',
  description: 'Envia mensagem via WhatsApp Cloud API. Reutiliza a integração existente do Foco Imo.',
  version: '1.0',
  
  requiresIntegration: 'whatsapp_cloud_api',
  
  // --------------------------------------------------------------------------
  // CONFIG SCHEMA (gera formulário automaticamente no builder)
  // --------------------------------------------------------------------------
  configSchema: {
    type: 'object',
    required: ['integration_id', 'to', 'body'],
    properties: {
      integration_id: {
        type: 'string',
        title: 'Conta WhatsApp',
        description: 'Qual número usar para enviar',
        ui: 'integration-picker',
        provider: 'whatsapp_cloud_api',
      },
      to: {
        type: 'string',
        title: 'Para (número de telefone)',
        description: 'Formato internacional, ex: +351912345678',
        ui: 'variable-input',
        placeholder: '{{contact.phone}}',
      },
      body: {
        type: 'string',
        title: 'Mensagem',
        description: 'Texto da mensagem. Pode incluir variáveis como {{contact.first_name}}.',
        ui: 'textarea-with-variables',
        minLength: 1,
        maxLength: 4096,
      },
      media_url: {
        type: 'string',
        title: 'URL de mídia (opcional)',
        description: 'Imagem, vídeo, áudio ou documento',
        format: 'uri',
      },
      template_name: {
        type: 'string',
        title: 'Template aprovado (opcional)',
        description: 'Para mensagens iniciadas pela empresa fora da janela de 24h',
      },
      template_params: {
        type: 'object',
        title: 'Parâmetros do template',
        additionalProperties: { type: 'string' },
      },
      interactive_buttons: {
        type: 'array',
        title: 'Botões de resposta rápida (opcional)',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', title: 'ID' },
            label: { type: 'string', title: 'Texto do botão', maxLength: 20 },
          },
        },
        maxItems: 3,
      },
      record_activity: {
        type: 'boolean',
        title: 'Registar activity no negócio',
        description: 'Cria entrada em deal_activities (recomendado)',
        default: true,
      },
    },
  },
  
  // --------------------------------------------------------------------------
  // OUTPUT SCHEMA (para nós seguintes referenciarem)
  // --------------------------------------------------------------------------
  outputSchema: {
    type: 'object',
    properties: {
      message_id: { type: 'string', description: 'ID Meta da mensagem' },
      conversation_id: { type: 'string' },
      delivered: { type: 'boolean' },
      sent_at: { type: 'string', format: 'date-time' },
    },
  },
  
  // --------------------------------------------------------------------------
  // POLÍTICA DE RETRY
  // --------------------------------------------------------------------------
  retry: {
    maxAttempts: 3,
    backoffMs: 5_000, // 5s entre tentativas
    backoffMultiplier: 2, // exponencial (5s, 10s, 20s)
  },
  
  timeoutMs: 30_000,
  
  // --------------------------------------------------------------------------
  // VALIDAÇÃO (além do JSON Schema)
  // --------------------------------------------------------------------------
  validate(config) {
    const errors: string[] = [];
    
    // Validar formato do número
    const phone = config.to as string;
    if (phone && !phone.match(/^\+\d{8,15}$/)) {
      errors.push('Número de telefone deve estar em formato internacional (+351912345678)');
    }
    
    // Se tem template, não pode ter body solto (ambíguo)
    if (config.template_name && config.body) {
      errors.push('Use template OU mensagem livre, não os dois ao mesmo tempo');
    }
    
    return errors.length > 0 ? errors : null;
  },
  
  // --------------------------------------------------------------------------
  // EXECUÇÃO
  // --------------------------------------------------------------------------
  async execute(context: ExecutionContext) {
    const {
      integration_id,
      to,
      body,
      media_url,
      template_name,
      template_params,
      interactive_buttons,
      record_activity = true,
    } = context.config as {
      integration_id: string;
      to: string;
      body: string;
      media_url?: string;
      template_name?: string;
      template_params?: Record<string, string>;
      interactive_buttons?: Array<{ id: string; label: string }>;
      record_activity?: boolean;
    };
    
    await context.log('info', `A enviar WhatsApp para ${to}`);
    
    // Modo simulação: não envia, devolve fake response
    if (context.isTest && context.testOptions?.simulationMode) {
      await context.log('info', '[SIMULAÇÃO] Mensagem não enviada');
      return {
        message_id: 'sim_' + crypto.randomUUID(),
        conversation_id: 'sim_conversation',
        delivered: true,
        sent_at: new Date().toISOString(),
        _simulated: true,
      };
    }
    
    // Carregar credenciais da integração
    const integration = await context.getIntegration(integration_id);
    const accessToken = integration.credentials.access_token;
    const phoneNumberId = integration.metadata.phone_number_id as string;
    
    if (!accessToken || !phoneNumberId) {
      throw new Error('Integração WhatsApp sem credenciais válidas');
    }
    
    // Construir payload Meta
    let payload: Record<string, unknown>;
    
    if (template_name) {
      payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'template',
        template: {
          name: template_name,
          language: { code: 'pt_PT' },
          components: template_params
            ? [
                {
                  type: 'body',
                  parameters: Object.values(template_params).map((value) => ({
                    type: 'text',
                    text: value,
                  })),
                },
              ]
            : [],
        },
      };
    } else if (interactive_buttons && interactive_buttons.length > 0) {
      payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: interactive_buttons.map((btn) => ({
              type: 'reply',
              reply: { id: btn.id, title: btn.label },
            })),
          },
        },
      };
    } else if (media_url) {
      const mediaType = guessMediaType(media_url);
      payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: mediaType,
        [mediaType]: { link: media_url, caption: body },
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: { body, preview_url: true },
      };
    }
    
    // Idempotency key (caso retry, não duplica)
    const idempotencyKey = `${context.executionId}-${context.nodeId}`;
    
    // Chamada à API Meta
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payload),
      }
    );
    
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`WhatsApp API ${response.status}: ${errorBody}`);
    }
    
    const result = await response.json();
    const messageId = result.messages?.[0]?.id;
    
    if (!messageId) {
      throw new Error('Meta API não devolveu message_id');
    }
    
    await context.log('info', `WhatsApp enviado (message_id: ${messageId})`);
    
    // Registar mensagem nas tabelas existentes (messaging_messages)
    await context.supabase.from('messaging_messages').insert({
      organization_id: context.organizationId,
      external_id: messageId,
      direction: 'outbound',
      channel: 'whatsapp',
      to,
      body,
      status: 'sent',
      sent_at: new Date().toISOString(),
      automation_execution_id: context.executionId,
    });
    
    // Registar activity no deal (se aplicável)
    if (record_activity && context.dealId) {
      await context.recordActivity('WHATSAPP', {
        direction: 'outbound',
        body,
        to,
        message_id: messageId,
        via: 'automation',
      });
    }
    
    return {
      message_id: messageId,
      conversation_id: result.conversation?.id ?? null,
      delivered: true,
      sent_at: new Date().toISOString(),
    };
  },
};

// ----------------------------------------------------------------------------
// Helpers locais
// ----------------------------------------------------------------------------
function guessMediaType(url: string): 'image' | 'video' | 'audio' | 'document' {
  const ext = url.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
  if (['mp4', 'mov', '3gp'].includes(ext)) return 'video';
  if (['mp3', 'ogg', 'wav', 'm4a', 'opus'].includes(ext)) return 'audio';
  return 'document';
}

export default plugin;
