// ===== PROVEEDORES =====
function guardarProveedor() {
    const nombreInput   = document.getElementById("provNombre");
    const contactoInput = document.getElementById("provContacto");
    const nombre   = nombreInput.value.trim();
    const contacto = contactoInput.value.trim();

    if (!nombre) return alert("⚠️ El nombre del proveedor es obligatorio.");

    proveedores.push({ id: Date.now(), nombre, contacto, saldoDeuda: 0 });
    if (!StorageService.set("proveedores", proveedores)) {
        alert("❌ Error guardando proveedor");
        return;
    }

    nombreInput.value   = "";
    contactoInput.value = "";
    renderProveedores();
}

function renderProveedores() {
    const cont = document.getElementById("tablaProveedores");
    if (!cont) return;

    if (proveedores.length === 0) {
        cont.innerHTML = "<p style='color:gray; padding:20px;'>No hay proveedores registrados.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    proveedores.forEach(p => {
        html += `
            <tr>
                <td><b>${p.nombre}</b></td>
                <td>${p.contacto || '-'}</td>
                <td style="text-align:center;">
                    <button onclick="eliminarProveedor(${p.id})" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
                </td>
            </tr>`;
    });
    cont.innerHTML = html + "</tbody></table>";
}

function eliminarProveedor(id) {
    if (confirm("¿Estás seguro de eliminar este proveedor?")) {
        proveedores = proveedores.filter(p => p.id !== id);
        if (!StorageService.set("proveedores", proveedores)) {
            console.error("❌ Error eliminando proveedor");
            return;
        }
        renderProveedores();
    }
}

window.guardarProveedor = guardarProveedor;
window.renderProveedores = renderProveedores;
window.eliminarProveedor = eliminarProveedor;
