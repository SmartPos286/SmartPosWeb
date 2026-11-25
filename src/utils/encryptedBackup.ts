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

/**
 * Encabezados mágicos exactos (19 bytes UTF-8)
 * V1: JSON UTF-8 directo, usado en exportación local (formatVersion = 1)
 * V2: JSON UTF-8 comprimido con GZIP, usado en nube/Firestore (formatVersion = 2)
 */
export const BACKUP_HEADER_V1 = 'CAJAPOS_ENC_JSON_V1';
export const BACKUP_HEADER_V2 = 'CAJAPOS_ENC_GZIP_V2';

/** Passphrase maestra predeterminada de sincronización */
export const DEFAULT_SYNC_PASSPHRASE = 'CAJA_POS_SECURE_MASTER_SYNC_KEY_2026_V1';

/** Parámetros criptográficos exactos */
export const PBKDF2_ITERATIONS = 65536;
export const AES_KEY_BITS = 256;
export const SALT_BYTES_LENGTH = 16;
export const IV_BYTES_LENGTH = 12;
export const AUTH_TAG_BYTES_LENGTH = 16;
export const HEADER_BYTES_LENGTH = 19;

/**
 * Esquema Exacto del JSON Interno (EncryptedPosBackupPackage)
 * Diseñado para interoperabilidad 100% con la aplicación compañera Android/Kotlin
 */
export interface EncryptedPosBackupPackage {
  formatVersion: number;
  exportedAt: number;
  storeName: string;
  storeRif: string;
  storePhone: string;
  storeAddress: string;
  bcvRate: number;
  isCompanyRegistered: boolean;
  companyRegisteredAt: number;

  products: Array<{
    id: number;
    code: string;
    name: string;
    category: string;
    priceUsd: number;
    stock: number;
    costPriceUsd: number;
    invoiceNumber: string;
    isTaxExempt: boolean;
    hasCommission: boolean;
    commissionPercentage: number;
    commissionAmountUsd: number;
    isRecipe: boolean;
    isCombo: boolean;
    comboItemsJson: string;
    allowDecimalQuantity: boolean;
    isPriceModifiable: boolean;
    wholesalePriceUsd: number;
    aisleNumber: string;
    aisleQuantity: number;
    depotQuantity: number;
    counterQuantity: number;
    minStockAlertQuantity: number;
    isLowStockAlertEnabled: boolean;
  }>;

  customers: Array<{
    id: number;
    name: string;
    documentId: string;
    address: string;
    phone: string;
    clientType: string;
    isWithholdingAgent: boolean;
    ivaRetentionPercentage: number;
    islrRetentionPercentage: number;
  }>;

  sales: Array<{
    id: number;
    customerName: string;
    customerDocument: string;
    timestamp: number;
    rateBcv: number;
    totalUsd: number;
    totalBs: number;
    paymentCashUsd: number;
    paymentMobileBs: number;
    paymentCardBs: number;
    paymentCreditUsd: number;
    paymentCasheaUsd: number;
    isCreditPaid: boolean;
    creditPaidAmountUsd: number;
    creditDueDate: number;
    creditNotes: string;
    igtfUsd: number;
    igtfBs: number;
    baseTaxableUsd: number;
    baseExemptUsd: number;
    ivaUsd: number;
    discountUsd: number;
    cashierName: string;
    cashRegisterNumber: string;
    totalCommissionUsd: number;
    retencionIvaUsd: number;
    retencionIvaPercentage: number;
    retencionIslrUsd: number;
    retencionIslrPercentage: number;
    withholdingVoucherNumber: string;
    withholdingStatus: string;
    status?: string;
    returnedAt?: number;
    returnedBy?: string;
    returnReason?: string;
  }>;

  saleItems: Array<{
    id: number;
    saleId: number;
    productId: number;
    productName: string;
    quantity: number;
    priceUsd: number;
    costPriceUsd?: number;
    isTaxExempt: boolean;
    commissionUsd: number;
  }>;

  suppliers: Array<{
    id: number;
    name: string;
    documentId: string;
    phone: string;
    address: string;
  }>;

