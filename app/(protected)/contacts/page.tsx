import type { Metadata } from 'next';
import { ContactsPage } from '@/features/contacts/ContactsPage'

export const metadata: Metadata = { title: 'Contactos | Foco Imo' };

export default function Contacts() {
    return <ContactsPage />
}
