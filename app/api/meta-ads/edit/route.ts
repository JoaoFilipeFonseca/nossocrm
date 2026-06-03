// POST /api/meta-ads/edit — edição do anúncio (MA-EDIT, tier fácil).
// Acções:
//   - pause_ad       { ad_id }            -> status PAUSED (nível anúncio)
//   - resume_ad      { ad_id }            -> status ACTIVE (nível anúncio)
//   - set_adset_budget { ad_id, amount_cents, kind? } -> orçamento do adset
//
// Escreve em campanhas LIVE (dinheiro). Por isso: admin + org-scoped + mesma
// origem; valida que o anúncio pertence à org; relê o estado vivo antes de
// alterar; e regista SEMPRE em `audit_logs` (antes/depois). Nunca 5xx em erro
// lógico — devolve mensagem PT e 200. A confirmação explícita é feita na UI.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson, assertAdBelongsToOrg } from '@/lib/integrations/meta/server';
import { getAdLiveState, setAdStatus, setBudget, getAdCreativeFull, updateAdCopy, updateAdDynamicTexts, updateAdMedia, duplicateAd, deleteAd, getAdAccountId } from '@/lib/integrations/meta/write';

// Piso de segurança do orçamento (1,00 da moeda da conta). A Meta tem mínimos
// próprios por moeda e é a autoridade final; isto só evita zeros/enganos.
const MIN_BUDGET_CENTS = 100;
const MAX_BUDGET_CENTS = 100_000_00; // 100.000 — trava enganos grosseiros.

// Limites de texto (folga sobre os limites práticos da Meta; a Graph API é a
// autoridade final). Evitam enganos grosseiros antes de chamar a API.
const MAX_TITLE = 255;
const MAX_BODY = 2000;

