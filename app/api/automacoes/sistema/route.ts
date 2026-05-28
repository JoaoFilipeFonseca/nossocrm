/**
 * /api/automacoes/sistema — gestão das automações de sistema (cron + edge).
 *
 * Sprint 27 c2 — REGRA CRÍTICA gravada em memory/regra_automacoes_no_crm.md:
 * toda automação tem que ser visível e editável aqui. Sem código.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const { data, error } = await supabase
    .from('system_automations')
    .select('id, key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params, last_run_at, last_run_ok, last_run_error, run_count, fail_count, updated_at')
    .order('name');
  if (error) return json({ error: error.message }, 500);
  return json({ items: data ?? [] });
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('toggle'), enabled: z.boolean() }),
  z.object({ action: z.literal('schedule'), cron_expression: z.string().min(1).max(120) }),
  z.object({ action: z.literal('params'), params: z.record(z.string(), z.unknown()) }),
  z.object({ action: z.literal('trigger') }),
]);

export async function POST(req: NextRequest) {
  if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  if (!key) return json({ error: 'key required' }, 400);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Unauthorized' }, 401);

  const raw = await req.json().catch(() => null);
  const parsed = ActionSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
  try {
    if (body.action === 'toggle') {
      const { data, error } = await supabase.rpc('toggle_system_automation', { p_key: key, p_enabled: body.enabled });
      if (error) return json({ error: error.message }, error.message.includes('admin only') ? 403 : 500);
      return json(data);
    }
    if (body.action === 'schedule') {
      const { data, error } = await supabase.rpc('update_system_automation_schedule', { p_key: key, p_cron_expression: body.cron_expression });
      if (error) return json({ error: error.message }, error.message.includes('admin only') ? 403 : 500);
      return json(data);
    }
    if (body.action === 'params') {
      const { data, error } = await supabase.rpc('update_system_automation_params', { p_key: key, p_params: body.params });
      if (error) return json({ error: error.message }, error.message.includes('admin only') ? 403 : 500);
      return json(data);
    }
    if (body.action === 'trigger') {
      const { data, error } = await supabase.rpc('trigger_system_automation_now', { p_key: key });
      if (error) return json({ error: error.message }, error.message.includes('admin only') ? 403 : 500);
      return json(data);
    }
    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Erro' }, 500);
  }
}
