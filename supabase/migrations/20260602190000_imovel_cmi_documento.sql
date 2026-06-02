-- AUD-A2: ligar o documento CMI carregado ao registo imovel_cmi (paridade com imovel_mandato.documento_id).
alter table public.imovel_cmi
  add column if not exists documento_id uuid references public.imovel_documentos(id) on delete set null;
