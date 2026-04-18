# POS Mueblería Mi Pueblito

Sistema de punto de venta modular para Mueblería Mi Pueblito.

## Estructura de archivos

```
js/
├── services/
│   ├── storage.service.js      # CRUD de localStorage con manejo de errores
│   ├── validator.service.js    # Validaciones de productos, clientes y montos
│   └── calculator.service.js  # Cálculo de márgenes, precios y planes de crédito
├── core/
│   ├── state.js                # Variables globales (var) compartidas por todos los módulos
│   ├── utils.js                # dinero(), mostrarVista()
│   └── migrations.js          # Migración de datos legacy de localStorage
├── ui/
│   └── navigation.js          # navA(), toggleMenu(), toggleSubmenu()
└── modules/
    ├── inventario/inventario.js        # Filtros, renderizado y CRUD de inventario
    ├── productos/producto-form.js      # Formulario alta/edición de productos
    ├── catalogo/
    │   ├── catalogo.js                 # Grid de catálogo con filtros
    │   └── producto-modal.js           # Modal de detalle con simulador de enganche
    ├── lista-precios/lista-precios.js  # Lista de precios con exportación CSV/PDF
    ├── clientes/clientes.js            # CRUD de clientes y selección para venta
    ├── proveedores/proveedores.js      # CRUD de proveedores
    ├── compras/compras.js              # Registro de compras a proveedores
    ├── recepciones/recepciones.js      # Recepción física de mercancía
    ├── cxp/cxp.js                      # Cuentas por pagar a proveedores
    ├── categorias/categorias.js        # Configuración de categorías y márgenes
    ├── visor/visor-maestro.js          # Visor maestro de producto con kardex
    ├── bancos/bancos.js                # Configuración de bancos/tarjetas MSI
    ├── msi/msi.js                      # Dashboard y listado de compras a meses
    ├── carrito/carrito.js              # Carrito de ventas e interfaz de pago
    ├── ventas/ventas.js                # Confirmación y procesamiento de ventas
    ├── tickets/tickets.js              # Generación e historial de tickets
    ├── cxc/cxc.js                      # Cuentas por cobrar y cobranza esperada
    ├── logistica/logistica.js          # Salidas pendientes y requisiciones
    ├── importador/importador.js        # Importación masiva de productos (CSV/JSON)
    └── reportes/reportes.js            # Reportes dinámicos con exportación CSV
js/init.js                              # DOMContentLoaded — arranque del sistema
```

## Reglas de arquitectura

- **Sin ES Modules**: todos los archivos se cargan como `<script>` planos en `index.html`.
- **Variables globales**: declaradas con `var` en `state.js` — disponibles en `window.*` sin exposición explícita.
- **Exposición de funciones**: cada módulo termina con `window.nombreFuncion = nombreFuncion;`.
- **Orden de carga**: Services → Core → UI → Modules → Init.

## Bug fixes incluidos

- `eliminarProducto(id)`: eliminado el `confirm()` interno duplicado. La confirmación la hace `confirmarEliminarProducto()`.
- `togglePanelClientes()`: nueva implementación que alterna visibilidad del panel `#panelClientes`.
- `filtrarCuentasCobranza()`: stub agregado (referenciado en HTML pero ausente en script.js original).
- `previewProductosCSV()` / `importarProductosCSV()`: implementadas (referenciadas en HTML pero ausentes en script.js original).
- `actualizarReporte()` / `exportarReporte()`: implementadas en nuevo módulo `reportes/reportes.js` (referenciadas en HTML pero ausentes en script.js original).
