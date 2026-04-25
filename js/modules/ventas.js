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

    // 👉 Detectar admin
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

        html += `
            <tr>
                <td><strong>${p.nombre}</strong></td>

                <td style="text-align:center; font-weight:bold; color:${colorStock};">
                    ${textoStock}
                </td>

                <td style="text-align:center;">
                    <input type="number" min="1" max="99" value="${cantidad}" 
                        onchange="actualizarCantidadCarrito(${index}, this.value)"
                        style="width:50px; padding:6px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                </td>

                <!-- 🔥 PRECIO EDITABLE SOLO ADMIN -->
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

                <!-- CUENTA RECEPTORA (transferencia o enganche con transferencia) -->
                <div id="divCuentaReceptora" class="oculto" style="margin-bottom:12px;">
                    <label id="lblCuentaReceptora" style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:4px;">🏦 Cuenta receptora</label>
                    <select id="selCuentaReceptora" style="width:100%; padding:8px; border:1px solid #d1d5db; border-radius:6px; font-size:13px;"></select>
                </div>

                <!-- MODO ENGANCHE: efectivo vs transferencia (crédito/apartado con enganche) -->
                <div id="divModoEnganche" class="oculto" style="margin-bottom:12px;">
                    <label style="font-size:12px; font-weight:bold; color:#374151; display:block; margin-bottom:6px;">💰 ¿Cómo se recibe el enganche?</label>
                    <div style="display:flex; gap:8px;">
                        <label style="flex:1; cursor:pointer;">
                            <input type="radio" name="modoEnganche" value="efectivo" checked onchange="actualizarInterfazPago()">
                            <div id="btnModoEfectivo" style="margin-top:4px; padding:8px; border:2px solid #27ae60; border-radius:6px; text-align:center; font-size:13px; font-weight:bold; color:#166534; background:#dcfce7;">
                                💵 Efectivo
                            </div>
                        </label>
                        <label style="flex:1; cursor:pointer;">
                            <input type="radio" name="modoEnganche" value="transferencia" onchange="actualizarInterfazPago()">
                            <div id="btnModoTransferencia" style="margin-top:4px; padding:8px; border:2px solid #d1d5db; border-radius:6px; text-align:center; font-size:13px; font-weight:bold; color:#4a5568; background:#f9fafb;">
                                🏦 Transferencia
                            </div>
                        </label>
                    </div>
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
                           value="${new Date().toISOString().substring(0,10)}">
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
    // En tu código, el ID del enganche es "numEnganche"
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

    // ── CUENTA RECEPTORA / MODO DE COBRO ─────────────────────────────────────────
    const divCuenta = document.getElementById("divCuentaReceptora");
    const divModoEnganche = document.getElementById("divModoEnganche");
    const engancheVal = parseFloat(document.getElementById("numEnganche")?.value) || 0;
    const cuentasDebito = tarjetasConfig.filter(t => t.tipo === "debito");

    // Ocultar todo por defecto y limpiar
    if (divCuenta) divCuenta.classList.add("oculto");
    if (divModoEnganche) divModoEnganche.classList.add("oculto");

    if (metodo === "contado") {
        // Contado siempre va a caja/efectivo, no se pregunta
        // (nada que mostrar)

    } else if (metodo === "transferencia") {
        // Transferencia: preguntar a qué cuenta débito entra el dinero
        if (divCuenta) {
            divCuenta.classList.remove("oculto");
            const lbl = document.getElementById("lblCuentaReceptora");
            if (lbl) lbl.textContent = "🏦 ¿A qué cuenta ingresa la transferencia?";
            const optsHTML = cuentasDebito.length > 0
                ? cuentasDebito.map(c => `<option value="${c.banco}">🏦 ${c.banco}</option>`).join('')
                : '<option value="cuenta_debito">-- Registra cuentas en Bancos --</option>';
            document.getElementById("selCuentaReceptora").innerHTML = optsHTML;
        }

    } else if ((metodo === "credito" || metodo === "apartado") && engancheVal > 0) {
        // Crédito/Apartado con enganche: preguntar si el enganche entra en efectivo o transferencia
        if (divModoEnganche) divModoEnganche.classList.remove("oculto");

        // Sincronizar estilos de botones de modo según radio seleccionado
        const modoSeleccionado = document.querySelector('input[name="modoEnganche"]:checked')?.value || "efectivo";
        const btnEfec = document.getElementById("btnModoEfectivo");
        const btnTrans = document.getElementById("btnModoTransferencia");
        if (btnEfec && btnTrans) {
            if (modoSeleccionado === "efectivo") {
                btnEfec.style.borderColor = "#27ae60"; btnEfec.style.background = "#dcfce7"; btnEfec.style.color = "#166534";
                btnTrans.style.borderColor = "#d1d5db"; btnTrans.style.background = "#f9fafb"; btnTrans.style.color = "#4a5568";
            } else {
                btnEfec.style.borderColor = "#d1d5db"; btnEfec.style.background = "#f9fafb"; btnEfec.style.color = "#4a5568";
                btnTrans.style.borderColor = "#3b82f6"; btnTrans.style.background = "#dbeafe"; btnTrans.style.color = "#1e40af";
            }
        }

        if (modoSeleccionado === "transferencia") {
            // Mostrar selector de cuenta débito
            if (divCuenta) {
                divCuenta.classList.remove("oculto");
                const lbl = document.getElementById("lblCuentaReceptora");
                if (lbl) lbl.textContent = "🏦 ¿A qué cuenta ingresa el enganche?";
                const optsHTML = cuentasDebito.length > 0
                    ? cuentasDebito.map(c => `<option value="${c.banco}">🏦 ${c.banco}</option>`).join('')
                    : '<option value="cuenta_debito">-- Registra cuentas en Bancos --</option>';
                document.getElementById("selCuentaReceptora").innerHTML = optsHTML;
            }
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
    // plan se guarda en seleccionarPlan()
    window._estadoPago.fechaVenta = document.getElementById("inputFechaVenta")?.value || new Date().toISOString().substring(0,10);
}

function seleccionarPlan(index) {
    plazoSeleccionado = index;
    window._estadoPago.planIndex = index;

    try {
        // 1. Calculamos el total real del carrito ahora mismo
        const totalCarrito = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
        
        // 2. Obtenemos el enganche y la periodicidad de la pantalla
        const enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        
        // 3. Calculamos el saldo (Lo que realmente se va a pagar a crédito)
        const saldo = totalCarrito - enganche;

        // 4. Generamos los planes con el CalculatorService
        // IMPORTANTE: Usamos el saldo real. Si el saldo es 0 o menor, usamos el total.
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo > 0 ? saldo : totalCarrito, periodicidad);
        
        // 5. Guardamos el plan elegido en la libreta
        if (planes && planes[index]) {
            window._estadoPago.plan = planes[index];
            console.log("✅ Plan guardado con éxito:", window._estadoPago.plan);
        }
    } catch(e) {
        console.error("❌ Error al guardar el plan:", e);
    }

    // Refrescamos la pantalla para que se vea el botón seleccionado
    actualizarInterfazPago();
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

    // Leer desde _estadoPago (más confiable que el DOM del carrito oculto)
    const metodoPago = window._estadoPago?.metodo
        || document.getElementById("selMetodoPago")?.value;
    console.log("Método de pago:", metodoPago, "| Estado guardado:", window._estadoPago);

    if (!metodoPago) {
        alert("⚠️ Regresa al carrito y selecciona un método de pago.");
        return;
    }

    // ==== FIX AUDITORIA: Aplicar descuentos antes del cálculo de totales ====
    let descuentoAplicado = 0;
    if (typeof aplicarDescuentosAlCarrito === "function") {
        descuentoAplicado = aplicarDescuentosAlCarrito(carrito, clienteSeleccionado.id) || 0;
    }
    // ========================================================================

    const totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    const totalConDescuento = totalContado - descuentoAplicado; // actualizado

    console.log("Total contado:", totalContado, "| Descuento aplicado:", descuentoAplicado, "| Total con descuento:", totalConDescuento);

    let enganche = window._estadoPago?.enganche
        ?? parseFloat(document.getElementById("numEnganche")?.value) ?? 0;
    if (enganche < 0) enganche = 0;

    if (enganche > totalConDescuento) {
        alert("⚠️ El enganche no puede ser mayor al total.");
        return;
    }

    const saldoAFinanciar = totalConDescuento - enganche;
    let planElegido = null;

    if (metodoPago === "credito") {
        const periodicidad = window._estadoPago?.periodicidad
            || document.getElementById("selPeriodicidad")?.value || "semanal";
        console.log("Periodicidad:", periodicidad);

        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
        // Usar planIndex guardado en estado, luego plazoSeleccionado global, luego 0
        const planIdx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;
        console.log("Plan index:", planIdx, "| plazoSeleccionado global:", plazoSeleccionado);

        if (planIdx === null || planIdx === undefined || planIdx < 0 || planIdx >= planes.length) {
            alert("⚠️ Selecciona un plazo de crédito en el carrito antes de continuar.");
            return;
        }

        planElegido = planes[planIdx];
        // Sincronizar el índice global
        plazoSeleccionado = planIdx;

        if (!planElegido || planElegido.abono === 0) {
            alert("⚠️ Plan de crédito inválido. Regresa al carrito y vuelve a seleccionar el plazo.");
            return;
        }

        // Guardar el plan en estado
        window._estadoPago.plan = planElegido;
        window._estadoPago.periodicidad = periodicidad;
        console.log("Plan elegido:", planElegido);
    }

    console.log("✅ Todos los datos validados. Mostrando resumen...");
    // Capture selected vendor from cart view
    const selVnd = document.getElementById("selVendedor");
    if (selVnd && selVnd.value) {
        const vendedores = StorageService.get("vendedores", []);
        _vendedorSeleccionado = vendedores.find(v => String(v.id) === String(selVnd.value)) || null;
    } else {
        _vendedorSeleccionado = null;
    }

    // ==== FIX AUDITORIA: Pasa descuento aplicado al resumen ====
    mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, descuentoAplicado, totalConDescuento);
}

// Cambia la firma para recibir y mostrar descuento
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
        // === RECÁLCULO BLINDADO (Ignora datos corruptos o ceros de otras funciones) ===
        
        // 1. Obtenemos el total y el enganche reales
        const totalCarrito = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
        const engancheReal = window._estadoPago?.enganche || enganche || 0;
        const periodicidadResumen = window._estadoPago?.periodicidad || "semanal";
        
        // 2. Calculamos el saldo. 
        // IMPORTANTE: Si el saldo da 0 o negativo, usamos el total base para que los pagarés no salgan en $0.00
        let saldo = totalCarrito - engancheReal;
        let saldoBase = saldo > 0 ? saldo : totalCarrito;

        // 3. Generamos los planes matemáticos frescos aquí mismo
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoBase, periodicidadResumen);
        
        // 4. Recuperamos exactamente el botón (índice) que el usuario presionó
        let idx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;
        if (idx < 0 || idx >= planes.length) idx = 0;
        
        let plan = planes[idx];

        // Seguro anti-ceros final
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
        
        // Lo dejamos listo para la base de datos
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

    // Para métodos no-crédito usar planElegido (null); para crédito
    // se sobreescribirá abajo con el plan recalculado.
    _planElegidoPendiente = planElegido;
    document.querySelector('[data-modal="resumen-venta"]')?.remove();

    // ==== FIX AUDITORIA: Mostrar el descuento si fue aplicado ====
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
                <button onclick="procesarVentaConInventario('${metodoPago}', ${totalConDescuento ?? totalContado}, ${enganche}, ${saldoAFinanciar})"
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
    if (typeof acumularPuntosCliente === "function" && clienteSeleccionado) {
        acumularPuntosCliente(clienteSeleccionado.id, totalContado);
    }
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
        const prod = productos.find(p => String(p.id) === String(item.id));
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
    // 1. Lógica del plan (ya la tienes)
    let planElegido = _planElegidoPendiente;
    if (metodoPago === "credito") {
        if (!planElegido || !planElegido.abono || planElegido.abono === 0) {
            const periodicidad = window._estadoPago?.periodicidad
                || document.getElementById("selPeriodicidad")?.value || "semanal";
            const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
            const planIdx = window._estadoPago?.planIndex ?? plazoSeleccionado ?? 0;
            const safeIdx = (planIdx >= 0 && planIdx < planes.length) ? planIdx : 0;
            planElegido = planes[safeIdx];
            if (!planElegido || !planElegido.abono || planElegido.abono === 0) {
                planElegido = planes.find(p => p.abono > 0) || planes[0];
            }
        }
    }

    // --- NUEVO: CÁLCULO DEL IMPORTE DE VENTA CORRECTO ---
    // Si es crédito, sumamos Enganche + Total de Pagarés (con intereses). 
    // Si no, usamos el precio de contado normal.
    let montoVentaFinal = totalContado;
    if (metodoPago === "credito" && planElegido) {
        montoVentaFinal = enganche + (planElegido.total || 0);
    }
    // ---------------------------------------------------

    const folioVenta = "V-" + Date.now().toString().slice(-6);

    // Lógica de fechas (ya la tienes)
    const inputFechaEl = document.getElementById("inputFechaVenta");
    const fechaGuardada = window._estadoPago?.fechaVenta;
    let fechaVentaDate;
    if (inputFechaEl && inputFechaEl.value) {
        const [anio, mes, dia] = inputFechaEl.value.split("-").map(Number);
        fechaVentaDate = new Date(anio, mes - 1, dia, 12, 0, 0);
    } else if (fechaGuardada) {
        const [anio, mes, dia] = fechaGuardada.split("-").map(Number);
        fechaVentaDate = new Date(anio, mes - 1, dia, 12, 0, 0);
    } else {
        fechaVentaDate = new Date();
    }
    const fechaHoy = fechaVentaDate.toLocaleDateString("es-MX");
    const fechaVentaIso = fechaVentaDate.toISOString();

    let productosAEntregar = [];
    let productosAPendiente = [];

    carrito.forEach(item => {
        const prod = productos.find(prod => String(prod.id) === String(p.id));
        if (!prod) return;
        const decision = decisionesInventario[item.id];
        const tieneStock = (prod.stock || 0) >= (item.cantidad || 1);
        if (tieneStock && decision && decision.entregar) {
            productosAEntregar.push({ item, prod });
        } else {
            productosAPendiente.push({ item, prod });
        }
    });

    // IMPORTANTE: Ahora pasamos "montoVentaFinal" en lugar de "totalContado"
    procesarVentaFinal(
        metodoPago, 
        montoVentaFinal, // <--- Cambio aquí
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

    // ── GUARD: recalcular totalContado desde el carrito si llega 0 / NaN ────
    if (!totalContado || isNaN(totalContado) || totalContado <= 0) {
        totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    }
    // ──────────────────────────────────────────────────────────────────────────

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
    // Determinar cuenta receptora según método de pago
    let cuentaReceptora;
    if (metodoPago === "contado") {
        cuentaReceptora = "efectivo"; // Contado siempre va a caja
    } else if (metodoPago === "transferencia") {
        cuentaReceptora = document.getElementById("selCuentaReceptora")?.value || "cuenta_debito";
    } else {
        // Crédito/Apartado con enganche: verificar si fue efectivo o transferencia
        const modoEnganche = document.querySelector('input[name="modoEnganche"]:checked')?.value || "efectivo";
        cuentaReceptora = modoEnganche === "transferencia"
            ? (document.getElementById("selCuentaReceptora")?.value || "cuenta_debito")
            : "efectivo";
    }

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

        // Calcular y guardar los saldos requeridos para cada plan posible
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
            const periodicidad = window._estadoPago?.periodicidad
                || document.getElementById("selPeriodicidad")?.value || "semanal";
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

    // REGISTRAR COMISIÓN DEL VENDEDOR
    if (_vendedorSeleccionado) {
        registrarComisionVenta(folioVenta, totalContado, _vendedorSeleccionado.id);
    }

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
    _vendedorSeleccionado = null;
    if (!StorageService.set("carrito", carrito)) {
        console.error("❌ Error limpiando carrito");
    }
    actualizarContadorCarrito();

    alert(`✅ VENTA REGISTRADA\n\nFolio: ${folioVenta}\nCliente: ${datosVenta.cliente.nombre}\nTotal: ${dinero(datosVenta.total)}`);
    navA('tienda');
}
function generarLeyendaPagare(datosVenta, totalAPagar, esCompacta = false) {
    const cliente = datosVenta.cliente.nombre || "________________";
    const fecha = datosVenta.fecha;
    const lugar = "Xalapa, Veracruz";

    if (esCompacta) {
        return `PAGARÉ: Yo ${cliente} me obligo a pagar a la orden de Roberto Escobedo Vega la cantidad de ${dinero(totalAPagar)} conforme al calendario de pagos; incumplimiento genera interés moratorio del 2% mensual; firmado  en Santiago Cuaula Tlaxcala el ${fecha}.`;
    }

    return `PAGARÉ: Yo ${cliente} reconozco deber y me obligo incondicionalmente a pagar a la orden de Roberto Escobedo Vega la cantidad de ${dinero(totalAPagar)}, correspondiente al crédito otorgado, misma que cubriré en las fechas y montos establecidos en el calendario de pagos adjunto; en caso de incumplimiento total o parcial, se generarán intereses moratorios del 2% mensual sobre saldos insolutos; este pagaré se suscribe en Santiago Cuaula Tlaxcala con fecha ${fecha}, obligándome a cumplir en el domicilio del acreedor y sometiéndome para su interpretación y cumplimiento a la jurisdicción de los tribunales del domicilio del acreedor, renunciando a cualquier otro fuero que pudiera corresponderme.`;
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
                    <td class="celda-llenar" style="padding: 6px;"></td>
                    <td class="celda-llenar" style="padding: 6px;"></td>
                    <td class="celda-llenar" style="padding: 6px;"></td>
                </tr>
            `;
        });
    }

    // Tabla de resumen de planes
    // SIEMPRE calcular saldoParaPlanes como suma de precios de contado de los productos menos el enganche
    let saldoParaPlanes = (datosVenta.articulos || []).reduce(
        (sum, a) => sum + (a.precioContado || 0) * (a.cantidad || 1), 0
    ) - (datosVenta.enganche || 0);
    if (saldoParaPlanes < 0) saldoParaPlanes = 0;
    // Usar la periodicidad real de la venta, no siempre semanal
    const periodicidadTicket = datosVenta.periodicidad || window._estadoPago?.periodicidad || "semanal";
    const planesDisponibles = CalculatorService.calcularCreditoConPeriodicidad
        ? CalculatorService.calcularCreditoConPeriodicidad(saldoParaPlanes, periodicidadTicket)
        : CalculatorService.calcularCredito(saldoParaPlanes);
    const textoPeriodo = periodicidadTicket === "quincenal" ? "/quin" : periodicidadTicket === "mensual" ? "/mes" : "/sem";
    let tablaPlanes = '';
    planesDisponibles.forEach(plan => {
        const textoMeses = plan.meses === 1 ? `${plan.meses} MES (Contado)` : `${plan.meses} MESES`;
        const textoInteres = plan.meses === 1 ? '(Sin interés)' : `(${plan.pagos} pagos${textoPeriodo})`;
        const montoMostrar = plan.meses === 1 ? dinero(saldoParaPlanes) : `${dinero(plan.abono)}${textoPeriodo}`;
        const totalMostrar = plan.meses === 1 ? dinero(saldoParaPlanes) : dinero(plan.total);
        tablaPlanes += `
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">
                <strong>${textoMeses}</strong><br>
                ${montoMostrar}<br>
                <small style="color:#555;">Total: ${totalMostrar}</small><br>
                <small>${textoInteres}</small>
            </td>
        `;
    });

    const filasPagares = tablaPagares.split('</tr>').filter(f => f.trim());
