/**
 * Brief 6 — Radar Maia. Resumo das 08:30 (email marca João Fonseca + Telegram).
 *
 * Conteúdo: novas entradas (por portal), medianas por freguesia (mercado activo),
 * FSBO novos criados no CRM, e sinais — reduções de preço (>5%) e "proprietários
 * cansados" (angariações de agência 90+ dias no mercado).
 */
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import type { CreatedFsbo } from './fsbo';
import type { IngestSummary } from './types';

type Admin = ReturnType<typeof createStaticAdminClient>;

const TEAL = '#0f766e';

interface ActiveRow {
  freguesia: string | null;
  price: number | null;
  advertiser_type: string;
  days_on_market: number | null;
  tipologia: string | null;
  url: string;
  portal: string;
}

export interface DigestData {
  date: string;
  newByPortal: Record<string, number>;
  totalNew: number;
  medians: Array<{ freguesia: string; n: number; median: number }>;
  fsbo: CreatedFsbo[];
  drops: IngestSummary['priceDrops'];
  tired: Array<{ freguesia: string | null; tipologia: string | null; price: number | null; days: number; url: string }>;
  totalActive: number;
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function eur(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${Math.round(n).toLocaleString('pt-PT')} €`;
}

function todayLisbon(): string {
  return new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());
}

export async function collectDigestData(
  admin: Admin,
  orgId: string,
  summary: IngestSummary,
  fsbo: CreatedFsbo[],
): Promise<DigestData> {
  const { data } = await admin
    .from('market_listings')
    .select('freguesia, price, advertiser_type, days_on_market, tipologia, url, portal')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('operation', 'venda');
  const rows = (data ?? []) as ActiveRow[];

  // Medianas por freguesia (n >= 3).
  const byF = new Map<string, number[]>();
  for (const r of rows) {
    if (!r.freguesia || r.price == null) continue;
    const arr = byF.get(r.freguesia) ?? [];
    arr.push(r.price);
    byF.set(r.freguesia, arr);
  }
  const medians = Array.from(byF.entries())
    .filter(([, ps]) => ps.length >= 3)
    .map(([freguesia, ps]) => ({ freguesia, n: ps.length, median: median(ps) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 12);

  // Proprietários cansados: agência 90+ dias no mercado.
  const tired = rows
    .filter((r) => r.advertiser_type === 'agencia' && (r.days_on_market ?? 0) >= 90)
    .sort((a, b) => (b.days_on_market ?? 0) - (a.days_on_market ?? 0))
    .slice(0, 10)
    .map((r) => ({ freguesia: r.freguesia, tipologia: r.tipologia, price: r.price, days: r.days_on_market ?? 0, url: r.url }));

  const newByPortal: Record<string, number> = {};
  for (const l of summary.newListings) newByPortal[l.portal] = (newByPortal[l.portal] ?? 0) + 1;

  return {
    date: todayLisbon(),
    newByPortal,
    totalNew: summary.inserted,
    medians,
    fsbo,
    drops: summary.priceDrops.filter((d) => d.dropPct >= 5),
    tired,
    totalActive: rows.length,
  };
}

/* ---------- render email ---------- */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDigestEmail(d: DigestData): { subject: string; html: string; text: string } {
  const subject = `Radar Maia · ${d.totalNew} novas · ${d.fsbo.length} FSBO · ${d.date}`;

  const portalLine = Object.entries(d.newByPortal).map(([p, n]) => `${n} ${p}`).join(' · ') || 'nenhuma';

  const medianRows = d.medians
    .map((m) => `<tr><td style="padding:4px 10px;border-bottom:1px solid #eee">${esc(m.freguesia)}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right">${eur(m.median)}</td><td style="padding:4px 10px;border-bottom:1px solid #eee;text-align:right;color:#888">${m.n}</td></tr>`)
    .join('');

  const fsboRows = d.fsbo.length
    ? d.fsbo
        .map(
          (f) =>
            `<li style="margin:6px 0">${esc(f.name)}${f.phone ? ` · <a href="tel:${esc(f.phone)}" style="color:${TEAL}">${esc(f.phone)}</a>` : ''}${f.tipologia ? ` · ${esc(f.tipologia)}` : ''}${f.freguesia ? ` · ${esc(f.freguesia)}` : ''}${f.price != null ? ` · ${eur(f.price)}` : ''} — <a href="${esc(f.url)}" style="color:${TEAL}">anúncio</a></li>`,
        )
        .join('')
    : '<li style="color:#888">Nenhum particular novo hoje.</li>';

  const dropRows = d.drops.length
    ? d.drops
        .map((s) => `<li style="margin:6px 0">${s.advertiserType === 'particular' ? 'Particular' : 'Agência'}${s.freguesia ? ` · ${esc(s.freguesia)}` : ''}${s.tipologia ? ` · ${esc(s.tipologia)}` : ''} — ${eur(s.oldPrice)} → <b>${eur(s.newPrice)}</b> (−${s.dropPct}%) · <a href="${esc(s.url)}" style="color:${TEAL}">anúncio</a></li>`)
        .join('')
    : '<li style="color:#888">Sem reduções detectadas (precisa de histórico de 2+ dias).</li>';

  const tiredRows = d.tired.length
    ? d.tired
        .map((t) => `<li style="margin:6px 0">${t.tipologia ? esc(t.tipologia) : 'Imóvel'}${t.freguesia ? ` · ${esc(t.freguesia)}` : ''}${t.price != null ? ` · ${eur(t.price)}` : ''} — <b>${t.days} dias</b> no mercado · <a href="${esc(t.url)}" style="color:${TEAL}">anúncio</a></li>`)
        .join('')
    : '<li style="color:#888">Nenhuma angariação de agência com 90+ dias detectada hoje.</li>';

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f6f7f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
  <div style="background:${TEAL};color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
    <div style="font-size:13px;opacity:.85;letter-spacing:.5px">RADAR MAIA · ${esc(d.date)}</div>
    <div style="font-size:22px;font-weight:700;margin-top:2px">${d.totalNew} novas entradas · ${d.fsbo.length} FSBO</div>
  </div>
  <div style="background:#fff;padding:20px 22px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
    <p style="margin:0 0 14px;font-size:15px">Bom dia, João. Nas últimas horas entraram <b>${d.totalNew}</b> imóveis no mercado da Maia (${esc(portalLine)}). Mercado activo em vigilância: <b>${d.totalActive}</b> anúncios.</p>

    <h3 style="font-size:14px;color:${TEAL};margin:18px 0 6px">Particulares novos (FSBO) — já no seu CRM</h3>
    <ul style="margin:0;padding-left:18px;font-size:14px">${fsboRows}</ul>

    <h3 style="font-size:14px;color:${TEAL};margin:18px 0 6px">Mediana de preço por freguesia</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr><th style="text-align:left;padding:4px 10px;color:#888;font-weight:600">Freguesia</th><th style="text-align:right;padding:4px 10px;color:#888;font-weight:600">Mediana</th><th style="text-align:right;padding:4px 10px;color:#888;font-weight:600">N</th></tr></thead>
      <tbody>${medianRows}</tbody>
    </table>

    <h3 style="font-size:14px;color:${TEAL};margin:18px 0 6px">Sinais — reduções de preço</h3>
    <ul style="margin:0;padding-left:18px;font-size:14px">${dropRows}</ul>

    <h3 style="font-size:14px;color:${TEAL};margin:18px 0 6px">Proprietários cansados — angariações de agência 90+ dias</h3>
    <ul style="margin:0;padding-left:18px;font-size:14px">${tiredRows}</ul>

    <p style="margin:20px 0 0;font-size:12px;color:#999">Radar Maia · recolha automática dos portais · João Fonseca · Consultor Imobiliário · Maia</p>
  </div>
</div>
</body></html>`;

  const textLines = [
    `RADAR MAIA — ${d.date}`,
    `${d.totalNew} novas entradas (${portalLine}) · ${d.totalActive} anúncios em vigilância`,
    ``,
    `PARTICULARES NOVOS (FSBO) no CRM:`,
    ...(d.fsbo.length ? d.fsbo.map((f) => `- ${f.name}${f.phone ? ` ${f.phone}` : ''}${f.tipologia ? ` ${f.tipologia}` : ''}${f.freguesia ? ` ${f.freguesia}` : ''}${f.price != null ? ` ${eur(f.price)}` : ''} ${f.url}`) : ['- nenhum']),
    ``,
    `MEDIANA POR FREGUESIA:`,
    ...d.medians.map((m) => `- ${m.freguesia}: ${eur(m.median)} (n=${m.n})`),
    ``,
    `REDUÇÕES: ${d.drops.length}`,
    `ANGARIAÇÕES PARADAS 90+ DIAS: ${d.tired.length}`,
  ];

  return { subject, html, text: textLines.join('\n') };
}

/* ---------- render Telegram ---------- */

export function renderDigestTelegram(d: DigestData): string {
  const esc2 = (s: string) => esc(s);
  const lines: string[] = [];
  lines.push(`🛰️ <b>Radar Maia</b> · ${esc2(d.date)}`);
  lines.push(`${d.totalNew} novas · ${d.totalActive} em vigilância`);
  if (d.fsbo.length) {
    lines.push('');
    lines.push(`<b>FSBO novos (${d.fsbo.length}):</b>`);
    for (const f of d.fsbo.slice(0, 6)) {
      lines.push(`• ${esc2(f.name)}${f.phone ? ` ${esc2(f.phone)}` : ''}${f.freguesia ? ` · ${esc2(f.freguesia)}` : ''}${f.price != null ? ` · ${eur(f.price)}` : ''}`);
    }
    if (d.fsbo.length > 6) lines.push(`… e mais ${d.fsbo.length - 6}`);
  }
  if (d.drops.length) lines.push(`\n📉 ${d.drops.length} reduções de preço`);
  if (d.tired.length) lines.push(`😴 ${d.tired.length} angariações paradas 90+ dias`);
  return lines.join('\n');
}
