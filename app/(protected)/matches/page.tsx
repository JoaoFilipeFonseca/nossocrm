import { redirect } from 'next/navigation';

/**
 * Rota legada `/matches` (antes "Inbox Bruto") → `/cruzamentos`.
 * A ingestão de informação e os matches passaram a viver na mesma página
 * (arrumação do CRM, W-cruzamentos). Alias mantido para links antigos.
 */
export default function MatchesPage() {
  redirect('/cruzamentos');
}
