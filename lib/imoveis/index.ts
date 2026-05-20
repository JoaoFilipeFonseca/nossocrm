import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { Imovel, ImovelEvento, ImovelFoto, ImovelDocumento, ImovelProprietario, ImovelMandato, ProprietarioDocumento } from './shared';

export * from './shared';

export async function listImoveis(): Promise<Imovel[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as unknown as Imovel[];
}

export async function getImovelById(id: string): Promise<Imovel | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imoveis')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as Imovel | null;
}

export async function listEventosByImovelId(imovelId: string): Promise<ImovelEvento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_eventos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('occurred_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelEvento[];
}

export async function listFotosByImovelId(imovelId: string): Promise<ImovelFoto[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_fotos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('ordem', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ImovelFoto[];
}

export async function listDocumentosByImovelId(imovelId: string): Promise<ImovelDocumento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_documentos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelDocumento[];
}

export interface DealLite {
  id: string;
  title: string | null;
  status: string | null;
  value: number | null;
}

export async function listProprietariosByImovelId(imovelId: string): Promise<ImovelProprietario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_proprietarios')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ImovelProprietario[];
}

export async function listMandatosByImovelId(imovelId: string): Promise<ImovelMandato[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('imovel_mandatos')
    .select('*')
    .eq('imovel_id', imovelId)
    .order('data_inicio', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ImovelMandato[];
}

export async function listProprietarioDocs(propId: string): Promise<ProprietarioDocumento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('proprietario_documentos')
    .select('*')
    .eq('proprietario_id', propId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProprietarioDocumento[];
}

export async function listProprietarioDocsByImovel(imovelId: string): Promise<Record<string, ProprietarioDocumento[]>> {
  const supabase = await createClient();
  const { data: props } = await supabase
    .from('imovel_proprietarios').select('id').eq('imovel_id', imovelId);
  if (!props || props.length === 0) return {};
  const ids = props.map((p) => p.id);
  const { data, error } = await supabase
    .from('proprietario_documentos')
    .select('*')
    .in('proprietario_id', ids)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  const grouped: Record<string, ProprietarioDocumento[]> = {};
  for (const d of (data ?? []) as ProprietarioDocumento[]) {
    if (!grouped[d.proprietario_id]) grouped[d.proprietario_id] = [];
    grouped[d.proprietario_id].push(d);
  }
  return grouped;
}

export async function listDealsByImovelId(imovelId: string): Promise<DealLite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('deals')
    .select('id, title, status, value')
    .eq('imovel_id', imovelId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as DealLite[];
}
