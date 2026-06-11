import type { Metadata } from 'next';
import { CriativosPage } from '@/features/criativos/CriativosPage';

export const metadata: Metadata = { title: 'Biblioteca | Foco Imo' };

export default function Page() {
  return <CriativosPage />;
}
