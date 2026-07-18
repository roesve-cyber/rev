// ===== ESTADO DE PAGO persiste entre vistas =====
// Se guarda aquí para no depender del DOM del carrito cuando
// confirmarVentaFinal() se llama desde la vista seleccionarcliente
window._estadoPago = window._estadoPago || {
    metodo: "contado",
    enganche: 0,
    periodicidad: "semanal",
    modoEnganche: "efectivo",
    cuentaReceptora: "efectivo",
    planIndex: null,
    plan: null,          // objeto completo del plan elegido
    apartadoFechaCompromiso: "",
    apartadoCondiciones: ""
};
var plazoSeleccionado = window.plazoSeleccionado ?? null;

function _ventaCuentaEfectivoDefault() {
    const cajas = StorageService.get("cuentasEfectivo", []);
    const primera = Array.isArray(cajas) && cajas.length ? cajas[0] : null;
    return {
        cuentaId: primera?.id || "efectivo",
        etiqueta: primera?.nombre || "Efectivo"
    };
}

function _ventaFechaAhoraIso() {
    return window.localISO ? window.localISO(new Date()) : new Date().toISOString();
}

function _ventaFechaVisible(valor) {
    if (!valor) return '-';
    const d = window.parseFechaMX ? window.parseFechaMX(valor) : new Date(valor);
    if (!d || isNaN(d.getTime())) return String(valor);
    return window.formatearFechaCortaMX ? window.formatearFechaCortaMX(d) : d.toLocaleDateString('es-MX');
}

function _normalizarFechasPendientesAutorizacion() {
    let cambioVentas = false;
    const ventasPend = StorageService.get("ventasPendientes", []).map(v => {
        const iso = v.fechaCapturaIso || v.datosVenta?.fechaIso || v.args?.[7] || null;
        const visible = _ventaFechaVisible(iso || v.fechaCaptura);
        if (v.fechaCapturaIso === iso && v.fechaCaptura === visible) return v;
        cambioVentas = true;
        return { ...v, fechaCapturaIso: iso, fechaCaptura: visible };
    });
    if (cambioVentas) StorageService.set("ventasPendientes", ventasPend.map(_normalizarVentaPendienteFirestore));

    let cambioAbonos = false;
    const abonosPend = StorageService.get("abonosPendientes", []).map(a => {
        const iso = a.fechaCapturaIso || a.fechaAbonoIso || null;
        const visible = _ventaFechaVisible(iso || a.fechaCaptura || a.fechaAbonoStr);
        if (a.fechaCapturaIso === iso && a.fechaCaptura === visible) return a;
        cambioAbonos = true;
        return { ...a, fechaCapturaIso: iso, fechaCaptura: visible };
    });
    if (cambioAbonos) StorageService.set("abonosPendientes", abonosPend);
}

function _resolverEstadoBoveda(item, fallback = 'Pendiente') {
    const raw = String(item?.estado ?? item?.status ?? item?.estatus ?? '').trim();
    if (!raw) return fallback;
    const normalizado = raw.toLowerCase();
    if (['pendiente','pending','en boveda','en_boveda','en cuarentena','en_cuarentena','provisional','activo','activa','en espera','espera'].includes(normalizado)) return 'Pendiente';
    if (['aprobado','autorizado','aprobada','autorizada','procesado','procesada','registrado','registrada','aplicado','aplicada','cerrado','cerrada'].includes(normalizado)) return 'Aprobado';
    if (['rechazado','rechazada','cancelado','cancelada','anulado','anulada','descartado','descartada'].includes(normalizado)) return 'Rechazado';
    return raw;
}

function _esSolicitudBovedaPendiente(item) {
    return _resolverEstadoBoveda(item, 'Pendiente') === 'Pendiente';
}

function _marcarEstadoBoveda(item, estado, meta = {}) {
    return {
        ...(item || {}),
        estado,
        status: estado,
        estatus: estado,
        ...meta
    };
}

function _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _authGrupoConciliacionDesdeReferencia(referencia) {
    const limpia = String(referencia || '').trim();
    return limpia
        ? `TRANSF-${limpia.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9_-]/g, '')}`
        : '';
}

function _ventaProductoActivo(p) {
    if (typeof window.productoEstaActivo === 'function') return window.productoEstaActivo(p);
    return !!p && p.activo !== false && p.Activo !== 0 && p.Activo !== false;
}

function _fechaInputDesdeHoy(dias = 30) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return window.getFechaLocalMX ? window.getFechaLocalMX(d) : (window.localISO ? window.localISO(d).slice(0, 10) : d.toISOString().slice(0, 10));
}

function _condicionesApartadoDefault() {
    return [
        "Liquidar el saldo dentro del plazo comprometido.",
        "La mercancía se entrega únicamente cuando el apartado esté liquidado al 100%.",
        "Presentar este recibo e identificación para recoger la mercancía.",
        "La cancelación por causa del cliente puede generar cargo administrativo y/o almacenaje.",
        "Colores, medidas y piezas quedan sujetos al detalle descrito en este comprobante."
    ].join("\n");
}

function _ventaArticuloPlano(item = {}) {
    return {
        id: item.id ?? item.productoId ?? null,
        productoId: item.productoId ?? item.id ?? null,
        nombre: item.nombre || item.productoNombre || "",
        cantidad: Number(item.cantidad || 1),
        precio: Number(item.precio || item.precioContado || 0),
        precioContado: Number(item.precioContado || item.precio || 0),
        colorElegido: item.colorElegido || "",
        ubicacionElegida: item.ubicacionElegida || "",
        salidaOperativaAplicada: item.salidaOperativaAplicada === true
    };
}

function _ventaProductoPendientePlano(x = {}) {
    const item = _ventaArticuloPlano(x.item || x);
    const prod = x.prod || {};
    return {
        item,
        prod: {
            id: prod.id ?? item.productoId,
            nombre: prod.nombre || item.nombre,
            stock: Number(prod.stock || 0)
        },
        requiereCompra: x.requiereCompra !== false,
        generarEntregaPendiente: x.generarEntregaPendiente !== false,
        motivo: x.motivo || "",
        salidaOperativaAplicada: x.salidaOperativaAplicada === true || item.salidaOperativaAplicada === true
    };
}

function _envolverListaVentaPendiente(lista = []) {
    return { items: (lista || []).map(_ventaProductoPendientePlano) };
}

function _desenvolverListaVentaPendiente(valor) {
    if (Array.isArray(valor)) return valor;
    if (valor && Array.isArray(valor.items)) return valor.items;
    return [];
}

function _normalizarVentaPendienteFirestore(v = {}) {
    const copia = { ...v };
    if (Array.isArray(copia.args)) {
        copia.args = [...copia.args];
        copia.args[8] = _envolverListaVentaPendiente(_desenvolverListaVentaPendiente(copia.args[8]));
        copia.args[9] = _envolverListaVentaPendiente(_desenvolverListaVentaPendiente(copia.args[9]));
    }
    if (copia.datosVenta) {
        copia.datosVenta = {
            ...copia.datosVenta,
            articulos: (copia.datosVenta.articulos || []).map(_ventaArticuloPlano)
        };
    }
    return copia;
}

window._normalizarVentaPendienteFirestore = _normalizarVentaPendienteFirestore;

function _generarPagaresPreviewVentaCredito({ folio, cliente, fechaBaseIso, plan, periodicidad }) {
    if (!plan) return [];
    const diasIntervalo = periodicidad === "quincenal" ? 14 : periodicidad === "mensual" ? 30 : 7;
    const pagos = Number(plan.pagos || plan.plazo || Math.round((plan.semanas || (Number(plan.meses || 0) * 4)) / (diasIntervalo / 7)) || 0);
    if (!pagos || pagos <= 0) return [];

    const totalPlan = Number(plan.total || 0);
    const monto = Number(plan.abono || (totalPlan / pagos) || 0);
    if (!monto || monto <= 0) return [];

    const fechaPago = new Date(fechaBaseIso || Date.now());
    const pagares = [];
    let acumulado = 0;
    for (let i = 1; i <= pagos; i++) {
        fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
        const montoPagare = i === pagos && totalPlan > 0
            ? Math.max(0, Number((totalPlan - acumulado).toFixed(2)))
            : Number(monto.toFixed(2));
        acumulado = Number((acumulado + montoPagare).toFixed(2));
        pagares.push({
            id: Date.now() + i,
            folio,
            numeroPagere: `${folio}-${i}/${pagos}`,
            clienteNombre: cliente?.nombre || "",
            clienteId: cliente?.id || null,
            fechaEmision: fechaBaseIso || window.localISO?.(new Date()) || new Date().toISOString(),
            fechaVencimiento: fechaPago.getTime(),
            monto: montoPagare,
            estado: "Pendiente",
            diasAtrasoActual: 0
        });
    }
    return pagares;
}

function _normalizarPlanCreditoVenta(plan, capital, periodicidad = "semanal", planIndex = 0) {
    const multiplicador = periodicidad === "quincenal" ? 2 : periodicidad === "mensual" ? 4 : 1;
    const pagosBase = Number(plan?.pagos || plan?.plazo || Math.round(Number(plan?.semanas || 0) / multiplicador) || Math.round((Number(plan?.meses || 0) * 4) / multiplicador) || 0);
    const abonoBase = Number(plan?.abono || 0);
    const totalBase = Number(plan?.total || (pagosBase > 0 && abonoBase > 0 ? pagosBase * abonoBase : 0));

    if (pagosBase > 0 && abonoBase > 0 && totalBase > 0) {
        return {
            ...plan,
            pagos: pagosBase,
            plazo: plan?.plazo || pagosBase,
            abono: abonoBase,
            total: totalBase,
            semanas: plan?.semanas || pagosBase * multiplicador
        };
    }

    const capitalSeguro = Number(capital || 0);
    if (capitalSeguro <= 0 || !CalculatorService?.calcularCreditoConPeriodicidad) return null;

    const planes = CalculatorService.calcularCreditoConPeriodicidad(capitalSeguro, periodicidad);
    if (!planes || planes.length === 0) return null;
    const idx = Number(planIndex);
    const elegido = planes[idx >= 0 && idx < planes.length ? idx : 0] || planes.find(p => Number(p.abono || 0) > 0) || planes[0];
    return elegido && Number(elegido.abono || 0) > 0 && Number(elegido.total || 0) > 0 ? elegido : null;
}

function _aplicarSalidaInventarioOperativa(folioVenta, productosConStock) {
    const productosActuales = StorageService.get("productos", []);
    const entregados = [];

    (productosConStock || []).forEach(x => {
        if (x.salidaOperativaAplicada || x.item?.salidaOperativaAplicada) return;
        const item = x.item || {};
        const prod = productosActuales.find(p => String(p.id) === String(x.prod?.id || item.id || item.productoId));
        if (!prod) return;

        const cant = Number(item.cantidad || 1);
        const colorElegido = item.colorElegido || '';
        const ubicacionElegida = item.ubicacionElegida || '';
        const validacionOrigen = _validarOrigenEntregaVenta(prod, item, { color: colorElegido, ubicacion: ubicacionElegida });
        if (!validacionOrigen.ok || (Number(prod.stock) || 0) < cant) return;

        if (
            Array.isArray(prod.variantes) &&
            prod.variantes.length > 0 &&
            ubicacionElegida &&
            _normalizarClaveInventario(ubicacionElegida) !== 'STOCK GENERAL'
        ) {
            let restante = cant;
            prod.variantes.forEach(v => {
                const coincideColor = !colorElegido || String(v.color || '').toUpperCase() === String(colorElegido).toUpperCase();
                const coincideUbicacion = !ubicacionElegida || String(v.ubicacion || '').toUpperCase() === String(ubicacionElegida).toUpperCase();
                if (restante > 0 && coincideColor && coincideUbicacion && Number(v.stock) > 0) {
                    const deducir = Math.min(Number(v.stock), restante);
                    v.stock -= deducir;
                    restante -= deducir;
                }
            });
            if (restante > 0) return;
        }

        prod.stock = Math.max(0, (Number(prod.stock) || 0) - cant);
        if (typeof window.registrarMovimiento === 'function') {
            window.registrarMovimiento(prod.id, `Salida operativa por venta en cuarentena - Folio ${folioVenta}`, cant, "salida");
        }
        x.salidaOperativaAplicada = true;
        if (x.item) x.item.salidaOperativaAplicada = true;
        entregados.push({ productoId: prod.id, nombre: prod.nombre, colorElegido, ubicacionElegida, cantidad: cant });
    });

    if (entregados.length > 0) {
        StorageService.set("productos", productosActuales);
        productos = productosActuales;
        window.productos = productosActuales;
    }
    return entregados;
}

function _esAdmin() {
    try {
        const sesion = sessionStorage.getItem('sesionActiva');
        const usuario = sesion ? JSON.parse(sesion) : null;
        return usuario && usuario.rol === 'admin';
    } catch {
        return false;
    }
}

function _ventaSesionActual() {
    try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; }
}

function _ventaVendedorAsignadoSesion() {
    const sesion = _ventaSesionActual();
    if (!sesion || sesion.rol !== 'vendedor') return null;
    if (typeof window.obtenerVendedorDeUsuario === 'function') {
        return window.obtenerVendedorDeUsuario(sesion);
    }
    const vendedores = StorageService.get("vendedores", []).filter(v => v.activo !== false);
    if (sesion.vendedorId) {
        const directo = vendedores.find(v => String(v.id) === String(sesion.vendedorId));
        if (directo) return directo;
    }
    return vendedores.length === 1 ? vendedores[0] : null;
}

function _ventaResolverVendedorSeleccionado() {
    const sesion = _ventaSesionActual();
    if (sesion?.rol === 'vendedor') return _ventaVendedorAsignadoSesion();

    const selVnd = document.getElementById("selVendedor");
    if (selVnd && selVnd.value) {
        const vendedores = StorageService.get("vendedores", []);
        return vendedores.find(v => String(v.id) === String(selVnd.value)) || null;
    }
    return null;
}

function agregarAlCarritoDesdeModal() {
    if (!productoActualId) return;
    const p = productos.find(prod => String(prod.id) === String(productoActualId) && _ventaProductoActivo(prod));
    if (!p) {
        alert("Error: Producto no encontrado o inactivo.");
        return;
    }

    const indiceExistente = carrito.findIndex(item => String(item.id) === String(productoActualId));
    
    if (indiceExistente !== -1) {
        const mensaje = `"${p.nombre}" ya está en el carrito.\n\n¿Aumentar la cantidad en 1?`;
        
        if (confirm(mensaje)) {
            carrito[indiceExistente].cantidad = (carrito[indiceExistente].cantidad || 1) + 1;
            if (!StorageService.set("carrito", carrito)) {
                console.error("Error actualizando carrito");
                return;
            }
            actualizarContadorCarrito();
            alert(`Cantidad aumentada a ${carrito[indiceExistente].cantidad}`);
        }
    } else {
        const planes = CalculatorService.calcularCredito(p.precio);
        const plan = planes[5] || planes[0];

        carrito.push({
            id: p.id,
            nombre: p.nombre,
            precioContado: parseFloat(p.precio) || 0,
            plazo: plan.meses,
            totalCredito: plan.total,
            abonoSemanal: plan.abono,
            imagen: p.imagen,
            cantidad: 1
        });

        if (!StorageService.set("carrito", carrito)) {
            console.error("Error guardando carrito");
            return;
        }
        actualizarContadorCarrito();
        
        alert(`"${p.nombre}" agregado al carrito`);
    }
    
    cerrarProducto();
}

function agregarAlCarrito(id) {
    const p = productos.find(x => String(x.id) === String(id) && _ventaProductoActivo(x));
    if (!p) return;
    productoActualId = id;
    agregarAlCarritoDesdeModal();
}

function actualizarContadorCarrito() {
    const contador = document.getElementById("contadorCarrito");
    if (contador) {
        const total = carrito.length;
        contador.innerText = total;
        contador.style.display = total > 0 ? "flex" : "none";
    }
}

// Permite agregar productos al carrito sin depender del catalogo: reutiliza
// el mismo selector universal con buscador/categorias que ya usan Compras y
// Cotizaciones, y al elegir un producto lo agrega con la misma logica que
// usa el catalogo (agregarAlCarrito), luego refresca la tabla del carrito.
function agregarProductoDesdeCarrito() {
    if (typeof window.abrirSelectorProducto !== 'function') {
        alert('El selector de productos no esta disponible.');
        return;
    }
    window.abrirSelectorProducto({
        titulo: '🔍 Agregar producto al carrito',
        onSeleccion: function (p) {
            agregarAlCarrito(p.id);
            renderCarrito();
        }
    });
}

// ===== CARRITO =====
function renderCarrito() {
    const vistaCarrito = document.getElementById("carrito");
    if (!vistaCarrito) return;

    // Detectar admin
    const esAdmin = _esAdmin();

    if (carrito.length === 0) {
        vistaCarrito.innerHTML = `
            <div class="header-seccion"><h2>Carrito de Ventas</h2></div>
            <div style="text-align:center; padding:40px; color:#718096; background:white; border-radius:8px;">
                <p style="margin:0 0 16px;">El carrito está vacío.</p>
                <button onclick="agregarProductoDesdeCarrito()" style="padding:11px 18px; background:#1e40af; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px;">🔍 Agregar producto</button>
            </div>`;
        actualizarContadorCarrito();
        return;
    }

    carrito = carrito.filter(item => {
        const prod = productos.find(p => String(p.id) === String(item.id) && _ventaProductoActivo(p));
        if (!prod) {
            console.warn("Producto no disponible eliminado del carrito:", item.id);
            return false;
        }
        return true;
    });

    StorageService.set("carrito", carrito);

    let totalContado = carrito.reduce((sum, p) => 
        sum + (p.precioContado || 0) * (p.cantidad || 1), 0
    );
    const vendedorSesion = _ventaVendedorAsignadoSesion();
    const vendedoresActivos = StorageService.get("vendedores", []).filter(v => v.activo !== false);
    const vendedorControlHtml = esAdmin
        ? `
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Vendedor</label>
                    <select id="selVendedor" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
                        <option value="">-- Sin vendedor asignado --</option>
                        ${vendedoresActivos.map(v => `<option value="${v.id}" ${window._vendedorSeleccionado && String(window._vendedorSeleccionado.id) === String(v.id) ? 'selected' : ''}>${_escapeHtml(v.nombre)}</option>`).join('')}
                    </select>
                </div>`
        : `
                <div style="margin-bottom:12px; padding:10px 12px; background:${vendedorSesion ? '#f0fdf4' : '#fff7ed'}; border:1px solid ${vendedorSesion ? '#bbf7d0' : '#fed7aa'}; border-radius:8px;">
                    <div style="font-size:11px; font-weight:bold; color:${vendedorSesion ? '#166534' : '#92400e'}; margin-bottom:3px;">Vendedor asignado</div>
                    <div style="font-size:14px; font-weight:800; color:${vendedorSesion ? '#14532d' : '#9a3412'};">${vendedorSesion ? _escapeHtml(vendedorSesion.nombre) : 'Sin vínculo de vendedor'}</div>
                    ${vendedorSesion ? '' : '<div style="font-size:11px;color:#92400e;margin-top:4px;">Pide al administrador vincular tu usuario con un vendedor.</div>'}
                </div>`;

    let html = `
        <div class="header-seccion" style="margin-bottom: 20px;">
            <h2>Carrito de Ventas</h2>
        </div>
        
        <div style="display:grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px; align-items: start;">
            
            <div style="background:white; padding:20px; border-radius:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; flex-wrap:wrap; gap:10px;">
                    <h3 style="margin:0;">Productos seleccionados</h3>
                    <button onclick="agregarProductoDesdeCarrito()" style="padding:9px 14px; background:#1e40af; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">🔍 Agregar producto</button>
                </div>
                <table class="tabla-admin">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align:center;">Stock</th>
                            <th style="text-align:center;">Color</th>
                            <th style="text-align:center;">Piezas</th>
                            <th style="text-align:right;">Precio</th>
                            <th style="text-align:center;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    carrito.forEach((p, index) => {
        let cantidad = p.cantidad || 1;
        const prod = productos.find(prod => prod.id === p.id);
        const stock = prod ? (prod.stock || 0) : 0;
        const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
        const textoStock = stock > 0 ? stock : "Sin stock";

        // === LGICA DE COLOR (TEXTO LIBRE CON SUGERENCIAS) ===
        const coloresDisp = obtenerColoresDisponibles(p.id);
        const colorSeleccionado = p.colorElegido || '';
        
        // Creamos sugerencias (datalist) por si ya hay colores registrados
        let opcionesDatalist = coloresDisp.map(c => `<option value="${_escapeHtml(c.color)}">`).join('');
        
        let colorCell = `
            <input type="text" list="colores-${index}" value="${_escapeHtml(colorSeleccionado)}" 
                onchange="actualizarColorCarrito(${index}, this.value)"
                placeholder="Escribe color..."
                style="width:100%; padding:6px; border:1px solid #ddd; border-radius:4px; font-size:12px; text-align:center;">
            <datalist id="colores-${index}">
                ${opcionesDatalist}
            </datalist>
        `;

        html += `
            <tr>
                <td><strong>${p.nombre}</strong></td>

                <td style="text-align:center; font-weight:bold; color:${colorStock};">
                    ${textoStock}
                </td>

                <td style="text-align:center; min-width:110px;">
                    ${colorCell}
                </td>

                <td style="text-align:center;">
                    <input type="number" min="1" max="99" value="${cantidad}" 
                        onchange="actualizarCantidadCarrito(${index}, this.value)"
                        style="width:50px; padding:6px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                </td>

                <td style="text-align:right; font-weight:bold; color:#27ae60;">
                    ${
                        esAdmin
                        ? `
                        <input type="number" value="${p.precioContado || 0}" 
                            onchange="cambiarPrecioCarrito(${index}, this.value)"
                            style="width:80px; padding:5px; text-align:right; border:1px solid #ddd; border-radius:4px;">
                        <br>
                        <small>${dinero((p.precioContado || 0) * cantidad)}</small>
                        `
                        : dinero((p.precioContado || 0) * cantidad)
                    }
                </td>

                <td style="text-align:center;">
                    <button onclick="eliminarDelCarrito(${index}); renderCarrito();" 
                        style="background:#fed7d7; color:#c53030; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        </button>
                </td>
            </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>

            <div style="background:white; padding:20px; border-radius:10px;">
                <h3 style="margin:0 0 15px 0;">Resumen</h3>

                <div style="text-align:center; margin-bottom:20px;">
                    <div style="font-size:11px; color:#718096; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Total mercancía</div>
                    <strong style="font-size:26px; color:#2d3748;">${dinero(totalContado)}</strong>
                </div>

                <!-- VENDEDOR -->
                ${vendedorControlHtml}

                <!-- M0TODO DE PAGO -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Método de pago</label>
                    <select id="selMetodoPago"
                            onchange="actualizarInterfazPago();"
                            style="width:100%; padding:9px; border:2px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:bold;">
                        <option value="contado">Contado</option>
                        <option value="transferencia">Transferencia / Depósito</option>
                        <option value="credito">Crédito</option>
                        <option value="apartado">Apartado</option>
                    </select>
                </div>

                <!-- ENGANCHE (visible para crédito y apartado) -->
                <div id="divEnganche" class="oculto" style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Enganche inicial</label>
                    <input type="number" id="numEnganche" min="0" step="50" value="0"
                           onchange="actualizarInterfazPago()"
                           oninput="actualizarInterfazPago()"
                           placeholder="0.00"
                           style="width:100%; padding:9px; border:2px solid #f59e0b; border-radius:6px; font-size:16px; font-weight:bold; color:#92400e; box-sizing:border-box; text-align:right;">
                    <div style="font-size:11px; color:#92400e; margin-top:3px;">Monto que paga el cliente hoy</div>
                </div>

                <div id="divCondicionesApartado" class="oculto" style="margin-bottom:12px; padding:12px; background:#fffbeb; border:1px solid #fcd34d; border-radius:8px;">
                    <label style="font-size:12px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">Fecha compromiso de liquidación</label>
                    <input type="date" id="fechaCompromisoApartado"
                           onchange="actualizarInterfazPago()"
                           style="width:100%; padding:9px; border:1px solid #f59e0b; border-radius:6px; font-size:14px; box-sizing:border-box; margin-bottom:10px;">
                    <label style="font-size:12px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">Condiciones que acepta el cliente</label>
                    <textarea id="condicionesApartado"
                              oninput="actualizarInterfazPago()"
                              style="width:100%; min-height:110px; padding:9px; border:1px solid #f59e0b; border-radius:6px; font-size:12px; box-sizing:border-box; resize:vertical;"></textarea>
                </div>

                <!-- PERIODICIDAD (solo crédito) -->
                <div id="divPeriodicidad" class="oculto" style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Periodicidad de abonos</label>
                    <select id="selPeriodicidad"
                            onchange="actualizarInterfazPago()"
                            style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
                        <option value="semanal">Semanal</option>
                        <option value="quincenal">Quincenal</option>
                        <option value="mensual">Mensual</option>
                    </select>
                </div>

                <!-- ENCHUFE UNIVERSAL DE CAJAS/BANCOS -->
                <div id="divSelectorUniversal" class="oculto" style="margin-bottom:12px; padding:12px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px;">
                    <label style="font-size:13px; font-weight:bold; color:#166534; display:block; margin-bottom:6px;">¿A qué caja o cuenta ingresa el dinero hoy?</label>
                    ${window._buildSelectorCuentas ? window._buildSelectorCuentas('cuentaReceptora_venta', false) : '<select id="cuentaReceptora_venta" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;"><option value="efectivo">Efectivo Principal</option></select>'}
                </div>

                <!-- RESULTADOS DEL PLAN -->
                <div id="resultadosPago" style="margin-bottom:12px;"></div>

                <!-- NOTA DE INVENTARIO AUTOMÁTICO -->
                <div style="background:#eff6ff; padding:10px; border-radius:6px; margin-bottom:16px; font-size:12px; border:1px solid #bfdbfe; color:#1e40af;">
                    <strong>Inventario automático:</strong> Si hay stock se preguntará si se entrega; si no hay stock se genera requisición de compra automáticamente.
                </div>

                <!-- FECHA DE VENTA -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Fecha de venta</label>
                    <input type="date" id="inputFechaVenta"
                           style="width:100%; padding:9px; border:2px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box;"
                           value="${window.obtenerHoyInputMX()}">
                </div>

                <button onclick="irASeleccionCliente()"
                    style="width:100%; padding:14px; background:#27ae60; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:15px; letter-spacing:0.5px;">
                    Seleccionar cliente 
                </button>
            </div>
        </div>
    `;

    vistaCarrito.innerHTML = html;
    
    // Resetear estado de pago al renderizar el carrito
    const cuentaDefaultVenta = _ventaCuentaEfectivoDefault();
    window._estadoPago = {
        metodo: "contado",
        enganche: 0,
        periodicidad: "semanal",
        modoEnganche: "efectivo",
        cuentaReceptora: cuentaDefaultVenta.cuentaId,
        etiquetaCuenta: cuentaDefaultVenta.etiqueta,
        planIndex: null,
        plan: null,
        apartadoFechaCompromiso: _fechaInputDesdeHoy(30),
        apartadoCondiciones: _condicionesApartadoDefault()
    };
    plazoSeleccionado = null;
    const fechaCompromisoEl = document.getElementById("fechaCompromisoApartado");
    if (fechaCompromisoEl) fechaCompromisoEl.value = window._estadoPago.apartadoFechaCompromiso;
    const condicionesEl = document.getElementById("condicionesApartado");
    if (condicionesEl) condicionesEl.value = window._estadoPago.apartadoCondiciones;
    setTimeout(() => actualizarInterfazPago(), 30);
}

function cambiarPrecioCarrito(index, nuevoPrecio) {
    if (!_esAdmin()) {
        alert("No autorizado");
        return;
    }
    nuevoPrecio = parseFloat(nuevoPrecio);
    if (isNaN(nuevoPrecio) || nuevoPrecio <= 0) return;
    carrito[index].precioContado = nuevoPrecio;
    StorageService.set("carrito", carrito);
    renderCarrito();
}

function actualizarCantidadCarrito(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    if (isNaN(cantidad) || cantidad < 1) {
        alert("La cantidad debe ser mayor a 0");
        return;
    }
    if (index >= 0 && index < carrito.length) {
        carrito[index].cantidad = cantidad;
        if (!StorageService.set("carrito", carrito)) {
            console.error("Error actualizando cantidad");
        }
        renderCarrito();
    }
}

// ===== HELPERS DE VARIANTES (COLOR Y UBICACIN) =====

// 1. Obtiene los colores sumando el stock de todas las ubicaciones
function obtenerColoresDisponibles(productoId) {
    const prod = productos.find(p => String(p.id) === String(productoId));
    if (!prod || !prod.variantes || prod.variantes.length === 0) return [];
    
    const mapaColores = {};
    prod.variantes.forEach(v => {
        if (v.color) {
            // Sumamos el stock de este color, sin importar la ubicación
            mapaColores[v.color] = (mapaColores[v.color] || 0) + (Number(v.stock) || 0);
        }
    });
    
    return Object.entries(mapaColores).map(([color, stock]) => ({ color, stock }));
}

function _normalizarClaveInventario(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toUpperCase();
}

function _stockDisponibleEnOrigen(prod, colorElegido, ubicacionElegida) {
    if (!prod || !ubicacionElegida) return 0;

    const cantidadTotal = Number(prod.stock || 0);
    const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
    const ubicNorm = _normalizarClaveInventario(ubicacionElegida);
    const colorNorm = _normalizarClaveInventario(colorElegido);

    if (ubicNorm === 'STOCK GENERAL') {
        const asignadoAVariantes = variantes.reduce((s, v) => s + (Number(v.stock) || 0), 0);
        return Math.max(0, cantidadTotal - asignadoAVariantes);
    }

    if (variantes.length === 0) {
        return ubicNorm === 'GENERAL' ? cantidadTotal : 0;
    }

    return variantes
        .filter(v => _normalizarClaveInventario(v.ubicacion || 'General') === ubicNorm)
        .filter(v => !colorNorm || _normalizarClaveInventario(v.color || 'General') === colorNorm)
        .reduce((s, v) => s + (Number(v.stock) || 0), 0);
}

function _stockDisponibleEnUbicacionVenta(prod, ubicacionElegida) {
    if (!prod || !ubicacionElegida) return 0;
    const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
    const ubicNorm = _normalizarClaveInventario(ubicacionElegida);
    const cantidadTotal = Number(prod.stock || 0);

    if (ubicNorm === 'STOCK GENERAL') {
        const asignadoAVariantes = variantes.reduce((s, v) => s + (Number(v.stock) || 0), 0);
        return Math.max(0, cantidadTotal - asignadoAVariantes);
    }

    if (variantes.length === 0) {
        return ubicNorm === 'GENERAL' ? cantidadTotal : 0;
    }

    return variantes
        .filter(v => _normalizarClaveInventario(v.ubicacion || 'General') === ubicNorm)
        .reduce((s, v) => s + (Number(v.stock) || 0), 0);
}

function _resolverOrigenEntregaVenta(prod, item, decision) {
    const cantidad = Number(item?.cantidad || 1);
    const colorElegido = decision?.color !== undefined ? decision.color : (item?.colorElegido || '');
    const ubicacionElegida = decision?.ubicacion !== undefined ? decision.ubicacion : (item?.ubicacionElegida || '');

    if (!ubicacionElegida) {
        return {
            ok: false,
            mensaje: `Selecciona la ubicacion de salida para "${prod?.nombre || item?.nombre || 'producto'}".`
        };
    }

    const disponibleExacto = _stockDisponibleEnOrigen(prod, colorElegido, ubicacionElegida);
    if (disponibleExacto >= cantidad) {
        return { ok: true, disponible: disponibleExacto, requiereAjusteColor: false };
    }

    const disponibleUbicacion = _stockDisponibleEnUbicacionVenta(prod, ubicacionElegida);
    if (colorElegido && disponibleUbicacion >= cantidad) {
        return {
            ok: true,
            disponible: disponibleUbicacion,
            disponibleExacto,
            requiereAjusteColor: true,
            mensaje: `El color vendido "${colorElegido}" no coincide con el color registrado en inventario para ${ubicacionElegida}. Se descontara stock fisico de esa ubicacion y quedara trazado en Kardex.`
        };
    }

    return {
        ok: false,
        disponible: disponibleExacto,
        disponibleUbicacion,
        mensaje: `"${prod?.nombre || item?.nombre || 'Producto'}" no tiene inventario suficiente en ${ubicacionElegida}.\n\nSolicitado: ${cantidad}\nDisponible exacto: ${disponibleExacto}${colorElegido ? `\nColor vendido: ${colorElegido}` : ''}${disponibleUbicacion !== disponibleExacto ? `\nDisponible total en ubicacion: ${disponibleUbicacion}` : ''}`
    };
}

function _stockDisponibleParaSolicitudVenta(prod, item) {
    if (!prod) return 0;
    const cantidadTotal = Number(prod.stock || 0);
    const colorNorm = _normalizarClaveInventario(item?.colorElegido || '');
    if (!colorNorm) return cantidadTotal;

    const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
    const stockEnVariantes = variantes.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const stockGeneralSinAsignar = Math.max(0, cantidadTotal - stockEnVariantes);
    const stockColor = variantes
        .filter(v => _normalizarClaveInventario(v.color || 'General') === colorNorm)
        .reduce((s, v) => s + (Number(v.stock) || 0), 0);

    return stockGeneralSinAsignar + stockColor;
}

function _validarOrigenEntregaVenta(prod, item, decision) {
    return _resolverOrigenEntregaVenta(prod, item, decision);
}

function _opcionesUbicacionSalidaVenta(prod, colorElegido = '', seleccionActual = '') {
    if (!prod) return '<option value="">Producto no encontrado</option>';

    const stockActual = Number(prod.stock || 0);
    const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
    const stockEnVariantes = variantes.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const stockGeneralSinAsignar = Math.max(0, stockActual - stockEnVariantes);
    const colorNorm = _normalizarClaveInventario(colorElegido);
    const seleccionNorm = _normalizarClaveInventario(seleccionActual);
    let opciones = '<option value="">Selecciona salida...</option>';

    if (stockGeneralSinAsignar > 0) {
        opciones += `<option value="Stock General" ${seleccionNorm === 'STOCK GENERAL' ? 'selected' : ''}>Stock General (${stockGeneralSinAsignar} disp.)</option>`;
    }

    const ubicacionesStock = {};
    const ubicacionesTotales = {};
    variantes.forEach(v => {
        const nombreUbi = v.ubicacion || 'General';
        ubicacionesTotales[nombreUbi] = (ubicacionesTotales[nombreUbi] || 0) + (Number(v.stock) || 0);
        const coincideColor = !colorNorm || _normalizarClaveInventario(v.color || 'General') === colorNorm;
        if (!coincideColor) return;
        ubicacionesStock[nombreUbi] = (ubicacionesStock[nombreUbi] || 0) + (Number(v.stock) || 0);
    });

    const ubicacionesRenderizadas = new Set();
    Object.entries(ubicacionesStock).forEach(([ubicacion, stockUbi]) => {
        if (stockUbi <= 0) return;
        const selected = seleccionNorm === _normalizarClaveInventario(ubicacion) ? 'selected' : '';
        opciones += `<option value="${_escapeHtml(ubicacion)}" ${selected}>${_escapeHtml(ubicacion)} (${stockUbi} disp.)</option>`;
        ubicacionesRenderizadas.add(_normalizarClaveInventario(ubicacion));
    });

    if (colorNorm) {
        Object.entries(ubicacionesTotales).forEach(([ubicacion, stockUbi]) => {
            if (stockUbi <= 0) return;
            if (ubicacionesRenderizadas.has(_normalizarClaveInventario(ubicacion))) return;
            const selected = seleccionNorm === _normalizarClaveInventario(ubicacion) ? 'selected' : '';
            opciones += `<option value="${_escapeHtml(ubicacion)}" ${selected}>${_escapeHtml(ubicacion)} (${stockUbi} disp. en otro color registrado)</option>`;
        });
    }

    return opciones;
}

function _ubicacionesSalidaVentaDetalle(prod, colorElegido = '') {
    if (!prod) return [];

    const stockActual = Number(prod.stock || 0);
    const variantes = Array.isArray(prod.variantes) ? prod.variantes : [];
    const stockEnVariantes = variantes.reduce((s, v) => s + (Number(v.stock) || 0), 0);
    const stockGeneralSinAsignar = Math.max(0, stockActual - stockEnVariantes);
    const colorNorm = _normalizarClaveInventario(colorElegido);
    const mapa = new Map();

    const agregar = (ubicacion, stock, nota = '', prioridad = 1) => {
        const cantidad = Number(stock || 0);
        if (cantidad <= 0) return;
        const nombre = ubicacion || 'General';
        const key = _normalizarClaveInventario(nombre);
        const actual = mapa.get(key);
        if (!actual || prioridad < actual.prioridad) {
            mapa.set(key, { ubicacion: nombre, stock: cantidad, nota, prioridad });
        }
    };

    if (stockGeneralSinAsignar > 0) {
        agregar('Stock General', stockGeneralSinAsignar, 'Sin ubicacion/variante asignada', 0);
    }

    const porUbicacionColor = {};
    const porUbicacionTotal = {};
    variantes.forEach(v => {
        const ubicacion = v.ubicacion || 'General';
        const stock = Number(v.stock || 0);
        if (stock <= 0) return;
        porUbicacionTotal[ubicacion] = (porUbicacionTotal[ubicacion] || 0) + stock;
        const coincideColor = !colorNorm || _normalizarClaveInventario(v.color || 'General') === colorNorm;
        if (coincideColor) porUbicacionColor[ubicacion] = (porUbicacionColor[ubicacion] || 0) + stock;
    });

    Object.entries(porUbicacionColor).forEach(([ubicacion, stock]) => {
        agregar(ubicacion, stock, colorNorm ? 'Coincide con el color vendido' : 'Salida posible desde esta ubicacion', 1);
    });

    if (colorNorm) {
        Object.entries(porUbicacionTotal).forEach(([ubicacion, stock]) => {
            if (porUbicacionColor[ubicacion]) return;
            agregar(ubicacion, stock, 'Existe aqui, pero con otro color registrado', 2);
        });
    }

    return Array.from(mapa.values()).sort((a, b) => a.prioridad - b.prioridad || a.ubicacion.localeCompare(b.ubicacion));
}

function _ventaDomId(valor) {
    return String(valor || '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

function _ventaJsArg(valor) {
    return _escapeHtml(String(valor ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, ' '));
}

function _renderOpcionesOrigenVenta(prod, item) {
    const colorElegido = item?.colorElegido || '';
    const idProd = String(prod?.id ?? item?.id ?? item?.productoId ?? '');
    const idProdArg = _ventaJsArg(idProd);
    const idDom = _ventaDomId(idProd);
    const opciones = _ubicacionesSalidaVentaDetalle(prod, colorElegido);
    if (!opciones.length) {
        return `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:8px;padding:10px;font-size:12px;">No hay ubicaciones con existencia disponible. Se ira directo a sobre pedido.</div>`;
    }
    return `
        <div style="margin-top:10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;">
            <div style="font-size:12px;color:#1e40af;font-weight:900;margin-bottom:8px;">Elige la ubicacion fisica de salida: <span style="background:#dcfce7;color:#166534;border-radius:999px;padding:2px 8px;font-size:11px;">⭐ Se sugiere tomar de inventario</span></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
                ${opciones.map((op, idx) => `
                    <button type="button"
                        id="btn-origen-${idDom}-${_ventaDomId(op.ubicacion)}"
                        data-origen-producto="${_escapeHtml(idDom)}"
                        onclick="seleccionarOrigenInventario('${idProdArg}', '${_ventaJsArg(op.ubicacion)}')"
                        style="text-align:left;padding:12px;border:2px solid #93c5fd;background:white;color:#0f172a;border-radius:8px;cursor:pointer;transition:all .15s ease;box-shadow:0 1px 2px rgba(15,23,42,.08);">
                        <span style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
                            <strong style="font-size:14px;">${_escapeHtml(op.ubicacion)}${idx === 0 ? ' <small style="color:#16a34a;font-weight:900;">(sugerida)</small>' : ''}</strong>
                            <span style="background:#dbeafe;color:#1d4ed8;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:900;">${Number(op.stock || 0)} pza.</span>
                        </span>
                        ${op.nota ? `<br><small style="color:#64748b;">${_escapeHtml(op.nota)}</small>` : ''}
                    </button>
                `).join('')}
            </div>
            <div id="origen-seleccionado-${idDom}" style="margin-top:8px;font-size:12px;color:#92400e;font-weight:bold;background:#fffbeb;border:1px solid #fde68a;border-radius:7px;padding:8px;">Falta elegir ubicacion de salida.</div>
        </div>`;
}