  purchaseInvoices: Array<{
    id: number;
    supplierId: number;
    invoiceNumber: string;
    timestamp: number;
    totalAmount: number;
    description: string;
    isPaid: boolean;
    paidTimestamp: number;
    dueDate: number;
    paymentNotes: string;
    subtotalUsd: number;
    taxAmountUsd: number;
    retencionIvaUsd: number;
    retencionIvaPercentage: number;
    retencionIslrUsd: number;
    retencionIslrPercentage: number;
    withholdingVoucherNumber: string;
    withholdingStatus: string;
  }>;

  deliveryNotes: Array<{
    id: number;
    noteNumber: string;
    customerName: string;
    customerDocument: string;
    recipientName: string;
    reasonOrObservation: string;
    timestamp: number;
    totalEstimatedUsd: number;
    totalEstimatedBs: number;
    rateBcv: number;
    status: string;
    cashierName: string;
    cashRegisterNumber: string;
    displayCurrency: string;
  }>;

  deliveryNoteItems: Array<{
    id: number;
    deliveryNoteId: number;
    productId: number;
    productName: string;
    quantity: number;
    priceUsd: number;
    costPriceUsd?: number;
    isTaxExempt?: boolean;
  }>;

  expenses: Array<{
    id: number;
    category: string;
    invoiceNumber: string;
    amountUsd: number;
    amountBs: number;
    bcvRateUsed: number;
    paymentMethod: string;
    description: string;
    timestamp: number;
    registeredBy: string;
  }>;

  users: Array<{
    id: number;
    username: string;
    pin: string;
    role: any;
    avatarUrl: string;
    canEarnCommission: boolean;
    allowedModules: string;
  }>;

  quotes: Array<{
    id: number;
    quoteNumber: string;
    customerName: string;
    customerDocument: string;
    customerPhone: string;
    timestamp: number;
    validityDays: number;
    validUntil: number;
    rateBcv: number;
    baseTaxableUsd: number;
    baseExemptUsd: number;
    ivaUsd: number;
    discountUsd: number;
    totalUsd: number;
    totalBs: number;
    notesOrConditions: string;
    status: string;
    cashierName: string;
    cashRegisterNumber: string;
  }>;

  quoteItems: Array<{
    id: number;
    quoteId: number;
    productId: number;
    productName: string;
    quantity: number;
    priceUsd: number;
    isTaxExempt: boolean;
  }>;

  casheaSettlements: Array<{
    id: number;
    settlementDate: number;
    grossAmountUsd: number;
    commissionPercentage: number;
    commissionAmountUsd: number;
    netReceivedUsd: number;
    rateBcv: number;
    notes: string;
    registeredBy: string;
    createdAt: number;
  }>;

  posTerminalRecords: Array<{
    id: number;
    transactionDateTime: string;
    transactionTimestamp: number;
    receiptNumber: string;
    referenceNumber: string;
    approvalNumber: string;
    maskedCardNumber: string;
    operationType: string;
    totalAmount: number;
    currency: 'VES' | 'USD' | string;
    transactionStatus: string;
    bankOrTerminal: string;
    notes: string;
    rawOcrText: string;
    registeredBy: string;
    createdAt: number;
  }>;
}

/**
 * Codificación Base64 sin saltos de línea (equivalente a Base64.NO_WRAP en Android)
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/**
 * Decodificación de Base64 eliminando previamente cualquier espacio o salto de línea
 */
export function base64ToUint8Array(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Compresión GZIP utilizando la Web Streams API (RFC 1952)
 */
export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(data as any);
  writer.close();
  const res = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(res);
}

/**
 * Descompresión GZIP utilizando la Web Streams API (RFC 1952)
 */
export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  writer.write(data as any);
  writer.close();
  const res = await new Response(ds.readable).arrayBuffer();
  return new Uint8Array(res);
}

/**
 * Derivación de clave simétrica AES-256 usando PBKDF2WithHmacSHA256
 * Parámetros: 65,536 iteraciones, SHA-256, 256 bits (32 bytes)
 */
