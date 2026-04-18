// ===== BANCOS Y TARJETAS =====
function renderBancosConfig() {
    const contenedor = document.getElementById("tablaBancosConfig");
    if (!contenedor) return;

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Banco</th>
                <th>Tipo</th>
                <th>Día de Corte</th>
                <th>Día Límite de Pago</th>
                <th>Acciones</th>
            </tr></thead>
            <tbody>`;

    tarjetasConfig.forEach((t, index) => {
        const tipo = t.tipo || "credito";
        const tipoLabel = tipo === "debito"
            ? '<span style="color:#2b6cb0; font-weight:bold;">🏦 Débito</span>'
            : '<span style="color:#6b21a8; font-weight:bold;">💳 Crédito MSI</span>';
        const notaMes = (tipo !== "debito" && parseInt(t.diaCorte) > parseInt(t.diaLimite))
            ? '<br><small style="color:orange;">(Mes siguiente)</small>' : '';
        const diaCorteStr = tipo === "debito" ? '—' : `Día ${t.diaCorte}`;
        const diaLimiteStr = tipo === "debito" ? '—' : `Día ${t.diaLimite} ${notaMes}`;
        html += `
            <tr>
                <td><strong>${t.banco}</strong></td>
                <td>${tipoLabel}</td>
                <td>${diaCorteStr}</td>
                <td>${diaLimiteStr}</td>
                <td>
                    <button onclick="prepararEdicionBanco(${index})" style="background:#3182ce; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px;">Modificar</button>
                    <button onclick="eliminarBanco(${index})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Eliminar</button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function abrirModalBanco() {
    const nombre = prompt("Nombre del Banco / Cuenta:");
    if (!nombre) return;
    const tipoOpc = prompt("Tipo de cuenta:\n1 = Débito\n2 = Crédito (MSI)");
    const tipo = tipoOpc === "1" ? "debito" : "credito";

    if (tipo === "debito") {
        tarjetasConfig.push({ banco: nombre.toUpperCase(), tipo: "debito", diaCorte: 0, diaLimite: 0 });
        actualizarYRefrescarBancos();
    } else {
        const corte  = parseInt(prompt("Día de corte (1-31):"));
        const limite = parseInt(prompt("Día límite de pago (1-31):"));
        if (!isNaN(corte) && !isNaN(limite)) {
            tarjetasConfig.push({ banco: nombre.toUpperCase(), tipo: "credito", diaCorte: corte, diaLimite: limite });
            actualizarYRefrescarBancos();
        } else {
            alert("Por favor ingresa números válidos.");
        }
    }
}

function prepararEdicionBanco(index) {
    const banco = tarjetasConfig[index];
    const nuevoNombre = prompt("Nombre del Banco:", banco.banco);
    if (nuevoNombre === null) return;
    const tipo = banco.tipo || "credito";
    if (tipo === "debito") {
        if (!nuevoNombre) { alert("Datos inválidos."); return; }
        tarjetasConfig[index] = { banco: nuevoNombre.toUpperCase(), tipo: "debito", diaCorte: 0, diaLimite: 0 };
    } else {
        const nuevoCorte  = parseInt(prompt("Día de Corte (1-31):", banco.diaCorte));
        const nuevoLimite = parseInt(prompt("Día Límite de Pago (1-31):", banco.diaLimite));
        if (!nuevoNombre || isNaN(nuevoCorte) || isNaN(nuevoLimite)) {
            alert("Datos inválidos.");
            return;
        }
        tarjetasConfig[index] = { banco: nuevoNombre.toUpperCase(), tipo: "credito", diaCorte: nuevoCorte, diaLimite: nuevoLimite };
    }
    actualizarYRefrescarBancos();
    alert("¡Cuenta modificada con éxito!");
}

function eliminarBanco(index) {
    if (confirm("¿Seguro que deseas eliminar este banco?")) {
        tarjetasConfig.splice(index, 1);
        actualizarYRefrescarBancos();
    }
}

function actualizarYRefrescarBancos() {
    if (!StorageService.set("tarjetasConfig", tarjetasConfig)) {
        console.error("❌ Error guardando bancos");
        return;
    }
    renderBancosConfig();
    actualizarSelectBancos();
}

