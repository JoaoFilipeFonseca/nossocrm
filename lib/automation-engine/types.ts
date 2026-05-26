// ============================================================================
// types.ts — Tipos partilhados da Máquina de Automações Foco Imo
// ============================================================================
// Localização final: /lib/automation-engine/types.ts
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

// ----------------------------------------------------------------------------
// Categorias de átomos
// ----------------------------------------------------------------------------
export type AtomCategory = 'trigger' | 'action' | 'logic' | 'data' | 'observability';

// ----------------------------------------------------------------------------
// Tipos de trigger
// ----------------------------------------------------------------------------
export type TriggerType = 'event' | 'schedule' | 'webhook' | 'polling' | 'manual';

// ----------------------------------------------------------------------------
// Eventos canónicos do sistema (publicados em automation_events)
// ----------------------------------------------------------------------------
export type SystemEvent =
  // Contactos
  | 'contact.created'
  | 'contact.updated'
  | 'contact.deleted'
  | 'contact.tag.added'
  | 'contact.tag.removed'
  | 'contact.stage.changed'
  // Negócios (deals)
  | 'deal.created'
  | 'deal.updated'
  | 'deal.stage.changed'
  | 'deal.won'
  | 'deal.lost'
  // Imóveis
  | 'imovel.created'
  | 'imovel.captado'
  | 'imovel.sold'
  // Mensagens
  | 'message.received'
  | 'message.sent'
  | 'message.delivered'
  | 'message.read'
  | 'message.replied'
  // Magic Inbox / Match
  | 'raw_intel.created'
  | 'match.created'
  | 'match.score_high'
  // Sistema
  | 'webhook.received'
  | 'schedule.fired'
  | 'manual.triggered'
  | 'automation.completed'
  | 'automation.failed';

// ----------------------------------------------------------------------------
// Status de execução
// ----------------------------------------------------------------------------
export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

// ----------------------------------------------------------------------------
// Definição de uma automação (formato persistido em automations.definition)
// ----------------------------------------------------------------------------
export interface AutomationDefinition {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface AutomationNode {
  id: string;
  atom: string; // ex: 'action.send_whatsapp'
  position: { x: number; y: number };
  config: Record<string, unknown>;
  label?: string;
  notes?: string;
}

export interface AutomationEdge {
  id: string;
  source: string; // node id
  target: string; // node id
  sourceHandle?: string; // para nós com múltiplas saídas (logic.condition: 'true' / 'false')
  targetHandle?: string;
  label?: string;
}

// ----------------------------------------------------------------------------
// Contexto de execução passado a cada átomo
// ----------------------------------------------------------------------------
export interface ExecutionContext {
  // Supabase clients
  supabase: SupabaseClient; // service role
  
  // Identificadores da execução
  executionId: string;
  automationId: string;
  organizationId: string;
  nodeId: string;
  
  // Config resolvida (com variáveis já interpoladas)
  config: Record<string, unknown>;
  
  // Outputs acumulados de nós anteriores: { [nodeId]: { output: ... } }
  variables: Record<string, { output: unknown }>;
  
  // Contexto do trigger
  triggerEvent?: {
    type: string;
    payload: unknown;
  };
  
  // Contacto/negócio associados (se aplicável)
  contactId?: string;
  dealId?: string;
  imovelId?: string;
  
  // Modo teste
  isTest: boolean;
  testOptions?: {
    skipWaits?: boolean;
    simulationMode?: boolean;
    verboseLogging?: boolean;
  };
  
  // Helpers
  log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: unknown) => Promise<void>;
  getIntegration: (integrationId: string) => Promise<IntegrationWithCredentials>;
  getBrandKit: () => Promise<BrandKit>;
  getPromptTemplate: (templateId: string) => Promise<PromptTemplate>;
  recordActivity: (type: string, data: Record<string, unknown>) => Promise<void>;
  archiveCreative: (data: Record<string, unknown>) => Promise<void>;
}

// ----------------------------------------------------------------------------
// Output de um átomo
// ----------------------------------------------------------------------------
export type AtomOutput =
  | Record<string, unknown>
  | (Record<string, unknown> & {
      // Sinaliza ao executor para suspender (waits longos)
      _suspend?: true;
      _resumeAt?: string; // ISO datetime
      _resumeOnEvent?: SystemEvent;
      _resumeFilter?: Record<string, unknown>;
    })
  | (Record<string, unknown> & {
      // Sinaliza ao executor qual edge seguir (para logic.condition, logic.switch)
      _branch?: string;
    });

