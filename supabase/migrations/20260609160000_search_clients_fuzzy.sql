-- IA-7 Fase 1 — Assistente 360 no bot do CRM.
-- Procura difusa de clientes a partir de um NOME ou de uma DESCRIÇÃO VAGA (zona, tipologia
-- "T3", motivo/trigger, origem). Pontua cada contacto pelo nº de palavras da consulta que
-- aparecem no texto pesquisável (nome + origem + telefone + empresa + email + custom_fields),
-- com unaccent (acentos não falham — ver feedback_lookups_externos_unaccent). SECURITY DEFINER
-- com search_path pinado; filtra estritamente pela organização.

create or replace function public.search_clients_fuzzy(p_org uuid, p_query text, p_limit int default 6)
returns table (id uuid, name text, source text, phone text, custom_fields jsonb, company_name text, score int)
language sql
stable
security definer
set search_path = public
as $$
  with words as (
    select distinct w
    from regexp_split_to_table(lower(unaccent(coalesce(p_query, ''))), '\s+') as w
    where length(w) >= 2
      and w not in (
        'de','da','do','no','na','os','as','um','ao','se','ou','em','com','por','que','para',
        'dos','das','uma','tem','quer','queria','andava','ver','senhor','senhora','cliente',
        'sobre','fala','diz','quem','sou','foi','era','este','esse','aquele','meu','seu'
      )
  ),
  scored as (
    select c.id, c.name, c.source, c.phone, c.custom_fields, c.company_name,
      (
        select count(*)
        from words w
        where lower(unaccent(
          coalesce(c.name,'') || ' ' || coalesce(c.source,'') || ' ' || coalesce(c.phone,'') || ' ' ||
          coalesce(c.company_name,'') || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.custom_fields::text,'')
        )) like '%' || w || '%'
      )::int as score
    from contacts c
    where c.organization_id = p_org
  )
  select id, name, source, phone, custom_fields, company_name, score
  from scored
  where score > 0
  order by score desc, name asc
  limit greatest(1, least(p_limit, 12));
$$;

grant execute on function public.search_clients_fuzzy(uuid, text, int) to authenticated, service_role;
