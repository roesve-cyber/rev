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

// ===== HELPERS FINANCIEROS =====

/** Lee cuenta seleccionada de un <select id="cuentaOrigen_{sufijo}"> o del selector legacy */
function _getCuentaSeleccionada(sufijo) {
    // intentar primero el selector con sufijo
    let sel = document.getElementById(`cuentaOrigen_${sufijo}`);
    // fallback al selector legacy
    if (!sel) sel = document.getElementById('compraCuentaOrigen');
    if (!sel) return { medioPago: 'efectivo', cuentaId: 'efectivo', etiqueta: 'Efectivo' };
    const cuentaId = sel.value || 'efectivo';
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const medioPago = cuentaId === 'efectivo' ? 'efectivo' : 'debito';
    return { medioPago, cuentaId, etiqueta };
}

/** Descuenta de la cuenta y registra movimiento de caja */
function _egresarCuenta({ monto, cuentaId, etiqueta, concepto, referencia }) {
    if (cuentaId === 'efectivo') {
        let cef = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo', saldo: 0 }]);
        const c = cef.find(x => x.id === 'efectivo');
        if (c) { c.saldo = (Number(c.saldo) || 0) - monto; StorageService.set('cuentasEfectivo', cef); }
    } else {
        let cban = StorageService.get('cuentas-bancarias', []);
        const c = cban.find(x => String(x.id) === String(cuentaId));
        if (c) { c.saldo = (Number(c.saldo) || 0) - monto; StorageService.set('cuentas-bancarias', cban); }
    }
    const movs = StorageService.get('movimientosCaja', []);
    movs.push({
        id: Date.now() + Math.random(),
        tipo: 'egreso',
        concepto,
        monto,
        fecha: new Date().toISOString(),
        cuenta: cuentaId,
        etiquetaCuenta: etiqueta,
        medioPago: cuentaId === 'efectivo' ? 'efectivo' : 'debito',
        referencia
    });
    StorageService.set('movimientosCaja', movs);
}

/** Construye <select> con efectivo + cuentas débito */
function _buildSelectorCuentas(idSelect, soloDebito) {
    const efectivo  = soloDebito ? [] : StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo', saldo: 0 }]);
    const bancarias = StorageService.get('cuentas-bancarias', []);
    const debito    = bancarias.filter(c => c.tipo && c.tipo.toLowerCase().includes('debito'));
    const todas     = [...efectivo, ...debito];
    const opts = todas.map(c =>
        `<option value="${c.id}">${c.nombre}${c.saldo !== undefined ? '  —  ' + dinero(c.saldo) : ''}</option>`
    ).join('');
    return `<select id="${idSelect}" style="width:100%;padding:9px;border:2px solid #d1d5db;border-radius:6px;font-size:14px;">${opts}</select>`;
}

