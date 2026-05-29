// Épico Meta Ads — Fase A, c2 — estado da ligação Meta (para a UI).
export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store, max-age=0',
    },
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ connected: false, error: 'unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) {
    return json({ connected: false, error: 'sem_permissao' }, 403);
  }

  // RLS já filtra por organização; o filtro explícito é defesa em profundidade.
  const { data } = await supabase
    .from('automation_integrations')
    .select('account_name, status, metadata, last_error, updated_at')
    .eq('organization_id', profile.organization_id)
    .eq('provider', 'meta')
    .maybeSingle();

  if (!data) return json({ connected: false });

  const metadata = (data.metadata ?? {}) as Record<string, unknown>;

  // URL do webhook de leads (edge function pública).
  let webhookUrl: string | null = null;
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0];
    if (ref) webhookUrl = `https://${ref}.supabase.co/functions/v1/automation-meta-leads`;
  } catch {
    webhookUrl = null;
  }

  return json({
    connected: data.status === 'active' && Boolean(metadata.subscribed_page_id),
    status: data.status,
    accountName: data.account_name,
    pages: metadata.pages ?? [],
    adAccounts: metadata.ad_accounts ?? [],
    subscribedPageId: metadata.subscribed_page_id ?? null,
    selectedAdAccountId: metadata.selected_ad_account_id ?? null,
    webhookUrl,
    verifyToken: metadata.webhook_verify_token ?? null,
    lastError: data.last_error ?? null,
    updatedAt: data.updated_at,
  });
}
