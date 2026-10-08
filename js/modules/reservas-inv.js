/* =====================================================================
 * RESERVAS Y STOCK DE SEGUNDA -- panel de gestión dentro de Inventario
 * ---------------------------------------------------------------------
 * Una reserva (reservasInventario) es la "promesa" de una pieza a un
 * apartado: NO toca producto.stock ni el kardex hasta la entrega. Antes
 * no había dónde verlas ni corregirlas. Este módulo agrega:
 *
 *   1. 🔒 Panel "Reservas y segunda" (botón en Inventario):
 *        - Reservas activas con el físico real que hay en su ubicación y
 *          alertas (apartado ya no vigente, físico < reservado, sin
 *          ubicación, sin color).
 *        - Liberar una reserva puntual (admin, con auditoría).
 *        - Stock de SEGUNDA por color/ubicación, con "Pasar a nuevo"
 *          (corrige un reingreso por cancelación marcado por error).
 *   2. Etiquetas "🔒 reservadas / disponibles" y "🏷️ segunda" en la
 *      tabla de inventario (invBadgesReservaSegunda).
 *   3. Helpers que usa la toma de inventario (invReservadoEn).
 *
 * Depende de funciones ya existentes: StorageService, ajustarStockVariante,
 * registrarMovimiento, obtenerReservasInventario (inventario.js),
 * _invRequireAdmin y AuditService.
 * ===================================================================== */
