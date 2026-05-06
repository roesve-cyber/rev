// CRUD de ubicaciones (sucursales/almacenes) para REV POS.
// Cada ubicación tiene: id, nombre, dirección, urlGoogleMaps, qrData (URL para QR).
// Almacena datos en localStorage bajo la clave 'ubicaciones'.
// El QR se genera a partir de la URL de Google Maps.

/**
 * Devuelve el listado de ubicaciones.
 * @returns {Array} arreglo de ubicaciones
 */
function obtenerUbicaciones() {
    return StorageService.get('ubicaciones', []);
}

/**
 * Guarda un listado de ubicaciones en localStorage.
 * @param {Array} lista 
 */
function guardarUbicaciones(lista) {
    StorageService.set('ubicaciones', lista);
}

/**
 * Agrega o edita una ubicación. Si trae id, edita; si no, agrega.
 * @param {Object} ubicacion 
 */
function upsertUbicacion(ubicacion) {
    const lista = obtenerUbicaciones();
    if (ubicacion.id) {
        // Editar
        const idx = lista.findIndex(u => u.id === ubicacion.id);
        if (idx !== -1) {
            lista[idx] = {...ubicacion};
        }
    } else {
        // Nuevo
        ubicacion.id = Date.now().toString(36) + Math.random().toString(36).substr(2,8);
        lista.push(ubicacion);
    }
    guardarUbicaciones(lista);
}

/**
 * Elimina ubicación por id.
 * @param {string} id 
 */
function eliminarUbicacion(id) {
    let lista = obtenerUbicaciones();
    lista = lista.filter(u => u.id !== id);
    guardarUbicaciones(lista);
}

/**
 * Genera el contenido HTML del listado de ubicaciones con opciones de editar y eliminar.
 */
function renderUbicaciones() {
    const cont = document.getElementById('contenedorUbicaciones');
    if (!cont) return;
    const ubicaciones = obtenerUbicaciones();
    let html = `
        <h2 style="color:#1e40af;">&#128205; Sucursales / Almacenes</h2>
        <button onclick="mostrarFormUbicacion()" class="btn-primario" style="margin-bottom:18px;">
            + Nueva ubicación
        </button>
        <div style="overflow-x:auto;">
        <table class="tabla-admin">
            <thead>
                <tr>
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Mapa</th>
                    <th>QR</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${ubicaciones.map(u => `
                    <tr>
                        <td>${u.nombre}</td>
                        <td>${u.direccion}</td>
                        <td>
                            <a href="${u.urlGoogleMaps}" target="_blank">Ver mapa</a>
                        </td>
                        <td>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=60x60&data=${encodeURIComponent(u.urlGoogleMaps||'')}" alt="QR" title="QR" style="width:60px;height:60px;">
                        </td>
                        <td>
                            <button onclick="mostrarFormUbicacion('${u.id}')" class="btn-secundario">Editar</button>
                            <button onclick="if(confirm('¿Eliminar esta ubicación?')){eliminarUbicacion('${u.id}');renderUbicaciones();}" class="btn-rojo">Eliminar</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        </div>
        <div id="formUbicacionModal" class="modal oculto" style="display:none;">
            <div class="modal-content" style="max-width:470px;">
                <div id="formUbicacionContenido"></div>
            </div>
        </div>
    `;
    cont.innerHTML = html;
}

/**
 * Muestra el formulario para nueva o edición de ubicación.
 * @param {string} [id]
 */
function mostrarFormUbicacion(id) {
    const modal = document.getElementById('formUbicacionModal');
    if (!modal) return;
    let u = {nombre:'', direccion:'', urlGoogleMaps:''};
    if (id) {
        const ubic = obtenerUbicaciones().find(x=>x.id===id);
        if (ubic) u = {...ubic};
    }
    let html = `
        <h3 style="color:#1e40af;">${id ? "Editar" : "Nueva"} Ubicación</h3>
        <div class="campo">
            <label>Nombre</label>
            <input id="ubiNombre" value="${u.nombre||''}" style="width:100%;"/>
        </div>
        <div class="campo">
            <label>Dirección</label>
            <input id="ubiDireccion" value="${u.direccion||''}" style="width:100%;"/>
        </div>
        <div class="campo">
            <label>Enlace Google Maps</label>
            <input id="ubiMaps" value="${u.urlGoogleMaps||''}" style="width:100%;" placeholder="https://maps.google.com/..."/>
        </div>
        <div style="margin-top:18px; display:flex; gap:10px;">
            <button class="btn-primario" onclick="guardarFormUbicacion('${id||''}')">${id? 'Guardar' : 'Crear'}</button>
            <button class="btn-secundario" onclick="cerrarFormUbicacion()">Cancelar</button>
        </div>
    `;
    document.getElementById('formUbicacionContenido').innerHTML = html;
    modal.style.display = "flex";
    modal.classList.remove('oculto');
}
/**
 * Oculta el modal de formulario de ubicación.
 */
function cerrarFormUbicacion() {
    const modal = document.getElementById('formUbicacionModal');
    if (modal) {
        modal.style.display = "none";
        modal.classList.add('oculto');
    }
}

/**
 * Guarda los datos del formulario (alta o edición).
 */
function guardarFormUbicacion(id) {
    const nombre = document.getElementById('ubiNombre').value.trim();
    const direccion = document.getElementById('ubiDireccion').value.trim();
    const urlGoogleMaps = document.getElementById('ubiMaps').value.trim();
    if (!nombre || !direccion || !urlGoogleMaps) {
        alert("Completa todos los campos.");
        return;
    }
    upsertUbicacion({
        id: id||undefined,
        nombre,
        direccion,
        urlGoogleMaps
    });
    cerrarFormUbicacion();
    renderUbicaciones();
}

// Incluir esto en tu archivo de inicio/menú/configuración para exponer esta funcionalidad.