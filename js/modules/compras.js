// === AUDITORÍA: VISUALIZAR HISTORIAL DE COSTOS ===
function renderHistorialCostosAuditoria() {
    // Obtener productos
    let productos = [];
    try {
        productos = StorageService.get('productos', []);
    } catch (e) { productos = []; }
    const cont = document.getElementById('contenedorHistorialCostosAuditoria');
    if (!cont) return;
    // Selector de producto (picker dinámico)
    let html = `<div style="margin-bottom:18px;display:flex;align-items:center;gap:10px;">
        <label style='font-weight:bold;white-space:nowrap;'>Producto:</label>
        <input type="hidden" id="selectProductoHistorialCostos" value="">
        <span id="selectProductoHistorialCostos-display"
              style="flex:1;padding:7px 12px;font-size:15px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;">Sin seleccionar</span>
        <button type="button"
                onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){
                    document.getElementById('selectProductoHistorialCostos').value=p.id;
                    var d=document.getElementById('selectProductoHistorialCostos-display');
                    d.textContent=p.nombre; d.style.color='#111827';
                    mostrarTablaHistorialCostos(p.id);
                }})"
                style="padding:7px 14px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:14px;">
            🔍 Buscar
        </button>
    </div>
    <div id='tablaHistorialCostos'></div>`;
    cont.innerHTML = html;
    // El picker llama directamente a mostrarTablaHistorialCostos al seleccionar
}

function mostrarTablaHistorialCostos(productoId) {
    const tablaDiv = document.getElementById('tablaHistorialCostos');
    if (!productoId) { tablaDiv.innerHTML = ''; return; }
    const historial = obtenerHistorialCostosPorProducto(productoId);
    if (!historial.length) {
        tablaDiv.innerHTML = `<div style='color:#64748b;padding:12px;'>No hay historial de costos para este producto.</div>`;
        return;
    }
    let html = `<table style='width:100%;border-collapse:collapse;margin-top:10px;'>
        <thead><tr style='background:#f3f4f6;'>
            <th style='padding:8px;text-align:left;'>Fecha</th>
            <th style='padding:8px;text-align:right;'>Precio</th>
            <th style='padding:8px;text-align:right;'>Cantidad</th>
            <th style='padding:8px;text-align:left;'>Proveedor</th>
            <th style='padding:8px;text-align:left;'>Origen</th>
        </tr></thead><tbody>`;
    historial.slice().reverse().forEach(item => {
        html += `<tr>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;'>${item.fecha}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;'>$${item.precioCompra}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;text-align:right;'>${item.cantidad}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;'>${item.proveedorNombre}</td>
            <td style='padding:7px 8px;border-bottom:1px solid #e5e7eb;'>${item.origen}</td>
        </tr>`;
    });
    html += '</tbody></table>';
    tablaDiv.innerHTML = html;
}
/**
 * Obtiene el historial de costos de un producto por su ID.
 * @param {number|string} productoId
 * @returns {Array} Historial de costos del producto
 */
function obtenerHistorialCostosPorProducto(productoId) {
    const historial = StorageService.get('historialCostos', []);
    return historial.filter(item => String(item.productoId) === String(productoId));
}

// Ejemplo de uso: mostrar historial en consola
// Llama a esta función pasando el ID del producto que deseas consultar
function mostrarHistorialCostosEnConsola(productoId) {
    const historial = obtenerHistorialCostosPorProducto(productoId);
    if (historial.length === 0) {
        console.log('No hay historial de costos para este producto.');
        return;
    }
    console.log('Historial de costos para producto', productoId);
    historial.forEach(item => {
        console.log(`Fecha: ${item.fecha} | Precio: $${item.precioCompra} | Cantidad: ${item.cantidad} | Proveedor: ${item.proveedorNombre} | Origen: ${item.origen}`);
    });
}
// ===== CONTROL DE COSTOS =====
/** Guarda el historial de costos de productos en localStorage y Firebase. */
function guardarHistorialCosto({ productoId, precioCompra, fecha, cantidad, proveedorId, proveedorNombre, origen }) {
    let historial = StorageService.get('historialCostos', []);
    historial.push({
        productoId,
        precioCompra,
        fecha,
        cantidad,
        proveedorId,
        proveedorNombre,
        origen
    });
    StorageService.set('historialCostos', historial);
}
// ===== PROVEEDORES =====

function guardarProveedor() {
    const nombreInput   = document.getElementById("provNombre");
    const contactoInput = document.getElementById("provContacto");
    const nombre   = nombreInput.value.trim();
    const contacto = contactoInput.value.trim();

    if (!nombre) return alert("⚠️ El nombre del proveedor es obligatorio.");

    proveedores.push({ id: Date.now(), nombre, contacto, saldoDeuda: 0 });
    if (!StorageService.set("proveedores", proveedores)) {
        alert("❌ Error guardando proveedor");
        return;
    }

    nombreInput.value   = "";
    contactoInput.value = "";
    renderProveedores();
}

function renderProveedores() {
    const cont = document.getElementById("tablaProveedores");
    if (!cont) return;

    if (proveedores.length === 0) {
        cont.innerHTML = "<p style='color:gray; padding:20px;'>No hay proveedores registrados.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    proveedores.forEach(p => {
        html += `
            <tr>
                <td><b>${p.nombre}</b></td>
                <td>${p.contacto || '-'}</td>
                <td style="text-align:center;">
                    <button onclick="eliminarProveedor(${p.id})" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
                </td>
            </tr>`;
    });
    cont.innerHTML = html + "</tbody></table>";
}

function eliminarProveedor(id) {
    if (confirm("¿Estás seguro de eliminar este proveedor?")) {
        proveedores = proveedores.filter(p => p.id !== id);
        if (!StorageService.set("proveedores", proveedores)) {
            console.error("❌ Error eliminando proveedor");
            return;
        }
        renderProveedores();
    }
}

// ===== HELPERS FINANCIEROS (ENCHUFE UNIVERSAL) =====

window._buildSelectorCuentas = function(idSelect, soloDebito = false) {
    const cajas = soloDebito ? [] : StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo Principal', saldo: 0 }]);
    
    // LA SOLUCIÓN: Leemos directamente de la fuente maestra (tarjetasConfig) 
    // que es la que sobrevive a los respaldos de JSON.
    const tarjetas = StorageService.get('tarjetasConfig', []);
    
    // Mapeamos las tarjetas de débito. 
    // IMPORTANTE: el ID debe ser el nombre del banco (t.banco) para que 
    // las matemáticas del dashboard de Liquidez cuadren exactas.
    const debito = tarjetas.filter(t => t.tipo === "debito").map(t => ({
        id: t.banco, 
        nombre: `🏦 ${t.banco}${t.ultimos4 ? ' ••••' + t.ultimos4 : ''}`
    }));

    const todas = [...cajas, ...debito];
    const opts = todas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    return `<select id="${idSelect}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;box-sizing:border-box;">${opts}</select>`;
};

window._egresarCuenta = function({ monto, cuentaId, etiqueta, concepto, referencia, fecha }) {
    // Detectar si el ID es de una caja de efectivo
    const isCaja = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    
    if (isCaja) {
        let cef = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo Principal', saldo: 0 }]);
        const c = cef.find(x => String(x.id) === String(cuentaId));
        if (c) c.saldo = (Number(c.saldo) || 0) - monto;
        else if (cef.length > 0) cef[0].saldo = (Number(cef[0].saldo) || 0) - monto; // Fallback
        StorageService.set('cuentasEfectivo', cef);
    } else {
        let cban = StorageService.get('cuentas-bancarias', []);
        const c = cban.find(x => String(x.id) === String(cuentaId) || x.banco === cuentaId);
        if (c) c.saldo = (Number(c.saldo) || 0) - monto;
        StorageService.set('cuentas-bancarias', cban);
    }

    // Registrar en el flujo de caja
    const movs = StorageService.get('movimientosCaja', []);
    movs.push({
        id: Date.now() + Math.random(),
        tipo: 'egreso',
        concepto,
        monto,
        // 👇 AHORA TOMA LA FECHA QUE ELIJAS 👇
        fecha: fecha || window.localISO(new Date()),
        cuenta: cuentaId,
        etiquetaCuenta: etiqueta || cuentaId,
        medioPago: isCaja ? 'efectivo' : 'transferencia',
        referencia
    });
    StorageService.set('movimientosCaja', movs);
};
window._ingresarCuenta = function({ monto, cuentaId, etiqueta, concepto, referencia, fecha }) {
    const cuentaRealId = (cuentaId === 'caja') ? 'efectivo' : cuentaId;
    const isCaja = String(cuentaRealId).startsWith('caja_') || cuentaRealId === 'efectivo';
    
    if (isCaja) {
        let cef = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo Principal', saldo: 0 }]);
        const c = cef.find(x => String(x.id) === String(cuentaRealId));
        if (c) c.saldo = (Number(c.saldo) || 0) + monto;
        else if (cef.length > 0) cef[0].saldo = (Number(cef[0].saldo) || 0) + monto; 
        StorageService.set('cuentasEfectivo', cef);
    } else {
        let cban = StorageService.get('cuentas-bancarias', []);
        const c = cban.find(x => String(x.id) === String(cuentaRealId) || x.banco === cuentaRealId);
        if (c) c.saldo = (Number(c.saldo) || 0) + monto;
        StorageService.set('cuentas-bancarias', cban);
    }

    const movs = StorageService.get('movimientosCaja', []);
    movs.push({
        id: Date.now() + Math.random(),
        tipo: 'ingreso',
        concepto,
        monto,
        // 👇 AHORA TOMA LA FECHA QUE LE MANDES, O USA HOY SI NO MANDAS NADA
        fecha: fecha || window.localISO(new Date()), 
        cuenta: cuentaRealId,
        etiquetaCuenta: etiqueta || cuentaRealId,
        medioPago: isCaja ? 'efectivo' : 'transferencia',
        referencia
    });
    StorageService.set('movimientosCaja', movs);
};

function _getCuentaSeleccionada(sufijo) {
    let sel = document.getElementById(`cuentaOrigen_${sufijo}`) || document.getElementById('compraCuentaOrigen');
    if (!sel) return { medioPago: 'efectivo', cuentaId: 'efectivo', etiqueta: '💵 Efectivo Principal' };
    
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const isCaja = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    
    return { medioPago: isCaja ? 'efectivo' : 'debito', cuentaId, etiqueta };
}

// ===== COMPRAS =====
function prepararVistaCompras() {
    // compraProducto es ahora un hidden input + picker dinámico (ver index.html)
    const hidProd     = document.getElementById("compraProducto");
    const displayProd = document.getElementById("compraProducto-display");
    if (hidProd && displayProd && !hidProd.value) {
        displayProd.textContent = 'Sin seleccionar';
        displayProd.style.color = '#6b7280';
    }

    const selProv = document.getElementById("compraProveedor");
    if (selProv) {
        selProv.innerHTML = proveedores.length === 0
            ? '<option value="">-- NO HAY PROVEEDORES --</option>'
            : '<option value="">-- Selecciona Proveedor --</option>' +
              proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
    actualizarSelectBancos();
    _poblarCuentasOrigen();
    gestionarCamposPago();
}

function _poblarCuentasOrigen(targetId = "compraCuentaOrigen") {
    const sel = document.getElementById(targetId);
    if (!sel) return;
    
    // 1. Obtenemos el efectivo
    const efectivo = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo", saldo: 0 }]);
    
    // 2. Obtenemos las tarjetas bancarias
    const bancarias = StorageService.get("cuentas-bancarias", []);
    
    // 3. Filtramos para que solo aparezcan las de "debito"
    const debito = bancarias.filter(c => 
        c.tipo && c.tipo.toLowerCase().includes("debito")
    );
    
    // 4. Unimos ambos y llenamos el selector
    const todas = [...efectivo, ...debito];
    sel.innerHTML = todas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
}

function actualizarSelectBancos() {
    const select = document.getElementById("compraBancoSeleccionado");
    if (!select) return;
    const bancosMSI = tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito");
    select.innerHTML = bancosMSI.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
}

function gestionarCamposPago() {
    const metodo   = document.getElementById("compraMetodoPago")?.value;
    const divBanco  = document.getElementById("divSeleccionBanco");
    const divMeses  = document.getElementById("divMeses");
    const divCuenta = document.getElementById("divCuentaOrigen");
    if (!metodo) return;

    // Cuenta origen solo aplica para pago de contado (sale dinero inmediatamente)
    if (divCuenta) divCuenta.style.display = (metodo === 'contado') ? 'block' : 'none';
    if (divBanco)  divBanco.style.display  = (metodo === 'tarjeta_msi') ? 'block' : 'none';
    if (divMeses)  divMeses.style.display  = (metodo === 'tarjeta_msi') ? 'block' : 'none';

    actualizarSelectBancos();
}

// Función para cargar las ubicaciones en el select cuando el usuario le da clic
function cargarUbicacionesCompra() {
    const select = document.getElementById("compraUbicacion");
    // Si ya tiene más de 1 opción, significa que ya cargó, no lo volvemos a cargar
    if (!select || select.options.length > 1) return; 
    
    const ubicaciones = StorageService.get("ubicacionesConfig", []);
    let html = '<option value="General">-- General --</option>';
    ubicaciones.forEach(u => {
        html += `<option value="${u.nombre}">${u.nombre}</option>`;
    });
    select.innerHTML = html;
}

// Función principal de registro de compras actualizada
function registrarCompra() {
    const productoId  = parseInt(document.getElementById("compraProducto").value);
    const proveedorId = parseInt(document.getElementById("compraProveedor").value);
    const cantidad    = parseInt(document.getElementById("compraCantidad").value);
    const costoNuevo  = parseFloat(document.getElementById("compraCosto").value);
    const comboPago   = document.getElementById("compraMetodoPago");
    const metodo      = comboPago.value;
    const formaPagoTexto = comboPago.options[comboPago.selectedIndex].text;
    const ingresoInmediato = document.getElementById("compraIngresoInmediato")?.checked ?? true;

    // 👇 1. LEEMOS EL COLOR Y LA UBICACIÓN 👇
    const colorNuevo = document.getElementById("compraColor")?.value.trim() || 'General';
    const ubicacionNueva = document.getElementById("compraUbicacion")?.value || 'General';

    if (!proveedorId || !productoId || isNaN(cantidad) || isNaN(costoNuevo) || cantidad <= 0) {
        alert("⚠️ Por favor completa todos los campos correctamente.");
        return;
    }

    const prov    = proveedores.find(p => p.id == proveedorId);
    const producto = productos.find(p => String(p.id) === String(productoId));
    if (!prov || !producto) return alert("⚠️ Proveedor o producto no encontrado.");

    const bancoSel = document.getElementById("compraBancoSeleccionado")?.value || "";
    const cuentaOrigenId = document.getElementById("compraCuentaOrigen")?.value || "efectivo";
    const cuentaOrigenNombre = document.getElementById("compraCuentaOrigen")?.options[document.getElementById("compraCuentaOrigen")?.selectedIndex]?.text || "Efectivo";
    const fechaHoyISO  = window.getFechaLocalMX();
    const fechaHoyStr  = fechaHoyISO.split('-').reverse().join('/');
    const fechaPagoMensaje = (metodo === "contado") ? "Hoy (Contado)" : calcularFechaPago(fechaHoyStr, bancoSel);

    const mensajeConfirmar =
        `¿Deseas registrar esta compra?\n\n` +
        `Proveedor: ${prov.nombre}\n` +
        `Producto: ${producto.nombre} (${colorNuevo})\n` +
        `Ubicación destino: ${ubicacionNueva}\n` +
        `Total: ${dinero(cantidad * costoNuevo)}\n` +
        `Pago Estimado: ${fechaPagoMensaje}`;

    if (!confirm(mensajeConfirmar)) return;

    let avisoActualizacion = "";
    if (costoNuevo > producto.costo) {
        const costoAnterior = producto.costo;
        const precioAnterior = producto.precio;
        let margenAplicar = 30;
        categoriasData.forEach(cat => {
            const sub = cat.subcategorias.find(s => s.nombre === producto.subcategoria);
            if (sub) margenAplicar = sub.margen;
        });
        const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(costoNuevo, margenAplicar);
        producto.costo  = costoNuevo;
        producto.precio = nuevoPrecio;
        avisoActualizacion = `\n\n📢 ¡ACTUALIZACIÓN DE PRECIOS!\n` +
            `Costo: ${dinero(costoAnterior)} ➡️ ${dinero(costoNuevo)}\n` +
            `Precio: ${dinero(precioAnterior)} ➡️ ${dinero(nuevoPrecio)}\n` +
            `Margen aplicado: ${margenAplicar}%`;
    }

    const totalCompra = cantidad * costoNuevo;
    const caracteristicas = document.getElementById("compraCaracteristicas")?.value || "";

    const nuevaCompra = {
        id: Date.now(),
        productoId,
        productoNombre: producto.nombre,   
        proveedor: prov.nombre,
        proveedorId,
        total: totalCompra,
        fecha: fechaHoyStr,
        fechaISO: fechaHoyISO,
        caracteristicas,
        color: colorNuevo,           // <-- Guardamos el color en el historial
        ubicacion: ubicacionNueva    // <-- Guardamos la ubicación en el historial
    };
    compras.push(nuevaCompra);

    const caracteristicasInput = document.getElementById("compraCaracteristicas");
    if (caracteristicasInput) caracteristicasInput.value = "";
    const colorInput = document.getElementById("compraColor");
    if (colorInput) colorInput.value = "";
    const ubicacionInput = document.getElementById("compraUbicacion");
    if (ubicacionInput) ubicacionInput.value = "General";

    guardarHistorialCosto({
        productoId,
        precioCompra: costoNuevo,
        fecha: fechaHoyStr,
        cantidad,
        proveedorId,
        proveedorNombre: prov.nombre,
        origen: 'compra directa'
    });

    const nuevaRecepcion = {
        id: Date.now() + 1,
        compraId: nuevaCompra.id,
        productoId,
        productoNombre: producto.nombre,
        cantidadTotal: cantidad,
        cantidadRecibida: ingresoInmediato ? cantidad : 0,
        cantidadPendiente: ingresoInmediato ? 0 : cantidad,
        proveedor: prov.nombre,
        fechaPedido: nuevaCompra.fecha,
        metodoPago: formaPagoTexto,
        estatus: ingresoInmediato ? "Completado" : "Pendiente",
        color: colorNuevo,           // <-- Sabe de qué color viene
        ubicacion: ubicacionNueva    // <-- Sabe a qué bodega va
    };
    recepciones.push(nuevaRecepcion);

    // 👇 2. DISTRIBUIR EL STOCK EN LAS VARIANTES SI ENTRA INMEDIATAMENTE 👇
    if (ingresoInmediato) {
        // Actualiza el stock general (tu función original)
        actualizarStock(productoId, cantidad, `Compra a ${prov.nombre} (${colorNuevo})`);

        // Actualizamos la "cajita" específica (Color + Ubicación)
        if (!producto.variantes) producto.variantes = [];
        
        const varianteExistente = producto.variantes.find(v => 
            (v.color || "General").toUpperCase() === colorNuevo.toUpperCase() && 
            (v.ubicacion || "General").toUpperCase() === ubicacionNueva.toUpperCase()
        );

        if (varianteExistente) {
            varianteExistente.stock = (Number(varianteExistente.stock) || 0) + cantidad;
        } else {
            producto.variantes.push({
                color: colorNuevo,
                ubicacion: ubicacionNueva,
                stock: cantidad
            });
        }
    }

    if (metodo !== "contado") {
        const detalleDeuda = {
            id: Date.now() + 2,
            compraId: nuevaCompra.id,
            proveedor: prov.nombre,
            producto: producto.nombre,
            cantidad,
            total: totalCompra,
            saldoPendiente: totalCompra,
            metodo,
            formaPagoTexto,
            banco: bancoSel,
            meses: parseInt(document.getElementById("compraMeses")?.value) || 1,
            fecha: nuevaCompra.fecha,
            vencimiento: fechaPagoMensaje
        };

        if (metodo === "credito_proveedor") {
            let cuentasProv = StorageService.get("cuentasPorPagar", []);
            cuentasProv.push(detalleDeuda);
            if (!StorageService.set("cuentasPorPagar", cuentasProv)) {
                console.error("❌ Error guardando cuentas por pagar");
            }
        }

        if (metodo === "tarjeta_msi") {
            let cuentasBancos = StorageService.get("cuentasMSI", []);
            const numMeses = parseInt(document.getElementById("compraMeses").value) || 12;
            cuentasBancos.push({
                id: Date.now() + 3,
                compraId: nuevaCompra.id,
                banco: bancoSel,
                concepto: `Compra: ${producto.nombre} (Prov: ${prov.nombre})`, // 🔥 INYECCIÓN DE AUDITORÍA
                producto: producto.nombre,
                total: totalCompra,
                meses: numMeses,
                cuotaMensual: totalCompra / numMeses,
                fechaCompra: nuevaCompra.fecha,
                calendario: calcularCalendarioMSI(new Date(), numMeses, bancoSel),
                pagosRealizados: 0
            });
            if (!StorageService.set("cuentasMSI", cuentasBancos)) {
                console.error("❌ Error guardando cuentas MSI");
            }
        }
    }

    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("compras", compras)) {
        console.error("❌ Error guardando compras");
    }
    if (!StorageService.set("recepciones", recepciones)) {
        console.error("❌ Error guardando recepciones");
    }

    if (metodo === "contado") {
        window._egresarCuenta({
            monto: totalCompra, cuentaId: cuentaOrigenId, etiqueta: cuentaOrigenNombre,
            concepto: `Compra de contado — ${producto.nombre} a ${prov.nombre}`, referencia: `COMPRA-${nuevaCompra.id}`
        });
    }

    alert(`✅ Registro Exitoso\nProveedor: ${prov.nombre}${avisoActualizacion}`);
    
    // Si la función limpiarFormularioCompra existe, la ejecuta
    if(typeof limpiarFormularioCompra === 'function') limpiarFormularioCompra();
    
    navA('compras');
}

