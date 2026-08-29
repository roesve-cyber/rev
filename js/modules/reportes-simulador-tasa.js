// ============================================================
// 🧮 SIMULADOR DE TASA Y DESCUENTO POR PRONTO PAGO
// ------------------------------------------------------------
// Problema real: la mayoría de las ventas a crédito se liquidan
// más tarde del plazo pactado. El total que se cobra NO cambia
// por eso (es interés simple fijado al vender), así que lo que
// se diluye es tu tasa mensual REAL — tu dinero queda inmovilizado
// más tiempo por la misma ganancia nominal.
//
// La idea: subir la tasa general (para compensar la extensión real
// que ya observas en tu cartera) pero ofrecer un descuento a quien
// SÍ paga a tiempo, de forma que ese cliente puntual pague
// aproximadamente lo mismo que pagaría hoy. Quien se atrasa paga
// la tasa nueva completa, sin descuento.
//
// Este módulo:
//   1) Diagnostica, con tus cuentas reales, cuánto se extiende hoy
//      tu cartera vs. el plazo pactado.
//   2) Simula, por cada plazo, qué % de descuento neutraliza el
//      aumento de tasa para el pago puntual.
//   3) Proyecta el impacto neto en tu cartera si aplicas el nuevo
//      esquema, usando tu mezcla real de a-tiempo / atrasados.
// ============================================================

function _stpEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function _stpMesesEntre(fechaIni, fechaFin) {
    const a = new Date(fechaIni);
    const b = new Date(fechaFin);
    if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
    return (b - a) / (1000 * 60 * 60 * 24 * 30.44);
}

function _stpCuentaCancelada(c) {
    return typeof _cxcCuentaCancelada === 'function' ? _cxcCuentaCancelada(c) : String(c?.estado || '').toLowerCase().includes('cancel');
}

function _stpEsIncobrable(c) {
    return typeof _cxcEsIncobrable === 'function' ? _cxcEsIncobrable(c) : c?.incobrable === true;
}

// ---------------------------------------------------------------
// 1) DIAGNÓSTICO REAL: plazo pactado vs. tiempo real de liquidación
// ---------------------------------------------------------------
function _stpDiagnosticoCartera() {
    const cuentas = StorageService.get('cuentasPorCobrar', [])
        .filter(c => Number(c?.plan?.meses || 0) > 0 && !_stpCuentaCancelada(c) && !_stpEsIncobrable(c));

    const liquidadas = [];
    const activasVencidas = [];
    const activasEnPlazo = [];

    cuentas.forEach(c => {
        const mesesPactados = Number(c.plan?.meses || 0);
        const fechaVenta = c.fechaVenta || c.fecha;
        if (!mesesPactados || !fechaVenta) return;

        const abonos = (c.abonos || []).filter(a => !a.cancelado && !a.canceladoPorVenta && !a.canceladoPorApartado);
        const saldoActual = Number(c.saldoActual ?? 0);
        const estaSaldada = String(c.estado || '').toLowerCase() === 'saldado' || (saldoActual <= 0.01 && abonos.length > 0);

        if (estaSaldada && abonos.length) {
            const ultimoAbono = abonos.reduce((max, a) => new Date(a.fecha) > new Date(max.fecha) ? a : max, abonos[0]);
            const mesesReales = _stpMesesEntre(fechaVenta, ultimoAbono.fecha);
            if (mesesReales !== null && mesesReales >= -0.5) {
                const { totalMercancia, totalDocumento } = typeof window._rrcTotalesVenta === 'function'
                    ? window._rrcTotalesVenta(c)
                    : { totalMercancia: Number(c.totalMercancia || 0), totalDocumento: Number(c.total || 0) };
                const interes = typeof window._rrcInteres === 'function'
                    ? window._rrcInteres(totalDocumento, totalMercancia)
                    : Math.max(0, totalDocumento - totalMercancia);
                liquidadas.push({
                    folio: c.folio, mesesPactados, mesesReales: Math.max(0, mesesReales),
                    extension: mesesReales - mesesPactados,
                    totalMercancia, interes
                });
            }
        } else {
            const fechaFinalPactada = new Date(fechaVenta);
            fechaFinalPactada.setMonth(fechaFinalPactada.getMonth() + mesesPactados);
            const hoy = new Date();
            const mesesTranscurridos = _stpMesesEntre(fechaVenta, hoy) ?? 0;
            if (hoy > fechaFinalPactada) {
                activasVencidas.push({ folio: c.folio, mesesPactados, mesesTranscurridos, extension: mesesTranscurridos - mesesPactados });
            } else {
                activasEnPlazo.push({ folio: c.folio, mesesPactados, mesesTranscurridos });
            }
        }
    });

    const nL = liquidadas.length;
    const promedioExtLiquidadas = nL ? liquidadas.reduce((s, x) => s + x.extension, 0) / nL : 0;
    const aTiempo = liquidadas.filter(x => x.extension <= 0.5).length;
    const pctATiempo = nL ? (aTiempo / nL) * 100 : null;
    const pctExtendidas = nL ? 100 - pctATiempo : null;

    const totalMercanciaLiq = liquidadas.reduce((s, x) => s + x.totalMercancia, 0);
    const totalInteresLiq = liquidadas.reduce((s, x) => s + x.interes, 0);
    const mesesPactadosPromLiq = nL ? liquidadas.reduce((s, x) => s + x.mesesPactados, 0) / nL : 0;
    const mesesRealesPromLiq = nL ? liquidadas.reduce((s, x) => s + x.mesesReales, 0) / nL : 0;

    // Tasa mensual pactada promedio (simple, sobre mercancía) vs. tasa
    // mensual REAL que en realidad rendiste, dado el tiempo que tardaste
    // en cobrar el mismo interés.
    const tasaPactadaProm = (totalMercanciaLiq > 0 && mesesPactadosPromLiq > 0)
        ? (totalInteresLiq / totalMercanciaLiq / mesesPactadosPromLiq) * 100 : 0;
    const tasaRealProm = (totalMercanciaLiq > 0 && mesesRealesPromLiq > 0)
        ? (totalInteresLiq / totalMercanciaLiq / mesesRealesPromLiq) * 100 : 0;

    const nAV = activasVencidas.length;
    const promedioExtActivasVencidas = nAV ? activasVencidas.reduce((s, x) => s + x.extension, 0) / nAV : 0;

    return {
        liquidadas, activasVencidas, activasEnPlazo,
        nL, nAV, nEnPlazo: activasEnPlazo.length,
        promedioExtLiquidadas, pctATiempo, pctExtendidas,
        tasaPactadaProm, tasaRealProm,
        promedioExtActivasVencidas
    };
}

