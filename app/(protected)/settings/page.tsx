import type { Metadata } from 'next';
import SettingsPage from '@/features/settings/SettingsPage'

export const metadata: Metadata = { title: 'Configurações | Foco Imo' };

export default function Settings() {
    return <SettingsPage />
}
