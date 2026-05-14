/**
 * @fileoverview DefiniÃ§Ãµes de Tipos do CRM
 * 
 * Arquivo central de tipos TypeScript para o sistema Foco Imo.
 * ContÃ©m interfaces para todas as entidades do domÃ­nio.
 * 
 * @module types
 * 
 * Sistema SINGLE-TENANT (migrado em 2025-12-07)
 * 
 * @example
 * ```tsx
 * import { Deal, DealView, Contact, Board } from '@/types';
 * 
 * const deal: Deal = {
 *   title: 'Meu deal',
 *   value: 1000,
 *   // ...
 * };
 * ```
 */

/**
 * @deprecated Use deal.isWon e deal.isLost para verificar status final.
 * O estÃ¡gio atual Ã© deal.status (UUID do stage no board).
 * Mantido apenas para compatibilidade de cÃ³digo legado.
 */
export enum DealStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

// =============================================================================
// TYPE ALIASES (LEGACY - MANTIDOS PARA COMPATIBILIDADE)
// =============================================================================

/**
 * @deprecated Sistema migrado para single-tenant.
 * Mantido apenas para compatibilidade de cÃ³digo legado.
 * Campos organization_id sÃ£o opcionais e ignorados.
 */
export type OrganizationId = string;

/**
 * Client Company ID - UUID de empresa CLIENTE cadastrada no CRM
 * 
 * @description
 * Este ID representa uma empresa que Ã© cliente/prospect do usuÃ¡rio do CRM.
 * Ã um relacionamento comercial, nÃ£o relacionado a seguranÃ§a.
 * 
 * @origin Selecionado pelo usuÃ¡rio em dropdowns/formulÃ¡rios
 * @optional Pode ser null (contatos podem nÃ£o ter empresa)
 * 
 * @example
 * ```ts
 * // â Correto: client_company_id vem de seleÃ§Ã£o do usuÃ¡rio
 * const deal = { 
 *   organization_id: organizationId,     // Do auth (seguranÃ§a)
 *   client_company_id: selectedCompany,  // Do form (opcional)
 * };
 * ```
 */
export type ClientCompanyId = string;

// =============================================================================
// Core Types
// =============================================================================

// EstÃ¡gio do Ciclo de Vida (DinÃ¢mico)
export interface LifecycleStage {
  id: string;
  name: string;
  color: string; // Tailwind class or hex
  order: number;
  isDefault?: boolean; // Cannot be deleted
}

// EstÃ¡gio do Contato no Funil de Carteira
// @deprecated - Use LifecycleStage IDs (strings)
export enum ContactStage {
  LEAD = 'LEAD', // Suspeito - ainda nÃ£o qualificado
  MQL = 'MQL', // Marketing Qualified Lead
  PROSPECT = 'PROSPECT', // Em negociaÃ§Ã£o ativa
  CUSTOMER = 'CUSTOMER', // Cliente fechado
}

// @deprecated - Use Contact com stage: ContactStage.LEAD
// Mantido apenas para compatibilidade de migraÃ§Ã£o
export interface Lead {
  id: string;
  name: string; // Nome da pessoa
  email: string;
  companyName: string; // Texto solto, ainda nÃ£o Ã© uma Company
  role?: string;
  source: 'WEBSITE' | 'LINKEDIN' | 'REFERRAL' | 'MANUAL';
  status: 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'DISQUALIFIED';
  createdAt: string;
  notes?: string;
}

// =============================================================================
// Organization (Tenant - who pays for SaaS)
// =============================================================================

/**
 * Organization - The SaaS tenant (company paying for the service)
 * Previously named "Company" - renamed to avoid confusion with CRM client companies
 */
