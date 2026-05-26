-- ============================================================================
-- Smoke E2E, Sprint 1.1, fluxo Telegram completo
-- ============================================================================
-- Demonstra contact.created -> http_request -> send_telegram, com ping real
-- ao bot Telegram do CRM (organization_settings.telegram_crm_*).
--
-- Pré-requisitos:
--   - Sprint 0 + 1.0 migrations aplicadas
--   - Edge Functions automation-execute v3 e automation-event-listener
--   - organization_settings.telegram_crm_bot_token e telegram_crm_chat_id
--     populados na org alvo
--
-- Validado em produção a 26/05/2026: execution 1657ms total,
-- telegram message_id 195 entregue.
-- ============================================================================

WITH auto_insert AS (
  INSERT INTO automations (id, organization_id, name, status, definition, version)
  VALUES (
    '00000000-0000-0000-0000-000000beef11',
    '29455d22-ebbf-4996-ac46-a071cb4363bf',
    'Sprint 1.1 Smoke - Novo Lead Telegram',
    'active',
    '{
      "nodes": [
        {"id": "n1", "atom": "trigger.event", "position": {"x":0,"y":0}, "config": {"events": ["contact.created"]}},
        {"id": "n2", "atom": "action.http_request", "position": {"x":200,"y":0}, "config": {"method": "GET", "url": "https://httpbin.org/status/200"}},
        {"id": "n3", "atom": "action.send_telegram", "position": {"x":400,"y":0}, "config": {"text": "🤖 <b>Sprint 1.1 smoke</b>\nNovo contacto entrou no CRM via Máquina de Automações.\n\nFluxo: contact.created → http_request(httpbin 200) → send_telegram.\nSe estás a ler isto, o motor funciona end-to-end."}}
      ],
      "edges": [
        {"id": "e1", "source": "n1", "target": "n2"},
        {"id": "e2", "source": "n2", "target": "n3"}
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
VALUES ('00000000-0000-0000-0000-000000beef12', '29455d22-ebbf-4996-ac46-a071cb4363bf', 'SprintBeefLead', 'lead');

SELECT net.http_post(
  url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-event-listener',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_cron_secret' LIMIT 1)
  ),
  body := '{}'::jsonb
) AS request_id;

-- (aguardar ~8s para a cadeia async terminar)

SELECT status, duration_ms, error_message FROM automation_executions
WHERE automation_id = '00000000-0000-0000-0000-000000beef11';

SELECT node_id, atom_id, status, output->>'ok' AS ok, output->>'message_id' AS telegram_msg, duration_ms
FROM automation_node_executions
WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef11')
  AND atom_id != 'system.log'
ORDER BY started_at;

-- Cleanup
DELETE FROM automation_node_executions WHERE execution_id IN (SELECT id FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef11');
DELETE FROM automation_executions WHERE automation_id='00000000-0000-0000-0000-000000beef11';
DELETE FROM automation_triggers WHERE automation_id='00000000-0000-0000-0000-000000beef11';
DELETE FROM automations WHERE id='00000000-0000-0000-0000-000000beef11';
DELETE FROM contacts WHERE id='00000000-0000-0000-0000-000000beef12';
DELETE FROM automation_events WHERE source='contacts_table' AND payload->>'id'='00000000-0000-0000-0000-000000beef12';
