// ===== CARRITO =====
function renderCarrito() {
    const vistaCarrito = document.getElementById("carrito");
    if (!vistaCarrito) return;

    if (carrito.length === 0) {
        vistaCarrito.innerHTML = `
            <div class="header-seccion"><h2>🛒 Carrito de Ventas</h2></div>
            <p style="text-align:center; padding:40px; color:#718096; background:white; border-radius:8px;">
                El carrito está vacío. Agrega productos desde el inventario.
            </p>`;
        actualizarContadorCarrito();
        return;
    }

    carrito = carrito.filter(item => {
        const prod = productos.find(p => p.id === item.id);
        if (!prod) {
            console.warn("⚠️ Producto fantasma eliminado del carrito:", item.id);
            return false;
        }
        return true;
    });
    if (!StorageService.set("carrito", carrito)) {
        console.error("❌ Error guardando carrito");
    }

    let totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);

    let html = `
        <div class="header-seccion" style="margin-bottom: 20px;">
            <h2>🛒 Carrito de Ventas</h2>
        </div>
        
        <div style="display:grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px; align-items: start;">
            
            <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <h3 style="margin:0 0 15px 0; color:#2c3e50;">Productos seleccionados</h3>
                <table class="tabla-admin">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align:center;">Stock</th>
                            <th style="text-align:center;">Piezas</th>
                            <th style="text-align:right;">Precio</th>
                            <th style="text-align:center;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    carrito.forEach((p, index) => {
        let precio = p.precioContado || 0;
        let cantidad = p.cantidad || 1;
        const prod = productos.find(prod => prod.id === p.id);
        const stock = prod ? (prod.stock || 0) : 0;
        const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
        const textoStock = stock > 0 ? stock : "Sin stock";
        
        html += `
            <tr>
                <td><strong>${p.nombre}</strong></td>
                <td style="text-align:center; font-weight:bold; color:${colorStock};">${textoStock}</td>
                <td style="text-align:center;">
                    <input type="number" min="1" max="99" value="${cantidad}" 
                           onchange="actualizarCantidadCarrito(${index}, this.value)"
                           style="width:50px; padding:6px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                </td>
                <td style="text-align:right; font-weight:bold; color:#27ae60;">${dinero(precio * cantidad)}</td>
                <td style="text-align:center;">
                    <button onclick="eliminarDelCarrito(${index}); renderCarrito();" 
                            style="background:#fed7d7; color:#c53030; border:none; padding:8px; border-radius:5px; cursor:pointer;">🗑️</button>
                </td>
            </tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>

            <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); position: sticky; top: 80px;">
                <h3 style="margin:0 0 10px 0; border-bottom:2px solid #f7fafc; padding-bottom:10px;">Resumen de Venta</h3>
                
                <div style="text-align:center; margin-bottom:20px;">
                    <span style="color:#718096; font-size:14px;">TOTAL CONTADO</span><br>
                    <strong style="font-size:32px; color:#2d3748;">${dinero(totalContado)}</strong>
                </div>

                <div class="campo">
                    <label>Forma de Pago:</label>
                    <select id="selMetodoPago" onchange="aplicarMetodoStockDefaults(); actualizarInterfazPago();" style="width:100%; padding:12px; border:1px solid #cbd5e0; border-radius:6px; font-weight:bold;">
                        <option value="contado">💰 Efectivo / Contado</option>
                        <option value="apartado">📦 Sistema de Apartado</option>
                        <option value="credito">💳 Crédito / Pagos Semanales</option>
                    </select>
                </div>

                <div id="divPeriodicidad" class="campo oculto" style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0;">
                    <label>📅 Periodicidad de Pago:</label>
                    <select id="selPeriodicidad" onchange="actualizarInterfazPago();" style="width:100%; padding:12px; border:1px solid #cbd5e0; border-radius:6px; font-weight:bold;">
                        <option value="semanal">📆 Semanal (4 pagos/mes)</option>
                        <option value="quincenal">📅 Quincenal (2 pagos/mes)</option>
                        <option value="mensual">📋 Mensual (1 pago/mes)</option>
                    </select>
                </div>

                <div id="divEnganche" class="campo oculto" style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0;">
                    <label>Enganche Recibido ($):</label>
                    <input type="number" id="numEnganche" value="0" min="0" oninput="actualizarInterfazPago()" 
                           style="width:100%; padding:12px; border:1px solid #3182ce; border-radius:6px; font-size:18px; font-weight:bold; color:#2b6cb0;">
                </div>

                <div id="resultadosPago" style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:8px;"></div>

                <button onclick="irASeleccionCliente()"
                    style="width:100%; padding:15px; background:#27ae60; color:white; border:none; border-radius:8px; font-size:18px; font-weight:bold; margin-top:20px; cursor:pointer;">
                     ✅ Seleccionar cliente
                </button>
            </div>
        </div>
    `;

    vistaCarrito.innerHTML = html;
    actualizarInterfazPago();
    aplicarMetodoStockDefaults();
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
            console.error("❌ Error actualizando cantidad");
        }
        renderCarrito();
    }
}

function aplicarMetodoStockDefaults() {
    const met = document.getElementById("selMetodoPago")?.value;
    const chkD = document.getElementById("chkDescontarStock");
    const chkR = document.getElementById("chkRequisicionSinStock");
    if (!chkD || !chkR) return;
    if (met === "apartado") {
        chkD.checked = false;
        chkR.checked = true;
    } else {
        chkD.checked = true;
        chkR.checked = true;
    }
}

function actualizarInterfazPago() {
    const metodo = document.getElementById("selMetodoPago")?.value;
    const divEnganche = document.getElementById("divEnganche");
    const divPeriodicidad = document.getElementById("divPeriodicidad");
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

    let saldo = totalContado - enganche;
    if (saldo < 0) saldo = 0;

    if (metodo !== "credito") {
        plazoSeleccionado = null;
    }

    let html = "";

    if (metodo === "contado") {
        html = `<p><strong>Total a pagar:</strong> ${dinero(totalContado)}</p>`;
    }

    if (metodo === "apartado") {
        html = `
            <p>💰 Enganche: <strong>${dinero(enganche)}</strong></p>
            <p>📦 Saldo pendiente: <strong>${dinero(saldo)}</strong></p>
        `;
    }

    if (metodo === "credito") {
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo, periodicidad);
        
        if (plazoSeleccionado === null || plazoSeleccionado < 0 || plazoSeleccionado >= planes.length) {
            plazoSeleccionado = 0;
        }

        html = `
        <p>💰 Enganche: <strong>${dinero(enganche)}</strong></p>
        <p>📉 Saldo financiado: <strong>${dinero(saldo)}</strong></p>
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
                    📅 ${plan.meses} meses 
                    | 💳 Total: ${dinero(plan.total)} 
                    | 📆 ${dinero(plan.abono)}${textoPeriodicidad} (${plan.pagos} pagos)
                </label>
            </div>`;
        });
    }

    resultados.innerHTML = html;
}

function seleccionarPlan(index) {
    plazoSeleccionado = index;
}

function eliminarDelCarrito(index) {
    if (index >= 0 && index < carrito.length) {
        carrito.splice(index, 1);
        if (!StorageService.set("carrito", carrito)) {
            console.error("❌ Error guardando carrito");
        }
        actualizarContadorCarrito();
    }
}

function actualizarContadorCarrito() {
    const contador = document.getElementById("contadorCarrito");
    if (contador) {
        const total = carrito.length;
        contador.innerText = total;
        contador.style.display = total > 0 ? "flex" : "none";
    }
}

function agregarAlCarrito(id) {
    const p = productos.find(x => x.id == id);
    if (!p) return;
    productoActualId = id;
    agregarAlCarritoDesdeModal();
}

window.renderCarrito = renderCarrito;
window.actualizarCantidadCarrito = actualizarCantidadCarrito;
window.aplicarMetodoStockDefaults = aplicarMetodoStockDefaults;
window.actualizarInterfazPago = actualizarInterfazPago;
window.seleccionarPlan = seleccionarPlan;
window.eliminarDelCarrito = eliminarDelCarrito;
window.actualizarContadorCarrito = actualizarContadorCarrito;
window.agregarAlCarrito = agregarAlCarrito;