const Schema = z.object({
  // set_budget edita o orçamento no nó certo (adset ou campanha/CBO).
  // set_adset_budget mantém-se como alias para compatibilidade.
  // update_copy cria um criativo novo (texto novo) e aponta o anúncio a ele.
  action: z.enum(['pause_ad', 'resume_ad', 'set_budget', 'set_adset_budget', 'update_copy', 'update_media', 'duplicate_ad', 'delete_ad']),
  ad_id: z.string().min(1),
  amount_cents: z.number().int().positive().optional(),
  kind: z.enum(['daily', 'lifetime']).optional(),
  // update_copy (criativo simples):
  title: z.string().max(MAX_TITLE).nullable().optional(),
  body: z.string().max(MAX_BODY).nullable().optional(),
  cta_type: z.string().max(64).nullable().optional(),
  // update_copy (criativo dinâmico): listas de variações de texto.
  titles: z.array(z.string().max(MAX_TITLE)).max(20).optional(),
  bodies: z.array(z.string().max(MAX_BODY)).max(20).optional(),
  descriptions: z.array(z.string().max(MAX_BODY)).max(20).optional(),
  // update_media: hash da imagem OU id do vídeo (já enviados via upload-media).
  image_hash: z.string().max(255).optional(),
  video_id: z.string().max(64).optional(),
  // url da media nova (só para actualizar a cache local; informativo).
  media_url: z.string().url().max(2000).optional(),
});

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let payload: z.infer<typeof Schema>;
  try {
    payload = Schema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }
  const { action, ad_id } = payload;

  try {
    // ---- Apagar a cópia (desfazer duplicação) -----------------------------
    // A duplicação cria um CONJUNTO novo (ainda não está em ad_insights), por
    // isso validamos a posse pela conta de anúncios (tem de ser da conta da org).
    if (action === 'delete_ad') {
      const acc = await getAdAccountId(ad_id, c.token);
      if (!c.adAccountId || acc !== c.adAccountId) {
        return metaJson({ error: 'Este item não pertence à sua conta.' }, 200);
      }
      await deleteAd(ad_id, c.token);
      await c.admin.from('audit_logs').insert({
        user_id: c.userId,
        organization_id: c.orgId,
        action: 'META_AD_DELETE',
        resource_type: 'meta_adset',
        resource_id: c.integrationId,
        severity: 'warning',
        details: { deleted_id: ad_id, account_id: acc },
      });
      return metaJson({ ok: true, deleted: ad_id });
    }

    const { adName } = await assertAdBelongsToOrg(c, ad_id);

    // ---- Duplicar para testar (conjunto novo em pausa) --------------------
    if (action === 'duplicate_ad') {
      const { new_adset_id } = await duplicateAd(ad_id, c.token);
      await c.admin.from('audit_logs').insert({
        user_id: c.userId,
        organization_id: c.orgId,
        action: 'META_AD_DUPLICATE',
        resource_type: 'meta_adset',
        resource_id: c.integrationId,
        severity: 'warning',
        details: { ad_id, ad_name: adName, new_adset_id },
      });
      return metaJson({ ok: true, new_adset_id });
    }

    // ---- Pausar / reactivar (nível anúncio) -------------------------------
    if (action === 'pause_ad' || action === 'resume_ad') {
      const before = await getAdLiveState(ad_id, c.token);
      const next = action === 'pause_ad' ? 'PAUSED' : 'ACTIVE';
      await setAdStatus(ad_id, c.token, next);

      await c.admin.from('audit_logs').insert({
        user_id: c.userId,
        organization_id: c.orgId,
        action: action === 'pause_ad' ? 'META_AD_PAUSE' : 'META_AD_RESUME',
        resource_type: 'meta_ad',
        resource_id: c.integrationId,
        severity: 'warning',
        details: {
          ad_id,
          ad_name: adName ?? before.ad_name,
          status_before: before.status,
          status_after: next,
        },
      });

      return metaJson({ ok: true, status: next });
    }

    // ---- Editar o texto do anúncio (cria criativo novo + swap) -----------
    if (action === 'update_copy') {
      const before = await getAdCreativeFull(ad_id, c.token);
      if (!before.editable) {
        return metaJson({ error: before.reason ?? 'Texto não editável neste anúncio.' }, 200);
      }

      // Criativo DINÂMICO (asset_feed_spec): listas de títulos/textos/descrições.
      if (before.kind === 'dynamic') {
        const nextTexts = {
          titles: (payload.titles ?? before.texts.titles).map((t) => t.trim()).filter(Boolean),
          bodies: (payload.bodies ?? before.texts.bodies).map((t) => t.trim()).filter(Boolean),
          descriptions: (payload.descriptions ?? before.texts.descriptions).map((t) => t.trim()).filter(Boolean),
        };
        if (nextTexts.titles.length === 0 || nextTexts.bodies.length === 0) {
          return metaJson({ error: 'É preciso pelo menos um título e um texto.' }, 200);
        }

        const { creative_id } = await updateAdDynamicTexts(ad_id, c.adAccountId, c.token, nextTexts);

        await c.admin.from('audit_logs').insert({
          user_id: c.userId,
          organization_id: c.orgId,
          action: 'META_AD_COPY_UPDATE',
          resource_type: 'meta_ad',
          resource_id: c.integrationId,
          severity: 'warning',
          details: {
            ad_id,
            ad_name: adName,
            creative_kind: 'dynamic',
            new_creative_id: creative_id,
            titles_before: before.texts.titles,
            titles_after: nextTexts.titles,
            bodies_before: before.texts.bodies,
            bodies_after: nextTexts.bodies,
            descriptions_before: before.texts.descriptions,
            descriptions_after: nextTexts.descriptions,
          },
        });

        // Cache local: guarda o 1.º título/texto como representação da copy.
        await c.admin
          .from('ad_creatives')
          .update({ title: nextTexts.titles[0] ?? null, body: nextTexts.bodies[0] ?? null })
          .eq('organization_id', c.orgId)
          .eq('ad_id', ad_id);

        return metaJson({ ok: true, creative_id, kind: 'dynamic', texts: nextTexts });
      }

      const next = {
        title: payload.title ?? before.copy.title,
        body: payload.body ?? before.copy.body,
        cta_type: payload.cta_type ?? before.copy.cta_type,
      };
      if (!next.title && !next.body) {
        return metaJson({ error: 'O título ou o texto têm de ter conteúdo.' }, 200);
      }

      const { creative_id } = await updateAdCopy(ad_id, c.adAccountId, c.token, next);

      await c.admin.from('audit_logs').insert({
        user_id: c.userId,
        organization_id: c.orgId,
        action: 'META_AD_COPY_UPDATE',
        resource_type: 'meta_ad',
        resource_id: c.integrationId,
        severity: 'warning',
        details: {
          ad_id,
          ad_name: adName,
          new_creative_id: creative_id,
          title_before: before.copy.title,
          title_after: next.title,
          body_before: before.copy.body,
          body_after: next.body,
          cta_before: before.copy.cta_type,
          cta_after: next.cta_type,
        },
      });

      // Actualiza a cache local da copy (a imagem mantém-se; o thumbnail só muda
      // se mudar a imagem, o que este tier não faz).
      await c.admin
        .from('ad_creatives')
        .update({ title: next.title, body: next.body, cta_type: next.cta_type })
        .eq('organization_id', c.orgId)
        .eq('ad_id', ad_id);

      return metaJson({ ok: true, creative_id, copy: next });
    }

    // ---- Editar a imagem/vídeo do anúncio (cria criativo novo + swap) -----
    if (action === 'update_media') {
      const before = await getAdCreativeFull(ad_id, c.token);
      if (!before.editable) {
        return metaJson({ error: before.reason ?? 'Media não editável neste anúncio.' }, 200);
      }
      if (!payload.image_hash && !payload.video_id) {
        return metaJson({ error: 'Falta a imagem ou o vídeo.' }, 200);
      }

      const { creative_id } = await updateAdMedia(ad_id, c.adAccountId, c.token, {
        imageHash: payload.image_hash,
        videoId: payload.video_id,
      });

      await c.admin.from('audit_logs').insert({
        user_id: c.userId,
        organization_id: c.orgId,
        action: 'META_AD_MEDIA_UPDATE',
        resource_type: 'meta_ad',
        resource_id: c.integrationId,
        severity: 'warning',
        details: {
          ad_id,
          ad_name: adName,
          creative_kind: before.kind,
          new_creative_id: creative_id,
          media_type: payload.video_id ? 'video' : 'image',
          image_hash_before: before.media.image_hash,
          image_hash_after: payload.image_hash ?? null,
          video_id_before: before.media.video_id,
          video_id_after: payload.video_id ?? null,
        },
      });

      // Cache local: actualiza a miniatura/imagem se a UI a forneceu (a imagem
      // nova já foi enviada à Meta no passo de upload, com a url devolvida).
      if (payload.media_url) {
        await c.admin
          .from('ad_creatives')
          .update({ image_url: payload.media_url, thumbnail_url: payload.media_url })
          .eq('organization_id', c.orgId)
          .eq('ad_id', ad_id);
      }

      return metaJson({ ok: true, creative_id, media_type: payload.video_id ? 'video' : 'image' });
    }

    // ---- Orçamento (adset ou campanha/CBO) -------------------------------
    // Relê o estado vivo: descobre o nó certo (adset ou campanha), o tipo de
    // orçamento real e o valor actual. Não confiamos no cliente para o nó nem
    // para o tipo (não se pode misturar daily com lifetime).
    const live = await getAdLiveState(ad_id, c.token);
    if (live.budget_level === 'none' || !live.budget_id || !live.budget_kind) {
      return metaJson({ error: 'Este anúncio não tem orçamento editável.' }, 200);
    }

    const amount = payload.amount_cents;
    if (!amount || amount < MIN_BUDGET_CENTS || amount > MAX_BUDGET_CENTS) {
      return metaJson({ error: 'Valor de orçamento inválido.' }, 400);
    }

    const liveKind = live.budget_kind;
    const kind = payload.kind ?? liveKind;
    if (kind !== liveKind) {
      return metaJson({ error: `Este orçamento é ${liveKind === 'daily' ? 'diário' : 'total'}.` }, 200);
    }

    const isCampaign = live.budget_level === 'campaign';
    await setBudget(live.budget_id, c.token, kind, amount);

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: isCampaign ? 'META_CAMPAIGN_BUDGET' : 'META_ADSET_BUDGET',
      resource_type: isCampaign ? 'meta_campaign' : 'meta_adset',
      resource_id: c.integrationId,
      severity: 'warning',
      details: {
        ad_id,
        ad_name: adName ?? live.ad_name,
        budget_level: live.budget_level,
        node_id: live.budget_id,
        node_name: isCampaign ? live.campaign_name : live.adset_name,
        budget_kind: kind,
        cents_before: live.budget_cents,
        cents_after: amount,
      },
    });

    return metaJson({ ok: true, level: live.budget_level, kind, cents: amount });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 200);
  }
}
