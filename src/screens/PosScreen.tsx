import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Edit3,
  FileText,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { PrintTicketModal, type PrintableDocument } from '../components/PrintTicketModal';
import { usePos } from '../context/PosContext';
import type { CartItem, Product } from '../types/models';
import {
  calculateCartBreakdown,
  formatBs,
  formatQty,
  formatUsd,
  getEffectiveStock,
  round2,
} from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const PosScreen: React.FC = () => {
  const {
    state,
    posCart,
    addToCart,
    updateCartQty,
    updateCartCustomPrice,
    removeFromCart,
    clearCart,
    processSale,
    holdPosCart,
    restoreHeldSale,
    saveCustomer,
    setActiveRoute,
    notify,
  } = usePos();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number>(state.customers[0]?.id ?? 1);
  const [discountUsdStr, setDiscountUsdStr] = useState('');

  const [showCheckout, setShowCheckout] = useState(false);
  const [showHeldDrawer, setShowHeldDrawer] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [editQtyStr, setEditQtyStr] = useState('');
  const [editPriceStr, setEditPriceStr] = useState('');
  const [printDoc, setPrintDoc] = useState<PrintableDocument | null>(null);

  // Payment fields
  const [payCashUsd, setPayCashUsd] = useState('');
  const [payMobileBs, setPayMobileBs] = useState('');
  const [payCardBs, setPayCardBs] = useState('');
  const [payCasheaUsd, setPayCasheaUsd] = useState('');
  const [payCreditUsd, setPayCreditUsd] = useState('');
  const [creditDays, setCreditDays] = useState('15');
  const [creditNotes, setCreditNotes] = useState('');
  const [applyWithholding, setApplyWithholding] = useState(true);

  // Quick customer form
  const [newCustName, setNewCustName] = useState('');
  const [newCustDoc, setNewCustDoc] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;

  const categories = useMemo(() => {
    const set = new Set<string>(['Todas']);
    state.products.forEach((p) => set.add(p.category || 'General'));
    return Array.from(set);
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.products.filter((p) => {
      const catOk = selectedCategory === 'Todas' || (p.category || 'General') === selectedCategory;
      const textOk = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      return catOk && textOk;
    });
  }, [search, selectedCategory, state.products]);

  const selectedCustomer = useMemo(
    () => state.customers.find((c) => c.id === selectedCustomerId) ?? state.customers[0],
    [selectedCustomerId, state.customers]
  );

  const discountUsd = Math.max(0, Number(discountUsdStr) || 0);
  const breakdown = useMemo(() => calculateCartBreakdown(posCart, discountUsd), [posCart, discountUsd]);

  const cashVal = Math.max(0, Number(payCashUsd) || 0);
  const mobileUsd = Math.max(0, (Number(payMobileBs) || 0) / rate);
  const cardUsd = Math.max(0, (Number(payCardBs) || 0) / rate);
  const casheaVal = Math.max(0, Number(payCasheaUsd) || 0);
  const creditVal = Math.max(0, Number(payCreditUsd) || 0);

  const igtfUsd = cashVal > 0.001 ? round2(cashVal * 0.03) : 0;
  const totalWithIgtfUsd = round2(breakdown.subtotalWithIvaUsd + igtfUsd);
  const totalWithIgtfBs = round2(totalWithIgtfUsd * rate);
  const totalPaidUsd = round2(cashVal + mobileUsd + cardUsd + casheaVal + creditVal);
  const remainingUsd = round2(totalWithIgtfUsd - totalPaidUsd);

  const openCheckout = () => {
    if (posCart.length === 0) return;
    setPayCashUsd('');
    setPayMobileBs('');
    setPayCardBs('');
    setPayCasheaUsd('');
    setPayCreditUsd('');
    setApplyWithholding(Boolean(selectedCustomer?.isWithholdingAgent));
    setShowCheckout(true);
  };

  const handleConfirmCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (remainingUsd > 0.05) {
      notify(
        'Monto Incompleto',
        `Faltan ${formatUsd(remainingUsd)} (${formatBs(remainingUsd * rate)}) por asignar en los métodos de pago.`,
        'warning'
      );
      return;
    }

    const res = processSale({
      customerId: selectedCustomer?.id ?? null,
      customerName: selectedCustomer?.name ?? 'Consumidor Final',
      customerDocument: selectedCustomer?.documentId ?? 'V-00000000',
      discountUsd,
      paymentCashUsd: cashVal,
      paymentMobileBs: Math.max(0, Number(payMobileBs) || 0),
      paymentCardBs: Math.max(0, Number(payCardBs) || 0),
      paymentCreditUsd: creditVal,
      paymentCasheaUsd: casheaVal,
      creditDueDate: creditVal > 0 ? Date.now() + (Number(creditDays) || 15) * 86400000 : 0,
      creditNotes,
      applyCustomerWithholding: applyWithholding,
    });

    if (res.ok && res.sale && res.items) {
      setShowCheckout(false);
      setDiscountUsdStr('');
      setPrintDoc({ type: 'sale', sale: res.sale, items: res.items });
    } else if (res.error) {
      notify('No se pudo facturar', res.error, 'error');
    }
  };

  const handleQuickCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) return;
    const created = saveCustomer({
      name: newCustName.trim(),
      documentId: newCustDoc.trim() || 'V-00000000',
      phone: newCustPhone.trim(),
      address: newCustAddress.trim(),
      clientType: newCustDoc.toUpperCase().startsWith('J') ? 'PERSONA_JURIDICA' : 'PERSONA_NATURAL',
      isWithholdingAgent: false,
      ivaRetentionPercentage: 0,
      islrRetentionPercentage: 0,
    });
    setSelectedCustomerId(created.id);
    setShowNewCustomer(false);
    setNewCustName('');
    setNewCustDoc('');
    setNewCustPhone('');
    setNewCustAddress('');
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-12">
      {/* Left: Catalog */}
      <div className="space-y-4 lg:col-span-7 xl:col-span-8">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300/60 bg-white/90 p-3 shadow-sm dark:border-slate-700/80 dark:bg-[#1E2D48]">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto o escanear código de barras..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowHeldDrawer(true)}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 text-xs font-bold text-amber-700 dark:text-amber-300"
          >
            <Clock className="h-4 w-4" />
            En Espera ({state.heldSales.length})
          </button>
          <button
            type="button"
            onClick={() => {
              if (posCart.length > 0) {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Pre-Cuenta / Carrito POS Activo',
                  subtitle: `Cliente: ${selectedCustomer?.name || 'Consumidor Final'} (${selectedCustomer?.documentId || 'V-00000000'})`,
                  columns: ['Producto', 'Cant.', 'P. Unit ($)', 'IVA', 'Subtotal ($)', 'Subtotal (Bs.)'],
                  rows: posCart.map((ci) => {
                    const unit = ci.customPriceUsd ?? ci.product.priceUsd;
                    const sub = unit * ci.quantity;
                    return [
                      ci.product.name,
                      formatQty(ci.quantity),
                      formatUsd(unit),
                      ci.product.isTaxExempt ? 'Exento' : '16%',
                      formatUsd(sub),
                      formatBs(sub * rate),
                    ];
                  }),
                  summaryLines: [
                    `Base Imponible: ${formatUsd(breakdown.baseTaxableUsd)} | Exento: ${formatUsd(breakdown.baseExemptUsd)} | IVA (16%): ${formatUsd(breakdown.ivaUsd)}`,
                    `Total Estimado: ${formatUsd(breakdown.subtotalWithIvaUsd)} (${formatBs(breakdown.subtotalWithIvaUsd * rate)})`,
                  ],
                  filename: `pos_carrito_${Date.now()}.pdf`,
                });
              } else {
                exportModuleTablePdf({
                  settings: state.settings,
                  title: 'Lista de Precios y Catálogo POS',
                  subtitle: `Categoría: ${selectedCategory} (${filteredProducts.length} artículos)`,
                  columns: ['Código', 'Producto', 'Categoría', 'Precio ($)', 'Precio (Bs.)', 'Stock'],
                  rows: filteredProducts.map((p) => {
                    const eff = getEffectiveStock(p, state.products);
                    return [
                      p.code || `#${p.id}`,
                      p.name,
                      p.category,
                      formatUsd(p.priceUsd),
                      formatBs(p.priceUsd * rate),
                      p.isRecipe ? 'Ilimitado' : formatQty(eff),
                    ];
                  }),
                  filename: `catalogo_pos_${Date.now()}.pdf`,
                });
              }
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveRoute('delivery_notes')}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-bold text-sky-700 dark:text-sky-300"
          >
            <FileText className="h-4 w-4" />
            Nota Entrega
          </button>
        </div>

        {/* Category Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'border border-slate-300/70 bg-white/80 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#1E2D48] dark:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product: Product) => {
            const effStock = getEffectiveStock(product, state.products);
            const outOfStock = !product.isRecipe && effStock <= 1e-6;
            return (
              <button
                key={product.id}
                type="button"
                disabled={outOfStock}
                onClick={() => addToCart('pos', product, 1)}
                className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition ${
                  outOfStock
                    ? 'cursor-not-allowed border-rose-500/30 bg-rose-500/5 opacity-60'
                    : 'border-slate-300/60 bg-white/95 shadow-sm hover:-translate-y-0.5 hover:border-indigo-500/60 hover:shadow-md dark:border-slate-700/80 dark:bg-[#1E2D48]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono-num text-[10px] font-bold text-slate-600 dark:bg-[#283A5A] dark:text-slate-300">
                      {product.code || `#${product.id}`}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        product.isTaxExempt
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                      }`}
                    >
                      {product.isTaxExempt ? 'Exento' : 'IVA 16%'}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug">{product.name}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {product.category}
                    {product.isCombo ? ' • Combo' : product.isRecipe ? ' • Servicio/Receta' : ''}
                  </p>
                </div>

                <div className="mt-3 flex items-end justify-between border-t border-slate-200/70 pt-2.5 dark:border-slate-700/70">
                  <div>
                    <p className="font-mono-num text-base font-extrabold text-indigo-600 dark:text-sky-400">
                      {formatUsd(product.priceUsd)}
                    </p>
                    <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      {formatBs(product.priceUsd * rate)}
                    </p>
                  </div>
                  <span
                    className={`font-mono-num rounded-lg px-2 py-1 text-[11px] font-bold ${
                      product.isRecipe
                        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                        : effStock <= product.minStockAlertQuantity
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-700 dark:bg-[#283A5A] dark:text-slate-200'
                    }`}
                  >
                    {product.isRecipe ? 'Ilimitado' : `Stock: ${formatQty(effStock)}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="lg:col-span-5 xl:col-span-4">
        <div className="sticky top-20 flex flex-col rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-lg dark:border-slate-700/80 dark:bg-[#1E2D48]">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-indigo-600 dark:text-sky-400" />
              <h2 className="text-base font-extrabold">Carrito de Venta</h2>
            </div>
            {posCart.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    holdPosCart(selectedCustomer?.name || 'Cliente en Espera', selectedCustomer?.documentId || '', '')
                  }
                  title="Poner venta en espera"
                  className="rounded-lg bg-amber-500/15 p-1.5 text-amber-600 hover:bg-amber-500/25 dark:text-amber-300"
                >
                  <PauseCircle className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => clearCart('pos')}
                  title="Vaciar carrito"
                  className="rounded-lg bg-rose-500/15 p-1.5 text-rose-600 hover:bg-rose-500/25 dark:text-rose-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {/* Customer picker */}
          <div className="mt-3 flex items-center gap-2">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(Number(e.target.value))}
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900"
            >
              {state.customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.documentId})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCustomer(true)}
              title="Cliente rápido"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>

          {selectedCustomer?.isWithholdingAgent && (
            <p className="mt-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 dark:text-sky-300">
              Agente de Retención SENIAT (IVA {selectedCustomer.ivaRetentionPercentage}% / ISLR{' '}
              {selectedCustomer.islrRetentionPercentage}%)
            </p>
          )}

          {/* Items */}
          <div className="my-3 max-h-[300px] space-y-2 overflow-y-auto pr-1">
            {posCart.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 py-10 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Selecciona productos del catálogo para iniciar una factura
              </div>
            ) : (
              posCart.map((ci) => {
                const unitPrice = ci.customPriceUsd ?? ci.product.priceUsd;
                return (
                  <div
                    key={ci.product.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-[#283A5A]/60"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold">{ci.product.name}</p>
                        <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-300">
                          {formatUsd(unitPrice)} c/u • Total: {formatUsd(unitPrice * ci.quantity)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCartItem(ci);
                          setEditQtyStr(String(ci.quantity));
                          setEditPriceStr(String(unitPrice));
                        }}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-indigo-600 dark:hover:bg-slate-700"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateCartQty('pos', ci.product.id, ci.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-mono-num w-10 text-center text-xs font-bold">
                          {formatQty(ci.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty('pos', ci.product.id, ci.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart('pos', ci.product.id)}
                        className="text-[11px] font-semibold text-rose-500 hover:underline"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Discount & Totals */}
          <div className="space-y-1.5 border-t border-slate-200 pt-3 text-xs dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Descuento pre-IVA ($):</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={discountUsdStr}
                onChange={(e) => setDiscountUsdStr(e.target.value)}
                placeholder="0.00"
                className="w-24 rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-right font-mono-num text-xs font-bold dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">Base Imponible:</span>
              <span className="font-mono-num font-semibold">{formatUsd(breakdown.baseTaxableUsd)}</span>
            </div>
            {breakdown.baseExemptUsd > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Monto Exento:</span>
                <span className="font-mono-num font-semibold">{formatUsd(breakdown.baseExemptUsd)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-slate-400">IVA Fiscal (16%):</span>
              <span className="font-mono-num font-semibold">{formatUsd(breakdown.ivaUsd)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t border-slate-200 pt-2 dark:border-slate-700">
              <span className="text-sm font-extrabold">TOTAL A PAGAR:</span>
              <div className="text-right">
                <p className="font-mono-num text-xl font-extrabold text-indigo-600 dark:text-sky-400">
                  {formatUsd(breakdown.subtotalWithIvaUsd)}
                </p>
                <p className="font-mono-num text-xs font-bold text-slate-600 dark:text-slate-300">
                  {formatBs(breakdown.subtotalWithIvaUsd * rate)}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={posCart.length === 0}
            onClick={openCheckout}
            className="mt-4 flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-600 py-3 text-sm font-extrabold text-white shadow-lg transition hover:opacity-95 disabled:opacity-50"
          >
            <CreditCard className="h-4 w-4" />
            Procesar Cobro
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmCheckout}
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-700">
              <div>
                <h3 className="text-base font-extrabold">Finalizar Factura</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCustomer?.name} • Tasa BCV: Bs. {rate.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
              {/* Quick Fill */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPayCashUsd(breakdown.subtotalWithIvaUsd.toFixed(2));
                    setPayMobileBs('');
                    setPayCardBs('');
                    setPayCasheaUsd('');
                    setPayCreditUsd('');
                  }}
                  className="rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-bold text-emerald-700 dark:text-emerald-300"
                >
                  Todo Efectivo $ (+3% IGTF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayCashUsd('');
                    setPayMobileBs((breakdown.subtotalWithIvaUsd * rate).toFixed(2));
                    setPayCardBs('');
                    setPayCasheaUsd('');
                    setPayCreditUsd('');
                  }}
                  className="rounded-lg bg-sky-500/15 px-2.5 py-1.5 font-bold text-sky-700 dark:text-sky-300"
                >
                  Todo Pago Móvil Bs.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayCashUsd('');
                    setPayMobileBs('');
                    setPayCardBs((breakdown.subtotalWithIvaUsd * rate).toFixed(2));
                    setPayCasheaUsd('');
                    setPayCreditUsd('');
                  }}
                  className="rounded-lg bg-indigo-500/15 px-2.5 py-1.5 font-bold text-indigo-700 dark:text-indigo-300"
                >
                  Todo Punto Bs.
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPayCashUsd('');
                    setPayMobileBs('');
                    setPayCardBs('');
                    setPayCasheaUsd(breakdown.subtotalWithIvaUsd.toFixed(2));
                    setPayCreditUsd('');
                  }}
                  className="rounded-lg bg-amber-500/15 px-2.5 py-1.5 font-bold text-amber-700 dark:text-amber-300"
                >
                  Todo Cashea $
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold">Efectivo Divisas ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payCashUsd}
                    onChange={(e) => setPayCashUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">Pago Móvil (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payMobileBs}
                    onChange={(e) => setPayMobileBs(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">Punto de Venta / Tarjeta (Bs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payCardBs}
                    onChange={(e) => setPayCardBs(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">Cashea ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payCasheaUsd}
                    onChange={(e) => setPayCasheaUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold">Crédito / Fiado ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={payCreditUsd}
                    onChange={(e) => setPayCreditUsd(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                {creditVal > 0 && (
                  <div>
                    <label className="mb-1 block font-bold">Plazo Crédito (Días)</label>
                    <input
                      type="number"
                      value={creditDays}
                      onChange={(e) => setCreditDays(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>

              {creditVal > 0 && (
                <input
                  type="text"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  placeholder="Nota u observación del crédito..."
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                />
              )}

              {selectedCustomer?.isWithholdingAgent && (
                <label className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={applyWithholding}
                    onChange={(e) => setApplyWithholding(e.target.checked)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  <span>
                    Aplicar Retención SENIAT (IVA {selectedCustomer.ivaRetentionPercentage}% / ISLR{' '}
                    {selectedCustomer.islrRetentionPercentage}%)
                  </span>
                </label>
              )}

              {/* Summary Box */}
              <div className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#283A5A]/70">
                <div className="flex justify-between">
                  <span>Subtotal + IVA:</span>
                  <span className="font-mono-num font-bold">{formatUsd(breakdown.subtotalWithIvaUsd)}</span>
                </div>
                {igtfUsd > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-300">
                    <span>IGTF (3% sobre Efectivo $):</span>
                    <span className="font-mono-num font-bold">+{formatUsd(igtfUsd)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-extrabold dark:border-slate-600">
                  <span>Total Final:</span>
                  <span className="font-mono-num text-indigo-600 dark:text-sky-400">
                    {formatUsd(totalWithIgtfUsd)} ({formatBs(totalWithIgtfBs)})
                  </span>
                </div>
                <div className="flex justify-between pt-1">
                  <span>{remainingUsd > 0.01 ? 'Faltante por pagar:' : 'Cambio / Vuelto:'}</span>
                  <span
                    className={`font-mono-num font-extrabold ${
                      remainingUsd > 0.05 ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  >
                    {formatUsd(Math.abs(remainingUsd))} ({formatBs(Math.abs(remainingUsd) * rate)})
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold text-white shadow hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Emitir Factura
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Cart Item Modal */}
      {editingCartItem && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]">
            <h3 className="text-sm font-bold">{editingCartItem.product.name}</h3>
            <div className="mt-3 space-y-3 text-xs">
              <div>
                <label className="mb-1 block font-bold">Cantidad</label>
                <input
                  type="number"
                  step={editingCartItem.product.allowDecimalQuantity ? '0.01' : '1'}
                  value={editQtyStr}
                  onChange={(e) => setEditQtyStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">Precio Unitario ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editPriceStr}
                  onChange={(e) => setEditPriceStr(e.target.value)}
                  disabled={!editingCartItem.product.isPriceModifiable && editingCartItem.product.wholesalePriceUsd <= 0}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
                />
                {editingCartItem.product.wholesalePriceUsd > 0 && (
                  <button
                    type="button"
                    onClick={() => setEditPriceStr(String(editingCartItem.product.wholesalePriceUsd))}
                    className="mt-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1 font-bold text-sky-600 dark:text-sky-300"
                  >
                    Aplicar Precio al Mayor ({formatUsd(editingCartItem.product.wholesalePriceUsd)})
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCartItem(null)}
                className="rounded-xl px-3 py-2 text-xs font-bold text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = Number(editQtyStr) || 1;
                  const p = Number(editPriceStr) || editingCartItem.product.priceUsd;
                  updateCartQty('pos', editingCartItem.product.id, q);
                  updateCartCustomPrice('pos', editingCartItem.product.id, p);
                  setEditingCartItem(null);
                }}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Held Carts Modal */}
      {showHeldDrawer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
              <h3 className="text-base font-bold">Ventas en Espera</h3>
              <button type="button" onClick={() => setShowHeldDrawer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 max-h-80 space-y-2.5 overflow-y-auto">
              {state.heldSales.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">No hay ventas retenidas.</p>
              ) : (
                state.heldSales.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div>
                      <p className="text-xs font-bold">{h.customerName}</p>
                      <p className="font-mono-num text-xs text-indigo-500">{formatUsd(h.totalUsd)}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          restoreHeldSale(h.id);
                          setShowHeldDrawer(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        Retomar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleQuickCustomer}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Nuevo Cliente Rápido</h3>
              <button type="button" onClick={() => setShowNewCustomer(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              placeholder="Nombre o Razón Social *"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={newCustDoc}
              onChange={(e) => setNewCustDoc(e.target.value)}
              placeholder="Cédula o RIF (Ej: V-12345678 / J-40123456-7)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={newCustPhone}
              onChange={(e) => setNewCustPhone(e.target.value)}
              placeholder="Teléfono WhatsApp"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={newCustAddress}
              onChange={(e) => setNewCustAddress(e.target.value)}
              placeholder="Dirección"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowNewCustomer(false)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
                Guardar y Seleccionar
              </button>
            </div>
          </form>
        </div>
      )}

      <PrintTicketModal doc={printDoc} onClose={() => setPrintDoc(null)} />
    </div>
  );
};
