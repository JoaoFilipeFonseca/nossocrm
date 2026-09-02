-- Recomeço da contagem (RESET-1).
--
-- O Painel Diário passou a distinguir "o que a máquina fez" de "o que eu fiz".
-- A partir desta marca, só um toque HUMANO (deal_activities.actor = 'human')
-- registado em ou depois de `counters_reset_at` faz um negócio contar como
-- "a trabalhar" e entrar no pipeline previsto. Tudo o resto — importações,
-- movimentos por SQL, leads que entraram sozinhas, notas de automação — fica
-- como história, com a data de entrada intacta, mas não alimenta contadores.
--
-- NULL = sem recomeço; conta tudo desde sempre (comportamento de origem, e o
-- que qualquer instância nova tem por omissão).

alter table public.organization_settings
  add column if not exists counters_reset_at timestamptz;

comment on column public.organization_settings.counters_reset_at is
  'Marca de recomeço da contagem. Só toques humanos em deal_activities a partir '
  'desta data fazem um negócio contar como "a trabalhar"/pipeline previsto no '
  'Painel Diário. NULL = conta tudo desde sempre.';
