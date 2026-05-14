import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

// GHL pipeline -> Foco Imo board mapping
const PIPELINE_MAP: Record<string, string> = {
  'Calculadora': 'd08c7329-9e3e-43d1-ba42-6437a8363ae8', // Proprietários
  'Vendedores': 'd08c7329-9e3e-43d1-ba42-6437a8363ae8', // Proprietários
  'Comparadores': 'a70c40c7-5f9f-499b-9f39-f74cd9c596cf' // Compradores
};

// GHL stage name -> Foco Imo stage_id, by destination board
const STAGE_MAP_PROP: Record<string, string> = {
  'Nova Lead': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Preencheu': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Contactado': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Contactada': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Follow up': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Follow-Up': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Follow-up': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Reunião Marcada': '727eff0d-3cda-47a4-86a4-81283999d724',
  'Avaliação': 'c4a2f612-20b2-4244-a53a-1e9b6bc0c037',
  'Reunião Efetuada': 'c4a2f612-20b2-4244-a53a-1e9b6bc0c037',
  'CMI / Documentos / Fotógrafo': '1813bf77-6e54-4698-b0fb-b4513fda48ca',
  'Marketing': '519a3015-a7e1-4871-8b20-35f60a45d039',
  'Reunião/Visita': '11e9c5bb-fd75-4059-a828-3e6e4c17b1dc',
  'Proposta Enviada': '91745dae-0f88-4e16-8d71-ca57bd583c70',
  'Proposta Aceite': '91745dae-0f88-4e16-8d71-ca57bd583c70',
  'Proposta aceite': 'd5b3c87a-7604-45f4-a738-04cca3eebde2',
  'Escritura': 'dd2ad708-b124-4cfb-b171-1df71bf31541',
  'Pós Venda': '54749df5-9393-4bec-b171-f0bd698e1753',
  'Desclassificado': '727eff0d-3cda-47a4-86a4-81283999d724'
};

