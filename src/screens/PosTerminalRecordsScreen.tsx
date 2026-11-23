import React, { useMemo, useState } from 'react';
import { Camera, CreditCard, Download, FileText, Loader2, Plus, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { PosTerminalRecord } from '../types/models';
import { formatDateOnly, formatDateTime, round2 } from '../utils/currencyMath';
import { downloadTextFile } from '../utils/csvInventory';
import { generatePosTerminalCsv } from '../utils/exports';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const PosTerminalRecordsScreen: React.FC = () => {
  const { state, addPosTerminalRecord, currentUser, notify } = usePos();
  const [statusFilter, setStatusFilter] = useState<'ALL' | PosTerminalRecord['transactionStatus']>('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Form
  const [bankOrTerminal, setBankOrTerminal] = useState('Banesco');
  const [operationType, setOperationType] = useState('COMPRA');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [approvalNumber, setApprovalNumber] = useState('');
  const [maskedCardNumber, setMaskedCardNumber] = useState('');
  const [totalAmountStr, setTotalAmountStr] = useState('');
  const [currency, setCurrency] = useState<'VES' | 'USD'>('VES');
  const [transactionStatus, setTransactionStatus] = useState<PosTerminalRecord['transactionStatus']>('APROBADA');
  const [txDateTime, setTxDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [rawOcrText, setRawOcrText] = useState('');

  const filtered = useMemo(() => {
    return state.posTerminalRecords.filter(
      (r) => statusFilter === 'ALL' || r.transactionStatus === statusFilter
    );
  }, [state.posTerminalRecords, statusFilter]);

  const totalApprovedVes = round2(
    filtered
      .filter((r) => r.transactionStatus === 'APROBADA' && r.currency === 'VES')
      .reduce((s, r) => s + r.totalAmount, 0)
  );
  const totalApprovedUsd = round2(
    filtered
      .filter((r) => r.transactionStatus === 'APROBADA' && r.currency === 'USD')
      .reduce((s, r) => s + r.totalAmount, 0)
  );

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/gemini/pos-ticket-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error leyendo ticket POS');

      setBankOrTerminal(data.bankOrTerminal || 'Terminal');
      setOperationType(data.operationType || 'COMPRA');
      setReceiptNumber(data.receiptNumber || '');
      setReferenceNumber(data.referenceNumber || '');
      setApprovalNumber(data.approvalNumber || '');
      setMaskedCardNumber(data.maskedCardNumber || '');
      setTotalAmountStr(String(data.totalAmount || ''));
      setCurrency(data.currency === 'USD' ? 'USD' : 'VES');
      setTransactionStatus(
        ['APROBADA', 'RECHAZADA', 'ANULADA', 'PENDIENTE'].includes(data.transactionStatus)
          ? data.transactionStatus
          : 'APROBADA'
      );
      setTxDateTime(data.transactionDateTime || '');
      setRawOcrText(data.rawOcrText || '');
      setShowAdd(true);
      notify('Voucher Leído con IA', 'Verifica los campos extraídos antes de guardar.', 'success');
    } catch (err) {
      notify('Error OCR', err instanceof Error ? err.message : 'No se pudo procesar el ticket', 'error');
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(totalAmountStr) || 0;
    if (amount <= 0) return;
    addPosTerminalRecord({
      transactionDateTime: txDateTime || formatDateTime(Date.now()),
      transactionTimestamp: Date.now(),
      receiptNumber,
      referenceNumber,
      approvalNumber,
      maskedCardNumber,
      operationType,
      totalAmount: round2(amount),
      currency,
      transactionStatus,
      bankOrTerminal,
      notes,
      rawOcrText,
      registeredBy: currentUser?.username || 'Sistema',
    });
    setShowAdd(false);
    setTotalAmountStr('');
    setReferenceNumber('');
    setApprovalNumber('');
    setReceiptNumber('');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Vouchers Aprobados (Bs.)</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-sky-600 dark:text-sky-400">
            Bs. {totalApprovedVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Vouchers Aprobados ($ USD)</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            ${totalApprovedUsd.toFixed(2)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Total Comprobantes</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold">{filtered.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/60 bg-white/95 p-3.5 dark:border-slate-700 dark:bg-[#1E2D48]">
        <div className="flex flex-wrap gap-1.5 text-xs font-bold">
          {(['ALL', 'APROBADA', 'PENDIENTE', 'RECHAZADA', 'ANULADA'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3 py-1.5 ${
                statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-[#283A5A]'
              }`}
            >
              {st === 'ALL' ? 'Todos' : st}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3.5 py-2 text-xs font-bold text-sky-700 dark:text-sky-300">
            {isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Escanear Voucher IA
            <input type="file" accept="image/*" className="hidden" onChange={handleOcrUpload} disabled={isScanning} />
          </label>
          <button
            type="button"
            onClick={() =>
              downloadTextFile(`puntos_venta_${Date.now()}.csv`, generatePosTerminalCsv(filtered))
            }
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold dark:border-slate-600"
          >
            <Download className="h-4 w-4" />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Registro de Vouchers y Puntos de Venta',
                subtitle: `Filtro: ${statusFilter} • ${filtered.length} comprobante(s)`,
                columns: ['Fecha', 'Banco / Terminal', 'Operación', 'Ref.', 'Aprob.', 'Estado', 'Monto'],
                rows: filtered.map((r) => [
                  r.transactionDateTime || formatDateOnly(r.transactionTimestamp),
                  r.bankOrTerminal || 'POS',
                  r.operationType,
                  r.referenceNumber || '—',
                  r.approvalNumber || '—',
                  r.transactionStatus,
                  r.currency === 'USD' ? `$${r.totalAmount.toFixed(2)}` : `Bs. ${r.totalAmount.toFixed(2)}`,
                ]),
                summaryLines: [
                  `Aprobados VES: Bs. ${totalApprovedVes.toFixed(2)} | Aprobados USD: $${totalApprovedUsd.toFixed(2)}`,
                ],
                orientation: 'landscape',
                filename: `puntos_venta_${Date.now()}.pdf`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Registro Manual
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
            No hay comprobantes de punto de venta registrados. Usa "Escanear Voucher IA" o "Registro Manual".
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-sky-400">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-extrabold">
                      {r.bankOrTerminal || 'POS'} • {r.operationType}
                    </p>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        r.transactionStatus === 'APROBADA'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                          : 'bg-rose-500/15 text-rose-500'
                      }`}
                    >
                      {r.transactionStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">
                    {r.transactionDateTime || formatDateOnly(r.transactionTimestamp)} • Ref: {r.referenceNumber || '—'} •
                    Aprob: {r.approvalNumber || '—'} {r.maskedCardNumber ? `• ${r.maskedCardNumber}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono-num text-base font-extrabold text-indigo-600 dark:text-sky-400">
                  {r.currency === 'USD' ? `$${r.totalAmount.toFixed(2)}` : `Bs. ${r.totalAmount.toFixed(2)}`}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md space-y-3 rounded-2xl border border-slate-700 bg-white p-5 shadow-2xl dark:bg-[#1E2D48]"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Registrar Voucher POS</h3>
              <button type="button" onClick={() => setShowAdd(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <input
                type="text"
                value={bankOrTerminal}
                onChange={(e) => setBankOrTerminal(e.target.value)}
                placeholder="Banco / Terminal"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
              <select
                value={transactionStatus}
                onChange={(e) => setTransactionStatus(e.target.value as any)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="APROBADA">APROBADA</option>
                <option value="PENDIENTE">PENDIENTE</option>
                <option value="RECHAZADA">RECHAZADA</option>
                <option value="ANULADA">ANULADA</option>
              </select>
              <input
                type="number"
                step="0.01"
                required
                value={totalAmountStr}
                onChange={(e) => setTotalAmountStr(e.target.value)}
                placeholder="Monto Total *"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'VES' | 'USD')}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="VES">Bolívares (VES)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="N° Referencia"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
              <input
                type="text"
                value={approvalNumber}
                onChange={(e) => setApprovalNumber(e.target.value)}
                placeholder="N° Aprobación"
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <input
              type="text"
              value={maskedCardNumber}
              onChange={(e) => setMaskedCardNumber(e.target.value)}
              placeholder="Tarjeta (ej: ****4821)"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-600 dark:bg-slate-900"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAdd(false)} className="px-3 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">
                Guardar Voucher
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
