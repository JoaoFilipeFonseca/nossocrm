import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { processVoice, createEntityFromVoice } from '@/lib/ai/voice/processVoice';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const ALLOWED_MIMES = new Set([
  'audio/mpeg','audio/mp4','audio/m4a','audio/x-m4a',
  'audio/wav','audio/x-wav','audio/webm','audio/ogg','audio/aac',
]);
const MAX_BYTES = 25 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const form = await req.formData().catch(() => null);
  if (!form) return json({ error: 'Invalid form data' }, 400);

  const file = form.get('audio');
  const contextHint = (form.get('context_hint') as string | null) || null;

  if (!(file instanceof File)) return json({ error: 'audio file required' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Áudio demasiado grande (>25MB para voice input)' }, 413);

  const rawMime = (file.type || 'audio/webm').toLowerCase();
  const mime = rawMime.split(';')[0].trim();
  if (!ALLOWED_MIMES.has(mime)) {
    return json({ error: `Formato ${mime} não aceite` }, 415);
  }

  const { data: org } = await supabase
    .from('organization_settings').select('ai_google_key, ai_enabled')
    .eq('organization_id', profile.organization_id).maybeSingle();
  if (!org?.ai_enabled) return json({ error: 'IA desactivada' }, 403);
  if (!org?.ai_google_key) return json({ error: 'Chave Google IA não configurada' }, 400);

  const ext = file.name?.split('.').pop()?.toLowerCase() || mime.split('/')[1] || 'webm';
  const audioPath = `${profile.organization_id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from('voice-captures').upload(audioPath, bytes, { contentType: mime, upsert: false });
  if (upErr) return json({ error: `Upload falhou: ${upErr.message}` }, 500);

  const { data: inserted, error: insErr } = await supabase
    .from('voice_captures').insert({
      organization_id: profile.organization_id,
      owner_id: user.id,
      audio_path: audioPath,
      audio_mime: mime,
      audio_size_bytes: file.size,
      context_hint: contextHint,
      status: 'processing',
    }).select('id').single();

  if (insErr || !inserted) return json({ error: insErr?.message || 'Insert falhou' }, 500);

  const captureId = inserted.id;

  // Processamento SÍNCRONO — Gemini direct (até ~30s para audio curto). Cabe nos 60s do Vercel.
  try {
    const extraction = await processVoice({
      audioBuffer: bytes,
      audioMime: mime,
      contextHint,
      googleApiKey: org.ai_google_key,
    });

    const entity = await createEntityFromVoice(supabase, profile.organization_id, extraction);

    await supabase.from('voice_captures').update({
      status: 'done',
      transcript: extraction.transcript,
      intent: extraction.intent,
      intent_confidence: extraction.intent_confidence,
      extracted_data: extraction,
      entity_created: entity,
      ai_model: 'gemini-2.5-flash',
      ai_duration_ms: extraction.ai_duration_ms,
      processed_at: new Date().toISOString(),
    }).eq('id', captureId);

    return json({
      id: captureId,
      status: 'done',
      intent: extraction.intent,
      summary: extraction.summary,
      transcript: extraction.transcript,
      entity_created: entity,
    }, 200);
  } catch (err: any) {
    const errMsg = String(err?.message || err).slice(0, 500);
    await supabase.from('voice_captures').update({
      status: 'failed',
      error_message: errMsg,
    }).eq('id', captureId);
    return json({ id: captureId, status: 'failed', error: errMsg }, 500);
  }
}
