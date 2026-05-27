/**
 * POST /api/ai/automation-generate
 *
 * Sprint 9, commit 1.
 *
 * Recebe descrição em linguagem natural, devolve { name, icon, description, definition }
 * pronto a aplicar no builder. Auth: sessão Supabase (chamado do browser pelo
 * WriteBuilder).
 *
 * Pipeline:
 *  1. user descreve em PT
 *  2. routedGenerate com system prompt do generator-prompt.ts
 *  3. parse JSON (tenta robusta: strip ```json fences, trim)
 *  4. valida estrutura mínima (nodes array, edges array, IDs únicos, átomos conhecidos)
 *  5. devolve ao cliente
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { routedGenerate, type AIKeys } from '@/lib/ai/router';
import { AUTOMATION_GENERATOR_SYSTEM } from '@/lib/automation-engine/generator-prompt';
import { ATOM_CATALOG } from '@/lib/automation-engine/catalog';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface GeneratedAutomation {
  name?: string;
  icon?: string;
  description?: string;
  definition?: {
    nodes?: Array<{ id?: string; atom?: string; position?: { x: number; y: number }; config?: Record<string, unknown> }>;
    edges?: Array<{ id?: string; source?: string; target?: string; sourceHandle?: string }>;
  };
}

function extractJson(text: string): string {
  let s = text.trim();
  // remove ```json ... ``` fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // procura o primeiro { e o último } no caso de prefixo/sufixo
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first >= 0 && last > first) return s.slice(first, last + 1);
  return s;
}

function validate(auto: GeneratedAutomation): { ok: true } | { ok: false; error: string } {
  if (!auto.definition) return { ok: false, error: 'definition em falta' };
  const nodes = auto.definition.nodes ?? [];
  const edges = auto.definition.edges ?? [];
  if (!Array.isArray(nodes) || nodes.length === 0) return { ok: false, error: 'pelo menos 1 nó necessário' };
  if (!Array.isArray(edges)) return { ok: false, error: 'edges deve ser array' };

  const validAtomIds = new Set(ATOM_CATALOG.map((a) => a.id));
  const nodeIds = new Set<string>();
  for (const n of nodes) {
    if (!n.id || typeof n.id !== 'string') return { ok: false, error: 'nó sem id' };
    if (nodeIds.has(n.id)) return { ok: false, error: `id repetido: ${n.id}` };
    nodeIds.add(n.id);
    if (!n.atom || !validAtomIds.has(n.atom)) return { ok: false, error: `átomo desconhecido: ${n.atom}` };
  }
  for (const e of edges) {
    if (!e.id || !e.source || !e.target) return { ok: false, error: 'edge sem id/source/target' };
    if (!nodeIds.has(e.source)) return { ok: false, error: `edge.source desconhecida: ${e.source}` };
    if (!nodeIds.has(e.target)) return { ok: false, error: `edge.target desconhecida: ${e.target}` };
  }
  // pelo menos 1 trigger
  if (!nodes.some((n) => n.atom === 'trigger.event')) {
    return { ok: false, error: 'falta nó trigger.event como início' };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle();
  const organizationId = profile?.organization_id;
  if (!organizationId) return NextResponse.json({ error: 'Sem organização' }, { status: 400 });

  let body: { description?: string; refine?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (!description) return NextResponse.json({ error: 'description é obrigatório' }, { status: 400 });

  // Lê keys da org
  const { data: orgSettings } = await supabase
    .from('organization_settings')
    .select('ai_google_key, ai_anthropic_key')
    .eq('organization_id', organizationId)
    .maybeSingle();
  const keys: AIKeys = {};
  if (orgSettings?.ai_google_key) keys.google = orgSettings.ai_google_key as string;
  if (orgSettings?.ai_anthropic_key) keys.anthropic = orgSettings.ai_anthropic_key as string;
  if (!keys.google && !keys.anthropic) {
    return NextResponse.json({ error: 'Sem chaves AI configuradas para esta organização' }, { status: 503 });
  }

  const userPrompt = body.refine
    ? `Descrição original:\n${description}\n\nRefina seguindo este feedback adicional:\n${body.refine}`
    : description;

  try {
    const result = await routedGenerate({
      feature: 'workflow_desc',
      system: AUTOMATION_GENERATOR_SYSTEM,
      prompt: userPrompt,
      keys,
      temperature: 0.3,
    });

    const raw = extractJson(result.text);
    let parsed: GeneratedAutomation;
    try { parsed = JSON.parse(raw); }
    catch (e) {
      return NextResponse.json({
        error: 'IA devolveu JSON inválido',
        raw: result.text.slice(0, 2000),
        parse_error: e instanceof Error ? e.message : String(e),
        model_used: result.modelUsed,
      }, { status: 502 });
    }

    const v = validate(parsed);
    if (!v.ok) {
      return NextResponse.json({
        error: `Estrutura inválida: ${v.error}`,
        generated: parsed,
        model_used: result.modelUsed,
      }, { status: 422 });
    }

    return NextResponse.json({
      name: parsed.name ?? 'Automação gerada por IA',
      icon: parsed.icon ?? '✨',
      description: parsed.description ?? '',
      definition: parsed.definition,
      model_used: result.modelUsed,
      fallback_used: result.fallbackUsed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
