// ===== VENTA FINAL =====
function confirmarVentaFinal() {
    console.log("🔍 Iniciando confirmarVentaFinal()...");
    
    if (!clienteSeleccionado) {
        alert("⚠️ Por favor selecciona un cliente antes de continuar.");
        return;
    }
    
    if (carrito.length === 0) {
        alert("⚠️ El carrito está vacío.");
        return;
    }

    const metodoPago = document.getElementById("selMetodoPago")?.value;
    console.log("Método de pago:", metodoPago);
    
    if (!metodoPago) {
        alert("⚠️ Regresa al carrito y selecciona un método de pago.");
        return;
    }

    const totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    console.log("Total contado:", totalContado);
    
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
    if (enganche < 0) enganche = 0;
    
    if (enganche > totalContado) {
        alert("⚠️ El enganche no puede ser mayor al total.");
        return;
    }

    const saldoAFinanciar = totalContado - enganche;
    let planElegido = null;

    if (metodoPago === "credito") {
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        console.log("Periodicidad:", periodicidad);
        
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
        console.log("Plazo seleccionado:", plazoSeleccionado);
        
        if (plazoSeleccionado === null || plazoSeleccionado === undefined || plazoSeleccionado < 0 || plazoSeleccionado >= planes.length) {
            alert("⚠️ Selecciona un plazo de crédito en el carrito antes de continuar.");
            return;
        }
        
        planElegido = planes[plazoSeleccionado];
        if (!planElegido) {
            alert("⚠️ Plazo de crédito inválido.");
            return;
        }
        
        console.log("Plan elegido:", planElegido);
    }

    console.log("✅ Todos los datos validados. Mostrando resumen...");
    mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido);
}

function mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido) {
    const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
    let detalleMetodo = "";

    if (metodoPago === "contado") {
        detalleMetodo = `<p style="color:#27ae60;"><strong>💰 CONTADO</strong></p>`;
    } else if (metodoPago === "apartado") {
        detalleMetodo = `
            <p><strong>📦 APARTADO</strong></p>
            <div style="background:#fffbeb; padding:10px; border-radius:5px;">
                <p style="margin:5px 0;">💵 Enganche: <strong>${dinero(enganche)}</strong></p>
                <p style="margin:5px 0;">📦 Pendiente: <strong>${dinero(saldoAFinanciar)}</strong></p>
            </div>
        `;
    } else if (metodoPago === "credito") {
        const textoPeriodicidad = periodicidad === "semanal" ? "Semanales" : periodicidad === "quincenal" ? "Quincenales" : "Mensuales";
        detalleMetodo = `
            <p><strong>💳 CRÉDITO</strong></p>
            <div style="background:#dbeafe; padding:10px; border-radius:5px;">
                <p style="margin:5px 0;">💵 Enganche: <strong>${dinero(enganche)}</strong></p>
                <p style="margin:5px 0;">📊 Plazo: <strong>${planElegido.meses} meses</strong></p>
                <p style="margin:5px 0;">📅 Períodos: <strong>${textoPeriodicidad} (${planElegido.pagos} pagos)</strong></p>
                <p style="margin:5px 0;">🔢 Abono: <strong>${dinero(planElegido.abono)}</strong></p>
                <p style="margin:5px 0;">💰 Total a pagar: <strong>${dinero(planElegido.total)}</strong></p>
            </div>
        `;
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

    const modalHTML = `
    <div class="modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:700px; margin:20px auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">📋 Resumen de Transacción</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <h4 style="margin:0 0 10px 0; color:#166534;">👤 Cliente</h4>
                    <p style="margin:5px 0;"><strong>${clienteSeleccionado.nombre}</strong></p>
                    ${clienteSeleccionado.telefono ? `<p style="margin:5px 0;">📞 ${clienteSeleccionado.telefono}</p>` : ''}
                    ${clienteSeleccionado.direccion ? `<p style="margin:5px 0;">📍 ${clienteSeleccionado.direccion}</p>` : ''}
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="color:#2c3e50; margin:0 0 10px 0;">🛍️ Productos</h4>
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

                <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:8px 0; display:flex; justify-content:space-between;">
                        <span>Subtotal:</span>
                        <strong>${dinero(totalContado)}</strong>
                    </p>
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="color:#2c3e50; margin:0 0 10px 0;">💳 Forma de Pago</h4>
                    ${detalleMetodo}
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarVentaConInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar}, '${JSON.stringify(planElegido).replace(/'/g, "&apos;")}')" 
                            style="flex:1; padding:14px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✅ Confirmar Venta
                    </button>
                    <button onclick="cancelarYVolverAlCarrito()" 
        style="padding: 12px 24px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
    ✕ Cancelar
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
    navA('carrito');
}

function procesarVentaConInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegidoStr) {
    console.log("🔄 Procesando venta con inventario...");
    
    let planElegido = null;
    
    if (typeof planElegidoStr === 'string' && planElegidoStr !== 'null') {
        try {
            planElegido = JSON.parse(planElegidoStr);
        } catch (e) {
            console.error("Error al parsear plan:", e);
            planElegido = null;
        }
    } else if (typeof planElegidoStr === 'object' && planElegidoStr !== null) {
        planElegido = planElegidoStr;
    }
    
    console.log("Plan elegido final:", planElegido);
    mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido);
}

function mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido) {
    let productosConStock = [];
    let productosSinStock = [];
    let decisiones = {};

    carrito.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (prod) {
            if ((prod.stock || 0) > 0) {
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
                <h4 style="margin:0 0 15px 0; color:#166534;">✅ PRODUCTOS CON STOCK</h4>
        `;
        
        productosConStock.forEach(x => {
            const idProd = x.prod.id;
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${x.prod.nombre}</strong><br>
                        <small style="color:#718096;">Stock disponible: ${x.prod.stock} | Solicitado: ${x.item.cantidad || 1}</small>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="setDecisionInventario(${idProd}, true)" 
                                id="btn-si-${idProd}"
                                style="padding:8px 16px; background:#27ae60; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                            ✅ Entregar
                        </button>
                        <button onclick="setDecisionInventario(${idProd}, false)" 
                                id="btn-no-${idProd}"
                                style="padding:8px 16px; background:#f59e0b; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                            ⏳ Pendiente
                        </button>
                    </div>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    if (productosSinStock.length > 0) {
        htmlProductos += `
            <div style="background:#fee2e2; padding:15px; border-radius:8px; border-left:5px solid #dc2626;">
                <h4 style="margin:0 0 15px 0; color:#7f1d1d;">📦 PRODUCTOS SIN STOCK</h4>
        `;
        
        productosSinStock.forEach(x => {
            const idProd = x.prod.id;
            decisiones[idProd] = { entregar: false };
            
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px;">
                    <strong>${x.prod.nombre}</strong><br>
                    <small style="color:#991b1b;">⚠️ Se creará REQUISICIÓN DE COMPRA automáticamente</small><br>
                    <small style="color:#7f1d1d;">Stock actual: 0 | Solicitado: ${x.item.cantidad || 1}</small>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    const modalHTML = `
        <div class="modal" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:700px; margin:20px auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">📦 Gestión de Inventario</h2>
                <p style="color:#718096; margin:0 0 20px 0;">Confirma cómo se entregarán los productos</p>
                
                ${htmlProductos}
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="confirmarDecisionesInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar}, '${JSON.stringify(planElegido).replace(/'/g, "&apos;")}')" 
                            style="flex:1; padding:14px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✅ Procesar Venta
                    </button>
                    <button onclick="cancelarYVolverAlCarrito()" 
                            style="flex:1; padding:14px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function setDecisionInventario(productoId, entregar) {
    decisionesInventario[productoId] = { entregar };
    
    const btnSi = document.getElementById(`btn-si-${productoId}`);
    const btnNo = document.getElementById(`btn-no-${productoId}`);
    
    if (entregar) {
        btnSi.style.background = '#27ae60';
        btnSi.style.opacity = '1';
        btnNo.style.background = '#cbd5e0';
        btnNo.style.opacity = '0.5';
    } else {
        btnNo.style.background = '#f59e0b';
        btnNo.style.opacity = '1';
        btnSi.style.background = '#cbd5e0';
        btnSi.style.opacity = '0.5';
    }
}

function confirmarDecisionesInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegidoStr) {
    let planElegido = null;
    
    try {
        planElegido = JSON.parse(planElegidoStr);
    } catch (e) {
        planElegido = null;
    }

    const folioVenta = "V-" + Date.now().toString().slice(-6);
    const fechaHoy = new Date().toLocaleDateString("es-MX");
    const fechaVentaIso = new Date().toISOString();

    let productosAEntregar = [];
    let productosAPendiente = [];

    carrito.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (!prod) return;

        const decision = decisionesInventario[item.id];
        const tieneStock = (prod.stock || 0) > 0;

        if (tieneStock && decision && decision.entregar) {
            productosAEntregar.push({ item, prod });
        } else {
            productosAPendiente.push({ item, prod });
        }
    });

    procesarVentaFinal(
        metodoPago, 
        totalContado, 
        enganche, 
        saldoAFinanciar, 
        planElegido,
        folioVenta, 
        fechaHoy, 
        fechaVentaIso, 
        productosAEntregar, 
        productosAPendiente
    );
}

function procesarVentaFinal(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock) {
    
    requisicionesCompra = StorageService.get("requisicionesCompra", []);
    movimientosCaja = StorageService.get("movimientosCaja", []);
    cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    pagaresSistema = StorageService.get("pagaresSistema", []);

    let entregasPendientes = [];

    productosConStock.forEach(x => {
        x.prod.stock = (x.prod.stock || 0) - (x.item.cantidad || 1);
        registrarMovimiento(x.prod.id, `Venta - ${folioVenta}`, x.item.cantidad || 1, "salida");
    });

    productosSinStock.forEach(x => {
        const cantidadSolicitada = x.item.cantidad || 1;
        entregasPendientes.push({
            id: Date.now() + Math.random(),
            folioVenta,
            productoId: x.prod.id,
            nombre: x.prod.nombre,
            cantidad: cantidadSolicitada,
            motivo: "Sin stock en almacén"
        });

        requisicionesCompra.push({
            id: Date.now() + Math.random(),
            fecha: fechaHoy,
            producto: x.prod.nombre,
            folioVenta,
            cantidad: cantidadSolicitada,
            motivo: "Venta sin stock disponible",
            estatus: "Pendiente"
        });
    });

    if (metodoPago === "contado") {
        movimientosCaja.push({
            id: Date.now(),
            folio: folioVenta,
            fecha: fechaHoy,
            tipo: "ingreso",
            monto: totalContado,
            concepto: `Venta Contado - ${clienteSeleccionado.nombre}`,
            referencia: "Contado"
        });
    } else if (enganche > 0) {
        movimientosCaja.push({
            id: Date.now(),
            folio: folioVenta,
            fecha: fechaHoy,
            tipo: "ingreso",
            monto: enganche,
            concepto: `Enganche ${metodoPago} - ${clienteSeleccionado.nombre}`,
            referencia: "Enganche"
        });
    }

    if (metodoPago === "credito" || metodoPago === "apartado") {
        const saldoPendiente = metodoPago === "credito" ? planElegido.total : saldoAFinanciar;

        const cuentaNueva = {
            folio: folioVenta,
            nombre: clienteSeleccionado.nombre,
            clienteId: clienteSeleccionado.id,
            direccion: clienteSeleccionado.direccion || "",
            referencia: clienteSeleccionado.referencia || "",
            telefono: clienteSeleccionado.telefono || "",
            fechaVenta: fechaVentaIso,
            totalContadoOriginal: totalContado,
            engancheRecibido: enganche,
            saldoActual: saldoPendiente,
            saldoOriginal: saldoPendiente,
            metodo: metodoPago,
            plan: planElegido,
            estado: "Pendiente",
            abonos: [],
            articulos: JSON.parse(JSON.stringify(carrito)),
            totalMercancia: totalContado
        };

        cuentasPorCobrar.push(cuentaNueva);

        if (metodoPago === "credito" && planElegido) {
            const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
            let diasIntervalo = 7;
            
            if (periodicidad === "quincenal") diasIntervalo = 14;
            if (periodicidad === "mensual") diasIntervalo = 30;
            
            let fechaPago = new Date(fechaVentaIso);
            const totalPagos = planElegido.pagos || Math.round(planElegido.semanas / (periodicidad === "quincenal" ? 2 : periodicidad === "mensual" ? 4 : 1));
            
            for (let i = 1; i <= totalPagos; i++) {
                fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
                pagaresSistema.push({
                    id: Date.now() + i,
                    folio: folioVenta,
                    numeroPagere: `${folioVenta}-${i}/${totalPagos}`,
                    clienteNombre: clienteSeleccionado.nombre,
                    clienteId: clienteSeleccionado.id,
                    clienteDireccion: clienteSeleccionado.direccion || "",
                    fechaEmision: fechaVentaIso,
                    fechaVencimiento: fechaPago.toISOString(),
                    monto: planElegido.abono,
                    estado: "Pendiente",
                    diasAtrasoActual: 0,
                    tasaMorosidad: 2,
                    acreedor: "Roberto Escobedo Vega",
                    lugar: "Santiago Cuaula, Tlaxcala"
                });
            }
        }

        if (!StorageService.set("cuentasPorCobrar", cuentasPorCobrar)) {
            console.error("❌ Error guardando cuentas por cobrar");
        }
        if (!StorageService.set("pagaresSistema", pagaresSistema)) {
            console.error("❌ Error guardando pagarés");
        }
    }

    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("movimientosCaja", movimientosCaja)) {
        console.error("❌ Error guardando movimientos de caja");
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos de inventario");
    }
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) {
        console.error("❌ Error guardando requisiciones");
    }

    if (entregasPendientes.length > 0) {
        salidasPendientesVenta.push({
            id: Date.now(),
            folioVenta,
            fecha: fechaHoy,
            fechaIso: fechaVentaIso,
            clienteId: clienteSeleccionado.id,
            clienteNombre: clienteSeleccionado.nombre,
            clienteDireccion: clienteSeleccionado.direccion || "",
            metodoPago,
            items: entregasPendientes,
            estatus: "Pendiente"
        });
        if (!StorageService.set("salidasPendientesVenta", salidasPendientesVenta)) {
            console.error("❌ Error guardando salidas pendientes");
        }
    }

    const datosVenta = {
        folio: folioVenta,
        fecha: fechaHoy,
        fechaIso: fechaVentaIso,
        cliente: clienteSeleccionado,
        metodo: metodoPago,
        total: totalContado,
        enganche: enganche,
        saldoPendiente: metodoPago === "credito" ? planElegido.total : (metodoPago === "apartado" ? saldoAFinanciar : 0),
        plan: planElegido,
        articulos: [...carrito],
        tipoComprobante: metodoPago === "apartado" ? "recibo_apartado" : metodoPago === "credito" ? "pagare" : "factura",
        periodicidad: document.getElementById("selPeriodicidad")?.value || "semanal",
        acreedor: "Roberto Escobedo Vega",
        lugar: "Santiago Cuaula, Tlaxcala",
        tasaMorosidad: 2
    };

    generarTicketMediaHoja(datosVenta);

    carrito = [];
    clienteSeleccionado = null;
    plazoSeleccionado = null;
    if (!StorageService.set("carrito", carrito)) {
        console.error("❌ Error limpiando carrito");
    }
    actualizarContadorCarrito();

    alert(`✅ VENTA REGISTRADA\n\nFolio: ${folioVenta}\nCliente: ${datosVenta.cliente.nombre}\nTotal: ${dinero(datosVenta.total)}`);
    navA('tienda');
}

window.confirmarVentaFinal = confirmarVentaFinal;
window.mostrarResumenVenta = mostrarResumenVenta;
window.cancelarYVolverAlCarrito = cancelarYVolverAlCarrito;
window.procesarVentaConInventario = procesarVentaConInventario;
window.mostrarDialogoInventario = mostrarDialogoInventario;
window.setDecisionInventario = setDecisionInventario;
window.confirmarDecisionesInventario = confirmarDecisionesInventario;
window.procesarVentaFinal = procesarVentaFinal;
