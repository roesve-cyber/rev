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

    cont.innerHTML = plazos.map((p, i) => `
        <div style="background:#dbeafe; color:#1e40af; padding:8px 14px; border-radius:20px; font-size:13px; font-weight:bold; display:flex; align-items:center; gap:8px; border:1px solid #bfdbfe; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
            📅 ${p.meses} meses al ${p.tasa}%
            <button type="button" onclick="eliminarPlazoGlobal(${i})" style="background:none; border:none; color:#dc2626; cursor:pointer; font-size:15px; margin-left:4px; padding:0;">✕</button>
        </div>
    `).join('');
}

function agregarPlazoGlobal() {
    const meses = parseInt(document.getElementById('cfgMesesGlobal').value);
    const tasa = parseFloat(document.getElementById('cfgTasaGlobal').value);

    if (isNaN(meses) || meses <= 0 || isNaN(tasa) || tasa < 0) {
        return alert("⚠️ Ingresa un plazo en meses y una tasa válida.");
    }

    let config = StorageService.get('configCreditoGlobal', { plazos: [] });
    
    // Evitar plazos duplicados
    const existe = config.plazos.findIndex(p => p.meses === meses);
    if (existe !== -1) {
        config.plazos[existe].tasa = tasa; // Actualiza la tasa si ya existía el mes
    } else {
        config.plazos.push({ meses, tasa });
    }

    StorageService.set('configCreditoGlobal', config);
    
    document.getElementById('cfgMesesGlobal').value = '';
    document.getElementById('cfgTasaGlobal').value = '';
    renderConfiguracion();
    alert("✅ Regla global actualizada. Aplicará inmediatamente al carrito y catálogo.");
}

function eliminarPlazoGlobal(index) {
    if (!confirm('¿Eliminar este plazo de crédito de la tienda?')) return;
    let config = StorageService.get('configCreditoGlobal', { plazos: [] });
    config.plazos.splice(index, 1);
    StorageService.set('configCreditoGlobal', config);
    renderConfiguracion();
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
// =========================================================
// MÓDULO: EXPORTAR / IMPORTAR BACKUP JSON (ACTUALIZADO)
// =========================================================

window.exportarBackupJSON = function() {
    try {
        // 1. Definimos las tablas clave del sistema
        const tablas = [
            "productos", "clientes", "categoriasData", "tarjetasConfig", 
            "cuentasPorCobrar", "pagaresSistema", "proveedores", 
            "movimientosInventario", "recepciones", "compras", 
            "cuentasPorPagar", "deudasMSI", "movimientosCaja", "ubicacionesConfig"
        ];
        
        let backupData = {};
        
        // 2. Extraemos la información de la memoria blindada
        for (let tabla of tablas) {
            backupData[tabla] = StorageService.get(tabla, []);
        }

        // 3. Empaquetamos todo en un archivo .json
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
        const anchor = document.createElement('a');
        const fecha = new Date().toISOString().split('T')[0];
        
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", `Backup_MiPueblito_${fecha}.json`);
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);

        console.log("✅ Backup exportado con éxito.");
    } catch (error) {
        console.error("❌ Error al exportar:", error);
        alert("Ocurrió un error al exportar el archivo.");
    }
};

window.importarBackupJSON = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            const tablas = Object.keys(data);
            
            if (!confirm(`⚠️ ATENCIÓN: Vas a importar un archivo con ${tablas.length} tablas de datos.\n\nEsto reemplazará la información actual en tu memoria local y se sincronizará con la nube.\n\n¿Estás completamente seguro?`)) {
                event.target.value = ''; // Limpiar el input si cancela
                return;
            }

            // Inyectamos tabla por tabla en el sistema usando el canal oficial
            let importadas = 0;
            for (let tabla of tablas) {
                // El .set() se encarga de guardar en RAM, en LocalForage y enviarlo a Firebase
                StorageService.set(tabla, data[tabla]);
                importadas++;
            }

            alert(`✅ ¡Éxito! Se restauraron ${importadas} tablas de datos.\n\nEl sistema se recargará para aplicar todos los cambios visuales.`);
            
            // Recargamos la pestaña para que las variables globales y tablas se dibujen con lo nuevo
            window.location.reload();

        } catch (error) {
            console.error("❌ Error leyendo el JSON:", error);
            alert("El archivo que seleccionaste está corrupto o no es un formato válido del sistema.");
        }
    };
    
    reader.readAsText(file);
};

// Exponer globalmente
window.renderConfiguracion = renderConfiguracion;
window.agregarPlazoGlobal = agregarPlazoGlobal;
window.eliminarPlazoGlobal = eliminarPlazoGlobal;
window.toggleConfigCreditoProd = toggleConfigCreditoProd;
window.agregarPlazoProd = agregarPlazoProd;
window.eliminarPlazoProd = eliminarPlazoProd;