'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  definition: { nodes: Array<{ id: string; atom: string; position: { x: number; y: number }; config: Record<string, unknown> }>; edges: Array<{ id: string; source: string; target: string }> };
}

const TEMPLATES: Template[] = [
  {
    id: 'empty',
    name: 'Em branco',
    description: 'Começa do zero. Adiciona nós no builder.',
    icon: '⚡',
    definition: { nodes: [], edges: [] },
  },
  {
    id: 'contact_log',
    name: 'Lead novo → log',
    description: 'Quando um contacto é criado, escreve uma entrada no histórico. Útil para testares o motor.',
    icon: '📝',
    definition: {
      nodes: [
        { id: 'n1', atom: 'trigger.event', position: { x: 0, y: 0 }, config: { events: ['contact.created'] } },
        { id: 'n2', atom: 'action.log', position: { x: 250, y: 0 }, config: { message: 'Novo lead: {{contact.name}}', level: 'info' } },
      ],
      edges: [ { id: 'e1', source: 'n1', target: 'n2' } ],
    },
  },
  {
    id: 'contact_telegram',
    name: 'Lead novo → Telegram',
    description: 'Quando um contacto é criado, envia mensagem para o teu Telegram.',
    icon: '📨',
    definition: {
      nodes: [
        { id: 'n1', atom: 'trigger.event', position: { x: 0, y: 0 }, config: { events: ['contact.created'] } },
        { id: 'n2', atom: 'action.send_telegram', position: { x: 250, y: 0 }, config: { text: '🆕 Novo lead: <b>{{contact.name}}</b>\nStage: {{contact.stage}}' } },
      ],
      edges: [ { id: 'e1', source: 'n1', target: 'n2' } ],
    },
  },
  {
    id: 'contact_wait_telegram',
    name: 'Lead novo → espera 5min → Telegram',
    description: 'Espera 5 minutos antes de te avisar para não interromper noutra coisa.',
    icon: '⏱️',
    definition: {
      nodes: [
        { id: 'n1', atom: 'trigger.event', position: { x: 0, y: 0 }, config: { events: ['contact.created'] } },
        { id: 'n2', atom: 'logic.wait_fixed', position: { x: 250, y: 0 }, config: { seconds: 300 } },
        { id: 'n3', atom: 'action.send_telegram', position: { x: 500, y: 0 }, config: { text: '⏱️ Há 5 min entrou: <b>{{contact.name}}</b>\nStage: {{contact.stage}}' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
      ],
    },
  },
];

export default function NovaAutomacaoForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState<string>('contact_log');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Dá um nome à automação.');
      return;
    }
    const template = TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0];

    setSubmitting(true);
    try {
      const res = await fetch('/api/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmed,
          icon: template.icon,
          definition: template.definition,
          status: 'draft',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `Erro ${res.status}`);
      }
      const created = await res.json();
      router.push(`/automacoes/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Avisar-me de leads novos"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:ring-1 focus:ring-violet-500 outline-none"
          required
          autoFocus
        />
      </div>

      <fieldset>
        <legend className="block text-sm font-medium text-slate-700 mb-2">Ponto de partida</legend>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <label
              key={t.id}
              className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer transition ${templateId === t.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
            >
              <input
                type="radio"
                name="template"
                value={t.id}
                checked={templateId === t.id}
                onChange={() => setTemplateId(t.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{t.icon}</span>
                  <span className="font-medium text-slate-900">{t.name}</span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{t.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {error ? <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div> : null}

      <div className="flex items-center justify-between pt-2">
        <Link href="/automacoes" className="text-sm text-slate-600 hover:text-slate-900">Cancelar</Link>
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {submitting ? 'A criar...' : 'Criar automação'}
        </button>
      </div>
    </form>
  );
}
