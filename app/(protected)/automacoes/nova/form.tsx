'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  definition: { nodes: Array<{ id: string; atom: string; position: { x: number; y: number }; config: Record<string, unknown>; label?: string }>; edges: Array<{ id: string; source: string; target: string }> };
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
    id: 'email_sequence_boas_vindas',
    name: 'Sequência de boas-vindas (3 emails)',
    description: 'Lead nova com email recebe boas-vindas logo, um segundo email passadas ~3 horas e um terceiro no dia seguinte. As esperas respeitam o horário comercial (nunca aos Domingos). Todos os emails saem com rodapé de anular subscrição e política de privacidade. Nasce em rascunho: edita os textos no builder e activa quando estiver pronta.',
    icon: '💌',
    definition: {
      nodes: [
        { id: 'n1', atom: 'trigger.event', position: { x: 0, y: 0 }, config: { events: ['contact.created'] } },
        { id: 'n2', atom: 'logic.filter', position: { x: 220, y: 0 }, config: { left: '{{contact.email}}', operator: 'is_not_empty', right: '' } },
        {
          id: 'n3', atom: 'action.send_email', position: { x: 440, y: 0 },
          label: 'Email 1 · Boas-vindas',
          config: {
            to: '{{contact.email}}',
            subject: 'Recebi o seu pedido, {{contact.name | split: " " | first}}',
            text: 'Olá {{contact.name | split: " " | first}},\n\nObrigado pelo seu contacto. Recebi o seu pedido e vou analisar tudo com atenção.\n\nEntretanto, se quiser adiantar caminho, responda a este email com duas linhas sobre o que procura (zona, tipo de imóvel, prazos). Assim consigo preparar uma resposta mais útil.\n\nFalamos em breve.\n\nJoão Fonseca\nConsultor Imobiliário · RE/MAX',
            html: '<p>Olá {{contact.name | split: " " | first}},</p><p>Obrigado pelo seu contacto. Recebi o seu pedido e vou analisar tudo com atenção.</p><p>Entretanto, se quiser adiantar caminho, responda a este email com duas linhas sobre o que procura (zona, tipo de imóvel, prazos). Assim consigo preparar uma resposta mais útil.</p><p>Falamos em breve.</p><p>João Fonseca<br/>Consultor Imobiliário · RE/MAX</p>',
          },
        },
        { id: 'n4', atom: 'logic.wait_humanized', position: { x: 660, y: 0 }, config: { min_seconds: 10800, max_seconds: 14400 } },
        {
          id: 'n5', atom: 'action.send_email', position: { x: 880, y: 0 },
          label: 'Email 2 · ~3 horas depois',
          config: {
            to: '{{contact.email}}',
            subject: 'Uma pergunta rápida sobre o que procura',
            text: 'Olá {{contact.name | split: " " | first}},\n\nPara o conseguir ajudar a sério, só preciso de saber uma coisa: está a pensar comprar, vender, ou ainda a estudar o mercado?\n\nCom essa resposta consigo apontar o caminho certo, sem perder o seu tempo.\n\nQuando lhe for oportuno, basta responder a este email.\n\nJoão Fonseca\nConsultor Imobiliário · RE/MAX',
            html: '<p>Olá {{contact.name | split: " " | first}},</p><p>Para o conseguir ajudar a sério, só preciso de saber uma coisa: está a pensar comprar, vender, ou ainda a estudar o mercado?</p><p>Com essa resposta consigo apontar o caminho certo, sem perder o seu tempo.</p><p>Quando lhe for oportuno, basta responder a este email.</p><p>João Fonseca<br/>Consultor Imobiliário · RE/MAX</p>',
          },
        },
        { id: 'n6', atom: 'logic.wait_humanized', position: { x: 1100, y: 0 }, config: { min_seconds: 86400, max_seconds: 93600 } },
        {
          id: 'n7', atom: 'action.send_email', position: { x: 1320, y: 0 },
          label: 'Email 3 · No dia seguinte',
          config: {
            to: '{{contact.email}}',
            subject: 'Posso ajudar com o próximo passo?',
            text: 'Olá {{contact.name | split: " " | first}},\n\nNão quero encher a sua caixa de correio, por isso este é o meu último email por agora.\n\nSe fizer sentido, a minha proposta é uma conversa de 15 minutos, sem compromisso, para perceber o seu objectivo e responder com franqueza sobre a melhor forma de ajudar (e se não for o momento, digo isso mesmo).\n\nQuando lhe for oportuno, basta responder a este email.\n\nJoão Fonseca\nConsultor Imobiliário · RE/MAX',
            html: '<p>Olá {{contact.name | split: " " | first}},</p><p>Não quero encher a sua caixa de correio, por isso este é o meu último email por agora.</p><p>Se fizer sentido, a minha proposta é uma conversa de 15 minutos, sem compromisso, para perceber o seu objectivo e responder com franqueza sobre a melhor forma de ajudar (e se não for o momento, digo isso mesmo).</p><p>Quando lhe for oportuno, basta responder a este email.</p><p>João Fonseca<br/>Consultor Imobiliário · RE/MAX</p>',
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
        { id: 'e4', source: 'n4', target: 'n5' },
        { id: 'e5', source: 'n5', target: 'n6' },
        { id: 'e6', source: 'n6', target: 'n7' },
      ],
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
