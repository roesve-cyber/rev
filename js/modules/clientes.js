// ===== HELPERS DE CUENTA / MEDIO DE PAGO =====
// Definir clientes globalmente correctamente
window.clientes = StorageService.get("clientes", []);

function _escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==========================================
// 🧠 MOTOR CENTRAL DE SALDOS
// ==========================================
window._calcularEstadoCuenta = function(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return null;

    const hoy = new Date();
    const pagaresDelFolio = pagares.filter(p => p.folio === folio).sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    
    let saldoTotal = 0;
    let pagaresPendientes = [];
    let pagaresVencidos = [];
    let montoVencido = 0;
    let diasMaxAtraso = 0;

    pagaresDelFolio.forEach(p => {
        if (p.estado === "Pendiente" || p.estado === "Parcial") {
            pagaresPendientes.push(p);
            const restante = (p.estado === "Parcial") ? Math.max(0, (p.monto || 0) - (p.montoAbonado || 0)) : (p.monto || 0);
            saldoTotal += restante;

            const fechaVenc = new Date(p.fechaVencimiento);
            if (fechaVenc < hoy) {
                pagaresVencidos.push(p);
                montoVencido += restante;
                const atraso = Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24));
                if (atraso > diasMaxAtraso) diasMaxAtraso = atraso;
            }
        }
    });

    const abonos = cuenta.abonos || [];
    const totalAbonado = abonos.reduce((sum, a) => sum + (a.monto || 0), 0);

    // Evaluación Inteligente de Estado
    let estadoGeneral = "Activo";
    let promesaVigente = false;

    if (cuenta.estado === "Saldado" || saldoTotal <= 0.01) {
        estadoGeneral = "Saldado";
        saldoTotal = 0; // Limpiar centavos residuales
    } else {
        if (cuenta.promesaPago && cuenta.promesaPago.fecha) {
            const fechaPromObj = new Date(cuenta.promesaPago.fecha + "T23:59:59");
            if (fechaPromObj >= hoy) promesaVigente = true;
        }

        if (promesaVigente) {
            estadoGeneral = "Promesa";
        } else if (pagaresVencidos.length === 0) {
            estadoGeneral = "Al corriente";
        } else if (pagaresVencidos.length <= 2) {
            estadoGeneral = "Atrasado";
        } else {
            estadoGeneral = "Crítico";
        }
    }

    return {
        cuenta,
        pagares: pagaresDelFolio,
        pagaresPendientes,
        pagaresVencidos,
        saldoTotal,
        montoVencido,
        diasMaxAtraso,
        estadoGeneral,
        promesaVigente,
        totalAbonado
    };
};
// ==========================================

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
    let clientesBD = StorageService.get("clientes", []);

    if (window.clienteEditandoId) {
        const index = clientesBD.findIndex(c => c.id === window.clienteEditandoId);
        if (index !== -1) {
            clientesBD[index].nombre   = nombre;
            clientesBD[index].direccion = direccion;
            clientesBD[index].telefono = telefono;
            clientesBD[index].referencia = referencia;
        }
        window.clienteEditandoId = null;
    } else {
        clientesBD.push({
            id: Date.now(),
            nombre,
            direccion,
            telefono,
            referencia,
            fechaRegistro: new Date().toLocaleDateString()
        });
    }

    if (!StorageService.set("clientes", clientesBD)) {
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

    // LA CLAVE: Leer directo del baúl de datos, no de variables temporales
    const listaClientes = StorageService.get("clientes", []);
    window.clientes = listaClientes; // Sincronizar memoria global

    if (listaClientes.length === 0) {
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

    listaClientes.forEach(c => {
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
        let clientesBD = StorageService.get("clientes", []);
        clientesBD = clientesBD.filter(c => c.id !== id);
        if (!StorageService.set("clientes", clientesBD)) {
            console.error("❌ Error eliminando cliente");
            return;
        }
        renderClientes();
    }
}

function prepararEdicionCliente(id) {
    const c = window.clientes.find(cli => cli.id === id);
    if (!c) return;
    document.getElementById("clienteNombre").value   = c.nombre;
    document.getElementById("clienteDireccion").value = c.direccion || '';
    document.getElementById("clienteTelefono").value = c.telefono || '';
    document.getElementById("clienteReferencia").value = c.referencia || '';
    window.clienteEditandoId = id;
    window.scrollTo(0, 0);
}

// ===== CUENTAS POR COBRAR =====
function irASeleccionCliente() {
    if(typeof navA === 'function') navA("seleccionarcliente");
    renderResumenVentaCliente();
    cargarClientesSelect();
}

function mostrarInfoCliente() {
    const div = document.getElementById("infoCliente");
    if (!window.clienteSeleccionado || !div) return;

    // Obtener la calificación del Buró
    const score = window.calcularCalificacionCliente(window.clienteSeleccionado.id);

    div.innerHTML = `
        <div style="background:#f8fafc; padding:16px; border-radius:12px; border:1px solid #e2e8f0; position:relative;">
            
            <div style="position:absolute; top:-12px; right:15px; background:${score.bg}; border:1px solid ${score.color}; padding:4px 10px; border-radius:20px; box-shadow:0 2px 4px rgba(0,0,0,0.05); display:flex; flex-direction:column; align-items:center;">
                <span style="font-size:14px;">${score.estrellas}</span>
                <span style="font-size:9px; font-weight:bold; color:${score.color}; text-transform:uppercase;">${score.texto}</span>
            </div>

            <strong style="font-size:16px; color:#0f172a; display:block; margin-bottom:8px;">👤 ${window.clienteSeleccionado.nombre}</strong>
            <div style="font-size:13px; color:#475569; line-height:1.5;">
                ${window.clienteSeleccionado.direccion ? `📍 ${window.clienteSeleccionado.direccion}<br>` : ''}
                ${window.clienteSeleccionado.telefono ? `📞 ${window.clienteSeleccionado.telefono}<br>` : ''}
                ${window.clienteSeleccionado.referencia ? `📝 ${window.clienteSeleccionado.referencia}` : ''}
            </div>
            
            ${score.estrellas.includes('⭐') && score.estrellas.length < 3 ? `
                <div style="margin-top:10px; padding:8px; background:#fee2e2; border-left:3px solid #ef4444; border-radius:4px; font-size:11px; color:#991b1b; font-weight:bold;">
                    ⚠️ Recomendación: Cliente con historial de morosidad. Se sugiere exigir un enganche mayor o cobrar de contado.
                </div>
            ` : ''}
        </div>
    `;
}

// Le quitamos el valor por defecto para obligarlo a buscar en el baúl
function cargarClientesSelect(lista = null) {
    const cont = document.getElementById("listaClientesCards");
    if (!cont) return;

    const listaUsar = lista || StorageService.get("clientes", []);
    window.clientes = StorageService.get("clientes", []);

    cont.innerHTML = "";

    if (listaUsar.length === 0) {
        cont.innerHTML = "<p style='color:#9ca3af;text-align:center;padding:20px;'>Sin resultados.</p>";
        return;
    }

    listaUsar.forEach(c => {
        const div = document.createElement("div");
        const isSelected = window.clienteSeleccionado && window.clienteSeleccionado.id === c.id;
        div.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #f3f4f6;cursor:pointer;background:${isSelected ? '#eff6ff' : 'white'};transition:background 0.15s;`;
        div.onmouseover = () => { if (!isSelected) div.style.background = '#f9fafb'; };
        div.onmouseout  = () => { if (!(window.clienteSeleccionado && window.clienteSeleccionado.id === c.id)) div.style.background = 'white'; };
        div.onclick = () => {
            window.clienteSeleccionado = window.clientes.find(cl => cl.id === c.id);
            mostrarInfoCliente();
            cont.querySelectorAll('div').forEach(d => {
                d.style.background = 'white';
                d.style.fontWeight = 'normal';
            });
            div.style.background = '#eff6ff';
        };
        div.innerHTML = `
            <div style="width:34px;height:34px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">👤</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:${isSelected ? 'bold' : 'normal'};font-size:14px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nombre || '—'}</div>
                ${c.telefono ? `<div style="font-size:12px;color:#6b7280;">📞 ${c.telefono}</div>` : ''}
            </div>
            ${isSelected ? '<span style="color:#2563eb;font-size:16px;">✓</span>' : ''}
        `;
        cont.appendChild(div);
    });
}

function filtrarClientes() {
    const texto = document.getElementById("buscarCliente").value.toLowerCase();
    const filtrados = window.clientes.filter(c =>
        (c.nombre || "").toLowerCase().includes(texto) ||
        (c.telefono || "").includes(texto) ||
        (c.referencia || "").toLowerCase().includes(texto) 
    );
    cargarClientesSelect(filtrados);
}

function abrirModalCliente() {
    const nombre = prompt("Nombre del cliente:");
    if (!nombre || !nombre.trim()) return;

    const telefono = prompt("Teléfono:") || '';
    const validacion = ValidatorService.validarCliente({ nombre: nombre.trim(), telefono });
    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    const nuevo = {
        id: Date.now(),
        nombre: nombre.trim(),
        telefono,
        fechaRegistro: new Date().toLocaleDateString()
    };

    window.clientes.push(nuevo);
    if (!StorageService.set("clientes", window.clientes)) {
        console.error("❌ Error guardando cliente");
        return;
    }

    cargarClientesSelect();
}

function renderResumenVentaCliente() {
    const cont = document.getElementById("resumenVentaCliente");
    if (!cont) return;

    const carrito = StorageService.get("carrito", []);
    let totalContado = carrito.reduce((sum, p) => sum + ((p.precioContado || 0) * (p.cantidad || 1)), 0);

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
                const idx = (typeof window.plazoSeleccionado === "number" && window.plazoSeleccionado >= 0 && window.plazoSeleccionado < planes.length) ? window.plazoSeleccionado : 0;
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

window._pestanaCobranzaActiva = 'todas';

function renderCuentasXCobrar(filtroCliente = "", filtroEstado = "") {
    const contenedor = document.getElementById("tablaCuentasXCobrar");
    if (!contenedor) return;

    filtroCliente = (filtroCliente || document.getElementById("filtroClienteCobranza")?.value || "").trim().toLowerCase();
    
    if (filtroEstado) {
        window._pestanaCobranzaActiva = filtroEstado === "Promesa" ? "promesas" : (filtroEstado === "Saldado" ? "saldadas" : "todas");
    }

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const clientesBase = StorageService.get("clientes", []); 

    if (cuentas.length === 0) {
        contenedor.innerHTML = `<div style="background:#f0fdf4; padding:40px; text-align:center; border-radius:10px;"><p style="font-size:18px; color:#27ae60; font-weight:bold;">✅ ¡No hay cuentas registradas!</p></div>`;
        return;
    }

    let htmlTabs = `
    <div style="display: flex; gap: 10px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px;">
        <button onclick="cambiarPestanaCobranza('todas')" style="flex: 1; min-width: 120px; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; border: none; background: ${window._pestanaCobranzaActiva === 'todas' ? '#1e40af' : '#f3f4f6'}; color: ${window._pestanaCobranzaActiva === 'todas' ? 'white' : '#4b5563'};">
            🏠 Todas Activas
        </button>
        <button onclick="cambiarPestanaCobranza('al_corriente')" style="flex: 1; min-width: 120px; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; border: none; background: ${window._pestanaCobranzaActiva === 'al_corriente' ? '#16a34a' : '#f3f4f6'}; color: ${window._pestanaCobranzaActiva === 'al_corriente' ? 'white' : '#4b5563'};">
            ✅ Al Corriente
        </button>
        <button onclick="cambiarPestanaCobranza('morosos')" style="flex: 1; min-width: 120px; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; border: none; background: ${window._pestanaCobranzaActiva === 'morosos' ? '#dc2626' : '#f3f4f6'}; color: ${window._pestanaCobranzaActiva === 'morosos' ? 'white' : '#4b5563'};">
            🔴 Morosos
        </button>
        <button onclick="cambiarPestanaCobranza('promesas')" style="flex: 1; min-width: 120px; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; border: none; background: ${window._pestanaCobranzaActiva === 'promesas' ? '#d97706' : '#f3f4f6'}; color: ${window._pestanaCobranzaActiva === 'promesas' ? 'white' : '#4b5563'};">
            📝 Promesas
        </button>
        <button onclick="cambiarPestanaCobranza('saldadas')" style="flex: 1; min-width: 120px; padding: 12px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; border: none; background: ${window._pestanaCobranzaActiva === 'saldadas' ? '#4b5563' : '#f3f4f6'}; color: ${window._pestanaCobranzaActiva === 'saldadas' ? 'white' : '#4b5563'};">
            🔒 Saldadas
        </button>
    </div>`;

    let htmlTabla = `<div style="overflow-x:auto;"><table class="tabla-admin">
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

    let cuentasMostradas = 0;

    cuentas.forEach(c => {
        const estadoCta = window._calcularEstadoCuenta(c.folio);
        if(!estadoCta) return;

        let mostrarEnPestana = false;
        switch (window._pestanaCobranzaActiva) {
            case 'todas': mostrarEnPestana = estadoCta.estadoGeneral !== "Saldado"; break;
            case 'al_corriente': mostrarEnPestana = estadoCta.estadoGeneral === "Al corriente"; break;
            case 'morosos': mostrarEnPestana = estadoCta.estadoGeneral === "Atrasado" || estadoCta.estadoGeneral === "Crítico"; break;
            case 'promesas': mostrarEnPestana = estadoCta.estadoGeneral === "Promesa"; break;
            case 'saldadas': mostrarEnPestana = estadoCta.estadoGeneral === "Saldado"; break;
        }

        if (!mostrarEnPestana) return;
        if (filtroEstado && filtroEstado !== estadoCta.estadoGeneral) return;

        const dataCliente = clientesBase.find(cli => String(cli.id) === String(c.clienteId) || cli.nombre === c.nombre) || {};
        const refCliente = (dataCliente.referencia || "").toLowerCase();
        const stringBusqueda = `${c.nombre || ''} ${c.folio || ''} ${refCliente}`.toLowerCase();

        if (filtroCliente && !stringBusqueda.includes(filtroCliente)) return;

        cuentasMostradas++;
        const color = estadoCta.saldoTotal > 0 ? "#27ae60" : "#9ca3af";
        const enganche = Number(c.engancheRecibido ?? 0);

        const pagaresTexto = estadoCta.pagaresPendientes.length > 0
            ? `<span style="color:#374151;">${estadoCta.pagaresPendientes.length} pendiente(s)</span>`
            : `<span style="color:#27ae60;">✅ Al corriente</span>`;
            
        const vencidosTexto = estadoCta.pagaresVencidos.length > 0 && !estadoCta.promesaVigente
            ? `<br><span style="color:#dc2626; font-weight:bold; font-size:12px;">⚠️ ${estadoCta.pagaresVencidos.length} vencido(s)</span>`
            : '';
            
        const textoPromesa = estadoCta.promesaVigente 
            ? `<br><span style="color:#d97706; font-size:11px; font-weight:bold;">📝 Promesa: ${new Date(c.promesaPago.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>` 
            : '';

        htmlTabla += `<tr>
            <td><strong>${c.nombre}</strong><br><small style="color:#718096;">${c.folio}</small></td>
            <td>${c.fechaVenta ? new Date(c.fechaVenta).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '-'}</td>
            <td>${dinero(c.totalContadoOriginal ?? 0)}${enganche > 0 ? `<br><small style="color:#27ae60;">✅ Enganche: ${dinero(enganche)}</small>` : ''}</td>
            <td style="font-weight:bold; color:${color};">${dinero(estadoCta.saldoTotal)}</td>
            <td>${pagaresTexto}${vencidosTexto}${textoPromesa}<br><small style="color:#4b5563;">Estado: ${estadoCta.estadoGeneral}</small></td>
            <td>${c.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</td>
            <td style="white-space:nowrap;">
                <button onclick="abrirModalAbonoAvanzado('${c.folio}')" style="padding:6px 10px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;" title="Registrar Abono">💰</button>
                <button onclick="abrirModalPromesaPago('${c.folio}')" style="padding:6px 10px; background:#f59e0b; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;" title="Registrar Promesa">📝</button>
                <button onclick="abrirEstadoCuentaFolio('${c.folio}')" style="padding:6px 10px; background:#3b82f6; color:white; border:none; border-radius:4px; cursor:pointer; margin-right:4px;" title="Estado de Cuenta">📋</button>
                <button onclick="enviarRecordatorioWhatsApp('${c.folio}')" style="padding:6px 10px; background:#25D366; color:white; border:none; border-radius:4px; cursor:pointer;" title="Enviar WhatsApp">💬</button>
            </td>
        </tr>`;
    });

    htmlTabla += `</tbody></table></div>`;

    if (cuentasMostradas === 0) {
        htmlTabla = `<div style="background:#f9fafb; padding:40px; text-align:center; border-radius:10px; border:1px dashed #d1d5db;"><p style="font-size:16px; color:#6b7280;">No hay cuentas que coincidan con esta vista.</p></div>`;
    }

    contenedor.innerHTML = htmlTabs + htmlTabla;
}

window.cambiarPestanaCobranza = function(pestana) {
    window._pestanaCobranzaActiva = pestana;
    const inputBusqueda = document.getElementById("filtroClienteCobranza");
    const selectEstado = document.getElementById("filtroEstadoCobranza");
    if(inputBusqueda) inputBusqueda.value = "";
    if(selectEstado) selectEstado.value = "";
    renderCuentasXCobrar();
};

window.enviarRecordatorioWhatsApp = function(folio) {
    const estadoCta = window._calcularEstadoCuenta(folio);
    if (!estadoCta) return alert("❌ Error al leer la cuenta.");

    const clientesBase = StorageService.get("clientes", []);
    const cliente = clientesBase.find(cli => String(cli.id) === String(estadoCta.cuenta.clienteId) || cli.nombre === estadoCta.cuenta.nombre);

    if (!cliente || !cliente.telefono) {
        return alert("⚠️ Este cliente no tiene un número de teléfono registrado.");
    }

    let telefono = cliente.telefono.replace(/\D/g, '');
    if (telefono.length === 10) {
        telefono = '52' + telefono;
    }

    let mensaje = `Hola *${cliente.nombre}*, te saludamos de *Mueblería Mi Pueblito* 🛋️.\n\n`;
    if (estadoCta.montoVencido > 0) {
        mensaje += `Te recordamos amablemente que tienes un saldo vencido por *$${estadoCta.montoVencido.toFixed(2)}* correspondiente al folio ${folio}.\n\n¿Podemos ayudarte con algo para poner tu cuenta al corriente?`;
    } else {
        mensaje += `Te escribimos para recordarte de tu saldo activo por *$${estadoCta.saldoTotal.toFixed(2)}* del folio ${folio}.\n\nCualquier duda estamos a tus órdenes.`;
    }

    if (estadoCta.promesaVigente && estadoCta.cuenta.promesaPago) {
        const fechaP = new Date(estadoCta.cuenta.promesaPago.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
        mensaje += `\n\nTenemos registrada tu *promesa de pago para el día ${fechaP}*. ¡Muchas gracias por tu compromiso!`;
    }

    mensaje += `\n\nExcelente día. ✨`;

    const url = `https://api.whatsapp.com/send?phone=${telefono}&text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
};

function filtrarCuentasCobranza() {
    renderCuentasXCobrar();
}

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

    pagares.forEach(p => {
        if (p.estado === "Pendiente" || p.estado === "Parcial") {
            const fechaPago = new Date(p.fechaVencimiento);
            const clave = fechaPago.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
            
            if (!posMeses[clave]) {
                posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [] };
            }

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

    cuentas.forEach(cuenta => {
        if (cuenta.abonos && Array.isArray(cuenta.abonos)) {
            cuenta.abonos.forEach(abono => {
                const partes = (abono.fecha || '').split('/');
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

    let html = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">`;

    Object.entries(posMeses).forEach(([mes, datos]) => {
        if (datos.total === 0) return; 

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
    const hoy = new Date();
    let csv = "Folio,Fecha Vencimiento,Monto,Estado,Dias Atraso\n";
    pagares.forEach(p => {
        const venc = new Date(p.fechaVencimiento);
        const esPendiente = p.estado !== "Pagado" && p.estado !== "Cancelado";
        const diasAtraso = esPendiente && venc < hoy
            ? Math.floor((hoy - venc) / (1000 * 60 * 60 * 24))
            : 0;
        csv += `${p.folio},${p.fechaVencimiento},${p.monto},${p.estado},${diasAtraso}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cobranza_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
}

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
    
    const tarjetas = StorageService.get('tarjetasConfig', []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal", saldo: 0 }]);
    
    if (medio === 'efectivo') {
        divCuenta.style.display = 'block'; 
        selCuenta.innerHTML = cajas.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
    } else if (medio === 'transferencia') {
        const cuentasDebito = tarjetas.filter(t => t.tipo === 'debito');
        if (cuentasDebito.length === 0) {
            divCuenta.style.display = 'none';
            selCuenta.innerHTML = '<option value="">Sin cuentas débito registradas</option>';
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
    const selCuenta = document.getElementById('cuentaEspecifica_' + idSufijo);
    const cuentaEspecifica = selCuenta?.value || '';
    const textoCuenta = selCuenta?.options[selCuenta.selectedIndex]?.text || '';
    
    let cuentaId, etiqueta;
    if (medioPago === 'efectivo') {
        cuentaId = cuentaEspecifica || 'efectivo';
        etiqueta = textoCuenta || '💵 Efectivo';
    } else if (medioPago === 'transferencia') {
        cuentaId = cuentaEspecifica || '';
        etiqueta = cuentaEspecifica ? `🏦 ${cuentaEspecifica} Débito` : '🏦 Transferencia';
    } else if (medioPago === 'tarjeta_credito') {
        cuentaId = cuentaEspecifica || '';
        etiqueta = cuentaEspecifica ? `💳 ${cuentaEspecifica} Crédito` : '💳 Tarjeta';
    } else {
        cuentaId = 'efectivo';
        etiqueta = '💵 Efectivo';
    }
    return { medioPago, cuentaId, etiqueta };
}

function abrirModalAbonoAvanzado(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return alert("Cuenta no encontrada.");

    const hoy = new Date();
    const todosPagares = pagares
        .filter(p => p.folio === folio)
        .sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento));
    
    const pagaresCliente = todosPagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial');
    const saldo = pagaresCliente.reduce((s, p) => {
        if (p.estado === "Parcial") return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
        return s + (p.monto || 0);
    }, 0);
    
    let precioContadoReal = 0;
    if (cuenta.articulos && cuenta.articulos.length > 0) {
        precioContadoReal = cuenta.articulos.reduce((sum, art) => {
            return sum + (Number(art.precioContado || art.precio || 0) * Number(art.cantidad || 1));
        }, 0);
    }
    let original = precioContadoReal > 0 ? precioContadoReal : (Number(cuenta.totalContadoOriginal || cuenta.totalMercancia || 0));
    const enganche = Number(cuenta.engancheRecibido || 0);
    const montoAFinanciarContado = Math.max(0, original - enganche);

    const totalAbonosRegistrados = todosPagares.reduce((s, p) => {
        if (p.estado === 'Parcial') return s + (p.montoAbonado || 0);
        if (p.estado === 'Pagado') return s + (p.montoAbonado || p.monto || 0);
        return s;
    }, 0);

    const restanteContado = Math.max(0, montoAFinanciarContado - totalAbonosRegistrados);
    const periodicidadCuenta = cuenta.periodicidad || "semanal";
    const fechaVenta = new Date(cuenta.fecha || cuenta.fechaVenta);
    const diasDesdeVenta = Math.floor((hoy - fechaVenta) / (1000 * 60 * 60 * 24));
    const aplicaPoliticaContado = diasDesdeVenta <= 30; 

    let montoProximoMes = null;
    let mesesPlanMasCercano = null;
    if (!aplicaPoliticaContado && Array.isArray(cuenta.saldosPorMes)) {
        let mejorPlan = cuenta.saldosPorMes.find(plan => (plan.total - totalAbonosRegistrados) > 0);
        if (mejorPlan) {
            montoProximoMes = Math.max(0, mejorPlan.total - totalAbonosRegistrados);
            mesesPlanMasCercano = mejorPlan.meses;
        }
    }

    const articulosHTML = (cuenta.articulos || []).length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">🛒 Artículos:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:13px;">
                ${cuenta.articulos.map(a => `<tr><td style="padding:4px; border-bottom:1px solid #eee;">${a.nombre}</td><td style="text-align:right; padding:4px; border-bottom:1px solid #eee;">x${a.cantidad}</td></tr>`).join('')}
            </table>
        </div>` : '';

    const pagaresHTML = todosPagares.length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">📋 Pagarés:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:12px;">
                <thead><tr style="background:#f8fafc;"><th style="padding:5px; text-align:left;">#</th><th>Vencimiento</th><th style="text-align:right;">Saldo</th><th style="text-align:center;">Estado</th></tr></thead>
                <tbody>
                    ${todosPagares.map((p, i) => {
                        const esPagado = p.estado === 'Pagado' || p.estado === 'Cancelado';
                        const fechaVenc = new Date(p.fechaVencimiento);
                        const diasAtraso = !esPagado && fechaVenc < hoy ? Math.floor((hoy - fechaVenc) / (1000 * 60 * 60 * 24)) : 0;
                        const esVencido = !esPagado && diasAtraso > 0;
                        
                        let montoDisp = esPagado ? 0 : (p.estado === 'Parcial' ? (p.monto - p.montoAbonado) : p.monto);
                        
                        const rowStyle = esPagado ? 'color:#9ca3af; background:#f9fafb;' : (esVencido ? 'background:#fff1f2;' : '');
                        let badge = `<span style="padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; ${
                            esPagado ? 'background:#e5e7eb; color:#4b5563;' : 
                            (esVencido ? 'background:#fee2e2; color:#b91c1c;' : 'background:#fef3c7; color:#92400e;')
                        }">${esVencido ? 'VENCIDO' : p.estado.toUpperCase()}</span>`;

                        return `<tr style="${rowStyle}">
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9;">${i + 1}</td>
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9;">${p.fechaVencimiento} ${esVencido ? `<br><small style="color:#dc2626;">(${diasAtraso} días)</small>` : ''}</td>
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9; text-align:right;">${dinero(montoDisp)}</td>
                            <td style="padding:7px 5px; border-bottom:1px solid #f1f5f9; text-align:center;">${badge}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>` : '';

    let selectorCuentasHTML = '';
    if (typeof window._buildSelectorCuentas === 'function') {
        selectorCuentasHTML = window._buildSelectorCuentas('cuentaOrigen_abono', false);
    } else {
        selectorCuentasHTML = `<select id="cuentaOrigen_abono" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;"><option value="efectivo">💵 Efectivo Principal</option></select>`;
    }

    let modalHTML = `
        <div data-modal="abono-avanzado" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto; font-family:sans-serif;">
                <h2 style="margin-top:0;">💰 Registrar Abono - ${cuenta.nombre}</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
                    <div><small style="color:#4b5563;">Saldo Crédito</small><br><strong style="font-size:20px; color:#16a34a;">${dinero(saldo)}</strong></div>
                    <div style="text-align:right;"><small style="color:#4b5563;">Días Venta</small><br><strong style="font-size:20px; color:#2563eb;">${diasDesdeVenta}</strong></div>
                </div>

                ${articulosHTML}
                ${pagaresHTML}

                <div style="display:grid; grid-template-columns: 1fr 1.5fr; gap:10px; margin-bottom:15px;">
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">📅 Fecha de pago:</label>
                        <input type="date" id="fechaAbonoInput" value="${new Date().toISOString().substring(0,10)}" 
                            style="padding:12px; font-size:16px; border:2px solid #e2e8f0; border-radius:8px; width:100%; box-sizing:border-box;">
                    </div>
                    <div>
                        <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">Monto a abonar:</label>
                        <input type="number" id="montoAbono" placeholder="0.00" 
                            oninput="actualizarAvisoPoliticaAbono('${folio}', ${original}, ${enganche}, '${periodicidadCuenta}', ${aplicaPoliticaContado}, ${mesesPlanMasCercano || 'null'}, ${restanteContado}, ${montoProximoMes || 'null'})"
                            style="padding:12px; font-size:18px; border:2px solid #3b82f6; border-radius:8px; width:100%; box-sizing:border-box;">
                    </div>
                </div>

                <div style="background:#f8fafc; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:20px;">
                    <label style="display:block; margin-bottom:5px; font-weight:bold; color:#374151;">💳 ¿A qué caja/cuenta ingresa el dinero?</label>
                    ${selectorCuentasHTML}
                </div>

                <div style="background:#fffbeb; padding:15px; border-radius:8px; border-left:5px solid #f59e0b; margin-bottom:20px;">
                    <strong style="color:#92400e;">💡 Política de pago anticipado</strong>
                    <p style="margin:8px 0 0 0; font-size:14px; color:#78350f;">
                        ${aplicaPoliticaContado 
                            ? `Está dentro de los 30 días. Liquida con precio de contado: <strong>${dinero(restanteContado)}</strong>.`
                            : (mesesPlanMasCercano 
                                ? `Periodo de contado vencido. Puede liquidar a plan de ${mesesPlanMasCercano} meses con: <strong>${dinero(montoProximoMes)}</strong>.`
                                : `Debe liquidar el saldo total de su crédito.`)}
                    </p>
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarAbonoAvanzado('${folio}', ${original}, ${saldo}, ${aplicaPoliticaContado})" 
                            style="flex:2; padding:15px; background:#22c55e; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✅ Procesar Abono
                    </button>
                    <button onclick="document.querySelector('[data-modal=&quot;abono-avanzado&quot;]')?.remove();" 
                            style="flex:1; padding:15px; background:#ef4444; color:white; border:none; border-radius:8px; cursor:pointer;">
                        Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function actualizarAvisoPoliticaAbono(cuenta) {
    const avisoDiv = document.getElementById("avisoPoliticaAbono");
    if (!avisoDiv) return;

    const precioContadoOriginal = Number(cuenta.totalContadoOriginal || 0);
    const enganche = Number(cuenta.engancheRecibido || 0);
    const saldoBaseSinInteres = precioContadoOriginal - enganche;

    const fechaVenta = new Date(cuenta.fecha);
    const fechaHoy = new Date();
    const diferenciaSms = fechaHoy - fechaVenta;
    const dias = Math.floor(diferenciaSms / (1000 * 60 * 60 * 24));

    const planes = CalculatorService.calcularCredito(saldoBaseSinInteres);

    let montoParaLiquidar = 0;
    let mensaje = "";

    if (dias <= 30) {
        montoParaLiquidar = saldoBaseSinInteres;
        mensaje = `Política de pago anticipado: Dentro de los primeros 30 días, el cliente puede liquidar al precio sin interés con: <b>$${montoParaLiquidar.toLocaleString('en-US', {minimumFractionDigits:2})}</b>.`;
    } else if (dias <= 60) {
        montoParaLiquidar = planes[1].total;
        mensaje = `Han pasado ${dias} días. El periodo de contado venció. Puede liquidar con el costo a 2 meses de: <b>$${montoParaLiquidar.toLocaleString('en-US', {minimumFractionDigits:2})}</b>.`;
    } else if (dias <= 90) {
        montoParaLiquidar = planes[2].total;
        mensaje = `Venta con ${dias} días. Monto para liquidar según plan de 3 meses: <b>$${montoParaLiquidar.toLocaleString('en-US', {minimumFractionDigits:2})}</b>.`;
    } else {
        montoParaLiquidar = Number(cuenta.totalVenta || 0); 
        mensaje = `Días transcurridos: ${dias}. Para liquidar debe cubrir el saldo total de su plan actual: <b>$${montoParaLiquidar.toLocaleString('en-US', {minimumFractionDigits:2})}</b>.`;
    }

    const totalAbonado = (cuenta.abonos || []).reduce((sum, ab) => sum + Number(ab.monto), 0);
    const pagoFinal = montoParaLiquidar - totalAbonado;

    avisoDiv.innerHTML = `
        <div class="alert alert-info">
            <i class="fas fa-clock"></i> ${mensaje}
            ${totalAbonado > 0 ? `<br><small>(Menos $${totalAbonado} en abonos registrados)</small>` : ''}
            <hr>
            <strong>Total a cobrar hoy: $${pagoFinal.toLocaleString('en-US', {minimumFractionDigits:2})}</strong>
        </div>`;
}

function evaluarPoliticaLiquidacion(folio, montoAbono) {
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresFolio = pagares.filter(p => p.folio === folio);

    if (!pagaresFolio.length) return null;

    const totalPagado = pagaresFolio.reduce((s, p) => s + (p.montoAbonado || (p.estado === "Pagado" ? p.monto || 0 : 0)), 0);

    const pendientes = pagaresFolio.filter(p => p.estado !== "Pagado" && p.estado !== "Cancelado");
    const saldoActual = pendientes.reduce((s, p) => {
        if (p.estado === "Parcial") return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
        return s + (p.monto || 0);
    }, 0);

    const totalConAbono = totalPagado + montoAbono;
    const saldoBase = saldoActual + totalPagado;

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    const periodicidad = cuenta?.periodicidad || "semanal";

    const planes = CalculatorService.calcularCreditoConPeriodicidad
        ? CalculatorService.calcularCreditoConPeriodicidad(saldoBase, periodicidad)
        : CalculatorService.calcularCredito(saldoBase);

    let planAplicable = null;
    for (let plan of planes) {
        if (totalConAbono >= plan.total) {
            planAplicable = plan;
            break;
        }
    }

    if (!planAplicable) return null;

    const montoCorrecto = Math.max(0, planAplicable.total - totalPagado);

    return {
        aplica: true,
        montoCorrecto,
        ahorro: Math.max(0, saldoActual - montoCorrecto),
        plan: planAplicable
    };
} 

function confirmarPoliticaAntesDeGuardar(folio, monto, continuar) {
    const evalPol = evaluarPoliticaLiquidacion(folio, monto);

    if (!evalPol || !evalPol.aplica) {
        continuar(false);
        return;
    }

    if (Math.abs(monto - evalPol.montoCorrecto) < 0.01) {
        continuar(true, evalPol);
        return;
    }

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
    
    const fechaAbonoRaw = document.getElementById("fechaAbonoInput")?.value;
    const fechaObj = fechaAbonoRaw ? new Date(fechaAbonoRaw + "T12:00:00") : new Date();
    const fechaAbonoStr = fechaObj.toLocaleDateString("es-MX");
    const fechaAbonoIso = fechaObj.toISOString();
    
    const selCaja = document.getElementById("cuentaOrigen_abono");
    const cuentaId = selCaja ? selCaja.value : 'efectivo';
    const etiqueta = selCaja ? selCaja.options[selCaja.selectedIndex].text : 'Efectivo';
    const isCaja = String(cuentaId).startsWith('caja_') || cuentaId === 'efectivo';
    const medioPago = isCaja ? 'efectivo' : 'transferencia';

    if (isNaN(montoAbonoInput) || montoAbonoInput <= 0) {
        alert("Ingresa un monto válido.");
        return;
    }

    if (montoAbonoInput > (saldoActual + 0.01)) { 
        alert("El abono no puede ser mayor al saldo.");
        return;
    }

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio) || {};

    let montoFinal = montoAbonoInput;
    let liquidacionPorPolitica = false;

    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresFolio = pagares.filter(p => p.folio === folio);
    
    let precioContadoReal = 0;
    if (cuenta.articulos && cuenta.articulos.length > 0) {
        precioContadoReal = cuenta.articulos.reduce((sum, art) => {
            return sum + (Number(art.precioContado || art.precio || 0) * Number(art.cantidad || 1));
        }, 0);
    }
    const baseContadoParaCalculo = precioContadoReal > 0 ? precioContadoReal : Number(montoOriginal);
    
    const totalAbonosPagados = pagaresFolio.reduce((s, p) => {
        if (p.estado === "Pagado") return s + (p.monto || 0);
        if (p.estado === "Parcial") return s + (p.montoAbonado || 0);
        return s;
    }, 0);

    const enganche = Number(cuenta.engancheRecibido || 0);
    const saldoContadoSinInteres = Math.max(0, baseContadoParaCalculo - enganche);
    const restanteContado = Math.max(0, saldoContadoSinInteres - totalAbonosPagados);

    if (aplicaPoliticaContado && restanteContado > 0 && montoAbonoInput >= (restanteContado - 0.01)) {
        if (confirm(`💡 EL CLIENTE ESTÁ EN PERIODO DE GRACIA (30 DÍAS)\n\nPuede liquidar al precio sin interés pagando sólo: ${dinero(restanteContado)}\n\n¿Deseas aplicar esta política y condonar los intereses restantes?`)) {
            montoFinal = restanteContado;
            liquidacionPorPolitica = true;
        } else {
            montoFinal = montoAbonoInput;
        }
    }

    if (!liquidacionPorPolitica) {
        const evalPol = evaluarPoliticaLiquidacion(folio, montoAbonoInput);
        if (evalPol && evalPol.aplica) {
            if (confirm(`💡 LIQUIDACIÓN INTELIGENTE (SALTO DE PLAN)\n\nEl abono alcanza para cubrir un plan más corto. El cliente puede liquidar su cuenta con: ${dinero(evalPol.montoCorrecto)}\n(Se le ahorrarán ${dinero(evalPol.ahorro)}).\n\n¿Deseas aplicar el descuento y dar por liquidada la cuenta?`)) {
                montoFinal = evalPol.montoCorrecto;
                liquidacionPorPolitica = true;
            } else {
                montoFinal = montoAbonoInput;
            }
        }
    }

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

    let _todosActualizados = _todosLosPagares.map(p => {
        if (_pagaresCubiertos.find(pc => pc.id === p.id)) {
            return { ...p, estado: "Pagado", fechaAbono: fechaAbonoStr, montoAbonado: p.monto };
        }
        if (_pagareParcial && p.id === _pagareParcial.id) {
            return { ...p, estado: "Parcial", fechaAbono: fechaAbonoStr, montoAbonado: (p.montoAbonado || 0) + _pagareParcial.montoAplicado };
        }
        return p;
    });

    if (liquidacionPorPolitica) {
        _todosActualizados = _todosActualizados.map(p => {
            if (p.folio === folio && (p.estado === "Pendiente" || p.estado === "Parcial")) {
                return { ...p, estado: "Cancelado", nota: "Liquidado por política" };
            }
            return p;
        });
    }

    StorageService.set("pagaresSistema", _todosActualizados);

    const cuentasXCobrar = StorageService.get("cuentasPorCobrar", []);
    const idxCuenta = cuentasXCobrar.findIndex(c => c.folio === folio);
    let nuevoSaldoReal = 0;

    if (idxCuenta !== -1) {
        const cuentaAct = cuentasXCobrar[idxCuenta];
        cuentaAct.abonos = cuentaAct.abonos || [];
        
        cuentaAct.abonos.push({
            fecha: fechaAbonoStr,
            monto: montoFinal,
            cuentaId,
            medioPago,
            etiquetaCuenta: etiqueta,
            vendedorId: cuentaAct.vendedorId || null
        });

        const _pagaresAct = StorageService.get("pagaresSistema", []);
        nuevoSaldoReal = _pagaresAct
            .filter(p => p.folio === folio && (p.estado === 'Pendiente' || p.estado === 'Parcial'))
            .reduce((s, p) => {
                if (p.estado === 'Parcial') return s + Math.max(0, (p.monto || 0) - (p.montoAbonado || 0));
                return s + (p.monto || 0);
            }, 0);

        cuentaAct.saldoActual = nuevoSaldoReal;
        
        if (nuevoSaldoReal <= 0.01) { 
            cuentaAct.estado = "Saldado";
            cuentaAct.saldoActual = 0;
            nuevoSaldoReal = 0;
        }

        cuentasXCobrar[idxCuenta] = cuentaAct;
        StorageService.set("cuentasPorCobrar", cuentasXCobrar);

        if (typeof window._ingresarCuenta === 'function') {
            window._ingresarCuenta({
                monto: montoFinal,
                cuentaId: cuentaId,
                etiqueta: etiqueta,
                concepto: `Abono a ${cuentaAct.nombre} - ${folio}`,
                referencia: `ABONO-${folio}`,
                fecha: fechaAbonoIso 
            });
        } else {
            let movimientos = StorageService.get("movimientosCaja", []);
            movimientos.push({
                id: Date.now(),
                folio,
                fecha: fechaAbonoIso,
                monto: montoFinal,
                tipo: "ingreso",
                concepto: `Abono a ${cuentaAct.nombre} - ${folio}`,
                referencia: "Abono",
                cuenta: cuentaId,
                medioPago,
                etiquetaCuenta: etiqueta
            });
            StorageService.set("movimientosCaja", movimientos);
        }
    }

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
        fecha: fechaAbonoStr, 
        metodoCobro: medioPago || "efectivo",
        cuentaDestino: etiqueta || "efectivo",
        pagaresCubiertos: _pagaresCubiertosTicket,
        pagaresRestantes: _pagaresRestantes,
        articulos: _cuentaData?.articulos || [],
        totalVenta: baseContadoParaCalculo,
        enganche: enganche
    });

    if (typeof window.registrarComisionAbono === 'function' && _cuentaData && _cuentaData.vendedorId) {
        window.registrarComisionAbono(folio, montoFinal, _cuentaData.vendedorId);
    }

    try {
        const _tickets = StorageService.get("registroTickets", []);
        const _tIdx = _tickets.findIndex(t => t.folio === folio);
        if (_tIdx !== -1 && _tickets[_tIdx].pagares) {
            const _pagaresActualizados = StorageService.get("pagaresSistema", []);
            _tickets[_tIdx].pagares = _tickets[_tIdx].pagares.map(tp => {
                const pActual = _pagaresActualizados.find(p => p.numeroPagere === tp.numeroPagere);
                if (!pActual) return tp;
                return {
                    ...tp,
                    estado:        pActual.estado,
                    fechaAbono:    pActual.fechaAbono    || tp.fechaAbono,
                    montoAbonado:  pActual.montoAbonado  || tp.montoAbonado
                };
            });
            _tickets[_tIdx].ultimaActualizacion = new Date().toISOString();
            StorageService.set("registroTickets", _tickets);
        }
    } catch(e) {
        console.warn("⚠️ No se pudo sincronizar registroTickets:", e.message);
    }

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

    let clientesBD = StorageService.get("clientes", []);
    clientesBD.push(nuevo);
    if (!StorageService.set("clientes", clientesBD)) {
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
                    <td>${esc(new Date(p.fechaVencimiento).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }))}</td>
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
            <div>Mueblería Mi Pueblito</div>
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
    const estadoCta = window._calcularEstadoCuenta(folio);
    if (!estadoCta) return alert("Cuenta no encontrada.");

    const { cuenta, pagares, pagaresVencidos, montoVencido, saldoTotal, totalAbonado, estadoGeneral } = estadoCta;
    const totalVenta = Number(cuenta.totalContadoOriginal || cuenta.saldoOriginal || 0);
    const enganche = Number(cuenta.engancheRecibido || 0);
    const abonos = cuenta.abonos || [];
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    const amortizacionHTML = pagares.length > 0
        ? pagares.map((p, i) => {
            const esVencido = p.estado === "Pendiente" && new Date(p.fechaVencimiento) < new Date();
            const rowStyle = esVencido ? 'background:#fff1f2;' : (p.estado === "Pagado" ? 'background:#f8fafc; color:#94a3b8;' : '');
            let estadoBadge = '';
            if (p.estado === "Pagado") estadoBadge = `<span style="color:#10b981; font-weight:bold; font-size:12px;">✅ Pagado</span>`;
            else if (esVencido) estadoBadge = `<span style="color:#e11d48; font-weight:bold; font-size:12px;">⚠️ Vencido</span>`;
            else if (p.estado === "Cancelado") estadoBadge = `<span style="color:#64748b; font-weight:bold; font-size:12px;">✖ Cancelado</span>`;
            else if (p.estado === "Parcial") estadoBadge = `<span style="color:#d97706; font-weight:bold; font-size:12px;">⏳ Parcial</span>`;
            else estadoBadge = `<span style="color:#3b82f6; font-weight:bold; font-size:12px;">🗓️ Pendiente</span>`;

            return `<tr style="${rowStyle} border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px 8px; text-align:center; color:#64748b;">${i + 1}</td>
                <td style="padding:10px 8px; font-weight:500;">${esc(p.fechaVencimiento || '-')}</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold;">${dinero(p.monto || 0)}</td>
                <td style="padding:10px 8px; text-align:center;">${estadoBadge}</td>
                <td style="padding:10px 8px; font-size:12px;">${esc(p.fechaAbono || '-')}</td>
                <td style="padding:10px 8px; text-align:right; color:#10b981; font-weight:bold;">${p.montoAbonado ? dinero(p.montoAbonado) : '-'}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="6" style="padding:20px; text-align:center; color:#94a3b8; font-style:italic;">Sin pagarés registrados</td></tr>`;

    const abonosHTML = abonos.length > 0
        ? abonos.map(a => {
            let etiqueta = a.etiquetaCuenta || a.medioPago || '-';
            const esEfectivo = (a.medioPago === 'efectivo') || String(a.cuentaId||a.cuenta||'').startsWith('caja_') || String(a.cuentaId||a.cuenta||'') === 'efectivo';
            
            if (esEfectivo) {
                etiqueta = '💵 Efectivo';
            } else if (!etiqueta.includes('🏦') && !etiqueta.includes('💳')) {
                etiqueta = '🏦 ' + etiqueta; 
            }

            return `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:10px 8px; color:#475569;">${esc(a.fecha || '-')}</td>
                <td style="padding:10px 8px; text-align:right; font-weight:bold; color:#15803d;">+ ${dinero(a.monto || 0)}</td>
                <td style="padding:10px 8px; color:#475569;">${esc(etiqueta)}</td>
            </tr>`;
        }).join('')
        : `<tr><td colspan="3" style="padding:20px; text-align:center; color:#94a3b8; font-style:italic;">Sin abonos registrados</td></tr>`;

    const modalHTML = `
        <div data-modal="estado-cuenta-folio" style="position:fixed; inset:0; background:rgba(15,23,42,0.85); z-index:7000; display:flex; justify-content:center; align-items:flex-start; overflow-y:auto; padding:20px; backdrop-filter: blur(4px);">
            <div id="estadoCuentaFolioDoc" style="background:white; padding:35px; border-radius:16px; width:100%; max-width:900px; margin:0 auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
                
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:25px; border-bottom:2px solid #f1f5f9; padding-bottom:20px;">
                    <div style="display:flex; align-items:center; gap:20px;">
                        <img src="img/logo.png" style="width:70px; height:70px; object-fit:contain; border-radius:10px;" onerror="this.style.display='none'">
                        <div>
                            <div style="font-size:24px; font-weight:900; color:#0f172a; letter-spacing:-0.5px;">MUEBLERÍA MI PUEBLITO</div>
                            <div style="font-size:15px; color:#64748b; font-weight:500;">Estado de Cuenta Oficial</div>
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:22px; font-weight:bold; color:#1e40af;">Folio: ${esc(folio)}</div>
                        <div style="font-size:14px; color:#64748b; margin-top:4px;">Emisión: ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</div>
                        <span style="display:inline-block; margin-top:8px; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:bold; background:${estadoGeneral==='Saldado'?'#dcfce7':estadoGeneral==='Al corriente'?'#dbeafe':'#fee2e2'}; color:${estadoGeneral==='Saldado'?'#166534':estadoGeneral==='Al corriente'?'#1e40af':'#991b1b'};">${estadoGeneral.toUpperCase()}</span>
                    </div>
                </div>

                <div style="background:#f8fafc; padding:20px; border-radius:12px; margin-bottom:25px; border:1px solid #e2e8f0; display:flex; justify-content:space-between;">
                    <div>
                        <div style="font-size:12px; color:#64748b; text-transform:uppercase; font-weight:bold; letter-spacing:1px; margin-bottom:4px;">Datos del Cliente</div>
                        <div style="font-size:18px; font-weight:bold; color:#0f172a;">${esc(cuenta.nombre)}</div>
                        ${cuenta.telefono ? `<div style="font-size:14px; color:#475569; margin-top:4px;">📞 ${esc(cuenta.telefono)}</div>` : ''}
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px; color:#64748b; text-transform:uppercase; font-weight:bold; letter-spacing:1px; margin-bottom:4px;">Fecha de Venta</div>
                        <div style="font-size:16px; font-weight:bold; color:#0f172a;">${cuenta.fechaVenta ? new Date(cuenta.fechaVenta).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '-'}</div>
                        <div style="font-size:13px; color:#475569; margin-top:4px;">Modalidad: ${cuenta.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</div>
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:15px; margin-bottom:30px;">
                    <div style="padding:15px; border-radius:12px; background:#fff; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold; margin-bottom:5px;">TOTAL VENTA</div>
                        <div style="font-size:20px; font-weight:900; color:#0f172a;">${dinero(totalVenta)}</div>
                    </div>
                    <div style="padding:15px; border-radius:12px; background:#fff; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold; margin-bottom:5px;">ENGANCHE</div>
                        <div style="font-size:20px; font-weight:900; color:#0f172a;">${dinero(enganche)}</div>
                    </div>
                    <div style="padding:15px; border-radius:12px; background:#f0fdf4; border:1px solid #bbf7d0;">
                        <div style="font-size:12px; color:#166534; font-weight:bold; margin-bottom:5px;">TOTAL ABONADO</div>
                        <div style="font-size:20px; font-weight:900; color:#15803d;">${dinero(totalAbonado)}</div>
                    </div>
                    <div style="padding:15px; border-radius:12px; background:${saldoTotal > 0 ? '#fff1f2' : '#f8fafc'}; border:1px solid ${saldoTotal > 0 ? '#fecdd3' : '#e2e8f0'};">
                        <div style="font-size:12px; color:${saldoTotal > 0 ? '#e11d48' : '#64748b'}; font-weight:bold; margin-bottom:5px;">SALDO ACTUAL</div>
                        <div style="font-size:20px; font-weight:900; color:${saldoTotal > 0 ? '#be123c' : '#0f172a'};">${dinero(saldoTotal)}</div>
                    </div>
                </div>

                ${pagaresVencidos.length > 0 ? `
                <div style="background:#fef2f2; border-left:4px solid #ef4444; padding:15px 20px; border-radius:8px; margin-bottom:25px;">
                    <span style="color:#b91c1c; font-weight:bold; font-size:15px;">⚠️ Atención: Cuenta con ${pagaresVencidos.length} pagaré(s) vencido(s) por un total de ${dinero(montoVencido)}</span>
                </div>` : ''}

                <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:25px; margin-bottom:30px;">
                    <div>
                        <h3 style="margin:0 0 15px 0; color:#0f172a; font-size:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">📋 Amortización</h3>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                                <thead>
                                    <tr style="background:#f8fafc;">
                                        <th style="padding:10px 8px; text-align:center; color:#64748b;">No.</th>
                                        <th style="padding:10px 8px; text-align:left; color:#64748b;">Vencimiento</th>
                                        <th style="padding:10px 8px; text-align:right; color:#64748b;">Monto</th>
                                        <th style="padding:10px 8px; text-align:center; color:#64748b;">Estado</th>
                                        <th style="padding:10px 8px; text-align:left; color:#64748b;">F. Pago</th>
                                        <th style="padding:10px 8px; text-align:right; color:#64748b;">Abonado</th>
                                    </tr>
                                </thead>
                                <tbody>${amortizacionHTML}</tbody>
                            </table>
                        </div>
                    </div>

                    <div>
                        <h3 style="margin:0 0 15px 0; color:#0f172a; font-size:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">💰 Historial de Abonos</h3>
                        <div style="background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; overflow:hidden;">
                            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                                <thead>
                                    <tr style="background:#f1f5f9;">
                                        <th style="padding:10px 8px; text-align:left; color:#64748b;">Fecha</th>
                                        <th style="padding:10px 8px; text-align:right; color:#64748b;">Importe</th>
                                        <th style="padding:10px 8px; text-align:left; color:#64748b;">Medio</th>
                                    </tr>
                                </thead>
                                <tbody>${abonosHTML}</tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="no-print" style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid #e2e8f0; padding-top:20px; margin-top:20px;">
                    <div style="display:flex; gap:10px;">
                        <button onclick="imprimirEstadoCuentaFolio()" style="padding:10px 16px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:500; cursor:pointer;">🖨️ Imprimir PDF</button>
                        <button onclick="guardarImagenEstadoCuenta()" style="padding:10px 16px; background:#059669; color:white; border:none; border-radius:8px; font-weight:500; cursor:pointer;">📷 Guardar Imagen</button>
                    </div>
                    <button onclick="document.querySelector('[data-modal=&quot;estado-cuenta-folio&quot;]').remove();" style="padding:10px 20px; background:#ef4444; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">✕ Cerrar</button>
                </div>
                
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// ===== FUNCIONES RECUPERADAS PARA QUE NO EXPLOTE EL SISTEMA =====
function abrirEstadoCuentaCliente(clienteId) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => String(c.clienteId) === String(clienteId) && c.estado !== 'Saldado') || cuentas.find(c => String(c.clienteId) === String(clienteId));
    
    if (cuenta) {
        abrirEstadoCuentaFolio(cuenta.folio);
    } else {
        alert("Este cliente no tiene cuentas de crédito registradas.");
    }
}

function imprimirEstadoCuentaFolio() {
    window.print();
}

function guardarImagenEstadoCuenta() {
    const el = document.getElementById('estadoCuentaFolioDoc');
    if (!el) { window.print(); return; }
    
    if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.onload = function() {
            html2canvas(el).then(canvas => {
                const link = document.createElement('a');
                link.download = 'Estado_Cuenta.png';
                link.href = canvas.toDataURL();
                link.click();
            });
        };
        document.head.appendChild(script);
    } else {
        html2canvas(el).then(canvas => {
            const link = document.createElement('a');
            link.download = 'Estado_Cuenta.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
}

function renderClientesMorosos() {
    renderCuentasXCobrar('', 'Atrasado');
}

function exportarMorososCSV() {
    exportarCobranzaEsperada();
}

function abrirHistorialAbonos(folio) {
    // Si estás usando la misma vista detallada
    abrirEstadoCuentaFolio(folio);
}

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
        fecha: abono.fecha || new Date().toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
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

// ===== PROMESA DE PAGO =====
function abrirModalPromesaPago(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    if (!cuenta) return;

    const promesaAct = cuenta.promesaPago || { fecha: '', notas: '' };

    const modalHTML = `
    <div data-modal="promesa-pago" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:12px; width:90%; max-width:400px;">
            <h2 style="margin-top:0; color:#d97706;">📝 Promesa de Pago</h2>
            <p style="font-size:13px; color:#4b5563; margin-bottom:15px;">Cliente: <strong>${cuenta.nombre}</strong><br>Folio: ${folio}</p>
            
            <div style="margin-bottom:15px;">
                <label style="font-weight:bold; font-size:13px; color:#374151;">El cliente promete pagar el día:</label>
                <input type="date" id="promesaFecha" value="${promesaAct.fecha}" style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px; margin-top:5px; box-sizing:border-box;">
            </div>
            
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold; font-size:13px; color:#374151;">Notas / Comentarios:</label>
                <textarea id="promesaNotas" rows="3" placeholder="Ej: Pasará en la tarde a dejar el dinero..." style="width:100%; padding:10px; border:1px solid #d1d5db; border-radius:6px; margin-top:5px; box-sizing:border-box;">${promesaAct.notas}</textarea>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="guardarPromesaPago('${folio}')" style="flex:1; padding:12px; background:#d97706; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">💾 Guardar Promesa</button>
                <button onclick="document.querySelector('[data-modal=&quot;promesa-pago&quot;]').remove()" style="flex:1; padding:12px; background:#6b7280; color:white; border:none; border-radius:6px; cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function guardarPromesaPago(folio) {
    const fecha = document.getElementById('promesaFecha').value;
    const notas = document.getElementById('promesaNotas').value.trim();

    if (!fecha) return alert('⚠️ Debes seleccionar una fecha para la promesa.');

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const idx = cuentas.findIndex(c => c.folio === folio);
    if (idx === -1) return;

    cuentas[idx].promesaPago = { fecha, notas, fechaRegistro: new Date().toISOString() };
    StorageService.set("cuentasPorCobrar", cuentas);

    document.querySelector('[data-modal="promesa-pago"]').remove();
    alert('✅ Promesa de pago registrada. El cliente ha sido clasificado como "Promesa".');
    renderCuentasXCobrar();
}

// ===== BURÓ DE CRÉDITO INTERNO (SCORING) =====
window.calcularCalificacionCliente = function(clienteId) {
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresCliente = pagares.filter(p => String(p.clienteId) === String(clienteId));
    
    if (pagaresCliente.length === 0) {
        return { estrellas: '🌟 N/A', texto: 'Cliente Nuevo', color: '#64748b', bg: '#f1f5f9' };
    }

    let totalPagares = pagaresCliente.length;
    let pagaresAtrasados = 0;
    let maxDiasAtrasoHist = 0;
    const hoy = new Date();

    pagaresCliente.forEach(p => {
        if (p.estado === 'Pagado' && p.fechaAbono) {
            const fVenc = new Date(p.fechaVencimiento);
            const fPago = new Date(p.fechaAbono);
            if (fPago > fVenc) {
                const dias = Math.floor((fPago - fVenc) / (1000 * 60 * 60 * 24));
                if (dias > 3) pagaresAtrasados++; 
                if (dias > maxDiasAtrasoHist) maxDiasAtrasoHist = dias;
            }
        } 
        else if (p.estado !== 'Pagado' && p.estado !== 'Cancelado') {
            const fVenc = new Date(p.fechaVencimiento);
            if (fVenc < hoy) {
                const dias = Math.floor((hoy - fVenc) / (1000 * 60 * 60 * 24));
                pagaresAtrasados++;
                if (dias > maxDiasAtrasoHist) maxDiasAtrasoHist = dias;
            }
        }
    });

    const porcentajeIncumplimiento = (pagaresAtrasados / totalPagares) * 100;

    if (maxDiasAtrasoHist === 0 && porcentajeIncumplimiento === 0) {
        return { estrellas: '🌟🌟🌟🌟🌟', texto: 'Excelente (Puntual)', color: '#15803d', bg: '#dcfce7' }; 
    } else if (maxDiasAtrasoHist <= 7 && porcentajeIncumplimiento <= 20) {
        return { estrellas: '⭐⭐⭐⭐', texto: 'Bueno (Atrasos leves)', color: '#0369a1', bg: '#e0f2fe' }; 
    } else if (maxDiasAtrasoHist <= 15 && porcentajeIncumplimiento <= 40) {
        return { estrellas: '⭐⭐⭐', texto: 'Regular', color: '#b45309', bg: '#fef3c7' }; 
    } else if (maxDiasAtrasoHist <= 45) {
        return { estrellas: '⭐⭐', texto: 'Riesgoso', color: '#c2410c', bg: '#ffedd5' }; 
    } else {
        return { estrellas: '⭐', texto: 'Moroso Crítico', color: '#b91c1c', bg: '#fee2e2' }; 
    }
};

window.abrirModalPromesaPago = abrirModalPromesaPago;
window.guardarPromesaPago = guardarPromesaPago;

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
window.renderClientes = renderClientes;
window.renderCuentasXCobrar = renderCuentasXCobrar;
window.filtrarCuentasCobranza = filtrarCuentasCobranza;
window.renderCobranzaEsperada = renderCobranzaEsperada;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
window.abrirModalAbonoAvanzado = abrirModalAbonoAvanzado;
window.actualizarAvisoPoliticaAbono = actualizarAvisoPoliticaAbono;
window.procesarAbonoAvanzado = procesarAbonoAvanzado;
window.abrirDetalleCobranza = abrirDetalleCobranza;
window.abrirHistorialAbonos = abrirHistorialAbonos;
window.reimprimirTicketAbono = reimprimirTicketAbono;
window.renderClientesMorosos = renderClientesMorosos;
window.exportarMorososCSV = exportarMorososCSV;