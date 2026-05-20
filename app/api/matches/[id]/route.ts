import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const STATUS_VALIDOS = ['novo', 'visto', 'contactado', 'ignorado'] as const;

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const status: string | undefined = body?.status;
    if (!status || !STATUS_VALIDOS.includes(status as typeof STATUS_VALIDOS[number])) {
      return NextResponse.json({ message: 'Status inválido' }, { status: 400 });
    }

    const { error } = await supabase.from('matches').update({ status }).eq('id', id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    revalidatePath('/matches');
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
