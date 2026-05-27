/**
 * GET /api/dashboard/chq-today — lista CHQ feitas hoje pelo user
 * DELETE /api/dashboard/chq-today?id=<uuid> — apaga uma CHQ (engano)
 *
 * Sprint 24 c1 — permite ver e desfazer CHQ registadas hoje.
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const ALLOWED_TYPES = ['call', 'meeting', 'visit', 'whatsapp', 'email'] as const;

function lisbonTodayStartISO(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '0';
  // Construir Y-M-D Lisbon e converter para UTC instant via probing
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const probeUTC = Date.UTC(y, m - 1, d, 0, 0, 0);
  const probeHourLocal = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon', hour12: false, hour: '2-digit',
  }).format(new Date(probeUTC)));
  return new Date(probeUTC - probeHourLocal * 3600000).toISOString();
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const todayStart = lisbonTodayStartISO();

  const { data, error } = await supabase
    .from('deal_activities')
    .select('id, type, created_at, deal_id, contact_id, description, metadata, deals(title), contacts(name)')
    .eq('organization_id', profile.organization_id)
    .in('type', ALLOWED_TYPES as unknown as string[])
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return json({ error: error.message }, 500);

  const items = (data ?? []).map((row: any) => ({
    id: row.id,
    type: row.type,
    created_at: row.created_at,
    deal_id: row.deal_id,
    contact_id: row.contact_id,
    description: row.description,
    via: row.metadata?.via ?? null,
    deal_title: row.deals?.title ?? null,
    contact_name: row.contacts?.name ?? null,
  }));

  return json({ items });
}

export async function DELETE(req: NextRequest) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  // Verifica que o registo pertence à org E é de hoje (não apagar histórico antigo via UI)
  const todayStart = lisbonTodayStartISO();
  const { data: existing } = await supabase
    .from('deal_activities')
    .select('id, organization_id, created_at, type')
    .eq('id', id)
    .single();

  if (!existing || existing.organization_id !== profile.organization_id) {
    return json({ error: 'not found' }, 404);
  }
  if (existing.created_at < todayStart) {
    return json({ error: 'só podes apagar CHQ de hoje' }, 403);
  }
  if (!ALLOWED_TYPES.includes(existing.type as typeof ALLOWED_TYPES[number])) {
    return json({ error: 'só CHQ humanas, não actividades sistémicas' }, 403);
  }

  const { error } = await supabase.from('deal_activities').delete().eq('id', id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
