import type { Metadata } from 'next';
import { DespesasPage } from '@/features/financeiro/DespesasPage';

export const metadata: Metadata = { title: 'Despesas | Foco Imo' };

export default function Despesas() {
  return <DespesasPage />;
}
