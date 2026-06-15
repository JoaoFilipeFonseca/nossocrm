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

    // Recolher os caminhos no storage ANTES de apagar a linha (o cascata da BD remove
    // as linhas-filhas e perderíamos os storage_path). Sem isto, os ficheiros ficavam
    // órfãos nos buckets — incluindo documentos sensíveis do proprietário (ex.: CC).
    const [{ data: fotos }, { data: docs }, { data: props }] = await Promise.all([
      supabase.from('imovel_fotos').select('storage_path').eq('imovel_id', id),
      supabase.from('imovel_documentos').select('storage_path').eq('imovel_id', id),
      supabase.from('imovel_proprietarios').select('id').eq('imovel_id', id),
    ]);
    const propIds = (props ?? []).map((p) => p.id);
    let propDocs: { storage_path: string | null }[] = [];
    if (propIds.length > 0) {
      const { data } = await supabase
        .from('proprietario_documentos').select('storage_path').in('proprietario_id', propIds);
      propDocs = data ?? [];
    }

    const { error } = await supabase.from('imoveis').delete().eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    // Best-effort: remover os ficheiros dos buckets. Não bloquear a resposta se falhar
    // (a linha já foi apagada); o objectivo é não deixar dados sensíveis para trás.
    const removeAll = async (bucket: string, rows: { storage_path: string | null }[]) => {
      const paths = rows.map((r) => r.storage_path).filter((p): p is string => !!p);
      if (paths.length > 0) {
        try { await supabase.storage.from(bucket).remove(paths); } catch { /* best-effort */ }
      }
    };
    await Promise.all([
      removeAll('imovel-fotos', fotos ?? []),
      removeAll('imovel-documentos', docs ?? []),
      removeAll('proprietario-documentos', propDocs),
    ]);

    revalidatePath('/imoveis');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
