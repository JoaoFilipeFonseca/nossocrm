import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const userResp = await supabase.auth.getUser();
    const user = userResp.data.user;
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile || !profile.organization_id) return NextResponse.json({ error: 'no_organization' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];
    if (contacts.length === 0) return NextResponse.json({ error: 'no_contacts' }, { status: 400 });

    // force organization_id from session — never trust body
    const rows = contacts.map((c: any) => ({
      organization_id: profile.organization_id,
      name: String(c.name || '').slice(0, 200) || 'Sem nome',
      email: c.email || null,
      phone: c.phone || null,
      company_name: c.company_name || null,
      notes: c.notes || null,
      source: c.source || 'import',
      created_at: c.created_at || new Date().toISOString(),
      updated_at: c.updated_at || new Date().toISOString(),
      status: c.status || 'lead',
      stage: c.stage || 'LEAD'
    }));

    // batch insert in chunks of 250
    const batchSize = 250;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const { data, error } = await (supabase as any).from('contacts').insert(chunk).select('id');
      if (error) errors.push('batch ' + i + ': ' + error.message);
      else inserted += (data || []).length;
    }

    return NextResponse.json({ inserted, total: rows.length, errors });
  } catch (e: any) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
