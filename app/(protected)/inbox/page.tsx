import { redirect } from 'next/navigation';

/**
 * Rota legada `/inbox` → `/hoje` (Power List).
 * O Inbox deixou de existir (arrumação do CRM, W1/W2). O trabalho do dia
 * vive agora no Hoje. Alias mantido para marcadores e links antigos.
 */
export default function InboxPage() {
  redirect('/hoje');
}
