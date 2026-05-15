// ===== PROYECCIÓN DE FLUJO =====

// ===== PROYECCIÓN DE FLUJO (CASHFLOW) PROFESIONAL =====
function renderProyeccionFlujo() {
    const cont = document.getElementById('contenidoProyeccion');
    if (!cont) return;

    const mesesSel = parseInt(document.getElementById('proyMeses')?.value) || 6;
    const hoy = new Date();
    
    // 1. OBTENER RECURSOS ACTUALES (Saldo en mano)
    const movimientosCaja = StorageService.get("movimientosCaja", []);
    const saldoActual = movimientosCaja.reduce((s, m) => s + ((m.tipo === 'ingreso' || m.tipo === 'Ingreso') ? (m.monto || 0) : -(m.monto || 0)), 0);

    // 2. OBTENER COMPROMISOS (Deudas)
    const pagares = StorageService.get('pagaresSistema', []);
    const gastos = StorageService.get('gastosOperativos', []);
    const cxp = StorageService.get('cuentasPorPagar', []);
    const cuentasMSI = StorageService.get("cuentasMSI", []); // <--- Integración MSI

    const meses = [];
    for (let i = 0; i < mesesSel; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        meses.push({ 
            key: mesKey, 
            label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric', timeZone: 'America/Mexico_City'}), 
            ingresos: 0, 
            gastos: 0, 
            pagosMSI: 0, 
            pagosCXP: 0 
        });
    }

    // INGRESOS: Pagarés vencidos (se suman al mes actual) y por vencer
    pagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial').forEach(p => {
        const fv = new Date(p.fechaVencimiento);
        // Extraemos "YYYY-MM" directo del formato estandarizado para máxima seguridad
        const mesKey = p.fechaVencimiento.substring(0, 7);
        const m = meses.find(x => x.key === mesKey);
        const saldo = p.estado === 'Parcial' ? ((p.monto || 0) - (p.montoAbonado || 0)) : (p.monto || 0);
        
        if (m) { m.ingresos += saldo; } 
        else if (fv < hoy) { meses[0].ingresos += saldo; } // Vencidos se consideran "cobro inmediato"
    });

    // COMPROMISOS: Gastos recurrentes
    gastos.filter(g => g.recurrente).forEach(g => {
        const reps = g.periodicidad === 'semanal' ? 4 : 1;
        meses.forEach(m => { m.gastos += g.monto * reps; });
    });

    // COMPROMISOS: Cuentas por pagar (CXP)
    cxp.filter(c => (c.saldoPendiente || 0) > 0 && c.vencimiento).forEach(c => {
        // Parsear fecha de vencimiento (asumiendo DD/MM/YYYY)
        const partes = c.vencimiento.split('/');
        const fv = partes.length === 3 ? new Date(partes[2], partes[1]-1, partes[0]) : new Date(c.vencimientoIso || c.vencimiento);
        const mesKey = (c.vencimientoIso || window.localISO(fv)).substring(0, 7);
        const m = meses.find(x => x.key === mesKey);
        if (m) m.pagosCXP += c.saldoPendiente || 0;
    });

    // COMPROMISOS: Mensualidades MSI (Tarjetas de Crédito)
    cuentasMSI.forEach(deuda => {
        const cuota = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagados = parseInt(deuda.pagosRealizados || 0);
        const calendario = deuda.calendario || [];
        
        // Tomamos solo las cuotas que faltan por pagar
        calendario.slice(pagados).forEach(pago => {
            const mesKey = pago.fecha.substring(0, 7);
            const m = meses.find(x => x.key === mesKey);
            if (m) m.pagosMSI += cuota;
        });
    });

    // 3. RENDERIZAR TABLA Y ACUMULADO
    let acumulado = saldoActual;
    const rows = meses.map((m, idx) => {
        const totalCompromisos = m.gastos + m.pagosMSI + m.pagosCXP;
        const netoMes = m.ingresos - totalCompromisos;
        acumulado += netoMes;
        
        let semaforo = '🟢';
        if (acumulado < 0) semaforo = '🔴';
        else if (acumulado < 15000) semaforo = '🟠'; // Reserva de seguridad

        return `<tr>
          <td style="padding:10px;">${m.label}</td>
          <td style="padding:10px;text-align:right;color:#16a34a;">+${dinero(m.ingresos)}</td>
          <td style="padding:10px;text-align:right;color:#dc2626;">-${dinero(totalCompromisos)}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:${acumulado >= 0 ? '#16a34a' : '#dc2626'};">${semaforo} ${dinero(acumulado)}</td>
          <td style="padding:10px;text-align:center;">
            <small style="font-size:9px;color:#64748b;">MSI: ${dinero(m.pagosMSI)} | CXP: ${dinero(m.pagosCXP)}</small>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1e40af;">📈 Proyección de Caja (Cashflow)</h3>
        <select id="proyMeses" onchange="renderProyeccionFlujo()" style="padding:8px;border-radius:6px;">
            <option value="3" ${mesesSel===3?'selected':''}>3 meses</option>
            <option value="6" ${mesesSel===6?'selected':''}>6 meses</option>
            <option value="12" ${mesesSel===12?'selected':''}>12 meses</option>
        </select>
      </div>

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:#f8fafc;padding:15px;border-radius:10px;border:1px solid #e2e8f0;text-align:center;">
          <small style="color:#64748b;font-weight:bold;">SALDO HOY (Líquido)</small><br>
          <strong style="font-size:22px;color:#0f172a;">${dinero(saldoActual)}</strong>
        </div>
        <div style="background:#f0fdf4;padding:15px;border-radius:10px;border:1px solid #bbf7d0;text-align:center;">
          <small style="color:#166534;font-weight:bold;">COBRANZA ESTIMADA</small><br>
          <strong style="font-size:22px;color:#15803d;">${dinero(meses.reduce((s,m)=>s+m.ingresos,0))}</strong>
        </div>
        <div style="background:#fef2f2;padding:15px;border-radius:10px;border:1px solid #fecaca;text-align:center;">
          <small style="color:#991b1b;font-weight:bold;">COMPROMISOS TOTALES</small><br>
          <strong style="font-size:22px;color:#be123c;">${dinero(meses.reduce((s,m)=>s+m.gastos+m.pagosMSI+m.pagosCXP,0))}</strong>
        </div>
      </div>

      <div style="background:white;padding:20px;border-radius:12px;box-shadow:var(--shadow-sm);border:1px solid var(--border-color);">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f8fafc;color:#64748b;text-transform:uppercase;">
            <th style="padding:10px;text-align:left;">Mes</th>
            <th style="padding:10px;text-align:right;">Cobranza (+)</th>
            <th style="padding:10px;text-align:right;">Pagos (-)</th>
            <th style="padding:10px;text-align:right;">Saldo Final</th>
            <th style="padding:10px;text-align:center;">Desglose Egresos</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
}
