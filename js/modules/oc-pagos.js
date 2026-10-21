/* =====================================================================
 * PAGOS DE ÓRDENES DE COMPRA -- avance, conciliación con caja y
 * estado de pagos compartible con el proveedor
 * ---------------------------------------------------------------------
 * Antes una OC solo mostraba "Saldo: $X": no había forma de ver sus
 * pagos uno por uno, de cotejar que cada pago saliera de caja/banco, ni
 * de mandarle al proveedor cómo va su cuenta.
 *
 *   💳 verPagosOC(id)        Modal interno: total, pagado, saldo, % de
 *                            avance y cada pago con su movimiento de
 *                            caja (✅ en caja / ⚠️ sin movimiento) y el
 *                            botón para regularizar el faltante.
 *   📤 compartirPagosOC(id)  Estado de pagos limpio para el proveedor
 *                            (sin cuentas internas): imprimir/PDF,
 *                            imagen, copiar texto y WhatsApp.
 *
 * Fuente de datos (no se inventa nada): oc.total, oc.anticipo_pagado,
 * oc.saldoPendiente, oc.pagos[] y la tabla movimientosCaja.
 * Depende de compras.js: dinero, _egresarCuenta, _resolverCuentaMovimiento,
 * _buildSelectorCuentas, _comprasRequireAdmin, _getOrdenesCompra.
 * ===================================================================== */
