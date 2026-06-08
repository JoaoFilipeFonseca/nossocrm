import type { Metadata } from 'next';
import { SocialInboxPage } from '@/features/social-inbox/SocialInboxPage';

export const metadata: Metadata = { title: 'Caixa Social | Foco Imo' };

export default function CaixaSocial() {
  return <SocialInboxPage />;
}
