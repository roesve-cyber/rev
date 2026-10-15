// =====================================================================
// 🧬 REPARAR VÍNCULOS DE CLIENTE (ID)
// ---------------------------------------------------------------------
// El sistema se rige por clienteId, pero hay registros que nunca lo
// recibieron (p. ej. cuentas migradas "MIG-" con nombre libre) o que
// apuntan a un ID que ya no existe en `clientes` (huérfano, típico tras
// homologar/borrar un cliente duplicado). Esos registros salen como
// clientes "aparte" en Matriz de Cobranza, estados de cuenta, etc.
//
// Esta pantalla:
//   1) Escanea las tablas que guardan clienteId y agrupa lo roto
//      (por ID huérfano, o por nombre cuando no hay ID).
//   2) Para cada grupo propone clientes existentes parecidos, con el
//      motivo (cuenta hermana, mismo nombre, referencia, nº de migración…).
//   3) TÚ decides por grupo:
//        · Mismo cliente  → se asigna el ID del cliente elegido.
//        · Cliente nuevo  → se crea con el siguiente ID disponible.
//        · Omitir         → no se toca nada.
//   4) Nada se escribe hasta pulsar "Aplicar decisiones" (y confirmar).
//
// Solo cambia el campo de ID (clienteId / cliente.id). Los nombres
// guardados en cada registro NO se modifican (el sistema ya muestra el
// nombre vigente a partir del ID). Cada cambio queda en la bitácora de
// auditoría y se puede descargar como JSON.
// =====================================================================
(function () {
    'use strict';

    // ── Tablas que guardan referencia a un cliente ────────────────────
    // key: campo único del registro (para ubicarlo al escribir).
    const TABLAS = [
        { t: 'cuentasPorCobrar', key: 'folio', etiqueta: 'Cuentas por cobrar' },
        { t: 'apartados', key: 'folio', etiqueta: 'Apartados' },
        { t: 'ventasRegistradas', key: 'folio', etiqueta: 'Ventas' },
        { t: 'pagaresSistema', key: 'id', etiqueta: 'Pagarés' },
        { t: 'cotizaciones', key: 'id', etiqueta: 'Cotizaciones' },
        { t: 'salidasPendientesVenta', key: 'id', etiqueta: 'Salidas pendientes' },
        { t: 'documentosEntrega', key: 'id', etiqueta: 'Documentos de entrega' },
        { t: 'historialCobranza', key: 'id', etiqueta: 'Historial de cobranza' },
        { t: 'historialSolicitudesClientes', key: 'id', etiqueta: 'Solicitudes de cliente' },
        { t: 'puntosPorCliente', key: 'clienteId', etiqueta: 'Puntos por cliente' }
    ];
    const GENERICOS = new Set(['cliente general', 'publico general', 'mostrador', 'sin cliente', 'general']);
    const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e']);

    // ── Utilidades ────────────────────────────────────────────────────
    const leer = (tabla) => {
        try {
            const v = StorageService.get(tabla, []);
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    };
    const copiar = (v) => JSON.parse(JSON.stringify(v));
    const esc = (s) => String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const norm = (s) => String(s === undefined || s === null ? '' : s)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));
    const igualSet = (a, b) => a.length && a.length === b.length && a.every((x) => b.includes(x));
    const vacio = (v) => v === undefined || v === null || v === '';
    const esObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

    function bigramas(s) {
        const t = norm(s).replace(/ /g, '');
        const m = new Map();
        for (let i = 0; i < t.length - 1; i++) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
        return m;
    }
    function dice(a, b) {
        const A = bigramas(a), B = bigramas(b);
        let inter = 0, ta = 0, tb = 0;
        A.forEach((n) => { ta += n; });
        B.forEach((n) => { tb += n; });
        A.forEach((n, g) => { if (B.has(g)) inter += Math.min(n, B.get(g)); });
        return ta + tb ? (2 * inter) / (ta + tb) : 0;
    }

    // ── Acceso uniforme al ID / nombre de un registro ─────────────────
    const getId = (r) => {
        if (!vacio(r.clienteId)) return r.clienteId;
        if (esObj(r.cliente) && !vacio(r.cliente.id)) return r.cliente.id;
        return null;
    };
    const getNombre = (r) => {
        if (typeof r.clienteNombre === 'string' && r.clienteNombre.trim()) return r.clienteNombre.trim();
        if (typeof r.nombre === 'string' && r.nombre.trim()) return r.nombre.trim();
        if (esObj(r.cliente) && typeof r.cliente.nombre === 'string') return r.cliente.nombre.trim();
        if (typeof r.cliente === 'string') return r.cliente.trim();
        return '';
    };
    const getTel = (r) => String(r.telefono || (esObj(r.cliente) ? r.cliente.telefono : '') || '').replace(/\D/g, '');
    function setId(r, id) {
        const anterior = getId(r);
        if (esObj(r.cliente)) r.cliente = Object.assign({}, r.cliente, { id });
        if (!esObj(r.cliente) || 'clienteId' in r) r.clienteId = id;
        return anterior;
    }

    // ── Escaneo ───────────────────────────────────────────────────────
    function escanear() {
        const clientes = leer('clientes');
        const porId = new Map(clientes.map((c) => [String(c.id), c]));
        const datos = {};
        TABLAS.forEach((d) => { datos[d.t] = leer(d.t); });

        // cuentas con ID válido por folio → "cuenta hermana"
        const cxcPorFolio = new Map();
        datos.cuentasPorCobrar.forEach((c) => {
            const id = getId(c);
            if (!vacio(id) && porId.has(String(id))) cxcPorFolio.set(String(c.folio), String(id));
        });

        const grupos = new Map();
        const idsUsados = new Set(clientes.map((c) => Number(c.id)).filter(Number.isFinite));
        let sinInfo = 0;

        TABLAS.forEach((d) => {
            datos[d.t].forEach((r) => {
                const id = getId(r);
                if (!vacio(id)) { const n = Number(id); if (Number.isFinite(n)) idsUsados.add(n); }
                const huerfano = !vacio(id) && !porId.has(String(id));
                const sinId = vacio(id);
                if (!huerfano && !sinId) return;
                if (d.t === 'puntosPorCliente' && sinId) return;

                let nombre = getNombre(r);
                if (sinId) {
                    if (!nombre) {
                        const f = r.folio || r.folioVenta;
                        const hermano = f && cxcPorFolio.get(String(f));
                        if (!hermano) { sinInfo++; return; }
                        nombre = (porId.get(hermano) || {}).nombre || '';
                    }
                    if (GENERICOS.has(norm(nombre))) return;
                }
                const gk = huerfano ? 'ID:' + id : 'N:' + norm(nombre);
                if (!grupos.has(gk)) {
                    grupos.set(gk, { key: gk, idRoto: huerfano ? String(id) : null, nombres: new Map(), refs: [], folios: new Set(), tel: '', dir: '' });
                }
                const g = grupos.get(gk);
                if (nombre) g.nombres.set(nombre, (g.nombres.get(nombre) || 0) + 1);
                const folio = r.folio || r.folioVenta || '';
                if (folio) g.folios.add(String(folio));
                g.refs.push({ t: d.t, key: d.key, clave: r[d.key], folio: String(folio || ''), registro: r, idAnterior: vacio(id) ? null : id });
                if (!g.tel && getTel(r)) g.tel = String(r.telefono || '');
                if (!g.dir && r.direccion) g.dir = String(r.direccion);
            });
        });

        const lista = Array.from(grupos.values()).map((g) => {
            g.nombreMostrar = Array.from(g.nombres.entries()).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || '(sin nombre)';
            g.cuentas = g.refs.filter((x) => x.t === 'cuentasPorCobrar');
            g.saldo = g.cuentas.reduce((s, x) => s + (Number(x.registro.saldoActual) || 0), 0);
            g.porTabla = {};
            g.refs.forEach((x) => { g.porTabla[x.t] = (g.porTabla[x.t] || 0) + 1; });
            g.candidatos = candidatos(g, clientes, cxcPorFolio, porId, datos);
            return g;
        });
        lista.sort((a, b) => (b.cuentas.length - a.cuentas.length) || (b.refs.length - a.refs.length));
        return { grupos: lista, clientes, idsUsados, sinInfo, datos };
    }

    // ── Candidatos: clientes existentes que podrían ser el mismo ──────
    function candidatos(g, clientes, cxcPorFolio, porId, datos) {
        const mapa = new Map();
        const sumar = (c, score, motivo) => {
            const k = String(c.id);
            if (!mapa.has(k)) mapa.set(k, { cliente: c, score: 0, motivos: [] });
            const m = mapa.get(k);
            m.score = Math.max(m.score, score);
            if (!m.motivos.includes(motivo)) m.motivos.push(motivo);
        };
        const nombresGrupo = Array.from(g.nombres.keys());

        // 1) Cuenta hermana: otra cuenta con el mismo folio ya apunta a un cliente válido
        g.refs.forEach((x) => {
            if (!x.folio || x.t === 'cuentasPorCobrar') return;
            const hid = cxcPorFolio.get(x.folio);
            if (hid && porId.has(hid)) sumar(porId.get(hid), 100, `La cuenta ${x.folio} ya apunta a este cliente`);
        });
        // 2) Número de migración: MIG-082 → cliente …082 (serie 1715000000xxx)
        g.refs.forEach((x) => {
            const m = /^MIG-0*(\d+)$/i.exec(x.folio || '');
            if (!m) return;
            const c = porId.get(String(1715000000000 + Number(m[1])));
            if (c) sumar(c, 70, `Coincide con el nº de migración de ${x.folio}`);
        });
        // 3) Teléfono, nombre y referencia
        const telG = String(g.tel || '').replace(/\D/g, '');
        clientes.forEach((c) => {
            if (c.id === undefined) return;
            if (telG.length >= 10 && String(c.telefono || '').replace(/\D/g, '') === telG) sumar(c, 95, 'Mismo teléfono');
            const tc = tokens(c.nombre), tr = tokens(c.referencia);
            nombresGrupo.forEach((nom) => {
                const tn = tokens(nom);
                if (!tn.length) return;
                if (igualSet(tn, tc)) sumar(c, 90, 'Mismo nombre');
                else if (tr.length && igualSet(tn, tr)) sumar(c, 88, `Su referencia dice «${c.referencia}»`);
                else {
                    const cont = (a, b) => a.length >= 1 && a.every((w) => w.length >= 3 && b.includes(w));
                    if (cont(tn, tc) || cont(tc, tn)) sumar(c, 62, 'Nombre contenido en el otro');
                    else if (tr.length && (cont(tn, tr) || cont(tr, tn))) sumar(c, 60, `Parecido a su referencia «${c.referencia}»`);
                    else {
                        const d = Math.max(dice(nom, c.nombre), tr.length ? dice(nom, c.referencia) : 0);
                        if (d >= 0.75) sumar(c, Math.round(d * 60), 'Nombre parecido');
                    }
                }
            });
        });
        // cuántas cuentas ya tiene cada candidato (ayuda a decidir)
        const cuentasDe = new Map();
        datos.cuentasPorCobrar.forEach((c) => {
            const id = getId(c);
            if (!vacio(id)) cuentasDe.set(String(id), (cuentasDe.get(String(id)) || 0) + 1);
        });
        return Array.from(mapa.values())
            .filter((m) => m.score >= 50)
            .map((m) => Object.assign(m, { cuentas: cuentasDe.get(String(m.cliente.id)) || 0 }))
            .sort((a, b) => b.score - a.score).slice(0, 5);
    }

    function siguienteId(escaneo, extra) {
        let max = 0;
        escaneo.idsUsados.forEach((n) => { if (n > max) max = n; });
        (extra || new Set()).forEach((n) => { if (n > max) max = n; });
        return max + 1;
    }

    // ── Interfaz ──────────────────────────────────────────────────────
    let ESC = null;

    function abrir() {
        document.querySelector('[data-modal="auditoria-clientes-id"]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="auditoria-clientes-id" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9999;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:20px;">
            <div style="background:white;border-radius:12px;width:100%;max-width:1100px;padding:22px;box-shadow:0 20px 25px rgba(0,0,0,0.25);">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <h2 style="margin:0;color:#7c3aed;">🧬 Reparar vínculos de cliente (ID)</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;auditoria-clientes-id&quot;]').remove()" style="border:none;background:#f1f5f9;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:bold;">✕ Cerrar</button>
                </div>
                <p style="color:#64748b;font-size:13px;margin:6px 0 14px;">Registros sin ID de cliente o con un ID que ya no existe. Para cada grupo decide si es <strong>el mismo cliente</strong> (se asigna su ID) o <strong>un cliente distinto</strong> (se crea con el siguiente ID disponible). No se escribe nada hasta pulsar <strong>Aplicar decisiones</strong>.</p>
                <div id="aciResultado"></div>
            </div>
        </div>`);
        renderizar();
    }

    function renderizar() {
        const cont = document.getElementById('aciResultado');
        if (!cont) return;
        ESC = escanear();
        if (!ESC.grupos.length) {
            cont.innerHTML = `<div style="padding:24px;text-align:center;color:#15803d;font-weight:bold;background:#f0fdf4;border-radius:10px;">✅ Todos los registros tienen un cliente válido.${ESC.sinInfo ? `<div style="font-weight:normal;color:#64748b;font-size:12px;margin-top:6px;">(${ESC.sinInfo} registro(s) sin ID ni nombre no se pueden evaluar.)</div>` : ''}</div>`;
            return;
        }
        const nextId = siguienteId(ESC);
        const opcionesTodos = ESC.clientes.slice().sort((a, b) => norm(a.nombre).localeCompare(norm(b.nombre)))
            .map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}${c.referencia ? ' (' + esc(c.referencia) + ')' : ''} · #${esc(c.id)}</option>`).join('');

        const tarjetas = ESC.grupos.map((g, i) => {
            const top = g.candidatos[0];
            const fuerte = top && top.score >= 85;
            const defecto = fuerte ? 'cand' : (g.candidatos.length ? 'omitir' : 'nuevo');
            const tablas = Object.keys(g.porTabla).map((t) => `${esc((TABLAS.find((x) => x.t === t) || {}).etiqueta || t)}: <strong>${g.porTabla[t]}</strong>`).join(' · ');
            const candHtml = g.candidatos.map((m, j) => `
                <label style="display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border:1px solid ${j === 0 && fuerte ? '#86efac' : '#e2e8f0'};border-radius:8px;background:${j === 0 && fuerte ? '#f0fdf4' : '#fff'};cursor:pointer;margin-top:6px;">
                    <input type="radio" name="aci-acc-${i}" value="cand:${esc(m.cliente.id)}" ${defecto === 'cand' && j === 0 ? 'checked' : ''} style="margin-top:3px;">
                    <span style="font-size:13px;">
                        <strong>${esc(m.cliente.nombre)}</strong> <span style="color:#64748b;">· ID ${esc(m.cliente.id)}${m.cliente.referencia ? ' · ref: ' + esc(m.cliente.referencia) : ''}${m.cliente.telefono ? ' · tel ' + esc(m.cliente.telefono) : ''} · ${m.cuentas} cuenta(s)</span>
                        <div style="font-size:12px;color:#475569;">${m.motivos.map(esc).join(' · ')}</div>
                    </span>
                    ${j === 0 && fuerte ? '<span style="margin-left:auto;font-size:11px;background:#16a34a;color:#fff;border-radius:99px;padding:2px 8px;white-space:nowrap;">Sugerido</span>' : ''}
                </label>`).join('');
            return `
            <div class="aci-grupo" data-gk="${esc(g.key)}" data-i="${i}" style="border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin-top:12px;">
                <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                    <div>
                        <div style="font-weight:bold;font-size:15px;color:#0f172a;">${esc(g.nombreMostrar)}</div>
                        <div style="font-size:12px;color:#64748b;">${g.idRoto ? `Apunta a un ID que ya no existe: <code>${esc(g.idRoto)}</code>` : 'Sin ID de cliente'}${g.nombres.size > 1 ? ' · nombres vistos: ' + esc(Array.from(g.nombres.keys()).join(', ')) : ''}</div>
                    </div>
                    <div style="font-size:12px;color:#475569;text-align:right;">${g.cuentas.length ? `Saldo pendiente: <strong>${esc(typeof window.dinero === 'function' ? window.dinero(g.saldo) : '$' + g.saldo.toFixed(2))}</strong><br>` : ''}Folios: ${esc(Array.from(g.folios).slice(0, 4).join(', '))}${g.folios.size > 4 ? '…' : ''}</div>
                </div>
                <div style="font-size:12px;color:#475569;margin-top:6px;">${tablas}</div>
                ${candHtml}
                <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;cursor:pointer;">
                    <input type="radio" name="aci-acc-${i}" value="otro"> Otro cliente existente:
                    <select class="aci-otro" style="flex:1;min-width:0;padding:5px;border:1px solid #cbd5e1;border-radius:6px;" onfocus="this.parentElement.querySelector('input').checked=true"><option value="">— elegir —</option>${opcionesTodos}</select>
                </label>
                <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;cursor:pointer;flex-wrap:wrap;">
                    <input type="radio" name="aci-acc-${i}" value="nuevo" ${defecto === 'nuevo' ? 'checked' : ''}> <strong>Es un cliente distinto</strong> → crear con ID <code class="aci-next">${nextId}</code>
                    <input type="text" class="aci-nombre-nuevo" value="${esc(g.nombreMostrar)}" placeholder="Nombre del cliente nuevo" style="flex:1;min-width:160px;padding:5px;border:1px solid #cbd5e1;border-radius:6px;" onfocus="this.parentElement.querySelector('input[type=radio]').checked=true">
                </label>
                <label style="display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;cursor:pointer;color:#64748b;">
                    <input type="radio" name="aci-acc-${i}" value="omitir" ${defecto === 'omitir' ? 'checked' : ''}> Omitir por ahora
                </label>
            </div>`;
        }).join('');

        cont.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 14px;">
                <div style="font-size:13px;color:#581c87;"><strong>${ESC.grupos.length}</strong> grupo(s) por reparar · <strong>${ESC.grupos.reduce((s, g) => s + g.refs.length, 0)}</strong> registro(s)${ESC.sinInfo ? ` · ${ESC.sinInfo} sin ID ni nombre (no evaluables)` : ''}</div>
                <button onclick="aplicarReparacionClientesId()" style="padding:10px 18px;background:#7c3aed;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🧬 Aplicar decisiones</button>
            </div>
            ${tarjetas}
            <div style="margin-top:16px;"><button onclick="aplicarReparacionClientesId()" style="padding:10px 18px;background:#7c3aed;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🧬 Aplicar decisiones</button></div>`;
    }

    function leerDecisiones() {
        const out = [];
        document.querySelectorAll('#aciResultado .aci-grupo').forEach((el) => {
            const sel = el.querySelector('input[type=radio]:checked');
            if (!sel || sel.value === 'omitir') return;
            const gk = el.getAttribute('data-gk');
            if (sel.value === 'nuevo') {
                const nombre = (el.querySelector('.aci-nombre-nuevo').value || '').trim();
                out.push({ gk, accion: 'nuevo', nombre });
            } else if (sel.value === 'otro') {
                out.push({ gk, accion: 'existente', destId: el.querySelector('.aci-otro').value });
            } else if (sel.value.startsWith('cand:')) {
                out.push({ gk, accion: 'existente', destId: sel.value.slice(5) });
            }
        });
        return out;
    }

    // ── Aplicar ───────────────────────────────────────────────────────
    let aplicando = false;
    async function aplicar() {
        if (aplicando) return;
        const decisiones = leerDecisiones();
        if (!decisiones.length) { alert('No hay decisiones que aplicar (todo está en "Omitir").'); return; }
        for (const d of decisiones) {
            if (d.accion === 'nuevo' && !d.nombre) { alert('Escribe el nombre del cliente nuevo.'); return; }
            if (d.accion === 'existente' && !d.destId) { alert('Elige el cliente existente en los grupos marcados como "Otro cliente existente".'); return; }
        }
        const escaneo = escanear(); // lectura fresca
        const porKey = new Map(escaneo.grupos.map((g) => [g.key, g]));
        const resumen = decisiones.map((d) => {
            const g = porKey.get(d.gk); if (!g) return null;
            const dest = d.accion === 'nuevo' ? `cliente NUEVO «${d.nombre}»` : `cliente existente «${(escaneo.clientes.find((c) => String(c.id) === String(d.destId)) || {}).nombre || d.destId}» (ID ${d.destId})`;
            return `• ${g.nombreMostrar} (${g.refs.length} reg.) → ${dest}`;
        }).filter(Boolean);
        if (!confirm(`Se aplicarán ${resumen.length} cambio(s):\n\n${resumen.join('\n')}\n\nSolo cambia el ID de cliente en esos registros. ¿Continuar?`)) return;

        aplicando = true;
        const cont = document.getElementById('aciResultado');
        if (cont) cont.insertAdjacentHTML('afterbegin', '<div id="aciAplicando" style="padding:10px;background:#fef9c3;border-radius:8px;margin-bottom:10px;font-weight:bold;">⏳ Aplicando…</div>');
        try {
            // Trabajamos sobre copias de cada tabla y escribimos al final
            const tablas = {};
            const tocar = (t) => { if (!tablas[t]) tablas[t] = copiar(leer(t)); return tablas[t]; };
            const clientes = tocar('clientes');
            const nuevosIds = new Set();
            const cambios = [];
            const nuevos = [];
            const avisos = [];

            for (const d of decisiones) {
                const g = porKey.get(d.gk); if (!g) continue;
                let destId;
                if (d.accion === 'nuevo') {
                    destId = siguienteId(escaneo, nuevosIds);
                    nuevosIds.add(destId);
                    const base = { id: destId, nombre: d.nombre, direccion: g.dir || '', telefono: g.tel || '', referencia: '', limiteCredito: 0,
                        fechaRegistro: (typeof window.formatearFechaCortaMX === 'function') ? window.formatearFechaCortaMX(new Date()) : new Date().toISOString().slice(0, 10) };
                    clientes.push(typeof window._clienteConBusqueda === 'function' ? window._clienteConBusqueda(base) : (typeof _clienteConBusqueda === 'function' ? _clienteConBusqueda(base) : base));
                    nuevos.push({ id: destId, nombre: d.nombre });
                } else {
                    destId = Number.isFinite(Number(d.destId)) ? Number(d.destId) : d.destId;
                    if (!clientes.some((c) => String(c.id) === String(destId))) { avisos.push(`Grupo «${g.nombreMostrar}»: el cliente ${destId} ya no existe; se omitió.`); continue; }
                }
                for (const ref of g.refs) {
                    const arr = tocar(ref.t);
                    const obj = arr.find((r) => String(r[ref.key]) === String(ref.clave) && (String(getId(r) ?? '') === String(ref.idAnterior ?? '')));
                    if (!obj) { avisos.push(`No se encontró ${ref.t} ${ref.clave}; se omitió.`); continue; }
                    if (ref.t === 'puntosPorCliente' && arr.some((r) => String(r.clienteId) === String(destId))) {
                        avisos.push(`Puntos del ID ${ref.idAnterior}: el cliente destino ya tiene registro de puntos; revísalo a mano.`); continue;
                    }
                    const antes = setId(obj, destId);
                    cambios.push({ tabla: ref.t, clave: ref.clave, folio: ref.folio, idAnterior: antes, idNuevo: destId, grupo: g.nombreMostrar });
                }
            }
            if (!cambios.length && !nuevos.length) { alert('No hubo cambios que aplicar.\n\n' + avisos.join('\n')); return; }

            const fallos = [];
            const orden = Object.keys(tablas).sort((a, b) => (a === 'clientes' ? -1 : b === 'clientes' ? 1 : 0)); // clientes primero
            for (const t of orden) {
                const hubo = t === 'clientes' ? nuevos.length : cambios.some((c) => c.tabla === t);
                if (!hubo) continue;
                const r = await StorageService.setInmediato(t, tablas[t]);
                if (r && r.subioANube === false) fallos.push(t);
            }
            try {
                window.AuditService?.log?.({ accion: 'REPARAR_CLIENTE_ID', modulo: 'Auditoría', entidad: 'Clientes', detalle: `Reasignación de IDs de cliente: ${cambios.length} registro(s), ${nuevos.length} cliente(s) nuevo(s)`, severidad: 'riesgo', datos: { cambios, nuevos } });
            } catch (e) { /* bitácora best-effort */ }

            window._ultimaReparacionClientesId = { fecha: new Date().toISOString(), cambios, nuevos, avisos };
            renderizar();
            const c2 = document.getElementById('aciResultado');
            if (c2) c2.insertAdjacentHTML('afterbegin', `
                <div style="padding:12px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;margin-bottom:10px;font-size:13px;">
                    ✅ <strong>${cambios.length}</strong> registro(s) reasignados${nuevos.length ? ` · ${nuevos.length} cliente(s) nuevo(s): ${esc(nuevos.map((n) => n.nombre + ' (' + n.id + ')').join(', '))}` : ''}.
                    ${fallos.length ? `<div style="color:#b91c1c;margin-top:4px;">⚠️ No se confirmó la subida a la nube de: ${esc(fallos.join(', '))}. Quedó guardado en este equipo; revisa la conexión.</div>` : ''}
                    ${avisos.length ? `<div style="color:#b45309;margin-top:4px;">${avisos.map(esc).join('<br>')}</div>` : ''}
                    <div style="margin-top:6px;"><button onclick="descargarBitacoraReparacionClientesId()" style="padding:6px 12px;border:1px solid #16a34a;background:#fff;color:#166534;border-radius:6px;cursor:pointer;font-weight:bold;">⬇ Descargar bitácora de cambios (JSON)</button></div>
                </div>`);
        } catch (e) {
            console.error('Reparar clientes ID:', e);
            alert('Ocurrió un error al aplicar: ' + (e && e.message ? e.message : e));
        } finally {
            aplicando = false;
            document.getElementById('aciAplicando')?.remove();
        }
    }

    function descargarBitacora() {
        const b = window._ultimaReparacionClientesId;
        if (!b) return;
        const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `reparacion-clientes-id-${b.fecha.slice(0, 19).replace(/[:T]/g, '-')}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    window.abrirAuditoriaClientesId = function () {
        if (typeof window.requireAdmin === 'function') window.requireAdmin(abrir);
        else abrir();
    };
    window.aplicarReparacionClientesId = aplicar;
    window.descargarBitacoraReparacionClientesId = descargarBitacora;
    // Para pruebas / consola
    window._escanearClientesId = escanear;
})();
