export type MainModuleGroupId = 'VENTAS' | 'ADMINISTRATIVO' | 'INFO_GENERAL' | 'CONFIG';

export type AppRoute =
  | 'home'
  | 'pos'
  | 'quotes'
  | 'delivery_notes'
  | 'invoices'
  | 'inventory'
  | 'withholdings'
  | 'suppliers'
  | 'customers'
  | 'pos_terminals'
  | 'expenses'
  | 'cashea'
  | 'dashboard'
  | 'summary'
  | 'users'
  | 'settings';

export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'CASHIER';

export interface ComboComponent {
  productId: number;
  productName: string;
  quantity: number;
}

export interface Product {
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
}

export interface CartItem {
  product: Product;
  quantity: number;
  customPriceUsd?: number;
}

export interface Sale {
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
  withholdingStatus: 'SIN_RETENCION' | 'PENDIENTE_COMPROBANTE' | 'COMPROBANTE_RECIBIDO';
  status?: 'ACTIVA' | 'DEVUELTA';
  returnedAt?: number;
  returnedBy?: string;
  returnReason?: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  priceUsd: number;
  costPriceUsd: number;
  isTaxExempt: boolean;
  commissionUsd: number;
}

export interface Customer {
  id: number;
  name: string;
  documentId: string;
  address: string;
  phone: string;
  clientType: 'PERSONA_NATURAL' | 'PERSONA_JURIDICA' | 'GOBIERNO';
  isWithholdingAgent: boolean;
  ivaRetentionPercentage: number;
  islrRetentionPercentage: number;
}

export interface Quote {
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
  status: 'VIGENTE' | 'ACEPTADO' | 'FACTURADO' | 'ANULADO';
  cashierName: string;
  cashRegisterNumber: string;
}

export interface QuoteItem {
  id: number;
  quoteId: number;
  productId: number;
  productName: string;
  quantity: number;
  priceUsd: number;
  isTaxExempt: boolean;
}

export interface DeliveryNote {
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
  status: 'ENTREGADO' | 'FACTURADO' | 'ANULADO';
  cashierName: string;
  cashRegisterNumber: string;
  displayCurrency: 'USD' | 'BS';
}

export interface DeliveryNoteItem {
  id: number;
  deliveryNoteId: number;
  productId: number;
  productName: string;
  quantity: number;
  priceUsd: number;
  costPriceUsd: number;
  isTaxExempt: boolean;
}

export interface HeldSale {
  id: number;
  customerName: string;
  customerDocument: string;
  timestamp: number;
  totalUsd: number;
  note: string;
}

export interface HeldSaleItem {
  id: number;
  heldSaleId: number;
  productId: number;
  productName: string;
  quantity: number;
  priceUsd: number;
}

export interface Supplier {
  id: number;
  name: string;
  documentId: string;
  phone: string;
  address: string;
}

export interface PurchaseInvoice {
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
  withholdingStatus: 'NO_APLICA' | 'PENDIENTE_ENTERA' | 'ENTERADO_SENIAT';
}

export interface Expense {
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
}

export interface CasheaSettlement {
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
}

export interface PosTerminalRecord {
  id: number;
  transactionDateTime: string;
  transactionTimestamp: number;
  receiptNumber: string;
  referenceNumber: string;
  approvalNumber: string;
  maskedCardNumber: string;
  operationType: string;
  totalAmount: number;
  currency: 'VES' | 'USD';
  transactionStatus: 'APROBADA' | 'RECHAZADA' | 'ANULADA' | 'PENDIENTE';
  bankOrTerminal: string;
  notes: string;
  rawOcrText: string;
  registeredBy: string;
  createdAt: number;
}

export interface User {
  id: number;
  username: string;
  pin: string;
  role: UserRole;
  avatarUrl: string;
  canEarnCommission: boolean;
  allowedModules: string;
}

export interface StoreSettings {
  themeMode: 'DARK' | 'LIGHT';
  storeName: string;
  storeRif: string;
  storeAddress: string;
  storePhone: string;
  storeLogoDataUrl: string;
  bcvRate: number;
  cashRegisterNumber: string;
  commissionRegisters: string;
  isMinProfitMarginEnabled: boolean;
  minProfitMarginPercent: number;
  isFiscalMode: boolean;
  fiscalPrinterBrand: string;
  printerPaperWidth: '58mm' | '80mm';
  companyRegistered: boolean;
  companyCode: string;
  licenseType: 'FREE_TRIAL' | 'STANDARD' | 'PRO_LIFETIME';
  licenseKey: string;
  maxProductsLimit: number;
  maxDailyInvoicesLimit: number;
  maxTrialDays: number;
  licenseExpiresAt: string;
  licensedClientEmail: string;
}

export interface AssistantAction {
  type:
    | 'NAVIGATE'
    | 'UPDATE_RATE'
    | 'ADD_CUSTOMER'
    | 'ADD_PRODUCT'
    | 'UPDATE_INVENTORY'
    | 'CREATE_PRODUCT'
    | 'UPDATE_STOCK'
    | 'CREATE_EXPENSE'
    | 'SHOW_REPORT';
  label: string;
  payload: Record<string, any>;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
  pendingAction?: AssistantAction;
  webSources?: Array<{ title: string; url: string }>;
}

export interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}