(function () {
    'use strict';

    function esc(v) {
        return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    function money(v) { return typeof dinero === 'function' ? dinero(v) : '$' + num(v).toFixed(2); }
    function fechaCorta(f) {
        if (!f) return '-';
        return window.formatearFechaCortaMX ? window.formatearFechaCortaMX(f) : String(f).slice(0, 10);
    }
    function ordenPorId(id) {
        var lista = StorageService.get('ordenesCompra', []) || [];
        return lista.find(function (o) { return String(o.id) === String(id); });
    }
    function nombreCuenta(c) {
        if (!c) return '';
        var todas = (StorageService.get('cuentasEfectivo', []) || []).concat(StorageService.get('cuentas-bancarias', []) || []);
        var m = todas.find(function (x) {
            return String(x.id) === String(c) || String(x.banco) === String(c) ||
                (x.idCuenta && String(x.idCuenta) === String(c));
        });
        if (!m && typeof window.buscarBancoPorValor === 'function') {
            var e = window.buscarBancoPorValor(c, 'debito');
            if (e) m = todas.find(function (x) { return String(x.banco) === String(e.banco); });
        }
        return m ? (m.nombre || c) : c;
    }
    function nombreEmpresa() {
        var cfg = StorageService.get('configEmpresa', {}) || {};
        return cfg.nombre || 'Mueblería Mi Pueblito';
    }

    /** Totales de la OC con las MISMAS fuentes que la lista de OC (anticipo_pagado / saldoPendiente). */
    function resumen(oc) {
        var total = num(oc.total);
        var pagado = num(oc.anticipo_pagado);
        var saldo = oc.saldoPendiente !== undefined ? num(oc.saldoPendiente) : Math.max(0, total - pagado);
        var pct = total > 0 ? Math.max(0, Math.min(100, Math.round((pagado / total) * 100))) : 0;
        if (saldo <= 0.009 && total > 0) pct = 100;
        return { total: total, pagado: pagado, saldo: saldo, pct: pct, liquidada: saldo <= 0.009 && total > 0 };
    }

    /** Pagos de la OC + un renglón "sin detalle" si anticipo_pagado supera lo documentado. */
    function pagosDe(oc) {
        var pagos = (Array.isArray(oc.pagos) ? oc.pagos : []).map(function (p, i) {
            return { idx: i, fecha: p.fecha, monto: num(p.monto), cuenta: p.cuenta || '', referencia: p.referencia || p.idOperacion || '', sinDetalle: false };
        });
        var documentado = pagos.reduce(function (s, p) { return s + p.monto; }, 0);
        var faltante = num(oc.anticipo_pagado) - documentado;
        if (faltante > 0.009) {
            pagos.push({ idx: -1, fecha: null, monto: faltante, cuenta: '', referencia: '', sinDetalle: true });
        }
        return pagos;
    }

    /** Liga cada pago con su egreso en movimientosCaja (exacto por referencia; si no, por folio/proveedor). */
    function conciliar(oc, pagos) {
        var movs = (StorageService.get('movimientosCaja', []) || []).filter(function (m) {
            return String(m.tipo || '').toLowerCase() !== 'ingreso';
        });
        var usados = {};
        var folio = String(oc.folio || '');
        var prov = String(oc.proveedorNombre || '').toLowerCase();
        function libre(m) { return !usados[m.id]; }
        function mismoMonto(m, p) { return Math.abs(num(m.monto) - p.monto) < 0.01; }
        function dias(a, b) {
            var x = new Date(a), y = new Date(b);
            return isNaN(x) || isNaN(y) ? 999 : Math.abs(x - y) / 86400000;
        }
        return pagos.map(function (p) {
            if (p.sinDetalle) return { pago: p, mov: null, estado: 'sin-detalle' };
            var m = null;
            if (p.referencia) {
                m = movs.find(function (x) { return libre(x) && mismoMonto(x, p) && (x.referencia === p.referencia || x.idOperacion === p.referencia); });
            }
            if (!m) {
                m = movs.find(function (x) {
                    return libre(x) && mismoMonto(x, p) && (String(x.referencia || '') === folio || (folio && String(x.concepto || '').indexOf(folio) !== -1));
                });
            }
            if (!m) {
                m = movs.find(function (x) {
                    var c = String(x.concepto || '').toLowerCase();
                    return libre(x) && mismoMonto(x, p) && c.indexOf('anticipo oc') !== -1 && prov && c.indexOf(prov) !== -1 && dias(x.fecha, p.fecha) <= 2;
                });
            }
            if (m) usados[m.id] = true;
            return { pago: p, mov: m || null, estado: m ? 'ok' : 'falta' };
        });
    }

    // ------------------------------------------------------------------
    // Vista interna: avance + conciliación con caja
    // ------------------------------------------------------------------
    function verPagosOC(id) {
        var oc = ordenPorId(id);
        if (!oc) return alert('No encontré la orden de compra.');
        document.querySelector('[data-modal="oc-pagos"]')?.remove();
        var r = resumen(oc);
        var filas = conciliar(oc, pagosDe(oc));
        var faltan = filas.filter(function (f) { return f.estado === 'falta'; }).length;

        var tabla = filas.length ? filas.map(function (f, i) {
            var p = f.pago, celda;
            if (f.estado === 'ok') {
                celda = '<span style="color:#15803d;font-weight:bold;">✅ En caja</span><br><small style="color:#64748b;">' +
                    esc(f.mov.etiquetaCuenta || f.mov.cuenta || '') + ' · ' + esc(fechaCorta(f.mov.fecha)) + '</small>';
            } else if (f.estado === 'sin-detalle') {
                celda = '<small style="color:#64748b;">Pagos anteriores sin detalle (no se puede cotejar uno por uno)</small>';
            } else {
                celda = '<span style="color:#b45309;font-weight:bold;">⚠️ Sin movimiento en caja</span><br>' +
                    '<button onclick="registrarPagoOCEnCaja(' + oc.id + ',' + p.idx + ')" style="margin-top:4px;padding:5px 9px;background:#fff;color:#b45309;border:1px solid #fcd34d;border-radius:6px;font-weight:bold;font-size:12px;cursor:pointer;">Registrar en caja</button>';
            }
            return '<tr style="border-bottom:1px solid #e2e8f0;">' +
                '<td style="padding:9px;">' + (i + 1) + '</td>' +
                '<td style="padding:9px;">' + (p.sinDetalle ? '-' : esc(fechaCorta(p.fecha))) + '</td>' +
                '<td style="padding:9px;">' + esc(nombreCuenta(p.cuenta) || '-') + '</td>' +
                '<td style="padding:9px;text-align:right;font-weight:bold;">' + money(p.monto) + '</td>' +
                '<td style="padding:9px;font-size:12px;">' + celda + '</td></tr>';
        }).join('') : '<tr><td colspan="5" style="padding:22px;text-align:center;color:#94a3b8;">Esta orden aún no tiene pagos registrados.</td></tr>';

        var html =
            '<div data-modal="oc-pagos" style="position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:12px;">' +
            '<div style="background:#fff;border-radius:12px;width:100%;max-width:760px;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 10px 25px rgba(0,0,0,0.25);">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">' +
            '<div><h3 style="margin:0;color:#1e40af;">💳 Pagos de la OC ' + esc(oc.folio) + '</h3>' +
            '<div style="color:#64748b;font-size:13px;margin-top:2px;">' + esc(oc.proveedorNombre || '') + '</div></div>' +
            '<button onclick="document.querySelector(\'[data-modal=oc-pagos]\').remove()" style="padding:7px 12px;background:#e2e8f0;color:#475569;border:none;border-radius:6px;font-weight:bold;cursor:pointer;">Cerrar</button></div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0 10px;">' +
            '<div style="background:#eff6ff;border-radius:8px;padding:10px;"><small style="color:#64748b;">Total OC</small><div style="font-size:18px;font-weight:bold;color:#1e40af;">' + money(r.total) + '</div></div>' +
            '<div style="background:#f0fdf4;border-radius:8px;padding:10px;"><small style="color:#64748b;">Pagado</small><div style="font-size:18px;font-weight:bold;color:#15803d;">' + money(r.pagado) + '</div></div>' +
            '<div style="background:#fef2f2;border-radius:8px;padding:10px;"><small style="color:#64748b;">Saldo pendiente</small><div style="font-size:18px;font-weight:bold;color:#dc2626;">' + money(r.saldo) + '</div></div></div>' +
            '<div style="background:#e2e8f0;border-radius:999px;height:14px;overflow:hidden;"><div style="width:' + r.pct + '%;height:100%;background:' + (r.liquidada ? '#16a34a' : '#2563eb') + ';"></div></div>' +
            '<div style="font-size:12px;color:#475569;margin:5px 0 14px;font-weight:bold;">Avance de pago: ' + r.pct + '%' + (r.liquidada ? ' · LIQUIDADA ✅' : '') + '</div>' +
            (faltan ? '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:13px;color:#92400e;">' +
                '⚠️ <b>' + faltan + ' pago(s) cuentan en la OC pero no tienen movimiento en caja.</b> Si ese dinero sí salió y tu saldo de cuenta aún no lo refleja, usa «Registrar en caja». ' +
                'Si el saldo de la cuenta ya lo descontó, revisa primero Corte de caja (fecha, cuenta y cortes ya hechos) para no restarlo dos veces.</div>' : '') +
            '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead style="background:#f1f5f9;"><tr>' +
            '<th style="padding:9px;text-align:left;">#</th><th style="padding:9px;text-align:left;">Fecha</th><th style="padding:9px;text-align:left;">Cuenta</th>' +
            '<th style="padding:9px;text-align:right;">Monto</th><th style="padding:9px;text-align:left;">Movimiento de caja</th></tr></thead><tbody>' + tabla + '</tbody></table></div>' +
            '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">' +
            '<button onclick="compartirPagosOC(' + oc.id + ')" style="flex:1 1 220px;padding:12px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">📤 Compartir con el proveedor</button>' +
            (r.saldo > 0.009 ? '<button onclick="document.querySelector(\'[data-modal=oc-pagos]\').remove();abrirModalAbonoOC(' + oc.id + ')" style="flex:1 1 160px;padding:12px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">💰 Registrar pago</button>' : '') +
            '</div></div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    }

    // ------------------------------------------------------------------
    // Regularizar un pago que no tiene egreso en caja
    // ------------------------------------------------------------------
    function registrarPagoOCEnCaja(idOC, idxPago) {
        if (typeof _comprasRequireAdmin === 'function' && !_comprasRequireAdmin('Registrar pago de OC en caja')) return;
        var oc = ordenPorId(idOC);
        if (!oc || !oc.pagos || !oc.pagos[idxPago]) return alert('No encontré ese pago.');
        var p = oc.pagos[idxPago];
        document.querySelector('[data-modal="oc-pago-caja"]')?.remove();
        var html =
            '<div data-modal="oc-pago-caja" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10010;display:flex;align-items:center;justify-content:center;padding:12px;">' +
            '<div style="background:#fff;border-radius:12px;width:100%;max-width:430px;padding:22px;">' +
            '<h3 style="margin:0 0 6px;color:#b45309;">Registrar pago en caja</h3>' +
            '<div style="font-size:13px;color:#475569;margin-bottom:12px;">OC <b>' + esc(oc.folio) + '</b> · ' + esc(oc.proveedorNombre || '') + '<br>Pago de <b>' + money(p.monto) + '</b> del ' + esc(fechaCorta(p.fecha)) + '</div>' +
            '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px;font-size:12px;color:#92400e;margin-bottom:12px;">Esto <b>resta ' + money(p.monto) + ' del saldo de la cuenta</b> y crea el egreso en movimientos de caja con la fecha del pago. No cambia el saldo de la OC (ya estaba aplicado).</div>' +
            '<label style="font-size:12px;font-weight:bold;">¿De qué cuenta salió el dinero?</label>' +
            window._buildSelectorCuentas('cuentaRegPagoOC', false) +
            '<div style="display:flex;gap:10px;margin-top:16px;">' +
            '<button onclick="confirmarPagoOCEnCaja(' + oc.id + ',' + idxPago + ')" style="flex:2;padding:11px;background:#b45309;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Registrar egreso</button>' +
            '<button onclick="document.querySelector(\'[data-modal=oc-pago-caja]\').remove()" style="flex:1;padding:11px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;cursor:pointer;">Cancelar</button></div>' +
            '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
        // Preselecciona la cuenta del pago si se puede reconocer
        try {
            var sel = document.getElementById('cuentaRegPagoOC');
            var buscada = String(p.cuenta || '').toLowerCase();
            // Un banco puede venir guardado por su idCuenta: se traduce al nombre actual del banco.
            var buscadaBanco = String(window.claveBancoVisible ? window.claveBancoVisible(p.cuenta || '') : '').toLowerCase();
            Array.prototype.forEach.call(sel.options, function (o) {
                var ov = o.value.toLowerCase();
                if (ov === buscada || o.text.toLowerCase() === buscada || (buscadaBanco && ov === buscadaBanco)) sel.value = o.value;
            });
        } catch (e) { }
    }

    function confirmarPagoOCEnCaja(idOC, idxPago) {
        if (typeof _comprasRequireAdmin === 'function' && !_comprasRequireAdmin('Registrar pago de OC en caja')) return;
        var lista = StorageService.get('ordenesCompra', []) || [];
        var idx = lista.findIndex(function (o) { return String(o.id) === String(idOC); });
        if (idx === -1 || !lista[idx].pagos || !lista[idx].pagos[idxPago]) return;
        var oc = lista[idx], p = oc.pagos[idxPago];
        var sel = document.getElementById('cuentaRegPagoOC');
        var cuentaId = sel.value, etiqueta = sel.options[sel.selectedIndex].text;
        if (!confirm('¿Registrar el egreso de ' + money(p.monto) + ' desde "' + etiqueta + '"?\nSe restará de esa cuenta.')) return;
        var opId = 'REG-OC-' + oc.id + '-' + idxPago + '-' + Date.now();
        var ok = window._egresarCuenta({
            monto: p.monto, cuentaId: cuentaId, etiqueta: etiqueta,
            concepto: 'Abono a Orden de Compra ' + oc.folio + ' (regularización)',
            referencia: p.referencia || oc.folio, idOperacion: opId, fecha: p.fecha
        });
        if (!ok) return alert('No se pudo registrar el egreso. El pago de la OC no se modificó.');
        p.referencia = opId;
        p.cuenta = etiqueta;
        p.regularizadoEnCaja = true;
        StorageService.set('ordenesCompra', lista);
        if (window.AuditService && window.AuditService.log) {
            window.AuditService.log({
                accion: 'OC_PAGO_REGULARIZADO_EN_CAJA', modulo: 'Compras', entidad: oc.folio, entidadId: oc.id, monto: num(p.monto),
                detalle: 'Egreso de caja registrado a posteriori para un pago de la OC ' + oc.folio, severidad: 'riesgo', datos: { cuentaId: cuentaId, etiqueta: etiqueta, idOperacion: opId }
            });
        }
        document.querySelector('[data-modal="oc-pago-caja"]')?.remove();
        verPagosOC(oc.id);
        if (typeof window.renderListaOrdenesCompra === 'function') window.renderListaOrdenesCompra();
    }

    // ------------------------------------------------------------------
    // Estado de pagos para el proveedor
    // ------------------------------------------------------------------
    function formaPago(cuenta) {
        return /efectivo|caja/i.test(String(cuenta || '')) ? 'Efectivo' : (cuenta ? 'Transferencia / depósito' : '-');
    }

    function htmlEstadoProveedor(oc) {
        var r = resumen(oc);
        var pagos = pagosDe(oc);
        var filas = pagos.length ? pagos.map(function (p, i) {
            return '<tr><td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;">' + (i + 1) + '</td>' +
                '<td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;">' + (p.sinDetalle ? 'Pagos anteriores' : esc(fechaCorta(p.fecha))) + '</td>' +
                '<td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;">' + (p.sinDetalle ? '-' : esc(formaPago(p.cuenta))) + '</td>' +
                '<td style="padding:9px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">' + money(p.monto) + '</td></tr>';
        }).join('') : '<tr><td colspan="4" style="padding:18px;text-align:center;color:#94a3b8;">Aún no se registran pagos.</td></tr>';
        var badge = r.liquidada ? { t: 'LIQUIDADA', bg: '#dcfce7', fg: '#166534' } : (r.pagado > 0 ? { t: 'PAGO PARCIAL', bg: '#fef3c7', fg: '#92400e' } : { t: 'SIN PAGOS', bg: '#e2e8f0', fg: '#475569' });
        return '<div id="ocPagosDoc" style="width:640px;max-width:100%;background:#fff;font-family:\'Segoe UI\',Arial,sans-serif;color:#0f172a;border-top:6px solid #1e40af;padding:24px;box-sizing:border-box;">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:16px;">' +
            '<div><div style="font-size:19px;font-weight:800;color:#1e40af;">' + esc(nombreEmpresa()) + '</div>' +
            '<div style="font-size:12px;color:#64748b;letter-spacing:.05em;font-weight:700;margin-top:3px;">ESTADO DE PAGOS · ORDEN DE COMPRA</div></div>' +
            '<div style="text-align:right;"><div style="font-size:17px;font-weight:800;">' + esc(oc.folio) + '</div>' +
            '<span style="display:inline-block;margin-top:4px;padding:3px 11px;border-radius:999px;background:' + badge.bg + ';color:' + badge.fg + ';font-size:11px;font-weight:800;">' + badge.t + '</span></div></div>' +
            '<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:16px;font-size:13px;line-height:1.7;">' +
            'Proveedor: <b>' + esc(oc.proveedorNombre || '-') + '</b><br>Fecha de la orden: <b>' + esc(fechaCorta(oc.fechaEmision)) + '</b>' +
            (oc.fechaEntregaEstimada ? '<br>Entrega estimada: <b>' + esc(fechaCorta(oc.fechaEntregaEstimada)) + '</b>' : '') + '</div>' +
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;">' +
            '<div style="background:#eff6ff;border-radius:10px;padding:11px;"><div style="font-size:11px;color:#64748b;font-weight:700;">TOTAL DE LA ORDEN</div><div style="font-size:18px;font-weight:800;color:#1e40af;">' + money(r.total) + '</div></div>' +
            '<div style="background:#f0fdf4;border-radius:10px;padding:11px;"><div style="font-size:11px;color:#64748b;font-weight:700;">PAGADO</div><div style="font-size:18px;font-weight:800;color:#15803d;">' + money(r.pagado) + '</div></div>' +
            '<div style="background:#fef2f2;border-radius:10px;padding:11px;"><div style="font-size:11px;color:#64748b;font-weight:700;">SALDO PENDIENTE</div><div style="font-size:18px;font-weight:800;color:#dc2626;">' + money(r.saldo) + '</div></div></div>' +
            '<div style="background:#e2e8f0;border-radius:999px;height:16px;overflow:hidden;"><div style="width:' + r.pct + '%;height:100%;background:' + (r.liquidada ? '#16a34a' : '#2563eb') + ';"></div></div>' +
            '<div style="font-size:12px;font-weight:700;color:#475569;margin:6px 0 16px;">Avance de pago: ' + r.pct + '%</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:#f1f5f9;">' +
            '<th style="padding:9px 10px;text-align:left;">#</th><th style="padding:9px 10px;text-align:left;">Fecha</th><th style="padding:9px 10px;text-align:left;">Forma de pago</th><th style="padding:9px 10px;text-align:right;">Monto</th></tr></thead>' +
            '<tbody>' + filas + '</tbody></table>' +
            '<div style="font-size:11px;color:#94a3b8;margin-top:16px;">Documento informativo generado el ' + esc(fechaCorta(new Date())) + '. Cualquier aclaración, con ' + esc(nombreEmpresa()) + '.</div></div>';
    }

    function textoResumen(oc) {
        var r = resumen(oc), pagos = pagosDe(oc);
        var lineas = [
            '*' + nombreEmpresa() + '* — Estado de pagos',
            'Orden de compra ' + oc.folio + ' · ' + (oc.proveedorNombre || ''),
            'Total: ' + money(r.total) + ' | Pagado: ' + money(r.pagado) + ' | Saldo: ' + money(r.saldo) + ' (avance ' + r.pct + '%)' + (r.liquidada ? ' — LIQUIDADA' : '')
        ];
        if (pagos.length) {
            lineas.push('Pagos:');
            pagos.forEach(function (p, i) {
                lineas.push((i + 1) + ') ' + (p.sinDetalle ? 'Pagos anteriores' : fechaCorta(p.fecha)) + ' — ' + money(p.monto) + (p.sinDetalle ? '' : ' (' + formaPago(p.cuenta) + ')'));
            });
        }
        return lineas.join('\n');
    }

    function compartirPagosOC(id) {
        var oc = ordenPorId(id);
        if (!oc) return alert('No encontré la orden de compra.');
        document.querySelector('[data-modal="oc-compartir"]')?.remove();
        var html =
            '<div data-modal="oc-compartir" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:10020;display:flex;align-items:center;justify-content:center;padding:12px;">' +
            '<div style="background:#f1f5f9;border-radius:12px;width:100%;max-width:700px;max-height:94vh;overflow:auto;padding:18px;">' +
            '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">' +
            '<button onclick="ocPagosImprimir(' + oc.id + ')" style="padding:10px 14px;background:#1e40af;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🖨️ Imprimir / PDF</button>' +
            '<button onclick="ocPagosImagen(' + oc.id + ')" style="padding:10px 14px;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🖼️ Imagen / compartir</button>' +
            '<button onclick="ocPagosCopiar(' + oc.id + ')" style="padding:10px 14px;background:#7c3aed;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">📋 Copiar texto</button>' +
            '<button onclick="ocPagosWhatsApp(' + oc.id + ')" style="padding:10px 14px;background:#25d366;color:#fff;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">💬 WhatsApp</button>' +
            '<button onclick="document.querySelector(\'[data-modal=oc-compartir]\').remove()" style="margin-left:auto;padding:10px 14px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Cerrar</button></div>' +
            '<div style="display:flex;justify-content:center;overflow-x:auto;">' + htmlEstadoProveedor(oc) + '</div>' +
            '<div style="font-size:12px;color:#64748b;margin-top:10px;text-align:center;">Este documento no muestra tus cuentas bancarias ni movimientos internos de caja.</div>' +
            '</div></div>';
        document.body.insertAdjacentHTML('beforeend', html);
    }

    function ocPagosImprimir(id) {
        var oc = ordenPorId(id);
        if (!oc) return;
        var doc = htmlEstadoProveedor(oc);
        var opts = { html: doc, title: 'Estado de pagos ' + oc.folio, filename: 'estado_pagos_' + oc.folio, pageSize: 'letter' };
        if (window.TicketService && window.TicketService.elegirFormato) return window.TicketService.elegirFormato(opts);
        if (window.TicketService && window.TicketService.openDocument) return window.TicketService.openDocument(doc, { title: opts.title, filename: opts.filename, pageSize: 'letter', autoPrint: true });
        var w = window.open('', '_blank', 'width=800,height=900');
        if (!w) return alert('Habilita las ventanas emergentes para imprimir.');
        w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + esc(opts.title) + '</title></head><body style="margin:20px;">' + doc + '<script>setTimeout(function(){window.print();},300)<\/script></body></html>');
        w.document.close();
    }

    function cargarHtml2Canvas(cb) {
        if (typeof html2canvas !== 'undefined') return cb();
        if (typeof _cargarHtml2CanvasEstadoProveedor === 'function') return _cargarHtml2CanvasEstadoProveedor(cb);
        var s = document.createElement('script');
        s.src = new URL('js/vendor/html2canvas.min.js', document.baseURI).href;
        s.onload = cb;
        s.onerror = function () { alert('No se pudo cargar el motor de imagen. Usa Imprimir / PDF.'); };
        document.head.appendChild(s);
    }

    function ocPagosImagen(id) {
        var oc = ordenPorId(id);
        var nodo = document.getElementById('ocPagosDoc');
        if (!oc || !nodo) return;
        cargarHtml2Canvas(function () {
            html2canvas(nodo, { backgroundColor: '#ffffff', scale: 2, useCORS: true }).then(function (canvas) {
                canvas.toBlob(function (blob) {
                    if (!blob) return alert('No se pudo generar la imagen.');
                    var nombre = 'estado_pagos_' + String(oc.folio).replace(/[^\w-]/g, '_') + '.png';
                    var archivo = new File([blob], nombre, { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [archivo] }) && navigator.share) {
                        navigator.share({ files: [archivo], title: 'Estado de pagos ' + oc.folio, text: textoResumen(oc) }).catch(function () { });
                        return;
                    }
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = nombre;
                    document.body.appendChild(a); a.click(); a.remove();
                    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
                    alert('Imagen descargada. Adjúntala en WhatsApp o correo para el proveedor.');
                }, 'image/png');
            }).catch(function () { alert('No se pudo generar la imagen. Usa Imprimir / PDF.'); });
        });
    }

    function ocPagosCopiar(id) {
        var oc = ordenPorId(id);
        if (!oc) return;
        var t = textoResumen(oc);
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(t).then(function () { alert('Resumen copiado. Pégalo en WhatsApp o correo.'); }, function () { prompt('Copia el resumen:', t); });
        } else prompt('Copia el resumen:', t);
    }

    function ocPagosWhatsApp(id) {
        var oc = ordenPorId(id);
        if (!oc) return;
        window.open('https://wa.me/?text=' + encodeURIComponent(textoResumen(oc)), '_blank');
    }

    window.verPagosOC = verPagosOC;
    window.compartirPagosOC = compartirPagosOC;
    window.registrarPagoOCEnCaja = registrarPagoOCEnCaja;
    window.confirmarPagoOCEnCaja = confirmarPagoOCEnCaja;
    window.ocPagosImprimir = ocPagosImprimir;
    window.ocPagosImagen = ocPagosImagen;
    window.ocPagosCopiar = ocPagosCopiar;
    window.ocPagosWhatsApp = ocPagosWhatsApp;
    window.ocPagosResumen = resumen;
    window.ocPagosConciliar = function (oc) { return conciliar(oc, pagosDe(oc)); };
})();
