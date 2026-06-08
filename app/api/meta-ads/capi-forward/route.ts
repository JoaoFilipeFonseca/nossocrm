/**
 * /api/meta-ads/capi-forward — Reenvia negócios GANHOS à Meta (MA-CAPI, fatia 2).
 *
 * Dois modos (espelha /api/meta-ads/analyze):
 *  - CRON (header X-Cron-Secret == backup_cron_secret): percorre TODAS as
 *    integrações Meta activas e reencaminha os negócios ganhos recentes ainda
 *    não enviados. (O agendamento pg_cron + registo em /automacoes fica para a
 *    migração — ver TODO MA-CAPI fatia 2.)
 *  - UTILIZADOR (sessão admin): reencaminha a própria org. Com `dealId` +
 *    `testEventCode` reencaminha só esse negócio como TESTE (não marca), para
 *    verificar em produção sem tocar nos dados reais.
 *
 * Valor da conversão = comissão líquida do negócio (decisão do João). Reutiliza
 * o token de longa duração do Vault (sem token novo). Idempotente: marca cada
 * negócio em custom_fields.capi_forwarded_at. SALVAGUARDA: só negócios ganhos há
 * <= 7 dias (a Meta rejeita eventos mais antigos) — nunca dispara o histórico.
 * Devolve sempre 200 em erro lógico (regra dos crons/webhooks).
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { metaTokenSecretName, META_CAPI_DATASET_ID } from '@/lib/integrations/meta/config';
import { buildCapiEvent, sendCapiEvents } from '@/lib/integrations/meta/capi';
import { computeDealCommission } from '@/lib/financeiro/commission';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_DEALS = 50;
const MAX_AGE_DAYS = 7; // a Meta rejeita eventos mais antigos

type Admin = ReturnType<typeof createStaticAdminClient>;

interface DealRow {
  id: string;
  value: unknown;
  custom_fields: Record<string, unknown> | null;
  contact_id: string | null;
  closed_at: string | null;
  updated_at: string | null;
}

async function readToken(admin: Admin, integrationId: string, metadata: Record<string, unknown>): Promise<string | null> {
  const tokenName = (metadata.token_secret_name as string) ?? metaTokenSecretName(integrationId);
  const { data } = await admin.rpc('meta_oauth_read_token', { p_name: tokenName });
  return (data as string | null) ?? null;
}

/** Reenvia UM negócio à Meta. Devolve o resultado e (opcional) marca-o. */
async function forwardDeal(
  admin: Admin,
  orgId: string,
  token: string,
  deal: DealRow,
  defaults: { defaultPct?: number | null; defaultSharePct?: number | null },
  opts: { testEventCode?: string; mark: boolean },
) {
  const commission = computeDealCommission({ value: deal.value, custom_fields: deal.custom_fields }, defaults);

  let email: string | null = null;
  let phone: string | null = null;
  if (deal.contact_id) {
    const { data: contact } = await admin
      .from('contacts')
      .select('email, phone')
      .eq('organization_id', orgId)
      .eq('id', deal.contact_id)
      .maybeSingle();
    email = (contact?.email as string | null) ?? null;
    phone = (contact?.phone as string | null) ?? null;
  }

  const eventId = `deal-won:${deal.id}`;
  const event = buildCapiEvent({
    eventName: 'Purchase',
    eventId,
    actionSource: 'system_generated',
    email,
    phone,
    value: commission.netEuros,
    customData: { lead_event_source: 'crm' },
  });

  const result = await sendCapiEvents({ token, events: [event], testEventCode: opts.testEventCode });

  if (opts.mark && result.ok) {
    const cf = { ...(deal.custom_fields ?? {}) };
    cf['capi_forwarded_at'] = new Date().toISOString();
    cf['capi_event_id'] = eventId;
    await admin.from('deals').update({ custom_fields: cf }).eq('organization_id', orgId).eq('id', deal.id);
  }

  await admin.from('audit_logs').insert({
    organization_id: orgId,
    action: 'META_CAPI_FORWARD',
    resource_type: 'meta_capi',
    resource_id: deal.id,
    severity: 'info',
    details: {
      deal_id: deal.id,
      value_euros: commission.netEuros,
      events_received: result.eventsReceived,
      ok: result.ok,
      error: result.error,
      test: !!opts.testEventCode,
    },
  });

  return { deal_id: deal.id, value_euros: commission.netEuros, ok: result.ok, events_received: result.eventsReceived, error: result.error };
}

async function orgDefaults(admin: Admin, orgId: string) {
  const { data: settings } = await admin
    .from('organization_settings')
    .select('default_commission_pct, default_consultant_share_pct')
    .eq('organization_id', orgId)
    .maybeSingle();
  return {
    defaultPct: settings?.default_commission_pct as number | null,
    defaultSharePct: settings?.default_consultant_share_pct as number | null,
  };
}

