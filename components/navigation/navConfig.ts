import type { ComponentType } from 'react';
import type { RouteName } from '@/lib/prefetch';
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
  Share2,
  Brain,
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

export type SecondaryNavId = 'dashboard' | 'reports' | 'funil' | 'despesas' | 'anuncios' | 'organico' | 'cerebro' | 'criativos' | 'automacoes' | 'automation_logs' | 'settings' | 'profile';

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
  { id: 'organico', label: 'Orgânico', href: '/organico', icon: Share2 },
  { id: 'cerebro', label: 'Cérebro', href: '/cerebro', icon: Brain },
  { id: 'criativos', label: 'Biblioteca', href: '/criativos', icon: Archive },
  { id: 'automacoes', label: 'Automações', href: '/automacoes', icon: Zap },
  { id: 'automation_logs', label: 'Logs Automações', href: '/settings/automation-logs', icon: ScrollText },
  { id: 'settings', label: 'Configurações', href: '/settings', icon: Settings },
  { id: 'profile', label: 'Perfil', href: '/profile', icon: User },
];

export interface NavEntry {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Chunk a pré-carregar em hover/focus (lib/prefetch). */
  prefetch?: RouteName;
  /** Só aparece a utilizadores com role 'admin'. */
  adminOnly?: boolean;
}

export type NavFamilyId = 'vendas' | 'marketing' | 'analise' | 'sistema';

export interface NavFamily {
  id: NavFamilyId;
  label: string;
  items: NavEntry[];
}

/**
 * UX-1 NAV-IA — navegação por famílias (fonte única).
 * O dia a dia (NAV_TOP) fica sempre à vista; o resto vive em 4 famílias
 * colapsáveis. Consumida pela sidebar desktop (Layout) e pela gaveta mobile.
 */
export const NAV_TOP: NavEntry[] = [
  { id: 'inbox', label: 'Inbox', href: '/inbox', icon: Inbox, prefetch: 'inbox' },
  { id: 'messaging', label: 'Mensagens', href: '/messaging', icon: MessageSquare },
  { id: 'activities', label: 'Actividades', href: '/activities', icon: CheckSquare, prefetch: 'activities' },
];

export const NAV_FAMILIES: NavFamily[] = [
  {
    id: 'vendas',
    label: 'Vendas',
    items: [
      { id: 'boards', label: 'Boards', href: '/boards', icon: KanbanSquare, prefetch: 'boards' },
      { id: 'contacts', label: 'Contactos', href: '/contacts', icon: Users, prefetch: 'contacts' },
      { id: 'imoveis', label: 'Imóveis', href: '/imoveis', icon: Home },
      { id: 'cruzamentos', label: 'Cruzamentos', href: '/cruzamentos', icon: Target },
      { id: 'matches', label: 'Matches', href: '/matches', icon: Inbox },
    ],
  },
  {
    id: 'marketing',
    label: 'Marketing',
    items: [
      { id: 'anuncios', label: 'Anúncios', href: '/anuncios', icon: Megaphone },
      { id: 'organico', label: 'Orgânico', href: '/organico', icon: Share2 },
      { id: 'criativos', label: 'Biblioteca', href: '/criativos', icon: Archive },
      { id: 'angariacao', label: 'Angariação IA', href: '/ai/workflows/angariacao', icon: Sparkles },
    ],
  },
  {
    id: 'analise',
    label: 'Análise',
    items: [
      { id: 'dashboard', label: 'Visão Geral', href: '/dashboard', icon: LayoutDashboard, prefetch: 'dashboard' },
      { id: 'funil', label: 'Funil', href: '/funil', icon: Filter },
      { id: 'reports', label: 'Relatórios', href: '/reports', icon: BarChart3, prefetch: 'reports' },
      { id: 'despesas', label: 'Financeiro', href: '/financeiro', icon: Wallet },
      { id: 'cerebro', label: 'Cérebro', href: '/cerebro', icon: Brain },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    items: [
      { id: 'automacoes', label: 'Automações', href: '/automacoes', icon: Zap },
      { id: 'saude', label: 'Saúde', href: '/admin/saude', icon: Activity, adminOnly: true },
      { id: 'settings', label: 'Configurações', href: '/settings', icon: Settings, prefetch: 'settings' },
    ],
  },
];

/** Família a que pertence uma rota (por prefixo), p/ abrir sozinha a activa. */
export const familyIdForPath = (pathname: string): NavFamilyId | null => {
  if (!pathname) return null;
  const matches = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  for (const fam of NAV_FAMILIES) {
    for (const item of fam.items) {
      if (matches(item.href)) return fam.id;
      if (item.href === '/boards' && matches('/pipeline')) return fam.id;
    }
  }
  return null;
};
