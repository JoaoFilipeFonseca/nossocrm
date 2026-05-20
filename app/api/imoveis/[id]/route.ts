import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { normalizeImovelPayload } from '@/app/api/imoveis/route';
import { triggerMatchesAsync } from '@/lib/matches/engine';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const patch = normalizeImovelPayload(body);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Nada para actualizar' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('imoveis')
      .update(patch)
      .eq('id', id)
      .select('id')
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ message: 'Imóvel não encontrado' }, { status: 404 });

    revalidatePath('/imoveis');
    revalidatePath(`/imoveis/${id}`);

    // Auto-trigger: imovel actualizado pode mudar pares de match (preco/estado/tipologia/zona)
    try {
      const { data: prof } = await supabase
        .from('imoveis').select('organization_id').eq('id', id).single();
      if (prof?.organization_id) triggerMatchesAsync(prof.organization_id);
    } catch { /* nao bloquear */ }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase.from('imoveis').delete().eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath('/imoveis');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
