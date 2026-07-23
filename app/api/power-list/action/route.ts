/**
 * POST /api/power-list/action — BRIEF 2. Acção rápida da Power List (página /hoje).
 *
 * Body: { dealId: string, action: 'answered' | 'no_answer' | 'snooze' }
 *
 *  - answered  : houve conversa → regista CHQ (call, actor=human) e promove o
 *                negócio para a etapa "Oportunidade" (só se ainda estiver na etapa
 *                de espera "Contactos"). Conta para o número do dia.
 *  - no_answer : não atendeu → CONTA como contacto manual (trabalho feito), mas
 *                a lead ainda não foi atendida: NÃO conta como conversa e NÃO
 *                repõe o relógio de frieza (deal_state_signals exclui
 *                result=no_answer/voicemail do último toque). Adia 3 dias.
 *  - snooze    : adiar → adia 30 dias.
 *
 * Autenticado (sessão). Nunca 5xx em erro lógico previsível.
 */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const NO_ANSWER_SNOOZE_DAYS = 3;
const SNOOZE_DAYS = 30;

const BodySchema = z
  .object({
    dealId: z.string().uuid(),
    action: z.enum(['answered', 'no_answer', 'snooze']),
  })
  .strict();

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function lisbonPlusDaysISO(days: number): string {
  // Meia-noite (hora Lisboa) do dia de hoje + days, em ISO.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || '0');
  const d = new Date(Date.UTC(get('year'), get('month') - 1, get('day') + days, 0, 0, 0));
  return d.toISOString();
}

export async function POST(request: NextRequest) {
  if (!isAllowedOrigin(request)) return json({ error: 'Forbidden' }, 403);

  const supabase = await createClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) return json({ error: 'Unauthorized' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .maybeSingle();
  const orgId = (profile as { organization_id?: string } | null)?.organization_id;
  if (!orgId) return json({ error: 'Profile not found' }, 404);

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: 'Invalid payload', details: parsed.error.flatten() }, 400);
  const { dealId, action } = parsed.data;

  // Carregar o negócio (defesa em profundidade + dados para a acção).
  const { data: deal } = await supabase
    .from('deals')
    .select('id, organization_id, board_id, stage_id, contact_id, custom_fields')
    .eq('id', dealId)
    .maybeSingle();
  if (!deal || (deal as { organization_id?: string }).organization_id !== orgId) {
    return json({ error: 'Deal not found' }, 404);
  }
  const d = deal as {
    board_id: string;
    stage_id: string | null;
    contact_id: string | null;
    custom_fields: Record<string, unknown> | null;
  };

  let movedToOportunidade = false;
  let countsAsConversation = false;

  if (action === 'answered') {
    countsAsConversation = true;
    // 1) Registar CHQ (conta como conversa no número do dia).
    const { error: actErr } = await supabase.from('deal_activities').insert({
      deal_id: dealId,
      organization_id: orgId,
      owner_id: user.id,
      type: 'call',
      ...(d.contact_id ? { contact_id: d.contact_id } : {}),
      metadata: { via: 'power-list', result: 'answered', logged_by: user.id },
    });
    if (actErr) return json({ error: actErr.message }, 500);

    // 2) Promover para "Oportunidade" — só se ainda estiver numa etapa de espera.
    const { data: curStage } = await supabase
      .from('board_stages')
      .select('excludes_followup')
      .eq('id', d.stage_id)
      .maybeSingle();
    const isHolding = (curStage as { excludes_followup?: boolean } | null)?.excludes_followup === true;
    if (isHolding) {
      const { data: target } = await supabase
        .from('board_stages')
        .select('id')
        .eq('board_id', d.board_id)
        .eq('excludes_followup', false)
        .order('order', { ascending: true })
        .limit(1)
        .maybeSingle();
      const targetStageId = (target as { id?: string } | null)?.id;
      if (targetStageId) {
        const { error: mvErr } = await supabase
          .from('deals')
          .update({ stage_id: targetStageId, last_stage_change_date: new Date().toISOString() })
          .eq('id', dealId);
        if (!mvErr) movedToOportunidade = true;
      }
    }
  } else {
    // no_answer / snooze → adiar (não conta como conversa).
    const days = action === 'no_answer' ? NO_ANSWER_SNOOZE_DAYS : SNOOZE_DAYS;
    const reason = action === 'no_answer' ? 'Não atendeu (Power List)' : 'Adiado na Power List';
    const cf = { ...(d.custom_fields || {}), snoozedUntil: lisbonPlusDaysISO(days), snoozeReason: reason };
    const { error: snErr } = await supabase.from('deals').update({ custom_fields: cf }).eq('id', dealId);
    if (snErr) return json({ error: snErr.message }, 500);

    if (action === 'no_answer') {
      // Regista como CHAMADA humana com resultado 'no_answer': CONTA como contacto
      // manual (trabalho feito), mas o relógio de frieza NÃO é reposto — o
      // deal_state_signals exclui result=no_answer/voicemail do último toque.
      await supabase.from('deal_activities').insert({
        deal_id: dealId,
        organization_id: orgId,
        owner_id: user.id,
        type: 'call',
        actor: 'human',
        ...(d.contact_id ? { contact_id: d.contact_id } : {}),
        description: 'Tentativa de chamada sem resposta (Power List)',
        metadata: { via: 'power-list', result: 'no_answer', logged_by: user.id },
      });
    }
  }

  return json({ ok: true, action, movedToOportunidade, countsAsConversation });
}
