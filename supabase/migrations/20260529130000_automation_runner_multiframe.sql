-- ============================================================================
-- Engine de automações — runner multi-frame (suspend/resume)
-- Sprint 37, T4.
--
-- Aditiva e idempotente. O runner passou de cursor único para um frontier
-- multi-frame; o estado completo (frames activos + ramos suspensos + joins +
-- loops) é serializado em automation_executions.run_state. Cada ramo suspenso
-- ganha uma row em automation_schedules correlacionada por frame_id.
--
-- Colunas legacy (current_node_id, resume_node_id, resume_at) mantêm-se: o
-- resume prefere run_state quando presente e cai no caminho legacy se NULL.
-- ============================================================================

ALTER TABLE automation_executions
  ADD COLUMN IF NOT EXISTS run_state JSONB;

ALTER TABLE automation_schedules
  ADD COLUMN IF NOT EXISTS frame_id TEXT;

COMMENT ON COLUMN automation_executions.run_state IS
  'Estado serializado do runner multi-frame (frontier + suspensos + joins + loops). NULL em execuções legacy ou já concluídas.';
COMMENT ON COLUMN automation_schedules.frame_id IS
  'Correlaciona a schedule ao frame suspenso em automation_executions.run_state.frontier/suspended.';
