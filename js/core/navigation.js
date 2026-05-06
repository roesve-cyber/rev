// ===== CONTROL DE NAVEGACIÓN Y BOTÓN "ATRÁS" (PWA) =====

// ===== CONTROL DE NAVEGACIÓN Y BOTÓN "ATRÁS" (PWA) =====

window.navA = function(vistaId, isPopState = false) {
    // 1. Ocultar todas las vistas
    document.querySelectorAll('.vista').forEach(v => {
        v.classList.add('oculto');
        v.style.display = 'none';
    });

    // 2. Mostrar la vista solicitada
    const vistaDestino = document.getElementById(vistaId);
    if (vistaDestino) {
        vistaDestino.classList.remove('oculto');
        vistaDestino.style.display = 'block';
    }

    // 🌟 3. AUTO-RENDERIZAR (¡La pieza que nos faltaba!) 🌟
    // Esto asegura que al abrir una pantalla, sus datos se pinten inmediatamente
    try {
        if (vistaId === 'inventario' && typeof renderInventario === 'function') renderInventario();
        if (vistaId === 'tienda' && typeof renderTienda === 'function') renderTienda();
        if (vistaId === 'clientes' && typeof renderClientes === 'function') renderClientes();
        if (vistaId === 'proveedores' && typeof renderProveedores === 'function') renderProveedores();
        if (vistaId === 'cuentasxcobrar' && typeof renderCuentasXCobrar === 'function') renderCuentasXCobrar();
        if (vistaId === 'cobranzaesperada' && typeof renderCobranzaEsperada === 'function') renderCobranzaEsperada();
        if (vistaId === 'listaprecios' && typeof renderListaPrecios === 'function') renderListaPrecios();
        if (vistaId === 'entregas' && typeof renderEntregas === 'function') renderEntregas();
        if (vistaId === 'carrito' && typeof renderCarrito === 'function') renderCarrito();
        if (vistaId === 'cuentas-bancarias' && typeof renderCuentasBancarias === 'function') renderCuentasBancarias();
        if (vistaId === 'bancos' && typeof renderBancosConfig === 'function') renderBancosConfig();
        if (vistaId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    } catch(e) { console.warn("Aviso renderizando vista:", e); }

    // 4. RETRAER EL MENÚ AL SELECCIONAR ALGO
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    
    if (window.innerWidth < 1024) {
        // En celular: Siempre cerrar el menú
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
    } else {
        // En Computadora: Ocultar menú para pantalla completa
        const appContainer = document.getElementById('app-container');
        if (sidebar && !sidebar.classList.contains('oculto-desktop')) {
            sidebar.classList.add('oculto-desktop');
            if (appContainer) appContainer.classList.add('full-width');
        }
    }

    // 5. GUARDAR EN EL HISTORIAL (Protegido)
    if (!isPopState) {
        try { history.pushState({ vista: vistaId }, '', `#${vistaId}`); } catch (e) {}
    }
};

// ===== INTELIGENCIA DEL BOTÓN "ATRÁS" =====
window.addEventListener('popstate', (event) => {
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('active')) {
        window.toggleMenu(); 
        try { history.pushState({ vista: event.state ? event.state.vista : 'inicio' }, '', window.location.hash); } catch(e){}
        return;
    }

    const modalAbierto = document.querySelector('.modal:not(.oculto), [data-modal]');
    if (modalAbierto) {
        if (modalAbierto.id) {
            modalAbierto.classList.add('oculto');
            modalAbierto.style.display = 'none';
        } else {
            modalAbierto.remove(); 
        }
        try { history.pushState({ vista: event.state ? event.state.vista : 'inicio' }, '', window.location.hash); } catch(e){}
        return;
    }

    if (event.state && event.state.vista) {
        navA(event.state.vista, true);
    } else {
        navA('inicio', true);
    }
});

// Guardar la vista inicial cuando el sistema arranca
document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes("catalogo.html")) {
        try { history.replaceState({ vista: 'inicio' }, '', '#inicio'); } catch(e){}
    }
});

window.toggleMenu = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    const appContainer = document.getElementById('app-container');

    if (!sidebar) return;

    if (window.innerWidth >= 1024) {
        sidebar.classList.toggle('oculto-desktop');
        if (appContainer) {
            appContainer.classList.toggle('full-width');
        }
    } else {
        sidebar.classList.toggle('active');
        if (overlay) {
            overlay.classList.toggle('active');
        }
    }
};
// ===== CONTROL DE SUBMENÚS =====
window.toggleSubmenu = function(submenuId) {
    const submenu = document.getElementById(submenuId);
    if (submenu) {
        // Alterna la clase que oculta/muestra el submenú
        submenu.classList.toggle('oculto-submenu');
    }
};