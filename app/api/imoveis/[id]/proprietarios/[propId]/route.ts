import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; propId: string }> }) {
  try {
    const { id: imovelId, propId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if ('contact_id' in body) patch.contact_id = body.contact_id || null;
    if ('nome' in body) patch.nome = body.nome?.trim() || null;
    if ('percentagem' in body) patch.percentagem = body.percentagem != null && body.percentagem !== '' ? Number(body.percentagem) : null;
    if ('regime_bens' in body) patch.regime_bens = body.regime_bens || null;
    if ('e_residente' in body) patch.e_residente = !!body.e_residente;
    if ('notas' in body) patch.notas = body.notas?.trim() || null;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Nada para actualizar' }, { status: 400 });
    }

    const { error } = await supabase.from('imovel_proprietarios').update(patch).eq('id', propId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string; propId: string }> }) {
  try {
    const { id: imovelId, propId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    // Storage cleanup dos docs do proprietario
    const { data: docs } = await supabase
      .from('proprietario_documentos').select('storage_path').eq('proprietario_id', propId);
    if (docs && docs.length > 0) {
      await supabase.storage.from('proprietario-documentos').remove(docs.map((d) => d.storage_path));
    }

    const { error } = await supabase.from('imovel_proprietarios').delete().eq('id', propId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
