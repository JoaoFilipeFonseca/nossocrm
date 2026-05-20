'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CARACTERISTICAS_CATALOG } from '@/lib/imoveis';

const TIPOS = [
  { v: 'apartamento', l: 'Apartamento' }, { v: 'moradia', l: 'Moradia' },
  { v: 'terreno', l: 'Terreno' }, { v: 'predio', l: 'Prédio' },
  { v: 'loja', l: 'Loja' }, { v: 'armazem', l: 'Armazém' },
  { v: 'escritorio', l: 'Escritório' }, { v: 'garagem', l: 'Garagem' },
  { v: 'quinta', l: 'Quinta' },
];
const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T5+', 'V3', 'V4', 'V5', 'V5+', 'Loja', 'Armazem', 'Terreno'];
const ESTADOS = [
  { v: 'disponivel', l: 'Disponível' }, { v: 'reservado', l: 'Reservado' },
  { v: 'vendido', l: 'Vendido' }, { v: 'retirado', l: 'Retirado' },
  { v: 'em_avaliacao', l: 'Em avaliação' },
];
const ESTADOS_CONSERVACAO = [
  { v: 'novo', l: 'Novo' }, { v: 'como_novo', l: 'Como novo' },
  { v: 'usado', l: 'Usado' }, { v: 'recuperar', l: 'Para recuperar' },
  { v: 'construcao', l: 'Em construção' }, { v: 'projecto', l: 'Em projecto' },
];
const NEGOCIOS = [
  { v: 'venda', l: 'Venda' }, { v: 'arrendamento', l: 'Arrendamento' },
  { v: 'ambos', l: 'Ambos' }, { v: 'trespasse', l: 'Trespasse' }, { v: 'permuta', l: 'Permuta' },
];
const COZINHA = [
  { v: 'equipada', l: 'Equipada' }, { v: 'semi_equipada', l: 'Semi-equipada' }, { v: 'vazia', l: 'Vazia' },
];
const CE_VALORES = ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F', 'G', 'isento'];
const AQUECIMENTOS = ['Central', 'Gás natural', 'Eléctrico', 'Bomba calor', 'Bomba calor (split)', 'Lareira recuperador'];
const AGUAS = ['Rede pública', 'Furo', 'Poço', 'Cisterna', 'Misto'];
const PAINEIS_SOLARES = ['Não', 'Térmicos', 'Fotovoltaicos', 'Térmicos + Fotovoltaicos'];
const CAIXILHARIAS = ['PVC', 'Alumínio', 'Madeira', 'Alumínio com corte térmico'];
const ORIENTACOES = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const VISTAS = ['Mar', 'Rio', 'Montanha', 'Cidade', 'Jardim', 'Piscina', 'Campo', 'Castelo', 'Igreja', 'Sem vista'];
const PORTAIS = ['Idealista', 'Imovirtual', 'Casa Sapo', 'KW.pt', 'C21.pt', 'Site próprio', 'OLX'];

export type ImovelFormValue = string | number | boolean | string[] | Record<string, boolean> | null;
export type ImovelFormValues = Record<string, ImovelFormValue>;

const EMPTY: ImovelFormValues = {
  referencia: '', tipo: 'apartamento', subtipo: '',
  estado: 'disponivel', estado_conservacao: 'usado', tipo_negocio: 'venda',
  morada: '', numero_policia: '', codigo_postal: '',
  freguesia: '', concelho: '', distrito: 'Porto',
  latitude: '', longitude: '', ocultar_morada: false,
  tipologia: '',
  area_util: '', area_bruta: '', area_terreno: '', area_dependente: '',
  quartos: '', quartos_suite: '', wcs: '',
  piso: '', pisos_imovel: '', cozinha_tipo: '', sala_m2: '',
  ano_construcao: '', ano_remodelacao: '',
  certificado_energetico: '', ce_numero: '', ce_validade: '',
  aquecimento: '', tem_ac: false, agua: '', paineis_solares: '',
  caixilharia: '', vidros_duplos: false,
  orientacao: '', vista: '',
  tem_condominio: false, condominio_mensal: '', condominio_inclui: '',
  imi_anual: '',
  preco_actual: '', preco_inicial: '', preco_minimo_aceitavel: '', renda_mensal: '',
  titulo_anuncio: '', descricao_longa: '',
  destaques: [] as string[], publico_alvo: [] as string[], publicado_em: [] as string[],
  ref_idealista: '', ref_imovirtual: '', ref_casasapo: '', ref_kw: '',
  link_externo: '', notas_privadas: '',
  caracteristicas: {} as Record<string, boolean>,
};