export interface Organization {
  id: OrganizationId;
  name: string;
  industry?: string;
  website?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * @deprecated Use Organization instead
 * Kept for backwards compatibility during migration
 */
export type Company = Organization;

// =============================================================================
// CRM Company (Client company in the CRM)
// =============================================================================

/**
 * CRMCompany - A client company record in the CRM
 * This is a company that the user is selling to/managing
 */
export interface CRMCompany {
  id: ClientCompanyId;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  name: string;
  industry?: string;
  website?: string;
  createdAt: string;
  updatedAt?: string;
}

// =============================================================================
// Contact (Person we talk to)
// =============================================================================

// A Pessoa (Com quem falamos)
export interface Contact {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  clientCompanyId?: ClientCompanyId; // CRM company this contact belongs to
  name: string;
  role?: string;
  email: string;
  phone: string;
  avatar?: string;
  lastInteraction?: string;
  birthDate?: string; // New field for Agentic AI tasks
  status: 'ACTIVE' | 'INACTIVE' | 'CHURNED';
  stage: string; // ID do LifecycleStage (antes era ContactStage enum)
  source?: 'WEBSITE' | 'LINKEDIN' | 'REFERRAL' | 'MANUAL'; // Origem do contato
  notes?: string; // AnotaÃ§Ãµes gerais
  lastPurchaseDate?: string;
  totalValue?: number; // LTV
  createdAt: string;
  updatedAt?: string; // Ãltima modificaÃ§Ã£o do registro

  // @deprecated - Use clientCompanyId instead
  companyId?: string;

  /** Quando true, o agente de IA nÃ£o responde a este contato em nenhum canal. */
  aiPaused?: boolean;
}

// ITEM 3: Produtos e ServiÃ§os
export interface Product {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  name: string;
  description?: string;
  price: number;
  sku?: string;
  /** Se estÃ¡ ativo no catÃ¡logo (itens inativos nÃ£o devem aparecer no dropdown do deal). */
  active?: boolean;
}

export interface DealItem {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  productId: string;
  name: string; // Snapshot of name
  quantity: number;
  price: number; // Snapshot of price
}

// CUSTOM FIELDS DEFINITION
export type CustomFieldType = 'text' | 'number' | 'date' | 'select';

export interface CustomFieldDefinition {
  id: string;
  key: string; // camelCase identifier
  label: string;
  type: CustomFieldType;
  options?: string[]; // For select type
}

// O Dinheiro/Oportunidade (O que vai no Kanban)
export interface Deal {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  clientCompanyId?: ClientCompanyId; // CRM company FK
  title: string; // Ex: "LicenÃ§a Anual"
  contactId: string; // Relacionamento
  boardId: string; // Qual board este deal pertence
  value: number;
  items: DealItem[]; // Lista de Produtos
  status: string; // Stage ID dentro do board (UUID)
  isWon: boolean; // Deal foi ganho?
  isLost: boolean; // Deal foi perdido?
  closedAt?: string; // Quando foi fechado
  createdAt: string;
  updatedAt: string;
  probability: number;
  priority: 'low' | 'medium' | 'high';
  owner: {
    name: string;
    avatar: string;
  };
  ownerId?: string; // ID do usuÃ¡rio responsÃ¡vel
  nextActivity?: {
    type: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK';
    date: string;
    isOverdue?: boolean;
  };
  tags: string[];
  aiSummary?: string;
  customFields?: Record<string, any>; // Dynamic fields storage
  lastStageChangeDate?: string; // For stagnation tracking
  lossReason?: string; // For win/loss analysis
  aiExtracted?: Record<string, any>; // AI-extracted BANT fields (zero config)

  // @deprecated - Use clientCompanyId instead
  companyId?: string;
}

// Helper Type para VisualizaÃ§Ã£o (Desnormalizado)
export interface DealView extends Deal {
  clientCompanyName?: string; // Name of the CRM client company
  contactName: string;
  contactEmail: string;
  /** Nome/label do estÃ¡gio atual (resolvido a partir do status UUID) */
  stageLabel: string;

