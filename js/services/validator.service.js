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

window.ValidatorService = ValidatorService;
