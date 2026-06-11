/**
 * POST /api/criativos/upload — carregar um ficheiro para a biblioteca de activos.
 * multipart/form-data: file (obrigatório), type?, title?, content? (nota), tags? (csv),
 * origin? ('imported' | 'reference'), imovel_id?.
 * O ficheiro vai para o bucket privado creative-archive em {orgId}/uploads/{uuid}.{ext}
 * e a peça fica na creative_archive. Servido sempre por URL assinado.
 */
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  CREATIVE_TYPES,
  type CreativeType,
  defaultTypeForMime,
  uploadKindForMime,
  UPLOAD_MAX_BYTES,
  UPLOAD_MIME_TO_EXT,
} from '@/lib/criativos/shared';

export const maxDuration = 120;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const formData = await req.formData().catch(() => null);
  const file = formData?.get('file');
  if (!formData || !(file instanceof File)) {
    return json({ error: 'Falta o ficheiro' }, 400);
  }

  const kind = uploadKindForMime(file.type);
  if (!kind) {
    return json({ error: `Tipo de ficheiro não suportado: ${file.type || 'desconhecido'}` }, 400);
  }
  const maxBytes = UPLOAD_MAX_BYTES[kind];
  if (file.size > maxBytes) {
    return json({ error: `O ficheiro excede o limite de ${Math.round(maxBytes / (1024 * 1024))}MB` }, 400);
  }

  const rawType = String(formData.get('type') || '');
  const type: CreativeType = (CREATIVE_TYPES as readonly string[]).includes(rawType)
    ? (rawType as CreativeType)
    : defaultTypeForMime(file.type);

  const rawOrigin = String(formData.get('origin') || 'imported');
  const origin = rawOrigin === 'reference' ? 'reference' : 'imported';

  const title = String(formData.get('title') || '').trim() || file.name;
  const note = String(formData.get('content') || '').trim();
  const tags = String(formData.get('tags') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
  const imovelIdRaw = String(formData.get('imovel_id') || '').trim();
  const imovelId = /^[0-9a-f-]{36}$/i.test(imovelIdRaw) ? imovelIdRaw : null;

  const ext = UPLOAD_MIME_TO_EXT[file.type] || 'bin';
  const storagePath = `${profile.organization_id}/uploads/${crypto.randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from('creative-archive')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    console.error('[criativos/upload] storage error:', uploadError);
    return json({ error: 'Falhou guardar o ficheiro' }, 500);
  }

  const { data, error: dbError } = await supabase
    .from('creative_archive')
    .insert({
      organization_id: profile.organization_id,
      owner_id: user.id,
      type,
      origin,
      source: 'imported',
      status: 'approved',
      title,
      content: note || title,
      tags,
      imovel_id: imovelId,
      file_path: storagePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
    })
    .select('id')
    .single();

  if (dbError) {
    // não deixar ficheiro órfão no bucket
    await supabase.storage.from('creative-archive').remove([storagePath]).catch(() => {});
    console.error('[criativos/upload] db error:', dbError);
    return json({ error: dbError.message }, 500);
  }

  return json({ id: data.id, ok: true }, 201);
}
