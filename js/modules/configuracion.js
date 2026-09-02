// ===== MÓDULO DE CONFIGURACIÓN Y REGLAS DE CRÉDITO =====

// 1. Lógica Global
function renderConfiguracion() {
    let config = StorageService.get('configCreditoGlobal', null);
    
    // Si nunca se ha configurado, construimos el "default histórico" para que se vea
    if (!config || !config.plazos || config.plazos.length === 0) {
        config = {
            plazos: [
                { meses: 1, tasa: 2 }, { meses: 2, tasa: 2 }, { meses: 3, tasa: 2 },
                { meses: 4, tasa: 2.5 }, { meses: 5, tasa: 2.5 }, { meses: 6, tasa: 2.5 }
            ]
        };
        StorageService.set('configCreditoGlobal', config);
    }
    
    _dibujarPlazosGlobales(config.plazos);
    renderConfigCupon();
    if (typeof renderPushAutorizacionesConfig === 'function') renderPushAutorizacionesConfig();
}

function _dibujarPlazosGlobales(plazos) {
    const cont = document.getElementById('listaPlazosGlobales');
    if (!cont) return;

    if (plazos.length === 0) {
        cont.innerHTML = '<span style="color:#9ca3af; font-size:13px; padding:5px;">Sin plazos configurados (Solo contado)</span>';
        return;
    }

    // Ordenamos de menor a mayor plazo
    plazos.sort((a,b) => a.meses - b.meses);

    cont.innerHTML = plazos.map((p, i) => {
        const tieneBase = p.tasaBaseCupon !== undefined && p.tasaBaseCupon !== null && p.tasaBaseCupon !== '';
        const cuponDif = tieneBase ? Math.max(0, Number(p.tasa || 0) - Number(p.tasaBaseCupon || 0)) : null;
        const etiquetaCupon = tieneBase
            ? ` &middot; cupón: ${p.tasa}-${p.tasaBaseCupon}=${cuponDif}%`
            : '';
        return `
        <div style="background:#dbeafe; color:#1e40af; padding:8px 14px; border-radius:20px; font-size:13px; font-weight:bold; display:flex; align-items:center; gap:8px; border:1px solid #bfdbfe; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            📅 ${p.meses} meses al ${p.tasa}%${etiquetaCupon}
            <button type="button" onclick="eliminarPlazoGlobal(${i})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:15px; margin-left:4px; padding:0;">✕</button>
        </div>
    `;
    }).join('');
}

function agregarPlazoGlobal() {
    const meses = parseInt(document.getElementById('cfgMesesGlobal').value);
    const tasa = parseFloat(document.getElementById('cfgTasaGlobal').value);
    const tasaBaseInput = document.getElementById('cfgTasaBaseGlobal').value;
    const tasaBaseCupon = tasaBaseInput === '' ? null : parseFloat(tasaBaseInput);

    if (isNaN(meses) || meses <= 0 || isNaN(tasa) || tasa < 0) {
        return alert("⚠️ Ingresa un plazo en meses y una tasa válida.");
    }
    if (tasaBaseCupon !== null && (isNaN(tasaBaseCupon) || tasaBaseCupon < 0)) {
        return alert("⚠️ La tasa base para cupón debe ser un número válido (o déjala vacía).");
    }

    let config = StorageService.get('configCreditoGlobal', { plazos: [] });
    
    // Evitar plazos duplicados
    const existe = config.plazos.findIndex(p => p.meses === meses);
    if (existe !== -1) {
        config.plazos[existe].tasa = tasa; // Actualiza la tasa si ya existía el mes
        config.plazos[existe].tasaBaseCupon = tasaBaseCupon; // null = usa el % fijo de cupón
    } else {
        config.plazos.push({ meses, tasa, tasaBaseCupon });
    }

    StorageService.set('configCreditoGlobal', config);
    
    document.getElementById('cfgMesesGlobal').value = '';
    document.getElementById('cfgTasaGlobal').value = '';
    document.getElementById('cfgTasaBaseGlobal').value = '';
    renderConfiguracion();
    alert("✅ Regla global actualizada. Aplicará inmediatamente al carrito, catálogo y cupones de pronto pago.");
}

function eliminarPlazoGlobal(index) {
    if (!confirm('¿Eliminar este plazo de crédito de la tienda?')) return;
    let config = StorageService.get('configCreditoGlobal', { plazos: [] });
    config.plazos.splice(index, 1);
    StorageService.set('configCreditoGlobal', config);
    renderConfiguracion();
}

