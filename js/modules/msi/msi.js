// ===== MSI DASHBOARD =====
function renderDashboardMSI(bancoSeleccionado) {
    if (bancoSeleccionado === undefined) bancoSeleccionado = 'Todos';
    const contenedorBancos = document.getElementById('listaBancosMSI');
    const contenedorMeses  = document.getElementById('listaMesesMSI');
    const tituloMeses      = document.getElementById('tituloMesesMSI');
    if (!contenedorBancos || !contenedorMeses) return;

    const deudas = StorageService.get("cuentasMSI", []);

    let totalesPorBanco = {};
    let deudaTotalGlobal = 0;
    tarjetasConfig.forEach(t => { totalesPorBanco[t.banco] = 0; });
    deudas.forEach(deuda => {
        if (!totalesPorBanco[deuda.banco]) totalesPorBanco[deuda.banco] = 0;
        const totalVal  = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal  = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos     = parseInt(deuda.pagosRealizados || 0);
        const restante  = totalVal - (pagos * cuotaVal);
        totalesPorBanco[deuda.banco] += restante;
        deudaTotalGlobal += restante;
    });

    let htmlBancos = `
        <div class="tarjeta-banco-msi ${bancoSeleccionado === 'Todos' ? 'activo' : ''}" onclick="renderDashboardMSI('Todos')">
            <span>🌍 Todos</span>
            <span style="font-weight:bold; color:#e74c3c;">${dinero(deudaTotalGlobal)}</span>
        </div>`;
    Object.keys(totalesPorBanco).forEach(banco => {
        htmlBancos += `
            <div class="tarjeta-banco-msi ${bancoSeleccionado === banco ? 'activo' : ''}" onclick="renderDashboardMSI('${banco}')">
                <span>🏦 ${banco}</span>
                <span style="font-weight:bold;">${dinero(totalesPorBanco[banco])}</span>
            </div>`;
    });
    contenedorBancos.innerHTML = htmlBancos;

    if (tituloMeses) tituloMeses.innerText = `Proyección de Pagos (${bancoSeleccionado})`;

    let cronograma = {};
    const hoy = new Date();
    let mesAct  = hoy.getMonth() + 1;
    let anioAct = hoy.getFullYear();

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
    let htmlMeses = '';
    Object.keys(cronograma).sort().forEach(clave => {
        const [anio, mes] = clave.split('-');
        const data = cronograma[clave];
        if (data.total > 0) {
            const detallesHtml = data.detalles.map(det => `
                <div class="fila-conciliacion" onclick="this.classList.toggle('conciliado')">
                    <input type="checkbox" style="cursor:pointer">
                    <span>${det}</span>
                </div>`).join('');

            htmlMeses += `
                <div class="mes-msi-card">
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

window.renderDashboardMSI = renderDashboardMSI;
window.renderCuentasMSI = renderCuentasMSI;
