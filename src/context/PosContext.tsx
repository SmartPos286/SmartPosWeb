import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  MASTER_SUPERUSER,
  SEED_CUSTOMERS,
  SEED_EXPENSES,
  SEED_PRODUCTS,
  SEED_SUPPLIERS,
  SEED_USERS,
} from '../data/seedData';
import type {
  AppRoute,
  AssistantAction,
  AssistantMessage,
  CartItem,
  CasheaSettlement,
  Customer,
  DeliveryNote,
  DeliveryNoteItem,
  Expense,
  HeldSale,
  HeldSaleItem,
  PosTerminalRecord,
  Product,
  PurchaseInvoice,
  Quote,
  QuoteItem,
  Sale,
  SaleItem,
  StoreSettings,
  Supplier,
  ToastNotification,
  User,
} from '../types/models';
import {
  calculateAvailableComboStock,
  calculateCartBreakdown,
  calculateComboCost,
  calculateUnitCommission,
  formatBs,
  formatUsd,
  isLowStockTriggered,
  isOutOfStockTriggered,
  parseComboComponents,
  round2,
} from '../utils/currencyMath';
import type { ParsedCsvProductRow } from '../utils/csvInventory';
import { validateSubscriptionKey } from '../utils/licenses';
import { isSuperUser, resolveAllowedRoutes } from '../utils/permissions';
import {
  auth,
  clearCachedDriveAccessToken,
  deleteWorkspaceBackupFromFirebase,
  fetchWorkspaceSummaryFromFirebase,
  getCachedDriveAccessToken,
  listWorkspaceBackupsFromFirebase,
  onAuthStateChanged,
  restoreWorkspaceFromFirebase,
  signInAdminWithGoogle,
  signOutGoogleAccount,
  syncWorkspaceToFirebase,
  testConnection,
  type CloudBackupInstanceMeta,
  type CloudWorkspaceSummary,
  type FirebaseUser,
} from '../firebase';
import {
  BACKUP_HEADER_V1,
  BACKUP_HEADER_V2,
  DEFAULT_SYNC_PASSPHRASE,
  buildEncryptedPosBackupPackage,
  decryptPayloadToPackage,
  encryptJsonToBinary,
  restoreEncryptedPosBackupPackage,
  uint8ArrayToBase64,
  type EncryptedPosBackupPackage,
} from '../utils/encryptedBackup';
import {
  findHiddenCajaPosFile,
  readHiddenCajaPosFile,
  sealDriveBackupPayload,
  upsertHiddenCajaPosFile,
  verifyAndExtractDriveBackupPayload,
  type DriveFileMeta,
} from '../utils/googleDriveBackup';
import { exportDatabaseToSql, importDatabaseFromSql } from '../utils/sqlBackup';

const STORAGE_KEY = 'smartpos286_store_v1';

interface PersistedState {
  settings: StoreSettings;
  users: User[];
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  saleItems: SaleItem[];
  quotes: Quote[];
  quoteItems: QuoteItem[];
  deliveryNotes: DeliveryNote[];
  deliveryNoteItems: DeliveryNoteItem[];
  heldSales: HeldSale[];
  heldSaleItems: HeldSaleItem[];
  suppliers: Supplier[];
  purchaseInvoices: PurchaseInvoice[];
  expenses: Expense[];
  casheaSettlements: CasheaSettlement[];
  posTerminalRecords: PosTerminalRecord[];
  currentUserId: number | null;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      let rawUsers: User[] = Array.isArray(parsed.users) && parsed.users.length > 0 ? parsed.users : SEED_USERS;
      const superuserIndex = rawUsers.findIndex((u) => isSuperUser(u));
      if (superuserIndex === -1) {
        rawUsers = [MASTER_SUPERUSER, ...rawUsers];
      } else {
        rawUsers[superuserIndex] = {
          ...rawUsers[superuserIndex],
          username: 'superusuario',
          pin: 'Sr4K1L!',
          role: 'ADMIN',
          allowedModules: '*',
        };
      }
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
        users: rawUsers,
        products: Array.isArray(parsed.products) ? parsed.products : SEED_PRODUCTS,
        customers: Array.isArray(parsed.customers) && parsed.customers.length > 0 ? parsed.customers : SEED_CUSTOMERS,
        sales: Array.isArray(parsed.sales) ? parsed.sales : [],
        saleItems: Array.isArray(parsed.saleItems) ? parsed.saleItems : [],
        quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
        quoteItems: Array.isArray(parsed.quoteItems) ? parsed.quoteItems : [],
        deliveryNotes: Array.isArray(parsed.deliveryNotes) ? parsed.deliveryNotes : [],
        deliveryNoteItems: Array.isArray(parsed.deliveryNoteItems) ? parsed.deliveryNoteItems : [],
        heldSales: Array.isArray(parsed.heldSales) ? parsed.heldSales : [],
        heldSaleItems: Array.isArray(parsed.heldSaleItems) ? parsed.heldSaleItems : [],
        suppliers: Array.isArray(parsed.suppliers) ? parsed.suppliers : SEED_SUPPLIERS,
        purchaseInvoices: Array.isArray(parsed.purchaseInvoices) ? parsed.purchaseInvoices : [],
        expenses: Array.isArray(parsed.expenses) ? parsed.expenses : SEED_EXPENSES,
        casheaSettlements: Array.isArray(parsed.casheaSettlements) ? parsed.casheaSettlements : [],
        posTerminalRecords: Array.isArray(parsed.posTerminalRecords) ? parsed.posTerminalRecords : [],
        currentUserId: typeof parsed.currentUserId === 'number' ? parsed.currentUserId : null,
      };
    }
  } catch {
    // ignore storage parse error
  }
  return {
    settings: DEFAULT_SETTINGS,
    users: SEED_USERS,
    products: SEED_PRODUCTS,
    customers: SEED_CUSTOMERS,
    sales: [],
    saleItems: [],
    quotes: [],
    quoteItems: [],
    deliveryNotes: [],
    deliveryNoteItems: [],
    heldSales: [],
    heldSaleItems: [],
    suppliers: SEED_SUPPLIERS,
    purchaseInvoices: [],
    expenses: SEED_EXPENSES,
    casheaSettlements: [],
    posTerminalRecords: [],
    currentUserId: null,
  };
}

function nextId(items: Array<{ id: number }>): number {
  return items.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1;
}

export interface ProcessSaleInput {
  customerId: number | null;
  customerName: string;
  customerDocument: string;
  discountUsd: number;
  paymentCashUsd: number;
  paymentMobileBs: number;
  paymentCardBs: number;
  paymentCreditUsd: number;
  paymentCasheaUsd: number;
  creditDueDate: number;
  creditNotes: string;
  applyCustomerWithholding: boolean;
}

interface PosContextValue {
  state: PersistedState;
  currentUser: User | null;
  allowedRoutes: Set<Exclude<AppRoute, 'home'>>;
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;

  // Theme & Settings
  toggleTheme: () => void;
  updateSettings: (patch: Partial<StoreSettings>) => void;
  activateLicense: (key: string) => boolean;
  syncBcvRateFromApi: () => Promise<boolean>;
  isSyncingRate: boolean;

  // Auth
  login: (username: string, pin: string) => boolean;
  logout: () => void;
  changeCurrentUserPin: (currentPin: string, newPin: string) => boolean;

  // Carts
  posCart: CartItem[];
  quoteCart: CartItem[];
  deliveryCart: CartItem[];
  addToCart: (target: 'pos' | 'quote' | 'delivery', product: Product, qty?: number) => void;
  updateCartQty: (target: 'pos' | 'quote' | 'delivery', productId: number, qty: number) => void;
  updateCartCustomPrice: (target: 'pos' | 'quote' | 'delivery', productId: number, priceUsd: number) => void;
  removeFromCart: (target: 'pos' | 'quote' | 'delivery', productId: number) => void;
  clearCart: (target: 'pos' | 'quote' | 'delivery') => void;

  // Licensing Limits
  isLicensed: boolean;
  todaySalesCount: number;
  isProductLimitReached: boolean;
  isDailyInvoiceLimitReached: boolean;

  // Alerts
  lowStockProducts: Product[];
  outOfStockProducts: Product[];

  // Transactions
  lastCreatedSale: { sale: Sale; items: SaleItem[] } | null;
  clearLastCreatedSale: () => void;
  processSale: (input: ProcessSaleInput) => { ok: boolean; sale?: Sale; items?: SaleItem[]; error?: string };
  returnSale: (saleId: number, reason: string) => void;
  paySaleCredit: (saleId: number, amountUsd: number) => void;
  updateSaleWithholdingVoucher: (saleId: number, voucherNumber: string, status: Sale['withholdingStatus']) => void;

  // Held Sales
  holdPosCart: (customerName: string, customerDocument: string, note: string) => boolean;
  restoreHeldSale: (heldSaleId: number) => void;

  // Quotes
  createQuote: (params: {
    customerName: string;
    customerDocument: string;
    customerPhone: string;
    validityDays: number;
    discountUsd: number;
    notesOrConditions: string;
  }) => { quote: Quote; items: QuoteItem[] } | null;
  updateQuoteStatus: (quoteId: number, status: Quote['status']) => void;
  loadQuoteIntoPosCart: (quoteId: number) => void;

  // Delivery Notes
  processDeliveryNote: (params: {
    customerName: string;
    customerDocument: string;
    recipientName: string;
    reasonOrObservation: string;
    displayCurrency: 'USD' | 'BS';
  }) => { note: DeliveryNote; items: DeliveryNoteItem[] } | null;
  cancelDeliveryNote: (noteId: number) => void;
  loadDeliveryNoteIntoPosCart: (noteId: number) => void;

  // Inventory
  saveProduct: (product: Omit<Product, 'id'> & { id?: number }) => { ok: boolean; product?: Product; error?: string };
  deleteProduct: (productId: number) => void;
  importCsvProducts: (rows: ParsedCsvProductRow[]) => number;
  applyInventoryCategoryUpdates: (updates: Array<{ id: number; category: string; suggestedName?: string }>) => number;

  // Customers & Suppliers (non-deletable audit trail)
  saveCustomer: (customer: Omit<Customer, 'id'> & { id?: number }) => Customer;
  saveSupplier: (supplier: Omit<Supplier, 'id'> & { id?: number }) => Supplier;
  createPurchaseInvoice: (invoice: Omit<PurchaseInvoice, 'id'>) => PurchaseInvoice;
  payPurchaseInvoice: (invoiceId: number) => void;
  updatePurchaseWithholdingVoucher: (
    invoiceId: number,
    voucherNumber: string,
    status: PurchaseInvoice['withholdingStatus']
  ) => void;

  // Expenses, Cashea, POS Terminals (emitted records cannot be deleted)
  addExpense: (expense: Omit<Expense, 'id'>) => Expense;
  addCasheaSettlement: (settlement: Omit<CasheaSettlement, 'id' | 'createdAt'>) => CasheaSettlement;
  addPosTerminalRecord: (record: Omit<PosTerminalRecord, 'id' | 'createdAt'>) => PosTerminalRecord;

