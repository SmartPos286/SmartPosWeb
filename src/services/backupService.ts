import type { User as FirebaseUser } from 'firebase/auth';
import {
  syncEncryptedBackupToFirestore,
  fetchLatestEncryptedBackupFromFirestore,
  listEncryptedBackupsFromFirestore,
  deleteEncryptedBackupFromFirestore,
  type DirectEncryptedBackupMeta,
  type DirectEncryptedBackupDoc,
} from '../firebase';
import {
  buildEncryptedPosBackupPackage,
  decryptPayloadToPackage,
  DEFAULT_SYNC_PASSPHRASE,
  type EncryptedPosBackupPackage,
} from '../utils/encryptedBackup';
import type {
  StoreSettings,
  User,
  Product,
  Customer,
  Supplier,
  Sale,
  SaleItem,
  Quote,
  QuoteItem,
  DeliveryNote,
  DeliveryNoteItem,
  Expense,
  CasheaSettlement,
  PosTerminalRecord,
  PurchaseInvoice,
} from '../types/models';

export interface AppStatePayload {
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
  expenses: Expense[];
  casheaSettlements: CasheaSettlement[];
  posTerminalRecords: PosTerminalRecord[];
  purchaseInvoices: PurchaseInvoice[];
  currentUserId: number | null;
}

export interface CloudBackupServiceResponse {
  ok: boolean;
  error?: string;
  meta?: DirectEncryptedBackupMeta;
  doc?: DirectEncryptedBackupDoc;
}

/**
 * Servicio encargado de gestionar la carga, descarga y sincronización
 * del respaldo encriptado en Firestore bajo la ruta fija:
 * users/{userId}/encrypted_backups/latest
 */
export class EncryptedBackupCloudService {
  /**
   * Sube y actualiza el respaldo encriptado en Firestore (documento 'latest')
   */
  public static async uploadLatestBackup(
    user: FirebaseUser,
    state: AppStatePayload,
    passphrase = DEFAULT_SYNC_PASSPHRASE,
    formatVersion: 1 | 2 = 2,
    deviceInfo?: { deviceId?: string; deviceModel?: string }
  ): Promise<CloudBackupServiceResponse> {
    try {
      if (!user) {
        return { ok: false, error: 'Usuario no autenticado en Firebase.' };
      }

      const pkg = buildEncryptedPosBackupPackage(state, formatVersion);

      const meta = await syncEncryptedBackupToFirestore(user, pkg, 'latest', {
        deviceId: deviceInfo?.deviceId || 'web-caja-' + (state.settings.cashRegisterNumber || '1'),
        deviceModel: deviceInfo?.deviceModel || 'SmartPOS286 Web Terminal',
      });

      return { ok: true, meta };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return { ok: false, error: errMessage };
    }
  }

  /**
   * Descarga el documento 'latest' desde Firestore y lo descifra utilizando AES-256-GCM + PBKDF2
   */
  public static async downloadAndDecryptLatestBackup(
    user: FirebaseUser,
    passphrase = DEFAULT_SYNC_PASSPHRASE
  ): Promise<{ ok: boolean; error?: string; pkg?: EncryptedPosBackupPackage; doc?: DirectEncryptedBackupDoc }> {
    try {
      if (!user) {
        return { ok: false, error: 'Usuario no autenticado en Firebase.' };
      }

      const docSnap = await fetchLatestEncryptedBackupFromFirestore(user, 'latest');
      if (!docSnap || !docSnap.encryptedPayload) {
        return { ok: false, error: 'No se encontró el respaldo "latest" en Firestore para este usuario.' };
      }

      const pkg = await decryptPayloadToPackage(docSnap.encryptedPayload, passphrase);
      return { ok: true, pkg, doc: docSnap };
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      return { ok: false, error: errMessage };
    }
  }

  /**
   * Obtiene la lista completa de respaldos encriptados disponibles en la cuenta
   */
  public static async listBackups(user: FirebaseUser): Promise<DirectEncryptedBackupMeta[]> {
    if (!user) return [];
    try {
      return await listEncryptedBackupsFromFirestore(user);
    } catch {
      return [];
    }
  }

  /**
   * Elimina un respaldo específico o 'latest'
   */
  public static async deleteBackup(user: FirebaseUser, backupId = 'latest'): Promise<boolean> {
    if (!user) return false;
    try {
      await deleteEncryptedBackupFromFirestore(user, backupId);
      return true;
    } catch {
      return false;
    }
  }
}
