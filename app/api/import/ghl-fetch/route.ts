import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const userResp = await supabase.auth.getUser();
    const user = userResp.data.user;
    if (!user) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).single();
    if (!profile || !profile.organization_id) return NextResponse.json({ error: 'no_organization' }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const ghlToken = String(body.ghlToken || '');
    const locationId = String(body.locationId || '');
    if (!ghlToken || !locationId) return NextResponse.json({ error: 'missing_token_or_location' }, { status: 400 });

    // Fetch all contacts from GHL via pagination
    let all: any[] = [];
    let startAfter: any = null, startAfterId: any = null;
    let pages = 0;
    while (pages < 30) {
      let url = 'https://services.leadconnectorhq.com/contacts/?locationId=' + locationId + '&limit=100';
      if (startAfter && startAfterId) url += '&startAfter=' + startAfter + '&startAfterId=' + startAfterId;
      const r = await fetch(url, { headers: { Authorization: 'Bearer ' + ghlToken, Version: '2021-07-28', Accept: 'application/json' }});
      if (!r.ok) return NextResponse.json({ error: 'ghl_fetch_failed', page: pages, status: r.status }, { status: 500 });
      const j: any = await r.json();
      const contacts = j.contacts || [];
      all = all.concat(contacts);
      pages++;
      if (contacts.length < 100 || !j.meta || !j.meta.nextPage) break;
      startAfter = j.meta.startAfter;
      startAfterId = j.meta.startAfterId;
    }

    // Map to Foco Imo schema
    const rows = all.map((c: any) => {
      const fname = c.firstNameRaw || c.firstName || '';
      const lname = c.lastNameRaw || c.lastName || '';
      let name = (fname + ' ' + lname).trim();
      if (!name) name = c.contactName || c.email || c.phone || 'Sem nome';
      const notesLines: string[] = [];
      if (c.source) notesLines.push('Fonte: ' + c.source);
      if (Array.isArray(c.tags) && c.tags.length) notesLines.push('Tags GHL: ' + c.tags.join(', '));
      if (c.companyName) notesLines.push('Empresa: ' + c.companyName);
      if (c.address1 || c.city) notesLines.push('Morada: ' + [c.address1, c.city, c.postalCode].filter(Boolean).join(', '));
      if (c.country) notesLines.push('País: ' + c.country);
      if (Array.isArray(c.customFields) && c.customFields.length) {
        const cfs = c.customFields.map((f: any) => (f.id || 'cf') + ': ' + (typeof f.value === 'string' ? f.value : JSON.stringify(f.value))).join(' | ');
        notesLines.push('Custom: ' + cfs.slice(0, 800));
      }
      if (Array.isArray(c.attributions) && c.attributions.length) {
        const attrs = c.attributions.map((a: any) => a.utmSource || a.utmCampaign).filter(Boolean).join(', ');
        if (attrs) notesLines.push('Attribution: ' + attrs);
      }
      notesLines.push('[GHL_ID: ' + c.id + ']');
      return {
        organization_id: profile.organization_id,
        name: name.slice(0, 200),
        email: c.email || null,
        phone: c.phone || null,
        company_name: c.companyName || null,
        notes: notesLines.join('\n').slice(0, 5000),
        source: c.source || 'ghl_import',
        created_at: c.dateAdded || new Date().toISOString(),
        updated_at: c.dateUpdated || c.dateAdded || new Date().toISOString(),
        status: 'lead',
        stage: 'LEAD'
      };
    });

    // Bulk insert in batches of 250
    const batchSize = 250;
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += batchSize) {
      const chunk = rows.slice(i, i + batchSize);
      const { data, error } = await (supabase as any).from('contacts').insert(chunk).select('id');
      if (error) errors.push('batch ' + i + ': ' + error.message);
      else inserted += (data || []).length;
    }

    return NextResponse.json({ totalFetched: all.length, inserted, pages, errors });
  } catch (e: any) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
