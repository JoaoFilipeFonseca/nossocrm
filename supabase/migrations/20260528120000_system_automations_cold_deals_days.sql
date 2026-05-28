-- Sprint 28 c1: telegram-morning-brief param `cold_deals_days` editável.
-- A edge function passa a ler params da BD (loadAutomationParams) em vez de
-- constantes hardcoded. Adicionar default ao param se ainda não existir.

UPDATE system_automations
SET params = params || '{"cold_deals_days": 10}'::jsonb
WHERE key = 'telegram-morning-brief'
  AND NOT (params ? 'cold_deals_days');
