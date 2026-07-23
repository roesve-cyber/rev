// ================================================================
// 🏦 MÓDULO: ESTADO DE CUENTA BANCARIO (Mis Cuentas)
// Genera un estado de cuenta al estilo bancario para una cuenta
// (caja o banco débito) en un rango de fechas elegido:
//   - Todo lo anterior al rango se suma/resta para un "Saldo Inicial"
//   - Dentro del rango: entradas y salidas con saldo corriendo
//   - Al final: Saldo Actual (del periodo)
// Reutiliza TicketService (PDF paginado con encabezado repetido y
// numeración de página, e imagen) — mismo motor que el resto del sistema.
// ================================================================

function _escECB(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _dineroECB(v) {
    return (typeof window.dinero === 'function' ? window.dinero(v) : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0));
}

function _fechaCortaECB(fecha) {
    if (!fecha) return '-';
    if (typeof window.formatearFechaCortaMX === 'function') return window.formatearFechaCortaMX(fecha);
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? String(fecha) : d.toLocaleDateString('es-MX');
}

function _fechaObjECB(fecha) {
    if (typeof window.parseFechaMX === 'function') return window.parseFechaMX(fecha);
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

// 📋 Lista unificada de cuentas disponibles (cajas de efectivo + bancos débito)
function _obtenerCuentasLiquidezECB() {
    const cajas = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo Principal', saldo: 0 }]);
    const tarjetas = StorageService.get('tarjetasConfig', []);
    const debito = tarjetas.filter(t => t.tipo === 'debito');

    const lista = cajas.map(c => ({
        clave: c.id,
        nombre: c.nombre || '💵 Efectivo',
        tipo: 'caja',
        base: 0
    }));

    debito.forEach(t => {
        lista.push({
            clave: t.banco,
            nombre: `🏦 ${t.banco} Débito`,
            tipo: 'debito',
            base: parseFloat(t.saldoInicial) || 0
        });
    });

    return lista;
}

// 🔑 Normaliza a qué cuenta pertenece un movimiento (misma regla que _bancosCalcularSaldosDesdeMovimientos)
function _claveMovimientoECB(m, cajaDefaultId) {
    const cuentaRaw = m.cuenta || m.cuentaId || m.metodoPago || m.medioPago || 'efectivo';
    return (cuentaRaw === 'efectivo' || cuentaRaw === 'caja') ? cajaDefaultId : cuentaRaw;
}

// 🎯 FUNCIÓN PRINCIPAL: arma el estado de cuenta de una cuenta en un rango
window.obtenerEstadoCuentaBancaria = function(claveCuenta, fechaDesde, fechaHasta) {
    const cajas = StorageService.get('cuentasEfectivo', [{ id: 'efectivo', nombre: '💵 Efectivo Principal', saldo: 0 }]);
    const cajaDefaultId = cajas[0]?.id || 'efectivo';
    const movimientos = StorageService.get('movimientosCaja', []);
    const cuentas = _obtenerCuentasLiquidezECB();
    const cuentaInfo = cuentas.find(c => String(c.clave) === String(claveCuenta)) || { clave: claveCuenta, nombre: String(claveCuenta), tipo: 'caja', base: 0 };

    const inicioRango = fechaDesde ? new Date(`${fechaDesde}T00:00:00`) : null;
    const finRango = fechaHasta ? new Date(`${fechaHasta}T23:59:59`) : null;

    // Filtra movimientos de ESTA cuenta y los ordena cronológicamente (más antiguo primero)
    const movsCuenta = movimientos
        .filter(m => String(_claveMovimientoECB(m, cajaDefaultId)) === String(cuentaInfo.clave))
        .map(m => ({ ...m, _fechaObj: _fechaObjECB(m.fecha) }))
        .sort((a, b) => a._fechaObj - b._fechaObj);

    let saldoInicialPeriodo = cuentaInfo.base;
    const detalle = [];
    let totalCargos = 0;
    let totalAbonos = 0;

    movsCuenta.forEach(m => {
        const esIngreso = String(m.tipo || '').toLowerCase() === 'ingreso';
        const monto = Math.abs(parseFloat(m.monto) || 0);
        const signo = esIngreso ? monto : -monto;

        if (inicioRango && m._fechaObj < inicioRango) {
            // Anterior al rango: se acumula en el saldo inicial
            saldoInicialPeriodo += signo;
            return;
        }
        if (finRango && m._fechaObj > finRango) {
            // Posterior al rango elegido: no forma parte de este estado de cuenta
            return;
        }

        if (esIngreso) totalAbonos += monto; else totalCargos += monto;

        detalle.push({
            fecha: m.fecha,
            fechaCorta: _fechaCortaECB(m.fecha),
            concepto: m.concepto || (esIngreso ? 'Ingreso' : 'Egreso'),
            referencia: m.referencia || m.referenciaBancaria || '',
            esIngreso,
            monto
        });
    });

    // Saldo corriendo dentro del periodo
    let acumulado = saldoInicialPeriodo;
    detalle.forEach(d => {
        acumulado += d.esIngreso ? d.monto : -d.monto;
        d.saldo = acumulado;
    });

    return {
        cuenta: cuentaInfo,
        fechaDesde,
        fechaHasta,
        saldoInicial: saldoInicialPeriodo,
        movimientos: detalle,
        totalCargos,
        totalAbonos,
        saldoFinal: acumulado
    };
};

// 🖼️ Modal para elegir cuenta + rango de fechas
window.abrirEstadoCuentaBancaria = function() {
    document.getElementById('modalEstadoCuentaBancaria')?.remove();

    const cuentas = _obtenerCuentasLiquidezECB();
    const claveActual = (window._filtroCuentaLiquidez && window._filtroCuentaLiquidez !== 'Todos')
        ? window._filtroCuentaLiquidez
        : (cuentas[0]?.clave || '');

    const hoy = (typeof window.obtenerHoyInputMX === 'function') ? window.obtenerHoyInputMX() : new Date().toISOString().slice(0, 10);
    let desdeDefault = window._filtroLiquidezDesde || '';
    let hastaDefault = window._filtroLiquidezHasta || hoy;
    if (!desdeDefault) {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        desdeDefault = d.toISOString().slice(0, 10);
    }

    const opciones = cuentas.map(c => `<option value="${_escECB(c.clave)}" ${String(c.clave) === String(claveActual) ? 'selected' : ''}>${_escECB(c.nombre)}</option>`).join('');

    const html = `
    <div id="modalEstadoCuentaBancaria" style="position:fixed; inset:0; background:rgba(15,23,42,.6); z-index:120000; display:flex; align-items:center; justify-content:center; padding:16px;">
        <div style="width:100%; max-width:620px; max-height:90vh; overflow:auto; background:white; border-radius:12px; padding:26px; box-shadow:0 20px 50px rgba(15,23,42,.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:18px;">
                <h3 style="margin:0; color:#1e293b;">🧾 Estado de Cuenta Bancario</h3>
                <button onclick="document.getElementById('modalEstadoCuentaBancaria').remove()" style="background:none; border:none; font-size:20px; cursor:pointer; color:#64748b;">✕</button>
            </div>

            <label style="display:block; font-weight:bold; color:#334155; margin-bottom:6px; font-size:13px;">Cuenta</label>
            <select id="ecbCuenta" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; margin-bottom:16px; font-size:14px;">
                ${opciones}
            </select>

            <div style="display:flex; gap:14px; margin-bottom:6px; flex-wrap:wrap;">
                <div style="flex:1; min-width:150px;">
                    <label style="display:block; font-weight:bold; color:#334155; margin-bottom:6px; font-size:13px;">Desde</label>
                    <input type="date" id="ecbDesde" value="${desdeDefault}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px;">
                </div>
                <div style="flex:1; min-width:150px;">
                    <label style="display:block; font-weight:bold; color:#334155; margin-bottom:6px; font-size:13px;">Hasta</label>
                    <input type="date" id="ecbHasta" value="${hastaDefault}" style="width:100%; padding:10px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px;">
                </div>
            </div>

            <p style="font-size:12px; color:#64748b; margin:10px 0 18px 0;">
                Todo lo registrado antes de la fecha "Desde" se suma o resta para llegar a un <b>Saldo Inicial</b>. Dentro del rango se listan las entradas y salidas con saldo corriendo, hasta llegar al <b>Saldo Actual</b> del periodo.
            </p>

            <button onclick="window._ecbGenerar()" style="width:100%; padding:13px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; margin-bottom:18px;">
                📄 Generar Estado de Cuenta
            </button>

            <div id="ecbPreviewContenedor"></div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window._ecbGenerar = function() {
    const clave = document.getElementById('ecbCuenta')?.value;
    const desde = document.getElementById('ecbDesde')?.value;
    const hasta = document.getElementById('ecbHasta')?.value;

    if (!clave) return alert('⚠️ Selecciona una cuenta.');
    if (!desde || !hasta) return alert('⚠️ Elige el rango de fechas (Desde / Hasta).');
    if (desde > hasta) return alert('⚠️ La fecha "Desde" no puede ser posterior a "Hasta".');

    const estado = window.obtenerEstadoCuentaBancaria(clave, desde, hasta);
    window._estadoCuentaBancariaActual = estado;

    const cont = document.getElementById('ecbPreviewContenedor');
    if (!cont) return;

    const filasHTML = estado.movimientos.length === 0
        ? `<tr><td colspan="4" style="text-align:center; padding:20px; color:#94a3b8;">Sin movimientos en este rango.</td></tr>`
        : estado.movimientos.map(m => `
            <tr style="border-bottom:1px solid #f1f5f9;">
                <td style="padding:8px; white-space:nowrap; font-size:12px;">${m.fechaCorta}</td>
                <td style="padding:8px; font-size:12px;">${_escECB(m.concepto)}${m.referencia ? `<br><small style="color:#94a3b8;">Ref: ${_escECB(m.referencia)}</small>` : ''}</td>
                <td style="padding:8px; text-align:right; font-size:12px; color:${m.esIngreso ? '#16a34a' : '#dc2626'}; font-weight:bold;">${m.esIngreso ? _dineroECB(m.monto) : ''}</td>
                <td style="padding:8px; text-align:right; font-size:12px; color:${!m.esIngreso ? '#16a34a' : '#dc2626'}; font-weight:bold;">${!m.esIngreso ? _dineroECB(m.monto) : ''}</td>
            </tr>`).join('');

    cont.innerHTML = `
        <div style="border:1px solid #e2e8f0; border-radius:8px; padding:16px; background:#f8fafc;">
            <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px;">
                <div>
                    <div style="font-size:11px; color:#64748b; font-weight:bold; text-transform:uppercase;">Cuenta</div>
                    <div style="font-size:15px; font-weight:bold; color:#1e293b;">${_escECB(estado.cuenta.nombre)}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:11px; color:#64748b; font-weight:bold; text-transform:uppercase;">Periodo</div>
                    <div style="font-size:13px; color:#1e293b;">${_fechaCortaECB(estado.fechaDesde)} al ${_fechaCortaECB(estado.fechaHasta)}</div>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px,1fr)); gap:10px; margin-bottom:14px;">
                <div style="background:#eef2ff; border:1px solid #c7d2fe; border-radius:6px; padding:10px; text-align:center;">
                    <div style="font-size:10px; color:#4338ca; font-weight:bold;">SALDO INICIAL</div>
                    <div style="font-size:15px; font-weight:bold; color:#312e81;">${_dineroECB(estado.saldoInicial)}</div>
                </div>
                <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:6px; padding:10px; text-align:center;">
                    <div style="font-size:10px; color:#15803d; font-weight:bold;">TOTAL ENTRADAS</div>
                    <div style="font-size:15px; font-weight:bold; color:#166534;">${_dineroECB(estado.totalAbonos)}</div>
                </div>
                <div style="background:#fef2f2; border:1px solid #fca5a5; border-radius:6px; padding:10px; text-align:center;">
                    <div style="font-size:10px; color:#b91c1c; font-weight:bold;">TOTAL SALIDAS</div>
                    <div style="font-size:15px; font-weight:bold; color:#7f1d1d;">${_dineroECB(estado.totalCargos)}</div>
                </div>
                <div style="background:#eff6ff; border:1px solid #93c5fd; border-radius:6px; padding:10px; text-align:center;">
                    <div style="font-size:10px; color:#1d4ed8; font-weight:bold;">SALDO ACTUAL</div>
                    <div style="font-size:15px; font-weight:bold; color:#1e3a8a;">${_dineroECB(estado.saldoFinal)}</div>
                </div>
            </div>
            <div style="max-height:260px; overflow:auto; border:1px solid #e2e8f0; border-radius:6px;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead><tr style="background:#f1f5f9; position:sticky; top:0;">
                        <th style="padding:8px; text-align:left; font-size:11px; color:#475569;">Fecha</th>
                        <th style="padding:8px; text-align:left; font-size:11px; color:#475569;">Concepto</th>
                        <th style="padding:8px; text-align:right; font-size:11px; color:#475569;">Entradas</th>
                        <th style="padding:8px; text-align:right; font-size:11px; color:#475569;">Salidas</th>
                    </tr></thead>
                    <tbody>${filasHTML}</tbody>
                </table>
            </div>
            <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
                <button onclick="window.imprimirPdfEstadoCuentaBancaria()" style="flex:1; min-width:160px; padding:11px; background:#059669; color:white; border:none; border-radius:7px; font-weight:bold; cursor:pointer;">📄 Descargar PDF</button>
                <button id="btnImgECB" onclick="window.descargarImagenEstadoCuentaBancaria()" style="flex:1; min-width:160px; padding:11px; background:#d97706; color:white; border:none; border-radius:7px; font-weight:bold; cursor:pointer;">📷 Guardar Imagen</button>
            </div>
        </div>`;
};

// 🧾 Arma el documento imprimible (letter, con logo, márgenes, encabezado repetido y paginado)
function _construirHtmlDocEstadoCuentaBancaria(estado) {
    const filas = [];

    filas.push(`
        <tr style="background:#eef2ff;">
            <td colspan="3" style="padding:8px; font-weight:bold; color:#312e81;">SALDO INICIAL AL ${_fechaCortaECB(estado.fechaDesde)}</td>
            <td style="padding:8px; text-align:right; font-weight:bold; color:#312e81;">${_dineroECB(estado.saldoInicial)}</td>
        </tr>`);

    if (estado.movimientos.length === 0) {
        filas.push(`<tr><td colspan="4" style="padding:14px; text-align:center; color:#94a3b8;">Sin movimientos registrados en este rango.</td></tr>`);
    } else {
        estado.movimientos.forEach(m => {
            filas.push(`
            <tr>
                <td style="padding:7px 8px; white-space:nowrap;">${m.fechaCorta}</td>
                <td style="padding:7px 8px;">${_escECB(m.concepto)}${m.referencia ? ` <span style="color:#94a3b8;">(Ref: ${_escECB(m.referencia)})</span>` : ''}</td>
                <td style="padding:7px 8px; text-align:right; color:${m.esIngreso ? '#16a34a' : '#dc2626'}; font-weight:bold;">${m.esIngreso ? _dineroECB(m.monto) : '-'}</td>
                <td style="padding:7px 8px; text-align:right; font-weight:bold;">${_dineroECB(m.saldo)}</td>
            </tr>`);
        });
    }

    filas.push(`
        <tr style="background:#eff6ff;">
            <td colspan="3" style="padding:9px 8px; font-weight:bold; color:#1e3a8a; font-size:13px;">SALDO ACTUAL AL ${_fechaCortaECB(estado.fechaHasta)}</td>
            <td style="padding:9px 8px; text-align:right; font-weight:bold; color:#1e3a8a; font-size:13px;">${_dineroECB(estado.saldoFinal)}</td>
        </tr>`);

    return `
    <div data-pdf-header>
        <div style="display:flex; align-items:center; gap:14px; border-bottom:3px solid #1e40af; padding-bottom:14px; margin-bottom:14px;">
            <img src="img/Logo.svg" alt="Mi Pueblito" style="width:56px; height:56px; object-fit:contain;" onerror="this.style.display='none'">
            <div>
                <div style="font-size:18px; font-weight:bold; color:#1e293b;">MUEBLERÍA MI PUEBLITO</div>
                <div style="font-size:14px; color:#1e40af; font-weight:bold;">ESTADO DE CUENTA — ${_escECB(estado.cuenta.nombre)}</div>
            </div>
        </div>
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:12px; font-size:12px; color:#334155;">
            <div><b>Periodo:</b> ${_fechaCortaECB(estado.fechaDesde)} al ${_fechaCortaECB(estado.fechaHasta)}</div>
            <div><b>Fecha de emisión:</b> ${_fechaCortaECB(new Date())}</div>
        </div>
        <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px;">
            <colgroup><col style="width:14%"><col style="width:46%"><col style="width:18%"><col style="width:22%"></colgroup>
            <thead>
                <tr style="background:#1e40af; color:white;">
                    <th style="padding:8px; text-align:left;">Fecha</th>
                    <th style="padding:8px; text-align:left;">Concepto</th>
                    <th style="padding:8px; text-align:right;">Entrada</th>
                    <th style="padding:8px; text-align:right;">Saldo</th>
                </tr>
            </thead>
        </table>
    </div>
    <table style="width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px;">
        <colgroup><col style="width:14%"><col style="width:46%"><col style="width:18%"><col style="width:22%"></colgroup>
        <tbody>${filas.join('')}</tbody>
    </table>
    <p style="text-align:center; margin-top:26px; font-size:11px; color:#64748b;">
        Mueblería Mi Pueblito | Documento informativo de saldos — generado por el sistema
    </p>`;
}

window.imprimirPdfEstadoCuentaBancaria = function() {
    const estado = window._estadoCuentaBancariaActual;
    if (!estado) return alert('⚠️ Genera un estado de cuenta primero.');

    const htmlDoc = _construirHtmlDocEstadoCuentaBancaria(estado);
    const nombreArchivo = `estado_cuenta_${estado.cuenta.nombre}_${estado.fechaDesde}_${estado.fechaHasta}`;

    if (window.TicketService?.openDocument) {
        window.TicketService.openDocument(htmlDoc, {
            title: `Estado de Cuenta - ${estado.cuenta.nombre}`,
            filename: nombreArchivo,
            pageSize: 'letter',
            autoPrint: true
        });
    } else {
        alert('El motor de documentos (TicketService) no está disponible.');
    }
};

window.descargarImagenEstadoCuentaBancaria = function() {
    const estado = window._estadoCuentaBancariaActual;
    if (!estado) return alert('⚠️ Genera un estado de cuenta primero.');

    const btn = document.getElementById('btnImgECB');
    const txtOriginal = btn ? btn.innerHTML : null;
    if (btn) { btn.innerHTML = '⏳ Generando...'; btn.disabled = true; }

    const htmlDoc = _construirHtmlDocEstadoCuentaBancaria(estado);
    const nombreArchivo = `estado_cuenta_${estado.cuenta.nombre}_${estado.fechaDesde}_${estado.fechaHasta}`;

    const restaurar = () => { if (btn) { btn.innerHTML = txtOriginal; btn.disabled = false; } };

    if (window.TicketService?.descargarImagen) {
        Promise.resolve(window.TicketService.descargarImagen(htmlDoc, {
            title: `Estado de Cuenta - ${estado.cuenta.nombre}`,
            filename: nombreArchivo
        })).finally(restaurar);
    } else {
        alert('El motor de imágenes (TicketService) no está disponible.');
        restaurar();
    }
};

console.log('✅ Módulo Estado de Cuenta Bancaria cargado.');