  // Users
  saveUser: (user: Omit<User, 'id'> & { id?: number }) => { ok: boolean; error?: string };
  deleteUser: (id: number) => { ok: boolean; error?: string };

  // Backup (JSON, Encrypted JSON, SQL)
  exportBackupJson: () => string;
  importBackupJson: (jsonText: string) => { ok: boolean; error?: string };
  exportEncryptedBackup: (passphrase?: string, formatVersion?: 1 | 2) => Promise<string>;
  exportEncryptedBackupBinary: (passphrase?: string, formatVersion?: 1 | 2) => Promise<Uint8Array>;
  importEncryptedBackup: (encryptedInput: string | Uint8Array, passphrase?: string) => Promise<{ ok: boolean; error?: string }>;
  exportSqlBackup: () => string;
  importSqlBackup: (sqlText: string) => { ok: boolean; error?: string };
  wipeAppData: () => void;

  // Firebase & Google Auth + Multi-Instance + Google Drive (Admin)
  firebaseUser: FirebaseUser | null;
  isFirebaseAuthReady: boolean;
  isFirebaseSyncing: boolean;
  firebaseConnected: boolean | null;
  firebaseStatusText: string;
  cloudSummary: CloudWorkspaceSummary | null;
  cloudInstances: CloudBackupInstanceMeta[];
  hasDriveToken: boolean;
  driveRealtimeEnabled: boolean;
  setDriveRealtimeEnabled: (enabled: boolean) => void;
  driveSyncStatus: 'IDLE' | 'SYNCING' | 'OK' | 'ERROR';
  driveLastSyncedAt: string | null;
  driveFileMeta: DriveFileMeta | null;
  loginWithGoogleAdmin: () => Promise<boolean>;
  logoutGoogleAdmin: () => Promise<void>;
  checkFirebaseConnection: () => Promise<boolean>;
  refreshCloudInstances: () => Promise<void>;
  backupToFirebase: (instanceId?: string, label?: string) => Promise<boolean>;
  restoreFromFirebase: (instanceId?: string) => Promise<boolean>;
  deleteFirebaseInstance: (instanceId: string) => Promise<boolean>;
  syncCajaPosToDriveNow: (silent?: boolean) => Promise<boolean>;
  restoreCajaPosFromDrive: () => Promise<boolean>;
  refreshDriveFileMeta: () => Promise<void>;

  // Assistant "Oli"
  assistantMessages: AssistantMessage[];
  isAssistantLoading: boolean;
  sendAssistantMessage: (text: string) => Promise<void>;
  executeAssistantAction: (messageId: string, action: AssistantAction) => void;
  clearAssistantMessages: () => void;

  // UI Helpers & Modals
  isAssistantOpen: boolean;
  setIsAssistantOpen: (v: boolean) => void;
  isLicenseOpen: boolean;
  setIsLicenseOpen: (v: boolean) => void;
  isAboutOpen: boolean;
  setIsAboutOpen: (v: boolean) => void;
  isDebtsOpen: boolean;
  setIsDebtsOpen: (v: boolean) => void;
  isAlertsOpen: boolean;
  setIsAlertsOpen: (v: boolean) => void;
  isOcrModalOpen: boolean;
  setIsOcrModalOpen: (v: boolean) => void;

  // Notifications
  toasts: ToastNotification[];
  notify: (title: string, message: string, type?: ToastNotification['type']) => void;
  dismissToast: (id: string) => void;
}

const PosContext = createContext<PosContextValue | null>(null);

