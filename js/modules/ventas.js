// ===== ESTADO DE PAGO — persiste entre vistas =====
// Se guarda aquí para no depender del DOM del carrito cuando
// confirmarVentaFinal() se llama desde la vista seleccionarcliente
window._estadoPago = window._estadoPago || {
    metodo: "contado",
    enganche: 0,
    periodicidad: "semanal",
    modoEnganche: "efectivo",
    cuentaReceptora: "efectivo",
    planIndex: null,
    plan: null          // objeto completo del plan elegido
};

function _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

function agregarAlCarritoDesdeModal() {
    if (!productoActualId) return;
    const p = productos.find(prod => String(prod.id) === String(productoActualId));
    if (!p) {
        alert("❌ Error: Producto no encontrado.");
        return;
    }

    const indiceExistente = carrito.findIndex(item => String(item.id) === String(productoActualId));
    
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
    const p = productos.find(x => String(x.id) === String(id));
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

    // Detectar admin
    const esAdmin = _esAdmin();

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
        const prod = productos.find(p => String(p.id) === String(item.id));
        if (!prod) {
            console.warn("⚠️ Producto fantasma eliminado del carrito:", item.id);
            return false;
        }
        return true;
    });

    StorageService.set("carrito", carrito);

    let totalContado = carrito.reduce((sum, p) => 
        sum + (p.precioContado || 0) * (p.cantidad || 1), 0
    );

    let html = `
        <div class="header-seccion" style="margin-bottom: 20px;">
            <h2>🛒 Carrito de Ventas</h2>
        </div>
        
        <div style="display:grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px; align-items: start;">
            
            <div style="background:white; padding:20px; border-radius:10px;">
                <h3 style="margin:0 0 15px 0;">Productos seleccionados</h3>
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

        // === LÓGICA DE COLOR (TEXTO LIBRE CON SUGERENCIAS) ===
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
                        🗑️
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
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">👤 Vendedor</label>
                    <select id="selVendedor" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;">
                        <option value="">-- Sin vendedor asignado --</option>
                        ${StorageService.get("vendedores", []).map(v => `<option value="${v.id}">${v.nombre}</option>`).join('')}
                    </select>
                </div>

                <!-- MÉTODO DE PAGO -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">💳 Método de pago</label>
                    <select id="selMetodoPago"
                            onchange="actualizarInterfazPago();"
                            style="width:100%; padding:9px; border:2px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:bold;">
                        <option value="contado">💵 Contado</option>
                        <option value="transferencia">🏦 Transferencia / Depósito</option>
                        <option value="credito">💳 Crédito</option>
                        <option value="apartado">📦 Apartado</option>
                    </select>
                </div>

                <!-- ENGANCHE (visible para crédito y apartado) -->
                <div id="divEnganche" class="oculto" style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">💵 Enganche inicial</label>
                    <input type="number" id="numEnganche" min="0" step="50" value="0"
                           onchange="actualizarInterfazPago()"
                           oninput="actualizarInterfazPago()"
                           placeholder="0.00"
                           style="width:100%; padding:9px; border:2px solid #f59e0b; border-radius:6px; font-size:16px; font-weight:bold; color:#92400e; box-sizing:border-box; text-align:right;">
                    <div style="font-size:11px; color:#92400e; margin-top:3px;">Monto que paga el cliente hoy</div>
                </div>

                <!-- PERIODICIDAD (solo crédito) -->
                <div id="divPeriodicidad" class="oculto" style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">📅 Periodicidad de abonos</label>
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
                    <label style="font-size:13px; font-weight:bold; color:#166534; display:block; margin-bottom:6px;">💳 ¿A qué caja o cuenta ingresa el dinero hoy?</label>
                    ${window._buildSelectorCuentas ? window._buildSelectorCuentas('cuentaReceptora_venta', false) : '<select id="cuentaReceptora_venta" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;"><option value="efectivo">💵 Efectivo Principal</option></select>'}
                </div>

                <!-- RESULTADOS DEL PLAN -->
                <div id="resultadosPago" style="margin-bottom:12px;"></div>

                <!-- NOTA DE INVENTARIO AUTOMÁTICO -->
                <div style="background:#eff6ff; padding:10px; border-radius:6px; margin-bottom:16px; font-size:12px; border:1px solid #bfdbfe; color:#1e40af;">
                    ℹ️ <strong>Inventario automático:</strong> Si hay stock se preguntará si se entrega; si no hay stock se genera requisición de compra automáticamente.
                </div>

                <!-- FECHA DE VENTA -->
                <div style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">📅 Fecha de venta</label>
                    <input type="date" id="inputFechaVenta"
                           style="width:100%; padding:9px; border:2px solid #d1d5db; border-radius:6px; font-size:14px; font-weight:bold; box-sizing:border-box;"
                           value="${window.obtenerHoyInputMX()}">
                </div>

                <button onclick="irASeleccionCliente()"
                    style="width:100%; padding:14px; background:#27ae60; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:15px; letter-spacing:0.5px;">
                    👤 Seleccionar cliente →
                </button>
            </div>
        </div>
    `;

    vistaCarrito.innerHTML = html;
    
    // Resetear estado de pago al renderizar el carrito
    window._estadoPago = {
        metodo: "contado",
        enganche: 0,
        periodicidad: "semanal",
        modoEnganche: "efectivo",
        cuentaReceptora: "efectivo",
        planIndex: null,
        plan: null
    };
    plazoSeleccionado = null;
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
            console.error("❌ Error actualizando cantidad");
        }
        renderCarrito();
    }
}

// ===== HELPERS DE VARIANTES (COLOR Y UBICACIÓN) =====

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

// 2. Obtiene el stock total de un color específico
function obtenerStockPorColor(productoId, color) {
    const prod = productos.find(p => String(p.id) === String(productoId));
    if (!prod || !prod.variantes) return 0;
    
    return prod.variantes
        .filter(v => v.color && v.color.toUpperCase() === color.toUpperCase())
        .reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
}

