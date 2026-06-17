-- Bug #17: contadores de execução das automações do utilizador nunca subiam.
--
-- A edge function `automation-execute` finaliza a linha em `automation_executions`
-- (status completed/failed) mas NUNCA actualizava `automations.total_executions` /
-- `success_count` / `failure_count` / `last_execution_at`, e não havia trigger.
-- Resultado: o cartão em /automacoes e o cabeçalho do builder ("X totais · Y OK")
-- mostravam sempre 0 execuções mesmo depois de a automação correr e completar.
--
-- Correcção: trigger que incrementa os contadores quando uma execução transita
-- para estado terminal (completed/failed), uma única vez por execução, e SÓ para
-- execuções reais (is_test = false — as de teste aparecem na lista mas não contam).
-- Cobre todos os caminhos (manual, cron-tick, resume) porque depende só do estado
-- final da linha, não do código que a escreve.

CREATE OR REPLACE FUNCTION public.bump_automation_exec_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só conta na transição PARA terminal (evita dupla contagem em waiting→running→completed)
  -- e ignora execuções de teste.
  IF NEW.is_test IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('completed', 'failed') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  UPDATE public.automations
  SET
    total_executions = total_executions + 1,
    success_count = success_count + (CASE WHEN NEW.status = 'completed' THEN 1 ELSE 0 END),
    failure_count = failure_count + (CASE WHEN NEW.status = 'failed' THEN 1 ELSE 0 END),
    last_execution_at = COALESCE(NEW.completed_at, NOW())
  WHERE id = NEW.automation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_automation_exec_counters ON public.automation_executions;

CREATE TRIGGER tg_automation_exec_counters
AFTER UPDATE OF status ON public.automation_executions
FOR EACH ROW
EXECUTE FUNCTION public.bump_automation_exec_counters();
