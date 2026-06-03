/**
 * @fileoverview Contexto de Tema (Dark Mode)
 * 
 * Provider React que gerencia preferência de tema (claro/escuro) com
 * persistência em localStorage e sincronização com classe CSS do documento.
 * 
 * @module context/ThemeContext
 * 
 * @example
 * ```tsx
 * // No App.tsx
 * <ThemeProvider>
 *   <App />
 * </ThemeProvider>
 * 
 * // Em qualquer componente
 * function ThemeToggle() {
 *   const { darkMode, toggleDarkMode } = useTheme();
 *   
 *   return (
 *     <button onClick={toggleDarkMode}>
 *       {darkMode ? '☀️ Claro' : '🌙 Escuro'}
 *     </button>
 *   );
 * }
 * ```
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const STORAGE_KEY = 'crm_dark_mode';

/**
 * Tipo do contexto de tema
 * 
 * @interface ThemeContextType
 * @property {boolean} darkMode - Se o modo escuro está ativo
 * @property {() => void} toggleDarkMode - Alterna entre claro e escuro
 */
interface ThemeContextType {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (next: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Provider de tema da aplicação
 * 
 * Gerencia preferência de tema e aplica classe 'dark' ao documento.
 * O tema é persistido em localStorage com a chave 'crm_dark_mode'.
 * O padrão é modo escuro (true).
 * 
 * @param {Object} props - Props do componente
 * @param {ReactNode} props.children - Componentes filhos
 */
export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Hidratação-safe: arranca SEMPRE no default determinista (escuro) — igual ao
  // que o servidor renderiza — e só lê o localStorage DEPOIS de montar. Antes
  // líamos o localStorage no primeiro render do cliente, o que fazia o valor
  // diferir do servidor (ex.: utilizador em modo claro) e gerava o mismatch de
  // hidratação React #418 (ícone Sol/Lua e qualquer DOM dependente de darkMode),
  // transversal a todo o shell. Ver memory/prompt_arranque_418_hydration.
  const [darkMode, setDarkMode] = useState<boolean>(true);

  // Carrega a preferência guardada uma vez, após a montagem.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setDarkMode(raw !== 'false');
    } catch {
      // localStorage indisponível (modo privado / quota) — mantém o default.
    }
  }, []);

  // Reflecte no documento sempre que muda (o script inline no <head> já o faz
  // antes do paint para evitar flash; este efeito mantém-no sincronizado).
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Persiste só em acção explícita do utilizador — evita reescrever o valor
  // guardado antes de o termos lido (clobber) no arranque.
  const setDark = (next: boolean) => {
    setDarkMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // noop
    }
  };

  const toggleDarkMode = () => setDark(!darkMode);

  return (
    <ThemeContext.Provider value={{ darkMode, toggleDarkMode, setDarkMode: setDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook para acessar contexto de tema
 * 
 * Retorna estado do tema e função para alternar.
 * Deve ser usado dentro de um ThemeProvider.
 * 
 * @returns {ThemeContextType} Estado e controles do tema
 * @throws {Error} Se usado fora do ThemeProvider
 * 
 * @example
 * ```tsx
 * function Header() {
 *   const { darkMode } = useTheme();
 *   return <header className={darkMode ? 'bg-slate-900' : 'bg-white'}>...</header>;
 * }
 * ```
 */
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
