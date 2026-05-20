import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAIKeysForUser } from '@/lib/ai/router';
import { extractImovelFromInput, extractImovelFromFile } from '@/lib/imoveis/captar';

const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const keys = await fetchAIKeysForUser(supabase, user.id);
    if (!keys.google && !keys.anthropic) {
      return NextResponse.json(
        { message: 'Sem chave de IA configurada. Configure em /settings/ai.' },
        { status: 400 },
      );
    }

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.startsWith('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      if (!file) return NextResponse.json({ message: 'Sem ficheiro' }, { status: 400 });
      if (file.size > MAX_BYTES) return NextResponse.json({ message: 'Ficheiro maior que 15MB' }, { status: 400 });

      const supportedMimes = new Set([
        'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif',
        'application/pdf',
      ]);
      if (!supportedMimes.has(file.type)) {
        return NextResponse.json({ message: `Tipo não suportado: ${file.type}` }, { status: 400 });
      }

      const arrayBuffer = await file.arrayBuffer();
      const result = await extractImovelFromFile(
        { data: arrayBuffer, mimeType: file.type, name: file.name },
        keys,
      );
      return NextResponse.json({
        draft: result.draft,
        modelUsed: result.modelUsed,
        sourceLength: file.size,
        via: file.type.startsWith('image/') ? 'imagem' : 'pdf',
      });
    }

    // JSON body — text or link
    const body = await request.json();
    const kind = body.kind === 'link' ? 'link' : 'text';
    const payload = typeof body.payload === 'string' ? body.payload.trim() : '';
    if (!payload) return NextResponse.json({ message: 'Sem conteúdo' }, { status: 400 });

    const result = await extractImovelFromInput({ kind, payload }, keys);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
