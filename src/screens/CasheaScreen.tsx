import React, { useState } from 'react';
import { FileText, Plus, QrCode, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatBs, formatDateOnly, formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const CasheaScreen: React.FC = () => {
  const { state, addCasheaSettlement, currentUser } = usePos();
  const [showModal, setShowModal] = useState(false);
  const [grossStr, setGrossStr] = useState('');
  const [commPctStr, setCommPctStr] = useState('6');
  const [notes, setNotes] = useState('');

  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;

  const casheaSales = state.sales.filter((s) => s.status !== 'DEVUELTA' && s.paymentCasheaUsd > 0.001);
  const totalSoldCasheaUsd = round2(casheaSales.reduce((s, x) => s + x.paymentCasheaUsd, 0));
  const totalSettledGrossUsd = round2(state.casheaSettlements.reduce((s, c) => s + c.grossAmountUsd, 0));
  const totalNetReceivedUsd = round2(state.casheaSettlements.reduce((s, c) => s + c.netReceivedUsd, 0));
  const totalCommissionsUsd = round2(state.casheaSettlements.reduce((s, c) => s + c.commissionAmountUsd, 0));
  const pendingToSettleUsd = round2(Math.max(0, totalSoldCasheaUsd - totalSettledGrossUsd));

  const grossNum = Math.max(0, Number(grossStr) || 0);
  const commPct = Math.max(0, Number(commPctStr) || 0);
  const commAmt = round2(grossNum * (commPct / 100));
  const netAmt = round2(grossNum - commAmt);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (grossNum <= 0) return;
    addCasheaSettlement({
      settlementDate: Date.now(),
      grossAmountUsd: grossNum,
      commissionPercentage: commPct,
      commissionAmountUsd: commAmt,
      netReceivedUsd: netAmt,
      rateBcv: rate,
      notes: notes.trim(),
      registeredBy: currentUser?.username || 'Admin',
    });
    setShowModal(false);
    setGrossStr('');
    setNotes('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Vendido vía Cashea</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-indigo-600 dark:text-sky-400">
            {formatUsd(totalSoldCasheaUsd)}
          </p>
          <p className="text-xs text-slate-500">{casheaSales.length} venta(s)</p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Neto Liquidado en Banco</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatUsd(totalNetReceivedUsd)}
          </p>
          <p className="font-mono-num text-xs text-slate-500">{formatBs(totalNetReceivedUsd * rate)}</p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Por Liquidar</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-amber-500">
            {formatUsd(pendingToSettleUsd)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Comisiones Cashea</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-rose-500">
            {formatUsd(totalCommissionsUsd)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-extrabold">Liquidaciones Recibidas de Cashea</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Reporte de Ventas y Liquidaciones Cashea',
                subtitle: `${casheaSales.length} venta(s) Cashea • ${state.casheaSettlements.length} liquidación(es)`,
                columns: ['Fecha', 'Bruto ($)', 'Comisión (%)', 'Comisión ($)', 'Neto Recibido ($)', 'Notas'],
                rows: state.casheaSettlements.map((c) => [
                  formatDateOnly(c.settlementDate),
                  formatUsd(c.grossAmountUsd),
                  `${c.commissionPercentage}%`,
                  formatUsd(c.commissionAmountUsd),
                  formatUsd(c.netReceivedUsd),
                  c.notes || '—',
                ]),
                summaryLines: [
                  `Vendido Cashea: ${formatUsd(totalSoldCasheaUsd)} | Neto Liquidado: ${formatUsd(totalNetReceivedUsd)}`,
                  `Por Liquidar: ${formatUsd(pendingToSettleUsd)} | Comisiones: ${formatUsd(totalCommissionsUsd)}`,
                ],
                filename: `cashea_liquidaciones_${Date.now()}.pdf`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => {
              setGrossStr(pendingToSettleUsd > 0 ? pendingToSettleUsd.toFixed(2) : '');
              setShowModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Registrar Liquidación
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {state.casheaSettlements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
            No has registrado liquidaciones de Cashea aún.
          </div>
        ) : (
          state.casheaSettlements.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                  <QrCode className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-extrabold">
                    Liquidación {formatDateOnly(c.settlementDate)}
                  </p>
                  <p className="font-mono-num text-xs text-slate-500 dark:text-slate-300">
                    Bruto: {formatUsd(c.grossAmountUsd)} • Comisión ({c.commissionPercentage}%): -
                    {formatUsd(c.commissionAmountUsd)}
                  </p>
                  {c.notes && <p className="text-[11px] text-slate-400">{c.notes}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-num text-base font-extrabold text-emerald-500">
                  +{formatUsd(c.netReceivedUsd)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Registrar Liquidación Cashea</h3>
              <button type="button" onClick={() => setShowModal(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="mb-1 block font-bold">Monto Bruto ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={grossStr}
                  onChange={(e) => setGrossStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold">% Comisión Cashea</label>
                <input
                  type="number"
                  step="0.1"
                  value={commPctStr}
                  onChange={(e) => setCommPctStr(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                />
              </div>
            </div>
            <div className="rounded-xl bg-emerald-500/10 p-3 text-xs">
              <p>
                Comisión descontada: <strong className="font-mono-num">{formatUsd(commAmt)}</strong>
              </p>
              <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                Neto Recibido: <span className="font-mono-num">{formatUsd(netAmt)}</span>
              </p>
            </div>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Referencia bancaria / notas..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white">
                Guardar Liquidación
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
