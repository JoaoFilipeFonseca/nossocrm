-- MA-DRILLDOWN — guardar a copy do criativo (título, texto, CTA) por anúncio.
-- Preenchido a partir da Marketing API (creative{title,body,call_to_action_type}).
alter table public.ad_creatives
  add column if not exists title text,
  add column if not exists body text,
  add column if not exists cta_type text;
