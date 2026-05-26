// ============================================================================
// action.http_request — chamada HTTP arbitrária
// ============================================================================
// Sprint 1.1, commit 1 de 3.
//
// Acção universal para falar com APIs externas sem precisar de credenciais
// guardadas (caso precise, usar átomos específicos como send_telegram).
//
// Útil para webhooks Zapier/Make, ping a endpoints de monitorização, enviar
// dados a sistemas legacy.
//
// Sprint 1.0 do executor não tem ainda LiquidJS, por isso URL e body são
// strings literais. Sprint 1.2 adiciona variáveis {{...}}.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionHttpRequest: AtomDefinition = {
  id: 'action.http_request',
  category: 'action',
  name: 'Chamada HTTP',
  icon: '🌐',
  description: 'Faz pedido HTTP a um URL externo (webhooks, APIs).',

  configSchema: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      url: { type: 'string', format: 'uri' },
      headers: { type: 'object', additionalProperties: { type: 'string' } },
      body: { type: 'string', description: 'Body em texto (JSON serializado, form-urlencoded, etc.)' },
      timeout_ms: { type: 'integer', minimum: 100, maximum: 60000, default: 10000 },
    },
    required: ['url'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'integer' },
      ok: { type: 'boolean' },
      body: { type: 'string' },
      response_headers: { type: 'object' },
    },
  },

  timeoutMs: 60000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const method = String(context.config.method ?? 'GET').toUpperCase();
    const url = String(context.config.url ?? '');
    if (!url) throw new Error('url é obrigatório');

    const headers = (context.config.headers as Record<string, string> | undefined) ?? {};
    const body = context.config.body as string | undefined;
    const timeoutMs = Number(context.config.timeout_ms ?? 10000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: method === 'GET' || method === 'DELETE' ? undefined : body,
        signal: controller.signal,
      });
      const text = await res.text();
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      return {
        status: res.status,
        ok: res.ok,
        body: text,
        response_headers: responseHeaders,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
