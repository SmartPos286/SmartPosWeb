import React, { useState } from 'react';
import { Download, MessageCircle, Printer, Receipt, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { DeliveryNote, DeliveryNoteItem, Quote, QuoteItem, Sale, SaleItem } from '../types/models';
import { formatBs, formatDateOnly, formatDateTime, formatQty, formatUsd } from '../utils/currencyMath';
import {
  buildWhatsAppUrlForDeliveryNote,
  buildWhatsAppUrlForQuote,
  buildWhatsAppUrlForSale,
  renderSaleTicketCanvas,
} from '../utils/exports';

export type PrintableDocument =
  | { type: 'sale'; sale: Sale; items: SaleItem[] }
  | { type: 'quote'; quote: Quote; items: QuoteItem[] }
  | { type: 'delivery'; note: DeliveryNote; items: DeliveryNoteItem[] };

interface PrintTicketModalProps {
  doc: PrintableDocument | null;
  onClose: () => void;
}

export const PrintTicketModal: React.FC<PrintTicketModalProps> = ({ doc, onClose }) => {
  const { state, notify } = usePos();
  const [paperMode, setPaperMode] = useState<'80mm' | '58mm'>(state.settings.printerPaperWidth);

  if (!doc) return null;

  const handleDownloadPng = (format: 'square_whatsapp' | 'thermal_58' | 'thermal_80') => {
    if (doc.type !== 'sale') {
      window.print();
      return;
    }
    const canvas = renderSaleTicketCanvas({
      settings: state.settings,
      sale: doc.sale,
      items: doc.items,
      format,
    });
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket_smartpos286_${doc.sale.id}_${format}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    notify('Comprobante Descargado', 'Imagen PNG lista para compartir o imprimir.', 'success');
  };

  const whatsappUrl =
    doc.type === 'sale'
      ? buildWhatsAppUrlForSale(state.settings, doc.sale, doc.items)
      : doc.type === 'quote'
        ? buildWhatsAppUrlForQuote(state.settings, doc.quote, doc.items)
        : buildWhatsAppUrlForDeliveryNote(state.settings, doc.note, doc.items);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        {/* Header */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <Receipt className="h-5 w-5 text-indigo-600 dark:text-sky-400" />
            <div>
              <h3 className="text-base font-bold">
                {doc.type === 'sale'
                  ? `Comprobante de Venta #${doc.sale.id}`
                  : doc.type === 'quote'
                    ? `Presupuesto ${doc.quote.quoteNumber}`
                    : `Nota de Entrega ${doc.note.noteNumber}`}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Vista previa de impresión térmica y digital</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs dark:border-slate-600">
              {(['58mm', '80mm'] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPaperMode(w)}
                  className={`rounded-md px-2.5 py-1 font-bold ${
                    paperMode === w
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Receipt Body */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-5 dark:bg-slate-900/60">
          <div
            className={`print-only-container mx-auto rounded-xl border border-slate-300 bg-white p-5 font-mono-num text-xs text-slate-900 shadow-sm ${
              paperMode === '58mm' ? 'max-w-[300px]' : 'max-w-[400px]'
            }`}
          >
            <div className="border-b border-dashed border-slate-300 pb-3 text-center">
              {doc.type === 'sale' && (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                  {state.settings.isFiscalMode
                    ? `SENIAT - FACTURA FISCAL (${state.settings.fiscalPrinterBrand || 'FISCAL'})`
                    : 'SOLO USO INTERNO - NO VÁLIDO COMO FACTURA FISCAL'}
                </p>
              )}
              {doc.type === 'delivery' && (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                  NOTA DE ENTREGA • NO VÁLIDO PARA CRÉDITO FISCAL
                </p>
              )}
              {doc.type === 'quote' && (
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                  PRESUPUESTO / COTIZACIÓN COMERCIAL
                </p>
              )}
              <p className="text-base font-extrabold">{state.settings.storeName || 'SMARTPOS286'}</p>
              <p>RIF: {state.settings.storeRif || 'J-00000000-0'}</p>
              {state.settings.storeAddress && <p>{state.settings.storeAddress}</p>}
              {state.settings.storePhone && <p>Telf: {state.settings.storePhone}</p>}
            </div>

            {doc.type === 'sale' && (
              <>
                {doc.sale.status === 'DEVUELTA' && (
                  <div className="my-2 rounded-lg border border-rose-400 bg-rose-50 p-2 text-center text-[11px] font-extrabold text-rose-700">
                    <p>DEVOLUCIÓN EMITIDA</p>
                    {doc.sale.returnReason && <p className="font-normal">Motivo: {doc.sale.returnReason}</p>}
                    {(doc.sale.returnedBy || doc.sale.returnedAt) && (
                      <p className="text-[10px] font-normal">
                        {doc.sale.returnedBy ? `Por: ${doc.sale.returnedBy}` : ''}
                        {doc.sale.returnedAt ? ` • ${formatDateTime(doc.sale.returnedAt)}` : ''}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-0.5 border-b border-dashed border-slate-300 py-2.5">
                  <p>Fecha: {formatDateTime(doc.sale.timestamp)}</p>
                  <p className="font-bold">Factura N°: #{doc.sale.id}</p>
                  <p>
                    Caja: {doc.sale.cashRegisterNumber} • Cajero: {doc.sale.cashierName}
                  </p>
                  <p>Cliente: {doc.sale.customerName}</p>
                  <p>CI/RIF: {doc.sale.customerDocument}</p>
                </div>

                <div className="border-b border-dashed border-slate-300 py-2.5">
                  <div className="mb-1 flex justify-between font-bold">
                    <span>Cant / Descripción</span>
                    <span>Total Bs.</span>
                  </div>
                  {doc.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 py-0.5">
                      <span className="truncate">
                        {formatQty(item.quantity)}x {item.productName}
                        {item.isTaxExempt ? ' (E)' : ''}
                      </span>
                      <span className="shrink-0 font-semibold">
                        Bs. {(item.priceUsd * doc.sale.rateBcv * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1 py-2.5 text-right">
                  <p>Tasa BCV: Bs. {doc.sale.rateBcv.toFixed(2)}</p>
                  <p>Base Imponible (16%): {formatBs(doc.sale.baseTaxableUsd * doc.sale.rateBcv)}</p>
                  {doc.sale.discountUsd > 0.001 && (
                    <p className="text-emerald-700">
                      Descuento pre-IVA: -{formatBs(doc.sale.discountUsd * doc.sale.rateBcv)}
                    </p>
                  )}
                  {doc.sale.baseExemptUsd > 0.001 && (
                    <p>Monto Exento (0%): {formatBs(doc.sale.baseExemptUsd * doc.sale.rateBcv)}</p>
                  )}
                  <p>IVA (16%): {formatBs(doc.sale.ivaUsd * doc.sale.rateBcv)}</p>
                  {doc.sale.igtfUsd > 0.001 && (
                    <p>IGTF (3% Divisas): {formatBs(doc.sale.igtfBs || doc.sale.igtfUsd * doc.sale.rateBcv)}</p>
                  )}
                  <p className="pt-1 text-sm font-extrabold">
                    TOTAL: {formatBs(doc.sale.totalBs || doc.sale.totalUsd * doc.sale.rateBcv)}
                  </p>
                  <p className="text-[11px] text-slate-600">Ref. USD: {formatUsd(doc.sale.totalUsd)}</p>
                </div>
              </>
            )}

            {doc.type === 'quote' && (
              <>
                <div className="space-y-0.5 border-b border-dashed border-slate-300 py-2.5">
                  <p className="font-bold">Presupuesto: {doc.quote.quoteNumber}</p>
                  <p>Fecha: {formatDateTime(doc.quote.timestamp)}</p>
                  <p>Válido hasta: {formatDateOnly(doc.quote.validUntil)}</p>
                  <p>Cliente: {doc.quote.customerName}</p>
                  <p>CI/RIF: {doc.quote.customerDocument}</p>
                </div>
                <div className="border-b border-dashed border-slate-300 py-2.5">
                  {doc.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-2 py-0.5">
                      <span>
                        {formatQty(item.quantity)}x {item.productName}
                      </span>
                      <span className="font-semibold">{formatUsd(item.priceUsd * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 py-2.5 text-right">
                  <p>IVA (16%): {formatUsd(doc.quote.ivaUsd)}</p>
                  <p className="text-sm font-extrabold">TOTAL: {formatUsd(doc.quote.totalUsd)}</p>
                  <p className="text-[11px] text-slate-600">Equiv. Bs.: {formatBs(doc.quote.totalBs)}</p>
                  {doc.quote.notesOrConditions && (
                    <p className="pt-1 text-left text-[11px] text-slate-600">Notas: {doc.quote.notesOrConditions}</p>
                  )}
                </div>
              </>
            )}

            {doc.type === 'delivery' && (
              <>
                <div className="space-y-0.5 border-b border-dashed border-slate-300 py-2.5">
                  <p className="font-bold">Nota N°: {doc.note.noteNumber}</p>
                  <p>Fecha: {formatDateTime(doc.note.timestamp)}</p>
                  <p>Cliente: {doc.note.customerName}</p>
                  <p>CI/RIF: {doc.note.customerDocument}</p>
                  {doc.note.recipientName && <p>Recibe: {doc.note.recipientName}</p>}
                </div>
                <div className="border-b border-dashed border-slate-300 py-2.5">
                  {doc.items.map((item) => {
                    const useBs = doc.note.displayCurrency === 'BS';
                    const lineVal = item.priceUsd * item.quantity * (useBs ? doc.note.rateBcv : 1);
                    return (
                      <div key={item.id} className="flex justify-between gap-2 py-0.5">
                        <span>
                          {formatQty(item.quantity)}x {item.productName}
                        </span>
                        <span className="font-semibold">{useBs ? formatBs(lineVal) : formatUsd(lineVal)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1 py-2.5 text-right">
                  <p className="text-sm font-extrabold">
                    TOTAL:{' '}
                    {doc.note.displayCurrency === 'BS'
                      ? formatBs(doc.note.totalEstimatedBs)
                      : formatUsd(doc.note.totalEstimatedUsd)}
                  </p>
                  <div className="mt-6 grid grid-cols-2 gap-4 pt-4 text-center text-[10px]">
                    <div className="border-t border-slate-400 pt-1">Entregado Por</div>
                    <div className="border-t border-slate-400 pt-1">Recibido Conforme</div>
                  </div>
                </div>
              </>
            )}

            <p className="mt-2 border-t border-dashed border-slate-300 pt-2 text-center text-[11px] text-slate-500">
              ¡Gracias por su preferencia! • SmartPOS286
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="no-print flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
          {doc.type === 'sale' && (
            <button
              type="button"
              onClick={() => handleDownloadPng('square_whatsapp')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-indigo-500/40 bg-indigo-50 px-3.5 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              <Download className="h-4 w-4" />
              PNG Cuadrado
            </button>
          )}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
};