function limpiarFormularioCompra() {
    const ids = ["compraCantidad", "compraCosto"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    // compraProducto es hidden input + display span (picker dinámico)
    const hidProd     = document.getElementById("compraProducto");
    const displayProd = document.getElementById("compraProducto-display");
    if (hidProd)     { hidProd.value = ""; }
    if (displayProd) { displayProd.textContent = 'Sin seleccionar'; displayProd.style.color = '#6b7280'; }
    const selProv    = document.getElementById("compraProveedor");
    const selPago    = document.getElementById("compraMetodoPago");
    const chkIngreso = document.getElementById("compraIngresoInmediato");
    if (selProv) selProv.selectedIndex = 0;
    if (selPago) selPago.selectedIndex = 0;
    if (chkIngreso) chkIngreso.checked = true;
}

// ===== RECEPCIONES =====
function renderRecepciones() {
    const contenedor = document.getElementById("listaRecepcionesPendientes");
    if (!contenedor) return;

    let recs = StorageService.get("recepciones", []);
    let pendientes = recs.filter(r => r.estatus === "Pendiente");

    if (pendientes.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ No hay mercancía pendiente de recibir.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Producto</th>
                <th>Pedido</th>
                <th>Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    pendientes.forEach(r => {
        html += `
            <tr>
                <td>${r.fechaPedido}<br><strong>${r.proveedor}</strong></td>
                <td>${r.productoNombre}<br><small>Pago: ${r.metodoPago}</small></td>
                <td>${r.cantidadTotal}</td>
                <td style="color:red; font-weight:bold;">${r.cantidadPendiente}</td>
                <td>
                    <button onclick="procesarRecepcionFisica(${r.id})" style="background:#27ae60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        📥 Recibir
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

// --- MOTOR DE RECEPCIÓN FÍSICA MULTI-BODEGA ---
function procesarRecepcionFisica(idRecepcion) {
    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return alert("❌ Error: Recepción no encontrada.");
    const rec = recs[index];

    // Extraer catálogo real de ubicaciones
    const ubicacionesConfig = StorageService.get("ubicacionesConfig", [{nombre: "Piso de Ventas"}, {nombre: "Bodega Principal"}]);
    let opcionesUbi = '<option value="General">-- Elige la Bodega / Ubicación --</option>';
    ubicacionesConfig.forEach(u => {
        const isSelected = (rec.ubicacion === u.nombre) ? 'selected' : '';
        opcionesUbi += `<option value="${u.nombre}" ${isSelected}>${u.nombre}</option>`;
    });

    // Remover modal previo si existe
    document.querySelector('[data-modal="recepcion-fisica"]')?.remove();

    const html = `
    <div data-modal="recepcion-fisica" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
        <div style="background:white;border-radius:12px;width:380px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.3);">
            <h3 style="margin-top:0;color:#1e40af;margin-bottom:15px;">📥 Ingreso al Inventario</h3>
            
            <div style="background:#f8fafc;padding:12px;border-radius:8px;margin-bottom:15px;border:1px solid #e2e8f0;">
                <p style="margin:0;font-size:13px;color:#475569;">Producto: <b>${rec.productoNombre}</b></p>
                <p style="margin:5px 0 0;font-size:13px;color:#dc2626;font-weight:bold;">Pendiente por recibir: ${rec.cantidadPendiente}</p>
            </div>
            
            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px;color:#374151;">Cantidad a ingresar:</label>
                <input type="number" id="rfCantidad" value="${rec.cantidadPendiente}" min="1" max="${rec.cantidadPendiente}" style="width:100%;padding:10px;border:2px solid #3b82f6;border-radius:6px;font-size:16px;font-weight:bold;text-align:center;">
            </div>

            <div style="margin-bottom:12px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px;color:#374151;">Color / Variante:</label>
                <input type="text" id="rfColor" value="${rec.color || 'General'}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;font-size:14px;">
            </div>

            <div style="margin-bottom:20px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px;color:#374151;">Bodega / Ubicación de destino:</label>
                <select id="rfUbicacion" style="width:100%;padding:10px;border:2px solid #10b981;border-radius:6px;font-size:14px;background:#f0fdf4;">
                    ${opcionesUbi}
                </select>
            </div>

            <div style="display:flex;gap:10px;">
                <button onclick="ejecutarRecepcionFisica(${idRecepcion})" style="flex:1;padding:12px;background:#16a34a;color:white;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">✅ Recibir Mercancía</button>
                <button onclick="document.querySelector('[data-modal=\\'recepcion-fisica\\']').remove()" style="padding:12px 16px;background:#94a3b8;color:white;border:none;border-radius:6px;cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

// Lógica de ejecución atada al botón del modal
window.ejecutarRecepcionFisica = function(idRecepcion) {
    const cantidad = parseInt(document.getElementById('rfCantidad').value);
    const colorRecepcion = document.getElementById('rfColor').value.trim() || 'General';
    const ubicacionRecepcion = document.getElementById('rfUbicacion').value;

    if (!ubicacionRecepcion || ubicacionRecepcion === "General") {
        alert("❌ BLOQUEO DE AUDITORÍA: Está estrictamente prohibido ingresar mercancía sin declarar la bodega física de destino. Selecciona una ubicación válida.");
        return; // El return aquí "mata" la función, no guarda nada y no deja avanzar.
    }

    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return;
    const rec = recs[index];

    if (isNaN(cantidad) || cantidad <= 0 || cantidad > rec.cantidadPendiente) {
        return alert("⚠️ Cantidad no válida o mayor a lo pendiente.");
    }

    let productos = StorageService.get("productos", []);
    let movimientosInventario = StorageService.get("movimientosInventario", []);
    const prod = productos.find(p => String(p.id) === String(rec.productoId));
    
    if (prod) {
        // 1. Afectar Stock General
        prod.stock = (parseInt(prod.stock) || 0) + cantidad;

        // 2. Afectar Variantes (Color/Ubicación)
        if (!prod.variantes) prod.variantes = [];
        
        const varExistente = prod.variantes.find(v => 
            (v.color || "General").toUpperCase() === colorRecepcion.toUpperCase() && 
            (v.ubicacion || "General").toUpperCase() === ubicacionRecepcion.toUpperCase()
        );

        if (varExistente) {
            varExistente.stock = (Number(varExistente.stock) || 0) + cantidad;
        } else {
            prod.variantes.push({ color: colorRecepcion, ubicacion: ubicacionRecepcion, stock: cantidad });
        }
        
        // 3. Afectar KARDEX detallado
        movimientosInventario.push({
            id: Date.now(),
            productoId: String(prod.id),
            productoNombre: prod.nombre,
            tipo: 'entrada',
            cantidad,
            concepto: `Recepción Pendiente - Prov: ${rec.proveedor} (${colorRecepcion}) -> Ingresado a [${ubicacionRecepcion}]`,
            fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
        });
    } else {
        return alert("❌ Error: El producto ya no existe en la base de datos.");
    }

    // 4. Actualizar la tarjeta de Recepción
    rec.cantidadRecibida += cantidad;
    rec.cantidadPendiente -= cantidad;
    if (rec.cantidadPendiente === 0) rec.estatus = "Completado";
    rec.ubicacion = ubicacionRecepcion;
    rec.color = colorRecepcion;

    recs[index] = rec;
    
    StorageService.set("recepciones", recs);
    StorageService.set("productos", productos);
    StorageService.set("movimientosInventario", movimientosInventario);

    document.querySelector('[data-modal="recepcion-fisica"]').remove();
    alert(`✅ Recepción procesada exitosamente.\nInventario sumado a la bodega: [${ubicacionRecepcion}].`);
    renderRecepciones();
};

window.verDetalleCompra = function(idCuenta) {
    const cuentas = StorageService.get("cuentasPorPagar", []);
    const c = cuentas.find(x => String(x.id) === String(idCuenta));
    if (!c) return;

    // 1. Buscar el origen del pedido
    const compras = StorageService.get("compras", []);
    const ordenes = StorageService.get("ordenesCompra", []);
    let compraOriginal = compras.find(comp => String(comp.id) === String(c.id) || String(comp.id) === String(c.compraId)) ||
                         ordenes.find(oc => String(oc.id) === String(c.id) || String(oc.id) === String(c.compraId));

    // 2. Extraer artículos
    let listaArticulos = [];
    if (compraOriginal && compraOriginal.articulos && Array.isArray(compraOriginal.articulos)) {
        listaArticulos = compraOriginal.articulos;
    } else {
        const kardex = StorageService.get("movimientosInventario", []);
        const movs = kardex.filter(m => String(m.compraId) === String(c.compraId) || String(m.compraId) === String(c.id));
        if (movs.length > 0) {
            listaArticulos = movs.map(m => ({ producto: m.productoNombre, cantidad: parseFloat(m.cantidad) || 1, costo: parseFloat(m.costoUnitario) || 0 }));
        } else {
            const cant = parseFloat(c.cantidad || 1);
            const totalC = parseFloat(c.total || 0);
            listaArticulos.push({ producto: c.producto || 'Mercancía General', cantidad: cant, costo: cant > 0 ? (totalC / cant) : totalC });
        }
    }

    // 3. Tabla de artículos
    let filasHTML = '';
    let subtotalReal = 0;
    listaArticulos.forEach(art => {
        const cant = parseFloat(art.cantidad || art.cantidadRec) || 1;
        const costoNeto = parseFloat(art.costo || art.precioOriginal) || 0;
        const importe = cant * costoNeto;
        subtotalReal += importe;
        filasHTML += `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px;">${art.nombre || art.producto || art.productoNombre || 'Artículo'}
                    ${art.caracteristicas ? `<br><small style="color:#64748b;">${art.caracteristicas}</small>` : ''}</td>
                <td style="padding:10px;text-align:center;">${cant}</td>
                <td style="padding:10px;text-align:right;">${dinero(costoNeto)}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;">${dinero(importe)}</td>
            </tr>`;
    });
    if (subtotalReal < (parseFloat(c.total) || 0)) subtotalReal = parseFloat(c.total);

    // 4. Construir historial de movimientos para el estado de cuenta
    const abonos = Array.isArray(c.abonos) ? c.abonos : [];
    const totalAbonado = abonos.reduce((s, a) => s + (parseFloat(a.monto) || 0), 0);
    const saldoPendiente = parseFloat(c.saldoPendiente) || 0;

    // Pago inicial al momento de compra (si hay diferencia entre total y deuda original)
    // La deuda original es total - lo que ya pagó al registrar. Si no hay abonos registrados
    // pero el saldo < total, significa que hubo un anticipo al registrar.
    const anticipoInicial = subtotalReal - totalAbonado - saldoPendiente;

    let movimientosHTML = '';

    // Fila de compra inicial
    movimientosHTML += `
        <tr style="border-bottom:1px solid #e2e8f0; background:#fefce8;">
            <td style="padding:10px;">${c.fecha || '-'}</td>
            <td style="padding:10px;">Compra registrada</td>
            <td style="padding:10px;text-align:right;color:#dc2626;font-weight:bold;">${dinero(subtotalReal)}</td>
            <td style="padding:10px;text-align:right;">—</td>
            <td style="padding:10px;text-align:right;font-weight:bold;color:#dc2626;">${dinero(subtotalReal)}</td>
        </tr>`;

    // Anticipo al registrar (si aplica)
    let saldoCorriente = subtotalReal;
    if (anticipoInicial > 0.01) {
        saldoCorriente -= anticipoInicial;
        movimientosHTML += `
            <tr style="border-bottom:1px solid #e2e8f0; background:#f0fdf4;">
                <td style="padding:10px;">${c.fecha || '-'}</td>
                <td style="padding:10px;">Anticipo al registrar compra</td>
                <td style="padding:10px;text-align:right;">—</td>
                <td style="padding:10px;text-align:right;color:#16a34a;font-weight:bold;">${dinero(anticipoInicial)}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;color:#dc2626;">${dinero(saldoCorriente)}</td>
            </tr>`;
    }

    // Abonos posteriores
    abonos.forEach(ab => {
        saldoCorriente -= (parseFloat(ab.monto) || 0);
        const fechaAb = ab.fecha ? window.formatearFechaMX(ab.fecha) : '-';
        movimientosHTML += `
            <tr style="border-bottom:1px solid #e2e8f0; background:#f0fdf4;">
                <td style="padding:10px;">${fechaAb}</td>
                <td style="padding:10px;">Abono — ${ab.cuenta || 'No especificado'}</td>
                <td style="padding:10px;text-align:right;">—</td>
                <td style="padding:10px;text-align:right;color:#16a34a;font-weight:bold;">${dinero(ab.monto)}</td>
                <td style="padding:10px;text-align:right;font-weight:bold;color:${saldoCorriente > 0.01 ? '#dc2626' : '#16a34a'};">${dinero(Math.max(0, saldoCorriente))}</td>
            </tr>`;
    });

    // 5. Modal HTML
    const modalHTML = `
        <div data-modal="detalle-compra" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(3px);z-index:6000;display:flex;justify-content:center;align-items:flex-start;overflow-y:auto;padding:20px;">
            <div style="background:white;padding:32px;border-radius:10px;width:95%;max-width:860px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);margin:auto;">

                <div style="border-bottom:3px solid #1e3a8a;padding-bottom:12px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <h2 style="margin:0;color:#1e3a8a;font-size:22px;font-weight:800;">ESTADO DE CUENTA — PROVEEDOR</h2>
                        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Folio interno: <strong>#${c.compraId || c.id}</strong></p>
                    </div>
                    <div style="text-align:right;">
                        <button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove();" style="background:none;border:none;font-size:24px;cursor:pointer;color:#94a3b8;">✕</button>
                        <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Fecha: <strong>${c.fecha || '-'}</strong></p>
                    </div>
                </div>

                <div style="background:#f8fafc;padding:12px 16px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:20px;">
                    <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;font-weight:bold;">Proveedor / Acreedor</p>
                    <p style="margin:4px 0 0;font-weight:bold;font-size:18px;color:#0f172a;">${c.proveedor || 'No especificado'}</p>
                    <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Método: ${c.formaPagoTexto || c.metodo || '-'}</p>
                </div>

                <h3 style="color:#374151;font-size:14px;font-weight:700;text-transform:uppercase;margin:0 0 8px;">Detalle de lo comprado</h3>
                <div style="overflow-x:auto;margin-bottom:24px;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead style="background:#f1f5f9;color:#475569;">
                            <tr>
                                <th style="padding:10px;text-align:left;">Producto</th>
                                <th style="padding:10px;text-align:center;">Cant.</th>
                                <th style="padding:10px;text-align:right;">Costo</th>
                                <th style="padding:10px;text-align:right;">Importe</th>
                            </tr>
                        </thead>
                        <tbody>${filasHTML}</tbody>
                        <tfoot>
                            <tr style="background:#f8fafc;font-weight:bold;">
                                <td colspan="3" style="padding:10px;text-align:right;color:#374151;">Total de compra:</td>
                                <td style="padding:10px;text-align:right;color:#1e3a8a;font-size:15px;">${dinero(subtotalReal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <h3 style="color:#374151;font-size:14px;font-weight:700;text-transform:uppercase;margin:0 0 8px;">Historial de movimientos</h3>
                <div style="overflow-x:auto;margin-bottom:24px;">
                    <table style="width:100%;border-collapse:collapse;font-size:13px;">
                        <thead style="background:#f1f5f9;color:#475569;">
                            <tr>
                                <th style="padding:10px;text-align:left;">Fecha</th>
                                <th style="padding:10px;text-align:left;">Concepto</th>
                                <th style="padding:10px;text-align:right;">Cargo (+)</th>
                                <th style="padding:10px;text-align:right;">Abono (−)</th>
                                <th style="padding:10px;text-align:right;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>${movimientosHTML}</tbody>
                    </table>
                </div>

                <div style="display:flex;justify-content:flex-end;">
                    <div style="width:300px;background:#f8fafc;padding:18px;border-radius:8px;border:1px solid #e2e8f0;">
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                            <span style="color:#64748b;font-size:13px;">Total compra:</span>
                            <strong style="color:#0f172a;">${dinero(subtotalReal)}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;color:#16a34a;">
                            <span style="font-size:13px;">Total abonado:</span>
                            <strong>− ${dinero(totalAbonado + (anticipoInicial > 0.01 ? anticipoInicial : 0))}</strong>
                        </div>
                        <div style="display:flex;justify-content:space-between;border-top:2px solid #cbd5e1;padding-top:10px;font-size:16px;color:#dc2626;">
                            <strong>SALDO A PAGAR:</strong>
                            <strong>${dinero(saldoPendiente)}</strong>
                        </div>
                    </div>
                </div>

                <div style="margin-top:24px;text-align:right;border-top:1px solid #e2e8f0;padding-top:16px;display:flex;justify-content:flex-end;gap:10px;">
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove();" style="padding:10px 22px;background:#64748b;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Cerrar</button>
                    ${saldoPendiente > 0 ? `<button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove(); registrarAbonoProveedor('${c.id}');" style="padding:10px 22px;background:#1e3a8a;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💵 Registrar Abono</button>` : ''}
                </div>
            </div>
        </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

window.registrarAbonoProveedor = function(idCuenta) {
    const cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => String(c.id) === String(idCuenta));
    if (index === -1) { console.error("No se encontró la cuenta para abonar"); return; }
    const cuenta = cuentas[index];
    document.querySelector('[data-modal="abono-proveedor"]')?.remove();
    
    // Generar fecha hoy
    const fechaHoy = window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0];

    const modalHTML = `
    <div data-modal="abono-proveedor" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:6000;display:flex;justify-content:center;align-items:center;">
        <div style="background:white;padding:30px;border-radius:15px;width:90%;max-width:550px;max-height:90vh;overflow-y:auto;">
            <h2 style="margin-top:0;">💵 Pagar a ${cuenta.proveedor}</h2>
            <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><small style="color:#718096;">Producto</small><br><strong>${cuenta.producto || '-'}</strong></div>
                    <div><small style="color:#718096;">Saldo Pendiente</small><br><strong style="color:#e74c3c;font-size:20px;">${dinero(cuenta.saldoPendiente)}</strong></div>
                </div>
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">Fecha del Pago:</label>
                <input type="date" id="fechaAbonoProv" value="${fechaHoy}" style="width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:6px;">
            </div>

            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">Monto del pago ($):</label>
                <input type="number" id="montoAbonoProveedor" placeholder="0.00" min="0" max="${cuenta.saldoPendiente}"
                       style="width:100%;padding:12px;font-size:16px;border:2px solid #3498db;border-radius:6px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">💳 ¿De dónde sale el dinero?</label>
                ${_buildSelectorCuentas('cuentaOrigen_proveedor', false)}
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="confirmarAbonoProveedor('${idCuenta}')"
                        style="flex:1;padding:12px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">
                    ✅ Registrar Pago
                </button>
                <button onclick="document.querySelector('[data-modal=&quot;abono-proveedor&quot;]')?.remove();"
                        style="flex:1;padding:12px;background:#e74c3c;color:white;border:none;border-radius:6px;cursor:pointer;">
                    ✕ Cancelar
                </button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

function confirmarAbonoProveedor(idCuenta) {
    // 👇 AHORA SÍ LEE EL ID CORRECTO 👇
    const fechaInput = document.getElementById("fechaAbonoProv").value;
    if (!fechaInput) return alert("❌ Error de Auditoría: Debes especificar la fecha del pago.");
    const fechaPagoFinal = `${fechaInput}T12:00:00.000`;
    
    const montoAbono = parseFloat(document.getElementById("montoAbonoProveedor")?.value);
    let cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => String(c.id) === String(idCuenta));
    if (index === -1) return;
    const cuenta = cuentas[index];

    const validacion = ValidatorService.validarMonto(montoAbono, cuenta.saldoPendiente);
    if (!validacion.valid) { alert("⚠️ " + validacion.error); return; }

    const { medioPago, cuentaId, etiqueta } = _getCuentaSeleccionada('proveedor');

    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿ABONAR A PROVEEDOR?\n\nProveedor: ${cuenta.proveedor}\nMonto a abonar: ${formatoDinero(montoAbono)}\nOrigen del dinero: ${etiqueta}\n\n¿Deseas continuar?`;
    if (!confirm(msjConf)) return;

    _egresarCuenta({
        monto: montoAbono,
        cuentaId,
        etiqueta,
        concepto: `Pago a proveedor ${cuenta.proveedor}${cuenta.producto ? ' - ' + cuenta.producto : ''}`,
        referencia: `ABONO-PROV-${idCuenta}`,
        fecha: fechaPagoFinal // <-- SE INYECTA AQUÍ
    });

    cuenta.saldoPendiente -= montoAbono;

    if (!Array.isArray(cuenta.abonos)) cuenta.abonos = [];
    cuenta.abonos.push({
        fecha: fechaPagoFinal,
        monto: montoAbono,
        cuenta: etiqueta || 'No especificada'
    });

    StorageService.set("cuentasPorPagar", cuentas);
    alert("✅ Pago registrado correctamente.");
    document.querySelector('[data-modal="abono-proveedor"]')?.remove();
    renderCuentasPorPagar();
}
window.confirmarAbonoProveedor = confirmarAbonoProveedor;

// ===== ÓRDENES DE COMPRA =====
function _foliosOC() {
    const hoyIso = window.obtenerHoyInputMX();
    const ymd = hoyIso.replace(/-/g, '');
    const lista = StorageService.get('ordenesCompra', []);
    const seq = String(lista.length + 1).padStart(4, '0');
    return 'OC-' + ymd + '-' + seq;
}

function abrirNuevaOrdenCompra() {
    const provs = StorageService.get('proveedores', []);
    const prods = StorageService.get('productos', []);
    const selProvs = provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    const selProds = prods.map(p => `<option value="${p.id}" data-costo="${p.costo || 0}">${p.nombre} (Costo: ${dinero(p.costo || 0)})</option>`).join('');
    const html = `
    <div data-modal="nueva-oc" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:950px;padding:30px;margin:auto;">
        <h2 style="margin:0 0 20px;color:#1e40af;">📋 Nueva Orden de Compra</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PROVEEDOR</label>
            <select id="ocProveedor" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
    <option value="">-- Selecciona proveedor --</option>
    ${selProvs}
</select>

<div style="margin-top:15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
    <div>
        <label style="font-size:13px; font-weight:bold;">Método de Pago:</label>
        <select id="ocMetodoPago" onchange="document.getElementById('divMsiOC').style.display=(this.value==='msi'?'block':'none'); document.getElementById('divCuentaOC').style.display=(this.value==='contado'?'block':'none'); document.getElementById('alertaConsignacionOC').style.display=(this.value==='consignacion'?'block':'none');" 
                style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            <option value="contado">Contado</option>
            <option value="credito">Crédito Proveedor</option>
            <option value="msi">Meses sin Intereses (MSI)</option>
            <option value="consignacion" style="color:#10b981; font-weight:bold;">A Consignación</option>
        </select>
        <div id="alertaConsignacionOC" style="display:none; background:#ecfdf5; border:1px solid #10b981; padding:8px; border-radius:6px; margin-top:8px; font-size:11px; color:#065f46;">
            ✅ <b>Modo Consignación:</b> Esta OC no generará una deuda inmediata exigible en el flujo. Solo se pagará lo que se vaya vendiendo.
        </div>
    </div>

    <div id="divCuentaOC">
        <label style="font-size:13px; font-weight:bold;">Cuenta para anticipo:</label>
        <select id="ocCuentaOrigen" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></select>
        <div style="margin-top:10px;">
            <label style="font-size:13px; font-weight:bold;">Monto de anticipo:</label>
            <input type="number" id="ocAnticipo" min="0" value="0" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
        </div>
    </div>
</div>

<div id="divMsiOC" style="display:none; margin-top:10px;">
    <label style="font-size:13px; font-weight:bold;">Número de meses:</label>
    <input type="number" id="ocMeses" value="12" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
</div>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA ENTREGA ESTIMADA</label>
            <input type="date" id="ocFechaEntrega" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
        </div>
                <div style="display:grid;grid-template-columns:1fr 1fr auto auto;gap:10px;align-items:end;margin-bottom:12px;">
                    <div>
                        <input type="hidden" id="ocProductoSel" value="">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span id="ocProductoSel-display"
                                  style="flex:1;padding:9px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                Sin seleccionar
                            </span>
                            <button type="button"
        onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){document.getElementById('ocProductoSel').value=p.id;var d=document.getElementById('ocProductoSel-display');d.textContent=p.nombre+'  (Costo: '+dinero(p.costo||0)+')';d.style.color='#111827';alert('💡 Referencia de costo:\\nEl último costo registrado para este producto es de: $' + (p.costo || 0));}})"
        style="padding:9px 12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:13px;">
    🔍 Buscar
</button>
                        </div>
                    </div>
                    <input type="text" id="ocCaracteristicas" placeholder="Características (tela, color, etc)" style="padding:9px;border:1px solid #d1d5db;border-radius:6px;">
                    <input type="number" id="ocCantidad" value="1" min="1" style="width:70px;padding:9px;border:1px solid #d1d5db;border-radius:6px;">
                    <button onclick="agregarArticuloOC()" style="padding:9px 16px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;">➕ Agregar</button>
                </div>
        <div id="tablaArticulosOC" style="margin-bottom:16px;"></div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;">NOTAS</label>
          <textarea id="ocNotas" rows="2" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></textarea>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <strong>Total: <span id="ocTotal" style="color:#1e40af;font-size:18px;">$0.00</span></strong>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;">
            <input type="checkbox" id="ocBorrador" checked style="width:16px;height:16px;"> Guardar como Borrador
          </label>
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="guardarOrdenCompra()" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar OC</button>
          <button onclick="document.querySelector('[data-modal=nueva-oc]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Fecha entrega: default hoy + 15 días
    const fechaEnt = new Date(); fechaEnt.setDate(fechaEnt.getDate() + 15);
    const ocFechaEl = document.getElementById('ocFechaEntrega');
    if (ocFechaEl) ocFechaEl.value = window.fechaParaInput(fechaEnt).substring(0, 10);
    window._articulosOC = [];
    _renderTablaArticulosOC();
    // Llenar combo de cuenta para anticipo
    _poblarCuentasOrigen('ocCuentaOrigen');
    // Mostrar/ocultar combo según método de pago
    const metodoPagoSel = document.getElementById('ocMetodoPago');
    const divCuentaOC = document.getElementById('divCuentaOC');
    if (metodoPagoSel && divCuentaOC) {
        divCuentaOC.style.display = (metodoPagoSel.value === 'contado') ? 'block' : 'none';
        metodoPagoSel.onchange = function() {
            divCuentaOC.style.display = (this.value === 'contado') ? 'block' : 'none';
        };
    }
}

function agregarArticuloOC() {
    const sel = document.getElementById('ocProductoSel');
    const cantInput = document.getElementById('ocCantidad');
    const caracInput = document.getElementById('ocCaracteristicas');
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod = prods.find(p => String(p.id) === String(sel.value));
    if (!prod) return;
    const cant = parseInt(cantInput.value) || 1;
    const costo = parseFloat(prod.costo) || 0;
    const caracteristicas = caracInput ? caracInput.value.trim() : '';
    if (!window._articulosOC) window._articulosOC = [];
    const idx = window._articulosOC.findIndex(a => String(a.productoId) === String(prod.id) && a.caracteristicas === caracteristicas);
    if (idx !== -1) {
        window._articulosOC[idx].cantidad += cant;
        window._articulosOC[idx].subtotal = window._articulosOC[idx].cantidad * costo;
    } else {
        window._articulosOC.push({ productoId: prod.id, nombre: prod.nombre, costo, cantidad: cant, subtotal: cant * costo, caracteristicas });
    }
    cantInput.value = 1;
    // Resetear picker de producto OC
    sel.value = '';
    const displayOC = document.getElementById('ocProductoSel-display');
    if (displayOC) { displayOC.textContent = 'Sin seleccionar'; displayOC.style.color = '#6b7280'; }
    if (caracInput) caracInput.value = '';
    _renderTablaArticulosOC();
}

function _renderTablaArticulosOC() {
    const cont = document.getElementById('tablaArticulosOC');
    if (!cont) return;
    const arts = window._articulosOC || [];
    if (arts.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:12px;">Sin artículos</p>';
        const totEl = document.getElementById('ocTotal');
        if (totEl) totEl.textContent = dinero(0);
        return;
    }
    let total = 0;
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (typeof esAdmin === 'function' ? esAdmin() : false);
        const rows = arts.map((a, i) => {
                total += a.subtotal;
                return `<tr>
                        <td style="padding:8px;">${a.nombre}</td>
                        <td style="padding:8px;">${a.caracteristicas ? `<span style='color:#64748b;font-size:12px;'>${a.caracteristicas}</span>` : ''}</td>
                        <td style="padding:8px;text-align:center;">
                                <input type="number" min="0" step="0.01" value="${a.costo}" style="width:80px;text-align:right;" ${esAdmin ? '' : 'readonly disabled'} onchange="if(${esAdmin}){window._articulosOC[${i}].costo = parseFloat(event.target.value)||0; window._articulosOC[${i}].subtotal = window._articulosOC[${i}].cantidad * window._articulosOC[${i}].costo; _renderTablaArticulosOC();}" />
                        </td>
                        <td style="padding:8px;text-align:center;">${a.cantidad}</td>
                        <td style="padding:8px;text-align:right;">${dinero(a.subtotal)}</td>
                        <td style="padding:8px;text-align:center;"><button onclick="window._articulosOC.splice(${i},1);_renderTablaArticulosOC();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
                </tr>`;
        }).join('');
        cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
                <th style="padding:8px;text-align:left;">Artículo</th>
                <th style="padding:8px;">Características</th>
                <th style="padding:8px;text-align:center;">Costo Unit.</th>
                <th style="padding:8px;text-align:center;">Cant.</th>
                <th style="padding:8px;text-align:right;">Subtotal</th>
                <th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
    const totEl = document.getElementById('ocTotal');
    if (totEl) totEl.textContent = dinero(total);
}

function guardarOrdenCompra() {
    const arts = window._articulosOC || [];
    if (arts.length === 0) return alert('⚠️ Agrega al menos un artículo.');
    
    // --- CORRECCIÓN: Mover estas 3 líneas HACIA ARRIBA ---
    const provId = document.getElementById('ocProveedor')?.value;
    const provs = StorageService.get('proveedores', []);
    const prov = provs.find(p => String(p.id) === String(provId));
    const provNombre = prov ? prov.nombre : 'Sin proveedor';
    // -------------------------------------------------------

    const fechaEntrega = document.getElementById('ocFechaEntrega')?.value;
    const notas = document.getElementById('ocNotas')?.value.trim() || '';
    const borrador = document.getElementById('ocBorrador')?.checked ?? true;
    const metodoPago = document.getElementById('ocMetodoPago')?.value || '';
    const cuentaOrigen = document.getElementById('ocCuentaOrigen')?.value || '';
    
    // Ahora el anticipo ya sabe quién es provNombre
    const anticipo = parseFloat(document.getElementById('ocAnticipo')?.value || '0');
    if (anticipo > 0 && cuentaOrigen) {
        const etiqueta = document.getElementById('ocCuentaOrigen')?.options[document.getElementById('ocCuentaOrigen')?.selectedIndex]?.text || cuentaOrigen;
        _egresarCuenta({
            monto: anticipo,
            cuentaId: cuentaOrigen,
            etiqueta,
            concepto: `Anticipo OC a ${provNombre}`, 
            referencia: `ANTICIPO-OC-${Date.now()}`
        });
    }
    const meses = document.getElementById('ocMeses')?.value || '';
    const total = arts.reduce((s, a) => s + a.subtotal, 0);
    const oc = {
        id: Date.now(),
        folio: _foliosOC(),
        proveedorId: provId || null,
        proveedorNombre: provNombre,
        articulos: arts,
        total,
        fechaEmision: Date.now(),
        fechaEntregaEstimada: fechaEntrega || null,
        estado: borrador ? 'Borrador' : 'Enviada',
        notas,
        condicionesComerciales: {
            metodoPago,
            cuentaOrigen,
            meses
        },
        anticipo_pagado: anticipo || 0,
        saldoPendiente: Math.max(0, total - (anticipo || 0)),
        pagos: (anticipo > 0) ? [{ fecha: new Date().toISOString(), monto: anticipo, cuenta: cuentaOrigen }] : [],
        // 👇 AÑADIMOS LA BANDERA DE CONSIGNACIÓN 👇
        esConsignacion: metodoPago === 'consignacion'
    };
    const lista = StorageService.get('ordenesCompra', []);
    lista.push(oc);
    // --- MARCAR REQUISICIONES COMO EN ORDEN ---
    if (window._requisicionesVinculadasA_OC && window._requisicionesVinculadasA_OC.length > 0) {
        let reqsTotales = StorageService.get("requisicionesCompra", []);
        window._requisicionesVinculadasA_OC.forEach(idReq => {
            let r = reqsTotales.find(x => String(x.id) === String(idReq));
            if (r) r.estatus = `En OC (${oc.folio})`;
        });
        StorageService.set("requisicionesCompra", reqsTotales);
        window._requisicionesVinculadasA_OC = null;
    }
    // ------------------------------------------
    StorageService.set('ordenesCompra', lista);
    document.querySelector('[data-modal="nueva-oc"]')?.remove();
    alert(`✅ Orden de compra ${oc.folio} guardada.`);
    if (document.getElementById('contenidoOrdenesCompra')) renderListaOrdenesCompra();
    imprimirOrdenCompra(oc.id);
}

function imprimirOrdenCompra(id) {
    const lista = StorageService.get('ordenesCompra', []);
    const oc = lista.find(x => x.id === id);
    if (!oc) return;
    const cfg = StorageService.get('configEmpresa', {});
    const empresa = cfg.nombre || 'Mueblería Mi Pueblito';
    const rows = oc.articulos.map(a =>
        `<tr>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.nombre}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.caracteristicas ? `<span style='color:#64748b;font-size:12px;'>${a.caracteristicas}</span>` : ''}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.cantidad}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.costo)}</td>
            <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.subtotal)}</td>
        </tr>`
    ).join('');
    const w = window.open('', '_blank', 'width=750,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OC ${oc.folio}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;}table{width:100%;border-collapse:collapse;}th{background:#f3f4f6;padding:8px;text-align:left;}@media print{button{display:none!important;}}</style>
    </head><body>
    <div style="text-align:center;margin-bottom:24px;">
      <img src="img/Logo.svg" style="height:70px;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
      <h2 style="margin:8px 0;">${empresa}</h2>
    </div>
    <hr>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
      <div><strong>ORDEN DE COMPRA</strong><br><span style="font-size:20px;color:#1e40af;">${oc.folio}</span><br><span style="color:${oc.estado==='Enviada'?'#16a34a':'#d97706'}">${oc.estado}</span></div>
      <div style="text-align:right;">
        <div>Emisión: ${window.formatearFechaCortaMX(oc.fechaEmision)}</div>
        ${oc.fechaEntregaEstimada ? `<div>Entrega est.: ${window.formatearFechaCortaMX(oc.fechaEntregaEstimada)}</div>` : ''}
      </div>
    </div>
        <div style="margin-bottom:16px;"><strong>Proveedor:</strong> ${oc.proveedorNombre}</div>
        <div style="margin-bottom:16px;"><strong>Condiciones comerciales:</strong><br>
            Forma de pago: <b>${oc.condicionesComerciales?.metodoPago === 'contado' ? 'Contado' : oc.condicionesComerciales?.metodoPago === 'credito' ? 'Crédito Proveedor' : oc.condicionesComerciales?.metodoPago === 'msi' ? 'Meses sin Intereses' : '-'}</b><br>
            ${oc.condicionesComerciales?.metodoPago === 'msi' ? `Meses: <b>${oc.condicionesComerciales?.meses}</b><br>` : ''}
            ${oc.condicionesComerciales?.cuentaOrigen ? `Cuenta origen: <b>${oc.condicionesComerciales?.cuentaOrigen}</b><br>` : ''}
        </div>
        <table>
            <thead><tr><th>Artículo</th><th>Características</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Costo Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    <div style="text-align:right;margin-top:16px;font-size:20px;font-weight:bold;">TOTAL: ${dinero(oc.total)}</div>
    ${oc.notas ? `<div style="margin-top:16px;padding:12px;background:#f9fafb;border-radius:6px;"><strong>Notas:</strong> ${oc.notas}</div>` : ''}
    <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;text-align:center;">
      <div><div style="border-top:1px solid #374151;padding-top:8px;margin-top:40px;">Firma del Proveedor</div></div>
      <div><div style="border-top:1px solid #374151;padding-top:8px;margin-top:40px;">Autorizado por</div></div>
    </div>
    <div style="text-align:center;margin-top:12px;">
      <button onclick="window.print()" style="padding:10px 24px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-size:15px;">🖨️ Imprimir</button>
    </div>
    </body></html>`);
    w.document.close();
}

