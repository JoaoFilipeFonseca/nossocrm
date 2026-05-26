-- ============================================================================
-- Smoke test RLS, Máquina de Automações
-- Sprint 0, commit 4 de 6.
--
-- Idempotente: tudo dentro de BEGIN/ROLLBACK, zero residuo na BD.
--
-- Como correr:
--   psql ... -f supabase/tests/automation_rls_smoke.sql
--   OU mcp__supabase__execute_sql com o conteudo
--
-- Saida esperada: 10 linhas, todas com status='RLS_OK'.
--
-- Estrategia:
--   1. Como service_role, cria uma organizacao temporaria Z e insere 1 linha
--      em cada das 10 tabelas automation_*, sempre apontando para Z.
--   2. Faz SET LOCAL ROLE authenticated + claim sub para um utilizador real
--      cuja organizacao e' DIFERENTE de Z.
--   3. Tenta SELECT a partir desse contexto. As policies devem esconder
--      todas as linhas de Z.
--
-- Casos especiais por tabela:
--   - automation_credentials: policy SELECT USING(false), ninguem ve nada
--     mesmo da propria org (so service_role acede). Espera 0 linhas total.
--   - automation_atoms_registry: catalogo global, policy SELECT USING
--     auth.role()='authenticated'. Qualquer authenticated ve. Espera >=1.
--
-- Se algum dia precisar de outro user para o teste, troca o UUID da claim
-- sub por qualquer profiles.id existente cuja organization_id nao seja Z.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- Setup de dados em organizacao temporaria Z
-- ----------------------------------------------------------------------------
INSERT INTO organizations (id, name)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'rls_smoke_z');

INSERT INTO automations (id, organization_id, name, status)
VALUES ('11111111-aaaa-bbbb-cccc-111111111111',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        'rls_smoke_auto', 'draft');

INSERT INTO automation_versions (automation_id, organization_id, version, definition)
VALUES ('11111111-aaaa-bbbb-cccc-111111111111',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 1, '{}'::jsonb);

INSERT INTO automation_triggers (automation_id, organization_id, trigger_type, config)
VALUES ('11111111-aaaa-bbbb-cccc-111111111111',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'manual', '{}'::jsonb);

INSERT INTO automation_executions (id, automation_id, organization_id, automation_version, status)
VALUES ('22222222-aaaa-bbbb-cccc-222222222222',
        '11111111-aaaa-bbbb-cccc-111111111111',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 1, 'pending');

INSERT INTO automation_node_executions (execution_id, organization_id, node_id, atom_id, status)
VALUES ('22222222-aaaa-bbbb-cccc-222222222222',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        'n1', 'trigger.manual', 'pending');

INSERT INTO automation_events (organization_id, event_type, payload)
VALUES ('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'rls.smoke', '{}'::jsonb);

INSERT INTO automation_integrations (id, organization_id, provider, auth_type, account_name)
VALUES ('33333333-aaaa-bbbb-cccc-333333333333',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        'rls_smoke', 'api_key', 'smoke');

INSERT INTO automation_credentials (integration_id, organization_id, encrypted_data, nonce)
VALUES ('33333333-aaaa-bbbb-cccc-333333333333',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        '\x00'::bytea, '\x00'::bytea);

INSERT INTO automation_atoms_registry (id, category, name, config_schema, output_schema)
VALUES ('rls.smoke.atom', 'action', 'Smoke', '{}'::jsonb, '{}'::jsonb);

INSERT INTO automation_schedules (execution_id, organization_id, scheduled_for, resume_node_id)
VALUES ('22222222-aaaa-bbbb-cccc-222222222222',
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        NOW() + INTERVAL '1 day', 'n1');

-- ----------------------------------------------------------------------------
-- Mudanca de papel para simular utilizador autenticado de outra organizacao
-- (org Joao Fonseca neste projecto). Troca o sub por qualquer profile valido
-- de uma organizacao DIFERENTE de Z, se a BD em questao nao tiver este UUID.
-- ----------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"15a3f1c9-5837-41ff-b68f-a25893e79f62","role":"authenticated"}';

-- ----------------------------------------------------------------------------
-- Validacao: 10 tabelas, espera-se RLS_OK em todas
-- ----------------------------------------------------------------------------
SELECT table_name, status FROM (
  SELECT 'automations' AS table_name, 1 AS ord,
    CASE WHEN (SELECT count(*) FROM automations
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END AS status
  UNION ALL
  SELECT 'automation_versions', 2,
    CASE WHEN (SELECT count(*) FROM automation_versions
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
  UNION ALL
  SELECT 'automation_triggers', 3,
    CASE WHEN (SELECT count(*) FROM automation_triggers
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
  UNION ALL
  SELECT 'automation_executions', 4,
    CASE WHEN (SELECT count(*) FROM automation_executions
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
  UNION ALL
  SELECT 'automation_node_executions', 5,
    CASE WHEN (SELECT count(*) FROM automation_node_executions
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
  UNION ALL
  SELECT 'automation_events', 6,
    CASE WHEN (SELECT count(*) FROM automation_events
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
  UNION ALL
  SELECT 'automation_integrations', 7,
    CASE WHEN (SELECT count(*) FROM automation_integrations
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
  UNION ALL
  SELECT 'automation_credentials', 8,
    CASE WHEN (SELECT count(*) FROM automation_credentials)=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL select USING(false) violado' END
  UNION ALL
  SELECT 'automation_atoms_registry', 9,
    CASE WHEN (SELECT count(*) FROM automation_atoms_registry
               WHERE id='rls.smoke.atom')=1
         THEN 'RLS_OK' ELSE 'RLS_FAIL authenticated nao ve atom' END
  UNION ALL
  SELECT 'automation_schedules', 10,
    CASE WHEN (SELECT count(*) FROM automation_schedules
               WHERE organization_id='aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')=0
         THEN 'RLS_OK' ELSE 'RLS_FAIL leak' END
) v ORDER BY ord;

-- ----------------------------------------------------------------------------
-- Limpeza total (nada persiste na BD)
-- ----------------------------------------------------------------------------
ROLLBACK;
