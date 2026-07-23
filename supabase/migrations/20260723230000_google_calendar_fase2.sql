-- ============================================================================
-- TAREFAS FASE 2 — Google Calendar (empurrar em tempo real)
-- ============================================================================
-- O CRM é a fonte da verdade. Cada tarefa (activities) é espelhada num
-- calendário DEDICADO do Google ("Foco Imo — Tarefas"). Um sentido só.
--
-- Peças:
--   1) RPCs de Vault para as credenciais da app Google e o refresh token.
--   2) Colunas de sincronização em `activities`.
--   3) Tabela de remoções pendentes (o DELETE é físico: guardamos o event id).
--   4) Triggers: marcam pendente e chamam a rota de sync via pg_net (tempo real).
--   5) Registo em /automacoes + cron de recuperação (rede de segurança).
--
-- Idempotente. Enquanto o João não ligar a conta Google, os triggers ficam
-- inertes (verificam se existe integração activa antes de fazer seja o que for).
-- ============================================================================

-- ── 1) Vault: credenciais da app + refresh token ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_google_oauth_credentials()
RETURNS TABLE(client_id text, client_secret text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'google_oauth_client_id'     LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'google_oauth_client_secret' LIMIT 1);
$$;

CREATE OR REPLACE FUNCTION public.google_oauth_store_token(p_name text, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_token, p_name, 'Refresh token OAuth Google (Calendar)');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.google_oauth_read_token(p_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.google_oauth_delete_token(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_google_oauth_credentials()          FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_oauth_store_token(text, text)    FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_oauth_read_token(text)           FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.google_oauth_delete_token(text)         FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_oauth_credentials()       TO service_role;
GRANT EXECUTE ON FUNCTION public.google_oauth_store_token(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.google_oauth_read_token(text)        TO service_role;
GRANT EXECUTE ON FUNCTION public.google_oauth_delete_token(text)      TO service_role;

-- ── 2) Colunas de sincronização em activities ───────────────────────────────
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS google_event_id text;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS google_sync_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS google_sync_error text;

-- Índice para o cron drenar depressa só o que falta.
CREATE INDEX IF NOT EXISTS activities_google_sync_pending_idx
  ON public.activities(organization_id)
  WHERE google_sync_pending = true;

-- ── 3) Remoções pendentes (DELETE é físico: preservar o event id) ───────────
CREATE TABLE IF NOT EXISTS public.google_calendar_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.google_calendar_deletions ENABLE ROW LEVEL SECURITY;

-- Só o service_role lhe toca (a UI nunca precisa desta fila).
DROP POLICY IF EXISTS google_calendar_deletions_service ON public.google_calendar_deletions;
CREATE POLICY google_calendar_deletions_service ON public.google_calendar_deletions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS google_calendar_deletions_org_idx
  ON public.google_calendar_deletions(organization_id);

-- ── 4) Triggers ─────────────────────────────────────────────────────────────
-- Só há trabalho a fazer se a org tiver a integração Google activa.
CREATE OR REPLACE FUNCTION public.google_calendar_org_active(p_org uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.automation_integrations
    WHERE organization_id = p_org AND provider = 'google' AND status = 'active'
  );
$$;

-- (a) BEFORE: marca a tarefa como pendente de sincronização.
-- Ignora updates que só mexem nas próprias colunas google_* (senão a escrita
-- da rota de sync voltava a marcar pendente — ciclo infinito).
CREATE OR REPLACE FUNCTION public.activities_google_mark_pending()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.google_calendar_org_active(NEW.organization_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND
     OLD.title       IS NOT DISTINCT FROM NEW.title       AND
     OLD.description IS NOT DISTINCT FROM NEW.description AND
     OLD.type        IS NOT DISTINCT FROM NEW.type        AND
     OLD.date        IS NOT DISTINCT FROM NEW.date        AND
     OLD.completed   IS NOT DISTINCT FROM NEW.completed   AND
     OLD.deal_id     IS NOT DISTINCT FROM NEW.deal_id     AND
     OLD.contact_id  IS NOT DISTINCT FROM NEW.contact_id  AND
     OLD.deleted_at  IS NOT DISTINCT FROM NEW.deleted_at
  THEN
    RETURN NEW; -- só mudaram colunas de sync: não remarcar
  END IF;

  NEW.google_sync_pending := true;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS activities_google_mark_pending_trg ON public.activities;
CREATE TRIGGER activities_google_mark_pending_trg
  BEFORE INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_google_mark_pending();

-- (b) AFTER: empurra em tempo real (pg_net -> rota de sync no Vercel).
CREATE OR REPLACE FUNCTION public.activities_google_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  IF NOT NEW.google_sync_pending THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := 'https://crm.joaofilipefonseca.pt/api/integrations/google/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', v_secret),
    body := jsonb_build_object('organization_id', NEW.organization_id, 'activity_id', NEW.id),
    timeout_milliseconds := 20000
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS activities_google_push_trg ON public.activities;
CREATE TRIGGER activities_google_push_trg
  AFTER INSERT OR UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_google_push();

-- (c) AFTER DELETE: guarda o event id para remover lá, e empurra.
CREATE OR REPLACE FUNCTION public.activities_google_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  IF OLD.google_event_id IS NULL OR NOT public.google_calendar_org_active(OLD.organization_id) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.google_calendar_deletions (organization_id, google_event_id)
  VALUES (OLD.organization_id, OLD.google_event_id);

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret' LIMIT 1;
  IF v_secret IS NULL THEN
    RETURN NULL;
  END IF;

  PERFORM net.http_post(
    url := 'https://crm.joaofilipefonseca.pt/api/integrations/google/sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', v_secret),
    body := jsonb_build_object('organization_id', OLD.organization_id),
    timeout_milliseconds := 20000
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS activities_google_deleted_trg ON public.activities;
CREATE TRIGGER activities_google_deleted_trg
  AFTER DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.activities_google_deleted();

-- ── 5) Registo em /automacoes + cron de recuperação ─────────────────────────
INSERT INTO public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
VALUES
  ('google-calendar-sync',
   'Google Calendar — espelho das tarefas',
   'Empurra as tarefas do CRM para o calendário dedicado "Foco Imo — Tarefas" no Google. '
   || 'Em tempo real: criar, editar, concluir, adiar ou apagar uma tarefa actualiza logo o evento '
   || '(a base de dados chama a sincronização assim que a tarefa muda). De 10 em 10 minutos volta a '
   || 'passar como rede de segurança, para apanhar o que tenha falhado. O CRM é a fonte da verdade: '
   || 'a ligação é num sentido só e o CRM nunca lê o resto da tua agenda.',
   '📅',
   'google-calendar-sync',
   '*/10 * * * *',
   'https://crm.joaofilipefonseca.pt/api/integrations/google/sync',
   true,
   '{"batch_size": 50}'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  cron_expression = excluded.cron_expression,
  function_url = excluded.function_url,
  params = excluded.params;

DO $$
BEGIN
  PERFORM cron.unschedule('google-calendar-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'google-calendar-sync',
  '*/10 * * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://crm.joaofilipefonseca.pt/api/integrations/google/sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'backup_cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cmd$
);
