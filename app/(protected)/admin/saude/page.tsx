import type { Metadata } from 'next';
import HealthPage from '@/features/admin/HealthPage';

export const metadata: Metadata = { title: 'Saúde | Foco Imo' };

export default function AdminSaudePage() {
  return <HealthPage />;
}
