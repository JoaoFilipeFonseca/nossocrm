// ============================================================================
// server.ts — contexto partilhado das rotas de edição Meta Ads (MA-EDIT)
// ============================================================================
// Resolve, para um pedido autenticado:
//   - admin + organização (defesa em profundidade além do RLS),
//   - integração Meta activa da org,
//   - token de longa duração do Vault,
//   - conta de anúncios seleccionada.
// Devolve `error` (Response pronta) em qualquer falha — nunca 5xx em erro
// lógico. Também valida que um anúncio pertence à org (via ad_insights), para
// impedir edição de anúncios de terceiros.
// ============================================================================
import 'server-only';
import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { metaTokenSecretName } from './config';

export function metaJson<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export interface MetaAdminContext {
  orgId: string;
  userId: string;
  integrationId: string;
  token: string;
  adAccountId: string | null;
  /** Página seleccionada que recebe as leads (para criar formulários). */
  pageId: string | null;
  admin: ReturnType<typeof createStaticAdminClient>;
}

/** Resolve o contexto admin+Meta ou devolve uma Response de erro. */
export async function resolveMetaAdminContext(): Promise<
  { ctx: MetaAdminContext; error?: undefined } | { ctx?: undefined; error: Response }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: metaJson({ error: 'Unauthorized' }, 401) };

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return { error: metaJson({ error: 'Sem permissão.' }, 403) };
  }
  const orgId = profile.organization_id as string;

  const admin = createStaticAdminClient();
  const { data: integ } = await admin
    .from('automation_integrations')
    .select('id, status, metadata')
    .eq('organization_id', orgId)
    .eq('provider', 'meta')
    .maybeSingle();
  if (!integ || integ.status !== 'active') {
    return { error: metaJson({ error: 'Integração Meta não está activa.' }, 200) };
  }

  const metadata = (integ.metadata ?? {}) as Record<string, unknown>;
  const tokenName = (metadata.token_secret_name as string) ?? metaTokenSecretName(integ.id);
  const { data: token } = await admin.rpc('meta_oauth_read_token', { p_name: tokenName });
  if (!token) {
    return { error: metaJson({ error: 'Token indisponível. Volte a ligar a conta Meta.' }, 200) };
  }

  return {
    ctx: {
      orgId,
      userId: user.id,
      integrationId: integ.id,
      token: token as string,
      adAccountId: (metadata.selected_ad_account_id as string) ?? null,
      pageId: (metadata.subscribed_page_id as string) ?? null,
      admin,
    },
  };
}

/**
 * Confirma que um anúncio pertence à org (aparece em ad_insights dessa org).
 * Devolve o adset_id conhecido (último visto) ou null. Lança se não pertencer.
 */
export async function assertAdBelongsToOrg(
  ctx: MetaAdminContext,
  adId: string,
): Promise<{ adsetId: string | null; adName: string | null }> {
  const { data } = await ctx.admin
    .from('ad_insights')
    .select('adset_id, ad_name')
    .eq('organization_id', ctx.orgId)
    .eq('ad_id', adId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) {
    throw new Error('Anúncio desconhecido nesta conta.');
  }
  return { adsetId: (data.adset_id as string) ?? null, adName: (data.ad_name as string) ?? null };
}
