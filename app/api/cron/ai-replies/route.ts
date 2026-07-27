/**
 * @fileoverview Relógio das respostas com "timing humano".
 *
 * Corre a cada minuto (pg_cron → net.http_post com X-Cron-Secret). Envia as
 * respostas agendadas cuja hora chegou:
 *  - primeira mensagem / após >30 min de silêncio → minuto 3
 *  - conversa a decorrer → ~40s
 *
 * Segurança de envio:
 *  - "reclama" cada resposta antes de enviar (evita envio duplo entre tiques).
 *  - se o João (ou o agente) já respondeu à conversa entretanto, cancela (não sobrepõe).
 *
 * POST /api/cron/ai-replies  — interno, só o cron chama.
 */
import { NextRequest } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { processIncomingMessage } from '@/lib/ai/agent';

export const maxDuration = 60;

// Quantas respostas processar por tique (sequencial; cabe nos 60s).
const BATCH = 10;

interface DueReply {
  id: string;
  organization_id: string;
  conversation_id: string;
  last_inbound_message_id: string | null;
  last_inbound_text: string | null;
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();

  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';
  const { data: expected } = await admin.rpc('get_backup_cron_secret');
  if (!expected || cronSecret !== expected) {
    return Response.json({ error: 'forbidden' }, { status: 403 });
  }

  const nowIso = new Date().toISOString();
  const { data: due } = await admin
    .from('scheduled_ai_replies')
    .select('id, organization_id, conversation_id, last_inbound_message_id, last_inbound_text')
    .eq('status', 'pending')
    .lte('due_at', nowIso)
    .order('due_at', { ascending: true })
    .limit(BATCH);

  let sent = 0;
  let cancelled = 0;
  let failed = 0;

  for (const row of (due ?? []) as DueReply[]) {
    // Reclamar (atómico): só quem conseguir passar de 'pending' → 'sent' processa.
    const { data: claimed } = await admin
      .from('scheduled_ai_replies')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (!claimed) continue;

    // Se já há uma resposta na conversa (o João respondeu à mão, ou já foi enviada),
    // não sobrepomos: cancela.
    const { data: last } = await admin
      .from('messaging_messages')
      .select('direction')
      .eq('conversation_id', row.conversation_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if ((last as { direction?: string } | null)?.direction === 'outbound') {
      await admin
        .from('scheduled_ai_replies')
        .update({ status: 'cancelled' })
        .eq('id', row.id);
      cancelled += 1;
      continue;
    }

    try {
      await processIncomingMessage({
        supabase: admin,
        conversationId: row.conversation_id,
        organizationId: row.organization_id,
        incomingMessage: row.last_inbound_text ?? '',
        messageId: row.last_inbound_message_id ?? undefined,
      });
      sent += 1;
    } catch (e) {
      failed += 1;
      console.error('[ai-replies] Falha ao processar resposta agendada:', row.id, e);
    }
  }

  // Estado em /automacoes (best-effort).
  try {
    const { data: cur } = await admin
      .from('system_automations')
      .select('run_count, fail_count')
      .eq('key', 'ai-reply-timing')
      .maybeSingle();
    await admin
      .from('system_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: failed === 0,
        last_run_error: failed === 0 ? null : `${failed} falha(s)`,
        run_count: ((cur as { run_count?: number } | null)?.run_count ?? 0) + 1,
        fail_count: ((cur as { fail_count?: number } | null)?.fail_count ?? 0) + (failed === 0 ? 0 : 1),
      })
      .eq('key', 'ai-reply-timing');
  } catch {
    /* best-effort */
  }

  return Response.json({ ok: true, sent, cancelled, failed });
}
