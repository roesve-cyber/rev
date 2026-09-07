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
    _dibujarConfigCarpetaRaiz();
    if (typeof renderPushAutorizacionesConfig === 'function') renderPushAutorizacionesConfig();
}

// 📁 Sección de Configuración para elegir/cambiar/desactivar la carpeta donde
// se guardan los documentos generados (ver js/services/carpeta-raiz.js).
// Se inyecta dinámicamente (en vez de vivir como HTML estático en
// index.html) para no depender de tocar el layout existente de esta
// pantalla -- se ancla justo después del bloque de plazos globales, que
// siempre existe en esta vista.
function _dibujarConfigCarpetaRaiz() {
    const anclaPlazos = document.getElementById('listaPlazosGlobales');
    if (!anclaPlazos) return;
    if (document.getElementById('cfgCarpetaRaizSeccion')) {
        _actualizarEstadoCarpetaRaiz();
        return;
    }
    const contenedorPlazos = anclaPlazos.closest('div') || anclaPlazos.parentElement;
    if (!contenedorPlazos) return;
    contenedorPlazos.insertAdjacentHTML('afterend', `
    <div id="cfgCarpetaRaizSeccion" style="background:white; padding:20px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); margin-top:16px;">
        <h3 style="margin:0 0 8px; color:#0f172a;">📁 Carpeta de Documentos</h3>
        <p style="margin:0 0 12px; color:#6b7280; font-size:13px;">
            Elige una carpeta en esta computadora donde se guarden automáticamente, organizados por tipo,
            los PDF/imágenes que genera el sistema (cotizaciones, comprobantes, cortes de caja, etc.).
            Esta elección es solo para este dispositivo/navegador -- en Chrome/Edge de escritorio.
            No funciona en Android, iPhone/iPad ni Safari/Firefox (es una limitación de esos navegadores,
            no de este sistema); ahí los documentos se siguen descargando normal.
        </p>
        <p id="cfgCarpetaRaizEstado" style="margin:0 0 14px; font-size:13px; font-weight:bold;"></p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" onclick="window.CarpetaRaizService && window.CarpetaRaizService.configurarManualmente().then(_actualizarEstadoCarpetaRaiz)" style="padding:10px 16px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Elegir / cambiar carpeta</button>
            <button type="button" onclick="window.CarpetaRaizService && window.CarpetaRaizService.desactivar().then(_actualizarEstadoCarpetaRaiz)" style="padding:10px 16px; background:#f1f5f9; color:#475569; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">Desactivar (volver a Descargas)</button>
        </div>
    </div>`);
    _actualizarEstadoCarpetaRaiz();
}

function _actualizarEstadoCarpetaRaiz() {
    const estado = document.getElementById('cfgCarpetaRaizEstado');
    if (!estado || !window.CarpetaRaizService) return;
    if (!window.CarpetaRaizService.soportado()) {
        estado.textContent = 'Este navegador/dispositivo no soporta esta función -- los documentos se descargan normal.';
        estado.style.color = '#9ca3af';
    } else if (window.CarpetaRaizService.estaActiva()) {
        estado.textContent = '✅ Activa -- tus documentos se están guardando en la carpeta elegida.';
        estado.style.color = '#16a34a';
    } else {
        estado.textContent = 'Sin configurar -- se te preguntará la primera vez que generes un documento, o puedes elegirla aquí.';
        estado.style.color = '#b45309';
    }
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
        // 🛡️ CORREGIDO: antes mostraba "cupón: tasa-tasaBaseCupon=X%", la resta
        // de puntos que Roberto mismo determinó que no refleja el cupón real
        // (el cupón real corre la fórmula de venta dos veces y saca la
        // diferencia en PESOS, no en puntos -- ver _cxcCalcularCuponPronto en
        // cxc.js). Esta etiqueta solo confirma que el plazo tiene tasa base
        // propia; el monto real depende del capital y se ve en cotización/venta.
        const tieneBase = p.tasaBaseCupon !== undefined && p.tasaBaseCupon !== null && p.tasaBaseCupon !== '';
        const etiquetaCupon = tieneBase
            ? ` &middot; cupón: tasa base ${p.tasaBaseCupon}%`
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
    const tasaBaseInput = document.getElementById('cfgTasaBaseCuponPlazo').value;
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
    document.getElementById('cfgTasaBaseCuponPlazo').value = '';
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
// Crédito); si la tiene, el cupón de ESE plazo se calcula corriendo la
// fórmula de venta DOS VECES sobre el mismo capital y meses -- una con la
// tasa normal, otra con la tasa base -- y el cupón es la diferencia en
// pesos entre esos dos totales (ver _cxcCalcularCuponPronto en cxc.js). El %
// FIJO configurado aquí (porcentajeCuponProntoPago) sigue existiendo como
// valor por defecto para cualquier plazo que NO tenga tasaBaseCupon
// definida -- así nada se rompe si se agrega un plazo nuevo sin configurar
// su tasa base. El mes 1 (contado) nunca genera cupón, eso no cambia. El
// redondeo (redondeoCuponMultiplo/redondeoCuponDireccion) lo aplica
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
