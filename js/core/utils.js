function dinero(valor) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(valor || 0);
}

function mostrarVista(id) { navA(id); }

window.dinero = dinero;
window.mostrarVista = mostrarVista;
