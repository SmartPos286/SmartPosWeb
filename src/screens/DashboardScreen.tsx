import React, { useMemo } from 'react';
import { Award, DollarSign, FileText, Printer, TrendingUp, Users } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatBs, formatQty, formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const DashboardScreen: React.FC = () => {
  const { state } = usePos();
  const { currentYear, currentMonth, monthStart } = useMemo(() => {
    const d = new Date();
    return {
      currentYear: d.getFullYear(),
      currentMonth: d.getMonth(),
      monthStart: new Date(d.getFullYear(), d.getMonth(), 1).getTime(),
    };
  }, []);
  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;

  const allMonthSales = useMemo(
    () => state.sales.filter((s) => s.timestamp >= monthStart),
    [monthStart, state.sales]
  );
  const monthSales = useMemo(
    () => allMonthSales.filter((s) => s.status !== 'DEVUELTA'),
    [allMonthSales]
  );
  const returnedMonthCount = allMonthSales.length - monthSales.length;
  const monthSaleIds = useMemo(() => new Set(monthSales.map((s) => s.id)), [monthSales]);
  const monthItems = useMemo(
    () => state.saleItems.filter((i) => monthSaleIds.has(i.saleId)),
    [monthSaleIds, state.saleItems]
  );
  const monthExpenses = useMemo(
    () => state.expenses.filter((e) => e.timestamp >= monthStart),
    [monthStart, state.expenses]
  );

  const revenueUsd = round2(monthSales.reduce((s, x) => s + x.totalUsd, 0));
  const cogsUsd = round2(monthItems.reduce((s, i) => s + i.costPriceUsd * i.quantity, 0));
  const expensesUsd = round2(monthExpenses.reduce((s, e) => s + e.amountUsd, 0));
  const grossProfitUsd = round2(revenueUsd - cogsUsd);
  const netProfitUsd = round2(grossProfitUsd - expensesUsd);
  const grossMarginPct = revenueUsd > 0 ? (grossProfitUsd / revenueUsd) * 100 : 0;

  // Daily bar chart series for current month
  const dailySeries = useMemo(() => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const buckets = Array.from({ length: daysInMonth }, (_, idx) => ({
      day: idx + 1,
      totalUsd: 0,
    }));
    for (const s of monthSales) {
      const d = new Date(s.timestamp).getDate();
      if (buckets[d - 1]) buckets[d - 1].totalUsd += s.totalUsd;
    }
    return buckets;
  }, [currentMonth, currentYear, monthSales]);

  const maxDayUsd = Math.max(10, ...dailySeries.map((d) => d.totalUsd));

  // Top products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of monthItems) {
      const cur = map.get(it.productName) ?? { name: it.productName, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.priceUsd * it.quantity;
      map.set(it.productName, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);
  }, [monthItems]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; doc: string; count: number; total: number }>();
    for (const s of monthSales) {
      const key = s.customerDocument || s.customerName;
      const cur = map.get(key) ?? { name: s.customerName, doc: s.customerDocument, count: 0, total: 0 };
      cur.count += 1;
      cur.total += s.totalUsd;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [monthSales]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold">Dashboard Gerencial • Mes Actual</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rentabilidad real (Ingresos - COGS - Gastos) y métricas comerciales
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Dashboard Gerencial — Resumen del Mes',
                subtitle: `${monthSales.length} factura(s) activa(s)${returnedMonthCount > 0 ? ` (${returnedMonthCount} devuelta(s))` : ''} • ${monthExpenses.length} egreso(s)`,
                columns: ['Indicador / Ranking', 'Detalle', 'Monto ($)', 'Equivalente (Bs.)'],
                rows: [
                  ['Ingresos del Mes', `${monthSales.length} facturas`, formatUsd(revenueUsd), formatBs(revenueUsd * rate)],
                  ['Costo de Mercancía (COGS)', 'Costo directo vendido', formatUsd(cogsUsd), formatBs(cogsUsd * rate)],
                  ['Utilidad Bruta', `Margen ${grossMarginPct.toFixed(1)}%`, formatUsd(grossProfitUsd), formatBs(grossProfitUsd * rate)],
                  ['Gastos Operativos', `${monthExpenses.length} egresos`, formatUsd(expensesUsd), formatBs(expensesUsd * rate)],
                  ['Utilidad Neta Estimada', 'Bruta - Gastos', formatUsd(netProfitUsd), formatBs(netProfitUsd * rate)],
                  ...topProducts.map((p, i) => [
                    `Top #${i + 1} Producto: ${p.name}`,
                    `${formatQty(p.qty)} uds vendidas`,
                    formatUsd(p.revenue),
                    formatBs(p.revenue * rate),
                  ]),
                ],
                summaryLines: [
                  `Rentabilidad Neta del Mes: ${formatUsd(netProfitUsd)} (${formatBs(netProfitUsd * rate)})`,
                ],
                filename: `dashboard_gerencial_${Date.now()}.pdf`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Ingresos del Mes</span>
            <DollarSign className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-indigo-600 dark:text-sky-400">
            {formatUsd(revenueUsd)}
          </p>
          <p className="font-mono-num text-xs text-slate-500">
            {formatBs(revenueUsd * rate)} • {monthSales.length} fact. activas
            {returnedMonthCount > 0 ? ` (${returnedMonthCount} dev.)` : ''}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Utilidad Bruta (Margen)</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatUsd(grossProfitUsd)}
          </p>
          <p className="font-mono-num text-xs text-slate-500">
            Margen: {grossMarginPct.toFixed(1)}% • Costo COGS: {formatUsd(cogsUsd)}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Gastos Operativos Mes</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-rose-500">{formatUsd(expensesUsd)}</p>
          <p className="text-xs text-slate-500">{monthExpenses.length} egresos registrados</p>
        </div>

        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Utilidad Neta Estimada</p>
          <p
            className={`font-mono-num mt-1 text-2xl font-extrabold ${
              netProfitUsd >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {formatUsd(netProfitUsd)}
          </p>
          <p className="font-mono-num text-xs text-slate-500">{formatBs(netProfitUsd * rate)}</p>
        </div>
      </div>

      {/* SVG Daily Revenue Bar Chart */}
      <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-5 dark:border-slate-700 dark:bg-[#1E2D48]">
        <h3 className="mb-3 text-sm font-extrabold">Ingresos Diarios del Mes ($ USD)</h3>
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${dailySeries.length * 26} 160`} className="h-44 min-w-[600px] w-full">
            {dailySeries.map((d, i) => {
              const barH = Math.max(4, (d.totalUsd / maxDayUsd) * 120);
              const x = i * 26 + 4;
              const y = 135 - barH;
              return (
                <g key={d.day}>
                  <rect
                    x={x}
                    y={y}
                    width={18}
                    height={barH}
                    rx={4}
                    fill={d.totalUsd > 0 ? '#6366F1' : '#334155'}
                    opacity={d.totalUsd > 0 ? 0.9 : 0.25}
                  >
                    <title>{`Día ${d.day}: ${formatUsd(d.totalUsd)}`}</title>
                  </rect>
                  <text
                    x={x + 9}
                    y={152}
                    textAnchor="middle"
                    fontSize="9"
                    fill="currentColor"
                    opacity={0.65}
                  >
                    {d.day}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Rankings */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-5 dark:border-slate-700 dark:bg-[#1E2D48]">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <h3 className="text-sm font-extrabold">Top Productos del Mes</h3>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-xs text-slate-500">Sin ventas registradas este mes.</p>
          ) : (
            <div className="space-y-2">
              {topProducts.map((p, idx) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-[#283A5A]/60"
                >
                  <span className="font-bold">
                    #{idx + 1} {p.name}
                  </span>
                  <span className="font-mono-num font-bold text-indigo-600 dark:text-sky-400">
                    {formatQty(p.qty)} uds • {formatUsd(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-5 dark:border-slate-700 dark:bg-[#1E2D48]">
          <div className="mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-sky-500" />
            <h3 className="text-sm font-extrabold">Clientes Frecuentes</h3>
          </div>
          {topCustomers.length === 0 ? (
            <p className="text-xs text-slate-500">Sin clientes registrados en ventas este mes.</p>
          ) : (
            <div className="space-y-2">
              {topCustomers.map((c, idx) => (
                <div
                  key={c.doc + idx}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-[#283A5A]/60"
                >
                  <span className="font-bold">
                    #{idx + 1} {c.name}
                  </span>
                  <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                    {c.count} compras • {formatUsd(c.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