  // @deprecated - Use clientCompanyName instead
  companyName?: string;
}

export interface Activity {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional during migration
  dealId: string;
  /** ID do contato associado (opcional). Ãtil para tarefas sem deal. */
  contactId?: string;
  /** ID da empresa CRM associada (opcional). Derivado do deal ou contato. */
  clientCompanyId?: ClientCompanyId;
  /** IDs dos contatos participantes (opcional). */
  participantContactIds?: string[];
  dealTitle: string;
  type: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'NOTE' | 'STATUS_CHANGE';
  title: string;
  description?: string;
  date: string;
  user: {
    name: string;
    avatar: string;
  };
  completed: boolean;
}

export interface DashboardStats {
  totalDeals: number;
  pipelineValue: number;
  conversionRate: number;
  winRate: number;
}

// EstÃ¡gio de um Board (etapa do Kanban)
export interface BoardStage {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional for templates
  boardId?: string; // Board FK - optional for templates
  label: string;
  color: string;
  linkedLifecycleStage?: string; // ID do LifecycleStage
}

// Metas do Board (Revenue Ops)
export interface BoardGoal {
  description: string; // "Converter 20% dos leads"
  kpi: string; // "Taxa de ConversÃ£o"
  targetValue: string; // "20%"
  currentValue?: string; // "15%" (Progresso atual)
  type?: 'currency' | 'number' | 'percentage'; // Explicit type for calculation
}

// Persona do Agente (Quem opera o board)
export interface AgentPersona {
  name: string; // "Dra. Ana (Virtual)"
  role: string; // "Consultora de Beleza"
  behavior: string; // "EmpÃ¡tica, usa emojis..."
}

// Board = Kanban configurÃ¡vel (ex: Pipeline de Vendas, Onboarding, etc)
export interface Board {
  id: string;
  organizationId?: OrganizationId; // Tenant FK (for RLS) - optional for templates
  name: string;
  /**
   * Identificador humano e estÃ¡vel (slug) para integraÃ§Ãµes.
   * Ex.: "sales", "pos-venda".
   */
  key?: string;
  description?: string;
  linkedStage?: ContactStage; // Quando mover para etapa final, atualiza o stage do contato
  linkedLifecycleStage?: string; // Qual lifecycle stage este board gerencia (ex: 'LEAD', 'MQL', 'CUSTOMER')
  nextBoardId?: string; // Quando mover para etapa final (Ganho), cria um card neste board
  wonStageId?: string; // EstÃ¡gio de Ganho
  lostStageId?: string; // EstÃ¡gio de Perda
  wonStayInStage?: boolean; // Se true, "Arquiva" na etapa atual (status Won) em vez de mover
  lostStayInStage?: boolean; // Se true, "Arquiva" na etapa atual (status Lost) em vez de mover
  /** Produto padrÃ£o sugerido para deals desse board (opcional). */
  defaultProductId?: string;
  stages: BoardStage[];
  isDefault?: boolean;
  template?: 'PRE_SALES' | 'SALES' | 'ONBOARDING' | 'CS' | 'CUSTOM'; // Template usado para criar este board
  automationSuggestions?: string[]; // SugestÃµes de automaÃ§Ã£o da IA

  // AI Strategy Fields
  goal?: BoardGoal;
  agentPersona?: AgentPersona;
  entryTrigger?: string; // "Quem deve entrar aqui?"
  /** EstÃ¡gio limite do agente AI. NULL = sem limite (age atÃ© o fim do funil). */
  agentGoalStageId?: string | null;

