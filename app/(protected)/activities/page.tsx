import type { Metadata } from 'next';
import { ActivitiesPage } from '@/features/activities/ActivitiesPage'

export const metadata: Metadata = { title: 'Tarefas | Foco Imo' };

export default function Activities() {
    return <ActivitiesPage />
}
