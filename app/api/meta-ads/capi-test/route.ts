// POST /api/meta-ads/capi-test — verificação da API de Conversões (MA-CAPI).
// Dispara UM evento de teste (com test_event_code, fora dos dados reais) para o
// conjunto de dados, reutilizando a chave de longa duração do Vault — prova que
// a ligação Meta existente serve a CAPI, sem gerar token novo nem tocar em
// negócios. Admin + org-scoped + audit. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { buildCapiEvent, sendCapiEvents } from '@/lib/integrations/meta/capi';
import { computeDealCommission } from '@/lib/financeiro/commission';

const Schema = z.object({
  // Código do separador "Testar eventos" (ex.: TEST51462). Mantém o teste limpo.
  testEventCode: z.string().min(3).max(64),
  // Opcional: usar um negócio real para validar o valor da comissão líquida.
  dealId: z.string().uuid().optional(),
  // Opcional: email de teste quando não se passa um negócio.
  email: z.string().email().optional(),
  eventName: z.enum(['Purchase', 'Lead']).default('Purchase'),
});

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }

  try {
    let email: string | null = body.email ?? 'teste.capi@focoimo.example';
    let phone: string | null = null;
    let valueEuros: number | null = null;

    // Negócio real (opcional): comissão líquida + email/telefone do contacto.
    if (body.dealId) {
      const { data: deal } = await c.admin
        .from('deals')
        .select('id, value, custom_fields, contact_id')
        .eq('organization_id', c.orgId)
        .eq('id', body.dealId)
        .maybeSingle();
      if (!deal) return metaJson({ error: 'Negócio não encontrado nesta conta.' }, 200);

      const { data: settings } = await c.admin
        .from('organization_settings')
        .select('default_commission_pct, default_consultant_share_pct')
        .eq('organization_id', c.orgId)
        .maybeSingle();

      const commission = computeDealCommission(
        { value: (deal as { value: unknown }).value, custom_fields: (deal as { custom_fields: Record<string, unknown> | null }).custom_fields },
        { defaultPct: settings?.default_commission_pct as number | null, defaultSharePct: settings?.default_consultant_share_pct as number | null },
      );
      valueEuros = commission.netEuros;

      const contactId = (deal as { contact_id: string | null }).contact_id;
      if (contactId) {
        const { data: contact } = await c.admin
          .from('contacts')
          .select('email, phone')
          .eq('organization_id', c.orgId)
          .eq('id', contactId)
          .maybeSingle();
        email = (contact?.email as string | null) ?? email;
        phone = (contact?.phone as string | null) ?? null;
      }
    } else {
      valueEuros = 6250; // amostra ilustrativa (250.000 × 5% × 50%)
    }

    const event = buildCapiEvent({
      eventName: body.eventName,
      eventId: body.dealId ? `capi-test:${body.dealId}` : `capi-test:${c.integrationId}`,
      actionSource: 'system_generated',
      email,
      phone,
      value: body.eventName === 'Purchase' ? valueEuros : null,
      customData: { lead_event_source: 'crm', test: 1 },
    });

    const result = await sendCapiEvents({
      token: c.token,
      events: [event],
      testEventCode: body.testEventCode,
    });

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: 'META_CAPI_TEST',
      resource_type: 'meta_capi',
      resource_id: c.integrationId,
      severity: 'info',
      details: {
        event_name: body.eventName,
        deal_id: body.dealId ?? null,
        value_euros: valueEuros,
        test_event_code: body.testEventCode,
        events_received: result.eventsReceived,
        ok: result.ok,
        error: result.error,
        fbtrace_id: result.fbtraceId,
      },
    });

    return metaJson({
      ok: result.ok,
      events_received: result.eventsReceived,
      error: result.error,
      fbtrace_id: result.fbtraceId,
      value_euros: valueEuros,
    });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível enviar o evento de teste.' }, 200);
  }
}
