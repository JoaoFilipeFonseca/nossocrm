/**
 * GET /api/social-inbox/[id] — uma conversa + as suas mensagens (RLS por sessão).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: conv } = await supabase
    .from('social_conversations')
    .select(
      'id, platform, participant_name, participant_id, last_message_at, needs_response, status, is_noise, contact_id, deal_id, ai_draft, ai_draft_at',
    )
    .eq('id', id)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });

  const { data: messages } = await supabase
    .from('social_messages')
    .select('id, from_side, body, sent_at')
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })
    .limit(50);

  return NextResponse.json({ ok: true, conversation: conv, messages: messages ?? [] });
}
