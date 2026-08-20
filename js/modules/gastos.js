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
            <input type="date" id="gastoFecha" value="${window.obtenerHoyInputMX()}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
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
    const fecha = document.getElementById('gastoFecha')?.value || window.obtenerHoyInputMX();
    const recurrente = document.getElementById('gastoRecurrente')?.checked || false;
    const periodicidad = document.getElementById('gastoPeriodicidad')?.value || 'mensual';
    
    // Obtener cuenta conectada al enchufe
    const selCuenta = document.getElementById('gastoCuentaDebito');
    const cuentaId = selCuenta.value;
    const etiqueta = selCuenta.options[selCuenta.selectedIndex].text;

    if (!descripcion) return alert('⚠️ La descripción es obligatoria.');
    if (monto <= 0) return alert('⚠️ El monto debe ser mayor a 0.');

    // --- NUEVO: RESUMEN Y CONFIRMACIÓN ---
    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', {minimumFractionDigits: 2});
    const msjConf = `⚠️ RESUMEN DE OPERACIÓN - ¿REGISTRAR GASTO?\n\nCategoría: ${categoria}\nConcepto: ${descripcion}\nMonto: ${formatoDinero(monto)}\nDinero sale de: ${etiqueta}\n\n¿Deseas registrar este egreso?`;
    if (!confirm(msjConf)) return;
    // --- FIN DE CONFIRMACIÓN ---

    const hoyStr = window.obtenerHoyInputMX();
    const gasto = { id: Date.now(), categoria, descripcion, monto, fecha, cuentaDebito: cuentaId, etiquetaCuenta: etiqueta, recurrente, periodicidad, ultimaVez: recurrente ? hoyStr : null };

    // 🛡️ Confirmamos el egreso de caja ANTES de persistir el gasto. Antes, el
    // gasto se guardaba en gastosOperativos y se avisaba "restado de la
    // cuenta" sin revisar el resultado de _egresarCuenta: si la cuenta no
    // existía, el gasto quedaba registrado igual sin que el dinero saliera.
    if (typeof window._egresarCuenta !== 'function') {
        alert("No se pudo registrar el gasto: el módulo de caja no está disponible. Nada se guardó.");
        return;
    }
    const _egresoOkGasto = window._egresarCuenta({
        monto: monto, cuentaId: cuentaId, etiqueta: etiqueta,
        concepto: `Gasto: ${categoria} — ${descripcion}`, referencia: `GASTO-${gasto.id}`
    });
    if (!_egresoOkGasto) {
        alert(`No se pudo registrar el egreso de caja para "${etiqueta || cuentaId}".\n\nEl gasto NO se guardó. Verifica que esa cuenta exista.`);
        return;
    }

    const gastos = StorageService.get('gastosOperativos', []);
    gastos.push(gasto);
    StorageService.set('gastosOperativos', gastos);

    document.querySelector('[data-modal="registrar-gasto"]')?.remove();
    alert(`✅ Gasto registrado: ${dinero(monto)} (Restado de ${etiqueta})`);
    renderGestionGastos();
}

// ===== CORRECCIÓN DE GASTOS YA REGISTRADOS =====
// Editar un gasto no solo cambia el registro en gastosOperativos: también
// debe corregir el dinero que ya salió de la cuenta. El patrón es el mismo
// que usa bancos.js para deshacer pagos de corte: nunca se reescribe el
// movimiento viejo en movimientosCaja (se pierde el rastro), se revierte con
// un INGRESO nuevo (regresa el monto viejo a la cuenta vieja) y se aplica un
// EGRESO nuevo (saca el monto corregido de la cuenta corregida). Así la
// bitácora de caja queda completa y auditable.
function abrirEditarGasto(id) {
    if (typeof requireAdmin !== 'function') { _renderModalEditarGasto(id); return; }
    requireAdmin(() => _renderModalEditarGasto(id));
}