// 3. Obtiene en qué ubicaciones está disponible un color específico
function obtenerUbicacionesPorColor(productoId, color) {
    const prod = productos.find(p => String(p.id) === String(productoId));
    if (!prod || !prod.variantes) return [];
    
    // Filtramos solo las variantes que coincidan con el color y tengan stock > 0
    return prod.variantes
        .filter(v => v.color && v.color.toUpperCase() === color.toUpperCase() && (Number(v.stock) || 0) > 0)
        .map(v => ({ ubicacion: v.ubicacion || 'General', stock: v.stock }));
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

    // ── CUENTA RECEPTORA / MODO DE COBRO (NUEVO MOTOR) ───────────────────────
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
    capturarDatosCredito();

    // ── GUARDAR ESTADO DE PAGO para no depender del DOM después ──────────────────
    window._estadoPago.metodo      = metodo;
    window._estadoPago.enganche    = enganche;
    window._estadoPago.periodicidad = metodo === "credito"
        ? (document.getElementById("selPeriodicidad")?.value || "semanal")
        : "semanal";
    window._estadoPago.modoEnganche = metodo === "contado"
        ? "efectivo"
        : (document.querySelector('input[name="modoEnganche"]:checked')?.value || "efectivo");
    window._estadoPago.cuentaReceptora = metodo === "contado"
        ? "efectivo"
        : (document.getElementById("selCuentaReceptora")?.value || "efectivo");
    window._estadoPago.fechaVenta = document.getElementById("inputFechaVenta")?.value || window.obtenerHoyInputMX();
    
    // Guardamos la caja seleccionada en nuestra libreta de estado temporal
    const selCaja = document.getElementById("cuentaReceptora_venta");
    window._estadoPago.cuentaReceptora = selCaja ? selCaja.value : "efectivo";
    window._estadoPago.etiquetaCuenta = selCaja && selCaja.selectedIndex >= 0 ? selCaja.options[selCaja.selectedIndex].text : "Efectivo";
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
            console.log("✅ Plan guardado con éxito:", window._estadoPago.plan);
        }
    } catch(e) {
        console.error("❌ Error al guardar el plan:", e);
    }
    actualizarInterfazPago();
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

    const metodoPago = window._estadoPago?.metodo || document.getElementById("selMetodoPago")?.value;

    if (!metodoPago) {
        alert("⚠️ Regresa al carrito y selecciona un método de pago.");
        return;
    }

    let descuentoAplicado = 0;
    if (typeof aplicarDescuentosAlCarrito === "function") {
        descuentoAplicado = aplicarDescuentosAlCarrito(carrito, clienteSeleccionado.id) || 0;
    }

    const totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    const totalConDescuento = totalContado - descuentoAplicado; 

    let enganche = window._estadoPago?.enganche ?? parseFloat(document.getElementById("numEnganche")?.value) ?? 0;
    if (enganche < 0) enganche = 0;

    if (enganche > totalConDescuento) {
        alert("⚠️ El enganche no puede ser mayor al total.");
        return;
    }

    const saldoAFinanciar = totalConDescuento - enganche;
    let planElegido = null;

    if (metodoPago === "credito") {
        const periodicidad = window._estadoPago?.periodicidad || document.getElementById("selPeriodicidad")?.value || "semanal";
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
        const planIdx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;

        if (planIdx === null || planIdx === undefined || planIdx < 0 || planIdx >= planes.length) {
            alert("⚠️ Selecciona un plazo de crédito en el carrito antes de continuar.");
            return;
        }

        planElegido = planes[planIdx];
        plazoSeleccionado = planIdx;

        if (!planElegido || planElegido.abono === 0) {
            alert("⚠️ Plan de crédito inválido. Regresa al carrito y vuelve a seleccionar el plazo.");
            return;
        }

        window._estadoPago.plan = planElegido;
        window._estadoPago.periodicidad = periodicidad;
    }

    const selVnd = document.getElementById("selVendedor");
    if (selVnd && selVnd.value) {
        const vendedores = StorageService.get("vendedores", []);
        _vendedorSeleccionado = vendedores.find(v => String(v.id) === String(selVnd.value)) || null;
    } else {
        _vendedorSeleccionado = null;
    }

    mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, descuentoAplicado, totalConDescuento);
}

function mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, descuentoAplicado = 0, totalConDescuento = null) {
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
            <p style="color:#2b6cb0; margin-bottom:5px;"><strong>💳 CRÉDITO CONFIGURADO</strong></p>
            <div style="background:#ebf8ff; padding:12px; border-radius:8px; border: 1px solid #bee3f8;">
                <p style="margin:3px 0;">💰 Enganche inicial: <strong>${dinero(engancheReal)}</strong></p>
                <p style="margin:3px 0;">📅 Plazo: <strong>${plan.meses} meses</strong></p>
                <p style="margin:3px 0;">🔄 ${plan.pagos} pagos <strong>${textoFreq}</strong></p>
                <p style="margin:3px 0;">💵 Importe de cada pagaré: <strong>${dinero(plan.abono)}</strong></p>
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

            ${resumenFinanciero}

            <div style="margin-bottom:20px;">
                <h4 style="color:#2c3e50; margin:0 0 10px 0;">💳 Forma de Pago</h4>
                ${detalleMetodo}
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="mostrarDialogoInventario('${metodoPago}', ${totalConDescuento ?? totalContado}, ${enganche}, ${saldoAFinanciar})"
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
    document.querySelectorAll('[data-modal]').forEach(modal => modal.remove());
    navA('carrito');
}

/**
 * Dialogo interactivo de gestión de inventario
 */
function mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido) {
    let productosConStock = [];
    let productosSinStock = [];

    decisionesInventario = {};

    carrito.forEach(item => {
        const prod = productos.find(p => String(p.id) === String(item.id));
        if (prod) {
            if ((prod.stock || 0) >= (item.cantidad || 1)) {
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
            const cantRequerida = x.item.cantidad || 1;

            const colorElegido = x.item.colorElegido || '';
            const ubicacionElegida = x.item.ubicacionElegida || '';

            let colorSelectorHtml = `
                <div style="margin-top:6px;">
                    <label style="font-size:11px; color:#374151;">🎨 Color:</label>
                    <input type="text" value="${_escapeHtml(colorElegido)}" 
                        onchange="cambiarColorInventario(${idProd}, this.value)"
                        placeholder="Ej. Rojo" 
                        style="margin-left:4px; padding:4px; border:1px solid #ddd; border-radius:4px; font-size:12px; width:120px;">
                </div>`;

            // 1. Obtener ubicaciones oficiales del sistema
            const ubicacionesConfig = StorageService.get("ubicacionesConfig", [
                { id: 1, nombre: "Piso de Ventas (General)" },
                { id: 2, nombre: "Bodega Principal" }
            ]);
            
            // 2. Armar las opciones del Combo Box con INVENTARIO DINÁMICO
            const stockActual = parseFloat(x.prod.stock) || 0;
            const stockEnVariantes = (x.prod.variantes || []).reduce((s, v) => s + (parseFloat(v.stock) || 0), 0);
            const stockGeneralSinAsignar = Math.max(0, stockActual - stockEnVariantes);

            let opcionesUbi = `<option value="Stock General" ${ubicacionElegida === 'Stock General' ? 'selected' : ''}>Stock General (${stockGeneralSinAsignar} disp.)</option>`;
            
            ubicacionesConfig.forEach(u => {
                const varianteUbi = (x.prod.variantes || []).find(v => v.ubicacion === u.nombre);
                const stockUbi = varianteUbi ? parseFloat(varianteUbi.stock) : 0;
                let sel = ubicacionElegida === u.nombre ? 'selected' : '';
                opcionesUbi += `<option value="${u.nombre}" ${sel}>${u.nombre} (${stockUbi} disp.)</option>`;
            });

            // 3. Crear el HTML del Selector
            let ubicacionSelectorHtml = `
                <div style="margin-top:6px;">
                    <label style="font-size:11px; color:#374151;">📍 Ubicación:</label>
                    <select onchange="cambiarUbicacionInventario(${idProd}, this.value)"
                        style="margin-left:4px; padding:4px; border:1px solid #ddd; border-radius:4px; font-size:12px; background:#f0fdf4; border-color:#86efac; width:220px; cursor:pointer;">
                        ${opcionesUbi}
                    </select>
                </div>`;
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${x.prod.nombre}</strong><br>
                        <small style="color:#718096;">Stock disponible: ${x.prod.stock} | Solicitado: ${cantRequerida}</small>
                        ${colorSelectorHtml}
                        ${ubicacionSelectorHtml}
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
            decisionesInventario[idProd] = { entregar: false }; 
            const colorElegido = x.item.colorElegido || 'Sin especificar';
            
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px;">
                    <strong>${x.prod.nombre}</strong><br>
                    <small style="color:#991b1b;">⚠️ Se creará REQUISICIÓN DE COMPRA automáticamente</small><br>
                    <small style="color:#7f1d1d;">Stock actual: ${x.prod.stock || 0} | Solicitado: ${x.item.cantidad || 1}</small><br>
                    <small style="color:#374151;">Color solicitado: <b>${_escapeHtml(colorElegido)}</b></small>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

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

function setDecisionInventario(productoId, entregar) {
    if (!decisionesInventario[productoId]) decisionesInventario[productoId] = {};
    decisionesInventario[productoId].entregar = entregar;
    
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

window.confirmarDecisionesInventario = function(metodoPago, totalContado, enganche, saldoAFinanciar) {
    let productosConStock = [];
    let productosSinStock = [];

    carrito.forEach(item => {
        const prod = productos.find(p => String(p.id) === String(item.id));
        if (!prod) return;

        const decision = decisionesInventario[prod.id] || { entregar: false };
        
        if (decision.entregar) {
            productosConStock.push({ item, prod });
        } else {
            productosSinStock.push({ item, prod });
        }
    });

    const folioVenta = "V-" + Date.now().toString().slice(-6);
    const fechaHoy = window.formatearFechaCortaMX(Date.now());
    const fechaVentaIso = Date.now();

    procesarVentaFinal(metodoPago, totalContado, enganche, saldoAFinanciar, _planElegidoPendiente, folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock);
};

function procesarVentaFinal(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock) {

    if (!totalContado || isNaN(totalContado) || totalContado <= 0) {
        totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    }

    let requisicionesCompra = StorageService.get("requisicionesCompra", []);
    let movimientosCaja = StorageService.get("movimientosCaja", []);
    let cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    let salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    let pagaresSistema = StorageService.get("pagaresSistema", []);

    let entregasPendientes = [];

    // PASO 1: ACTUALIZAR STOCK 
    // PASO 1: ACTUALIZAR STOCK 
    productosConStock.forEach(x => {
        const cantRequerida = x.item.cantidad || 1;
        const stockActual = x.prod.stock || 0;
        const colorElegido = x.item.colorElegido || '';
        const ubicacionElegida = x.item.ubicacionElegida || ''; 

        if (stockActual >= cantRequerida) {
            
            // --- INICIO DE LA CORRECCIÓN (PUNTO 5) ---
            // Descontar de la variante específica por color Y UBICACIÓN
            if (x.prod.variantes && x.prod.variantes.length > 0) {
                let restante = cantRequerida;
                
                // Intento 1: Buscar coincidencia exacta
                x.prod.variantes.forEach(v => {
                    const coincideColor = !colorElegido || (v.color && v.color.toUpperCase() === colorElegido.toUpperCase());
                    const coincideUbicacion = !ubicacionElegida || (v.ubicacion && v.ubicacion.toUpperCase() === ubicacionElegida.toUpperCase());

                    if (restante > 0 && coincideColor && coincideUbicacion && Number(v.stock) > 0) {
                        const deducir = Math.min(Number(v.stock), restante);
                        v.stock -= deducir;
                        restante -= deducir;
                    }
                });

                // Intento 2: Si hubo un error de dedo y quedó restante, descontar de donde haya (para no descuadrar)
                if (restante > 0) {
                    x.prod.variantes.forEach(v => {
                        if (restante > 0 && Number(v.stock) > 0) {
                            const deducir = Math.min(Number(v.stock), restante);
                            v.stock -= deducir;
                            restante -= deducir;
                        }
                    });
                }
            }
            // --- FIN DE LA CORRECCIÓN ---

            x.prod.stock = stockActual - cantRequerida;
            const concepto = colorElegido
                ? `Venta - ${folioVenta} (${colorElegido} - ${ubicacionElegida || 'General'})`
                : `Venta - ${folioVenta}`;
            if (typeof registrarMovimiento === 'function') registrarMovimiento(x.prod.id, concepto, cantRequerida, "salida");
        }
    });

    // PASO 2: CREAR ENTREGAS PENDIENTES Y REQUISICIONES (SIN STOCK)
    productosSinStock.forEach(x => {
        const cantidadSolicitada = x.item.cantidad || 1;
        const colorElegido = x.item.colorElegido || '';
        
        const nombreConColor = colorElegido ? `${x.prod.nombre} (Color: ${colorElegido})` : x.prod.nombre;

        entregasPendientes.push({
            id: Date.now() + Math.random(),
            folioVenta,
            productoId: x.prod.id,
            nombre: nombreConColor,
            cantidad: cantidadSolicitada,
            motivo: "Sin stock en almacén"
        });

        requisicionesCompra.push({
            id: Date.now() + Math.random(),
            fecha: fechaHoy,
            producto: nombreConColor, 
            folioVenta,
            cantidad: cantidadSolicitada,
            motivo: "Venta sin stock disponible",
            estatus: "Pendiente"
        });
    });

    // PASO 3: REGISTRAR MOVIMIENTOS DE CAJA
    let montoIngresoHoy = 0;
    let tituloConcepto = "";
    
    if (metodoPago === "contado" || metodoPago === "transferencia") {
        montoIngresoHoy = totalContado;
        tituloConcepto = "Venta";
    } else if (enganche > 0) {
        montoIngresoHoy = enganche;
        tituloConcepto = "Enganche";
    }

    if (montoIngresoHoy > 0) {
        const cuentaId = window._estadoPago.cuentaReceptora || 'efectivo';
        const etiqueta = window._estadoPago.etiquetaCuenta || 'Efectivo';

        if (typeof window._ingresarCuenta === 'function') {
            window._ingresarCuenta({
                monto: montoIngresoHoy,
                cuentaId: cuentaId,
                etiqueta: etiqueta,
                concepto: `${tituloConcepto} ${metodoPago} - ${clienteSeleccionado.nombre} (Folio: ${folioVenta})`,
                referencia: `VENTA-${folioVenta}`
            });
        } else {
            movimientosCaja.push({
                id: Date.now(),
                folio: folioVenta,
                fecha: fechaHoy,
                tipo: "ingreso",
                monto: montoIngresoHoy,
                concepto: `${tituloConcepto} ${metodoPago} - ${clienteSeleccionado.nombre}`,
                referencia: `VENTA-${folioVenta}`,
                cuenta: cuentaId,
                etiquetaCuenta: etiqueta
            });
            StorageService.set("movimientosCaja", movimientosCaja);
        }
    }

    // PASO 4: CREAR CUENTAS POR COBRAR
    if (metodoPago === "credito" || metodoPago === "apartado") {
        const saldoPendiente = metodoPago === "credito" ? planElegido.total : saldoAFinanciar;    

        let saldosPorMes = [];
        if (planElegido && (metodoPago === "credito")) {
            const periodicidad = window._estadoPago?.periodicidad || document.getElementById("selPeriodicidad")?.value || "semanal";
            const saldoBase = (totalContado - enganche);
            const planesPosibles = CalculatorService.calcularCreditoConPeriodicidad
                ? CalculatorService.calcularCreditoConPeriodicidad(saldoBase, periodicidad)
                : CalculatorService.calcularCredito(saldoBase);
            saldosPorMes = planesPosibles.map(p => ({ meses: p.meses, total: p.total }));
        }
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
            periodicidad: window._estadoPago?.periodicidad || document.getElementById("selPeriodicidad")?.value || "semanal",
            vendedorId: _vendedorSeleccionado ? _vendedorSeleccionado.id : null,
            vendedorNombre: _vendedorSeleccionado ? _vendedorSeleccionado.nombre : null,
            saldosPorMes
        };

        cuentasPorCobrar.push(cuentaNueva);

        // PASO 5: CREAR PAGARÉS
        if (metodoPago === "credito" && planElegido) {
            const periodicidad = window._estadoPago?.periodicidad || document.getElementById("selPeriodicidad")?.value || "semanal";
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
                    fechaVencimiento: fechaPago.getTime(),
                    monto: planElegido.abono,
                    estado: "Pendiente",
                    diasAtrasoActual: 0,
                    tasaMorosidad: 2,
                    acreedor: "Roberto Escobedo Vega",
                    lugar: "Santiago Cuaula, Tlaxcala"
                });
            }
        }

        if (!StorageService.set("cuentasPorCobrar", cuentasPorCobrar)) console.error("❌ Error guardando cuentas por cobrar");
        if (!StorageService.set("pagaresSistema", pagaresSistema)) console.error("❌ Error guardando pagarés");
    }

    // GUARDAR TODO
    if (!StorageService.set("productos", productos)) console.error("❌ Error guardando productos");
    if (!StorageService.set("movimientosCaja", movimientosCaja)) console.error("❌ Error guardando movimientos de caja");
    // NOTA: movimientosInventario NO se re-guarda aquí.
    // registrarMovimiento() ya escribe en IDB internamente.
    // Volver a guardar la copia local sobreescribiría esos movimientos.
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) console.error("❌ Error guardando requisiciones");

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
        if (!StorageService.set("salidasPendientesVenta", salidasPendientesVenta)) console.error("❌ Error guardando salidas pendientes");
    }

    // GENERAR TICKET Y REGISTRAR
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

    try {
        const ventasRegistradas = StorageService.get('ventasRegistradas', []);
        ventasRegistradas.push({
            folio:      folioVenta,
            fechaVenta: fechaVentaIso,
            fecha:      fechaHoy,
            clienteId:  clienteSeleccionado?.id || null,
            clienteNombre: clienteSeleccionado?.nombre || 'Sin nombre',
            total:      totalContado,
            enganche:   enganche || 0,
            saldoAFinanciar: saldoAFinanciar || 0,
            metodoPago: metodoPago,
            articulos:  carrito.map(p => ({ id: p.id, nombre: p.nombre, colorElegido: p.colorElegido || '', cantidad: p.cantidad || 1, precio: p.precioContado || 0 })),
            vendedor:   _vendedorSeleccionado ? _vendedorSeleccionado.nombre : null
        });
        if (!StorageService.set('ventasRegistradas', ventasRegistradas)) console.error('❌ Error guardando ventasRegistradas');
    } catch(e) {
        console.warn('⚠️ Error registrando en ventasRegistradas:', e.message);
    }

    generarTicketMediaHoja(datosVenta);

    if (datosVenta.articulos && datosVenta.articulos.length > 0) {
    // Filtramos solo lo que realmente se entrega (por si hubiera preventas en el futuro)
    // Por ahora, asumimos que lo que se procesa en el carrito como "entrega" genera el vale
    const articulosParaVale = datosVenta.articulos.map(a => ({
        nombre: a.nombre,
        colorElegido: a.colorElegido || '',
        cantidad: a.cantidad || 1
    }));

    // Retrasamos un segundo el segundo popup para evitar que el navegador bloquee las ventanas
    setTimeout(() => {
        generarValeEntrega({
            folioVenta: datosVenta.folio,
            clienteNombre: datosVenta.cliente.nombre,
            metodoPago: datosVenta.metodo
        }, articulosParaVale);
    }, 1000);
}

    if (_vendedorSeleccionado) {
        window._ultimaVentaMetodo = metodoPago;
        registrarComisionVenta(folioVenta, totalContado, _vendedorSeleccionado.id);
        setTimeout(() => { window._ultimaVentaMetodo = undefined; }, 1000);
    }

    document.querySelectorAll('[data-modal]').forEach(m => m.remove());
    document.querySelectorAll('.modal').forEach(m => {
        m.classList.add('oculto');
        m.style.display = 'none';
    });

    // Guardar referencias antes de limpiar el estado
    const _clienteParaPuntos = clienteSeleccionado;
    const _folioParaPuntos   = folioVenta;
    const _totalParaPuntos   = totalContado;

    carrito = [];
    clienteSeleccionado = null;
    plazoSeleccionado = null;
    _vendedorSeleccionado = null;
    if (!StorageService.set("carrito", carrito)) console.error("❌ Error limpiando carrito");
    actualizarContadorCarrito();

    // FIX: clienteSeleccionado ya es null aquí, usar la referencia guardada
    // FIX: la firma correcta es acumularPuntosCliente(clienteId, nombre, total, folio)
    if (typeof acumularPuntosCliente === "function" && _clienteParaPuntos) {
        acumularPuntosCliente(
            _clienteParaPuntos.id,
            _clienteParaPuntos.nombre,
            _totalParaPuntos,
            _folioParaPuntos
        );
    }

    alert(`✅ VENTA REGISTRADA\n\nFolio: ${folioVenta}\nCliente: ${datosVenta.cliente.nombre}\nTotal: ${dinero(datosVenta.total)}`);
    navA('tienda');
}

