-- D (QA 10/06/2026): board por omissão para leads Meta sem campanha mapeada.
-- Sem isto, leads de campanhas não encaminhadas em `meta_lead_routing` ficavam
-- apenas como contacto, SEM negócio — invisíveis ao funil e ao motor de
-- follow-up "nunca perder uma lead". Configurável por org (multi-tenant).

alter table public.organization_settings
  add column if not exists default_lead_board_id uuid references public.boards(id) on delete set null,
  add column if not exists default_lead_stage_id uuid references public.board_stages(id) on delete set null;

comment on column public.organization_settings.default_lead_board_id is
  'Board por omissão onde caem leads Meta sem encaminhamento por campanha (não deixar a lead órfã).';
comment on column public.organization_settings.default_lead_stage_id is
  'Etapa por omissão dentro de default_lead_board_id; se nula, a edge usa a 1.ª etapa do board.';

-- Seed da org do João: Compradores / Oportunidade. Catch-all sensato (as Lead
-- Ads são tipicamente de compradores) e reversível — o João reatribui a campanha
-- em /anuncios quando quiser. Idempotente: só preenche se ainda estiver nulo.
update public.organization_settings
set default_lead_board_id = 'a70c40c7-5f9f-499b-9f39-f74cd9c596cf',
    default_lead_stage_id = '6bd91fc8-a4f5-4235-831b-e65ac9dc5154'
where organization_id = '29455d22-ebbf-4996-ac46-a071cb4363bf'
  and default_lead_board_id is null;
