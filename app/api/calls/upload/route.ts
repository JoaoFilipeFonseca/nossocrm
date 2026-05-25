import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const ALLOWED_MIMES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg',
  'audio/aac', 'audio/flac',
]);

const MAX_BYTES = 100 * 1024 * 1024; // 100MB

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return json({ error: 'Profile not found' }, 404);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: 'Invalid form data' }, 400);

  const file = form.get('audio');
  const dealId = (form.get('deal_id') as string | null) || null;
  const contactId = (form.get('contact_id') as string | null) || null;
  const recordedAt = (form.get('recorded_at') as string | null) || null;

  if (!(file instanceof File)) return json({ error: 'audio file required' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Áudio demasiado grande (>100MB)' }, 413);

  const mime = (file.type || 'audio/mpeg').toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return json({ error: `Formato ${mime} não aceite. Use m4a, mp3, wav, ogg, webm, aac, flac.` }, 415);
  }

  // Quick sanity: org has Google key (avoid uploading áudio para depois falhar)
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('ai_google_key, ai_enabled')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!orgSettings?.ai_enabled) return json({ error: 'IA desactivada na organização' }, 403);
  if (!orgSettings?.ai_google_key) return json({ error: 'Chave Google IA não configurada' }, 400);

  // Upload áudio para Storage
  const ext = file.name?.split('.').pop()?.toLowerCase() || mime.split('/')[1] || 'm4a';
  const audioPath = `${profile.organization_id}/${crypto.randomUUID()}.${ext}`;
  const audioBuffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('call-recordings')
    .upload(audioPath, audioBuffer, { contentType: mime, upsert: false });

  if (uploadError) return json({ error: `Upload falhou: ${uploadError.message}` }, 500);

  // Insert pending row
  const { data: inserted, error: insertError } = await supabase
    .from('call_recordings')
    .insert({
      organization_id: profile.organization_id,
      owner_id: user.id,
      deal_id: dealId,
      contact_id: contactId,
      audio_path: audioPath,
      audio_size_bytes: file.size,
      audio_mime: mime,
      status: 'transcribing',
      recorded_at: recordedAt,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return json({ error: insertError?.message || 'Insert falhou' }, 500);
  }

  const callId = inserted.id;

  // Fire-and-forget: dispara Edge Function `process-call` (Deno, sem limite 60s).
  // Cliente faz polling em /api/calls/[id] a cada 4s até ver status=processed.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (supabaseUrl && serviceRoleKey) {
    const edgeUrl = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-call`;
    // Não esperar — só dispara
    fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${serviceRoleKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ call_id: callId }),
    }).catch((err) => {
      console.error('[calls/upload] falhou disparar edge function process-call:', err);
    });
  } else {
    console.warn('[calls/upload] SUPABASE_URL ou SERVICE_ROLE_KEY em falta, edge function não disparada');
  }

  return json({ id: callId, status: 'transcribing' }, 202);
}
