import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile?.organization_id) return NextResponse.json({ items: [] });

    const url = new URL(req.url);
    const intent = url.searchParams.get('intent');
    const ownership = url.searchParams.get('ownership');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

    let q = supabase.from('raw_intel').select('*').eq('organization_id', profile.organization_id).neq('status', 'arquivado').order('created_at', { ascending: false }).limit(limit);
    if (intent && intent !== 'all') q = q.eq('intent', intent);
    if (ownership) q = q.eq('ownership', ownership);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // counters
    const { data: counts } = await supabase.from('raw_intel').select('intent', { count: 'exact', head: false }).eq('organization_id', profile.organization_id).neq('status', 'arquivado');
    const summary = (counts || []).reduce((acc: Record<string, number>, r: any) => { acc[r.intent] = (acc[r.intent] || 0) + 1; return acc; }, {});

    return NextResponse.json({ items: data || [], summary });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
