// ===== GASTOS OPERATIVOS =====

const _CATEGORIAS_GASTOS = ['Renta', 'Luz/Agua/Gas', 'Nómina', 'Transporte', 'Publicidad', 'Mantenimiento', 'Insumos', 'Otros'];

function abrirRegistrarGasto() {
    const tarjetas = StorageService.get('tarjetasConfig', []);
    const opcionesDebito = tarjetas.filter(t => t.tipo === 'debito').map(t =>
        `<option value="${t.banco}">${t.banco} Débito</option>`).join('');
    const html = `
    <div data-modal="registrar-gasto" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:520px;padding:28px;max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 20px;color:#dc2626;">💸 Registrar Gasto</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CATEGORÍA</label>
            <select id="gastoCategoria" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              ${_CATEGORIAS_GASTOS.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">DESCRIPCIÓN</label>
            <input type="text" id="gastoDescripcion" placeholder="Descripción del gasto" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">MONTO ($)</label>
            <input type="number" id="gastoMonto" min="0" step="0.01" placeholder="0.00" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA</label>
            <input type="date" id="gastoFecha" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CUENTA DÉBITO (Cargo)</label>
            <select id="gastoCuentaDebito" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="caja">💵 Caja / Efectivo</option>
              ${opcionesDebito}
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="gastoRecurrente" onchange="toggleRecurrente()" style="width:18px;height:18px;">
            <span style="font-size:14px;font-weight:bold;">¿Es gasto recurrente?</span>
          </label>
          <div id="divPeriodicidad" style="display:none;">
            <label style="font-size:12px;font-weight:bold;color:#374151;">PERIODICIDAD</label>
            <select id="gastoPeriodicidad" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarGasto()" style="flex:1;padding:12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Registrar Gasto</button>
          <button onclick="document.querySelector('[data-modal=registrar-gasto]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function toggleRecurrente() {
    const cb = document.getElementById('gastoRecurrente');
    const div = document.getElementById('divPeriodicidad');
    if (div) div.style.display = cb?.checked ? 'block' : 'none';
}

function guardarGasto() {
    const categoria = document.getElementById('gastoCategoria')?.value;
    const descripcion = document.getElementById('gastoDescripcion')?.value.trim();
    const monto = parseFloat(document.getElementById('gastoMonto')?.value) || 0;
    const fecha = document.getElementById('gastoFecha')?.value || new Date().toISOString().split('T')[0];
    const cuentaDebito = document.getElementById('gastoCuentaDebito')?.value || 'caja';
    const recurrente = document.getElementById('gastoRecurrente')?.checked || false;
    const periodicidad = document.getElementById('gastoPeriodicidad')?.value || 'mensual';
    if (!descripcion) return alert('⚠️ La descripción es obligatoria.');
    if (monto <= 0) return alert('⚠️ El monto debe ser mayor a 0.');
    const hoyStr = new Date().toISOString().split('T')[0];
    const gasto = { id: Date.now(), categoria, descripcion, monto, fecha, cuentaDebito, recurrente, periodicidad, ultimaVez: recurrente ? hoyStr : null };
    const gastos = StorageService.get('gastosOperativos', []);
    gastos.push(gasto);
    StorageService.set('gastosOperativos', gastos);
    // Registrar en movimientos de caja como egreso
    const movs = StorageService.get('movimientosCaja', []);
    movs.push({
        id: Date.now() + 1,
        tipo: 'egreso',
        concepto: `Gasto: ${categoria} — ${descripcion}`,
        monto,
        fecha: new Date(fecha).toISOString(),
        cuenta: cuentaDebito,
        referencia: `GASTO-${gasto.id}`
    });
    StorageService.set('movimientosCaja', movs);
    document.querySelector('[data-modal="registrar-gasto"]')?.remove();
    alert(`✅ Gasto registrado: ${dinero(monto)}`);
    renderGestionGastos();
}

function renderGestionGastos() {
    const cont = document.getElementById('contenidoGastos');
    if (!cont) return;
    const gastos = StorageService.get('gastosOperativos', []);
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);

    // Mini gráfico por categoría
    const porCat = {};
    _CATEGORIAS_GASTOS.forEach(c => porCat[c] = 0);
    gastos.forEach(g => { if (porCat[g.categoria] !== undefined) porCat[g.categoria] += g.monto; });
    const maxVal = Math.max(...Object.values(porCat), 1);
    const barras = Object.entries(porCat).filter(([, v]) => v > 0).map(([cat, val]) => {
        const pct = (val / maxVal * 100).toFixed(1);
        return `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span>${cat}</span><span>${dinero(val)}</span>
          </div>
          <div style="background:#f3f4f6;border-radius:4px;height:16px;">
            <div style="background:#dc2626;height:100%;border-radius:4px;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>`;
    }).join('');

    // Filtros aplicados
    const filtroMes = document.getElementById('gastoFiltroMes')?.value || '';
    const filtroCat = document.getElementById('gastoFiltroCat')?.value || '';
    let gastosFiltrados = gastos;
    if (filtroMes) gastosFiltrados = gastosFiltrados.filter(g => g.fecha && g.fecha.startsWith(filtroMes));
    if (filtroCat) gastosFiltrados = gastosFiltrados.filter(g => g.categoria === filtroCat);

    const rows = gastosFiltrados.slice().reverse().map(g => `<tr>
      <td style="padding:8px;">${g.fecha || '-'}</td>
      <td style="padding:8px;">${g.categoria}</td>
      <td style="padding:8px;">${g.descripcion}</td>
      <td style="padding:8px;text-align:right;">${dinero(g.monto)}</td>
      <td style="padding:8px;text-align:center;">${g.cuentaDebito || 'caja'}</td>
      <td style="padding:8px;text-align:center;">${g.recurrente ? `🔁 ${g.periodicidad}` : '-'}</td>
      <td style="padding:8px;text-align:center;"><button onclick="eliminarGasto(${g.id})" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
    </tr>`).join('');

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#dc2626;">💸 Gastos Operativos</h3>
        <button onclick="abrirRegistrarGasto()" style="padding:10px 18px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Registrar Gasto</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:20px;">
        <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <h4 style="margin:0 0 16px;color:#dc2626;">📊 Por Categoría</h4>
          ${barras || '<p style="color:#9ca3af;font-size:13px;">Sin datos</p>'}
          <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:12px;">
            <strong>Total: ${dinero(totalGastos)}</strong>
          </div>
        </div>
        <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="display:flex;gap:12px;margin-bottom:16px;align-items:end;">
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">MES (YYYY-MM)</label>
              <input type="month" id="gastoFiltroMes" onchange="renderGestionGastos()" style="padding:7px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">CATEGORÍA</label>
              <select id="gastoFiltroCat" onchange="renderGestionGastos()" style="padding:7px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
                <option value="">Todas</option>
                ${_CATEGORIAS_GASTOS.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>
          ${gastosFiltrados.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin resultados.</p>' : `
          <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead><tr style="background:#f3f4f6;position:sticky;top:0;">
                <th style="padding:8px;text-align:left;">Fecha</th>
                <th style="padding:8px;text-align:left;">Categoría</th>
                <th style="padding:8px;text-align:left;">Descripción</th>
                <th style="padding:8px;text-align:right;">Monto</th>
                <th style="padding:8px;text-align:center;">Cuenta</th>
                <th style="padding:8px;text-align:center;">Recurrente</th>
                <th></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
        </div>
      </div>`;
}

function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    let gastos = StorageService.get('gastosOperativos', []);
    gastos = gastos.filter(g => g.id !== id);
    StorageService.set('gastosOperativos', gastos);
    renderGestionGastos();
}

function verificarGastosRecurrentes() {
    const gastos = StorageService.get('gastosOperativos', []);
    const hoy = new Date();
    const recurrentes = gastos.filter(g => g.recurrente);
    if (recurrentes.length === 0) return;
    const hoyStr = hoy.toISOString().split('T')[0];
    let nuevos = 0;
    recurrentes.forEach(g => {
        if (!g.ultimaVez) return;
        const ultima = new Date(g.ultimaVez);
        const diasDif = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));
        const umbral = g.periodicidad === 'semanal' ? 7 : 30;
        if (diasDif >= umbral) {
            const nuevoId = Date.now() + Math.floor(Math.random() * 1000);
            const nuevo = { ...g, id: nuevoId, fecha: hoyStr, ultimaVez: hoyStr };
            gastos.push(nuevo);
            const movs = StorageService.get('movimientosCaja', []);
            movs.push({
                id: Date.now() + 2,
                tipo: 'egreso',
                concepto: `Gasto recurrente: ${g.categoria} — ${g.descripcion}`,
                monto: g.monto,
                fecha: new Date().toISOString(),
                cuenta: g.cuentaDebito || 'caja',
                referencia: `GASTO-${nuevo.id}`
            });
            StorageService.set('movimientosCaja', movs);
            nuevos++;
        }
    });
    if (nuevos > 0) {
        StorageService.set('gastosOperativos', gastos);
        console.log(`🔁 ${nuevos} gasto(s) recurrente(s) registrado(s) automáticamente.`);
    }
}

window.abrirRegistrarGasto = abrirRegistrarGasto;
window.toggleRecurrente = toggleRecurrente;
window.guardarGasto = guardarGasto;
window.renderGestionGastos = renderGestionGastos;
window.eliminarGasto = eliminarGasto;
window.verificarGastosRecurrentes = verificarGastosRecurrentes;
