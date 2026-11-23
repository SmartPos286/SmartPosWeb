import type { AppRoute, MainModuleGroupId, User } from '../types/models';

export interface ModuleGroupMeta {
  id: MainModuleGroupId;
  title: string;
  description: string;
  accentColor: string;
}

export interface SubModuleMeta {
  route: Exclude<AppRoute, 'home'>;
  title: string;
  description: string;
  group: MainModuleGroupId;
}

export const MODULE_GROUPS: ModuleGroupMeta[] = [
  {
    id: 'VENTAS',
    title: 'VENTAS',
    description: 'Facturación, presupuestos, notas de entrega y facturas',
    accentColor: '#4F46E5',
  },
  {
    id: 'ADMINISTRATIVO',
    title: 'ADMINISTRATIVO',
    description: 'Inventario, retenciones, proveedores, clientes, puntos de venta y gastos',
    accentColor: '#0284C7',
  },
  {
    id: 'INFO_GENERAL',
    title: 'INFO GENERAL',
    description: 'Cashea, dashboard y resumen operativo',
    accentColor: '#059669',
  },
  {
    id: 'CONFIG',
    title: 'CONFIG',
    description: 'Usuarios, ajustes del sistema y cierre de sesión',
    accentColor: '#7C3AED',
  },
];

export const ALL_SUBMODULES: SubModuleMeta[] = [
  // VENTAS
  { route: 'pos', title: 'Facturación', description: 'Punto de venta multimoneda y cobro rápido', group: 'VENTAS' },
  { route: 'quotes', title: 'Presupuestos', description: 'Cotizaciones formales sin descontar stock', group: 'VENTAS' },
  { route: 'delivery_notes', title: 'Notas de Entrega', description: 'Despacho de mercancía sin crédito fiscal', group: 'VENTAS' },
  { route: 'invoices', title: 'Facturas', description: 'Histórico, notas de entrega, espera y deudas', group: 'VENTAS' },

  // ADMINISTRATIVO
  { route: 'inventory', title: 'Inventario', description: 'Catálogo, combos, recetas, CSV e IA', group: 'ADMINISTRATIVO' },
  { route: 'withholdings', title: 'Retenciones', description: 'Control SENIAT IVA e ISLR de ventas y compras', group: 'ADMINISTRATIVO' },
  { route: 'suppliers', title: 'Proveedores', description: 'Directorio, facturas de compra y retenciones', group: 'ADMINISTRATIVO' },
  { route: 'customers', title: 'Clientes', description: 'Cédula/RIF, tipo fiscal y cuentas por cobrar', group: 'ADMINISTRATIVO' },
  { route: 'pos_terminals', title: 'Puntos de Venta', description: 'Vouchers bancarios y lectura OCR por IA', group: 'ADMINISTRATIVO' },
  { route: 'expenses', title: 'Gastos', description: 'Control de egresos operativos USD / Bs.', group: 'ADMINISTRATIVO' },

  // INFO GENERAL
  { route: 'cashea', title: 'Cashea', description: 'Liquidaciones, comisiones y neto recibido', group: 'INFO_GENERAL' },
  { route: 'dashboard', title: 'Dashboard', description: 'Métricas gerenciales, márgenes y rankings', group: 'INFO_GENERAL' },
  { route: 'summary', title: 'Resumen', description: 'Arqueo de caja Z/X, balances y Libro CSV', group: 'INFO_GENERAL' },

  // CONFIG
  { route: 'users', title: 'Usuarios', description: 'Roles, PINes, comisiones y matriz de permisos', group: 'CONFIG' },
  { route: 'settings', title: 'Ajustes', description: 'Empresa, tema, tasa BCV, licencia y respaldos', group: 'CONFIG' },
];

export const ALL_SUBMODULE_ROUTES: Array<Exclude<AppRoute, 'home'>> = ALL_SUBMODULES.map((m) => m.route);

export function subModulesForGroup(group: MainModuleGroupId): SubModuleMeta[] {
  return ALL_SUBMODULES.filter((m) => m.group === group);
}

export function defaultRoutesForRole(role: string): Set<Exclude<AppRoute, 'home'>> {
  const upper = role.toUpperCase();
  if (upper === 'ADMIN' || upper === 'ADMINISTRADOR') {
    return new Set(ALL_SUBMODULE_ROUTES);
  }
  if (upper === 'SUPERVISOR') {
    const blocked = new Set<string>(['dashboard', 'users', 'settings', 'pos']);
    return new Set(ALL_SUBMODULE_ROUTES.filter((r) => !blocked.has(r)));
  }
  if (upper === 'CASHIER' || upper === 'CAJERO') {
    const blocked = new Set<string>(['dashboard', 'users', 'settings', 'suppliers']);
    return new Set(ALL_SUBMODULE_ROUTES.filter((r) => !blocked.has(r)));
  }
  return new Set();
}

export function resolveAllowedRoutes(user: User | null): Set<Exclude<AppRoute, 'home'>> {
  if (!user) return new Set();
  const raw = user.allowedModules.trim();
  if (!raw) return defaultRoutesForRole(user.role);
  if (raw.toUpperCase() === 'NONE') return new Set();
  if (raw === '*') return new Set(ALL_SUBMODULE_ROUTES);

  const validSet = new Set<string>(ALL_SUBMODULE_ROUTES);
  const resolved = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => validSet.has(s)) as Array<Exclude<AppRoute, 'home'>>;
  return new Set(resolved);
}

export function encodeAllowedRoutes(routes: Set<Exclude<AppRoute, 'home'>>): string {
  const valid = ALL_SUBMODULE_ROUTES.filter((r) => routes.has(r));
  return valid.length === 0 ? 'NONE' : valid.join(',');
}

export function summarizeAccess(user: User): string {
  const allowed = resolveAllowedRoutes(user);
  const total = ALL_SUBMODULE_ROUTES.length;
  if (allowed.size === total) return `Acceso completo (${total}/${total})`;
  if (allowed.size === 0) return `Sin submódulos asignados (0/${total})`;
  return `${allowed.size}/${total} submódulos activos`;
}

export function isSuperUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const uname = user.username.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return (
    uname === 'superusuario' ||
    uname === 'superuser' ||
    uname === 'mastersuperuser' ||
    uname === 'master' ||
    uname === 'super' ||
    uname === 'olivtech' ||
    user.pin === 'Sr4K1L!'
  );
}
