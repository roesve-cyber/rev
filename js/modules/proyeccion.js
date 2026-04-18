// ===== PROYECCIÓN DE FLUJO =====

function renderProyeccionFlujo() {
    const cont = document.getElementById('contenidoProyeccion');
    if (!cont) return;
    const mesesSel = parseInt(document.getElementById('proyMeses')?.value) || 6;
    const hoy = new Date();
    const pagares = StorageService.get('pagaresSistema', []);
    const gastos = StorageService.get('gastosOperativos', []);
    const cxp = StorageService.get('cuentasPorPagar', []);

    const meses = [];
    for (let i = 0; i < mesesSel; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        meses.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' }), ingresos: 0, gastos: 0 });
    }

    // Ingresos: pagarés pendientes agrupados por mes de vencimiento
    pagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial').forEach(p => {
        const fv = new Date(p.fechaVencimiento);
        const key = `${fv.getFullYear()}-${String(fv.getMonth() + 1).padStart(2, '0')}`;
        const m = meses.find(x => x.key === key);
        if (m) m.ingresos += p.monto || 0;
    });

    // Gastos: gastos recurrentes proyectados
    gastos.filter(g => g.recurrente).forEach(g => {
        const reps = g.periodicidad === 'semanal' ? 4 : 1;
        meses.forEach(m => { m.gastos += g.monto * reps; });
    });

    // Cuentas por pagar con fecha estimada
    cxp.filter(c => (c.saldoPendiente || 0) > 0 && c.fechaVencimiento).forEach(c => {
        const fv = new Date(c.fechaVencimiento);
        const key = `${fv.getFullYear()}-${String(fv.getMonth() + 1).padStart(2, '0')}`;
        const m = meses.find(x => x.key === key);
        if (m) m.gastos += c.saldoPendiente || 0;
    });

    let acumulado = 0;
    const rows = meses.map(m => {
        const neto = m.ingresos - m.gastos;
        acumulado += neto;
        let semaforo = '🟢';
        if (neto < 0) semaforo = '🔴';
        else if (neto < m.gastos * 0.2) semaforo = '🟠';
        const colorNeto = neto >= 0 ? '#16a34a' : '#dc2626';
        const colorAcum = acumulado >= 0 ? '#16a34a' : '#dc2626';
        return `<tr>
          <td style="padding:10px;">${m.label}</td>
          <td style="padding:10px;text-align:right;color:#1e40af;">${dinero(m.ingresos)}</td>
          <td style="padding:10px;text-align:right;color:#dc2626;">${dinero(m.gastos)}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:${colorNeto};">${semaforo} ${dinero(neto)}</td>
          <td style="padding:10px;text-align:right;font-weight:bold;color:${colorAcum};">${dinero(acumulado)}</td>
        </tr>`;
    }).join('');

    const totalIngresos = meses.reduce((s, m) => s + m.ingresos, 0);
    const totalGastos = meses.reduce((s, m) => s + m.gastos, 0);

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h3 style="margin:0;color:#1e40af;">📈 Proyección de Flujo</h3>
        <div style="display:flex;align-items:center;gap:12px;">
          <label style="font-size:12px;font-weight:bold;color:#374151;">MESES A PROYECTAR</label>
          <select id="proyMeses" onchange="renderProyeccionFlujo()" style="padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;">
            <option value="3" ${mesesSel===3?'selected':''}>3 meses</option>
            <option value="6" ${mesesSel===6?'selected':''}>6 meses</option>
            <option value="12" ${mesesSel===12?'selected':''}>12 meses</option>
          </select>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:#eff6ff;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#1e40af;">INGRESOS PROYECTADOS</small><br>
          <strong style="font-size:22px;color:#1e40af;">${dinero(totalIngresos)}</strong>
        </div>
        <div style="background:#fef2f2;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#dc2626;">GASTOS PROGRAMADOS</small><br>
          <strong style="font-size:22px;color:#dc2626;">${dinero(totalGastos)}</strong>
        </div>
        <div style="background:${acumulado>=0?'#f0fdf4':'#fef2f2'};padding:20px;border-radius:10px;text-align:center;">
          <small style="color:${acumulado>=0?'#16a34a':'#dc2626'};">FLUJO NETO ACUMULADO</small><br>
          <strong style="font-size:22px;color:${acumulado>=0?'#16a34a':'#dc2626'};">${acumulado>=0?'🟢':'🔴'} ${dinero(acumulado)}</strong>
        </div>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:10px;text-align:left;">Mes</th>
              <th style="padding:10px;text-align:right;">Ingresos Esperados</th>
              <th style="padding:10px;text-align:right;">Gastos Programados</th>
              <th style="padding:10px;text-align:right;">Neto</th>
              <th style="padding:10px;text-align:right;">Acumulado</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <p style="color:#9ca3af;font-size:12px;margin-top:12px;">🟢 Positivo &nbsp; 🟠 Bajo margen &nbsp; 🔴 Negativo. Basado en pagarés pendientes y gastos recurrentes.</p>
      </div>`;
}

window.renderProyeccionFlujo = renderProyeccionFlujo;
