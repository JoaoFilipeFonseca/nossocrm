// POST /api/meta-ads/ad/[id]/upload-media — envia uma imagem/vídeo à Meta.
// Passo 1 do Tier 2 (editar media): faz só o upload para a biblioteca da conta
// e devolve o hash (imagem) ou id (vídeo) — NÃO toca no anúncio (permite
// pré-visualizar antes de confirmar a troca). A troca em si é a acção
// `update_media` em /api/meta-ads/edit. Admin + org-scoped. Nunca 5xx em erro
// lógico.
export const dynamic = 'force-dynamic';

import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson, assertAdBelongsToOrg } from '@/lib/integrations/meta/server';
import { uploadAdImage, uploadAdVideo } from '@/lib/integrations/meta/write';

// Limites de tamanho (folga sobre os limites práticos da Meta, que é a
// autoridade final). Evitam enganos grosseiros antes de chamar a API.
const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const { id } = await ctx.params;
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  try {
    await assertAdBelongsToOrg(c, id);
    if (!c.adAccountId) return metaJson({ error: 'Conta de anúncios não seleccionada.' }, 200);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return metaJson({ error: 'Ficheiro em falta.' }, 400);
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      return metaJson({ error: 'Só são aceites imagens ou vídeos.' }, 200);
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      return metaJson({ error: 'Imagem demasiado grande (máximo 30 MB).' }, 200);
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      return metaJson({ error: 'Vídeo demasiado grande (máximo 200 MB).' }, 200);
    }

    const bytes = await file.arrayBuffer();

    if (isImage) {
      const { hash, url } = await uploadAdImage(c.adAccountId, c.token, bytes, file.name || 'imagem', file.type);
      return metaJson({ ok: true, kind: 'image', image_hash: hash, image_url: url });
    }

    const { id: videoId } = await uploadAdVideo(c.adAccountId, c.token, bytes, file.name || 'video', file.type);
    return metaJson({ ok: true, kind: 'video', video_id: videoId });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível enviar a media.' }, 200);
  }
}
