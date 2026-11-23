import type {
  CasheaSettlement,
  DeliveryNote,
  DeliveryNoteItem,
  Expense,
  PosTerminalRecord,
  PurchaseInvoice,
  Quote,
  QuoteItem,
  Sale,
  SaleItem,
  StoreSettings,
  Supplier,
} from '../types/models';
import { formatDateOnly, formatDateTime, formatQty, round2 } from './currencyMath';

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes(',')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function generateAccountingLedgerCsv(params: {
  settings: StoreSettings;
  sales: Sale[];
  purchaseInvoices: PurchaseInvoice[];
  suppliers: Supplier[];
  expenses: Expense[];
  casheaSettlements: CasheaSettlement[];
  periodLabel: string;
}): string {
  const { settings, sales, purchaseInvoices, suppliers, expenses, casheaSettlements, periodLabel } = params;
  const lines: string[] = [];
  const rateDefault = settings.bcvRate > 0 ? settings.bcvRate : 1;

  lines.push(`LIBRO CONTABLE CONSOLIDADO (BOLÍVARES Bs.) - ${csvCell(settings.storeName)}`);
  lines.push(`RIF: ${csvCell(settings.storeRif)};Período: ${csvCell(periodLabel)};Generado: ${csvCell(formatDateTime(Date.now()))}`);
  lines.push('');

  // 1. Ventas
  lines.push('1. LIBRO DE VENTAS FISCALES (Bs.)');
  lines.push('N° Factura;Fecha;Cliente;CI/RIF;Estado;Tasa BCV;Base Imponible Bs.;Exento Bs.;IVA 16% Bs.;IGTF 3% Bs.;Ret. IVA Bs.;Ret. ISLR Bs.;Total Factura Bs.');
  let totalSalesBs = 0;
  let totalIvaSalesBs = 0;
  for (const s of sales) {
    const r = s.rateBcv > 0 ? s.rateBcv : rateDefault;
    const isReturned = s.status === 'DEVUELTA';
    const baseTaxBs = round2(s.baseTaxableUsd * r);
    const baseExBs = round2(s.baseExemptUsd * r);
    const ivaBs = round2(s.ivaUsd * r);
    const igtfBs = round2(s.igtfBs > 0 ? s.igtfBs : s.igtfUsd * r);
    const retIvaBs = round2(s.retencionIvaUsd * r);
    const retIslrBs = round2(s.retencionIslrUsd * r);
    const totBs = round2(s.totalBs > 0 ? s.totalBs : s.totalUsd * r);
    if (!isReturned) {
      totalSalesBs += totBs;
      totalIvaSalesBs += ivaBs;
    }
    lines.push(
      [
        s.id,
        formatDateTime(s.timestamp),
        s.customerName,
        s.customerDocument,
        isReturned ? `DEVUELTA${s.returnReason ? ` (${s.returnReason})` : ''}` : 'ACTIVA',
        r.toFixed(2),
        baseTaxBs.toFixed(2),
        baseExBs.toFixed(2),
        ivaBs.toFixed(2),
        igtfBs.toFixed(2),
        retIvaBs.toFixed(2),
        retIslrBs.toFixed(2),
        totBs.toFixed(2),
      ]
        .map(csvCell)
        .join(';')
    );
  }
  lines.push(`TOTAL VENTAS ACTIVAS;;;;;;;;;;IVA Débito Fiscal:;${totalIvaSalesBs.toFixed(2)};${totalSalesBs.toFixed(2)}`);
  lines.push('');

  // 2. Compras
  lines.push('2. LIBRO DE COMPRAS Y PROVEEDORES (Bs.)');
  lines.push('Fecha;N° Factura;Proveedor;RIF;Subtotal Bs.;IVA Crédito Bs.;Ret. IVA Bs.;Ret. ISLR Bs.;Total Compra Bs.;Estado');
  let totalPurchasesBs = 0;
  for (const inv of purchaseInvoices) {
    const supp = suppliers.find((x) => x.id === inv.supplierId);
    const subBs = round2((inv.subtotalUsd > 0 ? inv.subtotalUsd : inv.totalAmount) * rateDefault);
    const taxBs = round2(inv.taxAmountUsd * rateDefault);
    const retIvaBs = round2(inv.retencionIvaUsd * rateDefault);
    const retIslrBs = round2(inv.retencionIslrUsd * rateDefault);
    const totBs = round2(inv.totalAmount * rateDefault);
    totalPurchasesBs += totBs;
    lines.push(
      [
        formatDateOnly(inv.timestamp),
        inv.invoiceNumber,
        supp?.name ?? 'Proveedor',
        supp?.documentId ?? '',
        subBs.toFixed(2),
        taxBs.toFixed(2),
        retIvaBs.toFixed(2),
        retIslrBs.toFixed(2),
        totBs.toFixed(2),
        inv.isPaid ? 'PAGADA' : 'PENDIENTE',
      ]
        .map(csvCell)
        .join(';')
    );
  }
  lines.push(`TOTAL COMPRAS;;;;;;;;${totalPurchasesBs.toFixed(2)};`);
  lines.push('');

  // 3. Gastos
  lines.push('3. EGRESOS Y GASTOS OPERATIVOS (Bs.)');
  lines.push('Fecha;Categoría;Comprobante;Método;Descripción;Tasa Ref.;Monto Bs.');
  let totalExpensesBs = 0;
  for (const e of expenses) {
    const r = e.bcvRateUsed > 0 ? e.bcvRateUsed : rateDefault;
    const bs = round2(e.amountBs > 0 ? e.amountBs : e.amountUsd * r);
    totalExpensesBs += bs;
    lines.push(
      [
        formatDateTime(e.timestamp),
        e.category,
        e.invoiceNumber,
        e.paymentMethod,
        e.description,
        r.toFixed(2),
        bs.toFixed(2),
      ]
        .map(csvCell)
        .join(';')
    );
  }
  lines.push(`TOTAL GASTOS;;;;;;${totalExpensesBs.toFixed(2)}`);
  lines.push('');

  // 4. Liquidaciones Cashea
  lines.push('4. LIQUIDACIONES CASHEA (Bs.)');
  lines.push('Fecha;Bruto Bs.;Comisión %;Comisión Bs.;Neto Recibido Bs.;Notas');
  for (const c of casheaSettlements) {
    const r = c.rateBcv > 0 ? c.rateBcv : rateDefault;
    lines.push(
      [
        formatDateOnly(c.settlementDate),
        round2(c.grossAmountUsd * r).toFixed(2),
        `${c.commissionPercentage.toFixed(2)}%`,
        round2(c.commissionAmountUsd * r).toFixed(2),
        round2(c.netReceivedUsd * r).toFixed(2),
        c.notes,
      ]
        .map(csvCell)
        .join(';')
    );
  }
  lines.push('');

  // 5. Resumen
  const netResultBs = round2(totalSalesBs - totalPurchasesBs - totalExpensesBs);
  lines.push('5. RESUMEN FINANCIERO DEL PERÍODO (Bs.)');
  lines.push(`Total Ingresos Ventas Bs.;${totalSalesBs.toFixed(2)}`);
  lines.push(`Total Compras Mercancía Bs.;${totalPurchasesBs.toFixed(2)}`);
  lines.push(`Total Gastos Operativos Bs.;${totalExpensesBs.toFixed(2)}`);
  lines.push(`Resultado Neto Operativo Bs.;${netResultBs.toFixed(2)}`);

  return '\uFEFF' + lines.join('\n');
}

