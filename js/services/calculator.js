// ===== SERVICIO DE CÁLCULO (SOPORTA REGLAS DINÁMICAS Y PARAMETRIZABLES) =====
const CalculatorService = {
  calcularMargen(precio, costo) {
    if (precio <= 0) return 0;
    return ((precio - costo) / precio) * 100;
  },
  
  calcularPrecioDesdeMargen(costo, margen) {
    if (costo === 0 || margen === 0) return 0;
    const precioCalculado = costo / (1 - margen / 100);
    return Math.round(precioCalculado / 100) * 100;
  },

  // NUEVA LÓGICA PARAMETRIZABLE
  calcularCredito(precio, configPersonalizada = null) {
    // 1. Definir qué configuración usar (Prioridad: 1° Producto, 2° Global, 3° Default Histórico)
    let config = configPersonalizada;

    // Intentar leer la configuración global si no hay una personalizada para este producto
    if (!config && typeof StorageService !== 'undefined') {
        config = StorageService.get('configCreditoGlobal', null);
    }

    // Si la configuración indica que NO se permite crédito (ej. producto en liquidación)
    if (config && config.permitirCredito === false) {
        return []; // Retorna vacío, forzando a que la venta sea de contado
    }

    // 2. Definir los plazos y tasas. Si no hay config, usamos el default histórico.
    let plazosConfig = [];
    if (!config || !config.plazos || config.plazos.length === 0) {
        // Default histórico: 1 a 6 meses, 2% (hasta 3m) y 2.5% (hasta 6m)
        for (let i = 1; i <= 6; i++) {
            plazosConfig.push({ meses: i, tasa: (i <= 3) ? 2 : 2.5 });
        }
    } else {
        // Usa el arreglo dinámico: ej. [{meses: 3, tasa: 3}, {meses: 6, tasa: 3.5}]
        plazosConfig = config.plazos; 
    }

    // Ordenar los plazos de menor a mayor para asegurar la progresividad matemática
    plazosConfig.sort((a, b) => a.meses - b.meses);

    let resultados = [];
    let totalAnterior = 0;

    // 3. Generar la escalera de planes de crédito
    plazosConfig.forEach(plazoObj => {
      let m = plazoObj.meses;
      let tasaDecimal = plazoObj.tasa / 100; // Convertimos ej. 2.5 a 0.025

      let totalBase = precio * (1 + (tasaDecimal * m));
      let semanas = m * 4;
      let pagoSemanal = totalBase / semanas;

      // Redondeo de abono al múltiplo de 10 superior
      pagoSemanal = Math.ceil(pagoSemanal / 10) * 10;
      let totalFinal = pagoSemanal * semanas;

      // Asegurar que a mayor plazo, el total sea mayor (progresividad)
      let intentos = 0;
      while (totalFinal <= totalAnterior && intentos++ < 100) {
        pagoSemanal += 5;
        totalFinal = pagoSemanal * semanas;
      }

      // Evita colapsos de memoria si hay un error en la configuración
      if (intentos >= 100) return;

      totalAnterior = totalFinal;
      resultados.push({ meses: m, semanas, abono: pagoSemanal, total: totalFinal });
    });

    return resultados;
  },

  calcularCreditoConPeriodicidad(precio, periodicidad = 'semanal', configPersonalizada = null) {
    // Pasamos la configuración en cascada a la función base
    const planesSemanales = this.calcularCredito(precio, configPersonalizada);
    
    let multiplicador = 1;
    if (periodicidad === 'quincenal') multiplicador = 2;
    if (periodicidad === 'mensual') multiplicador = 4;
    
    return planesSemanales.map(plan => ({
      meses: plan.meses,
      // 🛡️ REPARACIÓN AUDITORÍA: 'semanas' SIEMPRE mantiene la base de tiempo semanal original (ej. 24 para 6 meses).
      // Para saber cuántas cuotas se cobrarán según la periodicidad, SE DEBE USAR EXCLUSIVAMENTE 'pagos'.
      semanas: plan.semanas,
      pagos: Math.round(plan.semanas / multiplicador),
      abono: plan.abono * multiplicador,
      total: plan.total
    }));
  }
};