// ===== MÓDULO DE CLIENTES (Exclusivo para CRUD y Selección) =====

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

function _clienteSesionActiva() {
    try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; }
}

function _clienteEsAdmin() {
    if (typeof window.esAdmin === 'function') return window.esAdmin();
    const s = _clienteSesionActiva();
    return !!(s && s.rol === 'admin');
}

function _clienteRequireAdmin(accion) {
    if (_clienteEsAdmin()) return true;
    window.AuditService?.log?.({
        accion: 'ACCESO_DENEGADO',
        modulo: 'Clientes',
        entidad: accion,
        detalle: `Intento sin permisos: ${accion}`,
        severidad: 'alerta'
    });
    alert('Operacion restringida. Solo administrador puede continuar.');
    return false;
}

function _clienteNormalizarBusqueda(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

function _clienteTextoBusqueda(c = {}) {
    return _clienteNormalizarBusqueda([
        c.nombre,
        c.telefono,
        c.direccion,
        c.referencia,
        c.referenciaBusqueda,
        c.busquedaCliente
    ].filter(Boolean).join(' '));
}

function _clienteConBusqueda(c = {}) {
    const copia = { ...c };
    copia.referenciaBusqueda = _clienteTextoBusqueda(copia);
    copia.busquedaCliente = copia.referenciaBusqueda;
    return copia;
}

function _clienteCamposBase(c = {}) {
    return {
        nombre: String(c.nombre || '').trim(),
        direccion: String(c.direccion || '').trim(),
        telefono: String(c.telefono || '').trim(),
        referencia: String(c.referencia || '').trim()
    };
}

function _clienteCambios(antes, despues) {
    return Object.keys(despues).filter(k => String(antes[k] || '') !== String(despues[k] || ''));
}

function _clienteFechaIso() {
    return window.localISO ? window.localISO(new Date()) : new Date().toISOString();
}

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
            if (!_clienteEsAdmin()) {
                const antes = _clienteCamposBase(clientesBD[index]);
                const despues = _clienteCamposBase({ nombre, direccion, telefono, referencia });
                const cambios = _clienteCambios(antes, despues);
                if (cambios.length === 0) return alert('No hay cambios para enviar a auditoria.');
                const pendientes = StorageService.get('solicitudesClientesPendientes', []);
                if (pendientes.some(s => String(s.clienteId) === String(clientesBD[index].id))) {
                    return alert('Este cliente ya tiene una solicitud pendiente en la boveda.');
                }
                const sesion = _clienteSesionActiva() || {};
                pendientes.unshift({
                    id: Date.now() + Math.random(),
                    tipo: 'actualizacion_cliente',
                    estado: 'Pendiente',
                    clienteId: clientesBD[index].id,
                    clienteNombre: clientesBD[index].nombre,
                    antes,
                    despues,
                    cambios,
                    motivo: 'Edicion solicitada desde Gestionar Clientes',
                    fechaSolicitud: _clienteFechaIso(),
                    fechaVisible: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
                    solicitadoPor: sesion.nombre || sesion.usuario || 'Usuario',
                    solicitadoPorId: sesion.uid || sesion.id || sesion.usuario || null,
                    rolSolicitante: sesion.rol || ''
                });
                StorageService.set('solicitudesClientesPendientes', pendientes);
                window.AuditService?.log?.({
                    accion: 'CLIENTE_CAMBIO_SOLICITADO',
                    modulo: 'Clientes',
                    entidad: clientesBD[index].nombre,
                    entidadId: clientesBD[index].id,
                    detalle: `Cambio solicitado: ${cambios.join(', ')}`,
                    severidad: 'riesgo',
                    datos: { antes, despues }
                });
                window.clienteEditandoId = null;
                nombreInput.value = "";
                direccionInput.value = "";
                telefonoInput.value = "";
                referenciaInput.value = "";
                renderClientes();
                return alert('Solicitud enviada a la Boveda de Autorizaciones.');
            }
            clientesBD[index].nombre     = nombre;
            clientesBD[index].direccion  = direccion;
            clientesBD[index].telefono   = telefono;
            clientesBD[index].referencia = referencia;
            clientesBD[index].fechaActualizacion = _clienteFechaIso();
            clientesBD[index] = _clienteConBusqueda(clientesBD[index]);
            // Propagar cambios a todas las tablas que copian datos del cliente
            _clientesSincronizarDatosRelacionados(clientesBD[index]);
        }
        window.clienteEditandoId = null;
    } else {
        clientesBD.push(_clienteConBusqueda({
            id: Date.now(),
            nombre,
            direccion,
            telefono,
            referencia,
            fechaRegistro: window.formatearFechaCortaMX(new Date())
        }));
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

    const listaClientes = StorageService.get("clientes", []);
    window.clientes = listaClientes;

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
    if (!_clienteRequireAdmin('Eliminar cliente')) return;
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

function irASeleccionCliente() {
    if(typeof navA === 'function') navA("seleccionarcliente");
    renderSeleccionClienteVenta();
    renderResumenVentaCliente();
    mostrarInfoCliente();
}

function mostrarInfoCliente() {
    const div = document.getElementById("infoCliente");
    if (!window.clienteSeleccionado || !div) return;

    // Obtener la calificación del Buró (La función vive en cxc.js ahora)
    let score = { estrellas: '🌟', texto: 'Calculando...', color: '#64748b', bg: '#f1f5f9' };
    if (typeof window.calcularCalificacionCliente === 'function') {
        score = window.calcularCalificacionCliente(window.clienteSeleccionado.id);
    }

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

function renderSeleccionClienteVenta() {
    const vista = document.getElementById("seleccionarcliente");
    if (!vista) return;
    const c = window.clienteSeleccionado || null;
    vista.innerHTML = `
        <div style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(330px,.7fr);gap:20px;align-items:start;">
            <div id="resumenVentaCliente"></div>
            <div style="background:white;padding:22px;border-radius:10px;border:1px solid #e2e8f0;box-shadow:0 2px 8px rgba(15,23,42,.06);">
                <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:14px;">
                    <div>
                        <h3 style="margin:0;color:#0f172a;">Cliente de la venta</h3>
                        <p style="margin:4px 0 0;color:#64748b;font-size:13px;">Selecciona uno existente o da de alta uno nuevo con datos completos.</p>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
                    <button onclick="abrirPickerClienteVenta()" style="padding:12px;background:#2563eb;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Buscar cliente</button>
                    <button onclick="abrirModalNuevoCliente({seleccionar:true})" style="padding:12px;background:#0f766e;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Nuevo cliente</button>
                </div>
                <input type="text" id="buscarCliente" placeholder="Buscar cliente..." oninput="filtrarClientes()" style="display:none;">
                <div id="listaClientesCards" style="display:none;"></div>
                <div id="infoCliente" style="margin-top:12px;"></div>
                ${c ? `
                    <div style="margin-top:12px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;font-size:12px;color:#64748b;">
                        Puedes cambiar el cliente con el picker sin perder el carrito ni las condiciones ya calculadas.
                    </div>
                ` : `
                    <div style="margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;font-size:12px;color:#9a3412;font-weight:bold;">
                        Selecciona o registra un cliente para continuar.
                    </div>
                `}
                <button onclick="confirmarVentaFinal()"
                    style="margin-top:15px;width:100%;background:${c ? '#27ae60' : '#94a3b8'};color:white;padding:13px;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">
                    Confirmar venta
                </button>
            </div>
        </div>`;
}

function abrirPickerClienteVenta() {
    if (typeof window.abrirSelectorCliente !== 'function') {
        alert('El selector de clientes aun no esta disponible.');
        return;
    }
    window.abrirSelectorCliente({
        titulo: 'Seleccionar cliente para venta',
        onSeleccion: (cliente) => {
            window.clienteSeleccionado = cliente;
            renderSeleccionClienteVenta();
            renderResumenVentaCliente();
            mostrarInfoCliente();
        }
    });
}

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
    const q = _clienteNormalizarBusqueda(texto);
    const filtrados = window.clientes.filter(c => _clienteTextoBusqueda(c).includes(q));
    cargarClientesSelect(filtrados);
}

function abrirModalCliente() {
    abrirModalNuevoCliente({ seleccionar: true });
    return;
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
        fechaRegistro: window.formatearFechaCortaMX(new Date())
    };

    window.clientes.push(nuevo);
    if (!StorageService.set("clientes", window.clientes)) {
        console.error("❌ Error guardando cliente");
        return;
    }

    const seleccionarVenta = document.getElementById("nuevoCliSeleccionarVenta")?.value === '1';
    const autoSeleccionar = document.getElementById("nuevoCliAutoSeleccionar")?.checked !== false;
    if (seleccionarVenta && autoSeleccionar) {
        window.clienteSeleccionado = nuevo;
        renderSeleccionClienteVenta();
        renderResumenVentaCliente();
        mostrarInfoCliente();
    } else {
        cargarClientesSelect();
    }
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

    const etiquetasMetodo = { contado: "💵 Contado", transferencia: "🏦 Transferencia / Depósito", credito: "💳 Crédito", apartado: "📦 Apartado" };
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

function abrirModalNuevoCliente(opciones = {}) {
    const seleccionar = opciones === true || opciones.seleccionar === true || document.getElementById('seleccionarcliente')?.style.display === 'block';
    const modalHTML = `
        <div data-modal="nuevo-cliente" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
                <input type="hidden" id="nuevoCliSeleccionarVenta" value="${seleccionar ? '1' : '0'}">
                <h2 style="margin-top:0;">➕ Nuevo Cliente</h2>
                <div class="campo" style="margin-bottom:15px;">
                    <label>Nombre Completo *</label>
                    <input type="text" id="nuevoCliNombre" placeholder="Juan Pérez" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>
                <div class="campo" style="margin-bottom:15px;">
                    <label>Dirección</label>
                    <input type="text" id="nuevoCliDireccion" placeholder="Calle Principal 123, Apt 4" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>
                <div class="campo" style="margin-bottom:15px;">
                    <label>Teléfono</label>
                    <input type="tel" id="nuevoCliTelefono" placeholder="555-1234567" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>
                <div class="campo" style="margin-bottom:20px;">
                    <label>Referencia</label>
                    <textarea id="nuevoCliReferencia" placeholder="Ej: Cerca del parque, casa azul" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; height:60px;"></textarea>
                </div>
                ${seleccionar ? `<label style="display:flex;gap:8px;align-items:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;margin-bottom:14px;font-size:13px;color:#1e40af;font-weight:bold;">
                    <input type="checkbox" id="nuevoCliAutoSeleccionar" checked>
                    Usar este cliente en la venta actual
                </label>` : ''}
                <div style="display:flex; gap:10px;">
                    <button onclick="guardarClienteDesdeModal()" style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">✅ Guardar Cliente</button>
                    <button onclick="document.querySelector('[data-modal=&quot;nuevo-cliente&quot;]')?.remove();" style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">✕ Cancelar</button>
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
    const nuevo = _clienteConBusqueda({ id: Date.now(), nombre, direccion, telefono, referencia, fechaRegistro: window.formatearFechaCortaMX(new Date()) });
    let clientesBD = StorageService.get("clientes", []);
    clientesBD.push(nuevo);
    window.clientes = clientesBD;
    if (!StorageService.set("clientes", clientesBD)) return alert("❌ Error guardando cliente");
    
    alert("✅ Cliente agregado exitosamente.");
    const seleccionarVentaModal = document.getElementById("nuevoCliSeleccionarVenta")?.value === '1';
    const autoSeleccionarModal = document.getElementById("nuevoCliAutoSeleccionar")?.checked !== false;
    document.querySelector('[data-modal="nuevo-cliente"]')?.remove();
    if (seleccionarVentaModal && autoSeleccionarModal) {
        window.clienteSeleccionado = nuevo;
        renderSeleccionClienteVenta();
        renderResumenVentaCliente();
        mostrarInfoCliente();
    } else {
        cargarClientesSelect();
    }
}

function seleccionarClienteParaGestion() {
    if (typeof window.abrirSelectorCliente !== 'function') {
        alert('El selector de clientes aun no esta disponible.');
        return;
    }
    window.abrirSelectorCliente({
        titulo: 'Seleccionar cliente para actualizar datos',
        onSeleccion: (cliente) => {
            window._clienteGestionSeleccionado = cliente;
            renderGestionDatosCliente();
        }
    });
}

function renderGestionDatosCliente() {
    const cont = document.getElementById('contenidoGestionDatosCliente');
    if (!cont) return;
    const cliente = window._clienteGestionSeleccionado || null;
    const pendientes = StorageService.get('solicitudesClientesPendientes', []);
    const pendientesHtml = pendientes.slice(0, 5).map(s => `
        <div style="border-bottom:1px solid #e2e8f0;padding:8px 0;font-size:13px;">
            <strong>${_escapeHtml(s.clienteNombre || s.antes?.nombre || 'Cliente')}</strong><br>
            <small style="color:#64748b;">${_escapeHtml(s.fechaVisible || s.fechaSolicitud || '-')} · ${_escapeHtml((s.cambios || []).join(', ') || 'Sin detalle')}</small>
        </div>
    `).join('');

    const actual = cliente ? _clienteCamposBase(cliente) : { nombre: '', direccion: '', telefono: '', referencia: '' };
    cont.innerHTML = `
    <div style="padding:24px;max-width:1180px;margin:0 auto;">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:18px;">
            <div>
                <h2 style="margin:0;color:#0f172a;">Gestion de datos del cliente</h2>
                <p style="margin:5px 0 0;color:#64748b;">El vendedor puede proponer cambios. Auditoria los autoriza antes de modificar la base oficial.</p>
            </div>
            <button onclick="seleccionarClienteParaGestion()" style="padding:11px 16px;background:#2563eb;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Seleccionar cliente</button>
        </div>

        <div style="display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:16px;align-items:start;">
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
                ${cliente ? `
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:14px;">
                        <strong style="color:#0f172a;">Cliente seleccionado: ${_escapeHtml(cliente.nombre || '-')}</strong><br>
                        <small style="color:#64748b;">Tel: ${_escapeHtml(cliente.telefono || '-')} · Dir: ${_escapeHtml(cliente.direccion || '-')}</small><br>
                        <small style="color:#64748b;">Referencia actual: ${_escapeHtml(cliente.referencia || '-')}</small>
                    </div>
                    <input type="hidden" id="gestClienteId" value="${_escapeHtml(cliente.id)}">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                        <div><label style="font-size:12px;font-weight:900;color:#475569;">NOMBRE</label><input id="gestClienteNombre" value="${_escapeHtml(actual.nombre)}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"></div>
                        <div><label style="font-size:12px;font-weight:900;color:#475569;">TELEFONO</label><input id="gestClienteTelefono" value="${_escapeHtml(actual.telefono)}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"></div>
                    </div>
                    <div style="margin-bottom:12px;"><label style="font-size:12px;font-weight:900;color:#475569;">DIRECCION</label><input id="gestClienteDireccion" value="${_escapeHtml(actual.direccion)}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"></div>
                    <div style="margin-bottom:12px;">
                        <label style="font-size:12px;font-weight:900;color:#475569;">REFERENCIA BUSCABLE</label>
                        <textarea id="gestClienteReferencia" style="width:100%;min-height:82px;padding:10px;border:1px solid #cbd5e1;border-radius:6px;resize:vertical;">${_escapeHtml(actual.referencia)}</textarea>
                        <small style="color:#64748b;">Usala como alias y ayuda de busqueda: colonia, punto cercano, nombre alterno, negocio, familiar autorizado o nota corta para reconocerlo rapido.</small>
                    </div>
                    <div style="margin-bottom:14px;"><label style="font-size:12px;font-weight:900;color:#475569;">MOTIVO DEL CAMBIO</label><input id="gestClienteMotivo" placeholder="Ej. actualizo telefono, nueva direccion, referencia incompleta..." style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;"></div>
                    <button onclick="enviarSolicitudCambioCliente()" style="width:100%;padding:13px;background:#d97706;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Enviar a Boveda de Auditoria</button>
                ` : `
                    <div style="text-align:center;padding:42px 20px;color:#64748b;">
                        <h3 style="margin-top:0;color:#0f172a;">Selecciona un cliente</h3>
                        <p>Usaremos el selector universal para encontrarlo por nombre, telefono, direccion o referencia.</p>
                        <button onclick="seleccionarClienteParaGestion()" style="padding:11px 16px;background:#2563eb;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Abrir selector</button>
                    </div>
                `}
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:18px;box-shadow:0 2px 8px rgba(15,23,42,0.06);">
                <h3 style="margin:0 0 10px;color:#0f172a;">Pendientes en boveda</h3>
                <div style="font-size:32px;font-weight:900;color:#d97706;line-height:1;">${pendientes.length}</div>
                <p style="color:#64748b;margin:6px 0 12px;font-size:13px;">Cambios esperando autorizacion.</p>
                ${pendientesHtml || '<p style="color:#94a3b8;font-size:13px;">Sin solicitudes pendientes.</p>'}
            </div>
        </div>
    </div>`;
}

function enviarSolicitudCambioCliente() {
    const clienteId = document.getElementById('gestClienteId')?.value;
    const clientesBD = StorageService.get('clientes', []);
    const cliente = clientesBD.find(c => String(c.id) === String(clienteId));
    if (!cliente) return alert('Cliente no encontrado.');

    const despues = _clienteCamposBase({
        nombre: document.getElementById('gestClienteNombre')?.value,
        direccion: document.getElementById('gestClienteDireccion')?.value,
        telefono: document.getElementById('gestClienteTelefono')?.value,
        referencia: document.getElementById('gestClienteReferencia')?.value
    });
    const validacion = ValidatorService.validarCliente({ nombre: despues.nombre, telefono: despues.telefono });
    if (!validacion.valid) return alert('⚠️ ' + validacion.errores.join('\n'));

    const antes = _clienteCamposBase(cliente);
    const cambios = _clienteCambios(antes, despues);
    if (cambios.length === 0) return alert('No hay cambios para enviar a auditoria.');

    const pendientes = StorageService.get('solicitudesClientesPendientes', []);
    const existePendiente = pendientes.some(s => String(s.clienteId) === String(cliente.id) && s.estado !== 'Rechazado');
    if (existePendiente) return alert('Este cliente ya tiene una solicitud pendiente en la boveda. Auditoria debe resolverla antes de crear otra.');

    const sesion = _clienteSesionActiva() || {};
    const solicitud = {
        id: Date.now() + Math.random(),
        tipo: 'actualizacion_cliente',
        estado: 'Pendiente',
        clienteId: cliente.id,
        clienteNombre: cliente.nombre,
        antes,
        despues,
        cambios,
        motivo: document.getElementById('gestClienteMotivo')?.value.trim() || 'Actualizacion de datos del cliente',
        fechaSolicitud: _clienteFechaIso(),
        fechaVisible: window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date()) : new Date().toLocaleDateString('es-MX'),
        solicitadoPor: sesion.nombre || sesion.usuario || 'Usuario',
        solicitadoPorId: sesion.uid || sesion.id || sesion.usuario || null,
        rolSolicitante: sesion.rol || ''
    };

    pendientes.unshift(solicitud);
    StorageService.set('solicitudesClientesPendientes', pendientes);
    window.AuditService?.log?.({
        accion: 'CLIENTE_CAMBIO_SOLICITADO',
        modulo: 'Clientes',
        entidad: cliente.nombre,
        entidadId: cliente.id,
        detalle: `Cambio solicitado: ${cambios.join(', ')}`,
        severidad: 'riesgo',
        datos: { antes, despues, motivo: solicitud.motivo }
    });
    alert('Solicitud enviada a la Boveda de Autorizaciones.');
    window._clienteGestionSeleccionado = null;
    renderGestionDatosCliente();
}

function _clientesSincronizarDatosRelacionados(cliente) {
    const campos = _clienteCamposBase(cliente);
    const idStr = String(cliente.id);

    // ── Tablas con objeto plano (clienteId al nivel raíz) ──────────────────
    const maps = [
        // cuentasPorCobrar guarda el nombre en el campo "nombre" (no "clienteNombre")
        { key: 'cuentasPorCobrar', campoNombre: 'nombre' },
        // pagaresSistema (era 'pagares' — nombre incorrecto, bug corregido)
        { key: 'pagaresSistema', campoNombre: 'clienteNombre' },
        { key: 'apartados',             campoNombre: 'clienteNombre' },
        { key: 'salidasPendientesVenta', campoNombre: 'clienteNombre' },
        // ventasRegistradas tiene clienteNombre plano y también objeto cliente anidado
        { key: 'ventasRegistradas',     campoNombre: 'clienteNombre' },
        // cotizaciones solo guarda el nombre (no hay teléfono ni dirección)
        { key: 'cotizaciones',          campoNombre: 'clienteNombre', soloNombre: true },
    ];

    maps.forEach(({ key, campoNombre, soloNombre }) => {
        const lista = StorageService.get(key, []);
        if (!Array.isArray(lista)) return;
        let cambio = false;
        lista.forEach(item => {
            if (String(item.clienteId || item.idCliente || '') !== idStr) return;
            item[campoNombre] = campos.nombre;
            if (!soloNombre) {
                item.clienteDireccion = campos.direccion;
                item.clienteTelefono  = campos.telefono;
                item.referencia       = campos.referencia;
                // Si el registro guarda también campos sin prefijo (cuentasPorCobrar)
                if (item.direccion !== undefined) item.direccion = campos.direccion;
                if (item.telefono  !== undefined) item.telefono  = campos.telefono;
            }
            // ventasRegistradas: actualizar también el objeto cliente anidado
            if (item.cliente && typeof item.cliente === 'object') {
                item.cliente.nombre    = campos.nombre;
                item.cliente.direccion = campos.direccion;
                item.cliente.telefono  = campos.telefono;
                item.cliente.referencia = campos.referencia;
            }
            cambio = true;
        });
        if (cambio) StorageService.set(key, lista);
    });

    // ── documentosEntrega: el cliente vive en doc.cliente (objeto anidado) ──
    (() => {
        const docs = StorageService.get('documentosEntrega', []);
        if (!Array.isArray(docs)) return;
        let cambio = false;
        docs.forEach(doc => {
            if (!doc.cliente || String(doc.cliente.id || '') !== idStr) return;
            doc.cliente.nombre    = campos.nombre;
            doc.cliente.telefono  = campos.telefono;
            doc.cliente.direccion = campos.direccion;
            cambio = true;
        });
        if (cambio) StorageService.set('documentosEntrega', docs);
    })();

    // ── ventasPendientes (bóveda de cuarentena): cliente en datosVenta.cliente
    (() => {
        const pendientes = StorageService.get('ventasPendientes', []);
        if (!Array.isArray(pendientes)) return;
        let cambio = false;
        pendientes.forEach(vp => {
            // Nombre plano en el nivel raíz
            if (vp.datosVenta?.cliente && String(vp.datosVenta.cliente.id || '') === idStr) {
                vp.datosVenta.cliente.nombre    = campos.nombre;
                vp.datosVenta.cliente.telefono  = campos.telefono;
                vp.datosVenta.cliente.direccion = campos.direccion;
                vp.datosVenta.cliente.referencia = campos.referencia;
                vp.clienteNombre = campos.nombre;
                cambio = true;
            }
        });
        if (cambio) StorageService.set('ventasPendientes', pendientes);
    })();
}

function renderSolicitudesClienteAutorizacion() {
    const solicitudes = StorageService.get('solicitudesClientesPendientes', []);
    const filas = solicitudes.map((s, i) => `
        <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px;">${_escapeHtml(s.fechaVisible || s.fechaSolicitud || '-')}</td>
            <td style="padding:8px;"><strong>${_escapeHtml(s.clienteNombre || s.antes?.nombre || 'Cliente')}</strong><br><small style="color:#64748b;">${_escapeHtml(s.solicitadoPor || '-')}</small></td>
            <td style="padding:8px;">${_escapeHtml((s.cambios || []).join(', ') || '-')}</td>
            <td style="padding:8px;"><button onclick="revisarSolicitudCliente(${i})" style="background:#7c3aed;color:white;border:0;padding:6px 12px;border-radius:4px;font-weight:bold;cursor:pointer;">Revisar</button></td>
        </tr>
    `).join('');
    return `
    <div style="background:white;padding:15px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="color:#7c3aed;margin-top:0;">Cambios de Cliente (${solicitudes.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr style="background:#ede9fe;text-align:left;">
                <th style="padding:8px;border-bottom:2px solid #ddd6fe;">Fecha</th>
                <th style="padding:8px;border-bottom:2px solid #ddd6fe;">Cliente</th>
                <th style="padding:8px;border-bottom:2px solid #ddd6fe;">Cambios</th>
                <th style="padding:8px;border-bottom:2px solid #ddd6fe;">Accion</th>
            </tr>
            ${filas || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af;">No hay cambios de clientes pendientes.</td></tr>'}
        </table>
    </div>`;
}

function revisarSolicitudCliente(index) {
    const solicitudes = StorageService.get('solicitudesClientesPendientes', []);
    const s = solicitudes[index];
    if (!s) return alert('Solicitud no encontrada.');
    const campos = ['nombre', 'telefono', 'direccion', 'referencia'];
    const filas = campos.map(k => {
        const cambio = String(s.antes?.[k] || '') !== String(s.despues?.[k] || '');
        return `<tr style="border-bottom:1px solid #e2e8f0;background:${cambio ? '#fff7ed' : 'white'};">
            <td style="padding:8px;font-weight:bold;">${k}</td>
            <td style="padding:8px;color:#64748b;">${_escapeHtml(s.antes?.[k] || '-')}</td>
            <td style="padding:8px;color:#0f172a;font-weight:${cambio ? 'bold' : 'normal'};">${_escapeHtml(s.despues?.[k] || '-')}</td>
        </tr>`;
    }).join('');
    document.querySelector('[data-modal="solicitud-cliente"]')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
    <div data-modal="solicitud-cliente" style="position:fixed;inset:0;background:rgba(15,23,42,.82);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;">
        <div style="background:white;border-radius:10px;max-width:760px;width:100%;max-height:90vh;overflow:auto;padding:22px;box-shadow:0 20px 40px rgba(0,0,0,.28);">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:12px;">
                <div><h3 style="margin:0;color:#7c3aed;">Auditoria de datos de cliente</h3><p style="margin:4px 0 0;color:#64748b;">Solicitado por ${_escapeHtml(s.solicitadoPor || '-')} · ${_escapeHtml(s.fechaVisible || '-')}</p></div>
                <button onclick="document.querySelector('[data-modal=solicitud-cliente]')?.remove()" style="background:#f1f5f9;border:0;padding:8px 12px;border-radius:6px;cursor:pointer;">Cerrar</button>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:12px;"><strong>Motivo:</strong> ${_escapeHtml(s.motivo || '-')}</div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
                <thead style="background:#f8fafc;"><tr><th style="padding:8px;text-align:left;">Campo</th><th style="padding:8px;text-align:left;">Antes</th><th style="padding:8px;text-align:left;">Propuesto</th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
                <button onclick="aprobarSolicitudCliente(${index})" style="flex:1;min-width:180px;padding:12px;background:#16a34a;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Autorizar cambio</button>
                <button onclick="rechazarSolicitudCliente(${index})" style="flex:1;min-width:180px;padding:12px;background:#dc2626;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Rechazar</button>
            </div>
        </div>
    </div>`);
}

function aprobarSolicitudCliente(index) {
    if (!_clienteRequireAdmin('Autorizar cambio de cliente')) return;
    const solicitudes = StorageService.get('solicitudesClientesPendientes', []);
    const s = solicitudes[index];
    if (!s) return alert('Solicitud no encontrada.');
    const clientesBD = StorageService.get('clientes', []);
    const idx = clientesBD.findIndex(c => String(c.id) === String(s.clienteId));
    if (idx === -1) return alert('Cliente no encontrado.');
    const aprobado = _clienteConBusqueda({ ...clientesBD[idx], ...s.despues, fechaActualizacion: _clienteFechaIso() });
    clientesBD[idx] = aprobado;
    StorageService.set('clientes', clientesBD);
    window.clientes = clientesBD;
    _clientesSincronizarDatosRelacionados(aprobado);

    const sesion = _clienteSesionActiva() || {};
    const historial = StorageService.get('historialSolicitudesClientes', []);
    historial.unshift({ ...s, estado: 'Aprobado', fechaResolucion: _clienteFechaIso(), autorizadoPor: sesion.nombre || sesion.usuario || 'Admin' });
    solicitudes.splice(index, 1);
    StorageService.set('solicitudesClientesPendientes', solicitudes);
    StorageService.set('historialSolicitudesClientes', historial);
    window.AuditService?.log?.({
        accion: 'CLIENTE_CAMBIO_AUTORIZADO',
        modulo: 'Clientes',
        entidad: aprobado.nombre,
        entidadId: aprobado.id,
        detalle: `Cambio autorizado: ${(s.cambios || []).join(', ')}`,
        severidad: 'riesgo',
        datos: { antes: s.antes, despues: s.despues, motivo: s.motivo }
    });
    document.querySelector('[data-modal="solicitud-cliente"]')?.remove();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    alert('Cambio de cliente autorizado.');
}

function rechazarSolicitudCliente(index) {
    if (!_clienteRequireAdmin('Rechazar cambio de cliente')) return;
    const solicitudes = StorageService.get('solicitudesClientesPendientes', []);
    const s = solicitudes[index];
    if (!s) return alert('Solicitud no encontrada.');
    const motivo = prompt('Motivo del rechazo:') || 'Rechazado por auditoria';
    const sesion = _clienteSesionActiva() || {};
    const historial = StorageService.get('historialSolicitudesClientes', []);
    historial.unshift({ ...s, estado: 'Rechazado', fechaResolucion: _clienteFechaIso(), rechazadoPor: sesion.nombre || sesion.usuario || 'Admin', motivoRechazo: motivo });
    solicitudes.splice(index, 1);
    StorageService.set('solicitudesClientesPendientes', solicitudes);
    StorageService.set('historialSolicitudesClientes', historial);
    window.AuditService?.log?.({
        accion: 'CLIENTE_CAMBIO_RECHAZADO',
        modulo: 'Clientes',
        entidad: s.clienteNombre,
        entidadId: s.clienteId,
        detalle: motivo,
        severidad: 'info',
        datos: { cambios: s.cambios, motivoSolicitud: s.motivo }
    });
    document.querySelector('[data-modal="solicitud-cliente"]')?.remove();
    if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    alert('Solicitud rechazada.');
}

window.guardarCliente = guardarCliente;
window.renderClientes = renderClientes;
window.eliminarCliente = eliminarCliente;
window.prepararEdicionCliente = prepararEdicionCliente;
window.irASeleccionCliente = irASeleccionCliente;
window.mostrarInfoCliente = mostrarInfoCliente;
window.renderSeleccionClienteVenta = renderSeleccionClienteVenta;
window.abrirPickerClienteVenta = abrirPickerClienteVenta;
window.cargarClientesSelect = cargarClientesSelect;
window.filtrarClientes = filtrarClientes;
window.abrirModalCliente = abrirModalCliente;
window.renderResumenVentaCliente = renderResumenVentaCliente;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
window.guardarClienteDesdeModal = guardarClienteDesdeModal;
window.seleccionarClienteParaGestion = seleccionarClienteParaGestion;
window.renderGestionDatosCliente = renderGestionDatosCliente;
window.enviarSolicitudCambioCliente = enviarSolicitudCambioCliente;
window.renderSolicitudesClienteAutorizacion = renderSolicitudesClienteAutorizacion;
window.revisarSolicitudCliente = revisarSolicitudCliente;
window.aprobarSolicitudCliente = aprobarSolicitudCliente;
window.rechazarSolicitudCliente = rechazarSolicitudCliente;
