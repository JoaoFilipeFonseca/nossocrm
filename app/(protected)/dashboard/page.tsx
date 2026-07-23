import type { Metadata } from 'next';
import PainelPage from '@/features/painel/PainelPage'

export const metadata: Metadata = { title: 'Painel Diário | Foco Imo' };

export default function Dashboard() {
    return <PainelPage />
}
