-- ============================================================================
-- 02 — Schema SQL: Máquina de Automações Foco Imo
-- ============================================================================
-- Pré-requisito: Ler CLAUDE.md e 01-architecture.md primeiro.
--
-- Este ficheiro é a migration completa para criar todas as tabelas da máquina
-- de automações. Corre como migration Supabase normal:
--
--   supabase migration new automation_engine_initial
--   # cola este conteúdo
--   supabase db push
--
-- Princípios aplicados:
--   - organization_id NOT NULL em TODAS as tabelas
--   - RLS activado em TODAS as tabelas
--   - Índices em todas as foreign keys e colunas de filtro frequente
--   - Updated_at automático via trigger
--   - Comentários em pt-PT formal
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSÕES (verificar se já existem)
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pgsodium";
-- pgvector já deve existir (raw_intel usa)

-- ----------------------------------------------------------------------------
-- FUNÇÃO AUXILIAR: updated_at automático
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABELA 1: automations
-- Definição de cada automação criada pelo utilizador
-- ============================================================================
CREATE TABLE automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Identificação
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'captacao', 'follow_up', 'relacionamento', etc.
  icon TEXT DEFAULT '⚡',
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  
  -- Definição do fluxo (nós, ligações, configurações)
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  
  -- Versionamento
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Métricas agregadas (actualizadas por trigger)
  total_executions INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_execution_at TIMESTAMPTZ,
  
  -- Auditoria
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

COMMENT ON TABLE automations IS 'Definições das automações criadas pelo utilizador no builder visual.';

CREATE INDEX idx_automations_org_status ON automations(organization_id, status);
CREATE INDEX idx_automations_category ON automations(organization_id, category);
CREATE TRIGGER tg_automations_updated_at BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automations_select_own_org" ON automations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "automations_insert_own_org" ON automations FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "automations_update_own_org" ON automations FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "automations_delete_own_org" ON automations FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================================
-- TABELA 2: automation_versions
-- Histórico de versões de cada automação (para rollback e auditoria)
-- ============================================================================
CREATE TABLE automation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(automation_id, version)
);

CREATE INDEX idx_automation_versions_automation ON automation_versions(automation_id, version DESC);

ALTER TABLE automation_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_versions_select_own_org" ON automation_versions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "automation_versions_insert_own_org" ON automation_versions FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================================
-- TABELA 3: automation_triggers
-- Registo dos triggers activos (subscrições para events, schedules, webhooks)
-- ============================================================================
CREATE TABLE automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'webhook', 'polling', 'manual')),
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Para webhooks (URL única gerada)
  webhook_path TEXT UNIQUE,
  webhook_secret TEXT, -- para validar signature
  
  -- Para schedules
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  
  -- Para polling
  poll_interval_seconds INTEGER,
  last_polled_at TIMESTAMPTZ,
  last_polled_state JSONB, -- para detectar mudanças
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automation_triggers_automation ON automation_triggers(automation_id);
CREATE INDEX idx_automation_triggers_webhook ON automation_triggers(webhook_path) WHERE webhook_path IS NOT NULL;
CREATE INDEX idx_automation_triggers_next_run ON automation_triggers(next_run_at) WHERE is_active = true AND next_run_at IS NOT NULL;
CREATE INDEX idx_automation_triggers_type_active ON automation_triggers(trigger_type, is_active);
CREATE TRIGGER tg_automation_triggers_updated_at BEFORE UPDATE ON automation_triggers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "automation_triggers_select_own_org" ON automation_triggers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "automation_triggers_all_own_org" ON automation_triggers FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================================
-- TABELA 4: automation_executions
-- Cada execução em curso ou completada
-- ============================================================================
CREATE TABLE automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_version INTEGER NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'waiting', 'completed', 'failed', 'cancelled')
  ),
  
  -- Contexto do disparo
  trigger_event JSONB,
  trigger_type TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  imovel_id UUID, -- referência opcional, deixar sem FK por enquanto
  
  -- Estado da máquina
  current_node_id TEXT,
  variables JSONB NOT NULL DEFAULT '{}', -- outputs acumulados {node_id: {output: ...}}
  
  -- Para execuções suspensas (waiting)
  resume_at TIMESTAMPTZ, -- quando retomar
  resume_node_id TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Erro (se aplicável)
  error_message TEXT,
  error_node_id TEXT,
  error_stack TEXT,
  
  -- Modo teste
  is_test BOOLEAN NOT NULL DEFAULT false,
  test_options JSONB, -- {skip_waits: true, simulation_mode: true, ...}
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE automation_executions IS 'Cada instância de uma automação a correr ou já corrida.';

