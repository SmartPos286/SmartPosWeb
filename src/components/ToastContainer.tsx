import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { usePos } from '../context/PosContext';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = usePos();

  if (toasts.length === 0) return null;

  return (
    <div className="no-print fixed bottom-4 right-4 z-[90] flex max-w-sm flex-col gap-2">
      {toasts.map((toast) => {
        const colors = {
          success: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-50 dark:bg-emerald-950/95',
          error: 'border-rose-500/40 bg-rose-950/90 text-rose-50',
          warning: 'border-amber-500/40 bg-amber-950/90 text-amber-50',
          info: 'border-sky-500/40 bg-slate-900/95 text-slate-50',
        }[toast.type];

        const Icon = {
          success: CheckCircle2,
          error: XCircle,
          warning: AlertTriangle,
          info: Info,
        }[toast.type];

        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all ${colors}`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">{toast.title}</p>
              <p className="mt-0.5 text-xs opacity-90">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="rounded-lg p-1 opacity-70 hover:bg-white/10 hover:opacity-100"
              aria-label="Cerrar notificación"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
