-- Meta Ads Fase A — polish c4.1
-- Negócio herda a atribuição (linhagem do anúncio Meta) do contacto de origem
-- quando é criado sem atribuição própria. Cobre todos os caminhos de criação
-- de negócio num só ponto (modal, tools IA, import, API pública).
-- Plumbing de dados no próprio INSERT do utilizador (mesma natureza do trigger
-- que auto-preenche organization_id) — não é automação de background/cron.

create or replace function public.deals_inherit_attribution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Só preenche se o negócio não trouxer atribuição própria
  -- (não sobrepõe a atribuição que o webhook de leads já define).
  if new.attribution is null and new.contact_id is not null then
    select c.attribution
      into new.attribution
      from public.contacts c
     where c.id = new.contact_id
       and c.organization_id = new.organization_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_deals_inherit_attribution on public.deals;
create trigger trg_deals_inherit_attribution
  before insert on public.deals
  for each row
  execute function public.deals_inherit_attribution();
