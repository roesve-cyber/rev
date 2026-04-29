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
    document.querySelector('[data-modal=panel-notif]')?.remove();
    setTimeout(abrirPanelNotificaciones, 100);
}
function limpiarNotificacionesVistas() {
    setNotificacionesVistas([]);
    renderBadgeNotificaciones();
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
            if (!vistas.includes(id)) notifs.push({ tipo: 'pagare', icono: '📋', color: '#dc2626', msg: `Pagaré ${p.folio} VENCIDO hace ${dias} día(s)`, folio: p.folio, id });
        } else if (fv <= en3dias) {
            const dias = Math.ceil((fv - hoy) / (1000 * 60 * 60 * 24));
            const id = `pagare_${p.folio}_proximo`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'pagare', icono: '📋', color: '#d97706', msg: `Pagaré ${p.folio} vence en ${dias} día(s)`, folio: p.folio, id });
        }
    });

    // Stock bajo
    const productos = StorageService.get('productos', []);
    productos.forEach(p => {
        const stock = p.stock || p.cantidad || 0;
        const minimo = p.stockMinimo || 3;
        if (stock > 0 && stock <= minimo) {
            const id = `stock_${p.id}_bajo`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'stock', icono: '📦', color: '#d97706', msg: `Stock bajo: ${p.nombre} (quedan ${stock} unidades)`, id });
        } else if (stock <= 0) {
            const id = `stock_${p.id}_sin`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'stock', icono: '📦', color: '#dc2626', msg: `Sin stock: ${p.nombre}`, id });
        }
    });

    // Cuentas por pagar próximas
    const cxp = StorageService.get('cuentasPorPagar', []);
    cxp.filter(c => (c.saldoPendiente || 0) > 0 && c.fechaVencimiento).forEach(c => {
        const fv = new Date(c.fechaVencimiento);
        if (fv <= en3dias) {
            const id = `cxp_${c.id}_vence`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'cxp', icono: '💳', color: '#dc2626', msg: `Cuenta por pagar a ${c.proveedor || 'proveedor'}: ${dinero(c.saldoPendiente)} vence ${fv.toLocaleDateString('es-MX')}`, id });
        }
    });

    // Cotizaciones por vencer en ≤3 días
    const cotizaciones = StorageService.get('cotizaciones', []);
    cotizaciones.filter(c => c.estado === 'Vigente').forEach(c => {
        const fv = new Date(c.fechaVencimiento);
        if (fv <= en3dias && fv >= hoy) {
            const dias = Math.ceil((fv - hoy) / (1000 * 60 * 60 * 24));
            const id = `cot_${c.folio}_vence`;
            if (!vistas.includes(id)) notifs.push({ tipo: 'cotizacion', icono: '📄', color: '#d97706', msg: `Cotización ${c.folio} vence en ${dias} día(s) — ${c.clienteNombre}`, id });
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
    const tipos = ['pagare', 'stock', 'cxp', 'cotizacion'];
    const titulos = { pagare: '📋 Pagarés', stock: '📦 Inventario', cxp: '💳 Cuentas por Pagar', cotizacion: '📄 Cotizaciones' };

    let contenido = '';
        tipos.forEach(t => {
                const grupo = notifs.filter(n => n.tipo === t);
                if (grupo.length === 0) return;
                contenido += `<div style="margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e40af;">${titulos[t]} (${grupo.length})</h4>
                    ${grupo.map(n => `<div style="display:flex;align-items:flex-start;gap:10px;padding:10px;background:#f9fafb;border-left:4px solid ${n.color};border-radius:4px;margin-bottom:6px;">
                        <span style="font-size:20px;">${n.icono}</span>
                        <span style="font-size:14px;color:#374151;flex:1;">${n.msg}</span>
                        <button onclick="marcarNotificacionVista('${n.id}')" style="background:#e5e7eb;border:none;border-radius:4px;padding:4px 8px;font-size:12px;cursor:pointer;">Marcar como vista</button>
                    </div>`).join('')}
                </div>`;
        });

    if (!contenido) contenido = '<p style="color:#9ca3af;text-align:center;padding:30px;">✅ Sin notificaciones pendientes.</p>';

        const html = `
        <div data-modal="panel-notif" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-start;justify-content:flex-end;">
            <div style="background:white;width:100%;max-width:420px;height:100%;overflow-y:auto;padding:24px;box-shadow:-4px 0 20px rgba(0,0,0,0.15);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                    <h2 style="margin:0;color:#1e40af;">🔔 Notificaciones (${notifs.length})</h2>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button onclick="limpiarNotificacionesVistas()" style="background:#f3f4f6;border:none;border-radius:4px;padding:6px 10px;font-size:13px;cursor:pointer;">Limpiar vistas</button>
                        <button onclick="document.querySelector('[data-modal=panel-notif]')?.remove()" style="background:none;border:none;font-size:22px;cursor:pointer;">✕</button>
                    </div>
                </div>
                ${contenido}
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
window.marcarNotificacionVista = marcarNotificacionVista;
window.limpiarNotificacionesVistas = limpiarNotificacionesVistas;
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
