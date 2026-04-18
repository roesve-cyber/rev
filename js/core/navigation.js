// NAVEGACIÓN
function navA(vistaId) {
    const idLimpio = vistaId.toLowerCase();
    
    // Cerrar todos los modales abiertos
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('oculto');
        modal.style.display = 'none';
    });
    // Eliminar modales dinámicos del DOM
    document.querySelectorAll('[data-modal]').forEach(modal => modal.remove());
    
    document.querySelectorAll('.vista').forEach(v => {
        v.classList.add('oculto');
        v.style.display = 'none';
    });

    const destino = document.getElementById(idLimpio);
    if (destino) {
        destino.classList.remove('oculto');
        destino.style.display = 'block';

        if (idLimpio === 'inventario') renderInventario();
        if (idLimpio === 'proveedores') renderProveedores();
        if (idLimpio === 'clientes') renderClientes();
        if (idLimpio === 'configcategorias') renderCategorias();
        if (idLimpio === 'recepcion') renderRecepciones();
        if (idLimpio === 'cuentasporpagar') renderCuentasPorPagar();
        if (idLimpio === 'tienda') mostrarProductos();
        if (idLimpio === 'bancos') renderBancosConfig();
        if (idLimpio === 'flujo-msi') { renderDashboardMSI(); renderCuentasMSI(); }
        if (idLimpio === 'flujocaja') renderFlujoCaja();
        if (idLimpio === 'cuentas-bancarias') renderCuentasBancarias();
        if (idLimpio === 'compras') prepararVistaCompras();
        if (idLimpio === 'carrito') renderCarrito();
        if (idLimpio === 'cuentasxcobrar') renderCuentasXCobrar();
        if (idLimpio === 'cobranzaesperada') renderCobranzaEsperada();
        if (idLimpio === 'logistica') renderLogistica();
        if (idLimpio === 'listaprecios') renderListaPrecios();
        if (idLimpio === 'reporte-ventas') renderReporteVentas();
        if (idLimpio === 'reporte-compras') renderReporteCompras();
        if (idLimpio === 'reporte-flujo') renderReporteFlujo();
        if (idLimpio === 'entregas') renderEntregas();
        if (idLimpio === 'cuentas-bancarias') renderCuentasBancarias();
    }

    const sb = document.getElementById("sidebar");
    if (sb && sb.classList.contains("active")) {
        toggleMenu();
    }
}

function toggleMenu() {
    const sb = document.getElementById("sidebar");
    const ov = document.querySelector(".overlay");
    if (sb) {
        sb.classList.toggle("active");
        const isActive = sb.classList.contains("active");
        sb.style.left = isActive ? "0" : "-280px";
        if (ov) {
            ov.style.display = isActive ? "block" : "none";
            ov.classList.toggle("active", isActive);
        }
    }
}

function toggleSubmenu(id) {
    const sub = document.getElementById(id);
    if (sub) sub.classList.toggle("oculto-submenu");
}
