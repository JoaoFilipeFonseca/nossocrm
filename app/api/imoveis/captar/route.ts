import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAIKeysForUser } from '@/lib/ai/router';
import { extractImovelFromInput } from '@/lib/imoveis/captar';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const kind = body.kind === 'link' ? 'link' : 'text';
    const payload = typeof body.payload === 'string' ? body.payload.trim() : '';
    if (!payload) {
      return NextResponse.json({ message: 'Sem conteúdo para processar' }, { status: 400 });
    }

    const keys = await fetchAIKeysForUser(supabase, user.id);
    if (!keys.google && !keys.anthropic) {
      return NextResponse.json(
        { message: 'Sem chave de IA configurada. Configure em /settings/ai antes de usar captura automática.' },
        { status: 400 },
      );
    }

    const result = await extractImovelFromInput({ kind, payload }, keys);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
