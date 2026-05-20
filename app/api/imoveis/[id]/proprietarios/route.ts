import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

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
    const payload = {
      organization_id: profile.organization_id,
      imovel_id: imovelId,
      contact_id: body.contact_id || null,
      nome: body.nome?.trim() || null,
      percentagem: body.percentagem != null && body.percentagem !== '' ? Number(body.percentagem) : null,
      regime_bens: body.regime_bens || null,
      e_residente: body.e_residente !== false,
      notas: body.notas?.trim() || null,
    };

    if (!payload.nome && !payload.contact_id) {
      return NextResponse.json({ message: 'Tem de indicar nome ou contacto' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('imovel_proprietarios')
      .insert(payload)
      .select('id')
      .single();
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
