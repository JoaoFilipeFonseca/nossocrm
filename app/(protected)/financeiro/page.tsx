import type { Metadata } from 'next';
import { FinanceiroPage } from '@/features/financeiro/FinanceiroPage';

export const metadata: Metadata = { title: 'Financeiro | Foco Imo' };

export default function Financeiro() {
  return <FinanceiroPage />;
}
