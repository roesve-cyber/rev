// =====================================================================
// 📊 MÓDULO CENTRAL DE REPORTES CONTABLES Y FLUJO DE CAJA
// Estructura Unificada, Auditada y Saneada
// =====================================================================

const fmt = (v) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v || 0);

function _rvEsc(valor) {
    if (typeof window._esc === "function") return window._esc(valor);
    return String(valor ?? "").replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[ch]));
}

// --- Helpers compartidos ---
function _kpiCard(titulo, valor, color, icono) {
    return `<div style="background:white; padding:18px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); border-left:4px solid ${color};">
        <div style="font-size:11px; font-weight:bold; color:#718096; text-transform:uppercase;">${icono} ${titulo}</div>
        <div style="font-size:22px; font-weight:bold; color:${color}; margin-top:6px;">${valor}</div>
    </div>`;
}

function _tablaHTML(headers, filas) {
    const ths = headers.map(h => `<th style="background:#f1f5f9; padding:10px 12px; text-align:left; font-size:12px; color:#2c3e50; border-bottom:2px solid #e2e8f0;">${h}</th>`).join('');
    const trs = filas.map(cols => {
        const tds = cols.map(c => `<td style="padding:9px 12px; font-size:12px; border-bottom:1px solid #f0f0f0;">${c}</td>`).join('');
        return `<tr>${tds}</tr>`;
    }).join('');
    return `<table style="width:100%; border-collapse:collapse;"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

function _repParseDate(valor) {
    if (!valor) return new Date(0);
    if (valor instanceof Date) return isNaN(valor.getTime()) ? new Date(0) : valor;
    if (typeof valor === "number") return new Date(valor);
    const raw = String(valor).trim();
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

function _repFechaTexto(d, fallback = "") {
    if (!(d instanceof Date) || isNaN(d.getTime()) || d.getFullYear() < 2000) return fallback || "-";
    if (window.formatearFechaVistaMX) return window.formatearFechaVistaMX(d, { fallback: fallback || "-" });
    return window.formatearFechaCortaMX ? window.formatearFechaCortaMX(d) : d.toLocaleDateString("es-MX");
}

function _repBarraLista(items, total, color = "#2563eb") {
    if (!items.length) return `<div style="padding:18px;text-align:center;color:#94a3b8;">Sin datos suficientes.</div>`;
    return items.map((it, idx) => {
        const pct = total > 0 ? Math.max(4, (it.valor / total) * 100) : 0;
        return `<div style="display:grid;grid-template-columns:24px 1fr auto;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;">
            <div style="font-weight:900;color:#94a3b8;">${idx + 1}</div>
            <div>
                <div style="display:flex;justify-content:space-between;gap:10px;font-size:13px;color:#0f172a;font-weight:800;">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_rvEsc(it.nombre)}</span>
                    <span>${it.extra || ""}</span>
                </div>
                <div style="height:7px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:5px;">
                    <div style="width:${pct}%;height:100%;background:${color};border-radius:999px;"></div>
                </div>
            </div>
            <div style="font-weight:900;color:${color};font-size:13px;">${fmt(it.valor)}</div>
        </div>`;
    }).join("");
}

// ─── 1. REPORTE DE VENTAS ────────────────────────────────────────────
function _rvFecha(v) {
    return v.fechaVenta || v.fechaIso || v.fecha || v.datosVenta?.fechaIso || v.args?.[7] || "";
}

function _rvDate(v) {
    const f = _rvFecha(v);
    return _repParseDate(f);
}

function _rvCliente(v) {
    const respaldo = v.clienteNombre || v.cliente?.nombre || v.datosVenta?.cliente?.nombre || "Público General";
    return typeof window.resolverNombreCliente === "function"
        ? window.resolverNombreCliente(v, respaldo)
        : respaldo;
}

function _rvMetodo(v) {
    return String(v.metodoPago || v.metodo || v.datosVenta?.metodo || v.args?.[0] || "contado").toLowerCase();
}

function _rvArticulos(v) {
    const articulos = v.articulos || v.datosVenta?.articulos || [];
    if (Array.isArray(articulos)) return articulos;
    if (articulos && Array.isArray(articulos.data)) return articulos.data;
    return [];
}

function _rvTotalMercancia(v) {
    const articulos = _rvArticulos(v);
    const porArticulos = articulos.reduce((s, a) => s + (Number(a.precioContado || a.precio || 0) * Number(a.cantidad || 1)), 0);
    return Number(v.totalMercancia || v.totalContadoOriginal || v.importeApartado || porArticulos || v.totalVenta || v.total || v.args?.[1] || 0);
}

function _rvTotalDocumento(v) {
    return Number(v.total || v.totalVenta || v.datosVenta?.total || v.args?.[1] || _rvTotalMercancia(v) || 0);
}

function _rvEnganche(v) {
    return Number(v.enganche || v.engancheRecibido || v.datosVenta?.enganche || v.args?.[2] || 0);
}

function _rvSaldo(v) {
    const metodo = _rvMetodo(v);
    const folio = v.folio || v.datosVenta?.folio || v.args?.[5] || "";
    if (metodo === "credito") {
        if (typeof window._calcularEstadoCuenta === "function" && folio) {
            const estado = window._calcularEstadoCuenta(folio);
            if (estado) return Number(estado.saldoTotal || 0);
        }
        return Number(v.saldoAFinanciar || v.saldoActual || v.datosVenta?.saldoPendiente || v.args?.[3] || 0);
    }
    if (metodo === "apartado") {
        const ap = StorageService.get("apartados", []).find(a => String(a.folio || "") === String(folio));
        return Number(ap?.saldoPendiente ?? v.saldoAFinanciar ?? v.saldoPendiente ?? v.datosVenta?.saldoPendiente ?? v.args?.[3] ?? 0);
    }
    return 0;
}

function _rvUnidades(v) {
    return _rvArticulos(v).reduce((s, a) => s + (Number(a.cantidad || a.cant || 1) || 1), 0);
}

function _rvCostoEstimado(v) {
    return _rvArticulos(v).reduce((s, a) => {
        const cantidad = Number(a.cantidad || a.cant || 1) || 1;
        const costo = Number(a.costoUnitario || a.costo || a.precioCompra || a.costoPromedio || 0) || 0;
        return s + (cantidad * costo);
    }, 0);
}

function _rvVentaNormalizada(v, origen = "registrada", index = null) {
    const totalMercancia = _rvTotalMercancia(v);
    const costoEstimado = _rvCostoEstimado(v);
    return {
        raw: v,
        index,
        origen,
        folio: v.folio || v.datosVenta?.folio || v.args?.[5] || "-",
        fecha: _rvDate(v),
        fechaTexto: _repFechaTexto(_rvDate(v), v.fecha || v.datosVenta?.fecha || "-"),
        cliente: _rvCliente(v),
        metodo: _rvMetodo(v),
        totalMercancia,
        totalDocumento: _rvTotalDocumento(v),
        enganche: _rvEnganche(v),
        saldo: _rvSaldo(v),
        articulos: _rvArticulos(v),
        unidades: _rvUnidades(v),
        costoEstimado,
        utilidadEstimada: costoEstimado > 0 ? Math.max(0, totalMercancia - costoEstimado) : 0,
        vendedor: v.vendedor || v.vendedorNombre || v.vendedorSeleccionado?.nombre || "",
        cuentaCobro: v.cuentaPago || v.cuenta || v.etiquetaCuenta || v.datosVenta?.cuentaPago || "",
        estado: origen === "cuarentena" ? "En bóveda" : (v.estado || v.estatus || "Registrada")
    };
}

function _rvVentasFiltradas(filtros = {}) {
    const desde = filtros.desde ?? (document.getElementById("rvFechaDesde")?.value || "");
    const hasta = filtros.hasta ?? (document.getElementById("rvFechaHasta")?.value || "");
    const metodo = filtros.metodo ?? (document.getElementById("rvMetodo")?.value || "");
    const estado = filtros.estado ?? (document.getElementById("rvEstado")?.value || "activas");
    const busqueda = String(filtros.busqueda ?? (document.getElementById("rvBusqueda")?.value || "")).trim().toLowerCase();
    const orden = filtros.orden ?? (document.getElementById("rvOrden")?.value || "fecha_desc");
    const desdeD = desde ? (window.fechaInicioDiaMX ? window.fechaInicioDiaMX(desde) : new Date(desde + "T00:00:00")) : null;
    const hastaD = hasta ? (window.fechaFinDiaMX ? window.fechaFinDiaMX(hasta) : new Date(hasta + "T23:59:59")) : null;

    const registradas = StorageService.get("ventasRegistradas", [])
        .map(v => _rvVentaNormalizada(v, "registrada"));
    const cuarentena = StorageService.get("ventasPendientes", [])
        .filter(_esSolicitudBovedaPendiente)
        .map((v, index) => _rvVentaNormalizada(v, "cuarentena", index));

    return [...registradas, ...cuarentena]
        .filter(v => !metodo || v.metodo === metodo)
        .filter(v => {
            const esCancelada = String(v.estado || "").toLowerCase().includes("cancel");
            if (estado === "todas") return true;
            if (estado === "canceladas") return esCancelada;
            if (estado === "boveda") return v.origen === "cuarentena";
            if (estado === "registradas") return v.origen === "registrada" && !esCancelada;
            return v.origen === "registrada" && !esCancelada;
        })
        .filter(v => {
            if (!busqueda) return true;
            const articulos = v.articulos.map(a => `${a.nombre || a.productoNombre || ""}`).join(" ");
            return `${v.folio} ${v.cliente} ${v.vendedor} ${v.metodo} ${v.estado} ${articulos}`.toLowerCase().includes(busqueda);
        })
        .filter(v => v.fecha instanceof Date && !isNaN(v.fecha.getTime()) && v.fecha.getFullYear() >= 1990)
        .filter(v => !desdeD || v.fecha >= desdeD)
        .filter(v => !hastaD || v.fecha <= hastaD)
        .sort((a, b) => {
            if (orden === "fecha_asc") return a.fecha - b.fecha;
            if (orden === "total_desc") return b.totalMercancia - a.totalMercancia;
            if (orden === "total_asc") return a.totalMercancia - b.totalMercancia;
            if (orden === "cliente") return String(a.cliente).localeCompare(String(b.cliente), "es");
            if (orden === "metodo") return String(a.metodo).localeCompare(String(b.metodo), "es");
            return b.fecha - a.fecha;
        });
}

function _rvBadgeMetodo(metodo) {
    const meta = {
        contado: ["Contado", "#dcfce7", "#166534"],
        transferencia: ["Transferencia", "#dbeafe", "#1d4ed8"],
        credito: ["Crédito", "#ede9fe", "#6d28d9"],
        apartado: ["Apartado", "#fef3c7", "#92400e"]
    }[metodo] || [metodo || "Venta", "#f1f5f9", "#334155"];
    return `<span style="display:inline-flex; align-items:center; padding:4px 9px; border-radius:999px; background:${meta[1]}; color:${meta[2]}; font-size:11px; font-weight:800; text-transform:uppercase;">${meta[0]}</span>`;
}

function _rvBadgeOrigen(origen) {
    return origen === "cuarentena"
        ? `<span style="display:inline-flex; padding:4px 9px; border-radius:999px; background:#fff7ed; color:#c2410c; font-size:11px; font-weight:800;">Bóveda</span>`
        : `<span style="display:inline-flex; padding:4px 9px; border-radius:999px; background:#ecfdf5; color:#047857; font-size:11px; font-weight:800;">Registrada</span>`;
}

function _rvBadgeEstado(estado) {
    const cancelada = String(estado || "").toLowerCase().includes("cancel");
    const bg = cancelada ? "#fee2e2" : "#e0f2fe";
    const color = cancelada ? "#991b1b" : "#075985";
    return `<span style="display:inline-flex; padding:4px 9px; border-radius:999px; background:${bg}; color:${color}; font-size:11px; font-weight:800;">${_rvEsc(estado || "Activa")}</span>`;
}

window.renderReporteVentas = function() {
    const app = document.getElementById("reporteVentasApp");
    const appVisible = app && app.closest(".vista") && app.closest(".vista").style.display !== "none" && !app.closest(".vista").classList.contains("oculto");
    const contenedorLegacy = document.getElementById("contenidoReporte") || document.getElementById("dashboardContenido") || document.getElementById("reportes");
    const filtros = {
        desde: document.getElementById("rvFechaDesde")?.value || "",
        hasta: document.getElementById("rvFechaHasta")?.value || "",
        metodo: document.getElementById("rvMetodo")?.value || "",
        estado: document.getElementById("rvEstado")?.value || "activas",
        busqueda: document.getElementById("rvBusqueda")?.value || "",
        orden: document.getElementById("rvOrden")?.value || "fecha_desc"
    };
    const ventas = _rvVentasFiltradas(filtros);

    const registradas = ventas.filter(v => v.origen === "registrada" && !String(v.estado || "").toLowerCase().includes("cancel"));
    const enBoveda = ventas.filter(v => v.origen === "cuarentena");
    const canceladas = ventas.filter(v => String(v.estado || "").toLowerCase().includes("cancel"));
    const totalMercancia = registradas.reduce((s, v) => s + v.totalMercancia, 0);
    const totalDocumento = registradas.reduce((s, v) => s + v.totalDocumento, 0);
    const cobradoInicial = registradas.reduce((s, v) => s + (["contado", "transferencia"].includes(v.metodo) ? v.totalMercancia : v.enganche), 0);
    const carteraOriginada = registradas.filter(v => v.metodo === "credito").reduce((s, v) => s + v.saldo, 0);
    const unidades = registradas.reduce((s, v) => s + v.unidades, 0);
    const costoEstimado = registradas.reduce((s, v) => s + v.costoEstimado, 0);
    const utilidadEstimada = registradas.reduce((s, v) => s + v.utilidadEstimada, 0);
    const ticketPromedio = registradas.length ? totalMercancia / registradas.length : 0;
    const margenEstimado = costoEstimado > 0 && totalMercancia > 0 ? (utilidadEstimada / totalMercancia) * 100 : 0;

    const kpisHTML = `
        ${_kpiCard("Ventas registradas", String(registradas.length), "#0f172a", "📄")}
        ${_kpiCard("Mercancía vendida", fmt(totalMercancia), "#2563eb", "🛋️")}
        ${_kpiCard("Cobro inicial", fmt(cobradoInicial), "#16a34a", "💵")}
        ${_kpiCard("Cartera originada", fmt(carteraOriginada), "#7c3aed", "💳")}
        ${_kpiCard("Ticket promedio", fmt(ticketPromedio), "#0f766e", "AVG")}
        ${_kpiCard("Utilidad estimada", costoEstimado > 0 ? `${fmt(utilidadEstimada)} (${margenEstimado.toFixed(1)}%)` : "Sin costo", "#dc2626", "M")}
    `;

    const porMes = new Map();
    registradas.forEach(v => {
        if (!(v.fecha instanceof Date) || isNaN(v.fecha.getTime()) || v.fecha.getFullYear() < 2000) return;
        const key = `${v.fecha.getFullYear()}-${String(v.fecha.getMonth() + 1).padStart(2, "0")}`;
        const actual = porMes.get(key) || { total: 0, label: new Intl.DateTimeFormat("es-MX", { month: "short" }).format(v.fecha) };
        actual.total += v.totalMercancia;
        porMes.set(key, actual);
    });
    const meses = [...porMes.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    const maxMes = Math.max(1, ...meses.map(([, m]) => m.total));
    const graficaHTML = meses.length === 0
        ? `<div style="width:100%; align-self:center; text-align:center; color:#94a3b8;">Sin ventas registradas en el rango seleccionado.</div>`
        : meses.map(([key, m]) => `
            <div title="${key}: ${fmt(m.total)}" style="flex:1; min-width:36px; height:${Math.max(10, (m.total / maxMes) * 160)}px; background:linear-gradient(180deg,#2563eb,#0f766e); border-radius:6px 6px 2px 2px; display:flex; align-items:flex-start; justify-content:center; color:white; font-size:10px; font-weight:bold; padding-top:5px;">${fmt(m.total).replace(".00","")}</div>
        `).join("");
    const labelsHTML = meses.map(([, m]) => `<div style="flex:1; min-width:36px; text-align:center; font-size:11px; color:#64748b; text-transform:uppercase;">${m.label}</div>`).join("");

    const acumular = (lista, keyFn, valorFn, extraFn) => {
        const map = new Map();
        lista.forEach(item => {
            const key = keyFn(item) || "Sin dato";
            const actual = map.get(key) || { nombre: key, valor: 0, extraRaw: 0 };
            actual.valor += valorFn(item) || 0;
            actual.extraRaw += extraFn ? (extraFn(item) || 0) : 0;
            map.set(key, actual);
        });
        return [...map.values()].sort((a, b) => b.valor - a.valor).slice(0, 5);
    };
    const topClientes = acumular(registradas, v => v.cliente, v => v.totalMercancia, v => 1).map(x => ({ ...x, extra: `${x.extraRaw} venta(s)` }));
    const topVendedores = acumular(registradas, v => v.vendedor || "Sin vendedor", v => v.totalMercancia, v => 1).map(x => ({ ...x, extra: `${x.extraRaw} venta(s)` }));
    const productosMap = new Map();
    registradas.forEach(v => v.articulos.forEach(a => {
        const nombre = a.nombre || a.productoNombre || "Producto";
        const cantidad = Number(a.cantidad || a.cant || 1) || 1;
        const precio = Number(a.precioContado || a.precio || 0) || 0;
        const actual = productosMap.get(nombre) || { nombre, valor: 0, unidades: 0 };
        actual.valor += precio * cantidad;
        actual.unidades += cantidad;
        productosMap.set(nombre, actual);
    }));
    const topProductos = [...productosMap.values()].sort((a, b) => b.valor - a.valor).slice(0, 5).map(x => ({ ...x, extra: `${x.unidades} pza(s)` }));
    const totalMetodo = Math.max(1, totalMercancia);
    const metodosHTML = ["contado", "transferencia", "credito", "apartado"].map(m => {
        const total = registradas.filter(v => v.metodo === m).reduce((s, v) => s + v.totalMercancia, 0);
        const pct = Math.round((total / totalMetodo) * 100);
        return `<div style="padding:9px 0;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:#334155;"><span>${_rvBadgeMetodo(m)}</span><span>${fmt(total)} (${pct}%)</span></div>
            <div style="height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:7px;"><div style="width:${pct}%;height:100%;background:#0f766e;"></div></div>
        </div>`;
    }).join("");

    const filas = ventas.map(v => {
        const articulosTxt = v.articulos.length
            ? v.articulos.slice(0, 3).map(a => `${a.cantidad || 1}x ${_rvEsc(a.nombre || a.productoNombre || "-")}`).join("<br>")
            : '<span style="color:#94a3b8;">Sin detalle</span>';
        const saldoTxt = v.metodo === "credito" || v.metodo === "apartado"
            ? `<div style="font-weight:800; color:#dc2626;">${fmt(v.saldo)}</div>`
            : '<span style="color:#94a3b8;">-</span>';
        const utilidadTxt = v.costoEstimado > 0
            ? `<strong style="color:#0f766e;">${fmt(v.utilidadEstimada)}</strong><br><small style="color:#64748b;">Costo: ${fmt(v.costoEstimado)}</small>`
            : '<span style="color:#94a3b8;">Sin costo</span>';
        return `
            <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:12px; vertical-align:top;"><strong>${_rvEsc(v.folio)}</strong><br>${_rvBadgeOrigen(v.origen)}<br>${_rvBadgeEstado(v.estado)}</td>
                <td style="padding:12px; vertical-align:top; white-space:nowrap;">${_rvEsc(v.fechaTexto)}</td>
                <td style="padding:12px; vertical-align:top;"><strong>${_rvEsc(v.cliente)}</strong>${v.vendedor ? `<br><small style="color:#64748b;">Vendedor: ${_rvEsc(v.vendedor)}</small>` : ""}</td>
                <td style="padding:12px; vertical-align:top;">${_rvBadgeMetodo(v.metodo)}</td>
                <td style="padding:12px; vertical-align:top; font-size:12px;">${articulosTxt}${v.articulos.length > 3 ? `<br><small style="color:#64748b;">+${v.articulos.length - 3} más</small>` : ""}</td>
                <td style="padding:12px; vertical-align:top; text-align:center; font-weight:900;">${v.unidades}</td>
                <td style="padding:12px; vertical-align:top; text-align:right;"><strong style="color:#1d4ed8;">${fmt(v.totalMercancia)}</strong><br><small style="color:#64748b;">Doc: ${fmt(v.totalDocumento)}</small></td>
                <td style="padding:12px; vertical-align:top; text-align:right;">${utilidadTxt}</td>
                <td style="padding:12px; vertical-align:top; text-align:right;"><strong style="color:#16a34a;">${fmt(v.enganche)}</strong></td>
                <td style="padding:12px; vertical-align:top; text-align:right;">${saldoTxt}</td>
            </tr>`;
    }).join("");

    const tablaHTML = ventas.length === 0
        ? `<div style="padding:34px; text-align:center; color:#64748b; background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px;">No hay ventas para mostrar con los filtros actuales.</div>`
        : `<div style="margin-bottom:12px; display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; color:#475569; font-size:13px;">
                <span><strong>${ventas.length}</strong> movimientos mostrados</span>
                <span><strong>${canceladas.length}</strong> canceladas en vista</span>
                <span><strong>${enBoveda.length}</strong> en bóveda pendientes de autorización</span>
           </div>
           <table style="width:100%; border-collapse:collapse; min-width:980px;">
                <thead>
                    <tr style="background:#f8fafc; color:#334155; text-align:left;">
                        <th style="padding:12px;">Folio</th><th style="padding:12px;">Fecha</th><th style="padding:12px;">Cliente</th><th style="padding:12px;">Método</th><th style="padding:12px;">Artículos</th><th style="padding:12px; text-align:right;">Mercancía</th><th style="padding:12px; text-align:right;">Cobrado/Eng.</th><th style="padding:12px; text-align:right;">Saldo</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
           </table>`;

    const html = `
        <div class="vista-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:14px; flex-wrap:wrap;">
            <div>
                <h2 style="margin:0; color:#0f172a;">💰 Reporte de Ventas</h2>
                <p style="color:#64748b; margin:4px 0 0;">Consulta operativa de ventas registradas, cartera originada y movimientos en bóveda.</p>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button onclick="exportarReporteVentas()" style="padding:10px 18px; background:#16a34a; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold;">📥 Exportar CSV</button>
                <button onclick="renderReporteVentas()" style="padding:10px 18px; background:#2563eb; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold;">🔄 Actualizar</button>
            </div>
        </div>

        <div style="background:white; border:1px solid #e2e8f0; padding:16px; border-radius:10px; margin-bottom:18px; display:grid; grid-template-columns:repeat(auto-fit, minmax(155px, 1fr)); gap:12px; align-items:end;">
            <div style="grid-column:span 2;">
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">BUSCAR</label>
                <input type="search" id="rvBusqueda" value="${_rvEsc(filtros.busqueda)}" placeholder="Cliente, folio, vendedor o producto" onkeydown="if(event.key==='Enter')renderReporteVentas()" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">DESDE</label>
                <input type="date" id="rvFechaDesde" value="${_rvEsc(filtros.desde)}" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">HASTA</label>
                <input type="date" id="rvFechaHasta" value="${_rvEsc(filtros.hasta)}" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">MÉTODO</label>
                <select id="rvMetodo" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="" ${filtros.metodo === "" ? "selected" : ""}>Todos</option>
                    <option value="contado" ${filtros.metodo === "contado" ? "selected" : ""}>Contado</option>
                    <option value="transferencia" ${filtros.metodo === "transferencia" ? "selected" : ""}>Transferencia</option>
                    <option value="credito" ${filtros.metodo === "credito" ? "selected" : ""}>Crédito</option>
                    <option value="apartado" ${filtros.metodo === "apartado" ? "selected" : ""}>Apartado</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">ESTADO</label>
                <select id="rvEstado" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="activas" ${filtros.estado === "activas" ? "selected" : ""}>Activas</option>
                    <option value="todas" ${filtros.estado === "todas" ? "selected" : ""}>Todas</option>
                    <option value="registradas" ${filtros.estado === "registradas" ? "selected" : ""}>Registradas</option>
                    <option value="boveda" ${filtros.estado === "boveda" ? "selected" : ""}>Boveda</option>
                    <option value="canceladas" ${filtros.estado === "canceladas" ? "selected" : ""}>Canceladas</option>
                </select>
            </div>
            <div>
                <label style="font-size:11px; font-weight:800; color:#475569; display:block; margin-bottom:5px;">ORDEN</label>
                <select id="rvOrden" style="width:100%; padding:9px; border:1px solid #cbd5e1; border-radius:6px; box-sizing:border-box;">
                    <option value="fecha_desc" ${filtros.orden === "fecha_desc" ? "selected" : ""}>Mas recientes</option>
                    <option value="fecha_asc" ${filtros.orden === "fecha_asc" ? "selected" : ""}>Mas antiguas</option>
                    <option value="total_desc" ${filtros.orden === "total_desc" ? "selected" : ""}>Mayor importe</option>
                    <option value="total_asc" ${filtros.orden === "total_asc" ? "selected" : ""}>Menor importe</option>
                    <option value="cliente" ${filtros.orden === "cliente" ? "selected" : ""}>Cliente A-Z</option>
                    <option value="metodo" ${filtros.orden === "metodo" ? "selected" : ""}>Metodo</option>
                </select>
            </div>
            <button onclick="renderReporteVentas()" style="padding:10px 18px; background:#0f172a; color:white; border:none; border-radius:7px; cursor:pointer; font-weight:bold;">Filtrar</button>
        </div>

        <div id="rvKpis" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(190px, 1fr)); gap:15px; margin-bottom:20px;">${kpisHTML}</div>

        <div style="display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:16px;margin-bottom:20px;">
            <div style="background:white; border:1px solid #e2e8f0; padding:18px; border-radius:10px;">
                <h3 style="margin:0 0 15px; color:#0f172a; font-size:16px;">Lectura rapida</h3>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;color:#334155;font-size:13px;">
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Piezas vendidas</strong>${unidades}</div>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Venta documental</strong>${fmt(totalDocumento)}</div>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">En boveda</strong>${enBoveda.length} movimiento(s)</div>
                    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;"><strong style="display:block;color:#0f172a;">Canceladas visibles</strong>${canceladas.length}</div>
                </div>
            </div>
            <div style="background:white; border:1px solid #e2e8f0; padding:18px; border-radius:10px;">
                <h3 style="margin:0 0 12px; color:#0f172a; font-size:16px;">Mix de venta</h3>
                ${metodosHTML}
            </div>
        </div>

        <div style="background:white; border:1px solid #e2e8f0; padding:18px; border-radius:10px; margin-bottom:20px;">
            <h3 style="margin:0 0 15px; color:#0f172a; font-size:16px;">📈 Ventas Registradas por Mes</h3>
            <div id="rvGraficaMeses" style="display:flex; align-items:flex-end; gap:6px; height:180px; padding:0 10px;">${graficaHTML}</div>
            <div id="rvGraficaLabels" style="display:flex; gap:6px; padding:4px 10px; margin-top:4px;">${labelsHTML}</div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px;">
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top clientes</h3>${_repBarraLista(topClientes, totalMercancia, "#2563eb")}</div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top productos</h3>${_repBarraLista(topProductos, totalMercancia, "#0f766e")}</div>
            <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:18px;"><h3 style="margin:0 0 12px;font-size:16px;color:#0f172a;">Top vendedores</h3>${_repBarraLista(topVendedores, totalMercancia, "#7c3aed")}</div>
        </div>

        <div style="background:white; border:1px solid #e2e8f0; padding:18px; border-radius:10px;">
            <h3 style="margin:0 0 15px; color:#0f172a; font-size:16px;">📋 Detalle de Ventas</h3>
            <div id="rvTabla" style="overflow-x:auto;">${tablaHTML}</div>
        </div>
    `;

    if (app && appVisible) {
        app.innerHTML = html;
        return;
    }

    if (contenedorLegacy) {
        contenedorLegacy.innerHTML = `<div style="padding:20px;">${html}</div>`;
    }
};

window.exportarReporteVentas = function() {
    const ventas = _rvVentasFiltradas();
    let csv = "Origen,Folio,Fecha,Cliente,Metodo,Articulos,Unidades,TotalMercancia,TotalDocumento,CostoEstimado,UtilidadEstimada,EngancheCobrado,Saldo,Vendedor,Estado\n";
    ventas.forEach(v => {
        const articulos = v.articulos.map(a => `${a.cantidad || 1}x ${a.nombre || a.productoNombre || ''}`).join(' | ');
        csv += `"${v.origen}","${v.folio}","${v.fechaTexto}","${v.cliente}","${v.metodo}","${articulos}",${v.unidades},${v.totalMercancia},${v.totalDocumento},${v.costoEstimado},${v.utilidadEstimada},${v.enganche},${v.saldo},"${v.vendedor}","${v.estado}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `reporte_ventas_${window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0])}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ─── 2. REPORTE DE COMPRAS Y RECEPCIONES ─────────────────────────────
