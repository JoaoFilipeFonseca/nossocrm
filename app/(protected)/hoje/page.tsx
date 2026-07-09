import type { Metadata } from 'next';
import { HojePage } from '@/features/hoje/HojePage';

export const metadata: Metadata = { title: 'Hoje | Foco Imo' };

export default function Hoje() {
  return <HojePage />;
}