// 🎟️ % del TOTAL FINANCIADO que se emite como cupón cuando un cliente
// liquida dentro de su plazo pactado. Desde sep 2026 (decisión de Roberto)
// cada plazo puede tener su propia "tasa base para cupón" (campo
// tasaBaseCupon en config.plazos, editado arriba en Regla Global de
// Crédito); si la tiene, el % de cupón de ESE plazo es tasa - tasaBaseCupon
// (así los plazos con tasa más alta pueden dar más cupón) y lo calcula
// _cxcPorcentajeCuponPorPlazo(mesesPlan) en cxc.js. El % FIJO configurado
// aquí (porcentajeCuponProntoPago) sigue existiendo como valor por defecto
// para cualquier plazo que NO tenga tasaBaseCupon definida -- así nada se
// rompe si se agrega un plazo nuevo sin configurar su tasa base. El mes 1
// (contado) nunca genera cupón, eso no cambia. El redondeo
// (redondeoCuponMultiplo/redondeoCuponDireccion) lo aplica
// _cxcRedondearMontoCupon en cxc.js justo después de calcular el %.
function renderConfigCupon() {
    const config = StorageService.get('configCreditoGlobal', {});
    const porcentaje = config.porcentajeCuponProntoPago ?? 3;
    const input = document.getElementById('cfgPorcentajeCupon');
    if (input) input.value = porcentaje;
    const actual = document.getElementById('cfgPorcentajeCuponActual');
    if (actual) actual.textContent = `Valor actual: ${porcentaje}% por defecto (solo para plazos SIN tasa base propia). Los plazos con tasa base definida arriba usan tasa - tasa base.`;

    const multiplo = config.redondeoCuponMultiplo || '';
    const direccion = config.redondeoCuponDireccion || 'abajo';
    const inputMultiplo = document.getElementById('cfgRedondeoCuponMultiplo');
    if (inputMultiplo) inputMultiplo.value = multiplo;
    const selectDireccion = document.getElementById('cfgRedondeoCuponDireccion');
    if (selectDireccion) selectDireccion.value = direccion;
    const actualRedondeo = document.getElementById('cfgRedondeoCuponActual');
    if (actualRedondeo) {
        actualRedondeo.textContent = (Number(multiplo) > 1)
            ? `Valor actual: redondea a cifras de ${multiplo}, hacia ${direccion === 'arriba' ? 'arriba' : 'abajo'}.`
            : `Valor actual: sin redondeo -- se emite el monto exacto calculado.`;
    }
}

function guardarConfigCupon() {
    const porcentaje = parseFloat(document.getElementById('cfgPorcentajeCupon').value);
    if (isNaN(porcentaje) || porcentaje < 0 || porcentaje > 100) {
        return alert("⚠️ Ingresa un porcentaje entre 0 y 100.");
    }
    const multiploInput = document.getElementById('cfgRedondeoCuponMultiplo').value;
    const multiplo = multiploInput === '' ? 0 : parseFloat(multiploInput);
    if (isNaN(multiplo) || multiplo < 0) {
        return alert("⚠️ El redondeo debe ser un número de 0 en adelante (0 o vacío = sin redondeo).");
    }
    const direccion = document.getElementById('cfgRedondeoCuponDireccion').value;

    let config = StorageService.get('configCreditoGlobal', { plazos: [] });
    config.porcentajeCuponProntoPago = porcentaje;
    config.redondeoCuponMultiplo = multiplo;
    config.redondeoCuponDireccion = direccion;
    StorageService.set('configCreditoGlobal', config);
    renderConfigCupon();
    alert(`✅ Se guardó ${porcentaje}%${multiplo > 1 ? `, redondeando a cifras de ${multiplo} hacia ${direccion}` : ' sin redondeo'}. Aplica a partir de la próxima liquidación dentro de plazo -- no afecta cupones ya emitidos.`);
}


// 2. Lógica Específica del Producto
window._plazosProductoTemp = [];

function toggleConfigCreditoProd() {
    const usaGlobal = document.getElementById('pUsaReglaGlobal')?.checked;
    const panelCustom = document.getElementById('pConfigCreditoExtra');
    if (panelCustom) {
        panelCustom.style.display = usaGlobal ? 'none' : 'block';
    }
}

function _dibujarPlazosProd() {
    const cont = document.getElementById('listaPlazosProd');
    if (!cont) return;

    if (window._plazosProductoTemp.length === 0) {
        cont.innerHTML = '<span style="color:#d97706; font-size:12px; font-style:italic;">Usará los plazos de la tienda, pero respetando si permites crédito o no.</span>';
        return;
    }

    window._plazosProductoTemp.sort((a,b) => a.meses - b.meses);

    cont.innerHTML = window._plazosProductoTemp.map((p, i) => `
        <div style="background:#fef3c7; color:#92400e; padding:6px 12px; border-radius:20px; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:6px; border:1px solid #fcd34d;">
            ${p.meses}m al ${p.tasa}%
            <button type="button" onclick="eliminarPlazoProd(${i})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:14px; margin-left:4px;">✕</button>
        </div>
    `).join('');
}

function agregarPlazoProd() {
    const meses = parseInt(document.getElementById('pPlazoProd').value);
    const tasa = parseFloat(document.getElementById('pTasaProd').value);

    if (isNaN(meses) || meses <= 0 || isNaN(tasa) || tasa < 0) return alert("⚠️ Datos inválidos.");

    const existe = window._plazosProductoTemp.findIndex(p => p.meses === meses);
    if (existe !== -1) window._plazosProductoTemp[existe].tasa = tasa;
    else window._plazosProductoTemp.push({ meses, tasa });

    document.getElementById('pPlazoProd').value = '';
    document.getElementById('pTasaProd').value = '';
    _dibujarPlazosProd();
}

function eliminarPlazoProd(index) {
    window._plazosProductoTemp.splice(index, 1);
    _dibujarPlazosProd();
}
// Nota: exportarBackupJSON e importarBackupJSON se definen en
// js/services/onedrive-backup.js (fuente única de verdad).
// TABLAS_SISTEMA también está disponible allí como window.TABLAS_SISTEMA.

// Exponer globalmente
window.renderConfiguracion = renderConfiguracion;
window.agregarPlazoGlobal = agregarPlazoGlobal;
window.eliminarPlazoGlobal = eliminarPlazoGlobal;
window.toggleConfigCreditoProd = toggleConfigCreditoProd;
window.agregarPlazoProd = agregarPlazoProd;
window.eliminarPlazoProd = eliminarPlazoProd;
window.renderConfigCupon = renderConfigCupon;
window.guardarConfigCupon = guardarConfigCupon;
