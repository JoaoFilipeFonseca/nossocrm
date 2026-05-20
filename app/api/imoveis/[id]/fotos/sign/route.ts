import { NextRequest, NextResponse } from 'next/server';
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
    const filenames = Array.isArray(body.filenames) ? body.filenames : [];
    if (filenames.length === 0) return NextResponse.json({ message: 'Sem ficheiros' }, { status: 400 });
    if (filenames.length > 30) return NextResponse.json({ message: 'Máximo 30 fotos por batch' }, { status: 400 });

    const items: Array<{ path: string; token: string; signedUrl: string; filename: string }> = [];
    for (const rawName of filenames) {
      const filename = String(rawName ?? 'foto.jpg');
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${profile.organization_id}/${imovelId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeName}`;

      const { data, error } = await supabase.storage
        .from('imovel-fotos')
        .createSignedUploadUrl(path);
      if (error || !data) return NextResponse.json({ message: error?.message ?? 'Erro signed URL' }, { status: 500 });

      items.push({ path, token: data.token, signedUrl: data.signedUrl, filename });
    }

    return NextResponse.json({ items });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
