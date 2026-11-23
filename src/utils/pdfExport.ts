import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { StoreSettings } from '../types/models';
import { formatDateTime } from './currencyMath';

export interface PdfExportOptions {
  settings: StoreSettings;
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  summaryLines?: string[];
  filename: string;
  orientation?: 'portrait' | 'landscape';
}

export function exportModuleTablePdf({
  settings,
  title,
  subtitle,
  columns,
  rows,
  summaryLines = [],
  filename,
  orientation = 'portrait',
}: PdfExportOptions): void {
  const doc = new jsPDF({
    orientation,
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 36;

  // Header band
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 84, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text((settings.storeName || 'SMARTPOS286').slice(0, 58), marginX, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  const companyMeta = [
    `RIF: ${settings.storeRif || 'J-00000000-0'}`,
    settings.storePhone ? `Tel: ${settings.storePhone}` : '',
    settings.storeAddress ? settings.storeAddress.slice(0, 52) : '',
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(companyMeta, marginX, 44);

  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title.toUpperCase(), marginX, 64);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(226, 232, 240);
  const rightMeta = `Tasa BCV: Bs. ${settings.bcvRate.toFixed(2)}  |  ${formatDateTime(Date.now())}`;
  doc.text(rightMeta, pageWidth - marginX, 64, { align: 'right' });

  let startY = 104;
  if (subtitle) {
    doc.setTextColor(51, 65, 85);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(subtitle, marginX, 102);
    startY = 116;
  }

  autoTable(doc, {
    startY,
    head: [columns],
    body: rows.length > 0 ? rows : [columns.map((_, idx) => (idx === 0 ? 'Sin registros' : '-'))],
    margin: { left: marginX, right: marginX },
    styles: {
      fontSize: 8.2,
      cellPadding: 5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.4,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: (data) => {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `SmartPOS286 — Documento generado automáticamente • Página ${data.pageNumber}`,
        marginX,
        pageHeight - 20
      );
    },
  });

  if (summaryLines.length > 0) {
    const tableEndY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? startY + 40;
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = tableEndY + 20;
    if (y + summaryLines.length * 14 + 24 > pageHeight - 36) {
      doc.addPage();
      y = 48;
    }

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(marginX, y - 12, pageWidth - marginX * 2, summaryLines.length * 14 + 18, 6, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    for (const line of summaryLines) {
      doc.text(line, marginX + 10, y + 2);
      y += 14;
    }
  }

  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  doc.save(safeName);
}
