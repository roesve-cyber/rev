// ============================================================================
// 🇲🇽 UTILIDADES GLOBALES DE FECHA Y MONEDA (MÉXICO)
// ============================================================================

/**
 * Formatea cualquier fecha al estándar de México: DD-MM-YYYY HH:MM:SS AM/PM
 */
window.formatearFechaMX = function(fecha) {
    if (!fecha) return "—";
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleString('es-MX', { 
        day: '2-digit', month: '2-digit', year: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit', 
        hour12: true 
    }).replace(/\//g, '-');
};

/**
 * Prepara una fecha para ser mostrada en un input tipo datetime-local sin desfase
 */
window.fechaParaInput = function(fecha) {
    const d = fecha ? new Date(fecha) : new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
};

/**
 * Formatea moneda a pesos mexicanos
 */
window.formatearDineroMX = function(monto) {
    return new Intl.NumberFormat('es-MX', { 
        style: 'currency', 
        currency: 'MXN' 
    }).format(monto || 0);
};

/**
 * Formatea fecha corta al estándar de México: DD-MM-YYYY
 */
window.formatearFechaCortaMX = function(fecha) {
    if (!fecha) return "—";
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return fecha;
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '-');
};

/**
 * Obtiene la fecha de hoy en formato YYYY-MM-DD (Seguro para inputs tipo date sin brincos de día)
 */
window.obtenerHoyInputMX = function() {
    const d = new Date();
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().split('T')[0];
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
