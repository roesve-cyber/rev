// ===== TOMA PROFESIONAL DE INVENTARIO POR UBICACION =====
(function() {
    const KEY = 'tomasInventario';
    let tomaActivaId = '';
    let filtroToma = '';

    function esc(value) {
        return String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[ch]));
    }

    function jsArg(value) {
        return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function ahora() {
        return window.localISO ? window.localISO(new Date()) : new Date().toISOString();
    }

    function sesion() {
        try { return JSON.parse(sessionStorage.getItem('sesionActiva') || 'null') || {}; } catch { return {}; }
    }

    function usuarioNombre() {
        const s = sesion();
        return s.nombre || s.usuario || s.email || 'Usuario';
    }

    function leer() {
        return StorageService.get(KEY, []) || [];
    }

    function guardar(lista) {
        StorageService.set(KEY, lista);
    }

    function ubicaciones() {
        const lista = StorageService.get('ubicacionesConfig', []) || [];
        return lista.length ? lista : [{ id: 'general', nombre: 'General' }];
    }

    function activo(p) {
        return typeof window.productoEstaActivo === 'function'
            ? window.productoEstaActivo(p)
            : p?.activo !== false;
    }

    function num(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : 0;
    }

    function fechaVisible(value) {
        if (!value) return '-';
        try {
            return new Date(value).toLocaleString('es-MX', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        } catch {
            return String(value);
        }
    }

    function folioNuevo() {
        const hoy = ahora().slice(0, 10).replace(/-/g, '');
        const consecutivo = leer().filter(t => String(t.folio || '').includes(hoy)).length + 1;
        return `TINV-${hoy}-${String(consecutivo).padStart(3, '0')}`;
    }

    function claveLinea(productoId, color) {
        return `${String(productoId)}|${String(color || 'General').trim().toUpperCase()}`;
    }

    function lineasIniciales(ubicacion) {
        const lineas = [];
        (StorageService.get('productos', []) || []).forEach(p => {
            const variantes = Array.isArray(p.variantes) ? p.variantes : [];
            const enUbicacion = variantes.filter(v =>
                String(v.ubicacion || 'General').trim().toUpperCase() === String(ubicacion).trim().toUpperCase()
            );
            const colores = new Set();

            enUbicacion.forEach(v => colores.add(String(v.color || 'General').trim() || 'General'));
            if (!colores.size && activo(p)) {
                variantes.forEach(v => colores.add(String(v.color || '').trim()));
                colores.delete('');
                if (!colores.size) colores.add(String(p.color || 'General').trim() || 'General');
            }

            if (!colores.size) {
                const legado = num(p.stockPorUbicacion?.[ubicacion]);
                if (legado !== 0) colores.add(String(p.color || 'General').trim() || 'General');
            }

            colores.forEach(color => {
                const teorico = enUbicacion
                    .filter(v => String(v.color || 'General').trim().toUpperCase() === color.toUpperCase())
                    .reduce((s, v) => s + num(v.stock), 0);
                lineas.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    productoId: p.id,
                    productoNombre: p.nombre || 'Producto',
                    categoria: p.categoria || '',
                    subcategoria: p.subcategoria || '',
                    color,
                    teorico,
                    conteo: null,
                    reconteo: null,
                    nota: '',
                    inactivo: !activo(p)
                });
            });
        });

        return lineas.sort((a, b) =>
            String(a.categoria).localeCompare(String(b.categoria), 'es') ||
            String(a.productoNombre).localeCompare(String(b.productoNombre), 'es') ||
            String(a.color).localeCompare(String(b.color), 'es')
        );
    }

    function valorFinal(linea) {
        return linea.reconteo !== null && linea.reconteo !== ''
            ? num(linea.reconteo)
            : (linea.conteo !== null && linea.conteo !== '' ? num(linea.conteo) : null);
    }

    function resumen(toma) {
        const total = toma.lineas.length;
        const contadas = toma.lineas.filter(l => l.conteo !== null && l.conteo !== '').length;
        const diferencias = toma.lineas.filter(l => {
            const final = valorFinal(l);
            return final !== null && final !== num(l.teorico);
        });
        return {
            total,
            contadas,
            pendientes: total - contadas,
            diferencias: diferencias.length,
            unidadesDiferencia: diferencias.reduce((s, l) => s + (valorFinal(l) - num(l.teorico)), 0),
            avance: total ? Math.round((contadas / total) * 100) : 100
        };
    }

    function buscarToma(id) {
        return leer().find(t => String(t.id) === String(id));
    }

    function actualizarToma(id, mutador) {
        const lista = leer();
        const idx = lista.findIndex(t => String(t.id) === String(id));
        if (idx < 0) return null;
        mutador(lista[idx]);
        lista[idx].actualizadaEn = ahora();
        lista[idx].actualizadaPor = usuarioNombre();
        guardar(lista);
        return lista[idx];
    }

    function badgeEstado(estado) {
        const cfg = {
            conteo: ['En conteo', '#1d4ed8', '#dbeafe'],
            revision: ['En revision', '#b45309', '#fef3c7'],
            cerrada: ['Cerrada', '#047857', '#d1fae5'],
            cancelada: ['Cancelada', '#b91c1c', '#fee2e2']
        }[estado] || [estado || '-', '#475569', '#e2e8f0'];
        return `<span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${cfg[2]};color:${cfg[1]};font-size:11px;font-weight:900;text-transform:uppercase;">${cfg[0]}</span>`;
    }

    function renderListado() {
        const cont = document.getElementById('contenidoTomaInventario');
        if (!cont) return;
        const lista = leer().slice().sort((a, b) => String(b.creadaEn).localeCompare(String(a.creadaEn)));
        const abiertas = lista.filter(t => t.estado === 'conteo' || t.estado === 'revision').length;
        const cerradas = lista.filter(t => t.estado === 'cerrada').length;
        const filas = lista.map(t => {
            const r = resumen(t);
            return `<tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:11px;"><b>${esc(t.folio)}</b><br><small style="color:#64748b;">${esc(fechaVisible(t.creadaEn))}</small></td>
                <td style="padding:11px;"><b>${esc(t.ubicacion)}</b><br><small style="color:#64748b;">${esc(t.responsable || '-')}</small></td>
                <td style="padding:11px;">${badgeEstado(t.estado)}</td>
                <td style="padding:11px;text-align:center;"><b>${r.contadas}/${r.total}</b><br><small style="color:#64748b;">${r.avance}%</small></td>
                <td style="padding:11px;text-align:center;color:${r.diferencias ? '#b45309' : '#047857'};font-weight:900;">${r.diferencias}</td>
                <td style="padding:11px;text-align:right;"><button onclick="abrirTomaInventario('${jsArg(t.id)}')" style="padding:8px 12px;border:0;border-radius:6px;background:#0f172a;color:white;font-weight:bold;cursor:pointer;">Abrir</button></td>
            </tr>`;
        }).join('');

        cont.innerHTML = `
            <div style="padding:24px;max-width:1500px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:18px;">
                    <div><h2 style="margin:0;color:#0f172a;">Toma de Inventario</h2><p style="margin:5px 0 0;color:#64748b;">Conteo fisico, revision y ajuste por ubicacion.</p></div>
                    <button onclick="abrirNuevaTomaInventario()" style="padding:11px 16px;border:0;border-radius:7px;background:#047857;color:white;font-weight:900;cursor:pointer;">+ Nueva toma</button>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px;">
                    <div style="border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;padding:14px;"><small style="font-weight:900;color:#64748b;">ABIERTAS</small><br><b style="font-size:24px;color:#1d4ed8;">${abiertas}</b></div>
                    <div style="border:1px solid #bbf7d0;background:#f0fdf4;border-radius:8px;padding:14px;"><small style="font-weight:900;color:#64748b;">CERRADAS</small><br><b style="font-size:24px;color:#15803d;">${cerradas}</b></div>
                    <div style="border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:14px;"><small style="font-weight:900;color:#64748b;">UBICACIONES</small><br><b style="font-size:24px;color:#334155;">${ubicaciones().length}</b></div>
                </div>
                <div style="overflow:auto;background:white;border:1px solid #e2e8f0;border-radius:8px;">
                    <table style="width:100%;border-collapse:collapse;min-width:760px;">
                        <thead style="background:#f8fafc;color:#475569;font-size:12px;text-transform:uppercase;"><tr>
                            <th style="padding:11px;text-align:left;">Folio</th><th style="padding:11px;text-align:left;">Ubicacion</th>
                            <th style="padding:11px;text-align:left;">Estado</th><th style="padding:11px;text-align:center;">Avance</th>
                            <th style="padding:11px;text-align:center;">Diferencias</th><th style="padding:11px;"></th>
                        </tr></thead>
                        <tbody>${filas || '<tr><td colspan="6" style="padding:30px;text-align:center;color:#64748b;">Aun no hay tomas registradas.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
    }

    window.abrirNuevaTomaInventario = function() {
        const opciones = ubicaciones().map(u => `<option value="${esc(u.nombre)}">${esc(u.nombre)}</option>`).join('');
        document.querySelector('[data-modal="nueva-toma-inventario"]')?.remove();
        document.body.insertAdjacentHTML('beforeend', `
            <div data-modal="nueva-toma-inventario" style="position:fixed;inset:0;background:rgba(15,23,42,.72);z-index:90000;display:flex;align-items:center;justify-content:center;padding:18px;">
                <div style="width:100%;max-width:520px;background:white;border-radius:8px;padding:24px;">
                    <h3 style="margin:0 0 6px;color:#0f172a;">Nueva toma de inventario</h3>
                    <p style="margin:0 0 18px;color:#64748b;font-size:13px;">Se guardara una fotografia del inventario actual. Evita entradas, ventas o transferencias en esta ubicacion durante el conteo.</p>
                    <label style="display:block;font-size:11px;font-weight:900;color:#475569;margin-bottom:5px;">UBICACION</label>
                    <select id="tomaNuevaUbicacion" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;margin-bottom:13px;">${opciones}</select>
                    <label style="display:block;font-size:11px;font-weight:900;color:#475569;margin-bottom:5px;">RESPONSABLE DEL CONTEO</label>
                    <input id="tomaNuevoResponsable" value="${esc(usuarioNombre())}" style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;margin-bottom:13px;">
                    <label style="display:block;font-size:11px;font-weight:900;color:#475569;margin-bottom:5px;">OBSERVACIONES / ALCANCE</label>
                    <textarea id="tomaNuevaNota" rows="3" placeholder="Ej. Conteo general de cierre, zona de exhibicion..." style="width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:6px;box-sizing:border-box;resize:vertical;"></textarea>
                    <div style="display:flex;gap:10px;margin-top:18px;">
                        <button onclick="crearTomaInventario()" style="flex:1;padding:11px;border:0;border-radius:6px;background:#047857;color:white;font-weight:900;cursor:pointer;">Iniciar conteo</button>
                        <button onclick="document.querySelector('[data-modal=nueva-toma-inventario]')?.remove()" style="padding:11px 16px;border:0;border-radius:6px;background:#e2e8f0;color:#334155;font-weight:bold;cursor:pointer;">Cancelar</button>
                    </div>
                </div>
            </div>`);
    };

    window.crearTomaInventario = function() {
        const ubicacion = document.getElementById('tomaNuevaUbicacion')?.value || '';
        const responsable = document.getElementById('tomaNuevoResponsable')?.value.trim() || '';
        const nota = document.getElementById('tomaNuevaNota')?.value.trim() || '';
        if (!ubicacion || !responsable) return alert('Selecciona la ubicacion e indica al responsable.');
        const abierta = leer().find(t => t.ubicacion === ubicacion && ['conteo', 'revision'].includes(t.estado));
        if (abierta) return alert(`Ya existe una toma abierta para ${ubicacion}: ${abierta.folio}. Debes concluirla o cancelarla.`);

        const creadaEn = ahora();
        const toma = {
            id: `toma-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            folio: folioNuevo(),
            ubicacion,
            responsable,
            nota,
            estado: 'conteo',
            creadaEn,
            creadaPor: usuarioNombre(),
            actualizadaEn: creadaEn,
            actualizadaPor: usuarioNombre(),
            lineas: lineasIniciales(ubicacion),
            historial: [{ fecha: creadaEn, accion: 'TOMA_INICIADA', usuario: usuarioNombre(), detalle: `Ubicacion: ${ubicacion}` }]
        };
        const lista = leer();
        lista.push(toma);
        guardar(lista);
        window.AuditService?.log?.({
            accion: 'TOMA_INVENTARIO_INICIADA', modulo: 'Inventario', entidad: toma.folio,
            entidadId: toma.id, detalle: `${ubicacion}; responsable: ${responsable}`,
            datos: { ubicacion, lineas: toma.lineas.length }
        });
        document.querySelector('[data-modal="nueva-toma-inventario"]')?.remove();
        abrirTomaInventario(toma.id);
    };

    window.abrirTomaInventario = function(id) {
        tomaActivaId = id;
        filtroToma = '';
        renderDetalle();
    };

    window.volverListadoTomas = function() {
        tomaActivaId = '';
        renderListado();
    };

    window.filtrarLineasToma = function() {
        filtroToma = String(document.getElementById('tomaFiltro')?.value || '').trim().toLowerCase();
        renderDetalle(true);
    };

    function movimientosPosteriores(toma) {
        const desde = new Date(toma.creadaEn).getTime();
        return (StorageService.get('movimientosInventario', []) || []).filter(m => {
            const fecha = new Date(m.fechaISO || m.fecha || m.createdAt || 0).getTime();
            const tocaUbicacion = [m.ubicacion, m.origen, m.destino]
                .some(u => String(u || '').toUpperCase() === String(toma.ubicacion).toUpperCase());
            return fecha > desde && tocaUbicacion && String(m.tomaInventarioId || '') !== String(toma.id);
        });
    }

    function renderDetalle(conservarFoco = false) {
        const cont = document.getElementById('contenidoTomaInventario');
        const toma = buscarToma(tomaActivaId);
        if (!cont || !toma) return renderListado();
        const r = resumen(toma);
        const editable = toma.estado === 'conteo' || toma.estado === 'revision';
        const posteriores = movimientosPosteriores(toma);
        const lista = toma.lineas.filter(l => {
            const texto = `${l.productoNombre} ${l.categoria} ${l.subcategoria} ${l.color} ${l.nota}`.toLowerCase();
            return !filtroToma || texto.includes(filtroToma);
        });

        const filas = lista.map(l => {
            const final = valorFinal(l);
            const diferencia = final === null ? null : final - num(l.teorico);
            const colorDif = diferencia === null ? '#94a3b8' : diferencia === 0 ? '#047857' : '#b45309';
            return `<tr style="border-bottom:1px solid #e2e8f0;background:${diferencia !== null && diferencia !== 0 ? '#fffbeb' : 'white'};">
                <td style="padding:9px;min-width:240px;"><b>${esc(l.productoNombre)}</b>${l.inactivo ? ' <span style="color:#991b1b;font-size:10px;font-weight:900;">INACTIVO</span>' : ''}<br><small style="color:#64748b;">${esc([l.categoria, l.subcategoria].filter(Boolean).join(' / ') || '-')}</small></td>
                <td style="padding:9px;min-width:110px;"><b>${esc(l.color || 'General')}</b></td>
                <td style="padding:9px;text-align:center;font-size:16px;font-weight:900;color:#334155;">${num(l.teorico)}</td>
                <td style="padding:7px;text-align:center;"><input type="number" min="0" step="1" value="${l.conteo ?? ''}" ${editable ? '' : 'disabled'} onchange="guardarConteoToma('${jsArg(l.id)}','conteo',this.value)" style="width:82px;padding:8px;border:2px solid ${l.conteo === null || l.conteo === '' ? '#cbd5e1' : '#60a5fa'};border-radius:6px;text-align:center;font-weight:900;"></td>
                <td style="padding:7px;text-align:center;"><input type="number" min="0" step="1" value="${l.reconteo ?? ''}" ${editable ? '' : 'disabled'} onchange="guardarConteoToma('${jsArg(l.id)}','reconteo',this.value)" placeholder="-" style="width:82px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;text-align:center;font-weight:900;"></td>
                <td style="padding:9px;text-align:center;color:${colorDif};font-size:16px;font-weight:900;">${diferencia === null ? '-' : (diferencia > 0 ? `+${diferencia}` : diferencia)}</td>
                <td style="padding:7px;"><input value="${esc(l.nota || '')}" ${editable ? '' : 'disabled'} onchange="guardarConteoToma('${jsArg(l.id)}','nota',this.value)" placeholder="Observacion" style="width:170px;padding:8px;border:1px solid #cbd5e1;border-radius:6px;"></td>
            </tr>`;
        }).join('');

        const acciones = editable ? `
            <button onclick="agregarProductoToma()" style="padding:9px 12px;border:1px solid #0f766e;border-radius:6px;background:white;color:#0f766e;font-weight:bold;cursor:pointer;">+ Producto no listado</button>
            <button onclick="marcarTeoricoComoConteo()" style="padding:9px 12px;border:1px solid #64748b;border-radius:6px;background:white;color:#475569;font-weight:bold;cursor:pointer;">Copiar teorico en pendientes</button>
            ${toma.estado === 'conteo'
                ? '<button onclick="enviarTomaRevision()" style="padding:9px 13px;border:0;border-radius:6px;background:#b45309;color:white;font-weight:900;cursor:pointer;">Enviar a revision</button>'
                : '<button onclick="regresarTomaConteo()" style="padding:9px 13px;border:0;border-radius:6px;background:#475569;color:white;font-weight:900;cursor:pointer;">Regresar a conteo</button><button onclick="solicitarCerrarTomaInventario()" style="padding:9px 13px;border:0;border-radius:6px;background:#047857;color:white;font-weight:900;cursor:pointer;">Cerrar y ajustar</button>'}
            <button onclick="solicitarCancelarToma()" style="padding:9px 12px;border:0;border-radius:6px;background:#b91c1c;color:white;font-weight:bold;cursor:pointer;">Cancelar toma</button>
        ` : `<button onclick="exportarTomaInventarioCSV()" style="padding:9px 12px;border:0;border-radius:6px;background:#0f766e;color:white;font-weight:bold;cursor:pointer;">Exportar CSV</button>`;

        cont.innerHTML = `
            <div style="padding:22px;max-width:1550px;margin:0 auto;">
                <div style="display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap;margin-bottom:14px;">
                    <div><button onclick="volverListadoTomas()" style="border:0;background:none;color:#1d4ed8;font-weight:bold;cursor:pointer;padding:0 0 8px;">← Todas las tomas</button>
                    <h2 style="margin:0;color:#0f172a;">${esc(toma.folio)} ${badgeEstado(toma.estado)}</h2>
                    <p style="margin:5px 0 0;color:#64748b;"><b>${esc(toma.ubicacion)}</b> | Responsable: ${esc(toma.responsable)} | Inicio: ${esc(fechaVisible(toma.creadaEn))}</p></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">${acciones}</div>
                </div>
                ${toma.nota ? `<div style="padding:10px 12px;border-left:4px solid #64748b;background:#f8fafc;margin-bottom:12px;color:#334155;">${esc(toma.nota)}</div>` : ''}
                ${posteriores.length ? `<div style="padding:11px 13px;border:1px solid #fdba74;background:#fff7ed;color:#9a3412;border-radius:7px;margin-bottom:12px;font-weight:bold;">Atencion: hay ${posteriores.length} movimiento(s) de inventario en esta ubicacion posteriores al inicio. El cierre conservara esos movimientos y aplicara solo la diferencia contra la fotografia inicial.</div>` : ''}
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px;">
                    <div style="padding:12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:8px;"><small style="color:#64748b;font-weight:900;">AVANCE</small><br><b style="font-size:22px;color:#1d4ed8;">${r.avance}%</b><br><small>${r.contadas} de ${r.total}</small></div>
                    <div style="padding:12px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;"><small style="color:#64748b;font-weight:900;">PENDIENTES</small><br><b style="font-size:22px;color:#334155;">${r.pendientes}</b></div>
                    <div style="padding:12px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px;"><small style="color:#64748b;font-weight:900;">RENGLONES CON DIFERENCIA</small><br><b style="font-size:22px;color:#b45309;">${r.diferencias}</b></div>
                    <div style="padding:12px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:8px;"><small style="color:#64748b;font-weight:900;">DIFERENCIA NETA</small><br><b style="font-size:22px;color:${r.unidadesDiferencia === 0 ? '#047857' : '#b45309'};">${r.unidadesDiferencia > 0 ? '+' : ''}${r.unidadesDiferencia}</b></div>
                </div>
                <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px;">
                    <input id="tomaFiltro" value="${esc(filtroToma)}" oninput="filtrarLineasToma()" placeholder="Buscar producto, categoria o color..." style="width:min(100%,430px);padding:9px;border:1px solid #cbd5e1;border-radius:6px;">
                    <small style="color:#64748b;">La existencia teorica es la fotografia tomada al iniciar.</small>
                </div>
                <div style="overflow:auto;border:1px solid #e2e8f0;border-radius:8px;background:white;">
                    <table style="width:100%;border-collapse:collapse;min-width:1050px;">
                        <thead style="position:sticky;top:0;background:#0f172a;color:white;z-index:1;"><tr>
                            <th style="padding:10px;text-align:left;">Producto</th><th style="padding:10px;text-align:left;">Color</th>
                            <th style="padding:10px;text-align:center;">Sistema</th><th style="padding:10px;text-align:center;">Conteo</th>
                            <th style="padding:10px;text-align:center;">Reconteo</th><th style="padding:10px;text-align:center;">Diferencia</th>
                            <th style="padding:10px;text-align:left;">Nota</th>
                        </tr></thead>
                        <tbody>${filas || '<tr><td colspan="7" style="padding:25px;text-align:center;color:#64748b;">No hay coincidencias.</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;
        if (conservarFoco) {
            const input = document.getElementById('tomaFiltro');
            input?.focus();
            input?.setSelectionRange(input.value.length, input.value.length);
        }
    }

    window.guardarConteoToma = function(lineaId, campo, value) {
        const toma = buscarToma(tomaActivaId);
        if (!toma || !['conteo', 'revision'].includes(toma.estado)) return;
        if (campo !== 'nota' && value !== '' && (num(value) < 0 || !Number.isFinite(Number(value)))) {
            alert('El conteo debe ser cero o un numero positivo.');
            return renderDetalle();
        }
        actualizarToma(toma.id, t => {
            const linea = t.lineas.find(l => String(l.id) === String(lineaId));
            if (!linea) return;
            linea[campo] = campo === 'nota' ? String(value || '').trim() : (value === '' ? null : num(value));
            linea.ultimaCapturaEn = ahora();
            linea.ultimaCapturaPor = usuarioNombre();
        });
        renderDetalle();
    };

    window.marcarTeoricoComoConteo = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma || !['conteo', 'revision'].includes(toma.estado)) return;
        const pendientes = toma.lineas.filter(l => l.conteo === null || l.conteo === '').length;
        if (!pendientes) return alert('No hay renglones pendientes.');
        if (!confirm(`Se copiaran las existencias del sistema en ${pendientes} renglones pendientes. Utiliza esta opcion solo si esos productos ya fueron verificados fisicamente.`)) return;
        actualizarToma(toma.id, t => t.lineas.forEach(l => {
            if (l.conteo === null || l.conteo === '') l.conteo = num(l.teorico);
        }));
        renderDetalle();
    };

    window.agregarProductoToma = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma || !['conteo', 'revision'].includes(toma.estado)) return;
        if (typeof window.abrirSelectorProducto !== 'function') return alert('No esta disponible el selector de productos.');
        window.abrirSelectorProducto({
            titulo: 'Agregar producto no listado',
            incluirInactivos: true,
            onSeleccion: p => {
                const color = prompt(`Color o variante fisica de "${p.nombre}"`, p.color || 'General');
                if (color === null) return;
                const limpio = color.trim() || 'General';
                const repetida = toma.lineas.some(l => claveLinea(l.productoId, l.color) === claveLinea(p.id, limpio));
                if (repetida) return alert('Ese producto y color ya estan incluidos en la toma.');
                actualizarToma(toma.id, t => t.lineas.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                    productoId: p.id, productoNombre: p.nombre || 'Producto',
                    categoria: p.categoria || '', subcategoria: p.subcategoria || '',
                    color: limpio, teorico: 0, conteo: null, reconteo: null,
                    nota: 'Producto encontrado fisicamente y agregado durante la toma',
                    agregadoDuranteToma: true, inactivo: !activo(p)
                }));
                renderDetalle();
            }
        });
    };

    window.enviarTomaRevision = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma || toma.estado !== 'conteo') return;
        const r = resumen(toma);
        if (r.pendientes) return alert(`Faltan ${r.pendientes} renglones por contar. Los ceros tambien deben capturarse expresamente.`);
        if (r.diferencias && !confirm(`La toma tiene ${r.diferencias} renglones con diferencia. Se enviara a revision para validar reconteos y notas. Continuar?`)) return;
        actualizarToma(toma.id, t => {
            t.estado = 'revision';
            t.enviadaRevisionEn = ahora();
            t.enviadaRevisionPor = usuarioNombre();
            t.historial.push({ fecha: ahora(), accion: 'ENVIADA_A_REVISION', usuario: usuarioNombre(), detalle: `${r.diferencias} diferencias` });
        });
        window.AuditService?.log?.({
            accion: 'TOMA_INVENTARIO_A_REVISION', modulo: 'Inventario',
            entidad: toma.folio, entidadId: toma.id, detalle: `${r.diferencias} renglones con diferencia`
        });
        renderDetalle();
    };

    window.regresarTomaConteo = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma || toma.estado !== 'revision') return;
        actualizarToma(toma.id, t => {
            t.estado = 'conteo';
            t.historial.push({ fecha: ahora(), accion: 'REGRESADA_A_CONTEO', usuario: usuarioNombre(), detalle: 'Se solicito correccion o reconteo' });
        });
        renderDetalle();
    };

    window.solicitarCerrarTomaInventario = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma || toma.estado !== 'revision') return;
        const accion = () => cerrarToma(toma.id);
        if (typeof window.requireAdmin === 'function') window.requireAdmin(accion);
        else if (confirm('Esta operacion requiere autorizacion administrativa. Continuar?')) accion();
    };

    function cerrarToma(id) {
        const toma = buscarToma(id);
        if (!toma || toma.estado !== 'revision') return alert('La toma ya no esta disponible para cierre.');
        const r = resumen(toma);
        if (r.pendientes) return alert('No se puede cerrar con renglones pendientes.');
        if (!confirm(`CIERRE DE TOMA ${toma.folio}\n\nUbicacion: ${toma.ubicacion}\nRenglones con diferencia: ${r.diferencias}\nDiferencia neta: ${r.unidadesDiferencia}\n\nSe ajustara el inventario y se generara Kardex por cada diferencia. Esta accion no se puede deshacer desde la toma. Continuar?`)) return;

        const productos = StorageService.get('productos', []) || [];
        const movs = StorageService.get('movimientosInventario', []) || [];
        const errores = [];
        const cambios = [];
        const deltaPorProducto = new Map();

        toma.lineas.forEach(l => {
            const final = valorFinal(l);
            const delta = final - num(l.teorico);
            if (!delta) return;
            const p = productos.find(x => String(x.id) === String(l.productoId));
            if (!p) {
                errores.push(`${l.productoNombre}: producto no encontrado`);
                return;
            }
            p.variantes = Array.isArray(p.variantes) ? p.variantes : [];
            let variante = p.variantes.find(v =>
                String(v.ubicacion || 'General').trim().toUpperCase() === String(toma.ubicacion).trim().toUpperCase() &&
                String(v.color || 'General').trim().toUpperCase() === String(l.color || 'General').trim().toUpperCase()
            );
            const stockVarianteActual = num(variante?.stock);
            if (stockVarianteActual + delta < 0) {
                errores.push(`${l.productoNombre} / ${l.color}: el ajuste dejaria la ubicacion en negativo (${stockVarianteActual + delta})`);
                return;
            }
            cambios.push({ linea: l, producto: p, variante, delta, final, stockVarianteActual });
            deltaPorProducto.set(String(p.id), num(deltaPorProducto.get(String(p.id))) + delta);
        });

        deltaPorProducto.forEach((delta, productoId) => {
            const p = productos.find(x => String(x.id) === productoId);
            if (p && num(p.stock) + delta < 0) {
                errores.push(`${p.nombre || 'Producto'}: el ajuste dejaria el stock general en negativo (${num(p.stock) + delta})`);
            }
        });

        if (errores.length) {
            return alert(`No se aplico ningun ajuste.\n\nHay conflictos con movimientos posteriores:\n- ${errores.join('\n- ')}\n\nRevisa o recontea esos productos antes de cerrar.`);
        }

        const fechaCierre = ahora();
        const afectados = new Set();
        cambios.forEach(c => {
            if (!c.variante) {
                c.variante = { ubicacion: toma.ubicacion, color: c.linea.color || 'General', stock: 0 };
                c.producto.variantes.push(c.variante);
            }
            c.variante.stock = c.stockVarianteActual + c.delta;
            c.producto.stock = num(c.producto.stock) + c.delta;
            afectados.add(String(c.producto.id));
            movs.push({
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                fecha: fechaCierre,
                tipo: c.delta > 0 ? 'Ingreso (Toma de Inventario)' : 'Egreso (Toma de Inventario)',
                tipoBase: c.delta > 0 ? 'entrada' : 'salida',
                productoId: c.producto.id,
                productoNombre: c.producto.nombre || c.linea.productoNombre,
                cantidad: Math.abs(c.delta),
                ubicacion: toma.ubicacion,
                color: c.linea.color || 'General',
                motivo: `Ajuste por toma fisica ${toma.folio}${c.linea.nota ? `: ${c.linea.nota}` : ''}`,
                referencia: toma.folio,
                tomaInventarioId: toma.id,
                conteoSistema: num(c.linea.teorico),
                conteoFisico: c.final,
                usuario: usuarioNombre(),
                rol: sesion().rol || ''
            });
        });

        productos.forEach(p => {
            if (!afectados.has(String(p.id))) return;
            p.stockPorUbicacion = p.stockPorUbicacion || {};
            p.stockPorUbicacion[toma.ubicacion] = (p.variantes || [])
                .filter(v => String(v.ubicacion || 'General').trim().toUpperCase() === String(toma.ubicacion).trim().toUpperCase())
                .reduce((s, v) => s + num(v.stock), 0);
        });

        StorageService.set('productos', productos);
        StorageService.set('movimientosInventario', movs);
        actualizarToma(toma.id, t => {
            t.estado = 'cerrada';
            t.cerradaEn = fechaCierre;
            t.cerradaPor = usuarioNombre();
            t.resumenCierre = { ...r, ajustesAplicados: cambios.length };
            t.historial.push({ fecha: fechaCierre, accion: 'TOMA_CERRADA', usuario: usuarioNombre(), detalle: `${cambios.length} ajustes aplicados` });
        });
        window.AuditService?.log?.({
            accion: 'TOMA_INVENTARIO_CERRADA', modulo: 'Inventario',
            entidad: toma.folio, entidadId: toma.id,
            detalle: `${toma.ubicacion}; ${cambios.length} ajustes; diferencia neta ${r.unidadesDiferencia}`,
            datos: { ubicacion: toma.ubicacion, diferencias: r.diferencias, ajustes: cambios.length, neto: r.unidadesDiferencia }
        });
        alert(`Toma cerrada correctamente.\n\nSe aplicaron ${cambios.length} ajustes y cada uno quedo registrado en Kardex.`);
        renderDetalle();
    }

    window.solicitarCancelarToma = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma || !['conteo', 'revision'].includes(toma.estado)) return;
        const accion = () => {
            const motivo = prompt(`Motivo para cancelar ${toma.folio}:`);
            if (!motivo?.trim()) return;
            if (!confirm('La toma quedara cancelada y no modificara existencias. Continuar?')) return;
            actualizarToma(toma.id, t => {
                t.estado = 'cancelada';
                t.canceladaEn = ahora();
                t.canceladaPor = usuarioNombre();
                t.motivoCancelacion = motivo.trim();
                t.historial.push({ fecha: ahora(), accion: 'TOMA_CANCELADA', usuario: usuarioNombre(), detalle: motivo.trim() });
            });
            window.AuditService?.log?.({
                accion: 'TOMA_INVENTARIO_CANCELADA', modulo: 'Inventario',
                entidad: toma.folio, entidadId: toma.id, detalle: motivo.trim(), severidad: 'riesgo'
            });
            renderDetalle();
        };
        if (typeof window.requireAdmin === 'function') window.requireAdmin(accion);
        else accion();
    };

    window.exportarTomaInventarioCSV = function() {
        const toma = buscarToma(tomaActivaId);
        if (!toma) return;
        const csvEsc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const rows = [['Folio', 'Ubicacion', 'Estado', 'Producto', 'Categoria', 'Subcategoria', 'Color', 'Sistema', 'Conteo', 'Reconteo', 'Conteo final', 'Diferencia', 'Nota']];
        toma.lineas.forEach(l => {
            const final = valorFinal(l);
            rows.push([toma.folio, toma.ubicacion, toma.estado, l.productoNombre, l.categoria, l.subcategoria, l.color, l.teorico, l.conteo ?? '', l.reconteo ?? '', final ?? '', final === null ? '' : final - num(l.teorico), l.nota || '']);
        });
        const blob = new Blob(['\ufeff' + rows.map(r => r.map(csvEsc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${toma.folio}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    window.renderTomaInventario = function() {
        if (tomaActivaId && buscarToma(tomaActivaId)) renderDetalle();
        else renderListado();
    };
})();
