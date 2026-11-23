import React, { useState } from 'react';
import { FileText, Minus, Plus, Printer, Search, ShoppingCart, Trash2, XCircle } from 'lucide-react';
import { PrintTicketModal, type PrintableDocument } from '../components/PrintTicketModal';
import { usePos } from '../context/PosContext';
import { formatBs, formatDateTime, formatQty, formatUsd, getEffectiveStock } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const DeliveryNotesScreen: React.FC = () => {
  const {
    state,
    deliveryCart,
    addToCart,
    updateCartQty,
    removeFromCart,
    clearCart,
    processDeliveryNote,
    cancelDeliveryNote,
    loadDeliveryNoteIntoPosCart,
  } = usePos();

  const [tab, setTab] = useState<'emitir' | 'historial'>('emitir');
  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(state.customers[0]?.id ?? 1);
  const [recipientName, setRecipientName] = useState('');
  const [observation, setObservation] = useState('Despacho de mercancía sin factura fiscal');
  const [displayCurrency, setDisplayCurrency] = useState<'USD' | 'BS'>('USD');
  const [printDoc, setPrintDoc] = useState<PrintableDocument | null>(null);

  const selectedCustomer = state.customers.find((c) => c.id === selectedCustomerId) ?? state.customers[0];
  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;
  const totalUsd = deliveryCart.reduce((s, ci) => s + (ci.customPriceUsd ?? ci.product.priceUsd) * ci.quantity, 0);

  const filteredProducts = state.products.filter(
    (p) =>
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleEmit = () => {
    const result = processDeliveryNote({
      customerName: selectedCustomer?.name || 'Cliente General',
      customerDocument: selectedCustomer?.documentId || 'V-00000000',
      recipientName,
      reasonOrObservation: observation,
      displayCurrency,
    });
    if (result) {
      setPrintDoc({ type: 'delivery', note: result.note, items: result.items });
      setTab('historial');
      setRecipientName('');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-300/70 bg-white/80 p-1 text-xs font-bold dark:border-slate-700 dark:bg-[#1E2D48]">
          <button
            type="button"
            onClick={() => setTab('emitir')}
            className={`rounded-lg px-4 py-2 ${tab === 'emitir' ? 'bg-indigo-600 text-white' : ''}`}
          >
            Emitir Nota de Entrega
          </button>
          <button
            type="button"
            onClick={() => setTab('historial')}
            className={`rounded-lg px-4 py-2 ${tab === 'historial' ? 'bg-indigo-600 text-white' : ''}`}
          >
            Historial ({state.deliveryNotes.length})
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (tab === 'emitir' && deliveryCart.length > 0) {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Borrador de Nota de Entrega',
                  subtitle: `Cliente: ${selectedCustomer?.name || 'Cliente General'} • Recibe: ${recipientName || 'Por definir'}`,
                  columns: ['Producto', 'Cant.', 'Precio Unit ($)', 'Subtotal ($)', 'Subtotal (Bs.)'],
                  rows: deliveryCart.map((ci) => {
                    const unit = ci.customPriceUsd ?? ci.product.priceUsd;
                    const sub = unit * ci.quantity;
                    return [
                      ci.product.name,
                      formatQty(ci.quantity),
                      formatUsd(unit),
                      formatUsd(sub),
                      formatBs(sub * rate),
                    ];
                  }),
                  summaryLines: [
                    `Total Estimado: ${formatUsd(totalUsd)} (${formatBs(totalUsd * rate)})`,
                    `Observación: ${observation}`,
                  ],
                  filename: `borrador_nota_entrega_${Date.now()}.pdf`,
                });
              } else {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Historial de Notas de Entrega',
                  subtitle: `${state.deliveryNotes.length} nota(s) registrada(s)`,
                  columns: ['N° Nota', 'Fecha', 'Cliente', 'Recibe', 'Estado', 'Monto ($)', 'Monto (Bs.)'],
                  rows: state.deliveryNotes.map((n) => [
                    n.noteNumber,
                    formatDateTime(n.timestamp),
                    n.customerName,
                    n.recipientName || '—',
                    n.status,
                    formatUsd(n.totalEstimatedUsd),
                    formatBs(n.totalEstimatedBs),
                  ]),
                  filename: `notas_entrega_${Date.now()}.pdf`,
                });
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <span className="rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
            SENIAT: No válido para crédito fiscal • Descuenta stock al emitir
          </span>
        </div>
      </div>

      {tab === 'emitir' ? (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-7">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar mercancía a despachar..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs dark:border-slate-700 dark:bg-[#1E2D48]"
              />
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {filteredProducts.map((p) => {
                const eff = getEffectiveStock(p, state.products);
                const disabled = !p.isRecipe && eff <= 1e-6;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => addToCart('delivery', p, 1)}
                    className="flex items-center justify-between rounded-xl border border-slate-300/60 bg-white/95 p-3 text-left transition hover:border-sky-500 disabled:opacity-50 dark:border-slate-700 dark:bg-[#1E2D48]"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-bold">{p.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {p.isRecipe ? 'Servicio' : `Disp: ${formatQty(eff)}`}
                      </p>
                    </div>
                    <span className="font-mono-num text-sm font-extrabold text-sky-600 dark:text-sky-400">
                      {displayCurrency === 'BS' ? formatBs(p.priceUsd * rate) : formatUsd(p.priceUsd)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm lg:col-span-5 dark:border-slate-700 dark:bg-[#1E2D48]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-sky-500" />
                <h3 className="text-sm font-bold">Despacho de Mercancía</h3>
              </div>
              <div className="flex rounded-lg border border-slate-300 p-0.5 text-[11px] font-bold dark:border-slate-600">
                {(['USD', 'BS'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDisplayCurrency(c)}
                    className={`rounded px-2 py-0.5 ${displayCurrency === c ? 'bg-sky-600 text-white' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.documentId})
                </option>
              ))}
            </select>

            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Persona que recibe (opcional)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder="Motivo / Observación"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />

            <div className="max-h-56 space-y-2 overflow-y-auto">
              {deliveryCart.map((ci) => (
                <div
                  key={ci.product.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-2 text-xs dark:border-slate-700"
                >
                  <span className="truncate pr-2 font-bold">{ci.product.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateCartQty('delivery', ci.product.id, ci.quantity - 1)}
                      className="rounded border px-1.5 py-0.5 dark:border-slate-600"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-mono-num w-7 text-center font-bold">{formatQty(ci.quantity)}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty('delivery', ci.product.id, ci.quantity + 1)}
                      className="rounded border px-1.5 py-0.5 dark:border-slate-600"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFromCart('delivery', ci.product.id)}
                      className="ml-1 text-rose-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 dark:border-slate-700">
              <span className="text-xs font-bold">Total Nota (Sin IVA):</span>
              <span className="font-mono-num text-lg font-extrabold text-sky-600 dark:text-sky-400">
                {displayCurrency === 'BS' ? formatBs(totalUsd * rate) : formatUsd(totalUsd)}
              </span>
            </div>

            <div className="flex gap-2">
              {deliveryCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearCart('delivery')}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-600"
                >
                  Vaciar
                </button>
              )}
              <button
                type="button"
                disabled={deliveryCart.length === 0}
                onClick={handleEmit}
                className="min-h-[42px] flex-1 rounded-xl bg-sky-600 py-2.5 text-xs font-extrabold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                Emitir Nota y Descontar Stock
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.deliveryNotes.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
              No hay notas de entrega registradas.
            </div>
          ) : (
            state.deliveryNotes.map((n) => {
              const items = state.deliveryNoteItems.filter((i) => i.deliveryNoteId === n.id);
              return (
                <div
                  key={n.id}
                  className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-extrabold">{n.noteNumber}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {n.customerName} • {formatDateTime(n.timestamp)}
                      </p>
                    </div>
                    <span
                      className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                        n.status === 'ANULADO'
                          ? 'bg-rose-500/15 text-rose-500'
                          : n.status === 'FACTURADO'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : 'bg-sky-500/15 text-sky-500'
                      }`}
                    >
                      {n.status}
                    </span>
                  </div>
                  <p className="font-mono-num mt-2 text-lg font-extrabold text-sky-600 dark:text-sky-400">
                    {n.displayCurrency === 'BS' ? formatBs(n.totalEstimatedBs) : formatUsd(n.totalEstimatedUsd)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setPrintDoc({ type: 'delivery', note: n, items })}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold dark:bg-[#283A5A]"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir / WhatsApp
                    </button>
                    {n.status === 'ENTREGADO' && (
                      <>
                        <button
                          type="button"
                          onClick={() => loadDeliveryNoteIntoPosCart(n.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          <ShoppingCart className="h-3.5 w-3.5" />
                          Facturar en POS
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelDeliveryNote(n.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-500/10"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Anular (Devolver Stock)
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
