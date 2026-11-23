import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
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
} from './types/models';

const app = initializeApp(firebaseConfig);
const configuredDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
export const db = configuredDatabaseId ? getFirestore(app, configuredDatabaseId) : getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.file',
];
for (const scope of WORKSPACE_SCOPES) {
  googleProvider.addScope(scope);
}
googleProvider.setCustomParameters({ prompt: 'select_account' });

// In-memory only access token cache (never written to localStorage or sessionStorage)
let cachedDriveAccessToken: string | null = null;

export function getCachedDriveAccessToken(): string | null {
  return cachedDriveAccessToken;
}

export function clearCachedDriveAccessToken(): void {
  cachedDriveAccessToken = null;
}

export const FIREBASE_PROJECT_INFO = {
  projectId: firebaseConfig.projectId,
  firestoreDatabaseId: configuredDatabaseId || '(default)',
  authDomain: firebaseConfig.authDomain,
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<{ ok: boolean; statusText: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, statusText: 'Conectado a Firestore' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { ok: false, statusText: 'Cliente sin conexión / configuración inválida' };
    }
    return { ok: true, statusText: 'Servicio Firestore en línea' };
  }
}

void testConnection();

export { onAuthStateChanged, type FirebaseUser };

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitizeInstanceId(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || 'latest';
}

export interface CloudBackupPayload {
  settings: StoreSettings;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: Sale[];
  saleItems: SaleItem[];
  quotes: Quote[];
  quoteItems: QuoteItem[];
  deliveryNotes: DeliveryNote[];
  deliveryNoteItems: DeliveryNoteItem[];
  expenses: Expense[];
  casheaSettlements: CasheaSettlement[];
  posTerminalRecords: PosTerminalRecord[];
  purchaseInvoices: PurchaseInvoice[];
}

export interface CloudWorkspaceSummary {
  storeName: string;
  storeRif: string;
  bcvRate: number;
  licenseType: string;
  productsCount: number;
  salesCount: number;
  customersCount: number;
  updatedAtIso: string;
}

export interface CloudBackupInstanceMeta {
  id: string;
  label: string;
  storeName: string;
  storeRif: string;
  productsCount: number;
  salesCount: number;
  customersCount: number;
  updatedAtIso: string;
}