function recibirOrdenCompra(id) {
    const lista = StorageService.get('ordenesCompra', []);
    const idx   = lista.findIndex(x => x.id === id);
    if (idx === -1) return;
    const oc = lista[idx];
    if (oc.estado === 'Recibida' || oc.estado === 'Recibida Parcial')  return alert('Esta orden ya fue recibida completamente o está en back order. Solo puedes recibir en el back order.');
    if (oc.estado === 'Cancelada') return alert('Esta orden está cancelada.');

    // Saldo pendiente según condición de pago de la OC
    const condPago   = oc.condicionesComerciales?.metodoPago || 'credito';
    const totalOC    = oc.total || 0;
    const anticipo   = oc.anticipo_pagado || 0;
    const saldoOC    = totalOC - anticipo;
    const yaHayPago  = condPago === 'contado'; // si era contado ya estaba acordado pagarlo

    // Obtener ubicaciones para forzar su selección
    const ubicacionesConfig = StorageService.get("ubicacionesConfig", []);
    let opcionesUbi = '<option value="">-- Elige --</option><option value="General">General</option>';
    ubicacionesConfig.forEach(u => {
        if(u.nombre !== 'General') opcionesUbi += `<option value="${u.nombre}">${u.nombre}</option>`;
    });

    // Filas de artículos con input de cantidad
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (typeof esAdmin === 'function' ? esAdmin() : false);
    const filasArts = oc.articulos.map((a, i) => `
        <tr style="border-bottom:1px solid #e5e7eb;">
            <td style="padding:10px;">${a.nombre}</td>
            <td style="padding:10px;text-align:center;color:#6b7280;">${a.cantidad}</td>
            <td style="padding:10px;text-align:center;">
                <input type="number" id="recQ_${i}" value="${a.cantidad}"
                       min="0"
                       oninput="window._ocActualizarPendiente(${i},${a.cantidad})"
                       style="width:70px;padding:6px;border:2px solid #3b82f6;border-radius:6px;text-align:center;font-size:14px;font-weight:bold;">
            </td>
            <td id="recP_${i}" style="padding:10px;text-align:center;color:#d97706;font-weight:bold;">0</td>
            <td style="padding:10px;text-align:center;">
                <input type="text" id="recColor_${i}" value="${a.color || ''}"
                       placeholder="Ej: Chocolate"
                       style="width:90px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px;">
            </td>
            <td style="padding:10px;text-align:center;">
                <select id="recUbicacion_${i}" style="width:110px;padding:6px;border:2px solid #ef4444;border-radius:6px;font-size:13px;background:#fff5f5;" required>
                    ${opcionesUbi}
                </select>
            </td>
            <td style="padding:10px;text-align:right;color:#374151;">
                <input type="number" id="recCosto_${i}" value="${a.costo}" min="0" step="0.01" style="width:80px;text-align:right;" ${esAdmin ? '' : 'readonly disabled'} onchange="if(${esAdmin}){window._actualizarCostoOCArticulo(${i}, this.value, ${id});}" />
            </td>
            <td id="recSub_${i}" style="padding:10px;text-align:right;font-weight:bold;">${dinero(a.cantidad * a.costo)}</td>
        </tr>`).join('');

    // Función global para actualizar el costo en recepción OC
    window._actualizarCostoOCArticulo = function(idx, nuevoCosto, ocId) {
        const lista = StorageService.get('ordenesCompra', []);
        const oc = lista.find(x => x.id === ocId);
        if (!oc) return;
        
        const art = oc.articulos[idx];
        art.costo = parseFloat(nuevoCosto) || 0;
        art.subtotal = art.cantidad * art.costo;
        StorageService.set('ordenesCompra', lista);
        
        // --- CORRECCIÓN: Actualizar solo el subtotal en la vista, NO redibujar todo ---
        const inputCant = parseInt(document.getElementById(`recQ_${idx}`)?.value) || 0;
        const subtotalVisual = document.getElementById(`recSub_${idx}`);
        if (subtotalVisual) {
            subtotalVisual.textContent = dinero(inputCant * art.costo);
        }
        // Llamamos a la función que recalcula el total inferior sin borrar los inputs
        window._ocActualizarPendiente(idx, art.cantidad); 
    };

    const selectorCuentas = _buildSelectorCuentas('recCuentaPago', false);

    document.querySelector('[data-modal="recepcion-oc"]')?.remove();
    const html = `
    <div data-modal="recepcion-oc" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:16px;">
      <div style="background:white;border-radius:14px;width:100%;max-width:760px;padding:28px;margin:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);">

        <!-- Encabezado -->
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
          <div>
            <h2 style="margin:0 0 4px;color:#1e40af;">📦 Recepción de Mercancía</h2>
            <p style="margin:0;color:#6b7280;font-size:14px;">OC: <strong>${oc.folio}</strong> &nbsp;•&nbsp; Proveedor: <strong>${oc.proveedorNombre}</strong></p>
          </div>
          <button onclick="document.querySelector('[data-modal=recepcion-oc]').remove()"
                  style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>

        <!-- Info OC -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
          <div style="background:#eff6ff;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;color:#3b82f6;font-weight:bold;">TOTAL OC</div>
            <div style="font-size:18px;font-weight:bold;color:#1e40af;">${dinero(totalOC)}</div>
          </div>
          <div style="background:#fef3c7;border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;color:#d97706;font-weight:bold;">ANTICIPO</div>
            <div style="font-size:18px;font-weight:bold;color:#b45309;">${dinero(anticipo)}</div>
          </div>
          <div style="background:${saldoOC > 0 ? '#fef2f2' : '#f0fdf4'};border-radius:8px;padding:10px;text-align:center;">
            <div style="font-size:11px;color:${saldoOC > 0 ? '#dc2626' : '#16a34a'};font-weight:bold;">SALDO PENDIENTE</div>
            <div style="font-size:18px;font-weight:bold;color:${saldoOC > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldoOC)}</div>
          </div>
        </div>

        <!-- Tabla de artículos -->
        <div style="overflow-x:auto;margin-bottom:6px;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead>
              <tr style="background:#f3f4f6;">
                <th style="padding:10px;text-align:left;">Artículo</th>
                <th style="padding:10px;text-align:center;">Pedido</th>
                <th style="padding:10px;text-align:center;">Recibido ✏️</th>
                <th style="padding:10px;text-align:center;">Back Order</th>
                <th style="padding:10px;text-align:center;">Color 🎨</th>
                <th style="padding:10px;text-align:center;">Ubicación 📍</th>
                <th style="padding:10px;text-align:right;">Costo U.</th>
                <th style="padding:10px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${filasArts}</tbody>
            <tfoot>
              <tr style="background:#f9fafb;font-weight:bold;">
                <td colspan="6" style="padding:10px;text-align:right;">Total recibido:</td>
                <td id="recTotalMonto" style="padding:10px;text-align:right;color:#1e40af;font-size:16px;">${dinero(totalOC)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style="font-size:12px;color:#9ca3af;margin-bottom:18px;">
          Ajusta las cantidades recibidas. Lo que falte quedará como <strong>Back Order</strong> automáticamente.
        </p>

        <!-- Sección pago (solo si hay saldo) -->
        <div id="seccionPagoRecepcion" style="${saldoOC > 0 ? '' : 'display:none;'}">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:18px;">
            <div style="font-size:14px;font-weight:bold;color:#374151;margin-bottom:12px;">💳 ¿Realizar pago ahora?</div>
            <div style="display:flex;gap:8px;margin-bottom:12px;" id="botonesMetodoPago">
              <button id="btnPagoNo" onclick="window._ocSelPago('no')"
                      style="flex:1;padding:9px;border:2px solid #1e40af;background:#1e40af;color:white;border-radius:8px;cursor:pointer;font-weight:bold;">
                ❌ No, registrar como C×P
              </button>
              <button id="btnPagoContado" onclick="window._ocSelPago('contado')"
                      style="flex:1;padding:9px;border:2px solid #d1d5db;background:white;color:#374151;border-radius:8px;cursor:pointer;font-weight:bold;">
                💵 Sí, Efectivo
              </button>
              <button id="btnPagoDebito" onclick="window._ocSelPago('debito')"
                      style="flex:1;padding:9px;border:2px solid #d1d5db;background:white;color:#374151;border-radius:8px;cursor:pointer;font-weight:bold;">
                💳 Sí, Débito
              </button>
            </div>
            <div id="divCuentaPago" style="display:none;">
              <label style="font-size:13px;font-weight:bold;color:#374151;display:block;margin-bottom:6px;">Cuenta de pago:</label>
              ${selectorCuentas}
            </div>
            <div id="divMontoManual" style="display:none;margin-top:10px;">
              <label style="font-size:13px;font-weight:bold;color:#374151;display:block;margin-bottom:6px;">Monto a pagar ahora (máx <span id="lblSaldoMax">${dinero(saldoOC)}</span>):</label>
              <input type="number" id="recMontoPago" placeholder="${saldoOC.toFixed(2)}" min="0" max="${saldoOC}"
                     style="width:100%;padding:9px;border:2px solid #3b82f6;border-radius:6px;font-size:15px;">
            </div>
          </div>
        </div>

        <!-- Notas recepción -->
        <div style="margin-bottom:18px;">
          <label style="font-size:13px;font-weight:bold;color:#374151;display:block;margin-bottom:6px;">📝 Observaciones de la recepción:</label>
          <textarea id="recNotas" rows="2" placeholder="Condición de la mercancía, faltantes, daños..."
                    style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;"></textarea>
        </div>

        <!-- Botones -->
        <div style="display:flex;gap:10px;">
          <button onclick="confirmarRecepcionOC(${id})"
                  style="flex:1;padding:13px;background:#16a34a;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;font-size:15px;">
            ✅ Confirmar Recepción e Imprimir
          </button>
          <button onclick="document.querySelector('[data-modal=recepcion-oc]').remove()"
                  style="padding:13px 20px;background:#6b7280;color:white;border:none;border-radius:8px;cursor:pointer;">
            ✕ Cancelar
          </button>
        </div>

      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    // Guardar estado de pago seleccionado
    window._ocMetodoPago = 'no';

    // Función para seleccionar método de pago
    window._ocSelPago = function(metodo) {
        window._ocMetodoPago = metodo;
        ['no','contado','debito'].forEach(m => {
            const btn = document.getElementById(`btnPago${m.charAt(0).toUpperCase()+m.slice(1)}`);
            if (btn) {
                btn.style.background = m === metodo ? '#1e40af' : 'white';
                btn.style.color      = m === metodo ? 'white' : '#374151';
                btn.style.borderColor= m === metodo ? '#1e40af' : '#d1d5db';
            }
        });
        const divC = document.getElementById('divCuentaPago');
        const divM = document.getElementById('divMontoManual');
        if (divC) divC.style.display = (metodo !== 'no') ? 'block' : 'none';
        if (divM) divM.style.display = (metodo !== 'no') ? 'block' : 'none';
        // filtrar cuentas según tipo
        if (metodo === 'debito') {
            const sel = document.getElementById('recCuentaPago');
            if (sel) {
                const cban = StorageService.get('cuentas-bancarias', []).filter(c => c.tipo && c.tipo.toLowerCase().includes('debito'));
                sel.innerHTML = cban.map(c => `<option value="${c.id}">${c.nombre}${c.saldo !== undefined ? ' — ' + dinero(c.saldo) : ''}</option>`).join('');
            }
        } else if (metodo === 'contado') {
            const sel = document.getElementById('recCuentaPago');
            if (sel) {
                const cef = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo', saldo: 0 }]);
                sel.innerHTML = cef.map(c => `<option value="${c.id}">${c.nombre}${c.saldo !== undefined ? ' — ' + dinero(c.saldo) : ''}</option>`).join('');
            }
        }
    };

    // Función para recalcular totales en tiempo real
    window._ocActualizarPendiente = function(i, total) {
        const inp  = document.getElementById(`recQ_${i}`);
        const pEl  = document.getElementById(`recP_${i}`);
        const sEl  = document.getElementById(`recSub_${i}`);
        const costo = oc.articulos[i]?.costo || 0;
        if (!inp) return;
        const val = Math.max(0, parseInt(inp.value) || 0);
        inp.value = val;
        if (pEl)  pEl.textContent  = total - val;
        if (sEl)  sEl.textContent  = dinero(val * costo);
        // recalcular total
        let totalRec = 0;
        oc.articulos.forEach((a, j) => {
            const q = parseInt(document.getElementById(`recQ_${j}`)?.value) || 0;
            totalRec += q * (a.costo || 0);
        });
        const totEl = document.getElementById('recTotalMonto');
        if (totEl) totEl.textContent = dinero(totalRec);
        // actualizar monto sugerido
        const montoInp = document.getElementById('recMontoPago');
        const saldoDisp = totalOC - anticipo;
        if (montoInp && !montoInp.dataset.editado) montoInp.value = Math.min(totalRec, saldoDisp > 0 ? saldoDisp : totalRec).toFixed(2);
        // saldo pendiente actualizado
        const lblSaldo = document.getElementById('lblSaldoMax');
        if (lblSaldo) lblSaldo.textContent = dinero(Math.max(0, saldoDisp));
    };

    // Marcar monto como editado manualmente
    const montoInputEl = document.getElementById('recMontoPago');
    if (montoInputEl) montoInputEl.addEventListener('input', () => { montoInputEl.dataset.editado = '1'; });
}

function confirmarRecepcionOC(ocId) {
    const lista = StorageService.get('ordenesCompra', []);
    const idx   = lista.findIndex(x => x.id === ocId);
    if (idx === -1) return;
    const oc = lista[idx];

    const fechaRec   = new Date();
    const fechaStr   = window.formatearFechaCortaMX(fechaRec);
    let notas      = document.getElementById('recNotas')?.value.trim() || '';
    const metodoPago = window._ocMetodoPago || 'no';

    // Recoger cantidades recibidas (permitir más de lo pedido)
    const itemsRecibidos = [];
    const itemsBackOrder  = [];
    let obsExtra = [];
    let faltanUbicaciones = false;

    oc.articulos.forEach((a, i) => {
        const inputVal = parseInt(document.getElementById(`recQ_${i}`)?.value) || 0;
        const cantRec = Math.max(0, inputVal);
        const backOrd = a.cantidad - Math.min(inputVal, a.cantidad);
        const colorRec = document.getElementById(`recColor_${i}`)?.value.trim() || '';
        const ubicacionRec = document.getElementById(`recUbicacion_${i}`)?.value;
        
        if (cantRec > 0 && !ubicacionRec) faltanUbicaciones = true;

        if (cantRec > 0) {
            itemsRecibidos.push({ ...a, cantidadRec: cantRec, subtotal: cantRec * a.costo, colorRec, ubicacionRec });
            // Guardar historial de costos (recepción OC)
            guardarHistorialCosto({
                productoId: a.productoId,
                precioCompra: a.costo,
                fecha: fechaStr,
                cantidad: cantRec,
                proveedorId: oc.proveedorId,
                proveedorNombre: oc.proveedorNombre,
                origen: 'orden de compra'
            });

            // --- Ajuste automático de costo y precio si hay aumento ---
            let productos = [];
            try {
                productos = StorageService.get('productos', []);
            } catch (e) { productos = []; }
            const idxProd = productos.findIndex(p => String(p.id) === String(a.productoId));
            if (idxProd !== -1) {
                const producto = productos[idxProd];
                if (a.costo > producto.costo) {
                    const costoAnterior = producto.costo;
                    const precioAnterior = producto.precio;
                    let margenAplicar = 30;
                    if (typeof categoriasData !== 'undefined' && Array.isArray(categoriasData)) {
                        categoriasData.forEach(cat => {
                            const sub = cat.subcategorias.find(s => s.nombre === producto.subcategoria);
                            if (sub) margenAplicar = sub.margen;
                        });
                    }
                    const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(a.costo, margenAplicar);
                    producto.costo = a.costo;
                    producto.precio = nuevoPrecio;
                    StorageService.set('productos', productos);
                    // Aviso visual opcional
                    alert(`📢 ¡ACTUALIZACIÓN DE PRECIOS!\n${producto.nombre}\nCosto: ${dinero(costoAnterior)} ➡️ ${dinero(a.costo)}\nPrecio: ${dinero(precioAnterior)} ➡️ ${dinero(nuevoPrecio)}\nMargen aplicado: ${margenAplicar}%`);
                }
            }
            // --- Fin ajuste automático ---
        }
        if (backOrd > 0) itemsBackOrder.push({ ...a, cantidad: backOrd, subtotal: backOrd * a.costo });
        if (inputVal > a.cantidad) {
            obsExtra.push(`Se reciben ${inputVal - a.cantidad} piezas de más de ${a.nombre}`);
        }
    });

    if (obsExtra.length > 0) {
        notas += (notas ? '\n' : '') + obsExtra.join('\n');
    }

    if (itemsRecibidos.length === 0) return alert('⚠️ Debes recibir al menos 1 unidad.');
    if (faltanUbicaciones) return alert('⚠️ REQUERIDO: Debes seleccionar la Ubicación (Bodega/Tienda) para todos los artículos que vas a recibir.');

    const totalRecibido = itemsRecibidos.reduce((s, a) => s + a.subtotal, 0);
    const totalOC       = oc.total || 0;
    const anticipo      = oc.anticipo_pagado || 0;
    const saldoDisp     = Math.max(0, totalOC - anticipo);

    // Validar pago si eligió pagar
    let montoPagado = 0;
    let cuentaPagoId = '';
    let cuentaPagoEtiqueta = '';
    if (metodoPago !== 'no' && saldoDisp > 0) {
        const montoEl = document.getElementById('recMontoPago');
        const cuentaEl = document.getElementById('recCuentaPago');
        montoPagado = parseFloat(montoEl?.value) || 0;
        // Validación: evitar pagos de $0
        if (montoPagado <= 0) return alert('⚠️ Ingresa un monto mayor a $0 para el pago.');
        // Validación: evitar pagos mayores al saldo pendiente
        if (montoPagado > saldoDisp + 0.01) return alert(`⚠️ El monto excede el saldo pendiente (${dinero(saldoDisp)}).`);
        // Validación: obligar cuenta seleccionada
        if (!cuentaEl || !cuentaEl.value) return alert('⚠️ Selecciona la cuenta de pago.');
        cuentaPagoId = cuentaEl.value;
        cuentaPagoEtiqueta = cuentaEl.options[cuentaEl.selectedIndex]?.text || 'Efectivo';
        // Validación: advertir si pago + anticipo supera el total
        if ((montoPagado + anticipo) > totalOC + 0.01) {
            if (!confirm(`⚠️ El pago (${dinero(montoPagado)}) más el anticipo (${dinero(anticipo)}) supera el total de la OC (${dinero(totalOC)}). ¿Deseas continuar?`)) return;
        }
    }

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN DE RECEPCIÓN DE ORDEN DE COMPRA ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConfRec = `⚠️ RESUMEN DE OPERACIÓN - ¿CONFIRMAR RECEPCIÓN?\n\nOrden de Compra: ${oc.folio}\nProveedor: ${oc.proveedorNombre}\nTotal de unidades a ingresar: ${itemsRecibidos.reduce((s, a) => s + a.cantidadRec, 0)}\nPago a registrar hoy: ${formatoDinero(montoPagado)}\n\n¿Deseas procesar la entrada al inventario y actualizar la OC?`;
    if (!confirm(msjConfRec)) return;
    // --- FIN DE CONFIRMACIÓN ---

    // ── 1. Actualizar inventario ───────────────────────────────

    // ── 1. Actualizar inventario ───────────────────────────────
const prods = StorageService.get('productos', []);
itemsRecibidos.forEach(art => {
    const pidx = prods.findIndex(p => String(p.id) === String(art.productoId));
    if (pidx !== -1) {
        prods[pidx].stock = (prods[pidx].stock || 0) + art.cantidadRec;
        // Afectar la ubicación específica y color
        prods[pidx].variantes = prods[pidx].variantes || [];
        const ubiFinal = art.ubicacionRec || 'General';
        const colFinal = art.colorRec || 'General';
        
        const existente = prods[pidx].variantes.find(
            v => (v.ubicacion || 'General').toUpperCase() === ubiFinal.toUpperCase() && 
                 (v.color || 'General').toUpperCase() === colFinal.toUpperCase()
        );
        if (existente) {
            existente.stock = (Number(existente.stock) || 0) + art.cantidadRec;
        } else {
            prods[pidx].variantes.push({ ubicacion: ubiFinal, color: colFinal, stock: art.cantidadRec });
        }
    }
});
StorageService.set('productos', prods);
productos = prods;          // ← ESTA línea sincroniza el global
window.productos = prods;   // ← por si se referencia con window. en otro lado

    // Movimientos de inventario
    const kardex = StorageService.get('movimientosInventario', []);  // ← leer fresco
itemsRecibidos.forEach(art => {
    const concepto = art.colorRec
        ? `Recepción OC ${oc.folio} — ${oc.proveedorNombre} (${art.colorRec})`
        : `Recepción OC ${oc.folio} — ${oc.proveedorNombre}`;
    kardex.push({
        id: Date.now() + Math.random(),
        productoId: art.productoId,
        tipo: 'entrada',
        cantidad: art.cantidadRec,
        concepto,
        fecha: window.formatearFechaMX(fechaRec)
    });
});
StorageService.set('movimientosInventario', kardex);
movimientosInventario = kardex;   // ✅ sincronizar global

    // ── 2. Afectar flujo si hay pago ───────────────────────────
    if (metodoPago !== 'no' && montoPagado > 0) {
        _egresarCuenta({
            monto: montoPagado,
            cuentaId: cuentaPagoId,
            etiqueta: cuentaPagoEtiqueta,
            concepto: `Pago recepción OC ${oc.folio} — ${oc.proveedorNombre}`,
            referencia: `OC-REC-${oc.id}`
        });
    }

    // ── 3. Si queda saldo sin pagar → Cuenta por Pagar ─────────
    const saldoRestante = totalRecibido - montoPagado;
    if (saldoRestante > 0.01) {
        const fechaVenc = new Date();
        fechaVenc.setDate(fechaVenc.getDate() + 30);
        let cxp = StorageService.get('cuentasPorPagar', []);
        cxp.push({
            id: Date.now() + 7,
            compraId: oc.id,
            proveedor: oc.proveedorNombre,
            producto: itemsRecibidos.map(a => a.nombre).join(', '),
            total: saldoRestante,
            saldoPendiente: saldoRestante,
            metodo: 'credito_proveedor',
            formaPagoTexto: `Saldo OC ${oc.folio}`,
            plazo: 30,
            fecha: fechaStr,
            vencimiento: window.formatearFechaCortaMX(fechaVenc),
            vencimientoIso: window.localISO(fechaVenc)
        });
        StorageService.set('cuentasPorPagar', cxp);
    }

    // ── 4. Back order: nueva OC en Borrador con referencia a OC padre ──
    let boId = null;
    if (itemsBackOrder.length > 0) {
        const ocBO = {
            id: Date.now() + 1,
            folio: oc.folio + '-BO',
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            articulos: itemsBackOrder,
            total: itemsBackOrder.reduce((s, a) => s + a.subtotal, 0),
            fechaEmision: Date.now(),
            fechaEntregaEstimada: null,
            estado: 'Borrador',
            notas: `Back Order de ${oc.folio}`,
            condicionesComerciales: { ...oc.condicionesComerciales },
            anticipo_pagado: 0,
            ocPadre: oc.id
        };
        boId = ocBO.id;
        lista.push(ocBO);
    }

    // ── 5. Actualizar estado OC ────────────────────────────────
    lista[idx].estado          = itemsBackOrder.length > 0 ? 'Recibida Parcial' : 'Recibida';
    lista[idx].anticipo_pagado = anticipo + montoPagado;
    lista[idx].fechaRecepcion  = window.localISO(fechaRec);
    if (boId) lista[idx].backOrderId = boId;
    StorageService.set('ordenesCompra', lista);

    // ── 6. Guardar compra para historial ───────────────────────
    const compraReg = {
        id: Date.now() + 2,
        folio: oc.folio + '-REC',
        proveedor: oc.proveedorNombre,
        proveedorId: oc.proveedorId,
        articulos: itemsRecibidos.map(a => ({ ...a, cantidad: a.cantidadRec })),
        total: totalRecibido,
        fecha: window.localISO(fechaRec),
        metodo: metodoPago !== 'no' && montoPagado >= totalRecibido ? metodoPago : 'credito',
        saldoPendiente: Math.max(0, saldoRestante),
        ordenCompraId: oc.id,
        pago: metodoPago !== 'no' ? { monto: montoPagado, metodo: metodoPago, cuenta: cuentaPagoId, etiqueta: cuentaPagoEtiqueta } : null
    };
    const comprasList = StorageService.get('compras', []);
    comprasList.push(compraReg);
    StorageService.set('compras', comprasList);

    document.querySelector('[data-modal="recepcion-oc"]')?.remove();
    renderListaOrdenesCompra();

    // Imprimir documento de recepción
    imprimirRecepcionCompra(oc, compraReg, itemsBackOrder, {
        montoPagado, metodoPago, cuentaPagoEtiqueta, saldoRestante, notas, fechaStr
    });
}

function imprimirRecepcionCompra(oc, compra, backorder, pagoDatos) {
    const cfg     = StorageService.get('configEmpresa', {});
    const empresa = cfg.nombre || 'Mueblería Mi Pueblito';
    const { montoPagado, metodoPago, cuentaPagoEtiqueta, saldoRestante, notas, fechaStr } = pagoDatos;
    const rowsRecibidos = (compra.articulos || []).map(a => `
        <tr>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;">${a.nombre || a.nombre}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.cantidadRec ?? a.cantidad}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.costo)}</td>
            <td style="padding:9px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:bold;">${dinero((a.cantidadRec ?? a.cantidad) * a.costo)}</td>
        </tr>`).join('');
    const rowsBO = (backorder || []).map(a => `
        <tr>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;">${a.nombre}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;text-align:center;color:#d97706;font-weight:bold;">${a.cantidad}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;text-align:right;">${dinero(a.costo)}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #fde68a;text-align:right;">${dinero(a.subtotal)}</td>
        </tr>`).join('');
    const metodosLabel = { contado: '💵 Efectivo', debito: '💳 Tarjeta Débito', no: '— Sin pago —' };
    // Calcular totales de la recepción (no de la OC)
    const totalRecibido = compra.total;
    // El saldo pendiente es lo recibido menos lo pagado en esta recepción
    const saldoPendienteRecepcion = Math.max(0, totalRecibido - montoPagado);
    const w = window.open('', '_blank', 'width=780,height=960');
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Recepción ${compra.folio}</title>
    <style>
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:Arial,sans-serif;padding:32px;color:#111;font-size:13px;}
        h1{font-size:22px;color:#1e40af;margin-bottom:4px;}
        table{width:100%;border-collapse:collapse;}
        th{background:#f3f4f6;padding:9px 12px;text-align:left;font-size:12px;color:#6b7280;text-transform:uppercase;}
        .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:bold;}
        .firma{border-top:1.5px solid #374151;padding-top:8px;margin-top:52px;text-align:center;font-weight:bold;font-size:13px;}
        @media print{button{display:none!important;}@page{margin:14mm;}}
    </style>
    </head><body>
    <!-- ENCABEZADO -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1e40af;">
        <div>
            <img src="img/Logo.svg" style="height:56px;" onerror="this.outerHTML='<span style=\\'font-size:28px;\\'>🏛️</span>'">
            <div style="font-size:18px;font-weight:bold;color:#1e40af;margin-top:4px;">${empresa}</div>
        </div>
        <div style="text-align:right;">
            <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;font-weight:bold;">Documento de Recepción</div>
            <div style="font-size:22px;font-weight:bold;color:#1e40af;">${compra.folio}</div>
            <div style="margin-top:4px;font-size:13px;">Fecha: <strong>${fechaStr}</strong></div>
        </div>
    </div>

    <!-- DATOS -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:#f8fafc;border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">Proveedor</div>
            <div style="font-size:16px;font-weight:bold;">${oc.proveedorNombre}</div>
        </div>
        <div style="background:#f8fafc;border-radius:8px;padding:14px;">
            <div style="font-size:11px;color:#6b7280;font-weight:bold;text-transform:uppercase;margin-bottom:8px;">Orden de Compra Origen</div>
            <div style="font-size:16px;font-weight:bold;">${oc.folio}</div>
            <div style="margin-top:4px;">
                <span class="badge" style="background:${oc.estado === 'Recibida' ? '#dcfce7' : '#fef3c7'};color:${oc.estado === 'Recibida' ? '#16a34a' : '#92400e'};">
                    ${oc.estado}
                </span>
            </div>
            ${(oc.backOrderId ? `<div style='font-size:11px;color:#d97706;margin-top:4px;'>→ Back Order: <b>${oc.folio}-BO</b></div>` : '')}
            ${(oc.ocPadre ? `<div style='font-size:11px;color:#d97706;margin-top:4px;'>Back Order de: <b>${(StorageService.get('ordenesCompra', []).find(x=>x.id===oc.ocPadre)?.folio)||''}</b></div>` : '')}
        </div>
    </div>

    <!-- ARTÍCULOS RECIBIDOS -->
    <div style="font-size:13px;font-weight:bold;color:#1e40af;margin-bottom:8px;text-transform:uppercase;">✅ Artículos Recibidos</div>
    <table style="margin-bottom:20px;">
        <thead><tr>
            <th>Artículo</th>
            <th style="text-align:center;">Cant. Recibida</th>
            <th style="text-align:right;">Costo Unit.</th>
            <th style="text-align:right;">Subtotal</th>
        </tr></thead>
        <tbody>${rowsRecibidos}</tbody>
        <tfoot>
            <tr style="background:#eff6ff;">
                <td colspan="3" style="padding:10px 12px;font-weight:bold;text-align:right;">TOTAL RECIBIDO:</td>
                <td style="padding:10px 12px;font-weight:bold;font-size:16px;text-align:right;color:#1e40af;">${dinero(totalRecibido)}</td>
            </tr>
        </tfoot>
    </table>

    <!-- BACK ORDER -->
    ${backorder && backorder.length > 0 ? `
    <div style="font-size:13px;font-weight:bold;color:#d97706;margin-bottom:8px;text-transform:uppercase;">⏳ Back Order — Pendiente de Recibir</div>
    <table style="margin-bottom:20px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">
        <thead><tr style="background:#fef3c7;">
            <th>Artículo</th>
            <th style="text-align:center;">Cant. Pendiente</th>
            <th style="text-align:right;">Costo Unit.</th>
            <th style="text-align:right;">Subtotal Est.</th>
        </tr></thead>
        <tbody>${rowsBO}</tbody>
    </table>
    <p style="font-size:11px;color:#92400e;margin-bottom:20px;">Se generó automáticamente una nueva OC (${oc.folio}-BO) para el back order.</p>` : ''}

    <!-- PAGO -->
    <div style="background:${metodoPago !== 'no' ? '#f0fdf4' : '#f8fafc'};border:1px solid ${metodoPago !== 'no' ? '#86efac' : '#e2e8f0'};border-radius:8px;padding:16px;margin-bottom:24px;">
        <div style="font-size:13px;font-weight:bold;margin-bottom:10px;color:${metodoPago !== 'no' ? '#15803d' : '#374151'};">
            💳 Estado del Pago
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center;">
            <div>
                <div style="font-size:11px;color:#6b7280;">Total Recibido</div>
                <div style="font-size:16px;font-weight:bold;">${dinero(totalRecibido)}</div>
            </div>
            <div>
                <div style="font-size:11px;color:#6b7280;">Pagado Hoy (${metodosLabel[metodoPago] || '-'})</div>
                <div style="font-size:16px;font-weight:bold;color:${montoPagado > 0 ? '#16a34a' : '#9ca3af'};">
                    ${dinero(montoPagado)}
                </div>
            </div>
            <div>
                <div style="font-size:11px;color:#6b7280;">Saldo Pendiente de esta recepción</div>
                <div style="font-size:16px;font-weight:bold;color:${saldoPendienteRecepcion > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldoPendienteRecepcion)}</div>
            </div>
        </div>
    </div>

    ${notas ? `
    <div style="background:#f8fafc;border-radius:8px;padding:14px;margin-bottom:24px;">
        <strong>Observaciones:</strong><br><span style="color:#374151;">${notas}</span>
    </div>` : ''}

    <!-- FIRMAS -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:40px;margin-top:20px;">
        <div><div class="firma">Entregado por<br><span style="font-weight:normal;color:#6b7280;">(Proveedor)</span></div></div>
        <div><div class="firma">Recibido por<br><span style="font-weight:normal;color:#6b7280;">(Almacén)</span></div></div>
        <div><div class="firma">Autorizado por<br><span style="font-weight:normal;color:#6b7280;">(Gerencia)</span></div></div>
    </div>

    <!-- BOTÓN IMPRIMIR -->
    <div style="text-align:center;margin-top:28px;">
        <button onclick="window.print()" style="padding:11px 28px;background:#1e40af;color:white;border:none;border-radius:8px;cursor:pointer;font-size:15px;font-weight:bold;">🖨️ Imprimir</button>
    </div>
    </body></html>`);
    w.document.close();
}

