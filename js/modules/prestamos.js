// ===== PRÉSTAMOS (dinero que Roberto presta a terceros) =====
// No confundir con crédito a clientes (cxc.js) ni anticipos de comisión a
// vendedores (vendedores.js): esto es dinero que sale de una caja/cuenta
// hacia una persona (familiar, empleado, conocido) que luego va devolviendo
// en abonos. Sigue el mismo patrón canónico de caja que el resto del
// sistema: el dinero SIEMPRE se mueve vía _egresarCuenta/_ingresarCuenta,
// nunca por escritura directa a movimientosCaja.

function _prestEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function _prestamoSaldoPendiente(p) {
    return Math.max(0, Number(p.saldoPendiente ?? p.monto) || 0);
}

function _prestamoFechaCorta(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Mexico_City' });
}

function renderGestionPrestamos() {
    const cont = document.getElementById('contenidoPrestamos');
    if (!cont) return;
    const prestamos = StorageService.get('prestamosOtorgados', []);

    const activos = prestamos.filter(p => p.estado !== 'Incobrable');
    const saldoTotalPendiente = activos.reduce((s, p) => s + _prestamoSaldoPendiente(p), 0);
    const numActivos = activos.filter(p => _prestamoSaldoPendiente(p) > 0).length;
    const totalPrestadoHistorico = prestamos.reduce((s, p) => s + (Number(p.monto) || 0), 0);

    const filtroEstado = document.getElementById('prestamoFiltroEstado')?.value || 'con_saldo';
    const filtroTexto = (document.getElementById('prestamoFiltroTexto')?.value || '').trim().toLowerCase();

    let lista = prestamos.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    if (filtroEstado === 'con_saldo') lista = lista.filter(p => _prestamoSaldoPendiente(p) > 0 && p.estado !== 'Incobrable');
    else if (filtroEstado === 'liquidado') lista = lista.filter(p => _prestamoSaldoPendiente(p) <= 0 && p.estado !== 'Incobrable');
    else if (filtroEstado === 'incobrable') lista = lista.filter(p => p.estado === 'Incobrable');
    // 'todos' no filtra

    if (filtroTexto) {
        lista = lista.filter(p => (p.deudor || '').toLowerCase().includes(filtroTexto) || (p.nota || '').toLowerCase().includes(filtroTexto));
    }

    const rows = lista.map(p => {
        const saldo = _prestamoSaldoPendiente(p);
        const numAbonos = Array.isArray(p.abonos) ? p.abonos.length : 0;
        let estadoLabel, estadoColor;
        if (p.estado === 'Incobrable') { estadoLabel = '⛔ Incobrable'; estadoColor = '#6b7280'; }
        else if (saldo <= 0) { estadoLabel = '✅ Liquidado'; estadoColor = '#16a34a'; }
        else { estadoLabel = '🕓 Activo'; estadoColor = '#d97706'; }

        return `<tr>
          <td style="padding:8px;">
            <strong>${_prestEsc(p.deudor)}</strong>
            ${p.telefono ? `<br><span style="font-size:11px;color:#9ca3af;">${_prestEsc(p.telefono)}</span>` : ''}
          </td>
          <td style="padding:8px;text-align:right;">${dinero(p.monto)}</td>
          <td style="padding:8px;text-align:right;font-weight:bold;color:${saldo > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldo)}</td>
          <td style="padding:8px;">${_prestamoFechaCorta(p.fecha)}${p.fechaCompromiso ? `<br><span style="font-size:11px;color:#9ca3af;">Compromiso: ${_prestamoFechaCorta(p.fechaCompromiso)}</span>` : ''}</td>
          <td style="padding:8px;color:#6b7280;">${p.origen === 'historico' ? '<span style="background:#f3f4f6;color:#6b7280;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:bold;">🕘 Histórico</span>' : _prestEsc(p.cuentaEtiqueta || '-')}</td>
          <td style="padding:8px;text-align:center;font-size:12px;color:#6b7280;">${numAbonos > 0 ? `${numAbonos} abono(s)` : 'Sin abonos'}</td>
          <td style="padding:8px;text-align:center;"><span style="color:${estadoColor};font-weight:bold;">${estadoLabel}</span></td>
          <td style="padding:8px;text-align:center;">
            <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap;">
              ${saldo > 0 && p.estado !== 'Incobrable' ? `<button onclick="abrirModalAbonoPrestamo(${p.id})" style="padding:4px 10px;background:#16a34a;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">💵 Abono</button>` : ''}
              <button onclick="abrirModalHistorialPrestamo(${p.id})" style="padding:4px 8px;background:none;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:12px;" title="Ver historial">📋</button>
              <button onclick="abrirModalEditarMontoPrestamo(${p.id})" style="padding:4px 8px;background:none;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;font-size:12px;" title="Corregir monto">✏️</button>
              ${saldo > 0 && p.estado !== 'Incobrable' ? `<button onclick="marcarIncobrablePrestamo(${p.id})" style="padding:4px 8px;background:none;border:1px solid #fca5a5;color:#dc2626;border-radius:4px;cursor:pointer;font-size:12px;" title="Marcar como incobrable">⛔</button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px;">
        <div style="background:#fef2f2;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#991b1b;">SALDO PENDIENTE POR COBRAR</small><br>
          <strong style="font-size:26px;color:#991b1b;">${dinero(saldoTotalPendiente)}</strong>
        </div>
        <div style="background:#eff6ff;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#1e40af;">PRÉSTAMOS ACTIVOS</small><br>
          <strong style="font-size:26px;color:#1e40af;">${numActivos}</strong>
        </div>
        <div style="background:#f0fdf4;padding:20px;border-radius:10px;text-align:center;">
          <small style="color:#16a34a;">TOTAL PRESTADO (HISTÓRICO)</small><br>
          <strong style="font-size:26px;color:#16a34a;">${dinero(totalPrestadoHistorico)}</strong>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:16px;">
        <h3 style="margin:0;color:#0f172a;">💸 Préstamos Otorgados</h3>
        <button onclick="abrirModalNuevoPrestamo()" style="padding:10px 18px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Nuevo Préstamo</button>
      </div>
      <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:16px;">
          <div>
            <label style="font-size:11px;font-weight:bold;color:#374151;">ESTADO</label><br>
            <select id="prestamoFiltroEstado" onchange="renderGestionPrestamos()" style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
              <option value="con_saldo" ${filtroEstado === 'con_saldo' ? 'selected' : ''}>Con saldo pendiente</option>
              <option value="liquidado" ${filtroEstado === 'liquidado' ? 'selected' : ''}>Liquidados</option>
              <option value="incobrable" ${filtroEstado === 'incobrable' ? 'selected' : ''}>Incobrables</option>
              <option value="todos" ${filtroEstado === 'todos' ? 'selected' : ''}>Todos</option>
            </select>
          </div>
          <div>
            <label style="font-size:11px;font-weight:bold;color:#374151;">BUSCAR</label><br>
            <input type="search" id="prestamoFiltroTexto" value="${_prestEsc(filtroTexto)}" oninput="renderGestionPrestamos()" placeholder="Nombre o nota..." style="padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;min-width:200px;">
          </div>
        </div>
        ${lista.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:24px;">No hay préstamos con este filtro.</p>' : `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="padding:8px;text-align:left;">A quién</th>
              <th style="padding:8px;text-align:right;">Prestado</th>
              <th style="padding:8px;text-align:right;">Saldo</th>
              <th style="padding:8px;text-align:left;">Fecha</th>
              <th style="padding:8px;text-align:left;">Cuenta origen</th>
              <th style="padding:8px;text-align:center;">Abonos</th>
              <th style="padding:8px;text-align:center;">Estado</th>
              <th style="padding:8px;text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`}
      </div>`;
}

function abrirModalNuevoPrestamo() {
    const html = `
    <div data-modal="nuevo-prestamo" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:480px;padding:28px;max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 20px;color:#dc2626;">💸 Nuevo Préstamo</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">¿A QUIÉN LE PRESTAS?</label>
            <input type="text" id="prestamoDeudor" placeholder="Nombre completo" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">TELÉFONO (opcional)</label>
            <input type="text" id="prestamoTelefono" placeholder="10 dígitos" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">MONTO ($)</label>
            <input type="number" id="prestamoMonto" min="0.01" step="0.01" placeholder="0.00" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA</label>
            <input type="date" id="prestamoFecha" value="${window.obtenerHoyInputMX()}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA COMPROMISO DE PAGO (opcional)</label>
            <input type="date" id="prestamoFechaCompromiso" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;background:#f9fafb;padding:10px;border-radius:6px;">
            <input type="checkbox" id="prestamoEsHistorico" onchange="togglePrestamoHistorico()" style="width:18px;height:18px;">
            <span style="font-size:13px;">Es un préstamo <strong>que ya di antes</strong> (el dinero ya salió, solo quiero registrarlo — no mover caja)</span>
          </label>
          <div id="divCuentaPrestamo">
            <label style="font-size:12px;font-weight:bold;color:#374151;">¿DE QUÉ CAJA/CUENTA SALE?</label>
            ${window._buildSelectorCuentas('prestamoCuenta', false)}
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">NOTA (opcional)</label>
            <input type="text" id="prestamoNota" placeholder="Motivo del préstamo" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;box-sizing:border-box;">
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarPrestamo()" id="btnGuardarPrestamo" style="flex:1;padding:12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Registrar Préstamo</button>
          <button onclick="document.querySelector('[data-modal=&quot;nuevo-prestamo&quot;]').remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function togglePrestamoHistorico() {
    const esHistorico = document.getElementById('prestamoEsHistorico')?.checked;
    const divCuenta = document.getElementById('divCuentaPrestamo');
    const btn = document.getElementById('btnGuardarPrestamo');
    if (divCuenta) divCuenta.style.display = esHistorico ? 'none' : 'block';
    if (btn) btn.textContent = esHistorico ? '✅ Registrar (sin mover caja)' : '✅ Registrar Préstamo';
}

function guardarPrestamo() {
    const deudor = document.getElementById('prestamoDeudor')?.value.trim();
    const telefono = document.getElementById('prestamoTelefono')?.value.trim();
    const monto = Number(document.getElementById('prestamoMonto')?.value);
    const fecha = document.getElementById('prestamoFecha')?.value || window.obtenerHoyInputMX();
    const fechaCompromiso = document.getElementById('prestamoFechaCompromiso')?.value || '';
    const nota = document.getElementById('prestamoNota')?.value.trim() || '';
    const esHistorico = document.getElementById('prestamoEsHistorico')?.checked || false;

    if (!deudor) return alert('⚠️ Indica a quién le prestas el dinero.');
    if (!Number.isFinite(monto) || monto <= 0) return alert('⚠️ Ingresa un monto válido.');

    const id = Date.now();
    let cuentaId = '', etiqueta = '';

    if (esHistorico) {
        // Préstamo anterior: el dinero ya salió antes de que existiera este
        // módulo. Se registra solo para llevar control, SIN generar un
        // egreso de caja hoy (eso duplicaría el hueco que ya tienes).
        if (!confirm(`⚠️ REGISTRAR PRÉSTAMO HISTÓRICO\n\nA quién: ${deudor}\nMonto: ${dinero(monto)}\nEste préstamo NO generará ningún movimiento de caja — solo queda registrado para llevar el control.\n\n¿Confirmar?`)) return;
        etiqueta = 'Histórico (sin movimiento de caja)';
    } else {
        const sel = document.getElementById('prestamoCuenta');
        if (!sel) return alert('No se pudo leer la cuenta seleccionada.');
        cuentaId = sel.value;
        etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;

        if (!confirm(`⚠️ RESUMEN DEL PRÉSTAMO\n\nA quién: ${deudor}\nMonto: ${dinero(monto)}\nSale de: ${etiqueta}\n\n¿Confirmar y registrar el egreso?`)) return;

        if (typeof window._egresarCuenta !== 'function') {
            alert('No se pudo registrar el préstamo: el módulo de caja no está disponible. Nada se aplicó.');
            return;
        }
        const egresoOk = window._egresarCuenta({
            monto, cuentaId, etiqueta,
            concepto: `Préstamo otorgado - ${deudor}${nota ? ' (' + nota + ')' : ''}`,
            referencia: `PRESTAMO-${id}`,
            idOperacion: `prestamo-${id}`
        });
        if (!egresoOk) {
            alert(`No se pudo registrar el egreso de caja para "${etiqueta || cuentaId}". El préstamo NO se guardó.`);
            return;
        }
    }

    const prestamos = StorageService.get('prestamosOtorgados', []);
    prestamos.push({
        id, deudor, telefono,
        monto, saldoPendiente: monto,
        fecha: window.localISO ? window.localISO(new Date(fecha + 'T12:00:00')) : new Date(fecha).toISOString(),
        fechaCompromiso,
        cuentaId, cuentaEtiqueta: etiqueta,
        origen: esHistorico ? 'historico' : 'nuevo',
        nota,
        estado: 'Activo',
        abonos: []
    });
    StorageService.set('prestamosOtorgados', prestamos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: esHistorico ? 'PRESTAMO_HISTORICO_REGISTRADO' : 'PRESTAMO_OTORGADO',
            modulo: 'Prestamos',
            entidad: 'prestamosOtorgados',
            entidadId: id,
            detalle: `${esHistorico ? 'Préstamo histórico registrado (sin egreso)' : 'Préstamo otorgado'} - ${deudor}`,
            monto,
            severidad: 'riesgo',
            datos: { deudor, cuentaId, etiqueta, nota, esHistorico }
        });
    }

    document.querySelector('[data-modal="nuevo-prestamo"]')?.remove();
    alert(esHistorico
        ? `✅ Préstamo histórico de ${dinero(monto)} registrado para ${deudor}.\n\nNo se movió caja: solo queda en control.`
        : `✅ Préstamo de ${dinero(monto)} registrado para ${deudor}, pagado desde ${etiqueta}.`);
    renderGestionPrestamos();
}

function abrirModalAbonoPrestamo(prestamoId) {
    const p = StorageService.get('prestamosOtorgados', []).find(x => x.id === prestamoId);
    if (!p) return alert('Préstamo no encontrado.');
    const saldo = _prestamoSaldoPendiente(p);
    if (saldo <= 0) return alert('Este préstamo ya está liquidado.');

    const modalHTML = `
    <div data-modal="abono-prestamo" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:30px;border-radius:12px;width:100%;max-width:420px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#0f172a;">💵 Registrar abono</h2>
            <p style="color:#4b5563;margin-bottom:16px;">Deudor: <strong>${_prestEsc(p.deudor)}</strong><br>Saldo pendiente: <strong style="color:#dc2626;">${dinero(saldo)}</strong></p>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO DEL ABONO</label>
                <input type="number" id="abonoPrestamoMonto" min="0.01" max="${saldo}" step="0.01" value="${saldo}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="margin-bottom:14px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">¿A QUÉ CAJA/CUENTA ENTRA?</label>
                ${window._buildSelectorCuentas('abonoPrestamoCuenta', false)}
            </div>
            <div style="margin-bottom:20px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">NOTA (opcional)</label>
                <input type="text" id="abonoPrestamoNota" placeholder="Ej. abono parcial en efectivo" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="registrarAbonoPrestamo(${p.id})" style="flex:1;padding:12px;background:#16a34a;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✅ Registrar Abono</button>
                <button onclick="document.querySelector('[data-modal=&quot;abono-prestamo&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function registrarAbonoPrestamo(prestamoId) {
    const prestamos = StorageService.get('prestamosOtorgados', []);
    const idx = prestamos.findIndex(x => x.id === prestamoId);
    if (idx === -1) return alert('Préstamo no encontrado.');
    const p = prestamos[idx];
    const saldo = _prestamoSaldoPendiente(p);

    const montoInput = document.getElementById('abonoPrestamoMonto');
    const monto = Number(montoInput?.value);
    if (!Number.isFinite(monto) || monto <= 0 || monto > saldo + 0.01) {
        alert(`Ingresa un monto válido (máximo ${dinero(saldo)}).`);
        return;
    }
    const sel = document.getElementById('abonoPrestamoCuenta');
    if (!sel) { alert('No se pudo leer la cuenta seleccionada.'); return; }
    const cuentaId = sel.value;
    const etiqueta = sel.options[sel.selectedIndex]?.text || cuentaId;
    const nota = document.getElementById('abonoPrestamoNota')?.value.trim() || '';

    if (typeof window._ingresarCuenta !== 'function') {
        alert('No se pudo registrar el abono: el módulo de caja no está disponible. Nada se aplicó.');
        return;
    }
    const idAbono = Date.now();
    const ingresoOk = window._ingresarCuenta({
        monto, cuentaId, etiqueta,
        concepto: `Abono de préstamo - ${p.deudor}${nota ? ' (' + nota + ')' : ''}`,
        referencia: `ABONO-PRESTAMO-${p.id}-${idAbono}`,
        idOperacion: `abono-prestamo-${p.id}-${idAbono}`
    });
    if (!ingresoOk) {
        alert(`No se pudo registrar el ingreso de caja para "${etiqueta || cuentaId}". El abono NO se aplicó.`);
        return;
    }

    const nuevoSaldo = Math.max(0, saldo - monto);
    const abonos = Array.isArray(p.abonos) ? p.abonos.slice() : [];
    abonos.push({
        id: idAbono, monto, cuentaId, cuentaEtiqueta: etiqueta, nota,
        fecha: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
    });
    prestamos[idx] = {
        ...p,
        saldoPendiente: nuevoSaldo,
        abonos,
        estado: nuevoSaldo <= 0.01 ? 'Liquidado' : 'Activo'
    };
    StorageService.set('prestamosOtorgados', prestamos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'ABONO_PRESTAMO_REGISTRADO',
            modulo: 'Prestamos',
            entidad: 'prestamosOtorgados',
            entidadId: p.id,
            detalle: `Abono de préstamo - ${p.deudor}`,
            monto,
            severidad: 'info',
            datos: { cuentaId, etiqueta, nota, saldoRestante: nuevoSaldo }
        });
    }

    document.querySelector('[data-modal="abono-prestamo"]')?.remove();
    renderGestionPrestamos();
}

function abrirModalHistorialPrestamo(prestamoId) {
    const p = StorageService.get('prestamosOtorgados', []).find(x => x.id === prestamoId);
    if (!p) return alert('Préstamo no encontrado.');
    const abonos = (Array.isArray(p.abonos) ? p.abonos : []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const saldo = _prestamoSaldoPendiente(p);

    const filas = abonos.map(a => `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${_prestamoFechaCorta(a.fecha)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;text-align:right;">${dinero(a.monto)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;">${_prestEsc(a.cuentaEtiqueta || '-')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;color:#6b7280;">${_prestEsc(a.nota || '-')}</td>
    </tr>`).join('');

    const modalHTML = `
    <div data-modal="historial-prestamo" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:28px;border-radius:12px;width:100%;max-width:560px;max-height:85vh;overflow-y:auto;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#0f172a;">📋 Historial del préstamo</h2>
            <p style="color:#4b5563;margin-bottom:6px;">Deudor: <strong>${_prestEsc(p.deudor)}</strong>${p.telefono ? ` · ${_prestEsc(p.telefono)}` : ''}</p>
            <p style="color:#4b5563;margin-bottom:16px;font-size:13px;">
              Prestado: <strong>${dinero(p.monto)}</strong> el ${_prestamoFechaCorta(p.fecha)}
              ${p.fechaCompromiso ? ` · Compromiso: ${_prestamoFechaCorta(p.fechaCompromiso)}` : ''}
              ${p.nota ? `<br>Nota: ${_prestEsc(p.nota)}` : ''}
              <br>Saldo pendiente: <strong style="color:${saldo > 0 ? '#dc2626' : '#16a34a'};">${dinero(saldo)}</strong>
            </p>
            <div style="overflow-x:auto;border:1px solid #e5e7eb;border-radius:8px;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead><tr style="background:#f3f4f6;">
                  <th style="padding:7px 10px;text-align:left;">Fecha</th>
                  <th style="padding:7px 10px;text-align:right;">Abono</th>
                  <th style="padding:7px 10px;text-align:left;">Cuenta</th>
                  <th style="padding:7px 10px;text-align:left;">Nota</th>
                </tr></thead>
                <tbody>${filas || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;">Sin abonos registrados aún.</td></tr>'}</tbody>
              </table>
            </div>
            <div style="margin-top:20px;text-align:right;">
                <button onclick="document.querySelector('[data-modal=&quot;historial-prestamo&quot;]').remove()" style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cerrar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// Corrige el monto original de un préstamo (p. ej. se capturó mal el
// monto entregado). Si el préstamo es histórico (nunca movió caja), solo
// ajusta el registro. Si es un préstamo generado en el sistema (sí generó
// un egreso real), también ajusta ese movimiento de caja y el saldo de la
// cuenta por la diferencia.
function abrirModalEditarMontoPrestamo(prestamoId) {
    const p = StorageService.get('prestamosOtorgados', []).find(x => x.id === prestamoId);
    if (!p) return alert('Préstamo no encontrado.');
    const totalAbonado = (Array.isArray(p.abonos) ? p.abonos : []).reduce((s, a) => s + (Number(a.monto) || 0), 0);

    const modalHTML = `
    <div data-modal="editar-prestamo" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:8000;display:flex;justify-content:center;align-items:center;padding:16px;">
        <div style="background:white;padding:30px;border-radius:12px;width:100%;max-width:400px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <h2 style="margin-top:0;color:#0f172a;">✏️ Corregir monto de préstamo</h2>
            <p style="color:#4b5563;margin-bottom:16px;">Deudor: <strong>${_prestEsc(p.deudor)}</strong><br>Monto actual: <strong>${dinero(p.monto)}</strong>${totalAbonado > 0 ? `<br><span style="font-size:12px;color:#6b7280;">Ya abonado: ${dinero(totalAbonado)}</span>` : ''}</p>
            <div style="margin-bottom:16px;">
                <label style="font-weight:bold;font-size:13px;color:#374151;display:block;margin-bottom:5px;">MONTO CORRECTO</label>
                <input type="number" id="editarPrestamoMonto" min="0.01" step="0.01" value="${p.monto}" style="width:100%;padding:10px;border:1px solid #d1d5db;border-radius:6px;box-sizing:border-box;">
                <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;">${p.origen === 'historico' ? 'Es un préstamo histórico: esto solo corrige el registro, no mueve caja (nunca se generó un egreso).' : 'Esto también ajustará el movimiento de caja y el saldo de la cuenta por la diferencia.'}</p>
            </div>
            <div style="display:flex;gap:10px;">
                <button onclick="guardarEdicionMontoPrestamo(${p.id})" style="flex:1;padding:12px;background:#1e40af;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar</button>
                <button onclick="document.querySelector('[data-modal=&quot;editar-prestamo&quot;]').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#4b5563;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">✕ Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function guardarEdicionMontoPrestamo(prestamoId) {
    const prestamos = StorageService.get('prestamosOtorgados', []);
    const idx = prestamos.findIndex(x => x.id === prestamoId);
    if (idx === -1) return alert('Préstamo no encontrado.');
    const p = prestamos[idx];

    const montoInput = document.getElementById('editarPrestamoMonto');
    const nuevoMonto = Number(montoInput?.value);
    if (!Number.isFinite(nuevoMonto) || nuevoMonto <= 0) {
        alert('Ingresa un monto válido.');
        return;
    }

    const totalAbonado = (Array.isArray(p.abonos) ? p.abonos : []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
    if (nuevoMonto < totalAbonado) {
        if (!confirm(`Ya se abonaron ${dinero(totalAbonado)} a este préstamo, más que el nuevo monto (${dinero(nuevoMonto)}). El saldo pendiente quedará en $0. ¿Continuar?`)) return;
    }
    const nuevoSaldo = Math.max(0, nuevoMonto - totalAbonado);
    const montoAnterior = p.monto;

    // 🛡️ Solo los préstamos "nuevos" (origen !== 'historico') generaron un
    // egreso real en _egresarCuenta al crearse. Los históricos se registraron
    // a propósito SIN mover caja, así que para esos la corrección de monto
    // debe seguir siendo solo de registro. Para los nuevos, si no reflejamos
    // la diferencia en movimientosCaja y en el saldo de la cuenta, el flujo
    // de dinero se desincroniza del registro del préstamo.
    if (p.origen !== 'historico' && typeof _resolverCuentaMovimiento === 'function') {
        const delta = nuevoMonto - montoAnterior; // aumento del préstamo = más egreso
        const movs = StorageService.get('movimientosCaja', []);
        let idxMov = -1;
        for (let i = movs.length - 1; i >= 0; i--) {
            if (movs[i].referencia === `PRESTAMO-${p.id}` && movs[i].tipo === 'egreso') { idxMov = i; break; }
        }
        if (idxMov === -1) {
            alert('⚠️ No se encontró el movimiento de caja original de este préstamo. Se corrigió solo el registro del préstamo — revisa manualmente el flujo de dinero.');
        } else {
            const c = _resolverCuentaMovimiento(p.cuentaId);
            if (!c.ok) {
                alert(`⚠️ La cuenta original "${p.cuentaEtiqueta || p.cuentaId}" ya no existe. Se corrigió solo el registro del préstamo — el saldo de caja NO se ajustó.`);
            } else {
                const coleccion = c.tipo === 'efectivo' ? 'cuentasEfectivo' : 'cuentas-bancarias';
                const lista = StorageService.get(coleccion, []);
                const idxCta = lista.findIndex(x => String(x.id) === String(c.cuentaRealId) || String(x.banco) === String(c.cuentaRealId));
                if (idxCta === -1) {
                    alert(`⚠️ No se encontró la cuenta "${p.cuentaEtiqueta || p.cuentaId}" en el storage. Se corrigió solo el registro del préstamo — el saldo de caja NO se ajustó.`);
                } else {
                    lista[idxCta].saldo = (Number(lista[idxCta].saldo) || 0) - delta;
                    StorageService.set(coleccion, lista);

                    const movsFrescos = StorageService.get('movimientosCaja', []);
                    movsFrescos[idxMov] = {
                        ...movsFrescos[idxMov],
                        monto: nuevoMonto,
                        corregido: true,
                        ultimaCorreccionIso: window.localISO ? window.localISO(new Date()) : new Date().toISOString()
                    };
                    StorageService.set('movimientosCaja', movsFrescos);
                }
            }
        }
    }

    prestamos[idx] = {
        ...p,
        monto: nuevoMonto,
        saldoPendiente: nuevoSaldo,
        estado: p.estado === 'Incobrable' ? 'Incobrable' : (nuevoSaldo <= 0.01 ? 'Liquidado' : 'Activo'),
        montoOriginalHistorico: p.montoOriginalHistorico ?? montoAnterior
    };
    StorageService.set('prestamosOtorgados', prestamos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'PRESTAMO_MONTO_CORREGIDO',
            modulo: 'Prestamos',
            entidad: 'prestamosOtorgados',
            entidadId: p.id,
            detalle: `Corrección de monto de préstamo - ${p.deudor}: ${dinero(montoAnterior)} -> ${dinero(nuevoMonto)}`,
            monto: nuevoMonto,
            severidad: 'riesgo',
            datos: { montoAnterior, montoNuevo: nuevoMonto, saldoPendiente: nuevoSaldo }
        });
    }

    document.querySelector('[data-modal="editar-prestamo"]')?.remove();
    renderGestionPrestamos();
}

// Marca un préstamo como incobrable (no se espera recuperar el saldo). No
// mueve caja — es solo una etiqueta contable para dejar de contarlo en el
// saldo pendiente "activo" y sacarlo de la lista de cobro.
function marcarIncobrablePrestamo(prestamoId) {
    const prestamos = StorageService.get('prestamosOtorgados', []);
    const idx = prestamos.findIndex(x => x.id === prestamoId);
    if (idx === -1) return alert('Préstamo no encontrado.');
    const p = prestamos[idx];
    const saldo = _prestamoSaldoPendiente(p);
    if (!confirm(`¿Marcar como incobrable el préstamo de ${dinero(saldo)} a ${p.deudor}?\n\nEsto NO borra el registro, solo lo saca del saldo pendiente por cobrar.`)) return;

    prestamos[idx] = { ...p, estado: 'Incobrable' };
    StorageService.set('prestamosOtorgados', prestamos);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'PRESTAMO_MARCADO_INCOBRABLE',
            modulo: 'Prestamos',
            entidad: 'prestamosOtorgados',
            entidadId: p.id,
            detalle: `Préstamo marcado incobrable - ${p.deudor}`,
            monto: saldo,
            severidad: 'riesgo',
            datos: { saldoAlMomento: saldo }
        });
    }

    renderGestionPrestamos();
}

window.renderGestionPrestamos = renderGestionPrestamos;
window.abrirModalNuevoPrestamo = abrirModalNuevoPrestamo;
window.guardarPrestamo = guardarPrestamo;
window.abrirModalAbonoPrestamo = abrirModalAbonoPrestamo;
window.registrarAbonoPrestamo = registrarAbonoPrestamo;
window.abrirModalHistorialPrestamo = abrirModalHistorialPrestamo;
window.abrirModalEditarMontoPrestamo = abrirModalEditarMontoPrestamo;
window.guardarEdicionMontoPrestamo = guardarEdicionMontoPrestamo;
window.marcarIncobrablePrestamo = marcarIncobrablePrestamo;
