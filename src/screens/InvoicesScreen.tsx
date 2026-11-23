import React, { useMemo, useState } from 'react';
import { CreditCard, FileText, PlayCircle, Printer, Receipt, RotateCcw, Search, ShoppingCart, X } from 'lucide-react';
import { DateRangeFilterBar, resolveDateBounds, type DateRangeValue } from '../components/DateRangeFilterBar';
import { PrintTicketModal, type PrintableDocument } from '../components/PrintTicketModal';
import { usePos } from '../context/PosContext';
import { formatBs, formatDateTime, formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const InvoicesScreen: React.FC = () => {
  const {
    state,
    returnSale,
    restoreHeldSale,
    loadQuoteIntoPosCart,
    loadDeliveryNoteIntoPosCart,
    cancelDeliveryNote,
    setIsDebtsOpen,
  } = usePos();

  const [tab, setTab] = useState<'facturas' | 'notas' | 'espera' | 'presupuestos'>('facturas');
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRangeValue>({ preset: 'MONTH', startDate: '', endDate: '' });
  const [printDoc, setPrintDoc] = useState<PrintableDocument | null>(null);
  const [returningSaleId, setReturningSaleId] = useState<number | null>(null);
  const [returnReason, setReturnReason] = useState('');

  const bounds = useMemo(() => resolveDateBounds(range), [range]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.sales.filter((s) => {
      const inRange = s.timestamp >= bounds.startTs && s.timestamp <= bounds.endTs;
      const match =
        !q ||
        String(s.id).includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        s.customerDocument.toLowerCase().includes(q);
      return inRange && match;
    });
  }, [bounds.endTs, bounds.startTs, search, state.sales]);

  const pendingReceivables = round2(
    state.sales
      .filter((s) => s.status !== 'DEVUELTA' && s.paymentCreditUsd > 0 && !s.isCreditPaid)
      .reduce((acc, s) => acc + Math.max(0, s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* Debts Banner */}
      {pendingReceivables > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <div className="flex items-center gap-2.5 text-xs">
            <CreditCard className="h-5 w-5 text-amber-500" />
            <span>
              Cuentas por cobrar activas: <strong className="font-mono-num">{formatUsd(pendingReceivables)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsDebtsOpen(true)}
            className="rounded-xl bg-amber-500 px-3.5 py-1.5 text-xs font-extrabold text-slate-950 hover:bg-amber-400"
          >
            Gestionar Deudas
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap rounded-xl border border-slate-300/70 bg-white/85 p-1 text-xs font-bold dark:border-slate-700 dark:bg-[#1E2D48]">
          {[
            { id: 'facturas', label: `Facturas (${filteredSales.length})` },
            { id: 'notas', label: `Notas Entrega (${state.deliveryNotes.length})` },
            { id: 'espera', label: `En Espera (${state.heldSales.length})` },
            { id: 'presupuestos', label: `Presupuestos (${state.quotes.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`rounded-lg px-3 py-1.5 ${tab === t.id ? 'bg-indigo-600 text-white' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar N°, cliente o cédula/RIF..."
              className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-[#1E2D48]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (tab === 'facturas') {
                const activeSales = filteredSales.filter((s) => s.status !== 'DEVUELTA');
                const returnedCount = filteredSales.length - activeSales.length;
                const total = round2(activeSales.reduce((s, x) => s + x.totalUsd, 0));
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Registro de Facturas Emitidas',
                  subtitle: `Período: ${bounds.label} • ${filteredSales.length} factura(s) (${returnedCount} devuelta(s))`,
                  columns: ['N°', 'Fecha', 'Cliente', 'Cédula/RIF', 'Cajero', 'Estado', 'Total ($)', 'Total (Bs.)'],
                  rows: filteredSales.map((s) => [
                    `#${s.id}`,
                    formatDateTime(s.timestamp),
                    s.customerName,
                    s.customerDocument,
                    s.cashierName,
                    s.status === 'DEVUELTA' ? 'DEVUELTA' : 'ACTIVA',
                    formatUsd(s.totalUsd),
                    formatBs(s.totalBs),
                  ]),
                  summaryLines: [
                    `Total Facturado Activo: ${formatUsd(total)} (${formatBs(total * state.settings.bcvRate)})`,
                    `Facturas con Devolución Emitida: ${returnedCount}`,
                    `Cuentas por Cobrar Pendientes: ${formatUsd(pendingReceivables)}`,
                  ],
                  orientation: 'landscape',
                  filename: `facturas_${Date.now()}.pdf`,
                });
              } else if (tab === 'notas') {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Notas de Entrega',
                  columns: ['N°', 'Fecha', 'Cliente', 'Estado', 'Monto ($)', 'Monto (Bs.)'],
                  rows: state.deliveryNotes.map((n) => [
                    n.noteNumber,
                    formatDateTime(n.timestamp),
                    n.customerName,
                    n.status,
                    formatUsd(n.totalEstimatedUsd),
                    formatBs(n.totalEstimatedBs),
                  ]),
                  filename: `notas_entrega_${Date.now()}.pdf`,
                });
              } else if (tab === 'espera') {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Ventas en Espera',
                  columns: ['Cliente', 'Cédula/RIF', 'Fecha', 'Total ($)'],
                  rows: state.heldSales.map((h) => [
                    h.customerName,
                    h.customerDocument,
                    formatDateTime(h.timestamp),
                    formatUsd(h.totalUsd),
                  ]),
                  filename: `ventas_espera_${Date.now()}.pdf`,
                });
              } else {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Presupuestos',
                  columns: ['N°', 'Fecha', 'Cliente', 'Estado', 'Total ($)', 'Total (Bs.)'],
                  rows: state.quotes.map((q) => [
                    q.quoteNumber,
                    formatDateTime(q.timestamp),
                    q.customerName,
                    q.status,
                    formatUsd(q.totalUsd),
                    formatBs(q.totalBs),
                  ]),
                  filename: `presupuestos_${Date.now()}.pdf`,
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
        </div>
      </div>

      {tab === 'facturas' && (
        <>
          <DateRangeFilterBar value={range} onChange={setRange} />
          <div className="space-y-3">
            {filteredSales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
                No hay facturas en el período seleccionado.
              </div>
            ) : (
              filteredSales.map((s) => {
                const items = state.saleItems.filter((i) => i.saleId === s.id);
                const isReturned = s.status === 'DEVUELTA';
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border p-4 shadow-sm ${
                      isReturned
                        ? 'border-amber-500/40 bg-amber-500/5 dark:border-amber-500/40 dark:bg-[#1E2D48]/90'
                        : 'border-slate-300/60 bg-white/95 dark:border-slate-700 dark:bg-[#1E2D48]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-sky-400">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-extrabold">Factura #{s.id}</p>
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-[#283A5A]">
                              Caja {s.cashRegisterNumber} • {s.cashierName}
                            </span>
                            {isReturned && (
                              <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-500">
                                DEVOLUCIÓN EMITIDA
                              </span>
                            )}
                            {!isReturned && s.paymentCreditUsd > 0 && !s.isCreditPaid && (
                              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                                CRÉDITO PENDIENTE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-300">
                            {s.customerName} ({s.customerDocument}) • {formatDateTime(s.timestamp)}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {items.length} renglón(es) • Tasa BCV: Bs. {s.rateBcv.toFixed(2)}
                            {s.igtfUsd > 0 ? ` • IGTF: ${formatUsd(s.igtfUsd)}` : ''}
                          </p>
                          {isReturned && (
                            <p className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              Devolución registrada{s.returnedAt ? ` el ${formatDateTime(s.returnedAt)}` : ''}
                              {s.returnedBy ? ` por ${s.returnedBy}` : ''}
                              {s.returnReason ? ` • Motivo: ${s.returnReason}` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p
                          className={`font-mono-num text-lg font-extrabold ${
                            isReturned
                              ? 'text-slate-400 line-through'
                              : 'text-indigo-600 dark:text-sky-400'
                          }`}
                        >
                          {formatUsd(s.totalUsd)}
                        </p>
                        <p className="font-mono-num text-xs text-slate-500 dark:text-slate-300">
                          {formatBs(s.totalBs)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-slate-200/70 pt-3 dark:border-slate-700/70">
                      <button
                        type="button"
                        onClick={() => setPrintDoc({ type: 'sale', sale: s, items })}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Reimprimir / WhatsApp
                      </button>
                      {!isReturned && (
                        <button
                          type="button"
                          onClick={() => {
                            setReturningSaleId(s.id);
                            setReturnReason('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 px-3 py-1.5 text-xs font-bold text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Emitir Devolución
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {tab === 'notas' && (
        <div className="grid gap-3 md:grid-cols-2">
          {state.deliveryNotes.map((n) => {
            const items = state.deliveryNoteItems.filter((i) => i.deliveryNoteId === n.id);
            return (
              <div
                key={n.id}
                className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-bold">{n.noteNumber}</p>
                    <p className="text-xs text-slate-500">{n.customerName}</p>
                  </div>
                  <span className="text-xs font-bold text-sky-500">{n.status}</span>
                </div>
                <p className="font-mono-num mt-2 text-base font-extrabold">{formatUsd(n.totalEstimatedUsd)}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintDoc({ type: 'delivery', note: n, items })}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-[#283A5A]"
                  >
                    Ver Ticket
                  </button>
                  {n.status === 'ENTREGADO' && (
                    <>
                      <button
                        type="button"
                        onClick={() => loadDeliveryNoteIntoPosCart(n.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Facturar
                      </button>
                      <button
                        type="button"
                        onClick={() => cancelDeliveryNote(n.id)}
                        className="rounded-lg px-3 py-1.5 text-xs font-bold text-rose-500"
                      >
                        Anular
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'espera' && (
        <div className="grid gap-3 md:grid-cols-2">
          {state.heldSales.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
              No hay carritos en espera.
            </div>
          ) : (
            state.heldSales.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
              >
                <div>
                  <p className="text-sm font-bold">{h.customerName}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(h.timestamp)}</p>
                  <p className="font-mono-num mt-1 text-base font-extrabold text-amber-500">
                    {formatUsd(h.totalUsd)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => restoreHeldSale(h.id)}
                    className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Retomar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'presupuestos' && (
        <div className="grid gap-3 md:grid-cols-2">
          {state.quotes.map((q) => {
            const items = state.quoteItems.filter((i) => i.quoteId === q.id);
            return (
              <div
                key={q.id}
                className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
              >
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-bold">{q.quoteNumber}</p>
                    <p className="text-xs text-slate-500">{q.customerName}</p>
                  </div>
                  <span className="text-xs font-bold text-indigo-500">{q.status}</span>
                </div>
                <p className="font-mono-num mt-2 text-base font-extrabold">{formatUsd(q.totalUsd)}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPrintDoc({ type: 'quote', quote: q, items })}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-[#283A5A]"
                  >
                    Ver Ticket
                  </button>
                  {q.status !== 'FACTURADO' && q.status !== 'ANULADO' && (
                    <button
                      type="button"
                      onClick={() => loadQuoteIntoPosCart(q.id)}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <ShoppingCart className="h-3.5 w-3.5" />
                      Facturar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {returningSaleId !== null && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              returnSale(returningSaleId, returnReason);
              setReturningSaleId(null);
              setReturnReason('');
            }}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold">Emitir Devolución — Factura #{returningSaleId}</h3>
              </div>
              <button type="button" onClick={() => setReturningSaleId(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              La factura permanecerá guardada en el historial con estado <strong>DEVUELTA</strong> para auditoría y
              control fiscal, y el stock de los artículos será reintegrado al inventario.
            </p>
            <div>
              <label className="mb-1 block text-xs font-bold">Motivo de la devolución *</label>
              <input
                type="text"
                required
                autoFocus
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="Ej: Mercancía defectuosa, cambio solicitado por el cliente..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setReturningSaleId(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 font-bold dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-xl bg-amber-600 px-4 py-2 font-extrabold text-white hover:bg-amber-700"
              >
                Confirmar Devolución
              </button>
            </div>
          </form>
        </div>
      )}

      <PrintTicketModal doc={printDoc} onClose={() => setPrintDoc(null)} />
    </div>
  );
};
