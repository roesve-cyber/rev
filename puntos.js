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
    gestionarCamposPago();
}

function actualizarSelectBancos() {
    const select = document.getElementById("compraBancoSeleccionado");
    if (!select) return;
    const bancosMSI = tarjetasConfig.filter(t => !t.tipo || t.tipo === "credito");
    select.innerHTML = bancosMSI.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
}

function gestionarCamposPago() {
    const metodo  = document.getElementById("compraMetodoPago")?.value;
    const divBanco = document.getElementById("divSeleccionBanco");
    const divMeses = document.getElementById("divMeses");
    if (!metodo) return;

    if (divBanco) divBanco.style.display = (metodo === 'tarjeta_msi') ? 'block' : 'none';
    if (divMeses) divMeses.style.display  = (metodo === 'tarjeta_msi') ? 'block' : 'none';

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
    const producto = productos.find(p => p.id == productoId);
    if (!prov || !producto) return alert("⚠️ Proveedor o producto no encontrado.");

    const bancoSel = document.getElementById("compraBancoSeleccionado")?.value || "";
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
        proveedor: prov.nombre,
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

    const prod = productos.find(p => Number(p.id) === Number(rec.productoId));
    
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

    cuenta.saldoPendiente -= montoAbono;
    cuentas[index] = cuenta;
    if (!StorageService.set("cuentasPorPagar", cuentas)) { console.error("❌ Error guardando abono"); return; }

    let movimientos = StorageService.get("movimientosCaja", []);
    movimientos.push({
        id: Date.now(),
        fecha: new Date().toLocaleDateString(),
        monto: montoAbono,
        tipo: "egreso",
        concepto: `Pago a proveedor ${cuenta.proveedor}${cuenta.producto ? ' - ' + cuenta.producto : ''}`,
        referencia: "Pago proveedor",
        cuenta: cuentaId,
        medioPago: medioPago,
        etiquetaCuenta: etiqueta
    });
    if (!StorageService.set("movimientosCaja", movimientos)) { console.error("❌ Error guardando movimiento"); }

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
    window._articulosOC = [];
    _renderTablaArticulosOC();
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
          <td style="padding:8px;text-align:center;">${dinero(a.costo)}</td>
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
        notas
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
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(a.costo).toFixed(2)}</td>
         <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;">$${Number(a.subtotal).toFixed(2)}</td></tr>`
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
    <table>
      <thead><tr><th>Artículo</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Costo Unit.</th><th style="text-align:right;">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;margin-top:16px;font-size:20px;font-weight:bold;">TOTAL: $${Number(oc.total).toFixed(2)}</div>
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
    const idx = lista.findIndex(x => x.id === id);
    if (idx === -1) return;
    const oc = lista[idx];
    if (oc.estado === 'Recibida') return alert('Esta orden ya fue recibida.');
    if (!confirm(`¿Confirmar recepción de ${oc.folio}? Se actualizará el stock.`)) return;
    // Actualizar stock
    const prods = StorageService.get('productos', []);
    oc.articulos.forEach(art => {
        const pidx = prods.findIndex(p => String(p.id) === String(art.productoId));
        if (pidx !== -1) {
            prods[pidx].stock = (prods[pidx].stock || 0) + art.cantidad;
        }
    });
    StorageService.set('productos', prods);
    // Crear compra
    const nuevaCompra = {
        id: Date.now(),
        folio: oc.folio + '-REC',
        proveedor: oc.proveedorNombre,
        proveedorId: oc.proveedorId,
        articulos: oc.articulos,
        total: oc.total,
        fecha: new Date().toISOString(),
        metodo: 'credito',
        saldoPendiente: oc.total,
        ordenCompraId: oc.id
    };
    const comprasList = StorageService.get('compras', []);
    comprasList.push(nuevaCompra);
    StorageService.set('compras', comprasList);
    lista[idx].estado = 'Recibida';
    StorageService.set('ordenesCompra', lista);
    alert(`✅ Orden ${oc.folio} recibida. Stock actualizado.`);
    renderListaOrdenesCompra();
}

function renderListaOrdenesCompra() {
    const cont = document.getElementById('contenidoOrdenesCompra');
    if (!cont) return;
    const lista = StorageService.get('ordenesCompra', []);
    const estadoColors = { Borrador: '#9ca3af', Enviada: '#2563eb', Recibida: '#16a34a', Cancelada: '#dc2626' };
    const rows = lista.slice().reverse().map(oc => {
        const color = estadoColors[oc.estado] || '#374151';
        return `<tr>
          <td style="padding:10px;">${oc.folio}</td>
          <td style="padding:10px;">${oc.proveedorNombre}</td>
          <td style="padding:10px;">${new Date(oc.fechaEmision).toLocaleDateString('es-MX')}</td>
          <td style="padding:10px;">${oc.fechaEntregaEstimada ? new Date(oc.fechaEntregaEstimada).toLocaleDateString('es-MX') : '-'}</td>
          <td style="padding:10px;text-align:right;">${dinero(oc.total)}</td>
          <td style="padding:10px;text-align:center;"><span style="background:${color}20;color:${color};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;">${oc.estado}</span></td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            <button onclick="imprimirOrdenCompra(${oc.id})" title="Imprimir" style="background:none;border:none;cursor:pointer;font-size:17px;">🖨️</button>
            ${oc.estado !== 'Recibida' && oc.estado !== 'Cancelada' ? `<button onclick="recibirOrdenCompra(${oc.id})" title="Recibir" style="background:none;border:none;cursor:pointer;font-size:17px;">✅</button>` : ''}
            ${oc.estado === 'Borrador' ? `<button onclick="cancelarOrdenCompra(${oc.id})" title="Cancelar" style="background:none;border:none;cursor:pointer;font-size:17px;">❌</button>` : ''}
          </td>
        </tr>`;
    }).join('');
    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#1e40af;">📋 Órdenes de Compra</h3>
        <button onclick="abrirNuevaOrdenCompra()" style="padding:10px 18px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nueva OC</button>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${lista.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin órdenes de compra.</p>' : `
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

function cancelarOrdenCompra(id) {
    if (!confirm('¿Cancelar esta orden de compra?')) return;
    const lista = StorageService.get('ordenesCompra', []);
    const idx = lista.findIndex(x => x.id === id);
    if (idx === -1) return;
    lista[idx].estado = 'Cancelada';
    StorageService.set('ordenesCompra', lista);
    renderListaOrdenesCompra();
}

window.abrirNuevaOrdenCompra = abrirNuevaOrdenCompra;
window.agregarArticuloOC = agregarArticuloOC;
window._renderTablaArticulosOC = _renderTablaArticulosOC;
window.guardarOrdenCompra = guardarOrdenCompra;
window.imprimirOrdenCompra = imprimirOrdenCompra;
window.recibirOrdenCompra = recibirOrdenCompra;
window.renderListaOrdenesCompra = renderListaOrdenesCompra;
window.cancelarOrdenCompra = cancelarOrdenCompra;
