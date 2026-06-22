import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
// Importar do módulo principal garante que os providers ficam registados na factory.
import { ChannelProviderFactory } from '@/lib/messaging';
import type { ChannelType, ProviderConfig } from '@/lib/messaging/types';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * POST /api/messaging/channels/test
 *
 * Testa a ligação a um fornecedor ANTES de guardar o canal: instancia o provider
 * com as credenciais recebidas e chama `getStatus()` — que bate mesmo na API do
 * fornecedor (ex.: Meta Cloud faz GET /{phoneNumberId}). Devolve o número/nome
 * verificado quando a ligação resulta. Não escreve nada na base de dados.
 *
 * Apenas admins; mesma origem. As credenciais nunca são persistidas aqui.
 */
export async function POST(req: Request): Promise<Response> {
  if (!isAllowedOrigin(req)) {
    return json({ success: false, message: 'Pedido recusado (origem inválida).' }, 403);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return json({ success: false, message: 'Sessão inválida.' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.organization_id) {
    return json({ success: false, message: 'Perfil não encontrado.' }, 404);
  }

  if (profile.role !== 'admin') {
    return json({ success: false, message: 'Apenas administradores podem testar canais.' }, 403);
  }

  let body: {
    channelType: ChannelType;
    provider: string;
    credentials: Record<string, string>;
    externalIdentifier?: string;
  };

  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: 'Corpo do pedido inválido.' }, 400);
  }

  const { channelType, provider, credentials } = body;

  if (!channelType || !provider || !credentials) {
    return json(
      { success: false, message: 'Faltam dados para testar (canal, fornecedor ou credenciais).' },
      400
    );
  }

  if (!ChannelProviderFactory.hasProvider(channelType, provider)) {
    return json(
      { success: false, message: `Fornecedor não suportado: ${channelType}/${provider}.` },
      400
    );
  }

  // O identificador externo só serve para a config passar a validação base;
  // para meta-cloud usamos o Phone Number ID quando o campo vem vazio.
  const externalIdentifier =
    body.externalIdentifier?.trim() ||
    credentials.phoneNumberId ||
    credentials.instanceName ||
    'connection-test';

  const config: ProviderConfig = {
    channelId: 'connection-test',
    channelType,
    provider,
    externalIdentifier,
    credentials,
  };

  try {
    const instance = ChannelProviderFactory.createProvider(channelType, provider);
    await instance.initialize(config);
    const status = await instance.getStatus();

    if (status.status === 'connected') {
      return json({
        success: true,
        message: status.message || 'Ligação estabelecida.',
        details: status.details ?? null,
      });
    }

    return json({
      success: false,
      message: status.message || 'Não foi possível ligar com estas credenciais.',
      details: status.details ?? null,
    });
  } catch (error) {
    // initialize() lança quando as credenciais obrigatórias faltam/são inválidas.
    return json({
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao testar a ligação.',
    });
  }
}
