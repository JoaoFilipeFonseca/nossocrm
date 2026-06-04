// POST /api/meta-ads/upload-image — envia uma imagem à Meta (biblioteca da conta)
// e devolve o hash, para o construtor de anúncios (MA-CREATE Fase 3). NÃO toca em
// nenhum anúncio (ainda não existe). Admin + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { uploadAdImage } from '@/lib/integrations/meta/write';

const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30 MB

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  try {
    if (!c.adAccountId) return metaJson({ error: 'Conta de anúncios não seleccionada.' }, 200);

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return metaJson({ error: 'Ficheiro em falta.' }, 400);
    }
    if (!file.type.startsWith('image/')) {
      return metaJson({ error: 'Só são aceites imagens (o vídeo edita-se no Gestor de Anúncios).' }, 200);
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return metaJson({ error: 'Imagem demasiado grande (máximo 30 MB).' }, 200);
    }

    const bytes = await file.arrayBuffer();
    const { hash, url } = await uploadAdImage(c.adAccountId, c.token, bytes, file.name || 'imagem', file.type);
    return metaJson({ ok: true, image_hash: hash, image_url: url });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível enviar a imagem.' }, 200);
  }
}