function renderListaOrdenesCompra() {
    const cont = document.getElementById('contenidoOrdenesCompra');
    if (!cont) return;
        const lista = StorageService.get('ordenesCompra', []);
        const estadoColors = {
            Borrador:  '#9ca3af',
            Enviada:   '#2563eb',
            'Recibida Parcial': '#d97706',
            Parcial:   '#d97706',
            Recibida:  '#16a34a',
            Cancelada: '#dc2626'
        };
        // Filtrar: solo mostrar OCs abiertas y back orders pendientes
        const activos = lista.filter(oc =>
            (oc.estado === 'Borrador' || oc.estado === 'Enviada') ||
            (oc.folio.endsWith('-BO') && oc.estado !== 'Recibida')
        );
        const rows = activos.slice().reverse().map(oc => {
                const color    = estadoColors[oc.estado] || '#374151';
                const esActiva = oc.estado !== 'Recibida' && oc.estado !== 'Cancelada' && oc.estado !== 'Recibida Parcial';
                // Mostrar vínculo a OC padre si es back order
                const boVinculo = oc.ocPadre ? `<br><span style="font-size:11px;color:#d97706;">BO de <b>${(lista.find(x=>x.id===oc.ocPadre)?.folio)||''}</b></span>` : '';
                // Mostrar vínculo a back order si existe
                const boHijo = oc.backOrderId ? `<br><span style="font-size:11px;color:#d97706;">→ BO: <b>${(lista.find(x=>x.id===oc.backOrderId)?.folio)||''}</b></span>` : '';
                
                // Calcular saldo pendiente (compatible con OCs viejas y nuevas)
                const anticipoPrevio = oc.anticipo_pagado || 0;
                let saldoPendiente = oc.saldoPendiente !== undefined ? oc.saldoPendiente : Math.max(0, oc.total - anticipoPrevio);

                return `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:10px;font-weight:bold;">${oc.folio}${boVinculo}${boHijo}</td>
                    <td style="padding:10px;">${oc.proveedorNombre}</td>
                    <td style="padding:10px;">${window.formatearFechaCortaMX(oc.fechaEmision)}</td>
                    <td style="padding:10px;">${oc.fechaEntregaEstimada ? window.formatearFechaCortaMX(oc.fechaEntregaEstimada) : '—'}</td>
                    <td style="padding:10px;text-align:right;">
                        <strong style="color:#1e40af;">${dinero(oc.total)}</strong><br>
                        <span style="font-size:11px;color:#dc2626;">Saldo: ${dinero(saldoPendiente)}</span>
                    </td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:${color}20;color:${color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;">${oc.estado}</span>
                    </td>
                    <td style="padding:10px;text-align:center;">
                        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                            <button onclick="imprimirOrdenCompra(${oc.id})" title="Imprimir OC" style="background:none;border:none;cursor:pointer;font-size:17px;">🖨️</button>
                            <button onclick="abrirModalAbonoOC(${oc.id})" title="Abonar a OC" style="background:none;border:none;cursor:pointer;font-size:17px; opacity:${saldoPendiente <= 0 ? '0.3' : '1'};" ${saldoPendiente <= 0 ? 'disabled' : ''}>💰</button>
                            ${esActiva ? `<button onclick="recibirOrdenCompra(${oc.id})" title="Recibir mercancía" style="background:none;border:none;cursor:pointer;font-size:17px;">📦</button>` : ''}
                            ${(oc.estado === 'Borrador' || oc.estado === 'Enviada') ? `<button onclick="editarOrdenCompra(${oc.id})" title="Editar" style="background:none;border:none;cursor:pointer;font-size:17px;">✏️</button>` : ''}
                            ${(oc.estado === 'Borrador' || oc.estado === 'Enviada') ? `<button onclick="confirmarEliminarOC(${oc.id})" title="Cancelar y Revertir Orden" style="background:none;border:none;cursor:pointer;font-size:17px;">🗑️</button>` : ''}
                    </td>
                </tr>`;
        }).join('');

        cont.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;color:#1e40af;">📋 Órdenes de Compra</h3>
                <button onclick="abrirNuevaOrdenCompra()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nueva OC</button>
        </div>
        <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                ${activos.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:30px;">Sin órdenes de compra.</p>' : `
                <div style="overflow-x:auto;">
                    <table style="width:100%;border-collapse:collapse;font-size:14px;">
                        <thead><tr style="background:#f3f4f6;">
                            <th style="padding:10px;text-align:left;">Folio</th>
                            <th style="padding:10px;text-align:left;">Proveedor</th>
                            <th style="padding:10px;text-align:left;">Emisión</th>
                            <th style="padding:10px;text-align:left;">Entrega Est.</th>
                            <th style="padding:10px;text-align:right;">Total</th>
                            <th style="padding:10px;text-align:center;">Estado</th>
                            <th style="padding:10px;text-align:center;">Acciones</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`}
        </div>`;
}

function editarOrdenCompra(id) {
    const lista = StorageService.get('ordenesCompra', []);
    const oc    = lista.find(x => x.id === id);
    if (!oc) return alert('OC no encontrada.');
    if (oc.estado === 'Recibida')  return alert('No se puede editar una OC ya recibida.');
    if (oc.estado === 'Cancelada') return alert('No se puede editar una OC cancelada.');

    const provs    = StorageService.get('proveedores', []);
    const prods    = StorageService.get('productos',   []);
    const selProvs = provs.map(p =>
        `<option value="${p.id}" ${String(oc.proveedorId) === String(p.id) ? 'selected' : ''}>${p.nombre}</option>`
    ).join('');
    const selProds = prods.map(p =>
        `<option value="${p.id}" data-costo="${p.costo || 0}">${p.nombre} (${dinero(p.costo || 0)})</option>`
    ).join('');

    const html = `
    <div data-modal="editar-oc" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:950px;padding:30px;margin:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;color:#1e40af;">✏️ Editar OC — ${oc.folio}</h2>
            <button onclick="document.querySelector('[data-modal=editar-oc]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">PROVEEDOR</label>
            <select id="editOcProveedor" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="">-- Selecciona proveedor --</option>${selProvs}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA ENTREGA ESTIMADA</label>
            <input type="date" id="editOcFechaEntrega" value="${oc.fechaEntregaEstimada?.substring(0,10) || ''}"
                   style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end;margin-bottom:12px;">
          <div>
            <input type="hidden" id="editOcProductoSel" value="">
            <div style="display:flex;align-items:center;gap:6px;">
                <span id="editOcProductoSel-display"
                      style="flex:1;padding:9px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    Sin seleccionar
                </span>
                <button type="button"
        onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){document.getElementById('editOcProductoSel').value=p.id;var d=document.getElementById('editOcProductoSel-display');d.textContent=p.nombre+' ('+dinero(p.costo||0)+')';d.style.color='#111827';alert('💡 Referencia de costo:\\nEl último costo registrado para este producto es de: $' + (p.costo || 0));}})"
        style="padding:9px 12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;font-size:13px;">
    🔍 Buscar
</button>
            </div>
          </div>
          <input type="number" id="editOcCantidad" value="1" min="1" style="width:70px;padding:9px;border:1px solid #d1d5db;border-radius:6px;">
          <button onclick="agregarArticuloEditOC()" style="padding:9px 14px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;">➕</button>
        </div>
        <div id="editTablaArticulosOC" style="margin-bottom:14px;"></div>
        <div style="margin-bottom:12px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;">NOTAS</label>
          <textarea id="editOcNotas" rows="2" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">${oc.notas || ''}</textarea>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <strong>Total: <span id="editOcTotal" style="color:#1e40af;font-size:18px;">$0.00</span></strong>
        </div>
        <div style="display:flex;gap:10px;">
          <button onclick="guardarEdicionOC(${id})" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar Cambios</button>
          <button onclick="document.querySelector('[data-modal=editar-oc]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    window._editArticulosOC = JSON.parse(JSON.stringify(oc.articulos));
    _renderEditTablaOC();
}

function agregarArticuloEditOC() {
    const sel  = document.getElementById('editOcProductoSel');
    const cant = parseInt(document.getElementById('editOcCantidad').value) || 1;
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod  = prods.find(p => String(p.id) === String(sel.value));
    if (!prod) return;
    if (!window._editArticulosOC) window._editArticulosOC = [];
    const idx = window._editArticulosOC.findIndex(a => String(a.productoId) === String(prod.id));
    if (idx !== -1) {
        window._editArticulosOC[idx].cantidad += cant;
        window._editArticulosOC[idx].subtotal  = window._editArticulosOC[idx].cantidad * prod.costo;
    } else {
        window._editArticulosOC.push({ productoId: prod.id, nombre: prod.nombre, costo: prod.costo || 0, cantidad: cant, subtotal: cant * (prod.costo || 0) });
    }
    // Resetear picker de producto en editar OC
    sel.value = '';
    const displayEditOC = document.getElementById('editOcProductoSel-display');
    if (displayEditOC) { displayEditOC.textContent = 'Sin seleccionar'; displayEditOC.style.color = '#6b7280'; }
    document.getElementById('editOcCantidad').value = 1;
    _renderEditTablaOC();
}

function _renderEditTablaOC() {
    const cont = document.getElementById('editTablaArticulosOC');
    if (!cont) return;
    const arts = window._editArticulosOC || [];
    if (arts.length === 0) { cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:10px;">Sin artículos</p>'; document.getElementById('editOcTotal').textContent = dinero(0); return; }
    let total = 0;
    const rows = arts.map((a, i) => { total += a.subtotal; return `<tr>
        <td style="padding:8px;">${a.nombre}</td>
        <td style="padding:8px;text-align:center;">${dinero(a.costo)}</td>
        <td style="padding:8px;text-align:center;">${a.cantidad}</td>
        <td style="padding:8px;text-align:right;">${dinero(a.subtotal)}</td>
        <td style="padding:8px;text-align:center;"><button onclick="window._editArticulosOC.splice(${i},1);_renderEditTablaOC();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
    </tr>`; }).join('');
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;"><thead><tr style="background:#f3f4f6;"><th style="padding:8px;">Artículo</th><th style="padding:8px;text-align:center;">Costo</th><th style="padding:8px;text-align:center;">Cant.</th><th style="padding:8px;text-align:right;">Subtotal</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
    document.getElementById('editOcTotal').textContent = dinero(total);
}

function guardarEdicionOC(id) {
    const arts = window._editArticulosOC || [];
    if (arts.length === 0) return alert('⚠️ Agrega al menos un artículo.');
    const provId       = document.getElementById('editOcProveedor')?.value;
    const fechaEntrega = document.getElementById('editOcFechaEntrega')?.value;
    const notas        = document.getElementById('editOcNotas')?.value.trim() || '';
    const provs        = StorageService.get('proveedores', []);
    const prov         = provs.find(p => String(p.id) === String(provId));
    const lista        = StorageService.get('ordenesCompra', []);
    const idx          = lista.findIndex(x => x.id === id);
    if (idx === -1) return;
    lista[idx] = {
        ...lista[idx],
        proveedorId:           provId || lista[idx].proveedorId,
        proveedorNombre:       prov ? prov.nombre : lista[idx].proveedorNombre,
        articulos:             arts,
        total:                 arts.reduce((s, a) => s + a.subtotal, 0),
        fechaEntregaEstimada:  fechaEntrega || null,
        notas,
        fechaModificacion:     window.localISO(new Date())
    };
    StorageService.set('ordenesCompra', lista);
    document.querySelector('[data-modal="editar-oc"]')?.remove();
    alert('✅ Orden de compra actualizada.');
    renderListaOrdenesCompra();
}
// Función auxiliar para listar tus cuentas de débito
function _generarOpcionesCuentasDebito() {
    const cuentas = StorageService.get("cuentas-bancarias", []);  // ← corregido: guión igual que el resto del sistema
    let opciones = `<option value="efectivo">💵 Efectivo (Caja Chica)</option>`;
    
    cuentas.forEach(c => {
        // Buscamos las que tengan la palabra "debito" en su tipo
        if (c.tipo && c.tipo.toLowerCase().includes("debito")) {
            opciones += `<option value="${c.nombre}">💳 Débito: ${c.nombre}</option>`;
        }
    });
    return opciones;
}
// ============================================================
// MÓDULO DE REQUISICIONES Y COMPRAS MULTI-ARTÍCULO
// ============================================================

function renderRequisiciones() {
    const contenedor = document.getElementById("contenidoRequisiciones");
    if (!contenedor) return;

    const reqs = StorageService.get("requisicionesCompra", []).filter(r => r.estatus === "Pendiente");

    if (reqs.length === 0) {
        contenedor.innerHTML = `
            <div style="background:white; padding:40px; border-radius:10px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <h2 style="color:#16a34a;">✅ Todo al día</h2>
                <p style="color:#6b7280;">No hay requisiciones pendientes. Todo lo vendido tenía stock.</p>
            </div>`;
        return;
    }

    let filas = reqs.map(r => `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding:10px; text-align:center;">
                <input type="checkbox" class="chk-req" value="${r.id}" style="width:18px; height:18px; cursor:pointer;">
            </td>
            <td style="padding:10px;">${r.fecha}</td>
            <td style="padding:10px; font-weight:bold; color:#1e40af;">${r.folioVenta}</td>
            <td style="padding:10px;">${r.producto}</td>
            <td style="padding:10px; text-align:center; font-weight:bold;">${r.cantidad}</td>
            <td style="padding:10px;"><span style="background:#fef3c7; color:#d97706; padding:4px 8px; border-radius:4px; font-size:12px;">${r.estatus}</span></td>
        </tr>
    `).join('');

    contenedor.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0; color:#1e40af;">📋 Requisiciones Pendientes</h2>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button onclick="iniciarOrdenDesdeRequisiciones()" 
                        style="padding:10px 15px; background:#1e40af; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    🛒 Nueva OC
                </button>
                <button onclick="abrirModalAgregarA_OC_Existente()" 
                        style="padding:10px 15px; background:#d97706; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    📥 Añadir a OC Existente
                </button>
                <button onclick="iniciarCompraDirectaDesdeRequisiciones()" 
                        style="padding:10px 15px; background:#059669; color:white; border:none; border-radius:6px; font-weight:bold; font-size:13px; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    🚀 Compra directa
                </button>
            </div>
        </div>

        <div style="background:white; border-radius:10px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <table style="width:100%; border-collapse:collapse; font-size:14px;">
                <thead>
                    <tr style="background:#f8fafc; border-bottom:2px solid #e2e8f0; color:#475569;">
                        <th style="padding:12px; text-align:center;"><input type="checkbox" onchange="document.querySelectorAll('.chk-req').forEach(c => c.checked = this.checked)" style="width:18px; height:18px;"></th>
                        <th style="padding:12px; text-align:left;">Fecha</th>
                        <th style="padding:12px; text-align:left;">Folio Venta</th>
                        <th style="padding:12px; text-align:left;">Producto / Variante</th>
                        <th style="padding:12px; text-align:center;">Cantidad</th>
                        <th style="padding:12px; text-align:left;">Estatus</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
        </div>
    `;
}

function iniciarOrdenDesdeRequisiciones() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición.");

    // 1. Abrimos tu modal oficial de Orden de Compra
    abrirNuevaOrdenCompra();

    // 2. Le inyectamos los productos seleccionados directamente
    const reqsTotales = StorageService.get("requisicionesCompra", []);
    const prods = StorageService.get("productos", []);
    
    window._articulosOC = [];
    window._requisicionesVinculadasA_OC = seleccionados;

    seleccionados.forEach(idReq => {
        const req = reqsTotales.find(r => String(r.id) === String(idReq));
        if (req) {
            const prod = prods.find(p => String(p.id) === String(req.productoId));
            window._articulosOC.push({
                productoId: req.productoId,
                nombre: req.producto,
                cantidad: parseInt(req.cantidad) || 1,
                costo: prod ? parseFloat(prod.costo) : 0,
                subtotal: (parseInt(req.cantidad) || 1) * (prod ? parseFloat(prod.costo) : 0),
                caracteristicas: `Req. Venta: ${req.folioVenta}`
            });
        }
    });

    _renderTablaArticulosOC();
}

