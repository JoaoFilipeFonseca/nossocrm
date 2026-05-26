-- ============================================================================
-- Smoke E2E, Máquina de Automações Sprint 1.0
-- ============================================================================
-- Demonstra o loop completo: evento -> listener -> execute -> log.
--
-- Como correr (linha a linha, observando os resultados intermédios):
--   psql ... -f supabase/tests/automation_e2e_smoke.sql
--   OU executar via mcp__supabase__execute_sql, statement a statement.
--
-- Pré-requisitos:
--   - Migrations Sprint 0 e Sprint 1.0 aplicadas
--   - Edge Functions automation-execute e automation-event-listener deployed
--   - Secret 'automation_cron_secret' em vault
--   - Cron job 'automation-event-listener-tick' agendado (1/min)
--
-- Espera-se ver no fim:
--   - automation_executions: 1 row, status='completed'
--   - automation_node_executions: 3 rows (n1 trigger.event + n2 action.log
--     + n2.log system.log do ctx.log)
--
-- Validado em produção a 26/05/2026: execution duration=186ms.
-- ============================================================================

-- 1. Cria automação "Hello World" na org alvo
WITH auto_insert AS (
  INSERT INTO automations (id, organization_id, name, status, definition, version)
  VALUES (
    '00000000-0000-0000-0000-000000beef01',
    '29455d22-ebbf-4996-ac46-a071cb4363bf',  -- substituir pela tua org
    'Smoke E2E Hello World',
    'active',
    '{
      "nodes": [
        {"id": "n1", "atom": "trigger.event", "position": {"x":0,"y":0}, "config": {"events": ["contact.created"]}},
        {"id": "n2", "atom": "action.log", "position": {"x":200,"y":0}, "config": {"message": "Smoke E2E: novo contacto recebido", "level": "info"}}
      ],
      "edges": [
        {"id": "e1", "source": "n1", "target": "n2"}
      ]
    }'::jsonb,
    1
  )
  RETURNING id
)
INSERT INTO automation_triggers (automation_id, organization_id, trigger_type, config, is_active)
SELECT id, '29455d22-ebbf-4996-ac46-a071cb4363bf', 'event', '{"events":["contact.created"]}'::jsonb, true
FROM auto_insert;

-- 2. Insere contacto que dispara contact.created via trigger publish_events
INSERT INTO contacts (id, organization_id, name, stage)
VALUES ('00000000-0000-0000-0000-000000beef03', '29455d22-ebbf-4996-ac46-a071cb4363bf', 'SmokeE2E_v2', 'lead');

-- 3. Invoca event-listener (mesma rota usada pelo cron)
SELECT net.http_post(
  url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-event-listener',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_cron_secret' LIMIT 1)
  ),
  body := '{}'::jsonb
) AS request_id;

-- 4. (aguardar 5s para a cadeia async terminar)

-- 5. Validar
SELECT status, duration_ms, error_message, trigger_type
FROM automation_executions
WHERE automation_id = '00000000-0000-0000-0000-000000beef01';

SELECT node_id, atom_id, status, duration_ms
FROM automation_node_executions
WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id = '00000000-0000-0000-0000-000000beef01')
ORDER BY started_at;

-- 6. Cleanup
DELETE FROM automation_node_executions WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef01');
DELETE FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef01';
DELETE FROM automation_triggers WHERE automation_id='00000000-0000-0000-0000-000000beef01';
DELETE FROM automations WHERE id='00000000-0000-0000-0000-000000beef01';
DELETE FROM contacts WHERE id='00000000-0000-0000-0000-000000beef03';
DELETE FROM automation_events WHERE source='contacts_table' AND payload->>'id'='00000000-0000-0000-0000-000000beef03';