export function generatePosTerminalCsv(records: PosTerminalRecord[]): string {
  const header = [
    'ID',
    'FechaHora',
    'BancoTerminal',
    'TipoOperacion',
    'Recibo',
    'Referencia',
    'Aprobacion',
    'Tarjeta',
    'Moneda',
    'Monto',
    'Estado',
    'Notas',
  ].join(';');

  const rows = records.map((r) =>
    [
      r.id,
      r.transactionDateTime || formatDateTime(r.transactionTimestamp),
      r.bankOrTerminal,
      r.operationType,
      r.receiptNumber,
      r.referenceNumber,
      r.approvalNumber,
      r.maskedCardNumber,
      r.currency,
      r.totalAmount.toFixed(2),
      r.transactionStatus,
      r.notes,
    ]
      .map(csvCell)
      .join(';')
  );

  return '\uFEFF' + [header, ...rows].join('\n');
}

export function renderSaleTicketCanvas(params: {
  settings: StoreSettings;
  sale: Sale;
  items: SaleItem[];
  format: 'square_whatsapp' | 'thermal_58' | 'thermal_80';
}): HTMLCanvasElement {
  const { settings, sale, items, format } = params;
  const rate = sale.rateBcv > 0.001 ? sale.rateBcv : 1;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  if (format === 'square_whatsapp') {
    const width = 800;
    const height = Math.max(820, 580 + items.length * 44);
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Card
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, 20, width - 40, height - 40, 20);
    ctx.fill();
    ctx.stroke();

    // Non-fiscal banner
    let y = 46;
    ctx.fillStyle = settings.isFiscalMode ? '#ECFDF5' : '#FEF2F2';
    ctx.strokeStyle = settings.isFiscalMode ? '#6EE7B7' : '#FCA5A5';
    ctx.beginPath();
    ctx.roundRect(40, y, width - 80, 42, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = sale.status === 'DEVUELTA' ? '#991B1B' : settings.isFiscalMode ? '#065F46' : '#991B1B';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      sale.status === 'DEVUELTA'
        ? 'DEVOLUCIÓN EMITIDA - REGISTRO HISTÓRICO'
        : settings.isFiscalMode
          ? `SENIAT - FACTURA FISCAL (${settings.fiscalPrinterBrand || 'FISCAL'})`
          : 'DOCUMENTO NO VÁLIDO COMO FACTURA FISCAL',
      width / 2,
      y + 27
    );

    y += 68;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText((settings.storeName || 'MI COMERCIO POS').slice(0, 28), 46, y + 24);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(`RIF: ${settings.storeRif || 'J-00000000-0'}`, 46, y + 50);
    if (settings.storeAddress) ctx.fillText(settings.storeAddress.slice(0, 42), 46, y + 72);
    if (settings.storePhone) ctx.fillText(`Telf: ${settings.storePhone}`, 46, y + 94);

    // Meta box
    y += 120;
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.roundRect(40, y, width - 80, 56, 10);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Ticket N°: #${sale.id}`, 54, y + 23);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(`Fecha: ${formatDateTime(sale.timestamp)}`, 54, y + 43);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`Cliente: ${(sale.customerName || 'Consumidor Final').slice(0, 24)}`, width - 54, y + 23);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#64748B';
    ctx.fillText(`CI/RIF: ${sale.customerDocument || 'V-00000000'}`, width - 54, y + 43);

    y += 74;
    // Table Header
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.roundRect(40, y, width - 80, 40, 8);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Producto', 54, y + 26);
    ctx.textAlign = 'center';
    ctx.fillText('Cant.', 390, y + 26);
    ctx.textAlign = 'right';
    ctx.fillText('P. Unit (Sin IVA)', 575, y + 26);
    ctx.fillText('Total Bs.', width - 54, y + 26);

    y += 50;
    for (const item of items) {
      const unitBs = item.priceUsd * rate;
      const unitNoIvaBs = item.isTaxExempt ? unitBs : unitBs / 1.16;
      const lineBs = unitBs * item.quantity;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${item.productName.slice(0, 24)}${item.isTaxExempt ? ' (E)' : ''}`, 54, y + 24);
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatQty(item.quantity), 390, y + 24);
      ctx.textAlign = 'right';
      ctx.fillText(`Bs. ${unitNoIvaBs.toFixed(2)}`, 575, y + 24);
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`Bs. ${lineBs.toFixed(2)}`, width - 54, y + 24);
      y += 40;
      ctx.strokeStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(width - 40, y);
      ctx.stroke();
      y += 4;
    }

    y += 22;
    ctx.textAlign = 'right';
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(`Base Imponible (Sin IVA): Bs. ${(sale.baseTaxableUsd * rate).toFixed(2)}`, width - 54, y);
    y += 22;
    if (sale.discountUsd > 0.001) {
      ctx.fillStyle = '#059669';
      ctx.fillText(`Descuento (Pre-IVA): -Bs. ${(sale.discountUsd * rate).toFixed(2)}`, width - 54, y);
      y += 22;
      ctx.fillStyle = '#475569';
    }
    if (sale.baseExemptUsd > 0.001) {
      ctx.fillText(`Monto Exento (0%): Bs. ${(sale.baseExemptUsd * rate).toFixed(2)}`, width - 54, y);
      y += 22;
    }
    ctx.fillText(`IVA (16%): Bs. ${(sale.ivaUsd * rate).toFixed(2)}`, width - 54, y);
    y += 24;
    if (sale.igtfUsd > 0.001) {
      ctx.fillText(`IGTF (3% Divisas): Bs. ${(sale.igtfUsd * rate).toFixed(2)}`, width - 54, y);
      y += 24;
    }

    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(width - 410, y, 370, 52, 12);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`TOTAL: Bs. ${(sale.totalBs > 0 ? sale.totalBs : sale.totalUsd * rate).toFixed(2)}`, width - 58, y + 33);
    y += 72;
    ctx.fillStyle = '#64748B';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Equivalente USD (Tasa BCV ${rate.toFixed(2)}): $${sale.totalUsd.toFixed(2)}`, width - 54, y);

    return canvas;
  }

  // Thermal 58mm / 80mm
  const is80 = format === 'thermal_80';
  const width = is80 ? 576 : 384;
  const lineH = is80 ? 24 : 20;
  const height = Math.max(520, 480 + items.length * lineH);
  canvas.width = width;
  canvas.height = height;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#000000';

  const pad = is80 ? 24 : 16;
  const center = width / 2;
  let y = is80 ? 36 : 30;

  ctx.textAlign = 'center';
  ctx.font = `bold ${is80 ? 13 : 11}px monospace`;
  ctx.fillText(
    sale.status === 'DEVUELTA'
      ? 'DEVOLUCIÓN EMITIDA'
      : settings.isFiscalMode
        ? `SENIAT - FACTURA FISCAL`
        : 'SOLO USO INTERNO - NO FISCAL',
    center,
    y
  );
  y += lineH + 4;
  ctx.font = `bold ${is80 ? 20 : 16}px monospace`;
  ctx.fillText(settings.storeName || 'SMARTPOS286', center, y);
  y += lineH;
  ctx.font = `${is80 ? 14 : 12}px monospace`;
  ctx.fillText(`RIF: ${settings.storeRif || 'J-00000000-0'}`, center, y);
  y += lineH;

  ctx.textAlign = 'left';
  ctx.fillText(`Fecha: ${formatDateTime(sale.timestamp)}`, pad, y);
  y += lineH;
  ctx.font = `bold ${is80 ? 14 : 12}px monospace`;
  ctx.fillText(`Factura N°: #${sale.id}`, pad, y);
  y += lineH;
  ctx.font = `${is80 ? 14 : 12}px monospace`;
  ctx.fillText(`Cliente: ${sale.customerName}`, pad, y);
  y += lineH;
  ctx.fillText(`CI/RIF: ${sale.customerDocument}`, pad, y);
  y += lineH;

  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += lineH;

  for (const item of items) {
    const label = `${formatQty(item.quantity)}x ${item.productName}${item.isTaxExempt ? ' (E)' : ''}`.slice(0, is80 ? 30 : 20);
    const totalBs = (item.priceUsd * rate * item.quantity).toFixed(2);
    ctx.textAlign = 'left';
    ctx.fillText(label, pad, y);
    ctx.textAlign = 'right';
    ctx.fillText(`Bs.${totalBs}`, width - pad, y);
    y += lineH;
  }

  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(width - pad, y);
  ctx.stroke();
  y += lineH;

  ctx.textAlign = 'right';
  ctx.fillText(`Tasa BCV: Bs. ${rate.toFixed(2)}`, width - pad, y);
  y += lineH;
  ctx.fillText(`IVA (16%): Bs. ${(sale.ivaUsd * rate).toFixed(2)}`, width - pad, y);
  y += lineH;
  ctx.font = `bold ${is80 ? 17 : 14}px monospace`;
  ctx.fillText(`TOTAL: Bs. ${(sale.totalBs > 0 ? sale.totalBs : sale.totalUsd * rate).toFixed(2)}`, width - pad, y);
  y += lineH + 8;
  ctx.textAlign = 'center';
  ctx.font = `${is80 ? 13 : 11}px monospace`;
  ctx.fillText('¡Gracias por su compra!', center, y);

  return canvas;
}

