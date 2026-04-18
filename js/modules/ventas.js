function agregarAlCarritoDesdeModal() {
    if (!productoActualId) return;
    const p = productos.find(prod => prod.id === productoActualId);
    if (!p) {
        alert("❌ Error: Producto no encontrado.");
        return;
    }

    const indiceExistente = carrito.findIndex(item => item.id === productoActualId);
    
    if (indiceExistente !== -1) {
        const mensaje = `⚠️ "${p.nombre}" ya está en el carrito.\n\n¿Aumentar la cantidad en 1?`;
        
        if (confirm(mensaje)) {
            carrito[indiceExistente].cantidad = (carrito[indiceExistente].cantidad || 1) + 1;
            if (!StorageService.set("carrito", carrito)) {
                console.error("❌ Error actualizando carrito");
                return;
            }
            actualizarContadorCarrito();
            alert(`✅ Cantidad aumentada a ${carrito[indiceExistente].cantidad}`);
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
            console.error("❌ Error guardando carrito");
            return;
        }
        actualizarContadorCarrito();
        
        alert(`✅ "${p.nombre}" agregado al carrito`);
    }
    
    cerrarProducto();
}

function agregarAlCarrito(id) {
    const p = productos.find(x => x.id == id);
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
                        <option value="contado">💵 Contado Efectivo</option>
                        <option value="transferencia">🏦 Transferencia / Depósito</option>
                        <option value="apartado">📦 Sistema de Apartado</option>
                        <option value="credito">💳 Crédito / Pagos Semanales</option>
                    </select>
                </div>

                <div id="divCuentaReceptora" class="campo oculto" style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0;">
                    <label>💳 ¿Dónde entra el dinero?</label>
                    <select id="selCuentaReceptora" style="width:100%; padding:12px; border:1px solid #cbd5e0; border-radius:6px; font-weight:bold;">
                        <option value="efectivo">💵 Efectivo</option>
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

    // Mostrar selector de cuenta receptora cuando hay cobro inmediato
    const divCuenta = document.getElementById("divCuentaReceptora");
    if (divCuenta) {
        const engancheVal = parseFloat(document.getElementById("numEnganche")?.value) || 0;
        const hayCobroInmediato = (metodo === "contado" || metodo === "transferencia" ||
            ((metodo === "apartado" || metodo === "credito") && engancheVal > 0));
        if (hayCobroInmediato) {
            divCuenta.classList.remove("oculto");
            const cuentasDebito = tarjetasConfig.filter(t => t.tipo === "debito");
            let optsHTML = "";
            if (metodo === "transferencia") {
                // Solo cuentas débito para transferencia
                optsHTML = cuentasDebito.length > 0
                    ? cuentasDebito.map(c => `<option value="${c.banco}">🏦 ${c.banco} Débito</option>`).join('')
                    : '<option value="">-- Sin cuentas débito --</option>';
            } else {
                // Efectivo + cuentas débito para contado / enganche
                optsHTML = '<option value="efectivo">💵 Efectivo</option>';
                cuentasDebito.forEach(c => {
                    optsHTML += `<option value="${c.banco}">🏦 ${c.banco} Débito</option>`;
                });
            }
            document.getElementById("selCuentaReceptora").innerHTML = optsHTML;
        } else {
            divCuenta.classList.add("oculto");
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
        const producto = carrito[index];
        carrito.splice(index, 1);
        if (!StorageService.set("carrito", carrito)) {
            console.error("❌ Error guardando carrito");
        }
        actualizarContadorCarrito();
    }
}

// ===== VENTA FINAL (FUNCIÓN ÚNICA - NO DUPLICADA) =====
/**
 * Confirma la venta final con todos los parámetros validados
 */
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
    } else if (metodoPago === "transferencia") {
        detalleMetodo = `<p style="color:#2b6cb0;"><strong>🏦 TRANSFERENCIA / DEPÓSITO</strong></p>`;
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

    _planElegidoPendiente = planElegido;

    // Eliminar modal anterior si existe
    document.querySelector('[data-modal="resumen-venta"]')?.remove();

    const modalHTML = `
    <div class="modal" data-modal="resumen-venta" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
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
                    <button onclick="procesarVentaConInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar})" 
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
    // Ocultar modales estáticos
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('oculto');
        modal.style.display = 'none';
    });
    // Eliminar modales dinámicos del DOM
    document.querySelectorAll('[data-modal]').forEach(modal => modal.remove());
    
    // Ir al carrito
    navA('carrito');
}

function procesarVentaConInventario(metodoPago, totalContado, enganche, saldoAFinanciar) {
    console.log("🔄 Procesando venta con inventario...");
    console.log("Plan elegido final:", _planElegidoPendiente);
    mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, _planElegidoPendiente);
}

/**
 * Dialogo interactivo de gestión de inventario
 * Pregunta por cada producto si se entrega o se deja pendiente
 */
function mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido) {
    let productosConStock = [];
    let productosSinStock = [];

    // Reiniciar decisiones para evitar estado residual de un diálogo anterior
    decisionesInventario = {};

    // Clasificar productos: solo "con stock" si hay suficiente para la cantidad solicitada
    carrito.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (prod) {
            if ((prod.stock || 0) >= (item.cantidad || 1)) {
                productosConStock.push({ item, prod });
            } else {
                productosSinStock.push({ item, prod });
            }
        }
    });

    // Crear modal interactivo
    let htmlProductos = '';

    // PRODUCTOS CON STOCK - Preguntar SÍ o NO
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

    // PRODUCTOS SIN STOCK - Solo aviso
    if (productosSinStock.length > 0) {
        htmlProductos += `
            <div style="background:#fee2e2; padding:15px; border-radius:8px; border-left:5px solid #dc2626;">
                <h4 style="margin:0 0 15px 0; color:#7f1d1d;">📦 PRODUCTOS SIN STOCK</h4>
        `;
        
        productosSinStock.forEach(x => {
            const idProd = x.prod.id;
            decisionesInventario[idProd] = { entregar: false }; // Auto pendiente
            
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px;">
                    <strong>${x.prod.nombre}</strong><br>
                    <small style="color:#991b1b;">⚠️ Se creará REQUISICIÓN DE COMPRA automáticamente</small><br>
                    <small style="color:#7f1d1d;">Stock actual: ${x.prod.stock || 0} | Solicitado: ${x.item.cantidad || 1}</small>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    // Eliminar modal anterior si existe
    document.querySelector('[data-modal="dialogo-inventario"]')?.remove();

    const modalHTML = `
        <div class="modal" data-modal="dialogo-inventario" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:700px; margin:20px auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">📦 Gestión de Inventario</h2>
                <p style="color:#718096; margin:0 0 20px 0;">Confirma cómo se entregarán los productos</p>
                
                ${htmlProductos}
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="confirmarDecisionesInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar})" 
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

/**
 * Guarda la decisión de cada producto (entregar o pendiente)
 */
function setDecisionInventario(productoId, entregar) {
    decisionesInventario[productoId] = { entregar };
    
    // Actualizar visual de botones
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

/**
 * Confirma todas las decisiones y procesa la venta
 */
function confirmarDecisionesInventario(metodoPago, totalContado, enganche, saldoAFinanciar) {
    const planElegido = _planElegidoPendiente;

    const folioVenta = "V-" + Date.now().toString().slice(-6);
    const fechaHoy = new Date().toLocaleDateString("es-MX");
    const fechaVentaIso = new Date().toISOString();

    let productosAEntregar = [];
    let productosAPendiente = [];

    // Procesar decisiones
    carrito.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (!prod) return;

        const decision = decisionesInventario[item.id];
        const tieneStock = (prod.stock || 0) >= (item.cantidad || 1);

        if (tieneStock && decision && decision.entregar) {
            // ENTREGAR AHORA
            productosAEntregar.push({ item, prod });
        } else {
            // DEJAR PENDIENTE O SIN STOCK
            productosAPendiente.push({ item, prod });
        }
    });

    // Procesar venta final
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

    // PASO 1: ACTUALIZAR STOCK (solo si hay stock suficiente; guard anti-negativo)
    productosConStock.forEach(x => {
        const cantRequerida = x.item.cantidad || 1;
        const stockActual = x.prod.stock || 0;
        if (stockActual >= cantRequerida) {
            x.prod.stock = stockActual - cantRequerida;
            registrarMovimiento(x.prod.id, `Venta - ${folioVenta}`, cantRequerida, "salida");
        } else {
            // Stock insuficiente en este punto (no debería ocurrir con la clasificación correcta)
            console.warn(`⚠️ Stock insuficiente para ${x.prod.nombre} al procesar venta. Creando requisición.`);
            requisicionesCompra.push({
                id: Date.now() + Math.random(),
                fecha: fechaHoy,
                producto: x.prod.nombre,
                folioVenta,
                cantidad: cantRequerida - stockActual,
                motivo: "Stock insuficiente al confirmar entrega",
                estatus: "Pendiente"
            });
        }
    });

    // PASO 2: CREAR ENTREGAS PENDIENTES
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

    // PASO 3: REGISTRAR MOVIMIENTOS DE CAJA
    const cuentaReceptora = document.getElementById("selCuentaReceptora")?.value || "efectivo";

    if (metodoPago === "contado" || metodoPago === "transferencia") {
        movimientosCaja.push({
            id: Date.now(),
            folio: folioVenta,
            fecha: fechaHoy,
            tipo: "ingreso",
            monto: totalContado,
            concepto: `Venta ${metodoPago === "transferencia" ? "Transferencia" : "Contado"} - ${clienteSeleccionado.nombre}`,
            referencia: metodoPago === "transferencia" ? "Transferencia" : "Contado",
            cuenta: cuentaReceptora
        });
    } else if (enganche > 0) {
        movimientosCaja.push({
            id: Date.now(),
            folio: folioVenta,
            fecha: fechaHoy,
            tipo: "ingreso",
            monto: enganche,
            concepto: `Enganche ${metodoPago} - ${clienteSeleccionado.nombre}`,
            referencia: "Enganche",
            cuenta: cuentaReceptora
        });
    }

    // PASO 4: CREAR CUENTAS POR COBRAR
    if (metodoPago === "credito" || metodoPago === "apartado") {
        const saldoPendiente = metodoPago === "credito"
            ? planElegido.total   // planElegido.total ya es calculado sobre saldoAFinanciar (precio - enganche)
            : saldoAFinanciar;    // apartado: precio - enganche

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
            totalMercancia: totalContado,
            periodicidad: document.getElementById("selPeriodicidad")?.value || "semanal"
        };

        cuentasPorCobrar.push(cuentaNueva);

        // PASO 5: CREAR PAGARÉS
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

    // GUARDAR TODO
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

    // GENERAR TICKET
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

    // Cerrar y eliminar todos los modales dinámicos
    document.querySelectorAll('[data-modal]').forEach(m => m.remove());
    document.querySelectorAll('.modal').forEach(m => {
        m.classList.add('oculto');
        m.style.display = 'none';
    });

    // LIMPIAR
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


// ===== GENERADOR DE TICKETS (COMPLETO) =====
function generarTicketMediaHoja(datosVenta) {
    // Preparar datos
    const folio = datosVenta.folio;
    const fechaActual = datosVenta.fecha;
    
    let tablaProductos = '';
    datosVenta.articulos.forEach(art => {
        const cantidad = art.cantidad || 1;
        const subtotal = (art.precioContado || 0) * cantidad;
        tablaProductos += `
            <tr>
                <td style="border: 1px solid #333; padding: 8px; text-align: center;">${cantidad}</td>
                <td style="border: 1px solid #333; padding: 8px;">${art.nombre}</td>
                <td style="border: 1px solid #333; padding: 8px; text-align: right;">${dinero(art.precioContado)}</td>
                <td style="border: 1px solid #333; padding: 8px; text-align: right;">${dinero(subtotal)}</td>
            </tr>
        `;
    });

    let tablaPagares = '';
    let totalAPagar = 0;

    if (datosVenta.metodo === "credito" && datosVenta.plan) {
        const pagares = StorageService.get("pagaresSistema", []);
        const pagaresDelFolio = pagares.filter(p => p.folio === folio);

        pagaresDelFolio.forEach((pagar, index) => {
            const fechaPago = new Date(pagar.fechaVencimiento);
            const fechaFormato = fechaPago.toLocaleDateString('es-MX');
            totalAPagar += pagar.monto;
            
            tablaPagares += `
                <tr>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${index + 1}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${fechaFormato}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: right; font-weight: bold;">${dinero(pagar.monto)}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                </tr>
            `;
        });
    }

    // Tabla de resumen de planes
    const saldoParaPlanes = datosVenta.total - (datosVenta.enganche || 0);
    const planesDisponibles = CalculatorService.calcularCredito(saldoParaPlanes > 0 ? saldoParaPlanes : datosVenta.total);
    let tablaPlanes = '';
    planesDisponibles.forEach(plan => {
        const textoMeses = plan.meses === 1 ? `${plan.meses} MES (Contado)` : `${plan.meses} MESES`;
        const textoInteres = plan.meses === 1 ? '(Sin interés)' : '(Total)';
        tablaPlanes += `
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">
                <strong>${textoMeses}</strong><br>
                ${dinero(plan.total)}<br>
                <small>${textoInteres}</small>
            </td>
        `;
    });

    const ticketHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TICKET DE VENTA - ${folio}</title>
            <style>
                @page {
                    size: Letter portrait;
                    margin: 8mm;
                }

                body {
                    font-family: Arial, sans-serif;
                    font-size: 10px;
                    padding: 5mm;
                    color: #000;
                }

                .ticket {
                    width: 100%;
                    max-width: 190mm;
                    margin: 0 auto;
                    border: 2px solid #1a3a70;
                    padding: 10px;
                }

                .encabezado {
                    display: grid;
                    grid-template-columns: 70px 1fr 120px;
                    gap: 10px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 8px;
                    margin-bottom: 8px;
                }

                .logo {
                    width: 70px;
                    height: 70px;
                    font-size: 40px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at 30% 30%, #87ceeb, #4a90e2);
                    border: 2px solid #1a3a70;
                }

                .titulo h1 {
                    font-size: 16px;
                    color: #1a3a70;
                    margin: 0;
                    text-align: center;
                }

                .titulo p {
                    font-size: 9px;
                    text-align: center;
                    margin: 2px 0;
                }

                .folio-box {
                    border: 2px solid #333;
                    padding: 6px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 9px;
                }

                .folio-number {
                    color: #dc2626;
                    font-size: 16px;
                }

                .subtitulo {
                    text-align: center;
                    font-size: 13px;
                    font-weight: bold;
                    margin: 6px 0 2px 0;
                    color: #1a3a70;
                }

                .fecha {
                    text-align: right;
                    font-weight: bold;
                    margin-bottom: 6px;
                    font-size: 10px;
                }

                .seccion-titulo {
                    background: #1a3a70;
                    color: white;
                    padding: 5px 10px;
                    font-weight: bold;
                    margin: 6px 0 4px 0;
                    border-radius: 3px;
                    font-size: 10px;
                }

                .datos-cliente {
                    border: 1px solid #333;
                    padding: 6px 10px;
                    margin-bottom: 6px;
                    font-size: 10px;
                }

                .datos-cliente p { margin: 3px 0; }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 6px;
                    font-size: 9px;
                }

                th {
                    background: #e8f0fe;
                    border: 1px solid #333;
                    padding: 5px 6px;
                    text-align: left;
                    font-weight: bold;
                    color: #1a3a70;
                }

                td {
                    border: 1px solid #333;
                    padding: 4px 6px;
                }

                .total-row {
                    background: #f0f0f0;
                    font-weight: bold;
                }

                .enganche-box {
                    background: #fffbeb;
                    border: 1px solid #f59e0b;
                    padding: 6px 10px;
                    margin: 6px 0;
                    display: grid;
                    grid-template-columns: 1fr 120px;
                    gap: 10px;
                    font-size: 9px;
                }

                .enganche-monto {
                    background: white;
                    border: 1px solid #f59e0b;
                    padding: 6px;
                    text-align: center;
                    font-size: 13px;
                    font-weight: bold;
                    color: #f59e0b;
                }

                .tabla-pagares-titulo {
                    background: #1a3a70;
                    color: white;
                    padding: 5px;
                    text-align: center;
                    font-weight: bold;
                    border-radius: 3px;
                    margin-bottom: 5px;
                    font-size: 10px;
                }

                .planes-resumen {
                    background: #1a3a70;
                    color: white;
                    padding: 8px;
                    margin: 8px 0;
                    border-radius: 3px;
                    text-align: center;
                    font-size: 9px;
                }

                .planes-titulo {
                    font-weight: bold;
                    margin-bottom: 6px;
                    font-size: 9px;
                }

                .firma-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-top: 15px;
                    text-align: center;
                }

                .linea-firma {
                    border-top: 1px solid #333;
                    padding-top: 5px;
                    font-weight: bold;
                    font-size: 9px;
                }

                .notas-legales {
                    background: #f0f0f0;
                    padding: 6px 10px;
                    margin-top: 8px;
                    font-size: 8px;
                    line-height: 1.4;
                    border: 1px solid #333;
                    text-align: justify;
                }

                @media print {
                    body { padding: 0; }
                    .ticket { border: none; max-width: 100%; }
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                <!-- ENCABEZADO -->
                <div class="encabezado">
                    <div class="logo" style="overflow:hidden; display:flex; align-items:center; justify-content:center;">
                        <img src="img/logo.png" style="width:66px; height:66px; object-fit:contain;"
                             onerror="this.outerHTML='<span style=&quot;font-size:36px;&quot;>🏛️</span>'">
                    </div>
                    <div class="titulo">
                        <h1>MUEBLERÍA<br>MI PUEBLITO</h1>
                        <p>"Calidad, Estilo y Precio que te hacen sentir en casa"</p>
                        <p style="margin-top: 8px;">Santiago Cuaula, Tlaxcala • Tel. 228 123 4567</p>
                    </div>
                    <div class="folio-box">
                        FOLIO:<br>
                        <div class="folio-number">${folio}</div>
                    </div>
                </div>

                <!-- TÍTULO Y FECHA -->
                <div style="text-align: center; margin-bottom: 10px;">
                    <div class="subtitulo">TICKET DE VENTA</div>
                    <div class="fecha">FECHA: ${fechaActual}</div>
                </div>

                <!-- DATOS DEL CLIENTE -->
                <div class="seccion-titulo">DATOS DEL CLIENTE</div>
                <div class="datos-cliente">
                    <p><strong>NOMBRE:</strong> ${datosVenta.cliente.nombre}</p>
                    <p><strong>TELÉFONO:</strong> ${datosVenta.cliente.telefono || '_______________________'}</p>
                    <p><strong>DOMICILIO:</strong> ${datosVenta.cliente.direccion || '_______________________'}</p>
                </div>

                <!-- TABLA DE PRODUCTOS -->
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">CANT.</th>
                            <th>DESCRIPCIÓN DEL PRODUCTO</th>
                            <th style="width: 120px; text-align: right;">PRECIO UNIT.</th>
                            <th style="width: 120px; text-align: right;">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tablaProductos}
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right;">TOTAL DE LA VENTA:</td>
                            <td style="text-align: right; color: #dc2626; font-size: 16px;">${dinero(datosVenta.total)}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- ENGANCHE -->
                ${datosVenta.enganche > 0 ? `
                    <div class="enganche-box">
                        <div class="enganche-texto">
                            <strong>ENGANCHE RECIBIDO:</strong><br>
                            Se descuenta del total y el saldo restante se financia.
                        </div>
                        <div class="enganche-monto">
                            ${dinero(datosVenta.enganche)}
                        </div>
                    </div>
                ` : ''}

                <!-- TABLA DE PAGARÉS (Solo si es crédito) -->
                ${datosVenta.metodo === "credito" && datosVenta.plan ? `
                    <div class="tabla-pagares">
                        <div class="tabla-pagares-titulo">PAGARÉS (TABLA DE AMORTIZACIONES)</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">No.</th>
                                    <th>FECHA DE ABONO (PAGARÉ)</th>
                                    <th style="width: 120px;">IMPORTE DE ABONO</th>
                                    <th>FECHA REAL DE ABONO (LLENAR)</th>
                                    <th>SALDO (LLENAR)</th>
                                    <th>FIRMA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tablaPagares}
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right;">TOTAL A PAGAR:</td>
                                    <td style="text-align: right; color: #dc2626; font-size: 14px;">${dinero(totalAPagar)}</td>
                                    <td colspan="3"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <!-- RESUMEN DE PLANES -->
                <div class="planes-resumen">
                    <div class="planes-titulo">RESUMEN DE SU PLAN DE PAGOS (SEGÚN SU COTIZACIÓN)</div>
                    <table style="background: transparent; margin: 0; border: none;">
                        <tr>
                            ${tablaPlanes}
                        </tr>
                    </table>
                </div>

                <!-- NOTAS Y TÉRMINOS -->
                <div class="notas-legales">
                    <strong>TÉRMINOS Y CONDICIONES:</strong>
                    <br><br>
                    Al firmar este ticket, acepto los términos de pago y me comprometo a cubrir cada pagaré en la fecha indicada.
                    <br><br>
                    <strong>Este pagaré se otorga en los términos del Art. 170 de la Ley General de Títulos y Operaciones de Crédito.</strong> El suscriptor se obliga incondicionalmente a pagar esta cantidad en la fecha indicada. El incumplimiento en el pago, ya sea total o parcial, causará intereses moratorios a razón de la tasa establecida (2% mensual). En caso de juicio, el deudor será responsable de los gastos de cobro que se generen.
                    <br><br>
                    Por lo relativo a la interpretación, cumplimiento y ejecución de este pagaré, las partes se someten a la jurisdicción de los tribunales del domicilio del acreedor (Santiago Cuaula, Tlaxcala), renunciando a cualquier otro fuero que pudiera corresponderle.
                </div>

                <!-- FIRMAS -->
                <div class="firma-section">
                    <div>
                        <div style="margin-bottom: 40px;"></div>
                        <div class="linea-firma">FIRMA DEL CLIENTE</div>
                    </div>
                    <div>
                        <div style="margin-bottom: 40px;"></div>
                        <div class="linea-firma">VENDEDOR / EMPRESA</div>
                    </div>
                </div>

                <!-- PIE -->
                <div style="text-align: center; margin-top: 20px; color: #666; font-size: 11px;">
                    <p><strong>Mueblería Mi Pueblito</strong></p>
                    <p>Roberto Escobedo Vega</p>
                    <p>Santiago Cuaula, Tlaxcala • Tel. 228 123 4567</p>
                    <p style="margin-top: 10px; color: #999;">Documento emitido: ${new Date().toLocaleString('es-MX')}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Crear e imprimir
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
        alert("⚠️ Habilita las ventanas emergentes para imprimir el ticket");
        return;
    }
    
    ventanaImpresion.document.write(ticketHTML);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    
    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
    // Guardar ticket en registro
    guardarTicketEnRegistro(datosVenta, folio);
}

/**
 * Guarda el ticket en el registro histórico
 * @param {Object} datosVenta - Datos de la venta
 * @param {string} folio - Folio único del ticket
 */
function guardarTicketEnRegistro(datosVenta, folio) {
    let registroTickets = StorageService.get("registroTickets", []);
    
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresDelFolio = pagares.filter(p => p.folio === folio);

    const ticketRegistro = {
        id: Date.now(),
        folio: folio,
        fechaEmision: datosVenta.fechaIso,
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
            articulos: datosVenta.articulos
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
        ultimaActualizacion: new Date().toISOString()
    };

    registroTickets.push(ticketRegistro);
    if (!StorageService.set("registroTickets", registroTickets)) {
        console.error("❌ Error guardando ticket en registro");
    }
}

// ===== ENTREGAS =====
function renderEntregas() {
    const contenedor = document.getElementById("panel-entregas-pendientes");
    if (!contenedor) return;

    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const pendientes = salidasPendientesVenta.filter(s => s.estatus === "Pendiente");

    if (pendientes.length === 0) {
        contenedor.innerHTML = "<p style='color:#718096; padding:20px; background:white; border-radius:8px;'>✅ No hay entregas pendientes.</p>";
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
        const resumen = (s.items || []).map(item => `${item.nombre} ×${item.cantidad || 1}`).join(', ');
        html += `<tr>
            <td><strong style="cursor:pointer; color:#2980b9; text-decoration:underline;" onclick="abrirDetalleEntrega(${s.id})">${s.folioVenta}</strong></td>
            <td>${s.clienteNombre || '—'}</td>
            <td>${s.fecha || '—'}</td>
            <td><small>${s.metodoPago || '—'}</small></td>
            <td style="font-size:13px;">${resumen || '—'}</td>
            <td style="text-align:center;">
                <button onclick="abrirDetalleEntrega(${s.id})" style="background:#3498db; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; margin-right:4px;">🔍 Detalle</button>
            </td>
        </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function abrirDetalleEntrega(idSalida) {
    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const s = salidasPendientesVenta.find(x => x.id === idSalida);
    if (!s) return;

    const clienteObj = clientes.find(c => c.id === s.clienteId || c.id === Number(s.clienteId));
    const direccion = clienteObj ? (clienteObj.direccion || '—') : '—';
    const telefono = clienteObj ? (clienteObj.telefono || '—') : '—';

    const itemsHtml = (s.items || []).map(i => `
        <tr>
            <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${i.nombre || '—'}</td>
            <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #f3f4f6;">${i.cantidad || 1}</td>
            <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #f3f4f6;">${dinero(i.precio || 0)}</td>
        </tr>`).join('');

    const totalVenta = (s.items || []).reduce((acc, i) => acc + ((i.precio || 0) * (i.cantidad || 1)), 0);

    const modalHTML = `
        <div data-modal="detalle-entrega" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:580px; max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0;">🚚 Detalle de Entrega</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-entrega&quot;]')?.remove();" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280;">✕</button>
                </div>
                <div style="display:grid; gap:10px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Folio:</span><strong>${s.folioVenta}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Cliente:</span><strong>${s.clienteNombre || '—'}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Dirección:</span><span>${direccion}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Teléfono:</span><span>${telefono}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Fecha:</span><span>${s.fecha || '—'}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Método de Pago:</span><span>${s.metodoPago || '—'}</span></div>
                </div>
                <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:15px;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:6px 8px; text-align:left;">Producto</th>
                        <th style="padding:6px 8px; text-align:right;">Cant.</th>
                        <th style="padding:6px 8px; text-align:right;">Precio</th>
                    </tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                <div style="text-align:right; font-size:16px; font-weight:bold; color:#2c3e50; margin-bottom:20px;">
                    Total: ${dinero(totalVenta)}
                </div>
                <div style="display:flex; gap:10px;">
                    <button onclick="aplicarSalidaPendienteVentas(${s.id}); document.querySelector('[data-modal=&quot;detalle-entrega&quot;]')?.remove();"
                            style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ Aplicar Entrega
                    </button>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-entrega&quot;]')?.remove();"
                            style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ✕ Cerrar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ===== REIMPRIMIR TICKET DE VENTA =====
function renderReimprimirVenta() {
    const contenedor = document.getElementById("contenidoReimprimirVenta");
    if (!contenedor) return;

    const folioFiltro = (document.getElementById("rvFolio")?.value || "").trim().toLowerCase();
    const clienteFiltro = (document.getElementById("rvCliente")?.value || "").trim().toLowerCase();
    const fechaDesde = document.getElementById("rvFechaDesde")?.value || "";
    const fechaHasta = document.getElementById("rvFechaHasta")?.value || "";
    const montoMin = parseFloat(document.getElementById("rvMontoMin")?.value) || 0;
    const montoMax = parseFloat(document.getElementById("rvMontoMax")?.value) || Infinity;

    const registros = StorageService.get("registroTickets", []);

    if (registros.length === 0) {
        contenedor.innerHTML = `<div style="background:#fef3c7; padding:30px; border-radius:10px; text-align:center; color:#92400e;">
            <p style="font-size:16px;">⚠️ No hay tickets registrados aún. Los tickets se guardan automáticamente al realizar ventas.</p>
        </div>`;
        return;
    }

    let filtrados = registros.filter(t => {
        const nombreCliente = (t.cliente?.nombre || "").toLowerCase();
        const folio = (t.folio || "").toLowerCase();
        const fecha = t.fechaEmision ? t.fechaEmision.substring(0, 10) : "";
        const total = t.venta?.total || 0;

        if (folioFiltro && !folio.includes(folioFiltro)) return false;
        if (clienteFiltro && !nombreCliente.includes(clienteFiltro)) return false;
        if (fechaDesde && fecha < fechaDesde) return false;
        if (fechaHasta && fecha > fechaHasta) return false;
        if (total < montoMin) return false;
        if (montoMax !== Infinity && total > montoMax) return false;
        return true;
    }).sort((a, b) => new Date(b.fechaEmision) - new Date(a.fechaEmision));

    if (filtrados.length === 0) {
        contenedor.innerHTML = `<div style="background:#f3f4f6; padding:30px; border-radius:10px; text-align:center; color:#6b7280;">
            <p style="font-size:16px;">🔍 Sin resultados para los filtros aplicados.</p>
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
        const fecha = t.fechaEmision ? new Date(t.fechaEmision).toLocaleDateString('es-MX') : '—';
        const total = t.venta?.total || 0;
        const metodo = t.venta?.metodoPago || '—';
        const folioEsc = (t.folio || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += `<tr>
            <td><strong style="color:#1d4ed8;">${t.folio || '—'}</strong></td>
            <td>${t.cliente?.nombre || '—'}</td>
            <td>${fecha}</td>
            <td><strong>${dinero(total)}</strong></td>
            <td>${metodo}</td>
            <td style="text-align:center;">
                <button onclick="reimprimirTicketVenta('${folioEsc}')"
                        style="padding:6px 12px; background:#2563eb; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">
                    🖨️ Reimprimir
                </button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

function reimprimirTicketVenta(folio) {
    const registros = StorageService.get("registroTickets", []);
    const ticket = registros.find(t => t.folio === folio);

    if (!ticket) {
        alert(`⚠️ No se encontró el ticket con folio: ${folio}`);
        return;
    }

    const datosVenta = {
        folio: ticket.folio,
        fecha: ticket.fechaEmision
            ? new Date(ticket.fechaEmision).toLocaleDateString('es-MX')
            : new Date().toLocaleDateString('es-MX'),
        fechaIso: ticket.fechaEmision,
        cliente: ticket.cliente || {},
        metodo: ticket.venta?.metodoPago || 'contado',
        total: ticket.venta?.total || 0,
        enganche: ticket.venta?.enganche || 0,
        saldoPendiente: ticket.venta?.saldoPendiente || 0,
        plan: ticket.venta?.plan || null,
        articulos: ticket.venta?.articulos || []
    };

    generarTicketMediaHoja(datosVenta);
}

function limpiarFiltrosReimpresion() {
    ['rvFolio','rvCliente','rvFechaDesde','rvFechaHasta','rvMontoMin','rvMontoMax'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    renderReimprimirVenta();
}

window.renderReimprimirVenta = renderReimprimirVenta;
window.reimprimirTicketVenta = reimprimirTicketVenta;
window.limpiarFiltrosReimpresion = limpiarFiltrosReimpresion;
