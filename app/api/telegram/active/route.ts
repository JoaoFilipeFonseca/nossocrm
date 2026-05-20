import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/telegram/active -> { imovel_id: string | null }
 * POST /api/telegram/active { imovel_id: string | null } -> grava como activo Telegram
 */

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('organization_id').eq('id', user.id).single();
  if (!profile?.organization_id) return NextResponse.json({ imovel_id: null });

  const { data } = await supabase
    .from('organization_settings')
    .select('telegram_active_imovel_id')
    .eq('organization_id', profile.organization_id)
    .maybeSingle();

  return NextResponse.json({ imovel_id: data?.telegram_active_imovel_id ?? null });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const imovelId: string | null = typeof body?.imovel_id === 'string' ? body.imovel_id : null;

    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) {
      return NextResponse.json({ message: 'Profile sem organização' }, { status: 404 });
    }

    // Confirma que o imóvel existe e pertence à org (se imovelId for definido)
    if (imovelId) {
      const { data: imv } = await supabase
        .from('imoveis').select('id, organization_id').eq('id', imovelId).maybeSingle();
      if (!imv || imv.organization_id !== profile.organization_id) {
        return NextResponse.json({ message: 'Imóvel inexistente' }, { status: 404 });
      }
    }

    const { error } = await supabase
      .from('organization_settings')
      .update({ telegram_active_imovel_id: imovelId })
      .eq('organization_id', profile.organization_id);

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath('/imoveis');
    if (imovelId) revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true, imovel_id: imovelId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
