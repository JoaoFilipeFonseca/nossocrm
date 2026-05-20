import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; mandId: string }> }) {
  try {
    const { id: imovelId, mandId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const patch: Record<string, unknown> = {};
    for (const k of ['tipo', 'data_inicio', 'data_fim', 'comissao_pct', 'comissao_paga_por', 'notas', 'activo']) {
      if (k in body) {
        if (k === 'comissao_pct') patch[k] = body[k] != null && body[k] !== '' ? Number(body[k]) : null;
        else if (k === 'activo') patch[k] = !!body[k];
        else patch[k] = body[k] || null;
      }
    }

    if (patch.activo === true) {
      await supabase.from('imovel_mandatos').update({ activo: false }).eq('imovel_id', imovelId).neq('id', mandId);
    }

    const { error } = await supabase.from('imovel_mandatos').update(patch).eq('id', mandId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string; mandId: string }> }) {
  try {
    const { id: imovelId, mandId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase.from('imovel_mandatos').delete().eq('id', mandId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
