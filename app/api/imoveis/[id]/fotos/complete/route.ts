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
    const uploads = Array.isArray(body.uploads) ? body.uploads : [];
    if (uploads.length === 0) return NextResponse.json({ message: 'Sem uploads' }, { status: 400 });

    const { data: existing } = await supabase
      .from('imovel_fotos').select('ordem, is_principal').eq('imovel_id', imovelId);
    let maxOrdem = existing?.reduce((m, f) => Math.max(m, f.ordem ?? 0), -1) ?? -1;
    let hasPrincipal = existing?.some((f) => f.is_principal) ?? false;

    const rows: Array<Record<string, unknown>> = [];
    for (const u of uploads) {
      if (!u.path) continue;
      maxOrdem++;
      const isPrincipal = !hasPrincipal;
      if (isPrincipal) hasPrincipal = true;

      rows.push({
        organization_id: profile.organization_id,
        imovel_id: imovelId,
        storage_path: u.path,
        url_publica: null, // bucket privado (AUD-C2) → URL assinado é gerado na leitura
        ordem: maxOrdem,
        is_principal: isPrincipal,
        bytes: u.bytes ?? null,
        origem: 'upload',
      });
    }

    if (rows.length === 0) return NextResponse.json({ inserted: 0 });

    const { data, error } = await supabase
      .from('imovel_fotos')
      .insert(rows)
      .select('id');

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ inserted: data?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
