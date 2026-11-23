import React, { useState } from 'react';
import { CheckCircle2, KeyRound, ShieldCheck, Sparkles, X } from 'lucide-react';
import { usePos } from '../context/PosContext';

export const LicenseModal: React.FC = () => {
  const {
    state,
    isLicenseOpen,
    setIsLicenseOpen,
    isLicensed,
    todaySalesCount,
    activateLicense,
  } = usePos();
  const [keyInput, setKeyInput] = useState(state.settings.licenseKey || '');

  if (!isLicenseOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activateLicense(keyInput)) {
      setIsLicenseOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        <div className="flex items-center justify-between bg-gradient-to-r from-indigo-700 to-sky-600 px-5 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6" />
            <div>
              <h3 className="text-base font-bold">Licencia SmartPOS286</h3>
              <p className="text-xs text-white/80">Estado de suscripción y límites operativos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsLicenseOpen(false)}
            className="rounded-lg p-1 hover:bg-white/15"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div
            className={`rounded-xl border p-4 ${
              isLicensed
                ? 'border-emerald-500/40 bg-emerald-500/10'
                : 'border-amber-500/40 bg-amber-500/10'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {state.settings.licenseType === 'PRO_LIFETIME'
                  ? 'Licencia Maestra Vitalicia'
                  : isLicensed
                    ? 'Licencia Comercial Activa'
                    : 'Modo Prueba Gratuita'}
              </span>
              {isLicensed ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <Sparkles className="h-5 w-5 text-amber-500" />
              )}
            </div>
            {!isLicensed ? (
              <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                <p>
                  • Productos registrados:{' '}
                  <strong className="font-mono-num">
                    {state.products.length} / {state.settings.maxProductsLimit}
                  </strong>
                </p>
                <p>
                  • Facturas emitidas hoy:{' '}
                  <strong className="font-mono-num">
                    {todaySalesCount} / {state.settings.maxDailyInvoicesLimit}
                  </strong>
                </p>
              </div>
            ) : (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Facturación diaria, productos, respaldo y usuarios ilimitados habilitados.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600 dark:text-slate-300">
                Código / Clave de Licencia
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="Ej: SP286-XXXX o Clave Maestra"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsLicenseOpen(false)}
                className="min-h-[40px] rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cerrar
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                Activar Licencia
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
