import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const CREATIVE_TYPES = [
  'email','whatsapp','sms','social_post','carousel','story','ad_copy',
  'blog_article','imovel_description','sales_script','briefing','swot',
  'proposal','pdf','banner',
] as const;

const CreateSchema = z.object({
  type: z.enum(CREATIVE_TYPES),
  channel: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  content: z.string().min(1),
  deal_id: z.string().uuid().nullable().optional(),
  contact_id: z.string().uuid().nullable().optional(),
  imovel_id: z.string().uuid().nullable().optional(),
  prompt_key: z.string().nullable().optional(),
  source: z.string().default('manual'),
  ai_provider: z.string().nullable().optional(),
  ai_model: z.string().nullable().optional(),
  ai_cost_usd: z.number().nullable().optional(),
  ai_duration_ms: z.number().int().nullable().optional(),
  status: z.string().default('draft'),
  tags: z.array(z.string()).default([]),
  is_template: z.boolean().default(false),
  is_favorite: z.boolean().default(false),
}).strict();

async function resolveProfile() {
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
  return { supabase, profile, userId: user.id };
}

export async function GET(req: Request) {
  const { supabase, profile, error } = await resolveProfile();
  if (error) return error;

  const url = new URL(req.url);
  const types = url.searchParams.getAll('type');
  const channel = url.searchParams.get('channel');
  const favoritesOnly = url.searchParams.get('favorites') === '1';
  const templatesOnly = url.searchParams.get('templates') === '1';
  const dealId = url.searchParams.get('dealId');
  const search = url.searchParams.get('q')?.trim();
  const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);

  let q = supabase
    .from('creative_archive')
    .select('id, type, channel, title, subject, content, deal_id, contact_id, imovel_id, tags, is_favorite, is_template, status, ai_provider, ai_model, ai_cost_usd, metric_opens, metric_replies, metric_clicks, metric_impressions, metric_conversions, performance_score, created_at, updated_at')
    .eq('organization_id', profile!.organization_id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (types.length > 0) q = q.in('type', types);
  if (channel) q = q.eq('channel', channel);
  if (favoritesOnly) q = q.eq('is_favorite', true);
  if (templatesOnly) q = q.eq('is_template', true);
  if (dealId) q = q.eq('deal_id', dealId);
  if (search) {
    const safe = search.replace(/[%_]/g, '\\$&');
    q = q.or(`title.ilike.%${safe}%,subject.ilike.%${safe}%,content.ilike.%${safe}%`);
  }

  const { data, error: dbError } = await q;
  if (dbError) return json({ error: dbError.message }, 500);

  return json({ items: data ?? [], total: data?.length ?? 0 });
}

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { supabase, profile, userId, error } = await resolveProfile();
  if (error) return error;

  const raw = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const { data, error: dbError } = await supabase
    .from('creative_archive')
    .insert({
      organization_id: profile!.organization_id,
      owner_id: userId,
      ...parsed.data,
    })
    .select('id')
    .single();

  if (dbError) return json({ error: dbError.message }, 500);
  return json({ id: data.id, ok: true }, 201);
}
