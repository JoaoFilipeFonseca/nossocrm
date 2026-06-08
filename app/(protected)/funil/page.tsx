import type { Metadata } from 'next';
import { FunnelPage } from '@/features/funnel/FunnelPage';

export const metadata: Metadata = { title: 'Funil de Vendas | Foco Imo' };

export default function Funil() {
  return <FunnelPage />;
}
