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
function recopilarNotificaciones() {
    const hoy = new Date();
    const en3dias = new Date(hoy.getTime() + 3 * 24 * 3600 * 1000);
    const notifs = [];
    const vistas = getNotificacionesVistas();

    // Pagarés vencidos o por vencer en ≤3 días
    const pagares = StorageService.get('pagaresSistema', []);
    pagares.filter(p => p.estado === 'Pendiente' || p.estado === 'Parcial').forEach(p => {
        const fv = new Date(p.fechaVencimiento);
        if (fv <= hoy) {
            const dias = Math.floor((hoy - fv) / (1000 * 60 * 60 * 24));
            const id = `pagare_${p.folio}_vencido`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'pagare', icono: '🔴', color: '#dc2626', msg: `Pagaré ${p.folio} VENCIDO hace ${dias} día(s)`, folio: p.folio, id });
        } else if (fv <= en3dias) {
            const dias = Math.ceil((fv - hoy) / (1000 * 60 * 60 * 24));
            const id = `pagare_${p.folio}_proximo`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'pagare', icono: '⏳', color: '#d97706', msg: `Pagaré ${p.folio} vence en ${dias} día(s)`, folio: p.folio, id });
        }
    });

    // Stock bajo
    const productos = StorageService.get('productos', []);
    productos.forEach(p => {
        const stock = p.stock || p.cantidad || 0;
        const minimo = p.stockMinimo || 3;
        if (stock > 0 && stock <= minimo) {
            const id = `stock_${p.id}_bajo`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'stock', icono: '📦', color: '#d97706', msg: `Stock bajo: ${p.nombre} (quedan ${stock} pzs)`, id });
        } else if (stock <= 0) {
            const id = `stock_${p.id}_sin`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'stock', icono: '🚫', color: '#dc2626', msg: `Sin stock: ${p.nombre}`, id });
        }
    });

    // Cuentas por pagar próximas
    const cxp = StorageService.get('cuentasPorPagar', []);
    cxp.filter(c => (c.saldoPendiente || 0) > 0 && c.fechaVencimiento).forEach(c => {
        const fv = new Date(c.fechaVencimiento);
        if (fv <= en3dias) {
            const id = `cxp_${c.id}_vence`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'cxp', icono: '💳', color: '#dc2626', msg: `Pago a ${c.proveedor || 'proveedor'}: ${dinero(c.saldoPendiente)} vence el ${fv.toLocaleDateString('es-MX')}`, id });
        }
    });

    return notifs;
}

function renderBadgeNotificaciones() {
    const badge = document.getElementById('badgeNotif');
    if (!badge) return;
    const notifs = recopilarNotificaciones();
    if (notifs.length === 0) {
        badge.style.display = 'none';
    } else {
        badge.style.display = 'flex';
        badge.textContent = notifs.length > 99 ? '99+' : notifs.length;
    }
}

function abrirPanelNotificaciones() {
    const notifs = recopilarNotificaciones();
    const tipos = ['pagare', 'stock', 'cxp'];
    const titulos = { pagare: '📋 Cobranza', stock: '📦 Inventario', cxp: '💳 Cuentas por Pagar' };

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