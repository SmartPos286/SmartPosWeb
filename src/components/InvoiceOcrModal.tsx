import React, { useState } from 'react';
import { Check, FileSpreadsheet, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import { formatUsd, round2 } from '../utils/currencyMath';

interface OcrLineItem {
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  salePriceUsd: number;
  matchedProductId: number | null;
}

export const InvoiceOcrModal: React.FC = () => {
  const {
    state,
    isOcrModalOpen,
    setIsOcrModalOpen,
    saveSupplier,
    createPurchaseInvoice,
    saveProduct,
    notify,
  } = usePos();

  const [isScanning, setIsScanning] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierDoc, setSupplierDoc] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [rateUsed, setRateUsed] = useState(String(state.settings.bcvRate || 54.85));
  const [ivaPercent, setIvaPercent] = useState('16');
  const [includeIvaInCost, setIncludeIvaInCost] = useState(false);
  const [items, setItems] = useState<OcrLineItem[]>([]);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOcrModalOpen) return null;

  const rateNum = Math.max(0.01, Number(rateUsed) || state.settings.bcvRate || 1);
  const marginMult = state.settings.isMinProfitMarginEnabled
    ? 1 + (state.settings.minProfitMarginPercent || 30) / 100
    : 1.3;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');
    setIsScanning(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/gemini/invoice-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type || 'image/jpeg' }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error procesando la factura con IA.');
      }

      const detectedCurrency: 'USD' | 'VES' = data.currency === 'VES' ? 'VES' : 'USD';
      const detectedIva = Number(data.ivaPercentage ?? 16);
      setSupplierName(data.supplierName || '');
      setSupplierDoc(data.supplierDocumentId || '');
      setInvoiceNumber(data.invoiceNumber || `FAC-${Date.now().toString().slice(-5)}`);
      setCurrency(detectedCurrency);
      setIvaPercent(String(Number.isFinite(detectedIva) ? detectedIva : 16));

      const extracted = Array.isArray(data.items) ? data.items : [];
      setItems(
        extracted.map((it: any) => {
          const rawUnit = Number(it.unitCost) || 0;
          const unitUsd = detectedCurrency === 'VES' ? rawUnit / rateNum : rawUnit;
          const matched = state.products.find(
            (p) =>
              (it.code && p.code.toLowerCase() === String(it.code).toLowerCase()) ||
              p.name.toLowerCase().includes(String(it.name || '').toLowerCase().slice(0, 12))
          );
          return {
            code: String(it.code || '').trim(),
            name: String(it.name || 'Producto Factura').trim(),
            quantity: Math.max(0.01, Number(it.quantity) || 1),
            unitCost: round2(rawUnit),
            salePriceUsd: matched ? matched.priceUsd : round2(unitUsd * marginMult),
            matchedProductId: matched?.id ?? null,
          };
        })
      );
      notify('Factura Escaneada', `Se detectaron ${extracted.length} renglones.`, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error leyendo factura.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmImport = () => {
    if (items.length === 0) return;
    const ivaFactor = includeIvaInCost ? 1 + (Number(ivaPercent) || 0) / 100 : 1;

    // Find or create supplier
    let supplier = state.suppliers.find(
      (s) =>
        (supplierDoc && s.documentId.toLowerCase() === supplierDoc.toLowerCase()) ||
        (supplierName && s.name.toLowerCase() === supplierName.toLowerCase())
    );
    if (!supplier) {
      supplier = saveSupplier({
        name: supplierName.trim() || 'Proveedor OCR',
        documentId: supplierDoc.trim() || 'J-00000000-0',
        phone: '',
        address: '',
      });
    }

    let subtotalUsd = 0;
    for (const it of items) {
      const unitUsd = currency === 'VES' ? it.unitCost / rateNum : it.unitCost;
      const finalUnitCost = round2(unitUsd * ivaFactor);
      subtotalUsd += round2(finalUnitCost * it.quantity);

      const existing = it.matchedProductId
        ? state.products.find((p) => p.id === it.matchedProductId)
        : undefined;

      if (existing) {
        saveProduct({
          ...existing,
          stock: round2(existing.stock + it.quantity),
          costPriceUsd: finalUnitCost > 0 ? finalUnitCost : existing.costPriceUsd,
          priceUsd: it.salePriceUsd > 0 ? it.salePriceUsd : existing.priceUsd,
          invoiceNumber: invoiceNumber || existing.invoiceNumber,
        });
      } else {
        saveProduct({
          code: it.code || `OCR-${Date.now().toString().slice(-4)}`,
          name: it.name,
          category: 'General',
          priceUsd: it.salePriceUsd > 0 ? it.salePriceUsd : round2(finalUnitCost * marginMult),
          stock: it.quantity,
          costPriceUsd: finalUnitCost,
          invoiceNumber: invoiceNumber || '',
          isTaxExempt: Number(ivaPercent) === 0,
          hasCommission: false,
          commissionPercentage: 0,
          commissionAmountUsd: 0,
          isRecipe: false,
          isCombo: false,
          comboItemsJson: '',
          allowDecimalQuantity: false,
          isPriceModifiable: false,
          wholesalePriceUsd: 0,
          aisleNumber: '',
          aisleQuantity: 0,
          depotQuantity: 0,
          counterQuantity: 0,
          minStockAlertQuantity: 5,
          isLowStockAlertEnabled: true,
        });
      }
    }

    const ivaAmt = includeIvaInCost ? 0 : round2(subtotalUsd * ((Number(ivaPercent) || 0) / 100));
    createPurchaseInvoice({
      supplierId: supplier.id,
      invoiceNumber: invoiceNumber || `FAC-${Date.now().toString().slice(-5)}`,
      timestamp: Date.now(),
      totalAmount: round2(subtotalUsd + ivaAmt),
      description: `Importada vía OCR IA (${items.length} productos)`,
      isPaid: false,
      paidTimestamp: 0,
      dueDate: 0,
      paymentNotes: '',
      subtotalUsd: round2(subtotalUsd),
      taxAmountUsd: ivaAmt,
      retencionIvaUsd: 0,
      retencionIvaPercentage: 0,
      retencionIslrUsd: 0,
      retencionIslrPercentage: 0,
      withholdingVoucherNumber: '',
      withholdingStatus: 'NO_APLICA',
    });

    notify('Compra e Inventario Actualizados', `Se ingresaron ${items.length} productos desde la factura.`, 'success');
    setIsOcrModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-sky-500" />
            <div>
              <h3 className="text-base font-bold">Importar Factura de Compra con IA (OCR)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sube una foto o captura de la factura para cargar stock y costos automáticamente
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOcrModalOpen(false)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sky-500/40 bg-sky-500/5 p-5 text-center transition hover:bg-sky-500/10">
            {isScanning ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin text-sky-500" />
                <span className="font-bold text-sky-600 dark:text-sky-300">
                  Analizando factura con Gemini Vision...
                </span>
              </>
            ) : (
              <>
                <Upload className="h-7 w-7 text-sky-500" />
                <span className="font-bold">Haz clic para seleccionar imagen de factura (JPG/PNG)</span>
                <span className="text-slate-500 dark:text-slate-400">
                  Detecta proveedor, RIF, número, moneda (USD/Bs.) y renglones
                </span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={isScanning} />
          </label>

          {errorMsg && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 font-semibold text-rose-600 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold">Proveedor</label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">RIF Proveedor</label>
              <input
                type="text"
                value={supplierDoc}
                onChange={(e) => setSupplierDoc(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">N° Factura</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block font-bold">Moneda Factura</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as 'USD' | 'VES')}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              >
                <option value="USD">Dólares ($ USD)</option>
                <option value="VES">Bolívares (Bs.)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block font-bold">Tasa BCV Ref.</label>
              <input
                type="number"
                step="0.01"
                value={rateUsed}
                onChange={(e) => setRateUsed(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">IVA (%)</label>
              <input
                type="number"
                value={ivaPercent}
                onChange={(e) => setIvaPercent(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <label className="flex items-center gap-2 pt-5 font-semibold">
              <input
                type="checkbox"
                checked={includeIvaInCost}
                onChange={(e) => setIncludeIvaInCost(e.target.checked)}
                className="h-4 w-4 rounded accent-indigo-600"
              />
              <span>Sumar IVA al costo</span>
            </label>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                Productos Detectados ({items.length})
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[11px] uppercase dark:bg-slate-800">
                    <tr>
                      <th className="p-2.5">Producto</th>
                      <th className="p-2.5">Cant.</th>
                      <th className="p-2.5">Costo ({currency})</th>
                      <th className="p-2.5">PVP Venta ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <input
                            type="text"
                            value={it.name}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x))
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-900"
                          />
                        </td>
                        <td className="w-20 p-2">
                          <input
                            type="number"
                            value={it.quantity}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x))
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                          />
                        </td>
                        <td className="w-28 p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={it.unitCost}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x, i) => (i === idx ? { ...x, unitCost: Number(e.target.value) || 0 } : x))
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                          />
                        </td>
                        <td className="w-28 p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={it.salePriceUsd}
                            onChange={(e) =>
                              setItems((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, salePriceUsd: Number(e.target.value) || 0 } : x
                                )
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                Total estimado compra:{' '}
                {formatUsd(
                  items.reduce(
                    (s, it) => s + (currency === 'VES' ? it.unitCost / rateNum : it.unitCost) * it.quantity,
                    0
                  )
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setIsOcrModalOpen(false)}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={items.length === 0}
            onClick={handleConfirmImport}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Check className="h-4 w-4" />
            Guardar Compra e Inventario
          </button>
        </div>
      </div>
    </div>
  );
};