function generarLeyendaPagare(datosVenta, totalAPagar, esCompacta = false) {
    const cliente = datosVenta.cliente.nombre || "________________";
    const fecha = datosVenta.fecha;

    if (esCompacta) {
        return `PAGARÉ: Yo ${cliente} me obligo a pagar a la orden de Roberto Escobedo Vega la cantidad de ${dinero(totalAPagar)} conforme al calendario de pagos; incumplimiento genera interés moratorio del 2% mensual; firmado  en Santiago Cuaula Tlaxcala el ${fecha}.`;
    }

    return `PAGARÉ: Yo ${cliente} reconozco deber y me obligo incondicionalmente a pagar a la orden de Roberto Escobedo Vega la cantidad de ${dinero(totalAPagar)}, correspondiente al crédito otorgado, misma que cubriré en las fechas y montos establecidos en el calendario de pagos adjunto; en caso de incumplimiento total o parcial, se generarán intereses moratorios del 2% mensual sobre saldos insolutos; este pagaré se suscribe en Santiago Cuaula Tlaxcala con fecha ${fecha}, obligándome a cumplir en el domicilio del acreedor y sometiéndome para su interpretación y cumplimiento a la jurisdicción de los tribunales del domicilio del acreedor, renunciando a cualquier otro fuero que pudiera corresponderme.`;
}

