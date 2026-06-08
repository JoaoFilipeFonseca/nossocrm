import type { ComponentType } from 'react';
import {
  Inbox,
  MessageSquare,
  KanbanSquare,
  Users,
  CheckSquare,
  MoreHorizontal,
  LayoutDashboard,
  BarChart3,
  Settings,
  User,
  ScrollText,
  Home,
  Target,
  Zap,
  Megaphone,
  Archive,
  Sparkles,
  Activity,
  Filter,
  Wallet,
} from 'lucide-react';

export type PrimaryNavId = 'inbox' | 'messaging' | 'cruzamentos' | 'matches' | 'boards' | 'contacts' | 'imoveis' | 'activities' | 'more';

export interface PrimaryNavItem {
  id: PrimaryNavId;
  label: string;
  /** Route to navigate. For "more", this is omitted because it opens a menu/sheet. */
  href?: string;
  icon: ComponentType<{ className?: string }>;
}

export const PRIMARY_NAV: PrimaryNavItem[] = [
  { id: 'inbox', label: 'Inbox', href: '/inbox', icon: Inbox },
  { id: 'messaging', label: 'Mensagens', href: '/messaging', icon: MessageSquare },
  { id: 'cruzamentos', label: 'Cruzamentos', href: '/cruzamentos', icon: Target },
  { id: 'matches', href: '/matches', label: 'Matches', icon: Inbox },
  { id: 'boards', label: 'Boards', href: '/boards', icon: KanbanSquare },
  { id: 'contacts', label: 'Contactos', href: '/contacts', icon: Users },
  { id: 'imoveis', label: 'Imóveis', href: '/imoveis', icon: Home },
  { id: 'activities', label: 'Actividades', href: '/activities', icon: CheckSquare },
  { id: 'more', label: 'Mais', icon: MoreHorizontal },
];

export type SecondaryNavId = 'dashboard' | 'reports' | 'funil' | 'despesas' | 'anuncios' | 'criativos' | 'automacoes' | 'automation_logs' | 'settings' | 'profile';

export interface SecondaryNavItem {
  id: SecondaryNavId;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

/** Mirrors non-primary destinations available in the desktop sidebar/user menu. */
export const SECONDARY_NAV: SecondaryNavItem[] = [
  { id: 'dashboard', label: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard },
  { id: 'reports', label: 'Relatórios', href: '/reports', icon: BarChart3 },
  { id: 'funil', label: 'Funil', href: '/funil', icon: Filter },
  { id: 'despesas', label: 'Financeiro', href: '/financeiro', icon: Wallet },
  { id: 'anuncios', label: 'Anúncios', href: '/anuncios', icon: Megaphone },
  { id: 'criativos', label: 'Criativos', href: '/criativos', icon: Archive },
  { id: 'automacoes', label: 'Automações', href: '/automacoes', icon: Zap },
  { id: 'automation_logs', label: 'Logs Automações', href: '/settings/automation-logs', icon: ScrollText },
  { id: 'settings', label: 'Configurações', href: '/settings', icon: Settings },
  { id: 'profile', label: 'Perfil', href: '/profile', icon: User },
];

export interface FullNavItem {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** Só aparece a utilizadores com role 'admin'. */
  adminOnly?: boolean;
}

/**
 * Navegação COMPLETA para a gaveta mobile (hambúrguer → esquerda).
 * Espelha a sidebar do desktop, na mesma ordem. Fonte única para o drawer.
 */
export const FULL_NAV: FullNavItem[] = [
  { id: 'inbox', label: 'Inbox', href: '/inbox', icon: Inbox },
  { id: 'messaging', label: 'Mensagens', href: '/messaging', icon: MessageSquare },
  { id: 'dashboard', label: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard },
  { id: 'cruzamentos', label: 'Cruzamentos', href: '/cruzamentos', icon: Target },
  { id: 'matches', label: 'Matches', href: '/matches', icon: Inbox },
  { id: 'angariacao', label: 'Angariação IA', href: '/ai/workflows/angariacao', icon: Sparkles },
  { id: 'boards', label: 'Boards', href: '/boards', icon: KanbanSquare },
  { id: 'contacts', label: 'Contactos', href: '/contacts', icon: Users },
  { id: 'imoveis', label: 'Imóveis', href: '/imoveis', icon: Home },
  { id: 'activities', label: 'Actividades', href: '/activities', icon: CheckSquare },
  { id: 'reports', label: 'Relatórios', href: '/reports', icon: BarChart3 },
  { id: 'funil', label: 'Funil', href: '/funil', icon: Filter },
  { id: 'despesas', label: 'Financeiro', href: '/financeiro', icon: Wallet },
  { id: 'anuncios', label: 'Anúncios', href: '/anuncios', icon: Megaphone },
  { id: 'criativos', label: 'Criativos', href: '/criativos', icon: Archive },
  { id: 'automacoes', label: 'Automações', href: '/automacoes', icon: Zap },
  { id: 'saude', label: 'Saúde', href: '/admin/saude', icon: Activity, adminOnly: true },
  { id: 'settings', label: 'Configurações', href: '/settings', icon: Settings },
  { id: 'profile', label: 'Perfil', href: '/profile', icon: User },
];
