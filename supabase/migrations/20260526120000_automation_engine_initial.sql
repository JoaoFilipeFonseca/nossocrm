-- ============================================================================
-- Máquina de Automações Foco Imo, migration inicial
-- Sprint 0, commit 2 de 6.
--
-- Cria 10 tabelas automation_*, função publish_event, RLS, índices, e activa
-- Realtime nas 3 tabelas observáveis. Idempotente (correr 2x não dá erro).
--
-- pg_cron é instalada aqui mas os jobs ficam comentados até Sprint 1.
-- pgsodium fica para o Sprint 5 (encriptação de credenciais).
-- Triggers de publish_event em contacts e deals vão no commit 3, ficheiro
-- separado para revert rápido.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- EXTENSÕES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ----------------------------------------------------------------------------
-- LIMPEZA da tabela legacy automation_executions (Bloco 1 placeholder, 0 rows)
-- O schema antigo não bate com o novo. CASCADE para apanhar dependências
-- residuais. Página /settings/automation-logs passa a mostrar lista vazia,
-- adaptação fica capturada como B-008 (Sprint 7).
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS automation_executions CASCADE;

-- ----------------------------------------------------------------------------
-- FUNÇÃO AUXILIAR set_updated_at (caso já não exista no projecto)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TABELA 1, automations: definição de cada automação criada pelo utilizador
-- ============================================================================
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  icon TEXT DEFAULT '⚡',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  definition JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  total_executions INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_execution_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ
);

COMMENT ON TABLE automations IS 'Definições de automações criadas pelo utilizador no builder visual.';

CREATE INDEX IF NOT EXISTS idx_automations_org_status ON automations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_automations_category ON automations(organization_id, category);

DROP TRIGGER IF EXISTS tg_automations_updated_at ON automations;
CREATE TRIGGER tg_automations_updated_at BEFORE UPDATE ON automations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_automations_select_own_org ON automations;
CREATE POLICY automation_automations_select_own_org ON automations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_automations_insert_own_org ON automations;
CREATE POLICY automation_automations_insert_own_org ON automations FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_automations_update_own_org ON automations;
CREATE POLICY automation_automations_update_own_org ON automations FOR UPDATE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_automations_delete_own_org ON automations;
CREATE POLICY automation_automations_delete_own_org ON automations FOR DELETE
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- TABELA 2, automation_versions: histórico de versões (rollback e auditoria)
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  definition JSONB NOT NULL,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(automation_id, version)
);

CREATE INDEX IF NOT EXISTS idx_automation_versions_automation ON automation_versions(automation_id, version DESC);

ALTER TABLE automation_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_versions_select_own_org ON automation_versions;
CREATE POLICY automation_versions_select_own_org ON automation_versions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_versions_insert_own_org ON automation_versions;
CREATE POLICY automation_versions_insert_own_org ON automation_versions FOR INSERT
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- TABELA 3, automation_triggers: registo de triggers activos
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('event', 'schedule', 'webhook', 'polling', 'manual')),
  config JSONB NOT NULL DEFAULT '{}',
  webhook_path TEXT UNIQUE,
  webhook_secret TEXT,
  cron_expression TEXT,
  next_run_at TIMESTAMPTZ,
  poll_interval_seconds INTEGER,
  last_polled_at TIMESTAMPTZ,
  last_polled_state JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_triggers_automation ON automation_triggers(automation_id);
CREATE INDEX IF NOT EXISTS idx_automation_triggers_webhook ON automation_triggers(webhook_path) WHERE webhook_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_triggers_next_run ON automation_triggers(next_run_at) WHERE is_active = true AND next_run_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_automation_triggers_type_active ON automation_triggers(trigger_type, is_active);

