import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MessagingTabs } from '@/features/messaging/MessagingTabs'

export const metadata: Metadata = { title: 'Mensagens | Foco Imo' };

export default function Messaging() {
    return (
      <Suspense fallback={null}>
        <MessagingTabs />
      </Suspense>
    )
}
