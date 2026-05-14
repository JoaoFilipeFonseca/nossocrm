import type { Metadata } from 'next';
import { DecisionQueuePage } from '@/features/decisions/DecisionQueuePage'

export const metadata: Metadata = { title: 'DecisÃµes | Foco Imo' };

export default function Decisions() {
    return <DecisionQueuePage />
}
