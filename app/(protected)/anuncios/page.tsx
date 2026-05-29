import type { Metadata } from 'next';
import { AnunciosPage } from '@/features/meta-ads/AnunciosPage';

export const metadata: Metadata = { title: 'Anúncios | Foco Imo' };

export default function Anuncios() {
  return <AnunciosPage />;
}