function _ventaDecisionesStockCompletas() {
    if (!Array.isArray(carrito) || !Array.isArray(productos)) return true;
    return carrito.every(item => {
        const prod = productos.find(p => String(p.id) === String(item.id));
        if (!prod) return true;
        const tieneStock = _stockDisponibleParaSolicitudVenta(prod, item) >= Number(item?.cantidad || 1);
        if (!tieneStock) return true;
        const decision = decisionesInventario[item.id];
        if (!decision || typeof decision.entregar !== 'boolean') return false;
        if (decision.entregar === true) return !!(decision.ubicacion || item.ubicacionElegida);
        return decision.confirmadoSobrePedido === true;
    });
}

function _actualizarBotonProcesarInventario() {
    const btn = document.getElementById('btnProcesarVentaInventario');
    const aviso = document.getElementById('avisoDecisionesInventario');
    if (!btn) return;
    const completas = _ventaDecisionesStockCompletas();
    btn.disabled = !completas;
    btn.style.background = completas ? '#27ae60' : '#94a3b8';
    btn.style.cursor = completas ? 'pointer' : 'not-allowed';
    btn.style.opacity = completas ? '1' : '.72';
    if (aviso) aviso.style.display = completas ? 'none' : 'block';
}

function _descontarInventarioDesdeOrigenVenta(prod, cantidad, colorElegido = '', ubicacionElegida = '') {
    const cant = Number(cantidad || 0);
    if (!prod || cant <= 0) return false;

    const validacion = _validarOrigenEntregaVenta(prod, { cantidad: cant, nombre: prod.nombre }, { color: colorElegido, ubicacion: ubicacionElegida });
    if (!validacion.ok) return false;
    window._ultimaSalidaInventarioVenta = {
        requiereAjusteColor: !!validacion.requiereAjusteColor,
        colorVendido: colorElegido || '',
        ubicacion: ubicacionElegida || '',
        coloresFisicos: []
    };

    if (
        Array.isArray(prod.variantes) &&
        prod.variantes.length > 0 &&
        ubicacionElegida &&
        _normalizarClaveInventario(ubicacionElegida) !== 'STOCK GENERAL'
    ) {
        let restante = cant;
        const descontarDeVariante = (v) => {
            if (restante <= 0 || Number(v.stock) <= 0) return;
            const deducir = Math.min(Number(v.stock), restante);
            v.stock -= deducir;
            restante -= deducir;
            window._ultimaSalidaInventarioVenta.coloresFisicos.push({
                color: v.color || 'General',
                ubicacion: v.ubicacion || 'General',
                cantidad: deducir
            });
        };

        prod.variantes.forEach(v => {
            const coincideColor = !colorElegido || _normalizarClaveInventario(v.color || 'General') === _normalizarClaveInventario(colorElegido);
            const coincideUbicacion = _normalizarClaveInventario(v.ubicacion || 'General') === _normalizarClaveInventario(ubicacionElegida);
            if (coincideColor && coincideUbicacion) descontarDeVariante(v);
        });

        if (restante > 0 && validacion.requiereAjusteColor) {
            prod.variantes.forEach(v => {
                const coincideUbicacion = _normalizarClaveInventario(v.ubicacion || 'General') === _normalizarClaveInventario(ubicacionElegida);
                if (coincideUbicacion) descontarDeVariante(v);
            });
        }

        if (restante > 0) return false;
    }

    prod.stock = Math.max(0, (Number(prod.stock) || 0) - cant);
    return true;
}

function actualizarColorCarrito(index, color) {
    if (index >= 0 && index < carrito.length) {
        carrito[index].colorElegido = color;
        // Al cambiar de color, reseteamos la ubicación elegida porque podría no estar ahí
        carrito[index].ubicacionElegida = ""; 
        StorageService.set("carrito", carrito);
    }
}

// 4. Guarda la ubicación elegida en el carrito
function actualizarUbicacionCarrito(index, ubicacion) {
    if (index >= 0 && index < carrito.length) {
        carrito[index].ubicacionElegida = ubicacion;
        StorageService.set("carrito", carrito);
    }
}

// Esta es la "libreta" donde anotamos los datos
function capturarDatosCredito() {
    const inputEnganche = document.getElementById("numEnganche");
    const selPeriodicidad = document.getElementById("selPeriodicidad");

    if (inputEnganche) {
        window._estadoPago.enganche = parseFloat(inputEnganche.value) || 0;
    }
    if (selPeriodicidad) {
        window._estadoPago.periodicidad = selPeriodicidad.value;
    }
}

function actualizarInterfazPago() {
    const metodo = document.getElementById("selMetodoPago")?.value;
    const divEnganche = document.getElementById("divEnganche");
    const divPeriodicidad = document.getElementById("divPeriodicidad");
    const divCondicionesApartado = document.getElementById("divCondicionesApartado");
    const resultados = document.getElementById("resultadosPago");

    if (!metodo || !resultados) return;

    let totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;

    if (metodo === "credito" || metodo === "apartado") {
        divEnganche?.classList.remove("oculto");
    } else {
        divEnganche?.classList.add("oculto");
        enganche = 0;
    }

    if (metodo === "credito") {
        divPeriodicidad?.classList.remove("oculto");
    } else {
        divPeriodicidad?.classList.add("oculto");
    }

    if (metodo === "apartado") {
        divCondicionesApartado?.classList.remove("oculto");
        const fechaCompromisoEl = document.getElementById("fechaCompromisoApartado");
        const condicionesEl = document.getElementById("condicionesApartado");
        if (fechaCompromisoEl && !fechaCompromisoEl.value) fechaCompromisoEl.value = window._estadoPago.apartadoFechaCompromiso || _fechaInputDesdeHoy(30);
        if (condicionesEl && !condicionesEl.value) condicionesEl.value = window._estadoPago.apartadoCondiciones || _condicionesApartadoDefault();
    } else {
        divCondicionesApartado?.classList.add("oculto");
    }

    // CUENTA RECEPTORA / MODO DE COBRO
    const divUniversal = document.getElementById("divSelectorUniversal");
    const engancheVal = parseFloat(document.getElementById("numEnganche")?.value) || 0;

    if (divUniversal) {
        // ¿Realmente está entrando dinero en este momento? 
        if (metodo === "contado" || metodo === "transferencia" || engancheVal > 0) {
            divUniversal.classList.remove("oculto");
            
            // Le agregamos un evento al selector para que se guarde al cambiar
            const selNode = document.getElementById("cuentaReceptora_venta");
            if (selNode && !selNode.hasAttribute('data-bound')) {
                selNode.addEventListener('change', actualizarInterfazPago);
                selNode.setAttribute('data-bound', 'true');
            }
        } else {
            divUniversal.classList.add("oculto");
        }
    }

    let saldo = totalContado - enganche;
    if (saldo < 0) saldo = 0;

    if (metodo !== "credito") {
        plazoSeleccionado = null;
    }

    let html = "";

    if (metodo === "contado" || metodo === "transferencia") {
        html = `<p><strong>Total a pagar:</strong> ${dinero(totalContado)}</p>`;
    }

    if (metodo === "apartado") {
        html = `
            <p>Enganche: <strong>${dinero(enganche)}</strong></p>
            <p>Saldo pendiente: <strong>${dinero(saldo)}</strong></p>
        `;
    }

    if (metodo === "credito") {
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo, periodicidad);
        
        if (plazoSeleccionado === null || plazoSeleccionado < 0 || plazoSeleccionado >= planes.length) {
            plazoSeleccionado = 0;
        }

        html = `
        <p>Enganche: <strong>${dinero(enganche)}</strong></p>
        <p>Saldo financiado: <strong>${dinero(saldo)}</strong></p>
        <hr>
        <p><strong>Selecciona un plan:</strong></p>
    `;
        planes.forEach((plan, i) => {
            const checked = (plazoSeleccionado === i) ? "checked" : "";
            const textoPeriodicidad = periodicidad === "semanal" ? "/sem" : periodicidad === "quincenal" ? "/quin" : "/mes";
            html += `
            <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:8px; cursor:pointer;">
                <label style="cursor:pointer; display:block;">
                    <input type="radio" name="planCredito" value="${i}" ${checked}
                        onchange="seleccionarPlan(${i})">
                    ${plan.meses} meses 
                    | Total: ${dinero(plan.total)} 
                    | ${dinero(plan.abono)}${textoPeriodicidad} (${plan.pagos} pagos)
                </label>
            </div>`;
        });
    }

    resultados.innerHTML = html;
    capturarDatosCredito();

    // GUARDAR ESTADO DE PAGO para no depender del DOM después window._estadoPago.metodo      = metodo;
    window._estadoPago.metodo      = metodo;
    window._estadoPago.enganche    = enganche;
    window._estadoPago.periodicidad = metodo === "credito"
        ? (document.getElementById("selPeriodicidad")?.value || "semanal")
        : "semanal";
    window._estadoPago.modoEnganche = metodo === "contado"
        ? "efectivo"
        : (document.querySelector('input[name="modoEnganche"]:checked')?.value || "efectivo");
    const cuentaDefaultEstado = _ventaCuentaEfectivoDefault();
    window._estadoPago.cuentaReceptora = metodo === "contado"
        ? cuentaDefaultEstado.cuentaId
        : (document.getElementById("selCuentaReceptora")?.value || cuentaDefaultEstado.cuentaId);
    const inputFechaDOM = document.getElementById("inputFechaVenta");
    if (inputFechaDOM && inputFechaDOM.value) {
        window._estadoPago.fechaVenta = inputFechaDOM.value;
    }
    
    // Guardamos la caja seleccionada en nuestra libreta de estado temporal
    const selCaja = document.getElementById("cuentaReceptora_venta");
    window._estadoPago.cuentaReceptora = selCaja ? selCaja.value : cuentaDefaultEstado.cuentaId;
    window._estadoPago.etiquetaCuenta = selCaja && selCaja.selectedIndex >= 0 ? selCaja.options[selCaja.selectedIndex].text : cuentaDefaultEstado.etiqueta;
    window._estadoPago.apartadoFechaCompromiso = document.getElementById("fechaCompromisoApartado")?.value || window._estadoPago.apartadoFechaCompromiso || "";
    window._estadoPago.apartadoCondiciones = document.getElementById("condicionesApartado")?.value || window._estadoPago.apartadoCondiciones || "";
}

function seleccionarPlan(index) {
    plazoSeleccionado = index;
    window._estadoPago.planIndex = index;

    try {
        const totalCarrito = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
        const enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        const saldo = totalCarrito - enganche;
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo > 0 ? saldo : totalCarrito, periodicidad);
        
        if (planes && planes[index]) {
            window._estadoPago.plan = planes[index];
            console.log("Plan guardado con éxito:", window._estadoPago.plan);
        }
    } catch(e) {
        console.error("Error al guardar el plan:", e);
    }
    actualizarInterfazPago();
}

function eliminarDelCarrito(index) {
    if (index >= 0 && index < carrito.length) {
        carrito.splice(index, 1);
        if (!StorageService.set("carrito", carrito)) {
            console.error("Error guardando carrito");
        }
        actualizarContadorCarrito();
    }
}

// ===== VENTA FINAL =====
function confirmarVentaFinal() {
    console.log("Iniciando confirmarVentaFinal()...");

    if (!clienteSeleccionado) {
        alert("Por favor selecciona un cliente antes de continuar.");
        return;
    }

    if (carrito.length === 0) {
        alert("El carrito está vacío.");
        return;
    }

    const metodoPago = window._estadoPago?.metodo || document.getElementById("selMetodoPago")?.value;

    if (!metodoPago) {
        alert("Regresa al carrito y selecciona un método de pago.");
        return;
    }

    window._vendedorSeleccionado = _ventaResolverVendedorSeleccionado();
    const sesionVenta = _ventaSesionActual();
    if (sesionVenta?.rol === 'vendedor' && !window._vendedorSeleccionado) {
        alert("Tu usuario no está vinculado a un vendedor activo. Pide al administrador vincularlo en Configuración > Usuarios del sistema.");
        return;
    }

    let descuentoAplicado = 0;
    let listaDescuentos = [];
    
    // Extraemos correctamente el monto del objeto que devuelve descuentos.js
    if (typeof aplicarDescuentosAlCarrito === "function") {
        const resultadoDesc = aplicarDescuentosAlCarrito(carrito, clienteSeleccionado.id);
        if (resultadoDesc) {
            descuentoAplicado = resultadoDesc.montoDescuento || 0;
            listaDescuentos = resultadoDesc.descuentosAplicados || [];
        }
    }

    const totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    const totalConDescuento = Math.max(0, totalContado - descuentoAplicado);

    let enganche = window._estadoPago?.enganche ?? parseFloat(document.getElementById("numEnganche")?.value) ?? 0;
    if (enganche < 0) enganche = 0;

    if (enganche > totalConDescuento) {
        alert("El enganche no puede ser mayor al total.");
        return;
    }

    const saldoAFinanciar = totalConDescuento - enganche;
    let planElegido = null;

    if (metodoPago === "apartado") {
        const fechaCompromiso = window._estadoPago?.apartadoFechaCompromiso || document.getElementById("fechaCompromisoApartado")?.value;
        const condicionesApartado = (window._estadoPago?.apartadoCondiciones || document.getElementById("condicionesApartado")?.value || "").trim();

        if (enganche <= 0) {
            alert("Para registrar un apartado debes capturar un anticipo.");
            return;
        }
        if (!fechaCompromiso) {
            alert("Captura la fecha compromiso de liquidación del apartado.");
            return;
        }
        if (!condicionesApartado) {
            alert("Captura las condiciones del apartado para que aparezcan en el recibo.");
            return;
        }

        window._estadoPago.apartadoFechaCompromiso = fechaCompromiso;
        window._estadoPago.apartadoCondiciones = condicionesApartado;
    }

    if (metodoPago === "credito") {
        const periodicidad = window._estadoPago?.periodicidad || document.getElementById("selPeriodicidad")?.value || "semanal";
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
        const planIdx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;

        if (planIdx === null || planIdx === undefined || planIdx < 0 || planIdx >= planes.length) {
            alert("Selecciona un plazo de crédito en el carrito antes de continuar.");
            return;
        }

        planElegido = planes[planIdx];
        plazoSeleccionado = planIdx;

        if (!planElegido || planElegido.abono === 0) {
            alert("Plan de crédito inválido. Regresa al carrito y vuelve a seleccionar el plazo.");
            return;
        }

        window._estadoPago.plan = planElegido;
        window._estadoPago.periodicidad = periodicidad;
    }

    window._vendedorSeleccionado = _ventaResolverVendedorSeleccionado();

    mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, descuentoAplicado, totalConDescuento);
}

function mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, descuentoAplicado = 0, totalConDescuento = null) {
    const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
    let detalleMetodo = "";

    if (metodoPago === "contado") {
        detalleMetodo = `<p style="color:#27ae60;"><strong>CONTADO</strong></p>`;
    } else if (metodoPago === "transferencia") {
        detalleMetodo = `<p style="color:#2b6cb0;"><strong>TRANSFERENCIA / DEPSITO</strong></p>`;
    } else if (metodoPago === "apartado") {
        const fechaCompromiso = window._estadoPago?.apartadoFechaCompromiso || document.getElementById("fechaCompromisoApartado")?.value || "";
        const condicionesApartado = window._estadoPago?.apartadoCondiciones || document.getElementById("condicionesApartado")?.value || "";
        detalleMetodo = `
            <p><strong>APARTADO</strong></p>
            <div style="background:#fffbeb; padding:10px; border-radius:5px;">
                <p style="margin:5px 0;">Enganche: <strong>${dinero(enganche)}</strong></p>
                <p style="margin:5px 0;">Pendiente: <strong>${dinero(saldoAFinanciar)}</strong></p>
                <p style="margin:5px 0;">Liquidar antes de: <strong>${fechaCompromiso || 'Sin fecha'}</strong></p>
                <div style="margin-top:8px; font-size:12px; color:#78350f; white-space:pre-line;">${_escapeHtml(condicionesApartado)}</div>
            </div>
        `;
    } else if (metodoPago === "credito") {
        const totalCarrito = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
        const engancheReal = window._estadoPago?.enganche || enganche || 0;
        const periodicidadResumen = window._estadoPago?.periodicidad || "semanal";
        
        let saldo = totalCarrito - engancheReal;
        let saldoBase = saldo > 0 ? saldo : totalCarrito;

        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoBase, periodicidadResumen);
        
        let idx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;
        if (idx < 0 || idx >= planes.length) idx = 0;
        
        let plan = planes[idx];

        if (!plan || !plan.abono || plan.abono === 0) {
            plan = planes.find(p => p.abono > 0) || planes[0];
        }

        const textoFreq = periodicidadResumen === "semanal" ? "Semanales" : periodicidadResumen === "quincenal" ? "Quincenales" : "Mensuales";
        
        detalleMetodo = `
            <p style="color:#2b6cb0; margin-bottom:5px;"><strong>CR0DITO CONFIGURADO</strong></p>
            <div style="background:#ebf8ff; padding:12px; border-radius:8px; border: 1px solid #bee3f8;">
                <p style="margin:3px 0;">Enganche inicial: <strong>${dinero(engancheReal)}</strong></p>
                <p style="margin:3px 0;">Plazo: <strong>${plan.meses} meses</strong></p>
                <p style="margin:3px 0;">${plan.pagos} pagos <strong>${textoFreq}</strong></p>
                <p style="margin:3px 0;">Importe de cada pagaré: <strong>${dinero(plan.abono)}</strong></p>
                <p style="margin:8px 0 0 0; border-top:1px solid #bee3f8; padding-top:8px; font-size:1.1em; color: #2c5282;">
                    <strong>Suma total de pagos: ${dinero(plan.total)}</strong>
                </p>
            </div>
        `;
        
        _planElegidoPendiente = plan;
        planElegido = plan;
    }

    const resumenProductos = carrito.map(p => {
        const cantidad = p.cantidad || 1;
        const subtotal = (p.precioContado || 0) * cantidad;
        return `<tr>
            <td>${p.nombre}</td>
            <td style="text-align:center;">${cantidad}</td>
            <td style="text-align:right;">${dinero(p.precioContado)}</td>
            <td style="text-align:right; font-weight:bold;">${dinero(subtotal)}</td>
        </tr>`;
    }).join('');

    _planElegidoPendiente = planElegido;
    document.querySelector('[data-modal="resumen-venta"]')?.remove();

    // REPARACIN: Empaquetar el plan para pasarlo por HTML sin que se rompa
    const planSafeStr = planElegido ? JSON.stringify(planElegido).replace(/'/g, "\\'").replace(/"/g, '&quot;') : 'null';

    const resumenFinanciero = `
        <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px;">
            <p style="margin:8px 0; display:flex; justify-content:space-between;">
                <span>Subtotal:</span>
                <strong>${dinero(totalContado)}</strong>
            </p>
            ${descuentoAplicado > 0 ? `
            <p style="margin:8px 0; display:flex; justify-content:space-between;">
                <span style="color:#16a34a;">Descuento aplicado:</span>
                <strong style="color:#16a34a;">- ${dinero(descuentoAplicado)}</strong>
            </p>
            <p style="margin:8px 0; display:flex; justify-content:space-between;">
                <span><strong>Total (con descuento):</strong></span>
                <strong>${dinero(totalConDescuento)}</strong>
            </p>
            ` : ''}
        </div>
    `;

    const modalHTML = `
    <div class="modal" data-modal="resumen-venta" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
        <div style="background:white; padding:30px; border-radius:15px; width:100%; max-width:700px; margin:0 auto;">
            <h2 style="margin-top:0; color:#2c3e50;">Resumen de Transacción</h2>
            <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                <h4 style="margin:0 0 10px 0; color:#166534;">Cliente</h4>
                <p style="margin:5px 0;"><strong>${clienteSeleccionado.nombre}</strong></p>
                ${clienteSeleccionado.telefono ? `<p style="margin:5px 0;">~ ${clienteSeleccionado.telefono}</p>` : ''}
                ${clienteSeleccionado.direccion ? `<p style="margin:5px 0;">${clienteSeleccionado.direccion}</p>` : ''}
            </div>
            <div style="margin-bottom:20px;">
                <h4 style="color:#2c3e50; margin:0 0 10px 0;">Productos</h4>
                <table class="tabla-admin" style="width:100%; font-size:14px;">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align:center;">Cant.</th>
                            <th style="text-align:right;">Precio Unit.</th>
                            <th style="text-align:right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>${resumenProductos}</tbody>
                </table>
            </div>

            ${resumenFinanciero}

            <div style="margin-bottom:20px;">
                <h4 style="color:#2c3e50; margin:0 0 10px 0;">Forma de Pago</h4>
                ${detalleMetodo}
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="mostrarDialogoInventario('${metodoPago}', ${totalConDescuento ?? totalContado}, ${enganche}, ${saldoAFinanciar}, ${planSafeStr})"
                    style="flex:1; padding:14px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                    Confirmar Venta
                </button>
                <button onclick="cancelarYVolverAlCarrito()"
                    style="padding: 12px 24px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    S" Cancelar
                </button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function cancelarYVolverAlCarrito() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('oculto');
        modal.style.display = 'none';
    });
    document.querySelectorAll('[data-modal]').forEach(modal => modal.remove());
    navA('carrito');
}

/**
 * Dialogo interactivo de gestión de inventario
 */
function mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegidoRecibido) {
    let planElegido = planElegidoRecibido || _planElegidoPendiente;
    let productosConStock = [];
    let productosSinStock = [];

    decisionesInventario = {};

    carrito.forEach(item => {
        const prod = productos.find(p => String(p.id) === String(item.id));
        if (prod) {
            if (_stockDisponibleParaSolicitudVenta(prod, item) >= (item.cantidad || 1)) {
                productosConStock.push({ item, prod });
            } else {
                productosSinStock.push({ item, prod });
            }
        }
    });

    let htmlProductos = '';

    if (productosConStock.length > 0) {
        htmlProductos += `
            <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px; border-left:5px solid #27ae60;">
                <h4 style="margin:0 0 15px 0; color:#166534;">PRODUCTOS CON STOCK</h4>
        `;
        
        productosConStock.forEach(x => {
            const idProd = x.prod.id;
            const idProdArg = _ventaJsArg(idProd);
            const cantRequerida = x.item.cantidad || 1;

            const colorElegido = x.item.colorElegido || '';
            const ubicacionElegida = x.item.ubicacionElegida || '';

            let colorSelectorHtml = `
                <div style="margin-top:6px;">
                    <label style="font-size:11px; color:#374151;">}Color:</label>
                    <input type="text" value="${_escapeHtml(colorElegido)}" 
                        onchange="cambiarColorInventario('${idProdArg}', this.value)"
                        placeholder="Ej. Rojo" 
                        style="margin-left:4px; padding:4px; border:1px solid #ddd; border-radius:4px; font-size:12px; width:120px;">
                </div>`;
            colorSelectorHtml = `
                <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <label style="font-size:11px;color:#374151;font-weight:bold;">Color vendido:</label>
                    <input type="text" value="${_escapeHtml(colorElegido)}"
                        onchange="cambiarColorInventario('${idProdArg}', this.value)"
                        placeholder="Ej. Blanco"
                        style="padding:7px 9px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;width:140px;">
                </div>`;

            // 1. Armar las opciones del Combo Box con INVENTARIO DINAMICO
            const stockActual = parseFloat(x.prod.stock) || 0;
            const stockEnVariantes = (x.prod.variantes || []).reduce((s, v) => s + (parseFloat(v.stock) || 0), 0);
            const stockGeneralSinAsignar = Math.max(0, stockActual - stockEnVariantes);

            const opcionesUbi = _opcionesUbicacionSalidaVenta(x.prod, colorElegido, ubicacionElegida);

            // 2. Crear el HTML del Selector
            let ubicacionSelectorHtml = `
                <div style="margin-top:6px;">
                    <label style="font-size:11px; color:#374151;">Ubicacion de salida:</label>
                    <select onchange="cambiarUbicacionInventario('${idProdArg}', this.value)"
                        style="margin-left:4px; padding:4px; border:1px solid #ddd; border-radius:4px; font-size:12px; background:#f0fdf4; border-color:#86efac; width:230px; cursor:pointer;">
                        ${opcionesUbi}
                    </select>
                </div>`;
            ubicacionSelectorHtml = _renderOpcionesOrigenVenta(x.prod, x.item);
            let accionesInventario = metodoPago === "apartado"
                ? `<div style="padding:8px 12px; background:#fffbeb; color:#92400e; border:1px solid #fcd34d; border-radius:6px; font-size:12px; max-width:220px;">
                        Apartado: queda en resguardo. No se descuenta inventario ni se emite entrega hasta liquidar.
                   </div>`
                : `<div style="display:flex; flex-direction:column; gap:8px; min-width:170px;">
                        <button onclick="setDecisionInventario('${idProdArg}', true)" 
                                id="btn-si-${idProd}"
                                style="padding:9px 12px; background:#94a3b8; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold;">
                            Tomar inventario
                        </button>
                        <button onclick="setDecisionInventario('${idProdArg}', false)" 
                                id="btn-no-${idProd}"
                                style="padding:9px 12px; background:#f59e0b; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold; font-size:0;">
                            <span style="font-size:13px;">Sobre pedido</span>
                            ⏳ Pendiente
                        </button>
                        <small style="color:#64748b; line-height:1.3;">Sobre pedido: no descuenta inventario y quedara pendiente/requisicion.</small>
                   </div>`;
            if (metodoPago !== "apartado") {
                accionesInventario = `
                   <div style="display:flex; flex-direction:column; gap:8px; min-width:180px;">
                        <button onclick="setDecisionInventario('${idProdArg}', true)"
                                id="btn-si-${idProd}"
                                style="padding:11px 12px; background:#94a3b8; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:900; box-shadow:none;">
                            Tomar de inventario
                        </button>
                        <button onclick="setDecisionInventario('${idProdArg}', false)"
                                id="btn-no-${idProd}"
                                style="padding:11px 12px; background:#f59e0b; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:900; box-shadow:none;">
                            Mandar sobre pedido
                        </button>
                        <small id="estado-decision-${idProd}" style="color:#92400e; line-height:1.3; font-weight:bold;">Decision pendiente.</small>
                   </div>`;
            }

            htmlProductos += `
                <div style="background:white; padding:14px; border-radius:8px; margin-bottom:12px; border:1px solid #bbf7d0; box-shadow:0 1px 4px rgba(15,23,42,.06);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; flex-wrap:wrap;">
                    <div style="flex:1; min-width:270px;">
                        <strong>${x.prod.nombre}</strong><br>
                        <small style="color:#718096;">Stock disponible: ${_stockDisponibleParaSolicitudVenta(x.prod, x.item)} | Solicitado: ${cantRequerida}</small>
                        <div style="margin-top:8px; padding:9px 10px; background:#ecfdf5; border:1px solid #86efac; border-radius:7px; color:#166534; font-size:12px; font-weight:bold;">
                            Hay existencia. Antes de vender debes decidir si la tomaras de inventario y de que ubicacion saldra.
                        </div>
                        ${colorSelectorHtml}
                        ${ubicacionSelectorHtml}
                    </div>
                    ${accionesInventario}
                    </div>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    if (productosSinStock.length > 0) {
        htmlProductos += `
            <div style="background:#fee2e2; padding:15px; border-radius:8px; border-left:5px solid #dc2626;">
                <h4 style="margin:0 0 15px 0; color:#7f1d1d;">PRODUCTOS SIN STOCK</h4>
        `;
        
        productosSinStock.forEach(x => {
            const idProd = x.prod.id;
            decisionesInventario[idProd] = { entregar: false, sinStock: true, confirmadoSobrePedido: true }; 
            const colorElegido = x.item.colorElegido || 'Sin especificar';
            
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px;">
                    <strong>${x.prod.nombre}</strong><br>
                    <small style="color:#991b1b;">Se creará REQUISICIN DE COMPRA automáticamente</small><br>
                    <small style="color:#7f1d1d;">Stock disponible para solicitud: ${_stockDisponibleParaSolicitudVenta(x.prod, x.item)} | Solicitado: ${x.item.cantidad || 1}</small><br>
                    <small style="color:#374151;">Color solicitado: <b>${_escapeHtml(colorElegido)}</b></small>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    document.querySelector('[data-modal="dialogo-inventario"]')?.remove();

    // REPARACIN: Volver a empaquetar el plan para el último botón
    const planSafeStr2 = planElegido ? JSON.stringify(planElegido).replace(/'/g, "\\'").replace(/"/g, '&quot;') : 'null';

    const modalHTML = `
        <div class="modal" data-modal="dialogo-inventario" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div style="background:white; padding:30px; border-radius:15px; width:100%; max-width:700px; margin:0 auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">Gestión de Inventario</h2>
                <p style="color:#718096; margin:0 0 20px 0;">Confirma cómo se entregarán los productos</p>
                
                ${htmlProductos}
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button id="btnProcesarVentaInventario" disabled onclick="confirmarDecisionesInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar}, ${planSafeStr2})" 
                            style="flex:1; padding:14px; background:#94a3b8; color:white; border:none; border-radius:6px; cursor:not-allowed; font-weight:bold; font-size:16px; opacity:.72;">
                        Procesar Venta
                    </button>
                    <button onclick="cancelarYVolverAlCarrito()" 
                            style="flex:1; padding:14px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        S" Cancelar
                    </button>
                </div>
                <div id="avisoDecisionesInventario" style="display:block;margin-top:10px;background:#fffbeb;border:1px solid #f59e0b;color:#92400e;border-radius:8px;padding:10px;font-size:13px;font-weight:bold;">
                    Falta decidir la salida de inventario o confirmar sobre pedido para los productos con existencia.
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    _actualizarBotonProcesarInventario();

    // Sugerencia automatica: si hay existencia se preselecciona tomarla de la
    // ubicacion de mayor prioridad (o la que el usuario ya tenia elegida si
    // reabrio este dialogo). "Mandar sobre pedido" sigue disponible para
    // que el usuario decida vender sobre pedido en su lugar.
    productosConStock.forEach(x => {
        const idProd = x.prod.id;
        const colorElegido = x.item.colorElegido || '';
        const opciones = _ubicacionesSalidaVentaDetalle(x.prod, colorElegido);
        if (!opciones.length) return;
        const ubicacionSugerida = x.item.ubicacionElegida || opciones[0].ubicacion;
        const idDom = _ventaDomId(idProd);
        if (document.getElementById(`btn-origen-${idDom}-${_ventaDomId(ubicacionSugerida)}`)) {
            seleccionarOrigenInventario(idProd, ubicacionSugerida);
        }
    });
}

function seleccionarOrigenInventario(productoId, ubicacion) {
    if (!decisionesInventario[productoId]) decisionesInventario[productoId] = {};
    decisionesInventario[productoId].ubicacion = ubicacion;
    decisionesInventario[productoId].entregar = true;
    decisionesInventario[productoId].confirmadoSobrePedido = false;

    const idx = carrito.findIndex(item => String(item.id) === String(productoId));
    if (idx !== -1) {
        carrito[idx].ubicacionElegida = ubicacion;
        StorageService.set("carrito", carrito);
    }

    setDecisionInventario(productoId, true, { saltarValidacionUbicacion: true });
    const idDom = _ventaDomId(productoId);
    document.querySelectorAll(`[data-origen-producto="${idDom}"]`).forEach(btn => {
        btn.style.background = '#f8fafc';
        btn.style.borderColor = '#cbd5e1';
        btn.style.boxShadow = 'none';
        btn.style.opacity = '0.42';
        btn.style.transform = 'scale(.98)';
    });
    const btnOrigen = document.getElementById(`btn-origen-${idDom}-${_ventaDomId(ubicacion)}`);
    if (btnOrigen) {
        btnOrigen.style.background = '#dcfce7';
        btnOrigen.style.borderColor = '#16a34a';
        btnOrigen.style.boxShadow = '0 0 0 3px rgba(22,163,74,.18)';
        btnOrigen.style.opacity = '1';
        btnOrigen.style.transform = 'scale(1)';
    }
    const nota = document.getElementById(`origen-seleccionado-${idDom}`);
    if (nota) {
        nota.style.background = '#dcfce7';
        nota.style.borderColor = '#86efac';
        nota.style.color = '#166534';
        nota.innerHTML = `<strong>Seleccionado para salida:</strong> ${_escapeHtml(ubicacion)}`;
    }
    const estado = document.getElementById(`estado-decision-${productoId}`);
    if (estado) {
        estado.style.color = '#166534';
        estado.innerHTML = `Tomaras inventario de ${_escapeHtml(ubicacion)}.`;
    }
    _actualizarBotonProcesarInventario();
}

function setDecisionInventario(productoId, entregar) {
    if (!decisionesInventario[productoId]) decisionesInventario[productoId] = {};
    const decision = decisionesInventario[productoId];
    const prod = productos.find(p => String(p.id) === String(productoId));
    const item = carrito.find(i => String(i.id) === String(productoId));

    if (entregar && !decision.ubicacion && !item?.ubicacionElegida) {
        alert(`Selecciona primero la ubicacion de salida para "${prod?.nombre || item?.nombre || 'producto'}".`);
        return;
    }

    if (!entregar) {
        const tieneStock = prod && _stockDisponibleParaSolicitudVenta(prod, item || {}) >= Number(item?.cantidad || 1);
        if (tieneStock && !confirm(`"${prod?.nombre || item?.nombre || 'Producto'}" tiene inventario disponible.\n\nConfirma que NO lo tomaras de inventario y que quedara sobre pedido/pendiente.`)) {
            return;
        }
        decision.confirmadoSobrePedido = true;
    }

    decisionesInventario[productoId].entregar = entregar;
    
    const btnSi = document.getElementById(`btn-si-${productoId}`);
    const btnNo = document.getElementById(`btn-no-${productoId}`);
    if (!btnSi || !btnNo) return;
    
    if (entregar) {
        btnSi.style.background = '#27ae60';
        btnSi.style.opacity = '1';
        btnSi.style.boxShadow = '0 0 0 3px rgba(39,174,96,.18)';
        btnNo.style.background = '#cbd5e0';
        btnNo.style.opacity = '0.5';
        btnNo.style.boxShadow = 'none';
    } else {
        btnNo.style.background = '#f59e0b';
        btnNo.style.opacity = '1';
        btnNo.style.boxShadow = '0 0 0 3px rgba(245,158,11,.20)';
        btnSi.style.background = '#cbd5e0';
        btnSi.style.opacity = '0.5';
        btnSi.style.boxShadow = 'none';
        const idDom = _ventaDomId(productoId);
        document.querySelectorAll(`[data-origen-producto="${idDom}"]`).forEach(btn => {
            btn.style.background = '#f8fafc';
            btn.style.borderColor = '#e2e8f0';
            btn.style.boxShadow = 'none';
            btn.style.opacity = '0.28';
            btn.style.transform = 'scale(.98)';
        });
        const nota = document.getElementById(`origen-seleccionado-${idDom}`);
        if (nota) {
            nota.style.background = '#fffbeb';
            nota.style.borderColor = '#f59e0b';
            nota.style.color = '#92400e';
            nota.innerHTML = '<strong>Sobre pedido confirmado:</strong> no se descontara inventario en esta venta.';
        }
        const estado = document.getElementById(`estado-decision-${productoId}`);
        if (estado) {
            estado.style.color = '#92400e';
            estado.innerHTML = 'Quedara como sobre pedido/pendiente.';
        }
    }
    _actualizarBotonProcesarInventario();
}

function cambiarColorInventario(productoId, nuevoColor) {
    if (!decisionesInventario[productoId]) decisionesInventario[productoId] = {};
    decisionesInventario[productoId].color = nuevoColor;
    decisionesInventario[productoId].ubicacion = ""; 

    const idx = carrito.findIndex(item => String(item.id) === String(productoId));
    if (idx !== -1) {
        carrito[idx].colorElegido = nuevoColor;
        StorageService.set("carrito", carrito);
    }
}

function cambiarUbicacionInventario(productoId, nuevaUbicacion) {
    if (!decisionesInventario[productoId]) decisionesInventario[productoId] = {};
    decisionesInventario[productoId].ubicacion = nuevaUbicacion;
}

window.confirmarDecisionesInventario = function(metodoPago, totalContado, enganche, saldoAFinanciar, planElegidoRecibido) {
    let planElegido = planElegidoRecibido || window._planElegidoPendiente;
    if (metodoPago === "credito") {
        if (!planElegido || !planElegido.abono || planElegido.abono === 0) {
            const periodicidad = window._estadoPago?.periodicidad || document.getElementById("selPeriodicidad")?.value || "semanal";
            const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
            const planIdx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;
            const safeIdx = (planIdx >= 0 && planIdx < planes.length) ? planIdx : 0;
            planElegido = planes[safeIdx];
            if (!planElegido || !planElegido.abono || planElegido.abono === 0) {
                planElegido = planes.find(p => p.abono > 0) || planes[0];
            }
        }
    }

    let montoVentaFinal = totalContado;
    if (metodoPago === "credito" && planElegido) {
        montoVentaFinal = enganche + (planElegido.total || 0);
    }

    const folioVenta = window.generarFolioSistema ? window.generarFolioSistema("V") : "V-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase();

    // --- CORRECCIN DE FECHA ---
    const inputFechaEl = document.getElementById("inputFechaVenta");
    const fechaGuardada = window._estadoPago?.fechaVenta;
    let fechaVentaStr = (inputFechaEl && inputFechaEl.value) ? inputFechaEl.value : fechaGuardada;
    
    let fechaVentaDate;
    if (fechaVentaStr) {
        const [anio, mes, dia] = fechaVentaStr.split("-").map(Number);
        fechaVentaDate = new Date(anio, mes - 1, dia, 12, 0, 0); // Fija a las 12pm para evitar saltos de día por zona horaria
    } else {
        fechaVentaDate = new Date();
    }

    const fechaHoy = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(fechaVentaDate) : fechaVentaDate.toLocaleDateString("es-MX");
    const fechaVentaIso = window.localISO ? window.localISO(fechaVentaDate) : fechaVentaDate.toISOString();
    // --- FIN CORRECCIN DE FECHA ---

    let productosAEntregar = [];
    let productosAPendiente = [];
    let errorInventario = "";

    carrito.forEach(item => {
        const prod = productos.find(prod => String(prod.id) === String(item.id)); 
        if (!prod || errorInventario) return;
        const decision = decisionesInventario[item.id];
        const tieneStock = _stockDisponibleParaSolicitudVenta(prod, item) >= (item.cantidad || 1);

        if (metodoPago !== "apartado" && tieneStock && (!decision || typeof decision.entregar !== "boolean")) {
            errorInventario = `Hay inventario disponible para "${prod.nombre || item.nombre}". Debes elegir la ubicacion de salida o confirmar que quedara sobre pedido.`;
            return;
        }

        if (metodoPago !== "apartado" && tieneStock && decision && decision.entregar === false && decision.confirmadoSobrePedido !== true) {
            errorInventario = `Confirma sobre pedido para "${prod.nombre || item.nombre}" antes de procesar la venta.`;
            return;
        }
        
        const puedeEntregarAhora = metodoPago !== "apartado" && tieneStock && decision && decision.entregar;

        if (puedeEntregarAhora) {
            const colorFinal = (decision.color !== undefined) ? decision.color : (item.colorElegido || '');
            const ubicacionFinal = (decision.ubicacion !== undefined) ? decision.ubicacion : (item.ubicacionElegida || '');
            const validacionOrigen = _validarOrigenEntregaVenta(prod, item, {
                color: colorFinal,
                ubicacion: ubicacionFinal
            });
            if (!validacionOrigen.ok) {
                errorInventario = validacionOrigen.mensaje;
                return;
            }
            productosAEntregar.push({ item: { ...item, colorElegido: colorFinal, ubicacionElegida: ubicacionFinal }, prod });
        } else {
            productosAPendiente.push({
                item,
                prod,
                requiereCompra: !tieneStock,
                generarEntregaPendiente: metodoPago !== "apartado",
                motivo: metodoPago === "apartado"
                    ? "Apartado en resguardo hasta liquidación"
                    : (tieneStock ? "Entrega diferida por decisión de venta" : "Sin stock en almacén")
            });
        }
    });

    if (errorInventario) {
        alert(`No se puede entregar la mercancia todavia.\n\n${errorInventario}\n\nSelecciona una ubicacion con inventario suficiente o deja el producto como pendiente.`);
        return;
    }

    procesarVentaFinal(
        metodoPago, 
        montoVentaFinal, 
        enganche, 
        saldoAFinanciar, 
        planElegido,
        folioVenta, 
        fechaHoy, 
        fechaVentaIso, 
        productosAEntregar, 
        productosAPendiente
    );
};

// INTERCEPTOR MAKER-CHECKER: Pone la venta en cuarentena y emite ticket provisional
function procesarVentaFinal(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock) {

    if (!totalContado || isNaN(totalContado) || totalContado <= 0) {
        totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    }

    const totalMercanciaContado = (carrito || []).reduce((sum, p) => sum + (Number(p.precioContado || p.precio || 0) * Number(p.cantidad || 1)), 0);
    const periodicidadVenta = document.getElementById("selPeriodicidad")?.value || window._estadoPago?.periodicidad || "semanal";
    const pagaresPreview = metodoPago === "credito"
        ? _generarPagaresPreviewVentaCredito({
            folio: folioVenta,
            cliente: clienteSeleccionado,
            fechaBaseIso: fechaVentaIso,
            plan: planElegido,
            periodicidad: periodicidadVenta
        })
        : [];

    let articulosEntregaOperativa = [];
    if (productosConStock && productosConStock.length > 0 && metodoPago !== "apartado") {
        articulosEntregaOperativa = _aplicarSalidaInventarioOperativa(folioVenta, productosConStock);
    }

    // 1. Armar los datos para el Ticket Provisional
    const datosVenta = {
        folio: folioVenta,
        fecha: fechaHoy,
        fechaIso: fechaVentaIso,
        cliente: clienteSeleccionado,
        metodo: metodoPago,
        total: totalContado,
        totalMercancia: totalMercanciaContado || totalContado,
        enganche: enganche,
        saldoPendiente: metodoPago === "credito" ? planElegido.total : (metodoPago === "apartado" ? saldoAFinanciar : 0),
        plan: planElegido,
        pagaresPreview,
        articulos: (carrito || []).map(_ventaArticuloPlano),
        tipoComprobante: "Ticket Provisional (Requiere Autorización)",
        periodicidad: periodicidadVenta,
        apartadoFechaCompromiso: window._estadoPago?.apartadoFechaCompromiso || null,
        apartadoCondiciones: window._estadoPago?.apartadoCondiciones || null,
        vendedorSeleccionado: window._vendedorSeleccionado || null,
        vendedor: window._vendedorSeleccionado?.nombre || null,
        vendedorId: window._vendedorSeleccionado?.id || null,
        vendedorNombre: window._vendedorSeleccionado?.nombre || null,
        acreedor: "Roberto Escobedo Vega",
        lugar: "Santiago Cuaula, Tlaxcala",
        tasaMorosidad: 2
    };

    // 2. Empaquetar todo en la Bóveda de Cuarentena
    const cuarentena = {
        idCuarentena: Date.now(),
        fechaCaptura: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
        fechaCapturaIso: _ventaFechaAhoraIso(),
        clienteNombre: clienteSeleccionado.nombre,
        totalVenta: totalContado,
        estado: 'Pendiente',
        status: 'Pendiente',
        estatus: 'Pendiente',
        args: [
            metodoPago,
            totalContado,
            enganche,
            saldoAFinanciar,
            planElegido,
            folioVenta,
            fechaHoy,
            fechaVentaIso,
            _envolverListaVentaPendiente(productosConStock),
            _envolverListaVentaPendiente(productosSinStock)
        ],
        datosVenta: datosVenta,
        vendedorSeleccionado: window._vendedorSeleccionado
    };

    let pendientes = StorageService.get("ventasPendientes", []).map(_normalizarVentaPendienteFirestore);
    pendientes.push(cuarentena);
    StorageService.set("ventasPendientes", pendientes);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BOVEDA_VENTA_PENDIENTE',
            modulo: 'Ventas',
            entidad: 'venta',
            entidadId: folioVenta,
            detalle: `Venta enviada a la bóveda de autorizaciones`,
            monto: totalContado,
            severidad: 'riesgo',
            datos: {
                clienteId: clienteSeleccionado?.id || null,
                clienteNombre: clienteSeleccionado?.nombre || null,
                metodoPago,
                enganche,
                estatus: 'Pendiente'
            }
        });
    }
    if (typeof window.notificarBovedaAutorizacion === 'function') {
        window.notificarBovedaAutorizacion({
            tipo: 'venta',
            id: `venta-${folioVenta}`,
            titulo: 'Venta pendiente en Boveda',
            cuerpo: `${clienteSeleccionado.nombre || 'Cliente'} - ${typeof dinero === 'function' ? dinero(totalContado) : totalContado}`,
            folio: folioVenta,
            cliente: clienteSeleccionado.nombre,
            total: totalContado
        });
    }

    // 3. Emitir documentos operativos aunque la venta quede en cuarentena.
    // La cuarentena es administrativa; no debe detener caja ni entrega.
    generarTicketMediaHoja(datosVenta);

    // Recibo de enganche/anticipo — se imprime automáticamente cuando la venta
    // es a crédito o apartado y el cliente entregó un enganche mayor a $0.
    if ((datosVenta.metodo === 'credito' || datosVenta.metodo === 'apartado') &&
        Number(datosVenta.enganche || 0) > 0) {
        generarTicketEnganche(
            datosVenta,
            window._estadoPago?.modoEnganche,
            window._estadoPago?.etiquetaCuenta
        );
    }

    if (articulosEntregaOperativa.length > 0 && typeof window.generarValeEntrega === "function") {
        const clienteEntrega = { ...(clienteSeleccionado || {}) };
        window.generarValeEntrega({
            folio: folioVenta,
            fecha: fechaHoy,
            fechaIso: fechaVentaIso,
            metodoPago,
            cliente: clienteEntrega,
            estatusEntrega: productosSinStock && productosSinStock.some(x => x.generarEntregaPendiente !== false) ? "Parcial" : "Total"
        }, articulosEntregaOperativa, {
            origen: "salida_operativa_venta_cuarentena",
            registrar: true,
            estatusEntrega: productosSinStock && productosSinStock.some(x => x.generarEntregaPendiente !== false) ? "Parcial" : "Total",
            observaciones: "Documento operativo emitido al ejecutar la venta. Su registro administrativo queda sujeto a autorización."
        });
    }

    // 4. Limpiar interfaz (sin afectar DB real)
    carrito = [];
    clienteSeleccionado = null;
    plazoSeleccionado = null;
    window._vendedorSeleccionado = null;
    if (!StorageService.set("carrito", carrito)) console.error("Error limpiando carrito");
    actualizarContadorCarrito();

    document.querySelectorAll('[data-modal]').forEach(m => m.remove());
    document.querySelectorAll('.modal').forEach(m => { m.classList.add('oculto'); m.style.display = 'none'; });

    alert(`⏳ VENTA EN CUARENTENA\\n\\nFolio: ${folioVenta}\\nLa nota fue emitida y el proceso en caja finalizó. Si marcaste mercancía para entrega, también se generó su comprobante operativo.\\n\\nEl registro financiero e inventario oficial quedan pendientes de autorización del Administrador.`);
    navA('tienda');
}

// aEJECUTOR REAL: Esta es la función original que escribe a la Base de Datos
window.ejecutarVentaAutorizadaReal = function(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock, datosVentaP) {

    productosConStock = _desenvolverListaVentaPendiente(productosConStock);
    productosSinStock = _desenvolverListaVentaPendiente(productosSinStock);

    const folioNormalizado = String(folioVenta || '').trim();

    // ── CAPA 0: Lista local de folios ya autorizados ───────────────────────
    // Clave con prefijo "_": nunca sube ni baja de Firebase.
    // Sobrevive a cualquier syncAll() con datos viejos de la nube.
    const _ventasAprobadas = StorageService.get('_idsAprobadosLocal', []);
    const _claveVenta = `venta-${folioNormalizado}`;
    if (folioNormalizado && _ventasAprobadas.includes(_claveVenta)) {
        alert(`⚠️ La venta ${folioNormalizado} ya fue autorizada en este dispositivo.\n\nNo se duplicará.`);
        return false;
    }
    // ──────────────────────────────────────────────────────────────────────

    const esConversionApartado = !!datosVentaP?.origenApartadoFolio &&
        String(datosVentaP.origenApartadoFolio || '').trim() === folioNormalizado;
    const ventaExistente = StorageService.get('ventasRegistradas', [])
        .find(v => String(v.folio || '').trim() === folioNormalizado);
    const ventaExistenteEsApartadoOrigen = ventaExistente &&
        esConversionApartado &&
        String(ventaExistente.metodoPago || '').toLowerCase() === 'apartado';
    if (ventaExistente && !ventaExistenteEsApartadoOrigen) {
        alert(`La venta ${folioNormalizado} ya existe en registros. No se volvera a procesar para evitar duplicar caja, cartera o inventario.`);
        return false;
    }
    const canceladaAntes = StorageService.get("historialCancelaciones", [])
        .some(h => h.tipo === 'venta' && String(h.folio || '').trim() === folioNormalizado);
    if (canceladaAntes) {
        alert(`La venta ${folioNormalizado} ya fue cancelada. No puede autorizarse desde la boveda.`);
        return false;
    }

    let requisicionesCompra = StorageService.get("requisicionesCompra", []);
    let movimientosCaja = StorageService.get("movimientosCaja", []);
    let cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    let salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    let pagaresSistema = StorageService.get("pagaresSistema", []);
    let entregasPendientes = [];
    let entregadosAhora = [];
    let productosActuales = StorageService.get("productos", []);
    let inventarioVentaActualizado = false;

    // PASO 1: ACTUALIZAR STOCK 
    productosConStock.forEach(x => {
        if (x.salidaOperativaAplicada || x.item?.salidaOperativaAplicada) return;
        const cantRequerida = x.item.cantidad || 1;
        const prodPersistente = productosActuales.find(p => String(p.id) === String(x.prod?.id || x.item?.id || x.item?.productoId));
        const prodVenta = prodPersistente || x.prod;
        if (!prodVenta) return;
        const stockActual = prodVenta.stock || 0;
        const colorElegido = x.item.colorElegido || '';
        const ubicacionElegida = x.item.ubicacionElegida || ''; 

        const validacionOrigen = _validarOrigenEntregaVenta(prodVenta, x.item, { color: colorElegido, ubicacion: ubicacionElegida });
        if (stockActual >= cantRequerida && validacionOrigen.ok) {
            if (
                prodVenta.variantes &&
                prodVenta.variantes.length > 0 &&
                ubicacionElegida &&
                _normalizarClaveInventario(ubicacionElegida) !== 'STOCK GENERAL'
            ) {
                let restante = cantRequerida;
                prodVenta.variantes.forEach(v => {
                    const coincideColor = !colorElegido || (v.color && v.color.toUpperCase() === colorElegido.toUpperCase());
                    const coincideUbicacion = !ubicacionElegida || (v.ubicacion && v.ubicacion.toUpperCase() === ubicacionElegida.toUpperCase());
                    if (restante > 0 && coincideColor && coincideUbicacion && Number(v.stock) > 0) {
                        const deducir = Math.min(Number(v.stock), restante);
                        v.stock -= deducir;
                        restante -= deducir;
                    }
                });
                if (restante > 0) return;
            }
            prodVenta.stock = stockActual - cantRequerida;
            if (prodPersistente) {
                x.prod = prodPersistente;
                inventarioVentaActualizado = true;
            }
            const concepto = colorElegido ? `Venta - ${folioVenta} (${colorElegido} - ${ubicacionElegida || 'General'})` : `Venta - ${folioVenta}`;
            if (typeof registrarMovimiento === 'function') registrarMovimiento(prodVenta.id, concepto, cantRequerida, "salida");
            entregadosAhora.push({
                productoId: prodVenta.id,
                nombre: prodVenta.nombre,
                colorElegido,
                ubicacionElegida,
                cantidad: cantRequerida
            });
        }
    });

    if (inventarioVentaActualizado) {
        StorageService.set("productos", productosActuales);
        productos = productosActuales;
        window.productos = productosActuales;
    }

    // PASO 2: CREAR ENTREGAS PENDIENTES Y REQUISICIONES
    productosSinStock.forEach(x => {
        const cantidadSolicitada = x.item.cantidad || 1;
        const colorElegido = x.item.colorElegido || '';
        const nombreConColor = colorElegido ? `${x.prod.nombre} (Color: ${colorElegido})` : x.prod.nombre;

        if (x.generarEntregaPendiente !== false) {
            entregasPendientes.push({
                id: Date.now() + Math.random(),
                folioVenta,
                productoId: x.prod.id,
                nombre: nombreConColor,
                cantidad: cantidadSolicitada,
                colorElegido,
                motivo: x.motivo || "Entrega pendiente"
            });
        }

        if (x.requiereCompra !== false) {
            requisicionesCompra.push({ id: Date.now() + Math.random(), fecha: fechaHoy, producto: nombreConColor, folioVenta, cantidad: cantidadSolicitada, motivo: "Venta sin stock disponible", estatus: "Pendiente" });
        }
    });

    // PASO 3: REGISTRAR MOVIMIENTOS DE CAJA
    let montoIngresoHoy = (metodoPago === "contado" || metodoPago === "transferencia") ? totalContado : enganche;
    if (datosVentaP.engancheYaRegistrado) montoIngresoHoy = 0;
    let tituloConcepto = (metodoPago === "contado" || metodoPago === "transferencia") ? "Venta" : "Enganche";

    if (montoIngresoHoy > 0) {
        const cuentaDefaultIngreso = _ventaCuentaEfectivoDefault();
        const cuentaId = window._estadoPago?.cuentaReceptora || cuentaDefaultIngreso.cuentaId;
        const etiqueta = window._estadoPago?.etiquetaCuenta || cuentaDefaultIngreso.etiqueta;

        if (typeof window._ingresarCuenta === 'function') {
            window._ingresarCuenta({ monto: montoIngresoHoy, cuentaId: cuentaId, etiqueta: etiqueta, concepto: `${tituloConcepto} ${metodoPago} - ${datosVentaP.cliente.nombre} (Folio: ${folioVenta})`, referencia: `VENTA-${folioVenta}`, fecha: fechaVentaIso });
        } else {
            movimientosCaja.push({ id: Date.now(), folio: folioVenta, fecha: fechaVentaIso, tipo: "ingreso", monto: montoIngresoHoy, concepto: `${tituloConcepto} ${metodoPago} - ${datosVentaP.cliente.nombre}`, referencia: `VENTA-${folioVenta}`, cuenta: cuentaId, etiquetaCuenta: etiqueta });
            StorageService.set("movimientosCaja", movimientosCaja);
        }
    }

    // PASO 4: CREAR CUENTAS POR COBRAR O APARTADOS
    if (metodoPago === "credito") {
        const totalMercanciaCredito = Number(datosVentaP.totalMercancia || totalContado || 0);
        const capitalCredito = Math.max(0, totalMercanciaCredito - Number(enganche || 0));
        planElegido = _normalizarPlanCreditoVenta(planElegido, capitalCredito, datosVentaP.periodicidad || "semanal", window._estadoPago?.planIndex || 0);
        if (!planElegido) {
            alert(`No se pudo autorizar la venta ${folioVenta}: el plan de credito no tiene pagos validos. Revisa la configuracion de credito antes de intentarlo de nuevo.`);
            return false;
        }
        let diasIntervalo = datosVentaP.periodicidad === "quincenal" ? 14 : datosVentaP.periodicidad === "mensual" ? 30 : 7;
        let fechaPago = new Date(fechaVentaIso);
        const totalPagos = Math.max(1, Number(planElegido.pagos || Math.round(planElegido.semanas / (diasIntervalo / 7))) || 1);
        const totalCreditoPlan = Math.max(0, Number(planElegido.total || 0));
        const abonoBasePlan = Math.max(0, Number(planElegido.abono || 0));
        const pagaresNuevos = [];
        let acumuladoPagares = 0;

        for (let i = 1; i <= totalPagos; i++) {
            fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
            const montoPagare = i === totalPagos
                ? Math.max(0, Number((totalCreditoPlan - acumuladoPagares).toFixed(2)))
                : Number(abonoBasePlan.toFixed(2));
            acumuladoPagares = Number((acumuladoPagares + montoPagare).toFixed(2));
            pagaresNuevos.push({ id: Date.now() + i, folio: folioVenta, numeroPagere: `${folioVenta}-${i}/${totalPagos}`, clienteNombre: datosVentaP.cliente.nombre, clienteId: datosVentaP.cliente.id, fechaEmision: fechaVentaIso, fechaVencimiento: fechaPago.getTime(), monto: montoPagare, estado: "Pendiente", diasAtrasoActual: 0 });
        }

        const saldoCreditoPagares = Number(pagaresNuevos.reduce((sum, p) => sum + Number(p.monto || 0), 0).toFixed(2));
        const planCreditoFinal = { ...planElegido, total: saldoCreditoPagares, pagos: totalPagos };
        let saldosPorMes = CalculatorService.calcularCreditoConPeriodicidad ? CalculatorService.calcularCreditoConPeriodicidad((totalMercanciaCredito - enganche), datosVentaP.periodicidad).map(p => ({ meses: p.meses, total: p.total })) : [];
        cuentasPorCobrar.push({ folio: folioVenta, nombre: datosVentaP.cliente.nombre, clienteId: datosVentaP.cliente.id, direccion: datosVentaP.cliente.direccion || "", telefono: datosVentaP.cliente.telefono || "", fechaVenta: fechaVentaIso, totalContadoOriginal: totalMercanciaCredito, engancheRecibido: enganche, saldoActual: saldoCreditoPagares, saldoOriginal: saldoCreditoPagares, metodo: metodoPago, plan: planCreditoFinal, estado: "Pendiente", abonos: [], articulos: datosVentaP.articulos, totalMercancia: totalMercanciaCredito, periodicidad: datosVentaP.periodicidad, vendedorId: window._vendedorSeleccionado?.id || null, vendedorNombre: window._vendedorSeleccionado?.nombre || null, saldosPorMes, origenApartadoFolio: datosVentaP.origenApartadoFolio || null, engancheOrigenApartado: datosVentaP.origenApartadoFolio ? enganche : 0 });
        pagaresSistema.push(...pagaresNuevos);
        StorageService.set("cuentasPorCobrar", cuentasPorCobrar);
        StorageService.set("pagaresSistema", pagaresSistema);

    } else if (metodoPago === "apartado") {
        let apartadosBD = StorageService.get("apartados", []);
        apartadosBD.push({
            id: Date.now(),
            folio: folioVenta,
            clienteId: datosVentaP.cliente.id,
            clienteNombre: datosVentaP.cliente.nombre,
            fechaApartado: fechaVentaIso,
            fechaCompromiso: datosVentaP.apartadoFechaCompromiso || window._estadoPago?.apartadoFechaCompromiso || null,
            condiciones: datosVentaP.apartadoCondiciones || window._estadoPago?.apartadoCondiciones || _condicionesApartadoDefault(),
            importeApartado: totalContado,
            enganche: enganche,
            saldoPendiente: saldoAFinanciar,
            articulos: datosVentaP.articulos,
            abonos: [],
            estado: 'Pendiente',
            cuentaIdEnganche: window._estadoPago?.cuentaReceptora || null,
            etiquetaCuentaEnganche: window._estadoPago?.etiquetaCuenta || null,
            vendedorId: window._vendedorSeleccionado?.id || null,
            vendedorNombre: window._vendedorSeleccionado?.nombre || null
        });
        StorageService.set("apartados", apartadosBD);
    }

    if (metodoPago === "credito" && datosVentaP.origenApartadoFolio) {
        const apartadosBD = StorageService.get("apartados", []);
        const idxApartado = apartadosBD.findIndex(a => a.folio === datosVentaP.origenApartadoFolio);
        if (idxApartado !== -1) {
            apartadosBD[idxApartado] = {
                ...apartadosBD[idxApartado],
                estado: "Migrado a Crédito",
                folioCredito: folioVenta,
                fechaConversionCredito: fechaVentaIso,
                saldoPendiente: 0
            };
            StorageService.set("apartados", apartadosBD);
        }
    }

    StorageService.set("productos", productos);
    StorageService.set("requisicionesCompra", requisicionesCompra);

    if (entregasPendientes.length > 0) {
        salidasPendientesVenta.push({
            id: Date.now(),
            folioVenta,
            fecha: fechaHoy,
            fechaIso: fechaVentaIso,
            clienteId: datosVentaP.cliente.id,
            clienteNombre: datosVentaP.cliente.nombre,
            clienteDireccion: datosVentaP.cliente.direccion || "",
            clienteTelefono: datosVentaP.cliente.telefono || "",
            metodoPago,
            items: entregasPendientes,
            estatus: "Pendiente"
        });
        StorageService.set("salidasPendientesVenta", salidasPendientesVenta);
    }

    const ventasRegistradas = StorageService.get('ventasRegistradas', []);
    const registroVentaAutorizada = {
        folio: folioVenta,
        fechaVenta: fechaVentaIso,
        fecha: fechaHoy,
        clienteId: datosVentaP.cliente.id,
        clienteNombre: datosVentaP.cliente.nombre,
        cliente: datosVentaP.cliente,
        total: totalContado,
        totalMercancia: datosVentaP.totalMercancia || totalContado,
        enganche: enganche,
        cuentaReceptora: window._estadoPago?.cuentaReceptora || null,
        etiquetaCuenta: window._estadoPago?.etiquetaCuenta || null,
        montoIngresoInicial: montoIngresoHoy,
        saldoAFinanciar: metodoPago === "credito" && planElegido?.total ? planElegido.total : saldoAFinanciar,
        metodoPago: metodoPago,
        plan: planElegido,
        periodicidad: datosVentaP.periodicidad,
        articulos: datosVentaP.articulos,
        apartadoFechaCompromiso: datosVentaP.apartadoFechaCompromiso || null,
        apartadoCondiciones: datosVentaP.apartadoCondiciones || null,
        vendedor: window._vendedorSeleccionado?.nombre || null,
        vendedorId: window._vendedorSeleccionado?.id || null,
        vendedorNombre: window._vendedorSeleccionado?.nombre || null
    };
    const idxVentaApartadoOrigen = ventasRegistradas.findIndex(v =>
        String(v.folio || '').trim() === folioNormalizado &&
        esConversionApartado &&
        String(v.metodoPago || '').toLowerCase() === 'apartado'
    );
    if (idxVentaApartadoOrigen !== -1) {
        ventasRegistradas[idxVentaApartadoOrigen] = {
            ...ventasRegistradas[idxVentaApartadoOrigen],
            ...registroVentaAutorizada,
            folioApartadoOrigen: datosVentaP.origenApartadoFolio,
            estadoAnteriorApartado: "Migrado a Credito",
            fechaConversionCredito: fechaVentaIso
        };
    } else {
        ventasRegistradas.push(registroVentaAutorizada);
    }
    StorageService.set('ventasRegistradas', ventasRegistradas);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: esConversionApartado ? 'CONVERSION_APARTADO_CREDITO' : 'VENTA_REGISTRADA',
            modulo: 'Ventas',
            entidad: 'venta',
            entidadId: folioVenta,
            detalle: `${metodoPago} - ${datosVentaP.cliente?.nombre || 'Cliente'}`,
            monto: totalContado,
            severidad: metodoPago === 'credito' || metodoPago === 'apartado' ? 'riesgo' : 'info',
            datos: {
                clienteId: datosVentaP.cliente?.id || null,
                clienteNombre: datosVentaP.cliente?.nombre || null,
                metodoPago,
                enganche,
                montoIngresoHoy,
                vendedorId: window._vendedorSeleccionado?.id || null,
                vendedorNombre: window._vendedorSeleccionado?.nombre || null
            }
        });
    }

    if (typeof window.registrarComisionVenta === "function" && window._vendedorSeleccionado?.id) {
        window._ultimaVentaMetodo = metodoPago;
        window.registrarComisionVenta(folioVenta, totalContado, window._vendedorSeleccionado.id);
    }

    const entregaYaDocumentada = StorageService.get("documentosEntrega", [])
        .some(d => d.folioVenta === folioVenta && d.origen === "salida_operativa_venta_cuarentena");

    if (entregadosAhora.length > 0 && !entregaYaDocumentada && typeof window.generarValeEntrega === 'function') {
        window.generarValeEntrega({
            folio: folioVenta,
            fecha: fechaHoy,
            fechaIso: fechaVentaIso,
            metodoPago,
            cliente: datosVentaP.cliente,
            estatusEntrega: entregasPendientes.length > 0 ? "Parcial" : "Total"
        }, entregadosAhora, {
            origen: "salida_inventario_venta",
            registrar: true,
            estatusEntrega: entregasPendientes.length > 0 ? "Parcial" : "Total"
        });
    }

    if (typeof window.acumularPuntosCliente === "function" && montoIngresoHoy > 0) {
        window.acumularPuntosCliente(datosVentaP.cliente.id, montoIngresoHoy);
    }

    // ── Marcar folio como autorizado en lista local persistente ───────────
    if (folioNormalizado) {
        const listaAprobados = StorageService.get('_idsAprobadosLocal', []);
        if (!listaAprobados.includes(_claveVenta)) {
            listaAprobados.push(_claveVenta);
            StorageService.set('_idsAprobadosLocal', listaAprobados.slice(-2000));
        }
    }
    // ──────────────────────────────────────────────────────────────────────

    return true;
};

function generarLeyendaPagare(datosVenta, totalAPagar, esCompacta = false) {
    const cliente = datosVenta.cliente.nombre || "________________";
    const fecha = datosVenta.fecha;

    if (esCompacta) {
        return `PAGAR0: Yo ${cliente} me obligo a pagar a la orden de Roberto Escobedo Vega la cantidad de ${dinero(totalAPagar)} conforme al calendario de pagos; incumplimiento genera interés moratorio del 2% mensual; firmado  en Santiago Cuaula Tlaxcala el ${fecha}.`;
    }

    return `PAGAR0: Yo ${cliente} reconozco deber y me obligo incondicionalmente a pagar a la orden de Roberto Escobedo Vega la cantidad de ${dinero(totalAPagar)}, correspondiente al crédito otorgado, misma que cubriré en las fechas y montos establecidos en el calendario de pagos adjunto; en caso de incumplimiento total o parcial, se generarán intereses moratorios del 2% mensual sobre saldos insolutos; este pagaré se suscribe en Santiago Cuaula Tlaxcala con fecha ${fecha}, obligándome a cumplir en el domicilio del acreedor y sometiéndome para su interpretación y cumplimiento a la jurisdicción de los tribunales del domicilio del acreedor, renunciando a cualquier otro fuero que pudiera corresponderme.`;
}

// ===== GENERADOR DE TICKET T0RMICO (80MM) CON CALENDARIO LIMPIO =====
function generarTicketMediaHoja(datosVenta) {
    const folio = datosVenta.folio;
    const fechaActual = datosVenta.fecha;
    const subtotalMercancia = Number(datosVenta.totalMercancia || (datosVenta.articulos || []).reduce((sum, a) => sum + (Number(a.precioContado || a.precio || 0) * Number(a.cantidad || 1)), 0) || datosVenta.total || 0);
    
    // 1. Cálculos de Pagarés y Saldo
    let totalAPagar = 0;
    let tablaPagares = '';
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresOficiales = pagares.filter(p => p.folio === folio);
    let pagaresDelFolio = pagaresOficiales.length > 0 ? pagaresOficiales : (datosVenta.pagaresPreview || []);
    if (datosVenta.metodo === "credito" && pagaresDelFolio.length === 0 && datosVenta.plan) {
        pagaresDelFolio = _generarPagaresPreviewVentaCredito({
            folio,
            cliente: datosVenta.cliente,
            fechaBaseIso: datosVenta.fechaIso,
            plan: datosVenta.plan,
            periodicidad: datosVenta.periodicidad || "semanal"
        });
    }

    if (datosVenta.metodo === "credito") {
        pagaresDelFolio.forEach((pagar, index) => {
            const fechaPago = new Date(pagar.fechaVencimiento);
            const fechaFmt = window.formatearFechaCortaMX(fechaPago);
            totalAPagar += Number(pagar.monto) || 0;
            
            // SOLO NMERO, FECHA Y MONTO
            tablaPagares += `
                <tr>
                    <td align="left" style="padding: 3px 0;">${index + 1}</td>
                    <td align="center" style="padding: 3px 0;">${fechaFmt}</td>
                    <td align="right" style="padding: 3px 0; font-weight: bold;">${dinero(Number(pagar.monto) || 0)}</td>
                </tr>`;
        });
    }

    // 2. Tabla de Productos
    let listaProductos = '';
    datosVenta.articulos.forEach(art => {
        const subtotal = (art.precioContado || 0) * (art.cantidad || 1);
        listaProductos += `
            <div style="margin-bottom: 4px; font-size: 11px;">
                <div style="display:flex; justify-content:space-between;">
                    <span><b>${art.cantidad || 1}x</b> ${art.nombre}</span>
                    <b>${dinero(subtotal)}</b>
                </div>
                ${art.colorElegido ? `<small style="display:block; color:#555;">}Color: ${art.colorElegido}</small>` : ''}
            </div>`;
    });

    // 3. Política de Liquidación Anticipada (TODOS LOS PLAZOS)
    let planesHTML = '';
    if (datosVenta.metodo === "credito") {
        let saldoParaPlanes = (datosVenta.articulos || []).reduce(
            (sum, a) => sum + (a.precioContado || 0) * (a.cantidad || 1), 0
        ) - (datosVenta.enganche || 0);
        
        const periodicidad = datosVenta.periodicidad || "semanal";
        const todosLosPlanes = CalculatorService.calcularCreditoConPeriodicidad
            ? CalculatorService.calcularCreditoConPeriodicidad(saldoParaPlanes, periodicidad)
            : CalculatorService.calcularCredito(saldoParaPlanes);

        todosLosPlanes.forEach(p => {
            planesHTML += `
                <div style="display:flex; justify-content:space-between; border-bottom:1px dotted #ccc; padding:4px 0;">
                    <span style="font-size:10px;">${p.meses} Meses ${p.pagos || ''} pagos:</span>
                    <strong style="font-size:11px;">${dinero(p.total)}</strong>
                </div>`;
        });
    }

    // LEYENDAS LEGALES DINÁMICAS (Como las grandes cadenas)
    let textoLegal = '';
    const tituloTicketBase = datosVenta.metodo === 'apartado' ? 'RECIBO DE APARTADO' : (datosVenta.metodo === 'credito' ? 'CONTRATO DE CR0DITO' : 'COMPROBANTE DE VENTA');
    const tituloTicket = datosVenta.tipoComprobante || tituloTicketBase;
    const condicionesApartado = datosVenta.apartadoCondiciones || datosVenta.condiciones || _condicionesApartadoDefault();
    const fechaCompromisoApartado = datosVenta.apartadoFechaCompromiso || datosVenta.fechaCompromiso || "";
    const condicionesApartadoHtml = String(condicionesApartado || "")
        .split(/\r?\n/)
        .filter(Boolean)
        .map(c => `<li>${_escapeHtml(c)}</li>`)
        .join("");

    if (datosVenta.metodo === "credito") {
        textoLegal = generarLeyendaPagare(datosVenta, totalAPagar, false);
    } else if (datosVenta.metodo === "apartado") {
        textoLegal = `<b>T0RMINOS DE APARTADO:</b><br>El cliente ${_escapeHtml(datosVenta.cliente.nombre)} entrega ${dinero(datosVenta.enganche)} como anticipo para apartar la mercancía descrita. El saldo pendiente es ${dinero(datosVenta.saldoPendiente)}${fechaCompromisoApartado ? ` y deberá liquidarse a más tardar el ${_escapeHtml(fechaCompromisoApartado)}` : ""}. La mercancía queda bajo resguardo de Mueblería Mi Pueblito y se entrega únicamente tras liquidación total. El cliente acepta las condiciones impresas en este comprobante.`;
    } else {
        textoLegal = `<b>T0RMINOS DE VENTA:</b><br>El cliente ${datosVenta.cliente.nombre} recibe la mercancía a su entera satisfacción, liquidada en su totalidad. Toda aclaración o garantía deberá tramitarse en tienda presentando este comprobante original.`;
    }

    // 4. Estructura HTML del Ticket de 80mm
    const ticketHTML = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="UTF-8">
    <style>
        @page { size: 80mm auto; margin: 0; }
        body { 
            font-family: 'Courier New', Courier, monospace; 
            width: 72mm; margin: 4mm auto; color: #000; background: #fff;
            line-height: 1.2; font-size: 12px;
        }
        .centro { text-align: center; }
        .negrita { font-weight: bold; }
        .separador { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .total-box { border: 2px solid #000; padding: 10px; margin: 10px 0; text-align: center; }
        .legal { font-size: 9.5px; text-align: justify; margin: 10px 0; line-height: 1.3; }
        .no-print { background: #eee; padding: 10px; text-align: center; margin-bottom: 10px; }
        @media print { .no-print { display: none; } }
    </style>
    </head>
    <body>
        <div class="no-print"><button onclick="window.print()" style="padding:10px 20px; cursor:pointer;">IMPRIMIR TICKET</button></div>

        <div class="centro">
            <img src="img/Logo.svg" style="width:50px; height:50px; object-fit:contain;" onerror="this.style.display='none'">
            <div class="negrita" style="font-size:16px;">MUEBLERIA MI PUEBLITO</div>
            <div style="font-size:10px;">Lo mejor a los mejores precios<br>Santiago Cuaula, Tlaxcala</div>
            <div class="negrita" style="font-size:13px; margin-top:6px; padding:3px; border:1px solid #000;">${tituloTicket}</div>
        </div>

        <div class="separador"></div>

        <div>
            <b>FOLIO: ${folio}</b><br>
            FECHA: ${fechaActual}<br>
            CLIENTE: ${datosVenta.cliente.nombre}<br>
            ${datosVenta.vendedorNombre || datosVenta.vendedor ? `VENDEDOR: ${_escapeHtml(datosVenta.vendedorNombre || datosVenta.vendedor)}<br>` : ''}
            ${datosVenta.cliente.telefono ? 'TEL: ' + datosVenta.cliente.telefono : ''}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:10px;">DETALLE DE MERCANCÍA</div>
        <div style="margin-top:5px;">${listaProductos}</div>

        <div class="separador"></div>

        <div style="display:flex; justify-content:space-between;">
            <span>Subtotal Mercancía:</span>
            <span>${dinero(subtotalMercancia)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>Anticipo / Enganche:</span>
            <span>${dinero(datosVenta.enganche || 0)}</span>
        </div>
        ${datosVenta.metodo === 'apartado' && fechaCompromisoApartado ? `
        <div style="display:flex; justify-content:space-between;">
            <span>Fecha límite:</span>
            <span>${_escapeHtml(fechaCompromisoApartado)}</span>
        </div>` : ''}
        
        <div class="total-box">
            <div style="font-size:10px;">${datosVenta.metodo === 'credito' ? 'GRAN TOTAL A PAGAR' : (datosVenta.metodo === 'apartado' ? 'SALDO PENDIENTE' : 'TOTAL PAGADO')}</div>
            <div style="font-size:24px;" class="negrita">${dinero(datosVenta.metodo === 'credito' ? totalAPagar + (datosVenta.enganche || 0) : (datosVenta.metodo === 'apartado' ? datosVenta.saldoPendiente : datosVenta.total))}</div>
            ${datosVenta.metodo === 'credito' ? `<div style="font-size:9px;">(${dinero(totalAPagar)} en pagarés + enganche)</div>` : ''}
        </div>

        ${datosVenta.metodo === "credito" ? `
            <div class="centro negrita" style="background:#000; color:#fff; padding:4px; font-size:10px; margin-bottom:5px;">POLÍTICA DE LIQUIDACIN</div>
            <div style="font-size:9px; text-align:center; margin-bottom:5px;">Total de pagarés si liquida en:</div>
            ${planesHTML}

            <div class="separador"></div>
            <div style="font-size:10px; padding:4px 0;">
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>Forma de pago:</span><strong>Crédito</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>Plazo:</span><strong>${datosVenta.plan?.meses || pagaresDelFolio.length} meses</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>Periodicidad:</span><strong>${{'semanal':'Semanal','quincenal':'Quincenal','mensual':'Mensual'}[datosVenta.periodicidad || 'semanal'] || 'Semanal'}</strong></div>
                <div style="display:flex; justify-content:space-between;"><span>No. de pagos:</span><strong>${pagaresDelFolio.length}</strong></div>
            </div>
            <div class="separador"></div>
            <div class="centro negrita" style="font-size:10px; margin-bottom:5px;">CALENDARIO DE PAGOS</div>
            <table style="margin-bottom: 10px;">
                <thead>
                    <tr style="border-bottom:1px solid #000;">
                        <th align="left" style="padding-bottom:3px;">#</th>
                        <th align="center" style="padding-bottom:3px;">VENCIMIENTO</th>
                        <th align="right" style="padding-bottom:3px;">MONTO</th>
                    </tr>
                </thead>
                <tbody>${tablaPagares}</tbody>
            </table>
        ` : ''}

        ${datosVenta.metodo === "apartado" ? `
            <div class="separador"></div>
            <div class="centro negrita" style="background:#000; color:#fff; padding:4px; font-size:10px; margin-bottom:5px;">CONDICIONES DEL APARTADO</div>
            <ol style="font-size:9.5px; margin:0 0 8px 16px; padding:0; line-height:1.35;">${condicionesApartadoHtml}</ol>
        ` : ''}

        <div class="separador"></div>

        <div class="legal">
            ${textoLegal}
        </div>

        <div style="margin-top:30px; text-align:center;">
            <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto;"></div>
            <div class="negrita" style="font-size:10px; margin-top:5px;">FIRMA DE CONFORMIDAD</div>
        </div>

        <div class="centro" style="margin-top:20px; font-size:9px;">
            *** Gracias por su preferencia ***<br>
            Mueblería Mi Pueblito
        </div>
    </body>
    </html>`;

    if (window.TicketService?.openHtml) {
        window.TicketService.openHtml(ticketHTML, { title: `${tituloTicket} ${folio}`, filename: `ticket_${folio}` });
        return;
    }
    const win = window.open('', '_blank');
    if (!win) {
        alert("Habilita las ventanas emergentes para ver el ticket.");
        return;
    }
    win.document.write(ticketHTML);
    win.document.close();
    win.focus();
    
    // Desactivado para unificar la fuente de verdad en ventasRegistradas
    // guardarTicketEnRegistro(datosVenta, folio);
}

function guardarTicketEnRegistro(datosVenta, folio) {
    let registroTickets = StorageService.get("registroTickets", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresDelFolio = pagares.filter(p => p.folio === folio);

    const ticketRegistro = {
        id: Date.now(),
        folio: folio,
        fechaEmision: datosVenta.fechaIso || window.localISO(new Date()),
        cliente: {
            id: datosVenta.cliente.id,
            nombre: datosVenta.cliente.nombre,
            telefono: datosVenta.cliente.telefono,
            direccion: datosVenta.cliente.direccion,
            referencia: datosVenta.cliente.referencia
        },
        venta: {
            total: datosVenta.total,
            enganche: datosVenta.enganche,
            saldoPendiente: datosVenta.saldoPendiente,
            metodoPago: datosVenta.metodo,
            plan: datosVenta.plan,
            articulos: datosVenta.articulos,
            periodicidad: datosVenta.periodicidad || 'semanal',
            apartadoFechaCompromiso: datosVenta.apartadoFechaCompromiso || null,
            apartadoCondiciones: datosVenta.apartadoCondiciones || null
        },
        pagares: pagaresDelFolio.map(p => ({
            numeroPagere: p.numeroPagere,
            fechaVencimiento: p.fechaVencimiento,
            monto: p.monto,
            estado: p.estado,
            fechaAbonada: null,
            montoAbonado: 0,
            saldoRestante: p.monto
        })),
        planesDisponibles: CalculatorService.calcularCredito(datosVenta.total),
        estado: "Activo",
        abonos: [],
        vendedorId: window._vendedorSeleccionado ? window._vendedorSeleccionado.id : null,
        vendedorNombre: window._vendedorSeleccionado ? window._vendedorSeleccionado.nombre : null,
        ultimaActualizacion: window.localISO(new Date())
    };

    // BLINDAJE ANTI-DUPLICADOS
    const indexExistente = registroTickets.findIndex(t => t.folio === folio);
    
    if (indexExistente !== -1) {
        // Si ya existe (ej. es una reimpresión), mantenemos su ID original y solo actualizamos
        ticketRegistro.id = registroTickets[indexExistente].id;
        registroTickets[indexExistente] = ticketRegistro;
    } else {
        // Si es totalmente nuevo, lo agregamos a la lista
        registroTickets.push(ticketRegistro);
    }

    if (!StorageService.set("registroTickets", registroTickets)) {
        console.error("Error guardando ticket en registro");
    }
}

// ===== ENTREGAS =====
function renderEntregas() {
    const contenedor = document.getElementById("panel-entregas-pendientes");
    if (!contenedor) return;

    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const pendientes = salidasPendientesVenta.filter(s => s.estatus === "Pendiente" || s.estatus === "Parcial");

    if (pendientes.length === 0) {
        contenedor.innerHTML = "<p style='color:#718096; padding:20px; background:white; border-radius:8px;'>No hay entregas pendientes.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th>Método Pago</th>
                <th>Productos</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    pendientes.forEach(s => {
        const resumen = (s.items || []).map(item => `${item.nombre} ${item.cantidad || 1}`).join(', ');
        html += `<tr>
            <td><strong style="cursor:pointer; color:#2980b9; text-decoration:underline;" onclick="abrirDetalleEntrega(${s.id})">${s.folioVenta}</strong></td>
            <td>${s.clienteNombre || ''}</td>
            <td>${s.fecha || ''}</td>
            <td><small>${s.metodoPago || ''}</small></td>
            <td style="font-size:13px;">${resumen || ''}</td>
            <td style="text-align:center;">
                <button onclick="abrirDetalleEntrega(${s.id})" style="background:#3498db; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; margin-right:4px;">Detalle</button>
            </td>
        </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

// ===== DETALLE DE ENTREGA (CON SOPORTE PARCIAL) =====
function abrirDetalleEntrega(idSalida) {
    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const s = salidasPendientesVenta.find(x => String(x.id) === String(idSalida));
    if (!s) return;

    let clientes = StorageService.get("clientes", []);
    const clienteObj = clientes.find(c => String(c.id) === String(s.clienteId));
    const direccion = clienteObj ? (clienteObj.direccion || '') : (s.clienteDireccion || '');
    const telefono = clienteObj ? (clienteObj.telefono || '') : '';

    // Generamos los inputs para que el vendedor decida cuánto entregar hoy
    const itemsHtml = (s.items || []).map((i, index) => {
        if (i.cantidad <= 0) return ''; // Si ya se entregó todo este item, lo omitimos
        const prodActual = StorageService.get("productos", []).find(p => String(p.id) === String(i.productoId));
        const opcionesUbicacion = _opcionesUbicacionSalidaVenta(prodActual, i.colorElegido || '', i.ubicacionElegida || '');
        const avisoColorFlexible = i.colorElegido && prodActual
            ? `<div style="margin-top:6px; font-size:11px; color:#92400e; background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:6px;">
                Si el color vendido fue capturado diferente al inventario, puedes elegir una ubicacion con stock en otro color registrado. El sistema lo dejara trazado.
               </div>`
            : '';

        return `
        <tr>
            <td style="padding:8px; border-bottom:1px solid #f3f4f6;">
                <strong>${i.nombre || ''}</strong>
                ${i.colorElegido ? `<br><small style="color:#64748b;">Color: ${i.colorElegido}</small>` : ''}
                <br>
                <label style="font-size:11px; color:#475569; display:block; margin-top:6px;">Ubicacion de salida</label>
                <select id="entregaUbi-${s.id}-${index}" style="width:100%; max-width:230px; padding:6px; border:1px solid #cbd5e1; border-radius:6px; background:white;">
                    ${opcionesUbicacion}
                </select>
                ${avisoColorFlexible}
            </td>
            <td style="padding:8px; text-align:center; border-bottom:1px solid #f3f4f6; color:#b91c1c; font-weight:bold;">
                ${i.cantidad}
            </td>
            <td style="padding:8px; text-align:center; border-bottom:1px solid #f3f4f6;">
                <input type="number" id="entregar-${s.id}-${index}" min="0" max="${i.cantidad}" value="${i.cantidad}" 
                    style="width:60px; padding:6px; text-align:center; border:2px solid #3b82f6; border-radius:6px; font-weight:bold;">
            </td>
        </tr>`;
    }).join('');

    const modalHTML = `
        <div data-modal="detalle-entrega" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0; color:#1e3a8a;">aa Gestión de Entrega</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-entrega&quot;]')?.remove();" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280;">S"</button>
                </div>
                
                <div style="display:grid; gap:8px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px; border: 1px solid #e2e8f0; font-size:13px;">
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Folio:</span><strong>${s.folioVenta}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Cliente:</span><strong>${s.clienteNombre || ''}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Dirección:</span><span>${direccion}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Teléfono:</span><span>${telefono}</span></div>
                </div>

                <div style="background:#fffbeb; color:#92400e; padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px; border:1px solid #fcd34d;">
                    <strong>Entregas Parciales:</strong> Modifica la cantidad en la columna "A entregar hoy". Si el cliente se lleva solo una parte, el resto seguirá quedando pendiente en el sistema.
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:20px;">
                    <thead><tr style="background:#f1f5f9;">
                        <th style="padding:10px; text-align:left;">Producto</th>
                        <th style="padding:10px; text-align:center;">Pendiente</th>
                        <th style="padding:10px; text-align:center; color:#1d4ed8;">A entregar hoy</th>
                    </tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <div style="display:grid; gap:10px; margin-bottom:18px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                    <div>
                        <label style="font-size:11px; font-weight:bold; color:#475569;">RECIBE MERCANCÍA</label>
                        <input id="entregaReceptor-${s.id}" type="text" value="${_escapeHtml(s.clienteNombre || '')}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:bold; color:#475569;">IDENTIFICACIN / REFERENCIA</label>
                        <input id="entregaIdentificacion-${s.id}" type="text" placeholder="INE, familiar autorizado, teléfono, etc." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:bold; color:#475569;">OBSERVACIONES DE ENTREGA</label>
                        <textarea id="entregaObservaciones-${s.id}" placeholder="Sin observaciones" style="width:100%; min-height:58px; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;"></textarea>
                    </div>
                </div>
                
                <div style="display:flex; gap:10px;">
                    <button onclick="aplicarSalidaPendienteVentas('${s.id}')"
                            style="flex:2; padding:14px; background:#27ae60; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;">
                        Registrar Entrega e Imprimir Vale
                    </button>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-entrega&quot;]')?.remove();"
                            style="flex:1; padding:14px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; cursor:pointer; font-weight:bold;">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function aplicarSalidaPendienteVentas(idSalida) {
    let salidas = StorageService.get("salidasPendientesVenta", []);
    const idx = salidas.findIndex(s => String(s.id) === String(idSalida));
    if (idx === -1) return;

    const s = salidas[idx];
    const productosActuales = StorageService.get("productos", []);
    
    // ========================================================
    // 1. VALIDACIN DE STOCK (Revisar antes de descontar)
    // ========================================================
    let validacionPasada = true;
    let mensajeError = "";
    let advertenciasColor = [];

    (s.items || []).forEach((item, index) => {
        const inputEl = document.getElementById(`entregar-${s.id}-${index}`);
        let cantAEntregar = inputEl ? parseInt(inputEl.value) : 0;
        
        if (cantAEntregar > 0) {
            if (cantAEntregar > Number(item.cantidad || 0)) {
                validacionPasada = false;
                mensajeError = `La cantidad a entregar de ${item.nombre} excede lo pendiente.`;
                return;
            }
            const prod = productosActuales.find(p => String(p.id) === String(item.productoId));
            const ubicacionSeleccionada = document.getElementById(`entregaUbi-${s.id}-${index}`)?.value || '';
            if (!prod) {
                validacionPasada = false;
                mensajeError = `Error: Producto no encontrado en el inventario: ${item.nombre}`;
            } else {
                const validacionOrigen = _validarOrigenEntregaVenta(prod, { ...item, cantidad: cantAEntregar }, {
                    color: item.colorElegido || '',
                    ubicacion: ubicacionSeleccionada
                });
                if (!validacionOrigen.ok) {
                    validacionPasada = false;
                    mensajeError = validacionOrigen.mensaje;
                } else if (validacionOrigen.requiereAjusteColor) {
                    advertenciasColor.push(validacionOrigen.mensaje);
                }
            }
            if (validacionPasada && (prod.stock || 0) < cantAEntregar) {
                validacionPasada = false;
                mensajeError = `STOCK INSUFICIENTE para: ${item.nombre}\n\n- Cantidad solicitada: ${cantAEntregar}\n- Piezas disponibles: ${prod.stock || 0}\n\nPor favor ajusta la cantidad a entregar.`;
            }
        }
    });

    if (!validacionPasada) return alert(mensajeError);
    if (advertenciasColor.length > 0) {
        const mensajesUnicos = [...new Set(advertenciasColor)];
        if (!confirm(`${mensajesUnicos.join('\n\n')}\n\nDeseas continuar con la entrega?`)) return;
    }

    // ========================================================
    // 2. DESCONTAR INVENTARIO Y AFECTAR KARDEX
    // ========================================================
    let entregadosHoy = [];
    let quedanPendientes = false;

    (s.items || []).forEach((item, index) => {
        const inputEl = document.getElementById(`entregar-${s.id}-${index}`);
        let cantAEntregar = inputEl ? parseInt(inputEl.value) : 0;
        
        if (cantAEntregar > 0) {
            const prod = productosActuales.find(p => String(p.id) === String(item.productoId));
            const ubicacionSeleccionada = document.getElementById(`entregaUbi-${s.id}-${index}`)?.value || '';
            if (prod) {
                const salidaOk = _descontarInventarioDesdeOrigenVenta(prod, cantAEntregar, item.colorElegido || '', ubicacionSeleccionada);
                if (!salidaOk) return;
                const metaSalida = window._ultimaSalidaInventarioVenta || {};
                const coloresFisicos = (metaSalida.coloresFisicos || [])
                    .map(x => `${x.color} x${x.cantidad}`)
                    .join(', ');
                const notaColor = metaSalida.requiereAjusteColor && coloresFisicos
                    ? ` | color fisico descontado: ${coloresFisicos}; color vendido: ${item.colorElegido || '-'}`
                    : '';
                
                // Afectar el Kardex
                if (typeof window.registrarMovimiento === 'function') {
                    window.registrarMovimiento(item.productoId, `Entrega diferida - Folio ${s.folioVenta} (${ubicacionSeleccionada})${notaColor}`, cantAEntregar, "salida");
                }

                entregadosHoy.push({
                    nombre: item.nombre,
                    colorElegido: item.colorElegido || '',
                    colorFisicoEntregado: coloresFisicos || '',
                    ubicacionElegida: ubicacionSeleccionada,
                    cantidad: cantAEntregar
                });
                item.ubicacionElegida = ubicacionSeleccionada;
                item.cantidad -= cantAEntregar;
            }
        }
        if (item.cantidad > 0) quedanPendientes = true;
    });

    if (entregadosHoy.length === 0) return alert("No indicaste ninguna cantidad para entregar.");

    // ========================================================
    // 3. ACTUALIZAR ESTADOS Y GUARDAR
    // ========================================================
    s.estatus = quedanPendientes ? "Parcial" : "Entregado";
    s.fechaUltimaEntrega = window.formatearFechaCortaMX(new Date());
    const receptorEntrega = document.getElementById(`entregaReceptor-${s.id}`)?.value || s.clienteNombre || "";
    const identificacionEntrega = document.getElementById(`entregaIdentificacion-${s.id}`)?.value || "";
    const observacionesEntrega = document.getElementById(`entregaObservaciones-${s.id}`)?.value || "";

    StorageService.set("salidasPendientesVenta", salidas);
    StorageService.set("productos", productosActuales);

    document.querySelector('[data-modal="detalle-entrega"]')?.remove();
    renderEntregas();

    // ========================================================
    // 4. EMITIR VALE DE ENTREGA (Solo lo entregado hoy)
    // ========================================================
    const datosParaVale = {
        cliente: {
            id: s.clienteId || null,
            nombre: s.clienteNombre || 'Público General',
            direccion: s.clienteDireccion || '',
            telefono: s.clienteTelefono || ''
        },
        folio: s.folioVenta || s.folioSalida,
        fecha: window.formatearFechaCortaMX(new Date()),
        metodoPago: s.metodoPago || "",
        estatusEntrega: quedanPendientes ? "Parcial" : "Total"
    };

    window.generarValeEntrega(datosParaVale, entregadosHoy, {
        origen: "salida_inventario_venta",
        registrar: true,
        estatusEntrega: quedanPendientes ? "Parcial" : "Total",
        receptorNombre: receptorEntrega,
        identificacionReceptor: identificacionEntrega,
        observaciones: observacionesEntrega
    });
}

// Función auxiliar para mantener limpio el historial

window.aplicarSalidaPendienteVentas = aplicarSalidaPendienteVentas;

function renderReimprimirVenta() {
    const contenedor = document.getElementById("contenidoReimprimirVenta");
    if (!contenedor) return;

    const folioFiltro = (document.getElementById("rvFolio")?.value || "").trim().toLowerCase();
    const clienteFiltro = (document.getElementById("rvCliente")?.value || "").trim().toLowerCase();
    const fechaDesde = document.getElementById("rvFechaDesde")?.value || "";
    const fechaHasta = document.getElementById("rvFechaHasta")?.value || "";
    const montoMin = parseFloat(document.getElementById("rvMontoMin")?.value) || 0;
    const montoMax = parseFloat(document.getElementById("rvMontoMax")?.value) || Infinity;

    const ventasNuevas = StorageService.get("ventasRegistradas", []);
    const ticketsViejos = StorageService.get("registroTickets", []);
    
    let registrosCombinados = [...ventasNuevas];
    
    // Concatenar registros históricos que no existan en la tabla nueva para preservar el pasado
    ticketsViejos.forEach(tv => {
        if (!registrosCombinados.find(v => v.folio === tv.folio)) {
            registrosCombinados.push({
                folio: tv.folio,
                fechaVenta: tv.fechaEmision,
                fecha: tv.fechaEmision ? window.formatearFechaCortaMX(tv.fechaEmision) : '',
                clienteNombre: tv.cliente?.nombre || '',
                total: tv.venta?.total || 0,
                metodoPago: tv.venta?.metodoPago || 'contado'
            });
        }
    });

    if (registrosCombinados.length === 0) {
        contenedor.innerHTML = `<div style="background:#fef3c7; padding:30px; border-radius:10px; text-align:center; color:#92400e;">
            <p style="font-size:16px;">No hay transacciones registradas en el sistema.</p>
        </div>`;
        return;
    }

    let filtrados = registrosCombinados.filter(t => {
        const nombreCliente = (t.clienteNombre || t.cliente?.nombre || "").toLowerCase();
        const folio = (t.folio || "").toLowerCase();
        const fe = t.fechaVenta || t.fechaIso || t.fechaEmision;
        const fecha = fe
            ? (typeof fe === 'number'
                ? window.localISO(new Date(fe)).substring(0, 10)
                : String(fe).substring(0, 10))
            : "";
        const total = t.total || t.venta?.total || 0;

        if (folioFiltro && !folio.includes(folioFiltro)) return false;
        if (clienteFiltro && !nombreCliente.includes(clienteFiltro)) return false;
        if (fechaDesde && fecha < fechaDesde) return false;
        if (fechaHasta && fecha > fechaHasta) return false;
        if (total < montoMin) return false;
        if (montoMax !== Infinity && total > montoMax) return false;
        return true;
    }).sort((a, b) => new Date(a.fechaVenta || a.fechaIso || a.fechaEmision || 0) - new Date(b.fechaVenta || b.fechaIso || b.fechaEmision || 0));

    const foliosUnicos = new Set();
    filtrados = filtrados.filter(t => {
        if (foliosUnicos.has(t.folio)) return false;
        foliosUnicos.add(t.folio);
        return true;
    });

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<div style="background:#f3f4f6; padding:30px; border-radius:10px; text-align:center; color:#6b7280;">
            <p style="font-size:16px;">Sin resultados para los filtros aplicados.</p>
        </div>`;
        return;
    }

    let html = `<div style="overflow-x:auto;"><table class="tabla-admin">
        <thead><tr>
            <th>Folio</th>
            <th>Cliente</th>
            <th>Fecha</th>
            <th>Total</th>
            <th>Método</th>
            <th style="text-align:center;">Acciones</th>
        </tr></thead>
        <tbody>`;

    filtrados.forEach(t => {
        const fecha = t.fechaVenta ? window.formatearFechaCortaMX(t.fechaVenta) : (t.fecha || '');
        const total = t.total || t.venta?.total || 0;
        const metodo = t.metodoPago || t.venta?.metodoPago || '';
        const folioEsc = (t.folio || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += `<tr>
            <td><strong style="color:#1d4ed8;">${t.folio || ''}</strong></td>
            <td>${t.clienteNombre || t.cliente?.nombre || ''}</td>
            <td>${fecha}</td>
            <td><strong>${dinero(total)}</strong></td>
            <td style="text-transform: uppercase;">${metodo}</td>
            <td style="text-align:center;">
                <button onclick="reimprimirTicketVenta('${folioEsc}')"
                        style="padding:6px 12px; background:#2563eb; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold;">
                    Reimprimir
                </button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

function reimprimirTicketVenta(folio) {
    const ventas = StorageService.get("ventasRegistradas", []);
    let ticket = ventas.find(t => t.folio === folio);

    let datosVenta;

    if (ticket) {
        // Re-mapeo del plan y la periodicidad desde CxC en caso de ventas históricas sin datos cruzados
        if (ticket.metodoPago === 'credito' && !ticket.plan) {
            const cxc = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === ticket.folio);
            if (cxc) {
                ticket.plan = cxc.plan;
                ticket.periodicidad = cxc.periodicidad;
                ticket.cliente = ticket.cliente || { nombre: cxc.nombre, direccion: cxc.direccion, telefono: cxc.telefono };
            }
        }

        datosVenta = {
            folio: ticket.folio,
            fecha: ticket.fecha || window.formatearFechaCortaMX(new Date(ticket.fechaVenta || Date.now())),
            fechaIso: ticket.fechaVenta || ticket.fechaIso || window.localISO(new Date()),
            cliente: ticket.cliente || { nombre: ticket.clienteNombre || 'Público General' },
            metodo: ticket.metodoPago || 'contado',
            total: ticket.total || 0,
            enganche: ticket.enganche || 0,
            saldoPendiente: ticket.saldoAFinanciar || 0,
            plan: ticket.plan || null,
            articulos: ticket.articulos || [],
            periodicidad: ticket.periodicidad || 'semanal',
            apartadoFechaCompromiso: ticket.apartadoFechaCompromiso || null,
            apartadoCondiciones: ticket.apartadoCondiciones || null
        };
    } else {
        // Fallback: Si la venta es muy antigua y no está en la tabla nueva, lee el nodo histórico para no quebrar el pasado
        const registrosViejos = StorageService.get("registroTickets", []);
        const ticketViejo = registrosViejos.find(t => t.folio === folio);
        
        if (!ticketViejo) {
            alert(`No se encontró el ticket con folio: ${folio}`);
            return;
        }
        
        datosVenta = {
            folio: ticketViejo.folio,
            fecha: ticketViejo.fechaEmision ? window.formatearFechaCortaMX(typeof ticketViejo.fechaEmision === 'number' ? new Date(ticketViejo.fechaEmision) : ticketViejo.fechaEmision) : window.formatearFechaCortaMX(new Date()),
            fechaIso: typeof ticketViejo.fechaEmision === 'number' ? window.localISO(new Date(ticketViejo.fechaEmision)) : ticketViejo.fechaEmision,
            cliente: ticketViejo.cliente || {},
            metodo: ticketViejo.venta?.metodoPago || 'contado',
            total: ticketViejo.venta?.total || 0,
            enganche: ticketViejo.venta?.enganche || 0,
            saldoPendiente: ticketViejo.venta?.saldoPendiente || 0,
            plan: ticketViejo.venta?.plan || null,
            articulos: ticketViejo.venta?.articulos || [],
            periodicidad: ticketViejo.venta?.periodicidad || 'semanal',
            apartadoFechaCompromiso: ticketViejo.venta?.apartadoFechaCompromiso || null,
            apartadoCondiciones: ticketViejo.venta?.apartadoCondiciones || null
        };
    }

    generarTicketMediaHoja(datosVenta);
}

function limpiarFiltrosReimpresion() {
    ['rvFolio','rvCliente','rvFechaDesde','rvFechaHasta','rvMontoMin','rvMontoMax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const tipoDoc = document.getElementById('rvTipoDoc');
    if (tipoDoc) tipoDoc.value = 'todos';
    renderReimprimirVenta();
}

// =====================================================================
// MDULO DE AUDITORÍA CXC (MODIFICACIN DE VENTAS Y PAGAR0S)
// SOLO ADMINISTRADORES
// =====================================================================

function abrirAuditoriaCxC() {
    const usuarioActual = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
    
    if (usuarioActual?.rol !== "admin" && usuarioActual?.rol !== "Administrador") {
        if (window.AuditService?.log) {
            window.AuditService.log({ accion: 'ACCESO_DENEGADO', modulo: 'Seguridad', entidad: 'Auditoria CxC', detalle: 'Intento de modificar ventas CxC sin rol admin', severidad: 'alerta' });
        }
        alert(": ACCESO DENEGADO: Esta función es exclusiva para Administradores.");
        return;
    }

    const modalHTML = `
    <div data-modal="auditoria-cxc" style="position:fixed; inset:0; background:rgba(15,23,42,0.9); z-index:9999; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:12px; width:100%; max-width:900px; margin-top:20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #ef4444; padding-bottom:15px; margin-bottom:20px;">
                <div>
                    <h2 style="margin:0; color:#b91c1c; font-size:24px;">Auditoría CxC: Edición de Ventas</h2>
                    <p style="margin:0; color:#64748b; font-size:14px;">Modificación profunda de fechas y pagarés con impacto en Caja</p>
                </div>
                <button onclick="document.querySelector('[data-modal=\\'auditoria-cxc\\']').remove()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; color:#475569;">S" Cerrar</button>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:25px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <input type="text" id="auditFolioInput" placeholder="Ej. V-123456" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:16px;">
                <button id="btnHiddenBuscarAudit" onclick="buscarVentaAuditoria()" style="display:none;"></button>
                <button onclick="abrirBuscadorVentasCxC('auditFolioInput')" style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">Buscar Venta</button>
            </div>

            <div id="auditContenedorDatos">
                <div style="text-align:center; padding:40px; color:#94a3b8;">Haz clic en "Buscar Venta" para seleccionar un cliente o folio.</div>
            </div>

        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function buscarVentaAuditoria() {
    const folio = document.getElementById("auditFolioInput").value.trim().toUpperCase();
    if (!folio) return alert("Por favor ingresa un folio.");

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);

    const cuenta = cuentas.find(c => String(c.folio).toUpperCase() === folio);
    if (!cuenta) {
        document.getElementById("auditContenedorDatos").innerHTML = `<div style="padding:20px; background:#fef2f2; color:#b91c1c; border-radius:8px; border:1px solid #fecaca;">No se encontró ninguna cuenta con el folio: ${folio}</div>`;
        return;
    }

    // Buscar pagarés asociados al folio o al clienteId si no tienen folio explícito
    let pagaresVenta = pagares.filter(p => String(p.folio).toUpperCase() === folio);
    
    // Ordenar pagarés por fecha
    pagaresVenta.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

    // Guardar temporalmente en memoria para poder agregar/quitar antes de guardar definitivamente
    window._auditCuentaActual = JSON.parse(JSON.stringify(cuenta));
    window._auditPagaresActuales = JSON.parse(JSON.stringify(pagaresVenta));

    dibujarFormularioAuditoria();
}

function _auditFechaAbonoBase(abono) {
    return abono?.fechaAbonoIso || abono?.fechaIso || abono?.fechaAbonoRaw || abono?.fechaAbono || abono?.fecha;
}

function _auditFechaCorta(valor) {
    if (!valor) return '-';
    const d = window.parseFechaMX ? window.parseFechaMX(valor) : new Date(valor);
    if (!d || isNaN(d.getTime())) return String(valor);
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const anio = d.getFullYear();
    return `${dia}-${mes}-${anio}`;
}

function dibujarFormularioAuditoria() {
    const cuenta = window._auditCuentaActual;
    const pagares = window._auditPagaresActuales;

    let fechaVentaDate = "";
    if(cuenta.fechaVenta) {
        try { fechaVentaDate = window.getFechaLocalMX ? window.getFechaLocalMX(cuenta.fechaVenta) : cuenta.fechaVenta.split('T')[0]; } catch(e) {}
    }

    const engancheActual = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
    const movEngancheAudit = (typeof _cxcMovimientoEngancheFolio === 'function') ? _cxcMovimientoEngancheFolio(cuenta.folio) : null;
    const etiquetaEngancheAudit = movEngancheAudit?.etiquetaCuenta || movEngancheAudit?.cuenta || 'Efectivo';

    let pagaresHTML = pagares.map((p, index) => {
        let fechaVencDate = "";
        if(p.fechaVencimiento) {
            try { fechaVencDate = window.getFechaLocalMX ? window.getFechaLocalMX(p.fechaVencimiento) : new Date(p.fechaVencimiento).toISOString().split('T')[0]; } catch(e) {}
        }

        return `
        <tr style="background:${p.estado === 'Pagado' ? '#f0fdf4' : '#fff'}; border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px;"><input type="text" value="${p.numeroPagere || ''}" onchange="window._auditPagaresActuales[${index}].numeroPagere = this.value" style="width:100px; padding:6px; border:1px solid #cbd5e1; border-radius:4px;"></td>
            <td style="padding:8px;"><input type="date" value="${fechaVencDate}" onchange="window._auditPagaresActuales[${index}].fechaVencimiento = window.localISO ? window.localISO(this.value + 'T12:00:00') : new Date(this.value + 'T12:00:00').toISOString()" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px;"></td>
            <td style="padding:8px;"><input type="number" step="0.01" value="${p.monto || 0}" onchange="window._auditPagaresActuales[${index}].monto = Number(this.value)" style="width:100px; padding:6px; border:1px solid #cbd5e1; border-radius:4px;"></td>
            <td style="padding:8px;">
                <select id="auditSelEstatus_${index}" onchange="auditarCambioPagareEnMemoria(${index}, this.value, '${p.estado}')" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px; font-weight:bold; color:${p.estado==='Pagado'?'#16a34a':p.estado==='Pendiente'?'#d97706':'#dc2626'};">
                    <option value="Pendiente" ${p.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Pagado" ${p.estado === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    <option value="Cancelado" ${p.estado === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td style="padding:8px; text-align:center;">
                <button onclick="eliminarPagareAuditoria(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar Pagaré"></button>
            </td>
        </tr>`;
    }).join('');

    const abonosActivos = (cuenta.abonos || [])
        .map((ab, originalIndex) => ({ ab, originalIndex }))
        .filter(x => !x.ab.cancelado && !x.ab.canceladoPorVenta && !x.ab.canceladoPorApartado);
    const totalAbonosAudit = abonosActivos.reduce((s, x) => s + Number(x.ab.monto || x.ab.montoAbonado || 0), 0);
    const abonosHTML = abonosActivos.map(({ ab, originalIndex }, idx) => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px; color:#64748b;">${idx + 1}</td>
            <td style="padding:8px;">${_auditFechaCorta(_auditFechaAbonoBase(ab))}</td>
            <td style="padding:8px; font-weight:bold; color:#15803d;">${dinero(Number(ab.monto || ab.montoAbonado || 0))}</td>
            <td style="padding:8px; font-size:12px; color:#475569;">${_escapeHtml(ab.etiquetaCuenta || ab.medioPago || ab.cuentaId || 'Efectivo')}</td>
            <td style="padding:8px; text-align:right;">
                <button onclick="if (typeof abrirEditorAbono === 'function') abrirEditorAbono('${cuenta.folio}', ${originalIndex}); else alert('Editor de abonos no disponible.');"
                    style="background:#1e40af; color:white; border:none; padding:7px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">Corregir</button>
                <button onclick="if (typeof eliminarAbonoAuditoriaCxC === 'function') eliminarAbonoAuditoriaCxC('${cuenta.folio}', ${originalIndex}); else alert('Eliminador de abonos no disponible.');"
                    style="background:#b91c1c; color:white; border:none; padding:7px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px; margin-left:5px;">Eliminar</button>
            </td>
        </tr>
    `).join('');

    const html = `
    <div style="background:#f8fafc; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;">
        <h3 style="margin-top:0; color:#334155; font-size:16px;">Datos Generales de la Cuenta</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
            <div>
                <label style="display:block; font-size:12px; color:#64748b; font-weight:bold; margin-bottom:4px;">Cliente</label>
                <input type="text" value="${cuenta.nombre || cuenta.cliente || ''}" disabled style="width:100%; padding:8px; background:#e2e8f0; border:1px solid #cbd5e1; border-radius:4px;">
            </div>
            <div>
                <label style="display:block; font-size:12px; color:#64748b; font-weight:bold; margin-bottom:4px;">Fecha de Venta</label>
                <input type="date" id="auditFechaVenta" value="${fechaVentaDate}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; background:#fffbdd; border-color:#fde047;">
                <small style="color:#d97706;">* Modificar esta fecha afecta el cálculo de antiguedad.</small>
            </div>
        </div>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; border:1px solid #bbf7d0; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:14px;">
            <div>
                <h3 style="margin:0; color:#166534; font-size:16px;">Enganche recibido</h3>
                <p style="margin:4px 0 0; color:#64748b; font-size:12px;">Corrige importe o cuenta receptora, o elimínalo por completo. Al guardar se recalculan saldo CxC y caja/banco.</p>
            </div>
            ${engancheActual > 0 ? `
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="text-align:right;">
                    <div style="font-size:18px; font-weight:bold; color:#15803d;">${dinero(engancheActual)}</div>
                    <div style="font-size:11px; color:#475569;">${_escapeHtml(etiquetaEngancheAudit)}</div>
                </div>
                <button onclick="if (typeof abrirEditorEnganche === 'function') abrirEditorEnganche('${cuenta.folio}'); else alert('Editor de enganche no disponible.');"
                    style="background:#1e40af; color:white; border:none; padding:9px 14px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">Corregir</button>
            </div>` : `<div style="color:#94a3b8; font-size:13px;">Esta venta no registró enganche.</div>`}
        </div>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; border:1px solid #bae6fd; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:14px; margin-bottom:15px;">
            <div>
                <h3 style="margin:0; color:#075985; font-size:16px;">Abonos registrados</h3>
                <p style="margin:4px 0 0; color:#64748b; font-size:12px;">Corrige fecha, importe o cuenta receptora. Al guardar se recalculan caja/banco, saldo CxC, pagarés y flujo de caja.</p>
            </div>
            <div style="background:#ecfdf5; border:1px solid #bbf7d0; color:#166534; padding:9px 12px; border-radius:8px; text-align:right;">
                <div style="font-size:10px; font-weight:bold;">TOTAL ABONADO</div>
                <strong>${dinero(totalAbonosAudit)}</strong>
            </div>
        </div>
        <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
                <tr style="background:#f0f9ff; color:#075985; font-size:12px;">
                    <th style="padding:9px; border-bottom:2px solid #bae6fd;">#</th>
                    <th style="padding:9px; border-bottom:2px solid #bae6fd;">Fecha</th>
                    <th style="padding:9px; border-bottom:2px solid #bae6fd;">Importe</th>
                    <th style="padding:9px; border-bottom:2px solid #bae6fd;">Cuenta</th>
                    <th style="padding:9px; border-bottom:2px solid #bae6fd; text-align:right;">Accion</th>
                </tr>
            </thead>
            <tbody>
                ${abonosHTML || '<tr><td colspan="5" style="text-align:center; padding:15px; color:#94a3b8;">Esta venta no tiene abonos registrados.</td></tr>'}
            </tbody>
        </table>
    </div>

    <div style="background:#fff; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; color:#334155; font-size:16px;">Tabla de Amortización (Pagarés)</h3>
            <button onclick="agregarPagareAuditoria()" style="background:#10b981; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold;">+ Nuevo Pagaré</button>
        </div>
        
        <table style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
                <tr style="background:#f1f5f9; color:#475569; font-size:13px;">
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1;">N° Pagaré</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1;">Fecha Vencimiento</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1;">Monto ($)</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1;">Estado</th>
                    <th style="padding:10px; border-bottom:2px solid #cbd5e1; text-align:center;">Acción</th>
                </tr>
            </thead>
            <tbody>
                ${pagaresHTML || '<tr><td colspan="5" style="text-align:center; padding:15px; color:#94a3b8;">No hay pagarés. Haz clic en "+ Nuevo Pagaré" para agregar.</td></tr>'}
            </tbody>
        </table>
    </div>

    <div style="margin-top:25px; text-align:right;">
        <button onclick="guardarAuditoriaDefinitiva()" style="background:#b91c1c; color:white; border:none; padding:12px 25px; border-radius:8px; font-size:16px; font-weight:bold; cursor:pointer; box-shadow:0 4px 6px rgba(220, 38, 38, 0.2);">
            Guardar Cambios en Base de Datos
        </button>
    </div>
    `;

    document.getElementById("auditContenedorDatos").innerHTML = html;
}

function agregarPagareAuditoria() {
    const cuenta = window._auditCuentaActual;
    const nuevoIndex = window._auditPagaresActuales.length + 1;
    
    // Crear un pagaré vacío asociado a la cuenta actual
    window._auditPagaresActuales.push({
        id: Date.now() + Math.floor(Math.random() * 1000), // Generar ID único
        folio: cuenta.folio,
        clienteId: cuenta.clienteId || cuenta.id,
        numeroPagere: `${cuenta.folio}-${nuevoIndex}/${nuevoIndex}`,
        fechaVencimiento: window.localISO(new Date()),
        monto: 0,
        estado: "Pendiente"
    });
    
    dibujarFormularioAuditoria();
}

function eliminarPagareAuditoria(index) {
    if(!confirm("¿Estás seguro de eliminar este pagaré? Esta acción no se puede deshacer si guardas los cambios.")) return;
    window._auditPagaresActuales.splice(index, 1);
    dibujarFormularioAuditoria();
}

function guardarAuditoriaDefinitiva() {
    if(!confirm("ADVERTENCIA: Estás a punto de reescribir los datos de esta venta y sus pagarés. ¿Continuar?")) return;

    const folio = window._auditCuentaActual.folio;
    
    let cuentas = StorageService.get("cuentasPorCobrar", []);
    let pagaresSistema = StorageService.get("pagaresSistema", []);

    // 1. RECALCULAR EL SALDO Y ESTADO DE LA CUENTA
    let saldoPendienteReal = window._auditPagaresActuales.reduce((sum, p) => {
        if (p.estado === 'Pendiente') return sum + Number(p.monto || 0);
        if (p.estado === 'Parcial') return sum + Math.max(0, Number(p.monto || 0) - Number(p.montoAbonado || 0));
        return sum;
    }, 0);

    const indexCuenta = cuentas.findIndex(c => String(c.folio).toUpperCase() === String(folio).toUpperCase());
    if(indexCuenta !== -1) {
        const nuevaFechaVenta = document.getElementById("auditFechaVenta").value;
        if(nuevaFechaVenta) {
            cuentas[indexCuenta].fechaVenta = window.localISO ? window.localISO(nuevaFechaVenta + "T12:00:00") : new Date(nuevaFechaVenta + "T12:00:00").toISOString();
        }
        cuentas[indexCuenta].saldoActual = saldoPendienteReal;
        if (saldoPendienteReal <= 0.01) {
            cuentas[indexCuenta].estado = "Saldado";
        } else if (cuentas[indexCuenta].estado === "Saldado") {
            cuentas[indexCuenta].estado = "Pendiente"; // Revivir si le agregaron deuda
        }
    }

    // 2. REESCRIBIR PAGAR0S
    pagaresSistema = pagaresSistema.filter(p => String(p.folio).toUpperCase() !== String(folio).toUpperCase());
    pagaresSistema = pagaresSistema.concat(window._auditPagaresActuales);

    StorageService.set("cuentasPorCobrar", cuentas);
    StorageService.set("pagaresSistema", pagaresSistema);

    alert("Cambios de auditoría guardados exitosamente. El Estado de Cuenta ha sido actualizado.");
    
    document.querySelector('[data-modal="auditoria-cxc"]').remove();
    if(typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
}
// ===== GENERADOR DE DOCUMENTO DE ENTREGA (SOLO CON SALIDA REAL DE INVENTARIO) =====
function generarValeEntrega(datosVenta, articulosAEntregar, opciones = {}) {
    if (!articulosAEntregar || articulosAEntregar.length === 0) {
        alert("No hay mercancía para documentar en esta entrega.");
        return null;
    }

    const folioVenta = datosVenta.folio || datosVenta.folioVenta || datosVenta.folioSalida || "S/F";
    const fechaIso = opciones.fechaIso || datosVenta.fechaIso || window.localISO?.(new Date()) || new Date().toISOString();
    const fechaEntrega = opciones.fechaEntrega || datosVenta.fecha || (window.formatearFechaMX ? window.formatearFechaMX(new Date(fechaIso)) : new Date(fechaIso).toLocaleString("es-MX"));
    const folioDocumento = opciones.folioDocumento || datosVenta.folioDocumento || (window.generarFolioSistema ? window.generarFolioSistema("ENT") : `ENT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const cliente = datosVenta.cliente || {};
    const receptorNombre = opciones.receptorNombre || datosVenta.receptorNombre || cliente.nombre || "";
    const identificacionReceptor = opciones.identificacionReceptor || datosVenta.identificacionReceptor || "";
    const observaciones = opciones.observaciones || datosVenta.observaciones || "";
    const entregadoPor = opciones.entregadoPor || datosVenta.entregadoPor || window._vendedorSeleccionado?.nombre || "";
    const estatusEntrega = opciones.estatusEntrega || datosVenta.estatusEntrega || "Entrega";

    const articulosDoc = articulosAEntregar.map(art => ({
        productoId: art.productoId || art.id || null,
        nombre: art.nombre || "Producto",
        colorElegido: art.colorElegido || art.color || "",
        ubicacionElegida: art.ubicacionElegida || art.ubicacion || "",
        cantidad: Number(art.cantidad || 1)
    }));

    const documento = {
        id: opciones.id || Date.now(),
        tipoDocumento: "entrega_mcia",
        origen: opciones.origen || "salida_inventario_venta",
        folioDocumento,
        folioVenta,
        fechaEmision: fechaIso,
        fecha: fechaEntrega,
        cliente: {
            id: cliente.id || datosVenta.clienteId || null,
            nombre: cliente.nombre || datosVenta.clienteNombre || "Público General",
            telefono: cliente.telefono || datosVenta.clienteTelefono || "",
            direccion: cliente.direccion || datosVenta.clienteDireccion || "Entrega en tienda"
        },
        metodoPago: datosVenta.metodoPago || datosVenta.metodo || "",
        estatusEntrega,
        receptorNombre,
        identificacionReceptor,
        observaciones,
        entregadoPor,
        articulos: articulosDoc
    };

    if (opciones.registrar !== false) {
        const documentos = StorageService.get("documentosEntrega", []);
        const idx = documentos.findIndex(d => d.folioDocumento === documento.folioDocumento);
        if (idx >= 0) documentos[idx] = documento;
        else documentos.push(documento);
        StorageService.set("documentosEntrega", documentos);
    }

    let listaEntregada = '';
    articulosDoc.forEach(art => {
        listaEntregada += `
            <div style="border-bottom: 1px solid #eee; padding: 5px 0;">
                <div style="display:flex; justify-content:space-between; font-size: 13px;">
                    <span><b>${art.cantidad}x</b> ${_escapeHtml(art.nombre)}</span>
                </div>
                ${art.colorElegido ? `<small style="color:#555;">Color: ${_escapeHtml(art.colorElegido)}</small>` : ''}
                ${art.ubicacionElegida ? `<small style="color:#555; display:block;">Ubicación salida: ${_escapeHtml(art.ubicacionElegida)}</small>` : ''}
            </div>`;
    });

    const htmlVale = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
    <meta charset="UTF-8">
    <style>
        @page { size: 80mm auto; margin: 0; }
        body { 
            font-family: 'Courier New', monospace; 
            width: 72mm; margin: 4mm auto; color: #000; background: #fff;
            line-height: 1.3; font-size: 12px;
        }
        .centro { text-align: center; }
        .negrita { font-weight: bold; }
        .separador { border-top: 1px dashed #000; margin: 10px 0; }
        .caja-conformidad { border: 1px solid #000; padding: 8px; margin: 15px 0; font-size: 10px; text-align: justify; }
        .bloque { font-size: 10.5px; line-height: 1.35; }
        .no-print { background: #f0f0f0; padding: 10px; text-align: center; margin-bottom: 10px; }
        @media print { .no-print { display: none; } }
    </style>
    </head>
    <body>
        <div class="no-print">
            <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; cursor:pointer;">IMPRIMIR COMPROBANTE</button>
        </div>

        <div class="centro">
            <img src="img/Logo.svg" style="width:60px; height:60px; object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'></span>'">
            <div class="negrita" style="font-size:16px;">MI PUEBLITO</div>
            <div class="negrita">COMPROBANTE DE ENTREGA DE MERCANCÍA</div>
            <div style="font-size:10px;">Doc: ${_escapeHtml(folioDocumento)}</div>
            <div style="font-size:10px;">${_escapeHtml(fechaEntrega)}</div>
        </div>

        <div class="separador"></div>

        <div>
            <b>VENTA REF: ${_escapeHtml(folioVenta)}</b><br>
            TIPO: ${_escapeHtml(estatusEntrega)}<br>
            CLIENTE: ${_escapeHtml(documento.cliente.nombre)}<br>
            ${documento.cliente.telefono ? `TEL: ${_escapeHtml(documento.cliente.telefono)}<br>` : ''}
            DIRECCIN: ${_escapeHtml(documento.cliente.direccion)}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:11px;">MERCANCÍA QUE RECIBE:</div>
        <div style="margin-top:10px;">
            ${listaEntregada}
        </div>

        <div class="caja-conformidad">
            <b>DECLARACIN DE CONFORMIDAD:</b><br>
            Recibí de entera conformidad la mercancía arriba descrita. Manifiesto que fue revisada al momento de la entrega, que corresponde a la venta referida y que se entrega en condiciones físicas aceptadas. A partir de esta recepción asumo la custodia, uso y cuidado ordinario del mueble. Las garantías aplican conforme a política de tienda y no cubren mal uso, humedad, golpes, maniobras ajenas o traslados posteriores realizados por terceros.
        </div>

        <div class="bloque">
            <b>Receptor:</b> ${_escapeHtml(receptorNombre || "________________________")}<br>
            <b>Identificación:</b> ${_escapeHtml(identificacionReceptor || "________________________")}<br>
            <b>Entregó:</b> ${_escapeHtml(entregadoPor || "________________________")}<br>
            ${observaciones ? `<b>Observaciones:</b> ${_escapeHtml(observaciones)}<br>` : ''}
        </div>

        <div style="margin-top:40px; text-align:center;">
            <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto;"></div>
            <div class="negrita" style="font-size:10px; margin-top:5px;">FIRMA DEL CLIENTE</div>
            <div style="font-size:9px;">DNI/Identificación: ________________</div>
        </div>

        <div style="margin-top:30px; text-align:center;">
            <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto;"></div>
            <div style="font-size:9px; margin-top:5px;">ENTREGADO POR (Personal)</div>
        </div>

        <div class="centro" style="margin-top:30px; font-size:9px;">
            *** Documento generado únicamente por salida de inventario ***<br>
            Mueblería Mi Pueblito
        </div>
    </body>
    </html>`;

    if (window.TicketService?.openHtml) {
        window.TicketService.openHtml(htmlVale, { title: `Entrega ${documento.folioDocumento || folio}`, filename: `entrega_${documento.folioDocumento || folio}` });
        return documento;
    }
    const win = window.open('', '_blank');
    if (!win) {
        alert("El comprobante de entrega se registró, pero el navegador bloqueó la ventana emergente.");
        return documento;
    }
    win.document.write(htmlVale);
    win.document.close();
    win.focus();
    return documento;
}

// ============================================================
// MOTOR DE AUDITORÍA FINANCIERA Y BUSCADOR CXC
// ============================================================

window.abrirBuscadorVentasCxC = function(inputIdDestino) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    
    const filas = cuentas.map(c => {
        // Formateamos la fecha
        const fechaFmt = c.fechaVenta ? (window.formatearFechaCortaMX ? window.formatearFechaCortaMX(c.fechaVenta) : c.fechaVenta) : '-';
        
        // Creamos un resumen de los artículos vendidos
        const resumenArticulos = (c.articulos || []).map(a => a.nombre).join(', ');

        return `
        <tr style="border-bottom:1px solid #e5e7eb; cursor:pointer;" onclick="seleccionarFolioAuditoria('${c.folio}', '${inputIdDestino}')" class="fila-busqueda-audit">
            <td style="padding:12px; font-weight:bold; color:#1e40af;">${c.folio}</td>
            <td style="padding:12px;">
                <div style="font-weight:bold;">${c.nombre}</div>
                <div style="font-size:11px; color:#64748b;">${fechaFmt}</div>
            </td>
            <td style="padding:12px; max-width:250px;">
                <div style="font-size:12px; color:#4b5563; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${resumenArticulos}">
                    ${resumenArticulos || '<span style="color:#9ca3af; font-style:italic;">Sin detalle</span>'}
                </div>
            </td>
            <td style="padding:12px; text-align:right; font-weight:bold; color:#16a34a;">
                ${_cxcDinero(c.totalContadoOriginal)}
            </td>
        </tr>`;
    }).join('');

    const html = `
    <div data-modal="buscador-folios" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:flex-start; padding-top:50px; backdrop-filter:blur(4px);">
        <div style="background:white; padding:25px; border-radius:12px; width:100%; max-width:850px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="margin:0; color:#1e40af; font-size:20px;">Seleccionar Venta para Auditoría</h3>
                <button onclick="document.querySelector('[data-modal=\\'buscador-folios\\']').remove()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;">S"</button>
            </div>
            
            <input type="text" id="inputFiltroAudit" onkeyup="filtrarTablaAuditoria()" placeholder="} Escribe nombre, folio o artículo..." style="width:100%; padding:14px; border:2px solid #3b82f6; border-radius:8px; font-size:16px; margin-bottom:15px; box-sizing:border-box; outline:none; box-shadow:0 2px 4px rgba(59,130,246,0.1);">
            
            <div style="max-height:500px; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px;">
                <table style="width:100%; border-collapse:collapse; font-size:14px;">
                    <thead style="position:sticky; top:0; background:#f8fafc; z-index:2; box-shadow:0 1px 2px rgba(0,0,0,0.1);">
                        <tr>
                            <th style="padding:12px; text-align:left; color:#475569;">Folio</th>
                            <th style="padding:12px; text-align:left; color:#475569;">Cliente / Fecha</th>
                            <th style="padding:12px; text-align:left; color:#475569;">Artículos Vendidos</th>
                            <th style="padding:12px; text-align:right; color:#475569;">Importe</th>
                        </tr>
                    </thead>
                    <tbody id="tablaBuscadorAudit">
                        ${filas || '<tr><td colspan="4" style="text-align:center; padding:30px; color:#94a3b8;">No se encontraron cuentas registradas.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    setTimeout(() => document.getElementById('inputFiltroAudit').focus(), 100);
};

window.seleccionarFolioAuditoria = function(folio, inputIdDestino) {
    const input = document.getElementById(inputIdDestino);
    if(input) {
        input.value = folio;
        const btnOculto = document.getElementById('btnHiddenBuscarAudit');
        if(btnOculto) btnOculto.click();
    }
    document.querySelector('[data-modal="buscador-folios"]').remove();
};

window.filtrarTablaAuditoria = function() {
    const texto = document.getElementById('inputFiltroAudit').value.toLowerCase();
    const filas = document.querySelectorAll('.fila-busqueda-audit');
    filas.forEach(f => {
        const contenido = f.textContent.toLowerCase();
        f.style.display = contenido.includes(texto) ? '' : 'none';
    });
};

window.auditarCambioPagareEnMemoria = function(index, nuevoEstado, estadoAnterior) {
    const p = window._auditPagaresActuales[index];
    if (estadoAnterior === nuevoEstado) return;

    if ((estadoAnterior === "Pagado" || estadoAnterior === "Parcial") && (nuevoEstado === "Pendiente" || nuevoEstado === "Cancelado")) {
        const montoDevolver = p.montoAbonado || p.monto || 0;
        
        const html = `
        <div data-modal="auditoria-finanzas" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:25px; border-radius:12px; width:450px;">
                <h3 style="color:#dc2626; margin-top:0;">Reverso de Cobranza</h3>
                <p style="color:#4b5563; font-size:14px; margin-bottom:10px;">Estás cancelando el pago de <b>${_cxcDinero(montoDevolver)}</b> del pagaré <b>${p.numeroPagere || p.folio}</b>.</p>
                <p style="color:#dc2626; font-weight:bold; font-size:13px; margin-bottom:15px;">Este dinero se RESTARÁ de tu flujo de caja de inmediato.</p>
                
                <label style="display:block; margin-bottom:8px; font-size:12px; font-weight:bold; color:#374151;">¿DE QU0 CUENTA SE DESCUENTA ESTE DINERO?</label>
                ${window._buildSelectorCuentas ? window._buildSelectorCuentas('auditoriaCuentaSelect', false) : '<select id="auditoriaCuentaSelect" style="width:100%; padding:10px; border-radius:6px;"><option value="efectivo">Efectivo</option></select>'}
                
                <div style="display:flex; gap:10px; margin-top:25px;">
                    <button onclick="ejecutarCambioFinancieroEnMemoria(${index}, '${nuevoEstado}', ${montoDevolver}, 'egreso')" style="flex:2; padding:12px; background:#dc2626; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Confirmar Reverso</button>
                    <button onclick="cancelarAuditoriaCxC(${index}, '${estadoAnterior}')" style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
    else if ((estadoAnterior === "Pendiente" || estadoAnterior === "Cancelado") && nuevoEstado === "Pagado") {
        const montoCobrar = p.monto || 0;
        
        const html = `
        <div data-modal="auditoria-finanzas" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:25px; border-radius:12px; width:450px;">
                <h3 style="color:#059669; margin-top:0;">Ingreso de Cobranza</h3>
                <p style="color:#4b5563; font-size:14px; margin-bottom:10px;">Estás marcando como pagado el pagaré <b>${p.numeroPagere || p.folio}</b>.</p>
                <p style="color:#059669; font-weight:bold; font-size:13px; margin-bottom:15px;">Se SUMARÁN <b>${_cxcDinero(montoCobrar)}</b> a tu flujo de caja de inmediato.</p>
                
                <label style="display:block; margin-bottom:8px; font-size:12px; font-weight:bold; color:#374151;">¿A QU0 CUENTA INGRESA ESTE DINERO?</label>
                ${window._buildSelectorCuentas ? window._buildSelectorCuentas('auditoriaCuentaSelect', false) : '<select id="auditoriaCuentaSelect" style="width:100%; padding:10px; border-radius:6px;"><option value="efectivo">Efectivo</option></select>'}
                
                <div style="display:flex; gap:10px; margin-top:25px;">
                    <button onclick="ejecutarCambioFinancieroEnMemoria(${index}, '${nuevoEstado}', ${montoCobrar}, 'ingreso')" style="flex:2; padding:12px; background:#059669; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Confirmar Ingreso</button>
                    <button onclick="cancelarAuditoriaCxC(${index}, '${estadoAnterior}')" style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    }
    else {
        p.estado = nuevoEstado;
        dibujarFormularioAuditoria();
    }
};

window.ejecutarCambioFinancieroEnMemoria = function(index, nuevoEstado, monto, tipo) {
    const p = window._auditPagaresActuales[index];
    const selCuenta = document.getElementById("auditoriaCuentaSelect");
    const cuentaId = selCuenta ? selCuenta.value : 'efectivo';
    const etiquetaCuenta = selCuenta && selCuenta.selectedIndex >= 0 ? selCuenta.options[selCuenta.selectedIndex].text : 'Efectivo';

    if (tipo === 'egreso' && typeof window._egresarCuenta === 'function') {
        window._egresarCuenta({
            monto: monto, cuentaId: cuentaId, etiqueta: etiquetaCuenta,
            concepto: `Reverso por Auditoría - Pagaré ${p.numeroPagere || p.folio}`,
            referencia: `REV-AUDIT-${p.folio}`
        });
        p.montoAbonado = 0;
        p.fechaAbono = null;
    } 
    else if (tipo === 'ingreso' && typeof window._ingresarCuenta === 'function') {
        window._ingresarCuenta({
            monto: monto, cuentaId: cuentaId, etiqueta: etiquetaCuenta,
            concepto: `Cobro por Auditoría - Pagaré ${p.numeroPagere || p.folio}`,
            referencia: `COB-AUDIT-${p.folio}`
        });
        p.montoAbonado = monto;
        p.fechaAbono = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
    }

    p.estado = nuevoEstado;
    document.querySelector('[data-modal="auditoria-finanzas"]')?.remove();
    alert(`Operación financiera (${tipo.toUpperCase()}) aplicada a ${etiquetaCuenta}.\\n¡NO OLVIDES HACER CLIC EN "GUARDAR CAMBIOS" AL FINAL!`);
    dibujarFormularioAuditoria();
};

window.cancelarAuditoriaCxC = function(index, estadoAnterior) {
    document.querySelector('[data-modal="auditoria-finanzas"]')?.remove();
    window._auditPagaresActuales[index].estado = estadoAnterior;
    dibujarFormularioAuditoria();
};

// =====================================================================
// BUSCADOR UNIFICADO DE REIMPRESIN (CONTADO, CR0DITO Y APARTADOS)
// =====================================================================

window.renderReimprimirVenta = function() {
    const folioBuscado = document.getElementById('rvFolio').value.toLowerCase().trim();
    const clienteBuscado = document.getElementById('rvCliente').value.toLowerCase().trim();
    const fechaDesde = document.getElementById('rvFechaDesde').value;
    const fechaHasta = document.getElementById('rvFechaHasta').value;
    const montoMin = parseFloat(document.getElementById('rvMontoMin').value) || 0;
    const montoMax = parseFloat(document.getElementById('rvMontoMax').value) || Infinity;
    const tipoDoc = document.getElementById('rvTipoDoc')?.value || 'todos';
    const escJs = v => String(v ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    // 1. Extraer documentos reimprimibles.
    const ventas = StorageService.get("ventasRegistradas", [])
        .filter(v => !['credito', 'apartado'].includes(String(v.metodoPago || '').toLowerCase()))
        .map(v => ({...v, _origen: 'contado'}));
    const cuentasCxc = StorageService.get("cuentasPorCobrar", []);
    const apartadosBase = StorageService.get("apartados", []);
    const cxc = cuentasCxc.map(c => ({...c, _origen: 'credito'}));
    const apartados = apartadosBase.map(a => ({...a, _origen: 'apartado'}));
    const abonosCredito = cuentasCxc.flatMap(c => (c.abonos || [])
        .map((ab, index) => ({ ab, index }))
        .filter(({ ab }) => !ab.cancelado && !ab.canceladoPorVenta && !ab.canceladoPorApartado)
        .map(({ ab, index }, consecutivo) => ({
            ...ab,
            _origen: 'abono_credito',
            _reimpresionFolio: `${c.folio}||${index}`,
            folio: `ABONO-${c.folio}-${consecutivo + 1}`,
            folioVenta: c.folio,
            clienteNombre: c.nombre || c.clienteNombre || '',
            fecha: ab.fechaAbonoIso || ab.fechaAbono || ab.fecha || ab.fechaIso || '',
            total: Number(ab.monto || ab.montoAbonado || 0)
        })));
    const abonosApartado = apartadosBase.flatMap(a => (a.abonos || [])
        .map((ab, index) => ({ ab, index }))
        .filter(({ ab }) => !ab.cancelado && !ab.anulado)
        .map(({ ab, index }, consecutivo) => ({
            ...ab,
            _origen: 'abono_apartado',
            _reimpresionFolio: `${a.folio}||${index}`,
            folio: `ABONO-${a.folio}-${consecutivo + 1}`,
            folioVenta: a.folio,
            clienteNombre: a.clienteNombre || '',
            fecha: ab.fechaAbono || ab.fecha || ab.fechaAbonoIso || '',
            total: Number(ab.monto || ab.montoAbonado || 0)
        })));
    const entregas = StorageService.get("documentosEntrega", []).map(d => ({
        ...d,
        _origen: 'entrega_mcia',
        folio: d.folioDocumento,
        clienteNombre: d.cliente?.nombre || d.clienteNombre || '',
        fecha: d.fechaEmision || d.fecha,
        total: 0
    }));
    const devoluciones = StorageService.get("documentosCancelacion", []).map(d => ({
        ...d,
        _origen: 'devolucion_cancelacion',
        folio: d.folioDocumento,
        clienteNombre: d.clienteNombre || '',
        fecha: d.fechaEmision || d.fecha,
        total: d.monto || 0
    }));

    // 2. Unificar todo en una sola lista maestra
    let todo = [...ventas, ...cxc, ...apartados, ...abonosCredito, ...abonosApartado, ...entregas, ...devoluciones];

    // 3. Aplicar Filtros de Búsqueda
    let filtrados = todo.filter(item => {
        const folio = String(item.folio || '').toLowerCase();
        const folioVenta = String(item.folioVenta || '').toLowerCase();
        const cliente = String(item.cliente?.nombre || item.clienteNombre || item.nombre || '').toLowerCase();
        const fecha = String(item.fechaVenta || item.fechaApartado || item.fechaEmision || item.fecha || '');
        const total = item.total || item.totalContadoOriginal || item.importeApartado || 0;

        if (tipoDoc !== 'todos' && item._origen !== tipoDoc) return false;
        if (folioBuscado && !folio.includes(folioBuscado) && !folioVenta.includes(folioBuscado)) return false;
        if (clienteBuscado && !cliente.includes(clienteBuscado)) return false;
        if (fechaDesde && fecha.split('T')[0] < fechaDesde) return false;
        if (fechaHasta && fecha.split('T')[0] > fechaHasta) return false;
        if (total < montoMin) return false;
        if (montoMax !== Infinity && total > montoMax) return false;

        return true;
    });

    // 4. Ordenar de lo más reciente a lo más viejo
    filtrados.sort((a, b) => {
        const fa = new Date(a.fechaVenta || a.fechaApartado || a.fechaEmision || a.fecha || 0);
        const fb = new Date(b.fechaVenta || b.fechaApartado || b.fechaEmision || b.fecha || 0);
        return fa - fb;
    });

    // 5. Dibujar la Tabla
    const cont = document.getElementById('contenidoReimprimirVenta');
    if (filtrados.length === 0) {
        cont.innerHTML = '<div style="padding:20px; text-align:center; color:#6b7280; background:white; border-radius:8px;">No se encontraron registros con esos filtros en ninguna categoría.</div>';
        return;
    }

    const fmtDinero = (m) => '$' + Number(m || 0).toLocaleString('es-MX', {minimumFractionDigits:2});
    let html = '<table class="tabla-admin" style="width:100%;"><thead><tr><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Total</th><th style="text-align:center;">Acción</th></tr></thead><tbody>';
    
    filtrados.forEach(item => {
        const folio = item.folio || 'S/F';
        let fechaLimpia = String(item.fechaVenta || item.fechaApartado || item.fechaEmision || item.fecha || '');
        if(fechaLimpia.includes('T')) fechaLimpia = fechaLimpia.split('T')[0];
        
        const cliente = item.cliente?.nombre || item.clienteNombre || item.nombre || 'Desconocido';
        const total = item.total || item.totalContadoOriginal || item.importeApartado || 0;
        const etiquetas = { contado: 'CONTADO', credito: 'CR0DITO', apartado: 'APARTADO', abono_credito: 'ABONO CREDITO', abono_apartado: 'ABONO APARTADO', entrega_mcia: 'ENTREGA MCIA', devolucion_cancelacion: 'DEVOLUCION' };
        const tipo = etiquetas[item._origen] || item._origen.toUpperCase();
        
        let colorTipo = '#6b7280';
        if (item._origen === 'contado') colorTipo = '#16a34a'; // Verde
        if (item._origen === 'credito') colorTipo = '#2563eb'; // Azul
        if (item._origen === 'apartado') colorTipo = '#7c3aed'; // Morado
        if (item._origen === 'abono_credito' || item._origen === 'abono_apartado') colorTipo = '#0f766e'; // Teal
        if (item._origen === 'entrega_mcia') colorTipo = '#0f766e'; // Teal

        const tieneEnganche = (item._origen === 'credito' || item._origen === 'apartado');
        const folioReimpresion = item._reimpresionFolio || folio;
        const botonesAccion = `
            <button onclick="reimprimirConAutorizacion('${escJs(folioReimpresion)}', '${escJs(item._origen)}')"
                    style="background:#475569; color:white; border:none; padding:7px 11px; border-radius:6px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1); font-size:12px;">
                🖨️ Ticket
            </button>
            ${tieneEnganche ? `
            <button onclick="reimprimirConAutorizacion('${escJs(folio)}', 'enganche')"
                    style="background:#0f766e; color:white; border:none; padding:7px 11px; border-radius:6px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1); font-size:12px; margin-left:4px;">
                🖨️ Enganche
            </button>` : ''}`;

        html += `<tr>
            <td><strong>${folio}</strong>${item.folioVenta ? `<br><small style="color:#64748b;">Venta: ${item.folioVenta}</small>` : ''}</td>
            <td>${fechaLimpia}</td>
            <td>${cliente}</td>
            <td><span style="background:${colorTipo}; color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">${tipo}</span></td>
            <td>${fmtDinero(total)}</td>
            <td style="text-align:center;">${botonesAccion}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    cont.innerHTML = html;
};

window.limpiarFiltrosReimpresion = function() {
    document.getElementById('rvFolio').value = '';
    document.getElementById('rvCliente').value = '';
    document.getElementById('rvFechaDesde').value = '';
    document.getElementById('rvFechaHasta').value = '';
    document.getElementById('rvMontoMin').value = '';
    document.getElementById('rvMontoMax').value = '';
    const tipoDoc = document.getElementById('rvTipoDoc');
    if (tipoDoc) tipoDoc.value = 'todos';
    renderReimprimirVenta();
};

window.reimprimirFolioUnificado = function(folio, origen) {
    const parseAbonoKey = () => {
        const partes = String(folio || '').split('||');
        return { folioBase: partes[0] || '', index: Number(partes[1] || 0) };
    };

    if (origen === 'abono_credito') {
        const { folioBase, index } = parseAbonoKey();
        if (typeof window.reimprimirTicketAbono !== 'function') {
            return alert("No esta disponible la reimpresion de abonos de credito.");
        }
        window.reimprimirTicketAbono(folioBase, index);
        return;
    }

    if (origen === 'abono_apartado') {
        const { folioBase, index } = parseAbonoKey();
        const apartados = StorageService.get("apartados", []);
        const ap = apartados.find(a => a.folio === folioBase);
        if (!ap) return alert("No se encontro el apartado del abono.");
        const abono = (ap.abonos || [])[index];
        if (!abono) return alert("No se encontro el abono del apartado.");
        if (typeof window.imprimirTicketAbonoApartado !== 'function') {
            return alert("No esta disponible la reimpresion de abonos de apartado.");
        }
        window.imprimirTicketAbonoApartado(
            ap,
            Number(abono.monto || abono.montoAbonado || 0),
            abono.etiquetaCuenta || abono.cuentaId || 'Caja',
            abono.fechaAbono || abono.fecha || abono.fechaAbonoIso
        );
        return;
    }

    if (origen === 'devolucion_cancelacion') {
        const docs = StorageService.get("documentosCancelacion", []);
        const doc = docs.find(d => d.folioDocumento === folio);
        if (!doc) return alert("No se encontro el comprobante de devolucion.");
        generarComprobanteDevolucionCancelacion({
            tipo: doc.tipo,
            referencia: doc.referencia,
            clienteNombre: doc.clienteNombre,
            monto: doc.monto,
            cuenta: doc.cuenta,
            motivo: doc.motivo,
            folioDoc: doc.folioDocumento,
            fechaIso: doc.fechaEmision,
            registrar: false
        });
        return;
    }

    if (origen === 'entrega_mcia') {
        const docs = StorageService.get("documentosEntrega", []);
        const doc = docs.find(d => d.folioDocumento === folio);
        if (!doc) return alert("No se encontró el documento de entrega.");
        if (typeof generarValeEntrega === 'function') {
            generarValeEntrega(doc, doc.articulos || [], {
                registrar: false,
                id: doc.id,
                folioDocumento: doc.folioDocumento,
                fechaIso: doc.fechaEmision,
                fechaEntrega: doc.fecha,
                estatusEntrega: doc.estatusEntrega,
                receptorNombre: doc.receptorNombre,
                identificacionReceptor: doc.identificacionReceptor,
                observaciones: doc.observaciones,
                entregadoPor: doc.entregadoPor
            });
        }
        return;
    }

    if (origen === 'apartado') {
        const apartados = StorageService.get("apartados", []);
        const ap = apartados.find(a => a.folio === folio);
        if (!ap) return alert("No se encontró el apartado en la base de datos.");
        
        // Reconstruimos el paquete de datos para engañar y alimentar a tu generador de tickets térmicos
        const datosVenta = {
            folio: ap.folio,
            fecha: ap.fechaApartado,
            cliente: { nombre: ap.clienteNombre, id: ap.clienteId },
            articulos: ap.articulos || [],
            total: ap.importeApartado,
            enganche: ap.enganche,
            saldoPendiente: ap.saldoPendiente,
            apartadoFechaCompromiso: ap.fechaCompromiso || null,
            apartadoCondiciones: ap.condiciones || null,
            metodo: 'apartado', // Esto asegura que salga la leyenda legal de almacenaje
            vendedorNombre: ap.vendedorNombre || 'N/A'
        };
        
        if (typeof generarTicketMediaHoja === 'function') generarTicketMediaHoja(datosVenta);
        else alert("La función de impresión de tickets no está disponible.");

    } else if (origen === 'credito') {
        const cxc = StorageService.get("cuentasPorCobrar", []);
        const c = cxc.find(x => x.folio === folio);
        if (!c) return alert("No se encontró el crédito.");
        
        const datosVenta = {
            folio: c.folio,
            fecha: c.fechaVenta,
            cliente: { nombre: c.nombre, direccion: c.direccion, telefono: c.telefono, id: c.clienteId },
            articulos: c.articulos || [],
            total: c.totalContadoOriginal,
            enganche: c.engancheRecibido,
            saldoPendiente: c.saldoActual,
            plan: c.plan,
            periodicidad: c.periodicidad,
            metodo: 'credito',
            vendedorNombre: c.vendedorNombre || 'N/A'
        };
        if (typeof generarTicketMediaHoja === 'function') generarTicketMediaHoja(datosVenta);

    } else { // Venta de contado / transferencia
        const ventas = StorageService.get("ventasRegistradas", []);
        const v = ventas.find(x => x.folio === folio);
        if (!v) return alert("No se encontró la venta de contado.");
        if (typeof generarTicketMediaHoja === 'function') generarTicketMediaHoja(v);
    }
};

// ===============================================================
// BVEDA DE AUTORIZACIONES (MAKER-CHECKER) - MOTOR REPARADO V2
// ===============================================================

// 1. PANEL PRINCIPAL DE LA VISTA (Mantiene tu estructura limpia)
window.renderPanelAutorizaciones = function() {
    const cont = document.getElementById("autorizaciones"); 
    if (!cont) return;
    _normalizarFechasPendientesAutorizacion();
    
    const ventasPendientesGlobal = StorageService.get("ventasPendientes", []);
    const ventasP = ventasPendientesGlobal
        .map((v, index) => ({
            ...v,
            _indiceBoveda: index,
            fechaCapturaIso: v.fechaCapturaIso || v.datosVenta?.fechaIso || v.args?.[7] || null
        }))
        .filter(_esSolicitudBovedaPendiente);
    const abonosPendientesGlobal = StorageService.get("abonosPendientes", []);
    const abonosP = abonosPendientesGlobal
        .map((a, index) => ({
            ...a,
            _indiceBoveda: index,
            fechaCapturaIso: a.fechaCapturaIso || a.fechaAbonoIso || null
        }))
        .filter(_esSolicitudBovedaPendiente);
    const solicitudesClientesP = StorageService.get("solicitudesClientesPendientes", []);

    let html = `
    <div style="padding: 20px;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top:0;">Bóveda de Autorizaciones (Pendientes)</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 20px; margin-top: 20px;">
            
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="color: #d97706; margin-top: 0;">Ventas Provisionales (${ventasP.length})</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr style="background: #fef3c7; text-align: left;">
                        <th style="padding: 8px; border-bottom: 2px solid #fde68a;">Fecha Captura</th>
                        <th style="padding: 8px; border-bottom: 2px solid #fde68a;">Cliente</th>
                        <th style="padding: 8px; border-bottom: 2px solid #fde68a;">Total</th>
                        <th style="padding: 8px; border-bottom: 2px solid #fde68a;">Acción</th>
                    </tr>
                    ${ventasP.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:#9ca3af;">Todo al día. No hay ventas pendientes.</td></tr>' : ''}
                    ${ventasP.map((v, i) => `
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px;">${_ventaFechaVisible(v.fechaCapturaIso || v.fechaCaptura || v.datosVenta?.fechaIso || v.args?.[7])}</td>
                        <td style="padding: 8px;">${v.clienteNombre || 'Público General'}</td>
                        <td style="padding: 8px; font-weight: bold;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v.totalVenta || 0)}</td>
                        <td style="padding: 8px;">
                            <button onclick="revisarVentaPendiente(${v._indiceBoveda})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Revisar </button>
                        </td>
                    </tr>
                    `).join('')}
                </table>
            </div>

            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="color: #059669; margin-top: 0;">Abonos Provisionales (${abonosP.length})</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr style="background: #d1fae5; text-align: left;">
                        <th style="padding: 8px; border-bottom: 2px solid #a7f3d0;">Fecha Captura</th>
                        <th style="padding: 8px; border-bottom: 2px solid #a7f3d0;">Folio Deuda</th>
                        <th style="padding: 8px; border-bottom: 2px solid #a7f3d0;">Monto</th>
                        <th style="padding: 8px; border-bottom: 2px solid #a7f3d0;">Acción</th>
                    </tr>
                    ${abonosP.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:#9ca3af;">Todo al día. No hay abonos pendientes.</td></tr>' : ''}
                    ${abonosP.map((a, i) => {
                        const esApartado = a.tipo === 'apartado' || a.origen === 'apartados' || a.folioApartado;
                        const folioRef = a.folioApartado || a.folioCXC || '-';
                        return `
                    <tr style="border-bottom: 1px solid #f3f4f6;">
                        <td style="padding: 8px;">${_ventaFechaVisible(a.fechaCapturaIso || a.fechaAbonoIso || a.fechaCaptura || a.fechaAbonoStr)}</td>
                        <td style="padding: 8px; color: #475569;"><strong>${folioRef}</strong><br><span style="font-size:11px; color:#64748b;">${esApartado ? 'Apartado' : 'Crédito'}</span></td>
                        <td style="padding: 8px; font-weight: bold; color: #059669;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(a.montoAbonado || 0)}</td>
                        <td style="padding: 8px;">
                            <button onclick="revisarAbonoPendiente(${a._indiceBoveda})" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Revisar </button>
                        </td>
                    </tr>
                    `}).join('')}
                </table>
            </div>

            ${typeof renderSolicitudesClienteAutorizacion === 'function'
                ? renderSolicitudesClienteAutorizacion(solicitudesClientesP)
                : `<div style="background:white;padding:15px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);"><h3 style="color:#7c3aed;margin-top:0;">Cambios de Cliente (${solicitudesClientesP.length})</h3><p style="color:#64748b;">Modulo de clientes cargando...</p></div>`}

        </div>
    </div>`;
    cont.innerHTML = html;
};

// 2. VENTANA DE REVISIN AVANZADA Y EDICIN DE VENTAS
function _authFolioVentaPendiente(v) {
    return String(v?.datosVenta?.folio || v?.args?.[5] || v?.folio || '').trim();
}

function _authResolverVentaPendiente(index) {
    const ventasP = StorageService.get("ventasPendientes", []);
    const ctx = window._authVentaPendienteCtx;
    if (ctx) {
        const idxCtx = ventasP.findIndex(v =>
            String(v.idCuarentena || '') === String(ctx.idCuarentena || '') ||
            (_authFolioVentaPendiente(v) && _authFolioVentaPendiente(v) === ctx.folio)
        );
        if (idxCtx !== -1) return { ventasP, index: idxCtx, venta: ventasP[idxCtx] };
    }
    return { ventasP, index, venta: ventasP[index] };
}

function _authVentaBloqueadaPorEstado(v) {
    const folio = _authFolioVentaPendiente(v);
    if (!folio) return { bloqueada: true, motivo: "La venta pendiente no tiene folio valido." };
    const esConversionApartado = !!(v?.tipo === "conversion_apartado_credito" || v?.origenApartadoFolio || v?.datosVenta?.origenApartadoFolio);
    const yaRegistrada = StorageService.get("ventasRegistradas", [])
        .some(x => {
            if (String(x.folio || '').trim() !== folio) return false;
            if (esConversionApartado && String(x.metodoPago || '').toLowerCase() === 'apartado') return false;
            return true;
        });
    if (yaRegistrada) return { bloqueada: true, motivo: `La venta ${folio} ya existe en registros.` };
    const cancelada = StorageService.get("historialCancelaciones", [])
        .some(h => h.tipo === 'venta' && String(h.folio || '').trim() === folio);
    if (cancelada) return { bloqueada: true, motivo: `La venta ${folio} ya fue cancelada.` };
    return { bloqueada: false, motivo: "" };
}

window.revisarVentaPendiente = function(index) {
    const resPendiente = _authResolverVentaPendiente(index);
    const ventasP = resPendiente.ventasP;
    index = resPendiente.index;
    const v = resPendiente.venta;
    if (!v) return;
    window._authVentaPendienteCtx = { index, idCuarentena: v.idCuarentena, folio: _authFolioVentaPendiente(v) };

    const fechaActualIso = v.args[7] || new Date().toISOString();
    const fechaCorta = fechaActualIso.split('T')[0];

    // Extraer condiciones de venta desde el paquete de datos
    const metodoPago = v.args[0];
    const totalVenta = parseFloat(v.totalVenta || v.args[1] || 0);
    const engancheActual = parseFloat(v.args[2] || 0);
    const saldoFinanciado = parseFloat(v.args[3] || 0);
    const plan = v.args[4] || {};
    
    // Lógica para mostrar detalles de crédito si existen (EDITABLES)
    let detalleCreditoHTML = "";
    if (metodoPago === "credito") {
        // Extraer plazo del plan o usar fallback
        let plazo = 0;
        let abonoSemanal = 0;
        let periodicidad = 'semanal';
        let valorPagareDisplay = 0;
        
        if (plan && (plan.plazo || plan.pagos)) {
            plazo = plan.plazo || plan.pagos || 0;
            abonoSemanal = plan.abono || (saldoFinanciado / plazo) || 0;
            periodicidad = plan.periodicidad || 'semanal';
            valorPagareDisplay = plan.valorPagare || (abonoSemanal * plazo + engancheActual);
        } else {
            // Si no hay plan, mostrar campos vacíos pero editables
            plazo = 0;
            abonoSemanal = 0;
            valorPagareDisplay = engancheActual;
        }
        
        if (plazo > 0 || saldoFinanciado > 0) {
            detalleCreditoHTML = `
                <div style="background:#fffbeb; border:1px solid #fcd34d; padding:12px; border-radius:8px; margin-bottom:15px; font-size:12px;">
                    <label style="font-weight:bold; display:block; margin-bottom:8px; color:#92400e;">" AJUSTAR T0RMINOS DEL CR0DITO (Editable):</label>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:10px;">
                        <div>
                            <label style="font-size:11px; color:#92400e;">Plazo (Pagos):</label>
                            <input type="number" id="authPlazoCreditoAjuste" value="${plazo || 0}" min="1" max="52" step="1" style="width:100%; padding:6px; border:1px solid #fde68a; border-radius:4px; font-weight:bold;">
                        </div>
                        <div>
                            <label style="font-size:11px; color:#92400e;">Abono por Período ($):</label>
                            <input type="number" id="authAbonoPeriodoAjuste" value="${abonoSemanal.toFixed(2)}" min="0" step="0.01" style="width:100%; padding:6px; border:1px solid #fde68a; border-radius:4px; font-weight:bold;">
                        </div>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:#fef3c7; padding:8px; border-radius:4px; font-weight:bold; color:#92400e;">
                        <span>Período:</span>
                        <span>${periodicidad}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; background:#fef3c7; padding:8px; border-radius:4px; margin-top:4px; font-weight:bold; color:#92400e;">
                        <span>Valor Pagaré:</span>
                        <span id="authValorPagareRecalc">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valorPagareDisplay)}</span>
                    </div>
                </div>`;
        }
    }

    // Determinar cuánto efectivo real entrará a caja/banco hoy
    const engancheYaRegistrado = v.datosVenta?.engancheYaRegistrado === true;
    const importeEfectivoCaja = engancheYaRegistrado ? 0 : ((metodoPago === "contado" || metodoPago === "transferencia") ? totalVenta : engancheActual);

    // Construir tabla de productos del carrito provisional
    const articulos = v.datosVenta?.articulos || [];
    let tablaProductosHTML = "";
    articulos.forEach(art => {
        tablaProductosHTML += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding:6px 0;">⬢ ${art.nombre} ${art.colorElegido ? `(${art.colorElegido})` : ''}</td>
                <td style="padding:6px 0; text-align:center;">${art.cantidad || 1}</td>
                <td style="padding:6px 0; text-align:right;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.precioContado || art.precio || 0)}</td>
            </tr>`;
    });

    const html = `
    <div data-modal="auth-venta" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:20px;">
        <div style="background:white; padding:25px; border-radius:12px; width:100%; max-width:500px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); max-height:90vh; overflow-y:auto;">
            <h3 style="color:#d97706; margin-top:0; border-bottom:2px solid #fde68a; padding-bottom:8px;">Auditoría de Venta Provisional</h3>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:15px; background:#f8fafc; padding:10px; border-radius:8px;">
                <div><strong>Folio:</strong> ${v.args[5]}</div>
                <div><strong>Método:</strong> <span style="text-transform:uppercase; font-weight:bold; color:#1e3a8a;">${metodoPago}</span></div>
                <div style="grid-column: span 2;"><strong>Cliente:</strong> ${v.clienteNombre}</div>
            </div>
            
            ${detalleCreditoHTML}

            <label style="font-weight:bold; font-size:12px; color:#475569; text-transform:uppercase;">Productos en la Nota:</label>
            <div style="margin-bottom:15px; border-bottom:1px dashed #cbd5e1; padding-bottom:10px;">
                <table style="width:100%; font-size:12px; border-collapse:collapse;">
                    <thead>
                        <tr style="color:#64748b; text-align:left; border-bottom:1px solid #e2e8f0;">
                            <th>Descripción</th>
                            <th style="text-align:center;">Cant</th>
                            <th style="text-align:right;">Precio</th>
                        </tr>
                    </thead>
                    <tbody>${tablaProductosHTML}</tbody>
                </table>
            </div>

            <label style="font-weight:bold; font-size:12px; color:#475569; text-transform:uppercase;">Condiciones de Venta (Editables):</label>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:5px; margin-bottom:15px;">
                <div>
                    <label style="font-size:11px; color:#64748b;">Total de la Venta ($):</label>
                    <input type="number" id="authTotalVenta" value="${totalVenta}" style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;">
                </div>
                <div>
                    <label style="font-size:11px; color:#64748b;">Enganche / Anticipo ($):</label>
                    <input type="number" id="authEngancheVenta" value="${engancheActual}" ${metodoPago === 'contado' ? 'disabled style="background:#f1f5f9; width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;"' : 'style="width:100%; padding:6px; border:1px solid #cbd5e1; border-radius:6px;"'}>
                </div>
            </div>

            <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:10px; border-radius:8px; margin-bottom:15px; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
                <span style="color:#166534; font-weight:bold;">${engancheYaRegistrado ? 'Importe a caja al autorizar:' : 'Importe neto que ingresa a Caja:'}</span>
                <strong style="color:#15803d; font-size:15px;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(importeEfectivoCaja)}</strong>
            </div>
            ${engancheYaRegistrado ? '<div style="margin-top:-8px; margin-bottom:15px; font-size:12px; color:#64748b;">Los anticipos ya fueron registrados durante el apartado; aquí sólo se formaliza la cartera.</div>' : ''}
            
            <label style="display:block; font-weight:bold; font-size:12px; color:#475569;">Fecha de Aplicación Oficial:</label>
            <input type="date" id="authFechaVenta" value="${fechaCorta}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box; margin-bottom:20px;">

            <div style="display:flex; gap:10px;">
                <button onclick="aprobarVentaCuarentena(${index})" style="flex:1; background:#22c55e; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">Autorizar a DB</button>
                <button onclick="rechazarVentaCuarentena(${index})" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">Anular Movimiento</button>
                <button onclick="document.querySelector('[data-modal=auth-venta]').remove()" style="padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; cursor:pointer; font-size:13px;">Regresar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Agregar listener para recalcular Valor Pagaré cuando se edite plazo o abono (CR0DITO)
    if (metodoPago === "credito") {
        setTimeout(() => {
            const plazoInput = document.getElementById('authPlazoCreditoAjuste');
            const abonoInput = document.getElementById('authAbonoPeriodoAjuste');
            const valorPagareDisplay = document.getElementById('authValorPagareRecalc');
            
            if (plazoInput && abonoInput && valorPagareDisplay) {
                const recalcularValorPagare = () => {
                    const plazo = parseInt(plazoInput.value) || 1;
                    const abono = parseFloat(abonoInput.value) || 0;
                    const enganche = engancheActual;
                    const valorPagare = (abono * plazo) + enganche;
                    valorPagareDisplay.textContent = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(valorPagare);
                };
                plazoInput.addEventListener('input', recalcularValorPagare);
                abonoInput.addEventListener('input', recalcularValorPagare);
            }
        }, 100);
    }
};

// 3. PROCESADOR DE APROBACIONES (MODO SILENCIOSO)
window.aprobarVentaCuarentena = function(index) {
    const resPendiente = _authResolverVentaPendiente(index);
    const ventasP = resPendiente.ventasP;
    index = resPendiente.index;
    const v = resPendiente.venta;
    if (!v) return;
    const bloqueo = _authVentaBloqueadaPorEstado(v);
    if (bloqueo.bloqueada) {
        alert(`${bloqueo.motivo} Se retirara de la boveda para evitar duplicidad.`);
        ventasP[index] = _marcarEstadoBoveda(ventasP[index], 'Rechazado', {
            fechaResolucionIso: _ventaFechaAhoraIso(),
            fechaResolucion: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : null,
            motivoResolucion: 'Bloqueada por estado'
        });
        StorageService.set("ventasPendientes", ventasP.map(_normalizarVentaPendienteFirestore));
        document.querySelector('[data-modal=auth-venta]')?.remove();
        if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
        return;
    }
    
    // 1. Capturar las correcciones hechas por el Admin en la ventana
    const nuevoTotal = parseFloat(document.getElementById('authTotalVenta').value) || 0;
    const nuevoEnganche = parseFloat(document.getElementById('authEngancheVenta').value) || 0;
    const nuevaFechaCorta = document.getElementById('authFechaVenta').value;
    const nuevaFechaIso = window.localISO ? window.localISO(nuevaFechaCorta + 'T12:00:00') : new Date(nuevaFechaCorta + 'T12:00:00').toISOString();
    
    // NUEVOS CAMPOS: Capturar ajustes de crédito si aplica
    const nuevoPlazoCreditoInput = document.getElementById('authPlazoCreditoAjuste');
    const nuevoAbonoPeriodoInput = document.getElementById('authAbonoPeriodoAjuste');
    
    if (nuevoTotal <= 0) return alert("El total de la venta debe ser mayor a 0.");

    // 2. Modificar dinámicamente los argumentos antes de inyectar a la base de datos real
    v.totalVenta = nuevoTotal;
    v.args[1] = nuevoTotal; // totalContado original
    v.args[2] = nuevoEnganche; // enganche original
    
    // Si es crédito, recalcular el saldo pendiente financiero CON LA MATEMÁTICA CORRECTA
    if (v.args[0] === "credito" && v.args[4]) {
        const saldoFinanciado = nuevoTotal - nuevoEnganche;
        v.args[3] = saldoFinanciado; 
        
        // AJUSTAR PLAZO Y ABONO SI SE MODIFICARON
        if (nuevoPlazoCreditoInput) {
            const nuevoPlazoCreditoValor = parseInt(nuevoPlazoCreditoInput.value) || (v.args[4].plazo || v.args[4].pagos || 1);
            const nuevoAbonoPeriodo = parseFloat(nuevoAbonoPeriodoInput.value) || (saldoFinanciado / nuevoPlazoCreditoValor);
            
            // CORRECCIN: La deuda real en el sistema es la suma de los pagarés.
            const totalDeudaFinanciera = parseFloat((nuevoAbonoPeriodo * nuevoPlazoCreditoValor).toFixed(2));

            v.args[4].plazo = nuevoPlazoCreditoValor;
            v.args[4].pagos = nuevoPlazoCreditoValor;
            v.args[4].abono = parseFloat(nuevoAbonoPeriodo.toFixed(2));
            v.args[4].total = totalDeudaFinanciera; // Matemática blindada
            
            // Recalcular valor pagaré visual 
            v.args[4].valorPagare = parseFloat((totalDeudaFinanciera + nuevoEnganche).toFixed(2));
        } else {
            v.args[4].total = saldoFinanciado;
        }
    } 
    // Si es un apartado, actualizar el saldo que resta liquidar
    else if (v.args[0] === "apartado") {
        v.args[3] = nuevoTotal - nuevoEnganche; 
    }

    // Actualizar las marcas de tiempo oficiales de auditoría
    v.args[6] = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(nuevaFechaIso)) : nuevaFechaCorta; 
    v.args[7] = nuevaFechaIso; 

    // Actualizar el espejo del objeto de impresión para futuras reimpresiones
    v.datosVenta.total = nuevoTotal;
    v.datosVenta.enganche = nuevoEnganche;
    v.datosVenta.fecha = v.args[6];
    v.datosVenta.fechaIso = nuevaFechaIso;
    v.datosVenta.saldoPendiente = v.args[3];
    v.datosVenta.tipoComprobante = "Ticket de Venta Oficial (Autorizado)";
    if (v.args[0] === "credito" && v.args[4]) {
        v.datosVenta.planCredito = v.args[4];
        v.datosVenta.plan = v.args[4];
        v.datosVenta.pagaresPreview = _generarPagaresPreviewVentaCredito({
            folio: v.args[5],
            cliente: v.datosVenta.cliente,
            fechaBaseIso: nuevaFechaIso,
            plan: v.args[4],
            periodicidad: v.datosVenta.periodicidad || "semanal"
        });
    }

    if (v.args[0] === "credito") {
        const periodicidadCredito = v.datosVenta.periodicidad || "semanal";
        const capitalBase = Math.max(0, Number(v.datosVenta.totalMercancia || nuevoTotal || 0) - nuevoEnganche);
        const planNormalizado = _normalizarPlanCreditoVenta(v.args[4], capitalBase, periodicidadCredito, window._estadoPago?.planIndex || 0);
        if (!planNormalizado) return alert("No se puede autorizar: el plan de credito no genera pagos validos. Revisa la configuracion global de credito.");
        v.args[4] = planNormalizado;
        v.datosVenta.planCredito = planNormalizado;
        v.datosVenta.plan = planNormalizado;
        v.datosVenta.saldoPendiente = planNormalizado.total;
        v.datosVenta.pagaresPreview = _generarPagaresPreviewVentaCredito({
            folio: v.args[5],
            cliente: v.datosVenta.cliente,
            fechaBaseIso: nuevaFechaIso,
            plan: planNormalizado,
            periodicidad: periodicidadCredito
        });
    }

    // 3. Ejecutar el motor de transacciones del POS original (GUARDA SILENCIOSAMENTE EN DB)
    window._vendedorSeleccionado = v.vendedorSeleccionado;
    const autorizada = window.ejecutarVentaAutorizadaReal(...v.args, v.datosVenta);
    if (autorizada === false) return;
    
    // 4. Marcar como aprobada y conservar el registro en la bóveda
    ventasP[index] = _marcarEstadoBoveda(ventasP[index], 'Aprobado', {
        fechaResolucionIso: _ventaFechaAhoraIso(),
        fechaResolucion: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : null,
        motivoResolucion: 'Autorizado por auditoría'
    });
    StorageService.set("ventasPendientes", ventasP.map(_normalizarVentaPendienteFirestore));
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BOVEDA_VENTA_APROBADA',
            modulo: 'Ventas',
            entidad: 'venta',
            entidadId: _authFolioVentaPendiente(v) || v?.args?.[5] || '',
            detalle: 'Venta aprobada desde la bóveda de autorizaciones',
            monto: Number(v?.totalVenta || v?.datosVenta?.total || 0),
            severidad: 'info',
            datos: {
                folio: _authFolioVentaPendiente(v) || v?.args?.[5] || '',
                metodoPago: v?.args?.[0] || null,
                estado: 'Aprobado'
            }
        });
    }
    document.querySelector('[data-modal=auth-venta]').remove();
    
    alert("Venta corregida y autorizada de forma silenciosa.\n\nEl sistema financiero ha sido actualizado. El cajero podrá generar el ticket definitivo desde la opción 'Reimprimir Ticket' si el cliente lo requiere.");
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    if (typeof renderApartados === 'function') renderApartados();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
};

window.rechazarVentaCuarentena = function(index) {
    const resPendiente = _authResolverVentaPendiente(index);
    const ventasP = resPendiente.ventasP;
    index = resPendiente.index;
    const v = resPendiente.venta;
    if (!v) return;
    const folio = _authFolioVentaPendiente(v);
    const docsEntregaActivos = StorageService.get("documentosEntrega", [])
        .filter(d => d.folioVenta === folio && d.estado !== 'Cancelado');
    const tieneSalidaOperativa = docsEntregaActivos.length > 0 || _desenvolverListaVentaPendiente(v.args?.[8]).some(x => x.salidaOperativaAplicada || x.item?.salidaOperativaAplicada);
    const mensaje = tieneSalidaOperativa
        ? `Esta venta provisional tiene mercancía entregada/documentada.\n\nAl rechazarla se reingresará inventario, se cancelará el vale de entrega y se retirará de la Bóveda.\n\n¿Deseas continuar?`
        : "¿Deseas eliminar permanentemente esta venta provisional sin afectar inventario ni caja?";
    if (!confirm(mensaje)) return;

    if (v && (v.tipo === "conversion_apartado_credito" || v.origenApartadoFolio || v.datosVenta?.origenApartadoFolio)) {
        const folioApartado = v.origenApartadoFolio || v.datosVenta?.origenApartadoFolio || v.args?.[5];
        const apartados = StorageService.get("apartados", []);
        const idxApartado = apartados.findIndex(a => a.folio === folioApartado);
        if (idxApartado !== -1 && String(apartados[idxApartado].estado || '').toLowerCase().includes('pendiente')) {
            apartados[idxApartado].estado = "Pendiente";
            StorageService.set("apartados", apartados);
        }
    }
    if (tieneSalidaOperativa && folio) {
        _cancelReingresarInventarioPorVenta(folio, 'Rechazo de venta provisional en Boveda');
    }
    ventasP[index] = _marcarEstadoBoveda(ventasP[index], 'Rechazado', {
        fechaResolucionIso: _ventaFechaAhoraIso(),
        fechaResolucion: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : null,
        motivoResolucion: 'Rechazado por auditoría'
    });
    StorageService.set("ventasPendientes", ventasP.map(_normalizarVentaPendienteFirestore));
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BOVEDA_VENTA_RECHAZADA',
            modulo: 'Ventas',
            entidad: 'venta',
            entidadId: folio || '',
            detalle: 'Venta rechazada desde la bóveda de autorizaciones',
            monto: Number(v?.totalVenta || v?.datosVenta?.total || 0),
            severidad: 'alerta',
            datos: {
                folio: folio || '',
                motivo: 'Rechazado por auditoría',
                estado: 'Rechazado'
            }
        });
    }
    document.querySelector('[data-modal=auth-venta]').remove();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    if (typeof renderApartados === 'function') renderApartados();
};

// =====================================================================
// : CENTRO DE CANCELACIONES
// =====================================================================
window._cancelacionTipo = window._cancelacionTipo || 'venta';

function _cancelEsc(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function _cancelDinero(v) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
}

function _cancelIsoAhora() {
    return window.localISO ? window.localISO(new Date()) : new Date().toISOString();
}

function _cancelSelectorCuenta(id) {
    return window._buildSelectorCuentas
        ? window._buildSelectorCuentas(id, false)
        : `<select id="${id}" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="efectivo">Efectivo</option></select>`;
}

function _cancelCuentaSeleccionada(id) {
    const sel = document.getElementById(id);
    return {
        cuentaId: sel?.value || 'efectivo',
        etiqueta: sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex].text : 'Efectivo'
    };
}

function _cancelTotalPagadoVenta(folio, venta = null, pendiente = null) {
    const cxc = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio);
    const ap = StorageService.get("apartados", []).find(a => a.folio === folio);
    if (cxc) return (Number(cxc.engancheRecibido || cxc.enganche || 0) + (cxc.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0));
    if (ap) return (Number(ap.enganche || 0) + (ap.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0));
    if (pendiente) {
        const metodo = pendiente.args?.[0] || pendiente.datosVenta?.metodo;
        const total = Number(pendiente.args?.[1] || pendiente.totalVenta || pendiente.datosVenta?.total || 0);
        const enganche = Number(pendiente.args?.[2] || pendiente.datosVenta?.enganche || 0);
        return (metodo === 'contado' || metodo === 'transferencia') ? total : enganche;
    }
    const metodo = venta?.metodoPago || venta?.metodo;
    if (metodo === 'contado' || metodo === 'transferencia') return Number(venta?.total || 0);
    return Number(venta?.enganche || 0);
}

function _cancelInfoDineroVenta(folio, venta = null, pendiente = null) {
    const movimientos = StorageService.get("movimientosCaja", [])
        .filter(m => String(m.tipo || '').toLowerCase() === 'ingreso')
        .filter(m => String(m.referencia || '').includes(folio) || String(m.folio || '') === String(folio));
    if (movimientos.length > 0) {
        return {
            monto: movimientos.reduce((s, m) => s + Number(m.monto || 0), 0),
            cuentas: [...new Set(movimientos.map(m => m.etiquetaCuenta || m.cuenta || 'Sin cuenta'))],
            fuente: 'Movimientos de caja'
        };
    }

    const cxc = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio);
    if (cxc) {
        const partes = [];
        if (Number(cxc.engancheRecibido || cxc.enganche || 0) > 0) partes.push({ monto: Number(cxc.engancheRecibido || cxc.enganche || 0), cuenta: 'Cuenta de venta/enganche' });
        (cxc.abonos || []).forEach(a => partes.push({ monto: Number(a.monto || 0), cuenta: a.etiquetaCuenta || a.cuentaId || a.medioPago || 'Sin cuenta' }));
        return {
            monto: partes.reduce((s, p) => s + p.monto, 0),
            cuentas: [...new Set(partes.map(p => p.cuenta))],
            fuente: 'Crédito / abonos'
        };
    }

    const ap = StorageService.get("apartados", []).find(a => a.folio === folio);
    if (ap) {
        const partes = [];
        if (Number(ap.enganche || 0) > 0) partes.push({ monto: Number(ap.enganche || 0), cuenta: 'Cuenta de apartado inicial' });
        (ap.abonos || []).forEach(a => partes.push({ monto: Number(a.monto || 0), cuenta: a.etiquetaCuenta || a.cuentaId || 'Sin cuenta' }));
        return {
            monto: partes.reduce((s, p) => s + p.monto, 0),
            cuentas: [...new Set(partes.map(p => p.cuenta))],
            fuente: 'Apartado / abonos'
        };
    }

    const metodo = pendiente?.args?.[0] || pendiente?.datosVenta?.metodo || venta?.metodoPago || venta?.metodo;
    const total = Number(pendiente?.args?.[1] || pendiente?.totalVenta || pendiente?.datosVenta?.total || venta?.total || 0);
    const enganche = Number(pendiente?.args?.[2] || pendiente?.datosVenta?.enganche || venta?.enganche || 0);
    const monto = (metodo === 'contado' || metodo === 'transferencia') ? total : enganche;
    return {
        monto,
        cuentas: [pendiente?.datosVenta?.etiquetaCuenta || window._estadoPago?.etiquetaCuenta || 'Pendiente de autorización / caja no oficial'],
        fuente: pendiente ? 'Venta en cuarentena' : 'Venta'
    };
}

function _cancelContextoVentaHTML(folio, venta = null, pendiente = null) {
    const cxc = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio);
    const ap = StorageService.get("apartados", []).find(a => a.folio === folio);
    const datos = pendiente?.datosVenta || {};
    const metodo = venta?.metodoPago || venta?.metodo || cxc?.metodo || (ap ? 'apartado' : '') || pendiente?.args?.[0] || datos.metodo || '-';
    const total = Number(venta?.total || cxc?.totalContadoOriginal || ap?.importeApartado || pendiente?.totalVenta || pendiente?.args?.[1] || datos.total || 0);
    const enganche = Number(venta?.enganche || cxc?.engancheRecibido || ap?.enganche || pendiente?.args?.[2] || datos.enganche || 0);
    const saldo = Number(venta?.saldoAFinanciar || cxc?.saldoActual || ap?.saldoPendiente || pendiente?.args?.[3] || datos.saldoPendiente || 0);
    const plan = venta?.plan || cxc?.plan || pendiente?.args?.[4] || datos.plan || null;
    const periodicidad = venta?.periodicidad || cxc?.periodicidad || datos.periodicidad || 'semanal';
    const articulos = venta?.articulos || cxc?.articulos || ap?.articulos || datos.articulos || [];
    const dinero = _cancelInfoDineroVenta(folio, venta, pendiente);
    const docsEntrega = StorageService.get("documentosEntrega", []).filter(d => d.folioVenta === folio && d.estado !== 'Cancelado');

    const plazoTexto = metodo === 'credito'
        ? `${plan?.meses || plan?.plazo || '-'} meses / ${plan?.pagos || '-'} pagos ${periodicidad}${plan?.abono ? ` de ${_cancelDinero(plan.abono)}` : ''}`
        : (metodo === 'apartado' ? `Apartado. Saldo pendiente: ${_cancelDinero(saldo)}` : 'No aplica');

    const productosHTML = articulos.length
        ? `<table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:12px;">
            <thead><tr style="background:#f1f5f9;"><th style="text-align:left;padding:6px;">Producto</th><th style="text-align:center;padding:6px;">Cant.</th><th style="text-align:right;padding:6px;">Importe</th></tr></thead>
            <tbody>${articulos.map(a => {
                const cant = Number(a.cantidad || 1);
                const precio = Number(a.precioContado || a.precio || 0);
                return `<tr><td style="padding:6px;border-bottom:1px solid #e5e7eb;">${_cancelEsc(a.nombre || '-')} ${a.colorElegido ? `<br><small>Color: ${_cancelEsc(a.colorElegido)}</small>` : ''}</td><td style="padding:6px;text-align:center;border-bottom:1px solid #e5e7eb;">${cant}</td><td style="padding:6px;text-align:right;border-bottom:1px solid #e5e7eb;">${_cancelDinero(precio * cant)}</td></tr>`;
            }).join('')}</tbody>
        </table>`
        : '<div style="color:#94a3b8;font-size:12px;">Sin detalle de productos.</div>';

    return `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div><span style="color:#64748b;">Importe total venta:</span><br><b>${_cancelDinero(total)}</b></div>
            <div><span style="color:#64748b;">Método:</span><br><b>${_cancelEsc(metodo)}</b></div>
            <div><span style="color:#64748b;">Dinero recibido:</span><br><b style="color:#059669;">${_cancelDinero(dinero.monto)}</b></div>
            <div><span style="color:#64748b;">Recibido en:</span><br><b>${_cancelEsc(dinero.cuentas.join(', ') || '-')}</b><br><small>${_cancelEsc(dinero.fuente)}</small></div>
            <div><span style="color:#64748b;">Enganche/anticipo:</span><br><b>${_cancelDinero(enganche)}</b></div>
            <div><span style="color:#64748b;">Plazo:</span><br><b>${_cancelEsc(plazoTexto)}</b></div>
        </div>
        <div style="margin-top:10px;"><b>Producto vendido</b>${productosHTML}</div>
        <div style="margin-top:10px;color:${docsEntrega.length ? '#b91c1c' : '#64748b'};"><b>Entregas emitidas:</b> ${docsEntrega.length}</div>
    `;
}

