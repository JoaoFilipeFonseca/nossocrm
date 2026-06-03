'use client';

// PREFS-1: preferências guardadas na conta (página de arranque + tema).
// Sincroniza desktop+mobile (grava em profiles via /api/profile/preferences).
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { Settings, Check, Loader2, Sun, Moon } from 'lucide-react';

const PAGES = [
  { v: '/dashboard', l: 'Dashboard' },
  { v: '/contacts', l: 'Contactos' },
  { v: '/imoveis', l: 'Imóveis' },
  { v: '/anuncios', l: 'Anúncios' },
  { v: '/financeiro', l: 'Financeiro' },
  { v: '/automacoes', l: 'Automações' },
];

export default function PreferencesCard() {
  const { profile, refreshProfile } = useAuth();
  const { darkMode, setDarkMode } = useTheme();
  const [landing, setLanding] = useState<string>('/dashboard');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setLanding(profile?.landing_page ?? '/dashboard'); }, [profile?.landing_page]);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (refreshProfile) await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function chooseTheme(dark: boolean) {
    setDarkMode(dark); // aplica já em todo o app
    void save({ dark_mode: dark });
  }
  function chooseLanding(v: string) {
    setLanding(v);
    void save({ landing_page: v });
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-6">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary-600" /> Preferências
        </h3>
        {saving ? (
          <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Loader2 className="h-3.5 w-3.5 animate-spin" /> A guardar…</span>
        ) : saved ? (
          <span className="text-xs text-emerald-600 inline-flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Guardado</span>
        ) : null}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Definições guardadas na tua conta — ficam iguais em computador e telemóvel até mudares.
      </p>

      {/* Página de arranque */}
      <div className="mb-5">
        <label htmlFor="landing-page" className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
          Página de arranque (onde o CRM abre)
        </label>
        <select
          id="landing-page"
          value={landing}
          onChange={(e) => chooseLanding(e.target.value)}
          className="w-full sm:w-72 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          {PAGES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
        </select>
      </div>

      {/* Tema */}
      <div>
        <span className="block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">Tema</span>
        <div className="inline-flex rounded-xl border border-slate-300 dark:border-white/15 overflow-hidden">
          <button
            type="button" onClick={() => chooseTheme(false)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${!darkMode ? 'bg-primary-600 text-white' : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            <Sun className="h-4 w-4" /> Claro
          </button>
          <button
            type="button" onClick={() => chooseTheme(true)}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium ${darkMode ? 'bg-primary-600 text-white' : 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            <Moon className="h-4 w-4" /> Escuro
          </button>
        </div>
      </div>
    </div>
  );
}
