/**
 * MobileNavDrawer — gaveta de navegação à ESQUERDA (mobile).
 *
 * Aberta pelo botão hambúrguer do header. Espelha a navegação da sidebar
 * (NAV_TOP sempre à vista + famílias em acordeão, UX-1), deslizável na
 * vertical (overflow-y-auto), full-height.
 * Fecha ao tocar num item, no fundo (backdrop) ou Escape.
 *
 * Mesmo padrão de acessibilidade/motion do ActionSheet, mas painel lateral.
 * Não toca nas primitivas Sheet/ActionSheet partilhadas.
 */
import React, { useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, ChevronDown, ChevronRight, User } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils/cn';
import { FocusTrap, useFocusReturn } from '@/lib/a11y';
import { NAV_TOP, NAV_FAMILIES, type NavEntry } from './navConfig';
import { useNavFamilies } from './useNavFamilies';

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Mostra os itens adminOnly (ex.: Saúde). */
  isAdmin?: boolean;
  /** Nome a mostrar no rodapé do drawer (opcional). */
  userLabel?: string;
  /** Email a mostrar no rodapé do drawer (opcional). */
  userEmail?: string;
}

export function MobileNavDrawer({
  isOpen,
  onClose,
  isAdmin = false,
  userLabel,
  userEmail,
}: MobileNavDrawerProps) {
  const pathname = usePathname();
  useFocusReturn({ enabled: isOpen });

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  const handleEscape = useCallback(() => onClose(), [onClose]);

  const isHrefActive = (href: string) =>
    pathname === href ||
    (href === '/boards' && pathname === '/pipeline');

  // UX-1: as mesmas famílias da sidebar, em acordeão (a activa abre sozinha).
  const { openFamilies, toggleFamily } = useNavFamilies(pathname);
  const families = NAV_FAMILIES.map((fam) => ({
    ...fam,
    items: fam.items.filter((item) => !item.adminOnly || isAdmin),
  }));

  const renderItem = (item: NavEntry) => {
    const Icon = item.icon;
    const active = isHrefActive(item.href);
    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={onClose}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible-ring',
          active
            ? 'border border-primary-200 bg-primary-500/10 text-primary-600 dark:border-primary-900/50 dark:text-primary-400'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
        )}
      >
        <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary-500' : '')} aria-hidden="true" />
        <span className="font-display tracking-wide">{item.label}</span>
      </Link>
    );
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <FocusTrap active={isOpen} onEscape={handleEscape} returnFocus={true}>
          <motion.div
            className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={handleBackdropClick}
            aria-hidden="false"
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navegação"
              className={cn(
                'absolute inset-y-0 left-0 flex h-full w-[80vw] max-w-[320px] flex-col',
                'bg-white dark:bg-dark-card',
                'border-r border-slate-200 dark:border-white/10',
                'shadow-2xl',
                // safe areas (notch esquerdo + barra inferior)
                'pl-[env(safe-area-inset-left,0px)] pb-[var(--app-safe-area-bottom,0px)]'
              )}
              initial={{ x: '-100%', opacity: 0.6 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.6 }}
              transition={{ type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.26 }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Cabeçalho com marca + fechar */}
              <div
                className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-white/10"
                style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)', paddingBottom: '12px' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-xs font-bold tracking-tight text-white shadow-lg shadow-primary-500/20"
                    aria-hidden="true"
                  >
                    CRM
                  </div>
                  <div className="flex flex-col">
                    <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                      Foco Imo
                    </span>
                    <span className="font-mono text-[10px] leading-tight text-slate-400 dark:text-slate-500">
                      {process.env.NEXT_PUBLIC_BUILD_TAG || 'dev'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 transition-colors hover:bg-slate-100 focus-visible-ring dark:hover:bg-white/5"
                  aria-label="Fechar menu"
                >
                  <X size={18} className="text-slate-500" />
                </button>
              </div>

              {/* Navegação completa, deslizável na vertical */}
              <nav
                aria-label="Navegação principal (mobile)"
                className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3"
              >
                {NAV_TOP.map(renderItem)}

                {families.map((fam) => (
                  <div key={fam.id} className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleFamily(fam.id)}
                      aria-expanded={!!openFamilies[fam.id]}
                      className="flex w-full items-center gap-2 px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600 focus-visible-ring dark:text-slate-500 dark:hover:text-slate-300"
                    >
                      <span className="font-display">{fam.label}</span>
                      {!openFamilies[fam.id] && (
                        <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold normal-case tracking-normal text-slate-500 dark:bg-white/10 dark:text-slate-400">{fam.items.length}</span>
                      )}
                      {openFamilies[fam.id]
                        ? <ChevronDown size={14} className="ml-auto shrink-0" aria-hidden="true" />
                        : <ChevronRight size={14} className="ml-auto shrink-0" aria-hidden="true" />}
                    </button>
                    {openFamilies[fam.id] && (
                      <div className="mt-1 space-y-1">
                        {fam.items.map(renderItem)}
                      </div>
                    )}
                  </div>
                ))}

                {renderItem({ id: 'profile', label: 'Perfil', href: '/profile', icon: User })}
              </nav>

              {/* Rodapé com identificação do utilizador */}
              {(userLabel || userEmail) ? (
                <div className="shrink-0 border-t border-slate-200 px-4 py-3 dark:border-white/10">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {userLabel || ''}
                  </p>
                  {userEmail ? (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{userEmail}</p>
                  ) : null}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        </FocusTrap>
      ) : null}
    </AnimatePresence>
  );
}
