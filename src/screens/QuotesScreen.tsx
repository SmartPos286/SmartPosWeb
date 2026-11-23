import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, Minus, Plus, Printer, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { PrintTicketModal, type PrintableDocument } from '../components/PrintTicketModal';
import { usePos } from '../context/PosContext';
import { calculateCartBreakdown, formatBs, formatDateOnly, formatQty, formatUsd } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const QuotesScreen: React.FC = () => {
  const {
    state,
    quoteCart,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    createQuote,
    loadQuoteIntoPosCart,
    updateQuoteStatus,
  } = usePos();

  const [tab, setTab] = useState<'crear' | 'historial'>('crear');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(state.customers[0]?.id ?? 1);
  const [validityDays, setValidityDays] = useState('7');
  const [discountUsd, setDiscountUsd] = useState('');
  const [notes, setNotes] = useState('Precios sujetos a tasa oficial BCV vigente.');
  const [printDoc, setPrintDoc] = useState<PrintableDocument | null>(null);

  const selectedCustomer = state.customers.find((c) => c.id === selectedCustomerId) ?? state.customers[0];
  const breakdown = useMemo(
    () => calculateCartBreakdown(quoteCart, Math.max(0, Number(discountUsd) || 0)),
    [quoteCart, discountUsd]
  );

  const filteredProducts = state.products.filter(
    (p) =>
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleEmit = () => {
    const result = createQuote({
      customerName: selectedCustomer?.name || 'Consumidor Final',
      customerDocument: selectedCustomer?.documentId || 'V-00000000',
      customerPhone: selectedCustomer?.phone || '',
      validityDays: Math.max(1, Number(validityDays) || 7),
      discountUsd: Math.max(0, Number(discountUsd) || 0),
      notesOrConditions: notes,
    });
    if (result) {
      setPrintDoc({ type: 'quote', quote: result.quote, items: result.items });
      setTab('historial');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-300/70 bg-white/80 p-1 text-xs font-bold dark:border-slate-700 dark:bg-[#1E2D48]">
          <button
            type="button"
            onClick={() => setTab('crear')}
            className={`rounded-lg px-4 py-2 ${tab === 'crear' ? 'bg-indigo-600 text-white' : ''}`}
          >
            Nuevo Presupuesto
          </button>
          <button
            type="button"
            onClick={() => setTab('historial')}
            className={`rounded-lg px-4 py-2 ${tab === 'historial' ? 'bg-indigo-600 text-white' : ''}`}
          >
            Historial ({state.quotes.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (tab === 'crear' && quoteCart.length > 0) {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Borrador de Presupuesto',
                  subtitle: `Cliente: ${selectedCustomer?.name || 'Consumidor Final'} (${selectedCustomer?.documentId || 'V-00000000'})`,
                  columns: ['Producto', 'Cant.', 'P. Unit ($)', 'Subtotal ($)', 'Subtotal (Bs.)'],
                  rows: quoteCart.map((ci) => {
                    const unit = ci.customPriceUsd ?? ci.product.priceUsd;
                    const sub = unit * ci.quantity;
                    return [
                      ci.product.name,
                      formatQty(ci.quantity),
                      formatUsd(unit),
                      formatUsd(sub),
                      formatBs(sub * state.settings.bcvRate),
                    ];
                  }),
                  summaryLines: [
                    `Total Estimado: ${formatUsd(breakdown.subtotalWithIvaUsd)} (${formatBs(breakdown.subtotalWithIvaUsd * state.settings.bcvRate)})`,
                    `Condiciones: ${notes || 'N/A'}`,
                  ],
                  filename: `borrador_presupuesto_${Date.now()}.pdf`,
                });
              } else {
                const totalQuoted = state.quotes.reduce((s, q) => s + q.totalUsd, 0);
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Historial de Presupuestos',
                  subtitle: `${state.quotes.length} presupuesto(s) registrado(s)`,
                  columns: ['N°', 'Cliente', 'Cédula/RIF', 'Válido Hasta', 'Estado', 'Total ($)', 'Total (Bs.)'],
                  rows: state.quotes.map((q) => [
                    q.quoteNumber,
                    q.customerName,
                    q.customerDocument,
                    formatDateOnly(q.validUntil),
                    q.status,
                    formatUsd(q.totalUsd),
                    formatBs(q.totalBs),
                  ]),
                  summaryLines: [`Monto Total Cotizado: ${formatUsd(totalQuoted)}`],
                  filename: `presupuestos_${Date.now()}.pdf`,
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <span className="rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
            Los presupuestos no descuentan inventario hasta facturarse
          </span>
        </div>
      </div>

      {tab === 'crear' ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar producto para cotizar..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-[#1E2D48]"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart('quote', p, 1)}
                  className="flex items-center justify-between rounded-xl border border-slate-300/60 bg-white/95 p-3 text-left transition hover:border-indigo-500 dark:border-slate-700 dark:bg-[#1E2D48]"
                >
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-bold">{p.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{p.category}</p>
                  </div>
                  <span className="font-mono-num shrink-0 text-sm font-extrabold text-indigo-600 dark:text-sky-400">
                    {formatUsd(p.priceUsd)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm lg:col-span-5 dark:border-slate-700 dark:bg-[#1E2D48]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-500" />
                <h3 className="text-sm font-bold">Detalle de Cotización</h3>
              </div>
              {quoteCart.length > 0 && (
                <button type="button" onClick={() => clearCart('quote')} className="text-xs font-bold text-rose-500">
                  Limpiar
                </button>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              >
                {state.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                placeholder="Días validez"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
            </div>

            <div className="max-h-60 space-y-2 overflow-y-auto">
              {quoteCart.map((ci) => (
                <div
                  key={ci.product.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 text-xs dark:border-slate-700"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{ci.product.name}</p>
                    <p className="font-mono-num text-[11px] text-slate-500">
                      {formatUsd((ci.customPriceUsd ?? ci.product.priceUsd) * ci.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateCartQty('quote', ci.product.id, ci.quantity - 1)}
                      className="rounded border px-1.5 py-0.5 dark:border-slate-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono-num w-7 text-center font-bold">{formatQty(ci.quantity)}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty('quote', ci.product.id, ci.quantity + 1)}
                      className="rounded border px-1.5 py-0.5 dark:border-slate-600"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart('quote', ci.product.id)}
                      className="ml-1 text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="number"
                step="0.01"
                value={discountUsd}
                onChange={(e) => setDiscountUsd(e.target.value)}
                placeholder="Descuento ($)"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Condiciones..."
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-700">
              <span className="text-xs font-bold">Total Estimado:</span>
              <div className="text-right">
                <p className="font-mono-num text-lg font-extrabold text-indigo-600 dark:text-sky-400">
                  {formatUsd(breakdown.subtotalWithIvaUsd)}
                </p>
                <p className="font-mono-num text-[11px] text-slate-500">
                  {formatBs(breakdown.subtotalWithIvaUsd * state.settings.bcvRate)}
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={quoteCart.length === 0}
              onClick={handleEmit}
              className="min-h-[42px] w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Emitir Presupuesto
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.quotes.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
              No hay presupuestos emitidos todavía.
            </div>
          ) : (
            state.quotes.map((q) => {
              const items = state.quoteItems.filter((i) => i.quoteId === q.id);
              return (
                <div
                  key={q.id}
                  className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-extrabold">{q.quoteNumber}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {q.customerName} ({q.customerDocument})
                      </p>
                      <p className="text-[11px] text-slate-400">Válido hasta: {formatDateOnly(q.validUntil)}</p>
                    </div>
                    <span className="rounded-lg bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold text-indigo-600 dark:text-sky-300">
                      {q.status}
                    </span>
                  </div>
                  <p className="font-mono-num mt-2 text-lg font-extrabold text-indigo-600 dark:text-sky-400">
                    {formatUsd(q.totalUsd)}{' '}
                    <span className="text-xs font-normal text-slate-500">({formatBs(q.totalBs)})</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPrintDoc({ type: 'quote', quote: q, items })}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-[#283A5A]"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Ticket / WhatsApp
                    </button>
                    {q.status !== 'FACTURADO' && q.status !== 'ANULADO' && (
                      <>
                        <button
                          type="button"
                          onClick={() => loadQuoteIntoPosCart(q.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Convertir a Factura
                        </button>
                        <button
                          type="button"
                          onClick={() => updateQuoteStatus(q.id, 'ANULADO')}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
                        >
                          Anular
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <PrintTicketModal doc={printDoc} onClose={() => setPrintDoc(null)} />
    </div>
  );
};
