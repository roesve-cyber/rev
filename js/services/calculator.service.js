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
  calcularCredito(precio) {
    let resultados = [];
    let totalAnterior = 0;
    for (let m = 1; m <= 6; m++) {
      let tasa = (m <= 3) ? 0.02 : 0.025;
      let totalBase = precio * (1 + (tasa * m));
      let semanas = m * 4;
      let pagoSemanal = totalBase / semanas;
      pagoSemanal = Math.ceil(pagoSemanal / 10) * 10;
      let totalFinal = pagoSemanal * semanas;
      let intentos = 0;
      while (totalFinal <= totalAnterior && intentos++ < 100) {
        pagoSemanal += 5;
        totalFinal = pagoSemanal * semanas;
      }
      if (intentos >= 100) continue;
      totalAnterior = totalFinal;
      resultados.push({ meses: m, semanas, abono: pagoSemanal, total: totalFinal });
    }
    return resultados;
  },
  calcularCreditoConPeriodicidad(precio, periodicidad = 'semanal') {
    const planesSemanales = this.calcularCredito(precio);
    let multiplicador = 1;
    if (periodicidad === 'quincenal') multiplicador = 2;
    if (periodicidad === 'mensual') multiplicador = 4;
    return planesSemanales.map(plan => ({
      meses: plan.meses,
      semanas: plan.semanas,
      pagos: Math.round(plan.semanas / multiplicador),
      abono: plan.abono * multiplicador,
      total: plan.total
    }));
  }
};

window.CalculatorService = CalculatorService;