function iniciarCompraDirectaDesdeRequisiciones() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición.");

    // 1. Abrimos el nuevo modal de Compra Directa Multi-Artículo
    abrirModalCompraDirectaMulti();

    // 2. Le inyectamos los productos seleccionados
    const reqsTotales = StorageService.get("requisicionesCompra", []);
    const prods = StorageService.get("productos", []);
    
    window._articulosCompraDirecta = [];
    window._requisicionesVinculadasA_CD = seleccionados;

    seleccionados.forEach(idReq => {
        const req = reqsTotales.find(r => String(r.id) === String(idReq));
        if (req) {
            const prod = prods.find(p => String(p.id) === String(req.productoId));
            window._articulosCompraDirecta.push({
                productoId: req.productoId,
                nombre: req.producto,
                cantidad: parseInt(req.cantidad) || 1,
                costo: prod ? parseFloat(prod.costo) : 0,
                subtotal: (parseInt(req.cantidad) || 1) * (prod ? parseFloat(prod.costo) : 0),
                color: 'General',
                ubicacion: 'General'
            });
        }
    });

    _renderTablaArticulosCompraDirecta();
}

// -----------------------------------------------------------
// NUEVO MOTOR: COMPRA DIRECTA MULTI-ARTÍCULO
// -----------------------------------------------------------
function abrirModalCompraDirectaMulti() {
    const provs = StorageService.get('proveedores', []);
    const selProvs = provs.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    
    const ubicaciones = StorageService.get("ubicacionesConfig", []);
    // Al dejar el value="" vacío, el sistema sabe que no hay respuesta aún
    let selUbi = '<option value="">-- 🛑 OBLIGATORIO: Elige Bodega --</option>';
    ubicaciones.forEach(u => {
        if(u.nombre !== 'General') selUbi += `<option value="${u.nombre}">${u.nombre}</option>`;
    });

    const html = `
    <div data-modal="nueva-compra-directa" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:1000px;padding:30px;margin:auto;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="margin:0;color:#059669;">🚀 Registro de Compra Directa Múltiple</h2>
            <button onclick="document.querySelector('[data-modal=nueva-compra-directa]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#9ca3af;">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">🏢 PROVEEDOR</label>
            <select id="cdProveedor" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
                <option value="">-- Selecciona proveedor --</option>${selProvs}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">📅 FECHA</label>
            <input type="date" id="cdFecha" value="${window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : new Date().toISOString().split('T')[0]}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          
          <div>
            <label style="font-size:12px; font-weight:bold; color:#374151;">💳 MÉTODO DE PAGO</label>
            <select id="cdMetodoPago" onchange="document.getElementById('divMsiCD').style.display=(this.value==='tarjeta_msi'?'block':'none'); document.getElementById('divCuentaCD').style.display=(this.value==='contado'?'block':'none'); document.getElementById('alertaConsigCD').style.display=(this.value==='consignacion'?'block':'none');" 
                    style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
                <option value="contado">Contado</option>
                <option value="credito_proveedor">Crédito Proveedor</option>
                <option value="tarjeta_msi">Meses sin Intereses (MSI)</option>
                <option value="consignacion" style="color:#10b981; font-weight:bold;">A Consignación</option>
            </select>
            <div id="alertaConsigCD" style="display:none; background:#ecfdf5; border:1px solid #10b981; padding:8px; border-radius:6px; margin-top:8px; font-size:11px; color:#065f46;">
                ✅ <b>Modo Consignación:</b> Esta compra entrará al inventario pero NO generará una deuda inmediata exigible.
            </div>
          </div>

          <div>
              <div id="divCuentaCD">
                  <label style="font-size:12px; font-weight:bold; color:#374151;">🏦 CUENTA DE ORIGEN</label>
                  <select id="cdCuentaOrigen" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></select>
              </div>
              <div id="divMsiCD" style="display:none;">
                  <div style="display:flex; gap:10px;">
                      <div style="flex:1;">
                          <label style="font-size:12px; font-weight:bold; color:#374151;">BANCO MSI</label>
                          <select id="cdBancoMSI" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;"></select>
                      </div>
                      <div style="width:80px;">
                          <label style="font-size:12px; font-weight:bold; color:#374151;">MESES</label>
                          <input type="number" id="cdMesesMSI" value="12" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
                      </div>
                  </div>
              </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;margin-bottom:12px;">
          <div>
            <input type="hidden" id="cdProductoSel" value="">
            <div style="display:flex;align-items:center;gap:6px;">
                <span id="cdProductoSel-display" style="flex:1;padding:9px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#6b7280;font-size:14px;">Sin seleccionar</span>
                <button type="button" onclick="abrirSelectorProducto({titulo:'🔍 Seleccionar Producto',onSeleccion:function(p){document.getElementById('cdProductoSel').value=p.id;var d=document.getElementById('cdProductoSel-display');d.textContent=p.nombre+' ('+dinero(p.costo||0)+')';d.style.color='#111827';}})" style="padding:9px 12px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;">🔍 Buscar</button>
            </div>
          </div>
          <button onclick="agregarArticuloCompraDirecta()" style="padding:9px 16px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Añadir Artículo</button>
        </div>

        <div id="tablaArticulosCompraDirecta" style="margin-bottom:16px;"></div>
        
        <div style="margin-bottom:15px; padding:12px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:bold; color:#1e40af; font-size:13px;">
                <input type="checkbox" id="cdIngresoInmediato" checked style="width:18px; height:18px; accent-color:#059669;">
                📦 Ingresar mercancía al inventario de inmediato
            </label>
            <p style="margin:5px 0 0 26px; font-size:11px; color:#475569; line-height:1.3;">
                Si desmarcas esta opción, se generará la cuenta por pagar/pago, pero la mercancía se irá a <b>Recepciones Pendientes</b> para darle entrada después.
            </p>
        </div>
        
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px; border-top:2px solid #e2e8f0; padding-top:15px;">
          <strong>Total a Pagar: <span id="cdTotal" style="color:#059669;font-size:22px;">$0.00</span></strong>
        </div>

        <div style="display:flex;gap:10px;">
          <button onclick="guardarCompraDirectaFinal()" style="flex:2;padding:14px;background:#059669;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;font-size:16px;">✅ Guardar Compra</button>
          <button onclick="document.querySelector('[data-modal=nueva-compra-directa]')?.remove()" style="flex:1;padding:14px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
    window._articulosCompraDirecta = window._articulosCompraDirecta || [];
    window._opcionesUbiCD = selUbi;
    
    _poblarCuentasOrigen('cdCuentaOrigen');
    
    const selectBanco = document.getElementById("cdBancoMSI");
    if (selectBanco) {
        const tarjetasConfig = StorageService.get("tarjetasConfig", []);
        const bancosMSI = tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito");
        selectBanco.innerHTML = bancosMSI.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
    }

    _renderTablaArticulosCompraDirecta();
}

function agregarArticuloCompraDirecta() {
    const sel = document.getElementById('cdProductoSel');
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod = prods.find(p => String(p.id) === String(sel.value));
    if (!prod) return;
    
    window._articulosCompraDirecta.push({ 
        productoId: prod.id, nombre: prod.nombre, costo: prod.costo || 0, cantidad: 1, 
        subtotal: prod.costo || 0, color: 'General', ubicacion: 'General'
    });
    
    sel.value = '';
    const display = document.getElementById('cdProductoSel-display');
    if (display) { display.textContent = 'Sin seleccionar'; display.style.color = '#6b7280'; }
    _renderTablaArticulosCompraDirecta();
}

function _renderTablaArticulosCompraDirecta() {
    const cont = document.getElementById('tablaArticulosCompraDirecta');
    if (!cont) return;
    const arts = window._articulosCompraDirecta || [];
    if (arts.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:12px; border:1px dashed #cbd5e1; border-radius:8px;">No hay productos en esta compra.</p>';
        document.getElementById('cdTotal').textContent = dinero(0);
        return;
    }
    
    let total = 0;
    const esAdmin = (typeof window.esAdmin === 'function') ? window.esAdmin() : (typeof esAdmin === 'function' ? esAdmin() : false);
    
    const rows = arts.map((a, i) => {
        total += a.subtotal;
        return `<tr>
            <td style="padding:8px;">${a.nombre}</td>
            <td style="padding:8px;text-align:center;"><input type="text" value="${a.color}" placeholder="Color" onchange="window._articulosCompraDirecta[${i}].color = this.value;" style="width:80px;padding:5px;border:1px solid #cbd5e1;border-radius:4px;"></td>
            <td style="padding:8px;text-align:center;">
                <select onchange="window._articulosCompraDirecta[${i}].ubicacion = this.value;" style="width:100px;padding:5px;border:1px solid #cbd5e1;border-radius:4px;">
                    ${window._opcionesUbiCD.replace(`value="${a.ubicacion}"`, `value="${a.ubicacion}" selected`)}
                </select>
            </td>
            <td style="padding:8px;text-align:center;">
                <input type="number" min="0" step="0.01" value="${a.costo}" style="width:80px;text-align:right;" ${esAdmin ? '' : 'readonly disabled'} 
                       onchange="if(${esAdmin}){window._articulosCompraDirecta[${i}].costo = parseFloat(event.target.value)||0; window._articulosCompraDirecta[${i}].subtotal = window._articulosCompraDirecta[${i}].cantidad * window._articulosCompraDirecta[${i}].costo; _renderTablaArticulosCompraDirecta();}" />
            </td>
            <td style="padding:8px;text-align:center;">
                <input type="number" min="1" value="${a.cantidad}" style="width:60px;text-align:center;" 
                       onchange="window._articulosCompraDirecta[${i}].cantidad = parseInt(event.target.value)||1; window._articulosCompraDirecta[${i}].subtotal = window._articulosCompraDirecta[${i}].cantidad * window._articulosCompraDirecta[${i}].costo; _renderTablaArticulosCompraDirecta();" />
            </td>
            <td style="padding:8px;text-align:right; font-weight:bold;">${dinero(a.subtotal)}</td>
            <td style="padding:8px;text-align:center;"><button onclick="window._articulosCompraDirecta.splice(${i},1);_renderTablaArticulosCompraDirecta();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
        </tr>`;
    }).join('');
    
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f3f4f6;"><th style="padding:8px;text-align:left;">Producto</th><th style="padding:8px;text-align:center;">Color</th><th style="padding:8px;text-align:center;">Bodega</th><th style="padding:8px;text-align:center;">Costo Unit.</th><th style="padding:8px;text-align:center;">Cant.</th><th style="padding:8px;text-align:right;">Subtotal</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
    </table>`;
    document.getElementById('cdTotal').textContent = dinero(total);
}

