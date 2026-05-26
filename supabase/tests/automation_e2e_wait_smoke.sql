-- ============================================================================
-- Smoke E2E, Sprint 1.2: wait_fixed + LiquidJS + suspend/resume
-- ============================================================================
-- Demonstra a cadeia completa:
--   contact.created
--      -> action.log (msg interpola {{contact.name}})
--      -> logic.wait_fixed(30s)         (execução fica status='waiting')
--      -> [pg_cron automation-resume-tick @ 1/min, OU invocação manual]
--      -> action.send_telegram (msg interpola {{contact.name}}, {{contact.stage}})
--
-- Validado live (26/05/2026):
--   - n2 log saiu "lead recebido: TestWait Maria"
--   - n3 wait_fixed suspendeu, automation_schedules.status=pending
--   - resume invocado, executor retomou de n4
--   - n4 enviou Telegram com {{contact.name}} interpolado
--   - automation_executions.status=completed
-- ============================================================================

WITH auto_insert AS (
  INSERT INTO automations (id, organization_id, name, status, definition, version)
  VALUES (
    '00000000-0000-0000-0000-000000beef21',
    '29455d22-ebbf-4996-ac46-a071cb4363bf',
    'Sprint 1.2 Smoke - Wait + Liquid',
    'active',
    '{
      "nodes": [
        {"id": "n1", "atom": "trigger.event", "position": {"x":0,"y":0}, "config": {"events": ["contact.created"]}},
        {"id": "n2", "atom": "action.log", "position": {"x":200,"y":0}, "config": {"message": "lead recebido: {{contact.name}}", "level": "info"}},
        {"id": "n3", "atom": "logic.wait_fixed", "position": {"x":400,"y":0}, "config": {"seconds": 30}},
        {"id": "n4", "atom": "action.send_telegram", "position": {"x":600,"y":0}, "config": {"text": "🤖 <b>Sprint 1.2 smoke</b>\nOlá {{contact.name}}!\nFoste criado há ~30s e o motor esperou antes de te avisar.\nStage: {{contact.stage}}"}}
      ],
      "edges": [
        {"id": "e1", "source": "n1", "target": "n2"},
        {"id": "e2", "source": "n2", "target": "n3"},
        {"id": "e3", "source": "n3", "target": "n4"}
      ]
    }'::jsonb,
    1
  )
  RETURNING id
)
INSERT INTO automation_triggers (automation_id, organization_id, trigger_type, config, is_active)
SELECT id, '29455d22-ebbf-4996-ac46-a071cb4363bf', 'event', '{"events":["contact.created"]}'::jsonb, true
FROM auto_insert;

INSERT INTO contacts (id, organization_id, name, stage)
VALUES ('00000000-0000-0000-0000-000000beef22', '29455d22-ebbf-4996-ac46-a071cb4363bf', 'TestWait Maria', 'lead');

-- Dispara listener (cron equivalent)
SELECT net.http_post(
  url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-event-listener',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_cron_secret' LIMIT 1)
  ),
  body := '{}'::jsonb
);

-- (aguardar ~8s -> execução fica status='waiting' em automation_executions)
-- (aguardar até resume_at, OU invocar resume manualmente)

SELECT net.http_post(
  url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-resume',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_cron_secret' LIMIT 1)
  ),
  body := '{}'::jsonb
);

-- (aguardar ~5s -> execução fica completed, telegram chega)

SELECT status, duration_ms, current_node_id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef21';

SELECT node_id, atom_id, status, output->>'message_id' AS tg_msg, output->>'_suspend' AS suspended
FROM automation_node_executions
WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef21')
  AND atom_id != 'system.log'
ORDER BY started_at;

-- Cleanup
DELETE FROM automation_schedules WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef21');
DELETE FROM automation_node_executions WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef21');
DELETE FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef21';
DELETE FROM automation_triggers WHERE automation_id='00000000-0000-0000-0000-000000beef21';
DELETE FROM automations WHERE id='00000000-0000-0000-0000-000000beef21';
DELETE FROM contacts WHERE id='00000000-0000-0000-0000-000000beef22';
DELETE FROM automation_events WHERE source='contacts_table' AND payload->>'id'='00000000-0000-0000-0000-000000beef22';
