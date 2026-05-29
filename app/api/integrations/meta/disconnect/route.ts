// Épico Meta Ads — Fase A, c2 — desligar a integração Meta.
// Marca a integração como desconectada (mantém o histórico/atribuição). Não
// apaga o token do Vault de imediato; uma reconexão volta a escrevê-lo.
export const dynamic = 'force-dynamic';

import { createClient, createStaticAdminClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

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
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return json({ error: 'Forbidden' }, 403);
  }

  const admin = createStaticAdminClient();
  const { error } = await admin
    .from('automation_integrations')
    .update({ status: 'disconnected', updated_at: new Date().toISOString() })
    .eq('organization_id', profile.organization_id)
    .eq('provider', 'meta');

  if (error) return json({ error: 'Falha ao desligar.' }, 500);
  return json({ ok: true });
}
