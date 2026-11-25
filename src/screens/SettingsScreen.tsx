import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  CloudDownload,
  CloudUpload,
  Database,
  Download,
  FileCode2,
  FileText,
  HardDrive,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  RefreshCw,
  Server,
  ShieldCheck,
  Store,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { FIREBASE_PROJECT_INFO, sanitizeInstanceId } from '../firebase';
import { downloadBinaryFile, downloadTextFile } from '../utils/csvInventory';
import { DEFAULT_SYNC_PASSPHRASE } from '../utils/encryptedBackup';
import { exportModuleTablePdf } from '../utils/pdfExport';

type ConfirmModalState =
  | {
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => unknown | Promise<unknown>;
    }
  | null;

type PassphraseModalState =
  | {
      mode: 'EXPORT' | 'IMPORT';
      fileBytes?: Uint8Array;
      fileText?: string;
      fileName?: string;
      exportFormat?: 1 | 2;
    }
  | null;

export const SettingsScreen: React.FC = () => {
  const {
    state,
    currentUser,
    toggleTheme,
    updateSettings,
    syncBcvRateFromApi,
    isSyncingRate,
    isLicensed,
    setIsLicenseOpen,
    changeCurrentUserPin,
    exportBackupJson,
    importBackupJson,
    exportEncryptedBackup,
    exportEncryptedBackupBinary,
    importEncryptedBackup,
    exportSqlBackup,
    importSqlBackup,
    firebaseUser,
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
    latestEncryptedBackupMeta,
    encryptedBackupList,
    refreshEncryptedBackups,
    syncLatestEncryptedBackupToFirestore,
    restoreLatestEncryptedBackupFromFirestore,
    syncCajaPosToDriveNow,
    restoreCajaPosFromDrive,
    notify,
  } = usePos();

  const isAdminProfile = currentUser?.role === 'ADMIN';

  const [storeName, setStoreName] = useState(state.settings.storeName);
  const [storeRif, setStoreRif] = useState(state.settings.storeRif);
  const [storePhone, setStorePhone] = useState(state.settings.storePhone);
  const [storeAddress, setStoreAddress] = useState(state.settings.storeAddress);
  const [cashRegisterNumber, setCashRegisterNumber] = useState(state.settings.cashRegisterNumber);
  const [commissionRegisters, setCommissionRegisters] = useState(state.settings.commissionRegisters);
  const [minMargin, setMinMargin] = useState(String(state.settings.minProfitMarginPercent));

  useEffect(() => {
    setStoreName(state.settings.storeName);
    setStoreRif(state.settings.storeRif);
    setStorePhone(state.settings.storePhone);
    setStoreAddress(state.settings.storeAddress);
    setCashRegisterNumber(state.settings.cashRegisterNumber);
    setCommissionRegisters(state.settings.commissionRegisters);
    setMinMargin(String(state.settings.minProfitMarginPercent));
  }, [state.settings]);

  const [currPin, setCurrPin] = useState('');
  const [newPin, setNewPin] = useState('');

  const [instanceLabel, setInstanceLabel] = useState('Instancia Principal');
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [passphraseModal, setPassphraseModal] = useState<PassphraseModalState>(null);
  const [passphraseInput, setPassphraseInput] = useState('');
  const [isProcessingModal, setIsProcessingModal] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [copiedRules, setCopiedRules] = useState(false);

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminProfile) {
      updateSettings({
        cashRegisterNumber: cashRegisterNumber.trim() || '01',
        commissionRegisters: commissionRegisters.trim(),
        minProfitMarginPercent: Math.max(0, Number(minMargin) || 0),
      });
      notify(
        'Operación Actualizada',
        'Los datos fiscales de la empresa permanecen bloqueados y protegidos (solo Administrador).',
        'info'
      );
      return;
    }

    updateSettings({
      storeName: storeName.trim() || 'SMARTPOS286',
      storeRif: storeRif.trim() || 'J-00000000-0',
      storePhone: storePhone.trim(),
      storeAddress: storeAddress.trim(),
      cashRegisterNumber: cashRegisterNumber.trim() || '01',
      commissionRegisters: commissionRegisters.trim(),
      minProfitMarginPercent: Math.max(0, Number(minMargin) || 0),
    });
    notify('Ajustes Guardados', 'Configuración del comercio actualizada correctamente.', 'success');
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdminProfile) {
      notify('Acceso Restringido', 'Solo el Administrador puede cambiar el logo del comercio.', 'warning');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ storeLogoDataUrl: String(reader.result || '') });
      notify('Logo Actualizado', 'Logo del comercio guardado para comprobantes.', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';
    setConfirmModal({
      title: 'Restaurar Respaldo JSON',
      message: `¿Confirmas restaurar "${file.name}"? Esta acción reemplazará los datos locales actuales.`,
      confirmLabel: 'Restaurar JSON',
      danger: true,
      onConfirm: () => {
        const res = importBackupJson(text);
        if (!res.ok && res.error) notify('Error de Respaldo', res.error, 'error');
      },
    });
  };

  const handleImportEncryptedFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    e.target.value = '';
    setPassphraseInput('');
    setPassphraseModal({ mode: 'IMPORT', fileBytes: bytes, fileName: file.name });
  };

  const handleImportSqlFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    e.target.value = '';
    setConfirmModal({
      title: 'Importar Instancia SQL (.sql)',
      message: `¿Deseas restaurar la base de datos desde "${file.name}"? Los datos locales actuales serán reemplazados.`,
      confirmLabel: 'Importar SQL',
      danger: true,
      onConfirm: () => {
        const res = importSqlBackup(text);
        if (!res.ok && res.error) notify('Error SQL', res.error, 'error');
      },
    });
  };

  const handleSubmitPassphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphraseModal) return;
    if (passphraseInput.trim().length > 0 && passphraseInput.trim().length < 4) {
      notify('Clave Corta', 'Si usas contraseña personalizada, ingresa al menos 4 caracteres.', 'warning');
      return;
    }
    setIsProcessingModal(true);
    try {
      if (passphraseModal.mode === 'EXPORT') {
        const formatVersion = passphraseModal.exportFormat || 1;
        const binaryBytes = await exportEncryptedBackupBinary(
          passphraseInput.trim() || undefined,
          formatVersion
        );
        const ext = formatVersion === 2 ? 'cajapos.enc' : 'sp286enc';
        downloadBinaryFile(
          `respaldo_cajapos_${formatVersion === 2 ? 'v2_gzip' : 'v1'}_${Date.now()}.${ext}`,
          binaryBytes
        );
        notify(
          'Respaldo Encriptado Generado',
          `Archivo binario ${formatVersion === 2 ? 'V2 (GZIP)' : 'V1 (JSON)'} AES-256-GCM + PBKDF2 descargado (interoperable con Android).`,
          'success'
        );
      } else if (passphraseModal.fileBytes || passphraseModal.fileText) {
        const inputData = passphraseModal.fileBytes || passphraseModal.fileText || '';
        const res = await importEncryptedBackup(inputData, passphraseInput.trim() || undefined);
        if (!res.ok && res.error) {
          notify('Error al Descifrar', res.error, 'error');
          return;
        }
      }
      setPassphraseModal(null);
      setPassphraseInput('');
    } catch (err) {
      notify('Error de Cifrado', err instanceof Error ? err.message : 'No se pudo procesar el archivo.', 'error');
    } finally {
      setIsProcessingModal(false);
    }
  };

  const handleExportSettingsPdf = () => {
    exportModuleTablePdf({
      settings: state.settings,
      title: 'Ficha de Configuración y Respaldo del Comercio',
      subtitle: 'Resumen de parámetros fiscales, integridad de datos e instancias registradas',
      columns: ['Parámetro', 'Valor Actual'],
      rows: [
        ['Razón Social', state.settings.storeName],
        ['RIF', state.settings.storeRif],
        ['Teléfono', state.settings.storePhone || 'N/A'],
        ['Dirección', state.settings.storeAddress || 'N/A'],
        ['Tasa BCV Oficial', `Bs. ${state.settings.bcvRate.toFixed(2)}`],
        ['Caja Actual / Comisiones', `${state.settings.cashRegisterNumber} / ${state.settings.commissionRegisters || 'Todas'}`],
        ['Ancho Papel Térmico', state.settings.printerPaperWidth],
        ['Licencia', state.settings.licenseType],
        ['Productos / Clientes / Proveedores', `${state.products.length} / ${state.customers.length} / ${state.suppliers.length}`],
        ['Facturas / Presupuestos / Notas', `${state.sales.length} / ${state.quotes.length} / ${state.deliveryNotes.length}`],
        ['Instancias Nube Guardadas', String(cloudInstances.length)],
        ['Respaldo Google Drive', driveFileMeta ? 'Sincronizado (Protegido SHA-256)' : 'Sin sincronizar'],
      ],
      summaryLines: [
        'Integridad Empresarial: Protegida — Ningún módulo de facturación modifica los datos de la empresa.',
      ],
      filename: `configuracion_${Date.now()}.pdf`,
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      {/* Theme + License */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex items-center justify-between rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <div>
            <p className="text-sm font-extrabold">Apariencia del Sistema</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Tema actual: {state.settings.themeMode === 'DARK' ? 'Oscuro Profundo' : 'Azul Cielo Claro'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            {state.settings.themeMode === 'DARK' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            Cambiar Tema
          </button>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-300/60 bg-white/95 p-4 dark:border-slate-700 dark:bg-[#1E2D48]">
          <div>
            <p className="text-sm font-extrabold">Estado de Licencia</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isLicensed ? 'SmartPOS286 Comercial Activo' : 'Modo Prueba (10 prod / 5 fact. diarias)'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsLicenseOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"
          >
            <ShieldCheck className="h-4 w-4" />
            Gestionar
          </button>
        </div>
      </div>

      {/* Store & Fiscal Config */}
      <form
        onSubmit={handleSaveCompany}
        className="space-y-4 rounded-2xl border border-slate-300/60 bg-white/95 p-5 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-indigo-500" />
            <div>
              <h3 className="text-base font-extrabold">Perfil del Comercio y Operación</h3>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                Integridad protegida: ninguna facturación o módulo operativo altera estos datos fiscales.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleExportSettingsPdf}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
            >
              <FileText className="h-3.5 w-3.5" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={syncBcvRateFromApi}
              disabled={isSyncingRate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/15 px-3 py-1.5 text-xs font-bold text-sky-700 dark:text-sky-300"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingRate ? 'animate-spin' : ''}`} />
              Sincronizar BCV ({state.settings.bcvRate.toFixed(2)})
            </button>
          </div>
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-bold">Nombre / Razón Social</label>
            <input
              type="text"
              value={storeName}
              disabled={!isAdminProfile}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">RIF</label>
            <input
              type="text"
              value={storeRif}
              disabled={!isAdminProfile}
              onChange={(e) => setStoreRif(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">Teléfono</label>
            <input
              type="text"
              value={storePhone}
              disabled={!isAdminProfile}
              onChange={(e) => setStorePhone(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">Dirección</label>
            <input
              type="text"
              value={storeAddress}
              disabled={!isAdminProfile}
              onChange={(e) => setStoreAddress(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">Número de Caja Actual</label>
            <input
              type="text"
              value={cashRegisterNumber}
              onChange={(e) => setCashRegisterNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">Cajas Habilitadas para Comisión (sep. coma)</label>
            <input
              type="text"
              value={commissionRegisters}
              onChange={(e) => setCommissionRegisters(e.target.value)}
              placeholder="Ej: 01, 02"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <input
              type="checkbox"
              checked={state.settings.isMinProfitMarginEnabled}
              onChange={(e) => updateSettings({ isMinProfitMarginEnabled: e.target.checked })}
            />
            <span className="font-semibold">Margen automático productos</span>
          </label>
          <div>
            <label className="mb-1 block font-bold">Margen Mínimo (%)</label>
            <input
              type="number"
              value={minMargin}
              onChange={(e) => setMinMargin(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <div>
            <label className="mb-1 block font-bold">Ancho Papel Térmico</label>
            <select
              value={state.settings.printerPaperWidth}
              onChange={(e) => updateSettings({ printerPaperWidth: e.target.value as '58mm' | '80mm' })}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            >
              <option value="80mm">80 mm (Mostrador)</option>
              <option value="58mm">58 mm (Portátil)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label
            className={`inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold dark:border-slate-600 ${
              isAdminProfile ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>{state.settings.storeLogoDataUrl ? 'Cambiar Logo del Comercio' : 'Subir Logo del Comercio'}</span>
            <input type="file" accept="image/*" disabled={!isAdminProfile} className="hidden" onChange={handleLogoUpload} />
          </label>
          <button
            type="submit"
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white hover:bg-indigo-700"
          >
            Guardar Configuración
          </button>
        </div>
      </form>

      {/* Change PIN + Local Backups (JSON, Encrypted JSON, SQL) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (changeCurrentUserPin(currPin, newPin)) {
              setCurrPin('');
              setNewPin('');
            }
          }}
          className="space-y-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 text-xs dark:border-slate-700 dark:bg-[#1E2D48]"
        >
          <div className="flex items-center gap-2 font-extrabold">
            <KeyRound className="h-4 w-4 text-amber-500" />
            <span>Cambiar Mi PIN de Seguridad</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="password"
              required
              value={currPin}
              onChange={(e) => setCurrPin(e.target.value)}
              placeholder="PIN Actual"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
            <input
              type="password"
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Nuevo PIN"
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
            />
          </div>
          <button type="submit" className="rounded-xl bg-amber-500 px-4 py-2 font-extrabold text-slate-950">
            Actualizar PIN
          </button>
        </form>

        {/* JSON & Encrypted JSON Backups */}
        <div className="space-y-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 text-xs dark:border-slate-700 dark:bg-[#1E2D48]">
          <div className="flex items-center gap-2 font-extrabold">
            <Lock className="h-4 w-4 text-emerald-500" />
            <span className="text-sm">Respaldo JSON y JSON Encriptado</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Exporta o importa tus datos en JSON estándar o protegido con cifrado AES-GCM-256 por contraseña.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `respaldo_smartpos286_${Date.now()}.json`,
                  exportBackupJson(),
                  'application/json;charset=utf-8;'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 font-bold dark:border-slate-600">
              <Upload className="h-3.5 w-3.5" />
              Importar JSON
              <input type="file" accept=".json" className="hidden" onChange={handleImportJson} />
            </label>
            <button
              type="button"
              onClick={() => {
                setPassphraseInput('');
                setPassphraseModal({ mode: 'EXPORT', exportFormat: 1 });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 font-bold text-white hover:bg-indigo-700"
              title="Formato V1: JSON UTF-8 directo con AES-256-GCM + PBKDF2"
            >
              <Lock className="h-3.5 w-3.5" />
              Encriptado V1 (Local)
            </button>
            <button
              type="button"
              onClick={() => {
                setPassphraseInput('');
                setPassphraseModal({ mode: 'EXPORT', exportFormat: 2 });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 font-bold text-white hover:bg-purple-700"
              title="Formato V2: GZIP comprimido con AES-256-GCM + PBKDF2 (Android/Nube)"
            >
              <Lock className="h-3.5 w-3.5" />
              Encriptado V2 (GZIP/Android)
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-indigo-400/50 px-3 py-2 font-bold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/30">
              <Upload className="h-3.5 w-3.5" />
              Restaurar Encriptado
              <input
                type="file"
                accept=".cajapos.enc,.sp286enc,.enc,.json,.b64,*"
                className="hidden"
                onChange={handleImportEncryptedFile}
              />
            </label>
          </div>
        </div>

        {/* SQL Backup (.sql) */}
        <div className="space-y-3 rounded-2xl border border-slate-300/60 bg-white/95 p-4 text-xs dark:border-slate-700 dark:bg-[#1E2D48]">
          <div className="flex items-center gap-2 font-extrabold">
            <FileCode2 className="h-4 w-4 text-sky-500" />
            <span className="text-sm">Respaldo e Instancia SQL (.sql)</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            Genera un script SQL relacional completo (DDL + INSERTs) o restaura una instancia desde un archivo .sql.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  `smartpos286_sql_${Date.now()}.sql`,
                  exportSqlBackup(),
                  'application/sql;charset=utf-8;'
                )
              }
              className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 font-bold text-white"
            >
              <Download className="h-3.5 w-3.5" />
              Exportar .SQL
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 font-bold dark:border-slate-600">
              <Upload className="h-3.5 w-3.5" />
              Importar .SQL
              <input type="file" accept=".sql" className="hidden" onChange={handleImportSqlFile} />
            </label>
          </div>
        </div>
      </div>

      {/* Admin-only Google Sign-In, Cloud Instances (Firestore) & Private Google Drive Backup */}
      {isAdminProfile ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Google Sign-In, Firebase & Multi-Instance Backups */}
          <div className="space-y-4 rounded-2xl border border-slate-300/60 bg-white/95 p-5 text-xs shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-sky-500" />
                <div>
                  <h3 className="text-sm font-extrabold">Google, Firebase e Instancias en la Nube</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Exclusivo Administrador ({currentUser?.username})
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  firebaseConnected
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                {firebaseStatusText}
              </span>
            </div>

            <div className="grid gap-1.5 rounded-xl bg-slate-100/80 p-3 font-mono-num text-[11px] dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Proyecto Firebase:</span>
                <span className="truncate font-bold text-indigo-600 dark:text-indigo-400">{FIREBASE_PROJECT_INFO.projectId}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Base Firestore:</span>
                <span className="truncate font-bold">{FIREBASE_PROJECT_INFO.firestoreDatabaseId}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Apps Android Vinculadas:</span>
                <span className="truncate font-mono text-[10px] text-slate-700 dark:text-slate-300">
                  com.aistudio.cajapos.mqplvx / vsupzn
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Ubicación Respaldo:</span>
                <span className="truncate font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  users/{'{userId}'}/encrypted_backups/latest
                </span>
              </div>
            </div>

            {!firebaseUser ? (
              <div className="space-y-3">
                <p className="text-slate-600 dark:text-slate-300">
                  Inicia sesión con tu cuenta Google para habilitar el respaldo sincronizado en Firestore y el
                  respaldo privado en Google Drive.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isFirebaseSyncing}
                    onClick={() => void loginWithGoogleAdmin()}
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-extrabold text-slate-900 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                      />
                    </svg>
                    {isFirebaseSyncing ? 'Conectando...' : 'Iniciar sesión con Google'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void checkFirebaseConnection()}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold dark:border-slate-600"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Probar Firestore
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRulesModal(true)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-50/60 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100/60 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Reglas Firestore
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {firebaseUser.photoURL ? (
                      <img
                        src={firebaseUser.photoURL}
                        alt={firebaseUser.displayName || 'Google User'}
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-extrabold text-white">
                        {(firebaseUser.displayName || firebaseUser.email || 'G')[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-extrabold">{firebaseUser.displayName || 'Administrador Google'}</p>
                      <p className="truncate text-[11px] text-slate-600 dark:text-slate-300">{firebaseUser.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setShowRulesModal(true)}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50/60 px-2.5 py-1.5 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100/60 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                      title="Ver reglas recomendadas de Firestore"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Reglas
                    </button>
                    <button
                      type="button"
                      onClick={() => void logoutGoogleAdmin()}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-bold text-rose-500 hover:bg-rose-500/20"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Salir
                    </button>
                  </div>
                </div>

                {/* Centralized Encrypted Cloud Backup (users/{userId}/encrypted_backups/latest) */}
                <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-50/70 to-purple-50/50 p-3.5 dark:from-indigo-950/30 dark:to-purple-950/20 dark:border-indigo-500/20">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/60 pb-2.5 dark:border-indigo-800/40">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                        <Lock className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-indigo-950 dark:text-indigo-200">
                          Respaldo Centralizado en Firestore
                        </h4>
                        <p className="font-mono-num text-[10px] text-indigo-700/90 dark:text-indigo-300/90 font-medium">
                          users/{firebaseUser.uid.slice(0, 10)}.../encrypted_backups/latest
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                      <ShieldCheck className="h-3 w-3" />
                      {latestEncryptedBackupMeta?.formatVersion === 1
                        ? 'CAJAPOS_ENC_JSON_V1'
                        : 'CAJAPOS_ENC_GZIP_V2'}
                    </span>
                  </div>

                  {latestEncryptedBackupMeta ? (
                    <div className="mt-2.5 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                        <div className="rounded-lg border border-indigo-100 bg-white/80 p-2 dark:border-indigo-900/40 dark:bg-slate-900/70">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">Comercio</span>
                          <span className="block truncate font-bold text-slate-900 dark:text-slate-100">
                            {latestEncryptedBackupMeta.storeName || state.settings.storeName}
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {latestEncryptedBackupMeta.storeRif || state.settings.storeRif}
                          </span>
                        </div>
                        <div className="rounded-lg border border-indigo-100 bg-white/80 p-2 dark:border-indigo-900/40 dark:bg-slate-900/70">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">Dispositivo Origen</span>
                          <span className="block truncate font-bold text-slate-900 dark:text-slate-100">
                            {latestEncryptedBackupMeta.deviceModel}
                          </span>
                          <span className="block truncate font-mono-num text-[10px] text-slate-400">
                            {latestEncryptedBackupMeta.deviceId}
                          </span>
                        </div>
                        <div className="col-span-2 rounded-lg border border-indigo-100 bg-white/80 p-2 sm:col-span-1 dark:border-indigo-900/40 dark:bg-slate-900/70">
                          <span className="block text-[10px] text-slate-500 dark:text-slate-400">Contenido Registrado</span>
                          <span className="block font-bold text-emerald-600 dark:text-emerald-400">
                            {latestEncryptedBackupMeta.productsCount} prod. • {latestEncryptedBackupMeta.salesCount} ventas
                          </span>
                          <span className="block text-[10px] text-slate-400">
                            {latestEncryptedBackupMeta.exportedAtMs
                              ? new Date(latestEncryptedBackupMeta.exportedAtMs).toLocaleString()
                              : 'Reciente'}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isFirebaseSyncing}
                          onClick={() => void syncLatestEncryptedBackupToFirestore('latest')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          <CloudUpload className="h-3.5 w-3.5" />
                          Actualizar en Nube (latest)
                        </button>
                        <button
                          type="button"
                          disabled={isFirebaseSyncing}
                          onClick={() =>
                            setConfirmModal({
                              title: 'Restaurar Respaldo Encriptado (latest)',
                              message: `¿Restaurar el respaldo centralizado de la cuenta ${latestEncryptedBackupMeta.googleEmail}? Se actualizará la base de datos local con ${latestEncryptedBackupMeta.productsCount} productos y ${latestEncryptedBackupMeta.salesCount} ventas registradas en la nube.`,
                              confirmLabel: 'Restaurar desde Nube',
                              danger: true,
                              onConfirm: () => restoreLatestEncryptedBackupFromFirestore('latest'),
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <CloudDownload className="h-3.5 w-3.5" />
                          Restaurar a este Equipo
                        </button>
                        <button
                          type="button"
                          disabled={isFirebaseSyncing}
                          onClick={() => void refreshEncryptedBackups()}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          title="Verificar estado en Firestore"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Verificar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 space-y-2">
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        Aún no existe el documento <code className="rounded bg-indigo-100/70 px-1 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">users/{'{userId}'}/encrypted_backups/latest</code> para tu cuenta Google.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isFirebaseSyncing}
                          onClick={() => void syncLatestEncryptedBackupToFirestore('latest')}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60"
                        >
                          <CloudUpload className="h-3.5 w-3.5" />
                          Crear Respaldo Inicial (latest)
                        </button>
                        <button
                          type="button"
                          disabled={isFirebaseSyncing}
                          onClick={() => void refreshEncryptedBackups()}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Buscar en Firestore
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-[10px] text-indigo-800/80 dark:text-indigo-300/80">
                    Sincronización multi-dispositivo directa: Cualquier terminal (Web o Android) autenticado con <span className="font-bold underline">{firebaseUser.email}</span> lee este documento exacto con Magic Header de 19 bytes (<span className="font-mono font-bold">CAJAPOS_ENC_GZIP_V2</span>) y clave PBKDF2.
                  </p>
                </div>

                {/* Create / Update Cloud Instance */}
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                  <Server className="h-4 w-4 text-indigo-500" />
                  <input
                    type="text"
                    value={instanceLabel}
                    onChange={(e) => setInstanceLabel(e.target.value)}
                    placeholder="Nombre de la instancia (Ej: Sucursal Centro)"
                    className="min-w-[170px] flex-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                  />
                  <button
                    type="button"
                    disabled={isFirebaseSyncing}
                    onClick={() => {
                      const cleanLabel = instanceLabel.trim() || 'Instancia Principal';
                      const id = sanitizeInstanceId(cleanLabel);
                      void backupToFirebase(id, cleanLabel);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    Guardar Instancia
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshCloudInstances()}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 font-bold dark:border-slate-600"
                    title="Actualizar lista de instancias"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Saved Instances List */}
                <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                  {cloudInstances.length === 0 ? (
                    <p className="py-2 text-center text-[11px] text-slate-400">
                      No hay instancias guardadas todavía. Guarda tu primera instancia arriba.
                    </p>
                  ) : (
                    cloudInstances.map((inst) => (
                      <div
                        key={inst.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-extrabold">
                            {inst.label}{' '}
                            <span className="font-mono-num text-[10px] font-normal text-slate-400">({inst.id})</span>
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {inst.productsCount} prod • {inst.salesCount} ventas •{' '}
                            {inst.updatedAtIso ? new Date(inst.updatedAtIso).toLocaleString() : 'Reciente'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isFirebaseSyncing}
                            onClick={() =>
                              setConfirmModal({
                                title: 'Restaurar Instancia desde la Nube',
                                message: `¿Restaurar la instancia "${inst.label}"? Los datos locales actuales serán reemplazados.`,
                                confirmLabel: 'Restaurar Instancia',
                                danger: true,
                                onConfirm: () => restoreFromFirebase(inst.id),
                              })
                            }
                            className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-sky-700"
                          >
                            <CloudDownload className="h-3 w-3" />
                            Restaurar
                          </button>
                          <button
                            type="button"
                            disabled={isFirebaseSyncing}
                            onClick={() =>
                              setConfirmModal({
                                title: 'Eliminar Instancia de Firestore',
                                message: `¿Eliminar permanentemente la instancia "${inst.label}" de la nube?`,
                                confirmLabel: 'Eliminar',
                                danger: true,
                                onConfirm: () => deleteFirebaseInstance(inst.id),
                              })
                            }
                            className="inline-flex items-center rounded-lg border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-500 hover:bg-rose-500/20"
                            title="Eliminar instancia"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Private Google Drive Real-Time Backup */}
          <div className="space-y-4 rounded-2xl border border-slate-300/60 bg-white/95 p-5 text-xs shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-emerald-500" />
                <div>
                  <h3 className="text-sm font-extrabold">Respaldo Google Drive</h3>
                </div>
              </div>
              <span
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                  driveRealtimeEnabled
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {driveSyncStatus === 'SYNCING'
                  ? 'Sincronizando...'
                  : driveRealtimeEnabled
                    ? 'Tiempo Real Activo'
                    : 'Manual / Pausado'}
              </span>
            </div>

            <div className="space-y-2 rounded-xl bg-slate-100/80 p-3 text-[11px] dark:bg-slate-900/60">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Integridad del respaldo:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Privado e inviolable (Verificación SHA-256)
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Token Drive en sesión:</span>
                <span
                  className={`inline-block w-[200.578px] rounded px-2 py-0.5 text-center font-bold bg-[#1f0303] ${
                    hasDriveToken ? 'text-emerald-500' : 'text-amber-500'
                  }`}
                >
                  {hasDriveToken ? 'Autorizado (en memoria)' : 'Inicia sesión Google para autorizar'}
                </span>
              </div>
              {driveFileMeta && (
                <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-1.5 dark:border-slate-700">
                  <span className="text-slate-500 dark:text-slate-400">Última modificación:</span>
                  <span className="font-mono-num">
                    {driveLastSyncedAt
                      ? new Date(driveLastSyncedAt).toLocaleString()
                      : driveFileMeta.modifiedTime
                        ? new Date(driveFileMeta.modifiedTime).toLocaleString()
                        : 'Guardado'}
                  </span>
                </div>
              )}
            </div>

            {!firebaseUser || !hasDriveToken ? (
              <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-800 dark:text-amber-200">
                <p>
                  {firebaseUser
                    ? 'Para habilitar el respaldo en Google Drive en esta sesión de navegador, reconecta con Google pulsando el botón para autorizar el acceso privado.'
                    : 'Conecta primero tu cuenta Google en el panel izquierdo para crear y sincronizar tu respaldo en Google Drive.'}
                </p>
                <button
                  type="button"
                  disabled={isFirebaseSyncing}
                  onClick={() => void loginWithGoogleAdmin()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white hover:bg-indigo-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Autorizar Google Drive
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div>
                    <p className="font-extrabold">Respaldo Automático en Tiempo Real</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Actualiza el respaldo privado en Google Drive automáticamente ante cada venta o cambio.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (driveRealtimeEnabled) {
                        setDriveRealtimeEnabled(false);
                      } else {
                        setConfirmModal({
                          title: 'Activar Respaldo en Tiempo Real',
                          message:
                            'Cada cambio en el sistema actualizará automáticamente el respaldo privado e inviolable en tu Google Drive. ¿Deseas activarlo?',
                          confirmLabel: 'Activar Tiempo Real',
                          onConfirm: () => setDriveRealtimeEnabled(true),
                        });
                      }
                    }}
                    className={`rounded-xl px-3.5 py-2 font-extrabold text-white ${
                      driveRealtimeEnabled ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {driveRealtimeEnabled ? 'Pausar Tiempo Real' : 'Activar Tiempo Real'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={driveSyncStatus === 'SYNCING'}
                    onClick={() =>
                      setConfirmModal({
                        title: 'Actualizar Respaldo en Google Drive',
                        message:
                          '¿Deseas subir y actualizar ahora mismo el respaldo privado en Google Drive con los datos locales actuales?',
                        confirmLabel: 'Sincronizar Ahora',
                        onConfirm: () => syncCajaPosToDriveNow(false),
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    <CloudUpload className="h-4 w-4" />
                    Sincronizar Ahora
                  </button>

                  <button
                    type="button"
                    disabled={driveSyncStatus === 'SYNCING'}
                    onClick={() =>
                      setConfirmModal({
                        title: 'Restaurar desde Google Drive',
                        message:
                          'Esta operación verificará la integridad del respaldo privado en tu Google Drive y restaurará los datos locales. ¿Continuar?',
                        confirmLabel: 'Restaurar de Drive',
                        danger: true,
                        onConfirm: () => restoreCajaPosFromDrive(),
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    <CloudDownload className="h-4 w-4" />
                    Restaurar Respaldo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">
          <Lock className="h-5 w-5 shrink-0" />
          <p>
            El inicio de sesión con Google, las instancias en Firebase Firestore y el respaldo en Google Drive están
            disponibles únicamente desde un perfil <strong>Administrador</strong>.
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-300/60 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#1E2D48]">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`h-6 w-6 shrink-0 ${confirmModal.danger ? 'text-rose-500' : 'text-indigo-500'}`}
              />
              <div>
                <h4 className="text-sm font-extrabold">{confirmModal.title}</h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{confirmModal.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                disabled={isProcessingModal}
                onClick={() => setConfirmModal(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 font-bold dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isProcessingModal}
                onClick={async () => {
                  setIsProcessingModal(true);
                  try {
                    await confirmModal.onConfirm();
                  } finally {
                    setIsProcessingModal(false);
                    setConfirmModal(null);
                  }
                }}
                className={`rounded-xl px-4 py-2 font-extrabold text-white ${
                  confirmModal.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isProcessingModal ? 'Procesando...' : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passphrase Modal for Encrypted Backup */}
      {passphraseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSubmitPassphrase}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-300/60 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#1E2D48]"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-indigo-500" />
              <div>
                <h4 className="text-sm font-extrabold">
                  {passphraseModal.mode === 'EXPORT'
                    ? `Cifrar Respaldo Binario (AES-256-GCM)`
                    : 'Descifrar Respaldo Encriptado (AES-256-GCM)'}
                </h4>
                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {passphraseModal.mode === 'EXPORT'
                    ? passphraseModal.exportFormat === 2
                      ? 'Encabezado: CAJAPOS_ENC_GZIP_V2 (GZIP + AAD)'
                      : 'Encabezado: CAJAPOS_ENC_JSON_V1 (Directo + AAD)'
                    : `Archivo: ${passphraseModal.fileName || 'respaldo'}`}
                </span>
              </div>
            </div>

            {passphraseModal.mode === 'EXPORT' && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPassphraseModal((prev) => (prev ? { ...prev, exportFormat: 1 } : null))}
                  className={`flex-1 rounded-xl border p-2 text-left text-xs font-bold transition-all ${
                    (passphraseModal.exportFormat || 1) === 1
                      ? 'border-indigo-500 bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  <div>V1: JSON Local</div>
                  <div className="text-[10px] font-normal text-slate-500">UTF-8 directo sin compresión</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPassphraseModal((prev) => (prev ? { ...prev, exportFormat: 2 } : null))}
                  className={`flex-1 rounded-xl border p-2 text-left text-xs font-bold transition-all ${
                    passphraseModal.exportFormat === 2
                      ? 'border-purple-500 bg-purple-50/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  <div>V2: GZIP Nube / Android</div>
                  <div className="text-[10px] font-normal text-slate-500">Comprimido para sincronización</div>
                </button>
              </div>
            )}

            <p className="text-xs text-slate-600 dark:text-slate-300">
              {passphraseModal.mode === 'EXPORT'
                ? 'Introduce una contraseña personalizada o déjalo vacío para usar la Clave Maestra de Sincronización Automática con la app de Android.'
                : 'Ingresa la contraseña personalizada o déjalo en blanco para usar la Clave Maestra de Sincronización Automática.'}
            </p>

            <div className="space-y-1.5">
              <input
                type="password"
                autoFocus
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                placeholder="Contraseña (opcional: vacío = Clave Maestra Sync)"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-slate-900"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPassphraseInput(DEFAULT_SYNC_PASSPHRASE)}
                  className="text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  Usar Clave Maestra Android
                </button>
                {passphraseInput && (
                  <button
                    type="button"
                    onClick={() => setPassphraseInput('')}
                    className="text-[10px] text-slate-400 hover:text-slate-600"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isProcessingModal}
                onClick={() => setPassphraseModal(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 font-bold dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isProcessingModal}
                className="rounded-xl bg-indigo-600 px-4 py-2 font-extrabold text-white hover:bg-indigo-700"
              >
                {isProcessingModal
                  ? 'Procesando...'
                  : passphraseModal.mode === 'EXPORT'
                    ? `Generar y Descargar ${passphraseModal.exportFormat === 2 ? 'V2' : 'V1'}`
                    : 'Descifrar y Restaurar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Firestore Security Rules Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-300/80 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-[#1E2D48]">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Reglas de Seguridad para Proyecto {FIREBASE_PROJECT_INFO.projectId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className="text-lg font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Para que tu app de Android y esta versión Web puedan compartir los respaldos en paralelo en la ruta{' '}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[11px] font-bold text-indigo-600 dark:bg-slate-900 dark:text-indigo-400">
                users/{'{userId}'}/encrypted_backups/latest
              </code>
              , verifica que estas reglas estén publicadas en la{' '}
              <a
                href={`https://console.firebase.google.com/project/${FIREBASE_PROJECT_INFO.projectId}/firestore/rules`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-indigo-600 underline dark:text-indigo-400"
              >
                Consola de Firebase
              </a>
              :
            </p>

            <pre className="max-h-60 select-all overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-emerald-400">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    match /users/{userId}/encrypted_backups/{backupId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'ryd858501@gmail.com');
    }
    match /users/{userId}/private/{docId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'ryd858501@gmail.com');
    }
    match /workspaces/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'ryd858501@gmail.com');
    }
  }
}`}
            </pre>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
              <span className="text-[11px] text-slate-400">
                Compatible con Android Kotlin + Web AES-256-GCM
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const rulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
    match /users/{userId}/encrypted_backups/{backupId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'ryd858501@gmail.com');
    }
    match /users/{userId}/private/{docId} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'ryd858501@gmail.com');
    }
    match /workspaces/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && (request.auth.uid == userId || request.auth.token.email == 'ryd858501@gmail.com');
    }
  }
}`;
                    void navigator.clipboard.writeText(rulesText);
                    setCopiedRules(true);
                    setTimeout(() => setCopiedRules(false), 2500);
                  }}
                  className="rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  {copiedRules ? '✓ ¡Reglas Copiadas!' : 'Copiar Reglas'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="rounded-xl border border-slate-300 px-3.5 py-2 font-bold dark:border-slate-600"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