const STAGE_MAP_COMP: Record<string, string> = {
  'Nova Lead': 'a7a3fcbd-d852-4efc-bc73-808cf6c3ef8d',
  'Contactada / Não atendeu': 'a7a3fcbd-d852-4efc-bc73-808cf6c3ef8d',
  'Follow-up': 'a7a3fcbd-d852-4efc-bc73-808cf6c3ef8d',
  'Qualificação': 'fa78fe9a-31a3-4fbd-b994-5c7e54ea88c5',
  'Análise de Crédito': 'fa78fe9a-31a3-4fbd-b994-5c7e54ea88c5',
  'Pesquisa': '9a95ef47-2761-4a89-a8e5-afa3bddc1ff0',
  'Visita Agendada': 'd47be321-96ff-44c3-90b9-cd0f562f31b0',
  'Visita': 'd47be321-96ff-44c3-90b9-cd0f562f31b0',
  'Proposta Formalisada': '9f1bafc9-16f8-4ba9-ae3b-d08e244110b5',
  'Proposta Aceite': '764d2202-827a-4ebb-843b-1f8609da7c0f',
  'CPCV': '94a9c95f-dbea-40a3-9ed1-c6e01e0bc465',
  'Escritura': '515771e8-8a31-40cf-bf17-d350580cb443',
  'Pós Venda': '4ad1321a-a2c3-45fe-a4f6-de5d65ab4941'
};

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

    // 1. Fetch GHL pipelines
    const pipR = await fetch('https://services.leadconnectorhq.com/opportunities/pipelines?locationId=' + locationId, { headers: { Authorization: 'Bearer ' + ghlToken, Version: '2021-07-28', Accept: 'application/json' }});
    const pipJ: any = await pipR.json();
    const pipelines = pipJ.pipelines || [];

    const summary: any = { pipelines: {}, contactsInserted: 0, dealsInserted: 0, errors: [] as string[] };
    const contactCache: Map<string, string> = new Map(); // GHL contactId -> Foco Imo contact UUID

    for (const pip of pipelines) {
      const targetBoard = PIPELINE_MAP[pip.name];
      if (!targetBoard) { summary.errors.push('No mapping for pipeline: ' + pip.name); continue; }
      const stageMapByBoard = targetBoard === 'd08c7329-9e3e-43d1-ba42-6437a8363ae8' ? STAGE_MAP_PROP : STAGE_MAP_COMP;
      const stageById: any = {};
      (pip.stages || []).forEach((s: any) => { stageById[s.id] = s.name; });

      // 2. Fetch all opportunities for this pipeline
      let opps: any[] = [];
      let nextPageUrl = 'https://services.leadconnectorhq.com/opportunities/search?location_id=' + locationId + '&pipeline_id=' + pip.id + '&limit=100';
      let page = 0;
      while (nextPageUrl && page < 10) {
        const r = await fetch(nextPageUrl, { headers: { Authorization: 'Bearer ' + ghlToken, Version: '2021-07-28', Accept: 'application/json' }});
        if (!r.ok) { summary.errors.push('opp page ' + page + ' ' + pip.name + ': ' + r.status); break; }
        const j: any = await r.json();
        opps = opps.concat(j.opportunities || []);
        if (j.opportunities && j.opportunities.length >= 100 && j.meta && j.meta.nextPageUrl) {
          nextPageUrl = j.meta.nextPageUrl;
          page++;
        } else { nextPageUrl = null as any; }
      }
      summary.pipelines[pip.name] = { fetched: opps.length, board: targetBoard };

      // 3. For each opp, fetch contact details + insert
      for (const opp of opps) {
        const contactGhlId = opp.contactId || (opp.contact && opp.contact.id);
        if (!contactGhlId) continue;

        let contactUuid = contactCache.get(contactGhlId);
        if (!contactUuid) {
          // Fetch full contact details
          const cR = await fetch('https://services.leadconnectorhq.com/contacts/' + contactGhlId, { headers: { Authorization: 'Bearer ' + ghlToken, Version: '2021-07-28', Accept: 'application/json' }});
          if (!cR.ok) { summary.errors.push('contact fetch ' + contactGhlId + ': ' + cR.status); continue; }
          const cJ: any = await cR.json();
          const c = cJ.contact || cJ;
          const fname = c.firstNameRaw || c.firstName || '';
          const lname = c.lastNameRaw || c.lastName || '';
          let name = (fname + ' ' + lname).trim();
          if (!name) name = c.contactName || c.email || c.phone || 'Sem nome';
          const notesLines: string[] = [];
          notesLines.push('Pipeline GHL: ' + pip.name);
          notesLines.push('Estágio GHL: ' + (stageById[opp.pipelineStageId] || 'desconhecido'));
          if (c.source) notesLines.push('Fonte: ' + c.source);
          if (Array.isArray(c.tags) && c.tags.length) notesLines.push('Tags GHL: ' + c.tags.join(', '));
          if (c.address1 || c.city) notesLines.push('Morada: ' + [c.address1, c.city, c.postalCode].filter(Boolean).join(', '));
          if (c.country) notesLines.push('País: ' + c.country);
          if (Array.isArray(c.customFields) && c.customFields.length) {
            const cfs = c.customFields.map((f: any) => (f.id || 'cf') + ': ' + (typeof f.value === 'string' ? f.value : JSON.stringify(f.value))).join(' | ');
            notesLines.push('Custom: ' + cfs.slice(0, 1500));
          }
          if (Array.isArray(c.attributions) && c.attributions.length) {
            const attrs = c.attributions.map((a: any) => a.utmSource || a.utmCampaign || a.medium).filter(Boolean).join(', ');
            if (attrs) notesLines.push('Attribution: ' + attrs);
          }
          notesLines.push('[GHL_ID: ' + c.id + ']');
          const contactRow = {
            organization_id: profile.organization_id,
            name: name.slice(0, 200),
            email: c.email || null,
            phone: c.phone || null,
            company_name: c.companyName || null,
            notes: notesLines.join('\n').slice(0, 5000),
            source: c.source || 'ghl_pipeline_' + pip.name,
            created_at: c.dateAdded || new Date().toISOString(),
            updated_at: c.dateUpdated || c.dateAdded || new Date().toISOString(),
            status: 'lead',
            stage: 'lead_new'
          };
          const { data: ins, error: insErr } = await (supabase as any).from('contacts').insert(contactRow).select('id').single();
          if (insErr) { summary.errors.push('insert contact: ' + insErr.message); continue; }
          contactUuid = ins.id;
          contactCache.set(contactGhlId, contactUuid);
          summary.contactsInserted++;
        }

        // 4. Insert deal in mapped board + stage
        const ghlStageName = stageById[opp.pipelineStageId] || 'Nova Lead';
        const stageId = stageMapByBoard[ghlStageName] || stageMapByBoard['Nova Lead'];
        const dealRow: any = {
          organization_id: profile.organization_id,
          title: (opp.name || 'Opp GHL') + ' [' + pip.name + ']',
          value: opp.monetaryValue || 0,
          status: opp.status === 'won' ? 'won' : opp.status === 'lost' ? 'lost' : 'open',
          is_won: opp.status === 'won',
          is_lost: opp.status === 'lost' || opp.status === 'abandoned',
          board_id: targetBoard,
          stage_id: stageId,
          contact_id: contactUuid,
          tags: opp.tags || [],
          custom_fields: { ghl_opp_id: opp.id, ghl_pipeline: pip.name, ghl_stage: ghlStageName, ghl_assigned_to: opp.assignedTo || null, ghl_source: opp.source || null },
          created_at: opp.createdAt || opp.dateAdded || new Date().toISOString(),
          updated_at: opp.updatedAt || opp.dateUpdated || new Date().toISOString()
        };
        const { error: dErr } = await (supabase as any).from('deals').insert(dealRow);
        if (dErr) summary.errors.push('insert deal: ' + dErr.message);
        else summary.dealsInserted++;
      }
    }

    return NextResponse.json(summary);
  } catch (e: any) {
    return NextResponse.json({ error: String((e && e.message) || e) }, { status: 500 });
  }
}
