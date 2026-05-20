-- Imovel activo do bot Telegram — proximas fotos/audios sem contexto explicito
-- atribuem-se a este imovel ate o Joao criar outro ou usar /novo.
alter table public.organization_settings
  add column if not exists telegram_active_imovel_id uuid references public.imoveis(id) on delete set null;

comment on column public.organization_settings.telegram_active_imovel_id is
  'Imovel "activo" para o bot Telegram. Fotos/audios enviados sem contexto sao atribuidos a este imovel.';
