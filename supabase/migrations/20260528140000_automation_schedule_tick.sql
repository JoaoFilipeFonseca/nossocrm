-- Sprint 32 c1 — suporte a trigger.schedule.
--
-- 1. Helper `automation_calc_next_schedule(cron, after)` calcula proximo
--    momento de disparo para um subset comum de cron expressions.
-- 2. Entry em `system_automations` para que `automation-schedule-tick`
--    apareca em /automacoes/sistema (regra critica inegociavel).

-- ===========================================================================
-- 1. Helper SQL para calcular proximo disparo
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.automation_calc_next_schedule(p_cron text, p_after timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  parts text[];
  v_min text;
  v_hour text;
  v_dom text;
  v_mon text;
  v_dow text;
  step int;
  ref timestamptz;
  candidate timestamptz;
  i int;
BEGIN
  IF p_cron IS NULL OR length(trim(p_cron)) = 0 THEN
    RETURN NULL;
  END IF;

  parts := regexp_split_to_array(trim(p_cron), '\s+');
  IF array_length(parts, 1) <> 5 THEN
    RETURN NULL;
  END IF;

  v_min := parts[1];
  v_hour := parts[2];
  v_dom := parts[3];
  v_mon := parts[4];
  v_dow := parts[5];

  ref := COALESCE(p_after, now());

  -- Padrao 1: */N * * * *  (a cada N minutos)
  IF v_min LIKE '*/%' AND v_hour = '*' AND v_dom = '*' AND v_mon = '*' AND v_dow = '*' THEN
    step := substring(v_min FROM 3)::int;
    IF step < 1 OR step > 59 THEN RETURN NULL; END IF;
    RETURN date_trunc('minute', ref) + (step || ' minutes')::interval;
  END IF;

  -- Padrao 2: M H * * *  (diariamente as H:M UTC)
  IF v_min ~ '^\d+$' AND v_hour ~ '^\d+$' AND v_dom = '*' AND v_mon = '*' AND v_dow = '*' THEN
    candidate := date_trunc('day', ref) + (v_hour || ' hours')::interval + (v_min || ' minutes')::interval;
    IF candidate <= ref THEN
      candidate := candidate + interval '1 day';
    END IF;
    RETURN candidate;
  END IF;

  -- Padrao 3: M H * * D  (semanalmente DOW 0-6 as H:M)
  IF v_min ~ '^\d+$' AND v_hour ~ '^\d+$' AND v_dom = '*' AND v_mon = '*' AND v_dow ~ '^\d$' THEN
    candidate := date_trunc('day', ref) + (v_hour || ' hours')::interval + (v_min || ' minutes')::interval;
    -- Avanca ate apanhar DOW pretendido E ficar > ref
    FOR i IN 0..7 LOOP
      IF EXTRACT(DOW FROM candidate)::int = v_dow::int AND candidate > ref THEN
        RETURN candidate;
      END IF;
      candidate := candidate + interval '1 day';
    END LOOP;
    RETURN NULL;
  END IF;

  -- Padrao 4: M H D * *  (mensalmente dia D as H:M)
  IF v_min ~ '^\d+$' AND v_hour ~ '^\d+$' AND v_dom ~ '^\d+$' AND v_mon = '*' AND v_dow = '*' THEN
    candidate := date_trunc('month', ref) + ((v_dom::int - 1) || ' days')::interval
               + (v_hour || ' hours')::interval + (v_min || ' minutes')::interval;
    IF candidate <= ref THEN
      candidate := date_trunc('month', ref + interval '1 month') + ((v_dom::int - 1) || ' days')::interval
                 + (v_hour || ' hours')::interval + (v_min || ' minutes')::interval;
    END IF;
    RETURN candidate;
  END IF;

  -- Padrao nao reconhecido
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.automation_calc_next_schedule(text, timestamptz) IS
  'Calcula proximo disparo de cron expression simplificada (4 padroes basicos). NULL se cron nao reconhecido.';

-- ===========================================================================
-- 2. Entry em system_automations para a edge function de tick
-- ===========================================================================
INSERT INTO system_automations (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
VALUES (
  'automation-schedule-tick',
  'Disparador de horarios programados',
  'A cada minuto: verifica triggers do tipo schedule e dispara automacoes cujo next_run_at chegou. Recalcula proximo disparo via helper SQL.',
  '⏰',
  'automation-schedule-tick',
  '* * * * *',
  'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-schedule-tick',
  true,
  '{}'::jsonb
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  cron_expression = EXCLUDED.cron_expression,
  function_url = EXCLUDED.function_url,
  updated_at = now();