function _cancelRegistrarHistorial(registro) {
    const historial = StorageService.get("historialCancelaciones", []);
    historial.push({
        id: Date.now() + Math.random(),
        fecha: _cancelIsoAhora(),
        usuario: (() => {
            try { return JSON.parse(sessionStorage.getItem('sesionActiva') || '{}')?.nombre || ''; }
            catch { return ''; }
        })(),
        ...registro
    });
    StorageService.set("historialCancelaciones", historial);
}

function _cancelTieneIngresoCaja(folio) {
    return StorageService.get("movimientosCaja", []).some(m =>
        String(m.tipo || '').toLowerCase() === 'ingreso' &&
        (String(m.referencia || '').includes(folio) || String(m.folio || '') === String(folio))
    );
}

function _cancelFechaKey(valor) {
    if (!valor) return '';
    const d = window.parseFechaMX ? window.parseFechaMX(valor) : new Date(valor);
    if (!d || isNaN(d.getTime())) return String(valor).slice(0, 10);
    return window.getFechaLocalMX ? window.getFechaLocalMX(d) : d.toISOString().slice(0, 10);
}

function _cancelMarcarMovimientosOrigen({ folio, referenciaBase, motivo, tipoCancelacion, monto, fecha, cuentaId, idOperacion }) {
    let movimientos = StorageService.get("movimientosCaja", []);
    let marcados = 0;
    const refNorm = String(referenciaBase || folio || '').toUpperCase();
    const folioNorm = String(folio || '').toUpperCase();
    const montoObjetivo = Number(monto || 0);
    const fechaObjetivo = _cancelFechaKey(fecha);
    const cuentaObjetivo = String(cuentaId || '').trim();
    const idObjetivo = String(idOperacion || '').trim();

    movimientos = movimientos.map(m => {
        const texto = `${m.folio || ''} ${m.referencia || ''} ${m.concepto || ''}`.toUpperCase();
        const esIngreso = String(m.tipo || '').toLowerCase() === 'ingreso';
        const coincideReferencia = refNorm && texto.includes(refNorm);
        const coincideFolioSeguro = !refNorm && folioNorm && texto.includes(folioNorm);
        const coincideAbonoLegacy = tipoCancelacion === 'abono' && folioNorm && texto.includes(folioNorm) && (texto.includes('ABONO') || texto.includes('ABN') || texto.includes('APARTADO'));
        if (!esIngreso || m.reversadoCancelacion || (!coincideReferencia && !coincideFolioSeguro && !coincideAbonoLegacy)) return m;
        if (idObjetivo && String(m.idOperacion || '') !== idObjetivo) return m;
        if (tipoCancelacion === 'abono' && !idObjetivo) {
            if (montoObjetivo > 0 && Math.abs(Number(m.monto || 0) - montoObjetivo) > 0.01) return m;
            if (fechaObjetivo && _cancelFechaKey(m.fecha || m.fechaISO || m.createdAt) !== fechaObjetivo) return m;
            if (cuentaObjetivo && String(m.cuenta || m.cuentaId || '') !== cuentaObjetivo) return m;
            if (marcados > 0) return m;
        }
        marcados++;
        return {
            ...m,
            reversadoCancelacion: true,
            fechaReversaCancelacion: _cancelIsoAhora(),
            motivoReversaCancelacion: motivo,
            tipoCancelacion: tipoCancelacion || 'cancelacion'
        };
    });

    if (marcados > 0) StorageService.set("movimientosCaja", movimientos);
    return marcados;
}

