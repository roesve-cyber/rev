// ===== SELECTOR UNIVERSAL DE CLIENTES =====
window.abrirSelectorCliente = function(opciones) {
    const {
        titulo = "👤 Seleccionar Cliente",
        onSeleccion = () => {}
    } = opciones || {};

    // Eliminar si ya existe uno abierto
    document.querySelector('[data-modal="universal-client-picker"]')?.remove();

    const clientesLista = StorageService.get("clientes", []);

    const html = `
    <div data-modal="universal-client-picker" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:10001;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);">
        <div style="background:white;border-radius:15px;width:100%;max-width:500px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 25px -5px rgba(0,0,0,0.2);">

            <div style="padding:20px;border-bottom:1px solid #eee;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#1e40af;">${titulo}</h3>
                <button onclick="this.closest('[data-modal]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#6b7280;">✕</button>
            </div>

            <div style="padding:12px 20px;border-bottom:1px solid #eee;">
                <input type="text" id="clientePickerBuscar"
                       placeholder="🔍 Buscar por nombre o teléfono..."
                       oninput="window._filtrarClientesPicker(this.value)"
                       style="width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;">
            </div>

            <div id="clientePickerContenido" style="padding:16px;overflow-y:auto;flex:1;"></div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', html);

    window._clientesPickerData = clientesLista;
    window._clientesPickerCb   = onSeleccion;
    window._filtrarClientesPicker('');

    setTimeout(() => document.getElementById('clientePickerBuscar')?.focus(), 60);
};

window._filtrarClientesPicker = function(texto) {
    const cont = document.getElementById('clientePickerContenido');
    if (!cont) return;
    const clientesLista = window._clientesPickerData || [];
    const q = (texto || '').toLowerCase().trim();

    const filtrados = q
        ? clientesLista.filter(c =>
            (c.nombre   || '').toLowerCase().includes(q) ||
            (c.telefono || '').includes(q))
        : clientesLista;

    if (filtrados.length === 0) {
        cont.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:20px;">Sin resultados.</p>';
        return;
    }

    cont.innerHTML = '';
    filtrados.forEach(c => {
        const div = document.createElement('div');
        div.style.cssText = "display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:8px;cursor:pointer;background:white;transition:background 0.15s;";
        div.onmouseover = () => { div.style.background = '#eff6ff'; div.style.borderColor = '#93c5fd'; };
        div.onmouseout  = () => { div.style.background = 'white';   div.style.borderColor = '#e5e7eb'; };
        div.onclick = () => {
            window._clientesPickerCb(c);
            document.querySelector('[data-modal="universal-client-picker"]')?.remove();
        };
        div.innerHTML = `
            <div style="width:40px;height:40px;background:#dbeafe;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0;">👤</div>
            <div style="flex:1;min-width:0;">
                <div style="font-weight:bold;font-size:14px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${c.nombre || '—'}</div>
                ${c.telefono ? `<div style="font-size:12px;color:#6b7280;margin-top:1px;">📞 ${c.telefono}</div>` : ''}
                ${c.direccion ? `<div style="font-size:12px;color:#9ca3af;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📍 ${c.direccion}</div>` : ''}
            </div>
        `;
        cont.appendChild(div);
    });
};