DROP TRIGGER IF EXISTS tg_automation_triggers_updated_at ON automation_triggers;
CREATE TRIGGER tg_automation_triggers_updated_at BEFORE UPDATE ON automation_triggers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automation_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_triggers_select_own_org ON automation_triggers;
CREATE POLICY automation_triggers_select_own_org ON automation_triggers FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_triggers_all_own_org ON automation_triggers;
CREATE POLICY automation_triggers_all_own_org ON automation_triggers FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- TABELA 4, automation_executions: cada execução em curso ou completada
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  automation_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'waiting', 'completed', 'failed', 'cancelled')
  ),
  trigger_event JSONB,
  trigger_type TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  imovel_id UUID,
  current_node_id TEXT,
  variables JSONB NOT NULL DEFAULT '{}',
  resume_at TIMESTAMPTZ,
  resume_node_id TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  error_node_id TEXT,
  error_stack TEXT,
  is_test BOOLEAN NOT NULL DEFAULT false,
  test_options JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE automation_executions IS 'Cada instância de uma automação a correr ou já corrida.';

CREATE INDEX IF NOT EXISTS idx_executions_automation ON automation_executions(automation_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_status ON automation_executions(status) WHERE status IN ('running', 'waiting');
CREATE INDEX IF NOT EXISTS idx_executions_contact ON automation_executions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_deal ON automation_executions(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_resume ON automation_executions(resume_at) WHERE status = 'waiting' AND resume_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_executions_org_started ON automation_executions(organization_id, started_at DESC);

ALTER TABLE automation_executions REPLICA IDENTITY FULL;
ALTER TABLE automation_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_executions_select_own_org ON automation_executions;
CREATE POLICY automation_executions_select_own_org ON automation_executions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_executions_insert_service ON automation_executions;
CREATE POLICY automation_executions_insert_service ON automation_executions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS automation_executions_update_service ON automation_executions;
CREATE POLICY automation_executions_update_service ON automation_executions FOR UPDATE
  USING (true);

-- ============================================================================
-- TABELA 5, automation_node_executions: log detalhado de cada nó executado
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_node_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  atom_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  input JSONB,
  output JSONB,
  error TEXT,
  error_stack TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC(10, 6),
  service_used TEXT
);

CREATE INDEX IF NOT EXISTS idx_node_executions_execution ON automation_node_executions(execution_id, started_at);
CREATE INDEX IF NOT EXISTS idx_node_executions_atom ON automation_node_executions(atom_id, status);

ALTER TABLE automation_node_executions REPLICA IDENTITY FULL;
ALTER TABLE automation_node_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_node_executions_select_own_org ON automation_node_executions;
CREATE POLICY automation_node_executions_select_own_org ON automation_node_executions FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_node_executions_insert_service ON automation_node_executions;
CREATE POLICY automation_node_executions_insert_service ON automation_node_executions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS automation_node_executions_update_service ON automation_node_executions;
CREATE POLICY automation_node_executions_update_service ON automation_node_executions FOR UPDATE
  USING (true);

-- ============================================================================
-- TABELA 6, automation_events: ledger persistente do event bus
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  idempotency_key TEXT,
  UNIQUE (organization_id, event_type, idempotency_key)
);

COMMENT ON TABLE automation_events IS 'Ledger persistente de todos os eventos do sistema (base do Event Bus).';

CREATE INDEX IF NOT EXISTS idx_events_type ON automation_events(event_type, processed);
CREATE INDEX IF NOT EXISTS idx_events_unprocessed ON automation_events(occurred_at) WHERE processed = false;
CREATE INDEX IF NOT EXISTS idx_events_org_type ON automation_events(organization_id, event_type, occurred_at DESC);

ALTER TABLE automation_events REPLICA IDENTITY FULL;
ALTER TABLE automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_events_select_own_org ON automation_events;
CREATE POLICY automation_events_select_own_org ON automation_events FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_events_insert_service ON automation_events;
CREATE POLICY automation_events_insert_service ON automation_events FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- TABELA 7, automation_integrations: conexões a serviços externos
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  account_name TEXT,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'basic', 'token', 'webhook')),
  metadata JSONB DEFAULT '{}',
  access_token_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_used_at TIMESTAMPTZ,
  last_error TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, provider, account_name)
);

