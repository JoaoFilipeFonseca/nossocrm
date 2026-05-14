'use client';
import { useState } from 'react';
import { Loader2, Copy, ChevronRight, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Step = 'dados' | 'icp' | 'swot' | 'descricao' | 'pitch';

interface AngariacaoInput {
    zona: string;
    freguesia: string;
    tipologia: string;
    anoConstrucao: string;
    areaUtil: string;
    estadoConservacao: string;
    precoPedido: string;
    precoMinimo: string;
    caracteristicasDestaque: string;
    motivacaoVenda: string;
    exclusividade: 'sim' | 'aberta' | 'fsbo' | '';
    notasExtra: string;
}

const STEP_ORDER: Step[] = ['dados', 'icp', 'swot', 'descricao', 'pitch'];
const STEP_LABELS: Record<Step, string> = {
    dados: '1 · Dados do Imóvel',
    icp: '2 · ICP Comprador',
    swot: '3 · SWOT',
    descricao: '4 · Descrição Marketing',
    pitch: '5 · Pitch Reunião',
};

const ZONAS_PORTO = ['Porto', 'Matosinhos', 'V.N. Gaia', 'Maia', 'Gondomar', 'Vila do Conde', 'Póvoa de Varzim', 'Valongo', 'Santo Tirso', 'Trofa', 'Espinho', 'V.N. Famalicão', 'Outro'];
const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6+', 'Moradia', 'Terreno', 'Comercial'];
const ESTADOS = ['Novo', 'Usado-Bom', 'Usado-Reabilitar', 'Em Construção', 'Em Projeto'];


function parseSwotSections(text: string): {forcas: string; fraquezas: string; oportunidades: string; ameacas: string; recomendacoes: string} {
    const sections = {forcas: '', fraquezas: '', oportunidades: '', ameacas: '', recomendacoes: ''};
    // Match emoji+title section headers anywhere in text
    const splitRegex = /(?:#{1,3}\s*)?[✅❌🚀⚠️🎯]\s*[A-ZÀ-Úa-zà-ú\s\/]+(?:\([^)]*\))?\s*\n/g;
    const matches: Array<{idx: number; len: number; key: string}> = [];
    let m: RegExpExecArray | null;
    while ((m = splitRegex.exec(text)) !== null) {
        const header = m[0].toLowerCase();
        let key = '';
        if (/✅|forças|strengths/i.test(header)) key = 'forcas';
        else if (/❌|fraquezas|weaknesses/i.test(header)) key = 'fraquezas';
        else if (/🚀|oportunidades|opportunities/i.test(header)) key = 'oportunidades';
        else if (/⚠️|ameaças|threats/i.test(header)) key = 'ameacas';
        else if (/🎯|recomendações|strategic/i.test(header)) key = 'recomendacoes';
        if (key) matches.push({idx: m.index, len: m[0].length, key});
    }
    // Keep only the FIRST match for each key (avoids duplicates)
    const seen = new Set<string>();
    const unique = matches.filter(x => {
        if (seen.has(x.key)) return false;
        seen.add(x.key);
        return true;
    });
    // Sort by position
    unique.sort((a, b) => a.idx - b.idx);
    for (let j = 0; j < unique.length; j++) {
        const cur = unique[j];
        const next = unique[j + 1];
        const contentStart = cur.idx + cur.len;
        const contentEnd = next ? next.idx : text.length;
        const content = text.substring(contentStart, contentEnd).trim();
        (sections as any)[cur.key] = content;
    }
    return sections;
}

function SwotQuadrant({ data }: { data: string }) {
    const s = parseSwotSections(data);
    const hasStructure = s.forcas || s.fraquezas || s.oportunidades || s.ameacas;
    if (!hasStructure) {
        return <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{data}</ReactMarkdown>;
    }
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <QuadrantBox title="✅ Forças" body={s.forcas} colorClass="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800" />
                <QuadrantBox title="❌ Fraquezas" body={s.fraquezas} colorClass="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" />
                <QuadrantBox title="🚀 Oportunidades" body={s.oportunidades} colorClass="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" />
                <QuadrantBox title="⚠️ Ameaças" body={s.ameacas} colorClass="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" />
            </div>
            {s.recomendacoes && (
                <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20">
                    <h3 className="text-sm font-bold text-purple-900 dark:text-purple-200 mb-2">🎯 Recomendações Estratégicas</h3>
                    <div className="text-sm text-slate-800 dark:text-slate-200">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{s.recomendacoes}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
}

function QuadrantBox({ title, body, colorClass }: { title: string; body: string; colorClass: string }) {
    return (
        <div className={`p-4 rounded-xl border ${colorClass}`}>
            <h3 className="text-sm font-bold mb-2 text-slate-900 dark:text-white">{title}</h3>
            <div className="text-sm text-slate-700 dark:text-slate-200">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{body || '_(sem conteúdo)_'}</ReactMarkdown>
            </div>
        </div>
    );
}

const mdComponents = {
    h1: ({children}: any) => <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2">{children}</h2>,
    h2: ({children}: any) => <h3 className="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">{children}</h3>,
    h3: ({children}: any) => <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">{children}</h4>,
    p: ({children}: any) => <p className="mb-2 leading-relaxed">{children}</p>,
    strong: ({children}: any) => <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>,
    em: ({children}: any) => <em className="italic">{children}</em>,
    ul: ({children}: any) => <ul className="list-disc list-inside space-y-1 my-2 pl-2">{children}</ul>,
    ol: ({children}: any) => <ol className="list-decimal list-inside space-y-1 my-2 pl-2">{children}</ol>,
    li: ({children}: any) => <li className="leading-relaxed">{children}</li>,
    code: ({children}: any) => <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">{children}</code>,
    blockquote: ({children}: any) => <blockquote className="border-l-4 border-slate-300 dark:border-slate-600 pl-4 italic my-2">{children}</blockquote>,
};

export default function AngariacaoWorkflow() {
    const [currentStep, setCurrentStep] = useState<Step>('dados');
    const [data, setData] = useState<AngariacaoInput>({
        zona: '',
        freguesia: '',
        tipologia: '',
        anoConstrucao: '',
        areaUtil: '',
        estadoConservacao: '',
        precoPedido: '',
        precoMinimo: '',
        caracteristicasDestaque: '',
        motivacaoVenda: '',
        exclusividade: '',
        notasExtra: '',
    });
    const [outputs, setOutputs] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canAdvanceFromDados = data.zona && data.tipologia;

    const generate = async (step: Step) => {
        if (step === 'dados') return;
        setLoading(true);
        setError(null);
        try {
            const apiInput = {
                zona: data.zona,
                freguesia: data.freguesia || undefined,
                tipologia: data.tipologia,
                anoConstrucao: data.anoConstrucao ? parseInt(data.anoConstrucao) : undefined,
                areaUtil: data.areaUtil ? parseInt(data.areaUtil) : undefined,
                estadoConservacao: data.estadoConservacao || undefined,
                precoPedido: data.precoPedido ? parseInt(data.precoPedido) : undefined,
                precoMinimo: data.precoMinimo ? parseInt(data.precoMinimo) : undefined,
                caracteristicasDestaque: data.caracteristicasDestaque || undefined,
                motivacaoVenda: data.motivacaoVenda || undefined,
                exclusividade: data.exclusividade || undefined,
                notasExtra: data.notasExtra || undefined,
            };
            const res = await fetch('/api/ai/workflows/angariacao', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ step, input: apiInput }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Erro');
            setOutputs(prev => ({ ...prev, [step]: json.output }));
        } catch (e: any) {
            setError(e?.message || 'Erro ao gerar');
        } finally {
            setLoading(false);
        }
    };

    const goToStep = async (step: Step) => {
        setCurrentStep(step);
        if (step !== 'dados' && !outputs[step]) {
            await generate(step);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const currentIdx = STEP_ORDER.indexOf(currentStep);

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            <div className="flex items-center gap-3">
                <Sparkles className="w-7 h-7 text-purple-500" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Preparar Angariação</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Workflow guiado em 5 passos com IA</p>
                </div>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-white/5 overflow-x-auto">
                {STEP_ORDER.map((s, idx) => {
                    const active = s === currentStep;
                    const done = idx < currentIdx;
                    const disabled = idx > 0 && !canAdvanceFromDados;
                    return (
                        <button
                            key={s}
                            type="button"
                            disabled={disabled}
                            onClick={() => goToStep(s)}
                            className={`flex-1 min-w-fit px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                                active ? 'bg-purple-600 text-white shadow-sm' :
                                done ? 'text-emerald-600 dark:text-emerald-400 hover:bg-white dark:hover:bg-white/10' :
                                disabled ? 'text-slate-400 cursor-not-allowed' :
                                'text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10'
                            }`}
                        >
                            {done && '✓ '}{STEP_LABELS[s]}
                        </button>
                    );
                })}
            </div>

            {error && (
                <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 text-sm text-red-700 dark:text-red-300">{error}</div>
            )}

            {currentStep === 'dados' && (
                <div className="space-y-4 p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <h2 className="text-lg font-semibold">📝 Dados do Imóvel</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Preenche o que souberes. Quanto mais detalhado, melhores os outputs.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Zona / Concelho *">
                            <select value={data.zona} onChange={(e) => setData({ ...data, zona: e.target.value })} className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm">
                                <option value="">— Escolhe —</option>
                                {ZONAS_PORTO.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </Field>
                        <Field label="Freguesia">
                            <Input value={data.freguesia} onChange={v => setData({ ...data, freguesia: v })} placeholder="ex: Bonfim, Cedofeita" />
                        </Field>
                        <Field label="Tipologia *">
                            <select value={data.tipologia} onChange={(e) => setData({ ...data, tipologia: e.target.value })} className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm">
                                <option value="">— Escolhe —</option>
                                {TIPOLOGIAS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </Field>
                        <Field label="Ano construção">
                            <Input value={data.anoConstrucao} onChange={v => setData({ ...data, anoConstrucao: v })} type="number" placeholder="ex: 1985" />
                        </Field>
                        <Field label="Área útil (m²)">
                            <Input value={data.areaUtil} onChange={v => setData({ ...data, areaUtil: v })} type="number" placeholder="ex: 95" />
                        </Field>
                        <Field label="Estado conservação">
                            <select value={data.estadoConservacao} onChange={(e) => setData({ ...data, estadoConservacao: e.target.value })} className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm">
                                <option value="">— Escolhe —</option>
                                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </Field>
                        <Field label="Preço pedido (€)">
                            <Input value={data.precoPedido} onChange={v => setData({ ...data, precoPedido: v })} type="number" placeholder="ex: 280000" />
                        </Field>
                        <Field label="Preço mínimo (€)">
                            <Input value={data.precoMinimo} onChange={v => setData({ ...data, precoMinimo: v })} type="number" placeholder="ex: 260000" />
                        </Field>
                        <Field label="Características destaque" full>
                            <textarea value={data.caracteristicasDestaque} onChange={(e) => setData({ ...data, caracteristicasDestaque: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm" placeholder="ex: garagem fechada, varanda a sul, cozinha remodelada" />
                        </Field>
                        <Field label="Motivação venda" full>
                            <Input value={data.motivacaoVenda} onChange={v => setData({ ...data, motivacaoVenda: v })} placeholder="ex: divórcio, mudança família, herança" />
                        </Field>
                        <Field label="Exclusividade">
                            <select value={data.exclusividade} onChange={(e) => setData({ ...data, exclusividade: e.target.value as any })} className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm">
                                <option value="">— Escolhe —</option>
                                <option value="sim">Sim, exclusivo</option>
                                <option value="aberta">Aberta (não exclusivo)</option>
                                <option value="fsbo">FSBO (proprietário sozinho)</option>
                            </select>
                        </Field>
                        <Field label="Notas extra" full>
                            <textarea value={data.notasExtra} onChange={(e) => setData({ ...data, notasExtra: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm" placeholder="Qualquer info adicional relevante" />
                        </Field>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button type="button" disabled={!canAdvanceFromDados} onClick={() => goToStep('icp')} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-medium">
                            Avançar para ICP <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {currentStep !== 'dados' && (
                <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">{STEP_LABELS[currentStep]}</h2>
                        <div className="flex items-center gap-2">
                            {outputs[currentStep] && (
                                <>
                                    <button type="button" onClick={() => copyToClipboard(outputs[currentStep])} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5">
                                        <Copy className="w-3.5 h-3.5" /> Copiar
                                    </button>
                                    <button type="button" onClick={() => generate(currentStep)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50">
                                        <Sparkles className="w-3.5 h-3.5" /> Regenerar
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                    {loading ? (
                        <div className="flex items-center justify-center py-12 text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin mr-2" /> A gerar com IA... pode demorar 10-30s
                        </div>
                    ) : outputs[currentStep] ? (
                        <div className="text-sm text-slate-800 dark:text-slate-200">
                            {currentStep === 'swot' ? (
                                <SwotQuadrant data={outputs[currentStep]} />
                            ) : (
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{outputs[currentStep]}</ReactMarkdown>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-sm text-slate-500">
                            <button type="button" onClick={() => generate(currentStep)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium">
                                <Sparkles className="w-4 h-4" /> Gerar {STEP_LABELS[currentStep].split('·')[1]?.trim() || ''}
                            </button>
                        </div>
                    )}
                    {outputs[currentStep] && currentIdx < STEP_ORDER.length - 1 && (
                        <div className="flex justify-end pt-4 mt-4 border-t border-slate-200 dark:border-white/10">
                            <button type="button" onClick={() => goToStep(STEP_ORDER[currentIdx + 1])} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium">
                                Próximo passo <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
    return (
        <div className={full ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
            {children}
        </div>
    );
}

function Input({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white"
        />
    );
}
