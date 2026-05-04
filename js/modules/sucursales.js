// ===== MÓDULO DE SUCURSALES =====
// Gestión de puntos de venta / sucursales para el sistema POS

let sucursales = StorageService.get('sucursales', []);

// ── Sucursal por defecto ──────────────────────────────────────────────────────
const SUCURSAL_DEFECTO = {
    id: 'SUC-PRINCIPAL',
    nombre: 'Casa Matriz',
    direccion: '',
    telefono: '',
    gerente: '',
    activa: true
};

function inicializarSucursalDefecto() {
    if (!sucursales || sucursales.length === 0) {
        sucursales = [{ ...SUCURSAL_DEFECTO }];
        StorageService.set('sucursales', sucursales);
    }
    return sucursales;
}

function obtenerSucursales() {
    sucursales = StorageService.get('sucursales', []);
    if (!sucursales || sucursales.length === 0) {
        inicializarSucursalDefecto();
    }
    return sucursales;
}

function obtenerSucursalPorId(id) {
    const lista = obtenerSucursales();
    return lista.find(s => s.id === id) || null;
}

function obtenerSucursalDefecto() {
    const lista = obtenerSucursales();
    return lista[0] || SUCURSAL_DEFECTO;
}

// ── CRUD ──────────────────────────────────────────────────────────────────────
function guardarSucursal() {
    const nombre    = document.getElementById('sucNombre')?.value.trim();
    const direccion = document.getElementById('sucDireccion')?.value.trim() || '';
    const telefono  = document.getElementById('sucTelefono')?.value.trim() || '';
    const gerente   = document.getElementById('sucGerente')?.value.trim() || '';
    const editId    = document.getElementById('sucEditId')?.value || null;

    if (!nombre) return alert('⚠️ El nombre de la sucursal es obligatorio.');

    sucursales = obtenerSucursales();

    if (editId) {
        const idx = sucursales.findIndex(s => s.id === editId);
        if (idx !== -1) {
            sucursales[idx] = { ...sucursales[idx], nombre, direccion, telefono, gerente };
        }
    } else {
        const nuevoId = 'SUC-' + Date.now();
        sucursales.push({ id: nuevoId, nombre, direccion, telefono, gerente, activa: true });
    }

    StorageService.set('sucursales', sucursales);
    limpiarFormularioSucursal();
    renderSucursales();
    alert(editId ? '✅ Sucursal actualizada.' : '✅ Sucursal registrada.');
}

function editarSucursal(id) {
    const lista = obtenerSucursales();
    const s = lista.find(x => x.id === id);
    if (!s) return;

    const el = (elId) => document.getElementById(elId);
    if (el('sucNombre'))    el('sucNombre').value    = s.nombre;
    if (el('sucDireccion')) el('sucDireccion').value = s.direccion || '';
    if (el('sucTelefono'))  el('sucTelefono').value  = s.telefono  || '';
    if (el('sucGerente'))   el('sucGerente').value   = s.gerente   || '';
    if (el('sucEditId'))    el('sucEditId').value    = s.id;

    const btnGuardar = el('btnGuardarSucursal');
    if (btnGuardar) btnGuardar.textContent = '💾 Actualizar Sucursal';

    el('sucNombre')?.focus();
}

function eliminarSucursal(id) {
    const lista = obtenerSucursales();
    if (lista.length === 1) {
        return alert('⚠️ Debe existir al menos una sucursal.');
    }
    if (!confirm('¿Eliminar esta sucursal? Los datos de inventario asociados no se eliminarán.')) return;
    sucursales = lista.filter(s => s.id !== id);
    StorageService.set('sucursales', sucursales);
    renderSucursales();
}

