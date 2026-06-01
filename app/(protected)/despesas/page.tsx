import { redirect } from 'next/navigation';

// As Despesas passaram a viver no hub Financeiro (separador Despesas).
export default function Despesas() {
  redirect('/financeiro');
}
