import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/imoveis/[id]/fotos — lista fotos do imóvel.
 *
 * Upload é feito via /api/imoveis/[id]/fotos/sign + /complete (signed URL).
 * POST FormData foi removido por causa do limite 4.5MB do Vercel.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('imovel_fotos')
      .select('*')
      .eq('imovel_id', id)
      .order('ordem', { ascending: true });

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ fotos: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
