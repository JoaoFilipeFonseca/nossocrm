import type { Metadata } from 'next';
import { OrganicoPage } from '@/features/organico/OrganicoPage';

export const metadata: Metadata = { title: 'Orgânico | Foco Imo' };

export default function Organico() {
  return <OrganicoPage />;
}
