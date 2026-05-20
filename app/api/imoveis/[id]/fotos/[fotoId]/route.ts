import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string; fotoId: string }> }) {
  try {
    const { id: imovelId, fotoId } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const patch: Record<string, unknown> = {};
    if (typeof body.ordem === 'number') patch.ordem = body.ordem;
    if (typeof body.caption === 'string') patch.caption = body.caption.trim() || null;

    if (body.is_principal === true) {
      // Unset existing principal first to honour unique partial index
      await supabase
        .from('imovel_fotos')
        .update({ is_principal: false })
        .eq('imovel_id', imovelId)
        .eq('is_principal', true);
      patch.is_principal = true;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ message: 'Nada para actualizar' }, { status: 400 });
    }

    const { error } = await supabase.from('imovel_fotos').update(patch).eq('id', fotoId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string; fotoId: string }> }) {
  try {
    const { id: imovelId, fotoId } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: foto } = await supabase
      .from('imovel_fotos')
      .select('storage_path')
      .eq('id', fotoId)
      .maybeSingle();

    if (foto?.storage_path) {
      await supabase.storage.from('imovel-fotos').remove([foto.storage_path]);
    }

    const { error } = await supabase.from('imovel_fotos').delete().eq('id', fotoId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
