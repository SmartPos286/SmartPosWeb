import React, { useState } from 'react';
import {
  AlertTriangle,
  CloudDownload,
  CloudUpload,
  HardDrive,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { usePos } from '../context/PosContext';

interface SuperuserMasterModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SuperuserMasterModal: React.FC<SuperuserMasterModalProps> = ({ isOpen, onClose }) => {
  const {
    state,
    updateSettings,
    wipeAppData,
    firebaseUser,
    hasDriveToken,
    driveSyncStatus,
    driveLastSyncedAt,
    driveFileMeta,
    syncCajaPosToDriveNow,
    restoreCajaPosFromDrive,
    loginWithGoogleAdmin,
    notify,
  } = usePos();

  const [licenseType, setLicenseType] = useState(state.settings.licenseType);
  const [licenseKey, setLicenseKey] = useState(state.settings.licenseKey);
  const [maxProducts, setMaxProducts] = useState(String(state.settings.maxProductsLimit));
  const [maxInvoices, setMaxInvoices] = useState(String(state.settings.maxDailyInvoicesLimit));
  const [maxTrialDays, setMaxTrialDays] = useState(String(state.settings.maxTrialDays || 15));
  const [clientEmail, setClientEmail] = useState(state.settings.licensedClientEmail || firebaseUser?.email || '');
  const [confirmWipeModal, setConfirmWipeModal] = useState(false);

  if (!isOpen) return null;

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      licenseType,
      licenseKey: licenseKey.trim(),
      maxProductsLimit: Math.max(1, Number(maxProducts) || 10),
      maxDailyInvoicesLimit: Math.max(1, Number(maxInvoices) || 5),
      maxTrialDays: Math.max(1, Number(maxTrialDays) || 15),
      licensedClientEmail: clientEmail.trim(),
    });
    notify('Configuración Master Actualizada', 'Límites de cliente, tiempo y licencias guardados correctamente.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-3xl border border-indigo-500/40 bg-white shadow-2xl dark:border-indigo-500/30 dark:bg-[#1E2D48]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Panel Master de Superusuario (Sr4K1L!)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Control exclusivo de licencias, límites, cliente, respaldos Google y vaciado maestro.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
          {/* Form: License & Client Limits */}
          <form onSubmit={handleSaveConfig} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-700">
              <KeyRound className="h-4 w-4 text-indigo-500" />
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200">
                Control de Licencia y Límites de Uso del Cliente
              </h4>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Tipo de Licencia</label>
                <select
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <option value="FREE_TRIAL">Prueba Gratuita (Free Trial)</option>
                  <option value="STANDARD">Licencia Estándar (Standard)</option>
                  <option value="PRO_LIFETIME">Pro Vitalicia (Lifetime)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">Clave de Activación</label>
                <input
                  type="text"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  placeholder="Ej. SP286-PRO-9999"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  Límite Máx. Productos en Inventario
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxProducts}
                  onChange={(e) => setMaxProducts(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  Límite Máx. Facturas Diarias
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxInvoices}
                  onChange={(e) => setMaxInvoices(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-600 dark:text-slate-300">
                  Tiempo Máximo de Uso / Vigencia (Días)
                </label>
                <input
                  type="number"
                  min="1"
                  value={maxTrialDays}
                  onChange={(e) => setMaxTrialDays(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block font-bold text-slate-600 dark:text-slate-300">
                    Correo Autorizado del Cliente (Google)
                  </label>
                  {firebaseUser?.email && (
                    <button
                      type="button"
                      onClick={() => setClientEmail(firebaseUser.email || '')}
                      className="text-[10px] font-bold text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                      Copiar de Google ({firebaseUser.email})
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="ej. cliente@gmail.com"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-semibold text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 font-extrabold text-white hover:bg-indigo-700 shadow-md"
              >
                Guardar Licencia y Límites
              </button>
            </div>
          </form>

          {/* Google & Google Drive Client Backup Status */}
          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5 dark:border-slate-700">
              <HardDrive className="h-4 w-4 text-emerald-500" />
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200">
                Gestión de Correo del Cliente y Respaldo Google Drive (`cajapos.json`)
              </h4>
            </div>

            <div className="grid gap-2 text-slate-600 dark:text-slate-300">
              <div className="flex justify-between rounded-lg bg-white p-2.5 dark:bg-slate-800">
                <span className="font-semibold">Correo Asignado al Cliente:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-100">
                  {state.settings.licensedClientEmail || 'Sin correo asignado aún'}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-white p-2.5 dark:bg-slate-800">
                <span className="font-semibold">Cuenta Google en Sesión:</span>
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {firebaseUser?.email || firebaseUser?.displayName || 'No conectado en esta sesión'}
                </span>
              </div>
              <div className="flex justify-between rounded-lg bg-white p-2.5 dark:bg-slate-800">
                <span className="font-semibold">Token Google Drive:</span>
                <span className={`font-bold ${hasDriveToken ? 'text-emerald-600' : 'text-amber-500'}`}>
                  {hasDriveToken ? 'Autorizado (Activo)' : 'No autorizado'}
                </span>
              </div>
              {driveFileMeta && (
                <div className="flex justify-between rounded-lg bg-white p-2.5 dark:bg-slate-800">
                  <span className="font-semibold">Archivo `cajapos.json` Drive:</span>
                  <span className="font-mono text-emerald-600">
                    Sincronizado ({driveLastSyncedAt ? new Date(driveLastSyncedAt).toLocaleString() : 'OK'})
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {!hasDriveToken ? (
                <button
                  type="button"
                  onClick={() => void loginWithGoogleAdmin()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Vincular Google Drive del Cliente
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={driveSyncStatus === 'SYNCING'}
                    onClick={() => void syncCajaPosToDriveNow(false)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    Forzar Respaldo a Drive (`cajapos.json`)
                  </button>
                  <button
                    type="button"
                    disabled={driveSyncStatus === 'SYNCING'}
                    onClick={() => void restoreCajaPosFromDrive()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    <CloudDownload className="h-3.5 w-3.5" />
                    Restaurar desde Drive
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Master Wipe (Vaciado Master) */}
          <div className="space-y-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-5 dark:border-rose-500/40 dark:bg-rose-950/30">
            <div className="flex items-center gap-2 border-b border-rose-200 pb-2.5 dark:border-rose-900/40">
              <Trash2 className="h-5 w-5 text-rose-500" />
              <h4 className="font-extrabold text-rose-700 dark:text-rose-300">
                Vaciado Master de la Aplicación (Factory Reset)
              </h4>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              Esta función elimina absolutamente todo el inventario, ventas, facturas, gastos y clientes del comercio. La app quedará limpia como en su primer uso. Acción exclusiva del superusuario master.
            </p>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setConfirmWipeModal(true)}
                className="rounded-xl bg-rose-600 px-4 py-2.5 font-extrabold text-white hover:bg-rose-700 shadow-md"
              >
                Ejecutar Vaciado Master
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Master Wipe */}
      {confirmWipeModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-rose-500/50 bg-white p-5 shadow-2xl dark:border-rose-500/50 dark:bg-[#1E2D48]">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-6 w-6 shrink-0 text-rose-500" />
              <div>
                <h4 className="text-sm font-extrabold text-rose-600 dark:text-rose-400">
                  ¿Confirmas el Vaciado Master Absoluto?
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Se borrarán todos los datos comerciales, inventario, ventas y registros. Esta operación es irreversible.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmWipeModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 font-bold text-xs dark:border-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  wipeAppData();
                  setConfirmWipeModal(false);
                  onClose();
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 font-extrabold text-xs text-white hover:bg-rose-700 shadow-md"
              >
                Sí, Vaciar Todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
