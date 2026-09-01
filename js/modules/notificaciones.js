// === GESTIÓN DE NOTIFICACIONES VISTAS ===
function getNotificacionesVistas() {
    try {
        return JSON.parse(localStorage.getItem('notificacionesVistas') || '[]');
    } catch { return []; }
}

function setNotificacionesVistas(arr) {
    localStorage.setItem('notificacionesVistas', JSON.stringify(arr));
}

function marcarNotificacionVista(id) {
    const vistas = getNotificacionesVistas();
    if (!vistas.includes(id)) {
        vistas.push(id);
        setNotificacionesVistas(vistas);
    }
    renderBadgeNotificaciones();
    
    // Recargar el panel instantáneamente para que la notificación desaparezca
    const panelActual = document.querySelector('[data-modal=panel-notif]');
    if (panelActual) {
        panelActual.remove();
        abrirPanelNotificaciones();
    }
}

// Nueva función: Marcar TODAS como leídas correctamente
function marcarTodasComoLeidas() {
    const notifs = recopilarNotificaciones();
    const vistas = getNotificacionesVistas();
    
    notifs.forEach(n => {
        if (!vistas.includes(n.id)) vistas.push(n.id);
    });
    
    setNotificacionesVistas(vistas);
    renderBadgeNotificaciones();
    document.querySelector('[data-modal=panel-notif]')?.remove();
}

// ===== NOTIFICACIONES =====
// 🛡️ Decisión de Roberto: la campanita solo debe mostrar herramientas que
// el vendedor tiene que tener MUY presentes -- se quitaron cobranza,
// stock e inventario, cxp (eran ruido para el día a día del vendedor). Solo
// quedan dos categorías:
//   1. Saltos de plazo pendientes de confirmar (saltosPlazoPendientes).
//   2. Cuentas a punto de perder su ventana para el cupón de pronto pago
//      (recordatorio proactivo, antes de que se les acabe el tiempo).
function recopilarNotificaciones() {
    const hoy = new Date();
    const vistas = getNotificacionesVistas();
    const notifs = [];

    // 1) Saltos de plazo pendientes de confirmar
    const saltosPendientes = StorageService.get('saltosPlazoPendientes', []).filter(s => s.estado === 'Pendiente');
    saltosPendientes.forEach(s => {
        const id = `salto_${s.id}`;
        if (vistas.includes(id)) return;
        notifs.push({
            tipo: 'salto',
            icono: '📆',
            color: '#dc2626',
            msg: `${s.clienteNombre}: pasó de ${s.mesesActual} a ${s.mesesNuevo} meses (folio ${s.folio}). Total actual ${dinero(s.totalActual)} → propuesto ${dinero(s.totalNuevo)}. Requiere tu confirmación.`,
            folio: s.folio,
            id
        });
    });

    // 2) Cuentas próximas a su fecha límite de plazo -- mismo momento exacto
    // dispara DOS consecuencias si el cliente no paga: pierde el cupón de
    // pronto pago Y la cuenta brinca al siguiente plazo (_cxcDetectarSaltoPlazo,
    // cxc.js). Se avisan juntas en una sola notificación (ventana de 7 días),
    // usando el mismo criterio "aún en plazo" que usa
    // _cxcEvaluarPoliticaPagoAnticipado/_cxcDetectarSaltoPlazo, para que este
    // aviso nunca contradiga lo que el sistema aplicará al cobrar.
    const cuentasCredito = StorageService.get('cuentasPorCobrar', []);
    const DIAS_AVISO_CUPON = 7;
    cuentasCredito.forEach(cuenta => {
        if (cuenta.estado === 'Cancelado' || cuenta.incobrable) return;
        const estadoCta = (typeof window._calcularEstadoCuenta === 'function') ? window._calcularEstadoCuenta(cuenta.folio) : null;
        const saldoActual = Number(estadoCta?.saldoTotal ?? cuenta.saldoActual ?? 0) - Number(estadoCta?.saldoMoratorios || 0);
        if (saldoActual <= 0.01) return; // ya liquidada

        const mesesPlan = Number(cuenta?.plan?.meses || cuenta?.plazoMeses || cuenta?.meses || 0);
        if (mesesPlan <= 0) return; // sin plan definido

        const fechaVenta = (typeof _cxcFechaVentaDate === 'function') ? _cxcFechaVentaDate(cuenta) : new Date(cuenta.fechaVenta);
        const diasDesdeVenta = Math.max(0, Math.floor((hoy - fechaVenta) / 86400000));
        const diasPlazo = mesesPlan * 30.44;
        const diasRestantes = Math.ceil(diasPlazo - diasDesdeVenta);

        if (diasRestantes > 0 && diasRestantes <= DIAS_AVISO_CUPON) {
            const id = `cupon_prox_${cuenta.folio}`;
            if (vistas.includes(id)) return;
            const nombre = (typeof _cxcNombreClienteVigente === 'function') ? _cxcNombreClienteVigente(cuenta) : (cuenta.nombreCliente || cuenta.cliente?.nombre || 'Cliente');
            // El salto de plazo tiene tope de 6 meses (_cxcDetectarSaltoPlazo)
            // -- si ya está en el plan de 6, no hay "siguiente" al que brincar,
            // así que ese aviso solo aplica por debajo del tope.
            const avisoSalto = mesesPlan < 6
                ? ` Si no liquida, su cuenta brincará de ${mesesPlan} a ${mesesPlan + 1} meses.`
                : '';
            notifs.push({
                tipo: 'cupon',
                icono: '🎟️',
                color: '#7e22ce',
                msg: `${nombre}: le quedan ${diasRestantes} dia(s) para liquidar y ganar su cupón (folio ${cuenta.folio}, saldo ${dinero(saldoActual)}).${avisoSalto}`,
                folio: cuenta.folio,
                id
            });
        }
    });

    return notifs;
}

