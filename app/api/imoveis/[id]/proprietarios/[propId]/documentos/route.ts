import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_KINDS = new Set([
  'cc', 'bi', 'nif', 'comprovativo_morada',
  'certidao_casamento', 'sentenca_divorcio', 'habilitacao_herdeiros',
  'procuracao', 'declaracao_nao_residencia', 'outro',
]);

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string; propId: string }> }) {
  try {
    const { id: imovelId, propId } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) return NextResponse.json({ message: 'Sem organização' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const kind = (formData.get('kind') as string) || 'outro';
    const validade = (formData.get('validade') as string) || null;

    if (!file) return NextResponse.json({ message: 'Sem ficheiro' }, { status: 400 });
    if (!ALLOWED_KINDS.has(kind)) return NextResponse.json({ message: `kind inválido: ${kind}` }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ message: 'Ficheiro maior que 25MB' }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${profile.organization_id}/${imovelId}/${propId}/${kind}_${Date.now()}_${safeName}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage
      .from('proprietario-documentos')
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ message: upErr.message }, { status: 500 });

    const { data: row, error: insErr } = await supabase
      .from('proprietario_documentos')
      .insert({
        organization_id: profile.organization_id,
        proprietario_id: propId,
        kind,
        filename: file.name,
        storage_path: storagePath,
        bytes: file.size,
        validade: validade || null,
      })
      .select('id, kind, filename, bytes, validade, uploaded_at')
      .single();

    if (insErr) {
      await supabase.storage.from('proprietario-documentos').remove([storagePath]);
      return NextResponse.json({ message: insErr.message }, { status: 500 });
    }

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