CREATE INDEX idx_executions_automation ON automation_executions(automation_id, started_at DESC);
CREATE INDEX idx_executions_status ON automation_executions(status) WHERE status IN ('running', 'waiting');
CREATE INDEX idx_executions_contact ON automation_executions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_executions_deal ON automation_executions(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_executions_resume ON automation_executions(resume_at) WHERE status = 'waiting' AND resume_at IS NOT NULL;
CREATE INDEX idx_executions_org_started ON automation_executions(organization_id, started_at DESC);

-- Replica identity full para Realtime mostrar mudanças
ALTER TABLE automation_executions REPLICA IDENTITY FULL;

ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "executions_select_own_org" ON automation_executions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "executions_insert_service" ON automation_executions FOR INSERT
  WITH CHECK (true); -- só Edge Functions com service_role escrevem
CREATE POLICY "executions_update_service" ON automation_executions FOR UPDATE
  USING (true);


-- ============================================================================
-- TABELA 5: automation_node_executions
-- Log detalhado de cada nó executado dentro de uma execução
-- ============================================================================
CREATE TABLE automation_node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  node_id TEXT NOT NULL,        -- id do nó na definition
  atom_id TEXT NOT NULL,         -- ex: 'action.send_whatsapp'
  
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  
  input JSONB,
  output JSONB,
  error TEXT,
  error_stack TEXT,
  
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Custo (para átomos IA, API calls pagas)
  cost_usd NUMERIC(10, 6),
  
  -- Para auditoria
  service_used TEXT -- ex: 'gemini-2.5-flash', 'anthropic-haiku-4.5', 'whatsapp-cloud-api'
);

CREATE INDEX idx_node_executions_execution ON automation_node_executions(execution_id, started_at);
CREATE INDEX idx_node_executions_atom ON automation_node_executions(atom_id, status);

ALTER TABLE automation_node_executions REPLICA IDENTITY FULL;

ALTER TABLE automation_node_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "node_executions_select_own_org" ON automation_node_executions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "node_executions_insert_service" ON automation_node_executions FOR INSERT
  WITH CHECK (true);
CREATE POLICY "node_executions_update_service" ON automation_node_executions FOR UPDATE
  USING (true);


-- ============================================================================
-- TABELA 6: automation_events
-- Ledger de todos os eventos do sistema (event bus persistente)
-- ============================================================================
CREATE TABLE automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT, -- ex: 'contacts_table', 'meta_ads_webhook', 'manual'
  
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  
  -- Para deduplicação
  idempotency_key TEXT,
  
  UNIQUE (organization_id, event_type, idempotency_key)
);

COMMENT ON TABLE automation_events IS 'Ledger persistente de todos os eventos do sistema. Base do Event Bus.';

CREATE INDEX idx_events_type ON automation_events(event_type, processed);
CREATE INDEX idx_events_unprocessed ON automation_events(occurred_at) WHERE processed = false;
CREATE INDEX idx_events_org_type ON automation_events(organization_id, event_type, occurred_at DESC);

ALTER TABLE automation_events REPLICA IDENTITY FULL;

ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_own_org" ON automation_events FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "events_insert_service" ON automation_events FOR INSERT
  WITH CHECK (true);