export function buildWhatsAppUrlForSale(settings: StoreSettings, sale: Sale, items: SaleItem[], phone?: string): string {
  const rate = sale.rateBcv > 0.001 ? sale.rateBcv : 1;
  const totalBs = sale.totalBs > 0 ? sale.totalBs : sale.totalUsd * rate;
  const lines = [
    `*${settings.storeName || 'SmartPOS286'}*`,
    `RIF: ${settings.storeRif}`,
    `Comprobante N° #${sale.id}`,
    sale.status === 'DEVUELTA' ? `*ESTADO: DEVOLUCIÓN EMITIDA*` : '',
    sale.status === 'DEVUELTA' && sale.returnReason ? `Motivo devolución: ${sale.returnReason}` : '',
    `Fecha: ${formatDateTime(sale.timestamp)}`,
    `Cliente: ${sale.customerName} (${sale.customerDocument})`,
    '',
    ...items.map((it) => `• ${formatQty(it.quantity)}x ${it.productName}: Bs. ${(it.priceUsd * rate * it.quantity).toFixed(2)}`),
    '',
    `IVA (16%): Bs. ${(sale.ivaUsd * rate).toFixed(2)}`,
    sale.igtfUsd > 0.001 ? `IGTF (3%): Bs. ${(sale.igtfUsd * rate).toFixed(2)}` : '',
    `*TOTAL: Bs. ${totalBs.toFixed(2)}* ($${sale.totalUsd.toFixed(2)} USD)`,
    '',
    'Documento no válido como factura fiscal.',
  ].filter(Boolean);

  const cleanPhone = (phone || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(lines.join('\n'));
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildWhatsAppUrlForQuote(settings: StoreSettings, quote: Quote, items: QuoteItem[]): string {
  const lines = [
    `*PRESUPUESTO ${quote.quoteNumber}*`,
    `*${settings.storeName || 'SmartPOS286'}*`,
    `Cliente: ${quote.customerName} (${quote.customerDocument})`,
    `Válido hasta: ${formatDateOnly(quote.validUntil)}`,
    '',
    ...items.map((it) => `• ${formatQty(it.quantity)}x ${it.productName}: $${(it.priceUsd * it.quantity).toFixed(2)}`),
    '',
    `*TOTAL: $${quote.totalUsd.toFixed(2)} USD* (Bs. ${quote.totalBs.toFixed(2)})`,
    quote.notesOrConditions ? `Condiciones: ${quote.notesOrConditions}` : '',
  ].filter(Boolean);

  const cleanPhone = (quote.customerPhone || '').replace(/\D/g, '');
  const encoded = encodeURIComponent(lines.join('\n'));
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
}

export function buildWhatsAppUrlForDeliveryNote(settings: StoreSettings, note: DeliveryNote, items: DeliveryNoteItem[]): string {
  const useBs = note.displayCurrency === 'BS';
  const rate = note.rateBcv > 0 ? note.rateBcv : 1;
  const lines = [
    `*NOTA DE ENTREGA ${note.noteNumber}*`,
    `NO VÁLIDO PARA CRÉDITO FISCAL`,
    `*${settings.storeName || 'SmartPOS286'}*`,
    `Cliente: ${note.customerName} (${note.customerDocument})`,
    note.recipientName ? `Recibe: ${note.recipientName}` : '',
    '',
    ...items.map((it) => {
      const val = useBs ? `Bs. ${(it.priceUsd * rate * it.quantity).toFixed(2)}` : `$${(it.priceUsd * it.quantity).toFixed(2)}`;
      return `• ${formatQty(it.quantity)}x ${it.productName}: ${val}`;
    }),
    '',
    useBs
      ? `*TOTAL NOTA: Bs. ${note.totalEstimatedBs.toFixed(2)}*`
      : `*TOTAL NOTA: $${note.totalEstimatedUsd.toFixed(2)} USD*`,
  ].filter(Boolean);

  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}
