/**
 * POST /api/social-inbox/[id]/status — marcar a conversa como tratada/aberta/ignorada.
 * Body: { status: 'open' | 'handled' | 'ignored' }. RLS por sessão (update_own_org).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';

export const dynamic = 'force-dynamic';

const ALLOWED = new Set(['open', 'handled', 'ignored']);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAllowedOrigin(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { status?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }
  const status = body.status ?? '';
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
  }

  // Tratada/ignorada => deixa de precisar de resposta. Reaberta => volta a precisar.
  const needsResponse = status === 'open';
  const { error } = await supabase
    .from('social_conversations')
    .update({ status, needs_response: needsResponse, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  return NextResponse.json({ ok: true, status });
}