const esDobleColumna = datosVenta.metodo === "credito" && datosVenta.plan && filasPagares.length > 12;

function construirTablaPagares(filas) {
    return `
    <table class="tabla-pagares">
        <thead>
            <tr>
                <th>#</th>
                <th>VENCIMIENTO</th>
                <th>IMPORTE</th>
                <th>FECHA PAGO</th>
                <th>PAGO</th>
                <th>SALDO</th>
            </tr>
        </thead>
        <tbody>
            ${filas.join('</tr>')}
        </tbody>
    </table>`;
}

let pagaresHTML = '';

if (esDobleColumna) {
    const mitad = Math.ceil(filasPagares.length / 2);

    const col1 = filasPagares.slice(0, mitad);
    const col2 = filasPagares.slice(mitad);

    pagaresHTML = `
    <div class="pagares-doble">
        ${construirTablaPagares(col1)}
        ${construirTablaPagares(col2)}
    </div>`;
} else {
    pagaresHTML = construirTablaPagares(filasPagares);
}


const ticketHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">

<style>
@page { size: Letter landscape; margin: 10mm; }

body {
    font-family: 'Segoe UI', Arial, sans-serif;
    margin: 0;
    color: #1f2937;
}

.ticket {
    display: flex;
    gap: 15px;
}

