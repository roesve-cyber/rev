// ===== MÓDULO EXCLUSIVO DE CONCILIACIÓN MSI POR FECHA DE CORTE =====

// 1. Diccionario de respaldo (Restaurado de tu versión original)
const CONFIG_CORTES = {
    "MERCADOPAGO": 5,
    "BANAMEX SIMPLI": 19,
    "SANTANDER LIKEU": 10,
    "HSBC": 10,
    "DEFAULT": 15
};

function renderConciliacionMSI() {
    const cont = document.getElementById('contenedorConciliacion');
    if (!cont) return;

    // --- Helpers Locales Blindados ---
    const fmtDinero = v => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v) || 0);
    const fmtFecha = d => {
        const dt = new Date(d);
        if (isNaN(dt.getTime())) return String(d);
        return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(dt).toUpperCase();
    };

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const tarjetasConfig = StorageService.get("tarjetasConfig", []);
    
    // Filtros
    const bancoSeleccionado = window._filtroMSIBanco || (cuentasMSI.length > 0 ? cuentasMSI[0].banco : '');
    const mesReferencia = window._filtroMSIMes !== undefined ? window._filtroMSIMes : new Date().getMonth(); // 0-11
    const anioReferencia = window._filtroMSIAnio || new Date().getFullYear();

    // 2. Cálculo Inteligente del Periodo Bancario
    const infoTarjeta = tarjetasConfig.find(t => t.banco === bancoSeleccionado);
    
    // Prioriza la DB, si no existe usa el diccionario, si no, usa 15
    const diaCorte = (infoTarjeta && infoTarjeta.diaCorte) 
                     ? parseInt(infoTarjeta.diaCorte) 
                     : (CONFIG_CORTES[bancoSeleccionado] || CONFIG_CORTES.DEFAULT);
    
    // Matemáticas de fecha exactas (Si el corte es el 12: del 11 del mes pasado al 12 actual)
    const fechaInicio = new Date(anioReferencia, mesReferencia - 1, diaCorte - 1, 0, 0, 0);
    const fechaFin = new Date(anioReferencia, mesReferencia, diaCorte, 23, 59, 59);

    const periodoStr = `${fmtFecha(fechaInicio)} al ${fmtFecha(fechaFin)}`;

    // 3. Filtrar mensualidades en el periodo
    let mensualidadesEnPeriodo = [];
    let totalEsperado = 0;
    let totalConciliado = 0;

    cuentasMSI.forEach(cta => {
        if (cta.banco !== bancoSeleccionado) return;
        
        if (cta.calendario && Array.isArray(cta.calendario)) {
            cta.calendario.forEach((p, index_cal) => {
                const fechaPago = new Date(p.fecha + "T12:00:00");
                
                if (fechaPago >= fechaInicio && fechaPago <= fechaFin) {
                    const item = {
                        id_ref: `${cta.id}_${p.n || p.numero}`,
                        parent_id: cta.id,
                        index_cal: index_cal,
                        numero_ms: p.n || p.numero,
                        total_ms: cta.plazo || cta.meses,
                        fecha: p.fecha,
                        concepto: cta.concepto || cta.producto,
                        monto: parseFloat(p.monto) || 0,
                        conciliado: p.conciliado || false
                    };
                    mensualidadesEnPeriodo.push(item);
                    totalEsperado += item.monto;
                    if (item.conciliado) totalConciliado += item.monto;
                }
            });
        }
    });

    // 4. Construir Selectores
    const bancosUnicos = [...new Set(cuentasMSI.map(c => c.banco))];
    const opcionesBancos = bancosUnicos.map(b => `<option value="${b}" ${b === bancoSeleccionado ? 'selected' : ''}>💳 ${b}</option>`).join('');
    
    const meses = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const opcionesMeses = meses.map((m, i) => `<option value="${i}" ${i == mesReferencia ? 'selected' : ''}>${m}</option>`).join('');

    // 5. Renderizar Interfaz
    cont.innerHTML = `
        <div style="background:white; padding:25px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05); position: relative;">
            
            <div style="border-bottom: 2px solid #f1f5f9; padding-bottom:15px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <div>
                    <h2 style="margin:0; color:#1e293b;">🏦 Conciliación MSI: ${bancoSeleccionado}</h2>
                    <div style="background:#e0f2fe; color:#0369a1; padding:8px 15px; border-radius:6px; display:inline-block; margin-top:10px; font-weight:bold; font-size:14px;">
                        📅 Periodo facturado: ${periodoStr} <span style="color:#0284c7; font-size:12px; margin-left:8px;">(Corte: Día ${diaCorte})</span>
                    </div>
                </div>
            </div>

            <div style="display:flex; gap:15px; margin-bottom:15px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <label style="display:block; font-size:11px; font-weight:bold; color:#64748b; margin-bottom:5px;">SELECCIONAR BANCO:</label>
                    <select id="selMSIBanco" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-weight:bold;">${opcionesBancos}</select>
                </div>
                <div style="flex:1; min-width:150px;">
                    <label style="display:block; font-size:11px; font-weight:bold; color:#64748b; margin-bottom:5px;">MES DE ESTADO DE CUENTA:</label>
                    <select id="selMSIMes" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-weight:bold;">${opcionesMeses}</select>
                </div>
            </div>

            <div style="position: sticky; top: 0; z-index: 10; background: white; padding: 10px 0 15px 0; margin-bottom:15px; border-bottom:1px solid #e2e8f0; border-radius: 0 0 8px 8px;">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:20px;">
                    <div style="background:#f8fafc; padding:20px; border-radius:12px; border-top:4px solid #6366f1; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div style="font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Cargos en Periodo</div>
                        <div style="font-size:26px; font-weight:900; color:#1e293b;">${fmtDinero(totalEsperado)}</div>
                    </div>
                    <div style="background:#f0fdf4; padding:20px; border-radius:12px; border-top:4px solid #10b981; box-shadow:0 2px 4px rgba(0,0,0,0.02);">
                        <div style="font-size:12px; color:#166534; font-weight:bold; text-transform:uppercase;">Total Conciliado</div>
                        <div style="font-size:26px; font-weight:900; color:#15803d;">${fmtDinero(totalConciliado)}</div>
                    </div>
                </div>
            </div>

            <div style="overflow-x:auto;">
                <table style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="background:#f1f5f9; text-align:left;">
                            <th style="padding:12px; font-size:12px; color:#64748b;">FECHA CARGO</th>
                            <th style="padding:12px; font-size:12px; color:#64748b;">CONCEPTO</th>
                            <th style="padding:12px; font-size:12px; color:#64748b;">MENSUALIDAD</th>
                            <th style="padding:12px; text-align:right; font-size:12px; color:#64748b;">MONTO</th>
                            <th style="padding:12px; text-align:center; font-size:12px; color:#64748b;">CONCILIADO</th>
                            <th style="padding:12px; text-align:center; font-size:12px; color:#64748b;">ACCIÓN</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mensualidadesEnPeriodo.map(m => `
                            <tr style="border-bottom: 1px solid #e2e8f0; background: ${m.conciliado ? '#f0fdf4' : 'white'}; transition: 0.2s;">
                                <td style="padding:12px; font-size:13px;">${fmtFecha(m.fecha)}</td>
                                <td style="padding:12px; font-weight:bold; color:#1e293b;">${m.concepto}</td>
                                <td style="padding:12px;">
                                    <span style="background:#e0e7ff; color:#4338ca; padding:4px 8px; border-radius:20px; font-size:11px; font-weight:bold;">
                                        Mes ${m.numero_ms} de ${m.total_ms}
                                    </span>
                                </td>
                                <td style="padding:12px; text-align:right; font-weight:bold; color:#ef4444;">
                                    -${fmtDinero(m.monto)}
                                </td>
                                <td style="padding:12px; text-align:center;">
                                    <input type="checkbox" ${m.conciliado ? 'checked' : ''} 
                                           onchange="window.toggleConciliacionMSI('${m.parent_id}', '${m.numero_ms}', this.checked)"
                                           style="width:20px; height:20px; cursor:pointer; accent-color:#10b981;">
                                </td>
                                <td style="padding:12px; text-align:center;">
                                    <div style="display:flex; gap:6px; justify-content:center; flex-wrap:wrap;">
    <button onclick="abrirModalReprogramarConciliacion('${m.parent_id}', ${m.index_cal}, '${m.fecha}')" 
            style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#475569;">
        ✏️ Reprogramar
    </button>
    <button onclick="window.abrirModalReasignarBanco('${m.parent_id}')" 
            style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#1d4ed8;">
        🏦 Reasignar
    </button>
    <button onclick="window.eliminarMensualidadesEnCascada('${m.parent_id}', ${m.index_cal}, '${m.numero_ms}')" 
            style="background:#fff1f2; border:1px solid #fecdd3; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#e11d48;">
        ❌ Eliminar
    </button>
