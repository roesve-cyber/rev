// ===== MÓDULO EXCLUSIVO DE CONCILIACIÓN MSI POR FECHA DE CORTE =====

// 1. Configuración de Fechas de Corte por Banco
// Ajusta estos números según tus estados de cuenta reales
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

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    
    // Filtros seleccionados (o por defecto)
    const bancoSeleccionado = window._filtroMSIBanco || (cuentasMSI.length > 0 ? cuentasMSI[0].banco : '');
    const mesReferencia = window._filtroMSIMes || new Date().getMonth(); // 0-11
    const anioReferencia = window._filtroMSIAnio || new Date().getFullYear();

    // 2. Cálculo del Periodo Bancario
    const diaCorte = CONFIG_CORTES[bancoSeleccionado] || CONFIG_CORTES.DEFAULT;
    
    // Inicio: Día después del corte del mes anterior
    const fechaInicio = new Date(anioReferencia, mesReferencia - 1, diaCorte + 1, 0, 0, 0);
    // Fin: Día del corte del mes actual
    const fechaFin = new Date(anioReferencia, mesReferencia, diaCorte, 23, 59, 59);

    const periodoStr = `${window.formatearFechaCortaMX(fechaInicio)} al ${window.formatearFechaCortaMX(fechaFin)}`;

    // 3. Filtrar mensualidades que caen en este periodo
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
        <div style="background:white; padding:25px; border-radius:12px; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
            <div style="border-bottom: 2px solid #f1f5f9; padding-bottom:15px; margin-bottom:20px;">
                <h2 style="margin:0; color:#1e293b;">🏦 Conciliación MSI: ${bancoSeleccionado}</h2>
                <div style="background:#e0f2fe; color:#0369a1; padding:8px 15px; border-radius:6px; display:inline-block; margin-top:10px; font-weight:bold; font-size:14px;">
                    📅 Periodo: ${periodoStr}
                </div>
            </div>

            <div style="display:flex; gap:15px; margin-bottom:25px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <label style="display:block; font-size:11px; font-weight:bold; color:#64748b; margin-bottom:5px;">SELECCIONAR BANCO:</label>
                    <select id="selMSIBanco" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">${opcionesBancos}</select>
                </div>
                <div style="flex:1; min-width:150px;">
                    <label style="display:block; font-size:11px; font-weight:bold; color:#64748b; margin-bottom:5px;">MES DE ESTADO DE CUENTA:</label>
                    <select id="selMSIMes" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">${opcionesMeses}</select>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:20px; margin-bottom:30px;">
                <div style="background:#f8fafc; padding:20px; border-radius:12px; border-top:4px solid #6366f1;">
                    <div style="font-size:12px; color:#64748b; font-weight:bold; text-transform:uppercase;">Cargos en Periodo</div>
                    <div style="font-size:24px; font-weight:900; color:#1e293b;">${window.formatearDineroMX(totalEsperado)}</div>
                </div>
                <div style="background:#f0fdf4; padding:20px; border-radius:12px; border-top:4px solid #10b981;">
                    <div style="font-size:12px; color:#166534; font-weight:bold; text-transform:uppercase;">Total Conciliado</div>
                    <div style="font-size:24px; font-weight:900; color:#15803d;">${window.formatearDineroMX(totalConciliado)}</div>
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
                            <tr style="border-bottom: 1px solid #e2e8f0; background: ${m.conciliado ? '#f0fdf4' : 'white'};">
                                <td style="padding:12px; font-size:13px;">${window.formatearFechaCortaMX(m.fecha)}</td>
                                <td style="padding:12px; font-weight:bold; color:#1e293b;">${m.concepto}</td>
                                <td style="padding:12px;">
                                    <span style="background:#e0e7ff; color:#4338ca; padding:4px 8px; border-radius:20px; font-size:11px; font-weight:bold;">
                                        Mes ${m.numero_ms} de ${m.total_ms}
                                    </span>
                                </td>
                                <td style="padding:12px; text-align:right; font-weight:bold; color:#ef4444;">
                                    -${window.formatearDineroMX(m.monto)}
                                </td>
                                <td style="padding:12px; text-align:center;">
                                    <input type="checkbox" ${m.conciliado ? 'checked' : ''} 
                                           onchange="window.toggleConciliacionMSI('${m.parent_id}', '${m.numero_ms}', this.checked)"
                                           style="width:20px; height:20px; cursor:pointer; accent-color:#10b981;">
                                </td>
                                <td style="padding:12px; text-align:center;">
                                    <button onclick="abrirModalReprogramarConciliacion('${m.parent_id}', ${m.index_cal}, '${m.fecha}')" 
                                            style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:6px 10px; cursor:pointer; font-size:11px; font-weight:bold; color:#475569;">
                                        ✏️ Reprogramar
                                    </button>
                                </td>
                            </tr>
                        `).join('') || '<tr><td colspan=\"6\" style=\"text-align:center; padding:50px; color:#94a3b8; font-style:italic;\">No hay mensualidades registradas para este banco en el periodo seleccionado.</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // Listeners para filtros
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

// --- LÓGICA DE REPROGRAMACIÓN DESDE CONCILIACIÓN ---

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

    // Desplazamiento en cascada (+1 mes por cada cuota restante)
    for (let i = indexMensualidad; i < calendario.length; i++) {
        let fCalculada = new Date(anioActual, mesActual, diaActual, 12, 0, 0);
        let yyyy = fCalculada.getFullYear();
        let mm = String(fCalculada.getMonth() + 1).padStart(2, '0');
        let dd = String(fCalculada.getDate()).padStart(2, '0');

        calendario[i].fecha = `${yyyy}-${mm}-${dd}`;
        mesActual++; // Sumamos un mes para la siguiente cuota
    }

    StorageService.set("cuentasMSI", cuentasMSI);
    document.querySelector('[data-modal="repro-concilia"]').remove();
    alert("✅ Calendario MSI actualizado en cascada correctamente.");
    renderConciliacionMSI(); // Refrescar la tabla actual
};

window.renderConciliacion = renderConciliacionMSI;