import { redirect } from 'next/navigation';

// A Caixa Social passou a viver dentro de Mensagens (aba). Mantém-se o caminho antigo
// a redireccionar para não partir links (Telegram) nem marcadores.
export default function CaixaSocial() {
  redirect('/messaging?tab=social');
}
