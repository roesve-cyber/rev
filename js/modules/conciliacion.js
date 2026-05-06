// ===== MÓDULO DE CONCILIACIÓN Y TRANSFERENCIAS =====

function renderConciliacion() {
    const cont = document.getElementById('contenedorConciliacion');
    if (!cont) return;

    const movimientos = StorageService.get("movimientosCaja", []);
    const cuentasConfig = StorageService.get("tarjetasConfig", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal" }]);
    
    const cuentaFiltro = window._filtroCtaConciliacion || 'todas';

    // 1. Panel de Resumen de Saldos
    let totalSistema = 0;
    let totalConciliado = 0;

    movimientos.forEach(m => {
        if (cuentaFiltro !== 'todas' && m.cuenta !== cuentaFiltro) return;
        const monto = parseFloat(m.monto) || 0;
        const esIngreso = m.tipo.toLowerCase() === 'ingreso';
        const valor = esIngreso ? monto : -monto;
        
        totalSistema += valor;
        if (m.conciliado) totalConciliado += valor;
    });

    // 2. Selector de Cuenta
    let opcionesCta = `<option value="todas" ${cuentaFiltro === 'todas' ? 'selected' : ''}>🌍 Todas las cuentas</option>`;
    cajas.forEach(c => opcionesCta += `<option value="${c.id}" ${cuentaFiltro === c.id ? 'selected' : ''}>${c.nombre}</option>`);
    cuentasConfig.filter(t => t.tipo === "debito").forEach(t => opcionesCta += `<option value="${t.banco}" ${cuentaFiltro === t.banco ? 'selected' : ''}>🏦 ${t.banco} Débito</option>`);

    let html = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:25px;">
        <div style="background:#f8fafc; padding:20px; border-radius:12px; border:1px solid #e2e8f0; text-align:center;">
            <small style="color:#64748b; font-weight:bold;">SALDO EN SISTEMA</small>
            <div style="font-size:28px; font-weight:800; color:#1e293b;">${dinero(totalSistema)}</div>
        </div>
        <div style="background:#f0fdf4; padding:20px; border-radius:12px; border:1px solid #bbf7d0; text-align:center;">
            <small style="color:#166534; font-weight:bold;">SALDO CONCILIADO (BANCO)</small>
            <div style="font-size:28px; font-weight:800; color:#15803d;">${dinero(totalConciliado)}</div>
            ${Math.abs(totalSistema - totalConciliado) > 0.01 ? `<div style="color:#dc2626; font-size:12px; font-weight:bold; margin-top:5px;">⚠️ Diferencia: ${dinero(totalSistema - totalConciliado)}</div>` : '<div style="color:#15803d; font-size:12px; font-weight:bold; margin-top:5px;">✅ Cuadrado con banco</div>'}
        </div>
    </div>

    <div style="background:white; padding:20px; border-radius:12px; box-shadow:var(--shadow-sm); border:1px solid var(--border-color);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="margin:0;">📋 Movimientos</h3>
            <select onchange="window._filtroCtaConciliacion = this.value; renderConciliacion();" style="padding:8px; border-radius:6px; border:1px solid #d1d5db;">
                ${opcionesCta}
            </select>
        </div>
        <div style="overflow-x:auto;">
            <table class="tabla-admin">
                <thead><tr>
                    <th style="width:50px; text-align:center;">Audit</th>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th>Cuenta</th>
                    <th style="text-align:right;">Ingreso</th>
                    <th style="text-align:right;">Egreso</th>
                </tr></thead>
                <tbody>`;

    const movFiltrados = cuentaFiltro === 'todas' ? movimientos : movimientos.filter(m => m.cuenta === cuentaFiltro);
    
    [...movFiltrados].reverse().forEach(m => {
        const esIngreso = m.tipo.toLowerCase() === 'ingreso';
        html += `
        <tr style="${m.conciliado ? 'background:#f8fafc; opacity:0.8;' : ''}">
            <td style="text-align:center;">
                <input type="checkbox" ${m.conciliado ? 'checked' : ''} 
                    onchange="toggleConciliacionMov(${m.id}, this.checked)" 
                    style="width:18px; height:18px; cursor:pointer;">
            </td>
            <td style="font-size:12px;">${m.fecha ? m.fecha.substring(0,10) : '-'}</td>
            <td><small style="color:#64748b; font-size:10px;">${m.referencia || ''}</small><br><b>${m.concepto}</b></td>
            <td><small>${m.etiquetaCuenta || m.cuenta}</small></td>
            <td style="text-align:right; color:#16a34a; font-weight:bold;">${esIngreso ? dinero(m.monto) : ''}</td>
            <td style="text-align:right; color:#dc2626; font-weight:bold;">${!esIngreso ? dinero(m.monto) : ''}</td>
        </tr>`;
    });

    cont.innerHTML = html + `</tbody></table></div></div>`;
}

function toggleConciliacionMov(id, valor) {
    const movs = StorageService.get("movimientosCaja", []);
    const idx = movs.findIndex(m => m.id === id);
    if (idx !== -1) {
        movs[idx].conciliado = valor;
        StorageService.set("movimientosCaja", movs);
        renderConciliacion();
    }
}

// === LÓGICA DE TRANSFERENCIAS ===
function abrirModalTransferencia() {
    const tarjetas = StorageService.get("tarjetasConfig", []);
    const cajas = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "💵 Efectivo Principal" }]);
    
    let opciones = '';
    cajas.forEach(c => opciones += `<option value="${c.id}">${c.nombre}</option>`);
    tarjetas.filter(t => t.tipo === "debito").forEach(t => opciones += `<option value="${t.banco}">🏦 ${t.banco} Débito</option>`);

    const html = `
    <div data-modal="transferencia" style="position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(5px); z-index:9000; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:450px; box-shadow:var(--shadow-lg);">
            <h2 style="margin-top:0; color:#6366f1;">📲 Transferencia entre Cuentas</h2>
            
            <div class="campo" style="margin-bottom:15px;">
                <label>ORIGEN (Sale dinero)</label>
                <select id="transfOrigen" style="width:100%;">${opciones}</select>
            </div>
            <div class="campo" style="margin-bottom:15px;">
                <label>DESTINO (Entra dinero)</label>
                <select id="transfDestino" style="width:100%;">${opciones}</select>
            </div>
            <div class="campo" style="margin-bottom:20px;">
                <label>MONTO A MOVER ($)</label>
                <input type="number" id="transfMonto" placeholder="0.00" style="width:100%; font-size:18px; font-weight:bold; color:#1e293b;">
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="ejecutarTransferencia()" style="flex:1; padding:14px; background:#6366f1; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">✅ Confirmar Envío</button>
                <button onclick="document.querySelector('[data-modal=transferencia]').remove()" style="flex:1; padding:14px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; cursor:pointer;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function ejecutarTransferencia() {
    const oriId = document.getElementById('transfOrigen').value;
    const desId = document.getElementById('transfDestino').value;
    const monto = parseFloat(document.getElementById('transfMonto').value);
    
    if (oriId === desId) return alert("⚠️ La cuenta de origen y destino no pueden ser la misma.");
    if (isNaN(monto) || monto <= 0) return alert("⚠️ Ingresa un monto válido.");

    const oriEtq = document.getElementById('transfOrigen').options[document.getElementById('transfOrigen').selectedIndex].text;
    const desEtq = document.getElementById('transfDestino').options[document.getElementById('transfDestino').selectedIndex].text;

    // 1. Registrar Salida del Origen
    window._egresarCuenta({
        monto: monto, cuentaId: oriId, etiqueta: oriEtq,
        concepto: `Transferencia enviada a ${desEtq}`, referencia: `TRF-OUT-${Date.now()}`
    });

    // 2. Registrar Entrada al Destino
    window._ingresarCuenta({
        monto: monto, cuentaId: desId, etiqueta: desEtq,
        concepto: `Transferencia recibida de ${oriEtq}`, referencia: `TRF-IN-${Date.now()}`
    });

    document.querySelector('[data-modal="transferencia"]').remove();
    alert(`✅ Se movieron ${dinero(monto)} con éxito.`);
    renderConciliacion();
}

window.renderConciliacion = renderConciliacion;
window.toggleConciliacionMov = toggleConciliacionMov;
window.abrirModalTransferencia = abrirModalTransferencia;
window.ejecutarTransferencia = ejecutarTransferencia;