function guardarCompraDirectaFinal() {
    const provId = document.getElementById('cdProveedor')?.value;
    if (!provId) return alert("⚠️ Selecciona el proveedor.");
    
    const arts = window._articulosCompraDirecta || [];
    if (arts.length === 0) return alert("⚠️ La compra está vacía.");

    const provs = StorageService.get('proveedores', []);
    const prov = provs.find(p => String(p.id) === String(provId));
    if(!prov) return alert("Proveedor no encontrado.");

    const fechaStr = document.getElementById('cdFecha').value;
    const fechaFormatMX = fechaStr.split('-').reverse().join('/');

    let selectsBodega = document.querySelectorAll("select[id^='cdUbicacion_']");
    for (let i = 0; i < selectsBodega.length; i++) {
        let valorBodega = selectsBodega[i].value;
        if (!valorBodega || valorBodega === "" || valorBodega === "General") {
            alert(`❌ BLOQUEO DE AUDITORÍA: No has seleccionado la bodega de destino para el artículo en la fila ${i + 1}.\n\nRevisa la tabla y asigna una ubicación antes de guardar.`);
            return; // Aborta todo el proceso de guardado inmediatamente
        }
    }
    
    const metodoPago = document.getElementById('cdMetodoPago').value;
    const comboPago = document.getElementById("cdMetodoPago");
    const formaPagoTexto = comboPago.options[comboPago.selectedIndex].text;

    const cuentaOrigenId = document.getElementById('cdCuentaOrigen')?.value || "efectivo";
    const cuentaOrigenNombre = document.getElementById('cdCuentaOrigen')?.options[document.getElementById('cdCuentaOrigen').selectedIndex]?.text || "Efectivo";
    
    // 👇 Leemos tus campos nativos de MSI 👇
    const bancoSel = document.getElementById('cdBancoMSI')?.value || "";
    const msiMeses = parseInt(document.getElementById('cdMesesMSI')?.value) || 12;
    
    const ingresoInmediato = document.getElementById('cdIngresoInmediato')?.checked ?? true;
    const totalCompra = arts.reduce((s, a) => s + a.subtotal, 0);

    const msjConfirmar = `¿Deseas registrar esta compra?\n\nProveedor: ${prov.nombre}\nTotal de artículos: ${arts.length}\nTotal a pagar: ${dinero(totalCompra)}\nMétodo: ${formaPagoTexto}\nInventario: ${ingresoInmediato ? 'ENTRA AHORA ✅' : 'A RECEPCIONES ⏳'}`;
    if (!confirm(msjConfirmar)) return;

    let comprasList = StorageService.get("compras", []);
    let recepciones = StorageService.get("recepciones", []);
    let productos = StorageService.get("productos", []);
    let movimientosInventario = StorageService.get("movimientosInventario", []);

    const idCompraUnico = Date.now();
    let avisoActualizacion = "";

    arts.forEach((art, index) => {
        // 1. Historial de Costos
        guardarHistorialCosto({
            productoId: art.productoId, precioCompra: art.costo, fecha: fechaFormatMX,
            cantidad: art.cantidad, proveedorId: prov.id, proveedorNombre: prov.nombre, origen: 'compra directa multi'
        });

        // 2. Inventario inmediato
        if (ingresoInmediato) {
            const pidx = productos.findIndex(p => String(p.id) === String(art.productoId));
            if (pidx !== -1) {
                let p = productos[pidx];
                if (art.costo > p.costo) {
                    let margenAplicar = 30;
                    const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(art.costo, margenAplicar);
                    avisoActualizacion += `\n- ${p.nombre}: Costo subió a ${dinero(art.costo)}.`;
                    p.costo = art.costo;
                    p.precio = nuevoPrecio;
                }

                p.stock = (Number(p.stock) || 0) + art.cantidad;
                p.variantes = p.variantes || [];
                const colFinal = art.color || 'General';
                const ubiFinal = art.ubicacion || 'General';
                const existente = p.variantes.find(v => (v.ubicacion || 'General').toUpperCase() === ubiFinal.toUpperCase() && (v.color || 'General').toUpperCase() === colFinal.toUpperCase());
                
                if (existente) {
                    existente.stock = (Number(existente.stock) || 0) + art.cantidad;
                } else {
                    p.variantes.push({ ubicacion: ubiFinal, color: colFinal, stock: art.cantidad });
                }

                movimientosInventario.push({
                    id: Date.now() + Math.random(),
                    productoId: art.productoId,
                    tipo: 'entrada',
                    cantidad: art.cantidad,
                    concepto: `Compra Directa Múltiple a ${prov.nombre} (${colFinal})`,
                    fecha: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString()
                });
            }
        }

        // 3. Recepciones (Tarjeta individual)
        recepciones.push({
            id: idCompraUnico + 1 + index,
            compraId: idCompraUnico,
            productoId: art.productoId,
            productoNombre: art.nombre,
            cantidadTotal: art.cantidad,
            cantidadRecibida: ingresoInmediato ? art.cantidad : 0,
            cantidadPendiente: ingresoInmediato ? 0 : art.cantidad,
            proveedor: prov.nombre,
            fechaPedido: fechaFormatMX,
            metodoPago: formaPagoTexto,
            estatus: ingresoInmediato ? "Completado" : "Pendiente",
            color: art.color,
            ubicacion: art.ubicacion
        });
    });

    // 4. Guardar Compra Maestro
    const nuevaCompra = {
        id: idCompraUnico,
        folio: `CD-${idCompraUnico.toString().slice(-6)}`,
        proveedor: prov.nombre,
        proveedorId: prov.id,
        total: totalCompra,
        fecha: fechaFormatMX,
        fechaISO: fechaStr,
        articulos: arts,
        metodo: metodoPago,
        saldoPendiente: metodoPago !== 'contado' ? totalCompra : 0
    };
    comprasList.push(nuevaCompra);

    // 👇 5. LÓGICA DE DISTRIBUCIÓN DE DEUDA/PAGO NATIVA 👇
    
    // Extraemos todos los nombres de los productos separados por comas
    const nombresProductos = arts.map(a => a.nombre).join(', ');
    // Creamos la etiqueta perfecta para tu conciliación
    const conceptoCombinado = `Compra: ${nombresProductos} (Prov: ${prov.nombre})`;

    if (metodoPago === "contado") {
        window._egresarCuenta({
            monto: totalCompra, cuentaId: cuentaOrigenId, etiqueta: cuentaOrigenNombre,
            concepto: conceptoCombinado, referencia: `COMPRA-${idCompraUnico}`
        });
    } 
    else if (metodoPago === "credito_proveedor" || metodoPago === "consignacion") {
        let cuentasProv = StorageService.get("cuentasPorPagar", []);
        cuentasProv.push({
            id: idCompraUnico + 2,
            compraId: idCompraUnico,
            proveedor: prov.nombre,
            producto: nombresProductos, // 🔥 Antes decía "Varios"
            total: totalCompra,
            saldoPendiente: totalCompra,
            metodo: metodoPago,
            formaPagoTexto: formaPagoTexto,
            fecha: fechaFormatMX,
            vencimiento: metodoPago === "consignacion" ? "Al venderse" : "Revisar CXP",
            esConsignacion: metodoPago === "consignacion"
        });
        StorageService.set("cuentasPorPagar", cuentasProv);
    }
    else if (metodoPago === "tarjeta_msi") {
        // 🚀 MOTOR BANCARIO: MSI CON CÁLCULO UNIVERSAL DE CORTE Y PAGO 🚀
        let cuentasBancos = StorageService.get("cuentasMSI", []);
        let tarjetasConfig = StorageService.get("tarjetasConfig", []);
        
        let infoTarjeta = tarjetasConfig.find(t => t.banco === bancoSel) || {};
        let diaCorte = parseInt(infoTarjeta.diaCorte) || 15;
        let diaPago = parseInt(infoTarjeta.diaLimite || infoTarjeta.diaPago || 5);

        let calendario = [];
        let cuotaMensual = parseFloat((totalCompra / msiMeses).toFixed(2));
        
        let fechaPartes = fechaStr.split('-'); 
        let anioCompra = parseInt(fechaPartes[0]);
        let mesCompra = parseInt(fechaPartes[1]) - 1; 
        let diaCompra = parseInt(fechaPartes[2]);

        let brincoCorte = (diaCompra > diaCorte) ? 1 : 0;
        let brincoPago = (diaCorte > diaPago) ? 1 : 0;
        let mesPrimerPago = mesCompra + brincoCorte + brincoPago;

        for (let i = 1; i <= msiMeses; i++) {
            let fCalculada = new Date(anioCompra, mesPrimerPago + (i - 1), diaPago, 12, 0, 0);
            let yyyy = fCalculada.getFullYear();
            let mm = String(fCalculada.getMonth() + 1).padStart(2, '0');
            let dd = String(fCalculada.getDate()).padStart(2, '0');
            
            calendario.push({
                n: i,
                fecha: `${yyyy}-${mm}-${dd}`,
                monto: cuotaMensual,
                estado: "Pendiente",
                montoAbonado: 0,
                conciliado: false
            });
        }

        cuentasBancos.push({
            id: idCompraUnico + 3,
            compraId: idCompraUnico,
            banco: bancoSel,
            concepto: conceptoCombinado, // 🔥 Etiqueta combinada en lugar de "Compra Directa"
            producto: nombresProductos,
            total: totalCompra,
            meses: msiMeses,
            cuotaMensual: cuotaMensual,
            fecha: fechaFormatMX,
            fechaCompra: fechaStr,
            calendario: calendario,
            pagosRealizados: 0
        });
        StorageService.set("cuentasMSI", cuentasBancos);
    }

    if (window._requisicionesVinculadasA_CD && window._requisicionesVinculadasA_CD.length > 0) {
        let reqsTotales = StorageService.get("requisicionesCompra", []);
        window._requisicionesVinculadasA_CD.forEach(idReq => {
            let r = reqsTotales.find(x => String(x.id) === String(idReq));
            if (r) r.estatus = `Comprado`;
        });
        StorageService.set("requisicionesCompra", reqsTotales);
        window._requisicionesVinculadasA_CD = null;
    }

    StorageService.set("productos", productos);
    StorageService.set("compras", comprasList);
    StorageService.set("recepciones", recepciones);
    StorageService.set("movimientosInventario", movimientosInventario);

    document.querySelector('[data-modal="nueva-compra-directa"]')?.remove();
    alert(`✅ Compra Directa Registrada Exitosamente.${ingresoInmediato ? '' : '\\n⏳ La mercancía fue enviada a Recepciones Pendientes.'}${avisoActualizacion}`);

    if (typeof renderRequisiciones === 'function') renderRequisiciones();
}

