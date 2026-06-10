// ============================================================================
// 🇲🇽 UTILIDADES GLOBALES DE FECHA Y MONEDA — ZONA HORARIA CDMX OBLIGATORIA
// America/Mexico_City (UTC-6 / UTC-5 en verano)
// ============================================================================
// REGLA DE ORO: NUNCA usar new Date().toISOString() — siempre window.localISO()
// NUNCA usar timeZone:'UTC' en displays — siempre 'America/Mexico_City'
// ============================================================================

/**
 * 🔑 FUNCIÓN MAESTRA: Devuelve fecha/hora actual (o la recibida) en ISO sin 'Z'
 * El string resultante es interpretado como hora local por el navegador (correcto).
 * Ejemplo: "2026-05-13T15:09:00.000"  ← 3:09 PM CDMX, no UTC
 */
window.localISO = function(fecha) {
    const entrada = fecha instanceof Date ? fecha : (fecha ? new Date(fecha) : new Date());
    const d = isNaN(entrada.getTime()) ? new Date() : entrada;
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Mexico_City',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    }).formatToParts(d);
    const p = {};
    parts.forEach(({ type, value }) => p[type] = value);
    // Intl puede devolver "24" en medianoche — normalizamos a "00"
    const hour = p.hour === '24' ? '00' : p.hour;
    return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}:${p.second}.000`;
};

/**
 * Fecha YYYY-MM-DD en CDMX — para inputs type="date"
 */
window.obtenerHoyInputMX = function() {
    return window.localISO(new Date()).split('T')[0];
};

/**
 * Fecha YYYY-MM-DD de cualquier fecha — safe para comparar sin saltos de día
 */
window.getFechaLocalMX = function(input = null) {
    const d = input ? new Date(input) : new Date();
    if (isNaN(d.getTime())) return window.localISO(new Date()).split('T')[0];
    return window.localISO(d).split('T')[0];
};

/**
 * Fecha para input datetime-local: "YYYY-MM-DDTHH:MM"
 */
window.fechaParaInput = function(fecha) {
    return window.localISO(fecha).slice(0, 16);
};

/**
 * Formatea fecha+hora larga: "13-05-2026 03:09:00 p. m."
 */
window.formatearFechaMX = function(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
    }).format(d).replace(/\//g, '-');
};

/**
 * Formatea solo la fecha corta: "13-05-2026"
 */
window.formatearFechaCortaMX = function(fecha) {
    if (!fecha) return '—';
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(d).replace(/\//g, '-');
};

/**
 * Alias: igual que getFechaLocalMX — compatibilidad con inventario
 */
window.formatearFechaVistaMX = function(fecha, opciones = {}) {
    const d = window.parseFechaMXOrNull ? window.parseFechaMXOrNull(fecha) : (fecha instanceof Date ? fecha : new Date(fecha));
    if (!d || isNaN(d.getTime())) return opciones.fallback ?? (fecha ? String(fecha) : '—');
    const dias = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${dias[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} de ${meses[d.getMonth()]} ${d.getFullYear()}`;
};

