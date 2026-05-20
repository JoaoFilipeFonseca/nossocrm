import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchImagesFromUrl, downloadAndUploadPhotos } from '@/lib/imoveis/fotos-from-url';

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
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return NextResponse.json({ message: 'URL obrigatório' }, { status: 400 });

    const urls = await fetchImagesFromUrl(url);
    if (urls.length === 0) {
      return NextResponse.json({ ok: 0, found: 0, errors: ['Nenhuma imagem detectada'] });
    }

    const result = await downloadAndUploadPhotos(
      supabase as never,
      profile.organization_id,
      imovelId,
      urls,
      { maxBytes: 10 * 1024 * 1024, maxCount: 30 },
    );

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ ok: result.ok, found: urls.length, errors: result.errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
