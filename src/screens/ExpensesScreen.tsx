import React, { useMemo, useState } from 'react';
import { FileText, Plus, Receipt, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatBs, formatDateTime, formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

const EXPENSE_CATEGORIES = [
  'Renta / Alquiler',
  'Servicio Eléctrico (Luz)',
  'Internet / Telecomunicaciones',
  'Sueldos / Nómina',
  'Mantenimiento',
  'Servicios Públicos',
  'Impuestos / Tasas',
  'Otros Gastos',
];

export const ExpensesScreen: React.FC = () => {
  const { state, addExpense, currentUser } = usePos();
  const [catFilter, setCatFilter] = useState('Todas');
  const [showAdd, setShowAdd] = useState(false);

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'BS'>('USD');
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Efectivo USD');
  const [description, setDescription] = useState('');

  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;

  const filtered = useMemo(
    () => state.expenses.filter((e) => catFilter === 'Todas' || e.category === catFilter),
    [catFilter, state.expenses]
  );

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const todayUsd = round2(
    state.expenses.filter((e) => e.timestamp >= startOfDay).reduce((s, e) => s + e.amountUsd, 0)
  );
  const monthUsd = round2(
    state.expenses.filter((e) => e.timestamp >= startOfMonth).reduce((s, e) => s + e.amountUsd, 0)
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const val = Math.max(0, Number(amountStr) || 0);
    if (val <= 0) return;
    const amountUsd = inputCurrency === 'USD' ? round2(val) : round2(val / rate);
    const amountBs = inputCurrency === 'BS' ? round2(val) : round2(val * rate);

    addExpense({
      category,
      invoiceNumber: invoiceNumber.trim(),
      amountUsd,
      amountBs,
      bcvRateUsed: rate,
      paymentMethod,
      description: description.trim(),
      timestamp: Date.now(),
      registeredBy: currentUser?.username || 'Admin',
    });
    setShowAdd(false);
    setAmountStr('');
    setInvoiceNumber('');
    setDescription('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Egresos de Hoy</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-rose-500">{formatUsd(todayUsd)}</p>
          <p className="font-mono-num text-xs text-slate-500">{formatBs(todayUsd * rate)}</p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Egresos del Mes Actual</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-amber-500">{formatUsd(monthUsd)}</p>
          <p className="font-mono-num text-xs text-slate-500">{formatBs(monthUsd * rate)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {['Todas', ...EXPENSE_CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCatFilter(cat)}
              className={`rounded-xl px-3 py-1.5 ${
                catFilter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/85 text-slate-700 dark:bg-[#1E2D48] dark:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const filteredTotal = round2(filtered.reduce((s, e) => s + e.amountUsd, 0));
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Reporte de Egresos y Gastos Operativos',
                subtitle: `Categoría: ${catFilter} • ${filtered.length} registro(s)`,
                columns: ['Fecha', 'Categoría', 'Descripción', 'Método', 'Ref.', 'Monto ($)', 'Monto (Bs.)'],
                rows: filtered.map((e) => [
                  formatDateTime(e.timestamp),
                  e.category,
                  e.description || 'Sin descripción',
                  e.paymentMethod,
                  e.invoiceNumber || '—',
                  formatUsd(e.amountUsd),
                  formatBs(e.amountBs),
                ]),
                summaryLines: [
                  `Egresos Hoy: ${formatUsd(todayUsd)} | Egresos Mes: ${formatUsd(monthUsd)}`,
                  `Total Filtrado: ${formatUsd(filteredTotal)} (${formatBs(filteredTotal * rate)})`,
                ],
                orientation: 'landscape',
                filename: `gastos_${Date.now()}.pdf`,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-rose-700"
          >
            <Plus className="h-4 w-4" />
            Registrar Gasto
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.map((exp) => (
          <div
            key={exp.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-500">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-extrabold">{exp.category}</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  {exp.description || 'Sin descripción'} • {exp.paymentMethod}
                  {exp.invoiceNumber ? ` • Ref: ${exp.invoiceNumber}` : ''}
                </p>
                <p className="text-[11px] text-slate-400">
                  {formatDateTime(exp.timestamp)} • Por: {exp.registeredBy}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-mono-num text-base font-extrabold text-rose-500">-{formatUsd(exp.amountUsd)}</p>
                <p className="font-mono-num text-[11px] text-slate-500">{formatBs(exp.amountBs)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Registrar Egreso / Gasto</h3>
              <button type="button" onClick={() => setShowAdd(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <select
                value={inputCurrency}
                onChange={(e) => setInputCurrency(e.target.value as 'USD' | 'BS')}
                className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 font-bold dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="USD">$ USD</option>
                <option value="BS">Bs.</option>
              </select>
              <input
                type="number"
                step="0.01"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="Monto *"
                className="col-span-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            {Number(amountStr) > 0 && (
              <p className="font-mono-num text-[11px] text-slate-500">
                Equivalente:{' '}
                {inputCurrency === 'USD'
                  ? formatBs(Number(amountStr) * rate)
                  : formatUsd(Number(amountStr) / rate)}
              </p>
            )}
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="Efectivo USD">Efectivo USD</option>
              <option value="Pago Móvil">Pago Móvil</option>
              <option value="Transferencia">Transferencia</option>
              <option value="Punto / Débito">Punto / Débito</option>
            </select>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="N° Comprobante / Factura (Opcional)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del gasto..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white">
                Guardar Gasto
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
