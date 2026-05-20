import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB por foto
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']);

export async function GET(_request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('imovel_fotos')
      .select('*')
      .eq('imovel_id', id)
      .order('ordem', { ascending: true });

    if (error) return NextResponse.json({ message: error.message }, { status: 500 });
    return NextResponse.json({ fotos: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}

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
    const files = formData.getAll('files') as File[];
    if (files.length === 0) return NextResponse.json({ message: 'Sem ficheiros' }, { status: 400 });

    // Get current max ordem
    const { data: existing } = await supabase
      .from('imovel_fotos')
      .select('ordem, is_principal')
      .eq('imovel_id', imovelId);
    let maxOrdem = existing?.reduce((m, f) => Math.max(m, f.ordem ?? 0), -1) ?? -1;
    const hasPrincipal = existing?.some((f) => f.is_principal) ?? false;

    const uploaded: Array<{ id: string; url: string; storage_path: string }> = [];
    const errors: string[] = [];

    for (const file of files) {
      if (!ALLOWED_MIMES.has(file.type)) {
        errors.push(`${file.name}: tipo não suportado (${file.type})`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: maior que 10MB`);
        continue;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const storagePath = `${profile.organization_id}/${imovelId}/${Date.now()}_${safeName}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from('imovel-fotos')
        .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

      if (upErr) {
        errors.push(`${file.name}: ${upErr.message}`);
        continue;
      }

      const { data: pub } = supabase.storage.from('imovel-fotos').getPublicUrl(storagePath);
      maxOrdem++;
      const isPrincipal = !hasPrincipal && uploaded.length === 0;

      const { data: row, error: insErr } = await supabase
        .from('imovel_fotos')
        .insert({
          organization_id: profile.organization_id,
          imovel_id: imovelId,
          storage_path: storagePath,
          url_publica: pub?.publicUrl,
          ordem: maxOrdem,
          is_principal: isPrincipal,
          bytes: file.size,
          origem: 'upload',
        })
        .select('id')
        .single();

      if (insErr) {
        errors.push(`${file.name}: ${insErr.message}`);
        continue;
      }
      uploaded.push({ id: row.id, url: pub?.publicUrl ?? '', storage_path: storagePath });
    }

    revalidatePath(`/imoveis/${imovelId}`);
    return NextResponse.json({ uploaded, errors });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
