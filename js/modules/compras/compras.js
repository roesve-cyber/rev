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
    select.innerHTML = tarjetasConfig.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
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

window.prepararVistaCompras = prepararVistaCompras;
window.actualizarSelectBancos = actualizarSelectBancos;
window.gestionarCamposPago = gestionarCamposPago;
window.registrarCompra = registrarCompra;
window.limpiarFormularioCompra = limpiarFormularioCompra;