(function () {
    'use strict';

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function jsArg(v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
    function norm(s) {
        return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toUpperCase();
    }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

    var _tab = 'reservas';
    var _filtro = '';

    function reservasActivas() {
        return (StorageService.get('reservasInventario', []) || []).filter(function (r) { return r.estado === 'Activa'; });
    }

    // Físico en una ubicación/color con la MISMA regla que la disponibilidad de venta
    // (ventas.js: _stockDisponibleEnOrigen), pero sin restar reservas.
    function fisicoEn(p, color, ubicacion) {
        if (!p) return 0;
        var variantes = Array.isArray(p.variantes) ? p.variantes : [];
        var ubicNorm = norm(ubicacion || 'General');
        var colorNorm = norm(color);
        if (ubicNorm === 'STOCK GENERAL') {
            return Math.max(0, num(p.stock) - variantes.reduce(function (s, v) { return s + num(v.stock); }, 0));
        }
        if (!variantes.length) return ubicNorm === 'GENERAL' ? num(p.stock) : 0;
        return variantes
            .filter(function (v) { return norm(v.ubicacion || 'General') === ubicNorm; })
            .filter(function (v) { return !colorNorm || norm(v.color || 'General') === colorNorm; })
            .reduce(function (s, v) { return s + num(v.stock); }, 0);
    }

    /** Piezas reservadas (activas) de un producto en una ubicación/color (para la toma de inventario). */
    function invReservadoEn(productoId, color, ubicacion) {
        var ubicNorm = norm(ubicacion);
        var colorNorm = norm(color);
        return reservasActivas()
            .filter(function (r) { return String(r.productoId) === String(productoId); })
            .filter(function (r) { return !ubicNorm || norm(r.ubicacion || 'General') === ubicNorm; })
            .filter(function (r) { return !colorNorm || norm(r.color || 'General') === colorNorm; })
            .reduce(function (s, r) { return s + num(r.cantidad); }, 0);
    }

    /** HTML de etiquetas para la celda de stock en la tabla de Inventario. */
    function invBadgesReservaSegunda(p) {
        try {
            var out = '';
            var reservado = reservasActivas()
                .filter(function (r) { return String(r.productoId) === String(p.id); })
                .reduce(function (s, r) { return s + num(r.cantidad); }, 0);
            if (reservado > 0) {
                var disp = Math.max(0, num(p.stock) - reservado);
                out += '<div style="margin-top:4px;"><span title="Piezas prometidas a apartados activos. Siguen en bodega hasta la entrega." ' +
                    'style="font-size:10px;font-weight:bold;color:#1d4ed8;background:#dbeafe;padding:2px 7px;border-radius:10px;">' +
                    '🔒 ' + reservado + ' reservada' + (reservado === 1 ? '' : 's') + ' · ' + disp + ' disp.</span></div>';
            }
            if (num(p.stockSegunda) > 0) {
                out += '<div style="margin-top:4px;"><span title="Stock de segunda (devoluciones dañadas o incompletas). No se mezcla con el nuevo." ' +
                    'style="font-size:10px;font-weight:bold;color:#991b1b;background:#fee2e2;padding:2px 7px;border-radius:10px;">' +
                    '🏷️ ' + num(p.stockSegunda) + ' segunda</span></div>';
            }
            return out;
        } catch (e) { return ''; }
    }

    // ------------------------------------------------------------------
    // Panel
    // ------------------------------------------------------------------
    function asegurarModal() {
        var m = document.getElementById('modalReservasInv');
        if (m) return m;
        m = document.createElement('div');
        m.id = 'modalReservasInv';
        m.className = 'modal oculto';
        m.style.display = 'none';
        m.innerHTML =
            '<div class="modal-content" style="max-width:1000px; width:96%; max-height:90vh; overflow:auto;">' +
            '<div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:6px;">' +
            '<h2 style="margin:0; color:#1d4ed8;">🔒 Reservas y stock de segunda</h2>' +
            '<button onclick="cerrarPanelReservasInv()" style="padding:8px 14px; background:#e2e8f0; color:#475569; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">Cerrar</button>' +
            '</div>' +
            '<div id="reservasInvTabs" style="display:flex; gap:8px; margin:10px 0; flex-wrap:wrap;"></div>' +
            '<div id="reservasInvCuerpo"></div>' +
            '</div>';
        document.body.appendChild(m);
        return m;
    }

    function abrirPanelReservasInv(tab) {
        var m = asegurarModal();
        if (tab) _tab = tab;
        render();
        m.classList.remove('oculto');
        m.style.display = 'flex';
    }

    function cerrarPanelReservasInv() {
        var m = document.getElementById('modalReservasInv');
        if (!m) return;
        m.classList.add('oculto');
        m.style.display = 'none';
    }

    function cambiarTab(t) { _tab = t; render(); }
    function cambiarFiltro(v) { _filtro = String(v || '').toLowerCase(); render(true); }

    function render(conservarFoco) {
        var tabs = document.getElementById('reservasInvTabs');
        var cuerpo = document.getElementById('reservasInvCuerpo');
        if (!tabs || !cuerpo) return;
        var act = 'background:#1d4ed8;color:#fff;border-color:#1d4ed8;';
        var off = 'background:#fff;color:#1d4ed8;border-color:#93c5fd;';
        var base = 'padding:9px 14px;border:1px solid;border-radius:6px;font-weight:bold;cursor:pointer;';
        tabs.innerHTML =
            '<button onclick="_reservasInvTab(\'reservas\')" style="' + base + (_tab === 'reservas' ? act : off) + '">🔒 Reservas activas</button>' +
            '<button onclick="_reservasInvTab(\'segunda\')" style="' + base + (_tab === 'segunda' ? act : off) + '">🏷️ Stock de segunda</button>' +
            '<input id="reservasInvFiltro" type="text" placeholder="🔎 Buscar producto, folio, cliente..." value="' + esc(_filtro) + '" oninput="_reservasInvFiltro(this.value)" ' +
            'style="flex:1 1 220px; min-width:0; padding:9px 12px; border:1px solid #cbd5e1; border-radius:6px;">';
        cuerpo.innerHTML = _tab === 'reservas' ? htmlReservas() : htmlSegunda();
        if (conservarFoco) {
            var f = document.getElementById('reservasInvFiltro');
            if (f) { f.focus(); var l = f.value.length; try { f.setSelectionRange(l, l); } catch (e) { } }
        }
    }

    function coincide(texto) { return !_filtro || String(texto).toLowerCase().indexOf(_filtro) !== -1; }

    function htmlReservas() {
        var prods = StorageService.get('productos', []) || [];
        var apartados = StorageService.get('apartados', []) || [];
        var filas = reservasActivas().map(function (r) {
            var p = prods.find(function (x) { return String(x.id) === String(r.productoId); });
            var ap = apartados.find(function (a) { return a.folio === r.folio; });
            var fisico = fisicoEn(p, r.color, r.ubicacion);
            var alertas = [];
            if (!ap) alertas.push('Apartado no encontrado');
            else if (norm(ap.estado) !== 'PENDIENTE') alertas.push('Apartado "' + ap.estado + '": la reserva debió liberarse');
            if (!p) alertas.push('Producto ya no existe');
            else if (fisico < num(r.cantidad)) alertas.push('Físico (' + fisico + ') menor a lo reservado');
            if (!r.ubicacion) alertas.push('Sin ubicación: no descuenta bien la disponibilidad');
            if (!r.color && p && (p.variantes || []).some(function (v) { return norm(v.color || 'General') !== 'GENERAL'; })) {
                alertas.push('Sin color: no descuenta cuando se vende por color');
            }
            return { r: r, p: p, ap: ap, fisico: fisico, alertas: alertas };
        }).filter(function (f) {
            return coincide([f.r.folio, f.r.clienteNombre, f.r.nombreProducto, f.r.color, f.r.ubicacion].join(' '));
        }).sort(function (a, b) { return b.alertas.length - a.alertas.length || String(a.r.fechaCreacion).localeCompare(String(b.r.fechaCreacion)); });

        var conAlerta = filas.filter(function (f) { return f.alertas.length; }).length;
        var piezas = filas.reduce(function (s, f) { return s + num(f.r.cantidad); }, 0);
        var html =
            '<div style="font-size:13px;color:#475569;margin-bottom:8px;">' +
            '<b>' + filas.length + '</b> reserva(s) activa(s) · <b>' + piezas + '</b> pieza(s)' +
            (conAlerta ? ' · <b style="color:#b45309;">' + conAlerta + ' con alerta ⚠️</b>' : ' · sin alertas ✅') +
            '<br><small style="color:#64748b;">Una reserva aparta la pieza para un apartado sin sacarla del stock físico. Se consume al entregar el apartado y se libera al cancelarlo. ' +
            'Libera manualmente solo reservas huérfanas (apartado ya entregado/cancelado) o capturadas por error.</small></div>';

        if (!filas.length) return html + '<div style="padding:30px;text-align:center;color:#94a3b8;">No hay reservas activas.</div>';

        html += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">' +
            '<thead style="background:#f1f5f9;"><tr>' +
            '<th style="padding:8px;text-align:left;">Folio / Cliente</th><th style="padding:8px;text-align:left;">Producto</th>' +
            '<th style="padding:8px;text-align:left;">Color · Ubicación</th><th style="padding:8px;text-align:center;">Reservado</th>' +
            '<th style="padding:8px;text-align:center;">Físico ahí</th><th style="padding:8px;text-align:left;">Estado</th><th style="padding:8px;"></th>' +
            '</tr></thead><tbody>';
        filas.forEach(function (f) {
            var r = f.r;
            html += '<tr style="border-bottom:1px solid #e2e8f0;background:' + (f.alertas.length ? '#fffbeb' : '#fff') + ';">' +
                '<td style="padding:8px;"><b>' + esc(r.folio) + '</b><br><small style="color:#64748b;">' + esc(r.clienteNombre || '-') + '</small></td>' +
                '<td style="padding:8px;">' + esc(r.nombreProducto || (f.p && f.p.nombre) || r.productoId) + '<br><small style="color:#94a3b8;">desde ' + esc(String(r.fechaCreacion || '').slice(0, 10)) + '</small></td>' +
                '<td style="padding:8px;">' + esc(r.color || '(sin color)') + '<br><small style="color:#64748b;">' + esc(r.ubicacion || '(sin ubicación)') + '</small></td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;">' + num(r.cantidad) + '</td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;color:' + (f.fisico < num(r.cantidad) ? '#b45309' : '#16a34a') + ';">' + f.fisico + '</td>' +
                '<td style="padding:8px;font-size:12px;">' + (f.alertas.length
                    ? f.alertas.map(function (a) { return '<div style="color:#b45309;">⚠️ ' + esc(a) + '</div>'; }).join('')
                    : '<span style="color:#16a34a;">✅ Vigente</span>') + '</td>' +
                '<td style="padding:8px;text-align:right;"><button onclick="liberarReservaInvManual(\'' + jsArg(r.id) + '\')" ' +
                'style="padding:6px 10px;background:#fff;color:#b91c1c;border:1px solid #fca5a5;border-radius:6px;font-weight:bold;cursor:pointer;font-size:12px;">Liberar</button></td></tr>';
        });
        return html + '</tbody></table></div>';
    }

    function htmlSegunda() {
        var prods = StorageService.get('productos', []) || [];
        var filas = [];
        prods.forEach(function (p) {
            var enVariantes = 0;
            (p.variantes || []).forEach(function (v) {
                var q = num(v.stockSegunda);
                if (q > 0) {
                    enVariantes += q;
                    filas.push({ p: p, color: v.color || 'General', ubicacion: v.ubicacion || 'General', q: q, accion: true });
                }
            });
            var resto = num(p.stockSegunda) - enVariantes;
            if (resto > 0) filas.push({ p: p, color: '-', ubicacion: '-', q: resto, accion: false });
        });
        filas = filas.filter(function (f) { return coincide([f.p.nombre, f.color, f.ubicacion].join(' ')); });
        var total = filas.reduce(function (s, f) { return s + f.q; }, 0);
        var html = '<div style="font-size:13px;color:#475569;margin-bottom:8px;"><b>' + total + '</b> pieza(s) de segunda en <b>' + filas.length + '</b> renglón(es).<br>' +
            '<small style="color:#64748b;">La segunda va aparte del stock nuevo. Si una devolución entró como segunda por error (pieza nueva), usa «Pasar a nuevo»: queda en kardex y auditoría.</small></div>';
        if (!filas.length) return html + '<div style="padding:30px;text-align:center;color:#94a3b8;">No hay stock de segunda.</div>';
        html += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:13px;">' +
            '<thead style="background:#f1f5f9;"><tr><th style="padding:8px;text-align:left;">Producto</th><th style="padding:8px;text-align:left;">Color · Ubicación</th>' +
            '<th style="padding:8px;text-align:center;">Segunda</th><th style="padding:8px;"></th></tr></thead><tbody>';
        filas.forEach(function (f) {
            html += '<tr style="border-bottom:1px solid #e2e8f0;">' +
                '<td style="padding:8px;"><b>' + esc(f.p.nombre) + '</b><br><small style="color:#94a3b8;">' + esc(f.p.id) + '</small></td>' +
                '<td style="padding:8px;">' + esc(f.color) + '<br><small style="color:#64748b;">' + esc(f.ubicacion) + '</small></td>' +
                '<td style="padding:8px;text-align:center;font-weight:bold;color:#991b1b;">' + f.q + '</td>' +
                '<td style="padding:8px;text-align:right;">' + (f.accion
                    ? '<button onclick="reclasificarSegundaANuevoInv(\'' + jsArg(f.p.id) + '\',\'' + jsArg(f.color) + '\',\'' + jsArg(f.ubicacion) + '\')" ' +
                    'style="padding:6px 10px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-weight:bold;cursor:pointer;font-size:12px;">↩ Pasar a nuevo</button>'
                    : '<small style="color:#94a3b8;">sin desglose por ubicación</small>') + '</td></tr>';
        });
        return html + '</tbody></table></div>';
    }

    // ------------------------------------------------------------------
    // Acciones
    // ------------------------------------------------------------------
    function liberarReservaInvManual(reservaId) {
        if (typeof _invRequireAdmin === 'function' && !_invRequireAdmin('Liberar reserva de inventario')) return;
        var lista = StorageService.get('reservasInventario', []) || [];
        var r = lista.find(function (x) { return x.id === reservaId && x.estado === 'Activa'; });
        if (!r) return alert('La reserva ya no está activa.');
        var ap = (StorageService.get('apartados', []) || []).find(function (a) { return a.folio === r.folio; });
        var vigente = ap && norm(ap.estado) === 'PENDIENTE';
        var aviso = vigente
            ? '⚠️ El apartado ' + r.folio + ' sigue VIGENTE. Si liberas esta reserva, la pieza podrá venderse a otro cliente y al liquidar el apartado no habrá reserva que entregar.\n\nLo correcto para dar de baja un apartado es cancelarlo desde Apartados.\n\n'
            : 'El apartado ' + r.folio + (ap ? ' está "' + ap.estado + '"' : ' no existe') + ': la reserva está huérfana y bloquea stock sin motivo.\n\n';
        if (!confirm(aviso + 'Liberar ' + num(r.cantidad) + ' pza de "' + (r.nombreProducto || r.productoId) + '" (' + (r.color || 'sin color') + ' / ' + (r.ubicacion || 'sin ubicación') + ')?\nNo se mueve stock físico.')) return;
        var motivo = prompt('Motivo de la liberación (queda en auditoría):', vigente ? '' : 'Reserva huérfana');
        if (motivo === null) return;
        if (!String(motivo).trim()) return alert('Escribe un motivo para la auditoría.');
        r.estado = 'Liberada';
        r.motivoLiberacion = 'Liberada manualmente desde panel de reservas: ' + String(motivo).trim();
        r.fechaResolucion = window.localISO ? window.localISO(new Date()) : new Date().toISOString();
        if (!StorageService.set('reservasInventario', lista)) return alert('No se pudo guardar la liberación.');
        if (window.AuditService && window.AuditService.log) {
            window.AuditService.log({
                accion: 'INVENTARIO_RESERVA_LIBERADA_MANUAL', modulo: 'Inventario', entidad: r.nombreProducto || r.productoId, entidadId: r.productoId,
                detalle: 'Reserva ' + r.id + ' (folio ' + r.folio + ', ' + num(r.cantidad) + ' pza) liberada a mano. Motivo: ' + String(motivo).trim(),
                severidad: vigente ? 'alerta' : 'info', datos: { reservaId: r.id, folio: r.folio, apartadoVigente: !!vigente }
            });
        }
        render();
        if (typeof window.renderInventario === 'function') window.renderInventario();
    }

    function reclasificarSegundaANuevoInv(productoId, color, ubicacion) {
        if (typeof _invRequireAdmin === 'function' && !_invRequireAdmin('Reclasificar stock de segunda a nuevo')) return;
        var prods = StorageService.get('productos', []) || [];
        var p = prods.find(function (x) { return String(x.id) === String(productoId); });
        if (!p) return alert('Producto no encontrado.');
        var v = (p.variantes || []).find(function (x) {
            return norm(x.color || 'General') === norm(color) && norm(x.ubicacion || 'General') === norm(ubicacion);
        });
        var disp = num(v && v.stockSegunda);
        if (disp <= 0) return alert('Esa variante ya no tiene stock de segunda.');
        var cantTxt = prompt('¿Cuántas piezas de "' + p.nombre + '" (' + color + ' / ' + ubicacion + ') pasan de SEGUNDA a NUEVO?\nHay ' + disp + ' de segunda.', '1');
        if (cantTxt === null) return;
        var cant = Math.floor(Number(cantTxt));
        if (!(cant > 0) || cant > disp) return alert('Cantidad inválida (máximo ' + disp + ').');
        var motivo = prompt('Motivo (queda en kardex y auditoría):', 'Reingreso por cancelación marcado por error como segunda');
        if (motivo === null) return;
        motivo = String(motivo).trim() || 'Corrección: segunda a nuevo';
        if (!confirm('Pasar ' + cant + ' pza de SEGUNDA a NUEVO?\n' + p.nombre + ' (' + color + ' / ' + ubicacion + ')\nSegunda: ' + num(p.stockSegunda) + ' → ' + (num(p.stockSegunda) - cant) +
            '\nNuevo: ' + num(p.stock) + ' → ' + (num(p.stock) + cant))) return;

        var salida = ajustarStockVariante(prods, p.id, cant, { color: v.color || 'General', ubicacion: v.ubicacion || 'General', modo: 'salida', condicion: 'segunda', concepto: motivo });
        if (!salida.ok || salida.stockNegativoDetectado) return alert('No se pudo descontar de segunda; no se guardó nada.');
        ajustarStockVariante(prods, p.id, cant, { color: v.color || 'General', ubicacion: v.ubicacion || 'General', modo: 'entrada', condicion: 'nuevo', concepto: motivo });
        registrarMovimiento(p.id, motivo + ' (sale de SEGUNDA)', cant, 'salida', { referencia: 'CORR-SEGUNDA-NUEVO', destinoStock: 'segunda' });
        registrarMovimiento(p.id, motivo + ' (entra a NUEVO)', cant, 'entrada', { referencia: 'CORR-SEGUNDA-NUEVO', destinoStock: 'nuevo' });
        StorageService.set('productos', prods);
        window.productos = prods;
        try { productos = prods; } catch (e) { }
        if (window.AuditService && window.AuditService.log) {
            window.AuditService.log({
                accion: 'INVENTARIO_RECLASIFICA_SEGUNDA_NUEVO', modulo: 'Inventario', entidad: p.nombre, entidadId: p.id,
                detalle: cant + ' pza ' + color + '/' + ubicacion + '. ' + motivo, datos: { productoId: p.id, cantidad: cant, color: color, ubicacion: ubicacion }
            });
        }
        render();
        if (typeof window.renderInventario === 'function') window.renderInventario();
    }

    window.abrirPanelReservasInv = abrirPanelReservasInv;
    window.cerrarPanelReservasInv = cerrarPanelReservasInv;
    window._reservasInvTab = cambiarTab;
    window._reservasInvFiltro = cambiarFiltro;
    window.liberarReservaInvManual = liberarReservaInvManual;
    window.reclasificarSegundaANuevoInv = reclasificarSegundaANuevoInv;
    window.invBadgesReservaSegunda = invBadgesReservaSegunda;
    window.invReservadoEn = invReservadoEn;
})();
