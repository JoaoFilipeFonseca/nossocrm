// POST /api/meta-ads/ad — cria o anúncio (MA-CREATE, Fase 3).
// Encadeado ao adset_id (Fase 2). Constrói o criativo (imagem + copy + destino +
// CTA) e o anúncio EM PAUSA. Destino Site (link) ou Formulário (lead_gen_form_id).
// Admin + org-scoped + audit. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { buildAdCreativeStorySpec, createAdCreative, createAd } from '@/lib/integrations/meta/write';

// Apelos à acção suportados na UI (mapeiam directamente ao enum da Meta).
const CTA_TYPES = ['LEARN_MORE', 'SIGN_UP', 'CONTACT_US', 'GET_QUOTE', 'BOOK_TRAVEL', 'SUBSCRIBE', 'DOWNLOAD', 'MESSAGE_PAGE'] as const;

const Schema = z
  .object({
    adsetId: z.string().min(1),
    name: z.string().min(1).max(200),
    imageHash: z.string().min(1),
    message: z.string().min(1).max(2000),
    title: z.string().max(255).optional(),
    description: z.string().max(255).optional(),
    destination: z.enum(['site', 'form']),
    link: z.string().url().optional(),
    leadGenFormId: z.string().optional(),
    ctaType: z.enum(CTA_TYPES).default('LEARN_MORE'),
  })
  .refine((d) => (d.destination === 'site' ? !!d.link : true), { message: 'Falta o URL do site.', path: ['link'] })
  .refine((d) => (d.destination === 'form' ? !!d.leadGenFormId : true), { message: 'Falta o formulário.', path: ['leadGenFormId'] });

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

  if (!c.pageId) return metaJson({ error: 'Página não seleccionada.' }, 200);

  try {
    const storySpec = buildAdCreativeStorySpec({
      pageId: c.pageId,
      imageHash: body.imageHash,
      message: body.message,
      title: body.title,
      description: body.description,
      link: body.destination === 'site' ? body.link : undefined,
      ctaType: body.ctaType,
      leadGenFormId: body.destination === 'form' ? body.leadGenFormId : undefined,
    });

    const creative = await createAdCreative(c.adAccountId, c.token, {
      name: `${body.name} — Criativo`,
      storySpec,
    });
    const ad = await createAd(c.adAccountId, c.token, {
      name: body.name,
      adsetId: body.adsetId,
      creativeId: creative.id,
      status: 'PAUSED',
    });

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: 'META_AD_CREATE',
      resource_type: 'meta_ad',
      resource_id: c.integrationId,
      severity: 'warning',
      details: {
        ad_id: ad.id,
        creative_id: creative.id,
        adset_id: body.adsetId,
        name: body.name,
        destination: body.destination,
        cta_type: body.ctaType,
      },
    });

    return metaJson({ ok: true, ad_id: ad.id, creative_id: creative.id });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível criar o anúncio.' }, 200);
  }
}
