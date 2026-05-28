// Sprint 15 c1: dump JSON semanal por organização.
// Lê tabelas críticas via service role e faz upload para o bucket privado
// `backups/{org_id}/{YYYY-WW}.json`. Retenção: 12 ficheiros mais recentes
// por organização.
//
// Auth: header X-Cron-Secret tem de bater com o segredo do vault
// `backup_cron_secret`. NÃO usa JWT — chamada vem do pg_cron.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadAutomationParams } from '../_shared/automation-params.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TABLES = [
  'organizations',
  'profiles',
  'organization_settings',
  'contacts',
  'deals',
  'deal_activities',
  'activities',
  'boards',
  'board_stages',
  'lifecycle_stages',
  'lead_eventos',
  'org_revenue_goals',
  'ai_brand_kits',
  'creative_archive',
  'call_recordings',
  'voice_captures',
  'matches',
  'raw_intel',
  'imoveis',
];

const DEFAULTS = { retention: 12 };

function isoWeekTag(d: Date = new Date()): string {
  const dt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get('X-Cron-Secret') || '';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret } = await supabase.rpc('get_backup_cron_secret');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
  }

  const params = await loadAutomationParams(supabase, 'backup-weekly', DEFAULTS);
  const retention = Math.max(1, Math.floor(Number(params.retention) || DEFAULTS.retention));

  const weekTag = isoWeekTag();
  const startedAt = new Date().toISOString();

  const { data: orgs, error: orgsErr } = await supabase
    .from('organizations')
    .select('id, name');

  if (orgsErr || !orgs) {
    return new Response(JSON.stringify({ error: orgsErr?.message || 'no orgs' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const report: Array<{ org_id: string; ok: boolean; path?: string; bytes?: number; tables?: number; error?: string; cleaned?: number }> = [];

  for (const org of orgs) {
    try {
      const dump: Record<string, unknown[]> = {};
      let bytes = 0;
      let tableCount = 0;

      for (const table of TABLES) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('organization_id', org.id);
          if (error) continue;
          dump[table] = data ?? [];
          tableCount++;
        } catch {
          // continue
        }
      }

      const payload = {
        org_id: org.id,
        org_name: org.name,
        week: weekTag,
        generated_at: startedAt,
        tables_dumped: tableCount,
        tables: dump,
      };

      const json = JSON.stringify(payload);
      bytes = new Blob([json]).size;

      const path = `${org.id}/${weekTag}.json`;
      const { error: uploadErr } = await supabase.storage
        .from('backups')
        .upload(path, new Blob([json], { type: 'application/json' }), { upsert: true });

      if (uploadErr) {
        report.push({ org_id: org.id, ok: false, error: uploadErr.message });
        continue;
      }

      let cleaned = 0;
      const { data: files } = await supabase.storage.from('backups').list(org.id, {
        limit: 100,
        sortBy: { column: 'name', order: 'desc' },
      });
      if (files && files.length > retention) {
        const toDelete = files.slice(retention).map((f) => `${org.id}/${f.name}`);
        const { error: delErr } = await supabase.storage.from('backups').remove(toDelete);
        if (!delErr) cleaned = toDelete.length;
      }

      report.push({ org_id: org.id, ok: true, path, bytes, tables: tableCount, cleaned });
    } catch (e) {
      report.push({ org_id: org.id, ok: false, error: (e as Error).message });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      week: weekTag,
      generated_at: startedAt,
      orgs: orgs.length,
      report,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
});
