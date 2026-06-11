/**
 * MKT-BIBLIOTECA Fatia 3 — GET/PUT /api/settings/privacidade
 * Link da política de privacidade da organização (organization_settings.privacy_policy_url).
 * É o link que aparece no rodapé RGPD de todos os emails de automação. Admin-only na escrita.
 */
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export const dynamic = 'force-dynamic';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function resolve() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: json({ error: 'Unauthorized' }, 401) };
  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.organization_id) return { error: json({ error: 'Profile not found' }, 404) };
  return { orgId: profile.organization_id as string, role: profile.role as string };
}

export async function GET() {
  const { orgId, role, error } = await resolve();
  if (error) return error;
  const admin = createStaticAdminClient();
  const { data } = await admin
    .from('organization_settings')
    .select('privacy_policy_url')
    .eq('organization_id', orgId)
    .maybeSingle();
  return json({ url: data?.privacy_policy_url ?? null, isAdmin: role === 'admin' });
}

const PutSchema = z.object({
  url: z.string().trim().url().max(300).startsWith('https://').nullable().or(z.literal('').transform(() => null)),
}).strict();

export async function PUT(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const { orgId, role, error } = await resolve();
  if (error) return error;
  if (role !== 'admin') return json({ error: 'Apenas administradores' }, 403);

  const raw = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(raw);
  if (!parsed.success) return json({ error: 'URL inválido (tem de começar por https://)' }, 400);

  const admin = createStaticAdminClient();
  const { error: dbErr } = await admin
    .from('organization_settings')
    .update({ privacy_policy_url: parsed.data.url })
    .eq('organization_id', orgId);
  if (dbErr) return json({ error: dbErr.message }, 500);
  return json({ ok: true });
}