// ===== CUENTAS POR PAGAR =====
function renderCuentasPorPagar() {
    const contenedor = document.getElementById("listaCuentasPorPagar");
    if (!contenedor) return;

    // Bloque para mostrar Saldos a Favor al inicio de CXP
    const saldosFavor = StorageService.get("saldosFavorProveedores", []).filter(s => s.montoDisponible > 0);
    let htmlSaldos = "";
    if (saldosFavor.length > 0) {
        htmlSaldos = `<div style="background:#ecfdf5; border:1px solid #10b981; padding:15px; border-radius:10px; margin-bottom:20px;">
            <h4 style="margin:0 0 10px; color:#065f46;">💰 SALDOS A FAVOR DISPONIBLES</h4>
            <table style="width:100%; font-size:13px;">
                ${saldosFavor.map(s => `<tr>
                    <td><b>${s.proveedorNombre}</b></td>
                    <td>Ref: ${s.referencia}</td>
                    <td style="text-align:right; color:#059669; font-weight:bold;">${dinero(s.montoDisponible)}</td>
                </tr>`).join('')}
            </table>
        </div>`;
    }

    let cuentas = StorageService.get("cuentasPorPagar", []) || [];
    
    // Filtro blindado contra valores vacíos
    let deudas = cuentas.filter(c => parseFloat(c.saldoPendiente || 0) > 0);

    if (deudas.length === 0) {
        contenedor.innerHTML = htmlSaldos + "<p style='text-align:center; padding:20px; color:#10b981; font-weight:bold;'>✅ ¡No tienes deudas pendientes con proveedores!</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead>
                <tr>
                    <th>Fecha / Proveedor</th>
                    <th>Método</th>
                    <th>Total</th>
                    <th>Saldo Pendiente</th>
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>`;

    deudas.forEach(c => {
        // Formateo de fecha por si viene cruda
        const fechaVenta = c.fecha ? window.formatearFechaCortaMX(c.fecha) : '-';

        html += `
            <tr>
                <td>
                    ${fechaVenta}<br>
                    <strong style="cursor:pointer; color:#2980b9; text-decoration:underline;" onclick="verDetalleCompra('${c.id}')">${c.proveedor || 'General'}</strong>
                </td>
                <td><small>${c.metodo || c.formaPagoTexto || '-'}</small></td>
                <td>${dinero(c.total)}</td>
                <td style="color:red; font-weight:bold;">${dinero(c.saldoPendiente)}</td>
                <td>
                    <button onclick="registrarAbonoProveedor('${c.id}')" style="background:#2c3e50; color:white; border:none; padding:8px 12px; border-radius:5px; cursor:pointer; font-weight:bold;">
                        💵 Abonar
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = htmlSaldos + html + "</tbody></table>";
}

window.abrirModalAbonoOC = function(idOC) {
    const ordenes = StorageService.get("ordenesCompra", []);
    const fechaHoy = window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0];
    const oc = ordenes.find(o => o.id === idOC);
    if (!oc) return;

    const anticipoPrevio = oc.anticipo_pagado || 0;
    const saldoPendiente = oc.saldoPendiente !== undefined ? oc.saldoPendiente : Math.max(0, oc.total - anticipoPrevio);

    const html = `
    <div data-modal="abono-oc" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; align-items:center; justify-content:center;">
        <div style="background:white; padding:25px; border-radius:12px; width:400px; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#1e40af;">💰 Abonar a OC: ${oc.folio}</h3>
            <p style="color:#6b7280; font-size:14px; margin-bottom: 15px;">Saldo pendiente: <b style="color:#dc2626;">${dinero(saldoPendiente)}</b></p>
            
            <div style="margin-bottom:15px;">
                <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:5px;color:#334155;">Fecha del Pago:</label>
                <input type="date" id="fechaAbonoOC" value="${fechaHoy}" style="width:100%;padding:8px;border:1px solid #cbd5e1;border-radius:6px;font-family:sans-serif;">
             </div>

            <div style="margin-bottom:15px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:4px;">MONTO DEL ABONO</label>
                <input type="number" id="montoAbonoOC" max="${saldoPendiente}" placeholder="Ej: 500" style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px; font-size:16px;">
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:4px;">PAGAR DESDE (DÉBITO O EFECTIVO)</label>
                ${_buildSelectorCuentas('cuentaAbonoOC', false)}
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="confirmarAbonoOC(${oc.id})" style="flex:2; padding:12px; background:#059669; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Registrar Pago</button>
                <button onclick="document.querySelector('[data-modal=abono-oc]').remove()" style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.confirmarAbonoOC = function(idOC) {
    const ordenes = StorageService.get("ordenesCompra", []);
    const idx = ordenes.findIndex(o => o.id === idOC);
    if (idx === -1) return;

    // 👇 LEEMOS EL CALENDARIO 👇
    const fechaInput = document.getElementById("fechaAbonoOC").value;
    if (!fechaInput) return alert("❌ Error de Auditoría: Debes especificar la fecha del pago.");
    const fechaPagoFinal = `${fechaInput}T12:00:00.000`;

    const monto = parseFloat(document.getElementById('montoAbonoOC').value) || 0;
    const selectCuenta = document.getElementById('cuentaAbonoOC');
    const cuentaId = selectCuenta.value;
    const cuentaNombre = selectCuenta.options[selectCuenta.selectedIndex].text;

    const anticipoPrevio = ordenes[idx].anticipo_pagado || 0;
    const saldoPendiente = ordenes[idx].saldoPendiente !== undefined ? ordenes[idx].saldoPendiente : Math.max(0, ordenes[idx].total - anticipoPrevio);

    if (monto <= 0 || monto > saldoPendiente) return alert("⚠️ Monto inválido. Verifica el saldo pendiente.");

    // 1. Registrar el egreso en el flujo de caja (mandando la fecha)
    window._egresarCuenta({
        monto: monto,
        cuentaId: cuentaId,
        etiqueta: cuentaNombre,
        concepto: `Abono a Orden de Compra ${ordenes[idx].folio}`,
        referencia: ordenes[idx].folio,
        fecha: fechaPagoFinal // <-- SE INYECTA AQUÍ
    });

    // 2. Actualizar la OC
    ordenes[idx].pagos = ordenes[idx].pagos || [];
    ordenes[idx].pagos.push({ fecha: fechaPagoFinal, monto: monto, cuenta: cuentaNombre });
    ordenes[idx].saldoPendiente = saldoPendiente - monto;
    ordenes[idx].anticipo_pagado = anticipoPrevio + monto; 

    StorageService.set("ordenesCompra", ordenes);
    document.querySelector('[data-modal=abono-oc]').remove();
    alert("✅ Abono registrado exitosamente y retirado de la cuenta " + cuentaNombre);
    if(window.renderListaOrdenesCompra) renderListaOrdenesCompra();
};
window.abrirNuevaCompraDirectaBlanco = function() {
    // 1. Limpiamos la memoria para que sea una compra completamente nueva y vacía
    window._articulosCompraDirecta = [];
    window._requisicionesVinculadasA_CD = [];
    
    // 2. Llamamos al súper modal multi-artículo
    if (typeof abrirModalCompraDirectaMulti === 'function') {
        abrirModalCompraDirectaMulti();
    } else {
        alert("⚠️ El módulo de compra múltiple no está cargado.");
    }
};

window.confirmarEliminarOC = function(id) {
    const lista = StorageService.get('ordenesCompra', []);
    const oc = lista.find(x => x.id === id);
    if (!oc) return;

    // Calculamos cuánto se ha pagado ya
    const pagado = (oc.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
    
    let mensaje = `¿Estás seguro de eliminar la Orden de Compra ${oc.folio}?\n\n`;
    
    if (pagado > 0) {
        mensaje += `⚠️ AVISO: Esta orden tiene abonos por ${dinero(pagado)}. Al eliminarla, el dinero se guardará como 'SALDO A FAVOR' para el proveedor ${oc.proveedorNombre} y podrás usarlo en futuras compras.\n\n`;
    }
    
    mensaje += "Las requisiciones vinculadas volverán a estar 'Pendientes'.\n\n¿Deseas continuar?";

    if (confirm(mensaje)) {
        ejecutarEliminacionOC(id, pagado);
    }
};

function ejecutarEliminacionOC(id, montoAFavor) {
    let lista = StorageService.get('ordenesCompra', []);
    const idx = lista.findIndex(x => x.id === id);
    if (idx === -1) return;

    const oc = lista[idx];

    // 1. Si hubo pagos, generamos el Saldo a Favor
    if (montoAFavor > 0) {
        let saldos = StorageService.get("saldosFavorProveedores", []);
        saldos.push({
            id: Date.now(),
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            montoOriginal: montoAFavor,
            montoDisponible: montoAFavor,
            fecha: window.obtenerHoyInputMX(),
            referencia: `Cancelación ${oc.folio}`
        });
        StorageService.set("saldosFavorProveedores", saldos);
    }

    // 2. "Revivir" Requisiciones (Buscamos las que digan "En OC (FOLIO)")
    let reqsTotales = StorageService.get("requisicionesCompra", []);
    reqsTotales.forEach(r => {
        if (r.estatus === `En OC (${oc.folio})`) {
            r.estatus = "Pendiente";
        }
    });
    StorageService.set("requisicionesCompra", reqsTotales);

    // 3. Cambiamos el estado de la OC a "Eliminada" para que desaparezca de la lista activa
    lista[idx].estado = 'Eliminada';
    StorageService.set('ordenesCompra', lista);

    alert(`✅ OC ${oc.folio} eliminada. Las requisiciones han sido reactivadas.`);
    if (typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
    if (typeof renderRequisiciones === 'function') renderRequisiciones();
}

function cancelarOrdenCompra(id) {
    const lista = StorageService.get('ordenesCompra', []);
    const oc = lista.find(x => x.id === id);
    if (!oc) return;
    if (oc.estado === 'Cancelada') return alert('Esta orden ya está cancelada.');
    if (oc.estado === 'Recibida' || oc.estado === 'Recibida Parcial') return alert('No se puede cancelar una orden ya recibida.');

    const pagado = (oc.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
    let mensaje = `¿Cancelar la Orden de Compra ${oc.folio}?\n\n`;
    if (pagado > 0) {
        mensaje += `⚠️ Esta orden tiene abonos por ${dinero(pagado)}. El monto se registrará como Saldo a Favor del proveedor ${oc.proveedorNombre}.\n\n`;
    }
    mensaje += "Las requisiciones vinculadas volverán a estar 'Pendientes'.\n\n¿Deseas continuar?";

    if (!confirm(mensaje)) return;

    // Saldo a favor si hubo pagos
    if (pagado > 0) {
        let saldos = StorageService.get('saldosFavorProveedores', []);
        saldos.push({
            id: Date.now(),
            proveedorId: oc.proveedorId,
            proveedorNombre: oc.proveedorNombre,
            montoOriginal: pagado,
            montoDisponible: pagado,
            fecha: window.obtenerHoyInputMX(),
            referencia: `Cancelación ${oc.folio}`
        });
        StorageService.set('saldosFavorProveedores', saldos);
    }

    // Revivir requisiciones vinculadas
    let reqs = StorageService.get('requisicionesCompra', []);
    reqs.forEach(r => {
        if (r.estatus === `En OC (${oc.folio})`) r.estatus = 'Pendiente';
    });
    StorageService.set('requisicionesCompra', reqs);

    // Marcar como Cancelada
    const idx = lista.findIndex(x => x.id === id);
    lista[idx].estado = 'Cancelada';
    StorageService.set('ordenesCompra', lista);

    alert(`✅ OC ${oc.folio} cancelada.`);
    if (typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
    if (typeof renderRequisiciones === 'function') renderRequisiciones();
}
// ============================================================
// AÑADIR REQUISICIONES A UNA OC EXISTENTE
// ============================================================
window.abrirModalAgregarA_OC_Existente = function() {
    const seleccionados = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value);
    if (seleccionados.length === 0) return alert("⚠️ Selecciona al menos una requisición de la lista.");

    // Buscar OC's que aún se puedan editar
    const ocs = StorageService.get('ordenesCompra', []).filter(oc => oc.estado === 'Borrador' || oc.estado === 'Enviada');
    if (ocs.length === 0) return alert("⚠️ No tienes Órdenes de Compra abiertas (Borrador o Enviadas). Crea una nueva primero.");

    let opciones = ocs.slice().reverse().map(oc => 
        `<option value="${oc.id}">${oc.folio} — ${oc.proveedorNombre} (Total actual: ${dinero(oc.total)})</option>`
    ).join('');

    const modalHTML = `
    <div data-modal="agregar-req-oc" style="position:fixed; inset:0; background:rgba(15,23,42,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(3px);">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:450px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#b45309; display:flex; align-items:center; gap:8px;">📥 Añadir a OC Existente</h3>
            <p style="font-size:13px; color:#64748b; margin-bottom:20px;">Se insertarán los ${seleccionados.length} artículos seleccionados dentro de la Orden de Compra que elijas, recalculando su total automáticamente.</p>
            
            <label style="font-weight:bold; font-size:12px; color:#374151; display:block; margin-bottom:6px;">SELECCIONA LA ORDEN DE DESTINO</label>
            <select id="selectReqOcDestino" style="width:100%; padding:12px; border:2px solid #fcd34d; border-radius:8px; margin-bottom:25px; font-size:14px; font-weight:bold; color:#92400e; background:#fffbeb;">
                ${opciones}
            </select>

            <div style="display:flex; gap:10px;">
                <button onclick="confirmarAgregarA_OC_Existente()" style="flex:2; padding:14px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:15px; box-shadow:0 4px 6px rgba(217, 119, 6, 0.3);">✅ Añadir Artículos</button>
                <button onclick="document.querySelector('[data-modal=\\'agregar-req-oc\\']').remove()" style="flex:1; padding:14px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    window._reqsTempParaOC = seleccionados; // Memoria temporal
};