/** Negócios ganhos recentes (<= MAX_AGE_DAYS) ainda não reencaminhados. */
async function pendingDeals(admin: Admin, orgId: string): Promise<DealRow[]> {
  const { data } = await admin
    .from('deals')
    .select('id, value, custom_fields, contact_id, closed_at, updated_at')
    .eq('organization_id', orgId)
    .eq('is_won', true)
    .order('updated_at', { ascending: false })
    .limit(MAX_DEALS);
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return (data ?? []).filter((d: DealRow) => {
    const cf = d.custom_fields ?? {};
    if (cf['capi_forwarded_at']) return false; // já enviado
    const when = d.closed_at ?? d.updated_at;
    if (!when) return false;
    return new Date(when).getTime() >= cutoff; // só recentes
  });
}

async function forwardOrg(admin: Admin, orgId: string, integrationId: string, metadata: Record<string, unknown>) {
  const token = await readToken(admin, integrationId, metadata);
  if (!token) return { org: orgId, error: 'sem token' };
  const defaults = await orgDefaults(admin, orgId);
  const deals = await pendingDeals(admin, orgId);
  const sent: unknown[] = [];
  for (const d of deals) {
    sent.push(await forwardDeal(admin, orgId, token, d, defaults, { mark: true }));
  }
  return { org: orgId, forwarded: sent.length, results: sent };
}

const BodySchema = z.object({
  dealId: z.string().uuid().optional(),
  testEventCode: z.string().min(3).max(64).optional(),
});

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';

  // ---- Modo CRON: todas as integrações activas ----
  if (cronSecret) {
    const { data: expected } = await admin.rpc('get_backup_cron_secret');
    if (!expected || cronSecret !== expected) return Response.json({ error: 'forbidden' }, { status: 403 });

    const { data: integ } = await admin
      .from('automation_integrations')
      .select('id, organization_id, metadata')
      .eq('provider', 'meta')
      .eq('status', 'active');

    const summary: unknown[] = [];
    let ok = true;
    for (const i of (integ ?? []) as Array<{ id: string; organization_id: string; metadata: Record<string, unknown> | null }>) {
      try {
        summary.push(await forwardOrg(admin, i.organization_id, i.id, i.metadata ?? {}));
      } catch (e) {
        ok = false;
        summary.push({ org: i.organization_id, error: e instanceof Error ? e.message : String(e) });
      }
    }

    // Estado em /automacoes (best-effort; a linha é criada pela migração do cron).
    try {
      const { data: cur } = await admin
        .from('system_automations')
        .select('run_count, fail_count')
        .eq('key', 'meta-capi-forward')
        .maybeSingle();
      await admin
        .from('system_automations')
        .update({
          last_run_at: new Date().toISOString(),
          last_run_ok: ok,
          last_run_error: ok ? null : 'ver logs',
          run_count: ((cur as { run_count?: number } | null)?.run_count ?? 0) + 1,
          fail_count: ((cur as { fail_count?: number } | null)?.fail_count ?? 0) + (ok ? 0 : 1),
        })
        .eq('key', 'meta-capi-forward');
    } catch { /* best-effort */ }

    return Response.json({ ok, summary });
  }

  // ---- Modo UTILIZADOR (admin) ----
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role, organization_id').eq('id', user.id).maybeSingle();
  if (profile?.role !== 'admin' || !profile.organization_id) return Response.json({ error: 'Sem permissão.' }, { status: 403 });
  const orgId = profile.organization_id as string;

  let body: z.infer<typeof BodySchema> = {};
  try { body = BodySchema.parse(await req.json().catch(() => ({}))); } catch { return Response.json({ error: 'Pedido inválido.' }, { status: 400 }); }

  const { data: integ } = await admin
    .from('automation_integrations')
    .select('id, metadata')
    .eq('provider', 'meta')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .maybeSingle();
  if (!integ) return Response.json({ error: 'Integração Meta não está activa.' }, { status: 200 });
  const integration = integ as { id: string; metadata: Record<string, unknown> | null };

  const token = await readToken(admin, integration.id, integration.metadata ?? {});
  if (!token) return Response.json({ error: 'Token indisponível.' }, { status: 200 });

  try {
    // Verificação: reencaminhar UM negócio como teste (não marca).
    if (body.dealId) {
      const { data: deal } = await admin
        .from('deals')
        .select('id, value, custom_fields, contact_id, closed_at, updated_at')
        .eq('organization_id', orgId)
        .eq('id', body.dealId)
        .maybeSingle();
      if (!deal) return Response.json({ error: 'Negócio não encontrado.' }, { status: 200 });
      const defaults = await orgDefaults(admin, orgId);
      const res = await forwardDeal(admin, orgId, token, deal as DealRow, defaults, {
        testEventCode: body.testEventCode,
        mark: !body.testEventCode,
      });
      return Response.json({ mode: 'single', ...res });
    }

    // Operação normal: varrer os ganhos recentes ainda não enviados.
    const out = await forwardOrg(admin, orgId, integration.id, integration.metadata ?? {});
    return Response.json({ ok: true, mode: 'scan', ...out });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'Falha ao reencaminhar.' }, { status: 200 });
  }
}
