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
                <td><b>${c.nombre}</b></td>
                <td>${c.direccion || '-'}</td>
                <td>${c.telefono || '-'}</td>
                <td><small>${c.referencia || '-'}</small></td>
                <td style="text-align:center;">
                    <button onclick="prepararEdicionCliente(${c.id})" style="background:none; border:none; cursor:pointer; font-size:16px; margin-right:10px;">✏️</button>
                    <button onclick="eliminarCliente(${c.id})" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
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
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
    let saldo = totalContado - enganche;

    let detalleProductos = carrito.map(p => {
        const cantidad = p.cantidad || 1;
        const subtotal = (p.precioContado || 0) * cantidad;
        return `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding:8px; background:#f8f9fa; border-radius:5px;">
                <span>${p.nombre} ×${cantidad}</span>
                <strong style="color:#27ae60;">${dinero(subtotal)}</strong>
            </div>
        `;
    }).join("");

    cont.innerHTML = `
        <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h3 style="margin:0 0 15px 0; color:#2c3e50;">🧾 Resumen de Compra</h3>

            <div style="background:#f0f4f8; padding:15px; border-radius:8px; margin-bottom:15px;">
                ${detalleProductos}
            </div>

            <div style="background:#f8f9fa; padding:15px; border-radius:8px; border-left:4px solid #3498db;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;">
                    <span>Subtotal:</span>
                    <strong>${dinero(totalContado)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;">
                    <span>Enganche:</span>
                    <strong style="color:#f59e0b;">-${dinero(enganche)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:16px;">
                    <span style="font-weight:bold;">Saldo:</span>
                    <strong style="color:#27ae60; font-size:18px;">${dinero(saldo)}</strong>
                </div>
            </div>
        </div>
    `;
}

function abrirModalNuevoCliente() {
    const modalHTML = `
        <div style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
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
                    <button onclick="this.closest('div').parentElement.remove();" 
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
    document.querySelector('div[style*="position:fixed"]').remove();
    cargarClientesSelect();
}

function togglePanelClientes() {
    const panel = document.getElementById("panelClientes");
    if (!panel) return;
    const isVisible = panel.style.display === 'flex' || panel.classList.contains('active');
    if (isVisible) {
        panel.style.display = 'none';
        panel.classList.remove('active');
    } else {
        panel.style.display = 'flex';
        panel.classList.add('active');
    }
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
window.togglePanelClientes = togglePanelClientes;
