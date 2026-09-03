import { notFound } from 'next/navigation';
import AIModesTestClient from './AIModesTestClient';

/**
 * @fileoverview AI Modes Test Page — guarda de acesso
 *
 * Painel de teste para validar os modos de IA. Dev-only, mesma guarda das
 * rotas irmãs (`/api/test/cleanup`, `/api/test/setup-mode`, `/ai/board-config`
 * etc.): fora de desenvolvimento devolve 404, tal como se a página não
 * existisse. Corrigido 2 Set 2026 — esta rota ficava acessível em produção a
 * qualquer sessão válida, sem a guarda que as outras já tinham.
 *
 * @module app/(app)/test/ai-modes/page
 */
export default function AIModesTestPage() {
  const isEnabled = process.env.NODE_ENV === 'development' && process.env.ALLOW_TEST_ROUTES === 'true';
  if (!isEnabled) {
    notFound();
  }
  return <AIModesTestClient />;
}