function calcularFechaPago(fechaCompraStr, bancoNombre) {
    const infoBanco = tarjetasConfig.find(t => t.banco === bancoNombre);
    if (!infoBanco) return fechaCompraStr;

    let partes = fechaCompraStr.split('/');
    let fecha = new Date(partes[2], partes[1] - 1, partes[0]);
    if (isNaN(fecha.getTime())) fecha = new Date();

    const diaCompra = fecha.getDate();
    const diaCorte  = parseInt(infoBanco.diaCorte);
    const diaLimite = parseInt(infoBanco.diaLimite);

    let mes  = fecha.getMonth();
    let anio = fecha.getFullYear();

    if (diaCompra > diaCorte) mes += 1;
    if (diaLimite < diaCorte)  mes += 1;

    return new Date(anio, mes, diaLimite).toLocaleDateString();
}

function calcularCalendarioMSI(fechaRef, meses, nombreBanco) {
    const config = tarjetasConfig.find(t => t.banco === nombreBanco) || { diaCorte: 15, diaLimite: 5 };
    let cronograma = [];
    let d = new Date(fechaRef);
    let saltoMes = (d.getDate() > config.diaCorte) ? 2 : 1;
    for (let i = 0; i < meses; i++) {
        let fPago = new Date(d.getFullYear(), d.getMonth() + i + saltoMes, config.diaLimite);
        cronograma.push({ n: i + 1, fecha: fPago.toISOString().split('T')[0] });
    }
    return cronograma;
}

