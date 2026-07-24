-- Pesquisa global (Ctrl+K) — contactos, negócios e imóveis num só lookup.
-- SECURITY INVOKER: corre com os privilégios do utilizador, logo o RLS de cada
-- tabela filtra automaticamente pela organização. Usa unaccent para ignorar
-- acentos (ex.: "sa" encontra "São"). Idempotente (create or replace).

create or replace function public.global_search(p_q text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with term as (select unaccent(lower(coalesce(p_q, ''))) as t)
  select jsonb_build_object(
    'contacts', (
      select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb)
      from (
        select ct.id, ct.name, ct.phone, ct.email
        from contacts ct, term
        where ct.deleted_at is null
          and length(term.t) >= 2
          and unaccent(lower(
                coalesce(ct.name, '') || ' ' || coalesce(ct.phone, '') || ' ' || coalesce(ct.email, '')
              )) like '%' || term.t || '%'
        order by ct.name
        limit 8
      ) c
    ),
    'deals', (
      select coalesce(jsonb_agg(row_to_json(d)), '[]'::jsonb)
      from (
        select dl.id, dl.title, dl.value, ct.name as contact_name
        from deals dl
        left join contacts ct on ct.id = dl.contact_id
        cross join term
        where dl.deleted_at is null
          and length(term.t) >= 2
          and unaccent(lower(
                coalesce(dl.title, '') || ' ' || coalesce(ct.name, '')
              )) like '%' || term.t || '%'
        order by dl.created_at desc
        limit 8
      ) d
    ),
    'imoveis', (
      select coalesce(jsonb_agg(row_to_json(i)), '[]'::jsonb)
      from (
        select im.id, im.referencia, im.morada, im.tipologia, im.concelho
        from imoveis im, term
        where length(term.t) >= 2
          and unaccent(lower(
                coalesce(im.referencia, '') || ' ' || coalesce(im.morada, '') || ' ' ||
                coalesce(im.tipologia, '') || ' ' || coalesce(im.concelho, '')
              )) like '%' || term.t || '%'
        order by im.created_at desc
        limit 8
      ) i
    )
  );
$$;
