import type { Metadata } from 'next';
import { ProfilePage } from '@/features/profile/ProfilePage'

export const metadata: Metadata = { title: 'Perfil | Foco Imo' };

export default function Profile() {
    return <ProfilePage />
}