// ===== MSI DASHBOARD =====
function renderDashboardMSI(bancoSeleccionado = 'Todos') {
    const contenedorBancos = document.getElementById('listaBancosMSI');
    const contenedorMeses  = document.getElementById('listaMesesMSI');
    const tituloMeses      = document.getElementById('tituloMesesMSI');
    if (!contenedorBancos || !contenedorMeses) return;

    const deudas = StorageService.get("cuentasMSI", []);

    let totalesPorBanco = {};
    let originalPorBanco = {};
    let deudaTotalGlobal = 0;
    let deudaOriginalTotal = 0;
    tarjetasConfig.forEach(t => { totalesPorBanco[t.banco] = 0; originalPorBanco[t.banco] = 0; });
    deudas.forEach(deuda => {
        if (!totalesPorBanco[deuda.banco]) totalesPorBanco[deuda.banco] = 0;
        if (!originalPorBanco[deuda.banco]) originalPorBanco[deuda.banco] = 0;
        const totalVal  = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal  = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos     = parseInt(deuda.pagosRealizados || 0);
        const restante  = totalVal - (pagos * cuotaVal);
        totalesPorBanco[deuda.banco] += Math.max(0, restante);
        originalPorBanco[deuda.banco] += totalVal;
        deudaTotalGlobal += Math.max(0, restante);
        deudaOriginalTotal += totalVal;
    });

    // ── KPIs ──────────────────────────────────────────────────────────────
    const hoy = new Date();
    let mesAct  = hoy.getMonth() + 1;
    let anioAct = hoy.getFullYear();

    let cronograma = {};
    for (let i = 0; i < 12; i++) {
        let m = mesAct + i;
        let a = anioAct;
        while (m > 12) { m -= 12; a++; }
        cronograma[`${a}-${m.toString().padStart(2, '0')}`] = { total: 0, detalles: [] };
    }
    deudas.forEach(deuda => {
        if (bancoSeleccionado !== 'Todos' && deuda.banco !== bancoSeleccionado) return;
        const totalVal = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos    = parseInt(deuda.pagosRealizados || 0);
        const pendientes = cuotaVal > 0 ? Math.round(totalVal / cuotaVal) - pagos : 0;
        for (let i = 0; i < pendientes; i++) {
            let m = mesAct + i;
            let a = anioAct;
            while (m > 12) { m -= 12; a++; }
            const clave = `${a}-${m.toString().padStart(2, '0')}`;
            if (cronograma[clave]) {
                cronograma[clave].total += cuotaVal;
                cronograma[clave].detalles.push(`<b>${deuda.banco}</b>: ${deuda.producto || 'Compra'} (${dinero(cuotaVal)})`);
            }
        }
    });

    const mesesNombre = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

    const mesesConPagos = Object.values(cronograma).filter(d => d.total > 0);
    const proximoPagoKey = Object.keys(cronograma).sort().find(k => cronograma[k].total > 0);
    const [proximoAnio, proximoMes] = proximoPagoKey ? proximoPagoKey.split('-') : ['-', '-'];
    const proximoPagoLabel = proximoPagoKey
        ? `${mesesNombre[parseInt(proximoMes)-1]} ${proximoAnio}`
        : 'Sin pagos';
    const bancosActivos = Object.keys(totalesPorBanco).filter(b => (totalesPorBanco[b] || 0) > 0).length;
    const promedioMensual = mesesConPagos.length > 0
        ? mesesConPagos.reduce((s, d) => s + d.total, 0) / mesesConPagos.length
        : 0;

    const kpisHTML = `
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:15px; margin-bottom:25px;">
            <div style="background:#fee2e2; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">💳</div>
                <small style="color:#7f1d1d; font-weight:bold; font-size:11px;">TOTAL DEUDA MSI</small>
                <div style="font-size:20px; font-weight:bold; color:#dc2626; margin-top:4px;">${dinero(deudaTotalGlobal)}</div>
            </div>
            <div style="background:#dbeafe; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">📅</div>
                <small style="color:#1e3a8a; font-weight:bold; font-size:11px;">PRÓXIMO PAGO</small>
                <div style="font-size:18px; font-weight:bold; color:#1d4ed8; margin-top:4px;">${proximoPagoLabel}</div>
            </div>
            <div style="background:#d1fae5; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">🏦</div>
                <small style="color:#065f46; font-weight:bold; font-size:11px;">BANCOS ACTIVOS</small>
                <div style="font-size:26px; font-weight:bold; color:#059669; margin-top:4px;">${bancosActivos}</div>
            </div>
            <div style="background:#fef3c7; padding:18px; border-radius:10px; text-align:center;">
                <div style="font-size:22px; margin-bottom:4px;">💰</div>
                <small style="color:#92400e; font-weight:bold; font-size:11px;">PROMEDIO MENSUAL</small>
                <div style="font-size:20px; font-weight:bold; color:#d97706; margin-top:4px;">${dinero(promedioMensual)}</div>
            </div>
        </div>`;

    const kpisContainer = document.getElementById('flujo-msi');
    const existingKpis = document.getElementById('msi-kpis');
    if (existingKpis) existingKpis.remove();
    const kpisEl = document.createElement('div');
    kpisEl.id = 'msi-kpis';
    kpisEl.innerHTML = kpisHTML;
    const gridMsi = kpisContainer?.querySelector('.grid-msi');
    if (gridMsi) gridMsi.before(kpisEl);

    // ── Tarjetas de bancos con barra de progreso ───────────────────────────
    let htmlBancos = `
        <div class="tarjeta-banco-msi ${bancoSeleccionado === 'Todos' ? 'activo' : ''}" onclick="renderDashboardMSI('Todos')" style="box-shadow:0 2px 6px rgba(0,0,0,0.08);">
            <span>🌍 Todos</span>
            <span style="font-weight:bold; color:#e74c3c;">${dinero(deudaTotalGlobal)}</span>
        </div>`;
    Object.keys(totalesPorBanco).forEach(banco => {
        const restante = totalesPorBanco[banco] || 0;
        const original = originalPorBanco[banco] || 0;
        const progreso = original > 0 ? Math.min(100, ((original - restante) / original) * 100).toFixed(0) : 0;
        htmlBancos += `
            <div class="tarjeta-banco-msi ${bancoSeleccionado === banco ? 'activo' : ''}" onclick="renderDashboardMSI('${banco}')" style="box-shadow:0 2px 6px rgba(0,0,0,0.08);">
                <span>🏦 ${banco}</span>
                <span style="font-weight:bold;">${dinero(restante)}</span>
                <div style="background:#e2e8f0; border-radius:4px; height:5px; margin-top:6px; width:100%;">
                    <div style="background:#3498db; height:100%; border-radius:4px; width:${progreso}%;"></div>
                </div>
                <small style="color:#718096; font-size:11px;">${progreso}% pagado</small>
            </div>`;
    });
    contenedorBancos.innerHTML = htmlBancos;

    if (tituloMeses) tituloMeses.innerText = `Proyección de Pagos (${bancoSeleccionado})`;

    const claveActual = `${anioAct}-${mesAct.toString().padStart(2, '0')}`;
    let mesNext = mesAct + 1;
    let anioNext = anioAct;
    if (mesNext > 12) { mesNext = 1; anioNext++; }
    const claveSiguiente = `${anioNext}-${mesNext.toString().padStart(2, '0')}`;

    let htmlMeses = '';
    Object.keys(cronograma).sort().forEach(clave => {
        const [anio, mes] = clave.split('-');
        const data = cronograma[clave];
        if (data.total > 0) {
            let bgColor = 'white';
            let borderColor = '#e2e8f0';
            if (clave === claveActual) { bgColor = '#fee2e2'; borderColor = '#e74c3c'; }
            else if (clave === claveSiguiente) { bgColor = '#fef3c7'; borderColor = '#f59e0b'; }

            const detallesHtml = data.detalles.map(det => `
                <div class="fila-conciliacion" onclick="this.classList.toggle('conciliado')">
                    <input type="checkbox" style="cursor:pointer">
                    <span>${det}</span>
                </div>`).join('');

            htmlMeses += `
                <div class="mes-msi-card" style="background:${bgColor}; border:1px solid ${borderColor}; box-shadow:0 2px 8px rgba(0,0,0,0.06);">
                    <div style="width: 100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #edf2f7; padding-bottom:8px; margin-bottom:8px;">
                            <strong>📅 ${mesesNombre[parseInt(mes)-1]} ${anio}</strong>
                            <span style="font-weight:bold; color:#27ae60; font-size:1.1em;">${dinero(data.total)}</span>
                        </div>
                        <div class="detalles-mes-interactivo">${detallesHtml}</div>
                    </div>
                </div>`;
        }
    });

    contenedorMeses.innerHTML = htmlMeses || '<p style="text-align:center; color:gray; padding:20px;">Sin pagos pendientes.</p>';
}

