import React from 'react';
import { Calendar } from 'lucide-react';

export type DatePreset = 'TODAY' | 'YESTERDAY' | 'LAST_7' | 'MONTH' | 'ALL' | 'CUSTOM';

export interface DateRangeValue {
  preset: DatePreset;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function resolveDateBounds(range: DateRangeValue): { startTs: number; endTs: number; label: string } {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

  switch (range.preset) {
    case 'TODAY':
      return { startTs: startOfToday, endTs: endOfToday, label: 'Hoy' };
    case 'YESTERDAY': {
      const yStart = startOfToday - 86400000;
      const yEnd = startOfToday - 1;
      return { startTs: yStart, endTs: yEnd, label: 'Ayer' };
    }
    case 'LAST_7':
      return { startTs: startOfToday - 6 * 86400000, endTs: endOfToday, label: 'Últimos 7 días' };
    case 'MONTH': {
      const mStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
      return { startTs: mStart, endTs: endOfToday, label: 'Mes actual' };
    }
    case 'CUSTOM': {
      const s = range.startDate ? new Date(`${range.startDate}T00:00:00`).getTime() : 0;
      const e = range.endDate ? new Date(`${range.endDate}T23:59:59.999`).getTime() : endOfToday;
      return {
        startTs: Number.isFinite(s) ? s : 0,
        endTs: Number.isFinite(e) ? e : endOfToday,
        label: `${range.startDate || '...'} a ${range.endDate || '...'}`,
      };
    }
    default:
      return { startTs: 0, endTs: Number.MAX_SAFE_INTEGER, label: 'Histórico completo' };
  }
}

interface DateRangeFilterBarProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

const PRESETS: Array<{ id: DatePreset; label: string }> = [
  { id: 'TODAY', label: 'Hoy' },
  { id: 'YESTERDAY', label: 'Ayer' },
  { id: 'LAST_7', label: '7 Días' },
  { id: 'MONTH', label: 'Mes Actual' },
  { id: 'ALL', label: 'Todo' },
  { id: 'CUSTOM', label: 'Rango' },
];

export const DateRangeFilterBar: React.FC<DateRangeFilterBarProps> = ({ value, onChange }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-300/60 bg-white/80 p-2.5 dark:border-slate-700/70 dark:bg-[#1E2D48]/90">
      <div className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-600 dark:text-slate-300">
        <Calendar className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <span>Período:</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const active = value.preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange({ ...value, preset: p.id })}
              className={`min-h-[34px] rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-500'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-[#283A5A] dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {value.preset === 'CUSTOM' && (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <input
            type="date"
            value={value.startDate}
            onChange={(e) => onChange({ ...value, startDate: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500">hasta</span>
          <input
            type="date"
            value={value.endDate}
            onChange={(e) => onChange({ ...value, endDate: e.target.value })}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      )}
    </div>
  );
};
