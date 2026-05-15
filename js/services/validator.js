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
    const d = fecha instanceof Date ? fecha : (fecha ? new Date(fecha) : new Date());
    if (isNaN(d.getTime())) return new Date().toString();
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

// 🛡️ Alias global para módulos que usen la versión corta
window.dinero = window.formatearDineroMX;
