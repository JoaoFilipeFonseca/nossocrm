// /api/meta-ads/routing/archive — MA-ROUTING-UX.
//   POST { campaign_id, campaign_name?, archived } → arquiva/desarquiva a campanha
//   no painel de encaminhamento. Arquivar NÃO destrói nada: só esconde da vista
//   principal. Reversível. Uma campanha arquivada reaparece sozinha se voltar a
//   ficar activa ou receber lead nova (lógica no GET /api/meta-ads/routing).
// Admin + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';

const PostSchema = z.object({
  campaign_id: z.string().min(1),
  campaign_name: z.string().nullable().optional(),
  archived: z.boolean(),
});

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let body: z.infer<typeof PostSchema>;
  try {
    body = PostSchema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }

  if (body.archived) {
    const { error } = await c.admin
      .from('meta_campaign_archive')
      .upsert(
        {
          organization_id: c.orgId,
          campaign_id: body.campaign_id,
          campaign_name: body.campaign_name ?? null,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,campaign_id' },
      );
    if (error) return metaJson({ error: error.message }, 200);
    return metaJson({ ok: true, archived: true });
  }

  const { error } = await c.admin
    .from('meta_campaign_archive')
    .delete()
    .eq('organization_id', c.orgId)
    .eq('campaign_id', body.campaign_id);
  if (error) return metaJson({ error: error.message }, 200);
  return metaJson({ ok: true, archived: false });
}