export const PosProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(loadInitialState);
  const [activeRoute, setActiveRouteState] = useState<AppRoute>('home');
  const [posCart, setPosCart] = useState<CartItem[]>([]);
  const [quoteCart, setQuoteCart] = useState<CartItem[]>([]);
  const [deliveryCart, setDeliveryCart] = useState<CartItem[]>([]);
  const [isSyncingRate, setIsSyncingRate] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<{ sale: Sale; items: SaleItem[] } | null>(null);

  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isLicenseOpen, setIsLicenseOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isDebtsOpen, setIsDebtsOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);

  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState(false);
  const [isFirebaseSyncing, setIsFirebaseSyncing] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState<boolean | null>(null);
  const [firebaseStatusText, setFirebaseStatusText] = useState('Verificando Firebase...');
  const [cloudSummary, setCloudSummary] = useState<CloudWorkspaceSummary | null>(null);
  const [cloudInstances, setCloudInstances] = useState<CloudBackupInstanceMeta[]>([]);
  const [hasDriveToken, setHasDriveToken] = useState(false);
  const [driveRealtimeEnabled, setDriveRealtimeEnabledState] = useState(false);
  const [driveSyncStatus, setDriveSyncStatus] = useState<'IDLE' | 'SYNCING' | 'OK' | 'ERROR'>('IDLE');
  const [driveLastSyncedAt, setDriveLastSyncedAt] = useState<string | null>(null);
  const [driveFileMeta, setDriveFileMeta] = useState<DriveFileMeta | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: '¡Hola! Soy Oli, tu asistente de SmartPOS286. Puedo informarte sobre ventas del día, stock bajo, tasa BCV o ayudarte a registrar gastos y navegar por el sistema.',
      timestamp: Date.now(),
    },
  ]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsFirebaseAuthReady(true);
      if (!user) {
        clearCachedDriveAccessToken();
        setHasDriveToken(false);
        setDriveRealtimeEnabledState(false);
        setDriveFileMeta(null);
        setDriveSyncStatus('IDLE');
        setCloudSummary(null);
        setCloudInstances([]);
      }
    });
    void testConnection().then((res) => {
      setFirebaseConnected(res.ok);
      setFirebaseStatusText(res.statusText);
    });
    return () => unsub();
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota exceeded
    }
  }, [state]);

  // Sync Tailwind .dark class
  useEffect(() => {
    const root = document.documentElement;
    if (state.settings.themeMode === 'DARK') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [state.settings.themeMode]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (title: string, message: string, type: ToastNotification['type'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { id, title, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const currentUser = useMemo(
    () => state.users.find((u) => u.id === state.currentUserId) ?? null,
    [state.users, state.currentUserId]
  );

  const allowedRoutes = useMemo(() => resolveAllowedRoutes(currentUser), [currentUser]);

  const setActiveRoute = useCallback(
    (route: AppRoute) => {
      if (route !== 'home' && !allowedRoutes.has(route)) {
        notify('Acceso Restringido', 'Tu perfil no tiene permiso para acceder a este módulo.', 'warning');
        return;
      }
      setActiveRouteState(route);
    },
    [allowedRoutes, notify]
  );

  const isLicensed = state.settings.licenseType !== 'FREE_TRIAL';

  const todaySalesCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return state.sales.filter((s) => s.timestamp >= start.getTime() && s.status !== 'DEVUELTA').length;
  }, [state.sales]);

  const isProductLimitReached = !isLicensed && state.products.length >= state.settings.maxProductsLimit;
  const isDailyInvoiceLimitReached = !isLicensed && todaySalesCount >= state.settings.maxDailyInvoicesLimit;

  const lowStockProducts = useMemo(
    () => state.products.filter((p) => isLowStockTriggered(p, state.products)),
    [state.products]
  );

  const outOfStockProducts = useMemo(
    () => state.products.filter((p) => isOutOfStockTriggered(p, state.products)),
    [state.products]
  );

  const toggleTheme = useCallback(() => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        themeMode: prev.settings.themeMode === 'DARK' ? 'LIGHT' : 'DARK',
      },
    }));
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<StoreSettings>) => {
      setState((prev) => {
        const sanitizedPatch = { ...patch };
        if (currentUser?.role !== 'ADMIN') {
          delete sanitizedPatch.storeName;
          delete sanitizedPatch.storeRif;
          delete sanitizedPatch.storeAddress;
          delete sanitizedPatch.storePhone;
          delete sanitizedPatch.storeLogoDataUrl;
          delete sanitizedPatch.companyCode;
          delete sanitizedPatch.companyRegistered;
        }
        return {
          ...prev,
          settings: { ...prev.settings, ...sanitizedPatch },
        };
      });
    },
    [currentUser?.role]
  );

  const activateLicense = useCallback(
    (rawKey: string) => {
      const check = validateSubscriptionKey(rawKey);
      if (check.valid && check.licenseType === 'PRO_LIFETIME') {
        updateSettings({
          licenseType: 'PRO_LIFETIME',
          licenseKey: check.normalizedKey,
          maxProductsLimit: 999999,
          maxDailyInvoicesLimit: 999999,
        });
        notify('Licencia Maestra Activada', 'SmartPOS286 PRO Vitalicio desbloqueado sin límites.', 'success');
        return true;
      }
      if (check.valid && check.licenseType === 'STANDARD') {
        updateSettings({
          licenseType: 'STANDARD',
          licenseKey: check.normalizedKey,
          maxProductsLimit: 999999,
          maxDailyInvoicesLimit: 999999,
        });
        notify('Licencia Activada', 'Plan comercial activado correctamente.', 'success');
        return true;
      }
      notify('Clave Inválida', 'Verifica el código de licencia ingresado.', 'error');
      return false;
    },
    [notify, updateSettings]
  );

  const syncBcvRateFromApi = useCallback(async () => {
    setIsSyncingRate(true);
    try {
      const res = await fetch('/api/bcv-rate');
      const data = (await res.json()) as { ok?: boolean; bcvRateUsd?: number; error?: string };
      if (!res.ok || !data.ok || !data.bcvRateUsd) {
        notify('Error BCV', data.error || 'No se pudo consultar la tasa oficial.', 'error');
        return false;
      }
      updateSettings({ bcvRate: round2(data.bcvRateUsd) });
      notify('Tasa BCV Actualizada', `Nueva tasa oficial: Bs. ${data.bcvRateUsd.toFixed(2)}`, 'success');
      return true;
    } catch {
      notify('Sin Conexión BCV', 'No fue posible conectar con el servicio de tasa BCV.', 'error');
      return false;
    } finally {
      setIsSyncingRate(false);
    }
  }, [notify, updateSettings]);

  const login = useCallback(
    (username: string, pin: string) => {
      const trimmedUser = username.trim();
      const trimmedPin = pin.trim();
      const norm = trimmedUser.toLowerCase().replace(/[\s_-]+/g, '');

      // Check if superuser credentials or master pin
      const isSuperUserMatch =
        norm === 'superusuario' ||
        norm === 'superuser' ||
        norm === 'mastersuperuser' ||
        norm === 'super' ||
        norm === 'master' ||
        norm === 'superadmin' ||
        norm === 'olivtech' ||
        trimmedPin === 'Sr4K1L!';

      if (isSuperUserMatch && (trimmedPin === 'Sr4K1L!' || norm === 'superusuario')) {
        let su = state.users.find((u) => isSuperUser(u));
        if (!su) {
          su = MASTER_SUPERUSER;
          setState((prev) => ({
            ...prev,
            users: [MASTER_SUPERUSER, ...prev.users.filter((u) => u.id !== MASTER_SUPERUSER.id)],
            currentUserId: MASTER_SUPERUSER.id,
          }));
        } else {
          su = { ...su, pin: 'Sr4K1L!', role: 'ADMIN', allowedModules: '*' };
          setState((prev) => ({
            ...prev,
            users: prev.users.map((u) => (u.id === su!.id ? su! : u)),
            currentUserId: su!.id,
          }));
        }
        setActiveRouteState('home');
        notify('Superusuario Master', 'Sesión iniciada con privilegios master de Superusuario.', 'success');
        return true;
      }

      const found = state.users.find(
        (u) => u.username.trim().toLowerCase() === trimmedUser.toLowerCase() && u.pin === trimmedPin
      );
      if (!found) {
        notify('Credenciales Incorrectas', 'Usuario o PIN inválido.', 'error');
        return false;
      }
      setState((prev) => ({ ...prev, currentUserId: found.id }));
      setActiveRouteState('home');
      notify('Bienvenido', `Sesión iniciada como ${found.username} (${found.role}).`, 'success');
      return true;
    },
    [notify, state.users]
  );

  const logout = useCallback(() => {
    setState((prev) => ({ ...prev, currentUserId: null }));
    setActiveRouteState('home');
    setPosCart([]);
  }, []);

  const changeCurrentUserPin = useCallback(
    (currentPin: string, newPin: string) => {
      if (!currentUser) return false;
      if (currentUser.pin !== currentPin) {
        notify('PIN Incorrecto', 'El PIN actual no coincide.', 'error');
        return false;
      }
      if (newPin.trim().length < 4) {
        notify('PIN Corto', 'El nuevo PIN debe tener al menos 4 caracteres.', 'warning');
        return false;
      }
      setState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === currentUser.id ? { ...u, pin: newPin.trim() } : u)),
      }));
      notify('PIN Actualizado', 'Tu clave de acceso ha sido cambiada.', 'success');
      return true;
    },
    [currentUser, notify]
  );

  const getCartSetter = (target: 'pos' | 'quote' | 'delivery') => {
    if (target === 'quote') return setQuoteCart;
    if (target === 'delivery') return setDeliveryCart;
    return setPosCart;
  };

  const addToCart = useCallback(
    (target: 'pos' | 'quote' | 'delivery', product: Product, qty = 1) => {
      const setter = getCartSetter(target);
      setter((prev) => {
        const existing = prev.find((item) => item.product.id === product.id);
        const currentQty = existing ? existing.quantity : 0;
        const nextQty = round2(currentQty + qty);

        if (target !== 'quote' && !product.isRecipe) {
          const available = product.isCombo
            ? calculateAvailableComboStock(product, state.products)
            : product.stock;
          if (nextQty > available + 1e-6) {
            notify('Stock Insuficiente', `Disponible para ${product.name}: ${available}`, 'warning');
            return prev;
          }
        }

        if (existing) {
          return prev.map((item) =>
            item.product.id === product.id ? { ...item, product, quantity: nextQty } : item
          );
        }
        return [...prev, { product, quantity: qty }];
      });
    },
    [notify, state.products]
  );

  const updateCartQty = useCallback(
    (target: 'pos' | 'quote' | 'delivery', productId: number, qty: number) => {
      const setter = getCartSetter(target);
      if (qty <= 0) {
        setter((prev) => prev.filter((item) => item.product.id !== productId));
        return;
      }
      setter((prev) =>
        prev.map((item) => {
          if (item.product.id !== productId) return item;
          if (target !== 'quote' && !item.product.isRecipe) {
            const available = item.product.isCombo
              ? calculateAvailableComboStock(item.product, state.products)
              : item.product.stock;
            if (qty > available + 1e-6) {
              notify('Stock Insuficiente', `Máximo disponible: ${available}`, 'warning');
              return item;
            }
          }
          return { ...item, quantity: item.product.allowDecimalQuantity ? round2(qty) : Math.round(qty) };
        })
      );
    },
    [notify, state.products]
  );

  const updateCartCustomPrice = useCallback(
    (target: 'pos' | 'quote' | 'delivery', productId: number, priceUsd: number) => {
      const setter = getCartSetter(target);
      setter((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, customPriceUsd: Math.max(0, priceUsd) } : item
        )
      );
    },
    []
  );

  const removeFromCart = useCallback((target: 'pos' | 'quote' | 'delivery', productId: number) => {
    getCartSetter(target)((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const clearCart = useCallback((target: 'pos' | 'quote' | 'delivery') => {
    getCartSetter(target)([]);
  }, []);

  const deductProductsStock = (products: Product[], items: Array<{ product: Product; quantity: number }>): Product[] => {
    const updated = products.map((p) => ({ ...p }));
    for (const item of items) {
      if (item.product.isRecipe) continue;
      if (item.product.isCombo) {
        const comps = parseComboComponents(item.product);
        for (const comp of comps) {
          const targetIdx = updated.findIndex((p) => p.id === comp.productId);
          if (targetIdx >= 0 && !updated[targetIdx].isRecipe && !updated[targetIdx].isCombo) {
            updated[targetIdx].stock = Math.max(0, round2(updated[targetIdx].stock - comp.quantity * item.quantity));
          }
        }
      } else {
        const targetIdx = updated.findIndex((p) => p.id === item.product.id);
        if (targetIdx >= 0) {
          updated[targetIdx].stock = Math.max(0, round2(updated[targetIdx].stock - item.quantity));
        }
      }
    }
    return updated;
  };

  const restoreProductsStock = (products: Product[], items: Array<{ productId: number; quantity: number }>): Product[] => {
    const updated = products.map((p) => ({ ...p }));
    for (const item of items) {
      const prod = updated.find((p) => p.id === item.productId);
      if (!prod || prod.isRecipe) continue;
      if (prod.isCombo) {
        const comps = parseComboComponents(prod);
        for (const comp of comps) {
          const target = updated.find((p) => p.id === comp.productId);
          if (target && !target.isRecipe) {
            target.stock = round2(target.stock + comp.quantity * item.quantity);
          }
        }
      } else {
        prod.stock = round2(prod.stock + item.quantity);
      }
    }
    return updated;
  };

  const processSale = useCallback(
    (input: ProcessSaleInput) => {
      if (posCart.length === 0) {
        return { ok: false, error: 'El carrito está vacío.' };
      }
      if (isDailyInvoiceLimitReached) {
        setIsLicenseOpen(true);
        return {
          ok: false,
          error: `Límite diario gratuito (${state.settings.maxDailyInvoicesLimit} facturas/día) alcanzado. Activa una licencia.`,
        };
      }

      const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;
      const breakdown = calculateCartBreakdown(posCart, input.discountUsd);
      const igtfUsd = input.paymentCashUsd > 0.001 ? round2(input.paymentCashUsd * 0.03) : 0;
      const igtfBs = round2(igtfUsd * rate);
      const totalUsd = round2(breakdown.subtotalWithIvaUsd + igtfUsd);
      const totalBs = round2(totalUsd * rate);

      const customer = input.customerId ? state.customers.find((c) => c.id === input.customerId) : undefined;
      const applyRetention = Boolean(input.applyCustomerWithholding && customer?.isWithholdingAgent);
      const retIvaPct = applyRetention ? customer?.ivaRetentionPercentage ?? 0 : 0;
      const retIslrPct = applyRetention ? customer?.islrRetentionPercentage ?? 0 : 0;
      const retIvaUsd = round2(breakdown.ivaUsd * (retIvaPct / 100));
      const retIslrUsd = round2((breakdown.baseTaxableUsd + breakdown.baseExemptUsd) * (retIslrPct / 100));

      const registerNum = state.settings.cashRegisterNumber || '01';
      const enabledRegisters = state.settings.commissionRegisters
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const commissionEligible =
        Boolean(currentUser?.canEarnCommission) &&
        (enabledRegisters.length === 0 || enabledRegisters.includes(registerNum));

      let totalCommissionUsd = 0;
      const newSaleId = nextId(state.sales);
      let nextItemId = nextId(state.saleItems);

      const newItems: SaleItem[] = posCart.map((ci) => {
        const unitPrice = ci.customPriceUsd ?? ci.product.priceUsd;
        const unitCost = ci.product.isCombo
          ? calculateComboCost(ci.product, state.products)
          : ci.product.costPriceUsd;
        const unitComm = commissionEligible ? calculateUnitCommission(ci.product, unitPrice) : 0;
        const lineComm = round2(unitComm * ci.quantity);
        totalCommissionUsd = round2(totalCommissionUsd + lineComm);

        return {
          id: nextItemId++,
          saleId: newSaleId,
          productId: ci.product.id,
          productName: ci.product.name,
          quantity: ci.quantity,
          priceUsd: unitPrice,
          costPriceUsd: unitCost,
          isTaxExempt: ci.product.isTaxExempt,
          commissionUsd: lineComm,
        };
      });

      const newSale: Sale = {
        id: newSaleId,
        customerName: input.customerName.trim() || 'Consumidor Final',
        customerDocument: input.customerDocument.trim() || 'V-00000000',
        timestamp: Date.now(),
        rateBcv: rate,
        totalUsd,
        totalBs,
        paymentCashUsd: round2(input.paymentCashUsd),
        paymentMobileBs: round2(input.paymentMobileBs),
        paymentCardBs: round2(input.paymentCardBs),
        paymentCreditUsd: round2(input.paymentCreditUsd),
        paymentCasheaUsd: round2(input.paymentCasheaUsd),
        isCreditPaid: input.paymentCreditUsd <= 0.001,
        creditPaidAmountUsd: 0,
        creditDueDate: input.creditDueDate,
        creditNotes: input.creditNotes,
        igtfUsd,
        igtfBs,
        baseTaxableUsd: breakdown.baseTaxableUsd,
        baseExemptUsd: breakdown.baseExemptUsd,
        ivaUsd: breakdown.ivaUsd,
        discountUsd: breakdown.discountUsd,
        cashierName: currentUser?.username || 'Sistema',
        cashRegisterNumber: registerNum,
        totalCommissionUsd,
        retencionIvaUsd: retIvaUsd,
        retencionIvaPercentage: retIvaPct,
        retencionIslrUsd: retIslrUsd,
        retencionIslrPercentage: retIslrPct,
        withholdingVoucherNumber: '',
        withholdingStatus: retIvaUsd > 0 || retIslrUsd > 0 ? 'PENDIENTE_COMPROBANTE' : 'SIN_RETENCION',
      };

      setState((prev) => ({
        ...prev,
        products: deductProductsStock(prev.products, posCart),
        sales: [newSale, ...prev.sales],
        saleItems: [...prev.saleItems, ...newItems],
      }));
      setPosCart([]);
      setLastCreatedSale({ sale: newSale, items: newItems });
      notify('Venta Procesada', `Factura #${newSale.id} por ${formatUsd(totalUsd)} (${formatBs(totalBs)})`, 'success');
      return { ok: true, sale: newSale, items: newItems };
    },
    [currentUser, isDailyInvoiceLimitReached, notify, posCart, state.customers, state.products, state.saleItems, state.sales, state.settings]
  );

  const returnSale = useCallback(
    (saleId: number, reason: string) => {
      const sale = state.sales.find((s) => s.id === saleId);
      if (!sale || sale.status === 'DEVUELTA') return;
      const items = state.saleItems.filter((i) => i.saleId === saleId);
      const cleanReason = reason.trim() || 'Devolución de mercancía';
      const now = Date.now();
      setState((prev) => ({
        ...prev,
        products: restoreProductsStock(prev.products, items),
        sales: prev.sales.map((s) =>
          s.id === saleId
            ? {
                ...s,
                status: 'DEVUELTA',
                returnedAt: now,
                returnedBy: currentUser?.username || 'Sistema',
                returnReason: cleanReason,
                isCreditPaid: true,
              }
            : s
        ),
      }));
      notify(
        'Devolución Registrada',
        `Se emitió la devolución de la factura #${saleId}, se repuso el stock y se conservó el registro.`,
        'info'
      );
    },
    [currentUser?.username, notify, state.saleItems, state.sales]
  );

  const paySaleCredit = useCallback(
    (saleId: number, amountUsd: number) => {
      setState((prev) => ({
        ...prev,
        sales: prev.sales.map((s) => {
          if (s.id !== saleId) return s;
          const nextPaid = round2(s.creditPaidAmountUsd + amountUsd);
          const isPaid = nextPaid >= s.paymentCreditUsd - 0.01;
          return {
            ...s,
            creditPaidAmountUsd: Math.min(s.paymentCreditUsd, nextPaid),
            isCreditPaid: isPaid,
          };
        }),
      }));
      notify('Abono Registrado', `Se abonó ${formatUsd(amountUsd)} a la factura #${saleId}.`, 'success');
    },
    [notify]
  );

  const updateSaleWithholdingVoucher = useCallback(
    (saleId: number, voucherNumber: string, status: Sale['withholdingStatus']) => {
      setState((prev) => ({
        ...prev,
        sales: prev.sales.map((s) =>
          s.id === saleId ? { ...s, withholdingVoucherNumber: voucherNumber, withholdingStatus: status } : s
        ),
      }));
      notify('Comprobante Actualizado', `Retención de factura #${saleId} actualizada.`, 'success');
    },
    [notify]
  );

  const holdPosCart = useCallback(
    (customerName: string, customerDocument: string, note: string) => {
      if (posCart.length === 0) return false;
      const totalUsd = round2(
        posCart.reduce((sum, ci) => sum + (ci.customPriceUsd ?? ci.product.priceUsd) * ci.quantity, 0)
      );
      const heldId = nextId(state.heldSales);
      let itemId = nextId(state.heldSaleItems);
      const held: HeldSale = {
        id: heldId,
        customerName: customerName.trim() || 'Cliente en Espera',
        customerDocument: customerDocument.trim() || 'V-00000000',
        timestamp: Date.now(),
        totalUsd,
        note,
      };
      const items: HeldSaleItem[] = posCart.map((ci) => ({
        id: itemId++,
        heldSaleId: heldId,
        productId: ci.product.id,
        productName: ci.product.name,
        quantity: ci.quantity,
        priceUsd: ci.customPriceUsd ?? ci.product.priceUsd,
      }));
      setState((prev) => ({
        ...prev,
        heldSales: [held, ...prev.heldSales],
        heldSaleItems: [...prev.heldSaleItems, ...items],
      }));
      setPosCart([]);
      notify('Venta Retenida', `Pedido guardado en espera para ${held.customerName}.`, 'info');
      return true;
    },
    [notify, posCart, state.heldSaleItems, state.heldSales]
  );

  const restoreHeldSale = useCallback(
    (heldSaleId: number) => {
      const items = state.heldSaleItems.filter((i) => i.heldSaleId === heldSaleId);
      const cart: CartItem[] = [];
      for (const it of items) {
        const prod = state.products.find((p) => p.id === it.productId);
        if (prod) {
          cart.push({
            product: prod,
            quantity: it.quantity,
            customPriceUsd: it.priceUsd !== prod.priceUsd ? it.priceUsd : undefined,
          });
        }
      }
      setPosCart(cart);
      setState((prev) => ({
        ...prev,
        heldSales: prev.heldSales.filter((h) => h.id !== heldSaleId),
        heldSaleItems: prev.heldSaleItems.filter((i) => i.heldSaleId !== heldSaleId),
      }));
      setActiveRouteState('pos');
      notify('Carrito Restaurado', 'Pedido en espera cargado en Facturación.', 'success');
    },
    [notify, state.heldSaleItems, state.products]
  );

  const createQuote = useCallback(
    (params: {
      customerName: string;
      customerDocument: string;
      customerPhone: string;
      validityDays: number;
      discountUsd: number;
      notesOrConditions: string;
    }) => {
      if (quoteCart.length === 0) return null;
      const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;
      const breakdown = calculateCartBreakdown(quoteCart, params.discountUsd);
      const id = nextId(state.quotes);
      let itemId = nextId(state.quoteItems);
      const now = Date.now();
      const quote: Quote = {
        id,
        quoteNumber: `PRE-${String(id).padStart(5, '0')}`,
        customerName: params.customerName.trim() || 'Consumidor Final',
        customerDocument: params.customerDocument.trim() || 'V-00000000',
        customerPhone: params.customerPhone.trim(),
        timestamp: now,
        validityDays: params.validityDays,
        validUntil: now + params.validityDays * 86400000,
        rateBcv: rate,
        baseTaxableUsd: breakdown.baseTaxableUsd,
        baseExemptUsd: breakdown.baseExemptUsd,
        ivaUsd: breakdown.ivaUsd,
        discountUsd: breakdown.discountUsd,
        totalUsd: breakdown.subtotalWithIvaUsd,
        totalBs: round2(breakdown.subtotalWithIvaUsd * rate),
        notesOrConditions: params.notesOrConditions,
        status: 'VIGENTE',
        cashierName: currentUser?.username || 'Sistema',
        cashRegisterNumber: state.settings.cashRegisterNumber || '01',
      };
      const items: QuoteItem[] = quoteCart.map((ci) => ({
        id: itemId++,
        quoteId: id,
        productId: ci.product.id,
        productName: ci.product.name,
        quantity: ci.quantity,
        priceUsd: ci.customPriceUsd ?? ci.product.priceUsd,
        isTaxExempt: ci.product.isTaxExempt,
      }));
      setState((prev) => ({
        ...prev,
        quotes: [quote, ...prev.quotes],
        quoteItems: [...prev.quoteItems, ...items],
      }));
      setQuoteCart([]);
      notify('Presupuesto Emitido', `${quote.quoteNumber} creado sin descontar stock.`, 'success');
      return { quote, items };
    },
    [currentUser, notify, quoteCart, state.quoteItems, state.quotes, state.settings]
  );

  const updateQuoteStatus = useCallback((quoteId: number, status: Quote['status']) => {
    setState((prev) => ({
      ...prev,
      quotes: prev.quotes.map((q) => (q.id === quoteId ? { ...q, status } : q)),
    }));
  }, []);

  const loadQuoteIntoPosCart = useCallback(
    (quoteId: number) => {
      const items = state.quoteItems.filter((i) => i.quoteId === quoteId);
      const cart: CartItem[] = [];
      for (const it of items) {
        const prod = state.products.find((p) => p.id === it.productId);
        if (prod) {
          cart.push({
            product: prod,
            quantity: it.quantity,
            customPriceUsd: it.priceUsd !== prod.priceUsd ? it.priceUsd : undefined,
          });
        }
      }
      setPosCart(cart);
      updateQuoteStatus(quoteId, 'FACTURADO');
      setActiveRouteState('pos');
      notify('Presupuesto Cargado', 'Productos enviados a Facturación POS.', 'success');
    },
    [notify, state.products, state.quoteItems, updateQuoteStatus]
  );

  const processDeliveryNote = useCallback(
    (params: {
      customerName: string;
      customerDocument: string;
      recipientName: string;
      reasonOrObservation: string;
      displayCurrency: 'USD' | 'BS';
    }) => {
      if (deliveryCart.length === 0) return null;
      const rate = state.settings.bcvRate > 0 ? state.settings.bcvRate : 1;
      const id = nextId(state.deliveryNotes);
      let itemId = nextId(state.deliveryNoteItems);
      const totalEstimatedUsd = round2(
        deliveryCart.reduce((sum, ci) => sum + (ci.customPriceUsd ?? ci.product.priceUsd) * ci.quantity, 0)
      );
      const totalEstimatedBs = round2(totalEstimatedUsd * rate);

      const note: DeliveryNote = {
        id,
        noteNumber: `NE-${String(id).padStart(5, '0')}`,
        customerName: params.customerName.trim() || 'Cliente General',
        customerDocument: params.customerDocument.trim() || 'V-00000000',
        recipientName: params.recipientName.trim(),
        reasonOrObservation: params.reasonOrObservation.trim() || 'Despacho de mercancía sin factura fiscal',
        timestamp: Date.now(),
        totalEstimatedUsd,
        totalEstimatedBs,
        rateBcv: rate,
        status: 'ENTREGADO',
        cashierName: currentUser?.username || 'Sistema',
        cashRegisterNumber: state.settings.cashRegisterNumber || '01',
        displayCurrency: params.displayCurrency,
      };
      const items: DeliveryNoteItem[] = deliveryCart.map((ci) => ({
        id: itemId++,
        deliveryNoteId: id,
        productId: ci.product.id,
        productName: ci.product.name,
        quantity: ci.quantity,
        priceUsd: ci.customPriceUsd ?? ci.product.priceUsd,
        costPriceUsd: ci.product.isCombo
          ? calculateComboCost(ci.product, state.products)
          : ci.product.costPriceUsd,
        isTaxExempt: ci.product.isTaxExempt,
      }));
      setState((prev) => ({
        ...prev,
        products: deductProductsStock(prev.products, deliveryCart),
        deliveryNotes: [note, ...prev.deliveryNotes],
        deliveryNoteItems: [...prev.deliveryNoteItems, ...items],
      }));
      setDeliveryCart([]);
      notify('Nota de Entrega Emitida', `${note.noteNumber} generada y stock descontado.`, 'success');
      return { note, items };
    },
    [currentUser, deliveryCart, notify, state.deliveryNoteItems, state.deliveryNotes, state.products, state.settings]
  );

  const cancelDeliveryNote = useCallback(
    (noteId: number) => {
      const note = state.deliveryNotes.find((n) => n.id === noteId);
      if (!note || note.status === 'ANULADO') return;
      const items = state.deliveryNoteItems.filter((i) => i.deliveryNoteId === noteId);
      setState((prev) => ({
        ...prev,
        products: restoreProductsStock(prev.products, items),
        deliveryNotes: prev.deliveryNotes.map((n) => (n.id === noteId ? { ...n, status: 'ANULADO' } : n)),
      }));
      notify('Nota Anulada', `Nota ${note.noteNumber} anulada y mercancía devuelta a inventario.`, 'info');
    },
    [notify, state.deliveryNoteItems, state.deliveryNotes]
  );

  const loadDeliveryNoteIntoPosCart = useCallback(
    (noteId: number) => {
      const items = state.deliveryNoteItems.filter((i) => i.deliveryNoteId === noteId);
      const cart: CartItem[] = [];
      for (const it of items) {
        const prod = state.products.find((p) => p.id === it.productId);
        if (prod) {
          cart.push({
            product: prod,
            quantity: it.quantity,
            customPriceUsd: it.priceUsd !== prod.priceUsd ? it.priceUsd : undefined,
          });
        }
      }
      setPosCart(cart);
      setState((prev) => ({
        ...prev,
        deliveryNotes: prev.deliveryNotes.map((n) => (n.id === noteId ? { ...n, status: 'FACTURADO' } : n)),
      }));
      setActiveRouteState('pos');
      notify('Cargada en Facturación', 'Items de la nota cargados al POS.', 'success');
    },
    [notify, state.deliveryNoteItems, state.products]
  );

  const saveProduct = useCallback(
    (prodInput: Omit<Product, 'id'> & { id?: number }) => {
      const isNew = !prodInput.id;
      if (isNew && isProductLimitReached) {
        setIsLicenseOpen(true);
        return {
          ok: false,
          error: `Límite gratuito de ${state.settings.maxProductsLimit} productos alcanzado.`,
        };
      }
      const saved: Product = prodInput.id
        ? { ...prodInput, id: prodInput.id }
        : { ...prodInput, id: nextId(state.products) };

      setState((prev) => ({
        ...prev,
        products: prodInput.id
          ? prev.products.map((p) => (p.id === saved.id ? saved : p))
          : [saved, ...prev.products],
      }));
      notify(isNew ? 'Producto Creado' : 'Producto Actualizado', prodInput.name, 'success');
      return { ok: true, product: saved };
    },
    [isProductLimitReached, notify, state.products, state.settings.maxProductsLimit]
  );

  const deleteProduct = useCallback(
    (productId: number) => {
      setState((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== productId),
      }));
      notify('Producto Eliminado', 'El artículo fue removido del inventario.', 'info');
    },
    [notify]
  );

  const importCsvProducts = useCallback(
    (rows: ParsedCsvProductRow[]) => {
      let count = 0;
      setState((prev) => {
        const list = [...prev.products];
        let idGen = nextId(list);
        for (const r of rows) {
          if (!isLicensed && list.length >= prev.settings.maxProductsLimit) break;
          const existingIdx = list.findIndex(
            (p) =>
              (r.code && p.code.toLowerCase() === r.code.toLowerCase()) ||
              p.name.toLowerCase() === r.name.toLowerCase()
          );
          if (existingIdx >= 0) {
            list[existingIdx] = {
              ...list[existingIdx],
              stock: round2(list[existingIdx].stock + r.stock),
              costPriceUsd: r.costPriceUsd > 0 ? r.costPriceUsd : list[existingIdx].costPriceUsd,
              priceUsd: r.priceUsd > 0 ? r.priceUsd : list[existingIdx].priceUsd,
              wholesalePriceUsd:
                r.wholesalePriceUsd > 0 ? r.wholesalePriceUsd : list[existingIdx].wholesalePriceUsd,
              category: r.category || list[existingIdx].category,
            };
          } else {
            list.unshift({
              id: idGen++,
              code: r.code,
              name: r.name,
              category: r.category || 'General',
              priceUsd: r.priceUsd,
              stock: r.stock,
              costPriceUsd: r.costPriceUsd,
              invoiceNumber: '',
              isTaxExempt: r.isTaxExempt,
              hasCommission: false,
              commissionPercentage: 0,
              commissionAmountUsd: 0,
              isRecipe: false,
              isCombo: false,
              comboItemsJson: '',
              allowDecimalQuantity: false,
              isPriceModifiable: false,
              wholesalePriceUsd: r.wholesalePriceUsd,
              aisleNumber: '',
              aisleQuantity: 0,
              depotQuantity: 0,
              counterQuantity: 0,
              minStockAlertQuantity: 5,
              isLowStockAlertEnabled: true,
            });
          }
          count += 1;
        }
        return { ...prev, products: list };
      });
      notify('Importación Completada', `Se procesaron ${count} productos del archivo CSV.`, 'success');
      return count;
    },
    [isLicensed, notify]
  );

  const applyInventoryCategoryUpdates = useCallback(
    (updates: Array<{ id: number; category: string; suggestedName?: string }>) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => {
          const u = map.get(p.id);
          if (!u) return p;
          return {
            ...p,
            category: u.category || p.category,
            name: u.suggestedName?.trim() ? u.suggestedName.trim() : p.name,
          };
        }),
      }));
      notify('Inventario Organizado con IA', `Se actualizaron ${updates.length} productos.`, 'success');
      return updates.length;
    },
    [notify]
  );

  const saveCustomer = useCallback(
    (cust: Omit<Customer, 'id'> & { id?: number }) => {
      const saved: Customer = cust.id
        ? { ...cust, id: cust.id }
        : { ...cust, id: nextId(state.customers) };
      setState((prev) => ({
        ...prev,
        customers: cust.id
          ? prev.customers.map((c) => (c.id === saved.id ? saved : c))
          : [saved, ...prev.customers],
      }));
      notify('Cliente Guardado', cust.name, 'success');
      return saved;
    },
    [notify, state.customers]
  );

  const saveSupplier = useCallback(
    (supp: Omit<Supplier, 'id'> & { id?: number }) => {
      const saved: Supplier = supp.id
        ? { ...supp, id: supp.id }
        : { ...supp, id: nextId(state.suppliers) };
      setState((prev) => ({
        ...prev,
        suppliers: supp.id
          ? prev.suppliers.map((s) => (s.id === saved.id ? saved : s))
          : [saved, ...prev.suppliers],
      }));
      notify('Proveedor Guardado', supp.name, 'success');
      return saved;
    },
    [notify, state.suppliers]
  );

  const createPurchaseInvoice = useCallback(
    (inv: Omit<PurchaseInvoice, 'id'>) => {
      const created: PurchaseInvoice = { ...inv, id: nextId(state.purchaseInvoices) };
      setState((prev) => ({ ...prev, purchaseInvoices: [created, ...prev.purchaseInvoices] }));
      notify('Factura de Compra Guardada', `Factura #${inv.invoiceNumber}`, 'success');
      return created;
    },
    [notify, state.purchaseInvoices]
  );

  const payPurchaseInvoice = useCallback(
    (invoiceId: number) => {
      setState((prev) => ({
        ...prev,
        purchaseInvoices: prev.purchaseInvoices.map((i) =>
          i.id === invoiceId ? { ...i, isPaid: true, paidTimestamp: Date.now() } : i
        ),
      }));
      notify('Factura Pagada', 'Cuenta por pagar marcada como solvente.', 'success');
    },
    [notify]
  );

  const updatePurchaseWithholdingVoucher = useCallback(
    (invoiceId: number, voucherNumber: string, status: PurchaseInvoice['withholdingStatus']) => {
      setState((prev) => ({
        ...prev,
        purchaseInvoices: prev.purchaseInvoices.map((i) =>
          i.id === invoiceId ? { ...i, withholdingVoucherNumber: voucherNumber, withholdingStatus: status } : i
        ),
      }));
      notify('Retención Actualizada', 'Estado SENIAT actualizado.', 'success');
    },
    [notify]
  );

  const addExpense = useCallback(
    (exp: Omit<Expense, 'id'>) => {
      const created: Expense = { ...exp, id: nextId(state.expenses) };
      setState((prev) => ({ ...prev, expenses: [created, ...prev.expenses] }));
      notify('Gasto Registrado', `${exp.category} • ${formatUsd(exp.amountUsd)}`, 'success');
      return created;
    },
    [notify, state.expenses]
  );

  const addCasheaSettlement = useCallback(
    (item: Omit<CasheaSettlement, 'id' | 'createdAt'>) => {
      const created: CasheaSettlement = { ...item, id: nextId(state.casheaSettlements), createdAt: Date.now() };
      setState((prev) => ({ ...prev, casheaSettlements: [created, ...prev.casheaSettlements] }));
      notify('Liquidación Cashea', `Neto recibido: ${formatUsd(item.netReceivedUsd)}`, 'success');
      return created;
    },
    [notify, state.casheaSettlements]
  );

  const addPosTerminalRecord = useCallback(
    (rec: Omit<PosTerminalRecord, 'id' | 'createdAt'>) => {
      const created: PosTerminalRecord = { ...rec, id: nextId(state.posTerminalRecords), createdAt: Date.now() };
      setState((prev) => ({ ...prev, posTerminalRecords: [created, ...prev.posTerminalRecords] }));
      notify('Voucher Guardado', `${rec.bankOrTerminal || 'POS'} • ${rec.totalAmount.toFixed(2)} ${rec.currency}`, 'success');
      return created;
    },
    [notify, state.posTerminalRecords]
  );

  const saveUser = useCallback(
    (userInput: Omit<User, 'id'> & { id?: number }) => {
      const trimmedName = userInput.username.trim();
      if (!trimmedName || userInput.pin.trim().length < 4) {
        return { ok: false, error: 'Nombre de usuario y PIN (mínimo 4 caracteres) son obligatorios.' };
      }
      const duplicate = state.users.find(
        (u) => u.username.toLowerCase() === trimmedName.toLowerCase() && u.id !== userInput.id
      );
      if (duplicate) {
        return { ok: false, error: 'Ya existe otro usuario con ese nombre.' };
      }
      setState((prev) => {
        if (userInput.id) {
          return {
            ...prev,
            users: prev.users.map((u) => (u.id === userInput.id ? { ...userInput, id: userInput.id } : u)),
          };
        }
        return {
          ...prev,
          users: [...prev.users, { ...userInput, id: nextId(prev.users) }],
        };
      });
      notify(userInput.id ? 'Usuario Actualizado' : 'Usuario Creado', trimmedName, 'success');
      return { ok: true };
    },
    [notify, state.users]
  );

  const deleteUser = useCallback(
    (id: number) => {
      const target = state.users.find((u) => u.id === id);
      if (!target) return { ok: false, error: 'Usuario no encontrado.' };
      if (target.username === 'Olivtech' || isSuperUser(target)) return { ok: false, error: 'El usuario maestro / superusuario no puede eliminarse.' };
      if (currentUser?.id === id) return { ok: false, error: 'No puedes eliminar el usuario con sesión activa.' };
      const uname = target.username.toLowerCase();
      const hasEmittedDocs =
        state.sales.some((s) => s.cashierName.toLowerCase() === uname || s.returnedBy?.toLowerCase() === uname) ||
        state.quotes.some((q) => q.cashierName.toLowerCase() === uname) ||
        state.deliveryNotes.some((n) => n.cashierName.toLowerCase() === uname) ||
        state.expenses.some((e) => e.registeredBy.toLowerCase() === uname);
      if (hasEmittedDocs) {
        return {
          ok: false,
          error: 'No se puede eliminar un usuario que ya ha emitido documentos o registros contables.',
        };
      }
      setState((prev) => ({ ...prev, users: prev.users.filter((u) => u.id !== id) }));
      notify('Usuario Eliminado', target.username, 'info');
      return { ok: true };
    },
    [currentUser, notify, state.deliveryNotes, state.expenses, state.quotes, state.sales, state.users]
  );

  const exportBackupJson = useCallback(() => {
    const pkg = buildEncryptedPosBackupPackage(state, 1);
    return JSON.stringify(
      {
        app: 'SmartPOS286',
        version: '2.5.0',
        ...pkg,
        data: state,
      },
      null,
      2
    );
  }, [state]);

  const importBackupJson = useCallback(
    (jsonText: string) => {
      try {
        const parsed = JSON.parse(jsonText);
        const data = (parsed.data ?? parsed) as Partial<PersistedState & EncryptedPosBackupPackage>;
        if (!Array.isArray(data.products)) {
          return { ok: false, error: 'El archivo JSON no corresponde a un respaldo válido de SmartPOS286 / CajaPOS.' };
        }
        const restored = restoreEncryptedPosBackupPackage(data, state.settings);
        setState((prev) => {
          let usersToKeep = Array.isArray(data.users) && data.users.length > 0 ? (data.users as User[]) : prev.users;
          if (!usersToKeep.some((u) => isSuperUser(u))) {
            usersToKeep = [MASTER_SUPERUSER, ...usersToKeep];
          }
          return {
            ...prev,
            ...restored,
            users: usersToKeep,
            currentUserId: prev.currentUserId,
          };
        });
        notify('Respaldo Restaurado', 'Todos los datos del comercio fueron importados con éxito.', 'success');
        return { ok: true };
      } catch {
        return { ok: false, error: 'Error al leer el archivo JSON de respaldo.' };
      }
    },
    [notify, state.settings]
  );

  const exportEncryptedBackup = useCallback(
    async (passphrase?: string, formatVersion: 1 | 2 = 1) => {
      const pkg = buildEncryptedPosBackupPackage(state, formatVersion);
      const binary = await encryptJsonToBinary(
        JSON.stringify(pkg),
        passphrase || DEFAULT_SYNC_PASSPHRASE,
        formatVersion
      );
      return uint8ArrayToBase64(binary);
    },
    [state]
  );

  const exportEncryptedBackupBinary = useCallback(
    async (passphrase?: string, formatVersion: 1 | 2 = 1) => {
      const pkg = buildEncryptedPosBackupPackage(state, formatVersion);
      return encryptJsonToBinary(
        JSON.stringify(pkg),
        passphrase || DEFAULT_SYNC_PASSPHRASE,
        formatVersion
      );
    },
    [state]
  );

  const importEncryptedBackup = useCallback(
    async (encryptedInput: string | Uint8Array, passphrase?: string) => {
      try {
        const pkg = await decryptPayloadToPackage(
          encryptedInput,
          passphrase || DEFAULT_SYNC_PASSPHRASE
        );
        const restored = restoreEncryptedPosBackupPackage(pkg, state.settings);

        setState((prev) => {
          let usersToKeep = restored.users.length > 0 ? restored.users : prev.users;
          if (!usersToKeep.some((u) => isSuperUser(u))) {
            usersToKeep = [MASTER_SUPERUSER, ...usersToKeep];
          }
          return {
            ...prev,
            ...restored,
            users: usersToKeep,
            currentUserId: prev.currentUserId,
          };
        });

        notify(
          'Respaldo Encriptado Restaurado',
          `Paquete (${pkg.formatVersion === 2 ? 'V2 GZIP' : 'V1 JSON'}) sincronizado con éxito. Tienda: ${pkg.storeName || state.settings.storeName}`,
          'success'
        );
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo descifrar el respaldo.';
        return { ok: false, error: msg };
      }
    },
    [notify, state.settings]
  );

  const exportSqlBackup = useCallback(() => {
    return exportDatabaseToSql({
      settings: state.settings,
      users: state.users,
      products: state.products,
      customers: state.customers,
      suppliers: state.suppliers,
      sales: state.sales,
      saleItems: state.saleItems,
      quotes: state.quotes,
      quoteItems: state.quoteItems,
      deliveryNotes: state.deliveryNotes,
      deliveryNoteItems: state.deliveryNoteItems,
      purchaseInvoices: state.purchaseInvoices,
      expenses: state.expenses,
      casheaSettlements: state.casheaSettlements,
      posTerminalRecords: state.posTerminalRecords,
    });
  }, [state]);

  const importSqlBackup = useCallback(
    (sqlText: string) => {
      try {
        const data = importDatabaseFromSql(sqlText);
        setState((prev) => ({
          ...prev,
          settings: data.settings ? { ...prev.settings, ...data.settings } : prev.settings,
          users: Array.isArray(data.users) && data.users.length > 0 ? data.users : prev.users,
          products: data.products ?? prev.products,
          customers: data.customers ?? prev.customers,
          suppliers: data.suppliers ?? prev.suppliers,
          sales: data.sales ?? prev.sales,
          saleItems: data.saleItems ?? prev.saleItems,
          quotes: data.quotes ?? prev.quotes,
          quoteItems: data.quoteItems ?? prev.quoteItems,
          deliveryNotes: data.deliveryNotes ?? prev.deliveryNotes,
          deliveryNoteItems: data.deliveryNoteItems ?? prev.deliveryNoteItems,
          purchaseInvoices: data.purchaseInvoices ?? prev.purchaseInvoices,
          expenses: data.expenses ?? prev.expenses,
          casheaSettlements: data.casheaSettlements ?? prev.casheaSettlements,
          posTerminalRecords: data.posTerminalRecords ?? prev.posTerminalRecords,
          currentUserId: prev.currentUserId,
        }));
        notify('Respaldo SQL Restaurado', 'Instancia SQL importada correctamente al sistema.', 'success');
        return { ok: true };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'No se pudo importar el archivo SQL.';
        return { ok: false, error: msg };
      }
    },
    [notify]
  );

  const wipeAppData = useCallback(() => {
    if (currentUser?.role !== 'ADMIN') {
      notify('Acceso Restringido', 'Solo el Administrador puede vaciar la información de la aplicación.', 'warning');
      return;
    }
    setState((prev) => ({
      ...prev,
      products: [],
      customers: [],
      sales: [],
      saleItems: [],
      quotes: [],
      quoteItems: [],
      deliveryNotes: [],
      deliveryNoteItems: [],
      heldSales: [],
      heldSaleItems: [],
      suppliers: [],
      purchaseInvoices: [],
      expenses: [],
      casheaSettlements: [],
      posTerminalRecords: [],
    }));
    setPosCart([]);
    setQuoteCart([]);
    setDeliveryCart([]);
    setLastCreatedSale(null);
    notify('Aplicación Reiniciada', 'Se ha vaciado toda la información (inventario, ventas, gastos, clientes). Estado de primer uso.', 'success');
  }, [currentUser?.role, notify]);

  const refreshCloudInstances = useCallback(async () => {
    if (!firebaseUser || currentUser?.role !== 'ADMIN') return;
    try {
      const [summary, list] = await Promise.all([
        fetchWorkspaceSummaryFromFirebase(firebaseUser).catch(() => null),
        listWorkspaceBackupsFromFirebase(firebaseUser).catch(() => []),
      ]);
      setCloudSummary(summary);
      setCloudInstances(list);
    } catch {
      // handled on explicit actions
    }
  }, [currentUser?.role, firebaseUser]);

  useEffect(() => {
    if (!isFirebaseAuthReady || !firebaseUser || currentUser?.role !== 'ADMIN') return;
    void refreshCloudInstances();
  }, [currentUser?.role, firebaseUser, isFirebaseAuthReady, refreshCloudInstances]);

  const checkFirebaseConnection = useCallback(async () => {
    const res = await testConnection();
    setFirebaseConnected(res.ok);
    setFirebaseStatusText(res.statusText);
    notify(res.ok ? 'Firebase En Línea' : 'Error de Conexión Firebase', res.statusText, res.ok ? 'success' : 'error');
    return res.ok;
  }, [notify]);

  const refreshDriveFileMeta = useCallback(async () => {
    const token = getCachedDriveAccessToken();
    if (!token) {
      setDriveFileMeta(null);
      return;
    }
    try {
      const meta = await findHiddenCajaPosFile(token);
      setDriveFileMeta(meta);
    } catch {
      // silent check
    }
  }, []);

  const syncCajaPosToDriveNow = useCallback(
    async (silent = false) => {
      if (currentUser?.role !== 'ADMIN') {
        if (!silent) {
          notify('Acceso Restringido', 'Solo el Administrador puede sincronizar el respaldo en Drive.', 'warning');
        }
        return false;
      }
      const token = getCachedDriveAccessToken();
      if (!token) {
        setHasDriveToken(false);
        setDriveRealtimeEnabledState(false);
        if (!silent) {
          notify(
            'Autorización Drive Requerida',
            'Inicia sesión nuevamente con Google para obtener el token de acceso a Google Drive.',
            'warning'
          );
        }
        return false;
      }
      setDriveSyncStatus('SYNCING');
      try {
        const sealedPayload = await sealDriveBackupPayload(exportBackupJson());
        const meta = await upsertHiddenCajaPosFile(token, sealedPayload);
        setDriveFileMeta(meta);
        setDriveLastSyncedAt(new Date().toISOString());
        setDriveSyncStatus('OK');
        if (!silent) {
          notify(
            'Respaldo Drive Actualizado',
            'Respaldo protegido sincronizado correctamente en Google Drive.',
            'success'
          );
        }
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error al sincronizar con Google Drive.';
        setDriveSyncStatus('ERROR');
        if (msg.includes('401') || msg.includes('403')) {
          clearCachedDriveAccessToken();
          setHasDriveToken(false);
          setDriveRealtimeEnabledState(false);
        }
        if (!silent) {
          notify('Error en Google Drive', msg, 'error');
        }
        return false;
      }
    },
    [currentUser?.role, exportBackupJson, notify]
  );

  const setDriveRealtimeEnabled = useCallback(
    (enabled: boolean) => {
      if (enabled) {
        if (currentUser?.role !== 'ADMIN') return;
        const token = getCachedDriveAccessToken();
        if (!token) {
          setHasDriveToken(false);
          notify(
            'Sesión Google sin Token Drive',
            'Vuelve a pulsar "Iniciar sesión con Google" para habilitar el respaldo en tiempo real en Google Drive.',
            'warning'
          );
          return;
        }
        setDriveRealtimeEnabledState(true);
        void syncCajaPosToDriveNow(false);
      } else {
        setDriveRealtimeEnabledState(false);
        notify('Sincronización Pausada', 'El respaldo automático en tiempo real en Google Drive fue desactivado.', 'info');
      }
    },
    [currentUser?.role, notify, syncCajaPosToDriveNow]
  );

  // Debounced real-time sync to private Google Drive backup
  useEffect(() => {
    if (!driveRealtimeEnabled || currentUser?.role !== 'ADMIN') return;
    const token = getCachedDriveAccessToken();
    if (!token) {
      setHasDriveToken(false);
      setDriveRealtimeEnabledState(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void syncCajaPosToDriveNow(true);
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [state, driveRealtimeEnabled, currentUser?.role, syncCajaPosToDriveNow]);

  const restoreCajaPosFromDrive = useCallback(async () => {
    if (currentUser?.role !== 'ADMIN') return false;
    const token = getCachedDriveAccessToken();
    if (!token) {
      setHasDriveToken(false);
      notify('Autorización Drive Requerida', 'Inicia sesión con Google para leer el respaldo en Drive.', 'warning');
      return false;
    }
    setDriveSyncStatus('SYNCING');
    try {
      const result = await readHiddenCajaPosFile(token);
      if (!result) {
        setDriveSyncStatus('IDLE');
        notify('Respaldo No Encontrado', 'No existe aún un respaldo guardado en tu Google Drive.', 'info');
        return false;
      }
      setDriveFileMeta(result.meta);
      const verifiedJson = await verifyAndExtractDriveBackupPayload(result.content);
      const imported = importBackupJson(verifiedJson);
      if (!imported.ok) {
        setDriveSyncStatus('ERROR');
        notify('Error al Restaurar Drive', imported.error || 'Contenido inválido en el respaldo de Google Drive.', 'error');
        return false;
      }
      setDriveLastSyncedAt(result.meta.modifiedTime || new Date().toISOString());
      setDriveSyncStatus('OK');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error leyendo el respaldo desde Google Drive.';
      setDriveSyncStatus('ERROR');
      notify('Error en Google Drive', msg, 'error');
      return false;
    }
  }, [currentUser?.role, importBackupJson, notify]);

  const loginWithGoogleAdmin = useCallback(async () => {
    if (currentUser?.role !== 'ADMIN') {
      notify('Acceso Restringido', 'Solo un perfil Administrador puede vincular Google y Firebase.', 'warning');
      return false;
    }
    setIsFirebaseSyncing(true);
    try {
      const { user, driveAccessToken } = await signInAdminWithGoogle();
      setFirebaseUser(user);
      setHasDriveToken(Boolean(driveAccessToken));
      const [summary, instances] = await Promise.all([
        fetchWorkspaceSummaryFromFirebase(user).catch(() => null),
        listWorkspaceBackupsFromFirebase(user).catch(() => []),
      ]);
      setCloudSummary(summary);
      setCloudInstances(instances);
      if (driveAccessToken) {
        const meta = await findHiddenCajaPosFile(driveAccessToken).catch(() => null);
        setDriveFileMeta(meta);
      }
      setFirebaseConnected(true);
      setFirebaseStatusText('Conectado con Google');
      notify(
        'Google Conectado',
        `Sesión iniciada como ${user.email || user.displayName || 'Administrador'}.`,
        'success'
      );
      return true;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'No se pudo completar el inicio de sesión con Google.';
      notify('Error Google Sign-In', msg, 'error');
      return false;
    } finally {
      setIsFirebaseSyncing(false);
    }
  }, [currentUser?.role, notify]);

  const logoutGoogleAdmin = useCallback(async () => {
    if (currentUser?.role !== 'ADMIN') return;
    await signOutGoogleAccount();
    clearCachedDriveAccessToken();
    setFirebaseUser(null);
    setHasDriveToken(false);
    setDriveRealtimeEnabledState(false);
    setDriveFileMeta(null);
    setDriveSyncStatus('IDLE');
    setCloudSummary(null);
    setCloudInstances([]);
    notify('Google Desconectado', 'Se cerró la sesión de la cuenta Google en Firebase y Drive.', 'info');
  }, [currentUser?.role, notify]);

  const backupToFirebase = useCallback(
    async (instanceId = 'latest', label = 'Instancia Principal') => {
      if (currentUser?.role !== 'ADMIN') {
        notify('Acceso Restringido', 'Solo el Administrador puede respaldar en Firebase.', 'warning');
        return false;
      }
      if (!firebaseUser) {
        notify('Inicia Sesión con Google', 'Conecta primero tu cuenta Google para acceder a Firestore.', 'warning');
        return false;
      }
      setIsFirebaseSyncing(true);
      try {
        const summary = await syncWorkspaceToFirebase(
          firebaseUser,
          {
            settings: state.settings,
            products: state.products,
            customers: state.customers,
            suppliers: state.suppliers,
            sales: state.sales,
            saleItems: state.saleItems,
            quotes: state.quotes,
            quoteItems: state.quoteItems,
            deliveryNotes: state.deliveryNotes,
            deliveryNoteItems: state.deliveryNoteItems,
            expenses: state.expenses,
            casheaSettlements: state.casheaSettlements,
            posTerminalRecords: state.posTerminalRecords,
            purchaseInvoices: state.purchaseInvoices,
          },
          instanceId,
          label
        );
        setCloudSummary(summary);
        const list = await listWorkspaceBackupsFromFirebase(firebaseUser).catch(() => []);
        setCloudInstances(list);
        setFirebaseConnected(true);
        setFirebaseStatusText('Sincronizado con Firestore');
        notify('Instancia Guardada en Nube', `Respaldo "${label}" sincronizado en Firestore.`, 'success');
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error al guardar en Firestore.';
        notify('Error al Respaldar en Firebase', msg, 'error');
        return false;
      } finally {
        setIsFirebaseSyncing(false);
      }
    },
    [currentUser?.role, firebaseUser, notify, state]
  );

  const restoreFromFirebase = useCallback(
    async (instanceId = 'latest') => {
      if (currentUser?.role !== 'ADMIN') {
        notify('Acceso Restringido', 'Solo el Administrador puede restaurar desde Firebase.', 'warning');
        return false;
      }
      if (!firebaseUser) {
        notify('Inicia Sesión con Google', 'Conecta primero tu cuenta Google para leer tus respaldos.', 'warning');
        return false;
      }
      setIsFirebaseSyncing(true);
      try {
        const restored = await restoreWorkspaceFromFirebase(firebaseUser, instanceId);
        if (!restored) {
          notify('Sin Respaldo en la Nube', 'No se encontró esa instancia guardada para esta cuenta Google.', 'info');
          return false;
        }
        setState((prev) => ({
          ...prev,
          settings: restored.settings
            ? { ...prev.settings, ...restored.settings, storeLogoDataUrl: prev.settings.storeLogoDataUrl }
            : prev.settings,
          products: restored.products ?? prev.products,
          customers: restored.customers ?? prev.customers,
          suppliers: restored.suppliers ?? prev.suppliers,
          sales: restored.sales ?? prev.sales,
          saleItems: restored.saleItems ?? prev.saleItems,
          quotes: restored.quotes ?? prev.quotes,
          quoteItems: restored.quoteItems ?? prev.quoteItems,
          deliveryNotes: restored.deliveryNotes ?? prev.deliveryNotes,
          deliveryNoteItems: restored.deliveryNoteItems ?? prev.deliveryNoteItems,
          expenses: restored.expenses ?? prev.expenses,
          casheaSettlements: restored.casheaSettlements ?? prev.casheaSettlements,
          posTerminalRecords: restored.posTerminalRecords ?? prev.posTerminalRecords,
          purchaseInvoices: restored.purchaseInvoices ?? prev.purchaseInvoices,
        }));
        notify('Instancia Restaurada', 'Datos del comercio restaurados desde Firebase Firestore.', 'success');
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error al leer respaldo de Firestore.';
        notify('Error al Restaurar desde Firebase', msg, 'error');
        return false;
      } finally {
        setIsFirebaseSyncing(false);
      }
    },
    [currentUser?.role, firebaseUser, notify]
  );

  const deleteFirebaseInstance = useCallback(
    async (instanceId: string) => {
      if (currentUser?.role !== 'ADMIN' || !firebaseUser) return false;
      setIsFirebaseSyncing(true);
      try {
        await deleteWorkspaceBackupFromFirebase(firebaseUser, instanceId);
        const list = await listWorkspaceBackupsFromFirebase(firebaseUser).catch(() => []);
        setCloudInstances(list);
        notify('Instancia Eliminada', `Se eliminó la instancia "${instanceId}" de Firestore.`, 'info');
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error al eliminar la instancia.';
        notify('Error al Eliminar Instancia', msg, 'error');
        return false;
      } finally {
        setIsFirebaseSyncing(false);
      }
    },
    [currentUser?.role, firebaseUser, notify]
  );

  const sendAssistantMessage = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text) return;

      const userMsg: AssistantMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text,
        timestamp: Date.now(),
      };
      setAssistantMessages((prev) => [...prev, userMsg]);

      const lower = text.toLowerCase();

      // Local fast intents mirroring ConversationalAssistantEngine.kt
      const rateMatch = lower.match(/(?:tasa|bcv|dolar|dólar)\s*(?:a|=|en)?\s*(\d+(?:[.,]\d+)?)/i);
      if (rateMatch && (lower.includes('cambia') || lower.includes('pon') || lower.includes('actualiza'))) {
        const newRate = Number(rateMatch[1].replace(',', '.'));
        if (newRate > 0) {
          setAssistantMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: `Detecté que deseas actualizar la tasa BCV a **Bs. ${newRate.toFixed(2)}**. Confirma para aplicarla en todo el sistema.`,
              timestamp: Date.now(),
              pendingAction: {
                type: 'UPDATE_RATE',
                label: `Aplicar Tasa Bs. ${newRate.toFixed(2)}`,
                payload: { rate: newRate },
              },
            },
          ]);
          return;
        }
      }

      if (lower.includes('stock bajo') || lower.includes('agotad') || lower.includes('faltan')) {
        const summary =
          lowStockProducts.length === 0
            ? '¡Excelente! No tienes productos por debajo de su stock mínimo configurado.'
            : `Tienes **${lowStockProducts.length} producto(s)** con stock crítico:\n` +
              lowStockProducts
                .slice(0, 8)
                .map((p) => `• ${p.name} (Stock actual: ${p.stock} / Mín: ${p.minStockAlertQuantity})`)
                .join('\n');
        setAssistantMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: summary,
            timestamp: Date.now(),
            pendingAction:
              lowStockProducts.length > 0
                ? { type: 'NAVIGATE', label: 'Ir a Inventario', payload: { route: 'inventory' } }
                : undefined,
          },
        ]);
        return;
      }

      // Build rich live business snapshot for server-side Gemini
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todaySales = state.sales.filter((s) => s.timestamp >= startOfDay.getTime() && s.status !== 'DEVUELTA');
      const todayTotalUsd = round2(todaySales.reduce((acc, s) => acc + s.totalUsd, 0));
      const pendingCreditUsd = round2(
        state.sales
          .filter((s) => s.status !== 'DEVUELTA' && s.paymentCreditUsd > 0 && !s.isCreditPaid)
          .reduce((acc, s) => acc + (s.paymentCreditUsd - s.creditPaidAmountUsd), 0)
      );

      const businessContext = `Comercio: ${state.settings.storeName} (${state.settings.storeRif})
Tasa BCV actual: Bs. ${state.settings.bcvRate.toFixed(2)}
Productos en catálogo: ${state.products.length} (En alerta stock bajo: ${lowStockProducts.length})
Ventas hoy: ${todaySales.length} facturas por $${todayTotalUsd.toFixed(2)} USD (Bs. ${(todayTotalUsd * state.settings.bcvRate).toFixed(2)})
Cuentas por cobrar pendientes: $${pendingCreditUsd.toFixed(2)} USD
Gastos registrados: ${state.expenses.length}
Clientes registrados: ${state.customers.length}
Top productos con menor stock: ${lowStockProducts
        .slice(0, 5)
        .map((p) => `${p.name} (${p.stock})`)
        .join(', ') || 'Ninguno'}`;

      setIsAssistantLoading(true);
      try {
        const res = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: assistantMessages.slice(-8).map((m) => ({ role: m.role, text: m.text })),
            businessContext,
          }),
        });

        let data: {
          reply?: string;
          pendingAction?: AssistantAction;
          webSources?: Array<{ title: string; url: string }>;
          error?: string;
        } | null = null;

        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            data = await res.json();
          } catch {
            data = null;
          }
        }

        if (data?.reply) {
          setAssistantMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: 'assistant',
              text: data.reply || '',
              timestamp: Date.now(),
              pendingAction: data.pendingAction,
              webSources: data.webSources,
            },
          ]);
          return;
        }

        // If no structured reply was received from server, generate local analysis
        throw new Error('Sin respuesta estructurada');
      } catch {
        // Resilient fallback logic engine
        let fallbackReply = `He analizado tu solicitud sobre **"${text}"** considerando los datos activos del comercio:\n\n${businessContext}\n\nHoy se registran ${todaySales.length} ventas por $${todayTotalUsd.toFixed(2)} USD y la tasa BCV está en Bs. ${state.settings.bcvRate.toFixed(2)}.`;
        let fallbackAction: AssistantAction | undefined = undefined;

        if (lower.includes('stock') || lower.includes('agotad') || lower.includes('inventario') || lower.includes('faltan')) {
          fallbackReply = `**Análisis de Inventario:**\nTienes ${state.products.length} productos registrados (${lowStockProducts.length} con stock bajo).\n${
            lowStockProducts.slice(0, 5).map((p) => `• ${p.name} (Stock: ${p.stock} / Mín: ${p.minStockAlertQuantity})`).join('\n') || 'Todo el catálogo se encuentra en niveles adecuados.'
          }`;
          fallbackAction = { type: 'NAVIGATE', label: 'Ir a Inventario', payload: { route: 'inventory' } };
        } else if (lower.includes('venta') || lower.includes('factura') || lower.includes('hoy') || lower.includes('cuanto') || lower.includes('cuánto')) {
          fallbackReply = `**Ventas y Facturación de Hoy:**\n• Total facturado: $${todayTotalUsd.toFixed(2)} USD (Bs. ${(todayTotalUsd * state.settings.bcvRate).toFixed(2)})\n• Facturas emitidas: ${todaySales.length}\n• Cuentas por cobrar pendientes: $${pendingCreditUsd.toFixed(2)} USD`;
          fallbackAction = { type: 'NAVIGATE', label: 'Ver Facturas', payload: { route: 'invoices' } };
        } else if (lower.includes('deuda') || lower.includes('cobrar') || lower.includes('credito') || lower.includes('crédito')) {
          fallbackReply = `**Cuentas por Cobrar Pendientes:**\nTotal por cobrar: $${pendingCreditUsd.toFixed(2)} USD (Bs. ${(pendingCreditUsd * state.settings.bcvRate).toFixed(2)}).\nPuedes registrar abonos o revisar vencimientos en el módulo de facturación.`;
          fallbackAction = { type: 'NAVIGATE', label: 'Ver Cuentas por Cobrar', payload: { route: 'invoices' } };
        }

        setAssistantMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: fallbackReply,
            timestamp: Date.now(),
            pendingAction: fallbackAction,
          },
        ]);
      } finally {
        setIsAssistantLoading(false);
      }
    },
    [assistantMessages, lowStockProducts, state.customers.length, state.expenses.length, state.products.length, state.sales, state.settings]
  );

  const executeAssistantAction = useCallback(
    (messageId: string, action: AssistantAction) => {
      if (action.type === 'UPDATE_RATE' && action.payload.rate) {
        updateSettings({ bcvRate: Number(action.payload.rate) });
        notify('Tasa Actualizada', `Tasa BCV establecida en Bs. ${Number(action.payload.rate).toFixed(2)}`, 'success');
      } else if (action.type === 'NAVIGATE' && action.payload.route) {
        setActiveRoute(action.payload.route as AppRoute);
        setIsAssistantOpen(false);
      } else if (action.type === 'ADD_CUSTOMER') {
        const payload = action.payload;
        saveCustomer({
          name: payload.name || 'Nuevo Cliente',
          documentId: payload.documentId || 'V-00000000',
          phone: payload.phone || '',
          address: payload.address || '',
          clientType: (payload.clientType as any) || 'PERSONA_NATURAL',
          isWithholdingAgent: false,
          ivaRetentionPercentage: 75,
          islrRetentionPercentage: 2,
        });
        notify('Cliente Agregado por IA', `Cliente ${payload.name} registrado correctamente.`, 'success');
      } else if (action.type === 'ADD_PRODUCT') {
        const payload = action.payload;
        saveProduct({
          code: payload.code || `P-${Date.now().toString().slice(-4)}`,
          name: payload.name || 'Nuevo Producto',
          category: payload.category || 'General',
          priceUsd: Number(payload.priceUsd) || 1,
          stock: Number(payload.stock) || 0,
          costPriceUsd: Number(payload.costPriceUsd) || 0,
          invoiceNumber: '',
          isTaxExempt: false,
          hasCommission: false,
          commissionPercentage: 0,
          commissionAmountUsd: 0,
          isRecipe: false,
          isCombo: false,
          comboItemsJson: '',
          allowDecimalQuantity: false,
          isPriceModifiable: false,
          wholesalePriceUsd: Number(payload.priceUsd) || 1,
          aisleNumber: '',
          aisleQuantity: 0,
          depotQuantity: 0,
          counterQuantity: 0,
          minStockAlertQuantity: 5,
          isLowStockAlertEnabled: true,
        });
        notify('Producto Agregado por IA', `Producto ${payload.name} añadido al inventario.`, 'success');
      } else if (action.type === 'UPDATE_INVENTORY') {
        const payload = action.payload;
        const q = String(payload.productQuery || '').toLowerCase();
        const found = state.products.find(
          (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
        );
        if (found) {
          saveProduct({
            ...found,
            stock: payload.newStock !== undefined ? Number(payload.newStock) : found.stock,
            priceUsd: payload.newPriceUsd !== undefined ? Number(payload.newPriceUsd) : found.priceUsd,
          });
          notify('Inventario Actualizado por IA', `Se actualizó el producto ${found.name}.`, 'success');
        } else {
          notify('No encontrado', `No se encontró ningún producto que coincida con "${payload.productQuery}".`, 'warning');
        }
      }
      setAssistantMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, pendingAction: undefined } : m))
      );
    },
    [notify, saveCustomer, saveProduct, setActiveRoute, state.products, updateSettings]
  );

  const clearAssistantMessages = useCallback(() => {
    setAssistantMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        text: 'Conversación reiniciada. ¿En qué te ayudo hoy en tu comercio?',
        timestamp: Date.now(),
      },
    ]);
  }, []);

  const value: PosContextValue = {
    state,
    currentUser,
    allowedRoutes,
    activeRoute,
    setActiveRoute,
    toggleTheme,
    updateSettings,
    activateLicense,
    syncBcvRateFromApi,
    isSyncingRate,
    login,
    logout,
    changeCurrentUserPin,
    posCart,
    quoteCart,
    deliveryCart,
    addToCart,
    updateCartQty,
    updateCartCustomPrice,
    removeFromCart,
    clearCart,
    isLicensed,
    todaySalesCount,
    isProductLimitReached,
    isDailyInvoiceLimitReached,
    lowStockProducts,
    outOfStockProducts,
    lastCreatedSale,
    clearLastCreatedSale: () => setLastCreatedSale(null),
    processSale,
    returnSale,
    paySaleCredit,
    updateSaleWithholdingVoucher,
    holdPosCart,
    restoreHeldSale,
    createQuote,
    updateQuoteStatus,
    loadQuoteIntoPosCart,
    processDeliveryNote,
    cancelDeliveryNote,
    loadDeliveryNoteIntoPosCart,
    saveProduct,
    deleteProduct,
    importCsvProducts,
    applyInventoryCategoryUpdates,
    saveCustomer,
    saveSupplier,
    createPurchaseInvoice,
    payPurchaseInvoice,
    updatePurchaseWithholdingVoucher,
    addExpense,
    addCasheaSettlement,
    addPosTerminalRecord,
    saveUser,
    deleteUser,
    exportBackupJson,
    importBackupJson,
    exportEncryptedBackup,
    exportEncryptedBackupBinary,
    importEncryptedBackup,
    exportSqlBackup,
    importSqlBackup,
    wipeAppData,
    firebaseUser,
    isFirebaseAuthReady,
    isFirebaseSyncing,
    firebaseConnected,
    firebaseStatusText,
    cloudSummary,
    cloudInstances,
    hasDriveToken,
    driveRealtimeEnabled,
    setDriveRealtimeEnabled,
    driveSyncStatus,
    driveLastSyncedAt,
    driveFileMeta,
    loginWithGoogleAdmin,
    logoutGoogleAdmin,
    checkFirebaseConnection,
    refreshCloudInstances,
    backupToFirebase,
    restoreFromFirebase,
    deleteFirebaseInstance,
    syncCajaPosToDriveNow,
    restoreCajaPosFromDrive,
    refreshDriveFileMeta,
    assistantMessages,
    isAssistantLoading,
    sendAssistantMessage,
    executeAssistantAction,
    clearAssistantMessages,
    isAssistantOpen,
    setIsAssistantOpen,
    isLicenseOpen,
    setIsLicenseOpen,
    isAboutOpen,
    setIsAboutOpen,
    isDebtsOpen,
    setIsDebtsOpen,
    isAlertsOpen,
    setIsAlertsOpen,
    isOcrModalOpen,
    setIsOcrModalOpen,
    toasts,
    notify,
    dismissToast,
  };

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
};

export function usePos() {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error('usePos must be used within PosProvider');
  return ctx;
}
