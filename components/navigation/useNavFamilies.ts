/**
 * useNavFamilies — estado aberto/fechado das famílias da navegação (UX-1).
 *
 * SSR-determinista: tudo fechado no 1.º render; o localStorage só é lido
 * depois de montar (sem mismatch de hidratação #418). A família da rota
 * activa abre sozinha; só os toggles explícitos do utilizador persistem.
 */
import { useCallback, useEffect, useState } from 'react';
import { familyIdForPath, type NavFamilyId } from './navConfig';

const STORAGE_KEY = 'crm_nav_families_open';

type OpenMap = Partial<Record<NavFamilyId, boolean>>;

const readStored = (): OpenMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as OpenMap) : {};
  } catch {
    return {};
  }
};

export function useNavFamilies(pathname: string) {
  const [openFamilies, setOpenFamilies] = useState<OpenMap>({});

  // Pós-montagem: restaura o que o utilizador deixou aberto (prev ganha,
  // para não fechar a família da rota activa já aberta entretanto).
  useEffect(() => {
    setOpenFamilies(prev => ({ ...readStored(), ...prev }));
  }, []);

  // A família do sítio onde estás abre sozinha (não persiste).
  useEffect(() => {
    const fam = familyIdForPath(pathname);
    if (!fam) return;
    setOpenFamilies(prev => (prev[fam] ? prev : { ...prev, [fam]: true }));
  }, [pathname]);

  const toggleFamily = useCallback((id: NavFamilyId) => {
    setOpenFamilies(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* best-effort: sem storage continua a funcionar em memória */
      }
      return next;
    });
  }, []);

  return { openFamilies, toggleFamily };
}