</div>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan=\"6\" style=\"text-align:center; padding:50px; color:#94a3b8; font-style:italic;\">No hay mensualidades registradas para este banco en el periodo seleccionado.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    document.getElementById('selMSIBanco').onchange = (e) => { window._filtroMSIBanco = e.target.value; renderConciliacionMSI(); };
    document.getElementById('selMSIMes').onchange = (e) => { window._filtroMSIMes = parseInt(e.target.value); renderConciliacionMSI(); };
}

window.toggleConciliacionMSI = function(ctaId, numeroMes, valor) {
    const cuentasMSI = StorageService.get("cuentasMSI", []);
    const ctaIdx = cuentasMSI.findIndex(c => String(c.id) === String(ctaId));
    
    if (ctaIdx !== -1) {
        const calIdx = cuentasMSI[ctaIdx].calendario.findIndex(p => String(p.n || p.numero) === String(numeroMes));
        if (calIdx !== -1) {
            cuentasMSI[ctaIdx].calendario[calIdx].conciliado = valor;
            StorageService.set("cuentasMSI", cuentasMSI);
        }
    }
    renderConciliacionMSI();
};

window.abrirModalReprogramarConciliacion = function(cuentaId, indexMensualidad, fechaActual) {
    document.querySelector('[data-modal="repro-concilia"]')?.remove();
    const html = `
    <div data-modal="repro-concilia" style="position:fixed; inset:0; background:rgba(15,23,42,0.8); z-index:10000; display:flex; justify-content:center; align-items:center; backdrop-filter:blur(4px);">
        <div style="background:white; padding:30px; border-radius:16px; width:90%; max-width:380px; box-shadow:0 20px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:#d97706;">📅 Ajustar Fecha de Mensualidad</h3>
            <p style="font-size:12px; color:#64748b; margin-bottom:20px;">Al cambiar esta fecha, todas las mensualidades siguientes se recorrerán automáticamente sumando un mes.</p>
            
            <label style="font-size:12px; font-weight:bold; color:#475569; display:block; margin-bottom:5px;">Nueva fecha de cobro:</label>
            <input type="date" id="nuevaFechaConcilia" value="${fechaActual}" style="width:100%; padding:12px; border:2px solid #cbd5e1; border-radius:8px; margin-bottom:25px; font-size:16px; box-sizing:border-box;">
            
            <div style="display:flex; gap:10px;">
                <button onclick="ejecutarReprogramacionConciliacion('${cuentaId}', ${indexMensualidad})" style="flex:2; padding:12px; background:#d97706; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px;">💾 Guardar y Recorrer</button>
                <button onclick="this.closest('[data-modal]').remove()" style="flex:1; padding:12px; background:#f1f5f9; border:none; border-radius:8px; cursor:pointer; color:#475569; font-weight:bold;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.ejecutarReprogramacionConciliacion = function(cuentaId, indexMensualidad) {
    const nuevaFechaStr = document.getElementById("nuevaFechaConcilia").value;
    if (!nuevaFechaStr) return;

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    if (!cuenta) return;

    let calendario = cuenta.calendario;
    let fechaBase = new Date(nuevaFechaStr + "T12:00:00");
    let mesActual = fechaBase.getMonth();
    let anioActual = fechaBase.getFullYear();
    let diaActual = fechaBase.getDate();

    for (let i = indexMensualidad; i < calendario.length; i++) {
        let fCalculada = new Date(anioActual, mesActual, diaActual, 12, 0, 0);
        let yyyy = fCalculada.getFullYear();
        let mm = String(fCalculada.getMonth() + 1).padStart(2, '0');
        let dd = String(fCalculada.getDate()).padStart(2, '0');

        calendario[i].fecha = `${yyyy}-${mm}-${dd}`;
        mesActual++; 
    }

    StorageService.set("cuentasMSI", cuentasMSI);
    document.querySelector('[data-modal="repro-concilia"]').remove();
    alert("✅ Calendario MSI actualizado en cascada correctamente.");
    renderConciliacionMSI(); 
};
// --- MOTOR DE ELIMINACIÓN EN CASCADA DESDE CONCILIACIÓN ---
window.eliminarMensualidadesEnCascada = function(cuentaId, indexMensualidad, numeroMes) {
    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    
    if (!cuenta) {
        alert("❌ Error: No se encontró el registro raíz de esta cuenta MSI.");
        return;
    }

    // Extraemos el concepto seguro desde la base de datos
    let conceptoSeguro = cuenta.concepto || cuenta.producto || "Compra MSI";

    let calendario = cuenta.calendario || [];
    let totalCuotasOriginales = calendario.length;
    let cuotasAEliminar = totalCuotasOriginales - indexMensualidad;

    let resumen = `⚠️ RESUMEN DE OPERACIÓN - ELIMINACIÓN EN CASCADA\n\n` +
                  `📦 Concepto: ${conceptoSeguro}\n` +
                  `💳 Banco/Tarjeta: ${cuenta.banco}\n` +
                  `📍 Punto de Inflexión: Mensualidad No. ${numeroMes} de ${cuenta.meses || cuenta.plazo}\n\n` +
                  `--------------------------------------------------\n` +
                  `✅ Se CONSERVARÁN: ${indexMensualidad} mensualidades previas.\n` +
                  `🔥 Se ELIMINARÁN: ${cuotasAEliminar} mensualidades (esta y todas las siguientes).\n` +
                  `--------------------------------------------------\n\n` +
                  `¿Estás seguro de que deseas eliminar este fragmento del calendario?`;

    if (!confirm(resumen)) return;

    if (indexMensualidad === 0) {
        cuentasMSI = cuentasMSI.filter(c => String(c.id) !== String(cuentaId));
        StorageService.set("cuentasMSI", cuentasMSI);
        alert("🗑️ Cuenta MSI eliminada por completo del sistema ya que se purgó desde la primera cuota.");
    } else {
        let cuotasConservadas = calendario.slice(0, indexMensualidad);
        let nuevoTotalMonto = cuotasConservadas.reduce((sum, item) => sum + (parseFloat(item.monto) || 0), 0);
        
        cuenta.calendario = cuotasConservadas;
        cuenta.meses = cuotasConservadas.length;
        if (cuenta.plazo) cuenta.plazo = cuotasConservadas.length;
        cuenta.total = nuevoTotalMonto;

        StorageService.set("cuentasMSI", cuentasMSI);
        alert(`✅ Cascada ejecutada. Se purgaron las últimas ${cuotasAEliminar} cuotas con éxito.`);
    }

    if (typeof renderConciliacionMSI === 'function') renderConciliacionMSI();
};
// --- MOTOR DE REASIGNACIÓN BANCARIA (CONCILIACIÓN) ---
window.abrirModalReasignarBanco = function(cuentaId) {
    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    if (!cuenta) {
        alert("❌ Error: No se encontró la cuenta maestra.");
        return;
    }

    // Extraemos dinámicamente tu catálogo real de bancos configurados
    let tarjetasConfig = StorageService.get("tarjetasConfig", []);
    let opcionesBancos = tarjetasConfig.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
    
    // Respaldo de seguridad por si el catálogo viene vacío
    if (!opcionesBancos) {
        opcionesBancos = `
            <option value="BANAMEX SIMPLI">BANAMEX SIMPLI</option>
            <option value="SANTANDER LIKEU">SANTANDER LIKEU</option>
            <option value="HSBC">HSBC</option>
            <option value="MERCADOPAGO">MERCADOPAGO</option>
        `;
    }

    let concepto = cuenta.concepto || cuenta.producto || "Compra MSI";

    let html = `
    <div id="modalReasignarBanco" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;">
        <div style="background:#fff; padding:20px; border-radius:8px; width:320px; box-shadow:0 4px 6px rgba(0,0,0,0.1); font-family:sans-serif;">
            <h3 style="margin-top:0; color:#1e293b; font-size:16px;">🏦 Reasignar Banco</h3>
            <p style="font-size:13px; color:#475569; margin-bottom:4px;">Compra: <b>${concepto}</b></p>
            <p style="font-size:13px; color:#475569; margin-top:0;">Banco Actual: <b style="color:#e11d48;">${cuenta.banco}</b></p>
            
            <div style="margin-top:15px; margin-bottom:20px;">
                <label style="display:block; font-size:12px; font-weight:bold; margin-bottom:5px; color:#334155;">Seleccionar Nuevo Banco:</label>
                <select id="nuevoBancoMSISelect" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
                    <option value="">-- Elige un banco --</option>
                    ${opcionesBancos}
                </select>
            </div>
            
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button onclick="document.getElementById('modalReasignarBanco').remove()" 
                        style="padding:8px 12px; background:#f1f5f9; border:none; border-radius:6px; cursor:pointer; color:#475569; font-weight:bold; font-size:12px;">
                    Cancelar
                </button>
                <button onclick="window.ejecutarReasignacionBanco('${cuentaId}')" 
                        style="padding:8px 12px; background:#2563eb; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:12px;">
                    💾 Guardar Cambio
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
};

