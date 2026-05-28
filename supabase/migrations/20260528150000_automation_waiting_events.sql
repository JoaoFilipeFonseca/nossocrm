-- Sprint 32 c3 — suporte a logic.wait_until (esperar evento OU timeout).
--
-- Tabela `automation_waiting_events` regista quais execucoes estao suspensas
-- a aguardar um evento canonico do sistema. Quando o automation-event-listener
-- processa eventos, faz match contra esta tabela e retoma execucoes.

CREATE TABLE IF NOT EXISTS public.automation_waiting_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.automation_executions(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  event_type text NOT NULL,
  contact_match uuid,            -- se non-null, evento tem de ter este contact_id no payload
  deal_match uuid,               -- idem para deal_id
  timeout_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','matched','timeout','cancelled')),
  matched_event_id uuid,         -- FK opcional para automation_events.id que disparou match
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_aut_waiting_events_match
  ON public.automation_waiting_events (organization_id, event_type, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_aut_waiting_events_execution
  ON public.automation_waiting_events (execution_id);

CREATE INDEX IF NOT EXISTS idx_aut_waiting_events_timeout
  ON public.automation_waiting_events (timeout_at)
  WHERE status = 'pending';

-- RLS: service role only (engine + edge). Sem acesso anon/authenticated direto.
ALTER TABLE public.automation_waiting_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS automation_waiting_events_service_only ON public.automation_waiting_events;
CREATE POLICY automation_waiting_events_service_only
  ON public.automation_waiting_events
  FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.automation_waiting_events IS
  'Sprint 32 c3 — registos de execucoes suspensas a aguardar eventos canonicos. listener processa pending vs eventos novos.';
