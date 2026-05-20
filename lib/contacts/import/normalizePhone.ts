/**
 * Normalização de telemóveis/telefones portugueses para uso no import.
 *
 * Aceita variadíssimos formatos comuns em exports antigos (Excel, GHL, agendas):
 *  - "+351 912 345 678"
 *  - "00351 912345678"
 *  - "912 345 678"
 *  - "912345678"
 *  - "+351912345678"
 *  - "(351) 912-345-678"
 *  - "912.345.678"
 *
 * Devolve sempre o número em formato E.164 (+3519XXXXXXXX) quando válido,
 * para tornar dedup determinístico independentemente do formato de entrada.
 */

export type NormalizedPhone = {
  /** Formato E.164 sem espaços (ex: "+351912345678"). Null se inválido. */
  e164: string | null;
  /** Só dígitos nacionais (9 dígitos) sem prefixo. Null se inválido. */
  national: string | null;
  /** Formato display PT (ex: "912 345 678"). Null se inválido. */
  display: string | null;
  /** true se o número parece um móvel PT (9 dígitos a começar por 9). */
  isMobile: boolean;
  /** true se o número parece um fixo PT (9 dígitos a começar por 2). */
  isLandline: boolean;
  /** true se o número é válido como número PT. */
  valid: boolean;
  /** Input original, trimmed. */
  raw: string;
};

const EMPTY: Omit<NormalizedPhone, 'raw'> = {
  e164: null,
  national: null,
  display: null,
  isMobile: false,
  isLandline: false,
  valid: false,
};

/**
 * Normaliza um número de telefone PT.
 *
 * Estratégia:
 *  1. Trim + strip de tudo que não é dígito ou '+'
 *  2. Remove prefixos internacionais comuns (+351, 00351, 351 quando aplicável)
 *  3. Valida 9 dígitos PT começando por 9 (móvel) ou 2 (fixo)
 *  4. Devolve forma E.164 canónica
 */
export function normalizePhonePT(raw: string | null | undefined): NormalizedPhone {
  const input = String(raw ?? '').trim();
  if (!input) return { ...EMPTY, raw: input };

  // Strip tudo excepto dígitos e o primeiro '+'
  let cleaned = input.replace(/[^\d+]/g, '');
  // Apenas o primeiro '+' conta
  cleaned = cleaned.replace(/(?!^)\+/g, '');

  // Remover prefixos internacionais
  if (cleaned.startsWith('+351')) cleaned = cleaned.slice(4);
  else if (cleaned.startsWith('00351')) cleaned = cleaned.slice(5);
  else if (cleaned.startsWith('351') && cleaned.length === 12) cleaned = cleaned.slice(3);
  else if (cleaned.startsWith('+')) {
    // Outro país (+55, +34, etc.) — não validamos como PT, devolvemos como display
    return {
      ...EMPTY,
      raw: input,
      e164: cleaned, // mantém +XX para podermos guardar
      display: input,
      valid: false,
    };
  }

  // Após strip de prefixo, esperamos 9 dígitos PT
  if (!/^\d{9}$/.test(cleaned)) {
    return { ...EMPTY, raw: input };
  }

  const first = cleaned[0];
  const isMobile = first === '9';
  const isLandline = first === '2';

  if (!isMobile && !isLandline) {
    // Pode ser número especial (800, 707, etc.) — guardamos mas marcamos inválido para dedup
    return {
      ...EMPTY,
      raw: input,
      national: cleaned,
      e164: `+351${cleaned}`,
      display: `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`,
      valid: false,
    };
  }

  return {
    raw: input,
    e164: `+351${cleaned}`,
    national: cleaned,
    display: `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`,
    isMobile,
    isLandline,
    valid: true,
  };
}

/**
 * Helper rápido: extrai a forma E.164 de um número PT, ou null se não normalizar.
 * Útil para construir chaves de dedup.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  const n = normalizePhonePT(raw);
  return n.valid ? n.e164 : null;
}
