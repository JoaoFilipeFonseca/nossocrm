import AngariacaoWorkflow from '@/features/ai/AngariacaoWorkflow';

export const metadata = {
    title: 'Preparar Angariação | Foco Imo',
    description: 'Workflow guiado IA para preparar reunião de angariação imobiliária',
};

export default function AngariacaoPage() {
    return <AngariacaoWorkflow />;
}