function _cancelLimpiarPendientesRelacionados(folio, motivo) {
    const folioNorm = String(folio || '').toUpperCase();

    let ventasPendientes = StorageService.get("ventasPendientes", []);
    const ventasAntes = ventasPendientes.length;
    ventasPendientes = ventasPendientes.filter(v => {
        const ref = String(v.datosVenta?.folio || v.folio || v.args?.[5] || v.origenApartadoFolio || v.datosVenta?.origenApartadoFolio || '').toUpperCase();
        return ref !== folioNorm;
    });
    if (ventasPendientes.length !== ventasAntes) {
        StorageService.set("ventasPendientes", ventasPendientes.map(_normalizarVentaPendienteFirestore));
    }

    let abonosPendientes = StorageService.get("abonosPendientes", []);
    let abonosModificados = false;
    abonosPendientes = abonosPendientes.map(a => {
        const ref = String(a.folioCXC || a.folioApartado || '').toUpperCase();
        if (ref !== folioNorm || a.estado === 'Cancelado') return a;
        abonosModificados = true;
        return {
            ...a,
            estado: 'Cancelado',
            canceladoPor: 'cancelacion_relacionada',
            fechaCancelacion: _cancelIsoAhora(),
            motivoCancelacion: motivo
        };
    });
    if (abonosModificados) {
        StorageService.set("abonosPendientes", abonosPendientes);
    }
}

