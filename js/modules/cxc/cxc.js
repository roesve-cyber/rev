// ===== CUENTAS POR COBRAR =====
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
        const color = saldo > 0 ? "#27ae60" : "#999";
        const fechaVenta = new Date(cuenta.fechaVenta).toLocaleDateString();

        html += `<tr>
            <td><strong>${cuenta.nombre}</strong><br><small style="color:#718096;">${cuenta.folio}</small></td>
            <td>${fechaVenta}</td>
            <td>${dinero(cuenta.totalContadoOriginal ?? 0)}</td>
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

    let modalHTML = `
        <div style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-top:0;">💰 Registrar Abono - ${cuenta.nombre}</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div><small style="color:#4b5563;">Saldo Actual</small><br><strong style="font-size:20px; color:#27ae60;">${dinero(saldo)}</strong></div>
                        <div><small style="color:#4b5563;">Pagarés Pendientes</small><br><strong style="font-size:20px; color:#e74c3c;">${pagaresCliente.length}</strong></div>
                    </div>
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
                    <button onclick="this.closest('div').parentElement.remove();" 
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
            monto: montoAbono
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
            concepto: `Abono a ${cuenta.nombre} - ${folio}`
        });
        if (!StorageService.set("movimientosCaja", movimientos)) {
            console.error("❌ Error guardando movimiento de caja");
        }
    }

    alert("✅ Abono registrado exitosamente.");
    document.querySelector('div[style*="position:fixed"]').remove();
    renderCuentasXCobrar();
}

function filtrarCuentasCobranza() {
    renderCuentasXCobrar();
}

window.renderCuentasXCobrar = renderCuentasXCobrar;
window.renderCobranzaEsperada = renderCobranzaEsperada;
window.exportarCobranzaEsperada = exportarCobranzaEsperada;
window.abrirModalAbonoAvanzado = abrirModalAbonoAvanzado;
window.procesarAbonoAvanzado = procesarAbonoAvanzado;
window.filtrarCuentasCobranza = filtrarCuentasCobranza;