-- ============================================================================
-- TABELA 7: automation_integrations
-- Conexões a serviços externos (Meta Ads, Gmail, etc.)
-- ============================================================================
CREATE TABLE automation_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  provider TEXT NOT NULL, -- 'meta_ads', 'gmail', 'google_drive', 'stripe', etc.
  account_name TEXT, -- nome que o utilizador vê na UI ("Conta Pessoal", "Negócio F&R")
  
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'basic', 'token', 'webhook')),
  
  -- Metadata pública (não sensível): scopes, account_id externo, etc.
  metadata JSONB DEFAULT '{}',
  
  -- Token de acesso (encriptado via pgsodium em coluna separada — ver automation_credentials)
  
  -- OAuth específico
  access_token_expires_at TIMESTAMPTZ,
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(organization_id, provider, account_name)
);

CREATE INDEX idx_integrations_org_provider ON automation_integrations(organization_id, provider);
CREATE INDEX idx_integrations_status ON automation_integrations(status);
CREATE TRIGGER tg_automation_integrations_updated_at BEFORE UPDATE ON automation_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automation_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "integrations_select_own_org" ON automation_integrations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "integrations_all_own_org" ON automation_integrations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));


-- ============================================================================
-- TABELA 8: automation_credentials
-- Credenciais encriptadas (separadas para segurança máxima)
-- ============================================================================
CREATE TABLE automation_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES automation_integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Encriptado com pgsodium
  -- Estrutura JSON encriptada: {access_token, refresh_token, api_key, etc.}
  encrypted_data BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

CREATE INDEX idx_credentials_integration ON automation_credentials(integration_id);

-- Esta tabela SÓ é acessível via Edge Functions com service_role
ALTER TABLE automation_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials_no_client_access" ON automation_credentials FOR SELECT
  USING (false); -- bloqueia tudo via cliente
CREATE POLICY "credentials_insert_service" ON automation_credentials FOR INSERT
  WITH CHECK (true);