function _cancelRegistrarReembolso({ monto, cuentaId, etiqueta, concepto, referencia, clienteNombre, tipo, motivo, emitirComprobante, registrarMovimiento = true }) {
    if (Number(monto || 0) <= 0) return;

    let movimientoOk = true;
    if (registrarMovimiento) {
        if (typeof window._egresarCuenta === 'function') {
            movimientoOk = window._egresarCuenta({ monto, cuentaId, etiqueta, concepto, referencia, fecha: _cancelIsoAhora() }) !== false;
        } else {
            const movs = StorageService.get("movimientosCaja", []);
            movs.push({
                id: Date.now() + Math.random(),
                tipo: "egreso",
                concepto,
                monto,
                fecha: _cancelIsoAhora(),
                cuenta: cuentaId,
                etiquetaCuenta: etiqueta,
                medioPago: String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo' ? 'efectivo' : 'transferencia',
                referencia
            });
            StorageService.set("movimientosCaja", movs);
        }
    }

    if (emitirComprobante && movimientoOk) {
        generarComprobanteDevolucionCancelacion({ tipo, referencia, clienteNombre, monto, cuenta: etiqueta, motivo });
    }

    return movimientoOk;
}

function _cancelReingresarInventarioPorVenta(folio, motivo) {
    const productosActuales = StorageService.get("productos", []);
    const movimientosInv = StorageService.get("movimientosInventario", []);
    const docs = StorageService.get("documentosEntrega", []);
    const docsActivos = docs.filter(d => d.folioVenta === folio && d.estado !== 'Cancelado');
    let articulos = [];

    docsActivos.forEach(d => {
        (d.articulos || []).forEach(a => articulos.push({
            productoId: a.productoId || a.id,
            nombre: a.nombre,
            cantidad: Number(a.cantidad || 1),
            color: a.colorElegido || a.color || 'General',
            ubicacion: a.ubicacionElegida || a.ubicacion || 'General'
        }));
        d.estado = 'Cancelado';
        d.fechaCancelacion = _cancelIsoAhora();
        d.motivoCancelacion = motivo || 'Cancelación de venta';
    });

    if (articulos.length === 0) {
        movimientosInv
            .filter(m => m.tipo === 'salida' && String(m.concepto || '').includes(folio) && !m.reversadoCancelacion)
            .forEach(m => {
                const prod = productosActuales.find(p => String(p.id) === String(m.productoId));
                articulos.push({
                    productoId: m.productoId,
                    nombre: prod?.nombre || m.productoId,
                    cantidad: Number(m.cantidad || 0),
                    color: 'General',
                    ubicacion: 'General'
                });
                m.reversadoCancelacion = true;
            });
    }

    articulos.forEach(a => {
        if (!a.productoId || !a.cantidad) return;
        const p = productosActuales.find(prod => String(prod.id) === String(a.productoId));
        if (!p) return;
        p.stock = (Number(p.stock) || 0) + Number(a.cantidad || 0);
        if (!Array.isArray(p.variantes)) p.variantes = [];
        const color = a.color || 'General';
        const ubicacion = a.ubicacion || 'General';
        let variante = p.variantes.find(v =>
            String(v.color || 'General').toUpperCase() === String(color).toUpperCase() &&
            String(v.ubicacion || 'General').toUpperCase() === String(ubicacion).toUpperCase()
        );
        if (variante) variante.stock = (Number(variante.stock) || 0) + Number(a.cantidad || 0);
        else p.variantes.push({ color, ubicacion, stock: Number(a.cantidad || 0) });

        movimientosInv.push({
            id: Date.now() + Math.random(),
            productoId: a.productoId,
            tipo: 'entrada',
            cantidad: Number(a.cantidad || 0),
            concepto: `Reingreso por cancelación - Folio ${folio}`,
            fecha: window.formatearFechaMX ? window.formatearFechaMX(new Date()) : _cancelIsoAhora(),
            referencia: `CANCEL-${folio}`
        });
    });

    StorageService.set("productos", productosActuales);
    productos = productosActuales;
    window.productos = productosActuales;
    StorageService.set("movimientosInventario", movimientosInv);
    StorageService.set("documentosEntrega", docs);
    return articulos;
}