window.ejecutarReasignacionBanco = function(cuentaId) {
    let nuevoBanco = document.getElementById("nuevoBancoMSISelect").value;
    if (!nuevoBanco) {
        alert("❌ Por favor, selecciona un banco de la lista.");
        return;
    }

    let cuentasMSI = StorageService.get("cuentasMSI", []);
    let cuenta = cuentasMSI.find(c => String(c.id) === String(cuentaId));
    
    if (cuenta) {
        let bancoAnterior = cuenta.banco;
        
        if (bancoAnterior === nuevoBanco) {
            alert("⚠️ Seleccionaste el mismo banco que ya tiene asignado.");
            return;
        }

        // Aplicamos el cambio al registro raíz
        cuenta.banco = nuevoBanco;
        StorageService.set("cuentasMSI", cuentasMSI);
        
        document.getElementById('modalReasignarBanco').remove();
        
        alert(`✅ REASIGNACIÓN EXITOSA:\n\nLa compra pasó de "${bancoAnterior}" a "${nuevoBanco}".\n\nTodos los pagarés de esta compra ya reflejan el nuevo banco en el sistema.`);
        
        // Refrescamos la interfaz automáticamente
        if (typeof renderConciliacionMSI === 'function') renderConciliacionMSI();
        if (typeof renderCuentasMSI === 'function') renderCuentasMSI();
    }
};
window.renderConciliacion = renderConciliacionMSI;