/* IZQUIERDA */
.izq {
    width: 30%;
    border-right: 2px dashed #d1d5db;
    padding-right: 10px;
    display: flex;
    flex-direction: column;
}

.logo {
    text-align: center;
    margin-bottom: 10px;
}

.logo img {
    width: 70px;
    height: 70px;
    object-fit: contain;
}

.titulo {
    text-align: center;
    font-weight: bold;
    color: #1e3a8a;
}

.box {
    border: 1px solid #e5e7eb;
    background: #f9fafb;
    padding: 8px;
    border-radius: 6px;
    margin-bottom: 8px;
    font-size: 11px;
}

.total {
    border: 2px solid #16a34a;
    text-align: center;
    padding: 10px;
    border-radius: 6px;
    margin-top: auto;
}

.total strong {
    font-size: 24px;
    color: #16a34a;
}

.firma {
    margin-top: 20px;
    text-align: center;
    font-size: 10px;
}

/* DERECHA */
.der {
    width: 70%;
}

h3 {
    font-size: 13px;
    margin: 8px 0;
    color: #1e3a8a;
}

/* TABLAS */
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10px;
}

th {
    background: #1e3a8a;
    color: white;
    padding: 6px;
}

td {
    padding: 5px;
    border-bottom: 1px solid #e5e7eb;
}

