-- REGRA DE OURO — Prospect / Contacto / Oportunidade.
-- Um nome numa lista de prospeccao nao e um negocio. So a Oportunidade
-- (necessidade imobiliaria concreta) alimenta o funil de vendas.
--
-- Prospect entra na ordem 0; tudo o resto desce uma posicao. Prospect e
-- Contactos ficam ambas como etapa de espera (excludes_followup = true):
-- nao contam para o funil e a Power List promove dali para a frente.

do $$
declare
  b record;
  v_org uuid;
begin
  for b in
    select id, key from public.boards where key in ('compradores','proprietarios')
  loop
    select organization_id into v_org from public.boards where id = b.id;

    if exists (
      select 1 from public.board_stages
      where board_id = b.id and lower(trim(coalesce(label, name))) = 'prospect'
    ) then
      continue;
    end if;

    update public.board_stages
       set "order" = "order" + 1
     where board_id = b.id;

    insert into public.board_stages
      (board_id, organization_id, name, label, color, "order", is_default, excludes_followup)
    values
      (b.id, v_org, 'Prospect', 'Prospect', 'bg-slate-500', 0, false, true);

    update public.board_stages
       set excludes_followup = true
     where board_id = b.id
       and lower(trim(coalesce(label, name))) = 'contactos';
  end loop;
end $$;
