import type { Metadata } from 'next';
import { CerebroPage } from '@/features/cerebro/CerebroPage';

export const metadata: Metadata = { title: 'Cérebro de Marketing | Foco Imo' };

export default function Cerebro() {
  return <CerebroPage />;
}
