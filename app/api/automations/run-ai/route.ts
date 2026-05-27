/**
 * POST /api/automations/run-ai
 *
 * Sprint 4.2, commit 1.
 *
 * Endpoint interno usado pelo átomo `action.run_ai` da Máquina de Automações.
 * Reusa o `routedGenerate` (Gemini + fallback Anthropic) com as keys do servidor.
 *
 * Auth: Bearer <SUPABASE_SERVICE_ROLE_KEY> (apenas chamado pela Edge Function,
 * nunca por browser). Sem cookie de sessão.
 *
 * Body:
 *   {
 *     prompt: string,
 *     system?: string,
 *     feature?: 'generic' | 'email_draft' | 'whatsapp_draft' | 'workflow_desc' | ...,
 *     temperature?: number,
 *     max_tokens?: number  // ignorado por agora (vercel AI SDK trata)
 *   }
 *
 * Resposta:
 *   { text, model_used, fallback_used }
 */
import { NextRequest, NextResponse } from 'next/server';
import { routedGenerate, type AIFeature } from '@/lib/ai/router';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const VALID_FEATURES: AIFeature[] = [
  'chat', 'briefing', 'workflow_icp', 'workflow_swot', 'workflow_desc',
  'workflow_pitch', 'email_draft', 'whatsapp_draft', 'deal_coach',
  'imovel_extract', 'generic',
];

export async function POST(req: NextRequest) {
  // Auth via service role
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.CRM_SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { prompt?: string; system?: string; feature?: string; temperature?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) return NextResponse.json({ error: 'prompt é obrigatório' }, { status: 400 });

  const feature: AIFeature = VALID_FEATURES.includes(body.feature as AIFeature)
    ? (body.feature as AIFeature)
    : 'generic';

  const keys = {
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
  };

  if (!keys.google && !keys.anthropic) {
    return NextResponse.json({ error: 'Nenhuma AI key configurada no servidor (GOOGLE_GENERATIVE_AI_API_KEY ou ANTHROPIC_API_KEY)' }, { status: 503 });
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
