// Reportes ejecutivos de ventas y compras.
// Capa de presentacion: sobreescribe los renderizadores legacy sin tocar la captura operativa.

(function() {
    const money = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));

    function arr(key) {
        const val = StorageService.get(key, []);
        let lista = Array.isArray(val) ? val : [];
        
        if (key === 'cuentasPorPagar') {
            return lista.map(cxp => {
                if (cxp.origenConsignacion || String(cxp.folioOrigen).startsWith('RCON-')) {
                    let clonDeuda = { ...cxp };
                    if (clonDeuda.vencimientoIso) {
                        clonDeuda.vencimiento = clonDeuda.vencimientoIso.substring(0, 10);
                    }
                    return clonDeuda;
                }
                return cxp;
            });
        }
        return lista;
    }

    function parseDate(value) {
        if (!value) return new Date(0);
        if (value instanceof Date) return isNaN(value.getTime()) ? new Date(0) : value;
        if (typeof value === 'number') return new Date(value);
        const raw = String(value).trim();
        if (!raw) return new Date(0);
        if (window.parseFechaMXOrNull) {
            try {
                const d = window.parseFechaMXOrNull(raw);
                if (d instanceof Date && !isNaN(d.getTime())) return d;
            } catch (e) {}
        }
        if (window.parseFechaMX) {
            try {
                const d = window.parseFechaMX(raw);
                if (d instanceof Date && !isNaN(d.getTime())) return d;
            } catch (e) {}
        }
        const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
        const mx = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
        if (mx) return new Date(Number(mx[3]), Number(mx[2]) - 1, Number(mx[1]), 12);
        const d = new Date(raw);
        return isNaN(d.getTime()) ? new Date(0) : d;
    }

    function dateLabel(d, fallback) {
        if (!(d instanceof Date) || isNaN(d.getTime()) || d.getFullYear() < 2000) return fallback || '-';
        if (window.formatearFechaVistaMX) return window.formatearFechaVistaMX(d, { fallback: fallback || '-' });
        return window.formatearFechaCortaMX ? window.formatearFechaCortaMX(d) : d.toLocaleDateString('es-MX');
    }

    function kpi(title, value, color, foot = '') {
        return `<div style="background:white;border:1px solid #e2e8f0;border-left:4px solid ${color};border-radius:8px;padding:15px;min-width:0;">
            <div style="font-size:11px;font-weight:900;color:#64748b;text-transform:uppercase;">${title}</div>
            <div style="font-size:23px;font-weight:900;color:${color};margin-top:5px;overflow-wrap:anywhere;">${value}</div>
            ${foot ? `<div style="font-size:12px;color:#64748b;margin-top:4px;">${foot}</div>` : ''}
        </div>`;
    }

    function reportTarget(appId, viewId) {
        const app = document.getElementById(appId);
        const view = document.getElementById(viewId);
        const visible = view && view.style.display !== 'none' && !view.classList.contains('oculto');
        if (visible) return app || view;
        return document.getElementById('contenidoReporte') || app || view;
    }

    function badge(text, bg, color) {
        return `<span style="display:inline-flex;padding:4px 9px;border-radius:999px;background:${bg};color:${color};font-size:11px;font-weight:900;">${esc(text)}</span>`;
    }

    function bars(items, total, color) {
        if (!items.length) return `<div style="padding:16px;text-align:center;color:#94a3b8;">Sin datos suficientes.</div>`;
        return items.map((it, idx) => {
            const pct = total > 0 ? Math.max(4, (it.value / total) * 100) : 0;
            return `<div style="display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
                <div style="font-weight:900;color:#94a3b8;">${idx + 1}</div>
                <div>
                    <div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;font-weight:800;color:#0f172a;">
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.name)}</span>
                        <span style="color:#64748b;">${esc(it.meta || '')}</span>
                    </div>
                    <div style="height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:5px;">
                        <div style="height:100%;width:${pct}%;background:${color};border-radius:999px;"></div>
                    </div>
                </div>
                <div style="font-size:13px;font-weight:900;color:${color};">${money(it.value)}</div>
            </div>`;
        }).join('');
    }

    function groupTop(list, keyFn, valueFn, metaFn) {
        const map = new Map();
        list.forEach(item => {
            const key = keyFn(item) || 'Sin dato';
            const row = map.get(key) || { name: key, value: 0, count: 0, metaRaw: 0 };
            row.value += Number(valueFn(item) || 0);
            row.count += 1;
            row.metaRaw += metaFn ? Number(metaFn(item) || 0) : 0;
            map.set(key, row);
        });
        return [...map.values()].sort((a, b) => b.value - a.value).slice(0, 5);
    }

    function chartByMonth(rows, valueFn, colorA, colorB) {
        const byMonth = new Map();
        rows.forEach(row => {
            if (!(row.date instanceof Date) || isNaN(row.date.getTime()) || row.date.getFullYear() < 2000) return;
            const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, '0')}`;
            const current = byMonth.get(key) || { total: 0, label: new Intl.DateTimeFormat('es-MX', { month: 'short' }).format(row.date) };
            current.total += Number(valueFn(row) || 0);
            byMonth.set(key, current);
        });
        const months = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
        const max = Math.max(1, ...months.map(([, m]) => m.total));
        const barsHtml = months.length ? months.map(([key, m]) => `
            <div title="${key}: ${money(m.total)}" style="flex:1;min-width:36px;height:${Math.max(10, (m.total / max) * 160)}px;background:linear-gradient(180deg,${colorA},${colorB});border-radius:6px 6px 2px 2px;color:white;font-size:10px;font-weight:900;display:flex;align-items:flex-start;justify-content:center;padding-top:5px;">${money(m.total).replace('.00','')}</div>
        `).join('') : `<div style="width:100%;align-self:center;text-align:center;color:#94a3b8;">Sin datos en el rango seleccionado.</div>`;
        const labels = months.map(([, m]) => `<div style="flex:1;min-width:36px;text-align:center;font-size:11px;color:#64748b;text-transform:uppercase;">${m.label}</div>`).join('');
        return `<div style="display:flex;align-items:flex-end;gap:6px;height:180px;padding:0 10px;">${barsHtml}</div><div style="display:flex;gap:6px;padding:4px 10px;margin-top:4px;">${labels}</div>`;
    }

    function saleItems(v) {
        const items = v.articulos || v.datosVenta?.articulos || [];
        return Array.isArray(items) ? items : (Array.isArray(items?.data) ? items.data : []);
    }

    function saleLiveBalance(folio, method, v, source) {
        const fallback = method === 'credito'
            ? Number(v.saldoAFinanciar || v.saldoActual || v.datosVenta?.saldoPendiente || v.args?.[3] || 0) || 0
            : method === 'apartado'
                ? Number(v.saldoAFinanciar || v.saldoPendiente || v.datosVenta?.saldoPendiente || v.args?.[3] || 0) || 0
                : 0;
        if (source !== 'registrada') return fallback;
        if (method === 'credito') {
            if (typeof window._calcularEstadoCuenta === 'function') {
                const estado = window._calcularEstadoCuenta(folio);
                if (estado) return Number(estado.saldoTotal || 0) || 0;
            }
            const cxc = arr('cuentasPorCobrar').find(c => String(c.folio || '') === String(folio));
            return Number(cxc?.saldoActual ?? fallback) || 0;
        }
        if (method === 'apartado') {
            const ap = arr('apartados').find(a => String(a.folio || '') === String(folio));
            return Number(ap?.saldoPendiente ?? fallback) || 0;
        }
        return fallback;
    }

    function normalizeSale(v, source, index = null) {
        const items = saleItems(v);
        const dateRaw = v.fechaVenta || v.fechaIso || v.fecha || v.datosVenta?.fechaIso || v.args?.[7] || '';
        const date = parseDate(dateRaw);
        const itemTotal = items.reduce((s, a) => s + ((Number(a.precioContado || a.precio || 0) || 0) * (Number(a.cantidad || 1) || 1)), 0);
        const totalMerch = Number(v.totalMercancia || v.totalContadoOriginal || v.importeApartado || itemTotal || v.totalVenta || v.total || v.args?.[1] || 0) || 0;
        const cost = items.reduce((s, a) => s + ((Number(a.costoUnitario || a.costo || a.precioCompra || 0) || 0) * (Number(a.cantidad || 1) || 1)), 0);
        const method = String(v.metodoPago || v.metodo || v.datosVenta?.metodo || v.args?.[0] || 'contado').toLowerCase();
        const folio = v.folio || v.datosVenta?.folio || v.args?.[5] || '-';
        return {
            raw: v,
            index,
            source,
            folio,
            date,
            dateText: dateLabel(date, v.fecha || v.datosVenta?.fecha || '-'),
            customer: v.clienteNombre || v.cliente?.nombre || v.datosVenta?.cliente?.nombre || 'Publico general',
            method,
            totalMerch,
            totalDoc: Number(v.total || v.totalVenta || v.datosVenta?.total || v.args?.[1] || totalMerch || 0) || 0,
            downPayment: Number(v.enganche || v.engancheRecibido || v.datosVenta?.enganche || v.args?.[2] || 0) || 0,
            initialCollected: Number(v.montoIngresoInicial ?? 0) || 0,
            account: v.cuentaReceptora || v.cuentaId || v.etiquetaCuenta || v.datosVenta?.cuentaReceptora || '',
            balance: saleLiveBalance(folio, method, v, source),
            items,
            units: items.reduce((s, a) => s + (Number(a.cantidad || 1) || 1), 0),
            cost,
            profit: cost > 0 ? Math.max(0, totalMerch - cost) : 0,
            seller: v.vendedor || v.vendedorNombre || v.vendedorSeleccionado?.nombre || '',
            status: source === 'cuarentena' ? 'En boveda' : (v.estado || v.estatus || 'Registrada')
        };
    }

    function filteredSales() {
        const filters = {
            q: String(document.getElementById('rvBusqueda')?.value || '').trim().toLowerCase(),
            from: document.getElementById('rvFechaDesde')?.value || '',
            to: document.getElementById('rvFechaHasta')?.value || '',
            method: document.getElementById('rvMetodo')?.value || '',
            status: document.getElementById('rvEstado')?.value || 'activas',
            order: document.getElementById('rvOrden')?.value || 'fecha_desc'
        };
        window._rplusVentaFiltros = filters;
        const fromD = filters.from ? (window.fechaInicioDiaMX ? window.fechaInicioDiaMX(filters.from) : new Date(filters.from + 'T00:00:00')) : null;
        const toD = filters.to ? (window.fechaFinDiaMX ? window.fechaFinDiaMX(filters.to) : new Date(filters.to + 'T23:59:59')) : null;
        const rows = [
            ...arr('ventasRegistradas').map(v => normalizeSale(v, 'registrada')),
            ...arr('ventasPendientes').map((v, i) => normalizeSale(v, 'cuarentena', i))
        ];
        return rows
            .filter(v => !filters.method || v.method === filters.method)
            .filter(v => {
                const canceled = String(v.status || '').toLowerCase().includes('cancel');
                if (filters.status === 'todas') return true;
                if (filters.status === 'canceladas') return canceled;
                if (filters.status === 'boveda') return v.source === 'cuarentena';
                if (filters.status === 'registradas') return v.source === 'registrada' && !canceled;
                return v.source === 'registrada' && !canceled;
            })
            .filter(v => v.date instanceof Date && !isNaN(v.date.getTime()) && v.date.getFullYear() >= 1990)
            .filter(v => !fromD || v.date >= fromD)
            .filter(v => !toD || v.date <= toD)
            .filter(v => !filters.q || `${v.folio} ${v.customer} ${v.seller} ${v.method} ${v.status} ${v.items.map(a => a.nombre || a.productoNombre || '').join(' ')}`.toLowerCase().includes(filters.q))
            .sort((a, b) => {
                if (filters.order === 'fecha_asc') return a.date - b.date;
                if (filters.order === 'total_desc') return b.totalMerch - a.totalMerch;
                if (filters.order === 'total_asc') return a.totalMerch - b.totalMerch;
                if (filters.order === 'cliente') return a.customer.localeCompare(b.customer, 'es');
                if (filters.order === 'metodo') return a.method.localeCompare(b.method, 'es');
                return b.date - a.date;
            });
    }

    window.renderReporteVentas = function() {
        const app = reportTarget('reporteVentasApp', 'reporte-ventas');
        if (!app) return;
        const rows = filteredSales();
        const active = rows.filter(v => v.source === 'registrada' && !String(v.status).toLowerCase().includes('cancel'));
        const total = active.reduce((s, v) => s + v.totalMerch, 0);
        const docTotal = active.reduce((s, v) => s + v.totalDoc, 0);
        const collected = active.reduce((s, v) => s + (v.initialCollected || (['contado', 'transferencia'].includes(v.method) ? v.totalMerch : v.downPayment)), 0);
        const credit = active.filter(v => v.method === 'credito').reduce((s, v) => s + v.balance, 0);
        const cost = active.reduce((s, v) => s + v.cost, 0);
        const profit = active.reduce((s, v) => s + v.profit, 0);
        const units = active.reduce((s, v) => s + v.units, 0);
        const avg = active.length ? total / active.length : 0;
        const margin = cost > 0 && total > 0 ? (profit / total) * 100 : 0;
        const inVault = arr('ventasPendientes')
            .filter(v => !String(v.estado || v.estatus || '').toLowerCase().includes('cancel')).length;
        const canceled = arr('ventasRegistradas')
            .filter(v => String(v.estado || v.estatus || '').toLowerCase().includes('cancel')).length;

        const topCustomers = groupTop(active, v => v.customer, v => v.totalMerch).map(x => ({ name: x.name, value: x.value, meta: `${x.count} venta(s)` }));
        const topSellers = groupTop(active, v => v.seller || 'Sin vendedor', v => v.totalMerch).map(x => ({ name: x.name, value: x.value, meta: `${x.count} venta(s)` }));
        const productMap = new Map();
        active.forEach(v => v.items.forEach(a => {
            const name = a.nombre || a.productoNombre || 'Producto';
            const qty = Number(a.cantidad || 1) || 1;
            const value = (Number(a.precioContado || a.precio || 0) || 0) * qty;
            const cur = productMap.get(name) || { name, value: 0, qty: 0 };
            cur.value += value; cur.qty += qty; productMap.set(name, cur);
        }));
        const topProducts = [...productMap.values()].sort((a, b) => b.value - a.value).slice(0, 5).map(x => ({ name: x.name, value: x.value, meta: `${x.qty} pza(s)` }));

        const methodBars = ['contado', 'transferencia', 'credito', 'apartado'].map(m => {
            const value = active.filter(v => v.method === m).reduce((s, v) => s + v.totalMerch, 0);
            const pct = total > 0 ? Math.round(value / total * 100) : 0;
            return `<div style="padding:9px 0;border-bottom:1px solid #f1f5f9;">
                <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:#334155;"><span>${badge(m, '#f1f5f9', '#334155')}</span><span>${money(value)} (${pct}%)</span></div>
                <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:7px;"><div style="width:${pct}%;height:100%;background:#0f766e;"></div></div>
            </div>`;
        }).join('');

        const table = rows.length ? `<table style="width:100%;border-collapse:collapse;min-width:1180px;">
            <thead><tr style="background:#f8fafc;color:#334155;text-align:left;">
                <th style="padding:12px;">Folio</th><th style="padding:12px;">Fecha</th><th style="padding:12px;">Cliente</th><th style="padding:12px;">Metodo</th><th style="padding:12px;">Articulos</th><th style="padding:12px;text-align:center;">Pzas</th><th style="padding:12px;text-align:right;">Venta</th><th style="padding:12px;text-align:right;">Utilidad</th><th style="padding:12px;text-align:right;">Cobrado</th><th style="padding:12px;text-align:right;">Saldo</th>
            </tr></thead><tbody>${rows.map(v => {
                const itemText = v.items.length ? v.items.slice(0, 3).map(a => `${a.cantidad || 1}x ${esc(a.nombre || a.productoNombre || '-')}`).join('<br>') : '<span style="color:#94a3b8;">Sin detalle</span>';
                const source = v.source === 'cuarentena' ? badge('Boveda', '#fff7ed', '#c2410c') : badge('Registrada', '#ecfdf5', '#047857');
                const status = String(v.status).toLowerCase().includes('cancel') ? badge(v.status, '#fee2e2', '#991b1b') : badge(v.status, '#e0f2fe', '#075985');
                return `<tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:12px;vertical-align:top;"><strong>${esc(v.folio)}</strong><br>${source}<br>${status}</td>
                    <td style="padding:12px;vertical-align:top;white-space:nowrap;">${esc(v.dateText)}</td>
                    <td style="padding:12px;vertical-align:top;"><strong>${esc(v.customer)}</strong>${v.seller ? `<br><small style="color:#64748b;">Vendedor: ${esc(v.seller)}</small>` : ''}</td>
                    <td style="padding:12px;vertical-align:top;">${badge(v.method, '#f1f5f9', '#334155')}</td>
                    <td style="padding:12px;vertical-align:top;font-size:12px;">${itemText}${v.items.length > 3 ? `<br><small style="color:#64748b;">+${v.items.length - 3} mas</small>` : ''}</td>
                    <td style="padding:12px;vertical-align:top;text-align:center;font-weight:900;">${v.units}</td>
                    <td style="padding:12px;vertical-align:top;text-align:right;"><strong style="color:#1d4ed8;">${money(v.totalMerch)}</strong><br><small style="color:#64748b;">Doc: ${money(v.totalDoc)}</small></td>
                    <td style="padding:12px;vertical-align:top;text-align:right;">${v.cost > 0 ? `<strong style="color:#0f766e;">${money(v.profit)}</strong><br><small style="color:#64748b;">Costo: ${money(v.cost)}</small>` : '<span style="color:#94a3b8;">Sin costo</span>'}</td>
                    <td style="padding:12px;vertical-align:top;text-align:right;color:#16a34a;font-weight:900;">${money(v.initialCollected || v.downPayment)}</td>
                    <td style="padding:12px;vertical-align:top;text-align:right;color:${v.balance > 0 ? '#dc2626' : '#94a3b8'};font-weight:900;">${v.balance > 0 ? money(v.balance) : '-'}</td>
                </tr>`;
            }).join('')}</tbody></table>` : `<div style="padding:34px;text-align:center;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">No hay ventas para mostrar con los filtros actuales.</div>`;

        app.innerHTML = `
            <div class="vista-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:14px;flex-wrap:wrap;">
                <div><h2 style="margin:0;color:#0f172a;">Reporte de Ventas</h2><p style="color:#64748b;margin:4px 0 0;">Venta, cobranza inicial, cartera generada, utilidad estimada y comportamiento comercial.</p></div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="exportarReporteVentas()" style="padding:10px 18px;background:#16a34a;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Exportar CSV</button><button onclick="renderReporteVentas()" style="padding:10px 18px;background:#2563eb;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Actualizar</button></div>
            </div>
            <div style="background:white;border:1px solid #e2e8f0;padding:16px;border-radius:10px;margin-bottom:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;align-items:end;">
                <div style="grid-column:span 2;"><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">BUSCAR</label><input type="search" id="rvBusqueda" value="${esc(document.getElementById('rvBusqueda')?.value || '')}" placeholder="Cliente, folio, vendedor o producto" onkeydown="if(event.key==='Enter')renderReporteVentas()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div>
                <div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">DESDE</label><input type="date" id="rvFechaDesde" value="${esc(document.getElementById('rvFechaDesde')?.value || '')}" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div>
                <div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">HASTA</label><input type="date" id="rvFechaHasta" value="${esc(document.getElementById('rvFechaHasta')?.value || '')}" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div>
                <div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">METODO</label><select id="rvMetodo" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="">Todos</option><option value="contado">Contado</option><option value="transferencia">Transferencia</option><option value="credito">Credito</option><option value="apartado">Apartado</option></select></div>
                <div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">ESTADO</label><select id="rvEstado" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="activas">Activas</option><option value="todas">Todas</option><option value="registradas">Registradas</option><option value="boveda">Boveda</option><option value="canceladas">Canceladas</option></select></div>
                <div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">ORDEN</label><select id="rvOrden" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="fecha_desc">Mas recientes</option><option value="fecha_asc">Mas antiguas</option><option value="total_desc">Mayor importe</option><option value="total_asc">Menor importe</option><option value="cliente">Cliente A-Z</option><option value="metodo">Metodo</option></select></div>
                <button onclick="renderReporteVentas()" style="padding:10px 18px;background:#0f172a;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Filtrar</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:15px;margin-bottom:20px;">${kpi('Ventas registradas', active.length, '#0f172a')}${kpi('Mercancia vendida', money(total), '#2563eb')}${kpi('Cobro inicial', money(collected), '#16a34a')}${kpi('Cartera originada', money(credit), '#7c3aed')}${kpi('Ticket promedio', money(avg), '#0f766e')}${kpi('Utilidad estimada', cost > 0 ? `${money(profit)} (${margin.toFixed(1)}%)` : 'Sin costo', '#dc2626')}</div>
            <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:16px;margin-bottom:20px;"><div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;"><h3 style="margin:0 0 15px;color:#0f172a;font-size:16px;">Lectura rapida</h3><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;color:#334155;font-size:13px;"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Piezas vendidas</strong>${units}</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Venta documental</strong>${money(docTotal)}</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">En boveda</strong>${inVault}</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Canceladas visibles</strong>${canceled}</div></div></div><div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;"><h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Mix de venta</h3>${methodBars}</div></div>
            <div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;margin-bottom:20px;"><h3 style="margin:0 0 15px;color:#0f172a;font-size:16px;">Ventas registradas por mes</h3>${chartByMonth(active, v => v.totalMerch, '#2563eb', '#0f766e')}</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;"><div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top clientes</h3>${bars(topCustomers, total, '#2563eb')}</div><div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top productos</h3>${bars(topProducts, total, '#0f766e')}</div><div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top vendedores</h3>${bars(topSellers, total, '#7c3aed')}</div></div>
            <div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;"><h3 style="margin:0 0 15px;color:#0f172a;font-size:16px;">Detalle de Ventas</h3><div style="overflow-x:auto;">${table}</div></div>`;
        const sf = window._rplusVentaFiltros || {};
        if (document.getElementById('rvMetodo')) document.getElementById('rvMetodo').value = sf.method || '';
        if (document.getElementById('rvEstado')) document.getElementById('rvEstado').value = sf.status || 'activas';
        if (document.getElementById('rvOrden')) document.getElementById('rvOrden').value = sf.order || 'fecha_desc';
    };

    window.exportarReporteVentas = function() {
        const rows = filteredSales();
        let csv = 'Origen,Folio,Fecha,Cliente,Metodo,Articulos,Unidades,TotalMercancia,TotalDocumento,CostoEstimado,UtilidadEstimada,EngancheCobrado,Saldo,Vendedor,Estado\n';
        rows.forEach(v => {
            const items = v.items.map(a => `${a.cantidad || 1}x ${a.nombre || a.productoNombre || ''}`).join(' | ');
            csv += `"${v.source}","${v.folio}","${v.dateText}","${v.customer}","${v.method}","${items}",${v.units},${v.totalMerch},${v.totalDoc},${v.cost},${v.profit},${v.initialCollected || v.downPayment},${v.balance},"${v.seller}","${v.status}"\n`;
        });
        downloadCsv('reporte_ventas', csv);
    };

    function purchaseItems(doc) {
        const items = doc.articulos || doc.items || doc.productos || [];
        if (Array.isArray(items) && items.length) return items;
        if (doc.productoNombre || doc.producto) {
            const qty = Number(doc.cantidad || doc.cantidadTotal || 1) || 1;
            const total = Number(doc.total || 0) || 0;
            return [{ nombre: doc.productoNombre || doc.producto, cantidad: qty, costo: qty > 0 ? total / qty : total, subtotal: total }];
        }
        return [];
    }

    function normalizePurchase(doc, source) {
        const items = purchaseItems(doc);
        const dateRaw = doc.fechaISO || doc.fechaIso || doc.fechaRecepcion || doc.fechaEmision || doc.fecha || doc.fechaPedido || '';
        const date = parseDate(dateRaw);
        const itemTotal = items.reduce((s, a) => {
            const qty = Number(a.cantidadRec ?? a.cantidad ?? a.cant ?? 1) || 1;
            const cost = Number(a.costo ?? a.costoUnitario ?? a.precioCompra ?? 0) || 0;
            return s + (Number(a.subtotal || 0) || qty * cost);
        }, 0);
        const method = String(doc.metodo || doc.metodoPago || doc.condicionesComerciales?.metodoPago || doc.formaPagoTexto || '').toLowerCase();
        const total = Number(doc.total || doc.totalCompra || itemTotal || 0) || 0;
        let paid = Number(doc.totalPagado ?? doc.montoPagadoTotal ?? doc.pagado ?? doc.montoPagado ?? doc.anticipo_pagado ?? doc.anticipo ?? doc.pago?.monto ?? 0) || 0;
        if (doc.anticipoEsTransferido) paid = 0;
        if (paid <= 0 && (method === 'contado' || method.includes('contado')) && !doc.esConsignacion) {
            paid = Math.max(0, total - (Number(doc.saldoFavorAplicado || 0) || 0));
        }
        return {
            source,
            folio: doc.folio || doc.id || '-',
            date,
            dateText: dateLabel(date, String(dateRaw || '-')),
            supplier: doc.proveedorNombre || doc.proveedor || 'Proveedor',
            type: source === 'orden' ? 'Orden de compra' : (doc.ordenCompraId ? 'Recepcion OC' : 'Compra directa'),
            method: method || (doc.esConsignacion ? 'consignacion' : 'contado'),
            status: doc.estado || doc.estatus || (source === 'compra' ? 'Recibido' : 'Pendiente'),
            total,
            paid: Math.min(total, paid),
            balance: Math.max(0, Number(doc.saldoPendiente ?? doc.saldo ?? 0) || 0),
            items,
            units: items.reduce((s, a) => s + (Number(a.cantidadRec ?? a.cantidad ?? a.cant ?? 1) || 1), 0),
            consignment: doc.esConsignacion === true || method === 'consignacion',
            ref: doc.ordenCompraId || doc.compraId || doc.id || ''
        };
    }

    function filteredPurchases() {
        const q = String(document.getElementById('rcProveedor')?.value || '').trim().toLowerCase();
        const from = document.getElementById('rcFechaDesde')?.value || '';
        const to = document.getElementById('rcFechaHasta')?.value || '';
        const type = document.getElementById('rcTipo')?.value || 'todos';
        const status = document.getElementById('rcEstado')?.value || 'operativas';
        const order = document.getElementById('rcOrden')?.value || 'fecha_desc';
        window._rplusCompraFiltros = { q, from, to, type, status, order };
        const fromD = from ? (window.fechaInicioDiaMX ? window.fechaInicioDiaMX(from) : new Date(from + 'T00:00:00')) : null;
        const toD = to ? (window.fechaFinDiaMX ? window.fechaFinDiaMX(to) : new Date(to + 'T23:59:59')) : null;
        return [
            ...arr('ordenesCompra').map(o => normalizePurchase(o, 'orden')),
            ...arr('compras').map(c => normalizePurchase(c, 'compra'))
        ].filter(d => d.date instanceof Date && !isNaN(d.date.getTime()) && d.date.getFullYear() >= 1990)
            .filter(d => !fromD || d.date >= fromD)
            .filter(d => !toD || d.date <= toD)
            .filter(d => !q || `${d.supplier} ${d.folio} ${d.status} ${d.items.map(a => a.nombre || a.productoNombre || '').join(' ')}`.toLowerCase().includes(q))
            .filter(d => {
                if (type === 'todos') return true;
                if (type === 'orden') return d.source === 'orden';
                if (type === 'compra') return d.source === 'compra';
                if (type === 'consignacion') return d.consignment;
                if (type === 'credito') return d.method.includes('credito') || d.balance > 0;
                if (type === 'contado') return d.method.includes('contado') || d.method.includes('efectivo') || d.method.includes('debito');
                return true;
            })
            .filter(d => {
                const canceled = String(d.status).toLowerCase().includes('cancel');
                const received = String(d.status).toLowerCase().includes('recib') || String(d.status).toLowerCase().includes('complet');
                if (status === 'todas') return true;
                if (status === 'canceladas') return canceled;
                if (status === 'pendientes') return !canceled && !received;
                if (status === 'recibidas') return !canceled && received;
                return !canceled;
            })
            .sort((a, b) => {
                if (order === 'fecha_asc') return a.date - b.date;
                if (order === 'total_desc') return b.total - a.total;
                if (order === 'total_asc') return a.total - b.total;
                if (order === 'saldo_desc') return b.balance - a.balance;
                if (order === 'proveedor') return a.supplier.localeCompare(b.supplier, 'es');
                return b.date - a.date;
            });
    }

    window.renderReporteCompras = function() {
        const app = reportTarget('reporteComprasApp', 'reporte-compras');
        if (!app) return;
        const rows = filteredPurchases();
        const operationalRows = rows.filter(d => !String(d.status).toLowerCase().includes('cancel'));
        const real = operationalRows.filter(d => d.source === 'compra');
        const openOrders = operationalRows.filter(d => d.source === 'orden' && !String(d.status).toLowerCase().includes('recib'));
        const receivedTotal = real.reduce((s, d) => s + d.total, 0);
        const pending = operationalRows.reduce((s, d) => s + d.balance, 0);
        const consignment = operationalRows.filter(d => d.consignment).reduce((s, d) => s + d.total, 0);
        const units = real.reduce((s, d) => s + d.units, 0);
        const avg = real.length ? receivedTotal / real.length : 0;
        const topSuppliers = groupTop(real, d => d.supplier, d => d.total).map(x => ({ name: x.name, value: x.value, meta: `${x.count} doc(s)` }));
        const topMethods = groupTop(real, d => d.consignment ? 'Consignacion' : d.method, d => d.total).map(x => ({ name: x.name, value: x.value, meta: `${x.count} doc(s)` }));

        const table = rows.length ? `<table style="width:100%;border-collapse:collapse;min-width:1080px;"><thead><tr style="background:#f8fafc;color:#334155;text-align:left;"><th style="padding:12px;">Folio</th><th style="padding:12px;">Fecha</th><th style="padding:12px;">Proveedor</th><th style="padding:12px;">Articulos</th><th style="padding:12px;text-align:center;">Pzas</th><th style="padding:12px;text-align:right;">Total / Pagado</th><th style="padding:12px;text-align:right;">Saldo</th><th style="padding:12px;">Estado</th></tr></thead><tbody>${rows.map(d => {
            const items = d.items.length ? d.items.slice(0, 3).map(a => `${a.cantidadRec ?? a.cantidad ?? 1}x ${esc(a.nombre || a.productoNombre || a.producto || '-')}`).join('<br>') : '<span style="color:#94a3b8;">Sin detalle</span>';
            const type = d.consignment ? badge('Consignacion', '#ede9fe', '#6d28d9') : badge(d.type, d.source === 'orden' ? '#dbeafe' : '#ecfdf5', d.source === 'orden' ? '#1d4ed8' : '#047857');
            const sLower = String(d.status).toLowerCase();
            const statusBadge = sLower.includes('cancel') ? badge(d.status, '#fee2e2', '#991b1b') : (sLower.includes('recib') || sLower.includes('complet') ? badge(d.status, '#dcfce7', '#166534') : badge(d.status, '#fef3c7', '#92400e'));
            return `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:12px;vertical-align:top;"><strong>${esc(d.folio)}</strong><br>${type}</td><td style="padding:12px;vertical-align:top;white-space:nowrap;">${esc(d.dateText)}</td><td style="padding:12px;vertical-align:top;"><strong>${esc(d.supplier)}</strong><br><small style="color:#64748b;">${esc(d.method || '-')}</small></td><td style="padding:12px;vertical-align:top;font-size:12px;">${items}${d.items.length > 3 ? `<br><small style="color:#64748b;">+${d.items.length - 3} mas</small>` : ''}</td><td style="padding:12px;vertical-align:top;text-align:center;font-weight:900;">${d.units}</td><td style="padding:12px;vertical-align:top;text-align:right;"><strong style="color:#1e40af;">${money(d.total)}</strong><br><small style="color:#64748b;">Pagado: ${money(d.paid)}</small></td><td style="padding:12px;vertical-align:top;text-align:right;color:${d.balance > 0 ? '#dc2626' : '#64748b'};font-weight:900;">${money(d.balance)}</td><td style="padding:12px;vertical-align:top;">${statusBadge}</td></tr>`;
        }).join('')}</tbody></table>` : `<div style="padding:34px;text-align:center;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">No hay compras para mostrar con los filtros actuales.</div>`;

        app.innerHTML = `<div class="vista-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;gap:14px;flex-wrap:wrap;"><div><h2 style="margin:0;color:#0f172a;">Reporte de Compras</h2><p style="color:#64748b;margin:4px 0 0;">Abastecimiento, recepciones, compromisos y saldos por proveedor.</p></div><div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="exportarReporteCompras()" style="padding:10px 18px;background:#16a34a;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Exportar CSV</button><button onclick="renderReporteCompras()" style="padding:10px 18px;background:#2563eb;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Actualizar</button></div></div>
        <div style="background:white;border:1px solid #e2e8f0;padding:16px;border-radius:10px;margin-bottom:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;align-items:end;"><div style="grid-column:span 2;"><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">BUSCAR</label><input type="search" id="rcProveedor" value="${esc(document.getElementById('rcProveedor')?.value || '')}" placeholder="Proveedor, folio o producto" onkeydown="if(event.key==='Enter')renderReporteCompras()" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div><div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">DESDE</label><input type="date" id="rcFechaDesde" value="${esc(document.getElementById('rcFechaDesde')?.value || '')}" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div><div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">HASTA</label><input type="date" id="rcFechaHasta" value="${esc(document.getElementById('rcFechaHasta')?.value || '')}" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;"></div><div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">TIPO</label><select id="rcTipo" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="todos">Todos</option><option value="compra">Compras/recepciones</option><option value="orden">Ordenes</option><option value="consignacion">Consignacion</option><option value="credito">Credito proveedor</option><option value="contado">Contado/debito</option></select></div><div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">ESTADO</label><select id="rcEstado" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="operativas">Operativas</option><option value="todas">Todas</option><option value="pendientes">Pendientes</option><option value="recibidas">Recibidas</option><option value="canceladas">Canceladas</option></select></div><div><label style="font-size:11px;font-weight:800;color:#475569;display:block;margin-bottom:5px;">ORDEN</label><select id="rcOrden" style="width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:6px;"><option value="fecha_desc">Mas recientes</option><option value="fecha_asc">Mas antiguas</option><option value="total_desc">Mayor importe</option><option value="total_asc">Menor importe</option><option value="saldo_desc">Mayor saldo</option><option value="proveedor">Proveedor A-Z</option></select></div><button onclick="renderReporteCompras()" style="padding:10px 18px;background:#0f172a;color:white;border:none;border-radius:7px;cursor:pointer;font-weight:bold;">Filtrar</button></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:15px;margin-bottom:20px;">${kpi('Compras recibidas', money(receivedTotal), '#0f766e')}${kpi('Ordenes abiertas', `${openOrders.length} (${money(openOrders.reduce((s, d) => s + d.total, 0))})`, '#1e40af')}${kpi('Saldo pendiente', money(pending), '#dc2626')}${kpi('Consignacion', money(consignment), '#7c3aed')}${kpi('Piezas recibidas', units, '#334155')}${kpi('Ticket promedio', money(avg), '#d97706')}</div>
        <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:16px;margin-bottom:20px;"><div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;"><h3 style="margin:0 0 15px;color:#0f172a;font-size:16px;">Compras recibidas por mes</h3>${chartByMonth(real, d => d.total, '#0f766e', '#1e40af')}</div><div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;"><h3 style="margin:0 0 12px;color:#0f172a;font-size:16px;">Por metodo / politica</h3>${bars(topMethods, receivedTotal, '#0f766e')}</div></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;"><div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top proveedores</h3>${bars(topSuppliers, receivedTotal, '#1e40af')}</div><div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Lectura de control</h3><div style="display:grid;gap:10px;font-size:13px;color:#334155;"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Documentos mostrados</strong>${rows.length}</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Recepciones / directas</strong>${real.length}</div><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Saldo vs recibido</strong>${receivedTotal > 0 ? ((pending / receivedTotal) * 100).toFixed(1) : '0.0'}%</div></div></div></div>
        <div style="background:white;border:1px solid #e2e8f0;padding:18px;border-radius:10px;"><h3 style="margin:0 0 15px;color:#0f172a;font-size:16px;">Detalle de Compras</h3><div style="overflow-x:auto;">${table}</div></div>`;
        const cf = window._rplusCompraFiltros || {};
        if (document.getElementById('rcTipo')) document.getElementById('rcTipo').value = cf.type || 'todos';
        if (document.getElementById('rcEstado')) document.getElementById('rcEstado').value = cf.status || 'operativas';
        if (document.getElementById('rcOrden')) document.getElementById('rcOrden').value = cf.order || 'fecha_desc';
    };

    window.exportarReporteCompras = function() {
        const rows = filteredPurchases();
        let csv = 'Folio,Fecha,Proveedor,Tipo,Metodo,Articulos,Unidades,Total,Pagado,Saldo,Estatus,Consignacion,Referencia\n';
        rows.forEach(d => {
            const items = d.items.map(a => `${a.cantidadRec ?? a.cantidad ?? 1}x ${a.nombre || a.productoNombre || a.producto || ''}`).join(' | ');
            csv += `"${d.folio}","${d.dateText}","${d.supplier}","${d.type}","${d.method}","${items}",${d.units},${d.total},${d.paid},${d.balance},"${d.status}","${d.consignment ? 'Si' : 'No'}","${d.ref}"\n`;
        });
        downloadCsv('reporte_compras', csv);
    };

    window.renderReporteLiquidezCortoPlazo = function() {
        const container = document.getElementById('reportes') || document.getElementById('dashboardContenido');
        if (!container) return;

        const today = new Date();
        const balances = {};
        const cashAccounts = arr('cuentasEfectivo');
        const cashList = cashAccounts.length ? cashAccounts : [{ id: 'efectivo', nombre: 'Efectivo Principal', saldo: 0 }];
        const debitAccounts = arr('tarjetasConfig').filter(t => String(t.tipo || '').toLowerCase() === 'debito');
        const defaultCashId = cashList[0]?.id || 'efectivo';

        cashList.forEach(c => { balances[String(c.id || 'efectivo')] = 0; });
        debitAccounts.forEach(t => {
            const id = String(t.banco || t.id || '');
            if (id) balances[id] = Number(t.saldoInicial || 0) || 0;
        });

        arr('movimientosCaja').forEach(m => {
            const type = String(m.tipo || '').toLowerCase();
            const amount = Number(m.monto || 0) || 0;
            const rawAccount = String(m.cuenta || m.cuentaId || '');
            const account = (rawAccount === 'efectivo' || rawAccount === 'caja' || !rawAccount) ? defaultCashId : rawAccount;
            if (balances[account] !== undefined) balances[account] += type === 'ingreso' ? amount : -amount;
        });

        const initialLiquidity = Object.values(balances).reduce((s, v) => s + (Number(v) || 0), 0);
        const months = [];
        for (let i = 0; i < 6; i++) {
            const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
            months.push({
                key: `${d.getFullYear()}-${d.getMonth()}`,
                label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
                out: { cards: 0, suppliers: 0 },
                detail: { cards: {}, suppliers: {} },
                initial: 0,
                totalOut: 0,
                final: 0
            });
        }

        const findMonth = (date) => {
            if (!(date instanceof Date) || isNaN(date.getTime())) return months[0];
            const found = months.find(m => m.key === `${date.getFullYear()}-${date.getMonth()}`);
            if (found) return found;
            return date < today ? months[0] : months[months.length - 1];
        };

        arr('cuentasMSI').forEach(msi => {
            (Array.isArray(msi.calendario) ? msi.calendario : []).forEach(payment => {
                if (payment.estado === 'Pagado' || payment.estado === 'Cancelado') return;
                const amount = Math.max(0, (Number(payment.monto || 0) || 0) - (Number(payment.montoAbonado || 0) || 0));
                if (amount <= 0) return;
                const dest = findMonth(parseDate(payment.fecha));
                dest.out.cards += amount;
                const label = msi.banco || msi.concepto || 'Tarjeta';
                dest.detail.cards[label] = (dest.detail.cards[label] || 0) + amount;
            });
        });

        arr('cuentasPorPagar').forEach(cp => {
            const amount = Number(cp.saldoPendiente || 0) || 0;
            if (amount <= 0 || cp.esConsignacion) return;
            const dest = findMonth(parseDate(cp.vencimientoIso || cp.vencimiento || cp.fecha));
            dest.out.suppliers += amount;
            const label = cp.proveedor || cp.proveedorNombre || 'Proveedor';
            dest.detail.suppliers[label] = (dest.detail.suppliers[label] || 0) + amount;
        });

        months.forEach(m => { m.totalOut = m.out.cards + m.out.suppliers; });
        const visibleMonths = months.filter(m => m.totalOut > 0.009);

        let running = initialLiquidity;
        let covered = 0;
        visibleMonths.forEach(m => {
            m.initial = running;
            m.final = m.initial - m.totalOut;
            if (m.final >= 0) covered += 1;
            else if (m.initial > 0 && m.totalOut > 0) covered += m.initial / m.totalOut;
            running = m.final;
        });

        const tooltip = (obj) => Object.entries(obj)
            .filter(([, v]) => Math.abs(Number(v) || 0) > 0)
            .map(([k, v]) => `${k}: ${money(v)}`)
            .join('\n') || 'Sin desglose';
        const firstCommitment = visibleMonths[0];
        const colSpan = Math.max(2, visibleMonths.length + 1);
        const table = visibleMonths.length ? `
            <div style="overflow-x:auto;">
                <table style="width:100%;min-width:850px;border-collapse:collapse;font-size:13px;">
                    <thead><tr>
                        <th style="padding:15px;background:#f1f5f9;text-align:left;border-bottom:2px solid #cbd5e1;width:260px;">Cascada de amortizacion</th>
                        ${visibleMonths.map(m => `<th style="padding:15px;background:#f8fafc;text-align:center;border-bottom:2px solid #cbd5e1;font-weight:bold;">${m.label}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        <tr style="background:#f0fdf4;">
                            <td style="padding:12px 15px;font-weight:bold;color:#16a34a;">LIQUIDEZ INICIAL DISPONIBLE</td>
                            ${visibleMonths.map((m, i) => `<td title="${i === 0 ? tooltip(balances) : `Remanente anterior aplicado a ${m.label}`}" style="padding:12px;text-align:center;color:#16a34a;font-weight:bold;cursor:help;border-bottom:1px dotted #86efac;">${money(m.initial)}</td>`).join('')}
                        </tr>
                        <tr><td colspan="${colSpan}" style="background:#fff1f2;color:#be123c;font-weight:bold;padding:8px 15px;font-size:12px;border-top:1px solid #fda4af;">(-) Egresos ineludibles</td></tr>
                        <tr style="border-bottom:1px solid #f1f5f9;">
                            <td style="padding:10px 15px;color:#475569;">Tarjetas bancarias (MSI real)</td>
                            ${visibleMonths.map(m => `<td title="${tooltip(m.detail.cards)}" style="padding:10px;text-align:center;color:#dc2626;cursor:help;">${money(m.out.cards)}</td>`).join('')}
                        </tr>
                        <tr style="border-bottom:2px solid #cbd5e1;">
                            <td style="padding:10px 15px;color:#475569;">Proveedores CXP</td>
                            ${visibleMonths.map(m => `<td title="${tooltip(m.detail.suppliers)}" style="padding:10px;text-align:center;color:#dc2626;cursor:help;">${money(m.out.suppliers)}</td>`).join('')}
                        </tr>
                        <tr style="background:#eff6ff;border-bottom:2px solid #cbd5e1;">
                            <td style="padding:14px 15px;font-weight:900;color:#1e40af;">(=) LIQUIDEZ FINAL AL CIERRE</td>
                            ${visibleMonths.map(m => `<td style="padding:14px;text-align:center;font-weight:900;color:${m.final < 0 ? '#dc2626' : '#1e40af'};background:${m.final < 0 ? '#fef2f2' : 'transparent'};">${money(m.final)}</td>`).join('')}
                        </tr>
                    </tbody>
                </table>
            </div>`
            : `<div style="padding:34px;text-align:center;color:#64748b;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">No hay compromisos por cubrir en los proximos meses proyectados. La liquidez permanece disponible.</div>`;

        container.innerHTML = `
            <div style="background:white;padding:20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.05);margin-top:15px;margin-bottom:30px;">
                <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #e2e8f0;padding-bottom:15px;margin-bottom:20px;gap:12px;flex-wrap:wrap;">
                    <div>
                        <h2 style="margin:0;color:#065f46;font-size:24px;">Valuacion de Liquidez (Runway Financiero)</h2>
                        <p style="margin:0;color:#64748b;font-size:14px;">Meses sin compromisos se ocultan; la liquidez se arrastra al siguiente mes con obligaciones.</p>
                    </div>
                    <button onclick="renderReporteCompromisos()" style="padding:10px 15px;background:#e2e8f0;color:#475569;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Volver a Cash Flow</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-bottom:20px;">
                    ${kpi('Efectivo + debito disponible', money(initialLiquidity), '#059669')}
                    ${kpi('Pista con compromisos', visibleMonths.length ? `${covered.toFixed(1)} Meses` : 'Sin compromisos', '#2563eb', `${visibleMonths.length} mes(es) con obligaciones`)}
                    ${kpi('Proximo mes con compromisos', money(firstCommitment?.totalOut || 0), '#be123c', firstCommitment ? firstCommitment.label : 'Sin compromisos')}
                </div>
                ${table}
            </div>`;
    };

    function downloadCsv(prefix, csv) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const today = window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (() => {
            const d = new Date();
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })();
        link.setAttribute('download', `${prefix}_${today}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
})();
