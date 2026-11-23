import type { CartItem, ComboComponent, Product } from '../types/models';

export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round4(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export function formatUsd(value: number): string {
  return `$${round2(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatBs(value: number): string {
  return `Bs. ${round2(value).toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function convertUsdToBs(amountUsd: number, rateBcv: number): number {
  if (!Number.isFinite(amountUsd) || !Number.isFinite(rateBcv) || amountUsd <= 0 || rateBcv <= 0) {
    return 0;
  }
  return round2(amountUsd * rateBcv);
}

export function parseComboComponents(product: Product): ComboComponent[] {
  if (!product.isCombo || !product.comboItemsJson?.trim()) return [];
  try {
    const parsed = JSON.parse(product.comboItemsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function calculateComboCost(product: Product, allProducts: Product[]): number {
  if (!product.isCombo) return product.costPriceUsd;
  const comps = parseComboComponents(product);
  return round4(
    comps.reduce((sum, comp) => {
      const found = allProducts.find((p) => p.id === comp.productId);
      return sum + (found?.costPriceUsd ?? 0) * comp.quantity;
    }, 0)
  );
}

export function calculateAvailableComboStock(product: Product, allProducts: Product[]): number {
  if (!product.isCombo) return product.stock;
  const comps = parseComboComponents(product);
  if (comps.length === 0) return 0;
  return Math.floor(
    Math.min(
      ...comps.map((comp) => {
        const found = allProducts.find((p) => p.id === comp.productId);
        if (!found || found.isRecipe || found.isCombo) return 9999;
        return found.stock / Math.max(1, comp.quantity);
      })
    )
  );
}

export function getEffectiveStock(product: Product, allProducts: Product[]): number {
  if (product.isRecipe) return Number.MAX_SAFE_INTEGER;
  if (product.isCombo) return calculateAvailableComboStock(product, allProducts);
  return product.stock;
}

export function isLowStockTriggered(product: Product, allProducts: Product[]): boolean {
  if (product.isRecipe || !product.isLowStockAlertEnabled) return false;
  if (product.minStockAlertQuantity < 0) return false;
  return getEffectiveStock(product, allProducts) <= product.minStockAlertQuantity + 1e-6;
}

export function isOutOfStockTriggered(product: Product, allProducts: Product[]): boolean {
  if (product.isRecipe || !product.isLowStockAlertEnabled) return false;
  return getEffectiveStock(product, allProducts) <= 1e-6;
}

export interface CartTaxBreakdown {
  grossTaxableUsd: number;
  grossExemptUsd: number;
  grossTotalUsd: number;
  discountUsd: number;
  baseTaxableUsd: number;
  baseExemptUsd: number;
  ivaUsd: number;
  subtotalWithIvaUsd: number;
}

/**
 * Product prices in SmartPOS286 are IVA-inclusive gross USD for taxable items.
 * Discounts reduce taxable and exempt bases proportionally pre-IVA.
 */
export function calculateCartBreakdown(items: CartItem[], discountUsd = 0): CartTaxBreakdown {
  let grossTaxable = 0;
  let grossExempt = 0;

  for (const item of items) {
    const unitPrice = item.customPriceUsd ?? item.product.priceUsd;
    const lineGross = Math.max(0, unitPrice * item.quantity);
    if (item.product.isTaxExempt) {
      grossExempt += lineGross;
    } else {
      grossTaxable += lineGross;
    }
  }

  const grossTotal = grossTaxable + grossExempt;
  const rawBaseTaxable = grossTaxable / 1.16;
  const rawBaseExempt = grossExempt;
  const rawTotalBase = rawBaseTaxable + rawBaseExempt;

  const appliedDiscount = Math.min(Math.max(0, discountUsd), rawTotalBase);
  const ratio = rawTotalBase > 0 ? Math.max(0, (rawTotalBase - appliedDiscount) / rawTotalBase) : 1;

  const baseTaxableUsd = round2(rawBaseTaxable * ratio);
  const baseExemptUsd = round2(rawBaseExempt * ratio);
  const ivaUsd = round2(baseTaxableUsd * 0.16);
  const subtotalWithIvaUsd = round2(baseTaxableUsd + baseExemptUsd + ivaUsd);

  return {
    grossTaxableUsd: round2(grossTaxable),
    grossExemptUsd: round2(grossExempt),
    grossTotalUsd: round2(grossTotal),
    discountUsd: round2(appliedDiscount),
    baseTaxableUsd,
    baseExemptUsd,
    ivaUsd,
    subtotalWithIvaUsd,
  };
}

export function calculateUnitCommission(product: Product, effectiveUnitPrice?: number): number {
  if (!product.hasCommission) return 0;
  const price = effectiveUnitPrice ?? product.priceUsd;
  if (product.commissionPercentage > 0) {
    return round4(price * (product.commissionPercentage / 100));
  }
  return round4(product.commissionAmountUsd);
}

export function formatQty(qty: number): string {
  if (Math.abs(qty - Math.round(qty)) < 1e-6) return String(Math.round(qty));
  return qty.toFixed(2);
}

export function formatDateTime(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
