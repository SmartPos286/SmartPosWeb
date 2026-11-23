import React from 'react';
import { AlertTriangle, ArrowRight, PackageX, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatQty, getEffectiveStock } from '../utils/currencyMath';

export const InventoryAlertsModal: React.FC = () => {
  const {
    state,
    isAlertsOpen,
    setIsAlertsOpen,
    lowStockProducts,
    outOfStockProducts,
    setActiveRoute,
  } = usePos();

  if (!isAlertsOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <h3 className="text-base font-bold">Alertas de Inventario</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {outOfStockProducts.length} agotados • {lowStockProducts.length} en nivel crítico
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAlertsOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-5">
          {lowStockProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Todos los productos monitoreados tienen inventario suficiente.
            </div>
          ) : (
            lowStockProducts.map((p) => {
              const eff = getEffectiveStock(p, state.products);
              const isOut = eff <= 1e-6;
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-xl border p-3 ${
                    isOut
                      ? 'border-rose-500/40 bg-rose-500/10'
                      : 'border-amber-500/40 bg-amber-500/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <PackageX className={`h-5 w-5 ${isOut ? 'text-rose-500' : 'text-amber-500'}`} />
                    <div>
                      <p className="text-sm font-bold">{p.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">
                        {p.category} • Mínimo alerta: {formatQty(p.minStockAlertQuantity)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`font-mono-num rounded-lg px-2.5 py-1 text-xs font-extrabold ${
                        isOut ? 'bg-rose-600 text-white' : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      Stock: {formatQty(eff)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setIsAlertsOpen(false)}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAlertsOpen(false);
              setActiveRoute('inventory');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            Ir a Inventario
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
