// ================================================================
// 📝 CxcNotas — Observación general de cartera + Historial de cobranza
// ================================================================
// 1) Observación general: un comentario libre por CUENTA (folio de venta a
//    crédito), por ejemplo "el cliente pagará el 10 de octubre y el resto
//    la 2da semana de noviembre". Vive como campo dentro del propio registro
//    de la cuenta en cuentasPorCobrar (que ya se sincroniza como UN documento
//    por folio, ver storage2.js), así que agregarlo no crea escrituras ni
//    documentos extra en Firestore: viaja gratis con el guardado normal de
//    la cuenta.
//    Se muestra en: Estado de Cuenta Cliente, ARC v3, Matriz de Cobranza
//    (como tooltip al pasar el cursor sobre el cliente), Scorecard de
//    Comportamiento de Pago y Concentración de Cartera (Pareto).
//
// 2) Historial de cobranza: bitácora de comentarios de gestión de cobro que
//    se van acumulando en el tiempo. Para NO exceder los límites de
//    Firestore (1 MiB por documento) cada comentario se guarda como su
//    propio registro pequeño en la tabla "historialCobranza"
//    (posData/historialCobranza/registros/{id}), exactamente igual a como
//    ya hace el sistema con pagarés, movimientos de caja, etc. Nunca se
//    reescribe un documento gigante para agregar un comentario nuevo.
// ================================================================

