import type { Metadata } from 'next';
import SettingsPage from '@/features/settings/SettingsPage';

export const metadata: Metadata = { title: 'Metas | Foco Imo' };

export default function SettingsMetas() {
  return <SettingsPage tab="metas" />;
}