window.formatearFechaHoraVistaMX = function(fecha, opciones = {}) {
    const d = window.parseFechaMXOrNull ? window.parseFechaMXOrNull(fecha) : (fecha instanceof Date ? fecha : new Date(fecha));
    if (!d || isNaN(d.getTime())) return opciones.fallback ?? (fecha ? String(fecha) : '—');
    const hora = new Intl.DateTimeFormat('es-MX', {
        timeZone: 'America/Mexico_City',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(d);
    return `${window.formatearFechaVistaMX(d, opciones)}, ${hora}`;
};

window.obtenerFechaCDMX = function(fechaManual = null) {
    return window.getFechaLocalMX(fechaManual);
};

// Función de escape global para limpiar texto
window._esc = function(estu) {
    if (!estu) return "";
    if (typeof estu !== 'string') return estu;
    return estu
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

window.formatearDineroMX = function(monto) {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto || 0);
};

window.parseFechaMX = function(fecha) {

    if (!fecha) return new Date();

    if (fecha instanceof Date) return fecha;

    // timestamp numérico
    if (typeof fecha === 'number') {
        return new Date(fecha);
    }

    if (typeof fecha !== 'string') {
        return new Date(fecha);
    }

    // ISO local del sistema
    if (fecha.includes('T')) {
        const d = new Date(fecha);
        if (!isNaN(d.getTime())) return d;
    }

    // YYYY-MM-DD o YYYY/MM/DD
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(fecha)) {
        const [anio, mes, dia] = fecha.split(/[-/]/).map(n => parseInt(n, 10));
        const d = new Date(anio, mes - 1, dia, 12, 0, 0);
        if (!isNaN(d.getTime())) return d;
    }

    // DD/MM/YYYY, h:mm:ss a.m./p.m. o DD/MM/YYYY h:mm:ss
    const fechaHoraMX = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?)?$/i);
    if (fechaHoraMX) {
        let [, diaStr, mesStr, anioStr, horaStr, minStr, segStr, ampm] = fechaHoraMX;
        let hora = horaStr ? parseInt(horaStr, 10) : 12;
        if (ampm) {
            const p = ampm.toLowerCase() === 'p';
            if (p && hora < 12) hora += 12;
            if (!p && hora === 12) hora = 0;
        }
        const d = new Date(
            parseInt(anioStr, 10),
            parseInt(mesStr, 10) - 1,
            parseInt(diaStr, 10),
            hora,
            parseInt(minStr || '0', 10),
            parseInt(segStr || '0', 10)
        );
        if (!isNaN(d.getTime())) return d;
    }

    // DD/MM/YYYY o DD-MM-YYYY
    const normalizada = fecha.replace(/-/g, '/');
    const p = normalizada.split('/');

    if (p.length === 3) {

        const dia = parseInt(p[0], 10);
        const mes = parseInt(p[1], 10) - 1;
        const anio = parseInt(p[2], 10);

        const d = new Date(anio, mes, dia, 12, 0, 0);

        if (!isNaN(d.getTime())) return d;
    }

    // fallback controlado
    const d = new Date(fecha);

    return isNaN(d.getTime()) ? new Date() : d;
};

window.parseFechaMXOrNull = function(fecha) {
    if (fecha === null || fecha === undefined || fecha === '') return null;
    if (fecha instanceof Date) return isNaN(fecha.getTime()) ? null : fecha;
    if (typeof fecha === 'number') {
        const d = new Date(fecha);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof fecha !== 'string') {
        const d = new Date(fecha);
        return isNaN(d.getTime()) ? null : d;
    }

    const raw = fecha.trim();
    if (!raw || raw === 'null' || raw === 'undefined' || raw === 'Invalid Date') return null;

    if (/^\d+$/.test(raw)) {
        const d = new Date(Number(raw));
        return isNaN(d.getTime()) ? null : d;
    }

    const isoLocal = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (isoLocal) {
        const [, y, m, d, hh = '12', mm = '0', ss = '0'] = isoLocal;
        const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss));
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    const mx = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?)?/i);
    if (mx) {
        let [, d, m, y, hh = '12', mm = '0', ss = '0', ampm] = mx;
        let hora = Number(hh);
        if (ampm) {
            const pm = ampm.toLowerCase() === 'p';
            if (pm && hora < 12) hora += 12;
            if (!pm && hora === 12) hora = 0;
        }
        const parsed = new Date(Number(y), Number(m) - 1, Number(d), hora, Number(mm), Number(ss));
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    const fallback = new Date(raw);
    return isNaN(fallback.getTime()) ? null : fallback;
};

window.fechaClaveMX = function(fecha, fallback = '') {
    const d = window.parseFechaMXOrNull(fecha);
    if (!d) return fallback;
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
};

window.fechaInicioDiaMX = function(fecha) {
    const d = window.parseFechaMXOrNull(fecha);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
};

window.fechaFinDiaMX = function(fecha) {
    const d = window.parseFechaMXOrNull(fecha);
    if (!d) return null;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
};