function _renderModalEditarGasto(id) {
    const gastos = StorageService.get('gastosOperativos', []);
    const g = gastos.find(x => x.id === id);
    if (!g) return alert('⚠️ Ese gasto ya no existe.');

    document.querySelector('[data-modal="editar-gasto"]')?.remove();
    const html = `
    <div data-modal="editar-gasto" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">
      <div style="background:white;border-radius:12px;width:100%;max-width:520px;padding:28px;max-height:90vh;overflow-y:auto;">
        <h2 style="margin:0 0 6px;color:#dc2626;">✏️ Corregir Gasto</h2>
        <p style="margin:0 0 20px;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fde68a;padding:8px 10px;border-radius:6px;">
          Esto ajusta también el dinero de caja: se regresa el monto original a "${g.etiquetaCuenta || g.cuentaDebito}" y se vuelve a sacar el monto corregido de la cuenta que elijas abajo. Queda registrado en auditoría.
        </p>
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">CATEGORÍA</label>
            <select id="editGastoCategoria-${id}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              ${getCategoriasGasto().map(c => `<option value="${c.nombre}" ${c.nombre === g.categoria ? 'selected' : ''}>${c.icono || ''} ${c.nombre}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">DESCRIPCIÓN</label>
            <input type="text" id="editGastoDescripcion-${id}" value="${_escGasto(g.descripcion)}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">MONTO ($)</label>
            <input type="number" id="editGastoMonto-${id}" min="0" step="0.01" value="${g.monto}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">FECHA</label>
            <input type="date" id="editGastoFecha-${id}" value="${g.fecha || window.obtenerHoyInputMX()}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
          </div>
          <div>
            <label style="font-size:12px;font-weight:bold;color:#374151;">¿DE QUÉ CUENTA SALE EL DINERO?</label>
            ${window._buildSelectorCuentas(`editGastoCuentaDebito-${id}`, false)}
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <input type="checkbox" id="editGastoRecurrente-${id}" ${g.recurrente ? 'checked' : ''} onchange="document.getElementById('editDivPeriodicidad-${id}').style.display = this.checked ? 'block' : 'none'" style="width:18px;height:18px;">
            <span style="font-size:14px;font-weight:bold;">¿Es gasto recurrente?</span>
          </label>
          <div id="editDivPeriodicidad-${id}" style="display:${g.recurrente ? 'block' : 'none'};">
            <label style="font-size:12px;font-weight:bold;color:#374151;">PERIODICIDAD</label>
            <select id="editGastoPeriodicidad-${id}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;margin-top:4px;">
              <option value="mensual" ${g.periodicidad === 'mensual' ? 'selected' : ''}>Mensual</option>
              <option value="semanal" ${g.periodicidad === 'semanal' ? 'selected' : ''}>Semanal</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:20px;">
          <button onclick="guardarEdicionGasto(${id})" style="flex:1;padding:12px;background:#dc2626;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">💾 Guardar Corrección</button>
          <button onclick="document.querySelector('[data-modal=editar-gasto]')?.remove()" style="padding:12px 20px;background:#6b7280;color:white;border:none;border-radius:6px;cursor:pointer;">✕ Cancelar</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Preseleccionar la cuenta que se usó originalmente, si sigue existiendo.
    setTimeout(() => {
        const selCuenta = document.getElementById(`editGastoCuentaDebito-${id}`);
        if (selCuenta && g.cuentaDebito && [...selCuenta.options].some(o => o.value === g.cuentaDebito)) {
            selCuenta.value = g.cuentaDebito;
        }
    }, 0);
}

