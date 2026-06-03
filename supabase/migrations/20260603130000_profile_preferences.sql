-- PREFS-1: preferências do utilizador guardadas na conta (sincronizam desktop+mobile).
-- landing_page = rota onde o CRM abre ao entrar; dark_mode = tema (null = default do dispositivo).
alter table public.profiles
  add column if not exists landing_page text,
  add column if not exists dark_mode boolean;
