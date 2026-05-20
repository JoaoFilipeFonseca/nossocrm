import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string; propId: string; docId: string }> }) {
  try {
    const { docId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: doc } = await supabase
      .from('proprietario_documentos').select('storage_path, filename').eq('id', docId).maybeSingle();
    if (!doc) return NextResponse.json({ message: 'Não encontrado' }, { status: 404 });

    const { data: signed, error } = await supabase.storage
      .from('proprietario-documentos').createSignedUrl(doc.storage_path, 60 * 10);
    if (error || !signed) return NextResponse.json({ message: error?.message ?? 'Erro' }, { status: 500 });

    return NextResponse.json({ url: signed.signedUrl, filename: doc.filename });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: { params: Promise<{ id: string; propId: string; docId: string }> }) {
  try {
    const { id: imovelId, docId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: doc } = await supabase
      .from('proprietario_documentos').select('storage_path').eq('id', docId).maybeSingle();
    if (doc?.storage_path) {
      await supabase.storage.from('proprietario-documentos').remove([doc.storage_path]);
    }
    const { error } = await supabase.from('proprietario_documentos').delete().eq('id', docId);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