export async function signInAdminWithGoogle(): Promise<{ user: FirebaseUser; driveAccessToken: string | null }> {
  const credentialResult = await signInWithPopup(auth, googleProvider);
  const user = credentialResult.user;
  const oauthCred = GoogleAuthProvider.credentialFromResult(credentialResult);
  cachedDriveAccessToken = oauthCred?.accessToken ?? null;

  const privateInfoPath = `users/${user.uid}/private/info`;
  const privateRef = doc(db, 'users', user.uid, 'private', 'info');
  try {
    const existingSnap = await getDoc(privateRef);
    const createdAtValue = existingSnap.exists() ? existingSnap.data().createdAt : serverTimestamp();
    await setDoc(privateRef, {
      uid: user.uid,
      email: (user.email || 'sin-correo@smartpos286.app').slice(0, 200),
      displayName: (user.displayName || 'Administrador SmartPOS286').slice(0, 120),
      createdAt: createdAtValue,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, privateInfoPath);
  }

  return { user, driveAccessToken: cachedDriveAccessToken };
}

export async function signOutGoogleAccount(): Promise<void> {
  cachedDriveAccessToken = null;
  await signOut(auth);
}

export async function fetchWorkspaceSummaryFromFirebase(
  user: FirebaseUser
): Promise<CloudWorkspaceSummary | null> {
  const workspacePath = `workspaces/${user.uid}`;
  const workspaceRef = doc(db, 'workspaces', user.uid);
  try {
    const snap = await getDoc(workspaceRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    const updatedTs = data.updatedAt as Timestamp | undefined;
    return {
      storeName: String(data.storeName || ''),
      storeRif: String(data.storeRif || ''),
      bcvRate: Number(data.bcvRate || 0),
      licenseType: String(data.licenseType || 'FREE_TRIAL'),
      productsCount: Number(data.productsCount || 0),
      salesCount: Number(data.salesCount || 0),
      customersCount: Number(data.customersCount || 0),
      updatedAtIso: updatedTs?.toDate ? updatedTs.toDate().toISOString() : '',
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, workspacePath);
  }
}

export async function listWorkspaceBackupsFromFirebase(
  user: FirebaseUser
): Promise<CloudBackupInstanceMeta[]> {
  const backupsPath = `workspaces/${user.uid}/backups`;
  try {
    const q = query(collection(db, 'workspaces', user.uid, 'backups'), where('ownerId', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => {
        const data = d.data();
        const updatedTs = data.updatedAt as Timestamp | undefined;
        return {
          id: d.id,
          label: String(data.label || d.id),
          storeName: String(data.storeName || ''),
          storeRif: String(data.storeRif || ''),
          productsCount: Number(data.productsCount || 0),
          salesCount: Number(data.salesCount || 0),
          customersCount: Number(data.customersCount || 0),
          updatedAtIso: updatedTs?.toDate ? updatedTs.toDate().toISOString() : '',
        };
      })
      .sort((a, b) => (b.updatedAtIso || '').localeCompare(a.updatedAtIso || ''));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, backupsPath);
  }
}

export async function syncWorkspaceToFirebase(
  user: FirebaseUser,
  payload: CloudBackupPayload,
  rawInstanceId = 'latest',
  rawLabel = 'Instancia Principal'
): Promise<CloudWorkspaceSummary> {
  const instanceId = sanitizeInstanceId(rawInstanceId);
  const label = (rawLabel || instanceId).trim().slice(0, 100) || 'Instancia Principal';
  const storeName = (payload.settings.storeName || 'SMARTPOS286').trim().slice(0, 120);
  const storeRif = (payload.settings.storeRif || 'J-00000000-0').trim().slice(0, 40);
  const bcvRate = payload.settings.bcvRate > 0 ? payload.settings.bcvRate : 1;
  const productsCount = Math.max(0, Math.floor(payload.products.length));
  const salesCount = Math.max(0, Math.floor(payload.sales.length));
  const customersCount = Math.max(0, Math.floor(payload.customers.length));

  const workspacePath = `workspaces/${user.uid}`;
  const workspaceRef = doc(db, 'workspaces', user.uid);
  let workspaceCreatedAt: unknown = serverTimestamp();
  let workspaceExists = false;

  try {
    const existingWs = await getDoc(workspaceRef);
    if (existingWs.exists()) {
      workspaceExists = true;
      workspaceCreatedAt = existingWs.data().createdAt;
    }
    await setDoc(workspaceRef, {
      ownerId: user.uid,
      storeName,
      storeRif,
      bcvRate,
      licenseType: payload.settings.licenseType,
      productsCount,
      salesCount,
      customersCount,
      createdAt: workspaceCreatedAt,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, workspaceExists ? OperationType.UPDATE : OperationType.CREATE, workspacePath);
  }

  const backupPath = `workspaces/${user.uid}/backups/${instanceId}`;
  const backupRef = doc(db, 'workspaces', user.uid, 'backups', instanceId);
  let backupCreatedAt: unknown = serverTimestamp();
  let backupExists = false;

  const cleanSettings: StoreSettings = sanitizeForFirestore({
    ...payload.settings,
    storeLogoDataUrl: '',
  });

  try {
    const existingBackup = await getDoc(backupRef);
    if (existingBackup.exists()) {
      backupExists = true;
      backupCreatedAt = existingBackup.data().createdAt;
    }
    await setDoc(backupRef, {
      ownerId: user.uid,
      label,
      storeName,
      storeRif,
      productsCount,
      salesCount,
      customersCount,
      settings: cleanSettings,
      products: sanitizeForFirestore(payload.products.slice(0, 500)),
      customers: sanitizeForFirestore(payload.customers.slice(0, 500)),
      suppliers: sanitizeForFirestore(payload.suppliers.slice(0, 200)),
      sales: sanitizeForFirestore(payload.sales.slice(0, 500)),
      saleItems: sanitizeForFirestore(payload.saleItems.slice(0, 1500)),
      quotes: sanitizeForFirestore(payload.quotes.slice(0, 300)),
      quoteItems: sanitizeForFirestore(payload.quoteItems.slice(0, 1000)),
      deliveryNotes: sanitizeForFirestore(payload.deliveryNotes.slice(0, 300)),
      deliveryNoteItems: sanitizeForFirestore(payload.deliveryNoteItems.slice(0, 1000)),
      expenses: sanitizeForFirestore(payload.expenses.slice(0, 500)),
      casheaSettlements: sanitizeForFirestore(payload.casheaSettlements.slice(0, 300)),
      posTerminalRecords: sanitizeForFirestore(payload.posTerminalRecords.slice(0, 500)),
      purchaseInvoices: sanitizeForFirestore(payload.purchaseInvoices.slice(0, 500)),
      createdAt: backupCreatedAt,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, backupExists ? OperationType.UPDATE : OperationType.CREATE, backupPath);
  }

  return {
    storeName,
    storeRif,
    bcvRate,
    licenseType: payload.settings.licenseType,
    productsCount,
    salesCount,
    customersCount,
    updatedAtIso: new Date().toISOString(),
  };
}

export async function restoreWorkspaceFromFirebase(
  user: FirebaseUser,
  rawInstanceId = 'latest'
): Promise<Partial<CloudBackupPayload> | null> {
  const instanceId = sanitizeInstanceId(rawInstanceId);
  const backupPath = `workspaces/${user.uid}/backups/${instanceId}`;
  const backupRef = doc(db, 'workspaces', user.uid, 'backups', instanceId);
  try {
    const snap = await getDoc(backupRef);
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      settings: data.settings as StoreSettings | undefined,
      products: Array.isArray(data.products) ? (data.products as Product[]) : undefined,
      customers: Array.isArray(data.customers) ? (data.customers as Customer[]) : undefined,
      suppliers: Array.isArray(data.suppliers) ? (data.suppliers as Supplier[]) : undefined,
      sales: Array.isArray(data.sales) ? (data.sales as Sale[]) : undefined,
      saleItems: Array.isArray(data.saleItems) ? (data.saleItems as SaleItem[]) : undefined,
      quotes: Array.isArray(data.quotes) ? (data.quotes as Quote[]) : undefined,
      quoteItems: Array.isArray(data.quoteItems) ? (data.quoteItems as QuoteItem[]) : undefined,
      deliveryNotes: Array.isArray(data.deliveryNotes) ? (data.deliveryNotes as DeliveryNote[]) : undefined,
      deliveryNoteItems: Array.isArray(data.deliveryNoteItems)
        ? (data.deliveryNoteItems as DeliveryNoteItem[])
        : undefined,
      expenses: Array.isArray(data.expenses) ? (data.expenses as Expense[]) : undefined,
      casheaSettlements: Array.isArray(data.casheaSettlements)
        ? (data.casheaSettlements as CasheaSettlement[])
        : undefined,
      posTerminalRecords: Array.isArray(data.posTerminalRecords)
        ? (data.posTerminalRecords as PosTerminalRecord[])
        : undefined,
      purchaseInvoices: Array.isArray(data.purchaseInvoices)
        ? (data.purchaseInvoices as PurchaseInvoice[])
        : undefined,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, backupPath);
  }
}

export async function deleteWorkspaceBackupFromFirebase(
  user: FirebaseUser,
  rawInstanceId: string
): Promise<void> {
  const instanceId = sanitizeInstanceId(rawInstanceId);
  const backupPath = `workspaces/${user.uid}/backups/${instanceId}`;
  const backupRef = doc(db, 'workspaces', user.uid, 'backups', instanceId);
  try {
    await deleteDoc(backupRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, backupPath);
  }
}
