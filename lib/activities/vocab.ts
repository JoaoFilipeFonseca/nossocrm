/**
 * Vocabulário canónico de registo de contactos (deal_activities).
 * Fonte única partilhada pela validação das rotas API e pela UI (modal + timeline).
 * Copy em PT-PT pré-AO 1990, sem abreviaturas.
 */

/** Canais de contacto manual (o `type` da deal_activity). */
export const CHANNELS = ['call', 'whatsapp', 'sms', 'email', 'meeting', 'visit'] as const;
export type Channel = (typeof CHANNELS)[number];

/** Resultado do contacto (guardado em metadata.result). */
export const RESULTS = ['answered', 'returned', 'no_answer', 'voicemail', 'rescheduled'] as const;
export type Result = (typeof RESULTS)[number];

/**
 * Resultados que NÃO contam como conversa real para o relógio de follow-up.
 * Uma chamada não atendida conta como contacto (trabalho feito), mas a lead
 * continua "por contactar" — o relógio do pipeline continua a andar.
 * (Alinhado com a migração deal_state_signals.)
 */
export const NON_CONVERSATION_RESULTS: readonly Result[] = ['no_answer', 'voicemail'];

export interface ChannelMeta {
  label: string;
  icon: string;
  /** classes do círculo do ícone na timeline. */
  cls: string;
}

export const CHANNEL_META: Record<string, ChannelMeta> = {
  call: { label: 'Chamada', icon: '📞', cls: 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-300' },
  whatsapp: { label: 'WhatsApp', icon: '💬', cls: 'bg-green-50 border-green-200 text-green-600 dark:bg-green-500/10 dark:border-green-500/20 dark:text-green-300' },
  sms: { label: 'SMS', icon: '✉️', cls: 'bg-sky-50 border-sky-200 text-sky-600 dark:bg-sky-500/10 dark:border-sky-500/20 dark:text-sky-300' },
  email: { label: 'Email', icon: '📧', cls: 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-500/10 dark:border-blue-500/20 dark:text-blue-300' },
  meeting: { label: 'Reunião', icon: '🤝', cls: 'bg-violet-50 border-violet-200 text-violet-600 dark:bg-violet-500/10 dark:border-violet-500/20 dark:text-violet-300' },
  visit: { label: 'Visita', icon: '🏠', cls: 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300' },
  note: { label: 'Nota', icon: '📝', cls: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300' },
  TASK: { label: 'Tarefa', icon: '📋', cls: 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300' },
  stage_moved: { label: 'Mudou de etapa', icon: '↗', cls: 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-slate-500' },
  stage_change: { label: 'Mudou de etapa', icon: '↗', cls: 'bg-slate-100 border-slate-200 text-slate-400 dark:bg-white/5 dark:border-white/10 dark:text-slate-500' },
  lead_first_response: { label: 'Resposta automática', icon: '⚡', cls: 'bg-indigo-50 border-indigo-200 text-indigo-500 dark:bg-indigo-500/10 dark:border-indigo-500/20 dark:text-indigo-300' },
};

export function channelMeta(type: string): ChannelMeta {
  return CHANNEL_META[type] ?? { label: type, icon: '•', cls: 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-white/5 dark:border-white/10 dark:text-slate-400' };
}

export interface ResultMeta {
  label: string;
  /** tom do chip: verde (positivo), rosa (sem resposta), neutro (a acompanhar). */
  tone: 'good' | 'bad' | 'neutral';
}

export const RESULT_META: Record<string, ResultMeta> = {
  answered: { label: 'Atendeu / Respondeu', tone: 'good' },
  returned: { label: 'Retribuiu', tone: 'good' },
  no_answer: { label: 'Não atendeu / Sem resposta', tone: 'bad' },
  voicemail: { label: 'Deixou mensagem / Voicemail', tone: 'bad' },
  rescheduled: { label: 'Reagendou / Ligar depois', tone: 'neutral' },
};

export const RESULT_TONE_CLS: Record<ResultMeta['tone'], string> = {
  good: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  bad: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
  neutral: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
};

/** Badge de quem originou o toque (👤 humano / 🤖 automação). */
export const ACTOR_BADGE: Record<'human' | 'automation', { label: string; icon: string; cls: string }> = {
  human: { label: 'Você', icon: '👤', cls: 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10' },
  automation: { label: 'Automação', icon: '🤖', cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20' },
};
