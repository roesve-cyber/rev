// ===== GASTOS OPERATIVOS =====

const _CATEGORIAS_GASTOS_DEFAULT = [
    { id: 1, nombre: 'Renta', icono: '🏠', color: '#ef4444' },
    { id: 2, nombre: 'Luz/Agua/Gas', icono: '💡', color: '#f59e0b' },
    { id: 3, nombre: 'Nómina', icono: '👥', color: '#8b5cf6' },
    { id: 4, nombre: 'Transporte', icono: '🚚', color: '#3b82f6' },
    { id: 5, nombre: 'Publicidad', icono: '📣', color: '#ec4899' },
    { id: 6, nombre: 'Mantenimiento', icono: '🔧', color: '#14b8a6' },
    { id: 7, nombre: 'Insumos', icono: '📦', color: '#f97316' },
    { id: 8, nombre: 'Otros', icono: '📝', color: '#6b7280' }
];

// Mantener compatibilidad hacia atrás con código que use _CATEGORIAS_GASTOS como array de strings
const _CATEGORIAS_GASTOS = _CATEGORIAS_GASTOS_DEFAULT.map(c => c.nombre);

function getCategoriasGasto() {
    return StorageService.get('categoriasGasto', _CATEGORIAS_GASTOS_DEFAULT);
}

function abrirGestionCategorias() {
    if (typeof requireAdmin !== 'function') { _renderModalCategorias(); return; }
    requireAdmin(_renderModalCategorias);
}

