import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bot,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Home,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  QrCode,
  Receipt,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { AppRoute } from '../types/models';
import { ALL_SUBMODULES, MODULE_GROUPS, isSuperUser } from '../utils/permissions';
import { SmartPos286Logo } from './SmartPos286Logo';
import { SuperuserMasterModal } from './SuperuserMasterModal';

const ROUTE_ICONS: Record<AppRoute, React.ComponentType<{ className?: string }>> = {
  home: Home,
  pos: ShoppingCart,
  quotes: FileSpreadsheet,
  delivery_notes: FileText,
  invoices: Receipt,
  inventory: Package,
  withholdings: FileCheck2,
  suppliers: Truck,
  customers: Users,
  pos_terminals: CreditCard,
  expenses: Receipt,
  cashea: QrCode,
  dashboard: LayoutDashboard,
  summary: BarChart3,
  users: UserCheck,
  settings: Settings,
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    state,
    currentUser,
    allowedRoutes,
    activeRoute,
    setActiveRoute,
    toggleTheme,
    syncBcvRateFromApi,
    isSyncingRate,
    updateSettings,
    lowStockProducts,
    isLicensed,
    setIsAssistantOpen,
    setIsLicenseOpen,
    setIsAboutOpen,
    setIsDebtsOpen,
    setIsAlertsOpen,
    logout,
  } = usePos();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateDraft, setRateDraft] = useState(String(state.settings.bcvRate));
  const [superUserModalOpen, setSuperUserModalOpen] = useState(false);

  const pendingCreditsCount = state.sales.filter((s) => s.paymentCreditUsd > 0 && !s.isCreditPaid).length;
  const currentMeta = ALL_SUBMODULES.find((m) => m.route === activeRoute);

  const handleSaveRate = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(rateDraft);
    if (num > 0) {
      updateSettings({ bcvRate: num });
    }
    setEditingRate(false);
  };

  const NavContent = () => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-slate-200/70 px-4 py-4 dark:border-slate-700/70">
        <SmartPos286Logo size={40} className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold tracking-tight">SmartPOS286</p>
          <p className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {state.settings.storeName}
          </p>
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <button
          type="button"
          onClick={() => {
            setActiveRoute('home');
            setMobileMenuOpen(false);
          }}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
            activeRoute === 'home'
              ? 'bg-indigo-600 text-white shadow-md dark:bg-indigo-500'
              : 'text-slate-700 hover:bg-sky-100/70 dark:text-slate-200 dark:hover:bg-[#283A5A]'
          }`}
        >
          <Home className="h-4 w-4 shrink-0" />
          <span>Inicio (Módulos)</span>
        </button>

        {MODULE_GROUPS.map((group) => {
          const mods = ALL_SUBMODULES.filter((m) => m.group === group.id && allowedRoutes.has(m.route));
          if (mods.length === 0) return null;
          return (
            <div key={group.id} className="space-y-1">
              <p className="px-3 text-[10px] font-extrabold tracking-wider text-slate-500 dark:text-slate-400">
                {group.title}
              </p>
              {mods.map((mod) => {
                const Icon = ROUTE_ICONS[mod.route];
                const active = activeRoute === mod.route;
                return (
                  <button
                    key={mod.route}
                    type="button"
                    onClick={() => {
                      setActiveRoute(mod.route);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                      active
                        ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                        : 'text-slate-700 hover:bg-sky-100/70 dark:text-slate-200 dark:hover:bg-[#283A5A]'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{mod.title}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="space-y-2 border-t border-slate-200/70 p-3 dark:border-slate-700/70">
        <button
          type="button"
          onClick={() => setIsLicenseOpen(true)}
          className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${
            isLicensed
              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            {isLicensed ? 'Licencia PRO' : 'Modo Prueba'}
          </span>
          <span className="text-[10px] underline">Ver</span>
        </button>

        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-[#283A5A]/70">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold">{currentUser?.username}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {currentUser?.role} • Caja {state.settings.cashRegisterNumber}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Cerrar sesión"
            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/15"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-[var(--app-bg)] text-[var(--app-on-bg)]">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden w-64 shrink-0 border-r border-slate-300/60 bg-white/90 backdrop-blur-md lg:block dark:border-slate-700/80 dark:bg-[#1E2D48]/95">
        <div className="sticky top-0 h-screen">
          <NavContent />
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-[75] flex lg:hidden">
          <div className="fixed inset-0 bg-slate-950/60" onClick={() => setMobileMenuOpen(false)} />
          <aside className="relative z-10 w-72 bg-white shadow-2xl dark:bg-[#1E2D48]">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-500 dark:text-slate-300"
            >
              <X className="h-5 w-5" />
            </button>
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* TopBar */}
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-300/60 bg-white/85 px-4 py-2.5 backdrop-blur-md dark:border-slate-700/70 dark:bg-[#1E2D48]/90">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-xl border border-slate-300/70 p-2 lg:hidden dark:border-slate-600"
              aria-label="Abrir menú"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-extrabold leading-tight sm:text-lg">
                {activeRoute === 'home' ? 'Panel de Módulos' : currentMeta?.title ?? 'SmartPOS286'}
              </h1>
              <p className="hidden text-xs text-slate-500 sm:block dark:text-slate-400">
                {activeRoute === 'home'
                  ? `Bienvenido, ${currentUser?.username} • Selecciona un módulo operativo`
                  : currentMeta?.description}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BCV Rate Pill */}
            {editingRate ? (
              <form onSubmit={handleSaveRate} className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={rateDraft}
                  onChange={(e) => setRateDraft(e.target.value)}
                  className="w-24 rounded-lg border border-indigo-500 bg-white px-2 py-1 font-mono-num text-xs font-bold dark:bg-slate-900"
                  autoFocus
                />
                <button
                  type="submit"
                  className="rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-bold text-white"
                >
                  OK
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setRateDraft(String(state.settings.bcvRate));
                    setEditingRate(true);
                  }}
                  title="Editar tasa BCV manualmente"
                  className="font-mono-num text-sky-700 hover:underline dark:text-sky-300"
                >
                  BCV: Bs. {state.settings.bcvRate.toFixed(2)}
                </button>
                <button
                  type="button"
                  onClick={syncBcvRateFromApi}
                  disabled={isSyncingRate}
                  title="Sincronizar tasa BCV oficial"
                  className="rounded-md p-1 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isSyncingRate ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {/* Low Stock Alert */}
            <button
              type="button"
              onClick={() => setIsAlertsOpen(true)}
              title="Alertas de Stock Mínimo"
              className={`relative flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold ${
                lowStockProducts.length > 0
                  ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  : 'border-slate-300/70 text-slate-600 dark:border-slate-600 dark:text-slate-300'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              {lowStockProducts.length > 0 && (
                <span className="font-mono-num">{lowStockProducts.length}</span>
              )}
            </button>

            {/* Debts / Credits */}
            <button
              type="button"
              onClick={() => setIsDebtsOpen(true)}
              title="Cuentas por Cobrar y Pagar"
              className="relative flex h-9 items-center gap-1.5 rounded-xl border border-slate-300/70 px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <CreditCard className="h-4 w-4" />
              {pendingCreditsCount > 0 && (
                <span className="font-mono-num rounded bg-rose-500 px-1.5 py-0.5 text-[10px] text-white">
                  {pendingCreditsCount}
                </span>
              )}
            </button>

            {/* Oli AI */}
            <button
              type="button"
              onClick={() => setIsAssistantOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 px-3 text-xs font-bold text-white shadow hover:opacity-95"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Oli IA</span>
            </button>

            {/* Theme */}
            <button
              type="button"
              onClick={toggleTheme}
              title="Cambiar tema Oscuro / Claro"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300/70 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {state.settings.themeMode === 'DARK' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* About */}
            <button
              type="button"
              onClick={() => setIsAboutOpen(true)}
              title="Acerca de SmartPOS286"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300/70 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <Info className="h-4 w-4" />
            </button>

            {isSuperUser(currentUser) && (
              <button
                type="button"
                onClick={() => setSuperUserModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-extrabold text-white shadow-md hover:opacity-95"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Panel Master</span>
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>

      <SuperuserMasterModal isOpen={superUserModalOpen} onClose={() => setSuperUserModalOpen(false)} />
    </div>
  );
};
