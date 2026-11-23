import React, { useState } from 'react';
import { CheckCircle2, FileCheck2, FileText } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatDateOnly, formatDateTime, formatUsd, round2 } from '../utils/currencyMath';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const WithholdingsScreen: React.FC = () => {
  const { state, updateSaleWithholdingVoucher, updatePurchaseWithholdingVoucher } = usePos();
  const [tab, setTab] = useState<'ventas' | 'compras'>('ventas');
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editingPurchId, setEditingPurchId] = useState<number | null>(null);
  const [voucherInput, setVoucherInput] = useState('');

  const retainedSales = state.sales.filter(
    (s) => s.status !== 'DEVUELTA' && (s.retencionIvaUsd > 0.001 || s.retencionIslrUsd > 0.001)
  );
  const retainedPurchases = state.purchaseInvoices.filter(
    (p) => p.retencionIvaUsd > 0.001 || p.retencionIslrUsd > 0.001
  );

  const totalSalesRet = round2(
    retainedSales.reduce((acc, s) => acc + s.retencionIvaUsd + s.retencionIslrUsd, 0)
  );
  const totalPurchRet = round2(
    retainedPurchases.reduce((acc, p) => acc + p.retencionIvaUsd + p.retencionIslrUsd, 0)
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Retenciones Aplicadas por Clientes (Ventas)</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-indigo-600 dark:text-sky-400">
            {formatUsd(totalSalesRet)}
          </p>
          <p className="text-xs text-slate-500">{retainedSales.length} factura(s) con retención</p>
        </div>
        <div className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]">
          <p className="text-xs font-bold text-slate-500">Retenciones Practicadas a Proveedores (Compras)</p>
          <p className="font-mono-num mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            {formatUsd(totalPurchRet)}
          </p>
          <p className="text-xs text-slate-500">{retainedPurchases.length} factura(s) de compra</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-slate-300/70 bg-white/85 p-1 text-xs font-bold sm:w-fit dark:border-slate-700 dark:bg-[#1E2D48]">
          <button
            type="button"
            onClick={() => setTab('ventas')}
            className={`rounded-lg px-4 py-2 ${tab === 'ventas' ? 'bg-indigo-600 text-white' : ''}`}
          >
            En Ventas ({retainedSales.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('compras')}
            className={`rounded-lg px-4 py-2 ${tab === 'compras' ? 'bg-indigo-600 text-white' : ''}`}
          >
            A Proveedores ({retainedPurchases.length})
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            if (tab === 'ventas') {
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Reporte de Retenciones SENIAT en Ventas',
                subtitle: `${retainedSales.length} factura(s) con retención`,
                columns: ['Factura', 'Fecha', 'Cliente', 'RIF/CI', 'Ret. IVA', 'Ret. ISLR', 'Comprobante', 'Estado'],
                rows: retainedSales.map((s) => [
                  `#${s.id}`,
                  formatDateTime(s.timestamp),
                  s.customerName,
                  s.customerDocument,
                  formatUsd(s.retencionIvaUsd),
                  formatUsd(s.retencionIslrUsd),
                  s.withholdingVoucherNumber || 'Pendiente',
                  s.withholdingStatus,
                ]),
                summaryLines: [`Total Retenido en Ventas: ${formatUsd(totalSalesRet)}`],
                orientation: 'landscape',
                filename: `retenciones_ventas_${Date.now()}.pdf`,
              });
            } else {
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Reporte de Retenciones SENIAT a Proveedores',
                subtitle: `${retainedPurchases.length} factura(s) de compra con retención`,
                columns: ['Factura Compra', 'Fecha', 'Proveedor', 'Ret. IVA', 'Ret. ISLR', 'Comprobante', 'Estado'],
                rows: retainedPurchases.map((p) => {
                  const supp = state.suppliers.find((x) => x.id === p.supplierId);
                  return [
                    `#${p.invoiceNumber}`,
                    formatDateOnly(p.timestamp),
                    supp?.name ?? 'Proveedor',
                    formatUsd(p.retencionIvaUsd),
                    formatUsd(p.retencionIslrUsd),
                    p.withholdingVoucherNumber || 'Pendiente',
                    p.withholdingStatus,
                  ];
                }),
                summaryLines: [`Total Retenido a Proveedores: ${formatUsd(totalPurchRet)}`],
                orientation: 'landscape',
                filename: `retenciones_compras_${Date.now()}.pdf`,
              });
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
        >
          <FileText className="h-4 w-4" />
          Exportar PDF
        </button>
      </div>

      {tab === 'ventas' ? (
        <div className="space-y-3">
          {retainedSales.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
              No hay retenciones registradas en ventas. Configura un cliente como Agente Especial SENIAT en el módulo Clientes.
            </div>
          ) : (
            retainedSales.map((s) => (
              <div
                key={s.id}
                className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <FileCheck2 className="mt-0.5 h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-sm font-extrabold">
                        Factura #{s.id} • {s.customerName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.customerDocument} • {formatDateTime(s.timestamp)}
                      </p>
                      <p className="font-mono-num mt-1 text-xs">
                        Ret. IVA ({s.retencionIvaPercentage}%): <strong>{formatUsd(s.retencionIvaUsd)}</strong> • Ret. ISLR ({s.retencionIslrPercentage}%): <strong>{formatUsd(s.retencionIslrUsd)}</strong>
                      </p>
                      {s.withholdingVoucherNumber && (
                        <p className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Comprobante N°: {s.withholdingVoucherNumber}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${
                      s.withholdingStatus === 'COMPROBANTE_RECIBIDO'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                    }`}
                  >
                    {s.withholdingStatus === 'COMPROBANTE_RECIBIDO' ? 'COMPROBANTE RECIBIDO' : 'PENDIENTE COMPROBANTE'}
                  </span>
                </div>

                {editingSaleId === s.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={voucherInput}
                      onChange={(e) => setVoucherInput(e.target.value)}
                      placeholder="N° Comprobante SENIAT (ej: 20250400001234)"
                      className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateSaleWithholdingVoucher(s.id, voucherInput, 'COMPROBANTE_RECIBIDO');
                        setEditingSaleId(null);
                      }}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      Guardar
                    </button>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSaleId(s.id);
                        setVoucherInput(s.withholdingVoucherNumber || '');
                      }}
                      className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Registrar Comprobante
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {retainedPurchases.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-xs text-slate-500 dark:border-slate-700">
              No hay retenciones registradas en facturas de compra.
            </div>
          ) : (
            retainedPurchases.map((p) => {
              const supp = state.suppliers.find((x) => x.id === p.supplierId);
              return (
                <div
                  key={p.id}
                  className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-extrabold">
                        Compra #{p.invoiceNumber} • {supp?.name ?? 'Proveedor'}
                      </p>
                      <p className="text-xs text-slate-500">{formatDateOnly(p.timestamp)}</p>
                      <p className="font-mono-num mt-1 text-xs">
                        Ret. IVA ({p.retencionIvaPercentage}%): <strong>{formatUsd(p.retencionIvaUsd)}</strong> • Ret. ISLR ({p.retencionIslrPercentage}%): <strong>{formatUsd(p.retencionIslrUsd)}</strong>
                      </p>
                      {p.withholdingVoucherNumber && (
                        <p className="mt-1 text-xs font-bold text-emerald-500">
                          Comprobante: {p.withholdingVoucherNumber}
                        </p>
                      )}
                    </div>
                    <span className="rounded-lg bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                      {p.withholdingStatus}
                    </span>
                  </div>

                  {editingPurchId === p.id ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={voucherInput}
                        onChange={(e) => setVoucherInput(e.target.value)}
                        placeholder="N° Comprobante Enterado"
                        className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          updatePurchaseWithholdingVoucher(p.id, voucherInput, 'ENTERADO_SENIAT');
                          setEditingPurchId(null);
                        }}
                        className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Marcar Enterado
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPurchId(p.id);
                          setVoucherInput(p.withholdingVoucherNumber || '');
                        }}
                        className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Actualizar Comprobante SENIAT
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
