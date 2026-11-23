# SmartPOS286

Plataforma integral de punto de venta (POS), inventario, contabilidad fiscal venezolana (SENIAT, IVA 16%, IGTF 3%, BCV) e inteligencia artificial para comercios multimoneda (**USD / Bs.**), construida con **React 19**, **TypeScript**, **Tailwind CSS v4**, **Vite** y **Express** con integración server-side de **Gemini AI**.

## Funcionalidades Principales

- **Facturación POS Multimoneda**: Carrito con precios unitarios/mayoristas/editables, descuento global, pagos mixtos (Efectivo USD con cálculo automático de IGTF 3%, Pago Móvil Bs., Tarjeta Bs., Crédito, Cashea), ventas en espera (hold/restore) y tickets térmicos imprimibles o enviables por WhatsApp.
- **Presupuestos y Notas de Entrega**: Cotizaciones sin descuento de inventario convertibles a factura y notas de entrega (SENIAT no fiscal) con descuento y reversión de stock.
- **Inventario Avanzado y Combos**: Productos simples, combos compuestos, servicios/recetas, control multi-ubicación (pasillo, depósito, mostrador), alertas de stock mínimo/agotado, importación/exportación CSV y organización inteligente de categorías con IA.
- **Gestión Fiscal y Compras**: Historial de facturas de venta, facturas de compra a proveedores, cuentas por pagar/cobrar, retenciones de IVA e ISLR (clientes y proveedores) y exportación de libro contable CSV.
- **Conciliación y Finanzas**: Módulo de liquidaciones Cashea, registro de vouchers de puntos de venta bancarios con OCR por IA, egresos/gastos operativos, dashboard analítico de rentabilidad y cierre de caja diario (Reporte X / Z).
- **Asistente Virtual "Oli" y OCR Multimodal (Gemini)**: Chat contextual en vivo sobre el negocio, lectura automática de facturas de compra y tickets de datáfono desde imágenes mediante rutas API seguras en el servidor.
- **Control de Acceso por Roles y Temas**: Usuarios con PIN y permisos granulares por módulo (`ADMIN`, `MANAGER`, `CASHIER`, `Olivtech`) y modo Dual (`DARK` / `LIGHT`).

## Acceso Inicial

- **Administrador Maestro**: Usuario `Olivtech` / PIN `23390497`
- **Cajero de Prueba**: Usuario `Cajero` / PIN `1234`

## Variables de Entorno

Copia `.env.example` y configura en el servidor:

- `GEMINI_API_KEY`: Clave de API de Google Gemini (usada exclusivamente en el backend Express para `/api/gemini/*`).
- `PORT`: Puerto del servidor HTTP (por defecto `3000`).

## Scripts

```bash
npm install
npm run dev      # Inicia Express + Vite middleware en http://0.0.0.0:3000
npm run build    # Genera el bundle de producción en dist/
npm start        # Sirve la aplicación compilada y la API en producción
npm run lint     # Ejecuta ESLint
```
