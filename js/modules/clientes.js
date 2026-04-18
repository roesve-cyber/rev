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

function renderCuentasXCobrar() {
    const contenedor = document.getElementById("tablaCuentasXCobrar");
    if (!contenedor) return;

    const cuentas = StorageService.get("cuentasPorCobrar", []);

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
            <th>Estatus</th>
            <th>Acciones</th>
        </tr></thead>
        <tbody>`;

    cuentas.forEach(cuenta => {
        if (cuenta.estado === "Saldado") return;

        const saldo = Number(cuenta.saldoActual ?? 0);
        const enganche = Number(cuenta.engancheRecibido ?? 0);
        const color = saldo > 0 ? "#27ae60" : "#999";
        const fechaVenta = new Date(cuenta.fechaVenta).toLocaleDateString();

        html += `<tr>
            <td><strong>${cuenta.nombre}</strong><br><small style="color:#718096;">${cuenta.folio}</small></td>
            <td>${fechaVenta}</td>
            <td>${dinero(cuenta.totalContadoOriginal ?? 0)}${enganche > 0 ? `<br><small style="color:#27ae60;">✅ Enganche: ${dinero(enganche)}</small>` : ''}</td>
            <td style="font-weight:bold; color:${color};">${dinero(saldo)}</td>
            <td>${cuenta.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</td>
            <td>
                <button onclick="abrirModalAbonoAvanzado('${cuenta.folio}')" style="padding:6px 12px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer;">💰 Abonar</button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

function renderCobranzaEsperada() {
    const contenedor = document.getElementById("escaleraCobranza");
    if (!contenedor) return;

    const pagares = StorageService.get("pagaresSistema", []);
    const hoy = new Date();

    let posMeses = {};
    for (let i = 0; i < 12; i++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const clave = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
        posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [] };
    }

    pagares.forEach(p => {
        const fechaPago = new Date(p.fechaVencimiento);
        const clave = fechaPago.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
        if (posMeses[clave]) {
            posMeses[clave].esperado += p.monto;
            posMeses[clave].total += p.monto;
            if (p.estado === "Pagado") posMeses[clave].recaudado += p.monto;
            if (new Date(p.fechaVencimiento) < hoy && p.estado !== "Pagado") posMeses[clave].vencidos += p.monto;
            posMeses[clave].pagaresDetalle.push(p);
        }
    });

    let html = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">`;

    Object.entries(posMeses).forEach(([mes, datos]) => {
        if (datos.total === 0) return;
        const porcentajeRecaudo = datos.esperado > 0 ? (datos.recaudado / datos.esperado * 100).toFixed(1) : 0;
        const colorMes = datos.vencidos > 0 ? "#fee2e2" : "#f0fdf4";
        const iconoMes = datos.vencidos > 0 ? "🔴" : "✅";

        html += `<div style="background:${colorMes}; padding:20px; border-radius:10px; border-left:5px solid ${datos.vencidos > 0 ? '#dc2626' : '#27ae60'};">
            <h4 style="margin:0 0 15px 0; color:#2c3e50;">${iconoMes} ${mes}</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><small style="color:#718096;">Esperado</small><br><strong style="font-size:18px; color:#2c3e50;">${dinero(datos.esperado)}</strong></div>
                <div><small style="color:#718096;">Recaudado</small><br><strong style="font-size:18px; color:#27ae60;">${dinero(datos.recaudado)}</strong></div>
            </div>
            <div style="background:white; border-radius:8px; overflow:hidden; height:8px; margin-bottom:10px;">
                <div style="background:#27ae60; height:100%; width:${porcentajeRecaudo}%;"></div>
            </div>
            <small style="color:#718096;">${porcentajeRecaudo}% recaudado</small>
            ${datos.vencidos > 0 ? `<p style="color:#dc2626; font-weight:bold; margin:10px 0 0 0;">⚠️ ${dinero(datos.vencidos)} VENCIDO</p>` : ''}
        </div>`;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
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

function abrirModalAbonoAvanzado(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return alert("Cuenta no encontrada.");

    const pagaresCliente = pagares.filter(p => p.folio === folio && p.estado !== "Pagado");
    const original = cuenta.totalContadoOriginal ?? 0;
    const saldo = cuenta.saldoActual ?? 0;
    const fechaVenta = new Date(cuenta.fechaVenta);
    const hoy = new Date();
    const diasDesdeVenta = Math.floor((hoy - fechaVenta) / (1000 * 60 * 60 * 24));
    const aplicaPoliticaContado = diasDesdeVenta < 30;

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

    const pagaresHTML = pagaresCliente.length > 0 ? `
        <div style="margin-bottom:20px;">
            <strong style="color:#374151;">📋 Pagarés Pendientes:</strong>
            <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:14px;">
                <thead><tr style="background:#fef3c7;">
                    <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e7eb;">#</th>
                    <th style="padding:6px 8px; text-align:left; border-bottom:1px solid #e5e7eb;">Vencimiento</th>
                    <th style="padding:6px 8px; text-align:right; border-bottom:1px solid #e5e7eb;">Monto</th>
                    <th style="padding:6px 8px; text-align:center; border-bottom:1px solid #e5e7eb;">Estado</th>
                </tr></thead>
                <tbody>
                    ${pagaresCliente.map((p, i) => `<tr>
                        <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${i + 1}</td>
                        <td style="padding:6px 8px; border-bottom:1px solid #f3f4f6;">${p.fechaVencimiento || p.vencimiento || '-'}</td>
                        <td style="padding:6px 8px; text-align:right; border-bottom:1px solid #f3f4f6;">${dinero(p.monto || p.abono || 0)}</td>
                        <td style="padding:6px 8px; text-align:center; border-bottom:1px solid #f3f4f6;"><span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:9999px; font-size:12px;">${p.estado || 'Pendiente'}</span></td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : '';

    const bancosDebito = (tarjetasConfig || []).filter(b => b.tipo === "debito");
    const opcionesDestino = [
        ...(cuentasEfectivo || [{ id: "efectivo", nombre: "💵 Efectivo" }]).map(c => `<option value="${c.id}">${c.nombre}</option>`),
        ...bancosDebito.map(b => `<option value="banco_${b.banco}">🏦 ${b.banco}</option>`)
    ].join('') || '<option value="efectivo">💵 Caja / Efectivo</option>';

    let modalHTML = `
        <div data-modal="true" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-top:0;">💰 Registrar Abono - ${cuenta.nombre}</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div><small style="color:#4b5563;">Saldo Actual</small><br><strong style="font-size:20px; color:#27ae60;">${dinero(saldo)}</strong></div>
                        <div><small style="color:#4b5563;">Pagarés Pendientes</small><br><strong style="font-size:20px; color:#e74c3c;">${pagaresCliente.length}</strong></div>
                    </div>
                </div>

                ${articulosHTML}
                ${pagaresHTML}

                <div class="campo" style="margin-bottom:15px;">
                    <label>Cuenta Receptora:</label>
                    <select id="cuentaDestinoAbono" style="padding:10px; font-size:15px; border:2px solid #3498db; border-radius:6px; width:100%;">
                        ${opcionesDestino}
                    </select>
                </div>

                <div class="campo" style="margin-bottom:20px;">
                    <label>Monto del Abono ($):</label>
                    <input type="number" id="montoAbono" placeholder="0.00" min="0" max="${saldo}" 
                           style="padding:12px; font-size:16px; border:2px solid #3498db; border-radius:6px; width:100%;">
                </div>

                ${aplicaPoliticaContado ? `
                    <div style="background:#fffbeb; padding:15px; border-radius:8px; border-left:5px solid #f59e0b; margin-bottom:20px;">
                        <strong style="color:#92400e;">💡 Política de Liquidación Anticipada</strong>
                        <p style="margin:10px 0 0 0; font-size:14px; color:#78350f;">
                            Si liquida en los primeros 30 días, se respeta: <strong>${dinero(original)}</strong>
                        </p>
                        <label style="margin-top:10px; display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="chkLiquidarContado" style="width:18px; height:18px;">
                            <span>✅ Aplicar política de liquidación</span>
                        </label>
                    </div>
                ` : ''}

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarAbonoAvanzado('${folio}', ${original}, ${saldo}, ${aplicaPoliticaContado})" 
                            style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ Registrar Abono
                    </button>
                    <button onclick="this.closest('[data-modal]').remove();" 
                            style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function procesarAbonoAvanzado(folio, montoOriginal, saldoActual, aplicaPolitica) {
    const montoAbono = parseFloat(document.getElementById("montoAbono").value);
    const usarPolitica = document.getElementById("chkLiquidarContado")?.checked && aplicaPolitica;
    const cuentaDestino = document.getElementById("cuentaDestinoAbono")?.value || "efectivo";

    if (isNaN(montoAbono) || montoAbono <= 0) {
        alert("Ingresa un monto válido.");
        return;
    }

    if (montoAbono > saldoActual) {
        alert("El abono no puede ser mayor al saldo.");
        return;
    }

    let nuevoSaldo = saldoActual - montoAbono;

    if (usarPolitica && Math.abs(montoAbono - saldoActual) < 0.01) {
        if (!confirm(`⚠️ APLICAR POLÍTICA DE CONTADO\n\nMonto a pagar: ${dinero(montoAbono)}\nRespetado al valor: ${dinero(montoOriginal)}\n\n¿Confirmar?`)) {
            return;
        }
        nuevoSaldo = 0;
    }

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const idxCuenta = cuentas.findIndex(c => c.folio === folio);
    
    if (idxCuenta !== -1) {
        const cuenta = cuentas[idxCuenta];
        cuenta.abonos = cuenta.abonos || [];
        cuenta.abonos.push({
            fecha: new Date().toLocaleDateString(),
            monto: montoAbono,
            cuentaDestino
        });
        cuenta.saldoActual = nuevoSaldo;
        
        if (nuevoSaldo === 0) {
            cuenta.estado = "Saldado";
        }

        cuentas[idxCuenta] = cuenta;
        if (!StorageService.set("cuentasPorCobrar", cuentas)) {
            console.error("❌ Error guardando abono");
            return;
        }

        let movimientos = StorageService.get("movimientosCaja", []);
        movimientos.push({
            fecha: new Date().toLocaleDateString(),
            monto: montoAbono,
            tipo: "Ingreso",
            concepto: `Abono a ${cuenta.nombre} - ${folio}`,
            cuenta: cuentaDestino
        });
        if (!StorageService.set("movimientosCaja", movimientos)) {
            console.error("❌ Error guardando movimiento de caja");
        }
    }

    alert("✅ Abono registrado exitosamente.");
    document.querySelector('[data-modal]').remove();
    renderCuentasXCobrar();
}

function abrirModalNuevoCliente() {
    const modalHTML = `
        <div data-modal="true" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
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
                    <button onclick="this.closest('[data-modal]').remove();" 
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
    document.querySelector('[data-modal]').remove();
    cargarClientesSelect();
}
