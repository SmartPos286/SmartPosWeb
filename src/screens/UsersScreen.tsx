import React, { useState } from 'react';
import { Check, Edit, FileText, Minus, Plus, Trash2, UserCheck, X } from 'lucide-react';
import { usePos } from '../context/PosContext';
import type { AppRoute, User, UserRole } from '../types/models';
import {
  defaultRoutesForRole,
  encodeAllowedRoutes,
  MODULE_GROUPS,
  resolveAllowedRoutes,
  subModulesForGroup,
  summarizeAccess,
  isSuperUser,
} from '../utils/permissions';
import { exportModuleTablePdf } from '../utils/pdfExport';

export const UsersScreen: React.FC = () => {
  const { state, currentUser, saveUser, deleteUser, notify } = usePos();
  const [editing, setEditing] = useState<{
    id?: number;
    username: string;
    pin: string;
    role: UserRole;
    canEarnCommission: boolean;
    selectedRoutes: Set<Exclude<AppRoute, 'home'>>;
  } | null>(null);

  const visibleUsers = state.users.filter(
    (u) => !isSuperUser(u) && (u.username !== 'Olivtech' || currentUser?.username === 'Olivtech')
  );

  const openNew = () => {
    setEditing({
      username: '',
      pin: '',
      role: 'CASHIER',
      canEarnCommission: true,
      selectedRoutes: defaultRoutesForRole('CASHIER'),
    });
  };

  const openEdit = (u: User) => {
    setEditing({
      id: u.id,
      username: u.username,
      pin: u.pin,
      role: u.role,
      canEarnCommission: u.canEarnCommission,
      selectedRoutes: resolveAllowedRoutes(u),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const res = saveUser({
      id: editing.id,
      username: editing.username,
      pin: editing.pin,
      role: editing.role,
      avatarUrl: '',
      canEarnCommission: editing.role === 'SUPERVISOR' ? false : editing.canEarnCommission,
      allowedModules: encodeAllowedRoutes(editing.selectedRoutes),
    });
    if (!res.ok && res.error) {
      notify('Error de Usuario', res.error, 'error');
    } else {
      setEditing(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-extrabold">Usuarios y Matriz de Permisos</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Controla roles, PINes, elegibilidad de comisiones y acceso por submódulos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportModuleTablePdf({
                settings: state.settings,
                title: 'Directorio de Usuarios y Matriz de Permisos',
                subtitle: `${visibleUsers.length} usuario(s) visible(s)`,
                columns: ['Usuario', 'Rol', 'Comisiones', 'Acceso a Módulos'],
                rows: visibleUsers.map((u) => [
                  u.username,
                  u.role,
                  u.canEarnCommission && u.role !== 'SUPERVISOR' ? 'Habilitada' : 'Desactivada',
                  summarizeAccess(u),
                ]),
                filename: `usuarios_permisos_${Date.now()}.pdf`,
              })
            }
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700"
          >
            <FileText className="h-4 w-4" />
            Exportar PDF
          </button>
          <button
            type="button"
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
          >
            <Plus className="h-4 w-4" />
            Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {visibleUsers.map((u) => (
          <div
            key={u.id}
            className="rounded-2xl border border-slate-300/60 bg-white/95 p-4 shadow-sm dark:border-slate-700 dark:bg-[#1E2D48]"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/15 font-extrabold text-violet-600 dark:text-violet-300">
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-extrabold">{u.username}</p>
                    <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-sky-300">
                      {u.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{summarizeAccess(u)}</p>
                  <p className="text-[11px] text-slate-400">
                    Comisión ventas: {u.canEarnCommission && u.role !== 'SUPERVISOR' ? 'Habilitada' : 'Desactivada'}
                  </p>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  <Edit className="h-4 w-4" />
                </button>
                {u.username !== 'Olivtech' && currentUser?.id !== u.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = deleteUser(u.id);
                      if (!res.ok && res.error) notify('No permitido', res.error, 'warning');
                    }}
                    className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-violet-500" />
                <h3 className="text-base font-bold">{editing.id ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              </div>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block font-bold">Usuario *</label>
                  <input
                    type="text"
                    required
                    value={editing.username}
                    onChange={(e) => setEditing({ ...editing, username: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">PIN (mín 4 dígitos) *</label>
                  <input
                    type="text"
                    required
                    value={editing.pin}
                    onChange={(e) => setEditing({ ...editing, pin: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 font-mono-num dark:border-slate-600 dark:bg-slate-900"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold">Rol</label>
                  <select
                    value={editing.role}
                    onChange={(e) => {
                      const nextRole = e.target.value as UserRole;
                      setEditing({
                        ...editing,
                        role: nextRole,
                        canEarnCommission: nextRole === 'SUPERVISOR' ? false : editing.canEarnCommission,
                        selectedRoutes: defaultRoutesForRole(nextRole),
                      });
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
                  >
                    <option value="ADMIN">ADMIN</option>
                    <option value="SUPERVISOR">SUPERVISOR</option>
                    <option value="CASHIER">CASHIER</option>
                  </select>
                </div>
              </div>

              <label
                className={`flex items-center gap-2 rounded-xl border p-3 font-semibold ${
                  editing.role === 'SUPERVISOR'
                    ? 'border-slate-300/40 opacity-50'
                    : 'border-emerald-500/30 bg-emerald-500/10'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={editing.role === 'SUPERVISOR'}
                  checked={editing.role !== 'SUPERVISOR' && editing.canEarnCommission}
                  onChange={(e) => setEditing({ ...editing, canEarnCommission: e.target.checked })}
                />
                <span>
                  Habilitar comisiones por venta {editing.role === 'SUPERVISOR' ? '(Deshabilitado para SUPERVISOR)' : ''}
                </span>
              </label>

              {/* TriState Module Matrix */}
              <div className="space-y-3">
                <p className="font-bold text-slate-600 dark:text-slate-300">
                  Permisos por Módulo y Submódulo ({editing.selectedRoutes.size} seleccionados)
                </p>
                {MODULE_GROUPS.map((group) => {
                  const mods = subModulesForGroup(group.id);
                  const selectedInGroup = mods.filter((m) => editing.selectedRoutes.has(m.route)).length;
                  const allSelected = selectedInGroup === mods.length;
                  const partial = selectedInGroup > 0 && !allSelected;

                  const toggleGroup = () => {
                    const next = new Set(editing.selectedRoutes);
                    if (allSelected) {
                      mods.forEach((m) => next.delete(m.route));
                    } else {
                      mods.forEach((m) => next.add(m.route));
                    }
                    setEditing({ ...editing, selectedRoutes: next });
                  };

                  return (
                    <div
                      key={group.id}
                      className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <button
                        type="button"
                        onClick={toggleGroup}
                        className="flex w-full items-center justify-between font-extrabold"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded border ${
                              allSelected || partial
                                ? 'border-indigo-500 bg-indigo-600 text-white'
                                : 'border-slate-400'
                            }`}
                          >
                            {allSelected ? <Check className="h-3.5 w-3.5" /> : partial ? <Minus className="h-3.5 w-3.5" /> : null}
                          </span>
                          <span>{group.title}</span>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {selectedInGroup}/{mods.length}
                        </span>
                      </button>

                      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                        {mods.map((mod) => {
                          const checked = editing.selectedRoutes.has(mod.route);
                          return (
                            <label
                              key={mod.route}
                              className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 dark:bg-[#283A5A]/60"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const next = new Set(editing.selectedRoutes);
                                  if (checked) next.delete(mod.route);
                                  else next.add(mod.route);
                                  setEditing({ ...editing, selectedRoutes: next });
                                }}
                              />
                              <span className="font-semibold">{mod.title}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5 dark:border-slate-700">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-xs font-bold">
                Cancelar
              </button>
              <button type="submit" className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white">
                Guardar Usuario
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
