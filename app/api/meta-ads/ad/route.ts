// POST /api/meta-ads/ad — cria o anúncio (MA-CREATE, Fase 3).
// Encadeado ao adset_id (Fase 2). Constrói o criativo (imagem + copy + destino +
// CTA) e o anúncio EM PAUSA. Destino Site (link) ou Formulário (lead_gen_form_id).
// Admin + org-scoped + audit. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { buildAdCreativeStorySpec, createAdCreative, createAd, setEntityStatus } from '@/lib/integrations/meta/write';

// Apelos à acção suportados na UI (mapeiam directamente ao enum da Meta).
const CTA_TYPES = ['LEARN_MORE', 'SIGN_UP', 'CONTACT_US', 'GET_QUOTE', 'BOOK_TRAVEL', 'SUBSCRIBE', 'DOWNLOAD', 'MESSAGE_PAGE'] as const;

const Schema = z
  .object({
    adsetId: z.string().min(1),
    // Necessário para publicar (ligar a campanha). Opcional se ficar em pausa.
    campaignId: z.string().optional(),
    publish: z.boolean().default(false),
    name: z.string().min(1).max(200),
    imageHash: z.string().min(1),
    message: z.string().min(1).max(2000),
    title: z.string().max(255).optional(),
    description: z.string().max(255).optional(),
    destination: z.enum(['site', 'form']),
    // URL externo: a Meta exige-o sempre (no Site é o destino; no Formulário é
    // o link "Ver mais", que não pode ser a própria Página do Facebook).
    link: z.string().url(),
    leadGenFormId: z.string().optional(),
    ctaType: z.enum(CTA_TYPES).default('LEARN_MORE'),
  })
  .refine((d) => (d.destination === 'form' ? !!d.leadGenFormId : true), { message: 'Falta o formulário.', path: ['leadGenFormId'] })
  .refine((d) => (d.publish ? !!d.campaignId : true), { message: 'Falta a campanha para publicar.', path: ['campaignId'] });

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
      link: body.link,
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

    // Publicar (opcional): liga campanha + conjunto + anúncio. O formulário já
    // fica activo (a Meta cria-o ACTIVE). O anúncio entra em revisão da Meta
    // antes de entregar — não gasta de imediato. Se a activação falhar, o
    // anúncio fica criado em pausa e devolvemos o aviso (nunca 5xx).
    let published = false;
    let publishWarning: string | null = null;
    if (body.publish && body.campaignId) {
      try {
        await setEntityStatus(body.campaignId, c.token, 'ACTIVE');
        await setEntityStatus(body.adsetId, c.token, 'ACTIVE');
        await setEntityStatus(ad.id, c.token, 'ACTIVE');
        published = true;
      } catch (e) {
        publishWarning = e instanceof Error ? e.message : 'O anúncio foi criado mas não foi possível publicá-lo; ficou em pausa.';
      }
    }

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
        campaign_id: body.campaignId ?? null,
        name: body.name,
        destination: body.destination,
        cta_type: body.ctaType,
        published,
      },
    });

    return metaJson({ ok: true, ad_id: ad.id, creative_id: creative.id, published, publish_warning: publishWarning });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível criar o anúncio.' }, 200);
  }
}
