import 'server-only';
import type { createStaticAdminClient } from '@/lib/supabase/server';

type Supabase = ReturnType<typeof createStaticAdminClient>;
export type OrgCtx = { organization_id: string; telegram_active_imovel_id: string | null };

const ESTADOS_VALIDOS = ['em_avaliacao', 'disponivel', 'reservado', 'cpcv', 'vendido', 'suspenso', 'anulado', 'retirado'] as const;
const DOC_KINDS = ['caderneta', 'certidao', 'licenca_utilizacao', 'ftecnica', 'certificado_energetico', 'planta', 'cmi', 'mandato', 'outro'] as const;

function normaliza(s: string): string {
  return s.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
}

export async function mudaEstado(
  supabase: Supabase, org: OrgCtx, novoEstado: string,
): Promise<{ ok: boolean; mensagem: string }> {
  if (!org.telegram_active_imovel_id) return { ok: false, mensagem: 'ℹ️ Sem imóvel activo. /menu para começar.' };
  const estado = normaliza(novoEstado);
  if (!ESTADOS_VALIDOS.includes(estado as typeof ESTADOS_VALIDOS[number])) {
    return { ok: false, mensagem: `❌ Estado inválido. Opções: ${ESTADOS_VALIDOS.join(', ')}` };
  }
  const { data: prev } = await supabase.from('imoveis').select('estado').eq('id', org.telegram_active_imovel_id).single();
  const { error } = await supabase.from('imoveis').update({ estado }).eq('id', org.telegram_active_imovel_id);
  if (error) return { ok: false, mensagem: `❌ Erro: ${error.message}` };
  await supabase.from('imovel_eventos').insert({
    organization_id: org.organization_id,
    imovel_id: org.telegram_active_imovel_id,
    kind: 'estado_alterado',
    descricao: `Estado: ${(prev as { estado?: string } | null)?.estado ?? '?'} → ${estado}`,
    metadata: { de: (prev as { estado?: string } | null)?.estado, para: estado, via: 'telegram' },
  });
  return { ok: true, mensagem: `✅ Estado actualizado: <b>${estado}</b>` };
}

export async function mudaPreco(
  supabase: Supabase, org: OrgCtx, preco: number,
): Promise<{ ok: boolean; mensagem: string }> {
  if (!org.telegram_active_imovel_id) return { ok: false, mensagem: 'ℹ️ Sem imóvel activo.' };
  if (!Number.isFinite(preco) || preco <= 0) return { ok: false, mensagem: '❌ Preço inválido.' };
  const { data: prev } = await supabase.from('imoveis').select('preco_actual').eq('id', org.telegram_active_imovel_id).single();
  const { error } = await supabase.from('imoveis').update({ preco_actual: preco }).eq('id', org.telegram_active_imovel_id);
  if (error) return { ok: false, mensagem: `❌ Erro: ${error.message}` };
  const anterior = (prev as { preco_actual?: number | string } | null)?.preco_actual;
  await supabase.from('imovel_eventos').insert({
    organization_id: org.organization_id,
    imovel_id: org.telegram_active_imovel_id,
    kind: 'preco_alterado',
    descricao: `Preço: ${anterior ?? '?'}€ → ${preco}€`,
    valor: preco,
    metadata: { anterior, novo: preco, via: 'telegram' },
  });
  const fmt = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(preco);
  return { ok: true, mensagem: `✅ Novo preço: <b>${fmt}€</b>` };
}

export async function addProprietario(
  supabase: Supabase, org: OrgCtx, nome: string, percentagem: number | null, residente: boolean | null,
): Promise<{ ok: boolean; mensagem: string }> {
  if (!org.telegram_active_imovel_id) return { ok: false, mensagem: 'ℹ️ Sem imóvel activo.' };
  const nomeLimpo = nome.trim();
  if (nomeLimpo.length < 2) return { ok: false, mensagem: '❌ Nome em falta.' };
  const pct = percentagem != null && Number.isFinite(percentagem) && percentagem > 0 ? percentagem : 100;
  const { error } = await supabase.from('imovel_proprietarios').insert({
    organization_id: org.organization_id,
    imovel_id: org.telegram_active_imovel_id,
    nome: nomeLimpo,
    percentagem: pct,
    e_residente: residente ?? true,
  });
  if (error) return { ok: false, mensagem: `❌ Erro: ${error.message}` };
  return { ok: true, mensagem: `✅ Proprietário <b>${nomeLimpo}</b> adicionado (${pct}%)` };
}

/**
 * Reclassifica o último ficheiro enviado nos últimos 5 minutos para o imóvel activo
 * como documento. Move metadados de `imovel_fotos` para `imovel_documentos`.
 */
export async function reclassifyLastDoc(
  supabase: Supabase, org: OrgCtx, kind: string,
): Promise<{ ok: boolean; mensagem: string }> {
  if (!org.telegram_active_imovel_id) return { ok: false, mensagem: 'ℹ️ Sem imóvel activo.' };
  const k = normaliza(kind);
  if (!DOC_KINDS.includes(k as typeof DOC_KINDS[number])) {
    return { ok: false, mensagem: `❌ Tipo inválido. Opções: ${DOC_KINDS.join(', ')}` };
  }
  const cincoMinAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: fotos } = await supabase.from('imovel_fotos')
    .select('id, storage_path, bytes, url_publica, created_at')
    .eq('imovel_id', org.telegram_active_imovel_id)
    .gte('created_at', cincoMinAtras)
    .order('created_at', { ascending: false })
    .limit(1);
  if (!fotos || fotos.length === 0) {
    return { ok: false, mensagem: 'ℹ️ Sem ficheiro recente. Manda primeiro o PDF/foto e depois diz o tipo.' };
  }
  const foto = fotos[0] as { id: string; storage_path: string; bytes: number; url_publica: string | null };
  const filename = foto.storage_path.split('/').pop() ?? `doc_${Date.now()}`;
  await supabase.from('imovel_documentos').insert({
    organization_id: org.organization_id,
    imovel_id: org.telegram_active_imovel_id,
    kind: k,
    filename,
    storage_path: foto.storage_path,
    mime_type: filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
    bytes: foto.bytes,
  });
  await supabase.from('imovel_fotos').delete().eq('id', foto.id);
  return { ok: true, mensagem: `✅ Reclassificado como <b>${k}</b>` };
}
