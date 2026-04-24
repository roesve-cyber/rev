// ===== HELPERS DE CUENTA / MEDIO DE PAGO =====
function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function _buildCuentaOrigen(idSufijo) {
    return `
        <div style="margin-bottom:8px;">
            <label style="font-size:14px; color:#4b5563;">Medio de pago:</label>
            <select id="medioPago_${idSufijo}" onchange="_actualizarCuentaEspecifica('${idSufijo}')"
                    style="width:100%; padding:10px; font-size:15px; border:2px solid #3498db; border-radius:6px; margin-top:4px;">
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia bancaria</option>
                <option value="tarjeta_credito">💳 Tarjeta de crédito</option>
            </select>
        </div>
        <div id="divCuentaEspecifica_${idSufijo}" style="display:none; margin-top:8px;">
            <label style="font-size:14px; color:#4b5563;">Cuenta específica:</label>
            <select id="cuentaEspecifica_${idSufijo}"
                    style="width:100%; padding:10px; font-size:15px; border:2px solid #3498db; border-radius:6px; margin-top:4px;">
            </select>
        </div>`;
}

function _actualizarCuentaEspecifica(idSufijo) {
    const medio = document.getElementById('medioPago_' + idSufijo)?.value;
    const div = document.getElementById('divCuentaEspecifica_' + idSufijo);
    const sel = document.getElementById('cuentaEspecifica_' + idSufijo);
    if (!div || !sel) return;
    if (medio === 'efectivo') { div.style.display = 'none'; return; }
    div.style.display = 'block';
    const tarjetas = StorageService.get('tarjetasConfig', []);
    if (medio === 'transferencia') {
        const debito = tarjetas.filter(t => t.tipo === 'debito');
        sel.innerHTML = debito.length === 0
            ? '<option value="">-- No hay cuentas débito registradas --</option>'
            : debito.map(t => `<option value="${t.banco}">🏦 ${t.banco} Débito</option>`).join('');
    } else {
        const credito = tarjetas.filter(t => !t.tipo || t.tipo === 'credito');
        sel.innerHTML = credito.length === 0
            ? '<option value="">-- No hay tarjetas registradas --</option>'
            : credito.map(t => `<option value="${t.banco}">💳 ${t.banco} Crédito</option>`).join('');
    }
}

function _getCuentaSeleccionada(idSufijo) {
    const medio = document.getElementById('medioPago_' + idSufijo)?.value || 'efectivo';
    const especifica = document.getElementById('cuentaEspecifica_' + idSufijo)?.value || '';
    let cuentaId = 'caja';
    let etiqueta = '💵 Efectivo';
    if (medio === 'transferencia' && especifica) { cuentaId = especifica; etiqueta = `🏦 ${especifica} Débito`; }
    if (medio === 'tarjeta_credito' && especifica) { cuentaId = especifica; etiqueta = `💳 ${especifica} Crédito`; }
    return { medioPago: medio, cuentaId, etiqueta };
}

window._buildCuentaOrigen = _buildCuentaOrigen;
window._actualizarCuentaEspecifica = _actualizarCuentaEspecifica;
window._getCuentaSeleccionada = _getCuentaSeleccionada;

// ===== CLIENTES =====
function guardarCliente() {
    const nombreInput   = document.getElementById("clienteNombre");
    const direccionInput = document.getElementById("clienteDireccion");
    const telefonoInput = document.getElementById("clienteTelefono");
    const referenciaInput = document.getElementById("clienteReferencia");
    
    const nombre   = nombreInput.value.trim();
    const direccion = direccionInput.value.trim();
    const telefono = telefonoInput.value.trim();
    const referencia = referenciaInput.value.trim();

    const validacion = ValidatorService.validarCliente({ nombre, telefono });
    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    if (clienteEditandoId) {
        const index = clientes.findIndex(c => c.id === clienteEditandoId);
        if (index !== -1) {
            clientes[index].nombre   = nombre;
            clientes[index].direccion = direccion;
            clientes[index].telefono = telefono;
            clientes[index].referencia = referencia;
        }
        clienteEditandoId = null;
    } else {
        clientes.push({
            id: Date.now(),
            nombre,
            direccion,
            telefono,
            referencia,
            fechaRegistro: new Date().toLocaleDateString()
        });
    }

    if (!StorageService.set("clientes", clientes)) {
        alert("❌ Error guardando cliente");
        return;
    }

    nombreInput.value   = "";
    direccionInput.value = "";
    telefonoInput.value = "";
    referenciaInput.value = "";
    renderClientes();
}

function renderClientes() {
    const cont = document.getElementById("listaClientes");
    if (!cont) return;

    if (clientes.length === 0) {
        cont.innerHTML = "<p style='color:gray; padding:20px;'>No hay clientes registrados.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Referencia</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    clientes.forEach(c => {
        html += `
            <tr>
                <td><b>${_escapeHtml(c.nombre)}</b></td>
		<td><b>${_escapeHtml(c.direccion)}</b></td>
		<td><b>${_escapeHtml(c.telefono)}</b></td>
		<td><b>${_escapeHtml(c.referencia)}</b></td>
                <td style="text-align:center;">
                    <button onclick="prepararEdicionCliente(${c.id})" style="background:none; border:none; cursor:pointer; font-size:16px; margin-right:10px;">✏️</button>
                    <button onclick="eliminarCliente(${c.id})" style="background:none; border:none; cursor:pointer; font-size:16px; margin-right:10px;">🗑️</button>
                    <button onclick="abrirEstadoCuentaCliente(${c.id})" style="padding:4px 8px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">📋 Estado</button>
                </td>
            </tr>`;
    });
    cont.innerHTML = html + "</tbody></table>";
}

function eliminarCliente(id) {
    if (confirm("¿Eliminar este cliente definitivamente?")) {
        clientes = clientes.filter(c => c.id !== id);
        if (!StorageService.set("clientes", clientes)) {
            console.error("❌ Error eliminando cliente");
            return;
        }
        renderClientes();
    }
}

function prepararEdicionCliente(id) {
    const c = clientes.find(cli => cli.id === id);
    if (!c) return;
    document.getElementById("clienteNombre").value   = c.nombre;
    document.getElementById("clienteDireccion").value = c.direccion || '';
    document.getElementById("clienteTelefono").value = c.telefono || '';
    document.getElementById("clienteReferencia").value = c.referencia || '';
    clienteEditandoId = id;
    window.scrollTo(0, 0);
}

// ===== CUENTAS POR COBRAR =====
function irASeleccionCliente() {
    navA("seleccionarcliente");
    renderResumenVentaCliente();
    cargarClientesSelect();
}

function mostrarInfoCliente() {
    const div = document.getElementById("infoCliente");
    if (!clienteSeleccionado || !div) return;

    div.innerHTML = `
        <div style="background:#f7fafc; padding:15px; border-radius:8px;">
            <strong style="font-size:16px;">${clienteSeleccionado.nombre}</strong><br>
            ${clienteSeleccionado.direccion ? `📍 ${clienteSeleccionado.direccion}<br>` : ''}
            ${clienteSeleccionado.telefono ? `📞 ${clienteSeleccionado.telefono}<br>` : ''}
            ${clienteSeleccionado.referencia ? `📝 ${clienteSeleccionado.referencia}` : ''}
        </div>
    `;
}

function cargarClientesSelect(lista = clientes) {
    const select = document.getElementById("selectCliente");
    if (!select) return;

    select.innerHTML = "<option value=''>-- Selecciona un cliente --</option>";

    lista.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = `${c.nombre} - ${c.telefono || 'Sin teléfono'}`;
        select.appendChild(option);
    });

    select.onchange = () => {
        clienteSeleccionado = clientes.find(c => c.id == select.value);
        mostrarInfoCliente();
    };
}

function filtrarClientes() {
    const texto = document.getElementById("buscarCliente").value.toLowerCase();

    const filtrados = clientes.filter(c =>
        c.nombre.toLowerCase().includes(texto) ||
        (c.telefono || "").includes(texto)
    );

    cargarClientesSelect(filtrados);
}

function abrirModalCliente() {
    const nombre = prompt("Nombre del cliente:");
    if (!nombre) return;

    const telefono = prompt("Teléfono:");
    const nuevo = {
        id: Date.now(),
        nombre,
        telefono,
        fechaRegistro: new Date().toLocaleDateString()
    };

    clientes.push(nuevo);
    if (!StorageService.set("clientes", clientes)) {
        console.error("❌ Error guardando cliente");
        return;
    }

    cargarClientesSelect();
}

function renderResumenVentaCliente() {
    const cont = document.getElementById("resumenVentaCliente");
    if (!cont) return;

    let totalContado = carrito.reduce((sum, p) => sum + ((p.precioContado || 0) * (p.cantidad || 1)), 0);

    // Leer estado del carrito (los elementos están en el div oculto del carrito)
    const metodo = document.getElementById("selMetodoPago")?.value || "contado";
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
    if (enganche < 0) enganche = 0;
    if (enganche > totalContado) enganche = totalContado;
    let saldo = totalContado - enganche;
    const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
    const modoEnganche = document.querySelector('input[name="modoEnganche"]:checked')?.value || "efectivo";
    const cuentaSeleccionada = document.getElementById("selCuentaReceptora")?.value || "";

    const etiquetasMetodo = {
        contado: "💵 Contado",
        transferencia: "🏦 Transferencia / Depósito",
        credito: "💳 Crédito",
        apartado: "📦 Apartado"
    };
    const colorMetodo = { contado:"#166534", transferencia:"#1e40af", credito:"#7c3aed", apartado:"#92400e" };
    const bgMetodo = { contado:"#dcfce7", transferencia:"#dbeafe", credito:"#ede9fe", apartado:"#fef3c7" };

    let detalleProductos = carrito.map(p => {
        const cantidad = p.cantidad || 1;
        const subtotal = (p.precioContado || 0) * cantidad;
        return `<div style="display:flex; justify-content:space-between; margin-bottom:7px; padding:8px 10px; background:#f8f9fa; border-radius:5px; font-size:13px;">
                <span>${p.nombre} <span style="color:#718096;">×${cantidad}</span></span>
                <strong style="color:#27ae60;">${dinero(subtotal)}</strong>
            </div>`;
    }).join("");

    // Detalle financiero según método
    let detalleFinanciero = `<div style="display:flex; justify-content:space-between; margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #e2e8f0;">
            <span style="color:#4a5568;">Subtotal:</span><strong>${dinero(totalContado)}</strong>
        </div>`;

    if (metodo === "contado") {
        detalleFinanciero += `<div style="display:flex; justify-content:space-between; font-size:15px;">
            <span style="font-weight:bold;">💵 Pago en efectivo:</span>
            <strong style="color:#27ae60; font-size:17px;">${dinero(totalContado)}</strong></div>
            <div style="font-size:11px; color:#6b7280; margin-top:4px;">→ Ingresa a caja (efectivo)</div>`;
    } else if (metodo === "transferencia") {
        detalleFinanciero += `<div style="display:flex; justify-content:space-between; font-size:15px;">
            <span style="font-weight:bold;">🏦 Total por transferencia:</span>
            <strong style="color:#1e40af; font-size:17px;">${dinero(totalContado)}</strong></div>
            ${cuentaSeleccionada ? `<div style="font-size:11px; color:#6b7280; margin-top:4px;">→ Cuenta: ${cuentaSeleccionada}</div>` : ''}`;
    } else if (metodo === "apartado") {
        const modoLabel = modoEnganche === "transferencia" ? `🏦 Transferencia${cuentaSeleccionada ? ' ('+cuentaSeleccionada+')' : ''}` : "💵 Efectivo (caja)";
        detalleFinanciero += `<div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#92400e;">💵 Enganche hoy:</span>
                <strong style="color:#92400e;">${dinero(enganche)}</strong></div>
            <div style="font-size:11px; color:#6b7280; margin-bottom:8px;">→ ${modoLabel}</div>
            <div style="display:flex; justify-content:space-between; font-size:15px;">
                <span style="font-weight:bold; color:#4a5568;">📦 Pendiente:</span>
                <strong style="color:#dc2626; font-size:17px;">${dinero(saldo)}</strong></div>`;
    } else if (metodo === "credito") {
        const textoPerio = periodicidad === "semanal" ? "Semanal" : periodicidad === "quincenal" ? "Quincenal" : "Mensual";
        const modoLabel = modoEnganche === "transferencia" ? `🏦 Transferencia${cuentaSeleccionada ? ' ('+cuentaSeleccionada+')' : ''}` : "💵 Efectivo (caja)";
        let planInfo = "";
        if (typeof CalculatorService !== "undefined") {
            try {
                const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo > 0 ? saldo : totalContado, periodicidad);
                const idx = (typeof plazoSeleccionado === "number" && plazoSeleccionado >= 0 && plazoSeleccionado < planes.length) ? plazoSeleccionado : 0;
                const plan = planes[idx];
                if (plan) planInfo = `<div style="background:#ede9fe; padding:8px; border-radius:5px; margin-top:8px; font-size:12px;">
                        📅 ${plan.meses} meses • ${textoPerio} • ${dinero(plan.abono)}/período<br>
                        <strong>Total a pagar: ${dinero(plan.total)}</strong></div>`;
            } catch(e) {}
        }
        detalleFinanciero += `<div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span style="color:#92400e;">💵 Enganche:</span>
                <strong style="color:#92400e;">${dinero(enganche)}</strong></div>
            <div style="font-size:11px; color:#6b7280; margin-bottom:8px;">→ ${modoLabel}</div>
            <div style="display:flex; justify-content:space-between;">
                <span style="color:#7c3aed; font-weight:bold;">💳 A financiar:</span>
                <strong style="color:#7c3aed; font-size:16px;">${dinero(saldo)}</strong></div>${planInfo}`;
    }

    cont.innerHTML = `<div style="background:white; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
            <h3 style="margin:0 0 15px 0; color:#2c3e50;">🧾 Resumen de Compra</h3>
            <div style="background:${bgMetodo[metodo]||'#f3f4f6'}; border-radius:8px; padding:10px 14px; margin-bottom:15px; text-align:center;">
                <span style="font-weight:bold; font-size:14px; color:${colorMetodo[metodo]||'#374151'};">${etiquetasMetodo[metodo]||metodo}</span>
            </div>
            <div style="background:#f0f4f8; padding:12px; border-radius:8px; margin-bottom:15px;">${detalleProductos}</div>
            <div style="background:#f8f9fa; padding:14px; border-radius:8px; border-left:4px solid #3498db;">${detalleFinanciero}</div>
            <p style="font-size:12px; color:#9ca3af; margin:12px 0 0 0; text-align:center;">Selecciona un cliente y confirma la venta →</p>
        </div>`;
}

