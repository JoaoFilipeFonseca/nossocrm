/**
 * emailCompliance — rodapé RGPD e tokens de anular subscrição (MKT-SEQUENCES Fatia 1).
 *
 * Todos os emails enviados por automações levam um rodapé com:
 *   - link de anular subscrição (token HMAC assinado com o secret do Vault
 *     'email_unsubscribe_secret', validado por /api/email/unsubscribe);
 *   - link da política de privacidade (organization_settings.privacy_policy_url,
 *     com fallback para a do João).
 *
 * ⚠️ O átomo action.send_email da edge function automation-execute (Deno) tem
 * uma CÓPIA INLINE desta lógica (Deno não importa de lib/). Mexer aqui = mexer lá.
 * Usa só Web Crypto (crypto.subtle) para os dois runtimes ficarem idênticos.
 */

export const DEFAULT_PRIVACY_POLICY_URL = 'https://joaofilipefonseca.pt/privacidade';

/**
 * Escapa wildcards de LIKE/ILIKE (`%` e `_`) para procurar emails por valor
 * exacto case-insensitive — emails com underscore são comuns.
 */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** Token HMAC-SHA256 (hex) sobre `${orgId}:${email minúsculo}`. */
export async function unsubscribeToken(orgId: string, email: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${orgId}:${email.trim().toLowerCase()}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildUnsubscribeUrl(appBaseUrl: string, orgId: string, email: string, token: string): string {
  const url = new URL('/unsubscribe', appBaseUrl);
  url.searchParams.set('o', orgId);
  url.searchParams.set('e', email.trim().toLowerCase());
  url.searchParams.set('t', token);
  return url.toString();
}

export interface ComplianceFooterInput {
  text: string;
  html?: string;
  senderName: string;
  unsubscribeUrl: string | null;
  privacyPolicyUrl: string;
}

/** Acrescenta o rodapé RGPD ao corpo text (sempre) e html (se existir). */
export function appendComplianceFooter(input: ComplianceFooterInput): { text: string; html?: string } {
  const { senderName, unsubscribeUrl, privacyPolicyUrl } = input;
  const reason = `Recebeu este email porque partilhou o seu contacto com ${senderName}.`;

  const textLines = ['', '', '____________________', '', reason];
  if (unsubscribeUrl) textLines.push(`Anular subscrição: ${unsubscribeUrl}`);
  textLines.push(`Política de privacidade: ${privacyPolicyUrl}`);
  const text = `${input.text}${textLines.join('\n')}`;

  let html: string | undefined;
  if (input.html) {
    const links = [
      unsubscribeUrl
        ? `<a href="${unsubscribeUrl}" style="color:#64748b;text-decoration:underline;">Anular subscrição</a>`
        : null,
      `<a href="${privacyPolicyUrl}" style="color:#64748b;text-decoration:underline;">Política de privacidade</a>`,
    ].filter(Boolean).join(' &nbsp;·&nbsp; ');
    const footer =
      `<div style="margin-top:28px;padding-top:14px;border-top:1px solid #e2e8f0;` +
      `font-size:12px;line-height:1.6;color:#64748b;font-family:Arial,Helvetica,sans-serif;">` +
      `<p style="margin:0 0 6px;">${reason}</p>` +
      `<p style="margin:0;">${links}</p>` +
      `</div>`;
    html = `${input.html}${footer}`;
  }

  return { text, html };
}
