// NS-3: gravar o custo por visita (combustível) da org. Usado no Custo & ROI por imóvel.
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) return NextResponse.json({ message: 'Sem organização' }, { status: 404 });

    const body = await request.json();
    const cents = Math.max(0, Math.round(Number(body.cents)));
    if (!Number.isFinite(cents)) return NextResponse.json({ message: 'Valor inválido' }, { status: 400 });

    const { error } = await supabase
      .from('organization_settings')
      .update({ default_visit_cost_cents: cents })
      .eq('organization_id', profile.organization_id);
    if (error) return NextResponse.json({ message: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, cents });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro';
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
