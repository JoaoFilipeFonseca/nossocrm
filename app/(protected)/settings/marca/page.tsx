import type { Metadata } from 'next';
import SettingsPage from '@/features/settings/SettingsPage';

export const metadata: Metadata = { title: 'Marca pessoal | Foco Imo' };

export default function SettingsMarca() {
  return <SettingsPage tab="marca" />;
}
