/**
 * GET /api/social-inbox — lista as conversas da Caixa Social (DMs) da org (RLS por sessão).
 * Ordena: a precisar de resposta primeiro, depois pela mais recente.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('social_conversations')
    .select(
      'id, platform, participant_name, last_snippet, last_message_at, last_from, message_count, needs_response, status, is_noise, contact_id, deal_id, ai_draft, ai_draft_at',
    )
    .order('needs_response', { ascending: false })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });

  const list = data ?? [];
  return NextResponse.json({
    ok: true,
    conversations: list,
    needsResponse: list.filter((c) => c.needs_response && !c.is_noise && c.status === 'open').length,
  });
}
