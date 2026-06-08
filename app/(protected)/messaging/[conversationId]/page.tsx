import { Suspense } from 'react';
import { Metadata } from 'next';
import { MessagingPage } from '@/features/messaging/MessagingPage';
import { MessageThreadSkeleton } from '@/features/messaging/components';

interface ConversationPageProps {
  params: Promise<{
    conversationId: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Conversa | Foco Imo',
  description: 'Visualizar conversa',
};

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params;

  return (
    <Suspense fallback={<MessageThreadSkeleton />}>
      <div className="h-[calc(100vh-4rem)]">
        <MessagingPage initialConversationId={conversationId} />
      </div>
    </Suspense>
  );
}