function _escGasto(str) {
    return String(str ?? '').replace(/"/g, '&quot;');
}

function guardarEdicionGasto(id) {
    const gastos = StorageService.get('gastosOperativos', []);
    const idx = gastos.findIndex(x => x.id === id);
    if (idx === -1) return alert('⚠️ Ese gasto ya no existe.');
    const gastoAnterior = { ...gastos[idx] };

    const categoria = document.getElementById(`editGastoCategoria-${id}`)?.value;
    const descripcion = document.getElementById(`editGastoDescripcion-${id}`)?.value.trim();
    const monto = parseFloat(document.getElementById(`editGastoMonto-${id}`)?.value) || 0;
    const fecha = document.getElementById(`editGastoFecha-${id}`)?.value || window.obtenerHoyInputMX();
    const recurrente = document.getElementById(`editGastoRecurrente-${id}`)?.checked || false;
    const periodicidad = document.getElementById(`editGastoPeriodicidad-${id}`)?.value || 'mensual';
    const selCuenta = document.getElementById(`editGastoCuentaDebito-${id}`);
    const cuentaId = selCuenta.value;
    const etiqueta = selCuenta.options[selCuenta.selectedIndex].text;

    if (!descripcion) return alert('⚠️ La descripción es obligatoria.');
    if (monto <= 0) return alert('⚠️ El monto debe ser mayor a 0.');

    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const sinCambios = categoria === gastoAnterior.categoria && descripcion === gastoAnterior.descripcion &&
        monto === Number(gastoAnterior.monto) && fecha === gastoAnterior.fecha && cuentaId === gastoAnterior.cuentaDebito &&
        recurrente === !!gastoAnterior.recurrente && (!recurrente || periodicidad === gastoAnterior.periodicidad);
    if (sinCambios) { alert('No hay cambios que guardar.'); return; }

    const msjConf = `⚠️ CONFIRMAR CORRECCIÓN DE GASTO\n\n` +
        `ANTES:\n${gastoAnterior.categoria} — ${gastoAnterior.descripcion}\n${formatoDinero(gastoAnterior.monto)} de ${gastoAnterior.etiquetaCuenta || gastoAnterior.cuentaDebito}\n\n` +
        `DESPUÉS:\n${categoria} — ${descripcion}\n${formatoDinero(monto)} de ${etiqueta}\n\n` +
        `Se regresará ${formatoDinero(gastoAnterior.monto)} a "${gastoAnterior.etiquetaCuenta || gastoAnterior.cuentaDebito}" y se sacará ${formatoDinero(monto)} de "${etiqueta}". ¿Continuar?`;
    if (!confirm(msjConf)) return;

    if (typeof window._ingresarCuenta !== 'function' || typeof window._egresarCuenta !== 'function') {
        alert("No se pudo corregir el gasto: el módulo de caja no está disponible. Nada se guardó.");
        return;
    }

    // 1) Revertir el egreso original a la cuenta donde salió.
    const idOpBase = `GASTO-${id}-CORR-${Date.now()}`;
    const reversaOk = window._ingresarCuenta({
        monto: gastoAnterior.monto,
        cuentaId: gastoAnterior.cuentaDebito,
        etiqueta: gastoAnterior.etiquetaCuenta || gastoAnterior.cuentaDebito,
        concepto: `Corrección de gasto — reversión: ${gastoAnterior.categoria} — ${gastoAnterior.descripcion}`,
        referencia: `GASTO-${id}`,
        idOperacion: `${idOpBase}-REV`
    });
    if (!reversaOk) {
        alert(`No se pudo regresar el dinero a "${gastoAnterior.etiquetaCuenta || gastoAnterior.cuentaDebito}" (¿ya no existe esa cuenta?). La corrección se canceló, nada se movió.`);
        return;
    }

    // 2) Aplicar el egreso con los datos corregidos.
    const egresoOk = window._egresarCuenta({
        monto: monto,
        cuentaId: cuentaId,
        etiqueta: etiqueta,
        concepto: `Gasto (corregido): ${categoria} — ${descripcion}`,
        referencia: `GASTO-${id}`,
        idOperacion: `${idOpBase}-APL`
    });
    if (!egresoOk) {
        alert(`⚠️ Se regresó el dinero de la corrección anterior, pero NO se pudo sacar de "${etiqueta}" (¿ya no existe esa cuenta?).\n\nEl gasto quedó SIN egreso registrado en caja — revisa manualmente y vuelve a intentar la corrección con una cuenta válida.`);
        // No seguimos: el registro del gasto se deja como estaba para no perder
        // el rastro de que el dinero YA fue devuelto pero no vuelto a sacar.
        return;
    }

    // 3) Actualizar el registro del gasto, guardando historial de la corrección.
    const gastoCorregido = {
        ...gastoAnterior,
        categoria, descripcion, monto, fecha,
        cuentaDebito: cuentaId, etiquetaCuenta: etiqueta,
        recurrente, periodicidad: recurrente ? periodicidad : gastoAnterior.periodicidad
    };
    gastoCorregido.historialCorrecciones = Array.isArray(gastoAnterior.historialCorrecciones) ? [...gastoAnterior.historialCorrecciones] : [];
    gastoCorregido.historialCorrecciones.push({
        fechaCorreccionIso: window.localISO ? window.localISO(new Date()) : new Date().toISOString(),
        anterior: {
            categoria: gastoAnterior.categoria, descripcion: gastoAnterior.descripcion, monto: gastoAnterior.monto,
            fecha: gastoAnterior.fecha, cuentaDebito: gastoAnterior.cuentaDebito, etiquetaCuenta: gastoAnterior.etiquetaCuenta
        }
    });
    gastos[idx] = gastoCorregido;
    StorageService.set('gastosOperativos', gastos);

    // 4) Auditoría: se registra como un acceso/evento nuevo, no se sobreescribe nada.
    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'GASTO_CORREGIDO',
            modulo: 'Gastos',
            entidad: 'gasto',
            entidadId: String(id),
            detalle: `Gasto corregido: "${gastoAnterior.categoria} — ${gastoAnterior.descripcion}" (${formatoDinero(gastoAnterior.monto)} de ${gastoAnterior.etiquetaCuenta || gastoAnterior.cuentaDebito}) → "${categoria} — ${descripcion}" (${formatoDinero(monto)} de ${etiqueta})`,
            monto: monto,
            severidad: 'riesgo',
            datos: { anterior: gastoAnterior, nuevo: gastoCorregido }
        });
    }

    document.querySelector('[data-modal="editar-gasto"]')?.remove();
    alert(`✅ Gasto corregido.\n\nSe regresó ${formatoDinero(gastoAnterior.monto)} a ${gastoAnterior.etiquetaCuenta || gastoAnterior.cuentaDebito} y se sacó ${formatoDinero(monto)} de ${etiqueta}.`);
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
      <td style="padding:8px;text-align:center;white-space:nowrap;">
        <button onclick="abrirEditarGasto(${g.id})" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Corregir">✏️</button>
        <button onclick="eliminarGasto(${g.id})" style="background:none;border:none;cursor:pointer;font-size:16px;" title="Eliminar">🗑️</button>
      </td>
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
    if (typeof requireAdmin !== 'function') { _ejecutarEliminarGasto(id); return; }
    requireAdmin(() => _ejecutarEliminarGasto(id));
}

