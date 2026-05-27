/**
 * POST /api/ai/automation-run
 *
 * Sprint 4.2 commit 1 (refactor: keys lidas da BD por org, não env Vercel).
 *
 * Endpoint interno usado pelo átomo `action.run_ai`. Reusa `routedGenerate`
 * com keys obtidas via service_role client a partir de `organization_settings`
 * (ai_google_key, ai_anthropic_key) ou `user_settings` (fallback).
 *
 * Auth: Bearer <SUPABASE_SERVICE_ROLE_KEY>.
 *
 * Body:
 *   { organization_id, prompt, system?, feature?, temperature? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { routedGenerate, type AIFeature, type AIKeys } from '@/lib/ai/router';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VALID_FEATURES: AIFeature[] = [
  'chat', 'briefing', 'workflow_icp', 'workflow_swot', 'workflow_desc',
  'workflow_pitch', 'email_draft', 'whatsapp_draft', 'deal_coach',
  'imovel_extract', 'generic',
];

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CRM_SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { organization_id?: string; prompt?: string; system?: string; feature?: string; temperature?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'prompt é obrigatório' }, { status: 400 });

  const organizationId = typeof body.organization_id === 'string' ? body.organization_id : '';
  if (!organizationId) return NextResponse.json({ error: 'organization_id é obrigatório' }, { status: 400 });

  const feature: AIFeature = VALID_FEATURES.includes(body.feature as AIFeature)
    ? (body.feature as AIFeature)
    : 'generic';

  // Lê keys da BD via service_role (bypass RLS, mas filtramos por organization_id)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.CRM_SUPABASE_URL ?? '';
  const admin = createClient(supabaseUrl, serviceKey);
  const { data: orgSettings } = await admin
    .from('organization_settings')
    .select('ai_google_key, ai_anthropic_key')
    .eq('organization_id', organizationId)
    .maybeSingle();

  const keys: AIKeys = {};
  if (orgSettings?.ai_google_key) keys.google = orgSettings.ai_google_key as string;
  if (orgSettings?.ai_anthropic_key) keys.anthropic = orgSettings.ai_anthropic_key as string;

  // Fallback final: env vars do servidor
  if (!keys.google && process.env.GOOGLE_GENERATIVE_AI_API_KEY) keys.google = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!keys.anthropic && process.env.ANTHROPIC_API_KEY) keys.anthropic = process.env.ANTHROPIC_API_KEY;

  if (!keys.google && !keys.anthropic) {
    return NextResponse.json({ error: 'Sem chaves AI configuradas para esta organização (organization_settings.ai_google_key/ai_anthropic_key)' }, { status: 503 });
  }

  try {
    const result = await routedGenerate({
      feature,
      prompt,
      system: typeof body.system === 'string' && body.system.trim() ? body.system : undefined,
      keys,
      temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    });
    return NextResponse.json({
      text: result.text,
      model_used: result.modelUsed,
      fallback_used: result.fallbackUsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
