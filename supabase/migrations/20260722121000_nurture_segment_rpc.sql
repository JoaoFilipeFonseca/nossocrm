-- BRIEF 7 / 7b — Segmentação da base.
--
-- `nurture_segment_base(org, only_unset)` classifica os contactos nos 5 segmentos
-- a partir do histórico real (funil do negócio + origem + fecho), de forma
-- determinística e instantânea (cobre 100% da base). É o alicerce; a IA refina
-- por cima (rota /api/nurture/segment/run) e o João corrige inline.
--
-- Nunca sobrepõe uma correcção humana (segment_set_by = 'human') quando
-- only_unset = true.

create or replace function public.nurture_segment_base(
  p_org uuid,
  p_only_unset boolean default true
)
returns table(segment text, n bigint)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.contacts c
    set segment = x.seg,
        segment_set_by = 'ai',
        segment_rationale = x.rat,
        segment_updated_at = now()
  from (
    select
      cand.id,
      case
        when cand.has_won then 'ex_cliente'
        when cand.source ilike '%CIPS%' or cand.source ilike '%Conhecimento Pessoal%'
             or cand.top_board ilike '%parceiro%' then 'referenciador'
        when cand.top_board ilike '%proprie%' then 'proprietario_vendedor'
        when cand.top_board ilike '%arrenda%' then 'comprador'
        when cand.top_board ilike '%compra%' then 'comprador'
        when cand.source ilike 'base-proprietarios-maia' or cand.source ilike 'radar-fsbo'
             or cand.source ilike '%calculadora%' or cand.source ilike 'Form Calculadora' then 'proprietario_vendedor'
        else 'curioso'
      end as seg,
      case
        when cand.has_won then 'Já fechou negócio consigo. Trate-o como ex-cliente (referências e novas necessidades).'
        when cand.source ilike '%CIPS%' or cand.source ilike '%Conhecimento Pessoal%'
             or cand.top_board ilike '%parceiro%' then 'Contacto de rede ou parceria; potencial referenciador.'
        when cand.top_board ilike '%proprie%' then 'Está no funil Proprietários. Tem imóvel ou pondera vender.'
        when cand.top_board ilike '%arrenda%' then 'Está no funil Arrendamento. Procura casa para arrendar.'
        when cand.top_board ilike '%compra%' then 'Está no funil Compradores. Procura casa para comprar.'
        when cand.source ilike 'base-proprietarios-maia' or cand.source ilike 'radar-fsbo'
             or cand.source ilike '%calculadora%' or cand.source ilike 'Form Calculadora'
             then 'A origem (' || coalesce(nullif(cand.source, ''), 'sem origem') || ') indica proprietário a pensar vender.'
        else 'Sem sinais fortes de intenção. Contacto a aquecer aos poucos.'
      end as rat
    from (
      select
        c.id,
        c.source,
        exists (
          select 1 from public.deals d
          where d.contact_id = c.id and d.deleted_at is null and d.is_won
        ) as has_won,
        (
          select b.name from public.deals d
          join public.boards b on b.id = d.board_id
          where d.contact_id = c.id and d.deleted_at is null
          order by d.created_at desc
          limit 1
        ) as top_board
      from public.contacts c
      where c.organization_id = p_org
        and c.deleted_at is null
        and (
          not p_only_unset
          or c.segment is null
          or coalesce(c.segment_set_by, '') <> 'human'
        )
    ) cand
  ) x
  where c.id = x.id;

  return query
    select c.segment, count(*)::bigint
    from public.contacts c
    where c.organization_id = p_org and c.deleted_at is null
    group by c.segment
    order by count(*) desc;
end;
$function$;

revoke all on function public.nurture_segment_base(uuid, boolean) from public;
grant execute on function public.nurture_segment_base(uuid, boolean) to service_role;