function renderCuentasMSI() {
    const contenedor = document.getElementById("listaCuentasMSI");
    if (!contenedor) return;

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    if (cuentasMSI.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>No hay compras a meses activas.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin" style="width:100%;">
            <thead><tr>
                <th>Detalle</th>
                <th>Total</th>
                <th>Mensualidad</th>
                <th>Progreso</th>
            </tr></thead>
            <tbody>`;

    cuentasMSI.forEach(c => {
        const porcentaje = ((c.pagosRealizados || 0) / c.meses) * 100;
        html += `
            <tr>
                <td>
                    <span style="font-weight:bold; color:#2c3e50;">${c.banco}</span><br>
                    <small style="color:#666;">${c.producto || 'Compra'}</small>
                </td>
                <td>${dinero(c.total)}</td>
                <td style="color:#27ae60; font-weight:bold;">${dinero(c.cuotaMensual)}</td>
                <td>
                    <div style="background:#eee; border-radius:10px; height:8px; width:100px; margin-bottom:4px;">
                        <div style="background:#3498db; height:100%; border-radius:10px; width:${porcentaje}%"></div>
                    </div>
                    <small>${c.pagosRealizados || 0} de ${c.meses} meses</small>
                </td>
            </tr>`;
    });
    contenedor.innerHTML = html + "</tbody></table>";
}

// ===== FLUJO DE CAJA =====
function renderFlujoCaja() {
    const contenedor = document.getElementById("tablasFlujoCaja");
    if (!contenedor) return;

    const movimientos = StorageService.get("movimientosCaja", []);

    let totalIngresos = 0;
    let totalEgresos = 0;

    let html = `
        <div style="overflow-x:auto;">
        <table class="tabla-admin" style="width:100%;">
            <thead><tr>
                <th>Fecha</th>
                <th>Folio</th>
                <th>Concepto</th>
                <th>Referencia</th>
                <th>Cuenta</th>
                <th>Tipo</th>
                <th style="text-align:right;">Monto</th>
            </tr></thead>
            <tbody>`;

    if (movimientos.length === 0) {
        html += `<tr><td colspan="7" style="text-align:center; padding:20px; color:#999;">Sin movimientos registrados.</td></tr>`;
    } else {
        [...movimientos].reverse().forEach(m => {
            const esIngreso = m.tipo === "ingreso" || m.tipo === "Ingreso";
            if (esIngreso) totalIngresos += parseFloat(m.monto) || 0;
            else totalEgresos += parseFloat(m.monto) || 0;
            const colorTipo = esIngreso ? "#059669" : "#dc2626";
            const labelTipo = esIngreso ? "⬆️ Ingreso" : "⬇️ Egreso";
            const cuenta = m.cuenta || "efectivo";
            html += `
                <tr>
                    <td>${m.fecha || ""}</td>
                    <td>${m.folio || "—"}</td>
                    <td>${m.concepto || ""}</td>
                    <td>${m.referencia || "—"}</td>
                    <td><strong>${cuenta}</strong></td>
                    <td style="color:${colorTipo}; font-weight:bold;">${labelTipo}</td>
                    <td style="text-align:right; font-weight:bold; color:${colorTipo};">${dinero(m.monto)}</td>
                </tr>`;
        });
    }

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;

    const elIngresos = document.getElementById("totalIngresoContado");
    if (elIngresos) elIngresos.textContent = dinero(totalIngresos);
    const elEgresos = document.getElementById("totalEgresosProveedores");
    if (elEgresos) elEgresos.textContent = dinero(totalEgresos);
}