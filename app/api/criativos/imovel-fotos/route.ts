/**
 * MKT-BIBLIOTECA Fatia 2 — GET /api/criativos/imovel-fotos?imovelId=…
 * Fotos do imóvel com URL assinado (1h) para o selector da aba Criar.
 * Reusa listFotosByImovelId (RLS valida a org; bucket privado).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { listFotosByImovelId } from '@/lib/imoveis';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const imovelId = request.nextUrl.searchParams.get('imovelId');
    if (!imovelId || !/^[0-9a-f-]{36}$/i.test(imovelId)) {
      return NextResponse.json({ error: 'imovelId inválido' }, { status: 400 });
    }

    const fotos = await listFotosByImovelId(imovelId);
    return NextResponse.json({
      fotos: fotos.map((f) => ({
        storage_path: f.storage_path,
        url: f.url_publica,
        is_principal: f.is_principal,
        caption: f.caption,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
