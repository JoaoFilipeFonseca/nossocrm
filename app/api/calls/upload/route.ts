import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { processCall } from '@/lib/ai/calls/processCall';

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
  if (file.size > MAX_BYTES) return json({ error: 'Audio too large (>100MB)' }, 413);

  const mime = (file.type || 'audio/mpeg').toLowerCase();
  if (!ALLOWED_MIMES.has(mime)) {
    return json({ error: `Mime ${mime} not allowed. Use m4a, mp3, wav, ogg, webm, aac, flac.` }, 415);
  }

  // Fetch org Google key
  const { data: orgSettings, error: settingsError } = await supabase
    .from('organization_settings')
    .select('ai_google_key, ai_enabled')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  if (settingsError) return json({ error: settingsError.message }, 500);
  if (!orgSettings?.ai_enabled) return json({ error: 'AI disabled' }, 403);
  if (!orgSettings?.ai_google_key) return json({ error: 'Google AI key not configured' }, 400);

  // Upload audio to Storage
  const ext = file.name?.split('.').pop()?.toLowerCase() || mime.split('/')[1] || 'm4a';
  const audioPath = `${profile.organization_id}/${crypto.randomUUID()}.${ext}`;
  const audioBuffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('call-recordings')
    .upload(audioPath, audioBuffer, { contentType: mime, upsert: false });

  if (uploadError) return json({ error: `Upload failed: ${uploadError.message}` }, 500);

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
    return json({ error: insertError?.message || 'Insert failed' }, 500);
  }

  const callId = inserted.id;

  // Process synchronously (limited to ~50s within Vercel 60s window)
  try {
    const result = await processCall(
      { audioBuffer, audioMime: mime },
      orgSettings.ai_google_key,
    );

    await supabase
      .from('call_recordings')
      .update({
        status: 'processed',
        transcript: result.transcript,
        summary: result.summary,
        key_points: result.key_points,
        next_actions: result.next_actions,
        decisions: result.decisions,
        mentions: result.mentions,
        sentiment: result.sentiment,
        ai_model: result.ai_model,
        ai_duration_ms: result.ai_duration_ms,
        processed_at: new Date().toISOString(),
      })
      .eq('id', callId);

    // Create deal_activity if deal_id present
    if (dealId) {
      const title = `📞 Chamada processada por IA`;
      const desc = result.summary || result.transcript.slice(0, 280);
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        organization_id: profile.organization_id,
        type: 'CALL',
        description: `${title}\n\n${desc}`,
        metadata: {
          call_recording_id: callId,
          sentiment: result.sentiment,
          next_actions_count: result.next_actions.length,
        },
      });
    }

    return json({ id: callId, status: 'processed', summary: result.summary }, 201);
  } catch (err: any) {
    await supabase
      .from('call_recordings')
      .update({
        status: 'failed',
        error_message: String(err?.message || err).slice(0, 500),
      })
      .eq('id', callId);
    return json({ id: callId, status: 'failed', error: String(err?.message || err) }, 500);
  }
}
