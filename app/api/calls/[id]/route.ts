import { createClient } from '@/lib/supabase/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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

  const { data, error } = await supabase
    .from('call_recordings')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('id', id)
    .maybeSingle();

  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'Not found' }, 404);

  // Signed URL for audio (10 min)
  let audioUrl: string | null = null;
  if (data.audio_path) {
    const { data: signed } = await supabase.storage
      .from('call-recordings')
      .createSignedUrl(data.audio_path, 600);
    audioUrl = signed?.signedUrl ?? null;
  }

  return json({ call: data, audioUrl });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const { data: call } = await supabase
    .from('call_recordings')
    .select('audio_path, owner_id')
    .eq('organization_id', profile.organization_id)
    .eq('id', id)
    .maybeSingle();
  if (!call) return json({ error: 'Not found' }, 404);
  if (call.owner_id !== user.id && profile.role !== 'admin') {
    return json({ error: 'Forbidden' }, 403);
  }

  // Delete audio file
  if (call.audio_path) {
    await supabase.storage.from('call-recordings').remove([call.audio_path]);
  }
  await supabase.from('call_recordings').delete().eq('id', id);

  return json({ ok: true });
}
