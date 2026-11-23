import type { Product } from '../types/models';

export interface ParsedCsvProductRow {
  rowNumber: number;
  code: string;
  name: string;
  category: string;
  stock: number;
  costPriceUsd: number;
  priceUsd: number;
  wholesalePriceUsd: number;
  isTaxExempt: boolean;
  error?: string;
}

export interface CsvParseResult {
  delimiter: string;
  totalRows: number;
  validRows: ParsedCsvProductRow[];
  invalidRows: ParsedCsvProductRow[];
}

function normalizeHeader(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseLocaleNumber(raw: string | undefined): number {
  if (!raw) return 0;
  let cleaned = raw
    .replace(/[$€]/g, '')
    .replace(/bs\.?/gi, '')
    .replace(/usd/gi, '')
    .replace(/\s+/g, '')
    .trim();

  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    const parts = cleaned.split(',');
    if (parts.length === 2 && parts[1].length <= 4) {
      cleaned = cleaned.replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  }

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseInventoryCsv(content: string): CsvParseResult {
  const lines = content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { delimiter: ',', totalRows: 0, validRows: [], invalidRows: [] };
  }

  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;

  let delimiter = ',';
  if (semiCount >= commaCount && semiCount >= tabCount && semiCount > 0) delimiter = ';';
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = '\t';

  const headers = splitCsvLine(headerLine, delimiter).map(normalizeHeader);

  const findIdx = (candidates: string[]): number =>
    headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)));

  const nameIdx = findIdx(['producto', 'nombre', 'descripcion', 'name', 'product', 'articulo']);
  const codeIdx = findIdx(['codigo', 'sku', 'barcode', 'code', 'barra', 'cod']);
  const categoryIdx = findIdx(['categoria', 'rubro', 'departamento', 'category', 'grupo']);
  const stockIdx = findIdx(['cantidad', 'stock', 'existencia', 'existencias', 'qty', 'inventario']);
  const costIdx = findIdx(['precio_costo', 'costo', 'cost', 'compra', 'costo_usd']);
  const priceIdx = findIdx(['precio_venta', 'precio', 'pvp', 'price', 'venta', 'precio_usd']);
  const wholesaleIdx = findIdx(['precio_mayor', 'mayor', 'wholesale', 'mayorista']);
  const exemptIdx = findIdx(['exento', 'iva_exento', 'exempt']);

  const validRows: ParsedCsvProductRow[] = [];
  const invalidRows: ParsedCsvProductRow[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i], delimiter);
    const rawName = nameIdx >= 0 ? cols[nameIdx] ?? '' : cols[0] ?? '';
    const rawCode = codeIdx >= 0 ? cols[codeIdx] ?? '' : '';
    const rawCategory = categoryIdx >= 0 ? cols[categoryIdx] ?? 'General' : 'General';
    const stock = stockIdx >= 0 ? Math.max(0, parseLocaleNumber(cols[stockIdx])) : 0;
    const costPriceUsd = costIdx >= 0 ? Math.max(0, parseLocaleNumber(cols[costIdx])) : 0;
    const priceUsd = priceIdx >= 0 ? Math.max(0, parseLocaleNumber(cols[priceIdx])) : 0;
    const wholesalePriceUsd = wholesaleIdx >= 0 ? Math.max(0, parseLocaleNumber(cols[wholesaleIdx])) : 0;
    const exemptRaw = exemptIdx >= 0 ? (cols[exemptIdx] ?? '').toLowerCase() : '';
    const isTaxExempt = ['si', 'sí', 'true', '1', 'exento', 'e'].includes(exemptRaw);

    const row: ParsedCsvProductRow = {
      rowNumber: i + 1,
      code: rawCode.trim() || `CSV-${String(i).padStart(4, '0')}`,
      name: rawName.trim(),
      category: rawCategory.trim() || 'General',
      stock,
      costPriceUsd,
      priceUsd,
      wholesalePriceUsd,
      isTaxExempt,
    };

    if (!row.name) {
      row.error = 'Nombre de producto vacío';
      invalidRows.push(row);
    } else if (row.priceUsd <= 0) {
      row.error = 'Precio de venta debe ser mayor a 0';
      invalidRows.push(row);
    } else {
      validRows.push(row);
    }
  }

  return {
    delimiter,
    totalRows: lines.length - 1,
    validRows,
    invalidRows,
  };
}

export function exportInventoryToCsv(products: Product[]): string {
  const header = [
    'codigo',
    'producto',
    'categoria',
    'cantidad',
    'precio_costo',
    'precio_venta',
    'precio_mayor',
    'exento',
  ].join(';');

  const escape = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = products.map((p) =>
    [
      escape(p.code),
      escape(p.name),
      escape(p.category),
      escape(p.stock),
      escape(p.costPriceUsd.toFixed(2)),
      escape(p.priceUsd.toFixed(2)),
      escape(p.wholesalePriceUsd.toFixed(2)),
      escape(p.isTaxExempt ? 'SI' : 'NO'),
    ].join(';')
  );

  return '\uFEFF' + [header, ...rows].join('\n');
}

export function downloadTextFile(filename: string, content: string, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