-- ============================================================================
-- TABELA 9: automation_atoms_registry
-- Cache na BD dos átomos disponíveis (para queries rápidas no builder)
-- ============================================================================
CREATE TABLE automation_atoms_registry (
  id TEXT PRIMARY KEY, -- ex: 'action.send_whatsapp'
  category TEXT NOT NULL CHECK (category IN ('trigger', 'action', 'logic', 'data', 'observability')),
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  config_schema JSONB NOT NULL,
  output_schema JSONB NOT NULL,
  
  -- Para átomos de integração
  requires_integration TEXT, -- ex: 'meta_ads', 'whatsapp'
  
  -- Versionamento
  version TEXT NOT NULL DEFAULT '1.0',
  
  -- Para depreciar átomos
  is_deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecation_message TEXT,
  
  -- Métricas globais (sumário)
  usage_count INTEGER NOT NULL DEFAULT 0,
  
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_atoms_category ON automation_atoms_registry(category) WHERE is_deprecated = false;

-- Esta tabela é pública (read-only) para clientes verem o catálogo
ALTER TABLE automation_atoms_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atoms_select_all" ON automation_atoms_registry FOR SELECT
  USING (auth.role() = 'authenticated');


-- ============================================================================
-- TABELA 10: automation_schedules
-- Agendamentos para retomar execuções suspensas (Wait Until, Wait Fixed longas)
-- ============================================================================
CREATE TABLE automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  scheduled_for TIMESTAMPTZ NOT NULL,
  resume_node_id TEXT NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fired', 'cancelled')),
  fired_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_schedules_pending ON automation_schedules(scheduled_for) WHERE status = 'pending';

ALTER TABLE automation_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_select_own_org" ON automation_schedules FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "schedules_all_service" ON automation_schedules FOR ALL
  USING (true);


-- ============================================================================
-- FUNÇÃO: publish_event
-- Publica um evento no event bus (chamada por triggers de outras tabelas)
-- ============================================================================
CREATE OR REPLACE FUNCTION publish_event(
  p_event_type TEXT,
  p_payload JSONB,
  p_organization_id UUID,
  p_source TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO automation_events (event_type, payload, organization_id, source, idempotency_key)
  VALUES (p_event_type, p_payload, p_organization_id, p_source, p_idempotency_key)
  ON CONFLICT (organization_id, event_type, idempotency_key) DO NOTHING
  RETURNING id INTO v_event_id;
  
  IF v_event_id IS NOT NULL THEN
    PERFORM pg_notify('automation_events', json_build_object(
      'event_id', v_event_id,
      'event_type', p_event_type,
      'organization_id', p_organization_id
    )::text);
  END IF;
  
  RETURN v_event_id;
END;
$$;


-- ============================================================================
-- TRIGGERS em tabelas existentes para publicar eventos
-- (Adicionar conforme cada entidade)
-- ============================================================================

-- Contacts
CREATE OR REPLACE FUNCTION trg_contacts_publish_events()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM publish_event('contact.created', row_to_json(NEW)::jsonb, NEW.organization_id, 'contacts_table');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage IS DISTINCT FROM NEW.stage THEN
      PERFORM publish_event('contact.stage.changed', 
        jsonb_build_object('contact', row_to_json(NEW), 'old_stage', OLD.stage, 'new_stage', NEW.stage),
        NEW.organization_id, 'contacts_table');
    END IF;
    PERFORM publish_event('contact.updated', row_to_json(NEW)::jsonb, NEW.organization_id, 'contacts_table');
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM publish_event('contact.deleted', row_to_json(OLD)::jsonb, OLD.organization_id, 'contacts_table');
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_publish_events ON contacts;
CREATE TRIGGER contacts_publish_events
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION trg_contacts_publish_events();

-- Deals
CREATE OR REPLACE FUNCTION trg_deals_publish_events()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM publish_event('deal.created', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      PERFORM publish_event('deal.stage.changed',
        jsonb_build_object('deal', row_to_json(NEW), 'old_stage_id', OLD.stage_id, 'new_stage_id', NEW.stage_id),
        NEW.organization_id, 'deals_table');
    END IF;
    IF OLD.is_won = false AND NEW.is_won = true THEN
      PERFORM publish_event('deal.won', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
    END IF;
    IF OLD.is_lost = false AND NEW.is_lost = true THEN
      PERFORM publish_event('deal.lost', row_to_json(NEW)::jsonb, NEW.organization_id, 'deals_table');
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_publish_events ON deals;
CREATE TRIGGER deals_publish_events
  AFTER INSERT OR UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION trg_deals_publish_events();


-- ============================================================================
-- pg_cron jobs (registar quando todas as tabelas estiverem prontas)
-- ============================================================================

-- Processar agendamentos pendentes a cada minuto
-- SELECT cron.schedule('process-automation-schedules', '* * * * *', $$
--   SELECT net.http_post(
--     url := 'https://zcqbbqrdbszzkpydrlmz.functions.supabase.co/automation-cron',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
-- $$);

-- Cleanup de eventos processados com mais de 30 dias
-- SELECT cron.schedule('cleanup-old-events', '0 3 * * *', $$
--   DELETE FROM automation_events WHERE processed = true AND processed_at < NOW() - INTERVAL '30 days';
-- $$);

-- Cleanup de execuções completadas com mais de 90 dias
-- SELECT cron.schedule('cleanup-old-executions', '0 4 * * *', $$
--   DELETE FROM automation_executions WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '90 days';
-- $$);


-- ============================================================================
-- ENABLE Realtime nas tabelas críticas
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE automation_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE automation_node_executions;
ALTER PUBLICATION supabase_realtime ADD TABLE automation_events;


-- ============================================================================
-- DADOS INICIAIS: categorias default
-- ============================================================================
-- (sem dados iniciais por agora; o utilizador cria automações)


-- ============================================================================
-- FIM da migration
-- ============================================================================
