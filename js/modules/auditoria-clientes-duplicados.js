// =====================================================================
// 🧩 FUSIONAR CLIENTES DUPLICADOS
// ---------------------------------------------------------------------
// Detecta clientes que son la misma persona registrada varias veces
// (típico de la migración: un cliente por cada cuenta MIG-) y deja que
// TÚ decidas por grupo:
//   · Fusionar     → se elige cuál ID se conserva; todo lo que apuntaba a
//                    los demás (cuentas, ventas, pagarés, apartados,
//                    entregas, puntos, etc.) pasa al conservado y los
//                    duplicados se eliminan de `clientes`.
//   · Son distintos → se marca para no volver a avisar.
//   · Omitir        → no se toca nada.
//
// Nada se escribe hasta pulsar "Aplicar decisiones" y confirmar.
// Las referencias se descubren dinámicamente en TODAS las tablas del
// sistema (cualquier registro con clienteId o cliente.id), así no queda
// ningún ID colgando. Orden de escritura: primero las tablas que
// apuntan al cliente y AL FINAL `clientes`; si algo falla a la mitad
// no queda ninguna referencia huérfana (solo un duplicado sin usar).
// Cada fusión queda en la bitácora de auditoría y se puede descargar un
// JSON con los clientes eliminados completos (por si hay que restaurar).
// =====================================================================
(function () {
    'use strict';

    const EXCLUIR = new Set(['clientes', 'bitacoraAuditoria']);
    const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e']);
    const UMBRAL_PARECIDO = 0.85;

    // ── Utilidades ────────────────────────────────────────────────────
    const leer = (t) => { try { const v = StorageService.get(t, []); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
    const copiar = (v) => JSON.parse(JSON.stringify(v));
    const esc = (s) => String(s === undefined || s === null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const norm = (s) => String(s === undefined || s === null ? '' : s)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const tokens = (s) => norm(s).split(' ').filter((w) => w && !STOP.has(w));
    const claveNombre = (s) => tokens(s).sort().join(' ');
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
        A.forEach((n) => { ta += n; }); B.forEach((n) => { tb += n; });
        A.forEach((n, g) => { if (B.has(g)) inter += Math.min(n, B.get(g)); });
        return ta + tb ? (2 * inter) / (ta + tb) : 0;
    }
    const getId = (r) => {
        if (!vacio(r.clienteId)) return r.clienteId;
        if (esObj(r.cliente) && !vacio(r.cliente.id)) return r.cliente.id;
        return null;
    };
    function setId(r, id) {
        if (esObj(r.cliente)) r.cliente = Object.assign({}, r.cliente, { id });
        if (!esObj(r.cliente) || 'clienteId' in r) r.clienteId = id;
    }

    // ── Descubrimiento de tablas que referencian clientes ─────────────
    async function tablasConReferencias() {
        let nombres = [];
        try { nombres = await StorageService.getTablasDinamicas(); } catch (e) { nombres = []; }
        if (!Array.isArray(nombres) || !nombres.length) nombres = Array.from(window.TABLAS_SISTEMA || []);
        const out = [];
        nombres.forEach((t) => {
            if (EXCLUIR.has(t)) return;
            const arr = leer(t);
            if (arr.length && arr.some((r) => esObj(r) && !vacio(getId(r)))) out.push(t);
        });
        return out;
    }

    // ── Escaneo ───────────────────────────────────────────────────────
    async function escanear() {
        const clientes = leer('clientes');
        const tablas = await tablasConReferencias();
        const uso = new Map(); // id -> { total, porTabla, cuentas, saldo }
        tablas.forEach((t) => {
            leer(t).forEach((r) => {
                if (!esObj(r)) return;
                const id = getId(r);
                if (vacio(id)) return;
                const k = String(id);
                if (!uso.has(k)) uso.set(k, { total: 0, porTabla: {}, cuentas: 0, saldo: 0 });
                const u = uso.get(k);
                u.total++; u.porTabla[t] = (u.porTabla[t] || 0) + 1;
                if (t === 'cuentasPorCobrar') { u.cuentas++; u.saldo += Number(r.saldoActual) || 0; }
            });
        });

        // Agrupar: mismo conjunto de palabras (exacto) o muy parecidos
        const padre = new Map(clientes.map((c) => [String(c.id), String(c.id)]));
        const raiz = (x) => { while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x))); x = padre.get(x); } return x; };
        const unir = (a, b) => { const ra = raiz(a), rb = raiz(b); if (ra !== rb) padre.set(rb, ra); };
        const porClave = new Map();
        clientes.forEach((c) => {
            const k = claveNombre(c.nombre);
            if (!k) return;
            if (!porClave.has(k)) porClave.set(k, []);
            porClave.get(k).push(c);
        });
        const exactos = new Set();
        porClave.forEach((lista) => {
            if (lista.length > 1) { lista.forEach((c) => unir(String(lista[0].id), String(c.id))); lista.forEach((c) => exactos.add(String(c.id))); }
        });
        const claves = Array.from(porClave.keys());
        for (let i = 0; i < claves.length; i++) {
            for (let j = i + 1; j < claves.length; j++) {
                const a = claves[i], b = claves[j];
                if (Math.min(a.replace(/ /g, '').length, b.replace(/ /g, '').length) < 8) continue;
                if (dice(a, b) >= UMBRAL_PARECIDO) unir(String(porClave.get(a)[0].id), String(porClave.get(b)[0].id));
            }
        }
        const ramas = new Map();
        clientes.forEach((c) => {
            if (!claveNombre(c.nombre)) return;
            const r = raiz(String(c.id));
            if (!ramas.has(r)) ramas.set(r, []);
            ramas.get(r).push(c);
        });

        const grupos = [];
        ramas.forEach((miembrosOrig) => {
            let miembros = miembrosOrig;
            if (miembros.length < 2) return;
            // pares ya marcados como distintos
            const distintos = (a, b) => (Array.isArray(a.distintoDe) && a.distintoDe.map(String).includes(String(b.id)))
                || (Array.isArray(b.distintoDe) && b.distintoDe.map(String).includes(String(a.id)));
            // Solo se muestran los miembros que aún tienen algún par sin resolver; el que ya
            // se marcó como "distinto" de todos los demás sale del grupo.
            const activos = miembros.filter((a) => miembros.some((b) => b !== a && !distintos(a, b)));
            if (activos.length < 2) return;
            miembros = activos;
            const info = miembros.map((c) => Object.assign({ cliente: c }, uso.get(String(c.id)) || { total: 0, porTabla: {}, cuentas: 0, saldo: 0 }));
            info.sort((x, y) => (y.cuentas - x.cuentas) || (y.total - x.total) || (Number(x.cliente.id) - Number(y.cliente.id)));
            const todosExactos = info.every((m) => exactos.has(String(m.cliente.id))) && new Set(info.map((m) => claveNombre(m.cliente.nombre))).size === 1;
            grupos.push({ key: info.map((m) => String(m.cliente.id)).sort().join('|'), miembros: info, exacto: todosExactos });
        });
        grupos.sort((a, b) => (Number(b.exacto) - Number(a.exacto)) || (b.miembros.length - a.miembros.length));
        return { grupos, clientes, tablas };
    }

    // ── Interfaz ──────────────────────────────────────────────────────
    let ESC = null;

    function abrir() {
        document.querySelector('[data-modal="auditoria-clientes-dup"]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
        <div data-modal="auditoria-clientes-dup" style="position:fixed;inset:0;background:rgba(15,23,42,0.75);z-index:9999;display:flex;justify-content:center;align-items:flex-start;overflow:auto;padding:20px;">
            <div style="background:white;border-radius:12px;width:100%;max-width:1100px;padding:22px;box-shadow:0 20px 25px rgba(0,0,0,0.25);">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
                    <h2 style="margin:0;color:#0f766e;">🧩 Fusionar clientes duplicados</h2>
                    <button onclick="document.querySelector('[data-modal=&quot;auditoria-clientes-dup&quot;]').remove()" style="border:none;background:#f1f5f9;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:bold;">✕ Cerrar</button>
                </div>
                <p style="color:#64748b;font-size:13px;margin:6px 0 14px;">Clientes con el mismo nombre (o casi). Por grupo decide si son <strong>la misma persona</strong> (eliges qué ID se conserva y los demás se fusionan en él) o <strong>personas distintas</strong>. No se escribe nada hasta pulsar <strong>Aplicar decisiones</strong>. Un mismo nombre no garantiza que sea la misma persona: revisa teléfono, referencia y movimientos.</p>
                <div id="acdResultado"><div style="padding:18px;color:#64748b;">⏳ Escaneando…</div></div>
            </div>
        </div>`);
        renderizar();
    }

    async function renderizar() {
        const cont = document.getElementById('acdResultado');
        if (!cont) return;
        ESC = await escanear();
        if (!ESC.grupos.length) {
            cont.innerHTML = '<div style="padding:24px;text-align:center;color:#15803d;font-weight:bold;background:#f0fdf4;border-radius:10px;">✅ No hay clientes duplicados pendientes de revisar.</div>';
            return;
        }
        const dinero = (n) => (typeof window.dinero === 'function' ? window.dinero(n) : '$' + Number(n || 0).toFixed(2));
        const tarjetas = ESC.grupos.map((g, i) => {
            const filas = g.miembros.map((m, j) => {
                const c = m.cliente;
                const tablas = Object.keys(m.porTabla).map((t) => `${esc(t)}: <strong>${m.porTabla[t]}</strong>`).join(' · ') || '<span style="color:#94a3b8;">sin registros asociados</span>';
                return `
                <div style="display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:start;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;margin-top:6px;background:${j === 0 ? '#f0fdfa' : '#fff'};">
                    <label style="font-size:12px;white-space:nowrap;cursor:pointer;"><input type="radio" name="acd-keep-${i}" value="${esc(c.id)}" ${j === 0 ? 'checked' : ''} onchange="_acdSyncGrupo(${i})"> Conservar</label>
                    <label style="font-size:12px;white-space:nowrap;cursor:pointer;"><input type="checkbox" class="acd-fus" data-id="${esc(c.id)}" ${g.exacto ? 'checked' : ''}> Fusionar</label>
                    <div style="font-size:13px;">
                        <strong>${esc(c.nombre)}</strong> <span style="color:#64748b;">· ID ${esc(c.id)}${c.telefono ? ' · tel ' + esc(c.telefono) : ''}${c.referencia ? ' · ref: ' + esc(c.referencia) : ''}${c.direccion ? ' · ' + esc(c.direccion) : ''}${c.limiteCredito ? ' · límite ' + esc(dinero(c.limiteCredito)) : ''}</span>
                        <div style="font-size:12px;color:#475569;">${m.cuentas ? `Cuentas: <strong>${m.cuentas}</strong> (saldo ${esc(dinero(m.saldo))}) · ` : ''}${tablas}</div>
                    </div>
                </div>`;
            }).join('');
            return `
            <div class="acd-grupo" data-gk="${esc(g.key)}" data-i="${i}" style="border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin-top:12px;">
                <div style="font-weight:bold;color:#0f172a;">${esc(g.miembros[0].cliente.nombre)} <span style="font-size:11px;font-weight:normal;background:${g.exacto ? '#dcfce7' : '#fef9c3'};color:${g.exacto ? '#166534' : '#854d0e'};border-radius:99px;padding:2px 8px;margin-left:6px;">${g.exacto ? 'Mismo nombre' : 'Nombres parecidos'}</span> <span style="font-size:12px;color:#64748b;font-weight:normal;">${g.miembros.length} clientes</span></div>
                ${filas}
                <div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:10px;font-size:13px;">
                    <label style="cursor:pointer;"><input type="radio" name="acd-acc-${i}" value="fusionar" ${g.exacto ? 'checked' : ''}> <strong>Es la misma persona</strong> → fusionar los marcados en el conservado</label>
                    <label style="cursor:pointer;"><input type="radio" name="acd-acc-${i}" value="distintos"> Son personas distintas (no volver a avisar)</label>
                    <label style="cursor:pointer;color:#64748b;"><input type="radio" name="acd-acc-${i}" value="omitir" ${g.exacto ? '' : 'checked'}> Omitir por ahora</label>
                </div>
            </div>`;
        }).join('');
        cont.innerHTML = `
            <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:12px 14px;">
                <div style="font-size:13px;color:#115e59;"><strong>${ESC.grupos.length}</strong> grupo(s) por revisar · revisando ${ESC.tablas.length} tabla(s) con referencias a clientes</div>
                <button onclick="aplicarFusionClientes()" style="padding:10px 18px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🧩 Aplicar decisiones</button>
            </div>
            ${tarjetas}
            <div style="margin-top:16px;"><button onclick="aplicarFusionClientes()" style="padding:10px 18px;background:#0f766e;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">🧩 Aplicar decisiones</button></div>`;
        ESC.grupos.forEach((_, i) => window._acdSyncGrupo(i));
    }

    // El cliente conservado no se puede fusionar consigo mismo
    window._acdSyncGrupo = function (i) {
        const el = document.querySelector(`#acdResultado .acd-grupo[data-i="${i}"]`);
        if (!el) return;
        const keep = el.querySelector(`input[name="acd-keep-${i}"]:checked`);
        el.querySelectorAll('.acd-fus').forEach((cb) => {
            const esKeeper = keep && cb.getAttribute('data-id') === keep.value;
            if (esKeeper) cb.checked = false;
            cb.disabled = !!esKeeper;
        });
    };

    function leerDecisiones() {
        const out = [];
        document.querySelectorAll('#acdResultado .acd-grupo').forEach((el) => {
            const i = el.getAttribute('data-i');
            const acc = el.querySelector(`input[name="acd-acc-${i}"]:checked`);
            if (!acc || acc.value === 'omitir') return;
            const gk = el.getAttribute('data-gk');
            if (acc.value === 'distintos') { out.push({ gk, accion: 'distintos' }); return; }
            const keep = el.querySelector(`input[name="acd-keep-${i}"]:checked`);
            const fus = Array.from(el.querySelectorAll('.acd-fus:checked')).map((cb) => cb.getAttribute('data-id'));
            out.push({ gk, accion: 'fusionar', keeper: keep ? keep.value : null, fusionar: fus });
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
            if (d.accion === 'fusionar') {
                if (!d.keeper) { alert('Elige qué cliente conservar en cada grupo a fusionar.'); return; }
                if (!d.fusionar.length) { alert('En un grupo marcado como "misma persona" no hay ningún cliente marcado para fusionar.'); return; }
            }
        }
        const escaneo = await escanear(); // lectura fresca
        const porKey = new Map(escaneo.grupos.map((g) => [g.key, g]));
        const nombreDe = (id) => (escaneo.clientes.find((c) => String(c.id) === String(id)) || {}).nombre || id;
        const resumen = decisiones.map((d) => {
            const g = porKey.get(d.gk); if (!g) return null;
            if (d.accion === 'distintos') return `• ${g.miembros[0].cliente.nombre}: se marcan como PERSONAS DISTINTAS`;
            const regs = g.miembros.filter((m) => d.fusionar.includes(String(m.cliente.id))).reduce((s, m) => s + m.total, 0);
            return `• ${nombreDe(d.keeper)}: se conserva ID ${d.keeper}; se fusionan ${d.fusionar.length} cliente(s) (${d.fusionar.join(', ')}) y ${regs} registro(s) pasan al conservado. Los duplicados se ELIMINAN de clientes.`;
        }).filter(Boolean);
        if (!confirm(`Se aplicarán ${resumen.length} decisión(es):\n\n${resumen.join('\n')}\n\n¿Continuar?`)) return;

        aplicando = true;
        const cont = document.getElementById('acdResultado');
        if (cont) cont.insertAdjacentHTML('afterbegin', '<div id="acdAplicando" style="padding:10px;background:#fef9c3;border-radius:8px;margin-bottom:10px;font-weight:bold;">⏳ Aplicando…</div>');
        try {
            const tablas = {};
            const tocar = (t) => { if (!tablas[t]) tablas[t] = copiar(leer(t)); return tablas[t]; };
            const clientes = tocar('clientes');
            const cambios = [], eliminados = [], avisos = [], tocadas = new Set();
            const mapaIds = new Map(); // idFusionado -> keeper
            let marcados = 0;

            for (const d of decisiones) {
                const g = porKey.get(d.gk); if (!g) continue;
                if (d.accion === 'distintos') {
                    const ids = g.miembros.map((m) => String(m.cliente.id));
                    clientes.forEach((c) => {
                        if (!ids.includes(String(c.id))) return;
                        const set = new Set((Array.isArray(c.distintoDe) ? c.distintoDe : []).map(String));
                        ids.forEach((o) => { if (o !== String(c.id)) set.add(o); });
                        c.distintoDe = Array.from(set);
                    });
                    marcados++; continue;
                }
                const keeperId = String(d.keeper);
                const fusIds = d.fusionar.map(String).filter((x) => x !== keeperId);
                const keeper = clientes.find((c) => String(c.id) === keeperId);
                if (!keeper) { avisos.push(`El cliente a conservar (${keeperId}) ya no existe; se omitió el grupo.`); continue; }
                const fusionados = fusIds.map((id) => clientes.find((c) => String(c.id) === id)).filter(Boolean);
                if (!fusionados.length) continue;

                // 1) Completar datos vacíos del conservado y recordar nombres alternos
                fusionados.forEach((f) => {
                    ['telefono', 'direccion'].forEach((campo) => { if (vacio(keeper[campo]) && !vacio(f[campo])) keeper[campo] = f[campo]; });
                    if (!vacio(f.referencia) && norm(f.referencia) !== norm(keeper.referencia) && !norm(keeper.referencia).includes(norm(f.referencia))) {
                        keeper.referencia = vacio(keeper.referencia) ? f.referencia : `${keeper.referencia} / ${f.referencia}`;
                    }
                    if (claveNombre(f.nombre) !== claveNombre(keeper.nombre) && !norm(keeper.referencia).includes(norm(f.nombre))) {
                        keeper.referencia = vacio(keeper.referencia) ? f.nombre : `${keeper.referencia} / ${f.nombre}`;
                    }
                    if (Number(f.limiteCredito || 0) !== Number(keeper.limiteCredito || 0)) {
                        avisos.push(`«${keeper.nombre}»: el límite de crédito del fusionado ${f.id} era ${f.limiteCredito || 0}; se conservó el del cliente ${keeperId} (${keeper.limiteCredito || 0}).`);
                    }
                });
                if (typeof window._clienteConBusqueda === 'function') Object.assign(keeper, window._clienteConBusqueda(keeper));

                // 2) Repuntar TODAS las referencias en todas las tablas
                for (const t of escaneo.tablas) {
                    const arr = tocar(t);
                    if (t === 'puntosPorCliente') {
                        const filaK = arr.find((r) => String(r.clienteId) === keeperId);
                        fusIds.forEach((fid) => {
                            for (let k = arr.length - 1; k >= 0; k--) {
                                if (String(arr[k].clienteId) !== fid) continue;
                                if (filaK) {
                                    const a = Number(filaK.puntos), b = Number(arr[k].puntos);
                                    if (Number.isFinite(a) || Number.isFinite(b)) filaK.puntos = (Number.isFinite(a) ? a : 0) + (Number.isFinite(b) ? b : 0);
                                    if (Array.isArray(arr[k].historial)) filaK.historial = (Array.isArray(filaK.historial) ? filaK.historial : []).concat(arr[k].historial);
                                    cambios.push({ tabla: t, clave: fid, idAnterior: fid, idNuevo: keeperId, nota: 'fila de puntos combinada con la del conservado' });
                                    arr.splice(k, 1);
                                } else {
                                    arr[k].clienteId = keeper.id;
                                    cambios.push({ tabla: t, clave: fid, idAnterior: fid, idNuevo: keeper.id });
                                }
                                tocadas.add(t);
                            }
                        });
                        continue;
                    }
                    arr.forEach((r) => {
                        if (!esObj(r)) return;
                        const id = getId(r);
                        if (vacio(id) || !fusIds.includes(String(id))) return;
                        setId(r, keeper.id);
                        tocadas.add(t);
                        cambios.push({ tabla: t, clave: r.folio || r.id || '', idAnterior: id, idNuevo: keeper.id });
                    });
                }
                // 3) Quitar duplicados de clientes
                fusionados.forEach((f) => {
                    eliminados.push(copiar(f));
                    mapaIds.set(String(f.id), keeperId);
                    const idx = clientes.findIndex((c) => String(c.id) === String(f.id));
                    if (idx >= 0) clientes.splice(idx, 1);
                });
            }
            // limpiar marcas distintoDe que apunten a clientes eliminados
            clientes.forEach((c) => { if (Array.isArray(c.distintoDe)) c.distintoDe = c.distintoDe.filter((x) => !mapaIds.has(String(x))); });

            if (!eliminados.length && !marcados) { alert('No hubo cambios que aplicar.\n\n' + avisos.join('\n')); return; }

            // Escritura: tablas referenciadoras primero, `clientes` AL FINAL
            const fallos = [];
            for (const t of tocadas) {
                const r = await StorageService.setInmediato(t, tablas[t]);
                if (r && r.subioANube === false) fallos.push(t);
            }
            const rc = await StorageService.setInmediato('clientes', clientes);
            if (rc && rc.subioANube === false) fallos.push('clientes');
            try {
                window.AuditService?.log?.({ accion: 'FUSIONAR_CLIENTES', modulo: 'Auditoría', entidad: 'Clientes', detalle: `Fusión de clientes duplicados: ${eliminados.length} cliente(s) fusionado(s), ${cambios.length} registro(s) reasignados, ${marcados} grupo(s) marcados como distintos`, severidad: 'riesgo', datos: { fusionados: Array.from(mapaIds.entries()), cambios: cambios.length } });
            } catch (e) { /* best-effort */ }

            window._ultimaFusionClientes = { fecha: new Date().toISOString(), fusionados: Array.from(mapaIds.entries()).map(([desde, hacia]) => ({ desde, hacia })), clientesEliminados: eliminados, cambios, avisos };
            await renderizar();
            const c2 = document.getElementById('acdResultado');
            if (c2) c2.insertAdjacentHTML('afterbegin', `
                <div style="padding:12px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:10px;margin-bottom:10px;font-size:13px;">
                    ✅ <strong>${eliminados.length}</strong> cliente(s) fusionado(s) · <strong>${cambios.length}</strong> registro(s) reasignados${marcados ? ` · ${marcados} grupo(s) marcados como distintos` : ''}.
                    ${fallos.length ? `<div style="color:#b91c1c;margin-top:4px;">⚠️ No se confirmó la subida a la nube de: ${esc(fallos.join(', '))}. Quedó guardado en este equipo; revisa la conexión.</div>` : ''}
                    ${avisos.length ? `<div style="color:#b45309;margin-top:4px;">${avisos.map(esc).join('<br>')}</div>` : ''}
                    <div style="margin-top:6px;"><button onclick="descargarBitacoraFusionClientes()" style="padding:6px 12px;border:1px solid #16a34a;background:#fff;color:#166534;border-radius:6px;cursor:pointer;font-weight:bold;">⬇ Descargar bitácora (incluye los clientes eliminados)</button></div>
                </div>`);
        } catch (e) {
            console.error('Fusionar clientes:', e);
            alert('Ocurrió un error al aplicar: ' + (e && e.message ? e.message : e));
        } finally {
            aplicando = false;
            document.getElementById('acdAplicando')?.remove();
        }
    }

    function descargarBitacora() {
        const b = window._ultimaFusionClientes;
        if (!b) return;
        const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `fusion-clientes-${b.fecha.slice(0, 19).replace(/[:T]/g, '-')}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    window.abrirAuditoriaClientesDuplicados = function () {
        if (typeof window.requireAdmin === 'function') window.requireAdmin(abrir);
        else abrir();
    };
    window.aplicarFusionClientes = aplicar;
    window.descargarBitacoraFusionClientes = descargarBitacora;
    window._escanearClientesDuplicados = escanear; // pruebas / consola
})();
