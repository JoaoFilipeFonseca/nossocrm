// BRIEF 2 — Power List. Email da manhã (marca João Fonseca), UTF-8, sem mojibake.
// Destinatário: o próprio João (email interno de trabalho, não é marketing —
// por isso NÃO leva rodapé de anular subscrição).

import type { NumeroDoDia, PowerListItem, Semaphore } from './types';

const ACCENT = '#0f766e'; // teal sóbrio
const INK = '#0f172a';
const MUTED = '#64748b';
const LINE = '#e2e8f0';

const SEM: Record<Semaphore, { color: string; label: string; dot: string }> = {
  green: { color: '#16a34a', label: 'No bom caminho', dot: '🟢' },
  amber: { color: '#d97706', label: 'A meio da meta', dot: '🟡' },
  red: { color: '#dc2626', label: 'Abaixo do ritmo', dot: '🔴' },
};

const BUCKET_LABEL: Record<string, string> = {
  lead_nova: 'Lead nova',
  followup: 'Seguimento',
  reactivacao: 'Reactivação',
};

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Telefone só com dígitos e + para o href tel:. */
function telHref(phone: string | null): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned ? `tel:${cleaned}` : '';
}

function lisbonDateLabel(): string {
  return new Intl.DateTimeFormat('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export interface RenderInput {
  items: PowerListItem[];
  numeroDoDia: NumeroDoDia;
  appUrl: string;
}

export function renderPowerListEmail(input: RenderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const { items, numeroDoDia, appUrl } = input;
  const dateLabel = lisbonDateLabel();
  const hojeUrl = `${appUrl}/hoje`;
  const sem = SEM[numeroDoDia.semaphore];
  const subject = `A sua Power List de hoje — ${items.length} contactos para ligar`;

  // ---- HTML ----
  const rows = items
    .map((it, i) => {
      const tel = telHref(it.phone);
      const phoneCell = it.phone
        ? tel
          ? `<a href="${tel}" style="color:${ACCENT};text-decoration:none;font-weight:600;">${esc(it.phone)}</a>`
          : esc(it.phone)
        : '<span style="color:#94a3b8;">sem telefone</span>';
      const meta = [BUCKET_LABEL[it.bucket] || it.bucket, it.boardName, it.source]
        .filter(Boolean)
        .map((m) => esc(String(m)))
        .join(' · ');
      const dealUrl = `${appUrl}/deals/${it.dealId}`;
      return `
      <tr>
        <td style="padding:16px 0;border-bottom:1px solid ${LINE};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;color:${INK};padding-bottom:2px;">
                ${i + 1}. ${esc(it.contactName)}
              </td>
              <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:15px;white-space:nowrap;padding-left:12px;">
                ${phoneCell}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};padding-bottom:8px;">
                ${meta}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#334155;line-height:1.5;padding-bottom:8px;">
                ${esc(it.reason)}
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding:2px 0 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-left:3px solid ${ACCENT};padding:6px 0 6px 12px;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-style:italic;color:${INK};line-height:1.5;">
                      ${esc(it.openingLine)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;">
                <a href="${dealUrl}" style="color:${MUTED};text-decoration:underline;">Abrir negócio no CRM</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(15,23,42,0.08);">
          <!-- Cabeçalho -->
          <tr>
            <td style="background:${INK};padding:28px 28px 22px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">João Fonseca</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;margin-top:2px;">Consultor Imobiliário · Maia</div>
            </td>
          </tr>
          <!-- Título -->
          <tr>
            <td style="padding:26px 28px 0;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:${INK};font-weight:700;">A sua Power List de hoje</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${MUTED};margin-top:4px;text-transform:capitalize;">${esc(dateLabel)}</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#334155;margin-top:12px;line-height:1.55;">
                ${items.length} ${items.length === 1 ? 'contacto' : 'contactos'} para ligar, por ordem de prioridade. Sem abrir o CRM.
              </div>
            </td>
          </tr>
          <!-- Número do dia -->
          <tr>
            <td style="padding:18px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${LINE};border-radius:10px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:${MUTED};text-transform:uppercase;letter-spacing:1px;">O número do dia</div>
                    <div style="font-family:Georgia,'Times New Roman',serif;font-size:17px;color:${INK};font-weight:700;margin-top:4px;">
                      ${sem.dot} ${numeroDoDia.conversasSemana} de ${numeroDoDia.meta} conversas esta semana
                    </div>
                    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${sem.color};font-weight:600;margin-top:2px;">${sem.label}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Lista -->
          <tr>
            <td style="padding:8px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${rows}
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:22px 28px 6px;" align="center">
              <a href="${hojeUrl}" style="display:inline-block;background:${ACCENT};color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 26px;border-radius:8px;">Abrir a lista no CRM</a>
            </td>
          </tr>
          <!-- Rodapé -->
          <tr>
            <td style="padding:18px 28px 28px;">
              <div style="border-top:1px solid ${LINE};padding-top:14px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${MUTED};line-height:1.6;">
                Marque cada chamada com o botão "Liguei" na página Hoje. Assim a lista de amanhã já vem limpa e o seu número do dia sobe.
                <br>Estou do seu lado. Bom trabalho.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // ---- Texto (fallback plain) ----
  const textLines: string[] = [
    'A SUA POWER LIST DE HOJE',
    dateLabel,
    '',
    `O número do dia: ${numeroDoDia.conversasSemana} de ${numeroDoDia.meta} conversas esta semana (${sem.label}).`,
    '',
    `${items.length} contactos para ligar, por ordem de prioridade:`,
    '',
  ];
  items.forEach((it, i) => {
    const meta = [BUCKET_LABEL[it.bucket] || it.bucket, it.boardName, it.source].filter(Boolean).join(' · ');
    textLines.push(`${i + 1}. ${it.contactName} — ${it.phone || 'sem telefone'}`);
    textLines.push(`   ${meta}`);
    textLines.push(`   ${it.reason}`);
    textLines.push(`   Primeira frase: ${it.openingLine}`);
    textLines.push('');
  });
  textLines.push(`Abrir a lista: ${hojeUrl}`);
  textLines.push('Estou do seu lado. Bom trabalho.');

  return { subject, html, text: textLines.join('\n') };
}
