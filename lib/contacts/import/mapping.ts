/**
 * Sinónimos de cabeçalhos e auto-detect de mapeamento CSV→contacts.
 *
 * Extraído de app/api/contacts/import/route.ts para ser partilhado entre
 * /preview (sugestão) e /commit (aplicação). UI do wizard usa o resultado
 * como pré-selecção que o utilizador pode ajustar antes de confirmar.
 */

/** Campos lógicos suportados no mapeamento. */
export type ContactField =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'role'
  | 'company'
  | 'status'
  | 'stage'
  | 'notes';

export const CONTACT_FIELDS: ContactField[] = [
  'name',
  'firstName',
  'lastName',
  'email',
  'phone',
  'role',
  'company',
  'status',
  'stage',
  'notes',
];

/**
 * Labels pt-PT amigáveis para apresentar no wizard.
 */
export const CONTACT_FIELD_LABELS: Record<ContactField, string> = {
  name: 'Nome completo',
  firstName: 'Primeiro nome',
  lastName: 'Apelido',
  email: 'Email',
  phone: 'Telemóvel',
  role: 'Cargo / Função',
  company: 'Empresa',
  status: 'Estado',
  stage: 'Fase',
  notes: 'Observações',
};

/**
 * Sinónimos comuns em ficheiros de export (CRM, agenda, Excel manual).
 * Match é feito após `normalizeHeader` (lowercase + sem acentos + trim).
 */
export const HEADER_SYNONYMS: Record<ContactField, string[]> = {
  name: ['name', 'nome', 'nome completo', 'full name', 'contacto', 'contact'],
  firstName: ['first name', 'firstname', 'primeiro nome', 'nome proprio'],
  lastName: ['last name', 'lastname', 'apelido', 'sobrenome', 'ultimo nome'],
  email: ['email', 'e-mail', 'e-mail address', 'mail', 'correio'],
  phone: [
    'phone',
    'telefone',
    'telemovel',
    'telemóvel',
    'whatsapp',
    'fone',
    'movel',
    'movel pessoal',
    'contacto telefonico',
    'numero',
  ],
  role: ['role', 'cargo', 'titulo', 'title', 'funcao', 'função', 'funcao/cargo', 'profissao', 'profissão'],
  company: [
    'company',
    'empresa',
    'conta',
    'account',
    'organization',
    'organizacao',
    'organização',
    'firma',
  ],
  status: ['status', 'estado'],
  stage: ['stage', 'etapa', 'fase', 'lifecycle stage', 'ciclo de vida', 'pipeline stage'],
  notes: [
    'notes',
    'nota',
    'notas',
    'observacoes',
    'observações',
    'obs',
    'comentarios',
    'comentários',
    'descricao',
    'descrição',
  ],
};

/**
 * Normaliza um header CSV para comparação tolerante.
 * - lowercase
 * - trim
 * - strip de acentos (NFD + remover marcas)
 */
export function normalizeHeader(h: string): string {
  return (h || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Constrói um índice {ContactField → posição do header no array}.
 * Devolve `undefined` para campos não detectados.
 *
 * Usado pelo /commit para extrair valores das linhas e pelo /preview
 * para sugerir mapeamento inicial ao wizard.
 */
export function buildHeaderIndex(headers: string[]): Record<ContactField, number | undefined> {
  const idx = new Map<string, number>();
  headers.forEach((h, i) => idx.set(normalizeHeader(h), i));

  const find = (syns: string[]) => {
    for (const s of syns) {
      const key = normalizeHeader(s);
      const found = idx.get(key);
      if (found !== undefined) return found;
    }
    return undefined;
  };

  const out: Record<ContactField, number | undefined> = {
    name: find(HEADER_SYNONYMS.name),
    firstName: find(HEADER_SYNONYMS.firstName),
    lastName: find(HEADER_SYNONYMS.lastName),
    email: find(HEADER_SYNONYMS.email),
    phone: find(HEADER_SYNONYMS.phone),
    role: find(HEADER_SYNONYMS.role),
    company: find(HEADER_SYNONYMS.company),
    status: find(HEADER_SYNONYMS.status),
    stage: find(HEADER_SYNONYMS.stage),
    notes: find(HEADER_SYNONYMS.notes),
  };
  return out;
}

/**
 * Forma "wizard-friendly": para cada ContactField devolve o NOME do header CSV
 * detectado (ou null se nenhum). Útil para popular dropdowns na UI.
 */
export function suggestMapping(headers: string[]): Record<ContactField, string | null> {
  const idx = buildHeaderIndex(headers);
  const out = {} as Record<ContactField, string | null>;
  for (const f of CONTACT_FIELDS) {
    const i = idx[f];
    out[f] = i !== undefined ? headers[i] : null;
  }
  return out;
}

/** Normaliza valor de status livre → enum interno do CRM. */
export function normalizeStatus(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = normalizeHeader(v).toUpperCase();
  if (s === 'ACTIVE' || s === 'ATIVO' || s === 'ACTIVO') return 'ACTIVE';
  if (s === 'INACTIVE' || s === 'INATIVO' || s === 'INACTIVO') return 'INACTIVE';
  if (s === 'CHURNED' || s === 'PERDIDO' || s === 'CANCELADO') return 'CHURNED';
  return undefined;
}

/** Normaliza valor de stage livre → enum interno do CRM. */
export function normalizeStage(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const s = normalizeHeader(v).toUpperCase();
  if (s === 'LEAD') return 'LEAD';
  if (s === 'MQL') return 'MQL';
  if (s === 'PROSPECT' || s === 'OPORTUNIDADE') return 'PROSPECT';
  if (s === 'CUSTOMER' || s === 'CLIENTE') return 'CUSTOMER';
  if (s === 'OTHER' || s === 'OUTRO' || s === 'OUTROS') return 'OTHER';
  return undefined;
}
