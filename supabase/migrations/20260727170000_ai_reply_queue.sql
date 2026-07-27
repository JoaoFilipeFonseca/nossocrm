-- AI reply queue — "timing humano" para as respostas automáticas dos agentes.
--
-- Problema: a função de resposta corre no máximo 60s, por isso não pode "esperar
-- 3 minutos lá dentro". Solução: fila agendada + tique de minuto (pg_cron).
--
-- Regra: primeira mensagem (ou depois de >30 min de silêncio) responde ao minuto 3;
-- conversa a decorrer responde em ~40s. O relógio (cron) envia quando chega a hora.

-- 1. Tabela da fila (uma resposta pendente por conversa)
CREATE TABLE IF NOT EXISTS public.scheduled_ai_replies (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         uuid NOT NULL,
  conversation_id         uuid NOT NULL,
  last_inbound_message_id uuid,
  last_inbound_text       text,
  due_at                  timestamptz NOT NULL,
  status                  text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','sent','cancelled')),
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id)
);

CREATE INDEX IF NOT EXISTS scheduled_ai_replies_due_idx
  ON public.scheduled_ai_replies (status, due_at);

-- 2. RLS: membros da org podem ver (o envio é feito pelo cron com service role)
ALTER TABLE public.scheduled_ai_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_ai_replies_org_read" ON public.scheduled_ai_replies;
CREATE POLICY "scheduled_ai_replies_org_read"
  ON public.scheduled_ai_replies FOR SELECT
  USING (organization_id = get_user_org_id());

-- 3. updated_at automático
CREATE OR REPLACE FUNCTION public.touch_scheduled_ai_replies_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS scheduled_ai_replies_updated_at ON public.scheduled_ai_replies;
CREATE TRIGGER scheduled_ai_replies_updated_at
  BEFORE UPDATE ON public.scheduled_ai_replies
  FOR EACH ROW EXECUTE FUNCTION public.touch_scheduled_ai_replies_updated_at();

-- 4. Registo em /automacoes (system_automations) — como as outras automações de sistema
INSERT INTO public.system_automations (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, kind)
SELECT 'ai-reply-timing',
       'Resposta com timing humano',
       'Dá às respostas automáticas dos agentes (Clara, Sofia) um tempo humano: a primeira mensagem responde ao minuto 3, uma conversa a decorrer responde em ~40 segundos. Nunca instantâneo, para não soar a robô.',
       '⏳',
       'ai-reply-tick',
       '* * * * *',
       'https://crm.joaofilipefonseca.pt/api/cron/ai-replies',
       true,
       'cron'
WHERE NOT EXISTS (SELECT 1 FROM public.system_automations WHERE key = 'ai-reply-timing');

-- 5. Tique de minuto via pg_cron → chama a rota da app com o segredo de cron
DO $unsched$
BEGIN
  PERFORM cron.unschedule('ai-reply-tick');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$unsched$;

SELECT cron.schedule('ai-reply-tick', '* * * * *', $job$
  SELECT net.http_post(
    url := 'https://crm.joaofilipefonseca.pt/api/cron/ai-replies',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
$job$);
