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
            fechaRegistro: window.formatearFechaCortaMX(new Date())
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
    renderResumenVentaCliente();
    cargarClientesSelect();
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
        fechaRegistro: window.formatearFechaCortaMX(new Date())
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

function abrirModalNuevoCliente() {
    const modalHTML = `
        <div data-modal="nuevo-cliente" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
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
    const nuevo = { id: Date.now(), nombre, direccion, telefono, referencia, fechaRegistro: window.formatearFechaCortaMX(new Date()) };
    let clientesBD = StorageService.get("clientes", []);
    clientesBD.push(nuevo);
    if (!StorageService.set("clientes", clientesBD)) return alert("❌ Error guardando cliente");
    
    alert("✅ Cliente agregado exitosamente.");
    document.querySelector('[data-modal="nuevo-cliente"]')?.remove();
    cargarClientesSelect();
}

window.guardarCliente = guardarCliente;
window.renderClientes = renderClientes;
window.eliminarCliente = eliminarCliente;
window.prepararEdicionCliente = prepararEdicionCliente;
window.irASeleccionCliente = irASeleccionCliente;
window.mostrarInfoCliente = mostrarInfoCliente;
window.cargarClientesSelect = cargarClientesSelect;
window.filtrarClientes = filtrarClientes;
window.abrirModalCliente = abrirModalCliente;
window.renderResumenVentaCliente = renderResumenVentaCliente;
window.abrirModalNuevoCliente = abrirModalNuevoCliente;
window.guardarClienteDesdeModal = guardarClienteDesdeModal;