// ============================================================================
// 🏷️ PROMOCIONES — promociones de CONTADO o de CRÉDITO (versión 1: diseño y publicidad)
//
//   • Contado: descuento en porcentaje o en pesos sobre el precio de contado.
//   • Crédito: enganche reducido, meses sin intereses y/o tasa preferencial mensual.
//
// Cada promoción define su alcance (productos, categorías o todo lo que tiene existencia), su
// vigencia y sus condiciones. El módulo calcula el precio / abono promocional con la MISMA regla
// del catálogo (enganche, redondeos), muestra en privado el impacto en tu margen y la conecta con
// el módulo de Publicidad para generar los anuncios.
//
// 🛡️ Versión 1: NO cambia precios ni condiciones de crédito en ventas, apartados ni en el catálogo
// público. Es la promoción "que se anuncia". Aplicarla automáticamente al cobrar es la fase 2.
// 🔒 El costo y el margen solo se ven en esta pantalla de administrador; nunca salen en un anuncio.
// ============================================================================
(function () {
    'use strict';

    const TABLA = 'promociones';
    const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

    const PRM = { vista: 'lista', filtro: 'todas', draft: null, editId: null, busqueda: '', categoria: '', margenMin: 10, msg: '' };

    const $ = id => document.getElementById(id);
    const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const dinero = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0);
    const sinAcentos = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const pct1 = n => (Math.round(Number(n) * 10) / 10).toString().replace(/\.0$/, '');

    // ------------------------------------------------------------------ datos
    function leer(k) { try { const v = StorageService.get(k, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
    function todasLasPromos() { return leer(TABLA); }
    function productos() { return leer('productos'); }
    function obtener(id) { return todasLasPromos().find(p => String(p.id) === String(id)) || null; }
    function hoyISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    function fechaTxt(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : ''; }

    function estado(pr) {
        if (pr.pausada) return 'Pausada';
        const v = pr.vigencia || {}, hoy = hoyISO();
        if (v.desde && hoy < v.desde) return 'Programada';
        if (v.hasta && hoy > v.hasta) return 'Finalizada';
        return 'Vigente';
    }
    function vigenciaTexto(pr) {
        const v = pr.vigencia || {};
        let t = '';
        if (v.desde && v.hasta) t = `Del ${fechaTxt(v.desde)} al ${fechaTxt(v.hasta)}`;
        else if (v.hasta) t = `Válida hasta el ${fechaTxt(v.hasta)}`;
        else if (v.desde) t = `A partir del ${fechaTxt(v.desde)}`;
        if (v.hastaAgotar) t = t ? `${t} o hasta agotar existencias` : 'Hasta agotar existencias';
        return t;
    }

    // ------------------------------------------------------------------ alcance y cálculo
    function aplicaA(pr, p) {
        const a = pr.alcance || {};
        if (a.soloConStock !== false && !(Number(p.stock) > 0)) return false;
        if (a.modo === 'productos') return (a.productoIds || []).map(String).includes(String(p.id));
        if (a.modo === 'categoria') return (a.categorias || []).includes(p.categoria);
        return true;   // 'todos'
    }
    function productosDe(pr) { return productos().filter(p => aplicaA(pr, p)); }

    // Resultado único que consumen Publicidad y la pantalla de impacto
    function calcular(p, pr) {
        if (!p || !pr) return null;
        const precio = Number(p.precio) || 0;
        const base = { promocionId: pr.id, nombre: pr.nombre, tipo: pr.tipo, vigencia: vigenciaTexto(pr), condiciones: pr.condiciones || '' };
        if (pr.tipo === 'contado') {
            const c = pr.contado || {};
            const valor = Number(c.valor) || 0;
            let precioPromo = c.modo === 'monto' ? precio - valor : precio * (1 - valor / 100);
            precioPromo = Math.max(0, Math.round(precioPromo / 10) * 10);          // a múltiplos de $10, como tus precios
            if (!(precioPromo < precio)) return null;
            const ahorro = precio - precioPromo, pct = Math.round((ahorro / precio) * 1000) / 10;
            return Object.assign(base, { precioNormal: precio, precioPromo, ahorro, pct, etiqueta: c.modo === 'monto' ? `${dinero(ahorro)} DE DESCUENTO` : `${pct1(pct)}% DE DESCUENTO` });
        }
        // ----- crédito
        const cr = pr.credito || {}, PS = window.PublicidadService;
        if (!PS) return null;
        const opts = {};
        if (cr.enganchePct != null && cr.enganchePct !== '') opts.enganchePct = Number(cr.enganchePct);
        if (cr.tasaPct != null && cr.tasaPct !== '') opts.tasaMensual = Number(cr.tasaPct);
        const planes = PS.planesCatalogo(p, opts);
        if (!planes.length) return null;
        let msi = null;
        if (cr.msiMeses) {
            const m = Number(cr.msiMeses), i = planes.findIndex(x => x.meses === m);
            if (i >= 0) {
                const pl = planes[i], semanas = m * 4, saldo = Math.max(0, precio - pl.enganche);
                const abono = Math.max(1, Math.ceil(saldo / semanas));               // sin interés: se redondea solo al peso
                planes[i] = Object.assign({}, pl, { abono, total: abono * semanas + pl.enganche, msi: true });
                msi = planes[i];
            }
        }
        const normal = PS.planPrincipal(p);
        const principal = msi || planes[5] || planes[planes.length - 1];
        const engPct = opts.enganchePct != null ? opts.enganchePct : 10;
        const etiquetas = [];
        if (msi) etiquetas.push(`${msi.meses} ${msi.meses === 1 ? 'MES' : 'MESES'} SIN INTERESES`);
        if (opts.tasaMensual != null && !msi) etiquetas.push(`TASA ESPECIAL ${pct1(opts.tasaMensual)}% MENSUAL`);
        if (opts.enganchePct != null && opts.enganchePct < 10) etiquetas.push(opts.enganchePct <= 0 ? 'SIN ENGANCHE' : `ENGANCHE DESDE ${dinero(principal.enganche)}`);
        if (!etiquetas.length) return null;
        return Object.assign(base, { precioContado: precio, enganche: principal.enganche, enganchePct: engPct, principal, planes, msi, normal, etiquetas, etiqueta: etiquetas[0] });
    }

    // Lectura privada de margen (solo para la pantalla de administrador)
    function impacto(p, r) {
        const costo = Number(p.costo) || 0;
        if (!r) return null;
        if (r.tipo === 'contado') {
            const mN = r.precioNormal > 0 ? (r.precioNormal - costo) / r.precioNormal * 100 : null;
            const mP = r.precioPromo > 0 ? (r.precioPromo - costo) / r.precioPromo * 100 : null;
            return { costo, mN, mP, perdida: r.precioPromo < costo, cuesta: r.ahorro };
        }
        const totN = r.normal ? r.normal.total : 0, totP = r.principal.total;
        const mN = totN > 0 ? (totN - costo) / totN * 100 : null, mP = totP > 0 ? (totP - costo) / totP * 100 : null;
        return { costo, mN, mP, perdida: totP < costo, cuesta: totN - totP, totN, totP };
    }

    // ------------------------------------------------------------------ guardado
    function guardarLista(l) { StorageService.set(TABLA, l); }
    function auditoria(accion, pr, detalle) {
        try { if (window.AuditService && AuditService.log) AuditService.log({ accion, modulo: 'Promociones', entidad: 'promocion', entidadId: pr.id, detalle: `${detalle}: ${pr.nombre}`, severidad: 'info', datos: { tipo: pr.tipo } }); } catch (e) { /* bitácora opcional */ }
    }
    function nuevoBorrador(tipo) {
        return {
            id: null, nombre: '', tipo: tipo || 'contado',
            contado: { modo: 'porcentaje', valor: 10 },
            credito: { usaEnganche: false, enganchePct: 5, usaMsi: true, msiMeses: 3, usaTasa: false, tasaPct: 1.5 },
            alcance: { modo: 'productos', productoIds: [], categorias: [], soloConStock: true },
            vigencia: { desde: hoyISO(), hasta: '', hastaAgotar: true },
            condiciones: 'Sujeto a existencias.', pausada: false
        };
    }
    function draftAPromo(d) {
        const out = { id: d.id, nombre: String(d.nombre || '').trim(), tipo: d.tipo, pausada: !!d.pausada, condiciones: String(d.condiciones || '').trim(),
            alcance: { modo: d.alcance.modo, productoIds: (d.alcance.productoIds || []).map(String), categorias: d.alcance.categorias || [], soloConStock: d.alcance.soloConStock !== false },
            vigencia: { desde: d.vigencia.desde || '', hasta: d.vigencia.hasta || '', hastaAgotar: !!d.vigencia.hastaAgotar } };
        if (d.tipo === 'contado') out.contado = { modo: d.contado.modo, valor: Number(d.contado.valor) || 0 };
        else out.credito = {
            enganchePct: d.credito.usaEnganche ? Number(d.credito.enganchePct) : null,
            msiMeses: d.credito.usaMsi ? Number(d.credito.msiMeses) : null,
            tasaPct: d.credito.usaTasa ? Number(d.credito.tasaPct) : null
        };
        return out;
    }
    function promoADraft(pr) {
        const d = nuevoBorrador(pr.tipo);
        d.id = pr.id; d.nombre = pr.nombre; d.pausada = !!pr.pausada; d.condiciones = pr.condiciones || '';
        d.alcance = Object.assign({}, d.alcance, pr.alcance || {}); d.vigencia = Object.assign({}, d.vigencia, pr.vigencia || {});
        if (pr.tipo === 'contado') d.contado = Object.assign({}, d.contado, pr.contado || {});
        else { const c = pr.credito || {}; d.credito = { usaEnganche: c.enganchePct != null, enganchePct: c.enganchePct != null ? c.enganchePct : 5, usaMsi: !!c.msiMeses, msiMeses: c.msiMeses || 3, usaTasa: c.tasaPct != null, tasaPct: c.tasaPct != null ? c.tasaPct : 1.5 }; }
        return d;
    }
    function validar(pr) {
        if (!pr.nombre) return 'Ponle un nombre a la promoción.';
        if (pr.tipo === 'contado') {
            const v = Number(pr.contado.valor);
            if (!(v > 0)) return 'Captura el descuento.';
            if (pr.contado.modo === 'porcentaje' && v >= 100) return 'El descuento en porcentaje debe ser menor a 100.';
        } else {
            const c = pr.credito;
            if (c.enganchePct == null && !c.msiMeses && c.tasaPct == null) return 'Elige al menos una condición de crédito (enganche, meses sin intereses o tasa).';
            if (c.enganchePct != null && !(c.enganchePct >= 0 && c.enganchePct < 10)) return 'El enganche promocional debe estar entre 0% y menos de 10% (el normal es 10%).';
            if (c.tasaPct != null && !(c.tasaPct >= 0 && c.tasaPct < 10)) return 'La tasa mensual debe estar entre 0% y 10%.';
        }
        const a = pr.alcance;
        if (a.modo === 'productos' && !a.productoIds.length) return 'Elige al menos un producto.';
        if (a.modo === 'categoria' && !a.categorias.length) return 'Elige al menos una categoría.';
        if (pr.vigencia.desde && pr.vigencia.hasta && pr.vigencia.hasta < pr.vigencia.desde) return 'La fecha final no puede ser anterior a la inicial.';
        if (!productosDe(pr).length) return 'Con ese alcance no hay ningún producto (¿sin existencia?).';
        return '';
    }

    // ------------------------------------------------------------------ interfaz
    function estilos() {
        if ($('prmEstilos')) return;
        const st = document.createElement('style'); st.id = 'prmEstilos';
        st.textContent = `
.prm-card{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:14px;margin-bottom:12px}
.prm-card h3{margin:0 0 10px;font-size:15px;color:#0f172a}
.prm-in{width:100%;padding:9px 10px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box}
.prm-lbl{display:block;font-size:11.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.03em;margin:10px 0 4px}
.prm-btn{padding:9px 13px;border:none;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;background:#e2e8f0;color:#0f172a}
.prm-btn.p{background:#0e8f6f;color:#fff}.prm-btn.az{background:#2563eb;color:#fff}.prm-btn.mo{background:#7c3aed;color:#fff}.prm-btn.r{background:#fee2e2;color:#991b1b}
.prm-chip{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:800;background:#e2e8f0;color:#334155}
.prm-chip.v{background:#dcfce7;color:#166534}.prm-chip.a{background:#fef3c7;color:#92400e}.prm-chip.r{background:#fee2e2;color:#991b1b}.prm-chip.b{background:#dbeafe;color:#1e40af}.prm-chip.m{background:#ede9fe;color:#5b21b6}
.prm-seg{display:inline-flex;border:1.5px solid #cbd5e1;border-radius:10px;overflow:hidden}
.prm-seg button{padding:9px 16px;border:0;background:#fff;font-weight:800;font-size:13.5px;cursor:pointer}
.prm-seg button.on{background:#0e8f6f;color:#fff}
.prm-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:820px){.prm-grid2{grid-template-columns:1fr}}
.prm-tabla{width:100%;border-collapse:collapse;font-size:13px}
.prm-tabla th{background:#f1f5f9;text-align:right;padding:7px;font-size:11.5px;color:#475569;text-transform:uppercase}
.prm-tabla th:first-child,.prm-tabla td:first-child{text-align:left}
.prm-tabla td{padding:7px;border-bottom:1px solid #eef2f7;text-align:right}
.prm-lista{max-height:300px;overflow-y:auto;border:1px solid #e5e7eb;border-radius:10px}
.prm-fila{display:flex;gap:10px;align-items:center;padding:7px 9px;border-bottom:1px solid #f1f5f9;font-size:13.5px;cursor:pointer}
.prm-aviso{background:#fffbeb;border:1px solid #fde68a;color:#92400e;padding:10px 12px;border-radius:10px;font-size:13px;margin-bottom:12px;line-height:1.4}`;
        document.head.appendChild(st);
    }

    function chipEstado(pr) {
        const e = estado(pr), cls = { Vigente: 'v', Programada: 'b', Finalizada: '', Pausada: 'a' }[e] || '';
        return `<span class="prm-chip ${cls}">${e}</span>`;
    }
    function resumenCondicion(pr) {
        if (pr.tipo === 'contado') { const c = pr.contado || {}; return c.modo === 'monto' ? `${dinero(c.valor)} de descuento` : `${pct1(c.valor)}% de descuento`; }
        const c = pr.credito || {}, t = [];
        if (c.msiMeses) t.push(`${c.msiMeses} ${c.msiMeses === 1 ? 'mes' : 'meses'} sin intereses`);
        if (c.enganchePct != null) t.push(c.enganchePct <= 0 ? 'sin enganche' : `enganche ${pct1(c.enganchePct)}%`);
        if (c.tasaPct != null) t.push(`tasa ${pct1(c.tasaPct)}% mensual`);
        return t.join(' + ');
    }
    function resumenAlcance(pr) {
        const a = pr.alcance || {}, n = productosDe(pr).length;
        const que = a.modo === 'productos' ? 'productos elegidos' : a.modo === 'categoria' ? a.categorias.join(', ') : 'todo el inventario con existencia';
        return `${n} producto${n === 1 ? '' : 's'} · ${que}`;
    }

    function vistaLista() {
        const todas = todasLasPromos().slice().sort((a, b) => String(b.id).localeCompare(String(a.id)));
        const filtros = [['todas', 'Todas'], ['Vigente', 'Vigentes'], ['Programada', 'Programadas'], ['Pausada', 'Pausadas'], ['Finalizada', 'Finalizadas']];
        const lista = todas.filter(p => PRM.filtro === 'todas' || estado(p) === PRM.filtro);
        const cuenta = f => f === 'todas' ? todas.length : todas.filter(p => estado(p) === f).length;
        const cards = lista.map(pr => `<div class="prm-card">
            <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:flex-start">
              <div style="min-width:0"><b style="font-size:16px">${esc(pr.nombre)}</b>
                <div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap"><span class="prm-chip ${pr.tipo === 'contado' ? 'm' : 'b'}">${pr.tipo === 'contado' ? '💵 Contado' : '📆 Crédito'}</span>${chipEstado(pr)}</div></div>
              <div style="text-align:right;font-weight:900;font-size:16px;color:#0b6e56">${esc(resumenCondicion(pr))}</div></div>
            <div style="font-size:13px;color:#475569;margin-top:8px">${esc(resumenAlcance(pr))}</div>
            <div style="font-size:13px;color:#475569;margin-top:2px">🗓️ ${esc(vigenciaTexto(pr) || 'Sin fechas')}</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
              <button class="prm-btn p" onclick="prmAnuncios('${esc(pr.id)}')">🎨 Crear anuncios</button>
              <button class="prm-btn" onclick="prmEditar('${esc(pr.id)}')">✏️ Editar</button>
              <button class="prm-btn" onclick="prmPausar('${esc(pr.id)}')">${pr.pausada ? '▶ Reanudar' : '⏸ Pausar'}</button>
              <button class="prm-btn" onclick="prmDuplicar('${esc(pr.id)}')">⧉ Duplicar</button>
              <button class="prm-btn r" onclick="prmEliminar('${esc(pr.id)}')">🗑 Eliminar</button></div></div>`).join('');
        return `<div class="prm-aviso"><b>Versión 1 — diseño y publicidad.</b> Aquí armas la promoción y generas sus anuncios con los números correctos. Por ahora <b>no cambia</b> los precios ni el crédito al vender (ni el catálogo público); el cobro se hace como siempre. Aplicarla automáticamente al cobrar es el siguiente paso.</div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
              <button class="prm-btn p" onclick="prmNueva('contado')">➕ Promoción de contado</button>
              <button class="prm-btn az" onclick="prmNueva('credito')">➕ Promoción de crédito</button>
              <span style="flex:1"></span>
              ${filtros.map(([k, t]) => `<button class="prm-btn" style="${PRM.filtro === k ? 'background:#0f172a;color:#fff' : ''}" onclick="PRM_.filtro='${k}'; renderPromociones()">${t} · ${cuenta(k)}</button>`).join('')}</div>
            ${cards || '<div class="prm-card" style="text-align:center;color:#94a3b8;padding:34px">Todavía no hay promociones en esta vista. Crea una de contado o de crédito.</div>'}`;
    }

    // ----- editor
    function categoriasDisponibles() { return [...new Set(productos().map(p => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es-MX')); }
    function listaProductosPicker(d) {
        const q = sinAcentos(PRM.busqueda).trim();
        return productos().filter(p => (!d.alcance.soloConStock || Number(p.stock) > 0) && (!PRM.categoria || p.categoria === PRM.categoria) && (!q || sinAcentos([p.nombre, p.marca, p.modelo, p.categoria].join(' ')).includes(q)))
            .sort((a, b) => String(a.categoria).localeCompare(String(b.categoria), 'es-MX') || String(a.nombre).localeCompare(String(b.nombre), 'es-MX'));
    }
    function filasPicker(d) {
        const l = listaProductosPicker(d), sel = new Set((d.alcance.productoIds || []).map(String));
        return l.length ? l.map(p => `<label class="prm-fila"><input type="checkbox" ${sel.has(String(p.id)) ? 'checked' : ''} onchange="prmTogProd('${esc(p.id)}',this.checked)"><span style="flex:1;min-width:0"><b>${esc(p.nombre)}</b><br><small style="color:#64748b">${esc(p.categoria || '')}</small></span><b>${dinero(p.precio)}</b></label>`).join('')
            : '<div style="padding:16px;text-align:center;color:#94a3b8">Sin productos con este filtro.</div>';
    }
    function tablaImpacto(d) {
        const pr = draftAPromo(d), ps = productosDe(pr);
        if (!ps.length) return '<div style="color:#94a3b8;padding:12px">Elige productos o categorías para ver el impacto.</div>';
        const filas = ps.map(p => ({ p, r: calcular(p, pr) })).map(x => Object.assign(x, { i: impacto(x.p, x.r) }));
        const validas = filas.filter(x => x.r), sinEfecto = filas.length - validas.length;
        const perdidas = validas.filter(x => x.i.perdida).length, bajos = validas.filter(x => !x.i.perdida && x.i.mP != null && x.i.mP < PRM.margenMin).length;
        const costoTotal = validas.reduce((t, x) => t + Math.max(0, x.i.cuesta), 0);
        const f = n => (n == null ? '—' : pct1(n) + '%');
        const body = validas.slice(0, 40).map(({ p, r, i }) => {
            const alerta = i.perdida ? '<span class="prm-chip r">Pierdes dinero</span>' : (i.mP != null && i.mP < PRM.margenMin ? '<span class="prm-chip a">Margen bajo</span>' : '<span class="prm-chip v">OK</span>');
            return pr.tipo === 'contado'
                ? `<tr><td>${esc(p.nombre)}</td><td>${dinero(r.precioNormal)}</td><td><b>${dinero(r.precioPromo)}</b></td><td>${dinero(r.ahorro)}</td><td>${f(i.mN)}</td><td><b>${f(i.mP)}</b></td><td>${alerta}</td></tr>`
                : `<tr><td>${esc(p.nombre)}</td><td>${dinero(r.precioContado)}</td><td><b>${dinero(r.principal.abono)}</b> <small>×${r.principal.pagos} (${r.principal.meses}m)</small></td><td>${dinero(r.principal.enganche)}</td><td>${dinero(r.principal.total)}</td><td>${i.cuesta >= 0 ? dinero(i.cuesta) : '+' + dinero(-i.cuesta)}</td><td>${alerta}</td></tr>`;
        }).join('');
        const cab = pr.tipo === 'contado'
            ? '<tr><th>Producto</th><th>Precio normal</th><th>Precio promo</th><th>Ahorra el cliente</th><th>Tu margen normal</th><th>Tu margen con promo</th><th>Alerta</th></tr>'
            : '<tr><th>Producto</th><th>Contado</th><th>Abono semanal promo</th><th>Enganche</th><th>Total a crédito</th><th>Costo de la promo*</th><th>Alerta</th></tr>';
        return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="prm-chip b">${validas.length} producto(s) con promoción</span>${sinEfecto ? `<span class="prm-chip">${sinEfecto} sin efecto</span>` : ''}${perdidas ? `<span class="prm-chip r">${perdidas} vendiéndose por debajo del costo</span>` : ''}${bajos ? `<span class="prm-chip a">${bajos} con margen bajo (&lt; ${PRM.margenMin}%)</span>` : ''}<span class="prm-chip m">${pr.tipo === 'contado' ? 'Descuento total si vendes 1 de cada uno' : 'Costo si vendes 1 de cada uno*'}: ${dinero(costoTotal)}</span></div>
            <div style="overflow-x:auto"><table class="prm-tabla"><thead>${cab}</thead><tbody>${body}</tbody></table></div>
            ${validas.length > 40 ? `<p style="font-size:12px;color:#64748b">Se muestran los primeros 40 de ${validas.length}.</p>` : ''}
            ${pr.tipo === 'credito' ? '<p style="font-size:12px;color:#64748b;margin:6px 0 0">* Diferencia entre el total a crédito normal (plan que muestra el catálogo) y el total con la promoción. Si es negativa (+), la promoción te deja más total.</p>' : ''}
            <p style="font-size:12px;color:#64748b;margin:4px 0 0">🔒 Costo y margen son solo para ti; no aparecen en los anuncios.</p>`;
    }

    function vistaEditor() {
        const d = PRM.draft, cats = categoriasDisponibles(), esC = d.tipo === 'contado';
        const seg = (act, items, fn) => `<div class="prm-seg">${items.map(([k, t]) => `<button class="${act === k ? 'on' : ''}" onclick="${fn}('${k}')">${t}</button>`).join('')}</div>`;
        const msiOpts = (() => { let cfg = null; try { cfg = StorageService.get('configCreditoGlobal', null); } catch (e) { cfg = null; } const ms = cfg && Array.isArray(cfg.plazos) && cfg.plazos.length ? cfg.plazos.map(x => Number(x.meses)).sort((a, b) => a - b) : [1, 2, 3, 4, 5, 6]; return ms.map(m => `<option value="${m}" ${Number(d.credito.msiMeses) === m ? 'selected' : ''}>${m} ${m === 1 ? 'mes' : 'meses'}</option>`).join(''); })();
        const condicion = esC ? `
            <label class="prm-lbl">Tipo de descuento</label>${seg(d.contado.modo, [['porcentaje', '% de descuento'], ['monto', '$ de descuento']], 'prmContadoModo')}
            <label class="prm-lbl">${d.contado.modo === 'monto' ? 'Pesos de descuento' : 'Porcentaje de descuento'}</label>
            <input class="prm-in" type="number" min="0" step="${d.contado.modo === 'monto' ? 10 : 0.5}" value="${esc(d.contado.valor)}" oninput="PRM_.draft.contado.valor=this.value; prmImpacto()">
            <p style="font-size:12px;color:#64748b;margin:6px 0 0">El precio promocional se redondea a múltiplos de $10. Aplica solo a la venta de <b>contado</b>.</p>` : `
            <label class="prm-lbl">Condiciones de crédito (combínalas como quieras)</label>
            <label style="display:block;margin:6px 0"><input type="checkbox" ${d.credito.usaMsi ? 'checked' : ''} onchange="PRM_.draft.credito.usaMsi=this.checked; prmImpacto()"> <b>Meses sin intereses</b>:
              <select class="prm-in" style="width:auto;display:inline-block" onchange="PRM_.draft.credito.msiMeses=this.value; PRM_.draft.credito.usaMsi=true; renderPromociones()">${msiOpts}</select></label>
            <label style="display:block;margin:6px 0"><input type="checkbox" ${d.credito.usaEnganche ? 'checked' : ''} onchange="PRM_.draft.credito.usaEnganche=this.checked; prmImpacto()"> <b>Enganche reducido</b>:
              <input class="prm-in" style="width:90px;display:inline-block" type="number" min="0" max="9.5" step="0.5" value="${esc(d.credito.enganchePct)}" oninput="PRM_.draft.credito.enganchePct=this.value; PRM_.draft.credito.usaEnganche=true; prmImpacto()"> % del precio <small style="color:#64748b">(normal: 10%; 0 = sin enganche)</small></label>
            <label style="display:block;margin:6px 0"><input type="checkbox" ${d.credito.usaTasa ? 'checked' : ''} onchange="PRM_.draft.credito.usaTasa=this.checked; prmImpacto()"> <b>Tasa preferencial</b>:
              <input class="prm-in" style="width:90px;display:inline-block" type="number" min="0" max="9.5" step="0.1" value="${esc(d.credito.tasaPct)}" oninput="PRM_.draft.credito.tasaPct=this.value; PRM_.draft.credito.usaTasa=true; prmImpacto()"> % mensual en todos los plazos</label>`;
        const alcance = `
            <label class="prm-lbl">¿A qué productos aplica?</label>${seg(d.alcance.modo, [['productos', 'Productos que elija'], ['categoria', 'Categorías'], ['todos', 'Todo con existencia']], 'prmAlcanceModo')}
            <label style="display:block;font-size:13px;margin:8px 0"><input type="checkbox" ${d.alcance.soloConStock ? 'checked' : ''} onchange="PRM_.draft.alcance.soloConStock=this.checked; renderPromociones()"> Solo productos con existencia</label>
            ${d.alcance.modo === 'productos' ? `
              <div style="display:flex;gap:8px;margin-bottom:8px"><select class="prm-in" onchange="PRM_.categoria=this.value; prmRefrescarPicker()"><option value="">Todas las categorías</option>${cats.map(c => `<option ${PRM.categoria === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
                <input class="prm-in" placeholder="Buscar…" value="${esc(PRM.busqueda)}" oninput="PRM_.busqueda=this.value; prmRefrescarPicker()"></div>
              <div style="display:flex;gap:8px;margin-bottom:8px"><button class="prm-btn" onclick="prmSelVisibles(true)">☑ Seleccionar visibles</button><button class="prm-btn" onclick="prmSelVisibles(false)">Quitar visibles</button><span style="align-self:center;font-size:13px"><b id="prmNSel">${d.alcance.productoIds.length}</b> elegido(s)</span></div>
              <div class="prm-lista" id="prmPicker">${filasPicker(d)}</div>` : ''}
            ${d.alcance.modo === 'categoria' ? `<div class="prm-lista">${cats.map(c => `<label class="prm-fila"><input type="checkbox" ${(d.alcance.categorias || []).includes(c) ? 'checked' : ''} onchange="prmTogCat(this.dataset.c,this.checked)" data-c="${esc(c)}"> ${esc(c)}</label>`).join('')}</div>` : ''}`;
        return `<div class="prm-card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><h3 style="margin:0">${d.id ? 'Editar' : 'Nueva'} promoción de ${esC ? '💵 contado' : '📆 crédito'}</h3>
              <button class="prm-btn" onclick="prmCancelar()">← Volver a la lista</button></div>
            ${PRM.msg ? `<div class="prm-aviso" style="margin-top:10px;background:#fef2f2;border-color:#fecaca;color:#991b1b">${esc(PRM.msg)}</div>` : ''}
            <div class="prm-grid2" style="margin-top:6px"><div>
              <label class="prm-lbl">Nombre de la promoción</label><input class="prm-in" placeholder="Ej.: Buen Fin, Aniversario, Regreso a clases…" value="${esc(d.nombre)}" oninput="PRM_.draft.nombre=this.value">
              <label class="prm-lbl">Tipo</label>${seg(d.tipo, [['contado', '💵 Contado'], ['credito', '📆 Crédito']], 'prmTipo')}
              ${condicion}
              <label class="prm-lbl">Vigencia</label>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><input class="prm-in" style="width:auto" type="date" value="${esc(d.vigencia.desde)}" onchange="PRM_.draft.vigencia.desde=this.value"> <span>al</span> <input class="prm-in" style="width:auto" type="date" value="${esc(d.vigencia.hasta)}" onchange="PRM_.draft.vigencia.hasta=this.value"></div>
              <label style="display:block;font-size:13px;margin:8px 0"><input type="checkbox" ${d.vigencia.hastaAgotar ? 'checked' : ''} onchange="PRM_.draft.vigencia.hastaAgotar=this.checked"> También "hasta agotar existencias"</label>
              <label class="prm-lbl">Condiciones (sale en letra chica del anuncio)</label><textarea class="prm-in" rows="2" oninput="PRM_.draft.condiciones=this.value">${esc(d.condiciones)}</textarea>
            </div><div>${alcance}</div></div></div>
          <div class="prm-card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h3 style="margin:0">Impacto de la promoción (solo para ti)</h3>
              <label style="font-size:13px">Cuidar margen mínimo de <input class="prm-in" style="width:70px;display:inline-block" type="number" min="0" max="90" value="${PRM.margenMin}" oninput="PRM_.margenMin=Number(this.value)||0; prmImpacto()"> %</label></div>
            <div id="prmImpacto" style="margin-top:10px">${tablaImpacto(d)}</div></div>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="prm-btn p" onclick="prmGuardar(false)">💾 Guardar</button><button class="prm-btn az" onclick="prmGuardar(true)">💾 Guardar y crear anuncios</button><button class="prm-btn" onclick="prmCancelar()">Cancelar</button></div>`;
    }

    // ------------------------------------------------------------------ acciones (globales para los onclick)
    window.PRM_ = PRM;
    window.renderPromociones = function () {
        const c = $('promocionesContenido'); if (!c) return;
        estilos();
        c.innerHTML = PRM.vista === 'editor' && PRM.draft ? vistaEditor() : vistaLista();
    };
    window.prmImpacto = function () { const el = $('prmImpacto'); if (el && PRM.draft) el.innerHTML = tablaImpacto(PRM.draft); };
    window.prmRefrescarPicker = function () { const el = $('prmPicker'); if (el) el.innerHTML = filasPicker(PRM.draft); };
    window.prmNueva = function (tipo) { PRM.draft = nuevoBorrador(tipo); PRM.vista = 'editor'; PRM.msg = ''; PRM.busqueda = ''; PRM.categoria = ''; window.renderPromociones(); };
    window.prmEditar = function (id) { const pr = obtener(id); if (!pr) return; PRM.draft = promoADraft(pr); PRM.vista = 'editor'; PRM.msg = ''; window.renderPromociones(); };
    window.prmCancelar = function () { PRM.vista = 'lista'; PRM.draft = null; PRM.msg = ''; window.renderPromociones(); };
    window.prmTipo = function (t) { PRM.draft.tipo = t; window.renderPromociones(); };
    window.prmContadoModo = function (m) { PRM.draft.contado.modo = m; PRM.draft.contado.valor = m === 'monto' ? 200 : 10; window.renderPromociones(); };
    window.prmAlcanceModo = function (m) { PRM.draft.alcance.modo = m; window.renderPromociones(); };
    window.prmTogProd = function (id, on) {
        const l = PRM.draft.alcance.productoIds.map(String), s = new Set(l); if (on) s.add(String(id)); else s.delete(String(id));
        PRM.draft.alcance.productoIds = [...s]; const n = $('prmNSel'); if (n) n.textContent = s.size; window.prmImpacto();
    };
    window.prmSelVisibles = function (on) {
        const s = new Set(PRM.draft.alcance.productoIds.map(String));
        listaProductosPicker(PRM.draft).forEach(p => { if (on) s.add(String(p.id)); else s.delete(String(p.id)); });
        PRM.draft.alcance.productoIds = [...s]; window.renderPromociones();
    };
    window.prmTogCat = function (c, on) {
        const s = new Set(PRM.draft.alcance.categorias || []); if (on) s.add(c); else s.delete(c);
        PRM.draft.alcance.categorias = [...s]; window.prmImpacto();
    };
    window.prmGuardar = function (conAnuncios) {
        const pr = draftAPromo(PRM.draft), err = validar(pr);
        if (err) { PRM.msg = err; window.renderPromociones(); const c = $('promocionesContenido'); if (c) c.scrollIntoView({ block: 'start' }); return; }
        const lista = todasLasPromos();
        if (pr.id) { const i = lista.findIndex(x => String(x.id) === String(pr.id)); if (i >= 0) lista[i] = Object.assign({}, lista[i], pr); else lista.push(pr); auditoria('PROMOCION_EDITADA', pr, 'Promoción editada'); }
        else { pr.id = 'PR-' + Date.now().toString(36).toUpperCase(); pr.creada = new Date().toISOString(); lista.push(pr); auditoria('PROMOCION_CREADA', pr, 'Promoción creada'); }
        guardarLista(lista);
        PRM.vista = 'lista'; PRM.draft = null; PRM.msg = '';
        if (conAnuncios) return window.prmAnuncios(pr.id);
        window.renderPromociones();
    };
    window.prmPausar = function (id) { const l = todasLasPromos(), p = l.find(x => String(x.id) === String(id)); if (!p) return; p.pausada = !p.pausada; guardarLista(l); auditoria(p.pausada ? 'PROMOCION_PAUSADA' : 'PROMOCION_REANUDADA', p, p.pausada ? 'Promoción pausada' : 'Promoción reanudada'); window.renderPromociones(); };
    window.prmDuplicar = function (id) { const pr = obtener(id); if (!pr) return; const c = JSON.parse(JSON.stringify(pr)); c.id = 'PR-' + Date.now().toString(36).toUpperCase(); c.nombre += ' (copia)'; c.pausada = true; c.creada = new Date().toISOString(); const l = todasLasPromos(); l.push(c); guardarLista(l); auditoria('PROMOCION_CREADA', c, 'Promoción duplicada'); window.renderPromociones(); };
    window.prmEliminar = function (id) {
        const pr = obtener(id); if (!pr) return;
        if (!confirm(`¿Eliminar la promoción "${pr.nombre}"?\n\nLos anuncios que ya descargaste no se afectan.`)) return;
        guardarLista(todasLasPromos().filter(x => String(x.id) !== String(id))); auditoria('PROMOCION_ELIMINADA', pr, 'Promoción eliminada'); window.renderPromociones();
    };
    // Abre Publicidad con los productos de la promoción ya elegidos y la promoción aplicada
    window.prmAnuncios = function (id) {
        const pr = obtener(id); if (!pr) return;
        const ps = productosDe(pr).filter(p => calcular(p, pr));
        if (!ps.length) return alert('Esta promoción no tiene productos con efecto (revisa el alcance o el descuento).');
        if (typeof navA === 'function') navA('publicidad');
        if (window.PUB_) {
            PUB_.sel = new Set(ps.map(p => String(p.id))); PUB_.promocionId = String(pr.id); PUB_.tab = 'diseno'; PUB_.activo = String(ps[0].id); PUB_.promo = '';
            PUB_.soloStock = pr.alcance && pr.alcance.soloConStock !== false; PUB_.categoria = ''; PUB_.busqueda = '';
        }
        if (typeof renderPublicidad === 'function') renderPublicidad();
    };

    window.PromocionesService = { listar: todasLasPromos, obtener, estado, vigenciaTexto, aplicaA, productosDe, calcular, impacto, resumenCondicion };
})();