// ----------------------------------------------------------------------------
// Definição de um Átomo (interface que cada plugin implementa)
// ----------------------------------------------------------------------------
export interface AtomDefinition {
  // Identificação
  id: string; // formato: 'trigger.event', 'action.send_whatsapp'
  category: AtomCategory;
  name: string;
  icon: string;
  description: string;
  version?: string; // default '1.0'
  
  // Schemas (JSON Schema)
  configSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  
  // Integrações necessárias
  requiresIntegration?: string; // ex: 'gmail', 'meta_ads'
  
  // Configuração de trigger (se category === 'trigger')
  triggerSchema?: {
    type: TriggerType;
    events?: SystemEvent[];
  };
  
  // Política de retry
  retry?: {
    maxAttempts: number;
    backoffMs: number; // tempo entre tentativas
    backoffMultiplier?: number; // exponential backoff
  };
  
  // Timeout máximo
  timeoutMs?: number;
  
  // Deprecação
  isDeprecated?: boolean;
  deprecationMessage?: string;
  
  // Execução
  execute: (context: ExecutionContext) => Promise<AtomOutput>;
  
  // Validação opcional da configuração (além do JSON Schema)
  validate?: (config: Record<string, unknown>) => string[] | null; // null = OK, array = erros
  
  // Para triggers webhook: handler HTTP customizado
  webhookHandler?: (request: Request, config: Record<string, unknown>) => Promise<{
    payload: unknown;
    response?: Response;
  }>;
}

// ----------------------------------------------------------------------------
// Integrações
// ----------------------------------------------------------------------------
export type AuthType = 'oauth2' | 'api_key' | 'basic' | 'token' | 'webhook';

export interface IntegrationDefinition {
  provider: string;
  name: string;
  icon: string;
  description: string;
  authType: AuthType;
  
  // Para OAuth
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientIdEnv: string;
    clientSecretEnv: string;
  };
  
  // Para API key
  apiKey?: {
    fields: Array<{ name: string; label: string; secret: boolean }>;
  };
  
  // Funções de validação e info
  testConnection: (credentials: Record<string, string>) => Promise<boolean>;
  getAccountInfo: (credentials: Record<string, string>) => Promise<{
    accountId: string;
    accountName: string;
    metadata?: Record<string, unknown>;
  }>;
  refreshTokenIfNeeded?: (credentials: Record<string, string>) => Promise<Record<string, string> | null>;
}

export interface IntegrationWithCredentials {
  id: string;
  provider: string;
  accountName: string;
  metadata: Record<string, unknown>;
  credentials: Record<string, string>;
}

// ----------------------------------------------------------------------------
// Brand Kit (carregado de ai_brand_kits)
// ----------------------------------------------------------------------------
export interface BrandKit {
  id: string;
  organization_id: string;
  visual: {
    primary_color: string;
    secondary_color: string;
    fonts: { heading: string; body: string };
    logos: Record<string, string>;
  };
  tone_of_voice: string;
  philosophy: string;
  pillars: string[];
  banned_vocabulary: string[];
  preferred_vocabulary: string[];
  official_data: {
    ami: string;
    nipc: string;
    phone: string;
    email: string;
  };
  bio: string;
  brand_phrases: string[];
  slogan: string;
}

// ----------------------------------------------------------------------------
// Prompt Template (carregado de ai_prompt_templates)
// ----------------------------------------------------------------------------
export interface PromptTemplate {
  id: string;
  name: string;
  version: number;
  system_prompt: string;
  user_prompt_template: string;
  variables: string[];
  model_preference?: 'auto' | 'gemini' | 'anthropic';
  max_tokens?: number;
  temperature?: number;
}

// ----------------------------------------------------------------------------
// Evento (do automation_events)
// ----------------------------------------------------------------------------
export interface AutomationEvent {
  id: string;
  organization_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  source: string | null;
  occurred_at: string;
  processed: boolean;
  processed_at: string | null;
  idempotency_key: string | null;
}

// ----------------------------------------------------------------------------
// Execução (do automation_executions)
// ----------------------------------------------------------------------------
export interface AutomationExecution {
  id: string;
  automation_id: string;
  organization_id: string;
  automation_version: number;
  status: ExecutionStatus;
  trigger_event: Record<string, unknown> | null;
  trigger_type: string | null;
  contact_id: string | null;
  deal_id: string | null;
  current_node_id: string | null;
  variables: Record<string, { output: unknown }>;
  resume_at: string | null;
  resume_node_id: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  error_node_id: string | null;
  is_test: boolean;
  test_options: Record<string, unknown> | null;
  created_at: string;
}
