'use client';

import React, { useEffect, useState } from 'react';
import { Save, Palette, MessageSquare, Ban, IdCard, PenLine, Target, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';

type BrandKit = {
  brand_primary_color: string | null;
  brand_secondary_color: string | null;
  brand_accent_color: string | null;
  brand_neutral_color: string | null;
  font_headline: string | null;
  font_body: string | null;
  logo_full_url: string | null;
  logo_symbol_url: string | null;
  logo_mono_url: string | null;
  logo_inverse_url: string | null;
  photo_personal_url: string | null;
  photo_team_url: string | null;
  tom_voz: string | null;
  filosofia: string | null;
  pilares: string[];
  vocabulario_banido: string[];
  vocabulario_preferido: Record<string, string>;
  saudacao_padrao: string | null;
  despedida_padrao: string | null;
  assinatura_email: string | null;
  nome_profissional: string | null;
  cargo: string | null;
  ami: string | null;
  nipc: string | null;
  telefone: string | null;
  email_profissional: string | null;
  morada_escritorio: string | null;
  website: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  bio_curta: string | null;
  bio_longa: string | null;
  segmento_alvo: string | null;
  proposta_unica: string | null;
  frases_marca: string[];
};

const emptyKit: BrandKit = {
  brand_primary_color: '', brand_secondary_color: '', brand_accent_color: '', brand_neutral_color: '',
  font_headline: '', font_body: '',
  logo_full_url: '', logo_symbol_url: '', logo_mono_url: '', logo_inverse_url: '',
  photo_personal_url: '', photo_team_url: '',
  tom_voz: '', filosofia: '', pilares: [],
  vocabulario_banido: [], vocabulario_preferido: {},
  saudacao_padrao: '', despedida_padrao: '', assinatura_email: '',
  nome_profissional: '', cargo: '', ami: '', nipc: '',
  telefone: '', email_profissional: '', morada_escritorio: '', website: '',
  facebook_url: '', instagram_url: '', linkedin_url: '', youtube_url: '',
  bio_curta: '', bio_longa: '',
  segmento_alvo: '', proposta_unica: '', frases_marca: [],
};

const inputCls =
  'w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-primary-500 focus:outline-none disabled:opacity-60';
const labelCls = 'block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1';
const sectionCls =
  'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 mb-6';

function ChipInput({
  values, onChange, placeholder, disabled,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState('');
  return (
    <div className="flex flex-wrap gap-2 items-center rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 px-2 py-2 min-h-[42px]">
      {values.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-700 dark:text-slate-200"
        >
          {v}
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-rose-500"
              aria-label={`Remover ${v}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && draft.trim()) {
              e.preventDefault();
              onChange([...values, draft.trim()]);
              setDraft('');
            }
            if (e.key === 'Backspace' && !draft && values.length > 0) {
              onChange(values.slice(0, -1));
            }
          }}
          placeholder={placeholder}
          className="flex-1 min-w-[140px] bg-transparent text-sm focus:outline-none"
        />
      )}
    </div>
  );
}

function PairsEditor({
  pairs, onChange, disabled,
}: {
  pairs: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled?: boolean;
}) {
  const entries = Object.entries(pairs);
  const [k, setK] = useState('');
  const [v, setV] = useState('');
  return (
    <div className="space-y-2">
      {entries.map(([key, val]) => (
        <div key={key} className="flex items-center gap-2">
          <span className="flex-1 text-sm text-slate-500 line-through">{key}</span>
          <span className="text-slate-400">→</span>
          <span className="flex-1 text-sm text-slate-900 dark:text-slate-100">{val}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                const next = { ...pairs };
                delete next[key];
                onChange(next);
              }}
              className="text-slate-400 hover:text-rose-500 text-sm"
              aria-label={`Remover ${key}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            value={k}
            onChange={(e) => setK(e.target.value)}
            placeholder="Evitar"
            className={`${inputCls} flex-1`}
          />
          <span className="text-slate-400">→</span>
          <input
            type="text"
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="Usar"
            className={`${inputCls} flex-1`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (k.trim() && v.trim()) {
                onChange({ ...pairs, [k.trim()]: v.trim() });
                setK('');
                setV('');
              }
            }}
          >
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className={sectionCls}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="h-5 w-5 text-primary-600" />
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export const MarcaSettings: React.FC = () => {
  const [kit, setKit] = useState<BrandKit>(emptyKit);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/settings/brand-kit', { cache: 'no-store' });
        const data = await res.json();
        if (!alive) return;
        setIsAdmin(Boolean(data.isAdmin));
        if (data.kit) {
          setKit({
            ...emptyKit,
            ...data.kit,
            pilares: data.kit.pilares ?? [],
            vocabulario_banido: data.kit.vocabulario_banido ?? [],
            vocabulario_preferido: data.kit.vocabulario_preferido ?? {},
            frases_marca: data.kit.frases_marca ?? [],
          });
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const update = <K extends keyof BrandKit>(key: K, value: BrandKit[K]) =>
    setKit((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/brand-kit', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(kit),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(`Erro: ${data?.error || res.statusText}`);
      } else {
        setToast('Marca actualizada com sucesso');
      }
    } catch (e: any) {
      setToast(`Erro: ${e?.message || 'falhou guardar'}`);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3500);
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400 py-12 text-center">A carregar Brand Kit…</div>;
  }

  const disabled = !isAdmin;

  return (
    <div className="pb-12">
      {/* Banner explicativo */}
      <div className="mb-6 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-900 dark:text-amber-100">
          <strong>Esta é a identidade da sua marca pessoal</strong> que aparece ao mundo em emails, posts, anúncios, materiais e PDFs.
          Não confundir com o tema do CRM (que permanece azul-slate inalterado). Os geradores de IA passarão a ler estes dados para
          manter consistência em tudo o que gera em seu nome.
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 md:px-0 py-3 mb-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {disabled ? 'Apenas leitura (precisa ser administrador para editar)' : 'Alterações guardam-se imediatamente após carregar Guardar'}
        </div>
        <div className="flex items-center gap-3">
          {toast && (
            <span className="text-xs text-slate-600 dark:text-slate-300">{toast}</span>
          )}
          <Button onClick={handleSave} disabled={disabled || saving} size="sm">
            <Save className="h-4 w-4 mr-1.5" />
            {saving ? 'A guardar…' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Section icon={Palette} title="1. Identidade Visual (para materiais externos)">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Cores, tipografias e logos que usa em anúncios, PDFs, posts e materiais impressos.
          Estes valores não afectam o tema do CRM.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {(['brand_primary_color','brand_secondary_color','brand_accent_color','brand_neutral_color'] as const).map((c) => (
            <div key={c}>
              <label className={labelCls}>{c.replace('brand_','').replace('_',' ')}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={kit[c] || '#000000'}
                  onChange={(e) => update(c, e.target.value)}
                  disabled={disabled}
                  className="h-9 w-12 rounded border border-slate-200 dark:border-white/10 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={kit[c] ?? ''}
                  onChange={(e) => update(c, e.target.value)}
                  disabled={disabled}
                  placeholder="#1a2849"
                  className={`${inputCls} flex-1`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Tipografia títulos</label>
            <input type="text" value={kit.font_headline ?? ''} onChange={(e) => update('font_headline', e.target.value)} disabled={disabled} placeholder="Playfair Display" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tipografia corpo</label>
            <input type="text" value={kit.font_body ?? ''} onChange={(e) => update('font_body', e.target.value)} disabled={disabled} placeholder="Inter" className={inputCls} />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ['logo_full_url','Logo completo (URL)'],
            ['logo_symbol_url','Símbolo (URL)'],
            ['logo_mono_url','Mono (URL)'],
            ['logo_inverse_url','Inverso (URL)'],
            ['photo_personal_url','Foto pessoal (URL)'],
            ['photo_team_url','Foto equipa (URL)'],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <label className={labelCls}>{label}</label>
              <input type="url" value={kit[k] ?? ''} onChange={(e) => update(k, e.target.value)} disabled={disabled} placeholder="https://…" className={inputCls} />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Upload directo de ficheiros chega no próximo passo (B.5).</p>
      </Section>

      <Section icon={MessageSquare} title="2. Tom de Voz e Filosofia">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Tom de voz</label>
            <textarea
              value={kit.tom_voz ?? ''}
              onChange={(e) => update('tom_voz', e.target.value)}
              disabled={disabled}
              rows={3}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Filosofia comercial</label>
            <textarea
              value={kit.filosofia ?? ''}
              onChange={(e) => update('filosofia', e.target.value)}
              disabled={disabled}
              rows={3}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Pilares (Enter para adicionar)</label>
            <ChipInput
              values={kit.pilares}
              onChange={(next) => update('pilares', next)}
              placeholder="ex: Continuidade obrigatória"
              disabled={disabled}
            />
          </div>
        </div>
      </Section>

      <Section icon={Ban} title="3. Vocabulário">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Banido (palavras a nunca usar)</label>
            <ChipInput
              values={kit.vocabulario_banido}
              onChange={(next) => update('vocabulario_banido', next)}
              placeholder="ex: Oi, Você, Abs"
              disabled={disabled}
            />
          </div>
          <div>
            <label className={labelCls}>Substituições preferidas</label>
            <PairsEditor
              pairs={kit.vocabulario_preferido}
              onChange={(next) => update('vocabulario_preferido', next)}
              disabled={disabled}
            />
          </div>
        </div>
      </Section>

      <Section icon={IdCard} title="4. Dados Oficiais">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            ['nome_profissional', 'Nome profissional', 'João Fonseca'],
            ['cargo', 'Cargo', 'Consultor Imobiliário'],
            ['ami', 'AMI', '10092'],
            ['nipc', 'NIPC', ''],
            ['telefone', 'Telefone profissional', '+351 …'],
            ['email_profissional', 'Email profissional', 'nome@exemplo.pt'],
            ['morada_escritorio', 'Morada do escritório', 'Rua, nº, Porto'],
            ['website', 'Website', 'https://…'],
            ['facebook_url', 'Facebook', 'https://facebook.com/…'],
            ['instagram_url', 'Instagram', 'https://instagram.com/…'],
            ['linkedin_url', 'LinkedIn', 'https://linkedin.com/in/…'],
            ['youtube_url', 'YouTube', 'https://youtube.com/@…'],
          ] as const).map(([k, label, ph]) => (
            <div key={k}>
              <label className={labelCls}>{label}</label>
              <input type="text" value={kit[k] ?? ''} onChange={(e) => update(k, e.target.value)} disabled={disabled} placeholder={ph} className={inputCls} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 mt-4">
          <div>
            <label className={labelCls}>Bio curta (1-2 frases)</label>
            <textarea value={kit.bio_curta ?? ''} onChange={(e) => update('bio_curta', e.target.value)} disabled={disabled} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Bio longa (parágrafo)</label>
            <textarea value={kit.bio_longa ?? ''} onChange={(e) => update('bio_longa', e.target.value)} disabled={disabled} rows={4} className={inputCls} />
          </div>
        </div>
      </Section>

      <Section icon={PenLine} title="5. Assinatura e Saudações">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelCls}>Saudação padrão</label>
            <input type="text" value={kit.saudacao_padrao ?? ''} onChange={(e) => update('saudacao_padrao', e.target.value)} disabled={disabled} placeholder="Caro/Cara [Nome]" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Despedida padrão</label>
            <input type="text" value={kit.despedida_padrao ?? ''} onChange={(e) => update('despedida_padrao', e.target.value)} disabled={disabled} placeholder="Com os melhores cumprimentos," className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Bloco de assinatura email</label>
          <textarea
            value={kit.assinatura_email ?? ''}
            onChange={(e) => update('assinatura_email', e.target.value)}
            disabled={disabled}
            rows={6}
            className={`${inputCls} font-mono text-xs`}
          />
        </div>
      </Section>

      <Section icon={Target} title="6. Diferenciação">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Segmento alvo</label>
            <input type="text" value={kit.segmento_alvo ?? ''} onChange={(e) => update('segmento_alvo', e.target.value)} disabled={disabled} placeholder="Porto, classe média-alta" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Proposta única</label>
            <textarea value={kit.proposta_unica ?? ''} onChange={(e) => update('proposta_unica', e.target.value)} disabled={disabled} rows={3} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Frases-marca (Enter para adicionar)</label>
            <ChipInput
              values={kit.frases_marca}
              onChange={(next) => update('frases_marca', next)}
              placeholder="ex: Entrego primeiro, sou recompensado depois."
              disabled={disabled}
            />
          </div>
        </div>
      </Section>
    </div>
  );
};

export default MarcaSettings;
