import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const TIPOS = new Set(['simples', 'exclusivo', 'misto']);
const PAGADORES = new Set(['vendedor', 'comprador', 'ambos']);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: imovelId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) return NextResponse.json({ message: 'Sem organização' }, { status: 404 });

    const body = await request.json();
    if (!TIPOS.has(body.tipo)) return NextResponse.json({ message: `tipo inválido: ${body.tipo}` }, { status: 400 });
    if (body.comissao_paga_por && !PAGADORES.has(body.comissao_paga_por)) {
      return NextResponse.json({ message: `comissao_paga_por inválido` }, { status: 400 });
    }
    if (!body.data_inicio) return NextResponse.json({ message: 'data_inicio obrigatória' }, { status: 400 });

    const payload = {
      organization_id: profile.organization_id,
      imovel_id: imovelId,
      tipo: body.tipo,
      data_inicio: body.data_inicio,
      data_fim: body.data_fim || null,
      comissao_pct: body.comissao_pct != null && body.comissao_pct !== '' ? Number(body.comissao_pct) : null,
      comissao_paga_por: body.comissao_paga_por || null,
      notas: body.notas?.trim() || null,
      activo: body.activo !== false,
    };

    // se este vai activo, desactivar os anteriores
    if (payload.activo) {
      await supabase.from('imovel_mandatos').update({ activo: false }).eq('imovel_id', imovelId);
    }

    const { data, error } = await supabase
      .from('imovel_mandatos').insert(payload).select('id').single();
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
