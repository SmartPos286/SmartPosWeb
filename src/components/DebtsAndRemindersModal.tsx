import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, CreditCard, Users, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatDateOnly, formatUsd, round2 } from '../utils/currencyMath';

export const DebtsAndRemindersModal: React.FC = () => {
  const {
    state,
    isDebtsOpen,
    setIsDebtsOpen,
    paySaleCredit,
    payPurchaseInvoice,
  } = usePos();
  const [tab, setTab] = useState<'cobrar' | 'pagar'>('cobrar');
  const [paySaleId, setPaySaleId] = useState<number | null>(null);
  const [payAmountStr, setPayAmountStr] = useState('');

  if (!isDebtsOpen) return null;

  const pendingSales = state.sales.filter(
    (s) => s.status !== 'DEVUELTA' && s.paymentCreditUsd > 0.001 && !s.isCreditPaid
  );
  const pendingPurchases = state.purchaseInvoices.filter((p) => !p.isPaid);
  const totalReceivable = round2(
    pendingSales.reduce((sum, s) => sum + Math.max(0, s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
  );
  const totalPayable = round2(pendingPurchases.reduce((sum, p) => sum + p.totalAmount, 0));

  const now = Date.now();

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <CreditCard className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="text-base font-bold">Cuentas por Cobrar y Pagar</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Por cobrar: {formatUsd(totalReceivable)} • Por pagar: {formatUsd(totalPayable)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsDebtsOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-200 text-xs font-bold dark:border-slate-700">
          <button
            type="button"
            onClick={() => setTab('cobrar')}
            className={`flex items-center justify-center gap-2 border-b-2 py-3 ${
              tab === 'cobrar'
                ? 'border-indigo-500 text-indigo-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <Users className="h-4 w-4" />
            Por Cobrar ({pendingSales.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('pagar')}
            className={`flex items-center justify-center gap-2 border-b-2 py-3 ${
              tab === 'pagar'
                ? 'border-indigo-500 text-indigo-600 dark:text-sky-400'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            Por Pagar Proveedores ({pendingPurchases.length})
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {tab === 'cobrar' && (
            <>
              {pendingSales.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No hay créditos de clientes pendientes por cobrar.
                </div>
              ) : (
                pendingSales.map((s) => {
                  const balance = round2(s.paymentCreditUsd - s.creditPaidAmountUsd);
                  const overdue = s.creditDueDate > 0 && s.creditDueDate < now;
                  const isPaying = paySaleId === s.id;
                  return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#283A5A]/50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">
                              Factura #{s.id} • {s.customerName}
                            </span>
                            {overdue && (
                              <span className="rounded bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-500">
                                VENCIDA
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-300">
                            {s.customerDocument} • Vence:{' '}
                            {s.creditDueDate > 0 ? formatDateOnly(s.creditDueDate) : 'Sin fecha'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono-num text-sm font-extrabold text-amber-500">
                            Saldo: {formatUsd(balance)}
                          </p>
                          <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                            Original: {formatUsd(s.paymentCreditUsd)}
                          </p>
                        </div>
                      </div>

                      {isPaying ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={payAmountStr}
                            onChange={(e) => setPayAmountStr(e.target.value)}
                            placeholder="Monto abono USD"
                            className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Number(payAmountStr);
                              if (val > 0) {
                                paySaleCredit(s.id, val);
                                setPaySaleId(null);
                                setPayAmountStr('');
                              }
                            }}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Confirmar Abono
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaySaleId(null)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setPaySaleId(s.id);
                              setPayAmountStr(balance.toFixed(2));
                            }}
                            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
                          >
                            Registrar Abono
                          </button>
                          <button
                            type="button"
                            onClick={() => paySaleCredit(s.id, balance)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-300"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Liquidar Total
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}

          {tab === 'pagar' && (
            <>
              {pendingPurchases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  No hay facturas de proveedores pendientes por pagar.
                </div>
              ) : (
                pendingPurchases.map((inv) => {
                  const supp = state.suppliers.find((x) => x.id === inv.supplierId);
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-700 dark:bg-[#283A5A]/50"
                    >
                      <div>
                        <p className="text-sm font-bold">
                          Factura #{inv.invoiceNumber} • {supp?.name ?? 'Proveedor'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                          Emisión: {formatDateOnly(inv.timestamp)}
                          {inv.dueDate > 0 ? ` • Vence: ${formatDateOnly(inv.dueDate)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-num text-sm font-extrabold text-rose-500">
                          {formatUsd(inv.totalAmount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => payPurchaseInvoice(inv.id)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          Marcar Pagada
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