function _ejecutarEliminarGasto(id) {
    const gastos = StorageService.get('gastosOperativos', []);
    const g = gastos.find(x => x.id === id);
    if (!g) return alert('⚠️ Ese gasto ya no existe.');

    const formatoDinero = (val) => '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2 });
    if (!confirm(`¿Eliminar este gasto?\n\n${g.categoria} — ${g.descripcion}\n${formatoDinero(g.monto)}\n\nSe regresará ese dinero a "${g.etiquetaCuenta || g.cuentaDebito}".`)) return;

    // 🛡️ Igual que la corrección: nunca se borra el gasto sin devolver el
    // dinero a la cuenta de donde salió. Se revierte con un INGRESO nuevo
    // (mismo patrón que guardarEdicionGasto y deshacerUltimoPagoCorteTarjeta),
    // conservando el rastro completo en movimientosCaja.
    if (typeof window._ingresarCuenta !== 'function') {
        alert("No se pudo eliminar el gasto: el módulo de caja no está disponible. Nada se borró.");
        return;
    }
    const reversaOk = window._ingresarCuenta({
        monto: g.monto,
        cuentaId: g.cuentaDebito,
        etiqueta: g.etiquetaCuenta || g.cuentaDebito,
        concepto: `Eliminación de gasto — reversión: ${g.categoria} — ${g.descripcion}`,
        referencia: `GASTO-${id}`,
        idOperacion: `GASTO-${id}-DEL-${Date.now()}`
    });
    if (!reversaOk) {
        alert(`No se pudo regresar el dinero a "${g.etiquetaCuenta || g.cuentaDebito}" (¿ya no existe esa cuenta?). El gasto NO se eliminó.`);
        return;
    }

    const gastosRestantes = gastos.filter(x => x.id !== id);
    StorageService.set('gastosOperativos', gastosRestantes);

    if (window.AuditService?.log) {
        window.AuditService.log({
            accion: 'GASTO_ELIMINADO',
            modulo: 'Gastos',
            entidad: 'gasto',
            entidadId: String(id),
            detalle: `Gasto eliminado: "${g.categoria} — ${g.descripcion}" (${formatoDinero(g.monto)} de ${g.etiquetaCuenta || g.cuentaDebito}), dinero devuelto a caja`,
            monto: g.monto,
            severidad: 'riesgo',
            datos: { gastoEliminado: g }
        });
    }

    alert(`✅ Gasto eliminado. Se regresaron ${formatoDinero(g.monto)} a ${g.etiquetaCuenta || g.cuentaDebito}.`);
    renderGestionGastos();
}

function verificarGastosRecurrentes() {
    const gastos = StorageService.get('gastosOperativos', []);
    const hoy = new Date();
    const recurrentes = gastos.filter(g => g.recurrente);
    if (recurrentes.length === 0) return;
    const hoyStr = window.obtenerHoyInputMX();
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
                fecha: window.localISO(new Date()),
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
window.abrirEditarGasto = abrirEditarGasto;
window.guardarEdicionGasto = guardarEdicionGasto;
window.verificarGastosRecurrentes = verificarGastosRecurrentes;
window.getCategoriasGasto = getCategoriasGasto;
window.abrirGestionCategorias = abrirGestionCategorias;
window._renderModalCategorias = _renderModalCategorias;
window.guardarCategoriaGasto = guardarCategoriaGasto;
window.editarCategoriaGasto = editarCategoriaGasto;
window.eliminarCategoriaGasto = eliminarCategoriaGasto;
