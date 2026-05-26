// ============================================================================
// lib/automations/server.ts — helpers server-side para queries de automações
// ============================================================================
// Sprint 2.0, commit 1 de 3.
//
// Server components leem daqui em vez de chamar /api/automations (evita
// round trip HTTP em renders). RLS continua a filtrar por organization_id.
// ============================================================================

import { createClient } from '@/lib/supabase/server';

export interface AutomationRow {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  total_executions: number;
  success_count: number;
  failure_count: number;
  last_execution_at: string | null;
  created_at: string;
  updated_at: string;
  activated_at: string | null;
}

export interface AutomationDetail extends AutomationRow {
  definition: { nodes: unknown[]; edges: unknown[] };
}

export async function listAutomations(): Promise<AutomationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('automations')
    .select('id, organization_id, name, description, category, icon, status, version, total_executions, success_count, failure_count, last_execution_at, created_at, updated_at, activated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AutomationRow[];
}

export async function getAutomation(id: string): Promise<AutomationDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('automations')
    .select('id, organization_id, name, description, category, icon, status, version, definition, total_executions, success_count, failure_count, last_execution_at, created_at, updated_at, activated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as AutomationDetail;
}

export function statusLabel(status: AutomationRow['status']): string {
  switch (status) {
    case 'draft': return 'Rascunho';
    case 'active': return 'Activa';
    case 'paused': return 'Pausada';
    case 'archived': return 'Arquivada';
  }
}

export function statusChipClass(status: AutomationRow['status']): string {
  switch (status) {
    case 'active': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'paused': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'draft': return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'archived': return 'bg-slate-100 text-slate-500 border-slate-200';
  }
}
