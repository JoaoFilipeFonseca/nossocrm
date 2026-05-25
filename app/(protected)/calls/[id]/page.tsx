import type { Metadata } from 'next';
import { CallDetailPage } from '@/features/calls/CallDetailPage';

export const metadata: Metadata = { title: 'Chamada | Foco Imo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallDetailPage id={id} />;
}
