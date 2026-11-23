import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  Edit,
  FileSpreadsheet,
  FileText,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { ComboComponent, Product } from '../types/models';
import {
  calculateAvailableComboStock,
  calculateComboCost,
  formatBs,
  formatQty,
  formatUsd,
  getEffectiveStock,
  isLowStockTriggered,
  parseComboComponents,
  round2,
} from '../utils/currencyMath';
import { downloadTextFile, exportInventoryToCsv, parseInventoryCsv, type CsvParseResult } from '../utils/csvInventory';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const InventoryScreen: React.FC = () => {
  const {
    state,
    isLicensed,
    isProductLimitReached,
    lowStockProducts,
    saveProduct,
    deleteProduct,
    importCsvProducts,
    applyInventoryCategoryUpdates,
    setIsLicenseOpen,
    setIsAlertsOpen,
    notify,
  } = usePos();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [stockFilter, setStockFilter] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');
  const [sortBy, setSortBy] = useState<'NAME' | 'STOCK_ASC' | 'PRICE_DESC'>('NAME');

  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [csvModal, setCsvModal] = useState<CsvParseResult | null>(null);
  const [isOrganizingAi, setIsOrganizingAi] = useState(false);

  const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;

  const categories = useMemo(() => {
    const s = new Set<string>(['Todas']);
    state.products.forEach((p) => s.add(p.category || 'General'));
    return Array.from(s);
  }, [state.products]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = state.products.filter((p) => {
      const catOk = categoryFilter === 'Todas' || (p.category || 'General') === categoryFilter;
      const qOk = !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      const eff = getEffectiveStock(p, state.products);
      const stockOk =
        stockFilter === 'ALL' ||
        (stockFilter === 'LOW' && isLowStockTriggered(p, state.products)) ||
        (stockFilter === 'OUT' && !p.isRecipe && eff <= 1e-6);
      return catOk && qOk && stockOk;
    });

    return list.sort((a, b) => {
      if (sortBy === 'STOCK_ASC') {
        return getEffectiveStock(a, state.products) - getEffectiveStock(b, state.products);
      }
      if (sortBy === 'PRICE_DESC') {
        return b.priceUsd - a.priceUsd;
      }
      return a.name.localeCompare(b.name);
    });
  }, [categoryFilter, search, sortBy, state.products, stockFilter]);

  const handleOpenNew = () => {
    if (isProductLimitReached) {
      setIsLicenseOpen(true);
      return;
    }
    setEditingProduct({
      code: '',
      name: '',
      category: 'General',
      priceUsd: 0,
      stock: 0,
      costPriceUsd: 0,
      invoiceNumber: '',
      isTaxExempt: false,
      hasCommission: false,
      commissionPercentage: 0,
      commissionAmountUsd: 0,
      isRecipe: false,
      isCombo: false,
      comboItemsJson: '[]',
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
  };

  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseInventoryCsv(text);
    setCsvModal(parsed);
    e.target.value = '';
  };

  const handleAiOrganize = async () => {
    if (state.products.length === 0) return;
    setIsOrganizingAi(true);
    try {
      const res = await fetch('/api/gemini/organize-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: state.products.map((p) => ({ id: p.id, name: p.name, category: p.category })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error organizando con IA');
      const updates = Array.isArray(data.updates) ? data.updates : [];
      if (updates.length > 0) {
        applyInventoryCategoryUpdates(updates);
      } else {
        notify('Inventario Limpio', 'La IA determinó que tus categorías ya están organizadas.', 'info');
      }
    } catch (err) {
      notify('Error IA', err instanceof Error ? err.message : 'No se pudo organizar con IA.', 'error');
    } finally {
      setIsOrganizingAi(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      {/* License + Low Stock Banners */}
      {!isLicensed && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-2.5 text-xs">
          <span>
            Plan Gratuito: <strong className="font-mono-num">{state.products.length}/{state.settings.maxProductsLimit}</strong> productos registrados.
          </span>
          <button
            type="button"
            onClick={() => setIsLicenseOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-1 font-bold text-white"
          >
            Activar Licencia
          </button>
        </div>
      )}

      {lowStockProducts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span>{lowStockProducts.length} producto(s) por debajo del stock mínimo configurado.</span>
          </div>
          <button
            type="button"
            onClick={() => setIsAlertsOpen(true)}
            className="rounded-lg bg-amber-500 px-3 py-1 font-extrabold text-slate-950"
          >
            Ver Alertas
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300/60 bg-white/95 p-3.5 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto o código..."
            className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs dark:border-slate-600 dark:bg-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-bold hover:bg-slate-100 dark:border-slate-600 dark:bg-[#283A5A]">
            <Upload className="h-3.5 w-3.5" />
            Importar CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvFile} />
          </label>

          <button
            type="button"
            onClick={() =>
              downloadTextFile(`inventario_smartpos286_${Date.now()}.csv`, exportInventoryToCsv(state.products))
            }
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 text-xs font-bold hover:bg-slate-100 dark:border-slate-600 dark:bg-[#283A5A]"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>

          <button
            type="button"
            onClick={() => {
              const totalRetailUsd = round2(
                filteredProducts.reduce((sum, p) => {
                  const eff = p.isRecipe ? 0 : getEffectiveStock(p, state.products);
                  return sum + p.priceUsd * eff;
                }, 0)
              );
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Reporte de Inventario y Catálogo',
                subtitle: `Filtro categoría: ${categoryFilter} • ${filteredProducts.length} artículo(s)`,
                columns: ['Código', 'Producto', 'Categoría', 'Costo ($)', 'Venta ($)', 'Venta (Bs.)', 'Stock'],
                rows: filteredProducts.map((p) => {
                  const eff = getEffectiveStock(p, state.products);
                  const effCost = p.isCombo ? calculateComboCost(p, state.products) : p.costPriceUsd;
                  return [
                    p.code || `#${p.id}`,
                    p.name,
                    p.category,
                    formatUsd(effCost),
                    formatUsd(p.priceUsd),
                    formatBs(p.priceUsd * rate),
                    p.isRecipe ? 'Ilimitado' : formatQty(eff),
                  ];
                }),
                summaryLines: [
                  `Artículos mostrados: ${filteredProducts.length} | Alertas stock bajo: ${lowStockProducts.length}`,
                  `Valoración Estimada a Precio Venta: ${formatUsd(totalRetailUsd)} (${formatBs(totalRetailUsd * rate)})`,
                ],
                orientation: 'landscape',
                filename: `inventario_${Date.now()}.pdf`,
              });
            }}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-3.5 w-3.5" />
            Exportar PDF
          </button>

          <button
            type="button"
            onClick={handleAiOrganize}
            disabled={isOrganizingAi}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-bold text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
          >
            {isOrganizingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Organizar IA
          </button>

          <button
            type="button"
            onClick={handleOpenNew}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-extrabold text-white shadow hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Nuevo Producto
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-3 py-1 font-bold ${
                categoryFilter === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white/80 text-slate-700 dark:bg-[#1E2D48] dark:text-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value as any)}
            className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold dark:border-slate-700 dark:bg-[#1E2D48]"
          >
            <option value="ALL">Todo el stock</option>
            <option value="LOW">Stock Crítico</option>
            <option value="OUT">Agotados</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 font-semibold dark:border-slate-700 dark:bg-[#1E2D48]"
          >
            <option value="NAME">Orden: A-Z</option>
            <option value="STOCK_ASC">Menor Stock</option>
            <option value="PRICE_DESC">Mayor Precio</option>
          </select>
        </div>
      </div>

      {/* Product Cards */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredProducts.map((p) => {
          const effStock = getEffectiveStock(p, state.products);
          const effCost = p.isCombo ? calculateComboCost(p, state.products) : p.costPriceUsd;
          const marginPct = effCost > 0 ? ((p.priceUsd - effCost) / effCost) * 100 : 0;
          const low = isLowStockTriggered(p, state.products);

          return (
            <div
              key={p.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-sky-400">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-extrabold leading-tight">{p.name}</p>
                      <p className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                        {p.code || `#${p.id}`} • {p.category}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingProduct({ ...p })}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-700"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(p.id)}
                      className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold">
                  <span
                    className={`rounded px-2 py-0.5 ${
                      p.isTaxExempt
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {p.isTaxExempt ? 'SENIAT Exento 0%' : 'IVA 16% Incluido'}
                  </span>
                  {p.isCombo && <span className="rounded bg-violet-500/15 px-2 py-0.5 text-violet-500">Combo</span>}
                  {p.isRecipe && <span className="rounded bg-sky-500/15 px-2 py-0.5 text-sky-500">Receta/Servicio</span>}
                  {p.allowDecimalQuantity && (
                    <span className="rounded bg-slate-500/15 px-2 py-0.5 text-slate-600 dark:text-slate-300">
                      Peso/Decimal
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-200/70 pt-3 text-xs dark:border-slate-700/70">
                <div>
                  <p className="text-[10px] text-slate-500">Precio Venta</p>
                  <p className="font-mono-num font-extrabold text-indigo-600 dark:text-sky-400">
                    {formatUsd(p.priceUsd)}
                  </p>
                  <p className="font-mono-num text-[10px] text-slate-400">{formatBs(p.priceUsd * rate)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500">Costo / Margen</p>
                  <p className="font-mono-num font-bold">{formatUsd(effCost)}</p>
                  <p className="font-mono-num text-[10px] text-emerald-500">+{marginPct.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500">Stock</p>
                  <p
                    className={`font-mono-num text-sm font-extrabold ${
                      low ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {p.isRecipe ? '∞' : formatQty(effStock)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Product Form Modal */}
      {editingProduct && (
        <ProductFormModal
          initial={editingProduct}
          allProducts={state.products}
          isMinMarginEnabled={state.settings.isMinProfitMarginEnabled}
          minMarginPercent={state.settings.minProfitMarginPercent}
          onClose={() => setEditingProduct(null)}
          onSave={(prod) => {
            const res = saveProduct(prod);
            if (res.ok) setEditingProduct(null);
          }}
        />
      )}

      {/* CSV Preview Modal */}
      {csvModal && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white shadow-2xl dark:bg-[#1E2D48]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold">Importación CSV de Inventario</h3>
              </div>
              <button type="button" onClick={() => setCsvModal(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5 text-xs">
              <div className="flex gap-3">
                <span className="rounded-lg bg-emerald-500/15 px-3 py-1.5 font-bold text-emerald-600 dark:text-emerald-300">
                  Válidos: {csvModal.validRows.length}
                </span>
                <span className="rounded-lg bg-rose-500/15 px-3 py-1.5 font-bold text-rose-500">
                  Con error: {csvModal.invalidRows.length}
                </span>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[11px] dark:bg-slate-800">
                    <tr>
                      <th className="p-2">Producto</th>
                      <th className="p-2">Stock</th>
                      <th className="p-2">Costo</th>
                      <th className="p-2">Venta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {csvModal.validRows.slice(0, 40).map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="p-2 font-semibold">{r.name}</td>
                        <td className="p-2 font-mono-num">{r.stock}</td>
                        <td className="p-2 font-mono-num">{formatUsd(r.costPriceUsd)}</td>
                        <td className="p-2 font-mono-num">{formatUsd(r.priceUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
              <button type="button" onClick={() => setCsvModal(null)} className="px-4 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button
                type="button"
                disabled={csvModal.validRows.length === 0}
                onClick={() => {
                  importCsvProducts(csvModal.validRows);
                  setCsvModal(null);
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
              >
                Importar {csvModal.validRows.length} Productos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ProductFormModalProps {
  initial: Partial<Product>;
  allProducts: Product[];
  isMinMarginEnabled: boolean;
  minMarginPercent: number;
  onClose: () => void;
  onSave: (product: Omit<Product, 'id'> & { id?: number }) => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  initial,
  allProducts,
  isMinMarginEnabled,
  minMarginPercent,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(initial.name || '');
  const [code, setCode] = useState(initial.code || '');
  const [category, setCategory] = useState(initial.category || 'General');
  const [mode, setMode] = useState<'SIMPLE' | 'COMBO' | 'RECIPE'>(
    initial.isCombo ? 'COMBO' : initial.isRecipe ? 'RECIPE' : 'SIMPLE'
  );
  const [costStr, setCostStr] = useState(String(initial.costPriceUsd ?? 0));
  const [saleStr, setSaleStr] = useState(String(initial.priceUsd ?? 0));
  const [wholesaleStr, setWholesaleStr] = useState(String(initial.wholesalePriceUsd ?? 0));
  const [stockStr, setStockStr] = useState(String(initial.stock ?? 0));
  const [isTaxExempt, setIsTaxExempt] = useState(Boolean(initial.isTaxExempt));
  const [allowDecimal, setAllowDecimal] = useState(Boolean(initial.allowDecimalQuantity));
  const [isPriceModifiable, setIsPriceModifiable] = useState(Boolean(initial.isPriceModifiable));
  const [hasCommission, setHasCommission] = useState(Boolean(initial.hasCommission));
  const [commPctStr, setCommPctStr] = useState(String(initial.commissionPercentage ?? 0));
  const [lowAlertEnabled, setLowAlertEnabled] = useState(initial.isLowStockAlertEnabled ?? true);
  const [minStockStr, setMinStockStr] = useState(String(initial.minStockAlertQuantity ?? 5));
  const [aisleNumber, setAisleNumber] = useState(initial.aisleNumber || '');
  const [aisleQtyStr, setAisleQtyStr] = useState(String(initial.aisleQuantity ?? 0));
  const [depotQtyStr, setDepotQtyStr] = useState(String(initial.depotQuantity ?? 0));
  const [counterQtyStr, setCounterQtyStr] = useState(String(initial.counterQuantity ?? 0));
  const [comboComps, setComboComps] = useState<ComboComponent[]>(
    initial.isCombo ? parseComboComponents(initial as Product) : []
  );
  const [compToAddId, setCompToAddId] = useState<number>(allProducts[0]?.id ?? 0);

  const costNum = Number(costStr) || 0;
  const saleNum = Number(saleStr) || 0;
  const profit = round2(saleNum - costNum);
  const marginOnCost = costNum > 0 ? (profit / costNum) * 100 : 0;

  const handleCostChange = (val: string) => {
    setCostStr(val);
    if (!initial.id && isMinMarginEnabled && minMarginPercent > 0) {
      const c = Number(val) || 0;
      if (c > 0) {
        setSaleStr((c * (1 + minMarginPercent / 100)).toFixed(2));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: initial.id,
      code: code.trim() || `PRD-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category: category.trim() || 'General',
      priceUsd: Math.max(0, Number(saleStr) || 0),
      wholesalePriceUsd: Math.max(0, Number(wholesaleStr) || 0),
      costPriceUsd: mode === 'SIMPLE' ? Math.max(0, Number(costStr) || 0) : 0,
      stock: mode === 'SIMPLE' ? Math.max(0, Number(stockStr) || 0) : 0,
      invoiceNumber: initial.invoiceNumber || '',
      isTaxExempt,
      hasCommission,
      commissionPercentage: hasCommission ? Math.max(0, Number(commPctStr) || 0) : 0,
      commissionAmountUsd: 0,
      isRecipe: mode === 'RECIPE',
      isCombo: mode === 'COMBO',
      comboItemsJson: mode === 'COMBO' ? JSON.stringify(comboComps) : '',
      allowDecimalQuantity: allowDecimal,
      isPriceModifiable,
      aisleNumber,
      aisleQuantity: Number(aisleQtyStr) || 0,
      depotQuantity: Number(depotQtyStr) || 0,
      counterQuantity: Number(counterQtyStr) || 0,
      minStockAlertQuantity: Math.max(0, Number(minStockStr) || 5),
      isLowStockAlertEnabled: lowAlertEnabled,
    });
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <h3 className="text-base font-extrabold">{initial.id ? 'Editar Producto' : 'Nuevo Producto'}</h3>
          <button type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1 font-bold dark:bg-[#283A5A]">
            {[
              { id: 'SIMPLE', label: 'Producto Físico' },
              { id: 'COMBO', label: 'Combo / Kit' },
              { id: 'RECIPE', label: 'Servicio / Receta' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id as any)}
                className={`rounded-lg py-2 ${mode === m.id ? 'bg-indigo-600 text-white' : ''}`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-bold">Nombre del Producto *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">Código / SKU</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold">Categoría</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">Precio Venta ($ USD) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={saleStr}
                onChange={(e) => setSaleStr(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block font-bold">Precio Mayor ($ USD)</label>
              <input
                type="number"
                step="0.01"
                value={wholesaleStr}
                onChange={(e) => setWholesaleStr(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
          </div>

          {mode === 'SIMPLE' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block font-bold">Costo Unitario ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={costStr}
                    onChange={(e) => handleCostChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">Stock / Existencias</label>
                  <input
                    type="number"
                    step={allowDecimal ? '0.01' : '1'}
                    value={stockStr}
                    onChange={(e) => setStockStr(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
              </div>

              {/* Margin Presets + Calculator */}
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold">Margen rápido s/ costo:</span>
                  <div className="flex gap-1.5">
                    {[20, 30, 40, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        disabled={costNum <= 0}
                        onClick={() => setSaleStr((costNum * (1 + pct / 100)).toFixed(2))}
                        className="rounded-lg bg-white px-2 py-1 font-bold text-indigo-600 shadow-sm disabled:opacity-40 dark:bg-slate-900 dark:text-sky-300"
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 font-mono-num text-[11px]">
                  Ganancia/u: <strong>{formatUsd(profit)}</strong> • Margen s/ Costo:{' '}
                  <strong>{marginOnCost.toFixed(1)}%</strong>
                </p>
              </div>
            </>
          )}

          {mode === 'COMBO' && (
            <div className="space-y-2 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3">
              <p className="font-bold text-violet-600 dark:text-violet-300">Componentes del Combo</p>
              <div className="flex gap-2">
                <select
                  value={compToAddId}
                  onChange={(e) => setCompToAddId(Number(e.target.value))}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                >
                  {allProducts
                    .filter((p) => !p.isCombo && !p.isRecipe && p.id !== initial.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const target = allProducts.find((p) => p.id === compToAddId);
                    if (!target) return;
                    setComboComps((prev) => {
                      const ex = prev.find((c) => c.productId === target.id);
                      if (ex) {
                        return prev.map((c) => (c.productId === target.id ? { ...c, quantity: c.quantity + 1 } : c));
                      }
                      return [...prev, { productId: target.id, productName: target.name, quantity: 1 }];
                    });
                  }}
                  className="rounded-xl bg-violet-600 px-3 py-2 font-bold text-white"
                >
                  Añadir
                </button>
              </div>
              {comboComps.map((c) => (
                <div key={c.productId} className="flex items-center justify-between rounded-lg bg-white/80 px-3 py-1.5 dark:bg-slate-900">
                  <span>
                    {c.quantity}x {c.productName}
                  </span>
                  <button
                    type="button"
                    onClick={() => setComboComps((prev) => prev.filter((x) => x.productId !== c.productId))}
                    className="text-rose-500"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toggles */}
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
              <input type="checkbox" checked={isTaxExempt} onChange={(e) => setIsTaxExempt(e.target.checked)} />
              <span className="font-semibold">Exento de IVA (0%)</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
              <input type="checkbox" checked={allowDecimal} onChange={(e) => setAllowDecimal(e.target.checked)} />
              <span className="font-semibold">Permitir cantidad decimal (Kg/L)</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isPriceModifiable}
                onChange={(e) => setIsPriceModifiable(e.target.checked)}
              />
              <span className="font-semibold">Permitir editar precio en POS</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
              <input type="checkbox" checked={hasCommission} onChange={(e) => setHasCommission(e.target.checked)} />
              <span className="font-semibold">Paga comisión al cajero (%)</span>
            </label>
          </div>

          {hasCommission && (
            <div>
              <label className="mb-1 block font-bold">Porcentaje de Comisión (%)</label>
              <input
                type="number"
                step="0.5"
                value={commPctStr}
                onChange={(e) => setCommPctStr(e.target.value)}
                className="w-40 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
              />
            </div>
          )}

          {mode !== 'RECIPE' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                <input
                  type="checkbox"
                  checked={lowAlertEnabled}
                  onChange={(e) => setLowAlertEnabled(e.target.checked)}
                />
                <span className="font-semibold">Alerta de stock mínimo</span>
              </label>
              {lowAlertEnabled && (
                <div>
                  <label className="mb-1 block font-bold">Stock mínimo alerta</label>
                  <input
                    type="number"
                    value={minStockStr}
                    onChange={(e) => setMinStockStr(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
              )}
            </div>
          )}

          {/* Zone Locations */}
          <div className="grid gap-2 sm:grid-cols-4">
            <input
              type="text"
              value={aisleNumber}
              onChange={(e) => setAisleNumber(e.target.value)}
              placeholder="Pasillo (Ej: P-2)"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="number"
              value={aisleQtyStr}
              onChange={(e) => setAisleQtyStr(e.target.value)}
              placeholder="Cant. Pasillo"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="number"
              value={depotQtyStr}
              onChange={(e) => setDepotQtyStr(e.target.value)}
              placeholder="Cant. Depósito"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="number"
              value={counterQtyStr}
              onChange={(e) => setCounterQtyStr(e.target.value)}
              placeholder="Cant. Mostrador"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
          <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold">
            Cancelar
          </button>
          <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-extrabold text-white">
            Guardar Producto
          </button>
        </div>
      </form>
    </div>
  );
};
