import type {
  CasheaSettlement,
  Customer,
  DeliveryNote,
  DeliveryNoteItem,
  Expense,
  PosTerminalRecord,
  Product,
  PurchaseInvoice,
  Quote,
  QuoteItem,
  Sale,
  SaleItem,
  StoreSettings,
  Supplier,
  User,
} from '../types/models';

export interface SqlExportData {
  settings: StoreSettings;
  users: User[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  saleItems: SaleItem[];
  quotes: Quote[];
  quoteItems: QuoteItem[];
  deliveryNotes: DeliveryNote[];
  deliveryNoteItems: DeliveryNoteItem[];
  purchaseInvoices: PurchaseInvoice[];
  expenses: Expense[];
  casheaSettlements: CasheaSettlement[];
  posTerminalRecords: PosTerminalRecord[];
}

function sqlVal(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : '0';
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

function buildInserts(table: string, rows: Array<Record<string, unknown>>): string[] {
  if (rows.length === 0) return [];
  const lines: string[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const cols = keys.map((k) => `"${k}"`).join(', ');
    const vals = keys.map((k) => sqlVal(row[k])).join(', ');
    lines.push(`INSERT INTO "${table}" (${cols}) VALUES (${vals});`);
  }
  return lines;
}

export function exportDatabaseToSql(data: SqlExportData): string {
  const lines: string[] = [
    '-- SmartPOS286 SQL Backup Dump',
    `-- GeneratedAt: ${new Date().toISOString()}`,
    `-- Store: ${data.settings.storeName} (${data.settings.storeRif})`,
    'BEGIN;',
    '',
    `CREATE TABLE IF NOT EXISTS "sp286_snapshot" ("id" INTEGER PRIMARY KEY, "section" TEXT NOT NULL, "payload_json" TEXT NOT NULL);`,
    `DELETE FROM "sp286_snapshot";`,
  ];

  // Relational tables export
  const tables: Array<{ name: string; ddl: string; rows: Array<Record<string, unknown>> }> = [
    {
      name: 'store_settings',
      ddl: `CREATE TABLE IF NOT EXISTS "store_settings" ("id" INTEGER PRIMARY KEY, "storeName" TEXT, "storeRif" TEXT, "storeAddress" TEXT, "storePhone" TEXT, "bcvRate" NUMERIC, "cashRegisterNumber" TEXT, "commissionRegisters" TEXT, "isMinProfitMarginEnabled" BOOLEAN, "minProfitMarginPercent" NUMERIC, "printerPaperWidth" TEXT, "licenseType" TEXT, "licenseKey" TEXT);`,
      rows: [
        {
          id: 1,
          storeName: data.settings.storeName,
          storeRif: data.settings.storeRif,
          storeAddress: data.settings.storeAddress,
          storePhone: data.settings.storePhone,
          bcvRate: data.settings.bcvRate,
          cashRegisterNumber: data.settings.cashRegisterNumber,
          commissionRegisters: data.settings.commissionRegisters,
          isMinProfitMarginEnabled: data.settings.isMinProfitMarginEnabled,
          minProfitMarginPercent: data.settings.minProfitMarginPercent,
          printerPaperWidth: data.settings.printerPaperWidth,
          licenseType: data.settings.licenseType,
          licenseKey: data.settings.licenseKey,
        },
      ],
    },
    {
      name: 'products',
      ddl: `CREATE TABLE IF NOT EXISTS "products" ("id" INTEGER PRIMARY KEY, "code" TEXT, "name" TEXT, "category" TEXT, "priceUsd" NUMERIC, "stock" NUMERIC, "costPriceUsd" NUMERIC, "isTaxExempt" BOOLEAN, "wholesalePriceUsd" NUMERIC, "minStockAlertQuantity" NUMERIC);`,
      rows: data.products.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        priceUsd: p.priceUsd,
        stock: p.stock,
        costPriceUsd: p.costPriceUsd,
        isTaxExempt: p.isTaxExempt,
        wholesalePriceUsd: p.wholesalePriceUsd,
        minStockAlertQuantity: p.minStockAlertQuantity,
      })),
    },
    {
      name: 'customers',
      ddl: `CREATE TABLE IF NOT EXISTS "customers" ("id" INTEGER PRIMARY KEY, "name" TEXT, "documentId" TEXT, "phone" TEXT, "address" TEXT, "clientType" TEXT, "isWithholdingAgent" BOOLEAN);`,
      rows: data.customers.map((c) => ({
        id: c.id,
        name: c.name,
        documentId: c.documentId,
        phone: c.phone,
        address: c.address,
        clientType: c.clientType,
        isWithholdingAgent: c.isWithholdingAgent,
      })),
    },
    {
      name: 'suppliers',
      ddl: `CREATE TABLE IF NOT EXISTS "suppliers" ("id" INTEGER PRIMARY KEY, "name" TEXT, "documentId" TEXT, "phone" TEXT, "address" TEXT);`,
      rows: data.suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        documentId: s.documentId,
        phone: s.phone,
        address: s.address,
      })),
    },
    {
      name: 'sales',
      ddl: `CREATE TABLE IF NOT EXISTS "sales" ("id" INTEGER PRIMARY KEY, "customerName" TEXT, "customerDocument" TEXT, "timestamp" BIGINT, "rateBcv" NUMERIC, "totalUsd" NUMERIC, "totalBs" NUMERIC, "cashierName" TEXT, "status" TEXT, "returnedAt" BIGINT, "returnedBy" TEXT, "returnReason" TEXT);`,
      rows: data.sales.map((s) => ({
        id: s.id,
        customerName: s.customerName,
        customerDocument: s.customerDocument,
        timestamp: s.timestamp,
        rateBcv: s.rateBcv,
        totalUsd: s.totalUsd,
        totalBs: s.totalBs,
        cashierName: s.cashierName,
        status: s.status || 'ACTIVA',
        returnedAt: s.returnedAt ?? null,
        returnedBy: s.returnedBy ?? null,
        returnReason: s.returnReason ?? null,
      })),
    },
    {
      name: 'expenses',
      ddl: `CREATE TABLE IF NOT EXISTS "expenses" ("id" INTEGER PRIMARY KEY, "category" TEXT, "invoiceNumber" TEXT, "amountUsd" NUMERIC, "amountBs" NUMERIC, "paymentMethod" TEXT, "timestamp" BIGINT);`,
      rows: data.expenses.map((e) => ({
        id: e.id,
        category: e.category,
        invoiceNumber: e.invoiceNumber,
        amountUsd: e.amountUsd,
        amountBs: e.amountBs,
        paymentMethod: e.paymentMethod,
        timestamp: e.timestamp,
      })),
    },
  ];

  for (const tbl of tables) {
    lines.push(tbl.ddl);
    lines.push(`DELETE FROM "${tbl.name}";`);
    lines.push(...buildInserts(tbl.name, tbl.rows));
    lines.push('');
  }

  // Also embed lossless full-state SQL snapshot rows for deterministic 100% restore
  const fullStateJson = JSON.stringify(data);
  lines.push(
    `INSERT INTO "sp286_snapshot" ("id", "section", "payload_json") VALUES (1, 'FULL_STATE', ${sqlVal(fullStateJson)});`
  );
  lines.push('COMMIT;');

  return lines.join('\n');
}

export function importDatabaseFromSql(sqlText: string): Partial<SqlExportData> {
  const match = sqlText.match(
    /INSERT INTO "sp286_snapshot" \("id", "section", "payload_json"\) VALUES \(1, 'FULL_STATE', '((?:[^']|'')*)'\);/
  );
  if (!match || !match[1]) {
    throw new Error('El archivo .sql no contiene un bloque de respaldo válido de SmartPOS286.');
  }
  const unescaped = match[1].replace(/''/g, "'");
  const parsed = JSON.parse(unescaped) as Partial<SqlExportData>;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.products)) {
    throw new Error('Los datos extraídos del archivo .sql están incompletos o dañados.');
  }
  return parsed;
}
