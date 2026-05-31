'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { ExternalLink, Download, Upload, ShieldCheck, FileText } from 'lucide-react';

/**
 * Sprint 29 c2 — tutorial para importar transcripts do Notta (sem links publicos).
 *
 * Notta Pro nao tem Zapier/API directa, mas exporta TXT/DOCX/PDF de cada gravacao.
 * Fluxo: Joao exporta TXT no Notta -> carrega no CRM via CallUploadModal.
 *
 * Os dados ficam APENAS no Supabase do Joao com RLS + JWT + bucket privado.
 * Zero exposicao publica.
 */
export const NottaImportSection: React.FC = () => {
  const { organizationId } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [lastAt, setLastAt] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) return;
    const supabase = createClient();
    if (!supabase) return;

    (async () => {
      const { count: c } = await supabase
        .from('call_recordings')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('source', 'notta-text');
      setCount(c ?? 0);

      const { data: last } = await supabase
        .from('call_recordings')
        .select('created_at')
        .eq('organization_id', organizationId)
        .eq('source', 'notta-text')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.created_at) setLastAt(last.created_at);
    })();
  }, [organizationId]);

  const steps = [
    {
      n: 1,
      title: 'No Notta, abrir a gravação',
      body: 'Vá a app.notta.ai, abra a gravação que quer importar.',
      icon: ExternalLink,
    },
    {
      n: 2,
      title: 'Exportar arquivos brutos',
      body: 'Clique no ícone de download (topo direito, ao lado de Compartilhar) e escolha "Exportar arquivos brutos". Seleccione o formato TXT.',
      icon: Download,
    },
    {
      n: 3,
      title: 'Guardar o ficheiro',
      body: 'O Notta gera um .txt com a transcrição completa. Guarde no telemóvel/computador.',
      icon: FileText,
    },
    {
      n: 4,
      title: 'No CRM, abrir um deal e carregar',
      body: 'No deal correspondente, clique "Adicionar chamada", depois "carregar áudio / transcript do Notta" e escolha o .txt. A IA extrai resumo, próximas acções, sentimento. Activity CHAMADA fica logada automaticamente.',
      icon: Upload,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <header>
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">Importar do Notta</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Use os transcripts que o Notta já gera no seu plano Profissional. Sem custo extra, sem links públicos.
        </p>
      </header>

      <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-emerald-900 dark:text-emerald-100">
          <strong>Privacidade garantida.</strong> Os transcripts ficam apenas no seu Supabase com RLS por organização. Não há partilha pública, não há link acessível na internet. Apenas quem tem sessão autenticada vê os dados.
        </div>
      </div>

      {count !== null && count > 0 && (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm">
          <div className="text-slate-900 dark:text-white font-medium">
            {count} {count === 1 ? 'chamada importada' : 'chamadas importadas'} do Notta
          </div>
          {lastAt && (
            <div className="text-slate-500 dark:text-slate-400 mt-1">
              Última: {new Date(lastAt).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <div
              key={step.n}
              className="flex gap-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-semibold">
                {step.n}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-slate-400" />
                  <h4 className="font-medium text-slate-900 dark:text-white">{step.title}</h4>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{step.body}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-sm space-y-2">
        <h4 className="font-medium text-slate-900 dark:text-white">Detalhes técnicos</h4>
        <ul className="text-slate-600 dark:text-slate-300 space-y-1 list-disc list-inside">
          <li>Formatos aceites: <code className="text-xs bg-slate-100 dark:bg-white/10 px-1 rounded">.txt</code>, <code className="text-xs bg-slate-100 dark:bg-white/10 px-1 rounded">.md</code> (até 2 MB)</li>
          <li>Processamento: Gemini 2.5 Flash extrai resumo, key points, next actions, decisions, mentions, sentiment</li>
          <li>Tempo médio: 5 a 10 segundos por transcript</li>
          <li>Quando associada a um deal, é criada activity CALL automática (fecha CHQ)</li>
          <li>O Notta continua a guardar os áudios — o CRM só guarda o texto da transcrição</li>
        </ul>
      </div>

      <div className="text-xs text-slate-400 dark:text-slate-500">
        Notta plan Profissional não inclui Zapier nem API directa (só plano Business+). Este caminho usa export manual TXT, que está incluído no seu plano.
      </div>
    </div>
  );
};
