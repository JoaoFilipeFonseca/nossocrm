import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const GoalSchema = z
  .object({
    year: z.number().int().min(2024).max(2100),
    annual_target_eur: z.number().min(0).max(999_999_999),
    monthly_target_eur: z.array(z.number().min(0).max(999_999_999)).length(12),
    notes: z.string().max(1000).nullable().optional(),
  })
  .strict();

async function resolveProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, error: json({ error: 'Unauthorized' }, 401) };
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single();
  if (profileError || !profile?.organization_id) {
    return { supabase, error: json({ error: 'Profile not found' }, 404) };
  }
  return { supabase, profile };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearParam = url.searchParams.get('year');

  const { supabase, profile, error } = await resolveProfile();
  if (error) return error;

  let query = supabase
    .from('org_revenue_goals')
    .select('id, year, annual_target_eur, monthly_target_eur, notes, updated_at')
    .eq('organization_id', profile!.organization_id)
    .order('year', { ascending: false });

  if (yearParam) {
    const y = Number(yearParam);
    if (!Number.isFinite(y)) return json({ error: 'Invalid year' }, 400);
    query = query.eq('year', y);
  }

  const { data, error: dbError } = await query;
  if (dbError) return json({ error: dbError.message }, 500);

  return json({ goals: data ?? [], isAdmin: profile!.role === 'admin' });
}

export async function PUT(req: Request) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);

  const { supabase, profile, error } = await resolveProfile();
  if (error) return error;
  if (profile!.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const raw = await req.json().catch(() => null);
  const parsed = GoalSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  }

  const payload = {
    organization_id: profile!.organization_id,
    year: parsed.data.year,
    annual_target_eur: parsed.data.annual_target_eur,
    monthly_target_eur: parsed.data.monthly_target_eur,
    notes: parsed.data.notes ?? null,
  };

  const { error: upsertError } = await supabase
    .from('org_revenue_goals')
    .upsert(payload, { onConflict: 'organization_id,year' });

  if (upsertError) return json({ error: upsertError.message }, 500);

  return json({ ok: true });
}
