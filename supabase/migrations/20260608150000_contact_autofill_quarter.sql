-- CT-AUTO Fase 1 — Auto-preenchimento de custom_fields na entrada de um contacto.
--
-- Sempre que um contacto entra (manual, webhook Meta Ads, import, criar-do-negocio),
-- preenche custom_fields.quarter (ex. "Q3 2026") e custom_fields.lastActivityDate
-- (data de entrada, YYYY-MM-DD) em hora de Lisboa.
--
-- Decisao de arquitectura: 1 trigger BEFORE INSERT na BD cobre TODOS os caminhos de
-- criacao de uma vez (DRY, a prova de futuro, multi-tenant) em vez de repetir a logica
-- em cada caminho. Valores explicitos (de forms/import) ganham sempre: so preenche as
-- chaves em falta. Idempotente.

create or replace function public.contacts_autofill_custom_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  l_now timestamp;       -- hora de parede de Lisboa
  l_quarter text;
  l_date text;
  cf jsonb;
begin
  l_now := (now() at time zone 'Europe/Lisbon');
  l_quarter := 'Q' || extract(quarter from l_now)::int || ' ' || extract(year from l_now)::int;
  l_date := to_char(l_now, 'YYYY-MM-DD');

  cf := coalesce(new.custom_fields, '{}'::jsonb);

  -- So preenche se a chave nao vier ja preenchida (valor explicito ganha sempre).
  if (cf->>'quarter') is null or (cf->>'quarter') = '' then
    cf := cf || jsonb_build_object('quarter', l_quarter);
  end if;

  if (cf->>'lastActivityDate') is null or (cf->>'lastActivityDate') = '' then
    cf := cf || jsonb_build_object('lastActivityDate', l_date);
  end if;

  new.custom_fields := cf;
  return new;
end;
$$;

drop trigger if exists trg_contacts_autofill_custom_fields on public.contacts;

create trigger trg_contacts_autofill_custom_fields
  before insert on public.contacts
  for each row
  execute function public.contacts_autofill_custom_fields();