type TabId = 'essencial' | 'localizacao' | 'caracteristicas' | 'comercial';
const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'essencial', label: 'Essencial' },
  { id: 'localizacao', label: 'Localização' },
  { id: 'caracteristicas', label: 'Características' },
  { id: 'comercial', label: 'Comercial & Marketing' },
];

interface Props {
  mode: 'create' | 'edit';
  imovelId?: string;
  initial?: Partial<ImovelFormValues>;
}

export default function ImovelForm({ mode, imovelId, initial }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('essencial');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const merged: ImovelFormValues = { ...EMPTY };
  if (initial) {
    for (const k of Object.keys(initial)) {
      const v = (initial as Partial<ImovelFormValues>)[k];
      if (v !== undefined) merged[k] = v;
    }
  }
  const [form, setForm] = useState<ImovelFormValues>(merged);

  function up(key: string, value: ImovelFormValue) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }
  function toggleArr(key: string, value: string) {
    setForm((prev) => {
      const arr = (prev[key] as string[]) ?? [];
      return { ...prev, [key]: arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value] };
    });
  }
  function toggleCarac(key: string) {
    setForm((prev) => {
      const c = (prev.caracteristicas as Record<string, boolean>) ?? {};
      return { ...prev, caracteristicas: { ...c, [key]: !c[key] } };
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const numericKeys = ['latitude', 'longitude', 'area_util', 'area_bruta', 'area_terreno', 'area_dependente',
        'quartos', 'quartos_suite', 'wcs', 'piso', 'pisos_imovel', 'sala_m2',
        'ano_construcao', 'ano_remodelacao', 'condominio_mensal', 'imi_anual', 'renda_mensal',
        'preco_actual', 'preco_inicial', 'preco_minimo_aceitavel'];
      const payload: Record<string, unknown> = { ...form };
      for (const k of numericKeys) {
        const v = payload[k];
        payload[k] = v === '' || v == null ? null : Number(v);
      }
      const url = mode === 'create' ? '/api/imoveis' : `/api/imoveis/${imovelId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro a gravar');
      router.push(`/imoveis/${mode === 'create' ? json.id : imovelId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setSubmitting(false);
    }
  }

  const caracs = (form.caracteristicas as Record<string, boolean>) ?? {};
  const caracGroups = Array.from(new Set(CARACTERISTICAS_CATALOG.map((c) => c.group)));

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'essencial' && (
        <div className="space-y-4 pt-2">
          <Row>
            <Field label="Tipo">
              <select value={form.tipo as string} onChange={(e) => up('tipo', e.target.value)} className={input}>
                {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </Field>
            <Field label="Subtipo (opcional)">
              <input type="text" value={form.subtipo as string} onChange={(e) => up('subtipo', e.target.value)}
                placeholder="ex: duplex, isolada, banda…" className={input} />
            </Field>
          </Row>

          <Row>
            <Field label="Referência interna">
              <input type="text" value={form.referencia as string} onChange={(e) => up('referencia', e.target.value)} className={input} />
            </Field>
            <Field label="Tipologia">
              <select value={form.tipologia as string} onChange={(e) => up('tipologia', e.target.value)} className={input}>
                <option value="">—</option>
                {TIPOLOGIAS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Negócio">
              <select value={form.tipo_negocio as string} onChange={(e) => up('tipo_negocio', e.target.value)} className={input}>
                {NEGOCIOS.map((n) => <option key={n.v} value={n.v}>{n.l}</option>)}
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.estado as string} onChange={(e) => up('estado', e.target.value)} className={input}>
                {ESTADOS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </Field>
            <Field label="Estado de conservação">
              <select value={form.estado_conservacao as string} onChange={(e) => up('estado_conservacao', e.target.value)} className={input}>
                <option value="">—</option>
                {ESTADOS_CONSERVACAO.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Preço actual (€)">
              <input type="number" step="100" value={form.preco_actual as string} onChange={(e) => up('preco_actual', e.target.value)} className={input} />
            </Field>
            <Field label="Preço inicial (€)">
              <input type="number" step="100" value={form.preco_inicial as string} onChange={(e) => up('preco_inicial', e.target.value)} className={input} />
            </Field>
            <Field label="Preço mínimo (privado)">
              <input type="number" step="100" value={form.preco_minimo_aceitavel as string} onChange={(e) => up('preco_minimo_aceitavel', e.target.value)} className={input} />
            </Field>
          </Row>

          {(form.tipo_negocio === 'arrendamento' || form.tipo_negocio === 'ambos') && (
            <Row>
              <Field label="Renda mensal (€)">
                <input type="number" step="50" value={form.renda_mensal as string} onChange={(e) => up('renda_mensal', e.target.value)} className={input} />
              </Field>
            </Row>
          )}

          <h3 className="text-sm font-semibold pt-4">Áreas</h3>
          <Row>
            <Field label="Área útil (m²)">
              <input type="number" step="0.1" value={form.area_util as string} onChange={(e) => up('area_util', e.target.value)} className={input} />
            </Field>
            <Field label="Área bruta privativa (m²)">
              <input type="number" step="0.1" value={form.area_bruta as string} onChange={(e) => up('area_bruta', e.target.value)} className={input} />
            </Field>
            <Field label="Área terreno (m²)">
              <input type="number" step="1" value={form.area_terreno as string} onChange={(e) => up('area_terreno', e.target.value)} className={input} />
            </Field>
            <Field label="Área dependente (m²)">
              <input type="number" step="0.1" value={form.area_dependente as string} onChange={(e) => up('area_dependente', e.target.value)} className={input} />
            </Field>
          </Row>

          <h3 className="text-sm font-semibold pt-4">Divisões</h3>
          <Row>
            <Field label="Quartos">
              <input type="number" step="1" value={form.quartos as string} onChange={(e) => up('quartos', e.target.value)} className={input} />
            </Field>
            <Field label="Suites">
              <input type="number" step="1" value={form.quartos_suite as string} onChange={(e) => up('quartos_suite', e.target.value)} className={input} />
            </Field>
            <Field label="WCs">
              <input type="number" step="1" value={form.wcs as string} onChange={(e) => up('wcs', e.target.value)} className={input} />
            </Field>
            <Field label="Piso">
              <input type="number" step="1" value={form.piso as string} onChange={(e) => up('piso', e.target.value)} className={input} />
            </Field>
            <Field label="Pisos do imóvel">
              <input type="number" step="1" value={form.pisos_imovel as string} onChange={(e) => up('pisos_imovel', e.target.value)} className={input} />
            </Field>
            <Field label="Cozinha">
              <select value={form.cozinha_tipo as string} onChange={(e) => up('cozinha_tipo', e.target.value)} className={input}>
                <option value="">—</option>
                {COZINHA.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
              </select>
            </Field>
          </Row>

          <Row>
            <Field label="Ano construção">
              <input type="number" step="1" value={form.ano_construcao as string} onChange={(e) => up('ano_construcao', e.target.value)} className={input} />
            </Field>
            <Field label="Ano remodelação">
              <input type="number" step="1" value={form.ano_remodelacao as string} onChange={(e) => up('ano_remodelacao', e.target.value)} className={input} />
            </Field>
          </Row>
        </div>
      )}

      {tab === 'localizacao' && (
        <div className="space-y-4 pt-2">
          <Field label="Morada">
            <input type="text" value={form.morada as string} onChange={(e) => up('morada', e.target.value)} className={input} />
          </Field>
          <Row>
            <Field label="Nº polícia">
              <input type="text" value={form.numero_policia as string} onChange={(e) => up('numero_policia', e.target.value)} className={input} />
            </Field>
            <Field label="Código postal">
              <input type="text" value={form.codigo_postal as string} onChange={(e) => up('codigo_postal', e.target.value)}
                placeholder="XXXX-XXX" className={input} />
            </Field>
          </Row>
          <Row>
            <Field label="Freguesia">
              <input type="text" value={form.freguesia as string} onChange={(e) => up('freguesia', e.target.value)} className={input} />
            </Field>
            <Field label="Concelho">
              <input type="text" value={form.concelho as string} onChange={(e) => up('concelho', e.target.value)} className={input} />
            </Field>
            <Field label="Distrito">
              <input type="text" value={form.distrito as string} onChange={(e) => up('distrito', e.target.value)} className={input} />
            </Field>
          </Row>
          <Row>
            <Field label="Latitude">
              <input type="number" step="0.000001" value={form.latitude as string} onChange={(e) => up('latitude', e.target.value)} className={input} />
            </Field>
            <Field label="Longitude">
              <input type="number" step="0.000001" value={form.longitude as string} onChange={(e) => up('longitude', e.target.value)} className={input} />
            </Field>
          </Row>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.ocultar_morada as boolean} onChange={(e) => up('ocultar_morada', e.target.checked)} />
            <span>Ocultar morada exacta no anúncio público (mostra só zona)</span>
          </label>
        </div>
      )}

      {tab === 'caracteristicas' && (
        <div className="space-y-4 pt-2">
          <h3 className="text-sm font-semibold">Eficiência energética</h3>
          <Row>
            <Field label="Certificado">
              <select value={form.certificado_energetico as string} onChange={(e) => up('certificado_energetico', e.target.value)} className={input}>
                <option value="">—</option>
                {CE_VALORES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Nº certificado">
              <input type="text" value={form.ce_numero as string} onChange={(e) => up('ce_numero', e.target.value)} className={input} />
            </Field>
            <Field label="Validade CE">
              <input type="date" value={form.ce_validade as string} onChange={(e) => up('ce_validade', e.target.value)} className={input} />
            </Field>
          </Row>

          <h3 className="text-sm font-semibold pt-2">Infraestruturas</h3>
          <Row>
            <Field label="Aquecimento">
              <select value={form.aquecimento as string} onChange={(e) => up('aquecimento', e.target.value)} className={input}>
                <option value="">—</option>
                {AQUECIMENTOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Ar condicionado">
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input type="checkbox" checked={form.tem_ac as boolean} onChange={(e) => up('tem_ac', e.target.checked)} />
                <span>Sim</span>
              </label>
            </Field>
          </Row>
          <Row>
            <Field label="Águas">
              <select value={form.agua as string} onChange={(e) => up('agua', e.target.value)} className={input}>
                <option value="">—</option>
                {AGUAS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Painéis solares">
              <select value={form.paineis_solares as string} onChange={(e) => up('paineis_solares', e.target.value)} className={input}>
                <option value="">—</option>
                {PAINEIS_SOLARES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </Row>
          <Row>
            <Field label="Caixilharia">
              <select value={form.caixilharia as string} onChange={(e) => up('caixilharia', e.target.value)} className={input}>
                <option value="">—</option>
                {CAIXILHARIAS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Vidros duplos">
              <label className="flex items-center gap-2 mt-2 text-sm">
                <input type="checkbox" checked={form.vidros_duplos as boolean} onChange={(e) => up('vidros_duplos', e.target.checked)} />
                <span>Sim</span>
              </label>
            </Field>
          </Row>

          <h3 className="text-sm font-semibold pt-2">Orientação e vista</h3>
          <Row>
            <Field label="Orientação solar">
              <select value={form.orientacao as string} onChange={(e) => up('orientacao', e.target.value)} className={input}>
                <option value="">—</option>
                {ORIENTACOES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Vista principal">
              <select value={form.vista as string} onChange={(e) => up('vista', e.target.value)} className={input}>
                <option value="">—</option>
                {VISTAS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </Field>
          </Row>

          <h3 className="text-sm font-semibold pt-2">Condomínio</h3>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.tem_condominio as boolean} onChange={(e) => up('tem_condominio', e.target.checked)} />
            <span>Tem condomínio</span>
          </label>
          {form.tem_condominio && (
            <Row>
              <Field label="Mensal (€)">
                <input type="number" step="1" value={form.condominio_mensal as string} onChange={(e) => up('condominio_mensal', e.target.value)} className={input} />
              </Field>
              <Field label="Inclui">
                <input type="text" value={form.condominio_inclui as string} onChange={(e) => up('condominio_inclui', e.target.value)}
                  placeholder="ex: limpeza, jardim, piscina" className={input} />
              </Field>
            </Row>
          )}

          <h3 className="text-sm font-semibold pt-2">Fiscalidade</h3>
          <Row>
            <Field label="IMI anual (€)">
              <input type="number" step="1" value={form.imi_anual as string} onChange={(e) => up('imi_anual', e.target.value)} className={input} />
            </Field>
          </Row>

          <h3 className="text-sm font-semibold pt-2">Equipamentos e extras</h3>
          {caracGroups.map((group) => (
            <div key={group}>
              <p className="text-xs uppercase tracking-wide text-slate-500 mt-3 mb-2">{group}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CARACTERISTICAS_CATALOG.filter((c) => c.group === group).map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!caracs[c.key]} onChange={() => toggleCarac(c.key)} />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'comercial' && (
        <div className="space-y-4 pt-2">
          <Field label="Título do anúncio">
            <input type="text" value={form.titulo_anuncio as string} onChange={(e) => up('titulo_anuncio', e.target.value)}
              placeholder="ex: Moradia T6 luxo Paços de Ferreira com piscina interior" className={input} maxLength={80} />
          </Field>

          <Field label="Descrição longa (markdown)">
            <textarea value={form.descricao_longa as string} onChange={(e) => up('descricao_longa', e.target.value)}
              rows={6} className={input} />
          </Field>

          <Field label="Destaques (bullet points, um por linha)">
            <textarea
              value={((form.destaques as string[]) ?? []).join('\n')}
              onChange={(e) => up('destaques', e.target.value.split('\n').filter((l) => l.trim()))}
              rows={5} placeholder="6 suites privadas&#10;Piscina interior aquecida&#10;Elevador particular" className={input}
            />
          </Field>

          <Field label="Público-alvo (1 por linha)">
            <textarea
              value={((form.publico_alvo as string[]) ?? []).join('\n')}
              onChange={(e) => up('publico_alvo', e.target.value.split('\n').filter((l) => l.trim()))}
              rows={3} placeholder="Famílias numerosas&#10;Empresários&#10;Investidores de luxo" className={input}
            />
          </Field>

          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-600 mb-2">Publicado em</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PORTAIS.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={((form.publicado_em as string[]) ?? []).includes(p)}
                    onChange={() => toggleArr('publicado_em', p)}
                  />
                  <span>{p}</span>
                </label>
              ))}
            </div>
          </div>

          <h3 className="text-sm font-semibold pt-2">Referências de portais</h3>
          <Row>
            <Field label="Idealista"><input type="text" value={form.ref_idealista as string} onChange={(e) => up('ref_idealista', e.target.value)} className={input} /></Field>
            <Field label="Imovirtual"><input type="text" value={form.ref_imovirtual as string} onChange={(e) => up('ref_imovirtual', e.target.value)} className={input} /></Field>
          </Row>
          <Row>
            <Field label="Casa Sapo"><input type="text" value={form.ref_casasapo as string} onChange={(e) => up('ref_casasapo', e.target.value)} className={input} /></Field>
            <Field label="KW"><input type="text" value={form.ref_kw as string} onChange={(e) => up('ref_kw', e.target.value)} className={input} /></Field>
          </Row>

          <Field label="Link externo (anúncio principal)">
            <input type="url" value={form.link_externo as string} onChange={(e) => up('link_externo', e.target.value)} className={input} />
          </Field>

          <Field label="Notas privadas">
            <textarea value={form.notas_privadas as string} onChange={(e) => up('notas_privadas', e.target.value)} rows={3} className={input} />
          </Field>
        </div>
      )}

      {error && <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
        <button type="submit" disabled={submitting}
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'A gravar…' : mode === 'create' ? 'Criar imóvel' : 'Gravar alterações'}
        </button>
        <Link href={mode === 'create' ? '/imoveis' : `/imoveis/${imovelId}`} className="text-sm text-slate-600 hover:text-slate-900">
          Cancelar
        </Link>
      </div>
    </form>
  );
}

const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block flex-1 min-w-0">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}