// ===== COMPRAS =====
function prepararVistaCompras() {
    const selProd = document.getElementById("compraProducto");
    const selProv = document.getElementById("compraProveedor");

    if (selProd) {
        selProd.innerHTML = '<option value="">-- Selecciona un producto --</option>' +
            productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
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

function _poblarCuentasOrigen() {
    const sel = document.getElementById("compraCuentaOrigen");
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

function registrarCompra() {
    const productoId  = parseInt(document.getElementById("compraProducto").value);
    const proveedorId = parseInt(document.getElementById("compraProveedor").value);
    const cantidad    = parseInt(document.getElementById("compraCantidad").value);
    const costoNuevo  = parseFloat(document.getElementById("compraCosto").value);
    const comboPago   = document.getElementById("compraMetodoPago");
    const metodo      = comboPago.value;
    const formaPagoTexto = comboPago.options[comboPago.selectedIndex].text;
    const ingresoInmediato = document.getElementById("compraIngresoInmediato")?.checked ?? true;

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
    const fechaHoyStr = new Date().toLocaleDateString();
    const fechaPagoMensaje = (metodo === "contado") ? "Hoy (Contado)" : calcularFechaPago(fechaHoyStr, bancoSel);

    const mensajeConfirmar =
        `¿Deseas registrar esta compra?\n\n` +
        `Proveedor: ${prov.nombre}\n` +
        `Producto: ${producto.nombre}\n` +
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
    const nuevaCompra = {
        id: Date.now(),
        productoId,
        productoNombre: producto.nombre,   // ← guardamos el nombre para que el historial no dependa del catálogo
        proveedor: prov.nombre,
        proveedorId,
        total: totalCompra,
        fecha: fechaHoyStr
    };
    compras.push(nuevaCompra);

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
        estatus: ingresoInmediato ? "Completado" : "Pendiente"
    };
    recepciones.push(nuevaRecepcion);
    if (ingresoInmediato) actualizarStock(productoId, cantidad, `Compra a ${prov.nombre}`);

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

    // Afectar el saldo real solo si el pago es de contado (sale dinero inmediatamente)
    if (metodo === "contado") {
        // --- A. DESCONTAR DEL SALDO REAL ---
        if (cuentaOrigenId === "efectivo") {
            // Buscamos tu lista de cuentas de efectivo
            let cuentasEf = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo", saldo: 0 }]);
            let c = cuentasEf.find(x => x.id === "efectivo");
            if (c) {
                c.saldo = (Number(c.saldo) || 0) - totalCompra; // Restamos el dinero
                StorageService.set("cuentasEfectivo", cuentasEf);
            }
        } else {
            // Buscamos en tus tarjetas bancarias
            let cuentasBan = StorageService.get("cuentas-bancarias", []);
            let c = cuentasBan.find(x => String(x.id) === String(cuentaOrigenId));
            if (c) {
                c.saldo = (Number(c.saldo) || 0) - totalCompra; // Restamos el dinero
                StorageService.set("cuentas-bancarias", cuentasBan);
            }
        }

        // --- B. REGISTRAR EL MOVIMIENTO (Para tu historial) ---
        const movs = StorageService.get("movimientosCaja", []);
        movs.push({
            id: Date.now() + 10,
            tipo: "egreso",
            concepto: `Compra de contado — ${producto.nombre} a ${prov.nombre}`,
            monto: totalCompra,
            fecha: new Date().toISOString(),
            cuenta: cuentaOrigenId,
            etiquetaCuenta: cuentaOrigenNombre,
            medioPago: "contado",
            referencia: `COMPRA-${nuevaCompra.id}`
        });
        StorageService.set("movimientosCaja", movs);
    }

    alert(`✅ Registro Exitoso\nProveedor: ${prov.nombre}${avisoActualizacion}`);
    limpiarFormularioCompra();
    navA('compras');
}

function limpiarFormularioCompra() {
    const ids = ["compraCantidad", "compraCosto"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const selProd = document.getElementById("compraProducto");
    const selProv = document.getElementById("compraProveedor");
    const selPago = document.getElementById("compraMetodoPago");
    const chkIngreso = document.getElementById("compraIngresoInmediato");
    if (selProd) selProd.selectedIndex = 0;
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

function procesarRecepcionFisica(idRecepcion) {
    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return;

    const rec = recs[index];
    const cantInput = prompt(`¿Cuánto llegó de ${rec.productoNombre}?\nFaltan: ${rec.cantidadPendiente}`);
    const cantidad = parseInt(cantInput);

    if (isNaN(cantidad) || cantidad <= 0 || cantidad > rec.cantidadPendiente) {
        alert("Cantidad no válida.");
        return;
    }
const prod = productos.find(p => String(p.id) === String(rec.productoId));
    
    
    if (prod) {
        prod.stock = (parseInt(prod.stock) || 0) + cantidad;
        
        movimientosInventario.push({
            id: Date.now(),
            productoId: prod.id,
            tipo: 'entrada',
            cantidad,
            concepto: `Recepción - Prov: ${rec.proveedor}`,
            fecha: new Date().toLocaleString()
        });
    } else {
        alert("Error: El producto ya no existe en la base de datos.");
        return; 
    }

    rec.cantidadRecibida += cantidad;
    rec.cantidadPendiente -= cantidad;
    if (rec.cantidadPendiente === 0) rec.estatus = "Completado";

    recs[index] = rec;
    
    if (!StorageService.set("recepciones", recs)) {
        console.error("❌ Error guardando recepciones");
        return;
    }
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
        return;
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
        return;
    }

    alert("Stock actualizado con éxito.");
    renderRecepciones();
}

// ===== CUENTAS POR PAGAR =====
function renderCuentasPorPagar() {
    const contenedor = document.getElementById("listaCuentasPorPagar");
    if (!contenedor) return;

    let cuentas = StorageService.get("cuentasPorPagar", []);
    let deudas = cuentas.filter(c => c.saldoPendiente > 0);

    if (deudas.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ ¡No tienes deudas pendientes!</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Método</th>
                <th>Total</th>
                <th>Saldo Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    deudas.forEach(c => {
        html += `
            <tr>
                <td>${c.fecha}<br><strong style="cursor:pointer; color:#2980b9; text-decoration:underline;" onclick="verDetalleCompra(${c.id})">${c.proveedor}</strong></td>
                <td><small>${c.metodo || c.formaPagoTexto || '-'}</small></td>
                <td>${dinero(c.total)}</td>
                <td style="color:red; font-weight:bold;">${dinero(c.saldoPendiente)}</td>
                <td>
                    <button onclick="registrarAbonoProveedor(${c.id})" style="background:#2c3e50; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        💵 Abonar
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function verDetalleCompra(idCuenta) {
    const cuentas = StorageService.get("cuentasPorPagar", []);
    const c = cuentas.find(x => x.id === idCuenta);
    if (!c) return;

    const modalHTML = `
        <div data-modal="detalle-compra" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0;">📦 Detalle de Compra</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove();" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280;">✕</button>
                </div>
                <div style="display:grid; gap:12px;">
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:8px;">
                        <span style="color:#6b7280;">Proveedor</span>
                        <strong>${c.proveedor}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:8px;">
                        <span style="color:#6b7280;">Fecha de Compra</span>
                        <strong>${c.fecha}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:8px;">
                        <span style="color:#6b7280;">Método de Pago</span>
                        <strong>${c.formaPagoTexto || c.metodo || '-'}</strong>
                    </div>
                    <div style="border-bottom:1px solid #f3f4f6; padding-bottom:8px;">
                        <span style="color:#6b7280;">Productos:</span>
                        <table style="width:100%; margin-top:8px; font-size:14px; border-collapse:collapse;">
                            <thead><tr style="background:#f9fafb;">
                                <th style="padding:6px 8px; text-align:left;">Producto</th>
                                <th style="padding:6px 8px; text-align:right;">Cantidad</th>
                            </tr></thead>
                            <tbody>
                                <tr>
                                    <td style="padding:6px 8px;">${c.producto || '-'}</td>
                                    <td style="padding:6px 8px; text-align:right;">${c.cantidad || 1}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style="display:flex; justify-content:space-between; border-bottom:1px solid #f3f4f6; padding-bottom:8px;">
                        <span style="color:#6b7280;">Total de Compra</span>
                        <strong>${dinero(c.total)}</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; padding-bottom:8px;">
                        <span style="color:#6b7280;">Saldo Pendiente</span>
                        <strong style="color:#e74c3c;">${dinero(c.saldoPendiente)}</strong>
                    </div>
                </div>
                <div style="margin-top:20px; text-align:right;">
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-compra&quot;]')?.remove();" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">Cerrar</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function registrarAbonoProveedor(idCuenta) {
    const cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => c.id === idCuenta);
    if (index === -1) return;
    const cuenta = cuentas[index];

    document.querySelector('[data-modal="abono-proveedor"]')?.remove();

    const modalHTML = `<div data-modal="abono-proveedor" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:6000;display:flex;justify-content:center;align-items:center;">
        <div style="background:white;padding:30px;border-radius:15px;width:90%;max-width:550px;max-height:90vh;overflow-y:auto;">
            <h2 style="margin-top:0;">💵 Pagar a ${cuenta.proveedor}</h2>
            <div style="background:#f8f9fa;padding:15px;border-radius:8px;margin-bottom:20px;">
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><small style="color:#718096;">Producto</small><br><strong>${cuenta.producto || '-'}</strong></div>
                    <div><small style="color:#718096;">Saldo Pendiente</small><br><strong style="color:#e74c3c;font-size:20px;">${dinero(cuenta.saldoPendiente)}</strong></div>
                </div>
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">Monto del pago ($):</label>
                <input type="number" id="montoAbonoProveedor" placeholder="0.00" min="0" max="${cuenta.saldoPendiente}"
                       style="width:100%;padding:12px;font-size:16px;border:2px solid #3498db;border-radius:6px;">
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;display:block;margin-bottom:8px;">💳 ¿De dónde sale el dinero?</label>
                ${_buildCuentaOrigen('proveedor')}
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="confirmarAbonoProveedor(${idCuenta})"
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
}

function confirmarAbonoProveedor(idCuenta) {
    const montoAbono = parseFloat(document.getElementById("montoAbonoProveedor")?.value);
    let cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => c.id === idCuenta);
    if (index === -1) return;
    const cuenta = cuentas[index];

    const validacion = ValidatorService.validarMonto(montoAbono, cuenta.saldoPendiente);
    if (!validacion.valid) { alert("⚠️ " + validacion.error); return; }

    const { medioPago, cuentaId, etiqueta } = _getCuentaSeleccionada('proveedor');

    _egresarCuenta({
        monto: montoAbono,
        cuentaId,
        etiqueta,
        concepto: `Pago a proveedor ${cuenta.proveedor}${cuenta.producto ? ' - ' + cuenta.producto : ''}`,
        referencia: `ABONO-PROV-${idCuenta}`
    });

    cuenta.saldoPendiente -= montoAbono;

    alert("✅ Pago registrado correctamente.");
    document.querySelector('[data-modal="abono-proveedor"]')?.remove();
    renderCuentasPorPagar();
}
window.confirmarAbonoProveedor = confirmarAbonoProveedor;

// ===== ÓRDENES DE COMPRA =====
function _foliosOC() {
    const hoy = new Date();
    const ymd = hoy.getFullYear().toString() +
        String(hoy.getMonth() + 1).padStart(2, '0') +
        String(hoy.getDate()).padStart(2, '0');
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
      <div style="background:white;border-radius:12px;width:100%;max-width:720px;padding:28px;margin:auto;">
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
        <select id="ocMetodoPago" onchange="document.getElementById('divMsiOC').style.display=(this.value==='msi'?'block':'none'); document.getElementById('divCuentaOC').style.display=(this.value==='contado'?'block':'none');" 
                style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            <option value="contado">Contado</option>
            <option value="credito">Crédito Proveedor</option>
            <option value="msi">Meses sin Intereses (MSI)</option>
        </select>
    </div>

    <div id="divCuentaOC">
        <label style="font-size:13px; font-weight:bold;">Pagar desde:</label>
        <select id="compraCuentaOrigen" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
            </select>
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
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end;margin-bottom:12px;">
          <select id="ocProductoSel" style="padding:9px;border:1px solid #d1d5db;border-radius:6px;">
            <option value="">-- Selecciona producto --</option>
            ${selProds}
          </select>
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
    if (ocFechaEl) ocFechaEl.value = fechaEnt.toISOString().substring(0, 10);
    window._articulosOC = [];
    _renderTablaArticulosOC();
    _poblarCuentasOrigen();
}

function agregarArticuloOC() {
    const sel = document.getElementById('ocProductoSel');
    const cantInput = document.getElementById('ocCantidad');
    if (!sel.value) return;
    const prods = StorageService.get('productos', []);
    const prod = prods.find(p => String(p.id) === String(sel.value));
    if (!prod) return;
    const cant = parseInt(cantInput.value) || 1;
    const costo = parseFloat(prod.costo) || 0;
    if (!window._articulosOC) window._articulosOC = [];
    const idx = window._articulosOC.findIndex(a => String(a.productoId) === String(prod.id));
    if (idx !== -1) {
        window._articulosOC[idx].cantidad += cant;
        window._articulosOC[idx].subtotal = window._articulosOC[idx].cantidad * costo;
    } else {
        window._articulosOC.push({ productoId: prod.id, nombre: prod.nombre, costo, cantidad: cant, subtotal: cant * costo });
    }
    cantInput.value = 1;
    sel.value = '';
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
        const rows = arts.map((a, i) => {
                total += a.subtotal;
                return `<tr>
                    <td style="padding:8px;">${a.nombre}</td>
                    <td style="padding:8px;text-align:center;">
                        <input type="number" min="0" step="0.01" value="${a.costo}" style="width:80px;text-align:right;" onchange="(function(e){ window._articulosOC[${i}].costo = parseFloat(e.target.value)||0; window._articulosOC[${i}].subtotal = window._articulosOC[${i}].cantidad * window._articulosOC[${i}].costo; _renderTablaArticulosOC(); })(event)" />
                    </td>
                    <td style="padding:8px;text-align:center;">${a.cantidad}</td>
                    <td style="padding:8px;text-align:right;">${dinero(a.subtotal)}</td>
                    <td style="padding:8px;text-align:center;"><button onclick="window._articulosOC.splice(${i},1);_renderTablaArticulosOC();" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
                </tr>`;
        }).join('');
    cont.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:14px;">
      <thead><tr style="background:#f3f4f6;">
        <th style="padding:8px;text-align:left;">Artículo</th>
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
    const provId = document.getElementById('ocProveedor')?.value;
    const fechaEntrega = document.getElementById('ocFechaEntrega')?.value;
    const notas = document.getElementById('ocNotas')?.value.trim() || '';
    const borrador = document.getElementById('ocBorrador')?.checked ?? true;
    const metodoPago = document.getElementById('ocMetodoPago')?.value || '';
    const cuentaOrigen = document.getElementById('compraCuentaOrigen')?.value || '';
    const meses = document.getElementById('ocMeses')?.value || '';
    const provs = StorageService.get('proveedores', []);
    const prov = provs.find(p => String(p.id) === String(provId));
    const provNombre = prov ? prov.nombre : 'Sin proveedor';
    const total = arts.reduce((s, a) => s + a.subtotal, 0);
    const oc = {
        id: Date.now(),
        folio: _foliosOC(),
        proveedorId: provId || null,
        proveedorNombre: provNombre,
        articulos: arts,
        total,
        fechaEmision: new Date().toISOString(),
        fechaEntregaEstimada: fechaEntrega || null,
        estado: borrador ? 'Borrador' : 'Enviada',
        notas,
        condicionesComerciales: {
            metodoPago,
            cuentaOrigen,
            meses
        }
    };
    const lista = StorageService.get('ordenesCompra', []);
    lista.push(oc);
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
        `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;">${a.nombre}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.cantidad}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.costo)}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">${dinero(a.subtotal)}</td></tr>`
    ).join('');
    const w = window.open('', '_blank', 'width=750,height=900');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>OC ${oc.folio}</title>
    <style>body{font-family:Arial,sans-serif;padding:32px;color:#111;}table{width:100%;border-collapse:collapse;}th{background:#f3f4f6;padding:8px;text-align:left;}@media print{button{display:none!important;}}</style>
    </head><body>
    <div style="text-align:center;margin-bottom:24px;">
      <img src="img/logo.png" style="height:70px;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
      <h2 style="margin:8px 0;">${empresa}</h2>
    </div>
    <hr>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
      <div><strong>ORDEN DE COMPRA</strong><br><span style="font-size:20px;color:#1e40af;">${oc.folio}</span><br><span style="color:${oc.estado==='Enviada'?'#16a34a':'#d97706'}">${oc.estado}</span></div>
      <div style="text-align:right;">
        <div>Emisión: ${new Date(oc.fechaEmision).toLocaleDateString('es-MX')}</div>
        ${oc.fechaEntregaEstimada ? `<div>Entrega est.: ${new Date(oc.fechaEntregaEstimada).toLocaleDateString('es-MX')}</div>` : ''}
      </div>
    </div>
        <div style="margin-bottom:16px;"><strong>Proveedor:</strong> ${oc.proveedorNombre}</div>
        <div style="margin-bottom:16px;"><strong>Condiciones comerciales:</strong><br>
            Forma de pago: <b>${oc.condicionesComerciales?.metodoPago === 'contado' ? 'Contado' : oc.condicionesComerciales?.metodoPago === 'credito' ? 'Crédito Proveedor' : oc.condicionesComerciales?.metodoPago === 'msi' ? 'Meses sin Intereses' : '-'}</b><br>
            ${oc.condicionesComerciales?.metodoPago === 'msi' ? `Meses: <b>${oc.condicionesComerciales?.meses}</b><br>` : ''}
            ${oc.condicionesComerciales?.cuentaOrigen ? `Cuenta origen: <b>${oc.condicionesComerciales?.cuentaOrigen}</b><br>` : ''}
        </div>
    <table>
      <thead><tr><th>Artículo</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Costo Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
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

    // Filas de artículos con input de cantidad
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
            <td style="padding:10px;text-align:right;color:#374151;">${dinero(a.costo)}</td>
            <td id="recSub_${i}" style="padding:10px;text-align:right;font-weight:bold;">${dinero(a.cantidad * a.costo)}</td>
        </tr>`).join('');

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
                <th style="padding:10px;text-align:right;">Costo U.</th>
                <th style="padding:10px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${filasArts}</tbody>
            <tfoot>
              <tr style="background:#f9fafb;font-weight:bold;">
                <td colspan="5" style="padding:10px;text-align:right;">Total recibido:</td>
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
    const fechaStr   = fechaRec.toLocaleDateString('es-MX');
    let notas      = document.getElementById('recNotas')?.value.trim() || '';
    const metodoPago = window._ocMetodoPago || 'no';

    // Recoger cantidades recibidas (permitir más de lo pedido)
    const itemsRecibidos = [];
    const itemsBackOrder  = [];
    let obsExtra = [];
    oc.articulos.forEach((a, i) => {
        const inputVal = parseInt(document.getElementById(`recQ_${i}`)?.value) || 0;
        const cantRec = Math.max(0, inputVal);
        const backOrd = a.cantidad - Math.min(inputVal, a.cantidad);
        if (cantRec > 0) itemsRecibidos.push({ ...a, cantidadRec: cantRec, subtotal: cantRec * a.costo });
        if (backOrd > 0) itemsBackOrder.push({ ...a, cantidad: backOrd, subtotal: backOrd * a.costo });
        if (inputVal > a.cantidad) {
            obsExtra.push(`Se reciben ${inputVal - a.cantidad} piezas de más de ${a.nombre}`);
        }
    });

    if (obsExtra.length > 0) {
        notas += (notas ? '\n' : '') + obsExtra.join('\n');
    }

    if (itemsRecibidos.length === 0) return alert('⚠️ Debes recibir al menos 1 unidad.');

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
        if (montoPagado <= 0) return alert('⚠️ Ingresa el monto a pagar.');
        if (montoPagado > saldoDisp + 0.01) return alert(`⚠️ El monto excede el saldo pendiente (${dinero(saldoDisp)}).`);
        cuentaPagoId = cuentaEl?.value || 'efectivo';
        cuentaPagoEtiqueta = cuentaEl?.options[cuentaEl?.selectedIndex]?.text || 'Efectivo';
    }

    // ── 1. Actualizar inventario ───────────────────────────────
    const prods = StorageService.get('productos', []);
    itemsRecibidos.forEach(art => {
        const pidx = prods.findIndex(p => String(p.id) === String(art.productoId));
        if (pidx !== -1) prods[pidx].stock = (prods[pidx].stock || 0) + art.cantidadRec;
    });
    StorageService.set('productos', prods);

    // Movimientos de inventario
    if (typeof movimientosInventario !== 'undefined') {
        itemsRecibidos.forEach(art => {
            movimientosInventario.push({
                id: Date.now() + Math.random(),
                productoId: art.productoId,
                tipo: 'entrada',
                cantidad: art.cantidadRec,
                concepto: `Recepción OC ${oc.folio} — ${oc.proveedorNombre}`,
                fecha: fechaRec.toLocaleString('es-MX')
            });
        });
        StorageService.set('movimientosInventario', movimientosInventario);
    }

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
            vencimiento: fechaVenc.toLocaleDateString('es-MX'),
            vencimientoIso: fechaVenc.toISOString()
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
            fechaEmision: new Date().toISOString(),
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
    lista[idx].fechaRecepcion  = fechaRec.toISOString();
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
        fecha: fechaRec.toISOString(),
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
            <img src="img/logo.png" style="height:56px;" onerror="this.outerHTML='<span style=\\'font-size:28px;\\'>🏛️</span>'">
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
                return `<tr style="border-bottom:1px solid #f3f4f6;">
                    <td style="padding:10px;font-weight:bold;">${oc.folio}${boVinculo}${boHijo}</td>
                    <td style="padding:10px;">${oc.proveedorNombre}</td>
                    <td style="padding:10px;">${new Date(oc.fechaEmision).toLocaleDateString('es-MX')}</td>
                    <td style="padding:10px;">${oc.fechaEntregaEstimada ? new Date(oc.fechaEntregaEstimada).toLocaleDateString('es-MX') : '—'}</td>
                    <td style="padding:10px;text-align:right;font-weight:bold;">${dinero(oc.total)}</td>
                    <td style="padding:10px;text-align:center;">
                        <span style="background:${color}20;color:${color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;">${oc.estado}</span>
                    </td>
                    <td style="padding:10px;text-align:center;">
                        <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
                            <button onclick="imprimirOrdenCompra(${oc.id})" title="Imprimir OC" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Imprimir">🖨️</button>
                            ${esActiva ? `<button onclick="recibirOrdenCompra(${oc.id})" title="Recibir mercancía" style="background:none;border:none;cursor:pointer;font-size:17px;">📦</button>` : ''}
                            ${(oc.estado === 'Borrador' || oc.estado === 'Enviada') ? `<button onclick="editarOrdenCompra(${oc.id})" title="Editar" style="background:none;border:none;cursor:pointer;font-size:17px;">✏️</button>` : ''}
                            ${oc.estado === 'Borrador' ? `<button onclick="cancelarOrdenCompra(${oc.id})" title="Cancelar" style="background:none;border:none;cursor:pointer;font-size:17px;">❌</button>` : ''}
                        </div>
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
      <div style="background:white;border-radius:12px;width:100%;max-width:720px;padding:28px;margin:auto;">
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
          <select id="editOcProductoSel" style="padding:9px;border:1px solid #d1d5db;border-radius:6px;">
            <option value="">-- Agregar producto --</option>${selProds}
          </select>
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
    sel.value = '';
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
        fechaModificacion:     new Date().toISOString()
    };
    StorageService.set('ordenesCompra', lista);
    document.querySelector('[data-modal="editar-oc"]')?.remove();
    alert('✅ Orden de compra actualizada.');
    renderListaOrdenesCompra();
}

function cancelarOrdenCompra(id) {
    if (!confirm('¿Cancelar esta orden de compra?')) return;
    const lista = StorageService.get('ordenesCompra', []);
    const idx = lista.findIndex(x => x.id === id);
    if (idx === -1) return;
    lista[idx].estado = 'Cancelada';
    StorageService.set('ordenesCompra', lista);
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

console.log('✅ compras.js cargado correctamente');