function _renderModalCategorias() {
    document.querySelector('[data-modal="gestion-categorias"]')?.remove();
    const cats = getCategoriasGasto();
    const rows = cats.map(c => `
      <tr id="catRow-${c.id}">
        <td style="padding:8px;text-align:center;font-size:18px;">${c.icono || '📝'}</td>
        <td style="padding:8px;">${c.nombre}</td>
        <td style="padding:8px;text-align:center;"><span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${c.color};border:1px solid #ddd;"></span></td>
        <td style="padding:8px;text-align:center;display:flex;gap:4px;justify-content:center;">
          <button onclick="editarCategoriaGasto(${c.id})" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Editar">✏️</button>
          <button onclick="eliminarCategoriaGasto(${c.id})" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Eliminar">🗑️</button>
        </td>
      </tr>`).join('');

    const html = `
    <div data-modal="gestion-categorias" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:540px;padding:28px;max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 20px;color:#dc2626;">⚙️ Categorías de Gasto</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px;">
          <thead><tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:center;">Icono</th>
            <th style="padding:8px;text-align:left;">Nombre</th>
            <th style="padding:8px;text-align:center;">Color</th>
            <th style="padding:8px;text-align:center;">Acciones</th>
          </tr></thead>
          <tbody id="listaCategorias">${rows || '<tr><td colspan="4" style="text-align:center;padding:20px;color:#9ca3af;">Sin categorías</td></tr>'}</tbody>
        </table>
        <div style="background:#f9fafb;border-radius:8px;padding:16px;">
          <h4 style="margin:0 0 12px;color:#374151;">➕ Agregar categoría</h4>
          <div style="display:grid;grid-template-columns:60px 1fr 80px auto;gap:10px;align-items:end;">
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">ICONO</label>
              <input type="text" id="newCatIcono" placeholder="📝" maxlength="4"
                style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;text-align:center;font-size:18px;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">NOMBRE</label>
              <input type="text" id="newCatNombre" placeholder="Nombre de categoría"
                style="width:100%;padding:8px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;box-sizing:border-box;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">COLOR</label>
              <input type="color" id="newCatColor" value="#6b7280"
                style="width:100%;height:36px;padding:2px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;cursor:pointer;">
            </div>
            <button onclick="guardarCategoriaGasto()"
              style="padding:8px 14px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;white-space:nowrap;">➕ Agregar</button>
          </div>
        </div>
        <div style="margin-top:16px;text-align:right;">
          <button onclick="document.querySelector('[data-modal=gestion-categorias]')?.remove()"
            style="padding:10px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cerrar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarCategoriaGasto(idEditar) {
    let icono, nombre, color;
    if (idEditar) {
        icono = document.getElementById(`editCatIcono-${idEditar}`)?.value.trim() || '📝';
        nombre = document.getElementById(`editCatNombre-${idEditar}`)?.value.trim();
        color = document.getElementById(`editCatColor-${idEditar}`)?.value || '#6b7280';
    } else {
        icono = document.getElementById('newCatIcono')?.value.trim() || '📝';
        nombre = document.getElementById('newCatNombre')?.value.trim();
        color = document.getElementById('newCatColor')?.value || '#6b7280';
    }
    if (!nombre) return alert('⚠️ El nombre de la categoría es obligatorio.');
    const cats = getCategoriasGasto();
    if (idEditar) {
        const idx = cats.findIndex(c => c.id === idEditar);
        if (idx !== -1) { cats[idx].icono = icono; cats[idx].nombre = nombre; cats[idx].color = color; }
    } else {
        if (cats.find(c => c.nombre.toLowerCase() === nombre.toLowerCase())) return alert('⚠️ Ya existe una categoría con ese nombre.');
        cats.push({ id: Date.now(), nombre, icono, color });
    }
    StorageService.set('categoriasGasto', cats);
    _renderModalCategorias();
}

function editarCategoriaGasto(id) {
    const cats = getCategoriasGasto();
    const c = cats.find(x => x.id === id);
    if (!c) return;
    const row = document.getElementById(`catRow-${id}`);
    if (!row) return;
    row.innerHTML = `
      <td style="padding:8px;text-align:center;"><input type="text" id="editCatIcono-${id}" value="${c.icono||'📝'}" maxlength="4" style="width:48px;padding:4px;border:1px solid #d1d5db;border-radius:4px;text-align:center;font-size:18px;"></td>
      <td style="padding:8px;"><input type="text" id="editCatNombre-${id}" value="${c.nombre}" style="width:100%;padding:6px;border:1px solid #d1d5db;border-radius:4px;box-sizing:border-box;"></td>
      <td style="padding:8px;text-align:center;"><input type="color" id="editCatColor-${id}" value="${c.color||'#6b7280'}" style="width:36px;height:30px;padding:2px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer;"></td>
      <td style="padding:8px;text-align:center;display:flex;gap:4px;justify-content:center;">
        <button onclick="guardarCategoriaGasto(${id})" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Guardar">💾</button>
        <button onclick="_renderModalCategorias()" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Cancelar">✕</button>
      </td>`;
}

function eliminarCategoriaGasto(id) {
    if (typeof requireAdmin !== 'function') { _ejecutarEliminarCategoria(id); return; }
    requireAdmin(() => _ejecutarEliminarCategoria(id));
}

function _ejecutarEliminarCategoria(id) {
    const cats = getCategoriasGasto();
    const c = cats.find(x => x.id === id);
    if (!c) return;
    // Verificar si hay gastos usando esta categoría
    const gastos = StorageService.get('gastosOperativos', []);
    const enUso = gastos.some(g => g.categoria === c.nombre);
    if (enUso) return alert(`⚠️ No se puede eliminar "${c.nombre}" porque hay gastos registrados con esa categoría.`);
    if (!confirm(`¿Eliminar la categoría "${c.nombre}"?`)) return;
    StorageService.set('categoriasGasto', cats.filter(x => x.id !== id));
    _renderModalCategorias();
}

function abrirRegistrarGasto() {
    const html = `
    <div data-modal="registrar-gasto" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:520px;padding:28px;max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 20px;color:#dc2626;">💸 Registrar Gasto</h2>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CATEGORÍA</label>
            <select id="gastoCategoria" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              ${getCategoriasGasto().map(c => `<option value="${c.nombre}">${c.icono || ''} ${c.nombre}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">DESCRIPCIÓN</label>
            <input type="text" id="gastoDescripcion" placeholder="Descripción del gasto" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">MONTO ($)</label>
            <input type="number" id="gastoMonto" min="0" step="0.01" placeholder="0.00" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA</label>
            <input type="date" id="gastoFecha" value="${new Date().toISOString().split('T')[0]}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">¿DE QUÉ CUENTA SALE EL DINERO?</label>
            ${window._buildSelectorCuentas('gastoCuentaDebito', false)}
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="gastoRecurrente" onchange="toggleRecurrente()" style="width:18px;height:18px;">
            <span style="font-size:14px;font-weight:bold;">¿Es gasto recurrente?</span>
          </label>
          <div id="divPeriodicidad" style="display:none;">
            <label style="font-size:12px;font-weight:bold;color:#374151;">PERIODICIDAD</label>
            <select id="gastoPeriodicidad" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="mensual">Mensual</option>
              <option value="semanal">Semanal</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarGasto()" style="flex:1;padding:12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Registrar Gasto</button>
          <button onclick="document.querySelector('[data-modal=registrar-gasto]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function guardarGasto() {
    const categoria = document.getElementById('gastoCategoria')?.value;
    const descripcion = document.getElementById('gastoDescripcion')?.value.trim();
    const monto = parseFloat(document.getElementById('gastoMonto')?.value) || 0;
    const fecha = document.getElementById('gastoFecha')?.value || new Date().toISOString().split('T')[0];
    const recurrente = document.getElementById('gastoRecurrente')?.checked || false;
    const periodicidad = document.getElementById('gastoPeriodicidad')?.value || 'mensual';
    
    // Obtener cuenta conectada al enchufe
    const selCuenta = document.getElementById('gastoCuentaDebito');
    const cuentaId = selCuenta.value;
    const etiqueta = selCuenta.options[selCuenta.selectedIndex].text;

    if (!descripcion) return alert('⚠️ La descripción es obligatoria.');
    if (monto <= 0) return alert('⚠️ El monto debe ser mayor a 0.');
    
    const hoyStr = new Date().toISOString().split('T')[0];
    const gasto = { id: Date.now(), categoria, descripcion, monto, fecha, cuentaDebito: cuentaId, etiquetaCuenta: etiqueta, recurrente, periodicidad, ultimaVez: recurrente ? hoyStr : null };
    
    const gastos = StorageService.get('gastosOperativos', []);
    gastos.push(gasto);
    StorageService.set('gastosOperativos', gastos);
    
    // Descontar usando el enchufe universal
    window._egresarCuenta({
        monto: monto, cuentaId: cuentaId, etiqueta: etiqueta,
        concepto: `Gasto: ${categoria} — ${descripcion}`, referencia: `GASTO-${gasto.id}`
    });

    document.querySelector('[data-modal="registrar-gasto"]')?.remove();
    alert(`✅ Gasto registrado: ${dinero(monto)} (Restado de ${etiqueta})`);
    renderGestionGastos();
}

function toggleRecurrente() {
    const cb = document.getElementById('gastoRecurrente');
    const div = document.getElementById('divPeriodicidad');
    if (div) div.style.display = cb?.checked ? 'block' : 'none';
}

function renderGestionGastos() {
    const cont = document.getElementById('contenidoGastos');
    if (!cont) return;
    const gastos = StorageService.get('gastosOperativos', []);
    const totalGastos = gastos.reduce((s, g) => s + g.monto, 0);
    const categorias = getCategoriasGasto();

    // Mini gráfico por categoría
    const porCat = {};
    categorias.forEach(c => porCat[c.nombre] = 0);
    gastos.forEach(g => { if (porCat[g.categoria] !== undefined) porCat[g.categoria] += g.monto; else { porCat[g.categoria] = (porCat[g.categoria] || 0) + g.monto; } });
    const maxVal = Math.max(...Object.values(porCat), 1);
    const barras = Object.entries(porCat).filter(([, v]) => v > 0).map(([cat, val]) => {
        const pct = (val / maxVal * 100).toFixed(1);
        const catObj = categorias.find(c => c.nombre === cat);
        const color = catObj ? catObj.color : '#dc2626';
        return `<div style="margin-bottom:8px;">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
            <span>${catObj ? (catObj.icono + ' ') : ''}${cat}</span><span>${dinero(val)}</span>
          </div>
          <div style="background:#f3f4f6;border-radius:4px;height:16px;">
            <div style="background:${color};height:100%;border-radius:4px;width:${pct}%;transition:width 0.3s;"></div>
          </div>
        </div>`;
    }).join('');

    // Filtros aplicados
    const filtroMes = document.getElementById('gastoFiltroMes')?.value || '';
    const filtroCat = document.getElementById('gastoFiltroCat')?.value || '';
    let gastosFiltrados = gastos;
    if (filtroMes) gastosFiltrados = gastosFiltrados.filter(g => g.fecha && g.fecha.startsWith(filtroMes));
    if (filtroCat) gastosFiltrados = gastosFiltrados.filter(g => g.categoria === filtroCat);

    const rows = gastosFiltrados.slice().reverse().map(g => `<tr>
      <td style="padding:8px;">${g.fecha || '-'}</td>
      <td style="padding:8px;">${g.categoria}</td>
      <td style="padding:8px;">${g.descripcion}</td>
      <td style="padding:8px;text-align:right;">${dinero(g.monto)}</td>
      <td style="padding:8px;text-align:center;">${g.cuentaDebito || 'caja'}</td>
      <td style="padding:8px;text-align:center;">${g.recurrente ? `🔁 ${g.periodicidad}` : '-'}</td>
      <td style="padding:8px;text-align:center;"><button onclick="eliminarGasto(${g.id})" style="background:none;border:none;cursor:pointer;font-size:16px;">🗑️</button></td>
    </tr>`).join('');

    cont.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;color:#dc2626;">💸 Gastos Operativos</h3>
        <div style="display:flex;gap:8px;">
          <button onclick="abrirGestionCategorias()" style="padding:10px 16px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">⚙️ Categorías</button>
          <button onclick="abrirRegistrarGasto()" style="padding:10px 18px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">➕ Registrar Gasto</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:20px;">
        <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <h4 style="margin:0 0 16px;color:#dc2626;">📊 Por Categoría</h4>
          ${barras || '<p style="color:#9ca3af;font-size:13px;">Sin datos</p>'}
          <div style="border-top:1px solid #e5e7eb;padding-top:12px;margin-top:12px;">
            <strong>Total: ${dinero(totalGastos)}</strong>
          </div>
        </div>
        <div style="background:white;padding:20px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          <div style="display:flex;gap:12px;margin-bottom:16px;align-items:end;">
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">MES (YYYY-MM)</label>
              <input type="month" id="gastoFiltroMes" onchange="renderGestionGastos()" style="padding:7px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
            </div>
            <div>
              <label style="font-size:11px;font-weight:bold;color:#374151;">CATEGORÍA</label>
              <select id="gastoFiltroCat" onchange="renderGestionGastos()" style="padding:7px;border:1px solid #d1d5db;border-radius:6px;margin-top:3px;">
                <option value="">Todas</option>
                ${categorias.map(c => `<option value="${c.nombre}" ${filtroCat === c.nombre ? 'selected' : ''}>${c.icono || ''} ${c.nombre}</option>`).join('')}
              </select>
            </div>
          </div>
          ${gastosFiltrados.length === 0 ? '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin resultados.</p>' : `
          <div style="overflow-x:auto;max-height:400px;overflow-y:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead><tr style="background:#f3f4f6;position:sticky;top:0;">
                <th style="padding:8px;text-align:left;">Fecha</th>
                <th style="padding:8px;text-align:left;">Categoría</th>
                <th style="padding:8px;text-align:left;">Descripción</th>
                <th style="padding:8px;text-align:right;">Monto</th>
                <th style="padding:8px;text-align:center;">Cuenta</th>
                <th style="padding:8px;text-align:center;">Recurrente</th>
                <th></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`}
        </div>
      </div>`;
}

function eliminarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    let gastos = StorageService.get('gastosOperativos', []);
    gastos = gastos.filter(g => g.id !== id);
    StorageService.set('gastosOperativos', gastos);
    renderGestionGastos();
}

function verificarGastosRecurrentes() {
    const gastos = StorageService.get('gastosOperativos', []);
    const hoy = new Date();
    const recurrentes = gastos.filter(g => g.recurrente);
    if (recurrentes.length === 0) return;
    const hoyStr = hoy.toISOString().split('T')[0];
    let nuevos = 0;
    recurrentes.forEach(g => {
        if (!g.ultimaVez) return;
        const ultima = new Date(g.ultimaVez);
        const diasDif = Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24));
        const umbral = g.periodicidad === 'semanal' ? 7 : 30;
        if (diasDif >= umbral) {
            const nuevoId = Date.now() + Math.floor(Math.random() * 1000);
            const nuevo = { ...g, id: nuevoId, fecha: hoyStr, ultimaVez: hoyStr };
            gastos.push(nuevo);
            const movs = StorageService.get('movimientosCaja', []);
            movs.push({
                id: Date.now() + 2,
                tipo: 'egreso',
                concepto: `Gasto recurrente: ${g.categoria} — ${g.descripcion}`,
                monto: g.monto,
                fecha: new Date().toISOString(),
                cuenta: g.cuentaDebito || 'caja',
                referencia: `GASTO-${nuevo.id}`
            });
            StorageService.set('movimientosCaja', movs);
            nuevos++;
        }
    });
    if (nuevos > 0) {
        StorageService.set('gastosOperativos', gastos);
        console.log(`🔁 ${nuevos} gasto(s) recurrente(s) registrado(s) automáticamente.`);
    }
}

window.abrirRegistrarGasto = abrirRegistrarGasto;
window.toggleRecurrente = toggleRecurrente;
window.guardarGasto = guardarGasto;
window.renderGestionGastos = renderGestionGastos;
window.eliminarGasto = eliminarGasto;
window.verificarGastosRecurrentes = verificarGastosRecurrentes;
window.getCategoriasGasto = getCategoriasGasto;
window.abrirGestionCategorias = abrirGestionCategorias;
window._renderModalCategorias = _renderModalCategorias;
window.guardarCategoriaGasto = guardarCategoriaGasto;
window.editarCategoriaGasto = editarCategoriaGasto;
window.eliminarCategoriaGasto = eliminarCategoriaGasto;
