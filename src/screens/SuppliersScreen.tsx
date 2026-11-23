import React, { useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, FileText, Plus, Search, Truck, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { Supplier } from '../types/models';
import { formatDateOnly, formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const SuppliersScreen: React.FC = () => {
  const {
    state,
    saveSupplier,
    createPurchaseInvoice,
    payPurchaseInvoice,
    setIsOcrModalOpen,
  } = usePos();

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(state.suppliers[0]?.id ?? null);
  const [editingSupp, setEditingSupp] = useState<Partial<Supplier> | null>(null);
  const [invoiceSuppId, setInvoiceSuppId] = useState<number | null>(null);

  // Add Purchase Invoice state
  const [invNum, setInvNum] = useState('');
  const [subtotalStr, setSubtotalStr] = useState('');
  const [ivaPctStr, setIvaPctStr] = useState('16');
  const [retIvaPctStr, setRetIvaPctStr] = useState('0');
  const [retIslrPctStr, setRetIslrPctStr] = useState('0');
  const [invDesc, setInvDesc] = useState('');
  const [isPaidNow, setIsPaidNow] = useState(false);

  const filteredSuppliers = state.suppliers.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const suppMatch = s.name.toLowerCase().includes(q) || s.documentId.toLowerCase().includes(q);
    const invMatch = state.purchaseInvoices.some(
      (i) => i.supplierId === s.id && i.invoiceNumber.toLowerCase().includes(q)
    );
    return suppMatch || invMatch;
  });

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupp?.name?.trim()) return;
    saveSupplier({
      id: editingSupp.id,
      name: editingSupp.name.trim(),
      documentId: editingSupp.documentId?.trim() || 'J-00000000-0',
      phone: editingSupp.phone?.trim() || '',
      address: editingSupp.address?.trim() || '',
    });
    setEditingSupp(null);
  };

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceSuppId || !invNum.trim()) return;
    const subtotal = Math.max(0, Number(subtotalStr) || 0);
    const ivaPct = Math.max(0, Number(ivaPctStr) || 0);
    const taxAmt = round2(subtotal * (ivaPct / 100));
    const retIvaPct = Math.max(0, Number(retIvaPctStr) || 0);
    const retIslrPct = Math.max(0, Number(retIslrPctStr) || 0);
    const retIva = round2(taxAmt * (retIvaPct / 100));
    const retIslr = round2(subtotal * (retIslrPct / 100));
    const hasRet = retIva > 0 || retIslr > 0;
    const now = Date.now();
    const ym = new Date(now).toISOString().slice(0, 7).replace('-', '');

    createPurchaseInvoice({
      supplierId: invoiceSuppId,
      invoiceNumber: invNum.trim(),
      timestamp: now,
      totalAmount: round2(subtotal + taxAmt),
      description: invDesc.trim(),
      isPaid: isPaidNow,
      paidTimestamp: isPaidNow ? now : 0,
      dueDate: isPaidNow ? 0 : now + 15 * 86400000,
      paymentNotes: '',
      subtotalUsd: subtotal,
      taxAmountUsd: taxAmt,
      retencionIvaUsd: retIva,
      retencionIvaPercentage: retIvaPct,
      retencionIslrUsd: retIslr,
      retencionIslrPercentage: retIslrPct,
      withholdingVoucherNumber: hasRet ? `${ym}${String(state.purchaseInvoices.length + 1).padStart(8, '0')}` : '',
      withholdingStatus: hasRet ? 'PENDIENTE_ENTERA' : 'NO_APLICA',
    });

    setInvoiceSuppId(null);
    setInvNum('');
    setSubtotalStr('');
    setInvDesc('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/60 bg-white/95 p-3.5 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar proveedor, RIF o N° factura..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const pendingTotal = round2(
                state.purchaseInvoices.filter((i) => !i.isPaid).reduce((sum, i) => sum + i.totalAmount, 0)
              );
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Directorio de Proveedores y Compras',
                subtitle: `${filteredSuppliers.length} proveedor(es) • ${state.purchaseInvoices.length} factura(s) de compra`,
                columns: ['Proveedor', 'RIF', 'Teléfono', 'Facturas', 'Por Pagar ($)', 'Total Compras ($)'],
                rows: filteredSuppliers.map((s) => {
                  const invs = state.purchaseInvoices.filter((i) => i.supplierId === s.id);
                  const pending = round2(invs.filter((i) => !i.isPaid).reduce((sum, i) => sum + i.totalAmount, 0));
                  const total = round2(invs.reduce((sum, i) => sum + i.totalAmount, 0));
                  return [
                    s.name,
                    s.documentId,
                    s.phone || '—',
                    String(invs.length),
                    formatUsd(pending),
                    formatUsd(total),
                  ];
                }),
                summaryLines: [`Cuentas por Pagar Pendientes a Proveedores: ${formatUsd(pendingTotal)}`],
                filename: `proveedores_${Date.now()}.pdf`,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => setIsOcrModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-700 dark:text-sky-300"
          >
            <Camera className="h-4 w-4" />
            Escanear Factura OCR
          </button>
          <button
            type="button"
            onClick={() => setEditingSupp({ name: '', documentId: '', phone: '', address: '' })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Nuevo Proveedor
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {filteredSuppliers.map((s) => {
          const invoices = state.purchaseInvoices.filter((i) => i.supplierId === s.id);
          const expanded = expandedId === s.id;
          return (
            <div
              key={s.id}
              className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">{s.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {s.documentId} • {s.phone || 'Sin teléfono'} • {invoices.length} factura(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInvoiceSuppId(s.id)}
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    + Factura Compra
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    className="rounded-xl border border-slate-300 p-1.5 dark:border-slate-600"
                  >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-700">
                  {invoices.length === 0 ? (
                    <p className="text-xs text-slate-500">Sin facturas de compra registradas.</p>
                  ) : (
                    invoices.map((inv) => {
                      const linkedProds = state.products.filter(
                        (p) => p.invoiceNumber && p.invoiceNumber === inv.invoiceNumber
                      );
                      return (
                        <div
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-[#283A5A]/50"
                        >
                          <div>
                            <div className="flex items-center gap-2 font-bold">
                              <FileText className="h-4 w-4 text-indigo-500" />
                              <span>Factura #{inv.invoiceNumber}</span>
                              <span
                                className={`rounded px-2 py-0.5 text-[10px] ${
                                  inv.isPaid
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                                }`}
                              >
                                {inv.isPaid ? 'PAGADA' : 'POR PAGAR'}
                              </span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-300">
                              {formatDateOnly(inv.timestamp)} • {inv.description || 'Compra mercancía'} •{' '}
                              {linkedProds.length} producto(s) asociado(s)
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-num text-sm font-extrabold">{formatUsd(inv.totalAmount)}</span>
                            {!inv.isPaid && (
                              <button
                                type="button"
                                onClick={() => payPurchaseInvoice(inv.id)}
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 font-bold text-white"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Pagar
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Supplier Modal */}
      {editingSupp && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleSaveSupplier}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Registrar Proveedor</h3>
              <button type="button" onClick={() => setEditingSupp(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={editingSupp.name || ''}
              onChange={(e) => setEditingSupp({ ...editingSupp, name: e.target.value })}
              placeholder="Razón Social *"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={editingSupp.documentId || ''}
              onChange={(e) => setEditingSupp({ ...editingSupp, documentId: e.target.value })}
              placeholder="RIF (Ej: J-30112233-4)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={editingSupp.phone || ''}
              onChange={(e) => setEditingSupp({ ...editingSupp, phone: e.target.value })}
              placeholder="Teléfono"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={editingSupp.address || ''}
              onChange={(e) => setEditingSupp({ ...editingSupp, address: e.target.value })}
              placeholder="Dirección fiscal"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingSupp(null)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
                Guardar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Purchase Invoice Modal */}
      {invoiceSuppId && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleCreateInvoice}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Nueva Factura de Compra</h3>
              <button type="button" onClick={() => setInvoiceSuppId(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={invNum}
              onChange={(e) => setInvNum(e.target.value)}
              placeholder="N° de Factura *"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="0.01"
                required
                value={subtotalStr}
                onChange={(e) => setSubtotalStr(e.target.value)}
                placeholder="Base Imponible ($)"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num text-xs dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                type="number"
                value={ivaPctStr}
                onChange={(e) => setIvaPctStr(e.target.value)}
                placeholder="IVA % (16)"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num text-xs dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="mb-1 block font-bold">Retención IVA %</label>
                <select
                  value={retIvaPctStr}
                  onChange={(e) => setRetIvaPctStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="0">0% (No aplica)</option>
                  <option value="75">75% SENIAT</option>
                  <option value="100">100% SENIAT</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block font-bold">Retención ISLR %</label>
                <select
                  value={retIslrPctStr}
                  onChange={(e) => setRetIslrPctStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                >
                  <option value="0">0%</option>
                  <option value="1">1%</option>
                  <option value="2">2%</option>
                  <option value="3">3%</option>
                  <option value="5">5%</option>
                </select>
              </div>
            </div>
            <input
              type="text"
              value={invDesc}
              onChange={(e) => setInvDesc(e.target.value)}
              placeholder="Descripción o concepto..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <label className="flex items-center gap-2 text-xs font-semibold">
              <input type="checkbox" checked={isPaidNow} onChange={(e) => setIsPaidNow(e.target.checked)} />
              <span>Marcar factura como pagada de contado</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setInvoiceSuppId(null)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">
                Registrar Compra
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