function renderBadgeNotificaciones() {
    const badge = document.getElementById('badgeNotif');
    if (!badge) return;
    const notifs = recopilarNotificaciones();
    if (notifs.length === 0) {
        badge.textContent = '0';
        badge.style.setProperty('display', 'none', 'important');
        badge.setAttribute('aria-hidden', 'true');
    } else {
        badge.textContent = notifs.length > 99 ? '99+' : notifs.length;
        badge.style.setProperty('display', 'flex', 'important');
        badge.removeAttribute('aria-hidden');
    }
}

function abrirPanelNotificaciones() {
    const notifs = recopilarNotificaciones();
    const tipos = ['salto', 'cupon'];
    const titulos = { salto: '📆 Saltos de Plazo Pendientes', cupon: '🎟️ Plazo por vencer (cupón / salto de plazo)' };

    let contenido = '';
    
    if (notifs.length === 0) {
        contenido = '<div style="text-align:center; padding:40px 20px;"><p style="font-size:40px; margin:0;">🎉</p><p style="color:#64748b; font-weight:600;">Todo al día. No hay notificaciones.</p></div>';
    } else {
        tipos.forEach(t => {
            const grupo = notifs.filter(n => n.tipo === t);
            if (grupo.length === 0) return;
            
            contenido += `<div style="margin-bottom:20px;">
                <h4 style="margin:0 0 10px; color:#1e293b; font-size:13px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #e2e8f0; padding-bottom:5px;">${titulos[t]} (${grupo.length})</h4>
                ${grupo.map(n => `
                <div style="display:flex; align-items:flex-start; gap:10px; padding:12px; background:#f8fafc; border-left:4px solid ${n.color}; border-radius:6px; margin-bottom:8px; box-shadow:0 1px 2px rgba(0,0,0,0.05);">
                    <span style="font-size:18px; margin-top:2px;">${n.icono}</span>
                    <span style="font-size:13px; color:#334155; flex:1; font-weight:500; line-height:1.4;">${n.msg}</span>
                    <button onclick="marcarNotificacionVista('${n.id}')" style="background:#e2e8f0; color:#475569; border:none; border-radius:6px; padding:6px 10px; font-size:11px; font-weight:bold; cursor:pointer; transition:0.2s;">OK</button>
                </div>`).join('')}
            </div>`;
        });
    }

    const html = `
    <div data-modal="panel-notif" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.5);backdrop-filter:blur(3px);z-index:9999;display:flex;justify-content:flex-end;">
        <div style="background:white; width:100%; max-width:400px; height:100%; overflow-y:auto; padding:24px; box-shadow:-5px 0 25px rgba(0,0,0,0.1); animation: fadeSlideUp 0.3s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h2 style="margin:0; color:#0f172a; font-size:18px;">🔔 Notificaciones</h2>
                <div style="display:flex; gap:10px; align-items:center;">
                    ${notifs.length > 0 ? `<button onclick="marcarTodasComoLeidas()" style="background:#f1f5f9; color:#0f172a; border:none; border-radius:6px; padding:8px 12px; font-size:12px; font-weight:bold; cursor:pointer;">🧹 Limpiar todas</button>` : ''}
                    <button onclick="document.querySelector('[data-modal=panel-notif]')?.remove()" style="background:none; border:none; font-size:24px; color:#64748b; cursor:pointer;">✕</button>
                </div>
            </div>
            ${contenido}
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

let _notifIntervalId = null;

function inicializarNotificaciones() {
    renderBadgeNotificaciones();
    if (_notifIntervalId) clearInterval(_notifIntervalId);
    _notifIntervalId = setInterval(renderBadgeNotificaciones, 5 * 60 * 1000);
}

window.recopilarNotificaciones = recopilarNotificaciones;
window.renderBadgeNotificaciones = renderBadgeNotificaciones;
window.abrirPanelNotificaciones = abrirPanelNotificaciones;
window.inicializarNotificaciones = inicializarNotificaciones;
window.marcarNotificacionVista = marcarNotificacionVista;
window.marcarTodasComoLeidas = marcarTodasComoLeidas;