async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyString = passphrase && passphrase.trim().length > 0 ? passphrase.trim() : DEFAULT_SYNC_PASSPHRASE;
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyString),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt).buffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Genera el archivo o ByteArray binario cifrado en el orden exacto:
 * [ HEADER (19 bytes) ] + [ SALT (16 bytes) ] + [ IV (12 bytes) ] + [ CIPHERTEXT + AUTH_TAG (N + 16 bytes) ]
 *
 * Se pasa el HEADER exacto como Additional Authenticated Data (AAD) antes de cifrar.
 */
export async function encryptJsonToBinary(
  jsonString: string,
  passphrase?: string,
  formatVersion: 1 | 2 = 1
): Promise<Uint8Array> {
  const headerString = formatVersion === 2 ? BACKUP_HEADER_V2 : BACKUP_HEADER_V1;
  const enc = new TextEncoder();
  const headerBytes = enc.encode(headerString);
  if (headerBytes.length !== HEADER_BYTES_LENGTH) {
    throw new Error(`El encabezado debe tener exactamente ${HEADER_BYTES_LENGTH} bytes UTF-8.`);
  }

  // Preparar contenido: si es V2 se comprime con GZIP; si es V1 va en UTF-8 directo
  const rawUtf8 = enc.encode(jsonString);
  const plainBytes = formatVersion === 2 ? await gzipCompress(rawUtf8) : rawUtf8;

  // Generar salt e IV aleatorios
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES_LENGTH));

  // Derivar clave
  const key = await deriveAesKey(passphrase || DEFAULT_SYNC_PASSPHRASE, salt);

  // Cifrado AES-GCM con AAD (autenticando el header de 19 bytes)
  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv).buffer,
      additionalData: new Uint8Array(headerBytes).buffer,
      tagLength: 128,
    },
    key,
    new Uint8Array(plainBytes).buffer
  );

  const cipherBytes = new Uint8Array(cipherBuffer);

  // Ensamblar los 4 bloques contiguos exactos
  const totalLength = HEADER_BYTES_LENGTH + SALT_BYTES_LENGTH + IV_BYTES_LENGTH + cipherBytes.length;
  const binaryPayload = new Uint8Array(totalLength);
  let offset = 0;

  binaryPayload.set(headerBytes, offset);
  offset += HEADER_BYTES_LENGTH;

  binaryPayload.set(salt, offset);
  offset += SALT_BYTES_LENGTH;

  binaryPayload.set(iv, offset);
  offset += IV_BYTES_LENGTH;

  binaryPayload.set(cipherBytes, offset);

  return binaryPayload;
}

/**
 * Desencripta el archivo o ByteArray binario:
 * Verifica el encabezado mágico de 19 bytes, extrae SALT (16B), IV (12B),
 * alimenta el AAD con el HEADER y ejecuta AES-GCM decrypt.
 * Si es V2 descomprime con GZIP; si es V1 lee directamente el JSON UTF-8.
 */