function renderCuentasXCobrar() {
    const contenedor = document.getElementById("tablaCuentasXCobrar");
    if (!contenedor) return;

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const hoy = new Date();

    if (cuentas.length === 0) {
        contenedor.innerHTML = `<div style="background:#f0fdf4; padding:40px; text-align:center; border-radius:10px;"><p style="font-size:18px; color:#27ae60; font-weight:bold;">✅ ¡No hay cuentas pendientes!</p></div>`;
        return;
    }

    let html = `<div style="overflow-x:auto;"><table class="tabla-admin">
        <thead><tr>
            <th>Cliente / Folio</th>
            <th>Fecha Venta</th>
            <th>Total Venta</th>
            <th>Saldo Actual</th>
            <th>Pagarés</th>
            <th>Estatus</th>
            <th>Acciones</th>
        </tr></thead>
        <tbody>`;

    cuentas.forEach(cuenta => {
        if (cuenta.estado === "Saldado") return;

        const enganche = Number(cuenta.engancheRecibido ?? 0);
        const fechaVenta = new Date(cuenta.fechaVenta).toLocaleDateString();

        const pagaresDelFolio = pagaresSistema.filter(p => p.folio === cuenta.folio);
        // CORRECCIÓN: Filtramos tanto Pendientes como Parciales
        const pagaresPendientes = pagaresDelFolio.filter(p => p.estado === "Pendiente" || p.estado === "Parcial");
        
        // CORRECCIÓN: Sumar el saldo real restando lo que ya se abonó en los parciales
        const saldo = pagaresPendientes.reduce((s, p) => {
            if (p.estado === "Parcial") return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
            return s + (p.monto || 0);
        }, 0);

        const color = saldo > 0 ? "#27ae60" : "#999";
        const pagaresVencidos = pagaresPendientes.filter(p => new Date(p.fechaVencimiento) < hoy);
        const pagaresTexto = pagaresPendientes.length > 0
            ? `<span style="color:#374151;">${pagaresPendientes.length} pendiente(s)</span>`
            : `<span style="color:#27ae60;">✅ Al corriente</span>`;
        const vencidosTexto = pagaresVencidos.length > 0
            ? `<br><span style="color:#dc2626; font-weight:bold; font-size:12px;">⚠️ ${pagaresVencidos.length} vencido(s)</span>`
            : '';

        html += `<tr>
            <td><strong>${cuenta.nombre}</strong><br><small style="color:#718096;">${cuenta.folio}</small></td>
            <td>${fechaVenta}</td>
            <td>${dinero(cuenta.totalContadoOriginal ?? 0)}${enganche > 0 ? `<br><small style="color:#27ae60;">✅ Enganche: ${dinero(enganche)}</small>` : ''}</td>
            <td style="font-weight:bold; color:${color};">${dinero(saldo)}</td>
            <td>${pagaresTexto}${vencidosTexto}</td>
            <td>${cuenta.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</td>
            <td style="white-space:nowrap;">
                <button onclick="abrirModalAbonoAvanzado('${cuenta.folio}')" style="padding:6px 10px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;">💰 Abonar</button>
                <button onclick="abrirEstadoCuentaFolio('${cuenta.folio}')" style="padding:6px 10px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;">📋 Estado</button>
                <button onclick="abrirHistorialAbonos('${cuenta.folio}')" style="padding:6px 10px; background:#7c3aed; color:white; border:none; border-radius:4px; cursor:pointer;">📜 Historial</button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

// ==========================================
// 1. REEMPLAZA renderCobranzaEsperada
// ==========================================
function renderCobranzaEsperada() {
    const contenedor = document.getElementById("escaleraCobranza");
    if (!contenedor) return;

    const pagares = StorageService.get("pagaresSistema", []);
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const hoy = new Date();

    let posMeses = {};
    for (let i = 0; i < 12; i++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const clave = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
        posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [] };
    }

    // A. CALCULAR LO ESPERADO (Solo lo que realmente falta por cobrar)
    pagares.forEach(p => {
        if (p.estado === "Pendiente" || p.estado === "Parcial") {
            const fechaPago = new Date(p.fechaVencimiento);
            const clave = fechaPago.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
            
            if (!posMeses[clave]) {
                posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [] };
            }

            // Calculamos lo que falta (ej. si era de 1000 y pagó 400, solo esperamos 600)
            const montoRestante = (p.monto || 0) - (p.montoAbonado || 0);

            if (montoRestante > 0) {
                posMeses[clave].esperado += montoRestante;
                posMeses[clave].total += montoRestante;
                posMeses[clave].pagaresDetalle.push(p);
                
                if (fechaPago < hoy) {
                    posMeses[clave].vencidos += montoRestante;
                }
            }
        }
    });

    // B. CALCULAR RECAUDACIÓN REAL (El dinero que realmente entró en ese mes)
    cuentas.forEach(cuenta => {
        if (cuenta.abonos && Array.isArray(cuenta.abonos)) {
            cuenta.abonos.forEach(abono => {
                // Parsear la fecha del abono para saber en qué mes cayó el dinero
                const partes = abono.fecha.split('/');
                let fechaEfectiva = hoy;
                if (partes.length === 3) {
                    fechaEfectiva = new Date(partes[2], partes[1] - 1, partes[0]);
                }

                const clave = fechaEfectiva.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });

                if (!posMeses[clave]) {
                    posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [] };
                }

                posMeses[clave].recaudado += abono.monto;
                posMeses[clave].total += abono.monto;
            });
        }
    });

    // C. DIBUJAR LAS TARJETAS (Tu mismo diseño)
    let html = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">`;

    Object.entries(posMeses).forEach(([mes, datos]) => {
        if (datos.total === 0) return; // Si no hay nada esperado ni recaudado, se oculta

        // Calcular porcentaje visual
        const baseCalculo = datos.esperado + datos.recaudado;
        const porcentajeRecaudo = baseCalculo > 0 ? (datos.recaudado / baseCalculo * 100).toFixed(1) : 0;
        
        const colorMes = datos.vencidos > 0 ? "#fee2e2" : "#f0fdf4";
        const iconoMes = datos.vencidos > 0 ? "🔴" : "✅";
        const mesEncoded = encodeURIComponent(mes);

        html += `<div style="background:${colorMes}; padding:20px; border-radius:10px; border-left:5px solid ${datos.vencidos > 0 ? '#dc2626' : '#27ae60'}; cursor:pointer;" onclick="abrirDetalleCobranza('${mesEncoded}')">
            <h4 style="margin:0 0 15px 0; color:#2c3e50;">${iconoMes} ${mes}</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><small style="color:#718096;">Falta por Cobrar</small><br><strong style="font-size:18px; color:#2c3e50;">${dinero(datos.esperado)}</strong></div>
                <div><small style="color:#718096;">Real Recaudado</small><br><strong style="font-size:18px; color:#27ae60;">${dinero(datos.recaudado)}</strong></div>
            </div>
            <div style="background:white; border-radius:8px; overflow:hidden; height:8px; margin-bottom:10px;">
                <div style="background:#27ae60; height:100%; width:${porcentajeRecaudo > 100 ? 100 : porcentajeRecaudo}%;"></div>
            </div>
            <small style="color:#718096;">${porcentajeRecaudo}% del flujo captado</small>
            ${datos.vencidos > 0 ? `<p style="color:#dc2626; font-weight:bold; margin:10px 0 0 0;">⚠️ ${dinero(datos.vencidos)} VENCIDO</p>` : ''}
            <p style="color:#718096; font-size:12px; margin:8px 0 0 0;">👆 Clic para ver detalle</p>
        </div>`;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
}

// ==========================================
// 2. REEMPLAZA abrirDetalleCobranza
// ==========================================
function abrirDetalleCobranza(mesKeyEncoded) {
    const mes = decodeURIComponent(mesKeyEncoded);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const hoy = new Date();

    const pagaresMes = pagares.filter(p => {
        const fechaPago = new Date(p.fechaVencimiento);
        const clave = fechaPago.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
        return clave === mes;
    });

    if (pagaresMes.length === 0) {
        alert("No hay pagarés para este mes.");
        return;
    }

    let filasHtml = pagaresMes.map(p => {
        const venc = new Date(p.fechaVencimiento);
        const diasAtraso = p.estado !== "Pagado" && venc < hoy ? Math.floor((hoy - venc) / (1000 * 60 * 60 * 24)) : 0;
        
        // Etiqueta visual clara del estado
        let atrasoHtml = '';
        if (p.estado === "Pagado") {
            atrasoHtml = `<span style="color:#27ae60; font-weight:bold; font-size:12px;">✅ Pagado</span>`;
        } else if (diasAtraso > 0) {
            atrasoHtml = `<span style="color:#dc2626; font-weight:bold; font-size:12px;">⚠️ Vencido (${diasAtraso}d)</span>`;
        } else {
            atrasoHtml = `<span style="color:#92400e; font-weight:bold; font-size:12px;">⏳ Pendiente</span>`;
        }

        const cuenta = cuentas.find(c => c.folio === p.folio);
        const clienteNombre = cuenta ? cuenta.nombre : (p.clienteNombre || p.folio || '-');
        const articulos = cuenta ? (cuenta.articulos || []) : [];
        const articulosHtml = articulos.length > 0
            ? articulos.map(a => `<small>${a.nombre || a.productoNombre || '-'} ×${a.cantidad || 1}</small>`).join(', ')
            : '<small style="color:#999;">Sin detalle</small>';

        return `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px;">${p.folio || '-'}</td>
            <td style="padding:8px;"><strong>${clienteNombre}</strong></td>
            <td style="padding:8px;">${p.fechaVencimiento || '-'}</td>
            <td style="padding:8px; text-align:right; font-weight:bold;">${dinero(p.monto || 0)}</td>
            <td style="padding:8px; text-align:center;">${atrasoHtml}</td>
            <td style="padding:8px; font-size:12px; color:#4a5568;">${articulosHtml}</td>
        </tr>`;
    }).join('');

    const modalHTML = `
        <div data-modal="detalle-cobranza" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:800px; max-height:90vh; overflow-y:auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h2 style="margin:0;">📅 Detalle Cobranza — ${mes}</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-cobranza&quot;]')?.remove();" style="background:none; border:none; font-size:22px; cursor:pointer; color:#6b7280;">✕</button>
                </div>
                <div style="overflow-x:auto;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                        <thead><tr style="background:#f3f4f6;">
                            <th style="padding:8px; text-align:left;">Folio</th>
                            <th style="padding:8px; text-align:left;">Cliente</th>
                            <th style="padding:8px; text-align:left;">Vencimiento</th>
                            <th style="padding:8px; text-align:right;">Monto</th>
                            <th style="padding:8px; text-align:center;">Estado</th>
                            <th style="padding:8px; text-align:left;">Productos</th>
                        </tr></thead>
                        <tbody>${filasHtml}</tbody>
                    </table>
                </div>
                <div style="margin-top:20px; text-align:right;">
                    <button onclick="document.querySelector('[data-modal=&quot;detalle-cobranza&quot;]')?.remove();" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">✕ Cerrar</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function exportarCobranzaEsperada() {
    const pagares = StorageService.get("pagaresSistema", []);
    let csv = "Folio,Fecha Vencimiento,Monto,Estado,Dias Atraso\n";
    pagares.forEach(p => {
        csv += `${p.folio},${p.fechaVencimiento},${p.monto},${p.estado},${p.diasAtrasoActual}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cobranza_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
}

// ===== HELPERS: COMBOS DE CUENTA ORIGEN/DESTINO =====
function _buildCuentaOrigen(idSufijo) {
    return `
        <div class="campo" style="margin-bottom:10px;">
            <label style="font-weight:bold; color:#374151;">💳 Medio de pago:</label>
            <select id="medioPago_${idSufijo}" onchange="_actualizarCuentaEspecifica('${idSufijo}')"
                    style="padding:10px; font-size:15px; border:2px solid #27ae60; border-radius:6px; width:100%; margin-top:4px;">
                <option value="efectivo">💵 Efectivo</option>
                <option value="transferencia">🏦 Transferencia bancaria</option>
                <option value="tarjeta_credito">💳 Tarjeta de crédito</option>
            </select>
        </div>
        <div id="divCuentaEspecifica_${idSufijo}" style="display:none; margin-bottom:10px;">
            <label style="font-weight:bold; color:#374151; display:block; margin-bottom:4px;">Cuenta específica:</label>
            <select id="cuentaEspecifica_${idSufijo}"
                    style="padding:10px; font-size:15px; border:2px solid #3498db; border-radius:6px; width:100%;">
            </select>
        </div>`;
}

function _actualizarCuentaEspecifica(idSufijo) {
    const medio = document.getElementById('medioPago_' + idSufijo)?.value;
    const divCuenta = document.getElementById('divCuentaEspecifica_' + idSufijo);
    const selCuenta = document.getElementById('cuentaEspecifica_' + idSufijo);
    if (!divCuenta || !selCuenta) return;
    const tarjetas = (typeof tarjetasConfig !== 'undefined' && tarjetasConfig) || StorageService.get('tarjetasConfig', []);
    if (medio === 'efectivo') {
        divCuenta.style.display = 'none';
        selCuenta.innerHTML = '<option value="caja">💵 Caja / Efectivo</option>';
    } else if (medio === 'transferencia') {
        const cuentasDebito = tarjetas.filter(t => t.tipo === 'debito');
        if (cuentasDebito.length === 0) {
            divCuenta.style.display = 'none';
            selCuenta.innerHTML = '<option value="caja">Sin cuentas débito registradas</option>';
        } else {
            divCuenta.style.display = 'block';
            selCuenta.innerHTML = cuentasDebito.map(b => `<option value="${b.banco}">🏦 ${b.banco} Débito</option>`).join('');
        }
    } else if (medio === 'tarjeta_credito') {
        const tarjetasCredito = tarjetas.filter(t => !t.tipo || t.tipo === 'credito');
        if (tarjetasCredito.length === 0) {
            divCuenta.style.display = 'none';
            selCuenta.innerHTML = '<option value="">Sin tarjetas crédito registradas</option>';
        } else {
            divCuenta.style.display = 'block';
            selCuenta.innerHTML = tarjetasCredito.map(b => `<option value="${b.banco}">💳 ${b.banco} Crédito</option>`).join('');
        }
    }
}

function _getCuentaSeleccionada(idSufijo) {
    const medioPago = document.getElementById('medioPago_' + idSufijo)?.value || 'efectivo';
    const cuentaEspecifica = document.getElementById('cuentaEspecifica_' + idSufijo)?.value || '';
    let cuentaId, etiqueta;
    if (medioPago === 'efectivo') {
        cuentaId = 'caja';
        etiqueta = '💵 Efectivo';
    } else if (medioPago === 'transferencia') {
        cuentaId = cuentaEspecifica || 'caja';
        etiqueta = cuentaEspecifica ? `🏦 ${cuentaEspecifica} Débito` : '💵 Efectivo';
    } else if (medioPago === 'tarjeta_credito') {
        cuentaId = cuentaEspecifica || '';
        etiqueta = cuentaEspecifica ? `💳 ${cuentaEspecifica} Crédito` : '💳 Tarjeta';
    } else {
        cuentaId = 'caja';
        etiqueta = '💵 Efectivo';
    }
    return { medioPago, cuentaId, etiqueta };
}

function abrirModalAbonoAvanzado(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return alert("Cuenta no encontrada.");

    const todosPagares = pagares
        .filter(p => p.folio === folio)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    
    // CORRECCIÓN: Filtrar y calcular sumando Parciales
    const pagaresCliente = todosPagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial');
    const saldo = pagaresCliente.reduce((s, p) => {
        if (p.estado === "Parcial") return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
        return s + (p.monto || 0);
    }, 0);
    
    const original = cuenta.totalContadoOriginal ?? 0;
    const fechaVenta = new Date(cuenta.fechaVenta);
    const hoy = new Date();
    const diasDesdeVenta = Math.floor((hoy - fechaVenta) / (1000 * 60 * 60 * 24));
    const aplicaPoliticaContado = diasDesdeVenta <= 30; // Primeros 30 días

    const articulos = cuenta.articulos || [];
    const articulosHTML = articulos.length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">🛒 Artículos de la Venta:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:14px;">
                <thead><tr style="background:#f3f4f6;">
                    <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e7eb;">Producto</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">Cant.</th>
                </tr></thead>
                <tbody>
                    ${articulos.map(a => `<tr>
                        <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${a.nombre || a.productoNombre || '-'}</td>
                        <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #f3f4f6;">${a.cantidad || 1}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '';

    const pagaresHTML = todosPagares.length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">📋 Pagarés del Folio:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:13px;">
                <thead><tr style="background:#fef3c7;">
                    <th style="padding:5px 7px; text-align:left; border-bottom:1px solid #e5e7eb;">#</th>
                    <th style="padding:5px 7px; text-align:left; border-bottom:1px solid #e5e7eb;">Fecha Vencimiento</th>
                    <th style="padding:5px 7px; text-align:right; border-bottom:1px solid #e5e7eb;">Monto Restante</th>
                    <th style="padding:5px 7px; text-align:center; border-bottom:1px solid #e5e7eb;">Estado</th>
                    <th style="padding:5px 7px; text-align:center; border-bottom:1px solid #e5e7eb;">Días Atraso</th>
                </tr></thead>
                <tbody>
                    ${todosPagares.map((p, i) => {
                        const esPagado = p.estado === 'Pagado' || p.estado === 'Cancelado' || p.estado.includes('Liquidado');
                        
                        // CORRECCIÓN: Cálculo de vista del pagaré
                        let montoDisplay = p.monto || p.abono || 0;
                        if (esPagado) {
                            montoDisplay = 0;
                        } else if (p.estado === 'Parcial') {
                            montoDisplay = Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
                        }

                        const fechaVenc = new Date(p.fechaVencimiento);
                        const diasAtraso = !esPagado && fechaVenc < hoy ? Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24)) : 0;
                        const esVencido = !esPagado && diasAtraso > 0;
                        const rowStyle = esPagado ? 'background:#f0fdf4; color:#6b7280;' : (esVencido ? 'background:#fff1f2;' : '');
                        
                        let estadoBadge = '';
                        if (esPagado) estadoBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 7px; border-radius:9999px; font-size:11px;">Pagado</span>`;
                        else if (p.estado === 'Parcial') estadoBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:9999px; font-size:11px;">Parcial</span>`;
                        else if (esVencido) estadoBadge = `<span style="background:#fee2e2; color:#dc2626; padding:2px 7px; border-radius:9999px; font-size:11px;">Vencido</span>`;
                        else estadoBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 7px; border-radius:9999px; font-size:11px;">Pendiente</span>`;

                        return `<tr style="${rowStyle}">
                            <td style="padding:5px 7px; border-bottom:1px solid #f3f4f6;">${i + 1}</td>
                            <td style="padding:5px 7px; border-bottom:1px solid #f3f4f6;">${p.fechaVencimiento || p.vencimiento || '-'}</td>
                            <td style="padding:5px 7px; text-align:right; border-bottom:1px solid #f3f4f6;">${dinero(montoDisplay)}</td>
                            <td style="padding:5px 7px; text-align:center; border-bottom:1px solid #f3f4f6;">${estadoBadge}</td>
                            <td style="padding:5px 7px; text-align:center; border-bottom:1px solid #f3f4f6; color:${esVencido ? '#dc2626' : 'inherit'}; font-weight:${esVencido ? 'bold' : 'normal'};">${esVencido ? diasAtraso + ' días' : '-'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>` : '';

    let modalHTML = `
        <div data-modal="abono-avanzado" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-top:0;">💰 Registrar Abono - ${cuenta.nombre}</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div><small style="color:#4b5563;">Saldo Actual</small><br><strong style="font-size:20px; color:#27ae60;">${dinero(saldo)}</strong></div>
                        <div><small style="color:#4b5563;">Pagarés Activos</small><br><strong style="font-size:20px; color:#e74c3c;">${pagaresCliente.length}</strong></div>
                    </div>
                </div>

                ${articulosHTML}
                ${pagaresHTML}

                <div style="background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:15px; border:1px solid #e2e8f0;">
                    <strong style="color:#374151; display:block; margin-bottom:10px;">💳 ¿Cómo se recibe el pago?</strong>
                    ${_buildCuentaOrigen('abono')}
                </div>

                <div class="campo" style="margin-bottom:20px;">
                    <label>Monto del Abono ($):</label>
                    <input type="number" id="montoAbono" placeholder="0.00" min="0" max="${saldo}" 
                           style="padding:12px; font-size:16px; border:2px solid #3498db; border-radius:6px; width:100%;">
                </div>

                ${aplicaPoliticaContado ? `
                    <div style="background:#fffbeb; padding:15px; border-radius:8px; border-left:5px solid #f59e0b; margin-bottom:20px;">
                        <strong style="color:#92400e;">💡 Precio de Contado Disponible (Primeros 30 días)</strong>
                        <p style="margin:10px 0 0 0; font-size:14px; color:#78350f;">
                            Total original pactado de contado: <strong>${dinero(original)}</strong>
                        </p>
                    </div>
                ` : ''}

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarAbonoAvanzado('${folio}', ${original}, ${saldo}, ${aplicaPoliticaContado})" 
                            style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ Procesar Abono
                    </button>
                    <button onclick="document.querySelector('[data-modal=&quot;abono-avanzado&quot;]')?.remove();" 
                            style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function evaluarPoliticaLiquidacion(folio, montoAbono) {

    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresFolio = pagares.filter(p => p.folio === folio);

    if (!pagaresFolio.length) return null;

    // saldo actual real
    const pendientes = pagaresFolio.filter(p => p.estado !== "Pagado");
    const saldoActual = pendientes.reduce((s, p) => s + p.monto, 0);

    // total ya pagado
    const pagados = pagaresFolio.filter(p => p.estado === "Pagado");
    const totalPagado = pagados.reduce((s, p) => s + p.monto, 0);

    const totalConAbono = totalPagado + montoAbono;

    // reconstruir saldo base (como ya haces en ticket)
    const saldoBase = saldoActual + totalPagado;

    // usar TU lógica de planes
    const planes = CalculatorService.calcularCreditoConPeriodicidad
        ? CalculatorService.calcularCreditoConPeriodicidad(saldoBase, "semanal")
        : CalculatorService.calcularCredito(saldoBase);

    // buscar plan alcanzado
    let planAplicable = null;

    for (let plan of planes) {
        if (totalConAbono >= plan.total) {
            planAplicable = plan;
            break;
        }
    }

    if (!planAplicable) return null;

    const montoCorrecto = planAplicable.total - totalPagado;

    return {
        aplica: true,
        montoCorrecto,
        ahorro: saldoActual - montoCorrecto,
        plan: planAplicable
    };
}
function confirmarPoliticaAntesDeGuardar(folio, monto, continuar) {

    const evalPol = evaluarPoliticaLiquidacion(folio, monto);

    // No aplica → sigue normal
    if (!evalPol || !evalPol.aplica) {
        continuar(false);
        return;
    }

    // CASO 1: el monto ya coincide EXACTO → aplicar automático
    if (Math.abs(monto - evalPol.montoCorrecto) < 0.01) {
        continuar(true, evalPol);
        return;
    }

    // CASO 2: el cliente puede pagar menos → sugerir ajuste
    if (monto > evalPol.montoCorrecto) {

        if (!confirm(
            `💡 LIQUIDACIÓN INTELIGENTE\n\n` +
            `El cliente puede liquidar con:\n${dinero(evalPol.montoCorrecto)}\n\n` +
            `Ahorro: ${dinero(evalPol.ahorro)}\n\n` +
            `¿Deseas ajustar el monto automáticamente?`
        )) {
            continuar(false);
            return;
        }

        continuar(true, evalPol);
        return;
    }

    // CASO 3: le falta para liquidar → solo sugerencia visual (no bloquear)
    continuar(false);
}

function aplicarPoliticaLiquidacion(folio) {

    let pagares = StorageService.get("pagaresSistema", []);

    pagares = pagares.map(p => {
        if (p.folio === folio && p.estado !== "Pagado") {
            return {
                ...p,
                estado: "Liquidado por política"
            };
        }
        return p;
    });

    StorageService.set("pagaresSistema", pagares);
}


function procesarAbonoAvanzado(folio, montoOriginal, saldoActual, aplicaPoliticaContado) {
    const montoAbonoInput = parseFloat(document.getElementById("montoAbono").value);
    const { medioPago, cuentaId, etiqueta } = _getCuentaSeleccionada('abono');

    if (isNaN(montoAbonoInput) || montoAbonoInput <= 0) {
        alert("Ingresa un monto válido.");
        return;
    }

    if (montoAbonoInput > saldoActual) {
        alert("El abono no puede ser mayor al saldo.");
        return;
    }

    let montoFinal = montoAbonoInput;
    let liquidacionPorPolitica = false;
    
    // Obtenemos historial de pagos para saber cuánto le falta en realidad
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresFolio = pagares.filter(p => p.folio === folio);
    const pagados = pagaresFolio.filter(p => p.estado === "Pagado" || p.estado === "Cancelado");
    const totalYaPagado = pagados.reduce((s, p) => s + (p.montoAbonado || p.monto), 0);
    
    // CORRECCIÓN: Diálogo para Política de 30 Días (Precio de Contado)
    if (aplicaPoliticaContado) {
        const restanteContado = montoOriginal - totalYaPagado;
        if (restanteContado > 0 && montoAbonoInput >= restanteContado) {
            if (confirm(`💡 EL CLIENTE ESTÁ EN PERIODO DE GRACIA (30 DÍAS)\n\nPuede liquidar la cuenta completa por el precio de contado pagando solo: ${dinero(restanteContado)}\n\n¿Deseas aplicar esta política, cobrar ${dinero(restanteContado)} y condonar los intereses restantes?`)) {
                montoFinal = restanteContado;
                liquidacionPorPolitica = true;
            }
        }
    }

    // CORRECCIÓN: Diálogo para Política de Liquidación Inteligente (Más de 30 días)
    if (!liquidacionPorPolitica) {
        const evalPol = evaluarPoliticaLiquidacion(folio, montoAbonoInput);
        if (evalPol && evalPol.aplica) {
            if (confirm(`💡 LIQUIDACIÓN INTELIGENTE (SALTO DE PLAN)\n\nEl abono alcanza para cubrir un plan más corto. El cliente puede liquidar su cuenta con: ${dinero(evalPol.montoCorrecto)}\n(Se le ahorrarán ${dinero(evalPol.ahorro)}).\n\n¿Deseas aplicar el descuento y dar por liquidada la cuenta?`)) {
                montoFinal = evalPol.montoCorrecto;
                liquidacionPorPolitica = true;
            }
        }
    }

    // ============================================
    // APLICAR ABONO (CASCADA NORMAL)
    // ============================================
    const _todosLosPagares = StorageService.get("pagaresSistema", []);
    let _pagaresDelFolio = _todosLosPagares
        .filter(p => p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial"))
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));

    let _montoRestante = montoFinal;
    const _pagaresCubiertos = [];
    let _pagareParcial = null;

    for (const pag of _pagaresDelFolio) {
        const _montoNecesario = (pag.estado === 'Parcial') 
            ? Math.max(0, pag.monto - (pag.montoAbonado || 0))
            : pag.monto;

        if (_montoRestante >= _montoNecesario - 0.01) {
            _pagaresCubiertos.push({ ...pag });
            _montoRestante -= _montoNecesario;
        } else {
            if (_montoRestante > 0.01) {
                _pagareParcial = { ...pag, montoAplicado: _montoRestante };
                _montoRestante = 0;
            }
            break;
        }
    }

    // Actualizamos Estados en Memoria
    const fechaAbono = new Date().toLocaleDateString("es-MX");
    let _todosActualizados = _todosLosPagares.map(p => {
        if (_pagaresCubiertos.find(pc => pc.id === p.id)) {
            return { ...p, estado: "Pagado", fechaAbono, montoAbonado: p.monto };
        }
        if (_pagareParcial && p.id === _pagareParcial.id) {
            return { ...p, estado: "Parcial", fechaAbono, montoAbonado: (p.montoAbonado || 0) + _pagareParcial.montoAplicado };
        }
        return p;
    });

    // ============================================
    // CERRAR PAGARÉS SOBRANTES SI APLICÓ POLÍTICA
    // ============================================
    if (liquidacionPorPolitica) {
        _todosActualizados = _todosActualizados.map(p => {
            // Cancelamos los pagarés que quedaron pendientes tras cubrir el montoFinal
            if (p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial")) {
                return { ...p, estado: "Cancelado", nota: "Liquidado por política" };
            }
            return p;
        });
    }

    StorageService.set("pagaresSistema", _todosActualizados);

    // ============================================
    // ACTUALIZAR CUENTA Y CAJA
    // ============================================
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const idxCuenta = cuentas.findIndex(c => c.folio === folio);
    let nuevoSaldoReal = 0;

    if (idxCuenta !== -1) {
        const cuenta = cuentas[idxCuenta];
        cuenta.abonos = cuenta.abonos || [];
        cuenta.abonos.push({
            fecha: new Date().toLocaleDateString(),
            monto: montoFinal,
            cuentaId,
            medioPago,
            etiquetaCuenta: etiqueta,
            vendedorId: cuenta.vendedorId || null
        });

        // Recalcular saldo exacto de Cuentas por Cobrar
        const _pagaresAct = StorageService.get("pagaresSistema", []);
        nuevoSaldoReal = _pagaresAct
            .filter(p => p.folio === folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
            .reduce((s, p) => {
                if (p.estado === 'Parcial') return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
                return s + (p.monto || 0);
            }, 0);

        cuenta.saldoActual = nuevoSaldoReal;
        
        // Liquidamos la cuenta si el saldo llegó a 0
        if (nuevoSaldoReal <= 0.01) { 
            cuenta.estado = "Saldado";
            cuenta.saldoActual = 0;
            nuevoSaldoReal = 0;
        }

        cuentas[idxCuenta] = cuenta;
        StorageService.set("cuentasPorCobrar", cuentas);

        // Ingreso a Caja
        let movimientos = StorageService.get("movimientosCaja", []);
        movimientos.push({
            id: Date.now(),
            folio,
            fecha: new Date().toLocaleDateString(),
            monto: montoFinal,
            tipo: "ingreso",
            concepto: `Abono a ${cuenta.nombre} - ${folio}`,
            referencia: "Abono",
            cuenta: cuentaId,
            medioPago,
            etiquetaCuenta: etiqueta
        });
        StorageService.set("movimientosCaja", movimientos);
    }

    // ============================================
    // GENERAR TICKET Y CERRAR MODAL
    // ============================================
    const _cuentaData = StorageService.get("cuentasPorCobrar", []).find(c => c.folio === folio);
    const _pagaresRestantes = _todosActualizados.filter(p => p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial"));
    
    const _pagaresCubiertosTicket = [..._pagaresCubiertos];
    if (_pagareParcial) {
        _pagaresCubiertosTicket.push({ ..._pagareParcial, parcial: true });
    }

    generarTicketAbonoTermico({
        folio,
        cliente: {
            nombre: _cuentaData?.nombre || folio,
            telefono: _cuentaData?.telefono || '',
            direccion: _cuentaData?.direccion || ''
        },
        montoAbono: montoFinal,
        nuevoSaldo: nuevoSaldoReal,
        fecha: new Date().toLocaleDateString("es-MX"),
        metodoCobro: medioPago || "efectivo",
        cuentaDestino: etiqueta || "efectivo",
        pagaresCubiertos: _pagaresCubiertosTicket,
        pagaresRestantes: _pagaresRestantes,
        articulos: _cuentaData?.articulos || [],
        totalVenta: _cuentaData?.totalContadoOriginal || 0,
        enganche: _cuentaData?.engancheRecibido || 0
    });

    alert(`✅ Abono registrado exitosamente por ${dinero(montoFinal)}.`);
    document.querySelector('[data-modal="abono-avanzado"]')?.remove();
    renderCuentasXCobrar();
}

function generarTicketAbono(datosAbono) {
    const { folio, folioAbono, fecha, cliente, montoAbono, saldoAnterior, nuevoSaldo,
        pagaresAfectados, totalPagares, pagaresPendientes, diasAtrasoTotal,
        etiquetaCuenta, empresa } = datosAbono;

    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dineroFmt = v => '$' + Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const pagaresHTML = pagaresAfectados.length > 0
        ? pagaresAfectados.map((p, i) => {
            const monto = p.monto || p.abono || 0;
            const fechaPag = esc(p.fechaVencimiento || p.vencimiento || '-');
            if (p.cubierto) {
                return `<tr style="background:#f0fdf4;">
                    <td style="padding:3px 5px;">#${i + 1}</td>
                    <td style="padding:3px 5px;">${fechaPag}</td>
                    <td style="padding:3px 5px; text-align:right; text-decoration:line-through; color:#6b7280;">${dineroFmt(monto)}</td>
                    <td style="padding:3px 5px; text-align:center; color:#27ae60;">✓</td>
                </tr>`;
            } else {
                const aplicado = p.montoAplicado || 0;
                return `<tr style="background:#fffbeb;">
                    <td style="padding:3px 5px;">#${i + 1}</td>
                    <td style="padding:3px 5px;">${fechaPag}</td>
                    <td style="padding:3px 5px; text-align:right;">${dineroFmt(monto)}</td>
                    <td style="padding:3px 5px; text-align:center; color:#f59e0b;">~${dineroFmt(aplicado)}</td>
                </tr>`;
            }
        }).join('')
        : `<tr><td colspan="4" style="padding:5px; text-align:center; color:#6b7280;">Sin pagarés registrados</td></tr>`;

    const mensajeEstado = diasAtrasoTotal === 0 && pagaresPendientes === 0
        ? `<div style="color:#27ae60; font-weight:bold; text-align:center; padding:6px 0;">✅ ¡Gracias! Está al corriente con sus pagos.</div>`
        : `<div style="color:#f59e0b; text-align:center; padding:6px 0;">⚠️ Aún tiene ${pagaresPendientes} pagaré(s) pendiente(s).<br>Le recordamos mantener su cuenta al corriente.</div>`;

    const ticketHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo de Abono ${esc(folioAbono)}</title>
    <style>
        @page { size: 80mm auto; margin: 0; }
        body {
            font-family: 'Courier New', monospace;
            font-size: 11px;
            width: 72mm;
            margin: 4mm auto;
            color: #000;
        }
        .centro { text-align: center; }
        .negrita { font-weight: bold; }
        hr { border: none; border-top: 1px dashed #333; margin: 6px 0; }
        .monto-grande { font-size: 20px; font-weight: bold; text-align: center; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #e8e8e8; padding: 3px 5px; text-align: left; }
        .fila-total { font-weight: bold; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body>
<div id="ticket-contenido">
    <div class="centro">
        <img src="img/logo.png" style="width:60px; height:60px; object-fit:contain;"
             onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
        <div class="negrita" style="font-size:14px; margin-top:4px;">${esc(empresa.nombre)}</div>
        <div>${esc(empresa.direccion)}</div>
        <div>Tel. ${esc(empresa.telefono)}</div>
    </div>
    <hr>
    <div class="centro negrita" style="font-size:13px;">── RECIBO DE PAGO ──</div>
    <div>Folio: <span class="negrita">${esc(folioAbono)}</span></div>
    <div>Fecha: <span class="negrita">${esc(fecha)}</span></div>
    <hr>
    <div class="negrita">CLIENTE</div>
    <div>${esc(cliente.nombre)}</div>
    ${cliente.telefono ? `<div>Tel: ${esc(cliente.telefono)}</div>` : ''}
    <div>Venta: ${esc(folio)}</div>
    <hr>
    <div class="negrita">PAGARÉ(S) CUBIERTO(S)</div>
    <table>
        <thead><tr>
            <th>#</th><th>Vcto.</th><th style="text-align:right;">Monto</th><th style="text-align:center;">Est.</th>
        </tr></thead>
        <tbody>${pagaresHTML}</tbody>
    </table>
    <hr>
    <div class="negrita">ABONO RECIBIDO:</div>
    <div class="monto-grande">${dineroFmt(montoAbono)}</div>
    <div style="display:flex; justify-content:space-between;">
        <span>Saldo anterior:</span><span>${dineroFmt(saldoAnterior)}</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
        <span>Nuevo saldo:</span><span class="negrita">${dineroFmt(nuevoSaldo)}</span>
    </div>
    <div style="display:flex; justify-content:space-between;">
        <span>Forma de pago:</span><span>${esc(etiquetaCuenta)}</span>
    </div>
    <hr>
    ${mensajeEstado}
    <hr>
    <div style="text-align:center; margin-top:10px;">
        <div style="border-top:1px solid #333; width:70%; margin:0 auto 4px auto;"></div>
        <div class="negrita">FIRMA DEL CLIENTE</div>
    </div>
    <div class="centro" style="margin-top:12px;">Gracias por su preferencia</div>
</div>
<div class="no-print" style="text-align:center; padding:15px; background:#f8f9fa; border-top:1px dashed #333; margin-top:10px;">
    <button onclick="window.print()" 
            style="margin:4px; padding:8px 14px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
        🖨️ Imprimir
    </button>
    <button onclick="exportarTicketImagen()" 
            style="margin:4px; padding:8px 14px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
        📷 Guardar como Imagen
    </button>
    <button onclick="exportarTicketPDF()" 
            style="margin:4px; padding:8px 14px; background:#7c3aed; color:white; border:none; border-radius:6px; cursor:pointer; font-size:13px;">
        📄 Guardar como PDF
    </button>
</div>
<script>
function exportarTicketImagen() {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = function() {
        html2canvas(document.getElementById('ticket-contenido')).then(function(canvas) {
            const link = document.createElement('a');
            link.download = 'recibo-abono.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    };
    script.onerror = function() { window.print(); };
    document.head.appendChild(script);
}
function exportarTicketPDF() {
    window.print();
}
<\/script>
</body>
</html>`;

    const ventana = window.open('', '_blank');
    if (!ventana) {
        alert("⚠️ Habilita las ventanas emergentes para ver el recibo.");
        return;
    }
    ventana.document.write(ticketHTML);
    ventana.document.close();
    ventana.focus();
}

function abrirModalNuevoCliente() {
    const modalHTML = `
        <div data-modal="nuevo-cliente" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-top:0;">➕ Nuevo Cliente</h2>
                
                <div class="campo" style="margin-bottom:15px;">
                    <label>Nombre Completo *</label>
                    <input type="text" id="nuevoCliNombre" placeholder="Juan Pérez" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>

                <div class="campo" style="margin-bottom:15px;">
                    <label>Dirección</label>
                    <input type="text" id="nuevoCliDireccion" placeholder="Calle Principal 123, Apt 4" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>

                <div class="campo" style="margin-bottom:15px;">
                    <label>Teléfono</label>
                    <input type="tel" id="nuevoCliTelefono" placeholder="555-1234567" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>

                <div class="campo" style="margin-bottom:20px;">
                    <label>Referencia</label>
                    <textarea id="nuevoCliReferencia" placeholder="Ej: Cerca del parque, casa azul" 
                              style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; height:60px;"></textarea>
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="guardarClienteDesdeModal()" 
                            style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ Guardar Cliente
                    </button>
                    <button onclick="document.querySelector('[data-modal=&quot;nuevo-cliente&quot;]')?.remove();" 
                            style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function guardarClienteDesdeModal() {
    const nombre = document.getElementById("nuevoCliNombre").value.trim();
    const direccion = document.getElementById("nuevoCliDireccion").value.trim();
    const telefono = document.getElementById("nuevoCliTelefono").value.trim();
    const referencia = document.getElementById("nuevoCliReferencia").value.trim();

    const validacion = ValidatorService.validarCliente({ nombre, telefono });
    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    const nuevo = {
        id: Date.now(),
        nombre,
        direccion,
        telefono,
        referencia,
        fechaRegistro: new Date().toLocaleDateString()
    };

    clientes.push(nuevo);
    if (!StorageService.set("clientes", clientes)) {
        alert("❌ Error guardando cliente");
        return;
    }
    alert("✅ Cliente agregado exitosamente.");
    document.querySelector('[data-modal="nuevo-cliente"]')?.remove();
    cargarClientesSelect();
}

function generarTicketAbonoTermico(datosAbono) {
    const { folio, cliente, montoAbono, nuevoSaldo, fecha, metodoCobro, cuentaDestino,
        pagaresCubiertos, pagaresRestantes, articulos, totalVenta, enganche } = datosAbono;

    const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const hoy = new Date();
    const vencidos = pagaresRestantes.filter(p => new Date(p.fechaVencimiento) < hoy);
    const montoVencido = vencidos.reduce((s, p) => s + p.monto, 0);

    let mensajeEstado = '';
    let mensajeClase = 'mensaje-ok';
    if (nuevoSaldo === 0) {
        mensajeEstado = `🎉 ¡Cuenta liquidada! Gracias por su compromiso, ${esc(cliente.nombre)}. ¡Hasta pronto!`;
        mensajeClase = 'mensaje-ok';
    } else if (vencidos.length > 0) {
        mensajeEstado = `Le recordamos amablemente que tiene ${vencidos.length} pago(s) con fecha vencida por un total de ${dinero(montoVencido)}. Le agradecemos su pronta atención. 🙏`;
        mensajeClase = 'mensaje-atraso';
    } else {
        mensajeEstado = `¡Gracias por su pago puntual! Está al corriente con sus pagos. ✅`;
        mensajeClase = 'mensaje-ok';
    }

    const articulosHTML = articulos.length > 0 ? `
        <div class="seccion-titulo">ARTÍCULOS DE LA VENTA</div>
        <table>
            <thead><tr><th>Producto</th><th style="text-align:right;">Cant.</th><th style="text-align:right;">Precio</th></tr></thead>
            <tbody>
                ${articulos.map(a => `
                <tr>
                    <td>${esc(a.nombre || '-')}</td>
                    <td style="text-align:right;">${esc(String(a.cantidad || 1))}</td>
                    <td style="text-align:right;">${dinero((a.precioContado || 0) * (a.cantidad || 1))}</td>
                </tr>`).join('')}
            </tbody>
        </table>` : '';

    const _formatPagareCubierto = (p, i) => {
        const montoCell = p.parcial
            ? `${dinero(p.montoAplicado)}<br><small style="color:#888;">/ ${dinero(p.monto)}</small>`
            : dinero(p.monto);
        const estadoCell = p.parcial ? '⚠️ PARCIAL' : '✅ PAG.';
        return `<tr class="pagare-cubierto">
                    <td>${i + 1}</td>
                    <td>${esc(new Date(p.fechaVencimiento).toLocaleDateString('es-MX'))}</td>
                    <td style="text-align:right;">${montoCell}</td>
                    <td>${estadoCell}</td>
                </tr>`;
    };

    const pagaresCubiertosHTML = pagaresCubiertos.length > 0 ? `
        <div class="seccion-titulo">PAGARÉS CUBIERTOS</div>
        <table>
            <thead><tr><th>#</th><th>Vencía</th><th style="text-align:right;">Monto</th><th>Est.</th></tr></thead>
            <tbody>
                ${pagaresCubiertos.map(_formatPagareCubierto).join('')}
            </tbody>
        </table>` : '';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Recibo de Abono - ${esc(folio)}</title>
    <style>
        @page { size: 80mm auto; margin: 3mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Courier New', Courier, monospace; font-size: 11px; width: 80mm; margin: 0 auto; padding: 0; color: #000; background: #fff; }
        .ticket { width: 76mm; margin: 0 auto; padding: 3mm; }
        .centrado { text-align: center; }
        .derecha { text-align: right; }
        .negrita { font-weight: bold; }
        .grande { font-size: 15px; }
        hr.separador { border: none; border-top: 1px dashed #000; margin: 5px 0; }
        .encabezado { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
        .logo-ticket { width: 55px; height: 55px; object-fit: contain; }
        .info-empresa { flex: 1; }
        .seccion-titulo { background: #000; color: #fff; padding: 3px 6px; font-weight: bold; font-size: 10px; margin: 5px 0 3px 0; }
        .fila { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
        .monto-abono-box { border: 2px solid #000; text-align: center; padding: 8px; margin: 8px 0; }
        .monto-abono-label { font-size: 10px; }
        .monto-abono-valor { font-size: 22px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        td, th { padding: 2px 4px; text-align: left; }
        th { border-bottom: 1px solid #000; font-weight: bold; }
        .pagare-cubierto td { }
        .mensaje-ok { border: 1px dashed #000; padding: 6px; font-size: 10px; text-align: center; margin: 6px 0; }
        .mensaje-atraso { background: #000; color: #fff; padding: 6px; font-size: 10px; text-align: center; margin: 6px 0; }
        .firma-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
        .linea-firma { border-top: 1px solid #000; padding-top: 4px; font-size: 9px; text-align: center; }
        .pie { text-align: center; font-size: 9px; color: #555; margin-top: 10px; }
        .no-print { display: flex; gap: 8px; padding: 10px; background: #f0f0f0; margin-bottom: 10px; }
        .no-print button { flex: 1; padding: 10px; font-weight: bold; border: none; cursor: pointer; border-radius: 4px; font-size: 13px; }
        @media print {
            .no-print { display: none !important; }
            body { margin: 0; width: 80mm; }
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
</head>
<body>
    <div class="no-print">
        <button onclick="window.print()" style="background:#2c3e50; color:white;">🖨️ Imprimir / Guardar PDF</button>
        <button onclick="exportarImagen()" style="background:#27ae60; color:white;">📷 Guardar como Imagen</button>
    </div>

    <div class="ticket" id="ticket-abono">
        <div class="encabezado">
            <img src="img/logo.png" class="logo-ticket" onerror="this.outerHTML='<span style=\\'font-size:36px;\\'>🏛️</span>'">
            <div class="info-empresa">
                <div class="negrita grande">MUEBLERÍA MI PUEBLITO</div>
                <div style="font-size:9px;">Santiago Cuaula, Tlaxcala</div>
                <div style="font-size:9px;">Tel. 228 123 4567</div>
            </div>
        </div>

        <hr class="separador">

        <div class="centrado negrita" style="font-size:14px; letter-spacing:1px;">RECIBO DE ABONO</div>
        <div class="fila">
            <span>Folio: <strong>${esc(folio)}</strong></span>
            <span>Fecha: <strong>${esc(fecha)}</strong></span>
        </div>

        <hr class="separador">

        <div class="seccion-titulo">DATOS DEL CLIENTE</div>
        <div style="font-size:10px;">
            <div><span class="negrita">Nombre:</span> ${esc(cliente.nombre)}</div>
            ${cliente.telefono ? `<div><span class="negrita">Tel:</span> ${esc(cliente.telefono)}</div>` : ''}
            ${cliente.direccion ? `<div><span class="negrita">Dir:</span> ${esc(cliente.direccion)}</div>` : ''}
        </div>

        ${articulosHTML}

        <div class="monto-abono-box">
            <div class="monto-abono-label">ABONO RECIBIDO</div>
            <div class="monto-abono-valor">${dinero(montoAbono)}</div>
            <div class="monto-abono-label">Vía: ${esc(metodoCobro)}</div>
        </div>

        <div class="seccion-titulo">RESUMEN DE CUENTA</div>
        <div class="fila"><span>Total de la venta:</span><span>${dinero(totalVenta)}</span></div>
        ${enganche > 0 ? `<div class="fila"><span>Enganche inicial:</span><span>${dinero(enganche)}</span></div>` : ''}
        <div class="fila negrita"><span>Este abono:</span><span>${dinero(montoAbono)}</span></div>
        <div class="fila negrita" style="border-top:1px solid #000; padding-top:3px; margin-top:3px;">
            <span>SALDO PENDIENTE:</span>
            <span style="font-size:13px;">${dinero(nuevoSaldo)}</span>
        </div>

        ${pagaresCubiertosHTML}

        <div class="${mensajeClase}">${mensajeEstado}</div>

        <hr class="separador">

        <div class="firma-section">
            <div>
                <div style="height:35px;"></div>
                <div class="linea-firma">FIRMA DEL CLIENTE</div>
            </div>
            <div>
                <div style="height:35px;"></div>
                <div class="linea-firma">VENDEDOR / EMPRESA</div>
            </div>
        </div>

        <hr class="separador">
        <div class="pie">
            <div>Mueblería Mi Pueblito • Roberto Escobedo Vega</div>
            <div>Este recibo es válido como comprobante de pago.</div>
        </div>
    </div>

    <script>
    function exportarImagen() {
        const ticket = document.getElementById('ticket-abono');
        if (typeof html2canvas === 'undefined') { alert('Cargando...'); return; }
        html2canvas(ticket, { scale: 3, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'recibo-abono-' + ${JSON.stringify(esc(folio))} + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => { console.error(err); alert('Error al generar imagen'); });
    }
    <\/script>
</body>
</html>`;

    const vent = window.open('', '_blank');
    if (!vent) {
        alert("⚠️ Habilita las ventanas emergentes para ver el recibo de abono.");
        return;
    }
    vent.document.write(html);
    vent.document.close();
    vent.focus();
    setTimeout(() => { vent.print(); }, 800);
}

// ===== ESTADO DE CUENTA POR FOLIO =====
function abrirEstadoCuentaFolio(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return alert("Cuenta no encontrada.");

    const hoy = new Date();
    const pagaresDelFolio = pagaresSistema
        .filter(p => p.folio === folio)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    const abonos = cuenta.abonos || [];
    const totalAbonado = abonos.reduce((s, a) => s + (a.monto || 0), 0);
    const enganche = Number(cuenta.engancheRecibido || 0);
    const saldoActual = Number(cuenta.saldoActual || 0);
    const totalVenta = Number(cuenta.totalContadoOriginal || cuenta.saldoOriginal || 0);
    const pagaresVencidos = pagaresDelFolio.filter(p => p.estado === "Pendiente" && new Date(p.fechaVencimiento) < hoy);
    const montoVencido = pagaresVencidos.reduce((s, p) => s + (p.monto || 0), 0);
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const amortizacionHTML = pagaresDelFolio.length > 0
        ? pagaresDelFolio.map((p, i) => {
            const vencido = p.estado === "Pendiente" && new Date(p.fechaVencimiento) < hoy;
            const rowStyle = vencido ? 'background:#fee2e2;' : (p.estado === "Pagado" ? 'background:#f0fdf4;' : '');
            const estadoBadge = p.estado === "Pagado"
                ? `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:9999px; font-size:12px;">✅ Pagado</span>`
                : vencido
                    ? `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:9999px; font-size:12px;">⚠️ Vencido</span>`
                    : p.estado === "Cancelado"
                        ? `<span style="background:#e5e7eb; color:#374151; padding:2px 8px; border-radius:9999px; font-size:12px;">✖ Cancelado</span>`
                        : `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:9999px; font-size:12px;">⏳ Pendiente</span>`;
            return `<tr style="${rowStyle}">
                <td style="padding:8px; text-align:center;">${i + 1}</td>
                <td style="padding:8px;">${esc(p.fechaVencimiento || '-')}</td>
                <td style="padding:8px; text-align:right;">${dinero(p.monto || 0)}</td>
                <td style="padding:8px; text-align:center;">${estadoBadge}</td>
                <td style="padding:8px;">${esc(p.fechaAbono || '-')}</td>
                <td style="padding:8px; text-align:right;">${p.montoAbonado ? dinero(p.montoAbonado) : '-'}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="6" style="padding:12px; text-align:center; color:#6b7280;">Sin pagarés registrados</td></tr>`;

    const abonosHTML = abonos.length > 0
        ? abonos.map(a => `<tr>
            <td style="padding:8px;">${esc(a.fecha || '-')}</td>
            <td style="padding:8px; text-align:right; font-weight:bold;">${dinero(a.monto || 0)}</td>
            <td style="padding:8px;">${esc(a.etiquetaCuenta || a.medioPago || '-')}</td>
        </tr>`).join('')
        : `<tr><td colspan="3" style="padding:12px; text-align:center; color:#6b7280;">Sin abonos registrados</td></tr>`;

    const modalHTML = `
        <div data-modal="estado-cuenta-folio" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div id="estadoCuentaFolioDoc" style="background:white; padding:30px; border-radius:15px; width:95%; max-width:900px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:2px solid #e5e7eb; padding-bottom:15px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <img src="img/logo.png" style="width:60px; height:60px; object-fit:contain;" onerror="this.style.display='none'">
                        <div>
                            <div style="font-size:20px; font-weight:bold; color:#1e3a5f;">MUEBLERÍA MI PUEBLITO</div>
                            <div style="font-size:14px; color:#6b7280;">Estado de Cuenta — ${esc(folio)}</div>
                        </div>
                    </div>
                    <button onclick="document.querySelector('[data-modal=&quot;estado-cuenta-folio&quot;]')?.remove();" style="background:none; border:none; font-size:24px; cursor:pointer; color:#6b7280;">✕</button>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:20px;">
                    <div style="background:#f8fafc; padding:15px; border-radius:8px;">
                        <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">CLIENTE</div>
                        <div style="font-weight:bold; font-size:16px;">${esc(cuenta.nombre)}</div>
                        ${cuenta.telefono ? `<div style="font-size:13px; color:#4b5563;">📞 ${esc(cuenta.telefono)}</div>` : ''}
                        ${cuenta.direccion ? `<div style="font-size:13px; color:#4b5563;">📍 ${esc(cuenta.direccion)}</div>` : ''}
                    </div>
                    <div style="background:#f8fafc; padding:15px; border-radius:8px;">
                        <div style="font-size:12px; color:#6b7280; margin-bottom:4px;">DATOS DE VENTA</div>
                        <div style="font-size:13px;"><b>Folio:</b> ${esc(folio)}</div>
                        <div style="font-size:13px;"><b>Fecha:</b> ${cuenta.fechaVenta ? new Date(cuenta.fechaVenta).toLocaleDateString('es-MX') : '-'}</div>
                        <div style="font-size:13px;"><b>Modalidad:</b> ${cuenta.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:12px; margin-bottom:20px;">
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:14px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:#1d4ed8;">TOTAL VENTA</div>
                        <div style="font-size:18px; font-weight:bold; color:#1e40af;">${dinero(totalVenta)}</div>
                    </div>
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:14px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:#15803d;">ENGANCHE</div>
                        <div style="font-size:18px; font-weight:bold; color:#166534;">${dinero(enganche)}</div>
                    </div>
                    <div style="background:#fefce8; border:1px solid #fde68a; padding:14px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:#92400e;">TOTAL ABONADO</div>
                        <div style="font-size:18px; font-weight:bold; color:#78350f;">${dinero(totalAbonado)}</div>
                    </div>
                    <div style="background:${saldoActual > 0 ? '#fef2f2' : '#f0fdf4'}; border:1px solid ${saldoActual > 0 ? '#fecaca' : '#bbf7d0'}; padding:14px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:${saldoActual > 0 ? '#b91c1c' : '#15803d'};">SALDO ACTUAL</div>
                        <div style="font-size:18px; font-weight:bold; color:${saldoActual > 0 ? '#991b1b' : '#166534'};">${dinero(saldoActual)}</div>
                    </div>
                </div>

                ${pagaresVencidos.length > 0 ? `
                <div style="background:#fee2e2; border:1px solid #fecaca; padding:12px; border-radius:8px; margin-bottom:20px;">
                    <span style="color:#991b1b; font-weight:bold;">⚠️ ${pagaresVencidos.length} pagaré(s) vencido(s) — Total vencido: ${dinero(montoVencido)}</span>
                </div>` : ''}

                <div style="margin-bottom:20px;">
                    <h3 style="margin:0 0 10px 0; color:#1e3a5f;">📋 Tabla de Amortización</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead><tr style="background:#1e3a5f; color:white;">
                                <th style="padding:10px; text-align:center;">#</th>
                                <th style="padding:10px; text-align:left;">Vencimiento</th>
                                <th style="padding:10px; text-align:right;">Monto</th>
                                <th style="padding:10px; text-align:center;">Estado</th>
                                <th style="padding:10px; text-align:left;">Fecha Pago</th>
                                <th style="padding:10px; text-align:right;">Monto Abonado</th>
                            </tr></thead>
                            <tbody>${amortizacionHTML}</tbody>
                        </table>
                    </div>
                </div>

                <div style="margin-bottom:20px;">
                    <h3 style="margin:0 0 10px 0; color:#1e3a5f;">💰 Historial de Abonos</h3>
                    <div style="overflow-x:auto;">
                        <table style="width:100%; border-collapse:collapse; font-size:14px;">
                            <thead><tr style="background:#f3f4f6;">
                                <th style="padding:10px; text-align:left;">Fecha</th>
                                <th style="padding:10px; text-align:right;">Monto</th>
                                <th style="padding:10px; text-align:left;">Método / Cuenta</th>
                            </tr></thead>
                            <tbody>${abonosHTML}</tbody>
                        </table>
                    </div>
                </div>

                <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                    <button onclick="imprimirEstadoCuentaFolio('${folio}')" style="padding:10px 20px; background:#2c3e50; color:white; border:none; border-radius:6px; cursor:pointer;">🖨️ Imprimir</button>
                    <button onclick="guardarImagenEstadoCuenta('estadoCuentaFolioDoc')" style="padding:10px 20px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer;">📷 Guardar Imagen</button>
                    <button onclick="document.querySelector('[data-modal=&quot;estado-cuenta-folio&quot;]')?.remove();" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">✕ Cerrar</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function imprimirEstadoCuentaFolio(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return;

    const hoy = new Date();
    const pagaresDelFolio = pagaresSistema
        .filter(p => p.folio === folio)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    const abonos = cuenta.abonos || [];
    const totalAbonado = abonos.reduce((s, a) => s + (a.monto || 0), 0);
    const enganche = Number(cuenta.engancheRecibido || 0);
    const saldoActual = Number(cuenta.saldoActual || 0);
    const totalVenta = Number(cuenta.totalContadoOriginal || cuenta.saldoOriginal || 0);
    const pagaresVencidos = pagaresDelFolio.filter(p => p.estado === "Pendiente" && new Date(p.fechaVencimiento) < hoy);
    const montoVencido = pagaresVencidos.reduce((s, p) => s + (p.monto || 0), 0);
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const amortizacionRows = pagaresDelFolio.map((p, i) => {
        const vencido = p.estado === "Pendiente" && new Date(p.fechaVencimiento) < hoy;
        const rowBg = vencido ? '#fee2e2' : (p.estado === "Pagado" ? '#f0fdf4' : '#fff');
        const estadoLabel = p.estado === "Pagado" ? '✅ Pagado' : vencido ? '⚠️ Vencido' : p.estado === "Cancelado" ? '✖ Cancelado' : '⏳ Pendiente';
        return `<tr style="background:${rowBg};">
            <td style="padding:6px 8px; text-align:center; border-bottom:1px solid #e5e7eb;">${i + 1}</td>
            <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">${esc(p.fechaVencimiento || '-')}</td>
            <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">${dinero(p.monto || 0)}</td>
            <td style="padding:6px 8px; text-align:center; border-bottom:1px solid #e5e7eb;">${estadoLabel}</td>
            <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">${esc(p.fechaAbono || '-')}</td>
            <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">${p.montoAbonado ? dinero(p.montoAbonado) : '-'}</td>
        </tr>`;
    }).join('');

    const abonosRows = abonos.map(a => `<tr>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">${esc(a.fecha || '-')}</td>
        <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e7eb; font-weight:bold;">${dinero(a.monto || 0)}</td>
        <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb;">${esc(a.etiquetaCuenta || a.medioPago || '-')}</td>
    </tr>`).join('') || `<tr><td colspan="3" style="padding:8px; text-align:center; color:#6b7280;">Sin abonos</td></tr>`;

    const printHTML = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Estado de Cuenta - ${esc(folio)}</title>
    <style>
        @page { size: letter; margin: 15mm; }
        body { font-family: Arial, sans-serif; font-size: 12px; color: #000; }
        h2 { margin: 0; font-size: 18px; }
        h3 { margin: 15px 0 8px 0; font-size: 14px; border-bottom: 2px solid #1e3a5f; padding-bottom: 4px; color: #1e3a5f; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        th { background: #1e3a5f; color: white; padding: 8px; text-align: left; font-size: 11px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px; }
        .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 15px; }
        .kpi { border: 1px solid #ddd; padding: 10px; text-align: center; border-radius: 6px; }
        .kpi-label { font-size: 10px; color: #6b7280; }
        .kpi-value { font-size: 16px; font-weight: bold; margin-top: 4px; }
        .alert-vencidos { background: #fee2e2; border: 1px solid #fecaca; padding: 8px 12px; border-radius: 6px; color: #991b1b; font-weight: bold; margin-bottom: 12px; }
        .header-row { display: flex; align-items: center; gap: 16px; margin-bottom: 15px; border-bottom: 2px solid #1e3a5f; padding-bottom: 12px; }
        .logo { width: 55px; height: 55px; object-fit: contain; }
        @media print { body { margin: 0; } }
    </style>
</head>
<body>
    <div class="header-row">
        <img src="img/logo.png" class="logo" onerror="this.style.display='none'">
        <div>
            <h2>MUEBLERÍA MI PUEBLITO</h2>
            <div>Estado de Cuenta — Folio: <b>${esc(folio)}</b> &nbsp;|&nbsp; Fecha: ${new Date().toLocaleDateString('es-MX')}</div>
            <div>Cliente: <b>${esc(cuenta.nombre)}</b>${cuenta.telefono ? ' &nbsp;|&nbsp; Tel: ' + esc(cuenta.telefono) : ''}</div>
        </div>
    </div>

    <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">TOTAL VENTA</div><div class="kpi-value">${dinero(totalVenta)}</div></div>
        <div class="kpi"><div class="kpi-label">ENGANCHE</div><div class="kpi-value">${dinero(enganche)}</div></div>
        <div class="kpi"><div class="kpi-label">TOTAL ABONADO</div><div class="kpi-value">${dinero(totalAbonado)}</div></div>
        <div class="kpi"><div class="kpi-label">SALDO ACTUAL</div><div class="kpi-value">${dinero(saldoActual)}</div></div>
    </div>

    ${pagaresVencidos.length > 0 ? `<div class="alert-vencidos">⚠️ ${pagaresVencidos.length} pagaré(s) vencido(s) — Total vencido: ${dinero(montoVencido)}</div>` : ''}

    <h3>📋 Tabla de Amortización</h3>
    <table>
        <thead><tr>
            <th style="text-align:center;">#</th>
            <th>Vencimiento</th>
            <th style="text-align:right;">Monto</th>
            <th style="text-align:center;">Estado</th>
            <th>Fecha Pago</th>
            <th style="text-align:right;">Abonado</th>
        </tr></thead>
        <tbody>${amortizacionRows || '<tr><td colspan="6" style="padding:8px; text-align:center;">Sin pagarés</td></tr>'}</tbody>
    </table>

    <h3>💰 Historial de Abonos</h3>
    <table>
        <thead><tr>
            <th>Fecha</th>
            <th style="text-align:right;">Monto</th>
            <th>Método / Cuenta</th>
        </tr></thead>
        <tbody>${abonosRows}</tbody>
    </table>

    <script>window.onload = function(){ window.print(); };<\/script>
</body>
</html>`;

    const vent = window.open('', '_blank');
    if (!vent) { alert("⚠️ Habilita las ventanas emergentes para imprimir."); return; }
    vent.document.write(printHTML);
    vent.document.close();
}

function guardarImagenEstadoCuenta(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.onload = function() {
        html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'estado-cuenta-' + elementId + '.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => { console.error(err); alert('No se pudo generar la imagen. Usa el botón 🖨️ Imprimir para guardar el documento como PDF desde tu navegador.'); });
    };
    script.onerror = function() { alert('No se pudo cargar la herramienta de imagen. Verifica tu conexión a internet o usa el botón 🖨️ Imprimir para guardar el estado de cuenta como PDF.'); };
    document.head.appendChild(script);
}

// ===== ESTADO DE CUENTA POR CLIENTE =====
function abrirEstadoCuentaCliente(clienteId) {
    const clientesData = StorageService.get("clientes", []);
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cliente = clientesData.find(c => c.id === clienteId);
    if (!cliente) return alert("Cliente no encontrado.");

    const hoy = new Date();
    const cuentasCliente = cuentas.filter(c => c.clienteId === clienteId || c.nombre === cliente.nombre);
    const cuentasActivas = cuentasCliente.filter(c => c.estado !== "Saldado");
    const totalAdeudado = cuentasActivas.reduce((s, c) => s + Number(c.saldoActual || 0), 0);
    const foliosActivos = cuentasActivas.length;
    const pagaresCliente = pagaresSistema.filter(p => cuentasCliente.some(c => c.folio === p.folio));
    const pagaresVencidosGlobal = pagaresCliente.filter(p => p.estado === "Pendiente" && new Date(p.fechaVencimiento) < hoy);
    const montoVencidoGlobal = pagaresVencidosGlobal.reduce((s, p) => s + (p.monto || 0), 0);
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const foliosHTML = cuentasActivas.length > 0
        ? cuentasActivas.map(cuenta => {
            const pagaresDelFolio = pagaresSistema.filter(p => p.folio === cuenta.folio);
            const pendientes = pagaresDelFolio.filter(p => p.estado === "Pendiente");
            const vencidos = pendientes.filter(p => new Date(p.fechaVencimiento) < hoy);
            const abonos = cuenta.abonos || [];
            const totalAbonado = abonos.reduce((s, a) => s + (a.monto || 0), 0);
            return `<div style="border:1px solid #e5e7eb; border-radius:8px; margin-bottom:12px; overflow:hidden;">
                <div style="background:#f8fafc; padding:12px 16px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="font-weight:bold; color:#1e3a5f;">${esc(cuenta.folio)}</span>
                        <span style="margin-left:12px; font-size:13px; color:#6b7280;">${cuenta.fechaVenta ? new Date(cuenta.fechaVenta).toLocaleDateString('es-MX') : '-'}</span>
                        ${vencidos.length > 0 ? `<span style="margin-left:10px; background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:9999px; font-size:12px;">⚠️ ${vencidos.length} vencido(s)</span>` : ''}
                    </div>
                    <button onclick="document.querySelector('[data-modal=&quot;estado-cuenta-cliente&quot;]')?.remove(); abrirEstadoCuentaFolio('${esc(cuenta.folio)}');" style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer; font-size:13px;">📋 Ver detalle</button>
                </div>
                <div style="padding:12px 16px; display:grid; grid-template-columns:repeat(3,1fr); gap:12px; font-size:13px;">
                    <div><span style="color:#6b7280;">Total venta:</span><br><b>${dinero(cuenta.totalContadoOriginal || 0)}</b></div>
                    <div><span style="color:#6b7280;">Total abonado:</span><br><b style="color:#059669;">${dinero(totalAbonado)}</b></div>
                    <div><span style="color:#6b7280;">Saldo actual:</span><br><b style="color:${Number(cuenta.saldoActual || 0) > 0 ? '#dc2626' : '#059669'};">${dinero(cuenta.saldoActual || 0)}</b></div>
                </div>
                <div style="padding:0 16px 12px 16px; font-size:13px; color:#6b7280;">
                    Pagarés: ${pendientes.length} pendiente(s) de ${pagaresDelFolio.length} total
                </div>
            </div>`;
        }).join('')
        : `<div style="padding:20px; text-align:center; color:#6b7280;">Este cliente no tiene cuentas activas.</div>`;

    const modalHTML = `
        <div data-modal="estado-cuenta-cliente" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div id="estadoCuentaClienteDoc" style="background:white; padding:30px; border-radius:15px; width:95%; max-width:850px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:2px solid #e5e7eb; padding-bottom:15px;">
                    <div style="display:flex; align-items:center; gap:16px;">
                        <img src="img/logo.png" style="width:55px; height:55px; object-fit:contain;" onerror="this.style.display='none'">
                        <div>
                            <div style="font-size:20px; font-weight:bold; color:#1e3a5f;">MUEBLERÍA MI PUEBLITO</div>
                            <div style="font-size:15px; color:#374151; font-weight:600;">Estado de Cuenta — ${esc(cliente.nombre)}</div>
                            ${cliente.telefono ? `<div style="font-size:13px; color:#6b7280;">📞 ${esc(cliente.telefono)}</div>` : ''}
                            ${cliente.direccion ? `<div style="font-size:13px; color:#6b7280;">📍 ${esc(cliente.direccion)}</div>` : ''}
                        </div>
                    </div>
                    <button onclick="document.querySelector('[data-modal=&quot;estado-cuenta-cliente&quot;]')?.remove();" style="background:none; border:none; font-size:24px; cursor:pointer; color:#6b7280;">✕</button>
                </div>

                <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:15px; margin-bottom:20px;">
                    <div style="background:#fef2f2; border:1px solid #fecaca; padding:16px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:#b91c1c;">TOTAL ADEUDADO</div>
                        <div style="font-size:22px; font-weight:bold; color:#991b1b;">${dinero(totalAdeudado)}</div>
                    </div>
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:16px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:#1d4ed8;">FOLIOS ACTIVOS</div>
                        <div style="font-size:22px; font-weight:bold; color:#1e40af;">${foliosActivos}</div>
                    </div>
                    <div style="background:${pagaresVencidosGlobal.length > 0 ? '#fee2e2' : '#f0fdf4'}; border:1px solid ${pagaresVencidosGlobal.length > 0 ? '#fecaca' : '#bbf7d0'}; padding:16px; border-radius:8px; text-align:center;">
                        <div style="font-size:11px; color:${pagaresVencidosGlobal.length > 0 ? '#b91c1c' : '#15803d'};">PAGARÉS VENCIDOS</div>
                        <div style="font-size:22px; font-weight:bold; color:${pagaresVencidosGlobal.length > 0 ? '#991b1b' : '#166534'};">${pagaresVencidosGlobal.length}</div>
                        ${pagaresVencidosGlobal.length > 0 ? `<div style="font-size:12px; color:#991b1b;">${dinero(montoVencidoGlobal)}</div>` : ''}
                    </div>
                </div>

                <h3 style="margin:0 0 12px 0; color:#1e3a5f;">📁 Detalle por Folio</h3>
                ${foliosHTML}

                <div style="display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap; margin-top:15px;">
                    <button onclick="guardarImagenEstadoCuenta('estadoCuentaClienteDoc')" style="padding:10px 20px; background:#059669; color:white; border:none; border-radius:6px; cursor:pointer;">📷 Guardar Imagen</button>
                    <button onclick="document.querySelector('[data-modal=&quot;estado-cuenta-cliente&quot;]')?.remove();" style="padding:10px 20px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">✕ Cerrar</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ===== CLIENTES MOROSOS =====
function renderClientesMorosos() {
    const cont = document.getElementById('contenidoMorosos');
    if (!cont) return;
    const hoy = new Date();
    const pagares = StorageService.get('pagaresSistema', []);
    const cxc = StorageService.get('cuentasPorCobrar', []);
    const clientesLista = StorageService.get('clientes', []);

    // Filtros
    const filtroNombre = (document.getElementById('morosoFiltroNombre')?.value || '').toLowerCase();
    const filtroMin = parseFloat(document.getElementById('morosoFiltroMin')?.value) || 0;

    // Agrupar por folio
    const porFolio = {};
    pagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Vencido' || p.estado === 'Parcial').forEach(p => {
        const fv = new Date(p.fechaVencimiento);
        const diasAtraso = fv < hoy ? Math.floor((hoy - fv) / (1000 * 60 * 60 * 24)) : 0;
        if (!porFolio[p.folio]) porFolio[p.folio] = { pagares: [], vencidos: 0, diasMax: 0, montoVencido: 0, saldoTotal: 0 };
        porFolio[p.folio].pagares.push(p);
        porFolio[p.folio].saldoTotal += p.monto || 0;
        if (diasAtraso > 0) {
            porFolio[p.folio].vencidos++;
            porFolio[p.folio].montoVencido += p.monto || 0;
            porFolio[p.folio].diasMax = Math.max(porFolio[p.folio].diasMax, diasAtraso);
        }
    });

    // Solo folios con pagarés vencidos
    let registros = Object.entries(porFolio)
        .filter(([, v]) => v.vencidos > 0)
        .map(([folio, v]) => {
            const cuenta = cxc.find(c => c.folio === folio);
            const nombre = cuenta ? cuenta.nombre : folio;
            const clienteId = cuenta ? cuenta.clienteId : null;
            const cli = clientesLista.find(c => String(c.id) === String(clienteId));
            const telefono = cli ? (cli.telefono || '-') : '-';
            return { folio, nombre, telefono, clienteId, ...v };
        })
        .sort((a, b) => b.montoVencido - a.montoVencido);

    if (filtroNombre) registros = registros.filter(r => r.nombre.toLowerCase().includes(filtroNombre));
    if (filtroMin > 0) registros = registros.filter(r => r.montoVencido >= filtroMin);

    const totalMoroso = registros.reduce((s, r) => s + r.montoVencido, 0);

    const rows = registros.map(r => {
        let semaforo = '🟡';
        if (r.diasMax > 60) semaforo = '🔴';
        else if (r.diasMax >= 30) semaforo = '🟠';
        return `<tr>
          <td style="padding:10px;">${semaforo} ${r.nombre}</td>
          <td style="padding:10px;text-align:center;">${r.telefono}</td>
          <td style="padding:10px;text-align:center;">${r.vencidos}</td>
          <td style="padding:10px;text-align:center;color:#dc2626;font-weight:bold;">${r.diasMax} días</td>
          <td style="padding:10px;text-align:right;color:#dc2626;font-weight:bold;">${dinero(r.montoVencido)}</td>
          <td style="padding:10px;text-align:right;">${dinero(r.saldoTotal)}</td>
          <td style="padding:10px;text-align:center;display:flex;gap:6px;justify-content:center;">
            ${r.telefono !== '-' ? `<a href="tel:${r.telefono}" style="font-size:18px;text-decoration:none;" title="Llamar">📞</a>` : ''}
            <button onclick="abrirModalAbonoAvanzado('${r.folio}')" style="padding:3px 8px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">💰 Abonar</button>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:#fef2f2;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#dc2626;">CLIENTES MOROSOS</small><br>
          <strong style="font-size:28px;color:#dc2626;">${registros.length}</strong>
        </div>
        <div style="background:#fef2f2;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#dc2626;">MONTO VENCIDO TOTAL</small><br>
          <strong style="font-size:22px;color:#dc2626;">${dinero(totalMoroso)}</strong>
        </div>
        <div style="background:#fef9c3;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#92400e;">LEYENDA</small><br>
          <span style="font-size:13px;">🔴 &gt;60d &nbsp; 🟠 30-60d &nbsp; 🟡 &lt;30d</span>
        </div>
      </div>
      <div style="background:white;padding:16px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);margin-bottom:16px;">
        <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;">
          <div>
            <label style="font-size:11px;font-weight:bold;color:#374151;">BUSCAR CLIENTE</label>
            <input type="text" id="morosoFiltroNombre" oninput="renderClientesMorosos()" placeholder="Nombre..."
                   style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
          </div>
          <div>
            <label style="font-size:11px;font-weight:bold;color:#374151;">MONTO MÍNIMO ($)</label>
            <input type="number" id="morosoFiltroMin" oninput="renderClientesMorosos()" placeholder="0" min="0"
                   style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;width:120px;">
          </div>
          <button onclick="exportarMorososCSV()" style="padding:8px 16px;background:#27ae60;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">📥 Exportar CSV</button>
        </div>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        ${registros.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">🎉 Sin clientes morosos.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Cliente</th>
              <th style="padding:10px;text-align:center;">Teléfono</th>
              <th style="padding:10px;text-align:center;"># Pagarés Vencidos</th>
              <th style="padding:10px;text-align:center;">Días Máx.</th>
              <th style="padding:10px;text-align:right;">Monto Vencido</th>
              <th style="padding:10px;text-align:right;">Saldo Total</th>
              <th style="padding:10px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>`;
}

function exportarMorososCSV() {
    const cont = document.getElementById('contenidoMorosos');
    if (!cont) return;
    // Re-calcular datos sin filtros para exportar todo
    const hoy = new Date();
    const pagares = StorageService.get('pagaresSistema', []);
    const cxc = StorageService.get('cuentasPorCobrar', []);
    const clientesLista = StorageService.get('clientes', []);
    const porFolio = {};
    pagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Vencido' || p.estado === 'Parcial').forEach(p => {
        const fv = new Date(p.fechaVencimiento);
        const diasAtraso = fv < hoy ? Math.floor((hoy - fv) / (1000 * 60 * 60 * 24)) : 0;
        if (!porFolio[p.folio]) porFolio[p.folio] = { pagares: [], vencidos: 0, diasMax: 0, montoVencido: 0, saldoTotal: 0 };
        porFolio[p.folio].saldoTotal += p.monto || 0;
        if (diasAtraso > 0) { porFolio[p.folio].vencidos++; porFolio[p.folio].montoVencido += p.monto || 0; porFolio[p.folio].diasMax = Math.max(porFolio[p.folio].diasMax, diasAtraso); }
    });
    const registros = Object.entries(porFolio).filter(([, v]) => v.vencidos > 0).map(([folio, v]) => {
        const cuenta = cxc.find(c => c.folio === folio);
        const nombre = cuenta ? cuenta.nombre : folio;
        const clienteId = cuenta ? cuenta.clienteId : null;
        const cli = clientesLista.find(c => String(c.id) === String(clienteId));
        const telefono = cli ? (cli.telefono || '') : '';
        return { folio, nombre, telefono, ...v };
    }).sort((a, b) => b.montoVencido - a.montoVencido);
    let csv = 'Cliente,Telefono,Folio,Pagares Vencidos,Dias Max Atraso,Monto Vencido,Saldo Total\n';
    registros.forEach(r => {
        csv += `"${r.nombre}","${r.telefono}","${r.folio}",${r.vencidos},${r.diasMax},${r.montoVencido.toFixed(2)},${r.saldoTotal.toFixed(2)}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'morosos.csv'; a.click();
    URL.revokeObjectURL(url);
}

// ===== HISTORIAL DE ABONOS POR FOLIO =====
function abrirHistorialAbonos(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) { alert("Cuenta no encontrada."); return; }

    const hoy = new Date();
    const abonos = cuenta.abonos || [];
    const articulos = cuenta.articulos || [];
    const totalAbonado = abonos.reduce((s, a) => s + (a.monto || 0), 0);
    const enganche = Number(cuenta.engancheRecibido || 0);
    const totalVenta = Number(cuenta.totalContadoOriginal || cuenta.saldoOriginal || 0);
    const pagaresDelFolio = pagaresSistema
        .filter(p => p.folio === folio)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    const pagaresCubiertos = pagaresDelFolio.filter(p => p.estado === "Pagado").length;
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    // Sección 1: Resumen de cuenta
    const resumenHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:12px; margin-bottom:20px;">
            <div style="background:#f8fafc; padding:14px; border-radius:8px; border-left:4px solid #3b82f6;">
                <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Cliente</div>
                <div style="font-weight:bold; color:#1e3a5f; margin-top:4px;">${esc(cuenta.nombre)}</div>
            </div>
            <div style="background:#f8fafc; padding:14px; border-radius:8px; border-left:4px solid #3b82f6;">
                <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Folio</div>
                <div style="font-weight:bold; color:#1d4ed8; margin-top:4px;">${esc(folio)}</div>
            </div>
            <div style="background:#f8fafc; padding:14px; border-radius:8px; border-left:4px solid #3b82f6;">
                <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Fecha Venta</div>
                <div style="font-weight:bold; margin-top:4px;">${cuenta.fechaVenta ? new Date(cuenta.fechaVenta).toLocaleDateString('es-MX') : '—'}</div>
            </div>
            <div style="background:#f8fafc; padding:14px; border-radius:8px; border-left:4px solid #f59e0b;">
                <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Total Original</div>
                <div style="font-weight:bold; color:#92400e; margin-top:4px;">${dinero(totalVenta)}</div>
            </div>
            <div style="background:#f8fafc; padding:14px; border-radius:8px; border-left:4px solid #22c55e;">
                <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Enganche</div>
                <div style="font-weight:bold; color:#15803d; margin-top:4px;">${dinero(enganche)}</div>
            </div>
            <div style="background:#f8fafc; padding:14px; border-radius:8px; border-left:4px solid ${cuenta.estado === 'Saldado' ? '#22c55e' : '#ef4444'};">
                <div style="font-size:11px; color:#6b7280; text-transform:uppercase;">Estado</div>
                <div style="font-weight:bold; color:${cuenta.estado === 'Saldado' ? '#15803d' : '#991b1b'}; margin-top:4px;">${esc(cuenta.estado || 'Activo')}</div>
            </div>
        </div>`;

    // Sección 2: Artículos
    const articulosHTML = articulos.length > 0
        ? `<h4 style="margin:0 0 10px 0; color:#1e3a5f;">🛋️ Artículos de la Venta</h4>
           <div style="overflow-x:auto; margin-bottom:20px;">
               <table style="width:100%; border-collapse:collapse; font-size:14px;">
                   <thead><tr style="background:#f3f4f6;">
                       <th style="padding:8px 10px; text-align:left;">Producto</th>
                       <th style="padding:8px 10px; text-align:center;">Cant.</th>
                       <th style="padding:8px 10px; text-align:right;">Precio Unit.</th>
                       <th style="padding:8px 10px; text-align:right;">Subtotal</th>
                   </tr></thead>
                   <tbody>
                       ${articulos.map(a => `<tr style="border-bottom:1px solid #f3f4f6;">
                           <td style="padding:8px 10px;">${esc(a.nombre || a.productoNombre || '—')}</td>
                           <td style="padding:8px 10px; text-align:center;">${a.cantidad || 1}</td>
                           <td style="padding:8px 10px; text-align:right;">${dinero(a.precioContado || a.precio || 0)}</td>
                           <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero((a.precioContado || a.precio || 0) * (a.cantidad || 1))}</td>
                       </tr>`).join('')}
                   </tbody>
               </table>
           </div>`
        : '';

    // Sección 3: Historial de abonos
    const abonosFilas = abonos.length > 0
        ? abonos.map((a, idx) => `<tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:8px 10px;">${esc(a.fecha || '—')}</td>
            <td style="padding:8px 10px; text-align:right; font-weight:bold; color:#15803d;">${dinero(a.monto || 0)}</td>
            <td style="padding:8px 10px;">${esc(a.medioPago || a.etiquetaCuenta || '—')}</td>
            <td style="padding:8px 10px;">${esc(a.cuentaDestino || a.etiquetaCuenta || '—')}</td>
            <td style="padding:8px 10px; text-align:center;">
                <button onclick="reimprimirTicketAbono('${esc(folio)}', ${idx})"
                        style="padding:4px 8px; background:#2563eb; color:white; border:none; border-radius:4px; cursor:pointer; font-size:12px;">🖨️</button>
            </td>
        </tr>`).join('')
        : `<tr><td colspan="5" style="padding:14px; text-align:center; color:#6b7280;">Sin abonos registrados</td></tr>`;

    // Sección 4: Estado de pagarés
    const pagaresFilas = pagaresDelFolio.length > 0
        ? pagaresDelFolio.map((p, i) => {
            const venc = new Date(p.fechaVencimiento);
            const esVencido = (p.estado === "Pendiente" || p.estado === "Parcial") && venc < hoy;
            let estadoBadge, rowBg;
            if (p.estado === "Pagado") {
                estadoBadge = `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:9999px; font-size:11px;">✅ Pagado</span>`;
                rowBg = '#f0fdf4';
            } else if (p.estado === "Parcial") {
                estadoBadge = `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:9999px; font-size:11px;">⚠️ Parcial</span>`;
                rowBg = esVencido ? '#fef3c7' : '';
            } else if (esVencido) {
                estadoBadge = `<span style="background:#fee2e2; color:#991b1b; padding:2px 8px; border-radius:9999px; font-size:11px;">🔴 Vencido</span>`;
                rowBg = '#fef2f2';
            } else if (p.estado === "Cancelado") {
                estadoBadge = `<span style="background:#e5e7eb; color:#374151; padding:2px 8px; border-radius:9999px; font-size:11px;">✖ Cancelado</span>`;
                rowBg = '#f9fafb';
            } else {
                estadoBadge = `<span style="background:#dbeafe; color:#1e40af; padding:2px 8px; border-radius:9999px; font-size:11px;">⏳ Pendiente</span>`;
                rowBg = '';
            }
            return `<tr style="border-bottom:1px solid #f3f4f6; ${rowBg ? 'background:' + rowBg + ';' : ''}">
                <td style="padding:8px 10px; text-align:center;">${i + 1}</td>
                <td style="padding:8px 10px;">${esc(p.fechaVencimiento || '—')}</td>
                <td style="padding:8px 10px; text-align:right; font-weight:bold;">${dinero(p.monto || 0)}</td>
                <td style="padding:8px 10px; text-align:right;">${p.montoAbonado ? dinero(p.montoAbonado) : '—'}</td>
                <td style="padding:8px 10px; text-align:center;">${estadoBadge}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="5" style="padding:14px; text-align:center; color:#6b7280;">Sin pagarés registrados</td></tr>`;

    const modalHTML = `
        <div data-modal="historial-abonos" style="position:fixed; inset:0; background:rgba(0,0,0,0.85); z-index:8000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:900px; margin:0 auto;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:2px solid #e5e7eb; padding-bottom:15px;">
                    <div style="display:flex; align-items:center; gap:14px;">
                        <img src="img/logo.png" style="width:50px; height:50px; object-fit:contain;" onerror="this.outerHTML='<span style=\\'font-size:32px;\\'>🏛️</span>'">
                        <div>
                            <div style="font-size:18px; font-weight:bold; color:#1e3a5f;">Historial de Cuenta</div>
                            <div style="font-size:13px; color:#6b7280;">Folio: ${esc(folio)} — ${esc(cuenta.nombre)}</div>
                        </div>
                    </div>
                    <button onclick="document.querySelector('[data-modal=&quot;historial-abonos&quot;]')?.remove();"
                            style="background:none; border:none; font-size:24px; cursor:pointer; color:#6b7280;">✕</button>
                </div>

                <!-- Resumen -->
                ${resumenHTML}

                <!-- Artículos -->
                ${articulosHTML}

                <!-- Historial de abonos -->
                <h4 style="margin:0 0 10px 0; color:#1e3a5f;">💰 Historial de Abonos</h4>
                <div style="overflow-x:auto; margin-bottom:20px;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                        <thead><tr style="background:#f3f4f6;">
                            <th style="padding:8px 10px; text-align:left;">Fecha</th>
                            <th style="padding:8px 10px; text-align:right;">Monto</th>
                            <th style="padding:8px 10px; text-align:left;">Medio de Pago</th>
                            <th style="padding:8px 10px; text-align:left;">Cuenta Destino</th>
                            <th style="padding:8px 10px; text-align:center;">🖨️</th>
                        </tr></thead>
                        <tbody>${abonosFilas}</tbody>
                        <tfoot>
                            <tr style="background:#f0fdf4; font-weight:bold;">
                                <td style="padding:8px 10px;" colspan="2">Total abonado: ${dinero(totalAbonado)}</td>
                                <td colspan="3"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <!-- Estado de pagarés -->
                <h4 style="margin:0 0 10px 0; color:#1e3a5f;">📋 Estado de Pagarés</h4>
                <div style="background:#f8fafc; padding:10px 14px; border-radius:6px; margin-bottom:10px; font-size:13px; color:#374151;">
                    <strong>${pagaresCubiertos} de ${pagaresDelFolio.length}</strong> pagaré(s) cubierto(s)
                </div>
                <div style="overflow-x:auto; margin-bottom:24px;">
                    <table style="width:100%; border-collapse:collapse; font-size:14px;">
                        <thead><tr style="background:#f3f4f6;">
                            <th style="padding:8px 10px; text-align:center;">#</th>
                            <th style="padding:8px 10px; text-align:left;">Vencimiento</th>
                            <th style="padding:8px 10px; text-align:right;">Monto</th>
                            <th style="padding:8px 10px; text-align:right;">Abonado</th>
                            <th style="padding:8px 10px; text-align:center;">Estado</th>
                        </tr></thead>
                        <tbody>${pagaresFilas}</tbody>
                    </table>
                </div>

                <div style="text-align:right;">
                    <button onclick="document.querySelector('[data-modal=&quot;historial-abonos&quot;]')?.remove();"
                            style="padding:10px 24px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer; font-size:14px;">✕ Cerrar</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ===== REIMPRIMIR TICKET DE ABONO =====
function reimprimirTicketAbono(folio, indexAbono) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagaresSistema = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) { alert("Cuenta no encontrada."); return; }

    const abonos = cuenta.abonos || [];
    if (indexAbono < 0 || indexAbono >= abonos.length) { alert("Abono no encontrado."); return; }

    const abono = abonos[indexAbono];
    const pagaresDelFolio = pagaresSistema.filter(p => p.folio === folio);
    const pagaresPendientes = pagaresDelFolio.filter(p => p.estado !== "Pagado" && p.estado !== "Cancelado");
    const saldoActual = pagaresPendientes.reduce((s, p) => s + (p.monto - (p.montoAbonado || 0)), 0);

    const datosAbono = {
        folio: folio,
        cliente: { nombre: cuenta.nombre, telefono: cuenta.telefono || '', direccion: cuenta.direccion || '' },
        montoAbono: abono.monto || 0,
        nuevoSaldo: saldoActual,
        fecha: abono.fecha || new Date().toLocaleDateString('es-MX'),
        metodoCobro: abono.etiquetaCuenta || abono.medioPago || 'Efectivo',
        cuentaDestino: abono.cuentaDestino || abono.etiquetaCuenta || '',
        pagaresCubiertos: pagaresDelFolio.filter(p => p.estado === "Pagado"),
        pagaresRestantes: pagaresPendientes,
        articulos: cuenta.articulos || [],
        totalVenta: Number(cuenta.totalContadoOriginal || cuenta.saldoOriginal || 0),
        enganche: Number(cuenta.engancheRecibido || 0)
    };

    generarTicketAbonoTermico(datosAbono);
}

// expose helpers for inline HTML event handlers
window._actualizarCuentaEspecifica = _actualizarCuentaEspecifica;
window._getCuentaSeleccionada = _getCuentaSeleccionada;
window._buildCuentaOrigen = _buildCuentaOrigen;
window.generarTicketAbono = generarTicketAbono;
window.generarTicketAbonoTermico = generarTicketAbonoTermico;
window.abrirEstadoCuentaFolio = abrirEstadoCuentaFolio;
window.imprimirEstadoCuentaFolio = imprimirEstadoCuentaFolio;
window.guardarImagenEstadoCuenta = guardarImagenEstadoCuenta;
window.abrirEstadoCuentaCliente = abrirEstadoCuentaCliente;
window.renderClientesMorosos = renderClientesMorosos;
window.exportarMorososCSV = exportarMorososCSV;
window.abrirHistorialAbonos = abrirHistorialAbonos;
window.reimprimirTicketAbono = reimprimirTicketAbono;
