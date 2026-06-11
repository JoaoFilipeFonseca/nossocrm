import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { CREATIVE_STATUSES, parseUsages } from '@/lib/criativos/shared';
import { attachSignedFileUrls } from '@/lib/criativos/server';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const PatchSchema = z.object({
  title: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  content: z.string().min(1).optional(),
  tags: z.array(z.string()).optional(),
  is_favorite: z.boolean().optional(),
  is_template: z.boolean().optional(),
  status: z.enum(CREATIVE_STATUSES).optional(),
  edited_by_human: z.boolean().optional(),
  imovel_id: z.string().uuid().nullable().optional(),
  // "usei em X a Y" — acrescenta um registo de utilização (nunca substitui os anteriores)
  add_usage: z.object({
    channel: z.string().min(1).max(60),
    used_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(200).optional(),
  }).optional(),
}).strict();

async function profileOr(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: json({ error: 'Unauthorized' }, 401) };
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (error || !profile?.organization_id) {
    return { supabase, error: json({ error: 'Profile not found' }, 404) };
  }
  return { supabase, profile };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, profile, error } = await profileOr(_req);
  if (error) return error;

  const { data, error: dbError } = await supabase
    .from('creative_archive')
    .select('*')
    .eq('organization_id', profile!.organization_id)
    .eq('id', id)
    .maybeSingle();

  if (dbError) return json({ error: dbError.message }, 500);
  if (!data) return json({ error: 'Not found' }, 404);
  const [item] = await attachSignedFileUrls(supabase, [data]);
  return json({ item });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await ctx.params;
  const { supabase, profile, error } = await profileOr(req);
  if (error) return error;

  const raw = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const { add_usage, ...fields } = parsed.data;
  const update: Record<string, unknown> = { ...fields };

  if (add_usage) {
    const { data: current, error: readError } = await supabase
      .from('creative_archive')
      .select('usages')
      .eq('organization_id', profile!.organization_id)
      .eq('id', id)
      .maybeSingle();
    if (readError) return json({ error: readError.message }, 500);
    if (!current) return json({ error: 'Not found' }, 404);
    update.usages = [...parseUsages(current.usages), add_usage];
  }

  if (Object.keys(update).length === 0) return json({ ok: true });

  const { error: dbError } = await supabase
    .from('creative_archive')
    .update(update)
    .eq('organization_id', profile!.organization_id)
    .eq('id', id);

  if (dbError) return json({ error: dbError.message }, 500);
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { id } = await ctx.params;
  const { supabase, profile, error } = await profileOr(req);
  if (error) return error;

  // Soft-delete (archive) by default — set archived_at
  const { error: dbError } = await supabase
    .from('creative_archive')
    .update({ archived_at: new Date().toISOString() })
    .eq('organization_id', profile!.organization_id)
    .eq('id', id);

  if (dbError) return json({ error: dbError.message }, 500);
  return json({ ok: true });
}
