-- Sprint 13 c2: permitir CHQ associado a contacto sem deal.
-- deal_id passa a ser NULLABLE; adiciona contact_id e owner_id opcionais.
-- A constraint nova garante que pelo menos um de (deal_id, contact_id) existe.

alter table public.deal_activities
  alter column deal_id drop not null;

alter table public.deal_activities
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

alter table public.deal_activities
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

alter table public.deal_activities
  drop constraint if exists deal_activities_deal_or_contact_chk;

alter table public.deal_activities
  add constraint deal_activities_deal_or_contact_chk
  check (deal_id is not null or contact_id is not null);

create index if not exists idx_deal_activities_contact_id
  on public.deal_activities (contact_id) where contact_id is not null;

create index if not exists idx_deal_activities_owner_created
  on public.deal_activities (owner_id, created_at desc) where owner_id is not null;

comment on column public.deal_activities.contact_id is 'Sprint 13 c2: CHQ pode estar associado directamente a um contacto sem deal.';
comment on column public.deal_activities.owner_id is 'Sprint 13 c2: utilizador que registou a CHQ (para filtros por consultor).';
