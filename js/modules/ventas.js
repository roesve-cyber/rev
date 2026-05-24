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
    plan: null,          // objeto completo del plan elegido
    apartadoFechaCompromiso: "",
    apartadoCondiciones: ""
};

function _escapeHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _fechaInputDesdeHoy(dias = 30) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
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
        if ((Number(prod.stock) || 0) < cant) return;

        if (Array.isArray(prod.variantes) && prod.variantes.length > 0) {
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
            if (restante > 0) {
                prod.variantes.forEach(v => {
                    if (restante > 0 && Number(v.stock) > 0) {
                        const deducir = Math.min(Number(v.stock), restante);
                        v.stock -= deducir;
                        restante -= deducir;
                    }
                });
            }
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

                <div id="divCondicionesApartado" class="oculto" style="margin-bottom:12px; padding:12px; background:#fffbeb; border:1px solid #fcd34d; border-radius:8px;">
                    <label style="font-size:12px; font-weight:bold; color:#92400e; display:block; margin-bottom:4px;">📅 Fecha compromiso de liquidación</label>
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
    const inputFechaDOM = document.getElementById("inputFechaVenta");
    if (inputFechaDOM && inputFechaDOM.value) {
        window._estadoPago.fechaVenta = inputFechaDOM.value;
    }
    
    // Guardamos la caja seleccionada en nuestra libreta de estado temporal
    const selCaja = document.getElementById("cuentaReceptora_venta");
    window._estadoPago.cuentaReceptora = selCaja ? selCaja.value : "efectivo";
    window._estadoPago.etiquetaCuenta = selCaja && selCaja.selectedIndex >= 0 ? selCaja.options[selCaja.selectedIndex].text : "Efectivo";
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
        alert("⚠️ El enganche no puede ser mayor al total.");
        return;
    }

    const saldoAFinanciar = totalConDescuento - enganche;
    let planElegido = null;

    if (metodoPago === "apartado") {
        const fechaCompromiso = window._estadoPago?.apartadoFechaCompromiso || document.getElementById("fechaCompromisoApartado")?.value;
        const condicionesApartado = (window._estadoPago?.apartadoCondiciones || document.getElementById("condicionesApartado")?.value || "").trim();

        if (enganche <= 0) {
            alert("⚠️ Para registrar un apartado debes capturar un anticipo.");
            return;
        }
        if (!fechaCompromiso) {
            alert("⚠️ Captura la fecha compromiso de liquidación del apartado.");
            return;
        }
        if (!condicionesApartado) {
            alert("⚠️ Captura las condiciones del apartado para que aparezcan en el recibo.");
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
        const fechaCompromiso = window._estadoPago?.apartadoFechaCompromiso || document.getElementById("fechaCompromisoApartado")?.value || "";
        const condicionesApartado = window._estadoPago?.apartadoCondiciones || document.getElementById("condicionesApartado")?.value || "";
        detalleMetodo = `
            <p><strong>📦 APARTADO</strong></p>
            <div style="background:#fffbeb; padding:10px; border-radius:5px;">
                <p style="margin:5px 0;">💵 Enganche: <strong>${dinero(enganche)}</strong></p>
                <p style="margin:5px 0;">📦 Pendiente: <strong>${dinero(saldoAFinanciar)}</strong></p>
                <p style="margin:5px 0;">📅 Liquidar antes de: <strong>${fechaCompromiso || 'Sin fecha'}</strong></p>
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

    // 🛡️ REPARACIÓN: Empaquetar el plan para pasarlo por HTML sin que se rompa
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
                <button onclick="mostrarDialogoInventario('${metodoPago}', ${totalConDescuento ?? totalContado}, ${enganche}, ${saldoAFinanciar}, ${planSafeStr})"
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
function mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegidoRecibido) {
    let planElegido = planElegidoRecibido || _planElegidoPendiente;
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
            const accionesInventario = metodoPago === "apartado"
                ? `<div style="padding:8px 12px; background:#fffbeb; color:#92400e; border:1px solid #fcd34d; border-radius:6px; font-size:12px; max-width:220px;">
                        Apartado: queda en resguardo. No se descuenta inventario ni se emite entrega hasta liquidar.
                   </div>`
                : `<div style="display:flex; gap:8px;">
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
                   </div>`;

            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${x.prod.nombre}</strong><br>
                        <small style="color:#718096;">Stock disponible: ${x.prod.stock} | Solicitado: ${cantRequerida}</small>
                        ${colorSelectorHtml}
                        ${ubicacionSelectorHtml}
                    </div>
                    ${accionesInventario}
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

    // 🛡️ REPARACIÓN: Volver a empaquetar el plan para el último botón
    const planSafeStr2 = planElegido ? JSON.stringify(planElegido).replace(/'/g, "\\'").replace(/"/g, '&quot;') : 'null';

    const modalHTML = `
        <div class="modal" data-modal="dialogo-inventario" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div style="background:white; padding:30px; border-radius:15px; width:100%; max-width:700px; margin:0 auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">📦 Gestión de Inventario</h2>
                <p style="color:#718096; margin:0 0 20px 0;">Confirma cómo se entregarán los productos</p>
                
                ${htmlProductos}
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="confirmarDecisionesInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar}, ${planSafeStr2})" 
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

    const folioVenta = "V-" + Date.now().toString().slice(-6);

    // --- CORRECCIÓN DE FECHA ---
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

    const fechaHoy = fechaVentaDate.toLocaleDateString("es-MX");
    const fechaVentaIso = fechaVentaDate.toISOString();
    // --- FIN CORRECCIÓN DE FECHA ---

    let productosAEntregar = [];
    let productosAPendiente = [];

    carrito.forEach(item => {
        const prod = productos.find(prod => String(prod.id) === String(item.id)); 
        if (!prod) return;
        const decision = decisionesInventario[item.id];
        const tieneStock = (prod.stock || 0) >= (item.cantidad || 1);
        
        const puedeEntregarAhora = metodoPago !== "apartado" && tieneStock && decision && decision.entregar;

        if (puedeEntregarAhora) {
            const colorFinal = (decision.color !== undefined) ? decision.color : (item.colorElegido || '');
            const ubicacionFinal = (decision.ubicacion !== undefined) ? decision.ubicacion : (item.ubicacionElegida || '');
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

// 🛡️ INTERCEPTOR MAKER-CHECKER: Pone la venta en cuarentena y emite ticket provisional
function procesarVentaFinal(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock) {

    if (!totalContado || isNaN(totalContado) || totalContado <= 0) {
        totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    }

    // 1. Armar los datos para el Ticket Provisional
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
        tipoComprobante: "Ticket Provisional (Requiere Autorización)",
        periodicidad: document.getElementById("selPeriodicidad")?.value || "semanal",
        apartadoFechaCompromiso: window._estadoPago?.apartadoFechaCompromiso || null,
        apartadoCondiciones: window._estadoPago?.apartadoCondiciones || null,
        acreedor: "Roberto Escobedo Vega",
        lugar: "Santiago Cuaula, Tlaxcala",
        tasaMorosidad: 2
    };

    // 2. Empaquetar todo en la Bóveda de Cuarentena
    const cuarentena = {
        idCuarentena: Date.now(),
        fechaCaptura: new Date().toLocaleString('es-MX'),
        clienteNombre: clienteSeleccionado.nombre,
        totalVenta: totalContado,
        args: [metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock],
        datosVenta: datosVenta,
        vendedorSeleccionado: window._vendedorSeleccionado
    };

    let pendientes = StorageService.get("ventasPendientes", []);
    pendientes.push(cuarentena);
    StorageService.set("ventasPendientes", pendientes);

    // 3. Emitir documentos operativos aunque la venta quede en cuarentena.
    // La cuarentena es administrativa; no debe detener caja ni entrega.
    generarTicketMediaHoja(datosVenta);

    if (productosConStock && productosConStock.length > 0 && metodoPago !== "apartado" && typeof window.generarValeEntrega === "function") {
        const clienteEntrega = { ...(clienteSeleccionado || {}) };
        const articulosParaEntrega = _aplicarSalidaInventarioOperativa(folioVenta, productosConStock);

        if (articulosParaEntrega.length > 0) {
            window.generarValeEntrega({
                folio: folioVenta,
                fecha: fechaHoy,
                fechaIso: fechaVentaIso,
                metodoPago,
                cliente: clienteEntrega,
                estatusEntrega: productosSinStock && productosSinStock.some(x => x.generarEntregaPendiente !== false) ? "Parcial" : "Total"
            }, articulosParaEntrega, {
                origen: "salida_operativa_venta_cuarentena",
                registrar: true,
                estatusEntrega: productosSinStock && productosSinStock.some(x => x.generarEntregaPendiente !== false) ? "Parcial" : "Total",
                observaciones: "Documento operativo emitido al ejecutar la venta. Su registro administrativo queda sujeto a autorización."
            });
        }
    }

    // 4. Limpiar interfaz (sin afectar DB real)
    carrito = [];
    clienteSeleccionado = null;
    plazoSeleccionado = null;
    window._vendedorSeleccionado = null;
    if (!StorageService.set("carrito", carrito)) console.error("❌ Error limpiando carrito");
    actualizarContadorCarrito();

    document.querySelectorAll('[data-modal]').forEach(m => m.remove());
    document.querySelectorAll('.modal').forEach(m => { m.classList.add('oculto'); m.style.display = 'none'; });

    alert(`⏳ VENTA EN CUARENTENA\\n\\nFolio: ${folioVenta}\\nLa nota fue emitida y el proceso en caja finalizó. Si marcaste mercancía para entrega, también se generó su comprobante operativo.\\n\\nEl registro financiero e inventario oficial quedan pendientes de autorización del Administrador.`);
    navA('tienda');
}

// 🚀 EJECUTOR REAL: Esta es la función original que escribe a la Base de Datos
window.ejecutarVentaAutorizadaReal = function(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock, datosVentaP) {

    let requisicionesCompra = StorageService.get("requisicionesCompra", []);
    let movimientosCaja = StorageService.get("movimientosCaja", []);
    let cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    let salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    let pagaresSistema = StorageService.get("pagaresSistema", []);
    let entregasPendientes = [];
    let entregadosAhora = [];

    // PASO 1: ACTUALIZAR STOCK 
    productosConStock.forEach(x => {
        if (x.salidaOperativaAplicada || x.item?.salidaOperativaAplicada) return;
        const cantRequerida = x.item.cantidad || 1;
        const stockActual = x.prod.stock || 0;
        const colorElegido = x.item.colorElegido || '';
        const ubicacionElegida = x.item.ubicacionElegida || ''; 

        if (stockActual >= cantRequerida) {
            if (x.prod.variantes && x.prod.variantes.length > 0) {
                let restante = cantRequerida;
                x.prod.variantes.forEach(v => {
                    const coincideColor = !colorElegido || (v.color && v.color.toUpperCase() === colorElegido.toUpperCase());
                    const coincideUbicacion = !ubicacionElegida || (v.ubicacion && v.ubicacion.toUpperCase() === ubicacionElegida.toUpperCase());
                    if (restante > 0 && coincideColor && coincideUbicacion && Number(v.stock) > 0) {
                        const deducir = Math.min(Number(v.stock), restante);
                        v.stock -= deducir;
                        restante -= deducir;
                    }
                });
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
            x.prod.stock = stockActual - cantRequerida;
            const concepto = colorElegido ? `Venta - ${folioVenta} (${colorElegido} - ${ubicacionElegida || 'General'})` : `Venta - ${folioVenta}`;
            if (typeof registrarMovimiento === 'function') registrarMovimiento(x.prod.id, concepto, cantRequerida, "salida");
            entregadosAhora.push({
                productoId: x.prod.id,
                nombre: x.prod.nombre,
                colorElegido,
                ubicacionElegida,
                cantidad: cantRequerida
            });
        }
    });

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
        const cuentaId = window._estadoPago?.cuentaReceptora || 'efectivo';
        const etiqueta = window._estadoPago?.etiquetaCuenta || 'Efectivo';

        if (typeof window._ingresarCuenta === 'function') {
            window._ingresarCuenta({ monto: montoIngresoHoy, cuentaId: cuentaId, etiqueta: etiqueta, concepto: `${tituloConcepto} ${metodoPago} - ${datosVentaP.cliente.nombre} (Folio: ${folioVenta})`, referencia: `VENTA-${folioVenta}`, fecha: fechaVentaIso });
        } else {
            movimientosCaja.push({ id: Date.now(), folio: folioVenta, fecha: fechaVentaIso, tipo: "ingreso", monto: montoIngresoHoy, concepto: `${tituloConcepto} ${metodoPago} - ${datosVentaP.cliente.nombre}`, referencia: `VENTA-${folioVenta}`, cuenta: cuentaId, etiquetaCuenta: etiqueta });
            StorageService.set("movimientosCaja", movimientosCaja);
        }
    }

    // PASO 4: CREAR CUENTAS POR COBRAR O APARTADOS
    if (metodoPago === "credito") {
        let saldosPorMes = CalculatorService.calcularCreditoConPeriodicidad ? CalculatorService.calcularCreditoConPeriodicidad((totalContado - enganche), datosVentaP.periodicidad).map(p => ({ meses: p.meses, total: p.total })) : [];
        cuentasPorCobrar.push({ folio: folioVenta, nombre: datosVentaP.cliente.nombre, clienteId: datosVentaP.cliente.id, direccion: datosVentaP.cliente.direccion || "", telefono: datosVentaP.cliente.telefono || "", fechaVenta: fechaVentaIso, totalContadoOriginal: totalContado, engancheRecibido: enganche, saldoActual: planElegido.total, saldoOriginal: planElegido.total, metodo: metodoPago, plan: planElegido, estado: "Pendiente", abonos: [], articulos: datosVentaP.articulos, totalMercancia: totalContado, periodicidad: datosVentaP.periodicidad, vendedorId: window._vendedorSeleccionado?.id || null, vendedorNombre: window._vendedorSeleccionado?.nombre || null, saldosPorMes });

        let diasIntervalo = datosVentaP.periodicidad === "quincenal" ? 14 : datosVentaP.periodicidad === "mensual" ? 30 : 7;
        let fechaPago = new Date(fechaVentaIso);
        const totalPagos = planElegido.pagos || Math.round(planElegido.semanas / (diasIntervalo/7));
        
        for (let i = 1; i <= totalPagos; i++) {
            fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
            pagaresSistema.push({ id: Date.now() + i, folio: folioVenta, numeroPagere: `${folioVenta}-${i}/${totalPagos}`, clienteNombre: datosVentaP.cliente.nombre, clienteId: datosVentaP.cliente.id, fechaEmision: fechaVentaIso, fechaVencimiento: fechaPago.getTime(), monto: planElegido.abono, estado: "Pendiente", diasAtrasoActual: 0 });
        }
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
    ventasRegistradas.push({ folio: folioVenta, fechaVenta: fechaVentaIso, fecha: fechaHoy, clienteId: datosVentaP.cliente.id, clienteNombre: datosVentaP.cliente.nombre, cliente: datosVentaP.cliente, total: totalContado, enganche: enganche, saldoAFinanciar: saldoAFinanciar, metodoPago: metodoPago, plan: planElegido, periodicidad: datosVentaP.periodicidad, articulos: datosVentaP.articulos, apartadoFechaCompromiso: datosVentaP.apartadoFechaCompromiso || null, apartadoCondiciones: datosVentaP.apartadoCondiciones || null, vendedor: window._vendedorSeleccionado?.nombre || null });
    StorageService.set('ventasRegistradas', ventasRegistradas);

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
};

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
    const pagaresOficiales = pagares.filter(p => p.folio === folio);
    const pagaresDelFolio = pagaresOficiales.length > 0 ? pagaresOficiales : (datosVenta.pagaresPreview || []);

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
            planesHTML += `
                <div style="display:flex; justify-content:space-between; border-bottom:1px dotted #ccc; padding:4px 0;">
                    <span style="font-size:10px;">${p.meses} Meses — ${p.pagos || ''} pagos:</span>
                    <strong style="font-size:11px;">${dinero(p.total)}</strong>
                </div>`;
        });
    }

    // LEYENDAS LEGALES DINÁMICAS (Como las grandes cadenas)
    let textoLegal = '';
    const tituloTicketBase = datosVenta.metodo === 'apartado' ? 'RECIBO DE APARTADO' : (datosVenta.metodo === 'credito' ? 'CONTRATO DE CRÉDITO' : 'COMPROBANTE DE VENTA');
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
        textoLegal = `<b>TÉRMINOS DE APARTADO:</b><br>El cliente ${_escapeHtml(datosVenta.cliente.nombre)} entrega ${dinero(datosVenta.enganche)} como anticipo para apartar la mercancía descrita. El saldo pendiente es ${dinero(datosVenta.saldoPendiente)}${fechaCompromisoApartado ? ` y deberá liquidarse a más tardar el ${_escapeHtml(fechaCompromisoApartado)}` : ""}. La mercancía queda bajo resguardo de Mueblería Mi Pueblito y se entrega únicamente tras liquidación total. El cliente acepta las condiciones impresas en este comprobante.`;
    } else {
        textoLegal = `<b>TÉRMINOS DE VENTA:</b><br>El cliente ${datosVenta.cliente.nombre} recibe la mercancía a su entera satisfacción, liquidada en su totalidad. Toda aclaración o garantía deberá tramitarse en tienda presentando este comprobante original.`;
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
            ${datosVenta.cliente.telefono ? 'TEL: ' + datosVenta.cliente.telefono : ''}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:10px;">DETALLE DE MERCANCÍA</div>
        <div style="margin-top:5px;">${listaProductos}</div>

        <div class="separador"></div>

        <div style="display:flex; justify-content:space-between;">
            <span>Subtotal Mercancía:</span>
            <span>${dinero(datosVenta.total - (datosVenta.intereses || 0))}</span>
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
            <div class="centro negrita" style="background:#000; color:#fff; padding:4px; font-size:10px; margin-bottom:5px;">POLÍTICA DE LIQUIDACIÓN</div>
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

    const win = window.open('', '_blank');
    if (!win) {
        alert("⚠️ Habilita las ventanas emergentes para ver el ticket.");
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
        vendedorId: _vendedorSeleccionado ? _vendedorSeleccionado.id : null,
        vendedorNombre: _vendedorSeleccionado ? _vendedorSeleccionado.nombre : null,
        ultimaActualizacion: window.localISO(new Date())
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
    const pendientes = salidasPendientesVenta.filter(s => s.estatus === "Pendiente" || s.estatus === "Parcial");

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

                <div style="display:grid; gap:10px; margin-bottom:18px; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0;">
                    <div>
                        <label style="font-size:11px; font-weight:bold; color:#475569;">RECIBE MERCANCÍA</label>
                        <input id="entregaReceptor-${s.id}" type="text" value="${_escapeHtml(s.clienteNombre || '')}" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="font-size:11px; font-weight:bold; color:#475569;">IDENTIFICACIÓN / REFERENCIA</label>
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
    
    // ========================================================
    // 1. VALIDACIÓN DE STOCK (Revisar antes de descontar)
    // ========================================================
    let validacionPasada = true;
    let mensajeError = "";

    (s.items || []).forEach((item, index) => {
        const inputEl = document.getElementById(`entregar-${s.id}-${index}`);
        let cantAEntregar = inputEl ? parseInt(inputEl.value) : 0;
        
        if (cantAEntregar > 0) {
            const prod = productosActuales.find(p => String(p.id) === String(item.productoId));
            if (!prod) {
                validacionPasada = false;
                mensajeError = `❌ Error: Producto no encontrado en el inventario: ${item.nombre}`;
            } else if ((prod.stock || 0) < cantAEntregar) {
                validacionPasada = false;
                mensajeError = `⚠️ STOCK INSUFICIENTE para: ${item.nombre}\n\n- Cantidad solicitada: ${cantAEntregar}\n- Piezas disponibles: ${prod.stock || 0}\n\nPor favor ajusta la cantidad a entregar.`;
            }
        }
    });

    if (!validacionPasada) return alert(mensajeError);

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
            if (prod) {
                // Descontar stock general
                prod.stock = Math.max(0, (prod.stock || 0) - cantAEntregar);
                
                // Descontar de variantes (para evitar descuadres de color/bodega)
                if (prod.variantes && prod.variantes.length > 0) {
                    let restante = cantAEntregar;
                    // Intentamos quitar del color que pidió el cliente
                    prod.variantes.forEach(v => {
                        const coincideColor = !item.colorElegido || (v.color && v.color.toUpperCase() === item.colorElegido.toUpperCase());
                        if (restante > 0 && coincideColor && Number(v.stock) > 0) {
                            const deducir = Math.min(Number(v.stock), restante);
                            v.stock -= deducir;
                            restante -= deducir;
                        }
                    });
                    // Si hubo error de dedo y sobra, descontamos de donde haya
                    if (restante > 0) {
                        prod.variantes.forEach(v => {
                            if (restante > 0 && Number(v.stock) > 0) {
                                const deducir = Math.min(Number(v.stock), restante);
                                v.stock -= deducir;
                                restante -= deducir;
                            }
                        });
                    }
                }
                
                // Afectar el Kardex
                if (typeof window.registrarMovimiento === 'function') {
                    window.registrarMovimiento(item.productoId, `Entrega diferida - Folio ${s.folioVenta}`, cantAEntregar, "salida");
                }

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

    if (entregadosHoy.length === 0) return alert("⚠️ No indicaste ninguna cantidad para entregar.");

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
            <p style="font-size:16px;">⚠️ No hay transacciones registradas en el sistema.</p>
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
    }).sort((a, b) => new Date(b.fechaVenta || b.fechaIso || b.fechaEmision || 0) - new Date(a.fechaVenta || a.fechaIso || a.fechaEmision || 0));

    const foliosUnicos = new Set();
    filtrados = filtrados.filter(t => {
        if (foliosUnicos.has(t.folio)) return false;
        foliosUnicos.add(t.folio);
        return true;
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
        const fecha = t.fechaVenta ? window.formatearFechaCortaMX(t.fechaVenta) : (t.fecha || '—');
        const total = t.total || t.venta?.total || 0;
        const metodo = t.metodoPago || t.venta?.metodoPago || '—';
        const folioEsc = (t.folio || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        html += `<tr>
            <td><strong style="color:#1d4ed8;">${t.folio || '—'}</strong></td>
            <td>${t.clienteNombre || t.cliente?.nombre || '—'}</td>
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
            alert(`⚠️ No se encontró el ticket con folio: ${folio}`);
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
            const fechaVentaIso = window.localISO(fechaVentaDate);
            const fechaVentaStr = window.formatearFechaCortaMX(fechaVentaDate);
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
                        fechaVencimiento: window.localISO(new Date(fechaPago)),
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
                fecha: item.fecha || window.formatearFechaCortaMX(new Date()),
                vencimiento: item.vencimiento || window.formatearFechaCortaMX(new Date())
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
                fechaCompra: window.formatearFechaCortaMX(fechaCompraDate),
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
    const usuarioActual = StorageService.get("usuarioActual") || StorageService.get("sesionActiva") || { rol: "admin" }; 
    
    if (usuarioActual.rol !== "admin" && usuarioActual.rol !== "Administrador") {
        alert("⛔ ACCESO DENEGADO: Esta función es exclusiva para Administradores.");
        return;
    }

    const modalHTML = `
    <div data-modal="auditoria-cxc" style="position:fixed; inset:0; background:rgba(15,23,42,0.9); z-index:9999; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(5px);">
        <div style="background:white; padding:30px; border-radius:12px; width:100%; max-width:900px; margin-top:20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);">
            
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #ef4444; padding-bottom:15px; margin-bottom:20px;">
                <div>
                    <h2 style="margin:0; color:#b91c1c; font-size:24px;">🛠️ Auditoría CxC: Edición de Ventas</h2>
                    <p style="margin:0; color:#64748b; font-size:14px;">Modificación profunda de fechas y pagarés con impacto en Caja</p>
                </div>
                <button onclick="document.querySelector('[data-modal=\\'auditoria-cxc\\']').remove()" style="background:#f1f5f9; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; color:#475569;">✕ Cerrar</button>
            </div>

            <div style="display:flex; gap:10px; margin-bottom:25px; background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0;">
                <input type="text" id="auditFolioInput" placeholder="Ej. V-123456" style="flex:1; padding:10px; border:1px solid #cbd5e1; border-radius:6px; font-size:16px;">
                <button id="btnHiddenBuscarAudit" onclick="buscarVentaAuditoria()" style="display:none;"></button>
                <button onclick="abrirBuscadorVentasCxC('auditFolioInput')" style="background:#2563eb; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:bold;">🔍 Buscar Venta</button>
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

    let fechaVentaDate = "";
    if(cuenta.fechaVenta) {
        try { fechaVentaDate = window.getFechaLocalMX ? window.getFechaLocalMX(cuenta.fechaVenta) : cuenta.fechaVenta.split('T')[0]; } catch(e) {}
    }

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
    if(!confirm("⚠️ ADVERTENCIA: Estás a punto de reescribir los datos de esta venta y sus pagarés. ¿Continuar?")) return;

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

    // 2. REESCRIBIR PAGARÉS
    pagaresSistema = pagaresSistema.filter(p => String(p.folio).toUpperCase() !== String(folio).toUpperCase());
    pagaresSistema = pagaresSistema.concat(window._auditPagaresActuales);

    StorageService.set("cuentasPorCobrar", cuentas);
    StorageService.set("pagaresSistema", pagaresSistema);

    alert("✅ Cambios de auditoría guardados exitosamente. El Estado de Cuenta ha sido actualizado.");
    
    document.querySelector('[data-modal="auditoria-cxc"]').remove();
    if(typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
}
// ===== GENERADOR DE DOCUMENTO DE ENTREGA (SOLO CON SALIDA REAL DE INVENTARIO) =====
function generarValeEntrega(datosVenta, articulosAEntregar, opciones = {}) {
    if (!articulosAEntregar || articulosAEntregar.length === 0) {
        alert("⚠️ No hay mercancía para documentar en esta entrega.");
        return null;
    }

    const folioVenta = datosVenta.folio || datosVenta.folioVenta || datosVenta.folioSalida || "S/F";
    const fechaIso = opciones.fechaIso || datosVenta.fechaIso || window.localISO?.(new Date()) || new Date().toISOString();
    const fechaEntrega = opciones.fechaEntrega || datosVenta.fecha || (window.formatearFechaMX ? window.formatearFechaMX(new Date(fechaIso)) : new Date(fechaIso).toLocaleString("es-MX"));
    const folioDocumento = opciones.folioDocumento || datosVenta.folioDocumento || `ENT-${Date.now().toString().slice(-8)}`;
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
            <button onclick="window.print()" style="padding:10px 20px; font-weight:bold; cursor:pointer;">🖨️ IMPRIMIR COMPROBANTE</button>
        </div>

        <div class="centro">
            <img src="img/Logo.svg" style="width:60px; height:60px; object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
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
            DIRECCIÓN: ${_escapeHtml(documento.cliente.direccion)}
        </div>

        <div class="separador"></div>
        <div class="centro negrita" style="font-size:11px;">MERCANCÍA QUE RECIBE:</div>
        <div style="margin-top:10px;">
            ${listaEntregada}
        </div>

        <div class="caja-conformidad">
            <b>DECLARACIÓN DE CONFORMIDAD:</b><br>
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

    const win = window.open('', '_blank');
    if (!win) {
        alert("⚠️ El comprobante de entrega se registró, pero el navegador bloqueó la ventana emergente.");
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
                <h3 style="margin:0; color:#1e40af; font-size:20px;">🔍 Seleccionar Venta para Auditoría</h3>
                <button onclick="document.querySelector('[data-modal=\\'buscador-folios\\']').remove()" style="background:none; border:none; font-size:24px; cursor:pointer; color:#9ca3af;">✕</button>
            </div>
            
            <input type="text" id="inputFiltroAudit" onkeyup="filtrarTablaAuditoria()" placeholder="🔎 Escribe nombre, folio o artículo..." style="width:100%; padding:14px; border:2px solid #3b82f6; border-radius:8px; font-size:16px; margin-bottom:15px; box-sizing:border-box; outline:none; box-shadow:0 2px 4px rgba(59,130,246,0.1);">
            
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
                <h3 style="color:#dc2626; margin-top:0;">⚠️ Reverso de Cobranza</h3>
                <p style="color:#4b5563; font-size:14px; margin-bottom:10px;">Estás cancelando el pago de <b>${_cxcDinero(montoDevolver)}</b> del pagaré <b>${p.numeroPagere || p.folio}</b>.</p>
                <p style="color:#dc2626; font-weight:bold; font-size:13px; margin-bottom:15px;">Este dinero se RESTARÁ de tu flujo de caja de inmediato.</p>
                
                <label style="display:block; margin-bottom:8px; font-size:12px; font-weight:bold; color:#374151;">¿DE QUÉ CUENTA SE DESCUENTA ESTE DINERO?</label>
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
                <h3 style="color:#059669; margin-top:0;">💰 Ingreso de Cobranza</h3>
                <p style="color:#4b5563; font-size:14px; margin-bottom:10px;">Estás marcando como pagado el pagaré <b>${p.numeroPagere || p.folio}</b>.</p>
                <p style="color:#059669; font-weight:bold; font-size:13px; margin-bottom:15px;">Se SUMARÁN <b>${_cxcDinero(montoCobrar)}</b> a tu flujo de caja de inmediato.</p>
                
                <label style="display:block; margin-bottom:8px; font-size:12px; font-weight:bold; color:#374151;">¿A QUÉ CUENTA INGRESA ESTE DINERO?</label>
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
    alert(`✅ Operación financiera (${tipo.toUpperCase()}) aplicada a ${etiquetaCuenta}.\\n⚠️ ¡NO OLVIDES HACER CLIC EN "GUARDAR CAMBIOS" AL FINAL!`);
    dibujarFormularioAuditoria();
};

window.cancelarAuditoriaCxC = function(index, estadoAnterior) {
    document.querySelector('[data-modal="auditoria-finanzas"]')?.remove();
    window._auditPagaresActuales[index].estado = estadoAnterior;
    dibujarFormularioAuditoria();
};

// =====================================================================
// 🖨️ BUSCADOR UNIFICADO DE REIMPRESIÓN (CONTADO, CRÉDITO Y APARTADOS)
// =====================================================================

window.renderReimprimirVenta = function() {
    const folioBuscado = document.getElementById('rvFolio').value.toLowerCase().trim();
    const clienteBuscado = document.getElementById('rvCliente').value.toLowerCase().trim();
    const fechaDesde = document.getElementById('rvFechaDesde').value;
    const fechaHasta = document.getElementById('rvFechaHasta').value;
    const montoMin = parseFloat(document.getElementById('rvMontoMin').value) || 0;
    const montoMax = parseFloat(document.getElementById('rvMontoMax').value) || Infinity;
    const tipoDoc = document.getElementById('rvTipoDoc')?.value || 'todos';

    // 1. Extraer documentos reimprimibles. Se excluyen abonos por regla operativa.
    const ventas = StorageService.get("ventasRegistradas", [])
        .filter(v => !['credito', 'apartado'].includes(String(v.metodoPago || '').toLowerCase()))
        .map(v => ({...v, _origen: 'contado'}));
    const cxc = StorageService.get("cuentasPorCobrar", []).map(c => ({...c, _origen: 'credito'}));
    const apartados = StorageService.get("apartados", []).map(a => ({...a, _origen: 'apartado'}));
    const entregas = StorageService.get("documentosEntrega", []).map(d => ({
        ...d,
        _origen: 'entrega_mcia',
        folio: d.folioDocumento,
        clienteNombre: d.cliente?.nombre || d.clienteNombre || '',
        fecha: d.fechaEmision || d.fecha,
        total: 0
    }));

    // 2. Unificar todo en una sola lista maestra
    let todo = [...ventas, ...cxc, ...apartados, ...entregas];

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
        return fb - fa;
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
        const etiquetas = { contado: 'CONTADO', credito: 'CRÉDITO', apartado: 'APARTADO', entrega_mcia: 'ENTREGA MCIA' };
        const tipo = etiquetas[item._origen] || item._origen.toUpperCase();
        
        let colorTipo = '#6b7280';
        if (item._origen === 'contado') colorTipo = '#16a34a'; // Verde
        if (item._origen === 'credito') colorTipo = '#2563eb'; // Azul
        if (item._origen === 'apartado') colorTipo = '#7c3aed'; // Morado
        if (item._origen === 'entrega_mcia') colorTipo = '#0f766e'; // Teal

        html += `<tr>
            <td><strong>${folio}</strong>${item.folioVenta ? `<br><small style="color:#64748b;">Venta: ${item.folioVenta}</small>` : ''}</td>
            <td>${fechaLimpia}</td>
            <td>${cliente}</td>
            <td><span style="background:${colorTipo}; color:white; padding:4px 8px; border-radius:6px; font-size:11px; font-weight:bold;">${tipo}</span></td>
            <td>${fmtDinero(total)}</td>
            <td style="text-align:center;">
                <button onclick="reimprimirFolioUnificado('${folio}', '${item._origen}')" style="background:#475569; color:white; border:none; padding:8px 15px; border-radius:6px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                    🖨️ Reimprimir
                </button>
            </td>
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
    if (origen === 'entrega_mcia') {
        const docs = StorageService.get("documentosEntrega", []);
        const doc = docs.find(d => d.folioDocumento === folio);
        if (!doc) return alert("❌ No se encontró el documento de entrega.");
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
        if (!ap) return alert("❌ No se encontró el apartado en la base de datos.");
        
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
        else alert("⚠️ La función de impresión de tickets no está disponible.");

    } else if (origen === 'credito') {
        const cxc = StorageService.get("cuentasPorCobrar", []);
        const c = cxc.find(x => x.folio === folio);
        if (!c) return alert("❌ No se encontró el crédito.");
        
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
        if (!v) return alert("❌ No se encontró la venta de contado.");
        if (typeof generarTicketMediaHoja === 'function') generarTicketMediaHoja(v);
    }
};

// ===============================================================
// 🛡️ BÓVEDA DE AUTORIZACIONES (MAKER-CHECKER) - MOTOR REPARADO V2
// ===============================================================

// 1. PANEL PRINCIPAL DE LA VISTA (Mantiene tu estructura limpia)
window.renderPanelAutorizaciones = function() {
    const cont = document.getElementById("autorizaciones"); 
    if (!cont) return;
    
    const ventasP = StorageService.get("ventasPendientes", []);
    const abonosP = StorageService.get("abonosPendientes", []);

    let html = `
    <div style="padding: 20px;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top:0;">🛡️ Bóveda de Autorizaciones (Pendientes)</h2>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            
            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="color: #d97706; margin-top: 0;">🛒 Ventas Provisionales (${ventasP.length})</h3>
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
                        <td style="padding: 8px;">${v.fechaCaptura || '-'}</td>
                        <td style="padding: 8px;">${v.clienteNombre || 'Público General'}</td>
                        <td style="padding: 8px; font-weight: bold;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v.totalVenta || 0)}</td>
                        <td style="padding: 8px;">
                            <button onclick="revisarVentaPendiente(${i})" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Revisar 🔍</button>
                        </td>
                    </tr>
                    `).join('')}
                </table>
            </div>

            <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <h3 style="color: #059669; margin-top: 0;">💵 Abonos Provisionales (${abonosP.length})</h3>
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
                        <td style="padding: 8px;">${a.fechaCaptura || '-'}</td>
                        <td style="padding: 8px; color: #475569;"><strong>${folioRef}</strong><br><span style="font-size:11px; color:#64748b;">${esApartado ? 'Apartado' : 'Crédito'}</span></td>
                        <td style="padding: 8px; font-weight: bold; color: #059669;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(a.montoAbonado || 0)}</td>
                        <td style="padding: 8px;">
                            <button onclick="revisarAbonoPendiente(${i})" style="background: #10b981; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-weight: bold;">Revisar 🔍</button>
                        </td>
                    </tr>
                    `}).join('')}
                </table>
            </div>

        </div>
    </div>`;
    cont.innerHTML = html;
};

// 2. VENTANA DE REVISIÓN AVANZADA Y EDICIÓN DE VENTAS
window.revisarVentaPendiente = function(index) {
    const ventasP = StorageService.get("ventasPendientes", []);
    const v = ventasP[index];
    if (!v) return;

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
                    <label style="font-weight:bold; display:block; margin-bottom:8px; color:#92400e;">⚙️ AJUSTAR TÉRMINOS DEL CRÉDITO (Editable):</label>
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
                <td style="padding:6px 0;">• ${art.nombre} ${art.colorElegido ? `(${art.colorElegido})` : ''}</td>
                <td style="padding:6px 0; text-align:center;">${art.cantidad || 1}</td>
                <td style="padding:6px 0; text-align:right;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(art.precioContado || art.precio || 0)}</td>
            </tr>`;
    });

    const html = `
    <div data-modal="auth-venta" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center; padding:20px;">
        <div style="background:white; padding:25px; border-radius:12px; width:100%; max-width:500px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3); max-height:90vh; overflow-y:auto;">
            <h3 style="color:#d97706; margin-top:0; border-bottom:2px solid #fde68a; padding-bottom:8px;">🛒 Auditoría de Venta Provisional</h3>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:13px; margin-bottom:15px; background:#f8fafc; padding:10px; border-radius:8px;">
                <div><strong>Folio:</strong> ${v.args[5]}</div>
                <div><strong>Método:</strong> <span style="text-transform:uppercase; font-weight:bold; color:#1e3a8a;">${metodoPago}</span></div>
                <div style="grid-column: span 2;"><strong>Cliente:</strong> ${v.clienteNombre}</div>
            </div>
            
            ${detalleCreditoHTML}

            <label style="font-weight:bold; font-size:12px; color:#475569; text-transform:uppercase;">📦 Productos en la Nota:</label>
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

            <label style="font-weight:bold; font-size:12px; color:#475569; text-transform:uppercase;">💰 Condiciones de Venta (Editables):</label>
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
                <span style="color:#166534; font-weight:bold;">💵 ${engancheYaRegistrado ? 'Importe a caja al autorizar:' : 'Importe neto que ingresa a Caja:'}</span>
                <strong style="color:#15803d; font-size:15px;">${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(importeEfectivoCaja)}</strong>
            </div>
            ${engancheYaRegistrado ? '<div style="margin-top:-8px; margin-bottom:15px; font-size:12px; color:#64748b;">Los anticipos ya fueron registrados durante el apartado; aquí sólo se formaliza la cartera.</div>' : ''}
            
            <label style="display:block; font-weight:bold; font-size:12px; color:#475569;">📅 Fecha de Aplicación Oficial:</label>
            <input type="date" id="authFechaVenta" value="${fechaCorta}" style="width:100%; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box; margin-bottom:20px;">

            <div style="display:flex; gap:10px;">
                <button onclick="aprobarVentaCuarentena(${index})" style="flex:1; background:#22c55e; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">✅ Autorizar a DB</button>
                <button onclick="rechazarVentaCuarentena(${index})" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer; font-size:13px;">🗑️ Anular Movimiento</button>
                <button onclick="document.querySelector('[data-modal=auth-venta]').remove()" style="padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; cursor:pointer; font-size:13px;">Regresar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    
    // Agregar listener para recalcular Valor Pagaré cuando se edite plazo o abono (CRÉDITO)
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
    const ventasP = StorageService.get("ventasPendientes", []);
    const v = ventasP[index];
    if (!v) return;
    
    // 1. Capturar las correcciones hechas por el Admin en la ventana
    const nuevoTotal = parseFloat(document.getElementById('authTotalVenta').value) || 0;
    const nuevoEnganche = parseFloat(document.getElementById('authEngancheVenta').value) || 0;
    const nuevaFechaCorta = document.getElementById('authFechaVenta').value;
    const nuevaFechaIso = window.localISO ? window.localISO(nuevaFechaCorta + 'T12:00:00') : new Date(nuevaFechaCorta + 'T12:00:00').toISOString();
    
    // NUEVOS CAMPOS: Capturar ajustes de crédito si aplica
    const nuevoPlazoCreditoInput = document.getElementById('authPlazoCreditoAjuste');
    const nuevoAbonoPeriodoInput = document.getElementById('authAbonoPeriodoAjuste');
    
    if (nuevoTotal <= 0) return alert("❌ El total de la venta debe ser mayor a 0.");

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
            
            // 🛡️ CORRECCIÓN: La deuda real en el sistema es la suma de los pagarés.
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
    }

    // 3. Ejecutar el motor de transacciones del POS original (GUARDA SILENCIOSAMENTE EN DB)
    window._vendedorSeleccionado = v.vendedorSeleccionado;
    window.ejecutarVentaAutorizadaReal(...v.args, v.datosVenta);
    
    // 4. Limpiar de la cuarentena
    ventasP.splice(index, 1);
    StorageService.set("ventasPendientes", ventasP);
    document.querySelector('[data-modal=auth-venta]').remove();
    
    alert("✅ Venta corregida y autorizada de forma silenciosa.\n\nEl sistema financiero ha sido actualizado. El cajero podrá generar el ticket definitivo desde la opción 'Reimprimir Ticket' si el cliente lo requiere.");
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    if (typeof renderApartados === 'function') renderApartados();
    if (typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
    if (typeof renderAbonosDirectos === 'function') renderAbonosDirectos();
};

window.rechazarVentaCuarentena = function(index) {
    if (!confirm("¿Deseas eliminar permanentemente esta venta provisional sin afectar el inventario ni la caja?")) return;
    const ventasP = StorageService.get("ventasPendientes", []);
    const v = ventasP[index];
    if (v && (v.tipo === "conversion_apartado_credito" || v.origenApartadoFolio || v.datosVenta?.origenApartadoFolio)) {
        const folioApartado = v.origenApartadoFolio || v.datosVenta?.origenApartadoFolio || v.args?.[5];
        const apartados = StorageService.get("apartados", []);
        const idxApartado = apartados.findIndex(a => a.folio === folioApartado);
        if (idxApartado !== -1 && apartados[idxApartado].estado === "Conversión a Crédito Pendiente") {
            apartados[idxApartado].estado = "Pendiente";
            StorageService.set("apartados", apartados);
        }
    }
    ventasP.splice(index, 1);
    StorageService.set("ventasPendientes", ventasP);
    document.querySelector('[data-modal=auth-venta]').remove();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    if (typeof renderApartados === 'function') renderApartados();
};

// =====================================================================
// ⛔ CENTRO DE CANCELACIONES
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

function _cancelRegistrarReembolso({ monto, cuentaId, etiqueta, concepto, referencia, clienteNombre, tipo, motivo, emitirComprobante, registrarMovimiento = true }) {
    if (Number(monto || 0) <= 0) return;

    if (registrarMovimiento) {
        if (typeof window._egresarCuenta === 'function') {
            window._egresarCuenta({ monto, cuentaId, etiqueta, concepto, referencia, fecha: _cancelIsoAhora() });
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

    if (emitirComprobante) {
        generarComprobanteDevolucionCancelacion({ tipo, referencia, clienteNombre, monto, cuenta: etiqueta, motivo });
    }
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
        if (p.estado === 'Cancelado') return;
        p.montoAbonado = 0;
        p.fechaAbono = null;
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

function generarComprobanteDevolucionCancelacion({ tipo, referencia, clienteNombre, monto, cuenta, motivo }) {
    const folioDoc = `DEV-${Date.now().toString().slice(-8)}`;
    const fecha = window.formatearFechaMX ? window.formatearFechaMX(new Date()) : new Date().toLocaleString('es-MX');
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
            <div class="negrita">COMPROBANTE DE DEVOLUCIÓN</div>
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
    const win = window.open('', '_blank');
    if (!win) return alert("El comprobante se generó, pero el navegador bloqueó la ventana emergente.");
    win.document.write(html);
    win.document.close();
    win.focus();
}

function renderCancelaciones(tipo = window._cancelacionTipo || 'venta') {
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
        .sort((a,b) => new Date(b.fechaVenta || b.fechaIso || 0) - new Date(a.fechaVenta || a.fechaIso || 0));
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
        if (ab.cancelado) return;
        filas.push({ origen: 'credito', folio: c.folio, cliente: c.nombre || c.clienteNombre, fecha: ab.fecha || ab.fechaAbono, monto: ab.monto, cuenta: ab.etiquetaCuenta || ab.medioPago, idx });
    }));
    apartados.forEach(a => (a.abonos || []).forEach((ab, idx) => {
        if (ab.cancelado) return;
        filas.push({ origen: 'apartado', folio: a.folio, cliente: a.clienteNombre, fecha: ab.fechaAbono || ab.fecha, monto: ab.monto, cuenta: ab.etiquetaCuenta || ab.cuentaId, idx });
    }));
    const filtradas = filas.filter(a => !filtro || `${a.folio} ${a.cliente}`.toLowerCase().includes(filtro)).sort((a,b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
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
    const filas = apartados.filter(a => !filtro || `${a.folio} ${a.clienteNombre}`.toLowerCase().includes(filtro)).sort((a,b) => new Date(b.fechaApartado || 0) - new Date(a.fechaApartado || 0));
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
    StorageService.set("ventasPendientes", pendientesRestantes);

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
    const registrarMovimientoReembolso = ctx.origen !== 'cuarentena' || _cancelTieneIngresoCaja(ctx.folio);
    _cancelRegistrarReembolso({
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
    _cancelRegistrarHistorial({ tipo: 'venta', folio: ctx.folio, origen: ctx.origen, clienteNombre: ctx.cliente, montoDevuelto: ctx.monto, movimientoCajaRegistrado: registrarMovimientoReembolso, motivo, articulosReingresados });

    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    alert("✅ Venta cancelada. Se aplicaron reversas de caja, cartera, pagarés e inventario entregado.");
    renderCancelaciones('venta');
};

window.abrirModalCancelarAbono = function(origen, folio, index) {
    const cuenta = origen === 'credito'
        ? StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio)
        : StorageService.get("apartados", []).find(a => a.folio === folio);
    const abono = cuenta?.abonos?.[index];
    if (!cuenta || !abono) return alert("No se encontró el abono.");
    const cliente = cuenta.nombre || cuenta.clienteNombre || 'Cliente';
    const monto = Number(abono.monto || 0);
    window._cancelacionActual = { tipo: 'abono', origen, folio, index, monto, cliente };
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
        _cancelRecalcularCredito(cuenta);
        StorageService.set("cuentasPorCobrar", cuentas);
        ctx.monto = Number(abono.monto || ctx.monto || 0);
        ctx.cliente = cuenta.nombre || cuenta.clienteNombre || ctx.cliente;
    } else {
        const apartados = StorageService.get("apartados", []);
        const ap = apartados.find(a => a.folio === ctx.folio);
        if (!ap || !ap.abonos?.[ctx.index]) return alert("El abono ya no existe.");
        const abono = ap.abonos.splice(ctx.index, 1)[0];
        ctx.monto = Number(abono.monto || ctx.monto || 0);
        ap.saldoPendiente = Number(ap.saldoPendiente || 0) + ctx.monto;
        if (ap.estado === 'Liquidado') ap.estado = 'Pendiente';
        ctx.cliente = ap.clienteNombre || ctx.cliente;
        StorageService.set("apartados", apartados);
    }

    _cancelRegistrarReembolso({
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
    _cancelRegistrarHistorial({ tipo: 'abono', origen: ctx.origen, folio: ctx.folio, clienteNombre: ctx.cliente, montoDevuelto: ctx.monto, motivo });
    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    alert("✅ Abono cancelado y saldos recalculados.");
    renderCancelaciones('abono');
};

window.abrirModalCancelarApartado = function(folio) {
    const ap = StorageService.get("apartados", []).find(a => a.folio === folio);
    if (!ap) return alert("No se encontró el apartado.");
    const monto = Number(ap.enganche || 0) + (ap.abonos || []).reduce((s, a) => s + Number(a.monto || 0), 0);
    window._cancelacionActual = { tipo: 'apartado', folio, monto, cliente: ap.clienteNombre || 'Cliente' };
    _modalCancelacion({
        titulo: `Cancelar apartado ${_cancelEsc(folio)}`,
        monto,
        resumen: `<b>Cliente:</b> ${_cancelEsc(ap.clienteNombre)}<br><b>Total apartado:</b> ${_cancelDinero(ap.importeApartado || ap.total || 0)}<br><b>Pagado a devolver:</b> ${_cancelDinero(monto)}<br>Se cancelará el apartado y cualquier crédito generado desde él.`,
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
    ap.estado = 'Cancelado';
    ap.fechaCancelacion = _cancelIsoAhora();
    ap.motivoCancelacion = motivo;
    StorageService.set("apartados", apartados);

    const ventas = StorageService.get("ventasRegistradas", []).map(v => v.folio === ctx.folio ? { ...v, estado: 'Cancelada', estatus: 'Cancelada', motivoCancelacion: motivo, fechaCancelacion: _cancelIsoAhora() } : v);
    StorageService.set("ventasRegistradas", ventas);
    const cuentas = StorageService.get("cuentasPorCobrar", []).map(c => c.folio === ctx.folio ? { ...c, estado: 'Cancelado', saldoActual: 0, motivoCancelacion: motivo, fechaCancelacion: _cancelIsoAhora() } : c);
    StorageService.set("cuentasPorCobrar", cuentas);
    const pagares = StorageService.get("pagaresSistema", []).map(p => p.folio === ctx.folio ? { ...p, estado: 'Cancelado', nota: 'Cancelado por cancelación de apartado' } : p);
    StorageService.set("pagaresSistema", pagares);

    _cancelRegistrarReembolso({
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
    _cancelRegistrarHistorial({ tipo: 'apartado', folio: ctx.folio, clienteNombre: ctx.cliente, montoDevuelto: ctx.monto, motivo });
    document.querySelector('[data-modal="cancelacion-modal"]')?.remove();
    alert("✅ Apartado cancelado y reversado.");
    renderCancelaciones('apartado');
};

// 3. DETALLE DE ABONOS PENDIENTES (MODAL)
window.revisarAbonoPendiente = function(index) {
    const abonosP = StorageService.get("abonosPendientes", []);
    const a = abonosP[index];
    if (!a) return;

    const fechaCorta = a.fechaAbonoIso.split('T')[0];
    const esApartado = a.tipo === 'apartado' || a.origen === 'apartados' || a.folioApartado;
    const folioRef = a.folioApartado || a.folioCXC || '-';

    const html = `
    <div data-modal="auth-abono" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:12px; width:400px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3);">
            <h3 style="color:#059669; margin-top:0;">💵 Autorizar Abono Provisional ${esApartado ? 'de Apartado' : 'de Crédito'}</h3>
            <p style="font-size:14px; margin: 6px 0;"><strong>Folio ${esApartado ? 'Apartado' : 'Crédito'}:</strong> ${folioRef}</p>
            <p style="font-size:14px; margin: 6px 0;"><strong>Cliente:</strong> ${a.clienteNombre || '-'}</p>
            <p style="font-size:14px; margin: 6px 0;"><strong>Monto Abono:</strong> ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(a.montoAbonado)}</p>
            <p style="font-size:14px; margin: 6px 0;"><strong>Cuenta Receptora:</strong> ${a.etiquetaCuenta}</p>
            
            <label style="display:block; margin-top:15px; font-weight:bold; font-size:12px; color:#475569;">Fecha de Ingreso Oficial (Auditoría):</label>
            <input type="date" id="authFechaAbono" value="${fechaCorta}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; margin-top:5px; box-sizing:border-box;">

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="aprobarAbonoCuarentena(${index})" style="flex:1; background:#22c55e; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">✅ Ingresar a Caja</button>
                <button onclick="rechazarAbonoCuarentena(${index})" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">🗑️ Eliminar</button>
                <button onclick="document.querySelector('[data-modal=auth-abono]').remove()" style="padding:12px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.aprobarAbonoCuarentena = function(index) {
    const abonosP = StorageService.get("abonosPendientes", []);
    const a = abonosP[index];
    if (!a) return;
    
    const nuevaFechaCorta = document.getElementById('authFechaAbono').value;
    const nuevaFechaIso = window.localISO ? window.localISO(nuevaFechaCorta + 'T12:00:00') : new Date(nuevaFechaCorta + 'T12:00:00').toISOString();
    
    a.fechaAbonoIso = nuevaFechaIso;
    a.fechaAbonoStr = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(nuevaFechaIso)) : nuevaFechaCorta;

    const aplicado = window.ejecutarAbonoAutorizadoReal(a);
    if (aplicado === false) return;
    
    abonosP.splice(index, 1);
    StorageService.set("abonosPendientes", abonosP);
    document.querySelector('[data-modal=auth-abono]').remove();
    alert("✅ Abono aprobado y registrado en flujo de caja.");
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
};

window.rechazarAbonoCuarentena = function(index) {
    if (!confirm("¿Deseas eliminar permanentemente este abono sin ingresarlo a caja?")) return;
    const abonosP = StorageService.get("abonosPendientes", []);
    abonosP.splice(index, 1);
    StorageService.set("abonosPendientes", abonosP);
    document.querySelector('[data-modal=auth-abono]').remove();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
};

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
window.generarValeEntrega = generarValeEntrega;
window.renderCancelaciones = renderCancelaciones;
window.procesarMigracionMSI_POS = procesarMigracionMSI_POS;
window.procesarMigracionCXC_POS = procesarMigracionCXC_POS;
window.procesarMigracionCXP_POS = procesarMigracionCXP_POS;
window.renderReimprimirVenta = window.renderReimprimirVenta || renderReimprimirVenta;
window.reimprimirTicketVenta = reimprimirTicketVenta;
window.limpiarFiltrosReimpresion = window.limpiarFiltrosReimpresion || limpiarFiltrosReimpresion;
