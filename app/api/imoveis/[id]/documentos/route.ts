import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { DOCUMENTO_KIND_VALUES } from '@/lib/imoveis/shared';

const MAX_BYTES = 25 * 1024 * 1024; // 25MB por doc

// Allowlist derivada da fonte única em shared (AUD-D1) — nunca mais sai de sincronia.
const ALLOWED_KINDS = new Set<string>(DOCUMENTO_KIND_VALUES);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: imovelId } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!profile?.organization_id) return NextResponse.json({ message: 'Profile sem organização' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kind = (formData.get('kind') as string) || 'outro';

    if (!file) return NextResponse.json({ message: 'Sem ficheiro' }, { status: 400 });
    if (!ALLOWED_KINDS.has(kind)) return NextResponse.json({ message: `kind inválido: ${kind}` }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ message: 'Ficheiro maior que 25MB' }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${profile.organization_id}/${imovelId}/${kind}_${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from('imovel-documentos')
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

    if (upErr) return NextResponse.json({ message: upErr.message }, { status: 500 });

    const { data: row, error: insErr } = await supabase
      .from('imovel_documentos')
      .insert({
        organization_id: profile.organization_id,
        imovel_id: imovelId,
        kind,
        filename: file.name,
        storage_path: storagePath,
        bytes: file.size,
        mime_type: file.type,
      })
      .select('id, kind, filename, bytes, uploaded_at')
      .single();

    if (insErr) {
      await supabase.storage.from('imovel-documentos').remove([storagePath]);
      return NextResponse.json({ message: insErr.message }, { status: 500 });
    }

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