CREATE INDEX IF NOT EXISTS idx_integrations_org_provider ON automation_integrations(organization_id, provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON automation_integrations(status);

DROP TRIGGER IF EXISTS tg_automation_integrations_updated_at ON automation_integrations;
CREATE TRIGGER tg_automation_integrations_updated_at BEFORE UPDATE ON automation_integrations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE automation_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_integrations_select_own_org ON automation_integrations;
CREATE POLICY automation_integrations_select_own_org ON automation_integrations FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_integrations_all_own_org ON automation_integrations;
CREATE POLICY automation_integrations_all_own_org ON automation_integrations FOR ALL
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- TABELA 8, automation_credentials: credenciais encriptadas
-- pgsodium é adiada para Sprint 5. Por agora a tabela existe com a coluna
-- BYTEA pronta, sem encriptação activa. RLS bloqueia leitura via cliente.
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES automation_integrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  encrypted_data BYTEA NOT NULL,
  nonce BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rotated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credentials_integration ON automation_credentials(integration_id);

ALTER TABLE automation_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_credentials_no_client_access ON automation_credentials;
CREATE POLICY automation_credentials_no_client_access ON automation_credentials FOR SELECT
  USING (false);

DROP POLICY IF EXISTS automation_credentials_insert_service ON automation_credentials;
CREATE POLICY automation_credentials_insert_service ON automation_credentials FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- TABELA 9, automation_atoms_registry: cache do catálogo de átomos
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_atoms_registry (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('trigger', 'action', 'logic', 'data', 'observability')),
  name TEXT NOT NULL,
  icon TEXT,
  description TEXT,
  config_schema JSONB NOT NULL,
  output_schema JSONB NOT NULL,
  requires_integration TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  is_deprecated BOOLEAN NOT NULL DEFAULT false,
  deprecation_message TEXT,
  usage_count INTEGER NOT NULL DEFAULT 0,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atoms_category ON automation_atoms_registry(category) WHERE is_deprecated = false;

ALTER TABLE automation_atoms_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_atoms_select_all ON automation_atoms_registry;
CREATE POLICY automation_atoms_select_all ON automation_atoms_registry FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- TABELA 10, automation_schedules: agendamentos para retomar execuções
-- ============================================================================
CREATE TABLE IF NOT EXISTS automation_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES automation_executions(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  resume_node_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fired', 'cancelled')),
  fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_pending ON automation_schedules(scheduled_for) WHERE status = 'pending';

ALTER TABLE automation_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_schedules_select_own_org ON automation_schedules;
CREATE POLICY automation_schedules_select_own_org ON automation_schedules FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS automation_schedules_all_service ON automation_schedules;
CREATE POLICY automation_schedules_all_service ON automation_schedules FOR ALL
  USING (true);

-- ============================================================================
-- FUNÇÃO publish_event: ponto único de publicação no event bus
--
-- SECURITY DEFINER porque pode ser chamada por triggers em tabelas que
-- pertencem a outros donos. EXCEPTION WHEN OTHERS THEN NULL para garantir
-- que falhas no event bus NUNCA quebram o INSERT/UPDATE upstream (princípio:
-- automação é observador, não pode bloquear operações de negócio).
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
  EXCEPTION WHEN OTHERS THEN
    -- Engole qualquer erro para não quebrar a operação que invocou.
    -- Se for útil, observabilidade futura pode logar para client_errors_log.
    RETURN NULL;
  END;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION publish_event IS 'Publica evento no automation_events. Nunca propaga erro upstream.';

-- ============================================================================
-- REALTIME publication, idempotente (verifica antes de adicionar)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'automation_executions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE automation_executions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'automation_node_executions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE automation_node_executions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'automation_events'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE automation_events';
  END IF;
END
$$;

-- ============================================================================
-- pg_cron jobs ficam comentados, serão activados no Sprint 1 quando a
-- Edge Function automation-cron existir.
-- ============================================================================
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

-- ============================================================================
-- FIM da migration. Triggers em contacts e deals vão no commit 3.
-- ============================================================================