function _cancelEsAbonoAnticipoConsignacion(abono) {
    const txt = `${abono?.cuenta || ''} ${abono?.nota || ''} ${abono?.concepto || ''}`.toUpperCase();
    return txt.includes('ANTICIPO CONSIGNACION') || txt.includes('ANTICIPO CONSIGNACI');
}

function _cancelReversarConsignacionPorVenta(folio, motivo) {
    const folioNorm = String(folio || '').trim().toUpperCase();
    if (!folioNorm) return { reversadas: 0, revision: 0, detalles: [] };

    const consignaciones = StorageService.get("consignacionesActivas", []);
    const cxp = StorageService.get("cuentasPorPagar", []);
    const detalles = [];
    let reversadas = 0;
    let revision = 0;
    let huboCambioConsig = false;
    let huboCambioCxp = false;

    consignaciones.forEach(c => {
        const ventasReportadas = Array.isArray(c.ventasReportadas) ? c.ventasReportadas : [];
        ventasReportadas.forEach(vr => {
            if (String(vr.folioVentaOrigen || '').trim().toUpperCase() !== folioNorm || vr.estado === 'Cancelado') return;

            const cuenta = cxp.find(cp =>
                cp.origenConsignacion &&
                cp.estado !== 'Cancelado' &&
                (
                    String(cp.folioReporteConsignacion || '') === String(vr.folioReporteConsignacion || vr.id || '') ||
                    (String(cp.consignacionId || '') === String(c.consignacionId || c.id) && String(cp.folioVentaOrigen || '').trim().toUpperCase() === folioNorm)
                )
            );
            const pagosReales = cuenta
                ? (cuenta.abonos || []).filter(a => !_cancelEsAbonoAnticipoConsignacion(a)).reduce((s, a) => s + Number(a.monto || 0), 0)
                : 0;

            if (pagosReales > 0.01) {
                revision++;
                if (cuenta) {
                    cuenta.requiereRevisionCancelacion = true;
                    cuenta.motivoRevisionCancelacion = `Venta ${folio} cancelada despues de pagar proveedor`;
                    cuenta.fechaRevisionCancelacion = _cancelIsoAhora();
                    huboCambioCxp = true;
                }
                detalles.push(`Revision proveedor ${c.proveedor || ''}: ya se pagaron ${_cancelDinero(pagosReales)}.`);
                return;
            }

            const cantidad = Number(vr.cantidad || 0);
            const montoDeuda = Number(vr.montoDeuda || (cantidad * Number(c.costoUnitario || 0)));
            const montoCxp = Number(vr.montoCxp || 0);
            const montoAnticipo = Number(vr.montoAnticipoAplicado || vr.montoCubiertoConAnticipos || 0);

            c.cantidadPendiente = Number(c.cantidadPendiente || 0) + cantidad;
            c.cantidadVendida = Math.max(0, Number(c.cantidadVendida || 0) - cantidad);
            c.montoTransferido = Math.max(0, Number(c.montoTransferido || 0) - montoCxp);
            c.montoVendidoReportado = Math.max(0, Number(c.montoVendidoReportado || 0) - montoDeuda);
            c.montoAbonosAplicados = Math.max(0, Number(c.montoAbonosAplicados || 0) - montoAnticipo);
            vr.estado = 'Cancelado';
            vr.fechaCancelacion = _cancelIsoAhora();
            vr.motivoCancelacion = motivo;
            huboCambioConsig = true;

            if (cuenta) {
                cuenta.estado = 'Cancelado';
                cuenta.saldoPendiente = 0;
                cuenta.fechaCancelacion = _cancelIsoAhora();
                cuenta.motivoCancelacion = `Cancelacion de venta ${folio}: ${motivo}`;
                cuenta.canceladoPorVenta = folio;
                cuenta.abonos = (cuenta.abonos || []).map(a => _cancelEsAbonoAnticipoConsignacion(a) ? { ...a, canceladoPorVenta: folio } : a);
                huboCambioCxp = true;
            }

            reversadas++;
            detalles.push(`${cantidad} pza(s) de ${c.producto || 'producto'} regresan a saldo de consignacion.`);
        });
    });

    if (huboCambioConsig) StorageService.set("consignacionesActivas", consignaciones);
    if (huboCambioCxp) StorageService.set("cuentasPorPagar", cxp);
    return { reversadas, revision, detalles };
}

function _cancelRecalcularCredito(cuenta) {
    let pagares = StorageService.get("pagaresSistema", []);
    const totalAbonado = (cuenta.abonos || []).reduce((sum, a) => sum + Number(a.monto || 0), 0);
    const enganche = Number(cuenta.engancheRecibido || cuenta.enganche || 0);
    let deudaTotal = Number(cuenta.totalContadoOriginal || 0) - enganche;
    if (cuenta.plan && cuenta.plan.total) deudaTotal = Number(cuenta.plan.total);
    else if (cuenta.saldoOriginal) deudaTotal = Number(cuenta.saldoOriginal);

    cuenta.saldoActual = Math.max(0, deudaTotal - totalAbonado);
    cuenta.estado = cuenta.saldoActual <= 0.01 ? "Saldado" : "Pendiente";
    if (cuenta.saldoActual <= 0.01) cuenta.saldoActual = 0;

    const pagaresFolio = pagares.filter(p => p.folio === cuenta.folio).sort((a,b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    let bolsa = totalAbonado;
    pagaresFolio.forEach(p => {
        const canceladoPorPolitica = p.estado === 'Cancelado' && String(p.nota || '').toLowerCase().includes('liquidado por');
        if (p.estado === 'Cancelado' && !canceladoPorPolitica) return;
        p.montoAbonado = 0;
        p.fechaAbono = null;
        if (canceladoPorPolitica) p.nota = '';
        p.estado = "Pendiente";
        if (bolsa >= Number(p.monto || 0) - 0.01) {
            p.estado = "Pagado";
            p.montoAbonado = Number(p.monto || 0);
            p.fechaAbono = cuenta.abonos[cuenta.abonos.length - 1]?.fecha || _cancelIsoAhora();
            bolsa -= Number(p.monto || 0);
        } else if (bolsa > 0.01) {
            p.estado = "Parcial";
            p.montoAbonado = bolsa;
            p.fechaAbono = cuenta.abonos[cuenta.abonos.length - 1]?.fecha || _cancelIsoAhora();
            bolsa = 0;
        }
    });
    pagares = pagares.map(p => pagaresFolio.find(pf => pf.id === p.id) || p);
    StorageService.set("pagaresSistema", pagares);
}

function generarComprobanteDevolucionCancelacion({ tipo, referencia, clienteNombre, monto, cuenta, motivo, folioDoc: folioDocExistente, fechaIso, registrar = true }) {
    const folioDoc = folioDocExistente || (window.generarFolioSistema ? window.generarFolioSistema("DEV") : `DEV-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`);
    const fechaRegistro = fechaIso || _cancelIsoAhora();
    const fecha = window.formatearFechaMX ? window.formatearFechaMX(new Date(fechaRegistro)) : new Date(fechaRegistro).toLocaleString('es-MX');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family:'Courier New', monospace; width:72mm; margin:4mm auto; color:#000; font-size:12px; line-height:1.3; }
        .centro{text-align:center}.negrita{font-weight:bold}.sep{border-top:1px dashed #000;margin:8px 0}.no-print{background:#eee;padding:10px;text-align:center;margin-bottom:10px}
        @media print{.no-print{display:none}}
    </style></head><body>
        <div class="no-print"><button onclick="window.print()" style="padding:10px 18px;font-weight:bold;">Imprimir comprobante</button></div>
        <div class="centro">
            <img src="img/Logo.svg" style="width:50px;height:50px;object-fit:contain;" onerror="this.style.display='none'">
            <div class="negrita" style="font-size:15px;">MUEBLERÍA MI PUEBLITO</div>
            <div class="negrita">COMPROBANTE DE DEVOLUCIN</div>
            <div>${_cancelEsc(folioDoc)}</div>
        </div>
        <div class="sep"></div>
        <div>Fecha: <b>${_cancelEsc(fecha)}</b></div>
        <div>Tipo: <b>${_cancelEsc(tipo)}</b></div>
        <div>Referencia: <b>${_cancelEsc(referencia)}</b></div>
        <div>Cliente: <b>${_cancelEsc(clienteNombre || 'Público General')}</b></div>
        <div class="sep"></div>
        <div class="centro">
            <div>MONTO DEVUELTO</div>
            <div class="negrita" style="font-size:24px;">${_cancelDinero(monto)}</div>
            <div style="font-size:10px;">Cuenta: ${_cancelEsc(cuenta)}</div>
        </div>
        <div class="sep"></div>
        <div style="font-size:10px;text-align:justify;">Motivo: ${_cancelEsc(motivo || 'Cancelación autorizada')}</div>
        <div style="margin-top:32px;text-align:center;">
            <div style="border-top:1px solid #000;width:80%;margin:0 auto;"></div>
            <div class="negrita" style="font-size:10px;">FIRMA DE RECIBIDO DEL CLIENTE</div>
        </div>
        <div class="centro" style="margin-top:18px;font-size:9px;">Documento de reversa administrativa</div>
    </body></html>`;
    if (registrar) {
        const documentos = StorageService.get("documentosCancelacion", []);
        documentos.push({
            id: Date.now() + Math.random(),
            tipoDocumento: "devolucion_cancelacion",
            folioDocumento: folioDoc,
            fechaEmision: fechaRegistro,
            fecha,
            tipo,
            referencia,
            clienteNombre,
            monto,
            cuenta,
            motivo
        });
        StorageService.set("documentosCancelacion", documentos);
    }
    if (window.TicketService?.openHtml) {
        window.TicketService.openHtml(html, { title: `Comprobante ${folioDoc}`, filename: `comprobante_${folioDoc}` });
        return;
    }
    const win = window.open('', '_blank');
    if (!win) return alert("El comprobante se generó, pero el navegador bloqueó la ventana emergente.");
    win.document.write(html);
    win.document.close();
    win.focus();
}

function renderCancelaciones(tipo = window._cancelacionTipo || 'venta') {
    const usuarioActual = (() => { try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; } })();
    if (usuarioActual?.rol !== 'admin') {
        if (window.AuditService?.log) {
            window.AuditService.log({ accion: 'ACCESO_DENEGADO', modulo: 'Seguridad', entidad: 'Cancelaciones', detalle: 'Intento de abrir cancelaciones sin rol admin', severidad: 'alerta' });
        }
        alert("Acceso restringido. Solo administrador puede cancelar ventas, abonos o apartados.");
        return;
    }
    window._cancelacionTipo = tipo;
    const cont = document.getElementById('contenidoCancelaciones');
    if (!cont) return;
    const filtro = (document.getElementById('cancelFiltro')?.value || '').trim().toLowerCase();
    const btn = (id, label, color) => `<button onclick="renderCancelaciones('${id}')" style="padding:12px 16px;border:none;border-radius:8px;font-weight:bold;cursor:pointer;background:${tipo === id ? color : '#f1f5f9'};color:${tipo === id ? 'white' : '#475569'};">${label}</button>`;

    cont.innerHTML = `
        <div style="background:white;border:1px solid #e2e8f0;border-radius:12px;padding:18px;box-shadow:0 4px 12px rgba(15,23,42,0.05);">
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
                ${btn('venta', 'Cancelar venta', '#dc2626')}
                ${btn('abono', 'Cancelar abono', '#b45309')}
                ${btn('apartado', 'Cancelar apartado', '#7c3aed')}
            </div>
            <input id="cancelFiltro" value="${_cancelEsc(filtro)}" oninput="renderCancelaciones('${tipo}')" placeholder="Buscar por folio o cliente..." style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box;margin-bottom:16px;">
            <div id="cancelResultados">${_renderCancelacionesResultados(tipo, filtro)}</div>
        </div>`;
}

function _renderCancelacionesResultados(tipo, filtro) {
    if (tipo === 'venta') return _renderCancelacionesVentas(filtro);
    if (tipo === 'abono') return _renderCancelacionesAbonos(filtro);
    return _renderCancelacionesApartados(filtro);
}

function _renderCancelacionesVentas(filtro) {
    const ventas = StorageService.get("ventasRegistradas", []).filter(v => v.estado !== 'Cancelada' && v.estatus !== 'Cancelada').map(v => ({ ...v, _origenCancel: 'registrada' }));
    const pendientes = StorageService.get("ventasPendientes", []).map((v, idx) => ({
        folio: v.datosVenta?.folio || v.args?.[5],
        clienteNombre: v.clienteNombre || v.datosVenta?.cliente?.nombre,
        fechaVenta: v.datosVenta?.fechaIso || v.args?.[7],
        total: v.totalVenta || v.args?.[1],
        metodoPago: v.args?.[0] || v.datosVenta?.metodo,
        _origenCancel: 'cuarentena',
        _pendienteIndex: idx
    }));
    const filas = [...ventas, ...pendientes]
        .filter(v => {
            const txt = `${v.folio || ''} ${v.clienteNombre || v.cliente?.nombre || ''}`.toLowerCase();
            return !filtro || txt.includes(filtro);
        })
        .slice()
        .sort((a,b) => new Date(a.fechaVenta || a.fechaIso || 0) - new Date(b.fechaVenta || b.fechaIso || 0));
    if (!filas.length) return '<div style="padding:22px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">Sin ventas para cancelar.</div>';
    return `<div style="overflow-x:auto;"><table class="tabla-admin"><thead><tr><th>Folio</th><th>Cliente</th><th>Tipo</th><th>Total</th><th>Origen</th><th>Acción</th></tr></thead><tbody>${filas.map(v => `
        <tr>
            <td><b>${_cancelEsc(v.folio)}</b></td>
            <td>${_cancelEsc(v.clienteNombre || v.cliente?.nombre || 'Público General')}</td>
            <td>${_cancelEsc(v.metodoPago || v.metodo || '-')}</td>
            <td>${_cancelDinero(v.total || v.totalVenta || 0)}</td>
            <td>${v._origenCancel === 'cuarentena' ? 'Cuarentena' : 'Registrada'}</td>
            <td><button onclick="abrirModalCancelarVenta('${_cancelEsc(v.folio)}', '${v._origenCancel}', ${v._pendienteIndex ?? -1})" style="padding:7px 12px;background:#dc2626;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Cancelar</button></td>
        </tr>`).join('')}</tbody></table></div>`;
}

function _renderCancelacionesAbonos(filtro) {
    const cxc = StorageService.get("cuentasPorCobrar", []);
    const apartados = StorageService.get("apartados", []);
    const filas = [];
    cxc.forEach(c => (c.abonos || []).forEach((ab, idx) => {
        if (String(c.estado || '').toLowerCase().includes('cancel') || ab.cancelado || ab.canceladoPorVenta || ab.canceladoPorApartado) return;
        filas.push({ origen: 'credito', folio: c.folio, cliente: c.nombre || c.clienteNombre, fecha: ab.fecha || ab.fechaAbono, monto: ab.monto, cuenta: ab.etiquetaCuenta || ab.medioPago, idx });
    }));
    apartados.forEach(a => (a.abonos || []).forEach((ab, idx) => {
        if (String(a.estado || '').toLowerCase().includes('cancel') || ab.cancelado || ab.canceladoPorVenta || ab.canceladoPorApartado) return;
        filas.push({ origen: 'apartado', folio: a.folio, cliente: a.clienteNombre, fecha: ab.fechaAbono || ab.fecha, monto: ab.monto, cuenta: ab.etiquetaCuenta || ab.cuentaId, idx });
    }));
    const filtradas = filas.filter(a => !filtro || `${a.folio} ${a.cliente}`.toLowerCase().includes(filtro)).sort((a,b) => new Date(a.fecha || 0) - new Date(b.fecha || 0));
    if (!filtradas.length) return '<div style="padding:22px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">Sin abonos para cancelar.</div>';
    return `<div style="overflow-x:auto;"><table class="tabla-admin"><thead><tr><th>Folio</th><th>Cliente</th><th>Origen</th><th>Fecha</th><th>Monto</th><th>Cuenta</th><th>Acción</th></tr></thead><tbody>${filtradas.map(a => `
        <tr>
            <td><b>${_cancelEsc(a.folio)}</b></td>
            <td>${_cancelEsc(a.cliente)}</td>
            <td>${a.origen === 'credito' ? 'Crédito' : 'Apartado'}</td>
            <td>${a.fecha ? (window.formatearFechaCortaMX ? window.formatearFechaCortaMX(a.fecha) : String(a.fecha).slice(0,10)) : '-'}</td>
            <td>${_cancelDinero(a.monto)}</td>
            <td>${_cancelEsc(a.cuenta || '-')}</td>
            <td><button onclick="abrirModalCancelarAbono('${a.origen}', '${_cancelEsc(a.folio)}', ${a.idx})" style="padding:7px 12px;background:#b45309;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Cancelar</button></td>
        </tr>`).join('')}</tbody></table></div>`;
}

function _renderCancelacionesApartados(filtro) {
    const apartados = StorageService.get("apartados", []).filter(a => a.estado !== 'Cancelado');
    const filas = apartados.filter(a => !filtro || `${a.folio} ${a.clienteNombre}`.toLowerCase().includes(filtro)).sort((a,b) => new Date(a.fechaApartado || 0) - new Date(b.fechaApartado || 0));
    if (!filas.length) return '<div style="padding:22px;text-align:center;color:#64748b;background:#f8fafc;border-radius:8px;">Sin apartados para cancelar.</div>';
    return `<div style="overflow-x:auto;"><table class="tabla-admin"><thead><tr><th>Folio</th><th>Cliente</th><th>Total</th><th>Pagado</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${filas.map(a => {
        const pagado = Number(a.enganche || 0) + (a.abonos || []).reduce((s, ab) => s + Number(ab.monto || 0), 0);
        return `<tr>
            <td><b>${_cancelEsc(a.folio)}</b></td>
            <td>${_cancelEsc(a.clienteNombre)}</td>
            <td>${_cancelDinero(a.importeApartado || a.total || 0)}</td>
            <td>${_cancelDinero(pagado)}</td>
            <td>${_cancelEsc(a.estado || 'Pendiente')}</td>
            <td><button onclick="abrirModalCancelarApartado('${_cancelEsc(a.folio)}')" style="padding:7px 12px;background:#7c3aed;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Cancelar</button></td>
        </tr>`;
    }).join('')}</tbody></table></div>`;
}

function _modalCancelacion({ titulo, resumen, monto, onConfirm }) {
    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    const html = `
    <div data-modal="cancelacion-modal" style="position:fixed;inset:0;background:rgba(15,23,42,0.82);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;">
        <div style="background:white;border-radius:14px;width:100%;max-width:560px;padding:24px;box-shadow:0 25px 60px rgba(0,0,0,0.35);">
            <h2 style="margin:0 0 8px;color:#b91c1c;">${titulo}</h2>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px;margin:14px 0;font-size:13px;">${resumen}</div>
            ${monto > 0 ? `
                <div style="background:#fff1f2;border:1px solid #fecaca;border-radius:10px;padding:14px;margin-bottom:14px;">
                    <b style="color:#991b1b;">Dinero a devolver: ${_cancelDinero(monto)}</b>
                    <label style="display:block;font-size:11px;font-weight:bold;color:#7f1d1d;margin-top:12px;">Cuenta de donde saldrá la devolución</label>
                    ${_cancelSelectorCuenta('cancelCuentaReembolso')}
                    <label style="display:flex;gap:8px;align-items:center;margin-top:12px;font-size:13px;color:#7f1d1d;">
                        <input type="checkbox" id="cancelEmitirComprobante" checked>
                        Emitir comprobante de devolución
                    </label>
                </div>` : ''}
            <label style="font-size:12px;font-weight:bold;color:#475569;">Motivo de cancelación</label>
            <textarea id="cancelMotivo" style="width:100%;min-height:74px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box;margin-top:5px;"></textarea>
            <div style="display:flex;gap:10px;margin-top:18px;">
                <button onclick="${onConfirm}" style="flex:2;padding:13px;background:#dc2626;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Confirmar cancelación</button>
                <button onclick="document.querySelector('[data-modal=&quot;cancelacion-modal&quot;]')?.remove()" style="flex:1;padding:13px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Cerrar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

window.abrirModalCancelarVenta = function(folio, origen, pendienteIndex = -1) {
    const ventas = StorageService.get("ventasRegistradas", []);
    const pendientes = StorageService.get("ventasPendientes", []);
    const venta = origen === 'cuarentena' ? null : ventas.find(v => v.folio === folio);
    const pendiente = origen === 'cuarentena' ? pendientes[pendienteIndex] : null;
    const cliente = venta?.clienteNombre || venta?.cliente?.nombre || pendiente?.clienteNombre || pendiente?.datosVenta?.cliente?.nombre || 'Público General';
    const monto = _cancelTotalPagadoVenta(folio, venta, pendiente);
    const docsEntrega = StorageService.get("documentosEntrega", []).filter(d => d.folioVenta === folio && d.estado !== 'Cancelado').length;
    window._cancelacionActual = { tipo: 'venta', folio, origen, pendienteIndex, monto, cliente };
    _modalCancelacion({
        titulo: `Cancelar venta ${_cancelEsc(folio)}`,
        monto,
        resumen: `<b>Cliente:</b> ${_cancelEsc(cliente)}<br><b>Origen:</b> ${origen === 'cuarentena' ? 'Bóveda de autorizaciones' : 'Venta registrada'}<br><b>Documentos de entrega activos:</b> ${docsEntrega}<hr style="border:none;border-top:1px solid #e2e8f0;margin:10px 0;">${_cancelContextoVentaHTML(folio, venta, pendiente)}<div style="margin-top:10px;color:#991b1b;font-weight:bold;">Se revertirá cartera, pagarés, caja y mercancía entregada.</div>`,
        onConfirm: "ejecutarCancelacionVenta()"
    });
};

window.ejecutarCancelacionVenta = function() {
    const ctx = window._cancelacionActual;
    if (!ctx || ctx.tipo !== 'venta') return;
    const motivo = document.getElementById('cancelMotivo')?.value || 'Cancelación de venta';
    const cuenta = _cancelCuentaSeleccionada('cancelCuentaReembolso');
    const emitir = document.getElementById('cancelEmitirComprobante')?.checked || false;

    const ventas = StorageService.get("ventasRegistradas", []);
    const vIdx = ventas.findIndex(v => v.folio === ctx.folio);
    if (vIdx >= 0) {
        ventas[vIdx].estado = 'Cancelada';
        ventas[vIdx].estatus = 'Cancelada';
        ventas[vIdx].fechaCancelacion = _cancelIsoAhora();
        ventas[vIdx].motivoCancelacion = motivo;
        StorageService.set("ventasRegistradas", ventas);
    }

    const pendientes = StorageService.get("ventasPendientes", []);
    const pendientesRestantes = pendientes.filter((p, idx) => !(idx === ctx.pendienteIndex || p.datosVenta?.folio === ctx.folio || p.args?.[5] === ctx.folio));
    StorageService.set("ventasPendientes", pendientesRestantes.map(_normalizarVentaPendienteFirestore));
    _cancelLimpiarPendientesRelacionados(ctx.folio, motivo);

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cIdx = cuentas.findIndex(c => c.folio === ctx.folio);
    if (cIdx >= 0) {
        cuentas[cIdx].estado = 'Cancelado';
        cuentas[cIdx].saldoActual = 0;
        cuentas[cIdx].fechaCancelacion = _cancelIsoAhora();
        cuentas[cIdx].motivoCancelacion = motivo;
        (cuentas[cIdx].abonos || []).forEach(a => a.canceladoPorVenta = true);
        StorageService.set("cuentasPorCobrar", cuentas);
    }

    const apartados = StorageService.get("apartados", []);
    const aIdx = apartados.findIndex(a => a.folio === ctx.folio);
    if (aIdx >= 0) {
        apartados[aIdx].estado = 'Cancelado';
        apartados[aIdx].fechaCancelacion = _cancelIsoAhora();
        apartados[aIdx].motivoCancelacion = motivo;
        StorageService.set("apartados", apartados);
    }

    let pagares = StorageService.get("pagaresSistema", []);
    pagares = pagares.map(p => p.folio === ctx.folio ? { ...p, estado: 'Cancelado', nota: 'Cancelado por cancelación de venta' } : p);
    StorageService.set("pagaresSistema", pagares);

    const salidas = StorageService.get("salidasPendientesVenta", []).map(s => s.folioVenta === ctx.folio ? { ...s, estatus: 'Cancelado', motivoCancelacion: motivo, fechaCancelacion: _cancelIsoAhora() } : s);
    StorageService.set("salidasPendientesVenta", salidas);
    const reqs = StorageService.get("requisicionesCompra", []).map(r => r.folioVenta === ctx.folio ? { ...r, estatus: 'Cancelada', motivoCancelacion: motivo } : r);
    StorageService.set("requisicionesCompra", reqs);

    const articulosReingresados = _cancelReingresarInventarioPorVenta(ctx.folio, motivo);
    const reversaConsignacion = _cancelReversarConsignacionPorVenta(ctx.folio, motivo);
    const registrarMovimientoReembolso = ctx.origen !== 'cuarentena' || _cancelTieneIngresoCaja(ctx.folio);
    const movimientosOrigenMarcados = _cancelMarcarMovimientosOrigen({
        folio: ctx.folio,
        referenciaBase: `VENTA-${ctx.folio}`,
        motivo,
        tipoCancelacion: 'venta'
    });
    const reembolsoOk = _cancelRegistrarReembolso({
        monto: ctx.monto,
        cuentaId: cuenta.cuentaId,
        etiqueta: cuenta.etiqueta,
        concepto: `Devolución por cancelación de venta ${ctx.folio}`,
        referencia: `CANCEL-VENTA-${ctx.folio}`,
        clienteNombre: ctx.cliente,
        tipo: 'Cancelación de venta',
        motivo,
        emitirComprobante: emitir,
        registrarMovimiento: registrarMovimientoReembolso
    });
    _cancelRegistrarHistorial({ tipo: 'venta', folio: ctx.folio, origen: ctx.origen, clienteNombre: ctx.cliente, montoDevuelto: ctx.monto, movimientoCajaRegistrado: registrarMovimientoReembolso && reembolsoOk, movimientosOrigenMarcados, motivo, articulosReingresados, reversaConsignacion });
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'VENTA_CANCELADA',
            modulo: 'Ventas',
            entidad: 'venta',
            entidadId: ctx.folio,
            detalle: motivo,
            monto: ctx.monto,
            severidad: 'alerta',
            datos: {
                origen: ctx.origen,
                cliente: ctx.cliente,
                reembolsoRegistrado: registrarMovimientoReembolso && reembolsoOk,
                movimientosOrigenMarcados,
                articulosReingresados,
                reversaConsignacion
            }
        });
    }

    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    alert("Venta cancelada. Se aplicaron reversas de caja, cartera, pagarés e inventario entregado.");
    if (reversaConsignacion.reversadas || reversaConsignacion.revision) {
        alert(`Consignacion: ${reversaConsignacion.reversadas} reversa(s) aplicada(s). ${reversaConsignacion.revision ? reversaConsignacion.revision + ' queda(n) para revision porque ya hubo pago real al proveedor.' : ''}`);
    }
    renderCancelaciones('venta');
};

window.abrirModalCancelarAbono = function(origen, folio, index) {
    const cuenta = origen === 'credito'
        ? StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio)
        : StorageService.get("apartados", []).find(a => a.folio === folio);
    const abono = cuenta?.abonos?.[index];
    if (!cuenta || !abono) return alert("No se encontró el abono.");
    if (String(cuenta.estado || '').toLowerCase().includes('cancel') || abono.cancelado || abono.canceladoPorVenta || abono.canceladoPorApartado) {
        return alert("Este abono ya pertenece a una cuenta cancelada o ya fue reversado.");
    }
    const cliente = cuenta.nombre || cuenta.clienteNombre || 'Cliente';
    const monto = Number(abono.monto || 0);
    window._cancelacionActual = { tipo: 'abono', origen, folio, index, monto, cliente, abonoSnapshot: { ...abono } };
    _modalCancelacion({
        titulo: `Cancelar abono ${_cancelEsc(folio)}`,
        monto,
        resumen: `<b>Cliente:</b> ${_cancelEsc(cliente)}<br><b>Origen:</b> ${origen === 'credito' ? 'Crédito' : 'Apartado'}<br><b>Importe:</b> ${_cancelDinero(monto)}<br>Se retirará del historial del cliente y se recalcularán saldos.`,
        onConfirm: "ejecutarCancelacionAbono()"
    });
};

