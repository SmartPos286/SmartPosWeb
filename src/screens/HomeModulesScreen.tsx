import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Package,
  QrCode,
  Receipt,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { AppRoute, MainModuleGroupId } from '../types/models';
import { formatBs, formatUsd, round2 } from '../utils/currencyMath';
import { ALL_SUBMODULES, MODULE_GROUPS } from '../utils/permissions';

const GROUP_ICONS: Record<MainModuleGroupId, React.ComponentType<{ className?: string }>> = {
  VENTAS: Store,
  ADMINISTRATIVO: Briefcase,
  INFO_GENERAL: TrendingUp,
  CONFIG: SlidersHorizontal,
};

const ROUTE_ICONS: Record<Exclude<AppRoute, 'home'>, React.ComponentType<{ className?: string }>> = {
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

export const HomeModulesScreen: React.FC = () => {
  const { state, allowedRoutes, setActiveRoute, lowStockProducts, setIsAlertsOpen, setIsDebtsOpen } = usePos();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaySales = state.sales.filter((s) => s.timestamp >= startOfDay.getTime());
  const todayRevenueUsd = round2(todaySales.reduce((acc, s) => acc + s.totalUsd, 0));
  const pendingReceivablesUsd = round2(
    state.sales
      .filter((s) => s.paymentCreditUsd > 0.001 && !s.isCreditPaid)
      .reduce((acc, s) => acc + Math.max(0, s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* KPI Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Ventas de Hoy</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-indigo-600 dark:text-sky-400">
            {formatUsd(todayRevenueUsd)}
          </p>
          <p className="font-mono-num text-xs text-slate-500 dark:text-slate-300">
            {formatBs(todayRevenueUsd * state.settings.bcvRate)} • {todaySales.length} factura(s)
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 shadow-sm dark:border-slate-700/80 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Tasa BCV Activa</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            Bs. {state.settings.bcvRate.toFixed(2)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">Caja #{state.settings.cashRegisterNumber}</p>
        </div>

        <button
          type="button"
          onClick={() => setIsAlertsOpen(true)}
          className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 text-left shadow-sm transition hover:border-amber-500/60 dark:border-slate-700/80 dark:bg-[#1E2D48]"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Alertas de Stock</p>
            <AlertTriangle className={`h-4 w-4 ${lowStockProducts.length > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <p className="font-mono-num mt-1 text-2xl font-extrabold">{lowStockProducts.length}</p>
          <p className="text-xs text-slate-500 dark:text-slate-300">
            De {state.products.length} productos en catálogo
          </p>
        </button>

        <button
          type="button"
          onClick={() => setIsDebtsOpen(true)}
          className="rounded-2xl border border-slate-300/60 bg-white/90 p-4 text-left shadow-sm transition hover:border-rose-500/60 dark:border-slate-700/80 dark:bg-[#1E2D48]"
        >
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Cuentas por Cobrar</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-amber-600 dark:text-amber-400">
            {formatUsd(pendingReceivablesUsd)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-300">Ver deudas y vencimientos</p>
        </button>
      </div>

      {/* Module Groups */}
      <div className="space-y-6">
        {MODULE_GROUPS.map((group) => {
          const modules = ALL_SUBMODULES.filter((m) => m.group === group.id && allowedRoutes.has(m.route));
          if (modules.length === 0) return null;
          const GroupIcon = GROUP_ICONS[group.id];

          return (
            <section
              key={group.id}
              className="rounded-2xl border border-slate-300/60 bg-white/90 p-5 shadow-sm dark:border-slate-700/80 dark:bg-[#1E2D48]"
            >
              <div className="mb-4 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow"
                  style={{ backgroundColor: group.accentColor }}
                >
                  <GroupIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold tracking-wide">{group.title}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{group.description}</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {modules.map((mod) => {
                  const Icon = ROUTE_ICONS[mod.route];
                  return (
                    <button
                      key={mod.route}
                      type="button"
                      onClick={() => setActiveRoute(mod.route)}
                      className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-500/60 hover:bg-white hover:shadow-md dark:border-slate-700 dark:bg-[#283A5A]/70 dark:hover:border-sky-400/60 dark:hover:bg-[#283A5A]"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                          style={{ backgroundColor: group.accentColor }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{mod.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">{mod.description}</p>
                        </div>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-500 dark:group-hover:text-sky-400" />
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
