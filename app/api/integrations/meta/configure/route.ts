// Épico Meta Ads — Fase A, c4 — escolher a Página/conta activa e limpar a lista.
// Acções: select_page (subscreve a nova + desubscreve a anterior), select_ad_account,
// remove_page, remove_ad_account. Admin, org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  getPageAccessToken,
  subscribePageToLeadgen,
  unsubscribePage,
} from '@/lib/integrations/meta/oauth';
import { metaTokenSecretName } from '@/lib/integrations/meta/config';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

interface MetaPageMeta { id: string; name: string }
interface MetaAdAccountMeta { id: string; name: string; account_id: string }

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) return json({ error: 'Forbidden' }, 403);
  const orgId = profile.organization_id as string;

  let payload: { action?: string; pageId?: string; adAccountId?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }
  const { action, pageId, adAccountId } = payload;

  const admin = createStaticAdminClient();
  const { data: integ } = await admin
    .from('automation_integrations')
    .select('id, metadata')
    .eq('organization_id', orgId)
    .eq('provider', 'meta')
    .maybeSingle();
  if (!integ) return json({ error: 'Integração Meta não encontrada.' }, 404);

  const metadata = (integ.metadata ?? {}) as Record<string, unknown>;
  const pages = (metadata.pages ?? []) as MetaPageMeta[];
  const adAccounts = (metadata.ad_accounts ?? []) as MetaAdAccountMeta[];
  const tokenName = (metadata.token_secret_name as string) ?? metaTokenSecretName(integ.id);
  const currentPageId = metadata.subscribed_page_id as string | null;

  async function save(next: Record<string, unknown>) {
    await admin
      .from('automation_integrations')
      .update({ metadata: { ...metadata, ...next }, updated_at: new Date().toISOString() })
      .eq('id', integ!.id);
  }

  try {
    switch (action) {
      case 'select_page': {
        if (!pageId || !pages.some((p) => p.id === pageId)) return json({ error: 'Página inválida.' }, 400);
        const { data: userToken } = await admin.rpc('meta_oauth_read_token', { p_name: tokenName });
        if (!userToken) return json({ error: 'Token indisponível. Volte a ligar a conta.' }, 200);

        // Subscreve a nova Página.
        const newToken = await getPageAccessToken(userToken as string, pageId);
        if (!newToken) return json({ error: 'Sem permissão para esta Página.' }, 200);
        await subscribePageToLeadgen(pageId, newToken);

        // Desubscreve a anterior (se diferente) — deixa de cruzar leads.
        if (currentPageId && currentPageId !== pageId) {
          const oldToken = await getPageAccessToken(userToken as string, currentPageId);
          if (oldToken) {
            try { await unsubscribePage(currentPageId, oldToken); } catch { /* best-effort */ }
          }
        }
        const accountName = pages.find((p) => p.id === pageId)?.name ?? 'Meta';
        await admin
          .from('automation_integrations')
          .update({
            account_name: accountName,
            status: 'active',
            metadata: { ...metadata, subscribed_page_id: pageId },
            updated_at: new Date().toISOString(),
          })
          .eq('id', integ.id);
        return json({ ok: true, subscribedPageId: pageId });
      }

      case 'select_ad_account': {
        if (!adAccountId || !adAccounts.some((a) => a.id === adAccountId)) return json({ error: 'Conta inválida.' }, 400);
        await save({ selected_ad_account_id: adAccountId });
        return json({ ok: true });
      }

      case 'remove_page': {
        if (!pageId) return json({ error: 'Página em falta.' }, 400);
        if (pageId === currentPageId) return json({ error: 'Não pode remover a Página que recebe leads.' }, 200);
        await save({ pages: pages.filter((p) => p.id !== pageId) });
        return json({ ok: true });
      }

      case 'remove_ad_account': {
        if (!adAccountId) return json({ error: 'Conta em falta.' }, 400);
        const next: Record<string, unknown> = { ad_accounts: adAccounts.filter((a) => a.id !== adAccountId) };
        if (metadata.selected_ad_account_id === adAccountId) next.selected_ad_account_id = null;
        await save(next);
        return json({ ok: true });
      }

      default:
        return json({ error: 'Acção desconhecida.' }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 200);
  }
}