/* PAGARES DOBLE */
.pagares-doble {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

/* CELDAS VACIAS PARA LLENAR */
td.celda-llenar {
    border-bottom: 1px solid #000;
}

/* PLANES */
.planes td {
    border: 1px solid #e5e7eb;
    text-align: center;
    padding: 6px;
}

/* LEGAL */
.legal {
    font-size: 8px;
    margin-top: 10px;
    line-height: 1.4;
    border-top: 1px solid #ddd;
    padding-top: 6px;
}
</style>
</head>

<body>

<div class="ticket">

<!-- IZQUIERDA -->
<div class="izq">

<div class="logo">
    <img src="img/logo.png" onerror="this.style.display='none'">
</div>

<div class="titulo">
MUEBLERÍA MI PUEBLITO<br>
<small>Folio: ${folio}</small><br>
<small>${fechaActual}</small>
</div>

<div class="box">
<strong>CLIENTE</strong><br>
${datosVenta.cliente.nombre}<br>
${datosVenta.cliente.telefono || ''}<br>
${datosVenta.cliente.direccion || ''}
</div>

<div class="box">
<strong>RESUMEN</strong><br>
Método: ${datosVenta.metodo}<br>
Enganche: ${dinero(datosVenta.enganche || 0)}<br>
Saldo: ${dinero(datosVenta.total - (datosVenta.enganche || 0))}
</div>

<div class="total">
TOTAL<br>
<strong>${dinero(datosVenta.total)}</strong>
</div>

<div class="firma">
_________________________<br>
FIRMA CLIENTE
</div>

</div>

<!-- DERECHA -->
<div class="der">

<h3>PRODUCTOS</h3>
<table>
<thead>
<tr>
<th>CANT</th>
<th>DESCRIPCIÓN</th>
<th>P. UNIT</th>
<th>SUBTOTAL</th>
</tr>
</thead>
<tbody>
${tablaProductos}
</tbody>
</table>

${datosVenta.metodo === "credito" ? `
<h3>CALENDARIO DE PAGARÉS</h3>

${pagaresHTML}

` : ''}

<h3>PLANES DISPONIBLES</h3>
<table class="planes">
<tr>
${tablaPlanes}
</tr>
</table>

<div class="legal">
${generarLeyendaPagare(datosVenta, totalAPagar, filasPagares.length > 18)}

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
        vendedorId: _vendedorSeleccionado ? _vendedorSeleccionado.id : null,
        vendedorNombre: _vendedorSeleccionado ? _vendedorSeleccionado.nombre : null,
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
