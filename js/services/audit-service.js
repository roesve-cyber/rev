// ===== BITACORA DE AUDITORIA =====
(function() {
    const existing = window.AuditService;
    if (existing && existing.__auditServiceInitialized) {
        if (typeof existing.render === 'function') window.renderBitacoraAuditoria = existing.render;
        return;
    }

    const KEY = 'bitacoraAuditoria';
    const MAX = 1500;

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[ch]));
    }

    function nowIso() {
        try {
            return window.localISO ? window.localISO(new Date()) : new Date().toISOString();
        } catch {
            return new Date().toISOString();
        }
    }

    function session() {
        try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null'); } catch { return null; }
    }

    function isAdmin() {
        const s = session();
        return s && s.rol === 'admin';
    }

    function compact(value) {
        if (value === undefined) return null;
        if (value === null) return null;
        if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch {
            return String(value);
        }
    }

    function read() {
        return StorageService.get(KEY, []);
    }

    function write(rows) {
        StorageService.set(KEY, rows.slice(0, MAX));
    }

    function log({ accion, modulo = 'Sistema', entidad = '', entidadId = '', detalle = '', monto = null, severidad = 'info', datos = null } = {}) {
        if (!accion) return null;
        const s = session() || {};
        const row = {
            id: Date.now() + Math.random(),
            fecha: nowIso(),
            accion,
            modulo,
            entidad,
            entidadId,
            detalle,
            monto: monto === null || monto === undefined || monto === '' ? null : Number(monto),
            severidad,
            usuario: s.nombre || s.usuario || s.email || 'Sin sesion',
            usuarioId: s.uid || s.id || s.usuario || null,
            rol: s.rol || 'sin_rol',
            vendedorId: s.vendedorId || null,
            vendedorNombre: s.vendedorNombre || null,
            datos: compact(datos)
        };
        const rows = read();
        rows.unshift(row);
        write(rows);
        return row;
    }

    function requireAdmin(accion = 'operacion restringida') {
        if (isAdmin()) return true;
        log({
            accion: 'ACCESO_DENEGADO',
            modulo: 'Seguridad',
            entidad: accion,
            detalle: `Intento de acceso sin permisos: ${accion}`,
            severidad: 'alerta'
        });
        alert('Operacion restringida. Solo un administrador puede continuar.');
        return false;
    }

    function money(value) {
        const n = Number(value || 0);
        if (typeof dinero === 'function') return dinero(n);
        return n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }

    function fechaVisible(iso) {
        if (!iso) return '-';
        try {
            if (window.formatearFechaMX) return window.formatearFechaMX(iso);
            return new Date(iso).toLocaleString('es-MX');
        } catch {
            return String(iso);
        }
    }

    function parseAuditDate(value) {
        if (!value) return null;
        try {
            const raw = String(value).trim();
            if (!raw) return null;
            if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
                return new Date(`${raw}T00:00:00`);
            }
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
                return new Date(`${raw}:00`);
            }
            return new Date(raw);
        } catch {
            return null;
        }
    }

    function parseAuditBoundary(value, endOfDay = false) {
        const base = parseAuditDate(value);
        if (!base) return null;
        if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
            base.setHours(23, 59, 59, 999);
        }
        return base;
    }

    function filters() {
        return {
            q: String(document.getElementById('audQ')?.value || '').trim().toLowerCase(),
            modulo: document.getElementById('audModulo')?.value || '',
            severidad: document.getElementById('audSeveridad')?.value || '',
            usuario: document.getElementById('audUsuario')?.value || '',
            tipoMovimiento: document.getElementById('audTipoMovimiento')?.value || '',
            desde: document.getElementById('audDesde')?.value || '',
            hasta: document.getElementById('audHasta')?.value || ''
        };
    }

    function matches(row, f) {
        const text = `${row.accion} ${row.modulo} ${row.entidad} ${row.entidadId} ${row.detalle} ${row.usuario} ${row.rol}`.toLowerCase();
        if (f.q && !text.includes(f.q)) return false;
        if (f.modulo && row.modulo !== f.modulo) return false;
        if (f.severidad && row.severidad !== f.severidad) return false;
        if (f.usuario && row.usuario !== f.usuario) return false;

        const tipoTexto = [row.tipoMovimiento, row.datos?.tipoMovimiento, row.datos?.tipo, row.datos?.movimiento, row.accion, row.entidad]
            .filter(Boolean)
            .map(v => String(v).trim().toLowerCase())
            .join(' ');
        if (f.tipoMovimiento && !tipoTexto.includes(String(f.tipoMovimiento).trim().toLowerCase())) return false;

        const rowTime = parseAuditDate(row.fecha);
        const desdeTime = parseAuditBoundary(f.desde, false);
        const hastaTime = parseAuditBoundary(f.hasta, true);

        if (desdeTime && rowTime && rowTime < desdeTime) return false;
        if (hastaTime && rowTime && rowTime > hastaTime) return false;
        return true;
    }

    function currentRows() {
        const f = filters();
        return read().filter(row => matches(row, f)).sort((a, b) => {
            const ta = parseAuditDate(a.fecha)?.getTime() || 0;
            const tb = parseAuditDate(b.fecha)?.getTime() || 0;
            return tb - ta;
        });
    }

    function renderBitacoraAuditoria() {
        const cont = document.getElementById('contenidoBitacoraAuditoria');
        if (!cont) return;
        if (!isAdmin()) {
            cont.innerHTML = '<div style="background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:18px;border-radius:8px;font-weight:bold;">Solo administrador puede consultar la bitacora.</div>';
            return;
        }

        const rowsAll = read();
        const modulos = [...new Set(rowsAll.map(r => r.modulo).filter(Boolean))].sort();
        const usuarios = [...new Set(rowsAll.map(r => r.usuario).filter(Boolean))].sort();
        const tiposMovimiento = [...new Set(rowsAll.map(r => [r.tipoMovimiento, r.datos?.tipoMovimiento, r.datos?.tipo, r.datos?.movimiento, r.accion, r.entidad].find(Boolean)).filter(Boolean).map(v => String(v).trim()).filter(Boolean))].sort();
        const old = filters();
        const rows = currentRows();
        const recientes24 = rowsAll.filter(r => Date.now() - new Date(r.fecha).getTime() < 86400000).length;
        const alertas = rowsAll.filter(r => r.severidad === 'alerta').length;

        const rowHtml = rows.slice(0, 300).map(r => {
            const color = r.severidad === 'alerta' ? '#b91c1c' : r.severidad === 'riesgo' ? '#b45309' : '#334155';
            return `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:9px;vertical-align:top;white-space:nowrap;">${esc(fechaVisible(r.fecha))}</td>
                <td style="padding:9px;vertical-align:top;"><b>${esc(r.usuario)}</b><br><small style="color:#64748b;">${esc(r.rol || '-')}</small></td>
                <td style="padding:9px;vertical-align:top;"><span style="color:${color};font-weight:900;">${esc(r.accion)}</span><br><small style="color:#64748b;">${esc(r.modulo || '-')}</small></td>
                <td style="padding:9px;vertical-align:top;">${esc(r.entidad || '-')} ${r.entidadId ? `<br><small style="color:#64748b;">${esc(r.entidadId)}</small>` : ''}</td>
                <td style="padding:9px;vertical-align:top;">${esc(r.detalle || '-')}</td>
                <td style="padding:9px;vertical-align:top;text-align:right;font-weight:bold;">${r.monto !== null && r.monto !== undefined ? money(r.monto) : '-'}</td>
            </tr>`;
        }).join('');

        cont.innerHTML = `
            <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:16px;">
                <div>
                    <h2 style="margin:0;color:#0f172a;">Visor de movimientos de usuario</h2>
                    <p style="margin:4px 0 0;color:#64748b;">Consulta el historial de operaciones sensibles por rango de tiempo, desde el más reciente al más antiguo.</p>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <button onclick="renderBitacoraAuditoria()" style="padding:10px 14px;background:#475569;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Actualizar</button>
                    <button onclick="exportarBitacoraAuditoria()" style="padding:10px 14px;background:#047857;color:white;border:0;border-radius:7px;font-weight:bold;cursor:pointer;">Exportar CSV</button>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:14px;">
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;"><small style="color:#64748b;font-weight:bold;">EVENTOS</small><br><b style="font-size:22px;color:#1d4ed8;">${rowsAll.length}</b></div>
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px;"><small style="color:#64748b;font-weight:bold;">ULTIMAS 24 HRS</small><br><b style="font-size:22px;color:#15803d;">${recientes24}</b></div>
                <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px;"><small style="color:#64748b;font-weight:bold;">ALERTAS</small><br><b style="font-size:22px;color:#b45309;">${alertas}</b></div>
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;"><small style="color:#64748b;font-weight:bold;">MOSTRADOS</small><br><b style="font-size:22px;color:#334155;">${rows.length}</b></div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:14px;display:grid;grid-template-columns:2fr repeat(6, minmax(120px,1fr));gap:10px;align-items:end;">
                <div><label style="font-size:11px;font-weight:900;color:#475569;">BUSCAR</label><input id="audQ" value="${esc(old.q)}" oninput="renderBitacoraAuditoria()" placeholder="Folio, usuario, accion..." style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"></div>
                <div><label style="font-size:11px;font-weight:900;color:#475569;">MODULO</label><select id="audModulo" onchange="renderBitacoraAuditoria()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="">Todos</option>${modulos.map(m => `<option value="${esc(m)}" ${old.modulo === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
                <div><label style="font-size:11px;font-weight:900;color:#475569;">SEVERIDAD</label><select id="audSeveridad" onchange="renderBitacoraAuditoria()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="">Todas</option>${['info','riesgo','alerta'].map(s => `<option value="${s}" ${old.severidad === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
                <div><label style="font-size:11px;font-weight:900;color:#475569;">USUARIO</label><select id="audUsuario" onchange="renderBitacoraAuditoria()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="">Todos</option>${usuarios.map(u => `<option value="${esc(u)}" ${old.usuario === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></div>
                <div><label style="font-size:11px;font-weight:900;color:#475569;">TIPO</label><select id="audTipoMovimiento" onchange="renderBitacoraAuditoria()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="">Todos</option>${tiposMovimiento.map(t => `<option value="${esc(t)}" ${old.tipoMovimiento === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
                <div><label style="font-size:11px;font-weight:900;color:#475569;">DESDE</label><input type="datetime-local" id="audDesde" value="${esc(old.desde)}" onchange="renderBitacoraAuditoria()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"></div>
                <div><label style="font-size:11px;font-weight:900;color:#475569;">HASTA</label><input type="datetime-local" id="audHasta" value="${esc(old.hasta)}" onchange="renderBitacoraAuditoria()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"></div>
            </div>
            <div style="margin-bottom:10px;color:#64748b;font-size:12px;font-weight:600;">Mostrando ${rows.length} registro(s) ordenados del más reciente al más antiguo.</div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;overflow:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;min-width:900px;">
                    <thead style="background:#f8fafc;color:#475569;"><tr><th style="padding:10px;text-align:left;">Fecha</th><th style="padding:10px;text-align:left;">Usuario</th><th style="padding:10px;text-align:left;">Accion</th><th style="padding:10px;text-align:left;">Entidad</th><th style="padding:10px;text-align:left;">Detalle</th><th style="padding:10px;text-align:right;">Monto</th></tr></thead>
                    <tbody>${rowHtml || '<tr><td colspan="6" style="padding:28px;text-align:center;color:#64748b;">Sin eventos para los filtros actuales.</td></tr>'}</tbody>
                </table>
            </div>`;
    }

    function exportarBitacoraAuditoria() {
        if (!requireAdmin('exportar bitacora')) return;
        const rows = currentRows();
        const headers = ['fecha','usuario','rol','modulo','accion','entidad','entidadId','detalle','monto','severidad'];
        const csv = [headers.join(',')].concat(rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bitacora_auditoria_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    window.AuditService = Object.assign(existing || {}, {
        __auditServiceInitialized: true,
        log,
        read,
        render: renderBitacoraAuditoria,
        requireAdmin
    });
    window.renderBitacoraAuditoria = renderBitacoraAuditoria;
    window.exportarBitacoraAuditoria = exportarBitacoraAuditoria;
})();