  createdAt: string;
}

// EstÃ¡gios padrÃ£o do board de vendas
export const DEFAULT_BOARD_STAGES: BoardStage[] = [
  { id: DealStatus.NEW, label: 'Novas Oportunidades', color: 'bg-blue-500' },
  { id: DealStatus.CONTACTED, label: 'Contatado', color: 'bg-yellow-500' },
  {
    id: DealStatus.PROPOSAL,
    label: 'Proposta',
    color: 'bg-purple-500',
    linkedLifecycleStage: ContactStage.PROSPECT,
  },
  {
    id: DealStatus.NEGOTIATION,
    label: 'NegociaÃ§Ã£o',
    color: 'bg-orange-500',
    linkedLifecycleStage: ContactStage.PROSPECT,
  },
  {
    id: DealStatus.CLOSED_WON,
    label: 'Ganho',
    color: 'bg-green-500',
    linkedLifecycleStage: ContactStage.CUSTOMER,
  },
];

// @deprecated - Use DEFAULT_BOARD_STAGES
export const PIPELINE_STAGES = DEFAULT_BOARD_STAGES;

// Registry Types
export interface RegistryTemplate {
  id: string;
  path: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
}

export interface RegistryIndex {
  version: string;
  templates: RegistryTemplate[];
}

export interface JourneyDefinition {
  schemaVersion: string;
  name?: string;
  boards: {
    slug: string;
    name: string;
    columns: {
      name: string;
      color?: string;
      linkedLifecycleStage?: string;
    }[];
    strategy?: {
      agentPersona?: AgentPersona;
      goal?: BoardGoal;
      entryTrigger?: string;
    };
  }[];
}

// =============================================================================
// Pagination Types (Server-Side)
// =============================================================================

/**
 * Estado de paginaÃ§Ã£o para controle de navegaÃ§Ã£o.
 * CompatÃ­vel com TanStack Table.
 * 
 * @example
 * ```ts
 * const [pagination, setPagination] = useState<PaginationState>({
 *   pageIndex: 0,
 *   pageSize: 50,
 * });
 * ```
 */
export interface PaginationState {
  /** Ãndice da pÃ¡gina atual (0-indexed). */
  pageIndex: number;
  /** Quantidade de itens por pÃ¡gina. */
  pageSize: number;
}

/** OpÃ§Ãµes vÃ¡lidas para tamanho de pÃ¡gina. */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/** Tamanho de pÃ¡gina padrÃ£o. */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Resposta paginada genÃ©rica do servidor.
 * 
 * @template T Tipo dos itens retornados.
 * 
 * @example
 * ```ts
 * const response: PaginatedResponse<Contact> = {
 *   data: [...],
 *   totalCount: 10000,
 *   pageIndex: 0,
 *   pageSize: 50,
 *   hasMore: true,
 * };
 * ```
 */
export interface PaginatedResponse<T> {
  /** Array de itens da pÃ¡gina atual. */
  data: T[];
  /** Total de registros no banco (para calcular nÃºmero de pÃ¡ginas). */
  totalCount: number;
  /** Ãndice da pÃ¡gina retornada (0-indexed). */
  pageIndex: number;
  /** Tamanho da pÃ¡gina solicitada. */
  pageSize: number;
  /** Se existem mais pÃ¡ginas apÃ³s esta. */
  hasMore: boolean;
}

/**
 * Filtros de contatos para busca server-side.
 * ExtensÃ£o dos filtros existentes com suporte a paginaÃ§Ã£o.
 */
export interface ContactsServerFilters {
  /** Busca por nome ou email (case-insensitive). */
  search?: string;
  /** Filtro por estÃ¡gio do funil. */
  stage?: string | 'ALL';
  /** Filtro por status. */
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE' | 'CHURNED' | 'RISK';
  /** Data de inÃ­cio (created_at >= dateStart). */
  dateStart?: string;
  /** Data de fim (created_at <= dateEnd). */
  dateEnd?: string;
  /** ID da empresa cliente (opcional). */
  clientCompanyId?: string;
  /** Campo para ordenaÃ§Ã£o. */
  sortBy?: ContactSortableColumn;
  /** DireÃ§Ã£o da ordenaÃ§Ã£o. */
  sortOrder?: 'asc' | 'desc';
}

/** Colunas ordenÃ¡veis na tabela de contatos. */
export type ContactSortableColumn = 'name' | 'created_at' | 'updated_at' | 'stage';
