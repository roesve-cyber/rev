function migrarStorageCuentasPorCobrar() {
    try {
        const legacyRaw = localStorage.getItem("cuentasPorCobrarCliente");
        if (!legacyRaw) return;
        const legacy = JSON.parse(legacyRaw);
        if (!Array.isArray(legacy) || legacy.length === 0) {
            localStorage.removeItem("cuentasPorCobrarCliente");
            return;
        }
        const actual = StorageService.get("cuentasPorCobrar", []);
        legacy.forEach((row) => {
            const saldoFin = row.precioContadoOriginal ?? row.totalContadoOriginal ?? row.saldoPendiente ?? 0;
            let fechaVentaIso = row.fechaVenta;
            if (!fechaVentaIso && typeof row.fecha === "string") {
                const partes = row.fecha.split("/");
                if (partes.length === 3) {
                    const d = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
                    if (!isNaN(d.getTime())) fechaVentaIso = d.toISOString();
                }
            }
            if (!fechaVentaIso) fechaVentaIso = new Date().toISOString();
            actual.push({
                folio: row.folio,
                nombre: row.clienteNombre || row.nombre || "Cliente",
                clienteId: row.clienteId,
                fechaVenta: fechaVentaIso,
                totalContadoOriginal: saldoFin,
                saldoActual: row.saldoPendiente ?? row.saldoActual ?? saldoFin,
                plan: row.plan || null,
                metodo: row.metodo || "credito",
                estado: row.estado || "Pendiente",
                abonos: Array.isArray(row.abonos) ? row.abonos : []
            });
        });
        if (!StorageService.set("cuentasPorCobrar", actual)) {
            console.warn("⚠️ No se pudo guardar migración");
            return;
        }
        localStorage.removeItem("cuentasPorCobrarCliente");
        cuentasPorCobrar = actual;
    } catch (e) {
        console.warn("⚠️ Error en migración:", e.message);
    }
}

window.migrarStorageCuentasPorCobrar = migrarStorageCuentasPorCobrar;