// ---------------------------------------------------------------
// 2) NEUTRALIZACIÓN: descuento para que el pago puntual quede como hoy
// ---------------------------------------------------------------
// total = M * (1 + tasa% /100 * meses). El descuento cancela EXACTO
// la diferencia entre la tasa vieja y la nueva para ese plazo — no
// depende del monto M, solo de las dos tasas y el plazo.
function _stpDescuentoNeutralizante(tasaActual, tasaNueva, meses) {
    const factorActual = 1 + (tasaActual / 100) * meses;
    const factorNuevo = 1 + (tasaNueva / 100) * meses;
    if (factorNuevo <= 0) return 0;
    return Math.max(0, (1 - (factorActual / factorNuevo)) * 100);
}

function _stpTotalConTasa(monto, tasa, meses) {
    return monto * (1 + (tasa / 100) * meses);
}

// ---------------------------------------------------------------
// CONDONACIÓN (pagos semanales / dinero fijo) — alternativa al %
// ---------------------------------------------------------------
// El plan de crédito de rev ya vive en semanas (plan.semanas, plan.abono),
// aunque se venda "a X meses" — 1 mes ≈ 4 semanas en tus planes reales.
// En vez de un % que hay que aplicar a mano y que no deja ver el impacto en
// pesos, esto calcula: cuántos pagos semanales completos le puedes condonar
// a quien pague a tiempo SIN perder margen vs. lo que rendías hoy — y
// cuánto colchón de margen extra te queda siempre protegido (nunca
// negativo, porque se redondea hacia abajo).
function _stpSemanasDePlazo(meses) {
    return Math.round(meses * 4);
}

function _stpCondonacionParaPlazo(p, tasaNueva, monto) {
    const totalActual = _stpTotalConTasa(monto, p.tasa, p.meses);
    const totalNuevo = _stpTotalConTasa(monto, tasaNueva, p.meses);
    const excedente = Math.max(0, totalNuevo - totalActual); // lo que ganaste extra al subir la tasa
    const semanas = _stpSemanasDePlazo(p.meses);
    const abonoSemanal = semanas > 0 ? totalNuevo / semanas : 0;

    // Redondeado HACIA ABAJO en ambos casos: nunca condonas más de lo que
    // ganaste con la subida de tasa, así el impacto en utilidad vs. hoy
    // siempre es >= 0 (nulo o positivo), nunca negativo.
    const pagosCondonables = abonoSemanal > 0 ? Math.floor(excedente / abonoSemanal) : 0;
    const dineroPorPagos = pagosCondonables * abonoSemanal;
    const colchonPorPagos = excedente - dineroPorPagos;

    const dineroFijoRedondeado = Math.floor(excedente / 50) * 50; // a $50 hacia abajo
    const colchonFijo = excedente - dineroFijoRedondeado;

    return {
        totalActual, totalNuevo, excedente, semanas, abonoSemanal,
        pagosCondonables, dineroPorPagos, colchonPorPagos,
        dineroFijoRedondeado, colchonFijo,
        totalPuntualPagos: totalNuevo - dineroPorPagos,
        totalPuntualFijo: totalNuevo - dineroFijoRedondeado
    };
}

