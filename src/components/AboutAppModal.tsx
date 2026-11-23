import React, { useState } from 'react';
import {
  Check,
  Cloud,
  Cpu,
  CreditCard,
  FileText,
  Lock,
  Package,
  Shield,
  ShoppingCart,
  Users,
  X,
} from 'lucide-react';
import { usePos } from '../context/PosContext';
import { SmartPos286Logo } from './SmartPos286Logo';

export const AboutAppModal: React.FC = () => {
  const { isAboutOpen, setIsAboutOpen } = usePos();
  const [tab, setTab] = useState<'general' | 'modulos' | 'roles' | 'flujo'>('general');

  if (!isAboutOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-white text-slate-900 shadow-2xl dark:bg-[#1E2D48] dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
              <SmartPos286Logo size={36} />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">Acerca de SmartPOS286</h2>
              <p className="text-xs text-white/80">Sistema de Facturación y Control Comercial</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAboutOpen(false)}
            className="rounded-xl bg-white/15 p-2 hover:bg-white/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 text-xs font-bold dark:border-slate-700 dark:bg-[#283A5A]/50">
          {[
            { id: 'general', label: 'General' },
            { id: 'modulos', label: 'Módulos' },
            { id: 'roles', label: 'Roles' },
            { id: 'flujo', label: 'Funcionamiento' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`border-b-2 py-3 transition ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-sky-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
          {tab === 'general' && (
            <>
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                <h3 className="font-bold text-indigo-700 dark:text-sky-300">¿Qué es SmartPOS286?</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  SmartPOS286 es una plataforma integral de facturación con inteligencia artificial, diseñada para el control total de comercios, bodegones, restaurantes, farmacias y tiendas minoristas. Permite gestionar ventas multimoneda ($ USD y Bs.), inventario en tiempo real, arqueos de caja, clientes, proveedores y estadísticas de rentabilidad.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Cpu, title: 'Asistente IA "Oli"', desc: 'Consulta existencias, ventas y escanea facturas o vouchers bancarios por foto.' },
                  { icon: CreditCard, title: 'Multimoneda ($ USD / Bs.)', desc: 'Cálculo automático con tasa BCV oficial, IVA 16%, IGTF 3% y Cashea.' },
                  { icon: Package, title: 'Inventario Inteligente', desc: 'Soporta productos simples, peso decimal, combos compuestos y recetas.' },
                  { icon: FileText, title: 'Tickets, Notas y PDF', desc: 'Emisión de tickets 58/80mm, Notas de Entrega y Presupuestos.' },
                  { icon: Lock, title: 'Control por Roles (RBAC)', desc: 'Permisos granulares por módulo y PIN de seguridad por cajero.' },
                  { icon: Cloud, title: 'Respaldo Local y JSON', desc: 'Operación instantánea sin latencia con exportación completa de datos.' },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-[#283A5A]/50"
                  >
                    <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500 dark:text-sky-400" />
                    <div>
                      <p className="text-xs font-bold">{f.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === 'modulos' && (
            <div className="space-y-2.5 text-xs">
              {[
                { title: '1. Punto de Venta (POS)', desc: 'Catálogo, búsqueda por código, descuentos pre-IVA, pagos mixtos, IGTF 3%, crédito y ventas en espera.' },
                { title: '2. Presupuestos y Notas de Entrega', desc: 'Cotizaciones formales sin tocar stock y despachos sin IVA convertibles a factura.' },
                { title: '3. Inventario y Proveedores', desc: 'Importación/exportación CSV, combos, alertas de stock mínimo y compras con retenciones SENIAT.' },
                { title: '4. Clientes, Retenciones y Puntos de Venta', desc: 'Cuentas por cobrar (fiado), agentes especiales SENIAT y lectura OCR de vouchers bancarios.' },
                { title: '5. Dashboard, Cashea y Resumen Z/X', desc: 'Márgenes de ganancia, liquidaciones Cashea, arqueo de caja y Libro Contable CSV.' },
              ].map((m) => (
                <div key={m.title} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <p className="font-bold text-indigo-600 dark:text-sky-300">{m.title}</p>
                  <p className="mt-1 text-slate-600 dark:text-slate-300">{m.desc}</p>
                </div>
              ))}
            </div>
          )}

          {tab === 'roles' && (
            <div className="space-y-3 text-xs">
              {[
                {
                  name: 'Administrador (ADMIN)',
                  icon: Shield,
                  perms: ['Acceso total a todos los submódulos', 'Dashboard Gerencial y Márgenes', 'Gestión de usuarios, ajustes y licencias'],
                },
                {
                  name: 'Supervisor (SUPERVISOR)',
                  icon: Users,
                  perms: ['Supervisión de inventario, compras y gastos', 'Control de facturas, retenciones y cierres', 'Auditoría operativa'],
                },
                {
                  name: 'Cajero (CASHIER)',
                  icon: ShoppingCart,
                  perms: ['Facturación POS, carritos en espera y presupuestos', 'Registro de clientes y abonos', 'Cierre y arqueo de turno'],
                },
              ].map((r) => (
                <div key={r.name} className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                  <div className="flex items-center gap-2 font-bold text-indigo-600 dark:text-sky-300">
                    <r.icon className="h-4 w-4" />
                    <span>{r.name}</span>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {r.perms.map((p) => (
                      <li key={p} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {tab === 'flujo' && (
            <div className="space-y-3 text-xs">
              {[
                { n: '1', t: 'Inicio de Sesión', d: 'Escribe tu usuario e ingresa tu PIN de seguridad.' },
                { n: '2', t: 'Sincroniza Tasa BCV', d: 'Verifica o actualiza la tasa oficial del día con un clic en la barra superior.' },
                { n: '3', t: 'Procesa la Venta', d: 'Agrega productos, elige cliente y combina efectivo $, Pago Móvil, Punto, Cashea o Crédito.' },
                { n: '4', t: 'Emite Comprobante', d: 'Imprime ticket 58/80mm, descarga PNG o comparte directo por WhatsApp.' },
                { n: '5', t: 'Cierre de Caja y Libro', d: 'Realiza el Arqueo Z/X en Resumen y descarga tu Libro Contable en Bolívares.' },
              ].map((s) => (
                <div key={s.n} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 font-bold text-white">
                    {s.n}
                  </span>
                  <div>
                    <p className="font-bold">{s.t}</p>
                    <p className="text-slate-600 dark:text-slate-300">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 dark:border-slate-700">
          <span className="text-xs text-slate-500 dark:text-slate-400">SmartPOS286 v2.5 • Edición Comercial</span>
          <button
            type="button"
            onClick={() => setIsAboutOpen(false)}
            className="min-h-[40px] rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
