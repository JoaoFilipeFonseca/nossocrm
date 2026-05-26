-- ============================================================================
-- Fix RLS em automation_schedules
-- Sprint 0, commit 4 de 6 (fix descoberto pelo smoke test do mesmo commit).
--
-- A policy automation_schedules_all_service tinha sido criada como FOR ALL
-- USING(true), o que (por causa da semântica OR das policies RLS) anulava
-- o isolamento por organização em SELECT: qualquer utilizador autenticado
-- via todas as linhas de todas as organizações.
--
-- A intenção original era "deixar service_role escrever livremente", mas
-- service_role já tem BYPASSRLS por defeito no Supabase, pelo que esta
-- policy era simultaneamente redundante e perigosa.
--
-- Fix: dropar a policy FOR ALL e recriar apenas para INSERT/UPDATE/DELETE.
-- O SELECT continua a depender exclusivamente de
-- automation_schedules_select_own_org (org-scoped).
-- ============================================================================

DROP POLICY IF EXISTS automation_schedules_all_service ON automation_schedules;

DROP POLICY IF EXISTS automation_schedules_insert_service ON automation_schedules;
CREATE POLICY automation_schedules_insert_service ON automation_schedules FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS automation_schedules_update_service ON automation_schedules;
CREATE POLICY automation_schedules_update_service ON automation_schedules FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS automation_schedules_delete_service ON automation_schedules;
CREATE POLICY automation_schedules_delete_service ON automation_schedules FOR DELETE
  USING (true);