window.confirmarAgregarA_OC_Existente = function() {
    const ocId = parseInt(document.getElementById('selectReqOcDestino').value);
    const reqIds = window._reqsTempParaOC || [];
    if (!ocId || reqIds.length === 0) return;

    let ocs = StorageService.get('ordenesCompra', []);
    let idxOC = ocs.findIndex(o => o.id === ocId);
    if (idxOC === -1) return alert("❌ Error: OC no encontrada.");
    let oc = ocs[idxOC];

    let reqsTotales = StorageService.get("requisicionesCompra", []);
    let prods = StorageService.get("productos", []);
    let agregados = 0;

    reqIds.forEach(idReq => {
        let req = reqsTotales.find(r => String(r.id) === String(idReq));
        if (req && req.estatus === "Pendiente") {
            const prod = prods.find(p => String(p.id) === String(req.productoId));
            const costoUnitario = prod ? parseFloat(prod.costo) : 0;
            const cant = parseInt(req.cantidad) || 1;
            const caracteristicas = `Req. Venta: ${req.folioVenta}`;

            // 1. Buscamos si ya existe el producto con esas características en la OC para sumar cantidad
            let idxArt = oc.articulos.findIndex(a => String(a.productoId) === String(req.productoId) && a.caracteristicas === caracteristicas);
            
            if (idxArt !== -1) {
                oc.articulos[idxArt].cantidad += cant;
                oc.articulos[idxArt].subtotal = oc.articulos[idxArt].cantidad * oc.articulos[idxArt].costo;
            } else {
                // Si no, lo agregamos como fila nueva
                oc.articulos.push({
                    productoId: req.productoId,
                    nombre: req.producto,
                    costo: costoUnitario,
                    cantidad: cant,
                    subtotal: cant * costoUnitario,
                    caracteristicas: caracteristicas
                });
            }

            // 2. Marcamos la requisición como amarrada a esta OC
            req.estatus = `En OC (${oc.folio})`;
            agregados++;
        }
    });

    // 3. Recalcular la matemática de la Orden de Compra
    oc.total = oc.articulos.reduce((s, a) => s + (a.subtotal || 0), 0);
    const anticipoPrevio = oc.anticipo_pagado || 0;
    oc.saldoPendiente = Math.max(0, oc.total - anticipoPrevio);

    // 4. Guardar cambios en las bases de datos
    StorageService.set('ordenesCompra', ocs);
    StorageService.set('requisicionesCompra', reqsTotales);
    
    document.querySelector('[data-modal="agregar-req-oc"]').remove();
    window._reqsTempParaOC = null;
    
    alert(`✅ ¡Éxito! Se añadieron ${agregados} producto(s) a la OC ${oc.folio}.\nEl nuevo total de la orden es ${dinero(oc.total)}`);
    
    // Refrescar vistas
    renderRequisiciones();
    if(typeof renderListaOrdenesCompra === 'function') renderListaOrdenesCompra();
};

// Exponer la función para que el menú HTML la encuentre
window.renderRequisiciones = renderRequisiciones;
window.renderProveedores = renderProveedores;
window.guardarProveedor = guardarProveedor;
window.eliminarProveedor = eliminarProveedor;

window.prepararVistaCompras = prepararVistaCompras;
window.gestionarCamposPago = gestionarCamposPago;
window.registrarCompra = registrarCompra;

window.abrirNuevaOrdenCompra = abrirNuevaOrdenCompra;
window.agregarArticuloOC = agregarArticuloOC;
window._renderTablaArticulosOC = _renderTablaArticulosOC;
window.guardarOrdenCompra = guardarOrdenCompra;
window.imprimirOrdenCompra = imprimirOrdenCompra;
window.recibirOrdenCompra = recibirOrdenCompra;
window.confirmarRecepcionOC = confirmarRecepcionOC;
window.imprimirRecepcionCompra = imprimirRecepcionCompra;
window.renderListaOrdenesCompra = renderListaOrdenesCompra;
window.cancelarOrdenCompra = cancelarOrdenCompra;
window.editarOrdenCompra = editarOrdenCompra;
window.agregarArticuloEditOC = agregarArticuloEditOC;
window._renderEditTablaOC = _renderEditTablaOC;
window.guardarEdicionOC = guardarEdicionOC;
window.renderCuentasPorPagar = renderCuentasPorPagar;
window.registrarAbonoProveedor = registrarAbonoProveedor;
window.confirmarAbonoProveedor = confirmarAbonoProveedor;
window.verDetalleCompra = verDetalleCompra;
window.renderRecepciones = renderRecepciones;
window.procesarRecepcionFisica = procesarRecepcionFisica;
window.iniciarOrdenDesdeRequisiciones = iniciarOrdenDesdeRequisiciones;
window.iniciarCompraDirectaDesdeRequisiciones = iniciarCompraDirectaDesdeRequisiciones;
window.abrirModalCompraDirectaMulti = abrirModalCompraDirectaMulti;
window.agregarArticuloCompraDirecta = agregarArticuloCompraDirecta;
window.guardarCompraDirectaFinal = guardarCompraDirectaFinal;
window.abrirModalAbonoOC = abrirModalAbonoOC;
window.confirmarAbonoOC = confirmarAbonoOC;

console.log('✅ compras.js cargado correctamente');
