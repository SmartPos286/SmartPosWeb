import React, { useState } from 'react';
import { Eye, EyeOff, Info, Lock, Moon, Sun, User as UserIcon } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { SmartPos286Logo } from '../components/SmartPos286Logo';

export const LoginScreen: React.FC = () => {
  const { state, login, toggleTheme, setIsAboutOpen } = usePos();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(username, pin);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-[var(--app-bg)] p-4 text-[var(--app-on-bg)]">
      {/* Top right controls */}
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300/60 bg-white/80 text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#1E2D48] dark:text-slate-200"
          title="Cambiar tema"
        >
          {state.settings.themeMode === 'DARK' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setIsAboutOpen(true)}
          className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-300/60 bg-white/80 px-3 text-xs font-bold text-slate-700 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-[#1E2D48] dark:text-slate-200"
        >
          <Info className="h-4 w-4" />
          <span>Acerca de</span>
        </button>
      </div>

      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-300/70 bg-white/95 shadow-2xl backdrop-blur-md dark:border-slate-700/80 dark:bg-[#1E2D48]/95">
        {/* Hero Brand Header */}
        <div className="bg-gradient-to-br from-[#17284A] via-[#1E1B4B] to-[#4338CA] px-6 py-7 text-center text-white">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 shadow-inner">
            <SmartPos286Logo size={68} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">SmartPOS286</h1>
          <p className="mt-1 text-xs text-sky-200">
            Facturación Multimoneda ($ / Bs.) • Control Comercial e IA
          </p>
          <p className="mt-2 inline-block rounded-lg bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/90">
            {state.settings.storeName}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">Usuario</label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                autoComplete="username"
                placeholder="Escribe tu nombre de usuario"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">PIN / Clave</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Ingresa tu PIN o clave"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                className="absolute right-3 top-2.5 rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[46px] w-full rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 py-3 text-sm font-extrabold text-white shadow-lg transition hover:opacity-95"
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
};
