// /api/meta-ads/routing — encaminhamento de leads por campanha (R2).
//   GET  → campanhas (de ad_insights) com o destino actual + boards/etapas.
//   PUT  → grava (ou limpa) o board+etapa de destino de uma campanha.
// Admin + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';

export async function GET() {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  // Campanhas vistas nos insights (distinct), com o destino guardado (se houver).
  const { data: insights } = await c.admin
    .from('ad_insights')
    .select('campaign_id, campaign_name')
    .eq('organization_id', c.orgId)
    .not('campaign_id', 'is', null);

  const campMap = new Map<string, string | null>();
  for (const r of insights ?? []) {
    const id = String((r as { campaign_id: string }).campaign_id);
    if (!campMap.has(id)) campMap.set(id, (r as { campaign_name: string | null }).campaign_name ?? null);
  }

  const { data: routes } = await c.admin
    .from('meta_lead_routing')
    .select('campaign_id, board_id, stage_id')
    .eq('organization_id', c.orgId);
  const routeMap = new Map((routes ?? []).map((r: { campaign_id: string; board_id: string; stage_id: string | null }) => [r.campaign_id, r]));

  const campaigns = [...campMap.entries()].map(([campaign_id, campaign_name]) => {
    const r = routeMap.get(campaign_id);
    return { campaign_id, campaign_name, board_id: r?.board_id ?? null, stage_id: r?.stage_id ?? null };
  }).sort((a, b) => (a.campaign_name ?? '').localeCompare(b.campaign_name ?? ''));

  // Boards + etapas da org para os selectores.
  const { data: boards } = await c.admin
    .from('boards')
    .select('id, name')
    .eq('organization_id', c.orgId)
    .order('name');
  const { data: stages } = await c.admin
    .from('board_stages')
    .select('id, board_id, name, label, order')
    .eq('organization_id', c.orgId)
    .order('order', { ascending: true });

  const boardsOut = (boards ?? []).map((b: { id: string; name: string }) => ({
    id: b.id,
    name: b.name,
    stages: (stages ?? [])
      .filter((s: { board_id: string }) => s.board_id === b.id)
      .map((s: { id: string; name: string | null; label: string | null }) => ({ id: s.id, name: s.label ?? s.name ?? 'Etapa' })),
  }));

  return metaJson({ ok: true, campaigns, boards: boardsOut });
}

const PutSchema = z.object({
  campaign_id: z.string().min(1),
  campaign_name: z.string().nullable().optional(),
  board_id: z.string().uuid().nullable(),
  stage_id: z.string().uuid().nullable().optional(),
});

export async function PUT(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let body: z.infer<typeof PutSchema>;
  try {
    body = PutSchema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }

  // board_id null → limpar o destino desta campanha.
  if (!body.board_id) {
    await c.admin
      .from('meta_lead_routing')
      .delete()
      .eq('organization_id', c.orgId)
      .eq('campaign_id', body.campaign_id);
    return metaJson({ ok: true, cleared: true });
  }

  // Defesa: o board tem de ser da org.
  const { data: board } = await c.admin
    .from('boards')
    .select('id')
    .eq('organization_id', c.orgId)
    .eq('id', body.board_id)
    .maybeSingle();
  if (!board) return metaJson({ error: 'Board inválido.' }, 400);

  const { error } = await c.admin
    .from('meta_lead_routing')
    .upsert(
      {
        organization_id: c.orgId,
        campaign_id: body.campaign_id,
        campaign_name: body.campaign_name ?? null,
        board_id: body.board_id,
        stage_id: body.stage_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,campaign_id' },
    );
  if (error) return metaJson({ error: error.message }, 200);

  return metaJson({ ok: true });
}
