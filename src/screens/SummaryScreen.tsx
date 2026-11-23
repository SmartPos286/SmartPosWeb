import React, { useMemo, useState } from 'react';
import { Calculator, Download, FileText, Printer, X } from 'lucide-react';
import { DateRangeFilterBar, resolveDateBounds, type DateRangeValue } from '../components/DateRangeFilterBar';
import { usePos } from '../context/PosContext';
import { formatBs, formatUsd, round2 } from '../utils/currencyMath';
import { downloadTextFile } from '../utils/csvInventory';
import { generateAccountingLedgerCsv } from '../utils/exports';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const SummaryScreen: React.FC = () => {
  const { state, currentUser } = usePos();
  const [range, setRange] = useState<DateRangeValue>({ preset: 'TODAY', startDate: '', endDate: '' });
  const [tab, setTab] = useState<'general' | 'detallado' | 'retenciones'>('general');
  const [showClosure, setShowClosure] = useState(false);

  // Cash Closure input
  const [countedCashUsd, setCountedCashUsd] = useState('');
  const [countedMobileBs, setCountedMobileBs] = useState('');
  const [countedCardBs, setCountedCardBs] = useState('');
  const [closureNotes, setClosureNotes] = useState('');

  const bounds = useMemo(() => resolveDateBounds(range), [range]);
  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;

  const allPeriodSales = useMemo(
    () => state.sales.filter((s) => s.timestamp >= bounds.startTs && s.timestamp <= bounds.endTs),
    [bounds.endTs, bounds.startTs, state.sales]
  );
  const sales = useMemo(
    () => allPeriodSales.filter((s) => s.status !== 'DEVUELTA'),
    [allPeriodSales]
  );
  const returnedCount = allPeriodSales.length - sales.length;
  const expenses = useMemo(
    () => state.expenses.filter((e) => e.timestamp >= bounds.startTs && e.timestamp <= bounds.endTs),
    [bounds.endTs, bounds.startTs, state.expenses]
  );
  const purchases = useMemo(
    () => state.purchaseInvoices.filter((p) => p.timestamp >= bounds.startTs && p.timestamp <= bounds.endTs),
    [bounds.endTs, bounds.startTs, state.purchaseInvoices]
  );

  const totalSalesUsd = round2(sales.reduce((s, x) => s + x.totalUsd, 0));
  const totalCashUsd = round2(sales.reduce((s, x) => s + x.paymentCashUsd, 0));
  const totalMobileBs = round2(sales.reduce((s, x) => s + x.paymentMobileBs, 0));
  const totalCardBs = round2(sales.reduce((s, x) => s + x.paymentCardBs, 0));
  const totalCasheaUsd = round2(sales.reduce((s, x) => s + x.paymentCasheaUsd, 0));
  const totalCreditUsd = round2(sales.reduce((s, x) => s + x.paymentCreditUsd, 0));
  const totalIvaUsd = round2(sales.reduce((s, x) => s + x.ivaUsd, 0));
  const totalIgtfUsd = round2(sales.reduce((s, x) => s + x.igtfUsd, 0));
  const totalCommUsd = round2(sales.reduce((s, x) => s + x.totalCommissionUsd, 0));
  const totalExpensesUsd = round2(expenses.reduce((s, e) => s + e.amountUsd, 0));

  const diffCashUsd = round2((Number(countedCashUsd) || 0) - totalCashUsd);
  const diffMobileBs = round2((Number(countedMobileBs) || 0) - totalMobileBs);
  const diffCardBs = round2((Number(countedCardBs) || 0) - totalCardBs);

  const handleExportAccountingCsv = () => {
    const csv = generateAccountingLedgerCsv({
      settings: state.settings,
      sales: allPeriodSales,
      purchaseInvoices: purchases,
      suppliers: state.suppliers,
      expenses,
      casheaSettlements: state.casheaSettlements,
      periodLabel: bounds.label,
    });
    downloadTextFile(`libro_contable_smartpos286_${Date.now()}.csv`, csv);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateRangeFilterBar value={range} onChange={setRange} />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Resumen Financiero y Cierre de Caja',
                subtitle: `Período: ${bounds.label} • ${sales.length} venta(s) activa(s)${returnedCount > 0 ? ` (${returnedCount} devuelta(s))` : ''} • ${expenses.length} egreso(s)`,
                columns: ['Concepto', 'Monto ($ USD)', 'Equivalente (Bs.)'],
                rows: [
                  ['Ventas Facturadas Totales', formatUsd(totalSalesUsd), formatBs(totalSalesUsd * rate)],
                  ['Efectivo Divisas ($)', formatUsd(totalCashUsd), formatBs(totalCashUsd * rate)],
                  ['Pago Móvil (Bs.)', formatUsd(totalMobileBs / rate), formatBs(totalMobileBs)],
                  ['Punto de Venta / Tarjeta (Bs.)', formatUsd(totalCardBs / rate), formatBs(totalCardBs)],
                  ['Cashea ($)', formatUsd(totalCasheaUsd), formatBs(totalCasheaUsd * rate)],
                  ['Crédito / Fiado ($)', formatUsd(totalCreditUsd), formatBs(totalCreditUsd * rate)],
                  ['IVA Débito Fiscal (16%)', formatUsd(totalIvaUsd), formatBs(totalIvaUsd * rate)],
                  ['IGTF Cobrado (3%)', formatUsd(totalIgtfUsd), formatBs(totalIgtfUsd * rate)],
                  ['Comisiones Cajeros', formatUsd(totalCommUsd), formatBs(totalCommUsd * rate)],
                  ['Egresos / Gastos Operativos', formatUsd(totalExpensesUsd), formatBs(totalExpensesUsd * rate)],
                ],
                summaryLines: [
                  `Flujo Neto del Período: ${formatUsd(totalSalesUsd - totalExpensesUsd)} (${formatBs((totalSalesUsd - totalExpensesUsd) * rate)})`,
                ],
                filename: `resumen_caja_${Date.now()}.pdf`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={handleExportAccountingCsv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"
          >
            <Download className="h-4 w-4" />
            Libro Contable CSV (Bs.)
          </button>
          <button
            type="button"
            onClick={() => {
              setCountedCashUsd(totalCashUsd.toFixed(2));
              setCountedMobileBs(totalMobileBs.toFixed(2));
              setCountedCardBs(totalCardBs.toFixed(2));
              setShowClosure(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-indigo-700"
          >
            <Calculator className="h-4 w-4" />
            Arqueo / Cierre de Caja (Z/X)
          </button>
        </div>
      </div>

      <div className="flex rounded-xl border border-slate-300/70 bg-white/85 p-1 text-xs font-bold sm:w-fit dark:border-slate-700 dark:bg-[#1E2D48]">
        {[
          { id: 'general', label: 'Balance General' },
          { id: 'detallado', label: 'Desglose Pagos' },
          { id: 'retenciones', label: 'Impuestos y Comisiones' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id as any)}
            className={`rounded-lg px-4 py-2 ${tab === t.id ? 'bg-indigo-600 text-white' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-5 dark:border-slate-700 dark:bg-[#1E2D48]">
            <p className="text-xs font-bold text-slate-500">
              Ventas Facturadas ({sales.length}
              {returnedCount > 0 ? ` • ${returnedCount} dev.` : ''})
            </p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold text-indigo-600 dark:text-sky-400">
              {formatUsd(totalSalesUsd)}
            </p>
            <p className="font-mono-num text-xs text-slate-500">{formatBs(totalSalesUsd * rate)}</p>
          </div>
          <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-5 dark:border-slate-700 dark:bg-[#1E2D48]">
            <p className="text-xs font-bold text-slate-500">Egresos / Gastos ({expenses.length})</p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold text-rose-500">
              {formatUsd(totalExpensesUsd)}
            </p>
            <p className="font-mono-num text-xs text-slate-500">{formatBs(totalExpensesUsd * rate)}</p>
          </div>
          <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-5 dark:border-slate-700 dark:bg-[#1E2D48]">
            <p className="text-xs font-bold text-slate-500">Flujo Neto del Período</p>
            <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-500">
              {formatUsd(totalSalesUsd - totalExpensesUsd)}
            </p>
            <p className="font-mono-num text-xs text-slate-500">
              {formatBs((totalSalesUsd - totalExpensesUsd) * rate)}
            </p>
          </div>
        </div>
      )}

      {tab === 'detallado' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Efectivo Divisas ($ USD)', val: formatUsd(totalCashUsd) },
            { label: 'Pago Móvil (Bs.)', val: formatBs(totalMobileBs) },
            { label: 'Punto de Venta / Tarjeta (Bs.)', val: formatBs(totalCardBs) },
            { label: 'Cashea ($ USD)', val: formatUsd(totalCasheaUsd) },
            { label: 'Crédito / Fiado ($ USD)', val: formatUsd(totalCreditUsd) },
          ].map((row) => (
            <div
              key={row.label}
              className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
            >
              <p className="text-xs font-bold text-slate-500">{row.label}</p>
              <p className="font-mono-num mt-1 text-xl font-extrabold">{row.val}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'retenciones' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
            <p className="text-xs font-bold text-slate-500">IVA Débito Fiscal (16%)</p>
            <p className="font-mono-num mt-1 text-xl font-extrabold text-indigo-500">{formatUsd(totalIvaUsd)}</p>
          </div>
          <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
            <p className="text-xs font-bold text-slate-500">IGTF Cobrado (3% Divisas)</p>
            <p className="font-mono-num mt-1 text-xl font-extrabold text-amber-500">{formatUsd(totalIgtfUsd)}</p>
          </div>
          <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
            <p className="text-xs font-bold text-slate-500">Comisiones Cajeros</p>
            <p className="font-mono-num mt-1 text-xl font-extrabold text-emerald-500">{formatUsd(totalCommUsd)}</p>
          </div>
        </div>
      )}

      {showClosure && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4">
          <div className="print-only-container w-full max-w-lg rounded-2xl border border-slate-700 bg-white p-5 text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
              <div>
                <h3 className="text-base font-extrabold">Planilla de Arqueo y Cierre de Caja</h3>
                <p className="text-xs text-slate-500">
                  Caja #{state.settings.cashRegisterNumber} • Cajero: {currentUser?.username} • {bounds.label}
                </p>
              </div>
              <button type="button" onClick={() => setShowClosure(false)} className="no-print">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-3 items-center gap-2 font-bold text-slate-500">
                <span>Método</span>
                <span>Sistema</span>
                <span>Conteo Físico</span>
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="font-bold">Efectivo $</span>
                <span className="font-mono-num">{formatUsd(totalCashUsd)}</span>
                <input
                  type="number"
                  step="0.01"
                  value={countedCashUsd}
                  onChange={(e) => setCountedCashUsd(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="font-bold">Pago Móvil Bs.</span>
                <span className="font-mono-num">{formatBs(totalMobileBs)}</span>
                <input
                  type="number"
                  step="0.01"
                  value={countedMobileBs}
                  onChange={(e) => setCountedMobileBs(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div className="grid grid-cols-3 items-center gap-2">
                <span className="font-bold">Punto Bs.</span>
                <span className="font-mono-num">{formatBs(totalCardBs)}</span>
                <input
                  type="number"
                  step="0.01"
                  value={countedCardBs}
                  onChange={(e) => setCountedCardBs(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                />
              </div>

              <div className="rounded-xl bg-slate-100 p-3 dark:bg-[#283A5A]">
                <p className="font-bold">Discrepancias (Contado - Sistema):</p>
                <p className="font-mono-num">Efectivo $: {diffCashUsd >= 0 ? `+${diffCashUsd.toFixed(2)}` : diffCashUsd.toFixed(2)}</p>
                <p className="font-mono-num">Pago Móvil Bs.: {diffMobileBs >= 0 ? `+${diffMobileBs.toFixed(2)}` : diffMobileBs.toFixed(2)}</p>
                <p className="font-mono-num">Punto Bs.: {diffCardBs >= 0 ? `+${diffCardBs.toFixed(2)}` : diffCardBs.toFixed(2)}</p>
              </div>

              <input
                type="text"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                placeholder="Observaciones del cierre..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>

            <div className="no-print mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowClosure(false)} className="px-4 py-2 text-xs font-bold">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                <Printer className="h-4 w-4" />
                Imprimir Planilla Z/X
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