window.renderReporteCompras = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const ocs = StorageService.get("ordenesCompra", []);
    const cds = StorageService.get("compras", []);
    let totalInvertido = 0;
    let filas = [];

    ocs.forEach(o => {
        if (o.estado === 'Cancelada') return;
        const t = parseFloat(o.total) || 0;
        totalInvertido += t;
        filas.push([o.folio || '-', o.fechaEmision || o.fecha || '-', o.proveedorNombre || '-', 'Orden de Compra', fmt(t), o.estado || 'Pendiente']);
    });

    cds.forEach(c => {
        const t = parseFloat(c.total) || 0;
        totalInvertido += t;
        filas.push([c.folio || c.id || '-', c.fecha || '-', c.proveedor || '-', 'Compra Directa', fmt(t), 'Recibido']);
    });

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.02); margin-top:15px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <h3 style="margin:0; color:#1e293b;">📦 Historial de Abastecimiento (Compras)</h3>
            <button onclick="exportarReporteCompras()" style="padding:8px 16px; background:#0f766e; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">📊 Exportar CSV</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:15px; margin-bottom:25px;">
            ${_kpiCard("Total de Inversión Registrada", fmt(totalInvertido), "#0f766e", "🏭")}
        </div>
        <div style="overflow-x:auto;">
            ${_tablaHTML(["Folio", "Fecha", "Proveedor", "Tipo", "Monto Total", "Estatus"], filas)}
        </div>
    </div>`;
    contenedor.innerHTML = html;
};

window.exportarReporteCompras = function() {
    const ocs = StorageService.get("ordenesCompra", []);
    const cds = StorageService.get("compras", []);
    let csv = "Folio,Fecha,Proveedor,Tipo,Total,Estatus\n";
    
    ocs.forEach(o => {
        if (o.estado === 'Cancelada') return;
        csv += `"${o.folio || ''}","${o.fechaEmision || o.fecha || ''}","${o.proveedorNombre || ''}","Orden de Compra",${o.total || 0},"${o.estado || ''}"\n`;
    });
    cds.forEach(c => {
        csv += `"${c.folio || c.id || ''}","${c.fecha || ''}","${c.proveedor || ''}","Compra Directa",${c.total || 0},"Recibido"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `reporte_compras_${window.obtenerHoyInputMX ? window.obtenerHoyInputMX() : (window.localISO ? window.localISO(new Date()).split('T')[0] : new Date().toISOString().split('T')[0])}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// ============================================================================
// 🔮 PROYECCIÓN DE COMPROMISOS (CASH FLOW) - SIMULADOR DE ESTRÉS Y YIELD
// ============================================================================

// Estado global para los interruptores del simulador
window._escenariosCF = { puntuales: true, bajo: true, medio: false, alto: false };
window._datosCF = null;

// ─── MOTOR DE PROYECCIÓN POR CUENTA (usado por renderReporteCompromisos) ──
// Reemplaza el reparto plano (mismo monto cada mes) por un cálculo que le
// arma a cada cuenta su propio calendario de cobro, basado en su ritmo real
// de abonos — sin tocar la clasificación de riesgo (puntuales/bajo/medio/alto)
// que ya existía, que se sigue calculando exactamente igual que antes.

const _CF_UMBRAL_MINIMO_ABONOS = 3; // menos de esto no alcanza para un patrón confiable

function _cfIntervalosAbonos(abonosAsc) {
    if (abonosAsc.length < 2) return [];
    const dias = [];
    for (let i = 1; i < abonosAsc.length; i++) {
        dias.push(Math.max(1, Math.round((abonosAsc[i].fecha - abonosAsc[i - 1].fecha) / 86400000)));
    }
    return dias;
}

function _cfMediana(valores) {
    if (!valores.length) return 0;
    const s = [...valores].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function _cfDesviacion(valores, media) {
    if (valores.length < 2) return 0;
    const varianza = valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / valores.length;
    return Math.sqrt(varianza);
}

// Calcula cuánto se espera cobrar por mes (capacidad) y qué tan confiable/regular
// es el ritmo de pago de la cuenta. abonosAsc = abonos reales (sin cancelados),
// ordenados ascendente por fecha.
function _cfPerfilCuenta(abonosAsc, fechaVenta, hoy) {
    const diasCuentaViva = Math.max(1, Math.floor((hoy - fechaVenta) / 86400000));

    const hace90 = new Date(hoy); hace90.setDate(hoy.getDate() - 90);
    const hace270 = new Date(hoy); hace270.setDate(hoy.getDate() - 270);

    const abonos90 = abonosAsc.filter(a => a.fecha >= hace90);
    const abonos270 = abonosAsc.filter(a => a.fecha >= hace270);

    const divisor90 = Math.min(90, diasCuentaViva);
    const divisor270 = Math.min(270, diasCuentaViva);

    const rate90 = abonos90.length ? (abonos90.reduce((s, a) => s + a.monto, 0) / divisor90) * 30.44 : 0;
    const rate270 = abonos270.length ? (abonos270.reduce((s, a) => s + a.monto, 0) / divisor270) * 30.44 : 0;

    let flujoMensual;
    if (abonos90.length > 0 && abonos270.length > 0) {
        // Doble ventana 40/60: resuelve el caso de "se saltó un mes y luego cubrió
        // dos" sin que el mes flojo lo haga ver moroso, y sin que un pico reciente
        // aislado infle la proyección por sí solo.
        flujoMensual = rate90 * 0.4 + rate270 * 0.6;
    } else if (abonos270.length > 0) {
        // No pagó en los últimos 90 días pero sí tiene ritmo sostenido en 270:
        // va a destiempo, no está muerto — se usa su ritmo largo completo.
        flujoMensual = rate270;
    } else {
        flujoMensual = 0; // sin historial suficiente; el llamador resuelve el respaldo
    }

    // Patrón de frecuencia + confiabilidad, solo con muestra mínima (>=3 abonos)
    const muestra = abonos270.length >= _CF_UMBRAL_MINIMO_ABONOS ? abonos270 : abonosAsc;
    let intervaloMediano = null, confiabilidad = 0.35, patron = 'Sin patrón suficiente';
    const tieneMuestra = muestra.length >= _CF_UMBRAL_MINIMO_ABONOS;

    if (tieneMuestra) {
        const intervalos = _cfIntervalosAbonos(muestra);
        intervaloMediano = _cfMediana(intervalos);
        const desviacion = _cfDesviacion(intervalos, intervaloMediano);
        const cv = intervaloMediano > 0 ? desviacion / intervaloMediano : 1.5;
        // CV bajo (pagos regulares) -> confiabilidad alta -> calendario concentrado.
        // CV alto (pagos erráticos) -> confiabilidad baja -> reparto casi plano.
        confiabilidad = Math.max(0.2, Math.min(0.9, 1 - cv));
        patron = cv > 1.1 ? 'Errático'
               : intervaloMediano <= 10 ? 'Semanal'
               : intervaloMediano <= 20 ? 'Quincenal'
               : intervaloMediano <= 40 ? 'Mensual'
               : 'Errático';
    }

    return { flujoMensual, intervaloMediano, confiabilidad, patron, tieneMuestra };
}

// Reparte el saldo de una cuenta en los próximos 6 meses según su perfil.
// Nunca rebasa el saldo. Lo que no alcanza a proyectarse dentro de los 6 meses
// se devuelve en `fueraDeHorizonte` — no se amontona en el mes 6.
function _cfDistribuirCobro(saldo, perfil, diasSinPago) {
    const meses6 = [0, 0, 0, 0, 0, 0];
    if (saldo <= 0) return { meses: meses6, fueraDeHorizonte: 0 };

    const flujo = Math.max(0, perfil.flujoMensual);
    if (flujo <= 0) return { meses: meses6, fueraDeHorizonte: saldo };

    if (!perfil.tieneMuestra || !perfil.intervaloMediano) {
        // Sin patrón de frecuencia confiable: reparto plano de la capacidad mensual
        // (mismo comportamiento que el modelo anterior), tope de 6 meses.
        let restante = saldo;
        for (let i = 0; i < 6 && restante > 0.01; i++) {
            const cobro = Math.min(restante, flujo);
            meses6[i] = cobro;
            restante -= cobro;
        }
        return { meses: meses6, fueraDeHorizonte: Math.max(0, restante) };
    }

    // Con patrón confiable: se simulan los eventos de pago esperados cada
    // "intervaloMediano" días. La mayor parte del evento cae en el mes exacto
    // esperado (según confiabilidad); el resto se reparte entre los meses vecinos,
    // para no ser tan rígido como un calendario fijo con clientes que varían un poco.
    const montoPorEvento = flujo * (perfil.intervaloMediano / 30.44);
    let restante = saldo;
    let diaCursor = Math.max(0, perfil.intervaloMediano - diasSinPago);
    let guard = 0;

    while (diaCursor < 182 && restante > 0.01 && guard < 60) {
        guard++;
        const mesExacto = Math.min(5, Math.floor(diaCursor / 30.44));
        const evento = Math.min(restante, montoPorEvento);

        const montoExacto = evento * perfil.confiabilidad;
        const montoVecino = evento - montoExacto;

        meses6[mesExacto] += montoExacto;
        restante -= montoExacto;

        const vecinos = [mesExacto - 1, mesExacto + 1].filter(m => m >= 0 && m <= 5);
        if (vecinos.length && restante > 0.01) {
            const porVecino = Math.min(restante, montoVecino) / vecinos.length;
            vecinos.forEach(v => { meses6[v] += porVecino; restante -= porVecino; });
        } else if (restante > 0.01) {
            const extra = Math.min(restante, montoVecino);
            meses6[mesExacto] += extra;
            restante -= extra;
        }

        diaCursor += perfil.intervaloMediano;
    }

    return { meses: meses6, fueraDeHorizonte: Math.max(0, restante) };
}

window.renderReporteCompromisos = function() {
    const contenedor = document.getElementById('contenidoReporte');
    if (!contenedor) return;

    const hoy = new Date();
    const cxc = StorageService.get("cuentasPorCobrar", []);
    const cxp = StorageService.get("cuentasPorPagar", []);
    const msi = StorageService.get("cuentasMSI", []);

    // 1. INICIALIZAR ESTRUCTURA DE DATOS (6 Meses)
    let meses = [];
    let etiquetasMeses = [];
    for (let i = 0; i < 6; i++) {
        const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        etiquetasMeses.push(new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric' }).format(d).toUpperCase());
        meses.push({ puntuales: 0, bajo: 0, medio: 0, alto: 0, cxp: 0, msi: 0 });
    }

    let stats = {
        puntuales: { cuentas: 0, saldo: 0, diasPromedio: 0, label: '0 a 15 días sin pago' },
        bajo:      { cuentas: 0, saldo: 0, diasPromedio: 0, label: '16 a 30 días sin pago' },
        medio:     { cuentas: 0, saldo: 0, diasPromedio: 0, label: '31 a 60 días sin pago' },
        alto:      { cuentas: 0, saldo: 0, diasPromedio: 0, label: '61 a 90 días sin pago' }
    };

    let carteraTotal = 0;
    let carteraMuerta = 0;
    let carteraFueraHorizonte = 0;
    let compromisos = []; // detalle por cuenta, para el visor "Compromisos de Pago por Cliente"

    // 2. MOTOR YIELD & CLASIFICACIÓN DE RIESGO
    cxc.filter(c => c.estado !== 'Saldado' && !String(c.estado || '').toLowerCase().includes('cancel')).forEach(cuenta => {
        const saldo = Number(cuenta.saldoActual || 0);
        if (saldo <= 0) return;
        carteraTotal += saldo;

        if (cuenta.incobrable) {
            carteraMuerta += saldo; return;
        }

        const abonos = (cuenta.abonos || []).filter(a => !a.cancelado).map(a => ({
            monto: Number(a.monto || a.montoAbonado || 0),
            fecha: new Date(a.fechaIso || a.fechaAbonoIso || a.fecha)
        })).filter(a => !isNaN(a.fecha.getTime())).sort((a, b) => b.fecha - a.fecha);

        const fechaVenta = new Date(cuenta.fechaVenta || cuenta.fecha || hoy);
        const ultimoMovimiento = abonos.length > 0 ? abonos[0].fecha : fechaVenta;
        const diasSinPago = Math.max(0, Math.floor((hoy - ultimoMovimiento) / 86400000));

        if (diasSinPago > 90) {
            carteraMuerta += saldo; return;
        }

        // Determinar Nivel de Riesgo (clasificación sin cambios respecto al modelo anterior)
        let tier = 'puntuales';
        if (diasSinPago > 15 && diasSinPago <= 30) tier = 'bajo';
        else if (diasSinPago > 30 && diasSinPago <= 60) tier = 'medio';
        else if (diasSinPago > 60 && diasSinPago <= 90) tier = 'alto';

        stats[tier].cuentas++;
        stats[tier].saldo += saldo;
        stats[tier].diasPromedio += diasSinPago;

        // Perfil de ritmo de pago (doble ventana 90/270 + patrón de frecuencia)
        const abonosAsc = [...abonos].sort((a, b) => a.fecha - b.fecha);
        const perfil = _cfPerfilCuenta(abonosAsc, fechaVenta, hoy);

        if (perfil.flujoMensual <= 0) {
            // Sin historial de abonos (cuenta nueva): respaldo por plan de crédito,
            // igual que el modelo anterior.
            const abonoTeorico = Number(cuenta.plan?.abono || cuenta.planCredito?.abono || 0);
            const mult = (cuenta.periodicidad === 'quincenal') ? 2.15 : (cuenta.periodicidad === 'mensual' ? 1 : 4.3);
            perfil.flujoMensual = abonoTeorico > 0 ? (abonoTeorico * mult) : (saldo / 6);
        }

        // Reparto por calendario real de la cuenta (no plano, no todo en el mes 6)
        const { meses: mesesCuenta, fueraDeHorizonte } = _cfDistribuirCobro(saldo, perfil, diasSinPago);
        mesesCuenta.forEach((monto, i) => { meses[i][tier] += monto; });
        carteraFueraHorizonte += fueraDeHorizonte;

        compromisos.push({
            nombre: cuenta.nombre || cuenta.clienteNombre || 'Cliente',
            folio: cuenta.folio || '—',
            saldo,
            tier,
            diasSinPago,
            patron: perfil.patron,
            flujoMensual: perfil.flujoMensual,
            mesesParaLiquidar: perfil.flujoMensual > 0 ? Math.min(99, Math.ceil(saldo / perfil.flujoMensual)) : null
        });
    });

    // 3. EGRESOS (CXP y MSI)
    cxp.filter(p => !p.esConsignacion && Number(p.saldoPendiente || 0) > 0).forEach(p => {
        const d = new Date(p.vencimientoIso || p.vencimiento || hoy);
        const diffMeses = (d.getFullYear() - hoy.getFullYear()) * 12 + (d.getMonth() - hoy.getMonth());
        const idx = Math.max(0, Math.min(diffMeses, 5));
        meses[idx].cxp += Number(p.saldoPendiente || 0);
    });

    msi.forEach(tarjeta => {
        (tarjeta.calendario || []).filter(p => p.estado !== 'Pagado').forEach(pago => {
            const monto = Number(pago.monto || 0) - Number(pago.montoAbonado || 0);
            if (monto <= 0) return;
            const d = new Date(pago.fecha);
            const diffMeses = (d.getFullYear() - hoy.getFullYear()) * 12 + (d.getMonth() - hoy.getMonth());
            if (diffMeses >= 0 && diffMeses < 6) meses[diffMeses].msi += monto;
        });
    });

    // Promediar días de atraso en stats
    ['puntuales', 'bajo', 'medio', 'alto'].forEach(t => {
        if (stats[t].cuentas > 0) stats[t].diasPromedio = Math.round(stats[t].diasPromedio / stats[t].cuentas);
    });

    // Guardar en memoria y dibujar
    window._datosCF = { meses, etiquetasMeses, stats, carteraTotal, carteraMuerta, carteraFueraHorizonte, compromisos };
    
    // Contenedor principal de la interfaz
    contenedor.innerHTML = `
        <div style="background:linear-gradient(135deg,#0f172a,#1e3a8a); color:white; padding:22px; border-radius:14px; margin-bottom:20px;">
            <h2 style="margin:0; font-size:22px; font-weight:900;">🔮 Simulador de Cash Flow y Liquidez</h2>
            <p style="margin:5px 0 0; color:#94a3b8; font-size:13px;">Activa o desactiva las llaves de cobro para medir cómo reacciona tu liquidez neta ante diferentes escenarios de riesgo.</p>
        </div>
        <div id="cf-tabla-dinamica"></div>
    `;

    window.dibujarTablaCashFlow();
};

window.toggleEscenarioCF = function(tier) {
    window._escenariosCF[tier] = !window._escenariosCF[tier];
    window.dibujarTablaCashFlow();
};

window.dibujarTablaCashFlow = function() {
    const cont = document.getElementById('cf-tabla-dinamica');
    if (!cont || !window._datosCF) return;

    const { meses, etiquetasMeses, stats, carteraTotal, carteraMuerta, carteraFueraHorizonte, compromisos } = window._datosCF;
    const esc = window._escenariosCF;
    const fmt = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(v);

    // Calcular totales horizontales
    let totalFilas = { puntuales: 0, bajo: 0, medio: 0, alto: 0, cxp: 0, msi: 0, ingresosNetos: 0, flujoLibre: 0 };
    meses.forEach(m => {
        totalFilas.puntuales += m.puntuales; totalFilas.bajo += m.bajo; totalFilas.medio += m.medio; totalFilas.alto += m.alto;
        totalFilas.cxp += m.cxp; totalFilas.msi += m.msi;
    });

    const tooltip = (tier) => {
        const s = stats[tier];
        const pct = carteraTotal > 0 ? ((s.saldo / carteraTotal) * 100).toFixed(1) : 0;
        return `${s.cuentas} cuentas detectadas.\nSaldo en este bloque: ${fmt(s.saldo)} (${pct}% de la cartera activa).\nPromedio de atraso: ${s.diasPromedio} días.\nComportamiento: ${s.label}.`;
    };

    const generarFilaIngreso = (tier, nombre, color, bg, icon) => {
        const activo = esc[tier];
        let celdas = meses.map(m => `<td style="padding:10px; text-align:right; color:${activo ? color : '#cbd5e1'}; font-weight:${activo ? 'bold' : 'normal'};">${fmt(m[tier])}</td>`).join('');
        return `
        <tr style="border-bottom:1px solid #f1f5f9; background:${activo ? bg : '#f8fafc'}; transition:0.3s;" title="${tooltip(tier)}">
            <td style="padding:10px;">
                <label style="cursor:pointer; display:flex; align-items:center; gap:8px; color:${activo ? '#0f172a' : '#94a3b8'}; font-weight:bold;">
                    <input type="checkbox" ${activo ? 'checked' : ''} onchange="toggleEscenarioCF('${tier}')" style="width:16px; height:16px; cursor:pointer;">
                    ${icon} ${nombre}
                </label>
            </td>
            ${celdas}
            <td style="padding:10px; text-align:right; font-weight:900; color:${activo ? color : '#cbd5e1'}; border-left:2px solid #e2e8f0;">${fmt(totalFilas[tier])}</td>
        </tr>`;
    };

    // Construcción de la tabla
    let thead = `<th style="padding:12px; text-align:left; width:220px;">Flujo de Efectivo</th>`;
    etiquetasMeses.forEach(m => { thead += `<th style="padding:12px; text-align:right;">${m}</th>`; });
    thead += `<th style="padding:12px; text-align:right; border-left:2px solid #e2e8f0;">TOTAL</th>`;

    let html = `
    <div style="background:white; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
        <table style="width:100%; border-collapse:collapse; font-size:13px; min-width:800px;">
            <thead style="background:#f8fafc; border-bottom:2px solid #cbd5e1; color:#475569;"><tr>${thead}</tr></thead>
            <tbody>
                <tr><td colspan="8" style="padding:8px 12px; background:#eff6ff; font-weight:900; color:#1e40af; font-size:11px;">(+) LLAVES DE COBRANZA (Activa para simular)</td></tr>
                ${generarFilaIngreso('puntuales', 'Cobranza Puntual', '#16a34a', '#f0fdf4', '🟢')}
                ${generarFilaIngreso('bajo', 'Bajo Riesgo', '#d97706', '#fffbeb', '🟡')}
                ${generarFilaIngreso('medio', 'Mediano Riesgo', '#c2410c', '#fff7ed', '🟠')}
                ${generarFilaIngreso('alto', 'Alto Riesgo', '#b91c1c', '#fef2f2', '🔴')}
    `;

    // Calcular Sumatorias Dinámicas
    let sumatorias = meses.map((m, i) => {
        let ingresos = 0;
        if(esc.puntuales) ingresos += m.puntuales;
        if(esc.bajo) ingresos += m.bajo;
        if(esc.medio) ingresos += m.medio;
        if(esc.alto) ingresos += m.alto;
        let neto = ingresos - m.cxp - m.msi;
        totalFilas.ingresosNetos += ingresos;
        totalFilas.flujoLibre += neto;
        return { ingresos, cxp: m.cxp, msi: m.msi, neto };
    });

    // Fila Ingresos Totales Escenario
    html += `<tr style="border-bottom:2px solid #cbd5e1; background:#e0f2fe;">
                <td style="padding:10px 12px; font-weight:900; color:#0369a1;">(=) TOTAL INGRESOS ESCENARIO</td>
                ${sumatorias.map(s => `<td style="padding:10px; text-align:right; font-weight:900; color:#0369a1;">${fmt(s.ingresos)}</td>`).join('')}
                <td style="padding:10px; text-align:right; font-weight:900; color:#0369a1; border-left:2px solid #bfdbfe;">${fmt(totalFilas.ingresosNetos)}</td>
             </tr>`;

    // Egresos
    html += `<tr><td colspan="8" style="padding:8px 12px; background:#fef2f2; font-weight:900; color:#be123c; font-size:11px; border-top:2px solid white;">(-) OBLIGACIONES DE PAGO</td></tr>`;
    html += `<tr style="border-bottom:1px solid #f1f5f9;"><td style="padding:10px 12px; color:#475569; font-weight:bold;">Proveedores CXP</td>${sumatorias.map(s => `<td style="padding:10px; text-align:right; color:#dc2626;">${fmt(s.cxp)}</td>`).join('')}<td style="padding:10px; text-align:right; font-weight:900; color:#dc2626; border-left:2px solid #e2e8f0;">${fmt(totalFilas.cxp)}</td></tr>`;
    html += `<tr style="border-bottom:2px solid #cbd5e1;"><td style="padding:10px 12px; color:#475569; font-weight:bold;">Tarjetas MSI</td>${sumatorias.map(s => `<td style="padding:10px; text-align:right; color:#dc2626;">${fmt(s.msi)}</td>`).join('')}<td style="padding:10px; text-align:right; font-weight:900; color:#dc2626; border-left:2px solid #e2e8f0;">${fmt(totalFilas.msi)}</td></tr>`;

    // Flujo Libre Neto
    html += `<tfoot><tr style="background:#0f172a; color:white;">
                <td style="padding:14px 12px; font-weight:900; font-size:14px;">(=) FLUJO DE CAJA NETO</td>
                ${sumatorias.map(s => `<td style="padding:14px; text-align:right; font-weight:900; font-size:14px; color:${s.neto >= 0 ? '#4ade80' : '#f87171'};">${fmt(s.neto)}</td>`).join('')}
                <td style="padding:14px; text-align:right; font-weight:900; font-size:14px; color:${totalFilas.flujoLibre >= 0 ? '#4ade80' : '#f87171'}; border-left:2px solid #334155;">${fmt(totalFilas.flujoLibre)}</td>
             </tr></tfoot>`;

    html += `</tbody></table></div>`;

    // Resumen de Cartera Congelada (Informativo)
    html += `
    <div style="margin-top:20px; display:flex; gap:10px; justify-content:space-between; align-items:center; flex-wrap:wrap; background:#f8fafc; padding:15px; border-radius:8px; border:1px dashed #cbd5e1;">
        <span style="font-size:12px; color:#64748b; flex:1; min-width:220px;">
            <b>Nota Analítica:</b> Pasa el cursor sobre las filas de cobranza para ver el número de cuentas y pesos comprometidos en cada estrato de riesgo.
        </span>
        <div style="text-align:right;">
            <span style="font-size:11px; color:#64748b; font-weight:bold; display:block;">CARTERA INCOBRABLE (>90 DÍAS) EXCLUIDA DEL SIMULADOR:</span>
            <span style="font-size:18px; font-weight:900; color:#475569;">${fmt(carteraMuerta)}</span>
        </div>
        <div style="text-align:right;">
            <span style="font-size:11px; color:#64748b; font-weight:bold; display:block;">SALDO ACTIVO FUERA DEL HORIZONTE DE 6 MESES:</span>
            <span style="font-size:18px; font-weight:900; color:#475569;">${fmt(carteraFueraHorizonte)}</span>
        </div>
    </div>`;

    // Visor de bullets: Compromisos de Pago por Cliente (mismo componente que
    // "Top clientes/productos/vendedores" en Reporte de Ventas: _repBarraLista)
    const compromisosOrdenados = [...(compromisos || [])].sort((a, b) => b.saldo - a.saldo);
    const totalCompromisos = compromisosOrdenados.reduce((s, c) => s + c.saldo, 0);
    const iconoTier = { puntuales: '🟢', bajo: '🟡', medio: '🟠', alto: '🔴' };
    const itemsCompromisos = compromisosOrdenados.slice(0, 10).map(c => ({
        nombre: c.nombre,
        valor: c.saldo,
        extra: `${iconoTier[c.tier] || ''} ${c.patron} · ${fmt(c.flujoMensual)}/mes · ${c.mesesParaLiquidar ? c.mesesParaLiquidar + ' mes(es)' : '—'}`
    }));

    html += `
    <div style="margin-top:20px; background:white; border:1px solid #e2e8f0; border-radius:10px; padding:18px;">
        <h3 style="margin:0 0 4px; font-size:16px; color:#0f172a;">📋 Compromisos de Pago por Cliente</h3>
        <p style="margin:0 0 12px; font-size:12px; color:#64748b;">Top 10 por saldo activo. Patrón detectado, cobro mensual estimado (doble ventana 90/270 días) y meses para liquidar a su ritmo actual.</p>
        ${_repBarraLista(itemsCompromisos, totalCompromisos, "#0369a1")}
    </div>`;

    cont.innerHTML = html;
};

// ─── 4. REPORTE DE LIQUIDEZ A CORTO PLAZO (RUNWAY FINANCIERO) ────────
window.renderReporteLiquidezCortoPlazo = function() {
    const contenedor = document.getElementById("reportes") || document.getElementById("dashboardContenido");
    if (!contenedor) return;

    const hoy = new Date();
    
    // 1. DINERO REAL (misma base que "Mis Cuentas")
    const saldos = {};
    const cajasLiquidez = StorageService.get("cuentasEfectivo", [{ id: "efectivo", nombre: "Efectivo Principal", saldo: 0 }]);
    const debitoLiquidez = StorageService.get("tarjetasConfig", []).filter(t => String(t.tipo || '').toLowerCase() === "debito");

    cajasLiquidez.forEach(c => {
        const id = String(c.id || "efectivo");
        saldos[id] = 0;
    });
    const cajaDefaultLiquidezId = cajasLiquidez[0]?.id || "efectivo";

    debitoLiquidez.forEach(t => {
        const id = String(t.banco || t.id || "");
        if (id) saldos[id] = parseFloat(t.saldoInicial) || 0;
    });
    StorageService.get("movimientosCaja", []).forEach(m => {
        const esIng = String(m.tipo || '').toLowerCase() === "ingreso";
        const amt = parseFloat(m.monto) || 0;
        const cuentaMov = String(m.cuenta || m.cuentaId || '');
        const cta = (cuentaMov === "efectivo" || cuentaMov === "caja" || !cuentaMov) ? cajaDefaultLiquidezId : cuentaMov;
        if (saldos[cta] !== undefined) saldos[cta] += (esIng ? amt : -amt);
    });
    const liquidezTotalInicial = Object.values(saldos).reduce((a, b) => a + b, 0);

    // 2. CONSTRUCCIÓN DE MESES
    const mesesProyeccion = [];
    for(let i = 0; i < 6; i++) {
        let d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        mesesProyeccion.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: new Intl.DateTimeFormat('es-MX', { month: 'long', year: 'numeric' }).format(d).toUpperCase(),
            egresos: { tdc: 0, proveedores: 0 },
            desglose: { tdc: {}, proveedores: {} },
            liquidezInicial: 0, totalEgresos: 0, liquidezFinal: 0
        });
    }

    // 3. MAPEAR EGRESOS (MSI: usar directamente el mes de pago.fecha sin recalcular)
    StorageService.get("cuentasMSI", []).forEach(msi => {
        (msi.calendario || []).forEach(pago => {
            if (pago.estado !== 'Pagado' && pago.estado !== 'Cancelado') {
                // pago.fecha YA es vencimiento calculado (ej: "2025-02-15"), NO es fecha de compra
                const partes = pago.fecha.split('-');
                const keyMes = `${partes[0]}-${parseInt(partes[1]) - 1}`;
                let dest = mesesProyeccion.find(m => m.key === keyMes);
                if (!dest) {
                    const fPago = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, 1);
                    dest = fPago < hoy ? mesesProyeccion[0] : mesesProyeccion[mesesProyeccion.length - 1];
                }
                
                let saldoReal = Math.max(0, (parseFloat(pago.monto)||0) - (parseFloat(pago.montoAbonado)||0));
                if (saldoReal > 0) {
                    dest.egresos.tdc += saldoReal;
                    dest.desglose.tdc[msi.banco] = (dest.desglose.tdc[msi.banco] || 0) + saldoReal;
                }
            }
        });
    });

    StorageService.get("cuentasPorPagar", []).forEach(cp => {
        const saldo = parseFloat(cp.saldoPendiente || 0);
        if (saldo > 0 && !cp.esConsignacion) {
            const fVenc = window.parseFechaMX(cp.vencimientoIso || cp.vencimiento || cp.fecha);
            let dest = mesesProyeccion.find(m => m.key === `${fVenc.getFullYear()}-${fVenc.getMonth()}`);
            if (!dest) dest = fVenc < hoy ? mesesProyeccion[0] : mesesProyeccion[mesesProyeccion.length - 1];
            
            dest.egresos.proveedores += saldo;
            dest.desglose.proveedores[cp.proveedor] = (dest.desglose.proveedores[cp.proveedor] || 0) + saldo;
        }
    });

    // 4. CASCADA DE LIQUIDEZ
    let liquidezArrastrada = liquidezTotalInicial;
    let mesesCubiertos = 0;

    mesesProyeccion.forEach(m => {
        m.liquidezInicial = liquidezArrastrada;
        m.totalEgresos = m.egresos.tdc + m.egresos.proveedores;
        m.liquidezFinal = m.liquidezInicial - m.totalEgresos;

        if (m.liquidezFinal >= 0) {
            mesesCubiertos++;
        } else if (m.liquidezInicial > 0 && m.totalEgresos > 0) {
            mesesCubiertos += (m.liquidezInicial / m.totalEgresos);
        }
        liquidezArrastrada = m.liquidezFinal;
    });

    const tooltipStr = (obj) => Object.entries(obj).map(([k, v]) => `${k}: ${fmt(v)}`).join('\n') || 'Sin desglose';

    let html = `
    <div style="background:white; padding:20px; border-radius:12px; box-shadow:0 10px 25px rgba(0,0,0,0.05); margin-top:15px; margin-bottom:30px;">
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #e2e8f0; padding-bottom:15px; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#065f46; font-size:24px;">💧 Valuación de Liquidez (Runway Financiero)</h2>
                <p style="margin:0; color:#64748b; font-size:14px;">Supervivencia contable basada en capital líquido en cuentas.</p>
            </div>
            <button onclick="renderReporteCompromisos()" style="padding:10px 15px; background:#e2e8f0; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">⬅️ Volver a Cash Flow</button>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:15px; margin-bottom:20px;">
            <div style="padding:20px; background:linear-gradient(135deg, #10b981, #059669); color:white; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; opacity:0.9;">EFECTIVO + DÉBITO DISPONIBLE</div>
                <div style="font-size:30px; font-weight:900; margin-top:5px;">${fmt(liquidezTotalInicial)}</div>
            </div>
            <div style="padding:20px; background:linear-gradient(135deg, #3b82f6, #2563eb); color:white; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; opacity:0.9;">PISTA DE SUPERVIVENCIA</div>
                <div style="font-size:30px; font-weight:900; margin-top:5px;">${mesesCubiertos.toFixed(1)} Meses</div>
            </div>
            <div style="padding:20px; background:#fff1f2; border:1px solid #fda4af; border-radius:12px;">
                <div style="font-size:11px; font-weight:bold; color:#be123c;">COMPROMISOS MES 1</div>
                <div style="font-size:30px; font-weight:900; color:#be123c; margin-top:5px;">${fmt(mesesProyeccion[0].totalEgresos)}</div>
            </div>
        </div>

        <div style="overflow-x:auto;">
            <table style="width:100%; min-width:850px; border-collapse:collapse; font-size:13px;">
                <thead>
                    <tr>
                        <th style=\"padding:15px; background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1; width:260px;\">Cascada de Amortización</th>
                        ${mesesProyeccion.map(m => `<th style="padding:15px; background:#f8fafc; text-align:center; border-bottom:2px solid #cbd5e1; font-weight:bold;">${m.label}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    <tr style="background:#f0fdf4;">
                        <td style="padding:12px 15px; font-weight:bold; color:#16a34a;">💰 LIQUIDEZ INICIAL DISPONIBLE</td>
                        ${mesesProyeccion.map((m, i) => {
                            const tltp = i === 0 ? tooltipStr(Object.fromEntries(Object.entries(saldos).filter(([k,v])=>Math.abs(v)>0))) : `Remanente de ${mesesProyeccion[i-1].label}`;
                            return `<td title="${tltp}" style="padding:12px; text-align:center; color:#16a34a; font-weight:bold; cursor:help; border-bottom:1px dotted #86efac;">${fmt(m.liquidezInicial)}</td>`;
                        }).join('')}
                    </tr>
                    
                    <tr><td colspan="7" style="background:#fff1f2; color:#be123c; font-weight:bold; padding:8px 15px; font-size:12px; border-top:1px solid #fda4af;">(-) Egresos Ineludibles</td></tr>
                    
                    <tr style="border-bottom:1px solid #f1f5f9;">
                        <td style="padding:10px 15px; color:#475569;">Tarjetas Bancarias (MSI Real)</td>
                        ${mesesProyeccion.map(m => `<td title="${tooltipStr(m.desglose.tdc)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help;">${fmt(m.egresos.tdc)}</td>`).join('')}
                    </tr>
                    <tr style="border-bottom:2px solid #cbd5e1;">
                        <td style="padding:10px 15px; color:#475569;">Proveedores CXP</td>
                        ${mesesProyeccion.map(m => `<td title="${tooltipStr(m.desglose.proveedores)}" style="padding:10px; text-align:center; color:#dc2626; cursor:help;">${fmt(m.egresos.proveedores)}</td>`).join('')}
                    </tr>

                    <tr style="background:#eff6ff; border-bottom:2px solid #cbd5e1;">
                        <td style="padding:14px 15px; font-weight:900; color:#1e40af;">(=) LIQUIDEZ FINAL AL CIERRE</td>
                        ${mesesProyeccion.map(m => {
                            const neg = m.liquidezFinal < 0;
                            return `<td style="padding:14px; text-align:center; font-weight:900; color:${neg ? '#dc2626' : '#1e40af'}; background:${neg ? '#fef2f2' : 'transparent'};">${fmt(m.liquidezFinal)}</td>`;
                        }).join('')}
                    </tr>
                </tbody>
            </table>
        </div>
    </div>`;
    contenedor.innerHTML = html;
};
// ─── REPORTE DE FLUJO DE EFECTIVO HORIZONTAL ─────────────────────────
window.renderReporteFlujo = function() {
    const cont = document.getElementById('reporte-flujo') 
              || document.getElementById('reportes') 
              || document.getElementById('dashboardContenido');

    if (!cont) {
        console.warn("⚠️ No se encontró contenedor para renderReporteFlujo. Se esperaba #reporte-flujo, #reportes o #dashboardContenido.");
        return;
    }

    cont.innerHTML = "";

    const fDesde = window._filtroFlujoFInicio || '';
    const fHasta = window._filtroFlujoFFin || '';
    const cuentaFiltro = window._filtroFlujoCuenta || 'todas';
    const periodoAgrupar = window._filtroFlujoPeriodo || 'diario';
    const ordenBloques = window._filtroFlujoOrden || 'desc';
    const ordenMovimientos = window._filtroFlujoOrdenMov || 'fecha_desc';
    const vistaMovimientos = window._filtroFlujoVista || 'normal';

    const dineroFlujo = (v) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(v || 0);

    const asegurarArray = (valor) => {
        if (Array.isArray(valor)) return valor;

        if (valor && Array.isArray(valor.data)) return valor.data;

        if (valor && typeof valor === 'object') {
            return Object.values(valor).filter(v => v && typeof v === 'object');
        }

        return [];
    };

    const escFlujo = (valor) => String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const fechaLargaFlujo = (fecha) => {
        const d = _repParseDate(fecha);
        if (isNaN(d.getTime())) return '';
        if (window.formatearFechaVistaMX) return window.formatearFechaVistaMX(d, { fallback: '' });
        return new Intl.DateTimeFormat('es-MX', {
            weekday: 'long',
            day: 'numeric',
            year: 'numeric',
            month: 'long',
            timeZone: 'America/Mexico_City'
        }).format(d).replace(/,/g, '');
    };

    const mesLargoFlujo = (fecha) => {
        const d = fecha instanceof Date ? fecha : new Date(fecha);
        if (isNaN(d.getTime())) return '';
        return new Intl.DateTimeFormat('es-MX', {
            month: 'long',
            year: 'numeric',
            timeZone: 'America/Mexico_City'
        }).format(d);
    };

    const ordenarItemsFlujo = (items) => [...items].sort((a, b) => {
        if (ordenMovimientos === 'importe_desc') return (Number(b.monto) || 0) - (Number(a.monto) || 0);
        if (ordenMovimientos === 'importe_asc') return (Number(a.monto) || 0) - (Number(b.monto) || 0);
        if (ordenMovimientos === 'nombre_asc') return String(a.concepto || '').localeCompare(String(b.concepto || ''), 'es-MX');
        if (ordenMovimientos === 'nombre_desc') return String(b.concepto || '').localeCompare(String(a.concepto || ''), 'es-MX');
        if (ordenMovimientos === 'fecha_asc') return _repParseDate(a.fecha).getTime() - _repParseDate(b.fecha).getTime();
        return _repParseDate(a.fecha).getTime() - _repParseDate(b.fecha).getTime();
    });

            const normalizarCuentaId = (valor) => {
        let c = String(valor || '').trim();

        if (!c) return 'efectivo_default';

        const lower = c.toLowerCase();

        // Solo mandamos a efectivo_default cuando viene vacío o genérico.
        // NO fusionamos cajas reales con nombres distintos.
        if (
            lower === 'efectivo' ||
            lower === 'caja' ||
            lower === 'cash'
        ) {
            const cajas = asegurarArray(StorageService.get("cuentasEfectivo", []));
            return String(cajas[0]?.id || 'efectivo_default');
        }

        const cajasPorNombre = asegurarArray(StorageService.get("cuentasEfectivo", []));
        const cajaPorNombre = cajasPorNombre.find(caja => String(caja.nombre || '').toLowerCase().trim() === lower);
        if (cajaPorNombre) return String(cajaPorNombre.id || c);

        // Mantener nombres reales de cuentas: Caja Principal, Caja Chica, etc.
        return c;
    };

            const nombreCuenta = (id) => {
        const key = normalizarCuentaId(id);

        if (key === 'efectivo_default') return '💵 Efectivo';

        const cajas = asegurarArray(StorageService.get("cuentasEfectivo", []));
        const caja = cajas.find(c => String(c.id) === String(key));
        if (caja) return caja.nombre || key;
        return String(id || key);
    };

    const normalizarTipo = (tipo) => {
        const t = String(tipo || '').toLowerCase();

        if (
            t === 'egreso' ||
            t === 'salida' ||
            t === 'gasto' ||
            t === 'pago'
        ) {
            return 'egreso';
        }

        return 'ingreso';
    };

    const normalizarFecha = (fecha) => {
        if (!fecha) return '';

        if (typeof fecha === 'number') return fecha;

        const dSeguro = window.parseFechaMXOrNull ? window.parseFechaMXOrNull(fecha) : _repParseDate(fecha);
        if (dSeguro && !isNaN(dSeguro.getTime()) && dSeguro.getFullYear() >= 1990) {
            return window.localISO ? window.localISO(dSeguro) : dSeguro.toISOString();
        }

        return '';
    };

    const crearMovimiento = ({
        id,
        fecha,
        concepto,
        tipo,
        cuenta,
        monto,
        origen,
        referencia,
        grupoConciliacion,
        referenciaBancaria,
        foliosGrupo
    }) => {
        const montoNum = parseFloat(monto || 0);

        if (!montoNum || montoNum <= 0) return null;

        const cuentaId = normalizarCuentaId(cuenta);

        return {
            id: id || `${origen || 'mov'}-${referencia || concepto || ''}-${fecha || ''}-${montoNum}`,
            fecha: normalizarFecha(fecha),
            concepto: concepto || 'Movimiento',
            tipo: normalizarTipo(tipo),
            cuenta: cuentaId,
            cuentaNombre: nombreCuenta(cuentaId),
            monto: montoNum,
            origen: origen || 'sin_origen',
            referencia: referencia || '',
            grupoConciliacion: grupoConciliacion || '',
            referenciaBancaria: referenciaBancaria || '',
            foliosGrupo: Array.isArray(foliosGrupo) ? foliosGrupo : []
        };
    };

    const refBase = (valor) => String(valor || '')
        .toUpperCase()
        .replace(/^(VENTA|ABONO|ENGANCHE|OC|COMPRA|PAGO|CANCEL|DEV|CONSIG|REC)[-_:\s]*/g, '')
        .trim();

    const fechaKeyMovimiento = (fecha) => {
        if (window.fechaClaveMX) return window.fechaClaveMX(fecha, '');
        const d = _repParseDate(fecha);
        return isNaN(d.getTime()) ? '' : (window.getFechaLocalMX ? window.getFechaLocalMX(d) : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    };

    const movimientoCajaSimilar = ({ tipo, referencia, monto, cuenta, fecha, concepto }) => {
        const tipoNorm = normalizarTipo(tipo);
        const ref = refBase(referencia);
        const montoNum = Number(monto || 0);
        const cuentaNorm = normalizarCuentaId(cuenta);
        const fechaKey = fechaKeyMovimiento(fecha);
        const conceptoNorm = String(concepto || '').toLowerCase();

        return movimientosCaja.some(m => {
            const mTipo = normalizarTipo(m.tipo);
            if (mTipo !== tipoNorm) return false;

            const mMonto = Number(m.monto || 0);
            if (Math.abs(mMonto - montoNum) > 0.01) return false;

            const mRef = refBase(m.folio || m.referencia || m.id);
            const mConcepto = String(m.concepto || '').toLowerCase();
            if (ref && (mRef === ref || mConcepto.includes(ref.toLowerCase()))) return true;

            const mCuenta = normalizarCuentaId(m.cuenta || m.cuentaId || m.metodoPago || m.medioPago || 'efectivo');
            const mFechaKey = fechaKeyMovimiento(m.fecha || m.fechaISO || m.createdAt);
            return fechaKey && mFechaKey === fechaKey && mCuenta === cuentaNorm && conceptoNorm && mConcepto.includes(conceptoNorm.slice(0, 18));
        });
    };

    const agregarRespaldoSiFalta = (datos) => {
        const mov = crearMovimiento(datos);
        if (!mov) return;
        if (movimientoCajaSimilar(mov)) return;
        movimientos.push({ ...mov, origen: `${mov.origen}_reconstruido` });
    };

    const agruparTransferenciasConciliacion = (lista) => {
        const gruposTransferencia = {};
        const sueltos = [];

        lista.forEach(m => {
            const grupo = String(m.grupoConciliacion || '').trim();
            if (!grupo || m.tipo !== 'ingreso') {
                sueltos.push(m);
                return;
            }
            const clave = `${m.tipo}|${m.cuenta}|${fechaKeyMovimiento(m.fecha)}|${grupo}`;
            if (!gruposTransferencia[clave]) {
                gruposTransferencia[clave] = {
                    ...m,
                    id: `grupo-${clave}`,
                    concepto: `Transferencia agrupada: ${m.referenciaBancaria || grupo}`,
                    referencia: m.referenciaBancaria || grupo,
                    monto: 0,
                    itemsGrupo: [],
                    foliosGrupo: []
                };
            }
            gruposTransferencia[clave].monto += Number(m.monto || 0);
            gruposTransferencia[clave].itemsGrupo.push(m);
            gruposTransferencia[clave].foliosGrupo.push(m.referencia || m.id || '');
        });

        const agrupados = Object.values(gruposTransferencia).flatMap(g => {
            if (g.itemsGrupo.length < 2) return g.itemsGrupo;
            return [{
                ...g,
                monto: Number(g.monto.toFixed(2)),
                foliosGrupo: [...new Set(g.foliosGrupo.filter(Boolean))]
            }];
        });

        return [...sueltos, ...agrupados];
    };

    // ======================================================
    // FUENTES DE DATOS
    // ======================================================
    const movimientosCaja = asegurarArray(StorageService.get("movimientosCaja", []));
    const manuales = asegurarArray(StorageService.get("movimientosManuales", []));

    const tickets = asegurarArray(StorageService.get("registroTickets", []));
    const ventasRegistradas = asegurarArray(StorageService.get("ventasRegistradas", []));
    const cuentasCxC = asegurarArray(StorageService.get("cuentasPorCobrar", []));
    const apartadosData = asegurarArray(StorageService.get("apartados", []));
    const ordenesCompra = asegurarArray(StorageService.get("ordenesCompra", []));
    const comprasDirectas = asegurarArray(StorageService.get("compras", []));
    const cuentasPorPagar = asegurarArray(StorageService.get("cuentasPorPagar", []));
    const anticiposConsignacion = asegurarArray(StorageService.get("anticiposConsignacion", []));

    let movimientos = [];

    // ======================================================
    // 1. FUENTE PRINCIPAL: movimientosCaja
    // Evita duplicar ventas/abonos/compras que ya están registradas aquí.
    // ======================================================
    movimientosCaja.forEach((m, indexMovimientoCaja) => {
        const mov = crearMovimiento({
            id: m.id || `movcaja-${m.folio || m.referencia || 'sinref'}-${indexMovimientoCaja}`,
            fecha: m.fecha || m.fechaISO || m.createdAt,
            concepto: m.concepto || m.descripcion || m.referencia || m.folio || 'Movimiento de caja',
            tipo: m.tipo,
            cuenta: m.cuenta || m.cuentaId || m.metodoPago || m.medioPago || m.origen || 'efectivo',
            monto: m.monto,
            origen: 'movimientosCaja',
            referencia: m.folio || m.referencia || m.id,
            grupoConciliacion: m.grupoConciliacion || '',
            referenciaBancaria: m.referenciaBancaria || '',
            foliosGrupo: m.foliosGrupo || []
        });

        if (mov) movimientos.push(mov);
    });

    // ======================================================
    // 2. MOVIMIENTOS MANUALES
    // Estos sí se agregan aparte.
    // ======================================================
    manuales.forEach(m => {
        const mov = crearMovimiento({
            id: m.id,
            fecha: m.fecha,
            concepto: m.concepto || 'Movimiento manual',
            tipo: m.tipo,
            cuenta: m.cuenta || 'efectivo',
            monto: m.monto,
            origen: 'manual',
            referencia: m.id
        });

        if (mov) movimientos.push(mov);
    });

    // ======================================================
    // 3. RESPALDO CONCILIADO
    // Reconstruye faltantes desde modulos sin duplicar lo que ya este en caja.
    // ======================================================
    {
        if (movimientosCaja.length === 0) {
            console.warn("No hay movimientosCaja. Reconstruyendo flujo desde tickets, ventas, CxC y compras como respaldo.");
        }

        ventasRegistradas.forEach(v => {
            if (String(v.estado || v.estatus || '').toLowerCase().includes('cancel')) return;
            const metodo = String(v.metodoPago || v.metodo || 'contado').toLowerCase();
            const monto = Number(v.montoIngresoInicial ?? ((metodo === 'contado' || metodo === 'transferencia')
                ? Number(v.total || v.totalDocumento || v.totalMercancia || 0)
                : Number(v.enganche || v.engancheRecibido || 0)));
            if (monto <= 0) return;

            agregarRespaldoSiFalta({
                id: `venta-reg-${v.folio || v.id || ''}-${monto}`,
                fecha: v.fechaVenta || v.fechaIso || v.fecha,
                concepto: `${metodo === 'credito' ? 'Enganche' : 'Venta'}: ${v.folio || '-'}`,
                tipo: 'ingreso',
                cuenta: v.cuentaReceptora || v.cuentaId || v.cuentaPago || v.medioPago || v.metodoPago || 'efectivo',
                monto,
                origen: 'ventaRegistrada',
                referencia: v.folio || v.id
            });
        });

        tickets.forEach(t => {
            const venta = t.venta || {};
            const metodo = venta.cuentaReceptora || venta.modoEnganche || venta.metodoPago || 'efectivo';

            const monto = (
                venta.metodoPago === 'contado' ||
                venta.metodoPago === 'transferencia'
            )
                ? parseFloat(venta.total || 0)
                : parseFloat(venta.enganche || 0);

            agregarRespaldoSiFalta({
                id: t.id || t.folio || venta.folio,
                fecha: t.fechaEmision || t.fecha || venta.fecha || venta.fechaVenta,
                concepto: `Venta: ${t.folio || venta.folio || '-'}`,
                tipo: 'ingreso',
                cuenta: metodo,
                monto,
                origen: 'ticket',
                referencia: t.folio || venta.folio
            });
        });

        cuentasCxC.forEach(c => {
            if (String(c.estado || c.estatus || '').toLowerCase().includes('cancel')) return;
            (c.abonos || []).forEach((ab, indexAbono) => {
                if (ab.cancelado || ab.canceladoPorVenta || ab.canceladoPorApartado) return;
                agregarRespaldoSiFalta({
                    id: ab.id || `${c.folio || c.id}-${indexAbono}-${ab.fecha}-${ab.monto}`,
                    fecha: ab.fechaAbonoIso || ab.fechaIso || ab.fecha,
                    concepto: `Abo: ${c.nombre || c.clienteNombre || c.folio || '-'}`,
                    tipo: 'ingreso',
                    cuenta: ab.cuentaId || ab.etiquetaCuenta || ab.medioPago || ab.metodoPago || 'efectivo',
                    monto: ab.monto,
                    origen: 'abonoCxC',
                    referencia: c.folio || c.id
                });
            });
        });

        apartadosData.forEach(ap => {
            if (String(ap.estado || ap.estatus || '').toLowerCase().includes('cancel')) return;
            const engancheAp = Number(ap.enganche || 0);
            if (engancheAp > 0) {
                agregarRespaldoSiFalta({
                    id: `apartado-eng-${ap.folio || ap.id}-${engancheAp}`,
                    fecha: ap.fechaApartado || ap.fecha || ap.fechaVenta,
                    concepto: `Enganche apartado: ${ap.clienteNombre || ap.folio || '-'}`,
                    tipo: 'ingreso',
                    cuenta: ap.cuentaIdEnganche || ap.etiquetaCuentaEnganche || 'efectivo',
                    monto: engancheAp,
                    origen: 'engancheApartado',
                    referencia: ap.folio || ap.id
                });
            }

            asegurarArray(ap.abonos || []).forEach((ab, indexAbono) => {
                if (ab.cancelado || ab.canceladoPorVenta || ab.canceladoPorApartado) return;
                agregarRespaldoSiFalta({
                    id: ab.idOperacion || ab.id || `${ap.folio || ap.id}-abono-${indexAbono}`,
                    fecha: ab.fechaAbonoIso || ab.fechaAbono || ab.fecha,
                    concepto: `Abono apartado: ${ap.clienteNombre || ap.folio || '-'}`,
                    tipo: 'ingreso',
                    cuenta: ab.cuentaId || ab.etiquetaCuenta || 'efectivo',
                    monto: ab.monto,
                    origen: 'abonoApartado',
                    referencia: ap.folio || ap.id
                });
            });
        });

        ordenesCompra.forEach(com => {
            const pagos = asegurarArray(com.pagos || []);
            if (pagos.length) {
                pagos.forEach((p, indexPago) => {
                    agregarRespaldoSiFalta({
                        id: p.id || `${com.id || com.folio}-pago-${indexPago}`,
                        fecha: p.fecha || p.fechaPago || com.fecha || com.fechaEmision,
                        concepto: `Pago OC: ${com.proveedor || com.proveedorNombre || '-'}`,
                        tipo: 'egreso',
                        cuenta: p.cuentaId || p.cuenta || com.condicionesComerciales?.cuentaOrigen || 'efectivo',
                        monto: p.monto || p.importe || 0,
                        origen: 'ordenCompra',
                        referencia: com.folio || com.id
                    });
                });
                return;
            }

            const pagado = com.anticipoEsTransferido ? 0 : parseFloat(com.pagado || com.montoPagado || com.anticipo_pagado || 0);
            if (pagado > 0) {
                agregarRespaldoSiFalta({
                    id: com.id || com.folio,
                    fecha: com.fecha || com.fechaEmision,
                    concepto: `Prov: ${com.proveedor || com.proveedorNombre || '-'}`,
                    tipo: 'egreso',
                    cuenta: com.metodoPago || com.cuentaPago || com.condicionesComerciales?.cuentaOrigen || 'efectivo',
                    monto: pagado,
                    origen: 'ordenCompra',
                    referencia: com.folio || com.id
                });
            }
        });

                comprasDirectas.forEach(com => {
            if (com.ordenCompraId) return;
            // IMPORTANTE:
            // El flujo de efectivo SOLO debe mostrar dinero realmente pagado.
            // Si una compra/recepción se fue a cuentas por pagar, NO debe salir aquí.
            let pagado = parseFloat(
                com.pagado ||
                com.montoPagado ||
                com.totalPagado ||
                com.pago?.monto ||
                com.anticipo ||
                0
            );

            const metodo = String(
                com.metodoPago ||
                com.metodo ||
                com.formaPago ||
                com.tipoPago ||
                ''
            ).toLowerCase();

            const esCreditoProveedor =
                metodo.includes('credito') ||
                metodo.includes('crédito') ||
                metodo.includes('cuenta por pagar') ||
                metodo.includes('cxp') ||
                metodo.includes('proveedor') ||
                com.esCredito === true ||
                com.esCuentaPorPagar === true ||
                com.generaCXP === true ||
                com.cuentaPorPagar === true ||
                com.estadoPago === 'pendiente' ||
                com.estadoPago === 'Pendiente';

            if (pagado <= 0 && !esCreditoProveedor && !com.esConsignacion && (metodo === 'contado' || metodo.includes('contado'))) {
                pagado = Math.max(0, parseFloat(com.total || 0) - parseFloat(com.saldoFavorAplicado || 0));
            }

            // Si no hubo pago real, no entra al flujo.
            if (pagado <= 0) return;

            // Si es crédito/CXP, solo entra si realmente trae un pago parcial/anticipo.
            // Nunca usar com.total como si fuera efectivo.
            agregarRespaldoSiFalta({
                id: com.id || com.folio,
                fecha: com.fechaPago || com.fechaISO || com.fecha,
                concepto: `Pago compra: ${com.proveedor || com.proveedorNombre || com.id || '-'}`,
                tipo: 'egreso',
                cuenta: com.pago?.cuenta || com.cuentaPago || com.cuenta || com.metodoPago || 'efectivo',
                monto: pagado,
                origen: esCreditoProveedor ? 'anticipoCompraCXP' : 'compraDirectaPagada',
                referencia: com.folio || com.id
            });
        });

        cuentasPorPagar.forEach(cxp => {
            const ligadaAOC = ordenesCompra.some(oc => String(oc.id) === String(cxp.compraId));
            if (ligadaAOC) return;

            asegurarArray(cxp.abonos || []).forEach((ab, indexAbono) => {
                const monto = parseFloat(ab.monto || ab.importe || 0);
                if (monto <= 0) return;
                const cuentaTxt = String(ab.cuenta || ab.cuentaId || '').toLowerCase();
                if (cuentaTxt.includes('saldo a favor') || cuentaTxt.includes('anticipo consignacion')) return;

                agregarRespaldoSiFalta({
                    id: ab.id || `cxp-${cxp.id || cxp.compraId || ''}-${indexAbono}`,
                    fecha: ab.fecha || ab.fechaPago || cxp.fecha,
                    concepto: `Pago proveedor: ${cxp.proveedor || cxp.proveedorNombre || '-'}`,
                    tipo: 'egreso',
                    cuenta: ab.cuentaId || ab.cuenta || cxp.cuentaPago || 'efectivo',
                    monto,
                    origen: 'abonoCXP',
                    referencia: cxp.id || cxp.compraId
                });
            });
        });

        anticiposConsignacion.forEach((ant, indexAnticipo) => {
            const monto = parseFloat(ant.monto || 0);
            if (monto <= 0) return;

            agregarRespaldoSiFalta({
                id: ant.id || `anticipo-consig-${indexAnticipo}`,
                fecha: ant.fecha || ant.fechaStr,
                concepto: `Anticipo consignacion ${ant.proveedor || ''}`.trim(),
                tipo: 'egreso',
                cuenta: ant.cuentaId || ant.cuenta || 'efectivo',
                monto,
                origen: 'anticipoConsignacion',
                referencia: ant.id || ant.proveedorKey || ant.proveedor
            });
        });
    }

    // ======================================================
    // 4. DEDUPLICACIÓN DE SEGURIDAD
    // Si por alguna razón llega repetido el mismo movimiento, se queda uno.
    // ======================================================
    const vistos = new Set();

    movimientos = movimientos.filter(m => {
        const fechaObj = _repParseDate(m.fecha);
        const fechaKey = isNaN(fechaObj.getTime()) ? '' : (window.fechaClaveMX ? window.fechaClaveMX(fechaObj, '') : `${fechaObj.getFullYear()}-${String(fechaObj.getMonth() + 1).padStart(2, '0')}-${String(fechaObj.getDate()).padStart(2, '0')}`);
        const idKey = String(m.id || '').trim();
        const refRecon = refBase(m.referencia || m.id || m.concepto);
        const esReconstruido = String(m.origen || '').includes('reconstruido');
        const key = esReconstruido && refRecon
            ? `recon|${m.tipo}|${refRecon}|${Number(m.monto || 0).toFixed(2)}|${m.cuenta}`
            : idKey
            ? `${m.origen}|id|${idKey}`
            : [
                m.tipo,
                fechaKey,
                m.cuenta,
                Number(m.monto || 0).toFixed(2),
                String(m.referencia || m.concepto || '').toLowerCase().trim()
            ].join('|');

        if (vistos.has(key)) {
            console.warn("⏭️ Movimiento duplicado ignorado:", m);
            return false;
        }

        vistos.add(key);
        return true;
    });

    movimientos = movimientos.map((m, idx) => ({
        ...m,
        _flujoId: `flujo_${idx}_${String(m.id || '').replace(/[^a-zA-Z0-9_-]/g, '')}`
    }));

        // ======================================================
    // 5. ARMAR COMBO CUENTA POR BLOQUES
    // Bloques permitidos:
    // - Efectivo / cajas
    // - Tarjetas débito
    // - Tarjetas MSI / crédito
    // ======================================================
    const cajas = asegurarArray(StorageService.get("cuentasEfectivo", [
        { id: "efectivo_default", nombre: "💵 Efectivo" }
    ]));

    const tarjetas = asegurarArray(StorageService.get("tarjetasConfig", []));

    const bloqueEfectivo = new Map();
    const bloqueDebito = new Map();
    const bloqueMSI = new Map();

    // 1. Efectivo / cajas configuradas
    if (cajas.length > 0) {
        cajas.forEach((c, index) => {
            const rawId = c.id || c.nombre || `efectivo_${index + 1}`;
            const id = normalizarCuentaId(rawId);
            const nombre = c.nombre || c.descripcion || rawId || `Caja ${index + 1}`;

            bloqueEfectivo.set(id, `💵 ${nombre}`);
        });
    } else {
        bloqueEfectivo.set('efectivo_default', '💵 Efectivo');
    }

    // 2. Tarjetas configuradas
    tarjetas.forEach((t, index) => {
        const tipo = String(t.tipo || '').toLowerCase();
        const banco = String(t.banco || t.nombre || t.id || '').trim();

        if (!banco) return;

        const id = normalizarCuentaId(t.id || t.banco || t.nombre || `tarjeta_${index + 1}`);
        const etiqueta = banco;

        if (tipo === 'debito' || tipo === 'débito') {
            bloqueDebito.set(id, `🏦 ${etiqueta}`);
        }

        if (
            tipo === 'credito' ||
            tipo === 'crédito' ||
            tipo === 'msi'
        ) {
            bloqueMSI.set(id, `💳 ${etiqueta}`);
        }
    });

    const renderOpcionesCuenta = () => {
        let html = `<option value="todas" ${cuentaFiltro === 'todas' ? 'selected' : ''}>🌍 Ver Todas</option>`;

        if (bloqueEfectivo.size > 0) {
            html += `<optgroup label="💵 EFECTIVO / CAJAS">`;
            bloqueEfectivo.forEach((nombre, id) => {
                html += `<option value="${id}" ${cuentaFiltro === String(id) ? 'selected' : ''}>${nombre}</option>`;
            });
            html += `</optgroup>`;
        }

        if (bloqueDebito.size > 0) {
            html += `<optgroup label="🏦 TARJETAS DÉBITO">`;
            bloqueDebito.forEach((nombre, id) => {
                html += `<option value="${id}" ${cuentaFiltro === String(id) ? 'selected' : ''}>${nombre}</option>`;
            });
            html += `</optgroup>`;
        }

        if (bloqueMSI.size > 0) {
            html += `<optgroup label="💳 TARJETAS MSI / CRÉDITO">`;
            bloqueMSI.forEach((nombre, id) => {
                html += `<option value="${id}" ${cuentaFiltro === String(id) ? 'selected' : ''}>${nombre}</option>`;
            });
            html += `</optgroup>`;
        }

        return html;
    };

    const cuentasValidas = [
        ...Array.from(bloqueEfectivo.keys()),
        ...Array.from(bloqueDebito.keys()),
        ...Array.from(bloqueMSI.keys())
    ].map(String);

    if (cuentaFiltro !== 'todas' && !cuentasValidas.includes(String(cuentaFiltro))) {
        window._filtroFlujoCuenta = 'todas';
    }

    const cuentaFiltroFinal = window._filtroFlujoCuenta || 'todas';

    // ======================================================
    // 6. FILTRADO
    // ======================================================
    let movsFiltrados = movimientos.filter(m => {
        const coincideCuenta =
            cuentaFiltroFinal === 'todas' ||
            String(normalizarCuentaId(m.cuenta)) === String(cuentaFiltroFinal);

        const fMov = _repParseDate(m.fecha);

        if (isNaN(fMov.getTime()) || fMov.getFullYear() < 1990) return false;

        let coincideRango = true;

        if (fDesde) {
            const desde = window.fechaInicioDiaMX ? window.fechaInicioDiaMX(fDesde) : new Date(fDesde + "T00:00:00");
            coincideRango = coincideRango && (!desde || fMov >= desde);
        }

        if (fHasta) {
            const hasta = window.fechaFinDiaMX ? window.fechaFinDiaMX(fHasta) : new Date(fHasta + "T23:59:59");
            coincideRango = coincideRango && (!hasta || fMov <= hasta);
        }

        return coincideCuenta && coincideRango;
    });

    const movsParaFlujo = agruparTransferenciasConciliacion(movsFiltrados);

    // ======================================================
    // 7. AGRUPACIÓN
    // ======================================================
    const grupos = {};

    movsParaFlujo.forEach(m => {
        const d = _repParseDate(m.fecha);
        let clave = "";
        let sortKey = d.getTime();

        const fmtFecha = _repFechaTexto(d, '-');

        if (periodoAgrupar === 'diario') {
            clave = fechaLargaFlujo(d) || fmtFecha;
        } else if (periodoAgrupar === 'semanal') {
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const lunes = new Date(new Date(d).setDate(diff));
            const domingo = new Date(new Date(lunes).setDate(lunes.getDate() + 6));

            clave = `del ${fechaLargaFlujo(lunes)} al ${fechaLargaFlujo(domingo)}`;
            sortKey = lunes.getTime();
        } else {
            clave = mesLargoFlujo(d);
            sortKey = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
        }

        if (!grupos[clave]) {
            grupos[clave] = {
                ing: 0,
                egr: 0,
                items: [],
                sortKey
            };
        }

        if (m.tipo === 'ingreso') {
            grupos[clave].ing += Number(m.monto || 0);
        } else {
            grupos[clave].egr += Number(m.monto || 0);
        }

        grupos[clave].items.push(m);
    });

    const clavesOrd = Object.keys(grupos).sort((a, b) => {
        return ordenBloques === 'desc'
            ? grupos[b].sortKey - grupos[a].sortKey
            : grupos[a].sortKey - grupos[b].sortKey;
    });

    let totalIng = 0;
    let totalEgr = 0;

    const bloquesHTML = clavesOrd.map(clave => {
        const g = grupos[clave];
        totalIng += g.ing;
        totalEgr += g.egr;

        const balance = g.ing - g.egr;
        const itemsOrdenados = ordenarItemsFlujo(g.items);
        const renderItem = (i) => {
            const detalleGrupo = Array.isArray(i.itemsGrupo) && i.itemsGrupo.length > 1
                ? `<br><small style="color:#0f766e; font-weight:700;">${i.itemsGrupo.length} abonos: ${escFlujo(i.itemsGrupo.map(x => `${x.referencia || '-'} ${dineroFlujo(x.monto)}`).join(' | '))}</small>`
                : '';
            return `
                        <label style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f1f5f9; font-size:11px; cursor:pointer;">
                            <div style="display:flex; align-items:center; gap:8px; min-width:0;">
                                <input type="checkbox" class="flujo-check" data-tipo="${i.tipo}" data-monto="${Number(i.monto || 0)}" onchange="window.actualizarResumenSeleccionFlujo()" style="width:16px; height:16px; cursor:pointer; accent-color:#1e40af; flex-shrink:0;">
                                <div style="max-width:190px; line-height:1.25; min-width:0;">
                                    <b style="display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escFlujo(i.concepto)}">${escFlujo(i.concepto)}</b>
                                    <small style="color:#64748b;">${escFlujo(i.cuentaNombre)}</small><br>
                                    <small style="color:#94a3b8;">${escFlujo(fechaLargaFlujo(i.fecha))}</small>
                                    ${detalleGrupo}
                                </div>
                            </div>
                            <span style="font-weight:bold; color:${i.tipo === 'ingreso' ? '#16a34a' : '#dc2626'}; white-space:nowrap;">
                                ${i.tipo === 'ingreso' ? '+' : '-'}${dineroFlujo(i.monto)}
                            </span>
                        </label>`;
        };

        const itemsHTML = vistaMovimientos === 'tipo'
            ? `
                <div style="font-size:10px; font-weight:900; color:#15803d; margin:2px 0 6px;">INGRESOS</div>
                ${itemsOrdenados.filter(i => i.tipo === 'ingreso').map(renderItem).join('') || '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">Sin ingresos</div>'}
                <div style="font-size:10px; font-weight:900; color:#b91c1c; margin:12px 0 6px;">EGRESOS</div>
                ${itemsOrdenados.filter(i => i.tipo !== 'ingreso').map(renderItem).join('') || '<div style="font-size:12px;color:#94a3b8;padding:8px 0;">Sin egresos</div>'}
              `
            : itemsOrdenados.map(renderItem).join('');

        return `
            <div style="min-width:320px; background:white; border-radius:12px; border:1px solid #e2e8f0; display:flex; flex-direction:column; max-height:450px; box-shadow:0 4px 10px rgba(0,0,0,0.05);">
                <div style="padding:15px; background:#1e3a8a; color:white; border-radius:12px 12px 0 0;">
                    <div style="font-weight:bold; font-size:14px;">${escFlujo(clave)}</div>
                    <div style="display:flex; justify-content:space-between; margin-top:10px; font-size:12px;">
                        <span style="color:#4ade80;">+ ${dineroFlujo(g.ing)}</span>
                        <span style="color:#f87171;">- ${dineroFlujo(g.egr)}</span>
                    </div>
                    <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.3); text-align:right; font-weight:bold;">
                        Neto: ${dineroFlujo(balance)}
                    </div>
                </div>

                <div style="flex:1; overflow-y:auto; padding:10px; background:#fcfcfc; border-radius:0 0 12px 12px;">
                    ${itemsHTML}
                </div>
            </div>`;
    }).join('');

    window._flujoResumenBase = {
        ingresos: totalIng,
        egresos: totalEgr,
        movimientos: movsParaFlujo.length
    };

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
            <div>
                <h2 style="margin:0; color:#1e40af;">💵 Flujo de Efectivo Horizontal</h2>
                <p style="color:#718096; margin:0;">Movimientos reales filtrados por cajas, bancos y origen normalizado.</p>
            </div>

            <div style="display:flex; gap:10px;">
                <button onclick="window.exportarReporteFlujo()" style="padding:10px 18px; background:#1e3a8a; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                    📊 Exportar CSV
                </button>
                <button onclick="window.abrirModalGastoExtra()" style="padding:10px 18px; background:#10b981; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                    💸 Nuevo Gasto / Ingreso
                </button>
            </div>
        </div>

        <div style="display:flex; flex-wrap:wrap; gap:15px; background:white; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05); margin-bottom:25px; align-items:end;">
            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">CUENTA:</label>
                <select onchange="window._filtroFlujoCuenta=this.value; window.renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px; min-width:240px;">
    ${renderOpcionesCuenta()}
</select>
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">AGRUPAR:</label>
                <select onchange="window._filtroFlujoPeriodo=this.value; window.renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
                    <option value="diario" ${periodoAgrupar === 'diario' ? 'selected' : ''}>Diario</option>
                    <option value="semanal" ${periodoAgrupar === 'semanal' ? 'selected' : ''}>Semanal (Lun-Dom)</option>
                    <option value="mensual" ${periodoAgrupar === 'mensual' ? 'selected' : ''}>Mensual</option>
                </select>
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">VER:</label>
                <select onchange="window._filtroFlujoVista=this.value; window.renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
                    <option value="normal" ${vistaMovimientos === 'normal' ? 'selected' : ''}>Tal cual</option>
                    <option value="tipo" ${vistaMovimientos === 'tipo' ? 'selected' : ''}>Por tipo</option>
                </select>
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">ORDEN MOVS:</label>
                <select onchange="window._filtroFlujoOrdenMov=this.value; window.renderReporteFlujo();" style="display:block; padding:8px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
                    <option value="fecha_desc" ${ordenMovimientos === 'fecha_desc' ? 'selected' : ''}>Fecha reciente</option>
                    <option value="fecha_asc" ${ordenMovimientos === 'fecha_asc' ? 'selected' : ''}>Fecha antigua</option>
                    <option value="importe_desc" ${ordenMovimientos === 'importe_desc' ? 'selected' : ''}>Importe mayor</option>
                    <option value="importe_asc" ${ordenMovimientos === 'importe_asc' ? 'selected' : ''}>Importe menor</option>
                    <option value="nombre_asc" ${ordenMovimientos === 'nombre_asc' ? 'selected' : ''}>Nombre A-Z</option>
                    <option value="nombre_desc" ${ordenMovimientos === 'nombre_desc' ? 'selected' : ''}>Nombre Z-A</option>
                </select>
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">DESDE:</label>
                <input type="date" value="${fDesde}" onchange="window._filtroFlujoFInicio=this.value; window.renderReporteFlujo();" style="display:block; padding:7px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
            </div>

            <div>
                <label style="font-size:10px; font-weight:bold; color:#64748b;">HASTA:</label>
                <input type="date" value="${fHasta}" onchange="window._filtroFlujoFFin=this.value; window.renderReporteFlujo();" style="display:block; padding:7px; border-radius:6px; border:1px solid #cbd5e1; margin-top:4px;">
            </div>
        </div>

        <div id="flujoResumenFijo" style="position:sticky; top:72px; z-index:20; display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:20px; background:rgba(240,242,247,0.92); backdrop-filter:blur(8px); padding:10px 0;">
            <div style="background:#f0fdf4; border-left:5px solid #16a34a; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#166534; font-weight:bold;">INGRESOS DEL FILTRO</small><br>
                <strong id="flujoKpiIngresos" style="font-size:22px; color:#15803d;">${dineroFlujo(totalIng)}</strong>
            </div>

            <div style="background:#fff1f2; border-left:5px solid #dc2626; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#991b1b; font-weight:bold;">EGRESOS DEL FILTRO</small><br>
                <strong id="flujoKpiEgresos" style="font-size:22px; color:#b91c1c;">${dineroFlujo(totalEgr)}</strong>
            </div>

            <div style="background:#eff6ff; border-left:5px solid #1e40af; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#1e3a8a; font-weight:bold;">BALANCE NETO</small><br>
                <strong id="flujoKpiBalance" style="font-size:22px; color:#1e40af;">${dineroFlujo(totalIng - totalEgr)}</strong>
            </div>

            <div style="background:#f8fafc; border-left:5px solid #64748b; padding:15px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.05);">
                <small style="color:#475569; font-weight:bold;">MOVIMIENTOS MOSTRADOS</small><br>
                <strong id="flujoKpiMovs" style="font-size:22px; color:#334155;">${movsParaFlujo.length}</strong>
                <div id="flujoKpiModo" style="font-size:11px; color:#64748b; font-weight:bold; margin-top:4px;">Filtro completo</div>
            </div>
        </div>

        <div style="display:flex; overflow-x:auto; gap:20px; padding:10px 0 25px 0; align-items:flex-start;">
            ${bloquesHTML || '<div style="width:100%; text-align:center; padding:50px; color:#94a3b8; background:white; border-radius:12px;">No hay movimientos con estos filtros.</div>'}
        </div>
    `;
    if (typeof window.actualizarResumenSeleccionFlujo === 'function') {
        window.actualizarResumenSeleccionFlujo();
    }
};

// --- SOPORTE PARA REPORTE DE FLUJO ---
window.actualizarResumenSeleccionFlujo = function() {
    const dineroFlujo = (v) => new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(v || 0);

    const checks = Array.from(document.querySelectorAll('.flujo-check'));
    const seleccionados = checks.filter(ch => ch.checked);
    const base = window._flujoResumenBase || { ingresos: 0, egresos: 0, movimientos: 0 };

    let ingresos = base.ingresos;
    let egresos = base.egresos;
    let movimientos = base.movimientos;
    let modo = 'Filtro completo';

    if (seleccionados.length > 0) {
        ingresos = 0;
        egresos = 0;
        movimientos = seleccionados.length;
        modo = 'Selección manual';

        seleccionados.forEach(ch => {
            const monto = parseFloat(ch.dataset.monto || 0);
            if (ch.dataset.tipo === 'ingreso') ingresos += monto;
            else egresos += monto;
        });
    }

    const balance = ingresos - egresos;
    const ingresoEl = document.getElementById('flujoKpiIngresos');
    const egresoEl = document.getElementById('flujoKpiEgresos');
    const balanceEl = document.getElementById('flujoKpiBalance');
    const movsEl = document.getElementById('flujoKpiMovs');
    const modoEl = document.getElementById('flujoKpiModo');

    if (ingresoEl) ingresoEl.textContent = dineroFlujo(ingresos);
    if (egresoEl) egresoEl.textContent = dineroFlujo(egresos);
    if (balanceEl) {
        balanceEl.textContent = dineroFlujo(balance);
        balanceEl.style.color = balance >= 0 ? '#1e40af' : '#dc2626';
    }
    if (movsEl) movsEl.textContent = movimientos;
    if (modoEl) modoEl.textContent = modo;
};

window.abrirModalGastoExtra = function() {
    const html = `
    <div id="mFin" style="position:fixed; inset:0; background:rgba(0,0,0,0.7); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:400px;">
            <h3 style="margin:0; color:#1e40af;">💸 Movimiento Manual</h3>

            <label style="display:block; margin-top:15px; font-size:11px; font-weight:bold;">TIPO:</label>
            <select id="mTipo" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="egreso">🔴 Gasto / Salida</option>
                <option value="ingreso">🟢 Ingreso Extra</option>
            </select>

            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">CUENTA:</label>
            <select id="mCta" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <option value="efectivo">Caja / Efectivo</option>
                <option value="transferencia">Banco / Transferencia</option>
                <option value="tarjeta">Tarjeta / Terminal</option>
            </select>

            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">CONCEPTO:</label>
            <input type="text" id="mCon" placeholder="Ej. Pago de luz, comida, ajuste..." style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; box-sizing:border-box;">

            <label style="display:block; margin-top:10px; font-size:11px; font-weight:bold;">MONTO ($):</label>
            <input type="number" id="mMon" placeholder="0.00" style="width:100%; padding:12px; border-radius:8px; border:2px solid #1e40af; font-size:18px; font-weight:bold; box-sizing:border-box;">

            <div style="display:flex; gap:10px; margin-top:25px;">
                <button onclick="window.guardarMovManual()" style="flex:1; padding:12px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold;">💾 Guardar</button>
                <button onclick="document.getElementById('mFin').remove()" style="flex:1; padding:12px; background:#f1f5f9; color:#475569; border:none; border-radius:8px;">Cancelar</button>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.guardarMovManual = function() {
    const tipo = document.getElementById('mTipo')?.value;
    const cuentaRaw = document.getElementById('mCta')?.value;
    const concepto = document.getElementById('mCon')?.value.trim();
    const monto = parseFloat(document.getElementById('mMon')?.value);

    if (!concepto || isNaN(monto) || monto <= 0) {
        return alert("❌ Datos inválidos");
    }

    const normalizarCuentaManual = (valor) => {
        const c = String(valor || '').toLowerCase().trim();

        if (c === 'caja' || c === 'efectivo') return 'efectivo';
        if (c === 'banco' || c === 'transferencia') return 'transferencia';
        if (c === 'terminal' || c === 'tarjeta') return 'tarjeta';

        return valor || 'efectivo';
    };

    const movimientosRaw = StorageService.get("movimientosManuales", []);
    const movimientos = Array.isArray(movimientosRaw)
        ? movimientosRaw
        : [];

    movimientos.push({
        id: Date.now(),
        fecha: Date.now(),
        tipo,
        cuenta: normalizarCuentaManual(cuentaRaw),
        concepto: `[Manual] ${concepto}`,
        monto
    });

    StorageService.set("movimientosManuales", movimientos);

    const modal = document.getElementById('mFin');
    if (modal) modal.remove();

    window.renderReporteFlujo();
};

window.exportarReporteFlujo = function() {
    const movimientosCaja = StorageService.get("movimientosCaja", []);

    if (typeof _csvDescargar !== 'function') {
        alert("❌ No está disponible la función de exportación CSV.");
        return;
    }

    _csvDescargar(
        'reporte-flujo.csv',
        ['Folio', 'Fecha', 'Tipo', 'Monto', 'Concepto', 'Referencia'],
        movimientosCaja.map(m => [
            m.folio || '-',
            m.fecha || '-',
            m.tipo || '-',
            m.monto || 0,
            m.concepto || '-',
            m.referencia || '-'
        ])
    );
};

// --- Registro Global de Funciones ---
window.renderReporteVentas = window.renderReporteVentas;
window.exportarReporteVentas = window.exportarReporteVentas;
window.renderReporteCompras = window.renderReporteCompras;
window.exportarReporteCompras = window.exportarReporteCompras;
window.renderReporteCompromisos = window.renderReporteCompromisos;
window.renderReporteLiquidezCortoPlazo = window.renderReporteLiquidezCortoPlazo;
window.renderReporteFlujo = window.renderReporteFlujo;
window.exportarReporteFlujo = window.exportarReporteFlujo;
