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

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return json({ error: 'Profile not found' }, 404);

  const { data, error } = await supabase
    .from('voice_captures').select('*')
    .eq('organization_id', profile.organization_id).eq('id', id).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: 'Not found' }, 404);

  return json({ capture: data });
}