function limpiarFormularioSucursal() {
    ['sucNombre','sucDireccion','sucTelefono','sucGerente'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const editId = document.getElementById('sucEditId');
    if (editId) editId.value = '';
    const btnGuardar = document.getElementById('btnGuardarSucursal');
    if (btnGuardar) btnGuardar.textContent = '➕ Agregar Sucursal';
}

function renderSucursales() {
    const cont = document.getElementById('tablaSucursales');
    if (!cont) return;
    const lista = obtenerSucursales();

    if (lista.length === 0) {
        cont.innerHTML = "<p style='color:gray;padding:20px;'>No hay sucursales registradas.</p>";
        return;
    }

    let html = `<table class="tabla-admin">
        <thead><tr>
            <th>Sucursal</th>
            <th>Dirección</th>
            <th>Teléfono</th>
            <th>Gerente</th>
            <th style="text-align:center;">Acciones</th>
        </tr></thead>
        <tbody>`;

    lista.forEach(s => {
        html += `<tr>
            <td><b>${s.nombre}</b>${s.id === 'SUC-PRINCIPAL' ? ' <span style="font-size:11px;color:#16a34a;">(Principal)</span>' : ''}</td>
            <td>${s.direccion || '—'}</td>
            <td>${s.telefono  || '—'}</td>
            <td>${s.gerente   || '—'}</td>
            <td style="text-align:center;">
                <button onclick="editarSucursal('${s.id}')" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Editar">✏️</button>
                ${s.id !== 'SUC-PRINCIPAL' ? `<button onclick="eliminarSucursal('${s.id}')" style="background:none;border:none;cursor:pointer;font-size:17px;" title="Eliminar">🗑️</button>` : ''}
            </td>
        </tr>`;
    });

    cont.innerHTML = html + '</tbody></table>';
}

// ── Selector reutilizable ─────────────────────────────────────────────────────
/**
 * Genera un <select> con las sucursales disponibles.
 * @param {string} idSelect - ID del select
 * @param {string} valorSeleccionado - ID de la sucursal a pre-seleccionar
 * @param {boolean} incluyeTodos - Si se agrega opción "Todas las sucursales"
 */
function buildSelectorSucursales(idSelect, valorSeleccionado = '', incluyeTodos = false) {
    const lista = obtenerSucursales();
    const opts = (incluyeTodos ? `<option value="">🏢 Todas las sucursales</option>` : '') +
        lista.map(s =>
            `<option value="${s.id}" ${s.id === valorSeleccionado ? 'selected' : ''}>${s.nombre}</option>`
        ).join('');
    return `<select id="${idSelect}" style="width:100%;padding:9px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;">${opts}</select>`;
}

// ── Migración ─────────────────────────────────────────────────────────────────
/**
 * Migración automática: asegura que la sucursal por defecto exista
 * y que el stock de productos tenga al menos la entrada de la sucursal principal.
 */
function migrarSucursales() {
    // 1. Asegurar que exista la sucursal por defecto
    inicializarSucursalDefecto();

    // 2. Asegurar que cada producto tenga stockPorSucursal inicializado
    try {
        const prods = StorageService.get('productos', []);
        let modificado = false;
        prods.forEach(p => {
            if (!p.stockPorSucursal) {
                const sucDef = obtenerSucursalDefecto();
                // Construir entrada con variantes existentes si las hay
                if (p.variantes && p.variantes.length > 0) {
                    p.stockPorSucursal = {
                        [sucDef.id]: p.variantes.map(v => ({
                            color: v.color || p.color || 'Sin color',
                            ubicacion: v.ubicacion || 'Almacén',
                            stock: v.stock || 0
                        }))
                    };
                } else {
                    p.stockPorSucursal = {
                        [sucDef.id]: [{
                            color: p.color || 'Sin color',
                            ubicacion: 'Almacén',
                            stock: p.stock || 0
                        }]
                    };
                }
                modificado = true;
            }
        });
        if (modificado) {
            StorageService.set('productos', prods);
            if (typeof window !== 'undefined') window.productos = prods;
        }
    } catch (e) {
        console.warn('⚠️ Error en migración de sucursales:', e.message);
    }
}

// ── Exposición global ─────────────────────────────────────────────────────────
window.obtenerSucursales       = obtenerSucursales;
window.obtenerSucursalPorId    = obtenerSucursalPorId;
window.obtenerSucursalDefecto  = obtenerSucursalDefecto;
window.guardarSucursal         = guardarSucursal;
window.editarSucursal          = editarSucursal;
window.eliminarSucursal        = eliminarSucursal;
window.renderSucursales        = renderSucursales;
window.buildSelectorSucursales = buildSelectorSucursales;
window.migrarSucursales        = migrarSucursales;
window.limpiarFormularioSucursal = limpiarFormularioSucursal;
