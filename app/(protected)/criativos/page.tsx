import type { Metadata } from 'next';
import { CriativosPage } from '@/features/criativos/CriativosPage';

export const metadata: Metadata = { title: 'Criativos | Foco Imo' };

export default function Page() {
  return <CriativosPage />;
}