function _escNotaCxc(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function _fechaCortaNotaCxc(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function _productosCuentaCxc(cuenta) {
    const articulos = Array.isArray(cuenta?.articulos) ? cuenta.articulos : [];
    if (!articulos.length) return 'Sin artículos registrados';
    const nombres = articulos.map(a => a?.nombre).filter(Boolean);
    if (!nombres.length) return 'Sin artículos registrados';
    return nombres.length > 2 ? `${nombres.slice(0, 2).join(', ')} +${nombres.length - 2} más` : nombres.join(', ');
}

function _usuarioActualCxcNotas() {
    return (window.usuarioActivo && (window.usuarioActivo.nombre || window.usuarioActivo.usuario)) ||
        (window._usuarioActual && (window._usuarioActual.nombre || window._usuarioActual.usuario)) ||
        'Sistema';
}

window.CxcNotas = {

    // Escapa texto para insertarlo seguro dentro de un atributo HTML (title="", etc.)
    escapar(texto) {
        return _escNotaCxc(texto);
    },

    // ────────────────────────────────────────────────────────────
    // Observación general (1 por cuenta/folio)
    // ────────────────────────────────────────────────────────────
    obtenerObservacion(folio) {
        const c = StorageService.get('cuentasPorCobrar', []).find(x => x.folio === folio);
        return c?.observacionCartera || '';
    },

    guardarObservacion(folio, texto) {
        const cuentas = StorageService.get('cuentasPorCobrar', []);
        const idx = cuentas.findIndex(x => x.folio === folio);
        if (idx === -1) return false;
        cuentas[idx] = {
            ...cuentas[idx],
            observacionCartera: String(texto || '').trim(),
            observacionCarteraFecha: new Date().toISOString(),
            observacionCarteraUsuario: _usuarioActualCxcNotas()
        };
        StorageService.set('cuentasPorCobrar', cuentas);
        return true;
    },

    // Junta las observaciones de una o varias cuentas (para filas que agrupan
    // todas las cuentas de un mismo cliente, como en Matriz/Scorecard)
    observacionesDe(folioOFolios) {
        const lista = Array.isArray(folioOFolios) ? folioOFolios : [folioOFolios];
        const cuentas = StorageService.get('cuentasPorCobrar', []);
        return lista
            .map(f => cuentas.find(c => c.folio === f))
            .filter(c => c && String(c.observacionCartera || '').trim())
            .map(c => ({ folio: c.folio, texto: c.observacionCartera }));
    },

    // Texto plano listo para usarse en un atributo title="" (tooltip nativo)
    tooltipTexto(folioOFolios) {
        const obs = this.observacionesDe(folioOFolios);
        if (!obs.length) return '';
        return obs.map(o => `📝 ${o.folio}: ${o.texto}`).join('\n');
    },

    // Icono/badge para insertar junto al nombre del cliente en tarjetas o filas.
    // Al pasar el cursor muestra la observación (tooltip emergente nativo).
    badgeHtml(folioOFolios) {
        const obs = this.observacionesDe(folioOFolios);
        if (!obs.length) return '';
        const tip = obs.map(o => `${o.folio}: ${o.texto}`).join(' | ');
        return `<span title="${_escNotaCxc(tip)}" style="display:inline-block;margin-left:6px;font-size:12px;cursor:help;" aria-label="Observación de cartera">📝</span>`;
    },

    // ────────────────────────────────────────────────────────────
    // Historial de cobranza (bitácora acumulable, 1 documento por comentario)
    // ────────────────────────────────────────────────────────────
    agregarComentario(folio, texto, opts = {}) {
        const limpio = String(texto || '').trim();
        if (!folio || !limpio) return false;
        const historial = StorageService.get('historialCobranza', []);
        historial.push({
            id: 'hc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
            folio,
            clienteId: opts.clienteId || null,
            texto: limpio,
            fecha: new Date().toISOString(),
            usuario: opts.usuario || _usuarioActualCxcNotas()
        });
        StorageService.set('historialCobranza', historial);
        return true;
    },

    obtenerHistorial(folio) {
        return StorageService.get('historialCobranza', [])
            .filter(h => h.folio === folio)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    },

    // Abre notas para una cuenta o, si el cliente tiene varias cuentas
    // agrupadas, primero muestra el selector para elegir cuál.
    abrir(folioOFolios, clienteNombre = '') {
        const lista = Array.isArray(folioOFolios) ? folioOFolios : [folioOFolios];
        if (lista.length > 1) this.abrirSelector(lista, clienteNombre);
        else this.abrirModal(lista[0], clienteNombre);
    },

    // Variante para usarse con data-folios (JSON) / data-cliente en el HTML,
    // así se evitan problemas de comillas al inyectar arreglos en onclick="".
    abrirDesdeElemento(el) {
        let folios = [];
        try { folios = JSON.parse(el.getAttribute('data-folios') || '[]'); } catch (e) { folios = []; }
        const cliente = el.getAttribute('data-cliente') || '';
        this.abrir(folios, cliente);
    },

    // Selector de cuenta cuando un cliente tiene varias cuentas agrupadas en
    // una sola fila (Matriz de Cobranza, Scorecard). Muestra folio + producto
    // comprado de cada una para poder diferenciarlas antes de anotar.
    abrirSelector(folios, clienteNombre = '') {
        const lista = Array.isArray(folios) ? folios : [folios];
        if (lista.length <= 1) {
            this.abrirModal(lista[0], clienteNombre);
            return;
        }
        document.querySelector('[data-modal="cxc-notas-selector"]')?.remove();
        const cuentas = StorageService.get('cuentasPorCobrar', []);
        const filas = lista.map(folio => {
            const cuenta = cuentas.find(c => c.folio === folio);
            const producto = _productosCuentaCxc(cuenta);
            const tieneObs = !!String(cuenta?.observacionCartera || '').trim();
            return `
                <button onclick="document.querySelector('[data-modal=&quot;cxc-notas-selector&quot;]')?.remove();CxcNotas.abrirModal('${String(folio).replace(/'/g, "\\'")}', '${String(clienteNombre).replace(/'/g, "\\'")}')"
                    style="display:block;width:100%;text-align:left;padding:12px 14px;margin-bottom:8px;background:${tieneObs ? '#fef3c7' : '#f8fafc'};border:1px solid ${tieneObs ? '#f59e0b' : '#e2e8f0'};border-radius:8px;cursor:pointer;">
                    <div style="font-weight:900;color:#0f172a;font-size:13px;">${_escNotaCxc(folio)} ${tieneObs ? '📝' : ''}</div>
                    <div style="font-size:12px;color:#64748b;margin-top:2px;">${_escNotaCxc(producto)}</div>
                </button>`;
        }).join('');

        document.body.insertAdjacentHTML('beforeend', `
            <div data-modal="cxc-notas-selector" style="position:fixed;inset:0;background:rgba(15,23,42,.78);z-index:10049;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;">
                <div style="width:100%;max-width:480px;background:white;border-radius:12px;padding:22px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                        <div>
                            <h3 style="margin:0;color:#0f172a;">🗒️ ¿Sobre cuál cuenta?</h3>
                            <p style="margin:4px 0 0;color:#64748b;font-size:12px;">${_escNotaCxc(clienteNombre)} tiene ${lista.length} cuentas activas</p>
                        </div>
                        <button onclick="document.querySelector('[data-modal=&quot;cxc-notas-selector&quot;]')?.remove()" style="padding:8px 12px;border:0;border-radius:6px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cerrar</button>
                    </div>
                    ${filas}
                </div>
            </div>`);
    },

    // ────────────────────────────────────────────────────────────
    // Modal compartido: ver/editar observación general + agregar y ver
    // historial de cobranza. Se invoca desde cualquiera de las vistas.
    // ────────────────────────────────────────────────────────────
    abrirModal(folio, clienteNombre = '') {
        document.querySelector('[data-modal="cxc-notas"]')?.remove();
        const obsActual = this.obtenerObservacion(folio);
        const hist = this.obtenerHistorial(folio);
        const filasHist = hist.length
            ? hist.map(h => `
                <div style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">
                    <div style="font-size:11px;color:#64748b;display:flex;justify-content:space-between;gap:10px;">
                        <span>👤 ${_escNotaCxc(h.usuario || 'Sistema')}</span>
                        <span>${_fechaCortaNotaCxc(h.fecha)}</span>
                    </div>
                    <div style="font-size:13px;color:#0f172a;margin-top:3px;">${_escNotaCxc(h.texto)}</div>
                </div>`).join('')
            : `<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;">Sin comentarios registrados todavía.</div>`;

        document.body.insertAdjacentHTML('beforeend', `
            <div data-modal="cxc-notas" style="position:fixed;inset:0;background:rgba(15,23,42,.78);z-index:10050;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px;">
                <div style="width:100%;max-width:560px;background:white;border-radius:12px;padding:22px;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                        <div>
                            <h3 style="margin:0;color:#0f172a;">🗒️ Notas de cobranza</h3>
                            <p style="margin:4px 0 0;color:#64748b;font-size:12px;">${_escNotaCxc(clienteNombre)} · Folio ${_escNotaCxc(folio)}</p>
                        </div>
                        <button onclick="document.querySelector('[data-modal=&quot;cxc-notas&quot;]')?.remove()" style="padding:8px 12px;border:0;border-radius:6px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cerrar</button>
                    </div>

                    <label style="display:block;font-size:12px;color:#475569;font-weight:800;margin-bottom:5px;">Observación general de la cuenta</label>
                    <p style="margin:0 0 6px;font-size:11px;color:#94a3b8;">Visible en Estado de Cuenta, ARC v3, Matriz de Cobranza, Scorecard y Concentración de Cartera.</p>
                    <textarea id="cxcNotasObsInput" placeholder="Ej. El cliente pagará el 10 de octubre y el resto la 2da semana de noviembre." style="width:100%;min-height:70px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;box-sizing:border-box;font-size:13px;font-family:inherit;">${_escNotaCxc(obsActual)}</textarea>
                    <div style="text-align:right;margin-top:6px;margin-bottom:18px;">
                        <button onclick="CxcNotas.guardarObservacionDesdeModal('${String(folio).replace(/'/g, "\\'")}')" style="padding:8px 14px;background:#1e40af;color:white;border:0;border-radius:6px;font-weight:bold;cursor:pointer;font-size:12px;">Guardar observación</button>
                    </div>

                    <label style="display:block;font-size:12px;color:#475569;font-weight:800;margin-bottom:5px;">Historial de cobranza</label>
                    <div style="display:flex;gap:6px;margin-bottom:10px;">
                        <input id="cxcNotasComentarioInput" type="text" placeholder="Agregar comentario de gestión de cobro..." style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:6px;font-size:12px;box-sizing:border-box;">
                        <button onclick="CxcNotas.agregarComentarioDesdeModal('${String(folio).replace(/'/g, "\\'")}', '${String(clienteNombre).replace(/'/g, "\\'")}')" style="padding:8px 12px;background:#16a34a;color:white;border:0;border-radius:6px;font-weight:bold;cursor:pointer;font-size:12px;white-space:nowrap;">Agregar</button>
                    </div>
                    <div style="max-height:260px;overflow-y:auto;border:1px solid #e2e8f0;border-radius:8px;">
                        ${filasHist}
                    </div>
                </div>
            </div>`);

        document.getElementById('cxcNotasComentarioInput')?.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') { ev.preventDefault(); window.CxcNotas.agregarComentarioDesdeModal(folio, clienteNombre); }
        });
    },

    guardarObservacionDesdeModal(folio) {
        const texto = document.getElementById('cxcNotasObsInput')?.value || '';
        this.guardarObservacion(folio, texto);
        if (typeof window.mostrarNotificacion === 'function') window.mostrarNotificacion('Observación de cartera guardada', 'exito');
        // Refrescar la tabla de folios del estado de cuenta si está abierta
        if (typeof window._eccAplicarFiltroSaldo === 'function' && window._estadoClienteActual) window._eccAplicarFiltroSaldo();
    },

    agregarComentarioDesdeModal(folio, clienteNombre) {
        const input = document.getElementById('cxcNotasComentarioInput');
        const texto = input?.value || '';
        if (!String(texto).trim()) return;
        const cuenta = StorageService.get('cuentasPorCobrar', []).find(c => c.folio === folio);
        this.agregarComentario(folio, texto, { clienteId: cuenta?.clienteId || null });
        if (input) input.value = '';
        this.abrirModal(folio, clienteNombre);
    }
};

console.log('✅ Módulo cxc-notas.js cargado — Observación de cartera + Historial de cobranza.');
