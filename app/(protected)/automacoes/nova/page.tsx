import NovaAutomacaoForm from './form';

export const metadata = { title: 'Nova Automação | Foco Imo' };

export default function NovaAutomacaoPage() {
  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Nova automação</h1>
      <p className="text-sm text-slate-500 mb-6">Dá-lhe um nome e escolhe um ponto de partida. Vais poder editar tudo no builder a seguir.</p>
      <NovaAutomacaoForm />
    </div>
  );
}