function _stpCondonacionHtml(plazosActuales) {
    const monto = window._stpMontoEjemplo;
    const filas = plazosActuales.map(p => {
        const tasaNueva = window._stpTasasNuevas[p.meses] ?? p.tasa;
        const c = _stpCondonacionParaPlazo(p, tasaNueva, monto);
        return { p, c };
    });

    return `
        <div style="background:white;padding:20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
            <h3 style="margin:0 0 6px;">🎁 Cómo premiar al cliente puntual: en pagos semanales o en $ fijo</h3>
            <p style="font-size:13px;color:#64748b;margin:0 0 16px;">Misma lógica que el % de arriba, pero expresada de forma concreta para el cliente y con el impacto en tu utilidad visible en cada fila. El "colchón" es lo que te queda de margen protegido — nunca es negativo, porque siempre se redondea hacia abajo.</p>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:9px;text-align:left;">Plazo</th>
                        <th style="padding:9px;text-align:right;">Pagos semanales</th>
                        <th style="padding:9px;text-align:right;">Pago semanal</th>
                        <th style="padding:9px;text-align:right;">Le puedes condonar</th>
                        <th style="padding:9px;text-align:right;">= en $</th>
                        <th style="padding:9px;text-align:right;">o en $ fijo redondo</th>
                        <th style="padding:9px;text-align:right;">Colchón protegido</th>
                    </tr></thead>
                    <tbody>
                        ${filas.map(({ p, c }) => `<tr>
                            <td style="padding:9px;font-weight:bold;">${p.meses} meses</td>
                            <td style="padding:9px;text-align:right;color:#64748b;">${c.semanas} sem.</td>
                            <td style="padding:9px;text-align:right;color:#64748b;">${dinero(c.abonoSemanal)}</td>
                            <td style="padding:9px;text-align:right;font-weight:900;color:#16a34a;">${c.pagosCondonables} pago${c.pagosCondonables === 1 ? '' : 's'}</td>
                            <td style="padding:9px;text-align:right;font-weight:bold;color:#1e40af;">${dinero(c.dineroPorPagos)}</td>
                            <td style="padding:9px;text-align:right;font-weight:bold;color:#1e40af;">${dinero(c.dineroFijoRedondeado)}</td>
                            <td style="padding:9px;text-align:right;color:#059669;">+${dinero(c.colchonPorPagos)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <p style="margin:12px 0 0;font-size:12px;color:#64748b;">Ejemplo con venta de ${dinero(monto)}: si un cliente elige 6 meses, en vez de decirle "10% de descuento" le dices <strong>"págame puntual y te perdono las últimas ${filas.find(f => f.p.meses === 6)?.c.pagosCondonables ?? '—'} semanas"</strong> — mismo efecto en dinero, mucho más claro para él, y tú ya sabes exactamente cuánto margen extra (el colchón) te queda de todos modos.</p>
        </div>`;
}

// ---------------------------------------------------------------
// RENDER
// ---------------------------------------------------------------
// ---------------------------------------------------------------
// DESCUENTO ÚNICO: un solo % para decirle al vendedor, en vez de
// una tabla distinta por plazo. Se calcula como el promedio de los
// descuentos neutralizantes por plazo, ponderado por cuánto peso
// real tiene cada plazo en tu cartera (pesos financiados). Si no
// hay suficiente historial, pondera parejo entre los plazos
// configurados.
// ---------------------------------------------------------------
function _stpDescuentoUnico(diag, plazosActuales) {
    const pesosPorPlazo = new Map();
    diag.liquidadas.forEach(x => {
        const m = Math.round(x.mesesPactados);
        pesosPorPlazo.set(m, (pesosPorPlazo.get(m) || 0) + x.totalMercancia);
    });

    const hayPeso = [...pesosPorPlazo.values()].some(v => v > 0);

    let sumaPonderada = 0;
    let sumaPesos = 0;
    const detalle = [];
    plazosActuales.forEach(p => {
        const tasaNueva = window._stpTasasNuevas[p.meses] ?? p.tasa;
        const descuentoPlazo = _stpDescuentoNeutralizante(p.tasa, tasaNueva, p.meses);
        const peso = hayPeso ? (pesosPorPlazo.get(p.meses) || 0) : 1;
        sumaPonderada += descuentoPlazo * peso;
        sumaPesos += peso;
        detalle.push({ meses: p.meses, descuentoPlazo, peso });
    });

    const descuentoUnico = sumaPesos > 0 ? sumaPonderada / sumaPesos : 0;
    return { descuentoUnico, detalle, ponderadoPorVentasReales: hayPeso };
}

function _stpDescuentoUnicoHtml(diag, plazosActuales) {
    const { descuentoUnico, detalle, ponderadoPorVentasReales } = _stpDescuentoUnico(diag, plazosActuales);
    window._stpDescuentoUnicoCalculado = descuentoUnico;
    if (window._stpDescuentoRedondeado === undefined) {
        window._stpDescuentoRedondeado = Math.round(descuentoUnico * 2) / 2; // al 0.5% más cercano
    }

    const minPlazo = detalle.reduce((min, d) => d.descuentoPlazo < min.descuentoPlazo ? d : min, detalle[0]);
    const maxPlazo = detalle.reduce((max, d) => d.descuentoPlazo > max.descuentoPlazo ? d : max, detalle[0]);
    const rangoAmplio = detalle.length > 1 && (maxPlazo.descuentoPlazo - minPlazo.descuentoPlazo) > 1.5;

    return `
        <div style="background:linear-gradient(135deg,#f5f3ff,#eff6ff);border:2px solid #7c3aed;border-radius:14px;padding:18px 20px;margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px;">
                <div>
                    <div style="font-size:11px;font-weight:800;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em;">👉 Dile a tu vendedor</div>
                    <div style="font-size:15px;color:#4c1d95;margin-top:2px;">Ofrece <strong>${window._stpDescuentoRedondeado}% de descuento del total</strong> si el cliente paga a tiempo — un solo número, sin importar el plazo ni el producto.</div>
                </div>
                <div style="text-align:right;">
                    <label style="font-size:11px;font-weight:bold;color:#6d28d9;display:block;margin-bottom:4px;">Redondear a</label>
                    <input type="number" step="0.5" value="${window._stpDescuentoRedondeado}" onchange="window._stpDescuentoRedondeado=Number(this.value)||0;renderSimuladorTasaProntoPago();" style="width:90px;padding:9px;border:2px solid #7c3aed;border-radius:8px;text-align:right;font-weight:900;font-size:18px;color:#6d28d9;">%
                </div>
            </div>
            <div style="margin-top:10px;font-size:12px;color:#5b21b6;">
                Calculado como el promedio ponderado ${ponderadoPorVentasReales ? 'por tus ventas reales de cada plazo' : '(sin suficiente historial por plazo, se ponderó parejo)'}: <strong>${descuentoUnico.toFixed(2)}%</strong> exacto, redondeado arriba a algo fácil de decir en piso de venta.
            </div>
            ${rangoAmplio ? `<div style="margin-top:8px;font-size:12px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:8px 10px;">
                ⚠️ Ojo: al ser un solo número, no es exacto para cada plazo. El neutralizante real va de <strong>${minPlazo.descuentoPlazo.toFixed(1)}%</strong> (a ${minPlazo.meses} meses) a <strong>${maxPlazo.descuentoPlazo.toFixed(1)}%</strong> (a ${maxPlazo.meses} meses) — con un solo % de ${window._stpDescuentoRedondeado}%, en plazos cortos regalas un poco más de lo necesario y en plazos largos compensas un poco menos. Si quieres precisión exacta por plazo, usa la tabla de abajo en vez del número único.
            </div>` : ''}
        </div>`;
}

// ---------------------------------------------------------------
// ESCENARIOS POR PLAZO CON EL DESCUENTO GLOBAL (único)
// ---------------------------------------------------------------
// La tabla de arriba (_stpDescuentoUnicoHtml) da UN número para decirle
// al vendedor. Esta tabla responde la pregunta complementaria: si de
// verdad usas ESE número (no el neutralizante exacto de cada plazo),
// ¿cómo le queda a cada plazo en específico comparado con lo que el
// cliente paga hoy? En plazos cortos el % único casi siempre le da de
// más al cliente (le sale más barato que hoy) y en plazos largos casi
// siempre le da de menos (le sale más caro que hoy) — esta tabla hace
// visible exactamente cuánto, en pesos y en %, para cada plazo.
function _stpEscenariosDescuentoGlobalHtml(plazosActuales) {
    const monto = window._stpMontoEjemplo;
    const descuentoGlobal = window._stpDescuentoRedondeado ?? 0;

    const filas = plazosActuales.map(p => {
        const tasaNueva = window._stpTasasNuevas[p.meses] ?? p.tasa;
        const totalActual = _stpTotalConTasa(monto, p.tasa, p.meses);
        const totalNuevoSinDescuento = _stpTotalConTasa(monto, tasaNueva, p.meses);
        const totalPuntual = totalNuevoSinDescuento * (1 - descuentoGlobal / 100);
        const diferenciaPesos = totalPuntual - totalActual;
        const diferenciaPct = totalActual > 0 ? (diferenciaPesos / totalActual) * 100 : 0;
        return { p, totalActual, totalNuevoSinDescuento, totalPuntual, diferenciaPesos, diferenciaPct };
    });

    return `
        <div style="background:white;padding:20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
            <h3 style="margin:0 0 6px;">📐 Con el ${descuentoGlobal}% único: cómo queda cada plazo vs. hoy</h3>
            <p style="font-size:13px;color:#64748b;margin:0 0 16px;">Aplicando el mismo ${descuentoGlobal}% de descuento a TODOS los plazos (no el neutralizante exacto de cada uno) — así se ve, plazo por plazo, si al cliente puntual le sale más barato o más caro que lo que paga hoy con la tasa actual.</p>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:9px;text-align:left;">Plazo</th>
                        <th style="padding:9px;text-align:right;">Total actual (hoy)</th>
                        <th style="padding:9px;text-align:right;">Total tasa nueva (sin descuento)</th>
                        <th style="padding:9px;text-align:right;">Total puntual (con ${descuentoGlobal}% único)</th>
                        <th style="padding:9px;text-align:right;">Diferencia vs. hoy</th>
                    </tr></thead>
                    <tbody>
                        ${filas.map(f => {
                            const neutral = Math.abs(f.diferenciaPct) < 0.3;
                            const favorable = f.diferenciaPesos < 0; // le sale más barato que hoy
                            const color = neutral ? '#64748b' : (favorable ? '#166534' : '#991b1b');
                            const signo = f.diferenciaPesos > 0 ? '+' : '';
                            const etiqueta = neutral ? '≈ igual que hoy' : (favorable ? 'más barato que hoy (le regalas)' : 'más caro que hoy (le falta compensación)');
                            return `<tr>
                                <td style="padding:9px;font-weight:bold;">${f.p.meses} meses</td>
                                <td style="padding:9px;text-align:right;color:#64748b;">${dinero(f.totalActual)}</td>
                                <td style="padding:9px;text-align:right;color:#64748b;">${dinero(f.totalNuevoSinDescuento)}</td>
                                <td style="padding:9px;text-align:right;font-weight:bold;">${dinero(f.totalPuntual)}</td>
                                <td style="padding:9px;text-align:right;font-weight:900;color:${color};">${signo}${dinero(f.diferenciaPesos)} (${signo}${f.diferenciaPct.toFixed(1)}%)<div style="font-size:10px;font-weight:normal;color:${color};">${etiqueta}</div></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <p style="margin:12px 0 0;font-size:12px;color:#64748b;">Ejemplo con venta de ${dinero(monto)}. Si el rango de "diferencia vs. hoy" te parece muy amplio entre plazo corto y largo, ajusta el % único arriba, o usa la tabla neutralizante exacta (más abajo) si prefieres precisión por plazo en vez de un solo número fácil de decir.</p>
        </div>`;
}

function renderSimuladorTasaProntoPago() {
    const vista = document.getElementById('simulador-tasa-pronto-pago');
    if (!vista) return;

    const diag = _stpDiagnosticoCartera();
    const config = StorageService.get('configCreditoGlobal', null);
    const plazosActuales = (config?.plazos?.length ? config.plazos : [
        { meses: 1, tasa: 2 }, { meses: 2, tasa: 2 }, { meses: 3, tasa: 2 },
        { meses: 4, tasa: 2.5 }, { meses: 5, tasa: 2.5 }, { meses: 6, tasa: 2.5 }
    ]).slice().sort((a, b) => a.meses - b.meses);

    window._stpPlazos = plazosActuales;
    window._stpMontoEjemplo = window._stpMontoEjemplo || 10000;
    window._stpDeltaGlobal = window._stpDeltaGlobal ?? 1;
    window._stpTasasNuevas = window._stpTasasNuevas || {};
    plazosActuales.forEach(p => {
        if (window._stpTasasNuevas[p.meses] === undefined) {
            window._stpTasasNuevas[p.meses] = Math.round((p.tasa + window._stpDeltaGlobal) * 100) / 100;
        }
    });

    const hayDatos = diag.nL >= 3;

    vista.innerHTML = `
        <div class="header-seccion" style="margin-bottom:16px;">
            <h2>🧮 Simulador de Tasa y Descuento por Pronto Pago</h2>
            <p style="color:#64748b;margin:4px 0 0;">Sube la tasa general para compensar lo que hoy pierdes por extensión de plazo, y ofrece un descuento a quien paga a tiempo para que no le cueste más que hoy.</p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:20px;">
            <div style="background:white;padding:18px;border-radius:12px;text-align:center;border:1px solid #e2e8f0;">
                <small style="color:#64748b;">CUENTAS LIQUIDADAS ANALIZADAS</small><br>
                <strong style="font-size:24px;color:#0f172a;">${diag.nL}</strong>
            </div>
            <div style="background:${diag.pctATiempo !== null && diag.pctATiempo < 50 ? '#fef2f2' : '#f0fdf4'};padding:18px;border-radius:12px;text-align:center;border:1px solid ${diag.pctATiempo !== null && diag.pctATiempo < 50 ? '#fecaca' : '#bbf7d0'};">
                <small style="color:${diag.pctATiempo !== null && diag.pctATiempo < 50 ? '#991b1b' : '#166534'};">% QUE PAGÓ A TIEMPO</small><br>
                <strong style="font-size:24px;color:${diag.pctATiempo !== null && diag.pctATiempo < 50 ? '#991b1b' : '#166534'};">${diag.pctATiempo !== null ? diag.pctATiempo.toFixed(0) + '%' : '—'}</strong>
            </div>
            <div style="background:#fffbeb;padding:18px;border-radius:12px;text-align:center;border:1px solid #fcd34d;">
                <small style="color:#92400e;">EXTENSIÓN PROMEDIO</small><br>
                <strong style="font-size:24px;color:#78350f;">${diag.nL ? (diag.promedioExtLiquidadas >= 0 ? '+' : '') + diag.promedioExtLiquidadas.toFixed(1) + ' meses' : '—'}</strong>
            </div>
            <div style="background:#eff6ff;padding:18px;border-radius:12px;text-align:center;border:1px solid #bfdbfe;">
                <small style="color:#1e40af;">TASA PACTADA PROM. / TASA REAL RENDIDA</small><br>
                <strong style="font-size:20px;color:#1e3a8a;">${diag.tasaPactadaProm.toFixed(2)}% → ${diag.tasaRealProm.toFixed(2)}%/mes</strong>
            </div>
        </div>

        ${!hayDatos ? `<div style="background:#fffbeb;border:1px solid #fcd34d;color:#92400e;border-radius:10px;padding:14px;margin-bottom:20px;font-size:13px;">
            ⚠️ Solo hay ${diag.nL} cuenta(s) liquidada(s) con plan de crédito en tu historial — muy poco para confiar en el promedio. Los cálculos de abajo funcionan igual, pero ajusta "extensión promedio" a mano con tu propio criterio del negocio.
        </div>` : ''}

        ${diag.nAV > 0 ? `<div style="background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:14px;margin-bottom:20px;font-size:13px;">
            📌 Además, ahora mismo tienes <strong>${diag.nAV} cuenta(s) activa(s)</strong> que ya rebasaron su plazo pactado (extensión promedio actual: ${diag.promedioExtActivasVencidas.toFixed(1)} meses) — van en camino a sumarse a esta misma estadística.
        </div>` : ''}

        <div style="background:white;padding:20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
                <h3 style="margin:0;">Nueva tasa por plazo y descuento neutralizante</h3>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                    <label style="font-size:12px;color:#374151;font-weight:bold;">Subir todas las tasas (puntos %):</label>
                    <input type="number" step="0.1" id="stpDeltaGlobal" value="${window._stpDeltaGlobal}" onchange="_stpAplicarDeltaGlobal(this.value)" style="width:80px;padding:7px;border:1px solid #d1d5db;border-radius:6px;text-align:right;">
                    <label style="font-size:12px;color:#374151;font-weight:bold;margin-left:10px;">Monto de ejemplo:</label>
                    <input type="number" step="500" id="stpMontoEjemplo" value="${window._stpMontoEjemplo}" onchange="window._stpMontoEjemplo=Number(this.value)||10000;renderSimuladorTasaProntoPago();" style="width:110px;padding:7px;border:1px solid #d1d5db;border-radius:6px;text-align:right;">
                </div>
            </div>

            ${_stpDescuentoUnicoHtml(diag, plazosActuales)}
        </div>

        ${_stpEscenariosDescuentoGlobalHtml(plazosActuales)}

        <div style="background:white;padding:20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
            <h3 style="margin:0 0 14px;">Nueva tasa por plazo y descuento neutralizante (exacto, no el único)</h3>
            <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr style="background:#f3f4f6;">
                        <th style="padding:9px;text-align:left;">Plazo</th>
                        <th style="padding:9px;text-align:right;">Tasa actual</th>
                        <th style="padding:9px;text-align:right;">Tasa nueva</th>
                        <th style="padding:9px;text-align:right;">Descuento pronto pago</th>
                        <th style="padding:9px;text-align:right;">Total actual (ejemplo)</th>
                        <th style="padding:9px;text-align:right;">Total con tasa nueva</th>
                        <th style="padding:9px;text-align:right;">Total puntual (con descuento)</th>
                    </tr></thead>
                    <tbody>
                        ${plazosActuales.map(p => {
                            const tasaNueva = window._stpTasasNuevas[p.meses];
                            const descuento = _stpDescuentoNeutralizante(p.tasa, tasaNueva, p.meses);
                            const totalActual = _stpTotalConTasa(window._stpMontoEjemplo, p.tasa, p.meses);
                            const totalNuevo = _stpTotalConTasa(window._stpMontoEjemplo, tasaNueva, p.meses);
                            const totalPuntual = totalNuevo * (1 - descuento / 100);
                            return `<tr>
                                <td style="padding:9px;font-weight:bold;">${p.meses} meses</td>
                                <td style="padding:9px;text-align:right;color:#64748b;">${p.tasa}%</td>
                                <td style="padding:9px;text-align:right;">
                                    <input type="number" step="0.1" value="${tasaNueva}" onchange="_stpCambiarTasaNueva(${p.meses}, this.value)" style="width:70px;padding:6px;border:1px solid #d1d5db;border-radius:6px;text-align:right;font-weight:bold;color:#7c3aed;">%
                                </td>
                                <td style="padding:9px;text-align:right;font-weight:900;color:#16a34a;">${descuento.toFixed(1)}%</td>
                                <td style="padding:9px;text-align:right;color:#64748b;">${dinero(totalActual)}</td>
                                <td style="padding:9px;text-align:right;">${dinero(totalNuevo)}</td>
                                <td style="padding:9px;text-align:right;font-weight:bold;color:#1e40af;">${dinero(totalPuntual)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <p style="margin:12px 0 0;font-size:12px;color:#64748b;">El "descuento pronto pago" es exacto: hace que el total puntual quede prácticamente igual al total actual de ese mismo plazo. Quien no pague a tiempo simplemente no lo recibe y paga la tasa nueva completa.</p>
        </div>

        ${_stpCondonacionHtml(plazosActuales)}

        ${_stpProyeccionHtml(diag, plazosActuales)}

        <div style="background:white;padding:18px;border-radius:12px;border:1px solid #e2e8f0;">
            <button onclick="_stpGuardarTasasNuevas()" style="padding:13px 22px;background:#7c3aed;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-size:14px;">💾 Aplicar estas tasas nuevas a la tienda (configCreditoGlobal)</button>
            <p style="margin:10px 0 0;font-size:12px;color:#64748b;">Esto reemplaza los plazos/tasas en Configuración — el descuento por pronto pago se aplica manualmente al cobrar (o dile a Claude que lo automatice en el flujo de abonos si quieres que sea un botón).</p>
        </div>
    `;
}

function _stpProyeccionHtml(diag, plazosActuales) {
    if (diag.nL < 1) {
        return `<div style="background:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;color:#64748b;margin-bottom:20px;">Aún no hay suficientes cuentas liquidadas para proyectar el impacto en cartera con datos reales.</div>`;
    }

    const pctATiempo = diag.pctATiempo ?? 50;
    const pctExtendidas = 100 - pctATiempo;
    const mesesPactadosProm = diag.nL ? diag.liquidadas.reduce((s, x) => s + x.mesesPactados, 0) / diag.nL : 3;

    const plazoRef = plazosActuales.reduce((best, p) => Math.abs(p.meses - mesesPactadosProm) < Math.abs(best.meses - mesesPactadosProm) ? p : best, plazosActuales[0]);
    const tasaActualRef = plazoRef.tasa;
    const tasaNuevaRef = window._stpTasasNuevas[plazoRef.meses] ?? tasaActualRef;
    const descuentoAplicado = window._stpDescuentoRedondeado ?? 0;

    const rendimientoActual = tasaActualRef * mesesPactadosProm; // % sobre mercancía, igual para ambos grupos hoy
    // Con el descuento ÚNICO (no el neutralizante perfecto por plazo): el
    // que paga a tiempo puede quedar un poco arriba o abajo de lo que
    // pagaba hoy, según qué tan cerca esté su plazo del "de referencia".
    const rendimientoPuntual = tasaNuevaRef * mesesPactadosProm * (1 - descuentoAplicado / 100);
    const rendimientoNuevo = (pctATiempo / 100) * rendimientoPuntual + (pctExtendidas / 100) * (tasaNuevaRef * mesesPactadosProm);
    const mejoraPuntos = rendimientoNuevo - rendimientoActual;
    const mejoraPesos = window._stpMontoEjemplo * (mejoraPuntos / 100);
    const diferenciaPuntual = rendimientoPuntual - rendimientoActual; // >0: al puntual le sale un poco más caro que hoy; <0: más barato

    return `
        <div style="background:white;padding:20px;border-radius:12px;border:1px solid #e2e8f0;margin-bottom:20px;">
            <h3 style="margin:0 0 14px;">Impacto neto estimado en tu cartera</h3>
            <p style="font-size:13px;color:#64748b;margin:0 0 14px;">Usando tu mezcla real: ${pctATiempo.toFixed(0)}% paga a tiempo (recibe el ${descuentoAplicado}% de descuento único) y ${pctExtendidas.toFixed(0)}% se extiende (paga la tasa nueva completa, sin descuento), sobre un plazo promedio de ${mesesPactadosProm.toFixed(1)} meses.</p>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
                <div style="background:#f8fafc;padding:14px;border-radius:10px;text-align:center;">
                    <small style="color:#64748b;">RENDIMIENTO HOY</small><br>
                    <strong style="font-size:18px;">${rendimientoActual.toFixed(2)}%</strong>
                    <div style="font-size:11px;color:#94a3b8;">sobre mercancía, cartera completa</div>
                </div>
                <div style="background:#f5f3ff;padding:14px;border-radius:10px;text-align:center;">
                    <small style="color:#6d28d9;">RENDIMIENTO CON EL CAMBIO</small><br>
                    <strong style="font-size:18px;color:#6d28d9;">${rendimientoNuevo.toFixed(2)}%</strong>
                </div>
                <div style="background:${mejoraPuntos >= 0 ? '#f0fdf4' : '#fef2f2'};padding:14px;border-radius:10px;text-align:center;">
                    <small style="color:${mejoraPuntos >= 0 ? '#166534' : '#991b1b'};">MEJORA NETA</small><br>
                    <strong style="font-size:18px;color:${mejoraPuntos >= 0 ? '#166534' : '#991b1b'};">${mejoraPuntos >= 0 ? '+' : ''}${mejoraPuntos.toFixed(2)} pts</strong>
                    <div style="font-size:11px;color:#94a3b8;">≈ ${dinero(mejoraPesos)} por cada ${dinero(window._stpMontoEjemplo)} financiados</div>
                </div>
            </div>
            <p style="margin:14px 0 0;font-size:12px;color:${Math.abs(diferenciaPuntual) < 0.15 ? '#64748b' : '#92400e'};">
                ${Math.abs(diferenciaPuntual) < 0.15
                    ? 'Con el plazo promedio de tu cartera, el descuento único deja al cliente puntual prácticamente igual que hoy.'
                    : (diferenciaPuntual > 0
                        ? `Con el plazo promedio de tu cartera, al cliente puntual le queda ${diferenciaPuntual.toFixed(2)} pts arriba de lo que pagaba hoy (le compensaste un poco de menos) — puedes subir el % único si quieres dejarlo exactamente neutral.`
                        : `Con el plazo promedio de tu cartera, al cliente puntual le queda ${Math.abs(diferenciaPuntual).toFixed(2)} pts abajo de lo que pagaba hoy (le regalaste un poco de más) — puedes bajar el % único si prefieres dejarlo exactamente neutral.`)}
            </p>
        </div>`;
}

window._stpAplicarDeltaGlobal = function(valor) {
    const delta = Number(valor) || 0;
    window._stpDeltaGlobal = delta;
    (window._stpPlazos || []).forEach(p => {
        window._stpTasasNuevas[p.meses] = Math.round((p.tasa + delta) * 100) / 100;
    });
    renderSimuladorTasaProntoPago();
};

window._stpCambiarTasaNueva = function(meses, valor) {
    window._stpTasasNuevas[meses] = Number(valor) || 0;
    renderSimuladorTasaProntoPago();
};

window._stpGuardarTasasNuevas = function() {
    const plazos = (window._stpPlazos || []).map(p => ({
        meses: p.meses,
        tasa: Number(window._stpTasasNuevas[p.meses] ?? p.tasa)
    }));
    if (!confirm(`¿Reemplazar la configuración de crédito de la tienda con estas tasas?\n\n${plazos.map(p => `${p.meses} meses al ${p.tasa}%`).join('\n')}\n\nAplica de inmediato a nuevas ventas.`)) return;
    StorageService.set('configCreditoGlobal', { plazos });
    alert('✅ Tasas actualizadas. El descuento por pronto pago se sigue aplicando a mano al cobrar — no cambia el ticket automáticamente.');
    if (typeof renderConfiguracion === 'function') renderConfiguracion();
    renderSimuladorTasaProntoPago();
};

window.renderSimuladorTasaProntoPago = renderSimuladorTasaProntoPago;