// ===== GENERADOR DE TICKET TÉRMICO (80MM) CON CALENDARIO LIMPIO =====
function generarTicketMediaHoja(datosVenta) {
    const folio = datosVenta.folio;
    const fechaActual = datosVenta.fecha;
    
    // 1. Cálculos de Pagarés y Saldo
    let totalAPagar = 0;
    let tablaPagares = '';
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresDelFolio = pagares.filter(p => p.folio === folio);

    if (datosVenta.metodo === "credito") {
        pagaresDelFolio.forEach((pagar, index) => {
            const fechaPago = new Date(pagar.fechaVencimiento);
            const fechaFmt = window.formatearFechaCortaMX(fechaPago);
            totalAPagar += pagar.monto;
            
            // SOLO NÚMERO, FECHA Y MONTO
            tablaPagares += `
                <tr>
                    <td align="left" style="padding: 3px 0;">${index + 1}</td>
                    <td align="center" style="padding: 3px 0;">${fechaFmt}</td>
                    <td align="right" style="padding: 3px 0; font-weight: bold;">${dinero(pagar.monto)}</td>
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
                ${art.colorElegido ? `<small style="display:block; color:#555;">🎨 Color: ${art.colorElegido}</small>` : ''}
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
            const totalConEnganche = p.total + (datosVenta.enganche || 0);
            planesHTML += `
                <div style="display:flex; justify-content:space-between; border-bottom:1px dotted #ccc; padding:4px 0;">
                    <span style="font-size:10px;">${p.meses} Meses:</span>
                    <strong style="font-size:11px;">${dinero(totalConEnganche)}</strong>
                </div>`;
        });
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
        <div class="no-print"><button onclick="window.print()" style="padding:10px 20px; cursor:pointer;">🖨️ IMPRIMIR TICKET</button></div>

        <div class="centro">
            <img src="img/logo.png" style="width:50px; height:50px; object-fit:contain;" onerror="this.style.display='none'">
            <div class="negrita" style="font-size:16px;">MI PUEBLITO</div>
            <div style="font-size:10px;">Mueblería y Línea Blanca<br>Santiago Cuaula, Tlaxcala</div>
        </div>

        <div class="separador"></div>

        <div>
            <b>FOLIO: ${folio}</b><br>
            FECHA: ${fechaActual}<br>
            CLIENTE: ${datosVenta.cliente.nombre}<br>
            ${datosVenta.cliente.telefono ? 'TEL: ' + datosVenta.cliente.telefono : ''}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:10px;">DETALLE DE COMPRA</div>
        <div style="margin-top:5px;">${listaProductos}</div>

        <div class="separador"></div>

        <div style="display:flex; justify-content:space-between;">
            <span>Subtotal Mercancía:</span>
            <span>${dinero(datosVenta.total - (datosVenta.intereses || 0))}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
            <span>Enganche Recibido:</span>
            <span>${dinero(datosVenta.enganche || 0)}</span>
        </div>
        
        <div class="total-box">
            <div style="font-size:10px;">TOTAL A PAGAR</div>
            <div style="font-size:24px;" class="negrita">${dinero(datosVenta.total)}</div>
        </div>

        ${datosVenta.metodo === "credito" ? `
            <div class="centro negrita" style="background:#000; color:#fff; padding:4px; font-size:10px; margin-bottom:5px;">POLÍTICA DE LIQUIDACIÓN</div>
            <div style="font-size:9px; text-align:center; margin-bottom:5px;">Si liquida anticipadamente, el total baja a:</div>
            ${planesHTML}
            
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

        <div class="separador"></div>

        <div class="legal">
            ${generarLeyendaPagare(datosVenta, totalAPagar, false)}
        </div>

        <div style="margin-top:30px; text-align:center;">
            <div style="border-top: 1px solid #000; width: 80%; margin: 0 auto;"></div>
            <div class="negrita" style="font-size:10px; margin-top:5px;">FIRMA DE CONFORMIDAD</div>
        </div>

        <div class="centro" style="margin-top:20px; font-size:9px;">
            *** Gracias por su compra ***<br>
            Mueblería Mi Pueblito
        </div>
    </body>
    </html>`;

    const win = window.open('', '_blank');
    if (!win) {
        alert("⚠️ Habilita las ventanas emergentes para ver el ticket.");
        return;
    }
    win.document.write(ticketHTML);
    win.document.close();
    win.focus();
    
    guardarTicketEnRegistro(datosVenta, folio);
}

function guardarTicketEnRegistro(datosVenta, folio) {
    let registroTickets = StorageService.get("registroTickets", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresDelFolio = pagares.filter(p => p.folio === folio);

    const ticketRegistro = {
        id: Date.now(),
        folio: folio,
        fechaEmision: datosVenta.fechaIso || new Date().toISOString(),
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
        vendedorId: _vendedorSeleccionado ? _vendedorSeleccionado.id : null,
        vendedorNombre: _vendedorSeleccionado ? _vendedorSeleccionado.nombre : null,
        ultimaActualizacion: new Date().toISOString()
    };

    // 🛡️ BLINDAJE ANTI-DUPLICADOS
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

// ===== DETALLE DE ENTREGA (CON SOPORTE PARCIAL) =====
function abrirDetalleEntrega(idSalida) {
    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const s = salidasPendientesVenta.find(x => String(x.id) === String(idSalida));
    if (!s) return;

    let clientes = StorageService.get("clientes", []);
    const clienteObj = clientes.find(c => String(c.id) === String(s.clienteId));
    const direccion = clienteObj ? (clienteObj.direccion || '—') : (s.clienteDireccion || '—');
    const telefono = clienteObj ? (clienteObj.telefono || '—') : '—';

    // Generamos los inputs para que el vendedor decida cuánto entregar hoy
    const itemsHtml = (s.items || []).map((i, index) => {
        if (i.cantidad <= 0) return ''; // Si ya se entregó todo este item, lo omitimos
        
        return `
        <tr>
            <td style="padding:8px; border-bottom:1px solid #f3f4f6;">
                <strong>${i.nombre || '—'}</strong>
                ${i.colorElegido ? `<br><small style="color:#64748b;">Color: ${i.colorElegido}</small>` : ''}
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
                    <h2 style="margin:0; color:#1e3a8a;">🚚 Gestión de Entrega</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-entrega&quot;]')?.remove();" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280;">✕</button>
                </div>
                
                <div style="display:grid; gap:8px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:8px; border: 1px solid #e2e8f0; font-size:13px;">
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Folio:</span><strong>${s.folioVenta}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Cliente:</span><strong>${s.clienteNombre || '—'}</strong></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Dirección:</span><span>${direccion}</span></div>
                    <div style="display:flex; justify-content:space-between;"><span style="color:#718096;">Teléfono:</span><span>${telefono}</span></div>
                </div>

                <div style="background:#fffbeb; color:#92400e; padding:10px; border-radius:6px; margin-bottom:15px; font-size:12px; border:1px solid #fcd34d;">
                    💡 <strong>Entregas Parciales:</strong> Modifica la cantidad en la columna "A entregar hoy". Si el cliente se lleva solo una parte, el resto seguirá quedando pendiente en el sistema.
                </div>

                <table style="width:100%; border-collapse:collapse; font-size:14px; margin-bottom:20px;">
                    <thead><tr style="background:#f1f5f9;">
                        <th style="padding:10px; text-align:left;">Producto</th>
                        <th style="padding:10px; text-align:center;">Pendiente</th>
                        <th style="padding:10px; text-align:center; color:#1d4ed8;">A entregar hoy</th>
                    </tr></thead>
                    <tbody>${itemsHtml}</tbody>
                </table>
                
                <div style="display:flex; gap:10px;">
                    <button onclick="aplicarSalidaPendienteVentas('${s.id}')"
                            style="flex:2; padding:14px; background:#27ae60; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;">
                        ✅ Registrar Entrega e Imprimir Vale
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
    let entregadosHoy = [];
    let quedanPendientes = false;

    (s.items || []).forEach((item, index) => {
        const inputEl = document.getElementById(`entregar-${s.id}-${index}`);
        let cantAEntregar = inputEl ? parseInt(inputEl.value) : 0;
        
        if (cantAEntregar > 0) {
            const prod = productosActuales.find(p => String(p.id) === String(item.productoId));
            if (prod) {
                // Descuento de stock
                prod.stock = Math.max(0, (prod.stock || 0) - cantAEntregar);
                
                // Registro de movimiento de inventario
                registrarMovimientoInterno(prod.id, `Entrega - ${s.folioVenta}`, cantAEntregar, "salida");

                entregadosHoy.push({
                    nombre: item.nombre,
                    colorElegido: item.colorElegido || '',
                    cantidad: cantAEntregar
                });
                item.cantidad -= cantAEntregar;
            }
        }
        if (item.cantidad > 0) quedanPendientes = true;
    });

    if (entregadosHoy.length === 0) return alert("⚠️ No hay nada que entregar.");

    s.estatus = quedanPendientes ? "Parcial" : "Entregado";
    s.fechaUltimaEntrega = new Date().toLocaleDateString();

    StorageService.set("salidasPendientesVenta", salidas);
    StorageService.set("productos", productosActuales);

    document.querySelector('[data-modal="detalle-entrega"]')?.remove();
    
    // Imprimir Vale
    generarValeEntrega(s, entregadosHoy);
    renderEntregas();
}

// Función auxiliar para mantener limpio el historial
function registrarMovimientoInterno(id, concepto, cant, tipo) {
    const movs = StorageService.get("movimientosInventario", []);
    movs.push({
        id: Date.now(),
        productoId: id,
        tipo: tipo,
        cantidad: cant,
        concepto: concepto,
        fecha: Date.now()
    });
    StorageService.set("movimientosInventario", movs);
}
// ===== VALE DE ENTREGA TÉRMICO (80MM) =====
function generarValeEntrega(datosSalida, articulosEntregadosHoy) {
    const folio = datosSalida.folioVenta;
    const fechaImpresion = new Date().toLocaleString('es-MX', { hour12: true });

    let listaHTML = '';
    articulosEntregadosHoy.forEach(art => {
        listaHTML += `
            <div style="border-bottom: 1px dashed #ccc; padding: 6px 0;">
                <div style="display:flex; justify-content:space-between; font-size: 13px;">
                    <span style="font-weight:bold;">${art.cantidad}x</span>
                    <span style="flex:1; margin-left:8px; text-align:left;">${art.nombre}</span>
                </div>
                ${art.colorElegido ? `<small style="display:block; color:#555; margin-left:25px;">Color: ${art.colorElegido}</small>` : ''}
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
            font-family: 'Courier New', Courier, monospace; 
            width: 72mm; margin: 4mm auto; color: #000; background: #fff;
            line-height: 1.3; font-size: 12px;
        }
        .centro { text-align: center; }
        .negrita { font-weight: bold; }
        .separador { border-top: 2px dashed #000; margin: 12px 0; }
        .caja-legal { border: 1px solid #000; padding: 10px; margin: 15px 0; font-size: 10px; text-align: justify; line-height: 1.4; }
        .no-print { background: #eee; padding: 10px; text-align: center; margin-bottom: 10px; }
        @media print { .no-print { display: none; } }
    </style>
    </head>
    <body>
        <div class="no-print">
            <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR VALE</button>
        </div>

        <div class="centro">
            <div class="negrita" style="font-size:18px;">MI PUEBLITO</div>
            <div style="font-size:12px; margin-top:2px;">VALE DE SALIDA Y ENTREGA</div>
            <div style="font-size:10px; margin-top:2px;">${fechaImpresion}</div>
        </div>

        <div class="separador"></div>

        <div>
            <b>REF VENTA: ${folio}</b><br>
            CLIENTE: ${datosSalida.clienteNombre || 'Público en General'}<br>
            MÉTODO: ${datosSalida.metodoPago || '—'}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:11px; margin-bottom:8px;">MERCANCÍA ENTREGADA HOY:</div>
        <div>
            ${listaHTML}
        </div>

        <div class="caja-legal">
            <div class="centro negrita" style="margin-bottom:5px;">DECLARACIÓN DE CONFORMIDAD</div>
            Recibí de entera conformidad la mercancía descrita en la parte superior. Manifiesto que el producto ha sido revisado detalladamente frente a mí y se encuentra en <b>perfectas condiciones físicas</b>, sin raspaduras, manchas, roturas o defectos de fabricación visibles. Acepto que a partir de este momento la custodia, cuidado y traslado de los bienes corre por mi exclusiva cuenta.
        </div>

        <div style="margin-top:50px; text-align:center;">
            <div style="border-top: 1px solid #000; width: 85%; margin: 0 auto;"></div>
            <div class="negrita" style="font-size:11px; margin-top:5px;">FIRMA DEL CLIENTE</div>
        </div>

        <div style="margin-top:40px; text-align:center;">
            <div style="border-top: 1px solid #000; width: 60%; margin: 0 auto;"></div>
            <div style="font-size:10px; margin-top:5px;">ENTREGÓ (ALMACÉN/PISO)</div>
        </div>

        <div class="centro" style="margin-top:30px; font-size:9px;">
            *** Conserve este documento ***<br>
            Mueblería Mi Pueblito
        </div>
    </body>
    </html>`;

    const win = window.open('', '_blank');
    if(win){
        win.document.write(htmlVale);
        win.document.close();
        win.focus();
    } else {
        alert("⚠️ Habilita las ventanas emergentes para ver el Vale de Entrega.");
    }
}
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

    // 🧹 LIMPIEZA VISUAL: Filtramos los duplicados históricos para que no salgan en pantalla
    const foliosUnicos = new Set();
    filtrados = filtrados.filter(t => {
        if (foliosUnicos.has(t.folio)) {
            return false; // Ya lo vimos, lo ocultamos
        }
        foliosUnicos.add(t.folio);
        return true; // Es nuevo, lo mostramos
    });

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
        const fecha = t.fechaEmision ? new Date(t.fechaEmision)window.formatearFechaCortaMX : '—';
        const total = t.venta?.total || 0;
        const metodo = t.venta?.metodoPago || '—';
        const folioEsc = (t.folio || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += `<tr>
            <td><strong style="color:#1d4ed8;">${t.folio || '—'}</strong></td>
            <td>${t.cliente?.nombre || '—'}</td>
            <td>${fecha}</td>
            <td><strong>${dinero(total)}</strong></td>
            <td style="text-transform: uppercase;">${metodo}</td>
            <td style="text-align:center;">
                <button onclick="reimprimirTicketVenta('${folioEsc}')"
                        style="padding:6px 12px; background:#2563eb; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px; font-weight:bold;">
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
            ? new Date(ticket.fechaEmision)window.formatearFechaCortaMX
            : new Date()window.formatearFechaCortaMX,
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

// ============================================================
// TRADUCTORES DE MIGRACIÓN (CONECTADOS A FIREBASE)
// ============================================================
function procesarMigracionCXC_POS() {
    const raw = document.getElementById('jsonCuentasPorCobrarPOS').value.trim();
    if (!raw) return alert('⚠️ Pega el JSON primero');
    
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error("Los datos deben estar entre corchetes [ ]");
        
        let cxc = StorageService.get('cuentasPorCobrar', []);
        let pagares = StorageService.get('pagaresSistema', []);
        let clientesList = StorageService.get('clientes', []);
        let ventasReg = StorageService.get('ventasRegistradas', []);
        let agregadas = 0;

        data.forEach(item => {
            if (!item.nombre || item.saldoActual === undefined) return;
            
            const folio = item.folio || ("V-MIG-" + Math.floor(Math.random()*10000));
            const saldo = Number(item.saldoActual);
            const total = Number(item.total) || saldo;
            const enganche = Number(item.enganche) || 0;
            const periodicidad = item.periodicidad || 'semanal';
            const fechaVentaDate = item.fechaVenta ? new Date(item.fechaVenta) : new Date();
            const fechaVentaIso = fechaVentaDate.toISOString();
            const fechaVentaStr = fechaVentaDatewindow.formatearFechaCortaMX;
            const pagosRestantes = Number(item.pagosRestantes) || 1;

            let cli = clientesList.find(c => c.nombre.toLowerCase() === item.nombre.toLowerCase());
            let clienteId;
            if (!cli) {
                clienteId = Date.now() + Math.random();
                clientesList.push({
                    id: clienteId,
                    nombre: item.nombre,
                    telefono: item.telefono || "",
                    direccion: item.direccion || "",
                    fechaRegistro: fechaVentaStr
                });
            } else {
                clienteId = cli.id;
            }
            
            cxc.push({
                folio: folio,
                nombre: item.nombre,
                clienteId: clienteId,
                telefono: item.telefono || "",
                direccion: item.direccion || "",
                fechaVenta: fechaVentaIso,
                fecha: fechaVentaIso,
                totalContadoOriginal: total,
                engancheRecibido: enganche,
                saldoActual: saldo,
                saldoOriginal: saldo,
                metodo: "credito",
                plan: { abono: item.montoPorPago || (saldo/pagosRestantes), total: saldo, meses: item.meses || 1 },
                estado: saldo > 0 ? "Pendiente" : "Saldado",
                abonos: [],
                articulos: [{ nombre: "Saldo Migrado", cantidad: 1, precioContado: total }],
                totalMercancia: total,
                periodicidad: periodicidad
            });

            if (saldo > 0) {
                let diasIntervalo = periodicidad === "quincenal" ? 14 : periodicidad === "mensual" ? 30 : 7;
                let fechaPago = item.fechaPrimerPago ? new Date(item.fechaPrimerPago) : new Date(fechaVentaDate);
                if (!item.fechaPrimerPago) fechaPago.setDate(fechaPago.getDate() + diasIntervalo);

                const montoCuota = Number(item.montoPorPago) || (saldo / pagosRestantes);

                for (let i = 1; i <= pagosRestantes; i++) {
                    pagares.push({
                        id: Date.now() + Math.random() + i,
                        folio: folio,
                        numeroPagere: `${folio}-${i}/${pagosRestantes}`,
                        clienteNombre: item.nombre,
                        fechaEmision: fechaVentaIso,
                        fechaVencimiento: new Date(fechaPago).toISOString(),
                        monto: montoCuota,
                        estado: "Pendiente",
                        diasAtrasoActual: 0
                    });
                    fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
                }
            }

            ventasReg.push({
                folio: folio,
                fechaVenta: fechaVentaIso,
                fecha: fechaVentaStr,
                clienteId: clienteId,
                clienteNombre: item.nombre,
                total: total,
                enganche: enganche,
                saldoAFinanciar: saldo,
                metodoPago: "credito",
                articulos: [{ id: "MIG", nombre: "Saldo Migrado", cantidad: 1, precio: total }],
                vendedor: "Migración Masiva"
            });

            agregadas++;
        });

        if (agregadas > 0) {
            StorageService.set('cuentasPorCobrar', cxc);
            StorageService.set('pagaresSistema', pagares);
            StorageService.set('clientes', clientesList);
            StorageService.set('ventasRegistradas', ventasReg);
            
            window.clientes = clientesList; 

            alert(`✅ ¡Éxito! ${agregadas} registros inyectados. La base de datos y Firebase se actualizaron.`);
            document.getElementById('jsonCuentasPorCobrarPOS').value = "";
        } else {
            alert('⚠️ No se encontraron registros válidos.');
        }
    } catch(e) {
        alert('❌ Error en el formato JSON: ' + e.message);
    }
}

function procesarMigracionCXP_POS() {
    const raw = document.getElementById('jsonCuentasPorPagarPOS').value.trim();
    if (!raw) return alert('⚠️ Pega el JSON primero');
    
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error("Los datos deben estar entre corchetes [ ]");
        
        let cxp = StorageService.get('cuentasPorPagar', []);
        let agregadas = 0;

        data.forEach(item => {
            if (!item.proveedor || item.saldoPendiente === undefined) return;
            cxp.push({
                id: Date.now() + Math.random(),
                compraId: item.compraId || Date.now(),
                proveedor: item.proveedor,
                producto: item.producto || "Saldo Migrado",
                total: Number(item.total) || Number(item.saldoPendiente),
                saldoPendiente: Number(item.saldoPendiente),
                metodo: item.metodo || 'credito_proveedor',
                formaPagoTexto: item.formaPagoTexto || 'Migración Histórica',
                fecha: item.fecha || new Date()window.formatearFechaCortaMX,
                vencimiento: item.vencimiento || new Date()window.formatearFechaCortaMX
            });
            agregadas++;
        });

        if (agregadas > 0) {
            StorageService.set('cuentasPorPagar', cxp);
            alert(`✅ ${agregadas} cuentas de proveedores migradas con éxito.`);
            document.getElementById('jsonCuentasPorPagarPOS').value = "";
        } else {
            alert('⚠️ No se encontraron registros válidos.');
        }
    } catch(e) {
        alert('❌ Error en el formato JSON: ' + e.message);
    }
}

function procesarMigracionMSI_POS() {
    const raw = document.getElementById('jsonCuentasMSIPOS').value.trim();
    if (!raw) return alert('⚠️ Pega el JSON primero');
    
    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error("Los datos deben estar entre corchetes [ ]");
        
        let cuentasMSI = StorageService.get('cuentasMSI', []);
        let agregadas = 0;

        window.tarjetasConfig = StorageService.get("tarjetasConfig", []);

        for (let item of data) {
            if (!item.banco || !item.total || !item.meses) continue;

            const fechaCompraDate = item.fechaCompra ? new Date(item.fechaCompra) : new Date();
            const total = Number(item.total);
            const meses = Number(item.meses);
            const pagosRealizados = Number(item.pagosRealizados) || 0;

            const nombreBanco = item.banco.trim().toUpperCase();

            let calendario = [];
            if (typeof calcularCalendarioMSI === 'function') {
                calendario = calcularCalendarioMSI(fechaCompraDate, meses, nombreBanco);
            }

            if (calendario.length === 0) {
                alert(`⚠️ ALERTA: No pude calcular las fechas para el banco "${nombreBanco}".\n\n¿Ya registraste esta tarjeta en el menú "Bancos" con su día de corte?\n\nDeteniendo la migración para no generar errores. Resuelve el problema y vuelve a intentarlo.`);
                return; 
            }

            cuentasMSI.push({
                id: Date.now() + Math.random(),
                compraId: "MIG-" + Date.now(),
                banco: nombreBanco,
                producto: item.producto || "Compra Histórica MSI",
                total: total,
                meses: meses,
                cuotaMensual: total / meses,
                fechaCompra: fechaCompraDatewindow.formatearFechaCortaMX,
                calendario: calendario,
                pagosRealizados: pagosRealizados
            });
            agregadas++;
        }

        if (agregadas > 0) {
            StorageService.set('cuentasMSI', cuentasMSI);
            alert(`✅ ¡Éxito! ${agregadas} compras a MSI migradas. El calendario de pagos se generó automáticamente.`);
            document.getElementById('jsonCuentasMSIPOS').value = "";
        }
    } catch(e) {
        alert('❌ Error en el formato JSON: ' + e.message);
    }
}

// =====================================================================
// 🔒 MÓDULO DE AUDITORÍA CXC (MODIFICACIÓN DE VENTAS Y PAGARÉS)
// SOLO ADMINISTRADORES
// =====================================================================

function abrirAuditoriaCxC() {
    // 1. VALIDACIÓN DE SEGURIDAD ESTRICTA
    // Ajusta esta línea según cómo guardes al usuario en tu sistema
    const usuarioActual = StorageService.get("usuarioActual") || StorageService.get("sesionActiva") || { rol: "admin" }; 
    
    if (usuarioActual.rol !== "admin" && usuarioActual.rol !== "Administrador") {
        alert("⛔ ACCESO DENEGADO: Esta función es exclusiva para Administradores.");
        return;
    }

    // 2. CREACIÓN DEL MODAL
    const modalHTML = `
    <div data-modal="auditoria-cxc" style="position:fixed; inset:0; background:rgba(15,23,42,0.9); z-index:9999; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:12px; width:100%; max-width:900px; margin-top:20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #ef4444; padding-bottom:15px; margin-bottom:20px;">
                <div>
                    <h2 style="margin:0; color:#b91c1c; font-size:24px;">🛠️ Auditoría CxC: Edición de Ventas</h2>
                    <p style="margin:0; color:#64748b; font-size:14px;">Modificación profunda de fechas y pagarés (Uso exclusivo Admin)</p>
                </div>
                <button onclick="document.querySelector('[data-modal=\\'auditoria-cxc\\']').remove()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; color:#475569;">✕ Cerrar</button>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:25px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <input type="text" id="auditFolioInput" placeholder="Ej. V-123456" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:16px;">
                <button onclick="buscarVentaAuditoria()" style="background:#0f172a; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">🔍 Buscar Folio</button>
            </div>

            <div id="auditContenedorDatos">
                <div style="text-align:center; padding:40px; color:#94a3b8;">Ingresa un folio para comenzar la auditoría.</div>
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
        document.getElementById("auditContenedorDatos").innerHTML = `<div style="padding:20px; background:#fef2f2; color:#b91c1c; border-radius:8px; border:1px solid #fecaca;">❌ No se encontró ninguna cuenta con el folio: ${folio}</div>`;
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

function dibujarFormularioAuditoria() {
    const cuenta = window._auditCuentaActual;
    const pagares = window._auditPagaresActuales;

    // Formatear la fecha de la venta para el input type="date"
    let fechaVentaDate = "";
    if(cuenta.fechaVenta) {
        try { fechaVentaDate = new Date(cuenta.fechaVenta).toISOString().split('T')[0]; } catch(e) {}
    }

    let pagaresHTML = pagares.map((p, index) => {
        let fechaVencDate = "";
        if(p.fechaVencimiento) {
            try { fechaVencDate = new Date(p.fechaVencimiento).toISOString().split('T')[0]; } catch(e) {}
        }

        return `
        <tr style="background:${p.estado === 'Pagado' ? '#f0fdf4' : '#fff'}; border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px;"><input type="text" value="${p.numeroPagere || ''}" onchange="window._auditPagaresActuales[${index}].numeroPagere = this.value" style="width:100px; padding:6px; border:1px solid #cbd5e1; border-radius:4px;"></td>
            <td style="padding:8px;"><input type="date" value="${fechaVencDate}" onchange="window._auditPagaresActuales[${index}].fechaVencimiento = this.value + 'T12:00:00Z'" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px;"></td>
            <td style="padding:8px;"><input type="number" step="0.01" value="${p.monto || 0}" onchange="window._auditPagaresActuales[${index}].monto = Number(this.value)" style="width:100px; padding:6px; border:1px solid #cbd5e1; border-radius:4px;"></td>
            <td style="padding:8px;">
                <select onchange="window._auditPagaresActuales[${index}].estado = this.value" style="padding:6px; border:1px solid #cbd5e1; border-radius:4px;">
                    <option value="Pendiente" ${p.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="Pagado" ${p.estado === 'Pagado' ? 'selected' : ''}>Pagado</option>
                    <option value="Cancelado" ${p.estado === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
                </select>
            </td>
            <td style="padding:8px; text-align:center;">
                <button onclick="eliminarPagareAuditoria(${index})" style="background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;" title="Eliminar Pagaré">🗑️</button>
            </td>
        </tr>`;
    }).join('');

    const html = `
    <div style="background:#f8fafc; padding:20px; border-radius:8px; margin-bottom:20px; border:1px solid #e2e8f0;">
        <h3 style="margin-top:0; color:#334155; font-size:16px;">👤 Datos Generales de la Cuenta</h3>
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

    <div style="background:#fff; padding:20px; border-radius:8px; border:1px solid #e2e8f0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0; color:#334155; font-size:16px;">📝 Tabla de Amortización (Pagarés)</h3>
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
            ⚠️ Guardar Cambios en Base de Datos
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
        fechaVencimiento: new Date().toISOString(),
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
    if(!confirm("⚠️ ADVERTENCIA: Estás a punto de reescribir los datos de esta venta y sus pagarés. ¿Continuar?")) return;

    const folio = window._auditCuentaActual.folio;
    
    // 1. Obtener bases de datos actuales
    let cuentas = StorageService.get("cuentasPorCobrar", []);
    let pagaresSistema = StorageService.get("pagaresSistema", []);

    // 2. Actualizar la cuenta (Fecha de Venta)
    const indexCuenta = cuentas.findIndex(c => String(c.folio).toUpperCase() === String(folio).toUpperCase());
    if(indexCuenta !== -1) {
        const nuevaFechaVenta = document.getElementById("auditFechaVenta").value;
        if(nuevaFechaVenta) {
            cuentas[indexCuenta].fechaVenta = nuevaFechaVenta + "T10:00:00Z";
        }
    }

    // 3. Eliminar todos los pagarés viejos de este folio
    pagaresSistema = pagaresSistema.filter(p => String(p.folio).toUpperCase() !== String(folio).toUpperCase());

    // 4. Inyectar los pagarés nuevos/modificados
    pagaresSistema = pagaresSistema.concat(window._auditPagaresActuales);

    // 5. Guardar en Base de Datos
    StorageService.set("cuentasPorCobrar", cuentas);
    StorageService.set("pagaresSistema", pagaresSistema);

    alert("✅ Cambios de auditoría guardados exitosamente. El Estado de Cuenta ha sido actualizado.");
    
    // Cerrar modal y refrescar (si estás en la vista de cobranza)
    document.querySelector('[data-modal="auditoria-cxc"]').remove();
    if(typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
}
// ===== GENERADOR DE VALE DE ENTREGA (PARA ENTREGAS TOTALES O PARCIALES) =====
function generarValeEntrega(datosVenta, articulosAEntregar) {
    const folio = datosVenta.folio;
    const fechaEntrega = new Date().toLocaleDateString('es-MX', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let listaEntregada = '';
    articulosAEntregar.forEach(art => {
        listaEntregada += `
            <div style="border-bottom: 1px solid #eee; padding: 5px 0;">
                <div style="display:flex; justify-content:space-between; font-size: 13px;">
                    <span><b>${art.cantidad || 1}x</b> ${art.nombre}</span>
                </div>
                ${art.colorElegido ? `<small style="color:#555;">🎨 Color: ${art.colorElegido}</small>` : ''}
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
        .no-print { background: #f0f0f0; padding: 10px; text-align: center; margin-bottom: 10px; }
        @media print { .no-print { display: none; } }
    </style>
    </head>
    <body>
        <div class="no-print">
            <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR COMPROBANTE</button>
        </div>

        <div class="centro">
            <div class="negrita" style="font-size:16px;">MI PUEBLITO</div>
            <div class="negrita">COMPROBANTE DE ENTREGA</div>
            <div style="font-size:10px;">${fechaEntrega}</div>
        </div>

        <div class="separador"></div>

        <div>
            <b>VENTA REF: ${folio}</b><br>
            CLIENTE: ${datosVenta.cliente.nombre}<br>
            DIRECCIÓN: ${datosVenta.cliente.direccion || 'Entrega en tienda'}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:11px;">MERCANCÍA QUE RECIBE:</div>
        <div style="margin-top:10px;">
            ${listaEntregada}
        </div>

        <div class="caja-conformidad">
            <b>DECLARACIÓN DE CONFORMIDAD:</b><br>
            Recibí de entera conformidad la mercancía arriba descrita. Manifiesto que el producto ha sido revisado a detalle y se encuentra en <b>perfectas condiciones físicas</b>, sin raspaduras, golpes o defectos de fabricación visibles. Acepto que a partir de este momento la custodia y cuidado del mueble corre por mi cuenta.
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
            *** Documento para control de inventario ***<br>
            Mueblería Mi Pueblito
        </div>
    </body>
    </html>`;

    const win = window.open('', '_blank');
    win.document.write(htmlVale);
    win.document.close();
}

// Exponer la función globalmente para poder llamarla desde un botón
window.abrirAuditoriaCxC = abrirAuditoriaCxC;

// ============================================================
// EXPOSICIÓN GLOBAL PARA QUE HTML Y EL MENÚ ENCUENTREN LAS FUNCIONES
// ============================================================
window.renderCarrito = renderCarrito;
window.agregarAlCarrito = agregarAlCarrito;
window.agregarAlCarritoDesdeModal = agregarAlCarritoDesdeModal;
window.eliminarDelCarrito = eliminarDelCarrito;
window.actualizarCantidadCarrito = actualizarCantidadCarrito;
window.cambiarPrecioCarrito = cambiarPrecioCarrito;
window.actualizarColorCarrito = actualizarColorCarrito;
window.actualizarUbicacionCarrito = actualizarUbicacionCarrito;
window.actualizarInterfazPago = actualizarInterfazPago;
window.seleccionarPlan = seleccionarPlan;
window.confirmarVentaFinal = confirmarVentaFinal;
window.cancelarYVolverAlCarrito = cancelarYVolverAlCarrito;
window.setDecisionInventario = setDecisionInventario;
window.cambiarColorInventario = cambiarColorInventario;
window.cambiarUbicacionInventario = cambiarUbicacionInventario;
window.mostrarDialogoInventario = mostrarDialogoInventario;
window.abrirDetalleEntrega = abrirDetalleEntrega;
window.renderEntregas = renderEntregas;
window.procesarMigracionMSI_POS = procesarMigracionMSI_POS;
window.procesarMigracionCXC_POS = procesarMigracionCXC_POS;
window.procesarMigracionCXP_POS = procesarMigracionCXP_POS;
window.renderReimprimirVenta = renderReimprimirVenta;
window.reimprimirTicketVenta = reimprimirTicketVenta;
window.limpiarFiltrosReimpresion = limpiarFiltrosReimpresion;