const ValidatorService = {
  validarProducto(producto) {
    const errores = [];
    if (!producto.nombre || producto.nombre.trim().length === 0) {
      errores.push('El nombre del producto es obligatorio');
    }
    if (isNaN(producto.costo) || producto.costo < 0) {
      errores.push('El costo debe ser un número válido');
    }
    if (isNaN(producto.precio) || producto.precio < 0) {
      errores.push('El precio debe ser un número válido');
    }
    if (producto.precio < producto.costo) {
      errores.push('El precio debe ser mayor o igual al costo');
    }
    return { valid: errores.length === 0, errores };
  },
  validarCliente(cliente) {
    const errores = [];
    if (!cliente.nombre || cliente.nombre.trim().length === 0) {
      errores.push('El nombre del cliente es obligatorio');
    }
    if (cliente.telefono && !/^\d{7,15}$/.test(cliente.telefono.replace(/[-\s]/g, ''))) {
      errores.push('El teléfono debe contener 7-15 dígitos');
    }
    return { valid: errores.length === 0, errores };
  },
  validarMonto(monto, saldoMaximo = Infinity) {
    if (isNaN(monto) || monto <= 0) {
      return { valid: false, error: 'El monto debe ser un número positivo' };
    }
    if (monto > saldoMaximo) {
      return { valid: false, error: `El monto no puede exceder ${dinero(saldoMaximo)}` };
    }
    return { valid: true, error: '' };
  }
};
// ===============================================================
// 🛡️ BÓVEDA DE AUTORIZACIONES (MAKER-CHECKER)
// ===============================================================
window.revisarVentaPendiente = function(index) {
    const ventasP = StorageService.get("ventasPendientes", []);
    const v = ventasP[index];
    if (!v) return;

    // v.args: [metodoPago, totalContado, enganche, saldoAFinanciar, planElegido, folioVenta, fechaHoy, fechaVentaIso...]
    const fechaActualIso = v.args[7];
    const fechaCorta = fechaActualIso.split('T')[0];

    const html = `
    <div data-modal="auth-venta" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:12px; width:400px;">
            <h3 style="color:#d97706; margin-top:0;">🛒 Autorizar Venta Provisional</h3>
            <p><strong>Folio:</strong> ${v.args[5]}</p>
            <p><strong>Cliente:</strong> ${v.clienteNombre}</p>
            <p><strong>Total:</strong> ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v.totalVenta)}</p>
            
            <label style="display:block; margin-top:15px; font-weight:bold; font-size:12px;">Fecha de Aplicación Oficial (Auditoría):</label>
            <input type="date" id="authFechaVenta" value="${fechaCorta}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc; margin-top:5px;">

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="aprobarVentaCuarentena(${index})" style="flex:1; background:#22c55e; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">Aprobar</button>
                <button onclick="rechazarVentaCuarentena(${index})" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">Rechazar</button>
                <button onclick="document.querySelector('[data-modal=auth-venta]').remove()" style="padding:12px; background:#e2e8f0; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.aprobarVentaCuarentena = function(index) {
    const ventasP = StorageService.get("ventasPendientes", []);
    const v = ventasP[index];
    const nuevaFechaCorta = document.getElementById('authFechaVenta').value;
    const nuevaFechaIso = window.localISO ? window.localISO(nuevaFechaCorta + 'T12:00:00') : new Date(nuevaFechaCorta + 'T12:00:00').toISOString();
    
    // Inyectar la nueva fecha aprobada por el Admin
    v.args[6] = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(nuevaFechaIso)) : nuevaFechaCorta; 
    v.args[7] = nuevaFechaIso; 

    // Ejecutar el motor real
    window._vendedorSeleccionado = v.vendedorSeleccionado;
    window.ejecutarVentaAutorizadaReal(...v.args, v.datosVenta);
    
    // 🛡️ CAMBIO CRÍTICO: Usar removeAtomo() para transacción atómica inmediata
    const ventaIdCuarentena = v.idCuarentena || v.args[5]; // Usar idCuarentena si existe, sino folio
    StorageService.removeAtomo("ventasPendientes", ventaIdCuarentena).then(() => {
        document.querySelector('[data-modal=auth-venta]').remove();
        alert("✅ Venta autorizada e ingresada al sistema financiero oficial.");
        if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    }).catch(e => {
        console.error("Error al eliminar venta de cuarentena:", e);
        alert("⚠️ La venta se aprobó pero hubo un error al actualizar la lista. Recarga la página.");
    });
};

window.rechazarVentaCuarentena = function(index) {
    if (!confirm("¿Deseas eliminar permanentemente esta venta provisional sin afectar el sistema?")) return;
    
    // 🛡️ CAMBIO CRÍTICO: Usar removeAtomo() para transacción atómica inmediata
    const ventasP = StorageService.get("ventasPendientes", []);
    const v = ventasP[index];
    const ventaIdCuarentena = v.idCuarentena || v.args[5];
    
    StorageService.removeAtomo("ventasPendientes", ventaIdCuarentena).then(() => {
        document.querySelector('[data-modal=auth-venta]').remove();
        if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    }).catch(e => {
        console.error("Error al rechazar venta:", e);
        alert("⚠️ No se pudo procesar el rechazo. Intenta nuevamente.");
    });
};

window.revisarAbonoPendiente = function(index) {
    const abonosP = StorageService.get("abonosPendientes", []);
    const a = abonosP[index];
    if (!a) return;

    const fechaCorta = a.fechaAbonoIso.split('T')[0];

    const html = `
    <div data-modal="auth-abono" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:9999; display:flex; justify-content:center; align-items:center;">
        <div style="background:white; padding:25px; border-radius:12px; width:400px;">
            <h3 style="color:#059669; margin-top:0;">💵 Autorizar Abono Provisional</h3>
            <p><strong>Folio Crédito:</strong> ${a.folioCXC}</p>
            <p><strong>Monto Abono:</strong> ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(a.montoAbonado)}</p>
            <p><strong>Cuenta Receptora:</strong> ${a.etiquetaCuenta}</p>
            
            <label style="display:block; margin-top:15px; font-weight:bold; font-size:12px;">Fecha de Ingreso Oficial (Auditoría):</label>
            <input type="date" id="authFechaAbono" value="${fechaCorta}" style="width:100%; padding:10px; border-radius:6px; border:1px solid #ccc; margin-top:5px;">

            <div style="display:flex; gap:10px; margin-top:20px;">
                <button onclick="aprobarAbonoCuarentena(${index})" style="flex:1; background:#22c55e; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">Aprobar</button>
                <button onclick="rechazarAbonoCuarentena(${index})" style="flex:1; background:#ef4444; color:white; border:none; padding:12px; border-radius:6px; font-weight:bold; cursor:pointer;">Rechazar</button>
                <button onclick="document.querySelector('[data-modal=auth-abono]').remove()" style="padding:12px; background:#e2e8f0; border:none; border-radius:6px; cursor:pointer;">Cancelar</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
};

