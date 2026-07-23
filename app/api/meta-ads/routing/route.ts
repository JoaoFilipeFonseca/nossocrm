// /api/meta-ads/routing — encaminhamento de leads por campanha (R2).
//   GET  → campanhas (de ad_insights) com o destino actual + boards/etapas.
//   PUT  → grava (ou limpa) o board+etapa de destino de uma campanha.
// Admin + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';

// Janela (dias) para considerar uma campanha "activa": gasto/entrega recente.
const ACTIVE_WINDOW_DAYS = 7;

interface OverviewRow {
  campaign_id: string;
  campaign_name: string | null;
  board_id: string | null;
  stage_id: string | null;
  last_active_date: string | null;
  active: boolean;
  last_lead_at: string | null;
  archived_at: string | null;
}

export async function GET() {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  // Visão agregada por campanha (destino + sinal de activa + última lead + arquivo).
  const { data: rows, error: rpcErr } = await c.admin.rpc('meta_campaign_routing_overview', {
    p_org: c.orgId,
    p_window_days: ACTIVE_WINDOW_DAYS,
  });
  if (rpcErr) return metaJson({ ok: true, campaigns: [], boards: [], error: rpcErr.message });

  // Auto-reaparecimento: campanha arquivada que voltou a ficar activa OU recebeu
  // lead nova depois do arquivo → limpa o flag (volta a "por definir"). É a regra
  // de segurança: nunca perder o encaminhamento de uma campanha viva.
  const toUnarchive: string[] = [];
  const campaigns = ((rows ?? []) as OverviewRow[]).map((r) => {
    let archived = !!r.archived_at;
    if (archived) {
      const newLead = !!(r.last_lead_at && r.archived_at && new Date(r.last_lead_at) > new Date(r.archived_at));
      if (r.active || newLead) {
        archived = false;
        toUnarchive.push(r.campaign_id);
      }
    }
    return {
      campaign_id: r.campaign_id,
      campaign_name: r.campaign_name,
      board_id: r.board_id ?? null,
      stage_id: r.stage_id ?? null,
      active: !!r.active,
      archived,
      last_active_date: r.last_active_date,
      last_lead_at: r.last_lead_at,
    };
  });

  if (toUnarchive.length > 0) {
    await c.admin
      .from('meta_campaign_archive')
      .delete()
      .eq('organization_id', c.orgId)
      .in('campaign_id', toUnarchive);
  }

  // Ordenar: activas primeiro, depois as por definir, depois por nome.
  campaigns.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const aUndef = !a.board_id, bUndef = !b.board_id;
    if (aUndef !== bUndef) return aUndef ? -1 : 1;
    return (a.campaign_name ?? '').localeCompare(b.campaign_name ?? '');
  });

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
