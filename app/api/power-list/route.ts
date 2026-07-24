/**
 * GET /api/power-list — BRIEF 2. A Power List de hoje para a página /hoje.
 *
 * Autenticado (sessão Supabase). Devolve os itens priorizados (RPC my_power_list,
 * RLS pela org do utilizador) + o número do dia (conversas da semana vs meta) +
 * a primeira frase da IA por contacto.
 */
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { assembleItems, buildNumeroDoDia, chqWeekFromMetrics, type RawPowerListRow } from '@/lib/power-list/build';
import type { PowerListPayload } from '@/lib/power-list/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return json({ error: 'Profile not found' }, 404);

  const admin = createStaticAdminClient();
  const { data: automation } = await admin
    .from('system_automations')
    .select('params')
    .eq('key', 'power-list')
    .maybeSingle();
  const params = (automation?.params ?? {}) as { list_size?: number; weekly_goal?: number };
  const listSize = Math.max(1, Math.floor(Number(params.list_size) || 15));

  // Meta de conversas: fonte única = org_revenue_goals (ano actual). Fallback ao
  // valor antigo dos params da automação, depois 25.
  const currentYear = new Date().getFullYear();
  const { data: goal } = await admin
    .from('org_revenue_goals')
    .select('weekly_conversas')
    .eq('organization_id', orgId)
    .eq('year', currentYear)
    .maybeSingle();
  const weeklyGoal = Math.max(
    1,
    Math.floor(Number((goal as { weekly_conversas?: number } | null)?.weekly_conversas) || Number(params.weekly_goal) || 25),
  );

  // Modo repor (dá-me outro): ?exclude=id1,id2&n=1 → devolve só itens NOVOS que
  // ainda não estão à vista, mantendo a fila cheia sem regenerar as frases das
  // linhas já mostradas.
  const url = new URL(request.url);
  const excludeRaw = (url.searchParams.get('exclude') || '').trim();
  const excludeIds = excludeRaw ? excludeRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  const wantN = Math.max(0, Math.min(listSize, Math.floor(Number(url.searchParams.get('n')) || 0)));

  if (excludeIds.length > 0 || wantN > 0) {
    const fetchN = Math.min(listSize, excludeIds.length + Math.max(1, wantN));
    const { data: rowsData, error: rowsErr } = await supabase.rpc('my_power_list', { p_n: fetchN });
    if (rowsErr) return json({ error: rowsErr.message }, 500);
    const excludeSet = new Set(excludeIds);
    const fresh = ((rowsData ?? []) as RawPowerListRow[])
      .filter((r) => !excludeSet.has(r.deal_id))
      .slice(0, Math.max(1, wantN));
    const items = await assembleItems(admin, orgId, fresh);
    return json({ items, generatedAt: new Date().toISOString() });
  }

  // Lista completa via wrapper RLS-safe.
  const { data: rowsData, error: rowsErr } = await supabase.rpc('my_power_list', { p_n: listSize });
  if (rowsErr) return json({ error: rowsErr.message }, 500);
  const rows = (rowsData ?? []) as RawPowerListRow[];

  // Número do dia (wrapper autenticado).
  const { data: metrics } = await supabase.rpc('compute_honest_metrics', { p_owner: null, p_year: null });
  const numeroDoDia = buildNumeroDoDia(chqWeekFromMetrics(metrics), weeklyGoal);

  // Frases da IA (admin client para ler a config de IA da org).
  const items = await assembleItems(admin, orgId, rows);

  const payload: PowerListPayload = {
    items,
    numeroDoDia,
    generatedAt: new Date().toISOString(),
  };
  return json(payload);
}