window.aprobarAbonoCuarentena = function(index) {
    const abonosP = StorageService.get("abonosPendientes", []);
    const a = abonosP[index];
    const nuevaFechaCorta = document.getElementById('authFechaAbono').value;
    const nuevaFechaIso = window.localISO ? window.localISO(nuevaFechaCorta + 'T12:00:00') : new Date(nuevaFechaCorta + 'T12:00:00').toISOString();
    
    a.fechaAbonoIso = nuevaFechaIso;
    a.fechaAbonoStr = window.formatearFechaCortaMX ? window.formatearFechaCortaMX(new Date(nuevaFechaIso)) : nuevaFechaCorta;

    window.ejecutarAbonoAutorizadoReal(a);
    
    // 🛡️ CAMBIO CRÍTICO: Usar removeAtomo() para transacción atómica inmediata
    const abonoIdCuarentena = a.idCuarentena || a.id;
    StorageService.removeAtomo("abonosPendientes", abonoIdCuarentena).then(() => {
        document.querySelector('[data-modal=auth-abono]').remove();
        alert("✅ Abono aprobado y registrado en flujo de caja.");
        if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    }).catch(e => {
        console.error("Error al eliminar abono de cuarentena:", e);
        alert("⚠️ El abono se aprobó pero hubo un error al actualizar la lista. Recarga la página.");
    });
};

window.rechazarAbonoCuarentena = function(index) {
    if (!confirm("¿Deseas eliminar permanentemente este abono sin ingresarlo a caja?")) return;
    
    // 🛡️ CAMBIO CRÍTICO: Usar removeAtomo() para transacción atómica inmediata
    const abonosP = StorageService.get("abonosPendientes", []);
    const a = abonosP[index];
    const abonoIdCuarentena = a.idCuarentena || a.id;
    
    StorageService.removeAtomo("abonosPendientes", abonoIdCuarentena).then(() => {
        document.querySelector('[data-modal=auth-abono]').remove();
        if (typeof renderPanelAutorizaciones === 'function') renderPanelAutorizaciones();
    }).catch(e => {
        console.error("Error al rechazar abono:", e);
        alert("⚠️ No se pudo procesar el rechazo. Intenta nuevamente.");
    });
};

// 🛡️ Alias global para módulos que usen la versión corta
window.dinero = window.formatearDineroMX;