window.ejecutarCancelacionAbono = function() {
    const ctx = window._cancelacionActual;
    if (!ctx || ctx.tipo !== 'abono') return;
    const motivo = document.getElementById('cancelMotivo')?.value || 'Cancelación de abono';
    const cuentaReembolso = _cancelCuentaSeleccionada('cancelCuentaReembolso');
    const emitir = document.getElementById('cancelEmitirComprobante')?.checked || false;

    if (ctx.origen === 'credito') {
        const cuentas = StorageService.get("cuentasPorCobrar", []);
        const cuenta = cuentas.find(c => c.folio === ctx.folio);
        if (!cuenta || !cuenta.abonos?.[ctx.index]) return alert("El abono ya no existe.");
        const abono = cuenta.abonos.splice(ctx.index, 1)[0];
        cuenta.abonosCancelados = cuenta.abonosCancelados || [];
        cuenta.abonosCancelados.push({ ...abono, cancelado: true, fechaCancelacion: _cancelIsoAhora(), motivoCancelacion: motivo });
        _cancelRecalcularCredito(cuenta);
        StorageService.set("cuentasPorCobrar", cuentas);
        ctx.monto = Number(abono.monto || ctx.monto || 0);
        ctx.cliente = cuenta.nombre || cuenta.clienteNombre || ctx.cliente;
    } else {
        const apartados = StorageService.get("apartados", []);
        const ap = apartados.find(a => a.folio === ctx.folio);
        if (!ap || !ap.abonos?.[ctx.index]) return alert("El abono ya no existe.");
        const abono = ap.abonos.splice(ctx.index, 1)[0];
        ap.abonosCancelados = ap.abonosCancelados || [];
        ap.abonosCancelados.push({ ...abono, cancelado: true, fechaCancelacion: _cancelIsoAhora(), motivoCancelacion: motivo });
        ctx.monto = Number(abono.monto || ctx.monto || 0);
        ap.saldoPendiente = Number(ap.saldoPendiente || 0) + ctx.monto;
        if (ap.estado === 'Liquidado') ap.estado = 'Pendiente';
        ctx.cliente = ap.clienteNombre || ctx.cliente;
        StorageService.set("apartados", apartados);
    }

    const refOriginal = ctx.origen === 'credito' ? `ABONO-${ctx.folio}` : `ABN-APT-${ctx.folio}`;
    const movimientosOrigenMarcados = _cancelMarcarMovimientosOrigen({
        folio: ctx.folio,
        referenciaBase: refOriginal,
        motivo,
        tipoCancelacion: 'abono',
        monto: ctx.abonoSnapshot?.monto || ctx.monto,
        fecha: ctx.abonoSnapshot?.fechaAbonoIso || ctx.abonoSnapshot?.fechaAbono || ctx.abonoSnapshot?.fecha,
        cuentaId: ctx.abonoSnapshot?.cuentaId,
        idOperacion: ctx.abonoSnapshot?.idOperacion || ctx.abonoSnapshot?.idCuarentena || ctx.abonoSnapshot?.id
    });
    const reembolsoOk = _cancelRegistrarReembolso({
        monto: ctx.monto,
        cuentaId: cuentaReembolso.cuentaId,
        etiqueta: cuentaReembolso.etiqueta,
        concepto: `Devolución por cancelación de abono ${ctx.folio}`,
        referencia: `CANCEL-ABONO-${ctx.folio}`,
        clienteNombre: ctx.cliente,
        tipo: 'Cancelación de abono',
        motivo,
        emitirComprobante: emitir
    });
    _cancelRegistrarHistorial({ tipo: 'abono', origen: ctx.origen, folio: ctx.folio, clienteNombre: ctx.cliente, montoDevuelto: ctx.monto, movimientoCajaRegistrado: reembolsoOk, movimientosOrigenMarcados, motivo, abono: ctx.abonoSnapshot });
    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    alert("Abono cancelado y saldos recalculados.");
    renderCancelaciones('abono');
};

window.abrirModalCancelarApartado = function(folio) {
    const ap = StorageService.get("apartados", []).find(a => a.folio === folio);
    if (!ap) return alert("No se encontró el apartado.");
    const cxc = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio || c.origenApartadoFolio === folio);
    const abonosApartadoVigentes = (ap.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
    const abonosCreditoVigentes = (cxc?.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
    const pagadoApartado = Number(ap.enganche || 0) + abonosApartadoVigentes.reduce((s, a) => s + Number(a.monto || 0), 0);
    const abonosCreditoPosteriores = abonosCreditoVigentes.reduce((s, a) => s + Number(a.monto || 0), 0);
    const monto = pagadoApartado + abonosCreditoPosteriores;
    const resumenApartadoCancelacion = `<b>Cliente:</b> ${_cancelEsc(ap.clienteNombre)}<br><b>Total apartado:</b> ${_cancelDinero(ap.importeApartado || ap.total || 0)}<br><b>Anticipos del apartado:</b> ${_cancelDinero(pagadoApartado)}<br><b>Abonos posteriores al credito:</b> ${_cancelDinero(abonosCreditoPosteriores)}<br><b>Pagado a devolver:</b> ${_cancelDinero(monto)}<br>Se cancelara el apartado y cualquier credito generado desde el.`;
    window._cancelacionActual = { tipo: 'apartado', folio, monto, cliente: ap.clienteNombre || 'Cliente' };
    _modalCancelacion({
        titulo: `Cancelar apartado ${_cancelEsc(folio)}`,
        monto,
        resumen: `<b>Cliente:</b> ${_cancelEsc(ap.clienteNombre)}<br><b>Total apartado:</b> ${_cancelDinero(ap.importeApartado || ap.total || 0)}<br><b>Pagado a devolver:</b> ${_cancelDinero(monto)}<br>Se cancelará el apartado y cualquier crédito generado desde él.`,
        onConfirm: "ejecutarCancelacionApartado()"
    });
};

window.abrirModalCancelarApartado = function(folio) {
    const ap = StorageService.get("apartados", []).find(a => a.folio === folio);
    if (!ap) return alert("No se encontro el apartado.");
    const cxc = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio);
    const pagadoApartado = Number(ap.enganche || 0) + (ap.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0);
    const abonosCreditoPosteriores = (cxc?.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0);
    const monto = pagadoApartado + abonosCreditoPosteriores;
    window._cancelacionActual = { tipo: 'apartado', folio, monto, cliente: ap.clienteNombre || 'Cliente' };
    _modalCancelacion({
        titulo: `Cancelar apartado ${_cancelEsc(folio)}`,
        monto,
        resumen: `<b>Cliente:</b> ${_cancelEsc(ap.clienteNombre)}<br><b>Total apartado:</b> ${_cancelDinero(ap.importeApartado || ap.total || 0)}<br><b>Anticipos del apartado:</b> ${_cancelDinero(pagadoApartado)}<br><b>Abonos posteriores al credito:</b> ${_cancelDinero(abonosCreditoPosteriores)}<br><b>Pagado a devolver:</b> ${_cancelDinero(monto)}<br>Se cancelara el apartado y cualquier credito generado desde el.`,
        onConfirm: "ejecutarCancelacionApartado()"
    });
};

window.ejecutarCancelacionApartado = function() {
    const ctx = window._cancelacionActual;
    if (!ctx || ctx.tipo !== 'apartado') return;
    const motivo = document.getElementById('cancelMotivo')?.value || 'Cancelación de apartado';
    const cuenta = _cancelCuentaSeleccionada('cancelCuentaReembolso');
    const emitir = document.getElementById('cancelEmitirComprobante')?.checked || false;

    const apartados = StorageService.get("apartados", []);
    const idx = apartados.findIndex(a => a.folio === ctx.folio);
    if (idx === -1) return alert("El apartado ya no existe.");
    const ap = apartados[idx];
    const foliosRelacionados = new Set([ctx.folio, ap.folioCredito].filter(Boolean).map(String));
    const esFolioRelacionado = folio => foliosRelacionados.has(String(folio || ''));
    ap.estado = 'Cancelado';
    ap.fechaCancelacion = _cancelIsoAhora();
    ap.motivoCancelacion = motivo;
    (ap.abonos || []).forEach(a => a.canceladoPorApartado = true);
    StorageService.set("apartados", apartados);
    foliosRelacionados.forEach(folioRel => _cancelLimpiarPendientesRelacionados(folioRel, motivo));

    const ventas = StorageService.get("ventasRegistradas", []).map(v => (esFolioRelacionado(v.folio) || v.folioApartadoOrigen === ctx.folio || v.origenApartadoFolio === ctx.folio || v.datosVenta?.origenApartadoFolio === ctx.folio) ? { ...v, estado: 'Cancelada', estatus: 'Cancelada', motivoCancelacion: motivo, fechaCancelacion: _cancelIsoAhora() } : v);
    StorageService.set("ventasRegistradas", ventas);
    const cuentas = StorageService.get("cuentasPorCobrar", []).map(c => (esFolioRelacionado(c.folio) || c.origenApartadoFolio === ctx.folio) ? { ...c, estado: 'Cancelado', saldoActual: 0, motivoCancelacion: motivo, fechaCancelacion: _cancelIsoAhora() } : c);
    StorageService.set("cuentasPorCobrar", cuentas);
    const pagares = StorageService.get("pagaresSistema", []).map(p => esFolioRelacionado(p.folio) ? { ...p, estado: 'Cancelado', nota: 'Cancelado por cancelación de apartado' } : p);
    StorageService.set("pagaresSistema", pagares);
    const salidas = StorageService.get("salidasPendientesVenta", []).map(s => esFolioRelacionado(s.folioVenta) ? { ...s, estatus: 'Cancelado', motivoCancelacion: motivo, fechaCancelacion: _cancelIsoAhora() } : s);
    StorageService.set("salidasPendientesVenta", salidas);
    const reqs = StorageService.get("requisicionesCompra", []).map(r => esFolioRelacionado(r.folioVenta) ? { ...r, estatus: 'Cancelada', motivoCancelacion: motivo } : r);
    StorageService.set("requisicionesCompra", reqs);
    const articulosReingresados = _cancelReingresarInventarioPorVenta(ctx.folio, motivo);
    const reversaConsignacion = _cancelReversarConsignacionPorVenta(ctx.folio, motivo);

    let movimientosOrigenMarcados = _cancelMarcarMovimientosOrigen({
        folio: ctx.folio,
        referenciaBase: `VENTA-${ctx.folio}`,
        motivo,
        tipoCancelacion: 'apartado'
    }) + _cancelMarcarMovimientosOrigen({
        folio: ctx.folio,
        referenciaBase: `ABN-APT-${ctx.folio}`,
        motivo,
        tipoCancelacion: 'apartado'
    });
    foliosRelacionados.forEach(folioRel => {
        movimientosOrigenMarcados += _cancelMarcarMovimientosOrigen({
            folio: folioRel,
            referenciaBase: `ABONO-${folioRel}`,
            motivo,
            tipoCancelacion: 'apartado'
        });
    });
    const reembolsoOk = _cancelRegistrarReembolso({
        monto: ctx.monto,
        cuentaId: cuenta.cuentaId,
        etiqueta: cuenta.etiqueta,
        concepto: `Devolución por cancelación de apartado ${ctx.folio}`,
        referencia: `CANCEL-APARTADO-${ctx.folio}`,
        clienteNombre: ctx.cliente,
        tipo: 'Cancelación de apartado',
        motivo,
        emitirComprobante: emitir
    });
    _cancelRegistrarHistorial({ tipo: 'apartado', folio: ctx.folio, clienteNombre: ctx.cliente, montoDevuelto: ctx.monto, movimientoCajaRegistrado: reembolsoOk, movimientosOrigenMarcados, motivo, articulosReingresados, reversaConsignacion });
    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    alert("Apartado cancelado y reversado.");
    if (reversaConsignacion.reversadas || reversaConsignacion.revision) {
        alert(`Consignacion: ${reversaConsignacion.reversadas} reversa(s) aplicada(s). ${reversaConsignacion.revision ? reversaConsignacion.revision + ' queda(n) para revision porque ya hubo pago real al proveedor.' : ''}`);
    }
    renderCancelaciones('apartado');
};

// 3. DETALLE DE ABONOS PENDIENTES (MODAL)
function _authFolioAbonoPendiente(a) {
    return String(a?.folioApartado || a?.folioCXC || '').trim();
}

function _authResolverAbonoPendiente(index) {
    const abonosP = StorageService.get("abonosPendientes", []);
    const ctx = window._authAbonoPendienteCtx;
    if (ctx) {
        const idxCtx = abonosP.findIndex(a =>
            String(a.idCuarentena || a.id || '') === String(ctx.id || '') ||
            (_authFolioAbonoPendiente(a) === ctx.folio && Number(a.montoAbonado || a.monto || 0) === Number(ctx.monto || 0))
        );
        if (idxCtx !== -1) return { abonosP, index: idxCtx, abono: abonosP[idxCtx] };
    }
    return { abonosP, index, abono: abonosP[index] };
}

function _authAbonoBloqueadoPorEstado(a) {
    if (!a) return { bloqueado: true, motivo: "El abono pendiente ya no existe." };
    if (String(a.estado || '').toLowerCase().includes('cancel')) return { bloqueado: true, motivo: "El abono pendiente fue cancelado." };
    if (a.aprobado || a.procesado || a.estado === 'Aprobado') return { bloqueado: true, motivo: "El abono pendiente ya fue procesado." };
    const folio = _authFolioAbonoPendiente(a);
    const monto = Number(a.montoAbonado || a.monto || 0);
    const idOperacion = String(a.idCuarentena || a.id || a.idOperacion || '');
    const esApartado = a.tipo === 'apartado' || a.origen === 'apartados' || a.folioApartado;
    const cuenta = esApartado
        ? StorageService.get("apartados", []).find(x => x.folio === folio)
        : StorageService.get("cuentasPorCobrar", []).find(x => x.folio === folio);
    if (!cuenta || String(cuenta.estado || '').toLowerCase().includes('cancel')) {
        return { bloqueado: true, motivo: `La cuenta ${folio || ''} no existe o esta cancelada.` };
    }
    const saldoActual = esApartado
        ? Number(cuenta.saldoPendiente || 0)
        : (typeof window._calcularEstadoCuenta === 'function'
            ? Number(window._calcularEstadoCuenta(folio)?.saldoTotal || 0)
            : Number(cuenta.saldoActual || 0));
    const politicaAbono = !esApartado && a.liquidacionPorPolitica && typeof window._cxcEvaluarPoliticaPagoAnticipado === 'function'
        ? window._cxcEvaluarPoliticaPagoAnticipado(folio, monto)
        : null;
    const maximoPermitido = Math.max(saldoActual, Number(politicaAbono?.montoLiquidacion || 0));
    if (monto > maximoPermitido + 0.01) {
        return { bloqueado: true, motivo: `El abono (${_cancelDinero(monto)}) excede el saldo vigente o el monto correcto por politica de ${folio}. Saldo: ${_cancelDinero(saldoActual)}. Politica: ${_cancelDinero(politicaAbono?.montoLiquidacion || saldoActual)}.` };
    }
    const yaAplicado = idOperacion && (cuenta.abonos || []).some(ab =>
        String(ab.idOperacion || ab.idCuarentena || ab.id || '') === idOperacion
    );
    if (yaAplicado) return { bloqueado: true, motivo: `Ya existe un abono igual aplicado en ${folio}.` };
    return { bloqueado: false, motivo: "" };
}

window.revisarAbonoPendiente = function(index) {
    const abonosP = StorageService.get("abonosPendientes", []);
    const a = abonosP[index];
    if (!a) return;
    window._authAbonoPendienteCtx = { index, id: a.idCuarentena || a.id, folio: _authFolioAbonoPendiente(a), monto: a.montoAbonado || a.monto || 0 };

    const fechaAbonoBase = a.fechaAbonoIso || a.fechaIso || a.fecha || (window.localISO ? window.localISO(new Date()) : new Date().toISOString());
    const fechaCorta = String(fechaAbonoBase).split('T')[0];
    const esApartado = a.tipo === 'apartado' || a.origen === 'apartados' || a.folioApartado;
    const folioRef = a.folioApartado || a.folioCXC || '-';
    const cuentaRef = esApartado
        ? StorageService.get("apartados", []).find(ap => ap.folio === folioRef)
        : StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folioRef);
    const clienteNombre = a.clienteNombre || cuentaRef?.nombre || cuentaRef?.clienteNombre || cuentaRef?.cliente?.nombre || '-';
    if (!a.clienteNombre && clienteNombre !== '-') {
        a.clienteNombre = clienteNombre;
        abonosP[index] = a;
        StorageService.set("abonosPendientes", abonosP);
    }

    const html = `
    <div data-modal="auth-abono" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:12px; width:100%; max-width:460px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
            <h3 style="color:#059669; margin-top:0;">Autorizar Abono Provisional ${esApartado ? 'de Apartado' : 'de Crédito'}</h3>
            <p style="font-size:14px; margin: 6px 0;"><strong>Folio ${esApartado ? 'Apartado' : 'Crédito'}:</strong> ${folioRef}</p>
            <p style="font-size:14px; margin: 6px 0;"><strong>Cliente:</strong> ${clienteNombre}</p>
            <p style="font-size:14px; margin: 6px 0;"><strong>Monto Abono:</strong> ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(a.montoAbonado)}</p>
            <p style="font-size:14px; margin: 6px 0;"><strong>Cuenta Receptora:</strong> ${a.etiquetaCuenta}</p>
            
            <label style="display:block; margin-top:15px; font-weight:bold; font-size:12px; color:#475569;">Fecha de Ingreso Oficial (Auditoría):</label>
            <input type="date" id="authFechaAbono" value="${fechaCorta}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box;">

            <label style="display:block; margin-top:15px; font-weight:bold; font-size:12px; color:#475569;">Agrupar transferencia para conciliacion:</label>
            <input type="text" id="authReferenciaTransferenciaAbono" placeholder="Ej. SPEI 123456, deposito 29-may"
                value="${_escapeHtml(a.referenciaBancaria || window._ultimaReferenciaTransferenciaAbono || '')}"
                style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box;">
            <small style="display:block; color:#64748b; margin-top:6px; line-height:1.35;">
                Usa la misma referencia al autorizar varios abonos de una sola transferencia. Si no aplica, dejalo vacio.
            </small>

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="aprobarAbonoCuarentena(${index})" style="flex:1; background:#22c55e; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">Ingresar a Caja</button>
                <button onclick="rechazarAbonoCuarentena(${index})" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">Eliminar</button>
                <button onclick="document.querySelector('[data-modal=auth-abono]').remove()" style="padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.aprobarAbonoCuarentena = function(index) {
    const resAbono = _authResolverAbonoPendiente(index);
    const abonosP = resAbono.abonosP;
    index = resAbono.index;
    const a = resAbono.abono;
    if (!a) return;
    const bloqueo = _authAbonoBloqueadoPorEstado(a);
    if (bloqueo.bloqueado) {
        alert(`${bloqueo.motivo} Se retirara de la boveda para evitar duplicidad.`);
        abonosP[index] = _marcarEstadoBoveda(abonosP[index], 'Rechazado', {
            fechaResolucionIso: _ventaFechaAhoraIso(),
            fechaResolucion: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : null,
            motivoResolucion: 'Bloqueado por estado'
        });
        StorageService.set("abonosPendientes", abonosP);
        document.querySelector('[data-modal=auth-abono]')?.remove();
        if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
        return;
    }
    
    const nuevaFechaCorta = document.getElementById('authFechaAbono').value;
    const nuevaFechaIso = window.localISO ? window.localISO(nuevaFechaCorta + 'T12:00:00') : new Date(nuevaFechaCorta + 'T12:00:00').toISOString();
    
    a.fechaAbonoIso = nuevaFechaIso;
    a.fechaAbonoStr = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(nuevaFechaIso)) : nuevaFechaCorta;
    const referenciaTransferencia = String(document.getElementById('authReferenciaTransferenciaAbono')?.value || '').trim();
    a.referenciaBancaria = referenciaTransferencia;
    a.grupoConciliacion = _authGrupoConciliacionDesdeReferencia(referenciaTransferencia);
    window._ultimaReferenciaTransferenciaAbono = referenciaTransferencia;

    const aplicado = window.ejecutarAbonoAutorizadoReal(a);
    if (aplicado === false) return;
    
    abonosP[index] = _marcarEstadoBoveda(abonosP[index], 'Aprobado', {
        fechaResolucionIso: _ventaFechaAhoraIso(),
        fechaResolucion: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : null,
        motivoResolucion: 'Autorizado por auditoría'
    });
    StorageService.set("abonosPendientes", abonosP);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BOVEDA_ABONO_APROBADO',
            modulo: 'CxC',
            entidad: 'abono',
            entidadId: _authFolioAbonoPendiente(a) || a?.folioCXC || a?.folioApartado || '',
            detalle: 'Abono aprobado desde la bóveda de autorizaciones',
            monto: Number(a?.montoAbonado || a?.monto || 0),
            severidad: 'info',
            datos: {
                folio: _authFolioAbonoPendiente(a) || a?.folioCXC || a?.folioApartado || '',
                estado: 'Aprobado'
            }
        });
    }
    document.querySelector('[data-modal=auth-abono]').remove();
    alert("Abono aprobado y registrado en flujo de caja.");
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
};

window.rechazarAbonoCuarentena = function(index) {
    if (!confirm("¿Deseas eliminar permanentemente este abono sin ingresarlo a caja?")) return;
    const resAbono = _authResolverAbonoPendiente(index);
    const abonosP = resAbono.abonosP;
    index = resAbono.index;
    if (!resAbono.abono) return;
    abonosP[index] = _marcarEstadoBoveda(abonosP[index], 'Rechazado', {
        fechaResolucionIso: _ventaFechaAhoraIso(),
        fechaResolucion: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : null,
        motivoResolucion: 'Rechazado por auditoría'
    });
    StorageService.set("abonosPendientes", abonosP);
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'BOVEDA_ABONO_RECHAZADO',
            modulo: 'CxC',
            entidad: 'abono',
            entidadId: _authFolioAbonoPendiente(resAbono.abono || a) || (resAbono.abono || a)?.folioCXC || (resAbono.abono || a)?.folioApartado || '',
            detalle: 'Abono rechazado desde la bóveda de autorizaciones',
            monto: Number((resAbono.abono || a)?.montoAbonado || (resAbono.abono || a)?.monto || 0),
            severidad: 'alerta',
            datos: {
                folio: _authFolioAbonoPendiente(resAbono.abono || a) || (resAbono.abono || a)?.folioCXC || (resAbono.abono || a)?.folioApartado || '',
                estado: 'Rechazado'
            }
        });
    }
    document.querySelector('[data-modal=auth-abono]').remove();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
};

// Exponer la función globalmente para poder llamarla desde un botón
window.abrirAuditoriaCxC = abrirAuditoriaCxC;

// ============================================================
// EXPOSICIN GLOBAL PARA QUE HTML Y EL MENENCUENTREN LAS FUNCIONES
// ============================================================
window.renderCarrito = renderCarrito;
window.agregarAlCarrito = agregarAlCarrito;
window.agregarAlCarritoDesdeModal = agregarAlCarritoDesdeModal;
window.eliminarDelCarrito = eliminarDelCarrito;
window.actualizarCantidadCarrito = actualizarCantidadCarrito;
window.cambiarPrecioCarrito = cambiarPrecioCarrito;
window.actualizarColorCarrito = actualizarColorCarrito;
window.actualizarUbicacionCarrito = actualizarUbicacionCarrito;
// ═══════════════════════════════════════════════════════════════════════════
// RECIBO DE ENGANCHE / ANTICIPO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Genera e imprime un recibo térmico (80mm) para el enganche o anticipo
 * entregado al momento de una venta a crédito o apartado.
 * @param {object} datosVenta  – objeto datosVenta completo de la venta
 * @param {string} modoEnganche – forma de pago del enganche (p.ej. "efectivo", "transferencia")
 * @param {string} etiquetaCuenta – texto legible de la cuenta receptora
 */
function generarTicketEnganche(datosVenta, modoEnganche, etiquetaCuenta) {
    const enganche = Number(datosVenta?.enganche || 0);
    if (enganche <= 0) return;

    const esc      = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const fmt      = v => '$' + Number(v).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2});
    const folio    = datosVenta.folio    || 'S/F';
    const fecha    = datosVenta.fecha    || new Date().toLocaleDateString('es-MX');
    const cliente  = datosVenta.cliente  || {};
    const metodo   = String(datosVenta.metodo || '');
    const saldo    = Number(datosVenta.saldoPendiente || 0);
    const arts     = Array.isArray(datosVenta.articulos) ? datosVenta.articulos : [];

    const esApartado  = metodo === 'apartado';
    const tipoRecibo  = esApartado ? 'RECIBO DE ANTICIPO' : 'RECIBO DE ENGANCHE';
    const labelMonto  = esApartado ? 'ANTICIPO RECIBIDO:' : 'ENGANCHE RECIBIDO:';

    const articulosHTML = arts.length ? `
        <div class="seccion-titulo">ARTÍCULOS</div>
        <table>
            <tbody>
                ${arts.map(a => `
                <tr>
                    <td style="font-size:10px;">${esc(a.nombre || '-')}</td>
                    <td style="text-align:right;font-size:10px;white-space:nowrap;">x${a.cantidad || 1}</td>
                    <td style="text-align:right;font-size:10px;white-space:nowrap;">${fmt((a.precioContado || 0) * (a.cantidad || 1))}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : '';

    const baseUrl = window.location.href.split('?')[0].split('#')[0];

    const ticketHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>${tipoRecibo} – ${folio}</title>
    <base href="${baseUrl}">
    <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: 'Courier New', monospace; font-size: 11px; width: 72mm; margin: 4mm auto; color: #000; background: #f3f4f6; }
        .centro { text-align: center; }
        .negrita { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #333; margin: 6px 0; }
        .monto-grande { font-size: 20px; font-weight: bold; text-align: center; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .seccion-titulo { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; font-size: 10px; margin: 5px 0 3px 0; }
        .fila { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
        #ticket-contenido { background: #ffffff; padding: 10px; padding-bottom: 20px; box-sizing: border-box; }
        .firma-linea { border-top: 1px solid #333; width: 70%; margin: 14px auto 3px; }
        @media print { .no-print { display: none !important; } body { background: white; margin: 0; } #ticket-contenido { padding: 0; } }
    </style>
</head>
<body>
<div id="ticket-contenido">
    <div class="centro">
        <img src="img/Logo.svg" style="width:60px; height:60px; object-fit:contain;"
             onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
        <div class="negrita" style="font-size:14px; margin-top:4px;">MUEBLERÍA MI PUEBLITO</div>
        <div>Santiago Cuaula, Tlaxcala</div>
    </div>
    <hr>
    <div class="centro negrita" style="font-size:13px;">── ${tipoRecibo} ──</div>
    <div class="fila"><span>Folio Venta:</span><span class="negrita">${esc(folio)}</span></div>
    <div class="fila"><span>Fecha:</span><span>${esc(fecha)}</span></div>
    <hr>
    <div class="negrita">CLIENTE</div>
    <div>${esc(cliente.nombre || '—')}</div>
    ${cliente.telefono ? `<div style="font-size:10px;">Tel: ${esc(cliente.telefono)}</div>` : ''}
    ${arts.length ? `<hr>${articulosHTML}` : ''}
    <hr>
    <div class="seccion-titulo">${labelMonto}</div>
    <div class="monto-grande">${fmt(enganche)}</div>
    <div class="fila"><span>Saldo pendiente:</span><span class="negrita">${fmt(saldo)}</span></div>
    <div class="fila"><span>Forma de pago:</span><span>${esc(etiquetaCuenta || modoEnganche || 'Efectivo')}</span></div>
    <hr>
    <div class="centro" style="margin-top:10px;">
        <div class="firma-linea"></div>
        <div class="negrita" style="font-size:10px;">FIRMA DEL CLIENTE</div>
    </div>
    <div class="centro" style="margin-top:10px; font-size:10px;">★ Gracias por su preferencia ★</div>
</div>
<div class="no-print" style="text-align:center; padding:14px; margin-top:8px;">
    <button onclick="window.print()"
            style="padding:10px 18px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:13px;">
        🖨️ Imprimir recibo
    </button>
</div>
</body>
</html>`;

    if (window.TicketService?.openHtml) {
        window.TicketService.openHtml(ticketHTML, { title: `${tipoRecibo} ${folio}` });
        return;
    }
    const w = window.open('', '_blank', 'width=440,height=620');
    if (!w) { alert('Habilita las ventanas emergentes para imprimir el recibo de enganche.'); return; }
    w.document.write(ticketHTML);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch(e) {} }, 350);
}

/**
 * Reimprime el recibo de enganche de una venta ya registrada,
 * leyendo los datos desde cuentasPorCobrar o apartados según el tipo.
 * @param {string} folio  – folio de la venta
 */
function reimprimirTicketEnganche(folio) {
    const folioStr = String(folio || '').trim();
    let datosVenta = null, modoEnganche = 'Efectivo', etiquetaCuenta = 'Efectivo';

    // Intentar desde cuentasPorCobrar (ventas a crédito)
    const cuentas = StorageService.get('cuentasPorCobrar', []);
    const cuenta  = cuentas.find(c => String(c.folio || c.folioVenta || '') === folioStr);
    if (cuenta) {
        datosVenta = {
            folio:          cuenta.folio || cuenta.folioVenta || folioStr,
            fecha:          cuenta.fechaVenta || cuenta.fecha || '',
            cliente:        { nombre: cuenta.nombre || cuenta.clienteNombre || '—', telefono: cuenta.telefono || '' },
            metodo:         'credito',
            enganche:       Number(cuenta.enganche || cuenta.anticipo || 0),
            saldoPendiente: Number(cuenta.saldoActual ?? cuenta.saldoPendiente ?? cuenta.importeTotal ?? 0),
            articulos:      cuenta.articulos || []
        };
        modoEnganche  = cuenta.modoEnganche || 'Efectivo';
        etiquetaCuenta = cuenta.etiquetaCuentaEnganche || cuenta.etiquetaCuenta || 'Efectivo';
    }

    // Intentar desde apartados
    if (!datosVenta) {
        const apartados = StorageService.get('apartados', []);
        const apt = apartados.find(a => String(a.folio || '') === folioStr);
        if (apt) {
            datosVenta = {
                folio:          apt.folio || folioStr,
                fecha:          apt.fechaApartado || apt.fecha || '',
                cliente:        { nombre: apt.clienteNombre || apt.cliente?.nombre || '—', telefono: apt.clienteTelefono || '' },
                metodo:         'apartado',
                enganche:       Number(apt.anticipo || apt.enganche || apt.importeApartado || 0),
                saldoPendiente: Number(apt.saldoPendiente ?? apt.saldo ?? 0),
                articulos:      apt.articulos || []
            };
            modoEnganche  = apt.modoEnganche  || 'Efectivo';
            etiquetaCuenta = apt.etiquetaCuentaEnganche || 'Efectivo';
        }
    }

    if (!datosVenta || Number(datosVenta.enganche || 0) <= 0) {
        alert(`No se encontró información de enganche/anticipo para el folio ${folioStr}.\n\nVerifica que la venta sea a crédito o apartado y que haya tenido enganche.`);
        return;
    }

    generarTicketEnganche(datosVenta, modoEnganche, etiquetaCuenta);
}

/**
 * Punto de entrada unificado para reimpresiones desde el panel de Operación.
 * Si el usuario no es admin, solicita PIN de autorización antes de proceder.
 * @param {string} folio   – folio del documento a reimprimir
 * @param {string} origen  – tipo: 'contado' | 'credito' | 'apartado' | 'entrega_mcia' |
 *                           'devolucion_cancelacion' | 'enganche'
 */
window.reimprimirConAutorizacion = function(folio, origen) {
    const _ejecutar = () => {
        if (origen === 'enganche') {
            reimprimirTicketEnganche(folio);
        } else if (typeof reimprimirFolioUnificado === 'function') {
            reimprimirFolioUnificado(folio, origen);
        } else {
            reimprimirTicketVenta(folio);
        }
    };

    // Admin directo: sin PIN
    if (typeof _esAdmin === 'function' && _esAdmin()) {
        _ejecutar();
        return;
    }

    // No admin: pedir autorización
    if (typeof window.requireAdmin === 'function') {
        window.requireAdmin(_ejecutar);
    } else {
        // Fallback: ejecutar de todas formas (requireAdmin no disponible)
        _ejecutar();
    }
};

window.reimprimirTicketEnganche = reimprimirTicketEnganche;
window.generarTicketEnganche    = generarTicketEnganche;

window.actualizarInterfazPago = actualizarInterfazPago;
window.seleccionarPlan = seleccionarPlan;
window.confirmarVentaFinal = confirmarVentaFinal;
window.cancelarYVolverAlCarrito = cancelarYVolverAlCarrito;
window.seleccionarOrigenInventario = seleccionarOrigenInventario;
window.setDecisionInventario = setDecisionInventario;
window.cambiarColorInventario = cambiarColorInventario;
window.cambiarUbicacionInventario = cambiarUbicacionInventario;
window.mostrarDialogoInventario = mostrarDialogoInventario;
window.abrirDetalleEntrega = abrirDetalleEntrega;
window.renderEntregas = renderEntregas;
window.generarValeEntrega = generarValeEntrega;
window.renderCancelaciones = renderCancelaciones;
window.renderReimprimirVenta = window.renderReimprimirVenta || renderReimprimirVenta;
window.reimprimirTicketVenta = reimprimirTicketVenta;
window.limpiarFiltrosReimpresion = window.limpiarFiltrosReimpresion || limpiarFiltrosReimpresion;