export async function decryptBinaryToJson(
  fileBytes: Uint8Array,
  passphrase?: string
): Promise<{ jsonString: string; formatVersion: number; header: string }> {
  const minRequiredLength = HEADER_BYTES_LENGTH + SALT_BYTES_LENGTH + IV_BYTES_LENGTH + AUTH_TAG_BYTES_LENGTH;
  if (fileBytes.length < minRequiredLength) {
    throw new Error('El archivo binario es demasiado corto o está corrupto.');
  }

  const dec = new TextDecoder();
  const headerBytes = fileBytes.subarray(0, HEADER_BYTES_LENGTH);
  const headerString = dec.decode(headerBytes);

  let formatVersion = 0;
  if (headerString === BACKUP_HEADER_V1) {
    formatVersion = 1;
  } else if (headerString === BACKUP_HEADER_V2) {
    formatVersion = 2;
  } else {
    throw new Error(
      `Encabezado de respaldo no reconocido: "${headerString}". Debe ser ${BACKUP_HEADER_V1} o ${BACKUP_HEADER_V2}.`
    );
  }

  const salt = fileBytes.subarray(HEADER_BYTES_LENGTH, HEADER_BYTES_LENGTH + SALT_BYTES_LENGTH);
  const iv = fileBytes.subarray(
    HEADER_BYTES_LENGTH + SALT_BYTES_LENGTH,
    HEADER_BYTES_LENGTH + SALT_BYTES_LENGTH + IV_BYTES_LENGTH
  );
  const cipherBytes = fileBytes.subarray(HEADER_BYTES_LENGTH + SALT_BYTES_LENGTH + IV_BYTES_LENGTH);

  // Derivar clave probando primero con la passphrase provista, o la predeterminada
  const keyCandidates: string[] = [];
  if (passphrase && passphrase.trim().length > 0) {
    keyCandidates.push(passphrase.trim());
  }
  if (!keyCandidates.includes(DEFAULT_SYNC_PASSPHRASE)) {
    keyCandidates.push(DEFAULT_SYNC_PASSPHRASE);
  }

  let decryptedBuffer: ArrayBuffer | null = null;
  let lastError: unknown = null;

  for (const candidate of keyCandidates) {
    try {
      const key = await deriveAesKey(candidate, salt);
      decryptedBuffer = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: new Uint8Array(iv).buffer,
          additionalData: new Uint8Array(headerBytes).buffer,
          tagLength: 128,
        },
        key,
        new Uint8Array(cipherBytes).buffer
      );
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!decryptedBuffer) {
    throw new Error(
      'Contraseña incorrecta o verificación de integridad de respaldo fallida (AAD/AuthTag inválido).'
    );
  }

  let plainBytes: Uint8Array = new Uint8Array(decryptedBuffer);
  if (formatVersion === 2) {
    try {
      plainBytes = await gzipDecompress(plainBytes);
    } catch (err) {
      throw new Error('Error al descomprimir el archivo GZIP del respaldo V2: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  const jsonString = dec.decode(plainBytes);
  return { jsonString, formatVersion, header: headerString };
}

/**
 * Construye el paquete estándar EncryptedPosBackupPackage a partir del estado de la aplicación
 */
export function buildEncryptedPosBackupPackage(
  state: {
    settings: StoreSettings;
    products: Product[];
    customers: Customer[];
    sales: Sale[];
    saleItems: SaleItem[];
    suppliers: Supplier[];
    purchaseInvoices: PurchaseInvoice[];
    deliveryNotes: DeliveryNote[];
    deliveryNoteItems: DeliveryNoteItem[];
    expenses: Expense[];
    users: User[];
    quotes: Quote[];
    quoteItems: QuoteItem[];
    casheaSettlements: CasheaSettlement[];
    posTerminalRecords: PosTerminalRecord[];
  },
  formatVersion: 1 | 2 = 1
): EncryptedPosBackupPackage {
  const now = Date.now();
  return {
    formatVersion,
    exportedAt: now,
    storeName: state.settings.storeName || 'Nombre del Comercio',
    storeRif: state.settings.storeRif || 'J-00000000-0',
    storePhone: state.settings.storePhone || '0414-0000000',
    storeAddress: state.settings.storeAddress || 'Dirección fiscal',
    bcvRate: state.settings.bcvRate > 0 ? state.settings.bcvRate : 1.0,
    isCompanyRegistered: Boolean(state.settings.companyRegistered),
    companyRegisteredAt: now,

    products: (state.products || []).map((p) => ({
      id: Number(p.id),
      code: String(p.code || ''),
      name: String(p.name || ''),
      category: String(p.category || 'General'),
      priceUsd: Number(p.priceUsd || 0),
      stock: Number(p.stock || 0),
      costPriceUsd: Number(p.costPriceUsd || 0),
      invoiceNumber: String(p.invoiceNumber || ''),
      isTaxExempt: Boolean(p.isTaxExempt),
      hasCommission: Boolean(p.hasCommission),
      commissionPercentage: Number(p.commissionPercentage || 0),
      commissionAmountUsd: Number(p.commissionAmountUsd || 0),
      isRecipe: Boolean(p.isRecipe),
      isCombo: Boolean(p.isCombo),
      comboItemsJson: String(p.comboItemsJson || ''),
      allowDecimalQuantity: Boolean(p.allowDecimalQuantity),
      isPriceModifiable: Boolean(p.isPriceModifiable),
      wholesalePriceUsd: Number(p.wholesalePriceUsd || 0),
      aisleNumber: String(p.aisleNumber || ''),
      aisleQuantity: Number(p.aisleQuantity || 0),
      depotQuantity: Number(p.depotQuantity || 0),
      counterQuantity: Number(p.counterQuantity || 0),
      minStockAlertQuantity: Number(p.minStockAlertQuantity || 0),
      isLowStockAlertEnabled: Boolean(p.isLowStockAlertEnabled),
    })),

    customers: (state.customers || []).map((c) => ({
      id: Number(c.id),
      name: String(c.name || ''),
      documentId: String(c.documentId || ''),
      address: String(c.address || ''),
      phone: String(c.phone || ''),
      clientType: String(c.clientType || 'PERSONA_NATURAL'),
      isWithholdingAgent: Boolean(c.isWithholdingAgent),
      ivaRetentionPercentage: Number(c.ivaRetentionPercentage || 0),
      islrRetentionPercentage: Number(c.islrRetentionPercentage || 0),
    })),

    sales: (state.sales || []).map((s) => ({
      id: Number(s.id),
      customerName: String(s.customerName || ''),
      customerDocument: String(s.customerDocument || ''),
      timestamp: Number(s.timestamp || now),
      rateBcv: Number(s.rateBcv || 1),
      totalUsd: Number(s.totalUsd || 0),
      totalBs: Number(s.totalBs || 0),
      paymentCashUsd: Number(s.paymentCashUsd || 0),
      paymentMobileBs: Number(s.paymentMobileBs || 0),
      paymentCardBs: Number(s.paymentCardBs || 0),
      paymentCreditUsd: Number(s.paymentCreditUsd || 0),
      paymentCasheaUsd: Number(s.paymentCasheaUsd || 0),
      isCreditPaid: Boolean(s.isCreditPaid),
      creditPaidAmountUsd: Number(s.creditPaidAmountUsd || 0),
      creditDueDate: Number(s.creditDueDate || 0),
      creditNotes: String(s.creditNotes || ''),
      igtfUsd: Number(s.igtfUsd || 0),
      igtfBs: Number(s.igtfBs || 0),
      baseTaxableUsd: Number(s.baseTaxableUsd || 0),
      baseExemptUsd: Number(s.baseExemptUsd || 0),
      ivaUsd: Number(s.ivaUsd || 0),
      discountUsd: Number(s.discountUsd || 0),
      cashierName: String(s.cashierName || 'admin'),
      cashRegisterNumber: String(s.cashRegisterNumber || 'Caja 1'),
      totalCommissionUsd: Number(s.totalCommissionUsd || 0),
      retencionIvaUsd: Number(s.retencionIvaUsd || 0),
      retencionIvaPercentage: Number(s.retencionIvaPercentage || 0),
      retencionIslrUsd: Number(s.retencionIslrUsd || 0),
      retencionIslrPercentage: Number(s.retencionIslrPercentage || 0),
      withholdingVoucherNumber: String(s.withholdingVoucherNumber || ''),
      withholdingStatus: String(s.withholdingStatus || 'SIN_RETENCION'),
      status: s.status,
      returnedAt: s.returnedAt,
      returnedBy: s.returnedBy,
      returnReason: s.returnReason,
    })),

    saleItems: (state.saleItems || []).map((si) => ({
      id: Number(si.id),
      saleId: Number(si.saleId),
      productId: Number(si.productId),
      productName: String(si.productName || ''),
      quantity: Number(si.quantity || 0),
      priceUsd: Number(si.priceUsd || 0),
      costPriceUsd: Number(si.costPriceUsd || 0),
      isTaxExempt: Boolean(si.isTaxExempt),
      commissionUsd: Number(si.commissionUsd || 0),
    })),

    suppliers: (state.suppliers || []).map((sup) => ({
      id: Number(sup.id),
      name: String(sup.name || ''),
      documentId: String(sup.documentId || ''),
      phone: String(sup.phone || ''),
      address: String(sup.address || ''),
    })),

    purchaseInvoices: (state.purchaseInvoices || []).map((pi) => ({
      id: Number(pi.id),
      supplierId: Number(pi.supplierId),
      invoiceNumber: String(pi.invoiceNumber || ''),
      timestamp: Number(pi.timestamp || now),
      totalAmount: Number(pi.totalAmount || 0),
      description: String(pi.description || ''),
      isPaid: Boolean(pi.isPaid),
      paidTimestamp: Number(pi.paidTimestamp || 0),
      dueDate: Number(pi.dueDate || 0),
      paymentNotes: String(pi.paymentNotes || ''),
      subtotalUsd: Number(pi.subtotalUsd || 0),
      taxAmountUsd: Number(pi.taxAmountUsd || 0),
      retencionIvaUsd: Number(pi.retencionIvaUsd || 0),
      retencionIvaPercentage: Number(pi.retencionIvaPercentage || 0),
      retencionIslrUsd: Number(pi.retencionIslrUsd || 0),
      retencionIslrPercentage: Number(pi.retencionIslrPercentage || 0),
      withholdingVoucherNumber: String(pi.withholdingVoucherNumber || ''),
      withholdingStatus: String(pi.withholdingStatus || 'NO_APLICA'),
    })),

    deliveryNotes: (state.deliveryNotes || []).map((dn) => ({
      id: Number(dn.id),
      noteNumber: String(dn.noteNumber || ''),
      customerName: String(dn.customerName || ''),
      customerDocument: String(dn.customerDocument || ''),
      recipientName: String(dn.recipientName || ''),
      reasonOrObservation: String(dn.reasonOrObservation || ''),
      timestamp: Number(dn.timestamp || now),
      totalEstimatedUsd: Number(dn.totalEstimatedUsd || 0),
      totalEstimatedBs: Number(dn.totalEstimatedBs || 0),
      rateBcv: Number(dn.rateBcv || 1),
      status: String(dn.status || 'ENTREGADO'),
      cashierName: String(dn.cashierName || 'admin'),
      cashRegisterNumber: String(dn.cashRegisterNumber || 'Caja 1'),
      displayCurrency: String(dn.displayCurrency || 'USD'),
    })),

    deliveryNoteItems: (state.deliveryNoteItems || []).map((dni) => ({
      id: Number(dni.id),
      deliveryNoteId: Number(dni.deliveryNoteId),
      productId: Number(dni.productId),
      productName: String(dni.productName || ''),
      quantity: Number(dni.quantity || 0),
      priceUsd: Number(dni.priceUsd || 0),
      costPriceUsd: Number(dni.costPriceUsd || 0),
      isTaxExempt: Boolean(dni.isTaxExempt),
    })),

    expenses: (state.expenses || []).map((e) => ({
      id: Number(e.id),
      category: String(e.category || 'Varios'),
      invoiceNumber: String(e.invoiceNumber || ''),
      amountUsd: Number(e.amountUsd || 0),
      amountBs: Number(e.amountBs || 0),
      bcvRateUsed: Number(e.bcvRateUsed || 1),
      paymentMethod: String(e.paymentMethod || 'Efectivo USD'),
      description: String(e.description || ''),
      timestamp: Number(e.timestamp || now),
      registeredBy: String(e.registeredBy || 'admin'),
    })),

    users: (state.users || []).map((u) => ({
      id: Number(u.id),
      username: String(u.username || ''),
      pin: String(u.pin || ''),
      role: u.role || 'CASHIER',
      avatarUrl: String(u.avatarUrl || ''),
      canEarnCommission: Boolean(u.canEarnCommission),
      allowedModules: String(u.allowedModules || ''),
    })),

    quotes: (state.quotes || []).map((q) => ({
      id: Number(q.id),
      quoteNumber: String(q.quoteNumber || ''),
      customerName: String(q.customerName || ''),
      customerDocument: String(q.customerDocument || ''),
      customerPhone: String(q.customerPhone || ''),
      timestamp: Number(q.timestamp || now),
      validityDays: Number(q.validityDays || 7),
      validUntil: Number(q.validUntil || now),
      rateBcv: Number(q.rateBcv || 1),
      baseTaxableUsd: Number(q.baseTaxableUsd || 0),
      baseExemptUsd: Number(q.baseExemptUsd || 0),
      ivaUsd: Number(q.ivaUsd || 0),
      discountUsd: Number(q.discountUsd || 0),
      totalUsd: Number(q.totalUsd || 0),
      totalBs: Number(q.totalBs || 0),
      notesOrConditions: String(q.notesOrConditions || ''),
      status: String(q.status || 'VIGENTE'),
      cashierName: String(q.cashierName || 'admin'),
      cashRegisterNumber: String(q.cashRegisterNumber || 'Caja 1'),
    })),

    quoteItems: (state.quoteItems || []).map((qi) => ({
      id: Number(qi.id),
      quoteId: Number(qi.quoteId),
      productId: Number(qi.productId),
      productName: String(qi.productName || ''),
      quantity: Number(qi.quantity || 0),
      priceUsd: Number(qi.priceUsd || 0),
      isTaxExempt: Boolean(qi.isTaxExempt),
    })),

    casheaSettlements: (state.casheaSettlements || []).map((cs) => ({
      id: Number(cs.id),
      settlementDate: Number(cs.settlementDate || now),
      grossAmountUsd: Number(cs.grossAmountUsd || 0),
      commissionPercentage: Number(cs.commissionPercentage || 0),
      commissionAmountUsd: Number(cs.commissionAmountUsd || 0),
      netReceivedUsd: Number(cs.netReceivedUsd || 0),
      rateBcv: Number(cs.rateBcv || 1),
      notes: String(cs.notes || ''),
      registeredBy: String(cs.registeredBy || 'admin'),
      createdAt: Number(cs.createdAt || now),
    })),

    posTerminalRecords: (state.posTerminalRecords || []).map((pt) => ({
      id: Number(pt.id),
      transactionDateTime: String(pt.transactionDateTime || ''),
      transactionTimestamp: Number(pt.transactionTimestamp || now),
      receiptNumber: String(pt.receiptNumber || ''),
      referenceNumber: String(pt.referenceNumber || ''),
      approvalNumber: String(pt.approvalNumber || ''),
      maskedCardNumber: String(pt.maskedCardNumber || ''),
      operationType: String(pt.operationType || 'COMPRA'),
      totalAmount: Number(pt.totalAmount || 0),
      currency: pt.currency === 'USD' ? 'USD' : 'VES',
      transactionStatus: String(pt.transactionStatus || 'APROBADA'),
      bankOrTerminal: String(pt.bankOrTerminal || ''),
      notes: String(pt.notes || ''),
      rawOcrText: String(pt.rawOcrText || ''),
      registeredBy: String(pt.registeredBy || 'admin'),
      createdAt: Number(pt.createdAt || now),
    })),
  };
}

/**
 * Convierte un paquete EncryptedPosBackupPackage en el estado de la aplicación
 */
export function restoreEncryptedPosBackupPackage(
  pkg: Partial<EncryptedPosBackupPackage>,
  prevSettings: StoreSettings
): {
  settings: StoreSettings;
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  saleItems: SaleItem[];
  suppliers: Supplier[];
  purchaseInvoices: PurchaseInvoice[];
  deliveryNotes: DeliveryNote[];
  deliveryNoteItems: DeliveryNoteItem[];
  expenses: Expense[];
  users: User[];
  quotes: Quote[];
  quoteItems: QuoteItem[];
  casheaSettlements: CasheaSettlement[];
  posTerminalRecords: PosTerminalRecord[];
} {
  const settings: StoreSettings = {
    ...prevSettings,
    storeName: pkg.storeName || prevSettings.storeName,
    storeRif: pkg.storeRif || prevSettings.storeRif,
    storePhone: pkg.storePhone || prevSettings.storePhone,
    storeAddress: pkg.storeAddress || prevSettings.storeAddress,
    bcvRate: typeof pkg.bcvRate === 'number' && pkg.bcvRate > 0 ? pkg.bcvRate : prevSettings.bcvRate,
    companyRegistered:
      typeof pkg.isCompanyRegistered === 'boolean' ? pkg.isCompanyRegistered : prevSettings.companyRegistered,
  };

  return {
    settings,
    products: Array.isArray(pkg.products) ? (pkg.products as Product[]) : [],
    customers: Array.isArray(pkg.customers) ? (pkg.customers as Customer[]) : [],
    sales: Array.isArray(pkg.sales) ? (pkg.sales as Sale[]) : [],
    saleItems: Array.isArray(pkg.saleItems) ? (pkg.saleItems as SaleItem[]) : [],
    suppliers: Array.isArray(pkg.suppliers) ? (pkg.suppliers as Supplier[]) : [],
    purchaseInvoices: Array.isArray(pkg.purchaseInvoices) ? (pkg.purchaseInvoices as PurchaseInvoice[]) : [],
    deliveryNotes: Array.isArray(pkg.deliveryNotes) ? (pkg.deliveryNotes as DeliveryNote[]) : [],
    deliveryNoteItems: Array.isArray(pkg.deliveryNoteItems) ? (pkg.deliveryNoteItems as DeliveryNoteItem[]) : [],
    expenses: Array.isArray(pkg.expenses) ? (pkg.expenses as Expense[]) : [],
    users: Array.isArray(pkg.users) ? (pkg.users as User[]) : [],
    quotes: Array.isArray(pkg.quotes) ? (pkg.quotes as Quote[]) : [],
    quoteItems: Array.isArray(pkg.quoteItems) ? (pkg.quoteItems as QuoteItem[]) : [],
    casheaSettlements: Array.isArray(pkg.casheaSettlements) ? (pkg.casheaSettlements as CasheaSettlement[]) : [],
    posTerminalRecords: Array.isArray(pkg.posTerminalRecords) ? (pkg.posTerminalRecords as PosTerminalRecord[]) : [],
  };
}

/**
 * Cifra el paquete completo y lo devuelve como Base64 (formato usado en Firestore o archivos de texto)
 */
export async function encryptBackupPackageToBase64(
  pkg: EncryptedPosBackupPackage,
  passphrase?: string,
  formatVersion: 1 | 2 = 2
): Promise<string> {
  const jsonStr = JSON.stringify(pkg);
  const binaryBytes = await encryptJsonToBinary(jsonStr, passphrase, formatVersion);
  return uint8ArrayToBase64(binaryBytes);
}

/**
 * Descifra un payload que puede venir como Base64 string o Uint8Array binario
 */
export async function decryptPayloadToPackage(
  input: string | Uint8Array,
  passphrase?: string
): Promise<EncryptedPosBackupPackage> {
  let bytes: Uint8Array;

  if (typeof input === 'string') {
    const trimmed = input.trim();

    // Soporte para legado: si es JSON plano o sobre SMARTPOS286_ENC_V1
    if (trimmed.startsWith('{') && trimmed.includes('SMARTPOS286_ENC_V1')) {
      const parsedLegacy = JSON.parse(trimmed);
      const salt = base64ToUint8Array(parsedLegacy.salt);
      const iv = base64ToUint8Array(parsedLegacy.iv);
      const ciphertext = base64ToUint8Array(parsedLegacy.ciphertext);
      const enc = new TextEncoder();
      const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(passphrase || DEFAULT_SYNC_PASSPHRASE),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: new Uint8Array(salt).buffer,
          iterations: parsedLegacy.iterations || 100000,
          hash: 'SHA-256',
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
        key,
        new Uint8Array(ciphertext).buffer
      );
      const legacyJson = new TextDecoder().decode(decBuf);
      return JSON.parse(legacyJson);
    }

    if (trimmed.startsWith('{')) {
      // JSON directo sin cifrar
      return JSON.parse(trimmed);
    }

    // Probar decodificar Base64
    bytes = base64ToUint8Array(trimmed);
  } else {
    bytes = input;
  }

  const { jsonString } = await decryptBinaryToJson(bytes, passphrase);
  return JSON.parse(jsonString) as EncryptedPosBackupPackage;
}

/**
 * Función de compatibilidad para exportar respaldos cifrados
 * Por defecto genera V1 para archivos locales, o V2 para sincronización
 */
export async function encryptBackupPayload(
  plainJson: string,
  passphrase?: string,
  formatVersion: 1 | 2 = 1
): Promise<string> {
  const binary = await encryptJsonToBinary(plainJson, passphrase, formatVersion);
  return uint8ArrayToBase64(binary);
}

/**
 * Función de compatibilidad para importar respaldos cifrados
 */
export async function decryptBackupPayload(
  encryptedInput: string | Uint8Array,
  passphrase?: string
): Promise<string> {
  const pkg = await decryptPayloadToPackage(encryptedInput, passphrase);
  return JSON.stringify(pkg, null, 2);
}
