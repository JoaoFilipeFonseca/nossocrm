-- REGRA DE OURO (bloqueio) — nao se entra no funil sem valor estimado.
--
-- Um negocio so sai das etapas de espera (Prospect, Contactos) para o funil
-- (Oportunidade em diante) se tiver valor estimado. Vive na base de dados, e
-- nao na interface, para que TODOS os caminhos obedecam: arrastar no kanban,
-- modal de mover, API publica, ferramentas da IA e automacoes.
--
-- EXCEPCAO DELIBERADA: so dispara em UPDATE, nunca em INSERT. Uma lead que
-- entra de um formulario ou de um anuncio cai directamente em "Oportunidade"
-- sem valor conhecido — bloquear ai era PERDER a lead, que e sempre pior.
-- Essa entra e fica a pedir o valor.

create or replace function public.check_valor_antes_do_funil()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_de_espera boolean;
  v_para_espera boolean;
  v_label text;
begin
  if new.stage_id is null or new.stage_id is not distinct from old.stage_id then
    return new;
  end if;

  select excludes_followup into v_de_espera
    from board_stages where id = old.stage_id;
  select excludes_followup, coalesce(label, name) into v_para_espera, v_label
    from board_stages where id = new.stage_id;

  if coalesce(v_de_espera, false) = true and coalesce(v_para_espera, true) = false then
    if coalesce(new.value, 0) <= 0 then
      raise exception
        'Sem valor estimado nao entra no funil. Preenche o valor do negocio antes de o mover para "%".', v_label
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_valor_antes_do_funil on public.deals;
create trigger trg_valor_antes_do_funil
  before update on public.deals
  for each row
  execute function public.check_valor_antes_do_funil();
