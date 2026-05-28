import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { processCallText } from '@/lib/ai/calls/processCallText';
import { sanitizeCopy } from '@/lib/ai/sanitize';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const AUDIO_MIMES = new Set([
  'audio/mpeg', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
  'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg',
  'audio/aac', 'audio/flac',
]);

const TEXT_MIMES = new Set([
  'text/plain', 'text/markdown', 'text/x-markdown',
  'application/octet-stream', // alguns browsers reportam .txt assim
]);

const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_TEXT_BYTES = 2 * 1024 * 1024;    // 2 MB de transcript chega para ~1h de fala

function isTextFile(mime: string, name: string): boolean {
  if (mime.startsWith('text/')) return true;
  if (TEXT_MIMES.has(mime)) return true;
  const lower = (name || '').toLowerCase();
  return lower.endsWith('.txt') || lower.endsWith('.md');
}

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

  const rawMime = (file.type || '').toLowerCase();
  const mime = rawMime.split(';')[0].trim();
  const fileName = file.name || '';
  const isText = isTextFile(mime, fileName);

  // Quick sanity: org has Google key (evita gastar I/O antes de falhar)
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('ai_google_key, ai_enabled')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();
  if (!orgSettings?.ai_enabled) return json({ error: 'IA desactivada na organização' }, 403);
  if (!orgSettings?.ai_google_key) return json({ error: 'Chave Google IA não configurada' }, 400);

  if (isText) {
    if (file.size > MAX_TEXT_BYTES) return json({ error: 'Transcript demasiado grande (>2 MB)' }, 413);

    const raw = await file.text();
    const transcript = sanitizeCopy(raw.trim());
    if (!transcript || transcript.length < 20) {
      return json({ error: 'Transcript vazio ou demasiado curto' }, 400);
    }

    const { data: inserted, error: insertError } = await supabase
      .from('call_recordings')
      .insert({
        organization_id: profile.organization_id,
        owner_id: user.id,
        deal_id: dealId,
        contact_id: contactId,
        audio_path: null,
        audio_size_bytes: file.size,
        audio_mime: mime || 'text/plain',
        source: 'notta-text',
        source_ref: fileName || null,
        status: 'transcribing',
        recorded_at: recordedAt,
        transcript,
      })
      .select('id')
      .single();

    if (insertError || !inserted) return json({ error: insertError?.message || 'Insert falhou' }, 500);
    const callId = inserted.id;

    try {
      const extraction = await processCallText(transcript, orgSettings.ai_google_key);

      const summary = extraction.summary;

      await supabase
        .from('call_recordings')
        .update({
          status: 'processed',
          summary,
          key_points: extraction.key_points,
          next_actions: extraction.next_actions,
          decisions: extraction.decisions,
          mentions: extraction.mentions,
          sentiment: extraction.sentiment,
          ai_model: extraction.ai_model,
          ai_duration_ms: extraction.ai_duration_ms,
          processed_at: new Date().toISOString(),
        })
        .eq('id', callId);

      if (dealId) {
        await supabase.from('deal_activities').insert({
          deal_id: dealId,
          organization_id: profile.organization_id,
          type: 'CALL',
          description: `📞 Chamada importada (Notta)\n\n${summary || transcript.slice(0, 280)}`,
          metadata: {
            call_recording_id: callId,
            sentiment: extraction.sentiment,
            next_actions_count: extraction.next_actions.length,
            source: 'notta-text',
          },
        });
      }

      return json({ id: callId, status: 'processed' }, 200);
    } catch (err: any) {
      await supabase
        .from('call_recordings')
        .update({
          status: 'failed',
          error_message: String(err?.message || err).slice(0, 500),
        })
        .eq('id', callId);
      // Webhooks nunca devolvem 500 em erro logico (memory). Retornamos 200 com erro estruturado
      // para o cliente saber sem trigger de retry indesejado.
      return json({ id: callId, status: 'failed', error: 'IA falhou na extracção. Ver detalhe na chamada.' }, 200);
    }
  }

  // ===== Caminho áudio (existente, inalterado) =====
  if (!AUDIO_MIMES.has(mime)) {
    return json({ error: `Formato ${mime || 'desconhecido'} não aceite. Use m4a/mp3/wav/ogg/webm/aac/flac ou .txt/.md exportado do Notta.` }, 415);
  }
  if (file.size > MAX_AUDIO_BYTES) return json({ error: 'Áudio demasiado grande (>100MB)' }, 413);

  const ext = fileName.split('.').pop()?.toLowerCase() || mime.split('/')[1] || 'm4a';
  const audioPath = `${profile.organization_id}/${crypto.randomUUID()}.${ext}`;
  const audioBuffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('call-recordings')
    .upload(audioPath, audioBuffer, { contentType: mime, upsert: false });

  if (uploadError) return json({ error: `Upload falhou: ${uploadError.message}` }, 500);

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
      source: 'audio',
      status: 'transcribing',
      recorded_at: recordedAt,
    })
    .select('id')
    .single();

  if (insertError || !inserted) {
    return json({ error: insertError?.message || 'Insert falhou' }, 500);
  }

  const callId = inserted.id;

  try {
    const admin = createStaticAdminClient();
    admin.functions.invoke('process-call', { body: { call_id: callId } })
      .catch((err) => console.error('[calls/upload] invoke falhou:', err));
  } catch (e) {
    console.error('[calls/upload] admin client falhou:', e);
  }

  return json({ id: callId, status: 'transcribing' }, 202);
}
