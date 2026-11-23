import React, { useState } from 'react';
import { Edit, FileText, Plus, Search, ShieldCheck, Users, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { Customer } from '../types/models';
import { formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const CustomersScreen: React.FC = () => {
  const { state, saveCustomer, setIsDebtsOpen } = usePos();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | Customer['clientType']>('ALL');
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);

  const filtered = state.customers.filter((c) => {
    const typeOk = typeFilter === 'ALL' || c.clientType === typeFilter;
    const q = search.trim().toLowerCase();
    const qOk = !q || c.name.toLowerCase().includes(q) || c.documentId.toLowerCase().includes(q);
    return typeOk && qOk;
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing?.name?.trim()) return;
    saveCustomer({
      id: editing.id,
      name: editing.name.trim(),
      documentId: editing.documentId?.trim() || 'V-00000000',
      phone: editing.phone?.trim() || '',
      address: editing.address?.trim() || '',
      clientType: editing.clientType || 'PERSONA_NATURAL',
      isWithholdingAgent: Boolean(editing.isWithholdingAgent),
      ivaRetentionPercentage: editing.isWithholdingAgent ? Number(editing.ivaRetentionPercentage ?? 75) : 0,
      islrRetentionPercentage: editing.isWithholdingAgent ? Number(editing.islrRetentionPercentage ?? 2) : 0,
    });
    setEditing(null);
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
            placeholder="Buscar cliente por nombre o Cédula/RIF..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs dark:border-slate-600 dark:bg-slate-900"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              const totalDebt = round2(
                state.sales
                  .filter((s) => s.status !== 'DEVUELTA' && s.paymentCreditUsd > 0 && !s.isCreditPaid)
                  .reduce((acc, s) => acc + Math.max(0, s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
              );
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Directorio de Clientes y Saldos',
                subtitle: `Filtro: ${typeFilter} • ${filtered.length} cliente(s)`,
                columns: ['Cliente', 'Cédula/RIF', 'Tipo', 'Teléfono', 'Agente Ret.', 'Saldo Pend. ($)'],
                rows: filtered.map((c) => {
                  const debtUsd = round2(
                    state.sales
                      .filter(
                        (s) =>
                          s.status !== 'DEVUELTA' &&
                          s.customerDocument === c.documentId &&
                          s.paymentCreditUsd > 0 &&
                          !s.isCreditPaid
                      )
                      .reduce((acc, s) => acc + Math.max(0, s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
                  );
                  return [
                    c.name,
                    c.documentId,
                    c.clientType.replace('_', ' '),
                    c.phone || '—',
                    c.isWithholdingAgent ? `Sí (${c.ivaRetentionPercentage}%/${c.islrRetentionPercentage}%)` : 'No',
                    formatUsd(debtUsd),
                  ];
                }),
                summaryLines: [`Total Cuentas por Cobrar: ${formatUsd(totalDebt)}`],
                orientation: 'landscape',
                filename: `clientes_${Date.now()}.pdf`,
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() =>
              setEditing({
                name: '',
                documentId: '',
                phone: '',
                address: '',
                clientType: 'PERSONA_NATURAL',
                isWithholdingAgent: false,
                ivaRetentionPercentage: 75,
                islrRetentionPercentage: 2,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Nuevo Cliente
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs font-bold">
        {[
          { id: 'ALL', label: 'Todos' },
          { id: 'PERSONA_NATURAL', label: 'Natural (V/E)' },
          { id: 'PERSONA_JURIDICA', label: 'Jurídica (J)' },
          { id: 'GOBIERNO', label: 'Gobierno (G)' },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id as any)}
            className={`rounded-xl px-3.5 py-1.5 ${
              typeFilter === f.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white/85 text-slate-700 dark:bg-[#1E2D48] dark:text-slate-300'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {filtered.map((c) => {
          const debtUsd = round2(
            state.sales
              .filter(
                (s) =>
                  s.status !== 'DEVUELTA' &&
                  s.customerDocument === c.documentId &&
                  s.paymentCreditUsd > 0 &&
                  !s.isCreditPaid
              )
              .reduce((acc, s) => acc + Math.max(0, s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
          );
          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-sky-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold">{c.name}</p>
                    <p className="font-mono-num text-xs text-slate-500 dark:text-slate-300">
                      {c.documentId} • {c.phone || 'Sin teléfono'}
                    </p>
                    {c.address && <p className="mt-0.5 text-[11px] text-slate-400">{c.address}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing({ ...c })}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-2.5 text-xs dark:border-slate-700/70">
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-[#283A5A]">
                    {c.clientType.replace('_', ' ')}
                  </span>
                  {c.isWithholdingAgent && (
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-sky-300">
                      <ShieldCheck className="h-3 w-3" />
                      Retención IVA {c.ivaRetentionPercentage}% / ISLR {c.islrRetentionPercentage}%
                    </span>
                  )}
                </div>
                {debtUsd > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsDebtsOpen(true)}
                    className="font-mono-num rounded-lg bg-amber-500/15 px-2.5 py-1 font-bold text-amber-600 dark:text-amber-300"
                  >
                    Saldo: {formatUsd(debtUsd)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{editing.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <input
              type="text"
              required
              value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="Nombre o Razón Social *"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={editing.documentId || ''}
                onChange={(e) => setEditing({ ...editing, documentId: e.target.value })}
                placeholder="Cédula o RIF"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
              <select
                value={editing.clientType || 'PERSONA_NATURAL'}
                onChange={(e) => setEditing({ ...editing, clientType: e.target.value as any })}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="PERSONA_NATURAL">Natural (V/E)</option>
                <option value="PERSONA_JURIDICA">Jurídica (J)</option>
                <option value="GOBIERNO">Gobierno (G)</option>
              </select>
            </div>
            <input
              type="text"
              value={editing.phone || ''}
              onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
              placeholder="Teléfono"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={editing.address || ''}
              onChange={(e) => setEditing({ ...editing, address: e.target.value })}
              placeholder="Dirección"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />

            <label className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-2.5 text-xs font-semibold">
              <input
                type="checkbox"
                checked={Boolean(editing.isWithholdingAgent)}
                onChange={(e) => setEditing({ ...editing, isWithholdingAgent: e.target.checked })}
              />
              <span>Es Agente de Retención Especial SENIAT</span>
            </label>

            {editing.isWithholdingAgent && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="mb-1 block font-bold">% Retención IVA</label>
                  <select
                    value={editing.ivaRetentionPercentage ?? 75}
                    onChange={(e) => setEditing({ ...editing, ivaRetentionPercentage: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value={75}>75%</option>
                    <option value={100}>100%</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-bold">% Retención ISLR</label>
                  <select
                    value={editing.islrRetentionPercentage ?? 2}
                    onChange={(e) => setEditing({ ...editing, islrRetentionPercentage: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value={0}>0%</option>
                    <option value={1}>1%</option>
                    <option value={2}>2%</option>
                    <option value={3}>3%</option>
                    <option value={5}>5%</option>
                  </select>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
                Guardar Cliente
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
