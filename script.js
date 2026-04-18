// ============================================================
// MUEBLERÍA MI PUEBLITO — script.js (VERSIÓN 2.0 REFACTORIZADA)
// ============================================================

// ===== STORAGESERVICE COMPLETO Y FUNCIONAL =====

const StorageService = {
    /**
     * Obtiene un valor del localStorage
     * @param {string} clave - Clave a obtener
     * @param {*} defaultValue - Valor por defecto si no existe
     * @returns {*} - Valor guardado o default
     */
    get(clave, defaultValue = []) {
        try {
            const valor = localStorage.getItem(clave);
            if (!valor) return defaultValue;
            return JSON.parse(valor) || defaultValue;
        } catch (e) {
            console.error(`❌ Error leyendo '${clave}':`, e.message);
            return defaultValue;
        }
    },

    /**
     * Guarda un valor en localStorage
     * @param {string} clave - Clave a guardar
     * @param {*} valor - Valor a guardar (se convierte a JSON)
     * @returns {boolean} - True si se guardó exitosamente
     */
    set(clave, valor) {
        try {
            localStorage.setItem(clave, JSON.stringify(valor));
            return true;
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.error(`❌ Error: localStorage lleno para '${clave}'`);
            } else {
                console.error(`❌ Error guardando '${clave}':`, e.message);
            }
            return false;
        }
    },

    /**
     * Elimina un valor del localStorage
     * @param {string} clave - Clave a eliminar
     * @returns {boolean} - True si se eliminó exitosamente
     */
    remove(clave) {
        try {
            localStorage.removeItem(clave);
            return true;
        } catch (e) {
            console.error(`❌ Error eliminando '${clave}':`, e.message);
            return false;
        }
    },

    /**
     * Calcula el uso total de localStorage en bytes
     * @returns {number} - Uso en bytes
     */
    getUsageBytes() {
        let total = 0;
        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    // Usar Blob para cálculo preciso de UTF-8
                    total += new Blob([key + value]).size;
                }
            }
        } catch (e) {
            console.warn("⚠️ Error calculando uso de localStorage:", e.message);
        }
        return total;
    },

    /**
     * Calcula el uso total de localStorage en KB
     * @returns {string} - Uso en KB con 2 decimales
     */
    getUsageKB() {
        const bytes = this.getUsageBytes();
        return (bytes / 1024).toFixed(2);
    },

    /**
     * Calcula el uso total de localStorage en MB
     * @returns {string} - Uso en MB con 4 decimales
     */
    getUsageMB() {
        const bytes = this.getUsageBytes();
        return (bytes / (1024 * 1024)).toFixed(4);
    },

    /**
     * Obtiene información completa del uso de localStorage
     * @returns {Object} - Objeto con información de uso
     */
    getUsageInfo() {
        const bytes = this.getUsageBytes();
        const kb = bytes / 1024;
        const mb = kb / 1024;
        const limiteAproximado = 5 * 1024; // 5MB típico en navegadores
        const porcentaje = ((bytes / (limiteAproximado * 1024)) * 100).toFixed(1);

        return {
            bytes: bytes,
            kb: kb.toFixed(2),
            mb: mb.toFixed(4),
            porcentaje: porcentaje,
            limite: "5 MB (aproximado)",
            mensaje: `${kb.toFixed(2)} KB de aproximadamente ${limiteAproximado} MB (${porcentaje}%)`
        };
    },

    /**
     * Obtiene el número de items guardados
     * @returns {number} - Cantidad de items
     */
    getItemCount() {
        return Object.keys(localStorage).length;
    },

    /**
     * Lista todas las claves guardadas
     * @returns {Array} - Array de claves
     */
    getAllKeys() {
        return Object.keys(localStorage);
    },

    /**
     * Limpia todo localStorage
     * @returns {boolean} - True si se limpió exitosamente
     */
    clearAll() {
        try {
            localStorage.clear();
            console.log("✅ localStorage limpiado completamente");
            return true;
        } catch (e) {
            console.error("❌ Error limpiando localStorage:", e.message);
            return false;
        }
    },

    /**
     * Obtiene un resumen de todos los datos guardados
     * @returns {Object} - Resumen con tamaños de cada clave
     */
    getSummary() {
        const summary = {};
        let totalBytes = 0;

        try {
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    const value = localStorage.getItem(key);
                    const size = new Blob([key + value]).size;
                    summary[key] = {
                        bytes: size,
                        kb: (size / 1024).toFixed(2)
                    };
                    totalBytes += size;
                }
            }
        } catch (e) {
            console.warn("⚠️ Error obteniendo resumen:", e.message);
        }

        return {
            items: summary,
            totalBytes: totalBytes,
            totalKB: (totalBytes / 1024).toFixed(2),
            count: Object.keys(summary).length
        };
    }
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

// Variables globales
let categoriasData = StorageService.get("categoriasData", [
    { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
    { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
]);

let tarjetasConfig = StorageService.get("tarjetasConfig", [
    { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
    { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
]);

// Si tarjetasConfig está vacío, inicializalo con valores por defecto
if (!tarjetasConfig || tarjetasConfig.length === 0) {
    tarjetasConfig = [
        { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
        { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
    ];
    StorageService.set("tarjetasConfig", tarjetasConfig);
    console.log("✅ tarjetasConfig inicializado con valores por defecto");
}

let productos = StorageService.get("productos", []);
let proveedores = StorageService.get("proveedores", []);
let clientes = StorageService.get("clientes", []);
let carrito = StorageService.get("carrito", []);
let movimientosInventario = StorageService.get("movimientosInventario", []);
let recepciones = StorageService.get("recepciones", []);
let compras = StorageService.get("compras", []);
let cuentasPorPagar = StorageService.get("cuentasPorPagar", []);
let deudasMSI = StorageService.get("deudasMSI", []);
let cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
let movimientosCaja = StorageService.get("movimientosCaja", []);
let requisicionesCompra = StorageService.get("requisicionesCompra", []);
let salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
let pagaresSistema = StorageService.get("pagaresSistema", []);

let plazoSeleccionado = null;
let productoEditando = null;
let productoActualId = null;
let clienteEditandoId = null;
let clienteSeleccionado = null;
let _planElegidoPendiente = null;
let decisionesInventario = {};

// Funciones utilidades
function dinero(valor) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(valor || 0);
}

function mostrarVista(id) { navA(id); }

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
        if (idLimpio === 'compras') prepararVistaCompras();
        if (idLimpio === 'carrito') renderCarrito();
        if (idLimpio === 'cuentasxcobrar') renderCuentasXCobrar();
        if (idLimpio === 'cobranzaesperada') renderCobranzaEsperada();
        if (idLimpio === 'logistica') renderLogistica();
        if (idLimpio === 'listaprecios') renderListaPrecios();
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

// FILTROS DE INVENTARIO
function aplicarFiltros() {
    const catFiltro = document.getElementById("filtroCategoria").value;
    const subFiltro = document.getElementById("filtroSubcategoria").value;
    const busqueda = document.getElementById("busquedaProducto").value.toLowerCase();

    const filtrados = productos.filter(p => {
        const coincideCat = (catFiltro === "todos" || p.categoria === catFiltro);
        const coincideSub = (subFiltro === "todos" || p.subcategoria === subFiltro);
        const coincideNombre = p.nombre.toLowerCase().includes(busqueda);
        return coincideCat && coincideSub && coincideNombre;
    });

    renderInventario(filtrados);
}

function actualizarSubcategoriasFiltro(catId, subId) {
    const catNombre = document.getElementById(catId).value;
    const comboSub = document.getElementById(subId);
    comboSub.innerHTML = '<option value="todos">-- Todas --</option>';

    if (catNombre !== "todos") {
        const categoriaDoc = categoriasData.find(c => c.nombre === catNombre);
        if (categoriaDoc && categoriaDoc.subcategorias) {
            categoriaDoc.subcategorias.forEach(sub => {
                const nombreSub = typeof sub === 'string' ? sub : sub.nombre;
                comboSub.innerHTML += `<option value="${nombreSub}">${nombreSub}</option>`;
            });
        }
    }
    aplicarFiltros();
}

function limpiarFiltros() {
    document.getElementById("filtroCategoria").value = "todos";
    document.getElementById("filtroSubcategoria").innerHTML = '<option value="todos">-- Todas --</option>';
    document.getElementById("busquedaProducto").value = "";
    renderInventario(productos);
}

function actualizarCombosFiltros() {
    const filtroCat = document.getElementById("filtroCategoria");
    const filtroSub = document.getElementById("filtroSubcategoria");
    if (!filtroCat) return;

    const catPrevia = filtroCat.value;
    const subPrevia = filtroSub ? filtroSub.value : "todos";

    let htmlCat = '<option value="todos">-- Todas las Categorías --</option>';
    categoriasData.forEach(cat => {
        htmlCat += `<option value="${cat.nombre}">${cat.nombre}</option>`;
    });
    filtroCat.innerHTML = htmlCat;
    filtroCat.value = catPrevia || "todos";

    if (filtroSub) {
        let htmlSub = '<option value="todos">-- Todas las Subcategorías --</option>';
        if (filtroCat.value !== "todos") {
            const catInfo = categoriasData.find(c => c.nombre === filtroCat.value);
            if (catInfo && catInfo.subcategorias) {
                catInfo.subcategorias.forEach(sub => {
                    htmlSub += `<option value="${sub.nombre}">${sub.nombre}</option>`;
                });
            }
        }
        filtroSub.innerHTML = htmlSub;
        filtroSub.value = subPrevia || "todos";
    }
}

// ============================================================
// MUEBLERÍA MI PUEBLITO — script.js (PARTE 2 - FUNCIONES COMPLETAS)
// ============================================================

// ===== INVENTARIO =====
function renderInventario(listaAMostrar = productos) {
    const cont = document.getElementById("listaInventario");
    if (!cont) return;

    actualizarCombosFiltros();

    let html = `
        <table class="tabla-admin">
            <thead>
                <tr>
                    <th>Producto</th>
                    <th style="text-align:center;">Stock</th>
                    <th style="text-align:right;">Precio</th>
                    <th style="text-align:center;">Acciones</th>
                </tr>
            </thead>
            <tbody>`;

    if (listaAMostrar.length === 0) {
        html += `<tr><td colspan="4" style="text-align:center; color:gray; padding:20px;">No se encontraron productos.</td></tr>`;
    } else {
        listaAMostrar.forEach(p => {
            const stock = p.stock || 0;
            const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
            html += `
                <tr>
                    <td>
                        <b>${p.nombre}</b><br>
                        <small style="color:#666;">${p.categoria || ''} > ${p.subcategoria || ''}</small>
                    </td>
                    <td style="text-align:center; font-weight:bold; color:${colorStock};">${stock}</td>
                    <td style="text-align:right;">${dinero(p.precio)}</td>
                    <td style="text-align:center; display:flex; gap:5px; justify-content:center;">
                        <button onclick="abrirProductoForm(${p.id})" 
                                style="padding:6px 10px; cursor:pointer; background:#3498db; color:white; border:none; border-radius:4px; font-weight:bold;">
                            ✏️ Editar
                        </button>
                        <button onclick="abrirVisorMaestro(${p.id})" 
                                style="padding:6px 10px; cursor:pointer; background:#2c3e50; color:white; border:none; border-radius:4px; font-weight:bold;">
                            🔍 Visor
                        </button>
                        <button onclick="confirmarEliminarProducto(${p.id})" 
                                style="padding:6px 10px; cursor:pointer; background:#e74c3c; color:white; border:none; border-radius:4px; font-weight:bold;">
                            🗑️ Eliminar
                        </button>
                    </td>
                </tr>`;
        });
    }

    html += `</tbody></table>`;
    cont.innerHTML = html;
}

function confirmarEliminarProducto(id) {
    const producto = productos.find(p => p.id === id);
    if (!producto) {
        alert("Producto no encontrado.");
        return;
    }

    const mensaje = `⚠️ ¿Eliminar producto: "${producto.nombre}"?\n\nEsta acción no se puede deshacer.`;
    
    if (confirm(mensaje)) {
        eliminarProducto(id);
    }
}

function actualizarStock(id, cant, concepto) {
    const idx = productos.findIndex(p => p.id === id);
    if (idx !== -1) {
        productos[idx].stock = (productos[idx].stock || 0) + cant;
        registrarMovimiento(id, concepto, cant, "entrada");
        if (!StorageService.set("productos", productos)) {
            console.error("❌ Error guardando productos");
        }
    }
}

function registrarMovimiento(productoId, concepto, cantidad, tipo) {
    const movimiento = {
        id: Date.now(),
        productoId: productoId,
        fecha: new Date().toLocaleString(),
        concepto: concepto,
        cantidad: Math.abs(cantidad),
        tipo: tipo
    };
    movimientosInventario.push(movimiento);
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
    }
}

function eliminarProducto(id) {
    productos = productos.filter(p => p.id !== id);
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error eliminando producto");
        return;
    }
    renderInventario();
}

// ===== FORMULARIO DE PRODUCTOS =====
function actualizarSelectorCategorias() {
    const select = document.getElementById("pSubcategoria");
    if (!select) return;
    let options = "";
    categoriasData.forEach(cat => {
        cat.subcategorias.forEach(sub => {
            options += `<option value="${sub.nombre}">${cat.nombre} - ${sub.nombre} (${sub.margen}%)</option>`;
        });
    });
    select.innerHTML = options || "<option>Crea una categoría primero</option>";
}

function abrirProductoForm(id = null) {
    actualizarSelectorCategorias();
    const modal = document.getElementById("modalProductoForm");
    if (!modal) return;

    const inputNombre = document.getElementById("pNombre");
    const inputCosto  = document.getElementById("pCosto");
    const inputPrecio = document.getElementById("pPrecio");
    const inputColor  = document.getElementById("pColor");
    const inputMarca  = document.getElementById("pMarca");
    const inputModelo = document.getElementById("pModelo");
    const inputImagen = document.getElementById("pImagen");
    const inputSub    = document.getElementById("pSubcategoria");

    if (id) {
        productoEditando = id;
        const p = productos.find(prod => prod.id === id);
        if (!p) return;
        document.getElementById("tituloModalProducto").innerText = "✏️ Editar Producto";
        inputNombre.value = p.nombre;
        inputCosto.value  = p.costo || 0;
        if (inputPrecio) inputPrecio.value = p.precio != null ? p.precio : "";
        inputColor.value = p.color || '';
        inputMarca.value = p.marca || '';
        inputModelo.value = p.modelo || '';
        inputImagen.value = p.imagen || '';
        inputSub.value    = p.subcategoria || '';
    } else {
        productoEditando = null;
        document.getElementById("tituloModalProducto").innerText = "📦 Nuevo Producto";
        inputNombre.value = "";
        inputCosto.value  = "";
        if (inputPrecio) inputPrecio.value = "";
        inputColor.value = "";
        inputMarca.value = "";
        inputModelo.value = "";
        inputImagen.value = "";
    }
    modal.classList.remove("oculto");
    modal.style.display = 'flex';
}

function guardarProductoDB() {
    const nombre      = document.getElementById("pNombre").value.trim();
    const costo       = parseFloat(document.getElementById("pCosto").value);
    const precioManual = parseFloat(document.getElementById("pPrecio").value);
    const color       = document.getElementById("pColor").value.trim();
    const marca       = document.getElementById("pMarca").value.trim();
    const modelo      = document.getElementById("pModelo").value.trim();
    const imagen      = document.getElementById("pImagen").value.trim();
    const subcatNombre = document.getElementById("pSubcategoria").value;

    const validacion = ValidatorService.validarProducto({
        nombre, costo, precio: precioManual
    });

    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    let margenFinal = 30;
    categoriasData.forEach(cat => {
        const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
        if (sub) margenFinal = sub.margen;
    });

    const precioVenta = precioManual;

    let categoriaPadre = '';
    categoriasData.forEach(cat => {
        if (cat.subcategorias.find(s => s.nombre === subcatNombre)) {
            categoriaPadre = cat.nombre;
        }
    });

    if (productoEditando) {
        const index = productos.findIndex(p => p.id === productoEditando);
        const margenCalculado = CalculatorService.calcularMargen(precioVenta, costo);
        if (index !== -1) {
            productos[index] = {
                ...productos[index],
                nombre, costo,
                margen: margenCalculado,
                precio: precioVenta,
                color, marca, modelo,
                imagen,
                categoria: categoriaPadre,
                subcategoria: subcatNombre
            };
        }
    } else {
        const margenCalculado = CalculatorService.calcularMargen(precioVenta, costo);
        productos.push({
            id: Date.now(),
            nombre,
            costo,
            margen: margenCalculado,
            precio: precioVenta,
            color, marca, modelo,
            imagen,
            categoria: categoriaPadre,
            subcategoria: subcatNombre,
            stock: 0
        });
    }

    if (!StorageService.set("productos", productos)) {
        alert("❌ Error guardando producto");
        return;
    }

    cerrarProductoForm();
    renderInventario();
    mostrarProductos();
}

function cerrarProductoForm() {
    const modal = document.getElementById("modalProductoForm");
    if (modal) {
        modal.classList.add("oculto");
        modal.style.display = 'none';
    }
    productoEditando = null;
}

// ===== CÁLCULO AUTOMÁTICO EN FORMULARIO DE PRODUCTOS =====
document.addEventListener('input', (e) => {
    const modal = document.getElementById("modalProductoForm");
    if (!modal || modal.style.display === 'none') {
        return;
    }

    const idElemento = e.target.id;
    
    if (!['pCosto', 'pPrecio', 'pMargenManual', 'pSubcategoria'].includes(idElemento)) {
        return;
    }

    const costo = parseFloat(document.getElementById("pCosto")?.value) || 0;
    const precioActual = parseFloat(document.getElementById("pPrecio")?.value) || 0;
    const margenActual = parseFloat(document.getElementById("pMargenManual")?.value) || 0;
    const subcatNombre = document.getElementById("pSubcategoria")?.value || '';

    let margenCategoria = 30;
    categoriasData.forEach(cat => {
        const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
        if (sub) margenCategoria = sub.margen;
    });

    if (idElemento === "pCosto") {
        if (costo === 0) return;
        
        const margenAUsar = margenActual > 0 ? margenActual : margenCategoria;
        const precioCalculado = CalculatorService.calcularPrecioDesdeMargen(costo, margenAUsar);
        
        document.getElementById("pPrecio").value = precioCalculado;
        document.getElementById("pMargenManual").value = margenAUsar;
        
        actualizarDisplayProducto(costo, precioCalculado, margenAUsar);
        return;
    }

    if (idElemento === "pPrecio") {
        if (costo === 0 || precioActual === 0) return;
        
        const margenCalculado = CalculatorService.calcularMargen(precioActual, costo);
        
        document.getElementById("pMargenManual").value = margenCalculado.toFixed(1);
        
        actualizarDisplayProducto(costo, precioActual, margenCalculado);
        return;
    }

    if (idElemento === "pMargenManual") {
        if (costo === 0 || margenActual === 0) return;
        
        const precioRecalculado = CalculatorService.calcularPrecioDesdeMargen(costo, margenActual);
        
        document.getElementById("pPrecio").value = precioRecalculado;
        
        actualizarDisplayProducto(costo, precioRecalculado, margenActual);
        return;
    }

    if (idElemento === "pSubcategoria") {
        if (costo === 0) return;
        
        if (margenActual === 0 || margenActual === "") {
            let nuevoMargen = 30;
            categoriasData.forEach(cat => {
                const sub = cat.subcategorias.find(s => s.nombre === subcatNombre);
                if (sub) nuevoMargen = sub.margen;
            });
            
            const precioNuevo = CalculatorService.calcularPrecioDesdeMargen(costo, nuevoMargen);
            
            document.getElementById("pPrecio").value = precioNuevo;
            document.getElementById("pMargenManual").value = nuevoMargen;
            
            actualizarDisplayProducto(costo, precioNuevo, nuevoMargen);
        }
        return;
    }
});

function actualizarDisplayProducto(costo, precio, margen) {
    const ganancia = precio - costo;
    const margenPct = precio > 0 ? parseFloat(margen).toFixed(1) : 0;
    
    const lblMargen = document.getElementById("lblMargenAplicado");
    const lblPrecio = document.getElementById("lblPrecioSugerido");
    const lblGanancia = document.getElementById("lblGananciaPesos");
    
    if (lblMargen) {
        lblMargen.innerText = margenPct;
        if (margenPct < 20) {
            lblMargen.style.color = "#e74c3c";
        } else if (margenPct <= 35) {
            lblMargen.style.color = "#f39c12";
        } else {
            lblMargen.style.color = "#27ae60";
        }
    }
    
    if (lblPrecio) {
        lblPrecio.innerText = dinero(precio);
    }
    
    if (lblGanancia) {
        lblGanancia.innerText = dinero(ganancia > 0 ? ganancia : 0);
        lblGanancia.style.color = ganancia > 0 ? "#27ae60" : "#e74c3c";
    }
}

// ===== TIENDA / CATÁLOGO CON FILTROS COMO ENCABEZADOS (SIN TÍTULO EXTRA) =====
function mostrarProductos() {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    // Crear encabezado con filtros (sin título extra)
    let html = `
        <div style="grid-column: 1/-1; background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
           
            
            <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: flex-end;">
                
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">📦 Categoría</label>
                    <select id="filtroCatalogoCategoria" onchange="filtrarCatalogo()" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                        <option value="">-- Todas las Categorías --</option>
                    </select>
                </div>
                
                <div>
                    <label style="display: block; font-weight: bold; color: rgba(255,255,255,0.9); margin-bottom: 8px; font-size: 13px;">🏷️ Subcategoría</label>
                    <select id="filtroCatalogoSubcategoria" onchange="filtrarCatalogo()" style="width: 100%; padding: 10px; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                        <option value="">-- Todas las Subcategorías --</option>
                    </select>
                </div>
                
                <div>
                    <button onclick="limpiarFiltrosCatalogo()" style="padding: 10px 20px; background: rgba(255,255,255,0.2); color: white; border: 2px solid white; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; transition: all 0.2s;">
                        🔄 Limpiar
                    </button>
                </div>
                
            </div>
        </div>
    `;

    contenedor.innerHTML = html;

    // Llenar categorías
    let categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
    let selectCategorias = '<option value="">-- Todas las Categorías --</option>';
    categorias.forEach(cat => {
        selectCategorias += `<option value="${cat}">${cat}</option>`;
    });

    // Llenar subcategorías (todas inicialmente)
    let subcategorias = [...new Set(productos.map(p => p.subcategoria).filter(Boolean))].sort();
    let selectSubcategorias = '<option value="">-- Todas las Subcategorías --</option>';
    subcategorias.forEach(subcat => {
        selectSubcategorias += `<option value="${subcat}">${subcat}</option>`;
    });

    document.getElementById('filtroCatalogoCategoria').innerHTML = selectCategorias;
    document.getElementById('filtroCatalogoSubcategoria').innerHTML = selectSubcategorias;

    // Mostrar productos
    renderProductosCatalogo(productos);
}

/**
 * Filtra los productos del catálogo según categoría y subcategoría
 */
function filtrarCatalogo() {
    const categoria = document.getElementById('filtroCatalogoCategoria')?.value || '';
    const subcategoria = document.getElementById('filtroCatalogoSubcategoria')?.value || '';

    // Si cambia categoría, actualizar subcategorías disponibles
    if (categoria) {
        actualizarSubcategoriasCatalogo(categoria);
    }

    // Filtrar productos
    let filtrados = productos;

    if (categoria) {
        filtrados = filtrados.filter(p => p.categoria === categoria);
    }

    if (subcategoria) {
        filtrados = filtrados.filter(p => p.subcategoria === subcategoria);
    }

    renderProductosCatalogo(filtrados);
}

/**
 * Actualiza las subcategorías disponibles según la categoría seleccionada
 */
function actualizarSubcategoriasCatalogo(categoriaSeleccionada) {
    const selectSub = document.getElementById('filtroCatalogoSubcategoria');
    if (!selectSub) return;

    // Obtener subcategorías de la categoría seleccionada
    let subcategoriasDisponibles = [...new Set(
        productos
            .filter(p => p.categoria === categoriaSeleccionada)
            .map(p => p.subcategoria)
            .filter(Boolean)
    )].sort();

    // Reconstruir select
    selectSub.innerHTML = '<option value="">-- Todas las Subcategorías --</option>';
    subcategoriasDisponibles.forEach(subcat => {
        selectSub.innerHTML += `<option value="${subcat}">${subcat}</option>`;
    });
}

/**
 * Limpia todos los filtros
 */
function limpiarFiltrosCatalogo() {
    document.getElementById('filtroCatalogoCategoria').value = '';
    document.getElementById('filtroCatalogoSubcategoria').value = '';
    
    // Restaurar todas las subcategorías
    let subcategorias = [...new Set(productos.map(p => p.subcategoria).filter(Boolean))].sort();
    let selectSub = document.getElementById('filtroCatalogoSubcategoria');
    selectSub.innerHTML = '<option value="">-- Todas las Subcategorías --</option>';
    subcategorias.forEach(subcat => {
        selectSub.innerHTML += `<option value="${subcat}">${subcat}</option>`;
    });
    
    renderProductosCatalogo(productos);
}

/**
 * Renderiza los productos en grid automático
 */
function renderProductosCatalogo(listaProductos) {
    const contenedor = document.getElementById("gridProductos");
    if (!contenedor) return;

    if (listaProductos.length === 0) {
        contenedor.innerHTML += `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: #718096;">
                <h3 style="font-size: 24px; margin-bottom: 10px;">📭 Sin productos</h3>
                <p>No hay productos que coincidan con los filtros seleccionados.</p>
            </div>`;
        return;
    }

    listaProductos.forEach(p => {
        const precio = p.precio || 0;
        const planes = CalculatorService.calcularCredito(precio);
        const plan6  = planes[5] || planes[0];
        const abono  = plan6 ? plan6.abono : 0;

        const cardHTML = `
            <div class="card-producto">
                <div class="card-producto-imagen">
                    <img src="${p.imagen || ''}" alt="${p.nombre}" onerror="this.parentElement.innerHTML='<div style=&quot;display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color:#bdc3c7;&quot;><span style=&quot;font-size:48px;&quot;>📦</span><p>Sin imagen</p></div>'">
                </div>
                <div class="card-producto-contenido">
                    <h3 class="card-producto-nombre">${p.nombre}</h3>
                    <div class="card-producto-precio">
                        <small class="precio-contado">Precio contado</small>
                        <p class="precio-valor">${dinero(precio)}</p>
                        <small class="precio-semanal">Desde ${dinero(abono)}/semana (${plan6.meses} meses)</small>
                    </div>
                    <div class="card-producto-acciones">
                        <button onclick="verProducto(${p.id})">👁️ Detalles</button>
                    </div>
                </div>
            </div>
        `;

        contenedor.innerHTML += cardHTML;
    });
}
// ===== MODAL DE PRODUCTO DETALLADO (CON SIMULADOR DE ENGANCHE) =====
function verProducto(id) {
    const p = productos.find(x => x.id == id);
    if (!p) return;
    productoActualId = id;

    const modal = document.getElementById("modalProducto");
    const contenido = document.getElementById("contenidoProducto");
    if (!modal || !contenido) return;

    const planes = CalculatorService.calcularCredito(p.precio);
    let tablaHtml = "";
    planes.forEach(plan => {
        tablaHtml += `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px; text-align: center; font-weight: 600;">${plan.meses}</td>
                <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: bold;">${dinero(plan.total)}</td>
                <td style="padding: 12px; text-align: center; color: #3498db; font-weight: 600;">${dinero(plan.abono)}</td>
            </tr>`;
    });

    contenido.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; height: 90vh; max-height: 90vh;">
            
            <!-- IMAGEN CON ZOOM -->
            <div class="modal-header-zoom" style="position: relative; overflow: hidden; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); display: flex; justify-content: center; align-items: center; height: 100%;">
                <div style="position: relative; width: 100%; height: 100%; cursor: zoom-in; overflow: auto;" id="zoomContainer">
                    <img id="imgModal" src="${p.imagen || ''}" alt="${p.nombre}" 
                         style="width: 100%; height: 100%; object-fit: contain; padding: 20px; transition: transform 0.1s ease-out; transform: scale(1);"
                         onerror="this.parentElement.innerHTML='<div style=&quot;display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100%; color:#bdc3c7;&quot;><span style=&quot;font-size:80px;&quot;>📦</span><p>Sin imagen</p></div>'">
                </div>
                <div style="position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.6); color: white; padding: 8px 12px; border-radius: 6px; font-size: 12px; font-weight: bold;">
                    🔍 Zoom interactivo
                </div>
            </div>

            <!-- INFORMACIÓN (SCROLLEABLE) -->
            <div style="display: flex; flex-direction: column; padding: 30px; background: white; overflow-y: auto; max-height: 90vh;">
                
                <h2 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 28px;">${p.nombre}</h2>
                
                ${p.color || p.marca || p.modelo ? `
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;">
                        ${p.color ? `<div><small style="color: #718096; text-transform: uppercase; font-weight: 600;">Color</small><br><strong style="color: #2c3e50;">${p.color}</strong></div>` : ''}
                        ${p.marca ? `<div><small style="color: #718096; text-transform: uppercase; font-weight: 600;">Marca</small><br><strong style="color: #2c3e50;">${p.marca}</strong></div>` : ''}
                        ${p.modelo ? `<div><small style="color: #718096; text-transform: uppercase; font-weight: 600;">Modelo</small><br><strong style="color: #2c3e50;">${p.modelo}</strong></div>` : ''}
                    </div>
                ` : ''}

                <!-- PRECIO DESTACADO -->
                <div style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center;">
                    <small style="opacity: 0.9; text-transform: uppercase; letter-spacing: 1px;">Precio al Contado</small>
                    <h3 style="margin: 10px 0; font-size: 32px;">${dinero(p.precio)}</h3>
                </div>

                <!-- SIMULADOR DE ENGANCHE -->
                <div style="background: #fffbeb; border: 2px solid #f59e0b; padding: 15px; border-radius: 10px; margin-bottom: 20px;">
                    <h4 style="margin: 0 0 12px 0; color: #92400e; font-size: 14px;">💡 Simula tu Enganche</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                        <div>
                            <label style="font-size: 12px; color: #92400e; font-weight: bold;">Enganche ($):</label>
                            <input type="number" id="engancheSimulado" 
                                   min="0" 
                                   max="${p.precio}" 
                                   value="0" 
                                   placeholder="0"
                                   onchange="actualizarSimuladorEnganche(${p.precio})"
                                   oninput="actualizarSimuladorEnganche(${p.precio})"
                                   style="width: 100%; padding: 10px; border: 2px solid #f59e0b; border-radius: 6px; font-size: 14px; font-weight: bold; color: #92400e;">
                        </div>
                        <div>
                            <label style="font-size: 12px; color: #92400e; font-weight: bold;">Porcentaje:</label>
                            <input type="number" id="porcentajeEnganche" 
                                   min="0" 
                                   max="100" 
                                   value="0" 
                                   placeholder="0%"
                                   onchange="actualizarSimuladorPorcentaje(${p.precio})"
                                   oninput="actualizarSimuladorPorcentaje(${p.precio})"
                                   style="width: 100%; padding: 10px; border: 2px solid #f59e0b; border-radius: 6px; font-size: 14px; font-weight: bold; color: #92400e;">
                        </div>
                    </div>
                    <div id="resumenEnganche" style="background: white; padding: 12px; border-radius: 6px; text-align: center; font-size: 13px;">
                        <small style="color: #78350f;">Saldo a financiar: <strong style="color: #f59e0b; font-size: 16px;">${dinero(p.precio)}</strong></small>
                    </div>
                </div>

                <!-- PLANES DE CRÉDITO CON SIMULACIÓN -->
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 16px;">💳 Planes de Financiamiento</h4>
                    <table style="width: 100%; border-collapse: collapse;" id="tablaPlanesSimulada">
                        <thead>
                            <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Meses</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Total</th>
                                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Abono Semanal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tablaHtml}
                        </tbody>
                    </table>
                </div>

                <!-- BOTONES (PEGADOS AL FONDO) -->
                <div style="display: flex; gap: 10px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; position: sticky; bottom: 0; background: white;">
                    <button onclick="agregarAlCarritoDesdeModal()" 
                            style="flex: 1; padding: 14px; background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(39, 174, 96, 0.2);">
                        🛒 Agregar al Carrito
                    </button>
                    <button onclick="cerrarProducto()" 
                            style="flex: 1; padding: 14px; background: #e2e8f0; color: #2c3e50; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 16px; transition: all 0.2s;">
                        ✕ Cerrar
                    </button>
                </div>

            </div>
        </div>
    `;

    modal.classList.remove("oculto");
    modal.style.display = 'flex';

    // Zoom interactivo mejorado
    setTimeout(() => {
        const img = document.getElementById('imgModal');
        const container = document.getElementById('zoomContainer');
        
        if (img && container) {
            let isZoomed = false;

            container.addEventListener('mousemove', (e) => {
                if (!isZoomed) return;

                const rect = container.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;

                img.style.transformOrigin = `${x}% ${y}%`;
                img.style.transform = "scale(2.5)";
            });

            container.addEventListener('mouseleave', () => {
                img.style.transform = "scale(1)";
                img.style.transformOrigin = "center";
            });

            container.addEventListener('click', () => {
                isZoomed = !isZoomed;
                if (isZoomed) {
                    img.style.transform = "scale(2.5)";
                    container.style.cursor = "zoom-out";
                } else {
                    img.style.transform = "scale(1)";
                    container.style.cursor = "zoom-in";
                }
            });

            // Scroll para zoom
            container.addEventListener('wheel', (e) => {
                e.preventDefault();
                const currentScale = img.style.transform.match(/scale\(([\d.]+)\)/)?.[1] || 1;
                let newScale = parseFloat(currentScale) + (e.deltaY > 0 ? -0.1 : 0.1);
                newScale = Math.max(1, Math.min(3, newScale));
                img.style.transform = `scale(${newScale})`;
            });
        }
    }, 100);
}

// ===== SIMULADOR DE ENGANCHE =====
/**
 * Actualiza la simulación de enganche cuando el usuario ingresa un monto
 * @param {number} precioTotal - Precio original del producto
 */
function actualizarSimuladorEnganche(precioTotal) {
    const engancheInput = document.getElementById("engancheSimulado");
    const porcentajeInput = document.getElementById("porcentajeEnganche");
    const resumenDiv = document.getElementById("resumenEnganche");
    const tablaPlanesDiv = document.getElementById("tablaPlanesSimulada");
    
    if (!engancheInput) return;
    
    const enganche = parseFloat(engancheInput.value) || 0;
    const saldoFinanciar = Math.max(0, precioTotal - enganche);
    
    // Validar que no supere el precio total
    if (enganche > precioTotal) {
        engancheInput.value = precioTotal;
        return;
    }
    
    // Actualizar porcentaje
    const porcentaje = precioTotal > 0 ? ((enganche / precioTotal) * 100).toFixed(1) : 0;
    if (porcentajeInput) {
        porcentajeInput.value = porcentaje;
    }
    
    // Actualizar resumen
    if (resumenDiv) {
        resumenDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div>
                    <small style="color: #78350f;">Enganche:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${dinero(enganche)}</strong>
                </div>
                <div>
                    <small style="color: #78350f;">Porcentaje:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${porcentaje}%</strong>
                </div>
                <div>
                    <small style="color: #78350f;">A Financiar:</small><br>
                    <strong style="color: #27ae60; font-size: 16px;">${dinero(saldoFinanciar)}</strong>
                </div>
            </div>
        `;
    }
    
    // Actualizar tabla de planes
    actualizarTablaPlanesSimulada(saldoFinanciar, tablaPlanesDiv);
}

/**
 * Actualiza la simulación de enganche cuando el usuario ingresa un porcentaje
 * @param {number} precioTotal - Precio original del producto
 */
function actualizarSimuladorPorcentaje(precioTotal) {
    const engancheInput = document.getElementById("engancheSimulado");
    const porcentajeInput = document.getElementById("porcentajeEnganche");
    const resumenDiv = document.getElementById("resumenEnganche");
    const tablaPlanesDiv = document.getElementById("tablaPlanesSimulada");
    
    if (!porcentajeInput) return;
    
    const porcentaje = parseFloat(porcentajeInput.value) || 0;
    let enganche = (porcentaje / 100) * precioTotal;
    enganche = Math.min(enganche, precioTotal);
    enganche = Math.max(0, enganche);
    
    // Validar porcentaje
    if (porcentaje > 100) {
        porcentajeInput.value = 100;
        enganche = precioTotal;
    }
    
    if (porcentaje < 0) {
        porcentajeInput.value = 0;
        enganche = 0;
    }
    
    const saldoFinanciar = Math.max(0, precioTotal - enganche);
    
    // Actualizar enganche
    if (engancheInput) {
        engancheInput.value = enganche.toFixed(2);
    }
    
    // Actualizar resumen
    if (resumenDiv) {
        resumenDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                <div>
                    <small style="color: #78350f;">Enganche:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${dinero(enganche)}</strong>
                </div>
                <div>
                    <small style="color: #78350f;">Porcentaje:</small><br>
                    <strong style="color: #f59e0b; font-size: 16px;">${porcentaje}%</strong>
                </div>
                <div>
                    <small style="color: #78350f;">A Financiar:</small><br>
                    <strong style="color: #27ae60; font-size: 16px;">${dinero(saldoFinanciar)}</strong>
                </div>
            </div>
        `;
    }
    
    // Actualizar tabla de planes
    actualizarTablaPlanesSimulada(saldoFinanciar, tablaPlanesDiv);
}

/**
 * Actualiza la tabla de planes según el saldo a financiar
 * @param {number} saldoFinanciar - Monto a financiar después del enganche
 * @param {HTMLElement} tablaPlanesDiv - Contenedor de la tabla
 */
function actualizarTablaPlanesSimulada(saldoFinanciar, tablaPlanesDiv) {
    if (!tablaPlanesDiv || saldoFinanciar <= 0) return;
    
    // Si no hay saldo a financiar, mostrar solo enganche
    if (saldoFinanciar === 0) {
        tablaPlanesDiv.innerHTML = `
            <thead>
                <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Meses</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Total</th>
                    <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Abono Semanal</th>
                </tr>
            </thead>
            <tbody>
                <tr style="background: #f0fdf4; border-bottom: 1px solid #f0f0f0;">
                    <td colspan="3" style="padding: 20px; text-align: center; color: #27ae60; font-weight: bold;">
                        ✅ Pagado al contado (sin financiamiento)
                    </td>
                </tr>
            </tbody>
        `;
        return;
    }
    
    // Calcular planes con el nuevo saldo
    const planesSimulados = CalculatorService.calcularCredito(saldoFinanciar);
    
    let tablaHtml = `
        <thead>
            <tr style="background: #f8f9fa; border-bottom: 2px solid #e2e8f0;">
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Meses</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Total</th>
                <th style="padding: 12px; text-align: center; font-weight: 600; color: #4a5568;">Abono Semanal</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    planesSimulados.forEach(plan => {
        tablaHtml += `
            <tr style="border-bottom: 1px solid #f0f0f0;">
                <td style="padding: 12px; text-align: center; font-weight: 600;">${plan.meses}</td>
                <td style="padding: 12px; text-align: center; color: #27ae60; font-weight: bold;">${dinero(plan.total)}</td>
                <td style="padding: 12px; text-align: center; color: #3498db; font-weight: 600;">${dinero(plan.abono)}</td>
            </tr>
        `;
    });
    
    tablaHtml += `</tbody>`;
    
    tablaPlanesDiv.innerHTML = tablaHtml;
}

/**
 * Cierra el modal de producto
 */
function cerrarProducto() {
    const modal = document.getElementById("modalProducto");
    if (modal) {
        modal.classList.add("oculto");
        modal.style.display = 'none';
    }
}
/**
 * Renderiza la lista de precios completa por categoría
 */
function renderListaPrecios() {
    const contenedor = document.getElementById("listaPrecios");
    if (!contenedor) return;

    if (productos.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #718096;">
                <h3>📊 No hay productos para mostrar</h3>
            </div>`;
        return;
    }

    // Agrupar productos por categoría y subcategoría
    const productosAgrupados = agruparProductosPorCategoria();

    let html = `
        <div style="padding: 20px;">
            <div style="margin-bottom: 30px;">
                <h1 style="color: #1a3a70; text-align: center; font-size: 28px; margin: 0 0 10px 0;">
                    📊 LISTA DE PRECIOS
                </h1>
                <p style="text-align: center; color: #718096; margin: 0;">
                    Mueblería Mi Pueblito - ${new Date().toLocaleDateString('es-MX')}
                </p>
            </div>
    `;

    // Iterar por cada categoría
    Object.keys(productosAgrupados).sort().forEach(categoria => {
        const subcategorias = productosAgrupados[categoria];

        html += `
            <div style="margin-bottom: 40px; page-break-inside: avoid;">
                <div style="background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%); color: white; padding: 15px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
                    <h2 style="margin: 0; font-size: 20px;">📦 ${categoria}</h2>
                </div>
        `;

        // Iterar por cada subcategoría
        Object.keys(subcategorias).sort().forEach(subcategoria => {
            const productosSubcat = subcategorias[subcategoria];

            html += `
                <div style="margin-bottom: 20px;">
                    <h3 style="background: #e8f0fe; padding: 12px 20px; margin: 0; color: #1a3a70; font-size: 16px; border-left: 5px solid #3498db;">
                        ${subcategoria}
                    </h3>

                    <div style="overflow-x: auto;">
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px;">
                            <thead>
                                <tr style="background: #f8f9fa; border-bottom: 2px solid #cbd5e0;">
                                    <th style="padding: 10px 12px; text-align: left; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; width: 17%;">
                                        Producto
                                    </th>
                                    <th style="padding: 10px 12px; text-align: right; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; width: 10%;">
                                        Contado
                                    </th>
            `;

            // Agregar columnas de planes
            const planesEjemplo = CalculatorService.calcularCredito(1000);
            planesEjemplo.forEach(plan => {
                html += `
                    <th colspan="2" style="padding: 10px 12px; text-align: center; font-weight: 600; color: #2c3e50; border-right: 1px solid #cbd5e0; background: #dbeafe;">
                        ${plan.meses} Mes${plan.meses > 1 ? 'es' : ''}
                    </th>
                `;
            });

            html += `
                                </tr>
                                <tr style="background: #f0f4f8; border-bottom: 1px solid #cbd5e0;">
                                    <th style="padding: 8px 12px; text-align: left; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0;"></th>
                                    <th style="padding: 8px 12px; text-align: right; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px;"></th>
            `;

            planesEjemplo.forEach(plan => {
                html += `
                    <th style="padding: 8px 6px; text-align: center; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px; background: #e0f2fe;">
                        Semanal
                    </th>
                    <th style="padding: 8px 6px; text-align: center; font-weight: 500; color: #4a5568; border-right: 1px solid #cbd5e0; font-size: 11px; background: #e0f2fe;">
                        Total
                    </th>
                `;
            });

            html += `
                                </tr>
                            </thead>
                            <tbody>
            `;

            // Ordenar productos alfabéticamente por nombre
            productosSubcat.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach((prod, idx) => {
                const planes = CalculatorService.calcularCredito(prod.precio);
                const colorFila = idx % 2 === 0 ? "#ffffff" : "#f9fafb";

                html += `
                    <tr style="background: ${colorFila}; border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 12px; text-align: left; border-right: 1px solid #e2e8f0;">
                            <strong style="color: #2c3e50; font-size: 13px;">${prod.nombre}</strong>
                            ${prod.color ? `<br><small style="color: #718096; font-size: 11px;">🎨 ${prod.color}</small>` : ''}
                            ${prod.marca ? `<br><small style="color: #718096; font-size: 11px;">🏷️ ${prod.marca}</small>` : ''}
                        </td>
                        <td style="padding: 10px 12px; text-align: right; border-right: 1px solid #e2e8f0; font-weight: bold; color: #27ae60; font-size: 12px;">
                            ${dinero(prod.precio)}
                        </td>
                `;

                // Agregar totales y semanales por plan
                planes.forEach(plan => {
                    html += `
                        <td style="padding: 10px 6px; text-align: right; border-right: 1px solid #e2e8f0; color: #3498db; font-weight: 600; font-size: 12px;">
                            ${dinero(plan.abono)}
                        </td>
                        <td style="padding: 10px 6px; text-align: right; border-right: 1px solid #e2e8f0; color: #2c3e50; font-weight: 600; font-size: 12px;">
                            ${dinero(plan.total)}
                        </td>
                    `;
                });

                html += `
                    </tr>
                `;
            });

            html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
        `;
    });

    // Pie
    html += `
            <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-left: 5px solid #3498db;">
                <p style="margin: 10px 0; font-size: 12px; color: #718096;">
                    <strong>📝 Notas:</strong>
                </p>
                <ul style="margin: 10px 0; padding-left: 20px; font-size: 12px; color: #718096;">
                    <li>Los precios mostrados son vigentes a partir de ${new Date().toLocaleDateString('es-MX')}</li>
                    <li>Se manejan plazos semanales para el pago</li>
                    <li>Sujeto a disponibilidad de inventario</li>
                    <li>Para más información contacte con nuestro equipo de ventas</li>
                </ul>
                <p style="margin: 10px 0; font-size: 12px; color: #718096;">
                    <strong>🏢 Mueblería Mi Pueblito</strong> - Santiago Cuaula, Tlaxcala
                </p>
            </div>

            <div style="margin-top: 30px; display: flex; gap: 10px; justify-content: center; padding-bottom: 40px; flex-wrap: wrap;">
                <button onclick="imprimirListaPrecios()" 
                        style="padding: 12px 24px; background: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    🖨️ Imprimir
                </button>
                <button onclick="exportarListaPreciosCSV()" 
                        style="padding: 12px 24px; background: #27ae60; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    📥 Descargar Excel
                </button>
                <button onclick="navA('tienda')" 
                        style="padding: 12px 24px; background: #95a5a6; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                    ← Volver
                </button>
            </div>
        </div>
    `;

    contenedor.innerHTML = html;
}

/**
 * Agrupa productos por categoría y subcategoría
 * @returns {Object} - Estructura de categorías
 */
function agruparProductosPorCategoria() {
    const agrupados = {};

    productos.forEach(prod => {
        const categoria = prod.categoria || "Sin Categoría";
        const subcategoria = prod.subcategoria || "Sin Subcategoría";

        if (!agrupados[categoria]) {
            agrupados[categoria] = {};
        }

        if (!agrupados[categoria][subcategoria]) {
            agrupados[categoria][subcategoria] = [];
        }

        agrupados[categoria][subcategoria].push(prod);
    });

    return agrupados;
}

/**
 * Imprime la lista de precios sin títulos, optimizado para 2 hojas de ancho
 */
function imprimirListaPrecios() {
    const contenido = document.getElementById("listaPrecios").innerHTML;
    
    if (!contenido) {
        alert("⚠️ No hay contenido para imprimir");
        return;
    }

    const ventanaImpresion = window.open('', '_blank');
    
    const htmlCompleto = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lista de Precios</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                @page {
                    size: A4 landscape;
                    margin: 8mm;
                }
                
                body {
                    font-family: 'Arial', sans-serif;
                    background: white;
                    padding: 8mm;
                    color: #2c3e50;
                }
                
                .fecha {
                    text-align: right;
                    color: #718096;
                    font-size: 11px;
                    margin-bottom: 10px;
                    padding-right: 10px;
                }
                
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                    margin-bottom: 5px;
                }
                
                th {
                    padding: 8px 8px;
                    text-align: center;
                    font-weight: 600;
                    color: #2c3e50;
                    border-right: 1px solid #cbd5e0;
                    background: #f8f9fa;
                    border-bottom: 2px solid #cbd5e0;
                    white-space: nowrap;
                    font-size: 11px;
                    line-height: 1.2;
                }
                
                td {
                    padding: 7px 8px;
                    border-right: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                    text-align: right;
                    font-size: 11px;
                }
                
                td:first-child {
                    text-align: left;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: clip;
                    width: 45%;
                }
                
                strong {
                    font-weight: bold;
                }
                
                small {
                    font-size: 10px;
                    color: #718096;
                }
                
                h2 {
                    margin: 0;
                    font-size: 18px;
                    color: white;
                }
                
                h3 {
                    background: #e8f0fe;
                    padding: 10px 15px;
                    margin: 0;
                    color: #1a3a70;
                    font-size: 14px;
                    border-left: 4px solid #3498db;
                    font-weight: bold;
                }
                
                .categoria-header {
                    background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%);
                    color: white;
                    padding: 12px 15px;
                    margin: 15px 0 0 0;
                }
                
                .subcategoria-content {
                    margin-bottom: 10px;
                }
                
                div[style*="margin-bottom: 40px"] {
                    margin-bottom: 15px !important;
                    page-break-inside: avoid;
                }
                
                div[style*="margin-bottom: 20px"] {
                    margin-bottom: 8px !important;
                }
                
                div[style*="overflow-x: auto"] {
                    overflow: visible !important;
                }
                
                @media print {
                    body {
                        padding: 5mm;
                    }
                    table {
                        page-break-inside: avoid;
                    }
                    h3 {
                        page-break-inside: avoid;
                    }
                    .categoria-header {
                        page-break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <div class="fecha">Fecha: ${new Date().toLocaleDateString('es-MX')}</div>
            ${contenido}
        </body>
        </html>
    `;

    ventanaImpresion.document.write(htmlCompleto);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();

    setTimeout(() => {
        ventanaImpresion.print();
    }, 300);
}
/**
 * Exporta la lista de precios a PDF (usando HTML a PDF)
 * Nota: Requiere una librería como html2pdf
 */
function exportarListaPreciosPDF() {
    const contenido = document.getElementById("listaPrecios").innerHTML;
    
    if (!contenido) {
        alert("⚠️ No hay contenido para exportar");
        return;
    }

    // Crear ventana de impresión
    const ventanaImpresion = window.open('', '_blank');
    
    const htmlCompleto = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Lista de Precios - Mueblería Mi Pueblito</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Arial', sans-serif;
                    background: white;
                    padding: 20px;
                    line-height: 1.4;
                }
                h1 {
                    color: #1a3a70;
                    text-align: center;
                    font-size: 28px;
                    margin-bottom: 10px;
                }
                h2 {
                    margin: 0;
                    font-size: 20px;
                }
                h3 {
                    padding: 12px 20px;
                    margin: 0;
                    color: #1a3a70;
                    font-size: 16px;
                    border-left: 5px solid #3498db;
                    background: #e8f0fe;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                th {
                    padding: 12px 15px;
                    text-align: left;
                    font-weight: 600;
                    color: #2c3e50;
                    border-right: 1px solid #cbd5e0;
                    background: #f8f9fa;
                    border-bottom: 2px solid #cbd5e0;
                    white-space: nowrap;
                }
                td {
                    padding: 12px 15px;
                    border-right: 1px solid #e2e8f0;
                    border-bottom: 1px solid #e2e8f0;
                }
                th[style*="text-right"],
                td[style*="text-right"] {
                    text-align: right;
                }
                .categoria-header {
                    background: linear-gradient(135deg, #1a3a70 0%, #2c5282 100%);
                    color: white;
                    padding: 15px 20px;
                    border-radius: 8px 8px 0 0;
                    margin-bottom: 0;
                    margin-top: 30px;
                }
                .subcategoria-header {
                    background: #e8f0fe;
                    padding: 12px 20px;
                    color: #1a3a70;
                    font-size: 16px;
                    border-left: 5px solid #3498db;
                    font-weight: bold;
                    margin-top: 20px;
                }
                .footer {
                    margin-top: 40px;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 8px;
                    border-left: 5px solid #3498db;
                    font-size: 12px;
                    color: #718096;
                }
                .fecha {
                    text-align: center;
                    color: #718096;
                    margin-bottom: 30px;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                    table { page-break-inside: avoid; }
                    .categoria-header { page-break-inside: avoid; }
                }
            </style>
        </head>
        <body>
            ${contenido}
        </body>
        </html>
    `;

    ventanaImpresion.document.write(htmlCompleto);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();

    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
}

/**
 * Genera una previsualización en CSV
 */
function exportarListaPreciosCSV() {
    const productosAgrupados = agruparProductosPorCategoria();
    let csv = "Categoría,Subcategoría,Producto,Color,Marca,Precio Contado";

    // Agregar headers de planes
    const planesEjemplo = CalculatorService.calcularCredito(1000);
    planesEjemplo.forEach(plan => {
        csv += `,${plan.meses}M Total`;
    });

    csv += "\n";

    // Agregar datos
    Object.keys(productosAgrupados).sort().forEach(categoria => {
        const subcategorias = productosAgrupados[categoria];

        Object.keys(subcategorias).sort().forEach(subcategoria => {
            const productosSubcat = subcategorias[subcategoria];

            productosSubcat.sort((a, b) => a.nombre.localeCompare(b.nombre)).forEach(prod => {
                const planes = CalculatorService.calcularCredito(prod.precio);
                
                csv += `"${categoria}","${subcategoria}","${prod.nombre}","${prod.color || ''}","${prod.marca || ''}",${prod.precio}`;
                
                planes.forEach(plan => {
                    csv += `,${plan.total}`;
                });
                
                csv += "\n";
            });
        });
    });

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `lista-precios-${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
}

function verDetalle(id) { verProducto(id); }

function agregarAlCarritoDesdeModal() {
    if (!productoActualId) return;
    const p = productos.find(prod => prod.id === productoActualId);
    if (!p) {
        alert("❌ Error: Producto no encontrado.");
        return;
    }

    const indiceExistente = carrito.findIndex(item => item.id === productoActualId);
    
    if (indiceExistente !== -1) {
        const mensaje = `⚠️ "${p.nombre}" ya está en el carrito.\n\n¿Aumentar la cantidad en 1?`;
        
        if (confirm(mensaje)) {
            carrito[indiceExistente].cantidad = (carrito[indiceExistente].cantidad || 1) + 1;
            if (!StorageService.set("carrito", carrito)) {
                console.error("❌ Error actualizando carrito");
                return;
            }
            actualizarContadorCarrito();
            alert(`✅ Cantidad aumentada a ${carrito[indiceExistente].cantidad}`);
        }
    } else {
        const planes = CalculatorService.calcularCredito(p.precio);
        const plan = planes[5] || planes[0];

        carrito.push({
            id: p.id,
            nombre: p.nombre,
            precioContado: parseFloat(p.precio) || 0,
            plazo: plan.meses,
            totalCredito: plan.total,
            abonoSemanal: plan.abono,
            imagen: p.imagen,
            cantidad: 1
        });

        if (!StorageService.set("carrito", carrito)) {
            console.error("❌ Error guardando carrito");
            return;
        }
        actualizarContadorCarrito();
        
        alert(`✅ "${p.nombre}" agregado al carrito`);
    }
    
    cerrarProducto();
}

function agregarAlCarrito(id) {
    const p = productos.find(x => x.id == id);
    if (!p) return;
    productoActualId = id;
    agregarAlCarritoDesdeModal();
}

function actualizarContadorCarrito() {
    const contador = document.getElementById("contadorCarrito");
    if (contador) {
        const total = carrito.length;
        contador.innerText = total;
        contador.style.display = total > 0 ? "flex" : "none";
    }
}

// ===== CLIENTES =====
function guardarCliente() {
    const nombreInput   = document.getElementById("clienteNombre");
    const direccionInput = document.getElementById("clienteDireccion");
    const telefonoInput = document.getElementById("clienteTelefono");
    const referenciaInput = document.getElementById("clienteReferencia");
    
    const nombre   = nombreInput.value.trim();
    const direccion = direccionInput.value.trim();
    const telefono = telefonoInput.value.trim();
    const referencia = referenciaInput.value.trim();

    const validacion = ValidatorService.validarCliente({ nombre, telefono });
    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    if (clienteEditandoId) {
        const index = clientes.findIndex(c => c.id === clienteEditandoId);
        if (index !== -1) {
            clientes[index].nombre   = nombre;
            clientes[index].direccion = direccion;
            clientes[index].telefono = telefono;
            clientes[index].referencia = referencia;
        }
        clienteEditandoId = null;
    } else {
        clientes.push({
            id: Date.now(),
            nombre,
            direccion,
            telefono,
            referencia,
            fechaRegistro: new Date().toLocaleDateString('es-MX')
        });
    }

    if (!StorageService.set("clientes", clientes)) {
        alert("❌ Error guardando cliente");
        return;
    }

    nombreInput.value   = "";
    direccionInput.value = "";
    telefonoInput.value = "";
    referenciaInput.value = "";
    renderClientes();
}

function renderClientes() {
    const cont = document.getElementById("listaClientes");
    if (!cont) return;

    if (clientes.length === 0) {
        cont.innerHTML = "<p style='color:gray; padding:20px;'>No hay clientes registrados.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Teléfono</th>
                <th>Referencia</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    clientes.forEach(c => {
        html += `
            <tr>
                <td><b>${c.nombre}</b></td>
                <td>${c.direccion || '-'}</td>
                <td>${c.telefono || '-'}</td>
                <td><small>${c.referencia || '-'}</small></td>
                <td style="text-align:center;">
                    <button onclick="prepararEdicionCliente(${c.id})" style="background:none; border:none; cursor:pointer; font-size:16px; margin-right:10px;">✏️</button>
                    <button onclick="eliminarCliente(${c.id})" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑️</button>
                </td>
            </tr>`;
    });
    cont.innerHTML = html + "</tbody></table>";
}

function eliminarCliente(id) {
    if (confirm("¿Eliminar este cliente definitivamente?")) {
        clientes = clientes.filter(c => c.id !== id);
        if (!StorageService.set("clientes", clientes)) {
            console.error("❌ Error eliminando cliente");
            return;
        }
        renderClientes();
    }
}

function prepararEdicionCliente(id) {
    const c = clientes.find(cli => cli.id === id);
    if (!c) return;
    document.getElementById("clienteNombre").value   = c.nombre;
    document.getElementById("clienteDireccion").value = c.direccion || '';
    document.getElementById("clienteTelefono").value = c.telefono || '';
    document.getElementById("clienteReferencia").value = c.referencia || '';
    clienteEditandoId = id;
    window.scrollTo(0, 0);
}

// ===== PROVEEDORES =====
function guardarProveedor() {
    const nombreInput   = document.getElementById("provNombre");
    const contactoInput = document.getElementById("provContacto");
    const nombre   = nombreInput.value.trim();
    const contacto = contactoInput.value.trim();

    if (!nombre) return alert("⚠️ El nombre del proveedor es obligatorio.");

    proveedores.push({ id: Date.now(), nombre, contacto, saldoDeuda: 0 });
    if (!StorageService.set("proveedores", proveedores)) {
        alert("❌ Error guardando proveedor");
        return;
    }

    nombreInput.value   = "";
    contactoInput.value = "";
    renderProveedores();
}

function renderProveedores() {
    const cont = document.getElementById("tablaProveedores");
    if (!cont) return;

    if (proveedores.length === 0) {
        cont.innerHTML = "<p style='color:gray; padding:20px;'>No hay proveedores registrados.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Proveedor</th>
                <th>Contacto</th>
                <th style="text-align:center;">Acciones</th>
            </tr></thead>
            <tbody>`;

    proveedores.forEach(p => {
        html += `
            <tr>
                <td><b>${p.nombre}</b></td>
                <td>${p.contacto || '-'}</td>
                <td style="text-align:center;">
                    <button onclick="eliminarProveedor(${p.id})" style="background:none; border:none; cursor:pointer; font-size:18px;">🗑️</button>
                </td>
            </tr>`;
    });
    cont.innerHTML = html + "</tbody></table>";
}

function eliminarProveedor(id) {
    if (confirm("¿Estás seguro de eliminar este proveedor?")) {
        proveedores = proveedores.filter(p => p.id !== id);
        if (!StorageService.set("proveedores", proveedores)) {
            console.error("❌ Error eliminando proveedor");
            return;
        }
        renderProveedores();
    }
}

// ===== COMPRAS =====
function prepararVistaCompras() {
    const selProd = document.getElementById("compraProducto");
    const selProv = document.getElementById("compraProveedor");

    if (selProd) {
        selProd.innerHTML = '<option value="">-- Selecciona un producto --</option>' +
            productos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
    if (selProv) {
        selProv.innerHTML = proveedores.length === 0
            ? '<option value="">-- NO HAY PROVEEDORES --</option>'
            : '<option value="">-- Selecciona Proveedor --</option>' +
              proveedores.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
    }
    actualizarSelectBancos();
    gestionarCamposPago();
}

function actualizarSelectBancos() {
    const select = document.getElementById("compraBancoSeleccionado");
    if (!select) return;
    select.innerHTML = tarjetasConfig.map(t => `<option value="${t.banco}">${t.banco}</option>`).join('');
}

function gestionarCamposPago() {
    const metodo  = document.getElementById("compraMetodoPago")?.value;
    const divBanco = document.getElementById("divSeleccionBanco");
    const divMeses = document.getElementById("divMeses");
    if (!metodo) return;

    if (divBanco) divBanco.style.display = (metodo === 'tarjeta_msi') ? 'block' : 'none';
    if (divMeses) divMeses.style.display  = (metodo === 'tarjeta_msi') ? 'block' : 'none';

    actualizarSelectBancos();
}

function registrarCompra() {
    const productoId  = parseInt(document.getElementById("compraProducto").value);
    const proveedorId = parseInt(document.getElementById("compraProveedor").value);
    const cantidad    = parseInt(document.getElementById("compraCantidad").value);
    const costoNuevo  = parseFloat(document.getElementById("compraCosto").value);
    const comboPago   = document.getElementById("compraMetodoPago");
    const metodo      = comboPago.value;
    const formaPagoTexto = comboPago.options[comboPago.selectedIndex].text;
    const ingresoInmediato = document.getElementById("compraIngresoInmediato")?.checked ?? true;

    if (!proveedorId || !productoId || isNaN(cantidad) || isNaN(costoNuevo) || cantidad <= 0) {
        alert("⚠️ Por favor completa todos los campos correctamente.");
        return;
    }

    const prov    = proveedores.find(p => p.id == proveedorId);
    const producto = productos.find(p => p.id == productoId);
    if (!prov || !producto) return alert("⚠️ Proveedor o producto no encontrado.");

    const bancoSel = document.getElementById("compraBancoSeleccionado")?.value || "";
    const fechaHoyISO = new Date().toISOString().split('T')[0];
    const fechaHoyStr = new Date().toLocaleDateString('es-MX');
    const fechaPagoMensaje = (metodo === "contado") ? "Hoy (Contado)" : calcularFechaPago(fechaHoyISO, bancoSel);

    const mensajeConfirmar =
        `¿Deseas registrar esta compra?\n\n` +
        `Proveedor: ${prov.nombre}\n` +
        `Producto: ${producto.nombre}\n` +
        `Total: ${dinero(cantidad * costoNuevo)}\n` +
        `Pago Estimado: ${fechaPagoMensaje}`;

    if (!confirm(mensajeConfirmar)) return;

    let avisoActualizacion = "";
    if (costoNuevo > producto.costo) {
        const costoAnterior = producto.costo;
        const precioAnterior = producto.precio;
        let margenAplicar = 30;
        categoriasData.forEach(cat => {
            const sub = cat.subcategorias.find(s => s.nombre === producto.subcategoria);
            if (sub) margenAplicar = sub.margen;
        });
        const nuevoPrecio = CalculatorService.calcularPrecioDesdeMargen(costoNuevo, margenAplicar);
        producto.costo  = costoNuevo;
        producto.precio = nuevoPrecio;
        avisoActualizacion = `\n\n📢 ¡ACTUALIZACIÓN DE PRECIOS!\n` +
            `Costo: ${dinero(costoAnterior)} ➡️ ${dinero(costoNuevo)}\n` +
            `Precio: ${dinero(precioAnterior)} ➡️ ${dinero(nuevoPrecio)}\n` +
            `Margen aplicado: ${margenAplicar}%`;
    }

    const totalCompra = cantidad * costoNuevo;
    const nuevaCompra = {
        id: Date.now(),
        productoId,
        proveedor: prov.nombre,
        total: totalCompra,
        fecha: fechaHoyStr,
        fechaISO: fechaHoyISO
    };
    compras.push(nuevaCompra);

    const nuevaRecepcion = {
        id: Date.now() + 1,
        compraId: nuevaCompra.id,
        productoId,
        productoNombre: producto.nombre,
        cantidadTotal: cantidad,
        cantidadRecibida: ingresoInmediato ? cantidad : 0,
        cantidadPendiente: ingresoInmediato ? 0 : cantidad,
        proveedor: prov.nombre,
        fechaPedido: nuevaCompra.fecha,
        metodoPago: formaPagoTexto,
        estatus: ingresoInmediato ? "Completado" : "Pendiente"
    };
    recepciones.push(nuevaRecepcion);
    if (ingresoInmediato) actualizarStock(productoId, cantidad, `Compra a ${prov.nombre}`);

    if (metodo !== "contado") {
        const detalleDeuda = {
            id: Date.now() + 2,
            compraId: nuevaCompra.id,
            proveedor: prov.nombre,
            producto: producto.nombre,
            cantidad,
            total: totalCompra,
            saldoPendiente: totalCompra,
            metodo,
            formaPagoTexto,
            banco: bancoSel,
            meses: parseInt(document.getElementById("compraMeses")?.value) || 1,
            fecha: nuevaCompra.fecha,
            vencimiento: fechaPagoMensaje
        };

        if (metodo === "credito_proveedor") {
            let cuentasProv = StorageService.get("cuentasPorPagar", []);
            cuentasProv.push(detalleDeuda);
            if (!StorageService.set("cuentasPorPagar", cuentasProv)) {
                console.error("❌ Error guardando cuentas por pagar");
            }
        }

        if (metodo === "tarjeta_msi") {
            let cuentasBancos = StorageService.get("cuentasMSI", []);
            const numMeses = parseInt(document.getElementById("compraMeses").value) || 12;
            cuentasBancos.push({
                id: Date.now() + 3,
                compraId: nuevaCompra.id,
                banco: bancoSel,
                producto: producto.nombre,
                total: totalCompra,
                meses: numMeses,
                cuotaMensual: totalCompra / numMeses,
                fechaCompra: nuevaCompra.fecha,
                calendario: calcularCalendarioMSI(new Date(), numMeses, bancoSel),
                pagosRealizados: 0
            });
            if (!StorageService.set("cuentasMSI", cuentasBancos)) {
                console.error("❌ Error guardando cuentas MSI");
            }
        }
    }

    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("compras", compras)) {
        console.error("❌ Error guardando compras");
    }
    if (!StorageService.set("recepciones", recepciones)) {
        console.error("❌ Error guardando recepciones");
    }

    alert(`✅ Registro Exitoso\nProveedor: ${prov.nombre}${avisoActualizacion}`);
    limpiarFormularioCompra();
    navA('compras');
}

function limpiarFormularioCompra() {
    const ids = ["compraCantidad", "compraCosto"];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const selProd = document.getElementById("compraProducto");
    const selProv = document.getElementById("compraProveedor");
    const selPago = document.getElementById("compraMetodoPago");
    const chkIngreso = document.getElementById("compraIngresoInmediato");
    if (selProd) selProd.selectedIndex = 0;
    if (selProv) selProv.selectedIndex = 0;
    if (selPago) selPago.selectedIndex = 0;
    if (chkIngreso) chkIngreso.checked = true;
}

// ===== RECEPCIONES =====
function renderRecepciones() {
    const contenedor = document.getElementById("listaRecepcionesPendientes");
    if (!contenedor) return;

    let recs = StorageService.get("recepciones", []);
    let pendientes = recs.filter(r => r.estatus === "Pendiente");

    if (pendientes.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ No hay mercancía pendiente de recibir.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Producto</th>
                <th>Pedido</th>
                <th>Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    pendientes.forEach(r => {
        html += `
            <tr>
                <td>${r.fechaPedido}<br><strong>${r.proveedor}</strong></td>
                <td>${r.productoNombre}<br><small>Pago: ${r.metodoPago}</small></td>
                <td>${r.cantidadTotal}</td>
                <td style="color:red; font-weight:bold;">${r.cantidadPendiente}</td>
                <td>
                    <button onclick="procesarRecepcionFisica(${r.id})" style="background:#27ae60; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        📥 Recibir
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function procesarRecepcionFisica(idRecepcion) {
    let recs = StorageService.get("recepciones", []);
    const index = recs.findIndex(r => r.id == idRecepcion);
    if (index === -1) return;

    const rec = recs[index];
    const cantInput = prompt(`¿Cuánto llegó de ${rec.productoNombre}?\nFaltan: ${rec.cantidadPendiente}`);
    const cantidad = parseInt(cantInput);

    if (isNaN(cantidad) || cantidad <= 0 || cantidad > rec.cantidadPendiente) {
        alert("Cantidad no válida.");
        return;
    }

    const prod = productos.find(p => Number(p.id) === Number(rec.productoId));
    
    if (prod) {
        prod.stock = (parseInt(prod.stock) || 0) + cantidad;
        
        movimientosInventario.push({
            id: Date.now(),
            productoId: prod.id,
            tipo: 'entrada',
            cantidad,
            concepto: `Recepción - Prov: ${rec.proveedor}`,
            fecha: new Date().toLocaleString()
        });
    } else {
        alert("Error: El producto ya no existe en la base de datos.");
        return; 
    }

    rec.cantidadRecibida += cantidad;
    rec.cantidadPendiente -= cantidad;
    if (rec.cantidadPendiente === 0) rec.estatus = "Completado";

    recs[index] = rec;
    
    if (!StorageService.set("recepciones", recs)) {
        console.error("❌ Error guardando recepciones");
        return;
    }
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
        return;
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
        return;
    }

    alert("Stock actualizado con éxito.");
    renderRecepciones();
}

// ===== CUENTAS POR PAGAR =====
function renderCuentasPorPagar() {
    const contenedor = document.getElementById("listaCuentasPorPagar");
    if (!contenedor) return;

    let cuentas = StorageService.get("cuentasPorPagar", []);
    let deudas = cuentas.filter(c => c.saldoPendiente > 0);

    if (deudas.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; padding:20px;'>✅ ¡No tienes deudas pendientes!</p>";
        return;
    }

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Fecha / Proveedor</th>
                <th>Método</th>
                <th>Total</th>
                <th>Saldo Pendiente</th>
                <th>Acción</th>
            </tr></thead>
            <tbody>`;

    deudas.forEach(c => {
        html += `
            <tr>
                <td>${c.fecha}<br><strong>${c.proveedor}</strong></td>
                <td><small>${c.metodo || c.formaPagoTexto || '-'}</small></td>
                <td>${dinero(c.total)}</td>
                <td style="color:red; font-weight:bold;">${dinero(c.saldoPendiente)}</td>
                <td>
                    <button onclick="registrarAbonoProveedor(${c.id})" style="background:#2c3e50; color:white; border:none; padding:8px; border-radius:5px; cursor:pointer;">
                        💵 Abonar
                    </button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function registrarAbonoProveedor(idCuenta) {
    let cuentas = StorageService.get("cuentasPorPagar", []);
    const index = cuentas.findIndex(c => c.id === idCuenta);
    if (index === -1) return;

    const cuenta = cuentas[index];
    const montoAbono = parseFloat(prompt(`¿Cuánto vas a abonar a ${cuenta.proveedor}?\nSaldo actual: ${dinero(cuenta.saldoPendiente)}`));

    const validacion = ValidatorService.validarMonto(montoAbono, cuenta.saldoPendiente);
    if (!validacion.valid) {
        alert("⚠️ " + validacion.error);
        return;
    }

    cuenta.saldoPendiente -= montoAbono;
    cuentas[index] = cuenta;
    if (!StorageService.set("cuentasPorPagar", cuentas)) {
        console.error("❌ Error guardando abono");
        return;
    }
    alert("Abono registrado correctamente.");
    renderCuentasPorPagar();
}

// ===== CATEGORÍAS =====
function renderCategorias() {
    const contenedor = document.getElementById("listaCategoriasCards");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    categoriasData.forEach((cat, indexCat) => {
        let card = document.createElement("div");
        card.style = "background: white; border-radius: 10px; padding: 15px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-top: 5px solid #3498db;";

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h3 style="margin:0; color:#2c3e50;">${cat.nombre}</h3>
                <button onclick="eliminarCategoria(${indexCat})" style="background:none; border:none; color:#e74c3c; cursor:pointer; font-size:18px;">🗑️</button>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="border-bottom: 1px solid #eee; text-align: left; color: #7f8c8d;">
                        <th style="padding: 5px;">Subcategoría</th>
                        <th style="padding: 5px; text-align: center;">Margen %</th>
                        <th style="padding: 5px;"></th>
                    </tr>
                </thead>
                <tbody>`;

        cat.subcategorias.forEach((sub, indexSub) => {
            html += `
                <tr style="border-bottom: 1px solid #fafafa;">
                    <td style="padding: 8px 5px;">${sub.nombre}</td>
                    <td style="padding: 8px 5px; text-align: center;">
                        <input type="number" value="${sub.margen}"
                            onchange="actualizarMargen(${indexCat}, ${indexSub}, this.value)"
                            style="width: 55px; text-align: center; border: 1px solid #ddd; border-radius: 4px; padding: 2px;">
                    </td>
                    <td style="text-align: right;">
                        <button onclick="eliminarSubcategoria(${indexCat}, ${indexSub})" style="background:none; border:none; cursor:pointer; color:#e74c3c;">✕</button>
                    </td>
                </tr>`;
        });

        html += `
                </tbody>
            </table>
            <button onclick="agregarSubcategoria(${indexCat})" style="margin-top: 15px; width: 100%; padding: 8px; background: #f8f9fa; border: 1px dashed #cbd5e0; border-radius: 5px; cursor: pointer; font-size: 12px; color: #3498db;">+ Añadir Subcategoría</button>
        `;

        card.innerHTML = html;
        contenedor.appendChild(card);
    });
}

function guardarCategoriasConfig() {
    if (!StorageService.set("categoriasData", categoriasData)) {
        console.error("❌ Error guardando categorías");
        return;
    }
    renderCategorias();
    actualizarCombosFiltros();
}

function nuevaCategoria() {
    const nombre = prompt("Nombre de la nueva categoría (Ej: Comedores, Oficinas):");
    if (nombre && nombre.trim()) {
        categoriasData.push({ nombre: nombre.trim(), subcategorias: [] });
        guardarCategoriasConfig();
    }
}

function agregarSubcategoria(indexCat) {
    const nombre = prompt("Nombre de la subcategoría:");
    const margen = prompt("¿Qué margen de ganancia (%) deseas?", "30");
    if (nombre && margen) {
        categoriasData[indexCat].subcategorias.push({
            nombre: nombre.trim(),
            margen: parseFloat(margen)
        });
        guardarCategoriasConfig();
    }
}

function eliminarSubcategoria(indexCat, indexSub) {
    if (confirm("¿Eliminar subcategoría?")) {
        categoriasData[indexCat].subcategorias.splice(indexSub, 1);
        guardarCategoriasConfig();
    }
}

function eliminarCategoria(index) {
    if (confirm("¿Seguro que quieres eliminar toda la categoría?")) {
        categoriasData.splice(index, 1);
        guardarCategoriasConfig();
    }
}

function actualizarMargen(indexCat, indexSub, nuevoValor) {
    categoriasData[indexCat].subcategorias[indexSub].margen = parseFloat(nuevoValor);
    if (!StorageService.set("categoriasData", categoriasData)) {
        console.error("❌ Error guardando categorías");
    }
}

// ===== VISOR MAESTRO =====
function abrirVisorMaestro(id) {
    navA('productos-visor');
    mostrarDetalleProductoMaestro(id);
}

function mostrarDetalleProductoMaestro(id) {
    const p = productos.find(prod => prod.id == id);
    if (!p) return;

    const cont = document.getElementById("detalle-producto-maestro");
    if (!cont) return;

    const ganancia = (p.precio || 0) - (p.costo || 0);
    const margen = p.precio > 0 ? ((ganancia / p.precio) * 100).toFixed(1) : 0;

    let html = `
        <div style="width: 100%; max-width: 1400px; margin: 0 auto; padding: 10px;">
            <div style="display: grid; grid-template-columns: 300px 1fr 300px; gap: 20px; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); margin-bottom: 20px;">

                <div style="text-align: center; border-right: 1px solid #eee; padding-right: 20px;">
                    <img src="${p.imagen || ''}" style="width: 100%; height: 200px; object-fit: contain; margin-bottom: 15px;" onerror="this.style.display='none'">
                    <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                        <span style="font-size: 12px; color: #7f8c8d;">STOCK TOTAL</span>
                        <h2 style="margin: 5px 0; color: ${(p.stock || 0) > 0 ? '#27ae60' : '#e74c3c'};">${p.stock || 0} pzs</h2>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; align-content: start;">
                    <div class="campo"><label>Nombre del Producto</label><input type="text" id="editNombre" value="${p.nombre}"></div>
                    <div class="campo"><label>Color</label><input type="text" id="editColor" value="${p.color || ''}"></div>
                    <div class="campo"><label>Marca</label><input type="text" id="editMarca" value="${p.marca || ''}"></div>
                    <div class="campo"><label>Modelo</label><input type="text" id="editModelo" value="${p.modelo || ''}"></div>
                    <div class="campo">
                        <label>Categoría</label>
                        <select id="editCategoria" onchange="actualizarSubcategoriasVisor()">
                            ${categoriasData.map(c => `<option value="${c.nombre}" ${p.categoria === c.nombre ? 'selected' : ''}>${c.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="campo">
                        <label>Subcategoría</label>
                        <select id="editSubcategoria"></select>
                    </div>
                    <div class="campo"><label style="color:#e74c3c;">Costo de Compra ($)</label><input type="number" id="editCosto" value="${p.costo || 0}" oninput="recalcularRentabilidad()"></div>
                    <div class="campo"><label style="color:#27ae60;">Precio de Venta ($)</label><input type="number" id="editPrecio" value="${p.precio || 0}" oninput="recalcularRentabilidad()"></div>
                    <div class="campo" style="grid-column: span 2;"><label>Descripción</label><textarea id="editDescripcion" rows="2">${p.descripcion || ''}</textarea></div>
                </div>

                <div style="background: #2c3e50; color: white; padding: 20px; border-radius: 10px; display: flex; flex-direction: column; justify-content: center; text-align: center;">
                    <p style="margin:0; font-size: 12px; opacity: 0.8;">RENTABILIDAD BRUTA</p>
                    <h2 id="displayGanancia" style="margin: 10px 0; color: #2ecc71;">${dinero(ganancia)}</h2>
                    <p id="displayMargen" style="margin:0; font-size: 18px; font-weight: bold;">${margen}%</p>
                    <button onclick="guardarCambiosVisor(${p.id})" style="margin-top: 20px; padding: 12px; background: #27ae60; color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold;">💾 GUARDAR TODO</button>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color: #27ae60; border-bottom: 2px solid #27ae60; padding-bottom: 10px;">📥 Entradas</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead><tr style="text-align: left; font-size: 12px; color: #7f8c8d;"><th>Fecha</th><th>Concepto</th><th style="text-align:right;">Cant.</th></tr></thead>
                        <tbody>${renderFilasKardex(id, 'entrada')}</tbody>
                    </table>
                </div>
                <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
                    <h3 style="color: #e67e22; border-bottom: 2px solid #e67e22; padding-bottom: 10px;">📤 Salidas</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                        <thead><tr style="text-align: left; font-size: 12px; color: #7f8c8d;"><th>Fecha</th><th>Concepto</th><th style="text-align:right;">Cant.</th></tr></thead>
                        <tbody>${renderFilasKardex(id, 'salida')}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
    cont.innerHTML = html;
    actualizarSubcategoriasVisor(p.subcategoria);
}

function renderFilasKardex(id, tipoFiltro) {
    const movimientos = movimientosInventario.filter(m => m.productoId == id && m.tipo === tipoFiltro);
    if (movimientos.length === 0) {
        return `<tr><td colspan="3" style="text-align: center; padding: 20px; color: #ccc;">Sin registros de ${tipoFiltro}</td></tr>`;
    }
    return [...movimientos].reverse().map(m => `
        <tr style="border-bottom: 1px solid #f1f1f1; font-size: 13px;">
            <td style="padding: 8px 0;">${m.fecha}</td>
            <td style="padding: 8px 0;">${m.concepto}</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">${m.cantidad}</td>
        </tr>
    `).join('');
}

function actualizarSubcategoriasVisor(valorSeleccionado = "") {
    const cat = document.getElementById("editCategoria")?.value;
    const subSelect = document.getElementById("editSubcategoria");
    if (!subSelect) return;

    let html = '<option value="">-- Seleccionar --</option>';
    if (cat) {
        const catInfo = categoriasData.find(c => c.nombre === cat);
        if (catInfo && catInfo.subcategorias) {
            catInfo.subcategorias.forEach(s => {
                html += `<option value="${s.nombre}" ${valorSeleccionado === s.nombre ? 'selected' : ''}>${s.nombre}</option>`;
            });
        }
    }
    subSelect.innerHTML = html;
}

function guardarCambiosVisor(id) {
    const p = productos.find(prod => prod.id == id);
    if (!p) return;
    if (!confirm(`¿Guardar cambios para "${p.nombre}"?`)) return;

    p.nombre       = document.getElementById("editNombre")?.value || p.nombre;
    p.color        = document.getElementById("editColor")?.value  || '';
    p.marca        = document.getElementById("editMarca")?.value  || '';
    p.modelo       = document.getElementById("editModelo")?.value || '';
    p.categoria    = document.getElementById("editCategoria")?.value || p.categoria;
    p.subcategoria = document.getElementById("editSubcategoria")?.value || p.subcategoria;
    p.costo        = parseFloat(document.getElementById("editCosto")?.value) || p.costo;
    p.precio       = parseFloat(document.getElementById("editPrecio")?.value) || p.precio;
    p.descripcion  = document.getElementById("editDescripcion")?.value || '';

    if (!StorageService.set("productos", productos)) {
        alert("❌ Error guardando cambios");
        return;
    }
    renderInventario();
    alert("✅ Cambios guardados correctamente.");
}

function recalcularRentabilidad() {
    const costo  = parseFloat(document.getElementById("editCosto")?.value)  || 0;
    const precio = parseFloat(document.getElementById("editPrecio")?.value) || 0;
    const ganancia  = precio - costo;
    const margenPct = CalculatorService.calcularMargen(precio, costo);

    const dispGanancia = document.getElementById("displayGanancia");
    const dispMargen   = document.getElementById("displayMargen");
    if (dispGanancia) dispGanancia.innerText = dinero(ganancia);
    if (dispMargen) {
        dispMargen.innerText = margenPct.toFixed(1) + "%";
        dispMargen.style.color = margenPct < 20 ? "#e74c3c" : margenPct <= 35 ? "#f39c12" : "#27ae60";
    }
}

// ===== BANCOS Y TARJETAS =====
function renderBancosConfig() {
    const contenedor = document.getElementById("tablaBancosConfig");
    if (!contenedor) return;

    let html = `
        <table class="tabla-admin">
            <thead><tr>
                <th>Banco</th>
                <th>Día de Corte</th>
                <th>Día Límite de Pago</th>
                <th>Acciones</th>
            </tr></thead>
            <tbody>`;

    tarjetasConfig.forEach((t, index) => {
        const notaMes = (parseInt(t.diaCorte) > parseInt(t.diaLimite))
            ? '<br><small style="color:orange;">(Mes siguiente)</small>' : '';
        html += `
            <tr>
                <td><strong>${t.banco}</strong></td>
                <td>Día ${t.diaCorte}</td>
                <td>Día ${t.diaLimite} ${notaMes}</td>
                <td>
                    <button onclick="prepararEdicionBanco(${index})" style="background:#3182ce; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-right:5px;">Modificar</button>
                    <button onclick="eliminarBanco(${index})" style="background:#e74c3c; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">Eliminar</button>
                </td>
            </tr>`;
    });

    contenedor.innerHTML = html + "</tbody></table>";
}

function abrirModalBanco() {
    const nombre = prompt("Nombre del Banco:");
    if (!nombre) return;
    const corte  = parseInt(prompt("Día de corte (1-31):"));
    const limite = parseInt(prompt("Día límite de pago (1-31):"));
    if (!isNaN(corte) && !isNaN(limite)) {
        tarjetasConfig.push({ banco: nombre.toUpperCase(), diaCorte: corte, diaLimite: limite });
        actualizarYRefrescarBancos();
    } else {
        alert("Por favor ingresa números válidos.");
    }
}

function prepararEdicionBanco(index) {
    const banco = tarjetasConfig[index];
    const nuevoNombre = prompt("Nombre del Banco:", banco.banco);
    if (nuevoNombre === null) return;
    const nuevoCorte  = parseInt(prompt("Día de Corte (1-31):", banco.diaCorte));
    const nuevoLimite = parseInt(prompt("Día Límite de Pago (1-31):", banco.diaLimite));
    if (!nuevoNombre || isNaN(nuevoCorte) || isNaN(nuevoLimite)) {
        alert("Datos inválidos.");
        return;
    }
    tarjetasConfig[index] = { banco: nuevoNombre.toUpperCase(), diaCorte: nuevoCorte, diaLimite: nuevoLimite };
    actualizarYRefrescarBancos();
    alert("¡Cuenta modificada con éxito!");
}

function eliminarBanco(index) {
    if (confirm("¿Seguro que deseas eliminar este banco?")) {
        tarjetasConfig.splice(index, 1);
        actualizarYRefrescarBancos();
    }
}

function actualizarYRefrescarBancos() {
    if (!StorageService.set("tarjetasConfig", tarjetasConfig)) {
        console.error("❌ Error guardando bancos");
        return;
    }
    renderBancosConfig();
    actualizarSelectBancos();
}

function _parseFecha(entrada) {
    if (entrada instanceof Date) return new Date(entrada);
    if (typeof entrada === 'string' && /^\d{4}-\d{2}-\d{2}/.test(entrada)) {
        const [y, m, d] = entrada.split('T')[0].split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const d = new Date(entrada);
    return isNaN(d.getTime()) ? new Date() : d;
}

function calcularFechaPago(fechaCompra, bancoNombre) {
    const infoBanco = tarjetasConfig.find(t => t.banco === bancoNombre);
    const fecha = _parseFecha(fechaCompra);

    if (!infoBanco) return fecha.toLocaleDateString('es-MX');

    const diaCompra = fecha.getDate();
    const diaCorte  = parseInt(infoBanco.diaCorte);
    const diaLimite = parseInt(infoBanco.diaLimite);

    let mes  = fecha.getMonth();
    let anio = fecha.getFullYear();

    if (diaCompra > diaCorte) mes += 1;
    if (diaLimite < diaCorte) mes += 1;

    return new Date(anio, mes, diaLimite).toLocaleDateString('es-MX');
}

function calcularCalendarioMSI(fechaRef, meses, nombreBanco) {
    const config = tarjetasConfig.find(t => t.banco === nombreBanco)
                   || { diaCorte: 15, diaLimite: 5 };

    const fecha     = _parseFecha(fechaRef);
    const diaCompra = fecha.getDate();
    const diaCorte  = parseInt(config.diaCorte);
    const diaLimite = parseInt(config.diaLimite);

    let saltoMes = 0;
    if (diaCompra > diaCorte) saltoMes += 1;
    if (diaLimite < diaCorte) saltoMes += 1;

    const cronograma = [];
    for (let i = 0; i < meses; i++) {
        const fPago = new Date(
            fecha.getFullYear(),
            fecha.getMonth() + saltoMes + i,
            diaLimite
        );
        cronograma.push({
            n    : i + 1,
            fecha: fPago.toISOString().split('T')[0]
        });
    }
    return cronograma;
}

// ===== MSI DASHBOARD =====
function renderDashboardMSI(bancoSeleccionado = 'Todos') {
    const contenedorBancos = document.getElementById('listaBancosMSI');
    const contenedorMeses  = document.getElementById('listaMesesMSI');
    const tituloMeses      = document.getElementById('tituloMesesMSI');
    if (!contenedorBancos || !contenedorMeses) return;

    const deudas = StorageService.get("cuentasMSI", []);

    let totalesPorBanco = {};
    let deudaTotalGlobal = 0;
    tarjetasConfig.forEach(t => { totalesPorBanco[t.banco] = 0; });
    deudas.forEach(deuda => {
        if (!totalesPorBanco[deuda.banco]) totalesPorBanco[deuda.banco] = 0;
        const totalVal  = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal  = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos     = parseInt(deuda.pagosRealizados || 0);
        const restante  = totalVal - (pagos * cuotaVal);
        totalesPorBanco[deuda.banco] += restante;
        deudaTotalGlobal += restante;
    });

    let htmlBancos = `
        <div class="tarjeta-banco-msi ${bancoSeleccionado === 'Todos' ? 'activo' : ''}" onclick="renderDashboardMSI('Todos')">
            <span>🌍 Todos</span>
            <span style="font-weight:bold; color:#e74c3c;">${dinero(deudaTotalGlobal)}</span>
        </div>`;
    Object.keys(totalesPorBanco).forEach(banco => {
        htmlBancos += `
            <div class="tarjeta-banco-msi ${bancoSeleccionado === banco ? 'activo' : ''}" onclick="renderDashboardMSI('${banco}')">
                <span>🏦 ${banco}</span>
                <span style="font-weight:bold;">${dinero(totalesPorBanco[banco])}</span>
            </div>`;
    });
    contenedorBancos.innerHTML = htmlBancos;

    if (tituloMeses) tituloMeses.innerText = `Proyección de Pagos (${bancoSeleccionado})`;

    let cronograma = {};
    const hoy = new Date();
    let mesAct  = hoy.getMonth() + 1;
    let anioAct = hoy.getFullYear();

    for (let i = 0; i < 12; i++) {
        let m = mesAct + i;
        let a = anioAct;
        while (m > 12) { m -= 12; a++; }
        cronograma[`${a}-${m.toString().padStart(2, '0')}`] = { total: 0, detalles: [] };
    }

    deudas.forEach(deuda => {
        if (bancoSeleccionado !== 'Todos' && deuda.banco !== bancoSeleccionado) return;
        const totalVal = parseFloat(String(deuda.total || 0).replace(/[$,]/g, ''));
        const cuotaVal = parseFloat(String(deuda.cuotaMensual || 0).replace(/[$,]/g, ''));
        const pagos    = parseInt(deuda.pagosRealizados || 0);
        const pendientes = cuotaVal > 0 ? Math.round(totalVal / cuotaVal) - pagos : 0;

        for (let i = 0; i < pendientes; i++) {
            let m = mesAct + i;
            let a = anioAct;
            while (m > 12) { m -= 12; a++; }
            const clave = `${a}-${m.toString().padStart(2, '0')}`;
            if (cronograma[clave]) {
                cronograma[clave].total += cuotaVal;
                cronograma[clave].detalles.push(`<b>${deuda.banco}</b>: ${deuda.producto || 'Compra'} (${dinero(cuotaVal)})`);
            }
        }
    });

    const mesesNombre = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    let htmlMeses = '';
    Object.keys(cronograma).sort().forEach(clave => {
        const [anio, mes] = clave.split('-');
        const data = cronograma[clave];
        if (data.total > 0) {
            const detallesHtml = data.detalles.map(det => `
                <div class="fila-conciliacion" onclick="this.classList.toggle('conciliado')">
                    <input type="checkbox" style="cursor:pointer">
                    <span>${det}</span>
                </div>`).join('');

            htmlMeses += `
                <div class="mes-msi-card">
                    <div style="width: 100%;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #edf2f7; padding-bottom:8px; margin-bottom:8px;">
                            <strong>📅 ${mesesNombre[parseInt(mes)-1]} ${anio}</strong>
                            <span style="font-weight:bold; color:#27ae60; font-size:1.1em;">${dinero(data.total)}</span>
                        </div>
                        <div class="detalles-mes-interactivo">${detallesHtml}</div>
                    </div>
                </div>`;
        }
    });

    contenedorMeses.innerHTML = htmlMeses || '<p style="text-align:center; color:gray; padding:20px;">Sin pagos pendientes.</p>';
}

function renderCuentasMSI() {
    const contenedor = document.getElementById("listaCuentasMSI");
    if (!contenedor) return;

    const cuentasMSI = StorageService.get("cuentasMSI", []);
    if (cuentasMSI.length === 0) {
        contenedor.innerHTML = "<p style='text-align:center; color:#999; padding:20px;'>No hay compras a meses activas.</p>";
        return;
    }

    let html = `
        <table class="tabla-admin" style="width:100%;">
            <thead><tr>
                <th>Detalle</th>
                <th>Total</th>
                <th>Mensualidad</th>
                <th>Progreso</th>
            </tr></thead>
            <tbody>`;

    cuentasMSI.forEach(c => {
        const porcentaje = ((c.pagosRealizados || 0) / c.meses) * 100;
        html += `
            <tr>
                <td>
                    <span style="font-weight:bold; color:#2c3e50;">${c.banco}</span><br>
                    <small style="color:#666;">${c.producto || 'Compra'}</small>
                </td>
                <td>${dinero(c.total)}</td>
                <td style="color:#27ae60; font-weight:bold;">${dinero(c.cuotaMensual)}</td>
                <td>
                    <div style="background:#eee; border-radius:10px; height:8px; width:100px; margin-bottom:4px;">
                        <div style="background:#3498db; height:100%; border-radius:10px; width:${porcentaje}%"></div>
                    </div>
                    <small>${c.pagosRealizados || 0} de ${c.meses} meses</small>
                </td>
            </tr>`;
    });
    contenedor.innerHTML = html + "</tbody></table>";
}

// ===== CARRITO =====
function renderCarrito() {
    const vistaCarrito = document.getElementById("carrito");
    if (!vistaCarrito) return;

    if (carrito.length === 0) {
        vistaCarrito.innerHTML = `
            <div class="header-seccion"><h2>🛒 Carrito de Ventas</h2></div>
            <p style="text-align:center; padding:40px; color:#718096; background:white; border-radius:8px;">
                El carrito está vacío. Agrega productos desde el inventario.
            </p>`;
        actualizarContadorCarrito();
        return;
    }

    carrito = carrito.filter(item => {
        const prod = productos.find(p => p.id === item.id);
        if (!prod) {
            console.warn("⚠️ Producto fantasma eliminado del carrito:", item.id);
            return false;
        }
        return true;
    });
    if (!StorageService.set("carrito", carrito)) {
        console.error("❌ Error guardando carrito");
    }

    let totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);

    let html = `
        <div class="header-seccion" style="margin-bottom: 20px;">
            <h2>🛒 Carrito de Ventas</h2>
        </div>
        
        <div style="display:grid; grid-template-columns: 1.8fr 1.2fr; gap: 20px; align-items: start;">
            
            <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                <h3 style="margin:0 0 15px 0; color:#2c3e50;">Productos seleccionados</h3>
                <table class="tabla-admin">
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th style="text-align:center;">Stock</th>
                            <th style="text-align:center;">Piezas</th>
                            <th style="text-align:right;">Precio</th>
                            <th style="text-align:center;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    carrito.forEach((p, index) => {
        let precio = p.precioContado || 0;
        let cantidad = p.cantidad || 1;
        const prod = productos.find(prod => prod.id === p.id);
        const stock = prod ? (prod.stock || 0) : 0;
        const colorStock = stock > 0 ? "#27ae60" : "#e74c3c";
        const textoStock = stock > 0 ? stock : "Sin stock";
        
        html += `
            <tr>
                <td><strong>${p.nombre}</strong></td>
                <td style="text-align:center; font-weight:bold; color:${colorStock};">${textoStock}</td>
                <td style="text-align:center;">
                    <input type="number" min="1" max="99" value="${cantidad}" 
                           onchange="actualizarCantidadCarrito(${index}, this.value)"
                           style="width:50px; padding:6px; text-align:center; border:1px solid #ddd; border-radius:4px;">
                </td>
                <td style="text-align:right; font-weight:bold; color:#27ae60;">${dinero(precio * cantidad)}</td>
                <td style="text-align:center;">
                    <button onclick="eliminarDelCarrito(${index}); renderCarrito();" 
                            style="background:#fed7d7; color:#c53030; border:none; padding:8px; border-radius:5px; cursor:pointer;">🗑️</button>
                </td>
            </tr>`;
    });

    html += `
                    </tbody>
                </table>
            </div>

            <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); position: sticky; top: 80px;">
                <h3 style="margin:0 0 10px 0; border-bottom:2px solid #f7fafc; padding-bottom:10px;">Resumen de Venta</h3>
                
                <div style="text-align:center; margin-bottom:20px;">
                    <span style="color:#718096; font-size:14px;">TOTAL CONTADO</span><br>
                    <strong style="font-size:32px; color:#2d3748;">${dinero(totalContado)}</strong>
                </div>

                <div class="campo">
                    <label>Forma de Pago:</label>
                    <select id="selMetodoPago" onchange="aplicarMetodoStockDefaults(); actualizarInterfazPago();" style="width:100%; padding:12px; border:1px solid #cbd5e0; border-radius:6px; font-weight:bold;">
                        <option value="contado">💰 Efectivo / Contado</option>
                        <option value="apartado">📦 Sistema de Apartado</option>
                        <option value="credito">💳 Crédito / Pagos Semanales</option>
                    </select>
                </div>

                <div id="divPeriodicidad" class="campo oculto" style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0;">
                    <label>📅 Periodicidad de Pago:</label>
                    <select id="selPeriodicidad" onchange="actualizarInterfazPago();" style="width:100%; padding:12px; border:1px solid #cbd5e0; border-radius:6px; font-weight:bold;">
                        <option value="semanal">📆 Semanal (4 pagos/mes)</option>
                        <option value="quincenal">📅 Quincenal (2 pagos/mes)</option>
                        <option value="mensual">📋 Mensual (1 pago/mes)</option>
                    </select>
                </div>

                <div id="divEnganche" class="campo oculto" style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0;">
                    <label>Enganche Recibido ($):</label>
                    <input type="number" id="numEnganche" value="0" min="0" oninput="actualizarInterfazPago()" 
                           style="width:100%; padding:12px; border:1px solid #3182ce; border-radius:6px; font-size:18px; font-weight:bold; color:#2b6cb0;">
                </div>

                <div id="resultadosPago" style="margin-top:20px; background:#f8fafc; padding:15px; border-radius:8px;"></div>

                <button onclick="irASeleccionCliente()"
                    style="width:100%; padding:15px; background:#27ae60; color:white; border:none; border-radius:8px; font-size:18px; font-weight:bold; margin-top:20px; cursor:pointer;">
                     ✅ Seleccionar cliente
                </button>
            </div>
        </div>
    `;

    vistaCarrito.innerHTML = html;
    actualizarInterfazPago();
    aplicarMetodoStockDefaults();
}

function actualizarCantidadCarrito(index, nuevaCantidad) {
    const cantidad = parseInt(nuevaCantidad);
    if (isNaN(cantidad) || cantidad < 1) {
        alert("La cantidad debe ser mayor a 0");
        return;
    }
    
    if (index >= 0 && index < carrito.length) {
        carrito[index].cantidad = cantidad;
        if (!StorageService.set("carrito", carrito)) {
            console.error("❌ Error actualizando cantidad");
        }
        renderCarrito();
    }
}

function aplicarMetodoStockDefaults() {
    const met = document.getElementById("selMetodoPago")?.value;
    const chkD = document.getElementById("chkDescontarStock");
    const chkR = document.getElementById("chkRequisicionSinStock");
    if (!chkD || !chkR) return;
    if (met === "apartado") {
        chkD.checked = false;
        chkR.checked = true;
    } else {
        chkD.checked = true;
        chkR.checked = true;
    }
}

function actualizarInterfazPago() {
    const metodo = document.getElementById("selMetodoPago")?.value;
    const divEnganche = document.getElementById("divEnganche");
    const divPeriodicidad = document.getElementById("divPeriodicidad");
    const resultados = document.getElementById("resultadosPago");

    if (!metodo || !resultados) return;

    let totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;

    if (metodo === "credito" || metodo === "apartado") {
    divEnganche?.classList.remove("oculto");
} else {
    divEnganche?.classList.add("oculto");
    enganche = 0;
}

if (metodo === "credito") {
    divPeriodicidad?.classList.remove("oculto");
} else {
    divPeriodicidad?.classList.add("oculto");
}

    let saldo = totalContado - enganche;
    if (saldo < 0) saldo = 0;

    if (metodo !== "credito") {
        plazoSeleccionado = null;
    }

    let html = "";

    if (metodo === "contado") {
        html = `<p><strong>Total a pagar:</strong> ${dinero(totalContado)}</p>`;
    }

    if (metodo === "apartado") {
        html = `
            <p>💰 Enganche: <strong>${dinero(enganche)}</strong></p>
            <p>📦 Saldo pendiente: <strong>${dinero(saldo)}</strong></p>
        `;
    }

    if (metodo === "credito") {
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldo, periodicidad);
        
        if (plazoSeleccionado === null || plazoSeleccionado < 0 || plazoSeleccionado >= planes.length) {
            plazoSeleccionado = 0;
        }

        html = `
        <p>💰 Enganche: <strong>${dinero(enganche)}</strong></p>
        <p>📉 Saldo financiado: <strong>${dinero(saldo)}</strong></p>
        <hr>
        <p><strong>Selecciona un plan:</strong></p>
    `;
        planes.forEach((plan, i) => {
            const checked = (plazoSeleccionado === i) ? "checked" : "";
            const textoPeriodicidad = periodicidad === "semanal" ? "/sem" : periodicidad === "quincenal" ? "/quin" : "/mes";
            html += `
            <div style="border:1px solid #e2e8f0; padding:10px; border-radius:8px; margin-bottom:8px; cursor:pointer;">
                <label style="cursor:pointer; display:block;">
                    <input type="radio" name="planCredito" value="${i}" ${checked}
                        onchange="seleccionarPlan(${i})">
                    📅 ${plan.meses} meses 
                    | 💳 Total: ${dinero(plan.total)} 
                    | 📆 ${dinero(plan.abono)}${textoPeriodicidad} (${plan.pagos} pagos)
                </label>
            </div>`;
        });
    }

    resultados.innerHTML = html;
}

function seleccionarPlan(index) {
    plazoSeleccionado = index;
}

function eliminarDelCarrito(index) {
    if (index >= 0 && index < carrito.length) {
        const producto = carrito[index];
        carrito.splice(index, 1);
        if (!StorageService.set("carrito", carrito)) {
            console.error("❌ Error guardando carrito");
        }
        actualizarContadorCarrito();
    }
}

// ===== VENTA FINAL (FUNCIÓN ÚNICA - NO DUPLICADA) =====
/**
 * Confirma la venta final con todos los parámetros validados
 */
function confirmarVentaFinal() {
    console.log("🔍 Iniciando confirmarVentaFinal()...");
    
    if (!clienteSeleccionado) {
        alert("⚠️ Por favor selecciona un cliente antes de continuar.");
        return;
    }
    
    if (carrito.length === 0) {
        alert("⚠️ El carrito está vacío.");
        return;
    }

    const metodoPago = document.getElementById("selMetodoPago")?.value;
    console.log("Método de pago:", metodoPago);
    
    if (!metodoPago) {
        alert("⚠️ Regresa al carrito y selecciona un método de pago.");
        return;
    }

    const totalContado = carrito.reduce((sum, p) => sum + (p.precioContado || 0) * (p.cantidad || 1), 0);
    console.log("Total contado:", totalContado);
    
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
    if (enganche < 0) enganche = 0;
    
    if (enganche > totalContado) {
        alert("⚠️ El enganche no puede ser mayor al total.");
        return;
    }

    const saldoAFinanciar = totalContado - enganche;
    let planElegido = null;

    if (metodoPago === "credito") {
        const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
        console.log("Periodicidad:", periodicidad);
        
        const planes = CalculatorService.calcularCreditoConPeriodicidad(saldoAFinanciar, periodicidad);
        console.log("Plazo seleccionado:", plazoSeleccionado);
        
        if (plazoSeleccionado === null || plazoSeleccionado === undefined || plazoSeleccionado < 0 || plazoSeleccionado >= planes.length) {
            alert("⚠️ Selecciona un plazo de crédito en el carrito antes de continuar.");
            return;
        }
        
        planElegido = planes[plazoSeleccionado];
        if (!planElegido) {
            alert("⚠️ Plazo de crédito inválido.");
            return;
        }
        
        console.log("Plan elegido:", planElegido);
    }

    console.log("✅ Todos los datos validados. Mostrando resumen...");
    mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido);
}

function mostrarResumenVenta(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido) {
    const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
    let detalleMetodo = "";

    if (metodoPago === "contado") {
        detalleMetodo = `<p style="color:#27ae60;"><strong>💰 CONTADO</strong></p>`;
    } else if (metodoPago === "apartado") {
        detalleMetodo = `
            <p><strong>📦 APARTADO</strong></p>
            <div style="background:#fffbeb; padding:10px; border-radius:5px;">
                <p style="margin:5px 0;">💵 Enganche: <strong>${dinero(enganche)}</strong></p>
                <p style="margin:5px 0;">📦 Pendiente: <strong>${dinero(saldoAFinanciar)}</strong></p>
            </div>
        `;
    } else if (metodoPago === "credito") {
        const textoPeriodicidad = periodicidad === "semanal" ? "Semanales" : periodicidad === "quincenal" ? "Quincenales" : "Mensuales";
        detalleMetodo = `
            <p><strong>💳 CRÉDITO</strong></p>
            <div style="background:#dbeafe; padding:10px; border-radius:5px;">
                <p style="margin:5px 0;">💵 Enganche: <strong>${dinero(enganche)}</strong></p>
                <p style="margin:5px 0;">📊 Plazo: <strong>${planElegido.meses} meses</strong></p>
                <p style="margin:5px 0;">📅 Períodos: <strong>${textoPeriodicidad} (${planElegido.pagos} pagos)</strong></p>
                <p style="margin:5px 0;">🔢 Abono: <strong>${dinero(planElegido.abono)}</strong></p>
                <p style="margin:5px 0;">💰 Total a pagar: <strong>${dinero(planElegido.total)}</strong></p>
            </div>
        `;
    }

    const resumenProductos = carrito.map(p => {
        const cantidad = p.cantidad || 1;
        const subtotal = (p.precioContado || 0) * cantidad;
        return `<tr>
            <td>${p.nombre}</td>
            <td style="text-align:center;">${cantidad}</td>
            <td style="text-align:right;">${dinero(p.precioContado)}</td>
            <td style="text-align:right; font-weight:bold;">${dinero(subtotal)}</td>
        </tr>`;
    }).join('');

    _planElegidoPendiente = planElegido;

    // Eliminar modal anterior si existe
    document.querySelector('[data-modal="resumen-venta"]')?.remove();

    const modalHTML = `
    <div class="modal" data-modal="resumen-venta" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:700px; margin:20px auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">📋 Resumen de Transacción</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <h4 style="margin:0 0 10px 0; color:#166534;">👤 Cliente</h4>
                    <p style="margin:5px 0;"><strong>${clienteSeleccionado.nombre}</strong></p>
                    ${clienteSeleccionado.telefono ? `<p style="margin:5px 0;">📞 ${clienteSeleccionado.telefono}</p>` : ''}
                    ${clienteSeleccionado.direccion ? `<p style="margin:5px 0;">📍 ${clienteSeleccionado.direccion}</p>` : ''}
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="color:#2c3e50; margin:0 0 10px 0;">🛍️ Productos</h4>
                    <table class="tabla-admin" style="width:100%; font-size:14px;">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th style="text-align:center;">Cant.</th>
                                <th style="text-align:right;">Precio Unit.</th>
                                <th style="text-align:right;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${resumenProductos}</tbody>
                    </table>
                </div>

                <div style="background:#f8f9fa; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <p style="margin:8px 0; display:flex; justify-content:space-between;">
                        <span>Subtotal:</span>
                        <strong>${dinero(totalContado)}</strong>
                    </p>
                </div>

                <div style="margin-bottom:20px;">
                    <h4 style="color:#2c3e50; margin:0 0 10px 0;">💳 Forma de Pago</h4>
                    ${detalleMetodo}
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarVentaConInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar})" 
                            style="flex:1; padding:14px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✅ Confirmar Venta
                    </button>
                    <button onclick="cancelarYVolverAlCarrito()" 
        style="padding: 12px 24px; background: #e74c3c; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
    ✕ Cancelar
</button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}
function cancelarYVolverAlCarrito() {
    // Ocultar modales estáticos
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('oculto');
        modal.style.display = 'none';
    });
    // Eliminar modales dinámicos del DOM
    document.querySelectorAll('[data-modal]').forEach(modal => modal.remove());
    
    // Ir al carrito
    navA('carrito');
}

function procesarVentaConInventario(metodoPago, totalContado, enganche, saldoAFinanciar) {
    console.log("🔄 Procesando venta con inventario...");
    console.log("Plan elegido final:", _planElegidoPendiente);
    mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, _planElegidoPendiente);
}

/**
 * Dialogo interactivo de gestión de inventario
 * Pregunta por cada producto si se entrega o se deja pendiente
 */
function mostrarDialogoInventario(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido) {
    let productosConStock = [];
    let productosSinStock = [];

    // Reiniciar decisiones para evitar estado residual de un diálogo anterior
    decisionesInventario = {};

    // Clasificar productos: solo "con stock" si hay suficiente para la cantidad solicitada
    carrito.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (prod) {
            if ((prod.stock || 0) >= (item.cantidad || 1)) {
                productosConStock.push({ item, prod });
            } else {
                productosSinStock.push({ item, prod });
            }
        }
    });

    // Crear modal interactivo
    let htmlProductos = '';

    // PRODUCTOS CON STOCK - Preguntar SÍ o NO
    if (productosConStock.length > 0) {
        htmlProductos += `
            <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px; border-left:5px solid #27ae60;">
                <h4 style="margin:0 0 15px 0; color:#166534;">✅ PRODUCTOS CON STOCK</h4>
        `;
        
        productosConStock.forEach(x => {
            const idProd = x.prod.id;
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong>${x.prod.nombre}</strong><br>
                        <small style="color:#718096;">Stock disponible: ${x.prod.stock} | Solicitado: ${x.item.cantidad || 1}</small>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="setDecisionInventario(${idProd}, true)" 
                                id="btn-si-${idProd}"
                                style="padding:8px 16px; background:#27ae60; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                            ✅ Entregar
                        </button>
                        <button onclick="setDecisionInventario(${idProd}, false)" 
                                id="btn-no-${idProd}"
                                style="padding:8px 16px; background:#f59e0b; color:white; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">
                            ⏳ Pendiente
                        </button>
                    </div>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    // PRODUCTOS SIN STOCK - Solo aviso
    if (productosSinStock.length > 0) {
        htmlProductos += `
            <div style="background:#fee2e2; padding:15px; border-radius:8px; border-left:5px solid #dc2626;">
                <h4 style="margin:0 0 15px 0; color:#7f1d1d;">📦 PRODUCTOS SIN STOCK</h4>
        `;
        
        productosSinStock.forEach(x => {
            const idProd = x.prod.id;
            decisionesInventario[idProd] = { entregar: false }; // Auto pendiente
            
            htmlProductos += `
                <div style="background:white; padding:12px; border-radius:6px; margin-bottom:10px;">
                    <strong>${x.prod.nombre}</strong><br>
                    <small style="color:#991b1b;">⚠️ Se creará REQUISICIÓN DE COMPRA automáticamente</small><br>
                    <small style="color:#7f1d1d;">Stock actual: ${x.prod.stock || 0} | Solicitado: ${x.item.cantidad || 1}</small>
                </div>
            `;
        });
        
        htmlProductos += `</div>`;
    }

    // Eliminar modal anterior si existe
    document.querySelector('[data-modal="dialogo-inventario"]')?.remove();

    const modalHTML = `
        <div class="modal" data-modal="dialogo-inventario" style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:7000; display:flex; justify-content:center; align-items:center; overflow-y:auto;">
            <div style="background:white; padding:30px; border-radius:15px; width:95%; max-width:700px; margin:20px auto;">
                
                <h2 style="margin-top:0; color:#2c3e50;">📦 Gestión de Inventario</h2>
                <p style="color:#718096; margin:0 0 20px 0;">Confirma cómo se entregarán los productos</p>
                
                ${htmlProductos}
                
                <div style="display:flex; gap:10px; margin-top:20px;">
                    <button onclick="confirmarDecisionesInventario('${metodoPago}', ${totalContado}, ${enganche}, ${saldoAFinanciar})" 
                            style="flex:1; padding:14px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✅ Procesar Venta
                    </button>
                    <button onclick="cancelarYVolverAlCarrito()" 
                            style="flex:1; padding:14px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:16px;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Guarda la decisión de cada producto (entregar o pendiente)
 */
function setDecisionInventario(productoId, entregar) {
    decisionesInventario[productoId] = { entregar };
    
    // Actualizar visual de botones
    const btnSi = document.getElementById(`btn-si-${productoId}`);
    const btnNo = document.getElementById(`btn-no-${productoId}`);
    
    if (entregar) {
        btnSi.style.background = '#27ae60';
        btnSi.style.opacity = '1';
        btnNo.style.background = '#cbd5e0';
        btnNo.style.opacity = '0.5';
    } else {
        btnNo.style.background = '#f59e0b';
        btnNo.style.opacity = '1';
        btnSi.style.background = '#cbd5e0';
        btnSi.style.opacity = '0.5';
    }
}

/**
 * Confirma todas las decisiones y procesa la venta
 */
function confirmarDecisionesInventario(metodoPago, totalContado, enganche, saldoAFinanciar) {
    const planElegido = _planElegidoPendiente;

    const folioVenta = "V-" + Date.now().toString().slice(-6);
    const fechaHoy = new Date().toLocaleDateString("es-MX");
    const fechaVentaIso = new Date().toISOString();

    let productosAEntregar = [];
    let productosAPendiente = [];

    // Procesar decisiones
    carrito.forEach(item => {
        const prod = productos.find(p => p.id === item.id);
        if (!prod) return;

        const decision = decisionesInventario[item.id];
        const tieneStock = (prod.stock || 0) >= (item.cantidad || 1);

        if (tieneStock && decision && decision.entregar) {
            // ENTREGAR AHORA
            productosAEntregar.push({ item, prod });
        } else {
            // DEJAR PENDIENTE O SIN STOCK
            productosAPendiente.push({ item, prod });
        }
    });

    // Procesar venta final
    procesarVentaFinal(
        metodoPago, 
        totalContado, 
        enganche, 
        saldoAFinanciar, 
        planElegido,
        folioVenta, 
        fechaHoy, 
        fechaVentaIso, 
        productosAEntregar, 
        productosAPendiente
    );
}

function procesarVentaFinal(metodoPago, totalContado, enganche, saldoAFinanciar, planElegido,
                            folioVenta, fechaHoy, fechaVentaIso, productosConStock, productosSinStock) {
    
    requisicionesCompra = StorageService.get("requisicionesCompra", []);
    movimientosCaja = StorageService.get("movimientosCaja", []);
    cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    pagaresSistema = StorageService.get("pagaresSistema", []);

    let entregasPendientes = [];

    // PASO 1: ACTUALIZAR STOCK (solo si hay stock suficiente; guard anti-negativo)
    productosConStock.forEach(x => {
        const cantRequerida = x.item.cantidad || 1;
        const stockActual = x.prod.stock || 0;
        if (stockActual >= cantRequerida) {
            x.prod.stock = stockActual - cantRequerida;
            registrarMovimiento(x.prod.id, `Venta - ${folioVenta}`, cantRequerida, "salida");
        } else {
            // Stock insuficiente en este punto (no debería ocurrir con la clasificación correcta)
            console.warn(`⚠️ Stock insuficiente para ${x.prod.nombre} al procesar venta. Creando requisición.`);
            requisicionesCompra.push({
                id: Date.now() + Math.random(),
                fecha: fechaHoy,
                producto: x.prod.nombre,
                folioVenta,
                cantidad: cantRequerida - stockActual,
                motivo: "Stock insuficiente al confirmar entrega",
                estatus: "Pendiente"
            });
        }
    });

    // PASO 2: CREAR ENTREGAS PENDIENTES
    productosSinStock.forEach(x => {
        const cantidadSolicitada = x.item.cantidad || 1;
        entregasPendientes.push({
            id: Date.now() + Math.random(),
            folioVenta,
            productoId: x.prod.id,
            nombre: x.prod.nombre,
            cantidad: cantidadSolicitada,
            motivo: "Sin stock en almacén"
        });

        requisicionesCompra.push({
            id: Date.now() + Math.random(),
            fecha: fechaHoy,
            producto: x.prod.nombre,
            folioVenta,
            cantidad: cantidadSolicitada,
            motivo: "Venta sin stock disponible",
            estatus: "Pendiente"
        });
    });

    // PASO 3: REGISTRAR MOVIMIENTOS DE CAJA
    if (metodoPago === "contado") {
        movimientosCaja.push({
            id: Date.now(),
            folio: folioVenta,
            fecha: fechaHoy,
            tipo: "ingreso",
            monto: totalContado,
            concepto: `Venta Contado - ${clienteSeleccionado.nombre}`,
            referencia: "Contado"
        });
    } else if (enganche > 0) {
        movimientosCaja.push({
            id: Date.now(),
            folio: folioVenta,
            fecha: fechaHoy,
            tipo: "ingreso",
            monto: enganche,
            concepto: `Enganche ${metodoPago} - ${clienteSeleccionado.nombre}`,
            referencia: "Enganche"
        });
    }

    // PASO 4: CREAR CUENTAS POR COBRAR
    if (metodoPago === "credito" || metodoPago === "apartado") {
        const saldoPendiente = metodoPago === "credito" ? planElegido.total : saldoAFinanciar;

        const cuentaNueva = {
            folio: folioVenta,
            nombre: clienteSeleccionado.nombre,
            clienteId: clienteSeleccionado.id,
            direccion: clienteSeleccionado.direccion || "",
            referencia: clienteSeleccionado.referencia || "",
            telefono: clienteSeleccionado.telefono || "",
            fechaVenta: fechaVentaIso,
            totalContadoOriginal: totalContado,
            engancheRecibido: enganche,
            saldoActual: saldoPendiente,
            saldoOriginal: saldoPendiente,
            metodo: metodoPago,
            plan: planElegido,
            estado: "Pendiente",
            abonos: [],
            articulos: JSON.parse(JSON.stringify(carrito)),
            totalMercancia: totalContado
        };

        cuentasPorCobrar.push(cuentaNueva);

        // PASO 5: CREAR PAGARÉS
        if (metodoPago === "credito" && planElegido) {
            const periodicidad = document.getElementById("selPeriodicidad")?.value || "semanal";
            let diasIntervalo = 7;
            
            if (periodicidad === "quincenal") diasIntervalo = 14;
            if (periodicidad === "mensual") diasIntervalo = 30;
            
            let fechaPago = new Date(fechaVentaIso);
            const totalPagos = planElegido.pagos || Math.round(planElegido.semanas / (periodicidad === "quincenal" ? 2 : periodicidad === "mensual" ? 4 : 1));
            
            for (let i = 1; i <= totalPagos; i++) {
                fechaPago.setDate(fechaPago.getDate() + diasIntervalo);
                pagaresSistema.push({
                    id: Date.now() + i,
                    folio: folioVenta,
                    numeroPagere: `${folioVenta}-${i}/${totalPagos}`,
                    clienteNombre: clienteSeleccionado.nombre,
                    clienteId: clienteSeleccionado.id,
                    clienteDireccion: clienteSeleccionado.direccion || "",
                    fechaEmision: fechaVentaIso,
                    fechaVencimiento: fechaPago.toISOString(),
                    monto: planElegido.abono,
                    estado: "Pendiente",
                    diasAtrasoActual: 0,
                    tasaMorosidad: 2,
                    acreedor: "Roberto Escobedo Vega",
                    lugar: "Santiago Cuaula, Tlaxcala"
                });
            }
        }

        if (!StorageService.set("cuentasPorCobrar", cuentasPorCobrar)) {
            console.error("❌ Error guardando cuentas por cobrar");
        }
        if (!StorageService.set("pagaresSistema", pagaresSistema)) {
            console.error("❌ Error guardando pagarés");
        }
    }

    // GUARDAR TODO
    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("movimientosCaja", movimientosCaja)) {
        console.error("❌ Error guardando movimientos de caja");
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos de inventario");
    }
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) {
        console.error("❌ Error guardando requisiciones");
    }

    if (entregasPendientes.length > 0) {
        salidasPendientesVenta.push({
            id: Date.now(),
            folioVenta,
            fecha: fechaHoy,
            fechaIso: fechaVentaIso,
            clienteId: clienteSeleccionado.id,
            clienteNombre: clienteSeleccionado.nombre,
            clienteDireccion: clienteSeleccionado.direccion || "",
            metodoPago,
            items: entregasPendientes,
            estatus: "Pendiente"
        });
        if (!StorageService.set("salidasPendientesVenta", salidasPendientesVenta)) {
            console.error("❌ Error guardando salidas pendientes");
        }
    }

    // GENERAR TICKET
    const datosVenta = {
        folio: folioVenta,
        fecha: fechaHoy,
        fechaIso: fechaVentaIso,
        cliente: clienteSeleccionado,
        metodo: metodoPago,
        total: totalContado,
        enganche: enganche,
        saldoPendiente: metodoPago === "credito" ? planElegido.total : (metodoPago === "apartado" ? saldoAFinanciar : 0),
        plan: planElegido,
        articulos: [...carrito],
        tipoComprobante: metodoPago === "apartado" ? "recibo_apartado" : metodoPago === "credito" ? "pagare" : "factura",
        periodicidad: document.getElementById("selPeriodicidad")?.value || "semanal",
        acreedor: "Roberto Escobedo Vega",
        lugar: "Santiago Cuaula, Tlaxcala",
        tasaMorosidad: 2
    };

    generarTicketMediaHoja(datosVenta);

    // LIMPIAR
    carrito = [];
    clienteSeleccionado = null;
    plazoSeleccionado = null;
    if (!StorageService.set("carrito", carrito)) {
        console.error("❌ Error limpiando carrito");
    }
    actualizarContadorCarrito();

    alert(`✅ VENTA REGISTRADA\n\nFolio: ${folioVenta}\nCliente: ${datosVenta.cliente.nombre}\nTotal: ${dinero(datosVenta.total)}`);
    navA('tienda');
}


// ===== GENERADOR DE TICKETS (COMPLETO) =====
function generarTicketMediaHoja(datosVenta) {
    // Preparar datos
    const folio = datosVenta.folio;
    const fechaActual = datosVenta.fecha;
    
    let tablaProductos = '';
    datosVenta.articulos.forEach(art => {
        const cantidad = art.cantidad || 1;
        const subtotal = (art.precioContado || 0) * cantidad;
        tablaProductos += `
            <tr>
                <td style="border: 1px solid #333; padding: 8px; text-align: center;">${cantidad}</td>
                <td style="border: 1px solid #333; padding: 8px;">${art.nombre}</td>
                <td style="border: 1px solid #333; padding: 8px; text-align: right;">${dinero(art.precioContado)}</td>
                <td style="border: 1px solid #333; padding: 8px; text-align: right;">${dinero(subtotal)}</td>
            </tr>
        `;
    });

    let tablaPagares = '';
    let totalAPagar = 0;

    if (datosVenta.metodo === "credito" && datosVenta.plan) {
        const pagares = StorageService.get("pagaresSistema", []);
        const pagaresDelFolio = pagares.filter(p => p.folio === folio);

        pagaresDelFolio.forEach((pagar, index) => {
            const fechaPago = new Date(pagar.fechaVencimiento);
            const fechaFormato = fechaPago.toLocaleDateString('es-MX');
            totalAPagar += pagar.monto;
            
            tablaPagares += `
                <tr>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center; font-weight: bold;">${index + 1}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">${fechaFormato}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: right; font-weight: bold;">${dinero(pagar.monto)}</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                    <td style="border: 1px solid #333; padding: 6px; text-align: center;">__________</td>
                </tr>
            `;
        });
    }

    // Tabla de resumen de planes
    const planesDisponibles = CalculatorService.calcularCredito(datosVenta.total);
    let tablaPlanes = '';
    planesDisponibles.forEach(plan => {
        const textoMeses = plan.meses === 1 ? `${plan.meses} MES (Contado)` : `${plan.meses} MESES`;
        const textoInteres = plan.meses === 1 ? '(Sin interés)' : '(Total)';
        tablaPlanes += `
            <td style="border: 1px solid #333; padding: 8px; text-align: center;">
                <strong>${textoMeses}</strong><br>
                ${dinero(plan.total)}<br>
                <small>${textoInteres}</small>
            </td>
        `;
    });

    const ticketHTML = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>TICKET DE VENTA - ${folio}</title>
            <style>
                * { 
                    margin: 0; 
                    padding: 0; 
                    box-sizing: border-box; 
                }
                body {
                    font-family: 'Arial', sans-serif;
                    background: white;
                    padding: 20px;
                    line-height: 1.4;
                }
                .ticket {
                    width: 100%;
                    max-width: 900px;
                    margin: 0 auto;
                    background: white;
                    border: 3px solid #1a3a70;
                    padding: 20px;
                }
                .encabezado {
                    display: grid;
                    grid-template-columns: 100px 1fr 150px;
                    gap: 20px;
                    align-items: center;
                    border-bottom: 3px solid #333;
                    padding-bottom: 15px;
                    margin-bottom: 15px;
                }
                .logo {
                    width: 100px;
                    height: 100px;
                    background: radial-gradient(circle at 30% 30%, #87ceeb, #4a90e2);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 60px;
                    border: 3px solid #1a3a70;
                }
                .titulo {
                    text-align: center;
                }
                .titulo h1 {
                    color: #1a3a70;
                    font-size: 28px;
                    margin: 0;
                }
                .titulo p {
                    color: #333;
                    font-size: 12px;
                    margin: 5px 0 0 0;
                }
                .folio-box {
                    border: 2px solid #333;
                    padding: 10px;
                    text-align: center;
                    font-weight: bold;
                }
                .folio-number {
                    color: #dc2626;
                    font-size: 24px;
                }
                .subtitulo {
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    margin: 15px 0;
                    color: #1a3a70;
                }
                .fecha {
                    text-align: right;
                    font-weight: bold;
                    margin-bottom: 15px;
                }
                .seccion-titulo {
                    background: #1a3a70;
                    color: white;
                    padding: 10px 15px;
                    font-weight: bold;
                    margin: 15px 0 10px 0;
                    border-radius: 4px;
                }
                .datos-cliente {
                    border: 2px solid #333;
                    padding: 15px;
                    margin-bottom: 15px;
                }
                .datos-cliente p {
                    margin: 8px 0;
                    font-size: 13px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                }
                th {
                    background: #e8f0fe;
                    border: 1px solid #333;
                    padding: 10px;
                    text-align: left;
                    font-weight: bold;
                    color: #1a3a70;
                }
                td {
                    border: 1px solid #333;
                    padding: 8px;
                }
                .total-row {
                    background: #f0f0f0;
                    font-weight: bold;
                }
                .enganche-box {
                    background: #fffbeb;
                    border: 2px solid #f59e0b;
                    padding: 15px;
                    margin: 15px 0;
                    display: grid;
                    grid-template-columns: 1fr 200px;
                    gap: 20px;
                }
                .enganche-texto {
                    font-size: 14px;
                    color: #92400e;
                }
                .enganche-monto {
                    background: white;
                    border: 2px solid #f59e0b;
                    padding: 10px;
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    color: #f59e0b;
                }
                .tabla-pagares {
                    margin-top: 20px;
                }
                .tabla-pagares-titulo {
                    background: #1a3a70;
                    color: white;
                    padding: 10px;
                    text-align: center;
                    font-weight: bold;
                    border-radius: 4px;
                    margin-bottom: 10px;
                }
                .planes-resumen {
                    background: #1a3a70;
                    color: white;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                    text-align: center;
                }
                .planes-titulo {
                    font-weight: bold;
                    margin-bottom: 15px;
                    font-size: 14px;
                }
                .planes-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 10px;
                }
                .plan-item {
                    background: #0f2847;
                    padding: 10px;
                    border-radius: 4px;
                    font-size: 11px;
                    text-align: center;
                }
                .firma-section {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 40px;
                    margin-top: 30px;
                    text-align: center;
                }
                .linea-firma {
                    border-top: 2px solid #333;
                    padding-top: 10px;
                    font-weight: bold;
                    font-size: 12px;
                }
                .notas-legales {
                    background: #f0f0f0;
                    padding: 15px;
                    margin-top: 20px;
                    font-size: 10px;
                    line-height: 1.6;
                    border: 1px solid #333;
                    text-align: justify;
                }
                @media print {
                    body { 
                        padding: 0; 
                    }
                    .ticket { 
                        border: none; 
                        max-width: 100%; 
                    }
                }
            </style>
        </head>
        <body>
            <div class="ticket">
                <!-- ENCABEZADO -->
                <div class="encabezado">
                    <div class="logo">🏛️</div>
                    <div class="titulo">
                        <h1>MUEBLERÍA<br>MI PUEBLITO</h1>
                        <p>"Calidad, Estilo y Precio que te hacen sentir en casa"</p>
                        <p style="margin-top: 8px;">Santiago Cuaula, Tlaxcala • Tel. 228 123 4567</p>
                    </div>
                    <div class="folio-box">
                        FOLIO:<br>
                        <div class="folio-number">${folio}</div>
                    </div>
                </div>

                <!-- TÍTULO Y FECHA -->
                <div style="text-align: center; margin-bottom: 10px;">
                    <div class="subtitulo">TICKET DE VENTA</div>
                    <div class="fecha">FECHA: ${fechaActual}</div>
                </div>

                <!-- DATOS DEL CLIENTE -->
                <div class="seccion-titulo">DATOS DEL CLIENTE</div>
                <div class="datos-cliente">
                    <p><strong>NOMBRE:</strong> ${datosVenta.cliente.nombre}</p>
                    <p><strong>TELÉFONO:</strong> ${datosVenta.cliente.telefono || '_______________________'}</p>
                    <p><strong>DOMICILIO:</strong> ${datosVenta.cliente.direccion || '_______________________'}</p>
                </div>

                <!-- TABLA DE PRODUCTOS -->
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px; text-align: center;">CANT.</th>
                            <th>DESCRIPCIÓN DEL PRODUCTO</th>
                            <th style="width: 120px; text-align: right;">PRECIO UNIT.</th>
                            <th style="width: 120px; text-align: right;">IMPORTE</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tablaProductos}
                        <tr class="total-row">
                            <td colspan="3" style="text-align: right;">TOTAL DE LA VENTA:</td>
                            <td style="text-align: right; color: #dc2626; font-size: 16px;">${dinero(datosVenta.total)}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- ENGANCHE -->
                ${datosVenta.enganche > 0 ? `
                    <div class="enganche-box">
                        <div class="enganche-texto">
                            <strong>ENGANCHE RECIBIDO:</strong><br>
                            Se descuenta del total y el saldo restante se financia.
                        </div>
                        <div class="enganche-monto">
                            ${dinero(datosVenta.enganche)}
                        </div>
                    </div>
                ` : ''}

                <!-- TABLA DE PAGARÉS (Solo si es crédito) -->
                ${datosVenta.metodo === "credito" && datosVenta.plan ? `
                    <div class="tabla-pagares">
                        <div class="tabla-pagares-titulo">PAGARÉS (TABLA DE AMORTIZACIONES)</div>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 50px;">No.</th>
                                    <th>FECHA DE ABONO (PAGARÉ)</th>
                                    <th style="width: 120px;">IMPORTE DE ABONO</th>
                                    <th>FECHA REAL DE ABONO (LLENAR)</th>
                                    <th>SALDO (LLENAR)</th>
                                    <th>FIRMA</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tablaPagares}
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right;">TOTAL A PAGAR:</td>
                                    <td style="text-align: right; color: #dc2626; font-size: 14px;">${dinero(totalAPagar)}</td>
                                    <td colspan="3"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <!-- RESUMEN DE PLANES -->
                <div class="planes-resumen">
                    <div class="planes-titulo">RESUMEN DE SU PLAN DE PAGOS (SEGÚN SU COTIZACIÓN)</div>
                    <table style="background: transparent; margin: 0; border: none;">
                        <tr>
                            ${tablaPlanes}
                        </tr>
                    </table>
                </div>

                <!-- NOTAS Y TÉRMINOS -->
                <div class="notas-legales">
                    <strong>TÉRMINOS Y CONDICIONES:</strong>
                    <br><br>
                    Al firmar este ticket, acepto los términos de pago y me comprometo a cubrir cada pagaré en la fecha indicada.
                    <br><br>
                    <strong>Este pagaré se otorga en los términos del Art. 170 de la Ley General de Títulos y Operaciones de Crédito.</strong> El suscriptor se obliga incondicionalmente a pagar esta cantidad en la fecha indicada. El incumplimiento en el pago, ya sea total o parcial, causará intereses moratorios a razón de la tasa establecida (2% mensual). En caso de juicio, el deudor será responsable de los gastos de cobro que se generen.
                    <br><br>
                    Por lo relativo a la interpretación, cumplimiento y ejecución de este pagaré, las partes se someten a la jurisdicción de los tribunales del domicilio del acreedor (Santiago Cuaula, Tlaxcala), renunciando a cualquier otro fuero que pudiera corresponderle.
                </div>

                <!-- FIRMAS -->
                <div class="firma-section">
                    <div>
                        <div style="margin-bottom: 40px;"></div>
                        <div class="linea-firma">FIRMA DEL CLIENTE</div>
                    </div>
                    <div>
                        <div style="margin-bottom: 40px;"></div>
                        <div class="linea-firma">VENDEDOR / EMPRESA</div>
                    </div>
                </div>

                <!-- PIE -->
                <div style="text-align: center; margin-top: 20px; color: #666; font-size: 11px;">
                    <p><strong>Mueblería Mi Pueblito</strong></p>
                    <p>Roberto Escobedo Vega</p>
                    <p>Santiago Cuaula, Tlaxcala • Tel. 228 123 4567</p>
                    <p style="margin-top: 10px; color: #999;">Documento emitido: ${new Date().toLocaleString('es-MX')}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Crear e imprimir
    const ventanaImpresion = window.open('', '_blank');
    if (!ventanaImpresion) {
        alert("⚠️ Habilita las ventanas emergentes para imprimir el ticket");
        return;
    }
    
    ventanaImpresion.document.write(ticketHTML);
    ventanaImpresion.document.close();
    ventanaImpresion.focus();
    
    setTimeout(() => {
        ventanaImpresion.print();
    }, 500);
    // Guardar ticket en registro
    guardarTicketEnRegistro(datosVenta, folio);
}

/**
 * Guarda el ticket en el registro histórico
 * @param {Object} datosVenta - Datos de la venta
 * @param {string} folio - Folio único del ticket
 */
function guardarTicketEnRegistro(datosVenta, folio) {
    let registroTickets = StorageService.get("registroTickets", []);
    
    const pagares = StorageService.get("pagaresSistema", []);
    const pagaresDelFolio = pagares.filter(p => p.folio === folio);

    const ticketRegistro = {
        id: Date.now(),
        folio: folio,
        fechaEmision: datosVenta.fechaIso,
        cliente: {
            id: datosVenta.cliente.id,
            nombre: datosVenta.cliente.nombre,
            telefono: datosVenta.cliente.telefono,
            direccion: datosVenta.cliente.direccion,
            referencia: datosVenta.cliente.referencia
        },
        venta: {
            total: datosVenta.total,
            enganche: datosVenta.enganche,
            saldoPendiente: datosVenta.saldoPendiente,
            metodoPago: datosVenta.metodo,
            plan: datosVenta.plan,
            articulos: datosVenta.articulos
        },
        pagares: pagaresDelFolio.map(p => ({
            numeroPagere: p.numeroPagere,
            fechaVencimiento: p.fechaVencimiento,
            monto: p.monto,
            estado: p.estado,
            fechaAbonada: null,
            montoAbonado: 0,
            saldoRestante: p.monto
        })),
        planesDisponibles: CalculatorService.calcularCredito(datosVenta.total),
        estado: "Activo",
        abonos: [],
        ultimaActualizacion: new Date().toISOString()
    };

    registroTickets.push(ticketRegistro);
    if (!StorageService.set("registroTickets", registroTickets)) {
        console.error("❌ Error guardando ticket en registro");
    }
}

// ===== CUENTAS POR COBRAR =====
function irASeleccionCliente() {
    navA("seleccionarcliente");
    renderResumenVentaCliente();
    cargarClientesSelect();
}

function mostrarInfoCliente() {
    const div = document.getElementById("infoCliente");
    if (!clienteSeleccionado || !div) return;

    div.innerHTML = `
        <div style="background:#f7fafc; padding:15px; border-radius:8px;">
            <strong style="font-size:16px;">${clienteSeleccionado.nombre}</strong><br>
            ${clienteSeleccionado.direccion ? `📍 ${clienteSeleccionado.direccion}<br>` : ''}
            ${clienteSeleccionado.telefono ? `📞 ${clienteSeleccionado.telefono}<br>` : ''}
            ${clienteSeleccionado.referencia ? `📝 ${clienteSeleccionado.referencia}` : ''}
        </div>
    `;
}

function cargarClientesSelect(lista = clientes) {
    const select = document.getElementById("selectCliente");
    if (!select) return;

    select.innerHTML = "<option value=''>-- Selecciona un cliente --</option>";

    lista.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = `${c.nombre} - ${c.telefono || 'Sin teléfono'}`;
        select.appendChild(option);
    });

    select.onchange = () => {
        clienteSeleccionado = clientes.find(c => c.id == select.value);
        mostrarInfoCliente();
    };
}

function filtrarClientes() {
    const texto = document.getElementById("buscarCliente").value.toLowerCase();

    const filtrados = clientes.filter(c =>
        c.nombre.toLowerCase().includes(texto) ||
        (c.telefono || "").includes(texto)
    );

    cargarClientesSelect(filtrados);
}

function abrirModalCliente() {
    const nombre = prompt("Nombre del cliente:");
    if (!nombre) return;

    const telefono = prompt("Teléfono:");
    const nuevo = {
        id: Date.now(),
        nombre,
        telefono,
        fechaRegistro: new Date().toLocaleDateString('es-MX')
    };

    clientes.push(nuevo);
    if (!StorageService.set("clientes", clientes)) {
        console.error("❌ Error guardando cliente");
        return;
    }

    cargarClientesSelect();
}

function renderResumenVentaCliente() {
    const cont = document.getElementById("resumenVentaCliente");
    if (!cont) return;

    let totalContado = carrito.reduce((sum, p) => sum + ((p.precioContado || 0) * (p.cantidad || 1)), 0);
    let enganche = parseFloat(document.getElementById("numEnganche")?.value) || 0;
    let saldo = totalContado - enganche;

    let detalleProductos = carrito.map(p => {
        const cantidad = p.cantidad || 1;
        const subtotal = (p.precioContado || 0) * cantidad;
        return `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; padding:8px; background:#f8f9fa; border-radius:5px;">
                <span>${p.nombre} ×${cantidad}</span>
                <strong style="color:#27ae60;">${dinero(subtotal)}</strong>
            </div>
        `;
    }).join("");

    cont.innerHTML = `
        <div style="background:white; padding:20px; border-radius:10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
            <h3 style="margin:0 0 15px 0; color:#2c3e50;">🧾 Resumen de Compra</h3>

            <div style="background:#f0f4f8; padding:15px; border-radius:8px; margin-bottom:15px;">
                ${detalleProductos}
            </div>

            <div style="background:#f8f9fa; padding:15px; border-radius:8px; border-left:4px solid #3498db;">
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;">
                    <span>Subtotal:</span>
                    <strong>${dinero(totalContado)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #e2e8f0;">
                    <span>Enganche:</span>
                    <strong style="color:#f59e0b;">-${dinero(enganche)}</strong>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:16px;">
                    <span style="font-weight:bold;">Saldo:</span>
                    <strong style="color:#27ae60; font-size:18px;">${dinero(saldo)}</strong>
                </div>
            </div>
        </div>
    `;
}

function renderCuentasXCobrar() {
    const contenedor = document.getElementById("tablaCuentasXCobrar");
    if (!contenedor) return;

    const cuentas = StorageService.get("cuentasPorCobrar", []);

    if (cuentas.length === 0) {
        contenedor.innerHTML = `<div style="background:#f0fdf4; padding:40px; text-align:center; border-radius:10px;"><p style="font-size:18px; color:#27ae60; font-weight:bold;">✅ ¡No hay cuentas pendientes!</p></div>`;
        return;
    }

    let html = `<div style="overflow-x:auto;"><table class="tabla-admin">
        <thead><tr>
            <th>Cliente / Folio</th>
            <th>Fecha Venta</th>
            <th>Total Venta</th>
            <th>Saldo Actual</th>
            <th>Estatus</th>
            <th>Acciones</th>
        </tr></thead>
        <tbody>`;

    cuentas.forEach(cuenta => {
        if (cuenta.estado === "Saldado") return;

        const saldo = Number(cuenta.saldoActual ?? 0);
        const color = saldo > 0 ? "#27ae60" : "#999";
        const fechaVenta = new Date(cuenta.fechaVenta).toLocaleDateString('es-MX');

        html += `<tr>
            <td><strong>${cuenta.nombre}</strong><br><small style="color:#718096;">${cuenta.folio}</small></td>
            <td>${fechaVenta}</td>
            <td>${dinero(cuenta.totalContadoOriginal ?? 0)}</td>
            <td style="font-weight:bold; color:${color};">${dinero(saldo)}</td>
            <td>${cuenta.metodo === "apartado" ? "📦 Apartado" : "💳 Crédito"}</td>
            <td>
                <button onclick="abrirModalAbonoAvanzado('${cuenta.folio}')" style="padding:6px 12px; background:#27ae60; color:white; border:none; border-radius:4px; cursor:pointer;">💰 Abonar</button>
            </td>
        </tr>`;
    });

    html += `</tbody></table></div>`;
    contenedor.innerHTML = html;
}

function renderCobranzaEsperada() {
    const contenedor = document.getElementById("escaleraCobranza");
    if (!contenedor) return;

    const pagares = StorageService.get("pagaresSistema", []);
    const hoy = new Date();

    let posMeses = {};
    for (let i = 0; i < 12; i++) {
        const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
        const clave = fecha.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
        posMeses[clave] = { total: 0, esperado: 0, recaudado: 0, vencidos: 0, pagaresDetalle: [] };
    }

    pagares.forEach(p => {
        const fechaPago = new Date(p.fechaVencimiento);
        const clave = fechaPago.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' });
        if (posMeses[clave]) {
            posMeses[clave].esperado += p.monto;
            posMeses[clave].total += p.monto;
            if (p.estado === "Pagado") posMeses[clave].recaudado += p.monto;
            if (new Date(p.fechaVencimiento) < hoy && p.estado !== "Pagado") posMeses[clave].vencidos += p.monto;
            posMeses[clave].pagaresDetalle.push(p);
        }
    });

    let html = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap:20px;">`;

    Object.entries(posMeses).forEach(([mes, datos]) => {
        if (datos.total === 0) return;
        const porcentajeRecaudo = datos.esperado > 0 ? (datos.recaudado / datos.esperado * 100).toFixed(1) : 0;
        const colorMes = datos.vencidos > 0 ? "#fee2e2" : "#f0fdf4";
        const iconoMes = datos.vencidos > 0 ? "🔴" : "✅";

        html += `<div style="background:${colorMes}; padding:20px; border-radius:10px; border-left:5px solid ${datos.vencidos > 0 ? '#dc2626' : '#27ae60'};">
            <h4 style="margin:0 0 15px 0; color:#2c3e50;">${iconoMes} ${mes}</h4>
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px;">
                <div><small style="color:#718096;">Esperado</small><br><strong style="font-size:18px; color:#2c3e50;">${dinero(datos.esperado)}</strong></div>
                <div><small style="color:#718096;">Recaudado</small><br><strong style="font-size:18px; color:#27ae60;">${dinero(datos.recaudado)}</strong></div>
            </div>
            <div style="background:white; border-radius:8px; overflow:hidden; height:8px; margin-bottom:10px;">
                <div style="background:#27ae60; height:100%; width:${porcentajeRecaudo}%;"></div>
            </div>
            <small style="color:#718096;">${porcentajeRecaudo}% recaudado</small>
            ${datos.vencidos > 0 ? `<p style="color:#dc2626; font-weight:bold; margin:10px 0 0 0;">⚠️ ${dinero(datos.vencidos)} VENCIDO</p>` : ''}
        </div>`;
    });

    html += `</div>`;
    contenedor.innerHTML = html;
}

function exportarCobranzaEsperada() {
    const pagares = StorageService.get("pagaresSistema", []);
    let csv = "Folio,Fecha Vencimiento,Monto,Estado,Dias Atraso\n";
    pagares.forEach(p => {
        csv += `${p.folio},${p.fechaVencimiento},${p.monto},${p.estado},${p.diasAtrasoActual}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `cobranza_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
}

function abrirModalAbonoAvanzado(folio) {
    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const pagares = StorageService.get("pagaresSistema", []);
    const cuenta = cuentas.find(c => c.folio === folio);
    
    if (!cuenta) return alert("Cuenta no encontrada.");

    const pagaresCliente = pagares.filter(p => p.folio === folio && p.estado !== "Pagado");
    const original = cuenta.totalContadoOriginal ?? 0;
    const saldo = cuenta.saldoActual ?? 0;
    const fechaVenta = new Date(cuenta.fechaVenta);
    const hoy = new Date();
    const diasDesdeVenta = Math.floor((hoy - fechaVenta) / (1000 * 60 * 60 * 24));
    const aplicaPoliticaContado = diasDesdeVenta < 30;

    let modalHTML = `
        <div style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-top:0;">💰 Registrar Abono - ${cuenta.nombre}</h2>
                
                <div style="background:#f0fdf4; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <div><small style="color:#4b5563;">Saldo Actual</small><br><strong style="font-size:20px; color:#27ae60;">${dinero(saldo)}</strong></div>
                        <div><small style="color:#4b5563;">Pagarés Pendientes</small><br><strong style="font-size:20px; color:#e74c3c;">${pagaresCliente.length}</strong></div>
                    </div>
                </div>

                <div class="campo" style="margin-bottom:20px;">
                    <label>Monto del Abono ($):</label>
                    <input type="number" id="montoAbono" placeholder="0.00" min="0" max="${saldo}" 
                           style="padding:12px; font-size:16px; border:2px solid #3498db; border-radius:6px; width:100%;">
                </div>

                ${aplicaPoliticaContado ? `
                    <div style="background:#fffbeb; padding:15px; border-radius:8px; border-left:5px solid #f59e0b; margin-bottom:20px;">
                        <strong style="color:#92400e;">💡 Política de Liquidación Anticipada</strong>
                        <p style="margin:10px 0 0 0; font-size:14px; color:#78350f;">
                            Si liquida en los primeros 30 días, se respeta: <strong>${dinero(original)}</strong>
                        </p>
                        <label style="margin-top:10px; display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="chkLiquidarContado" style="width:18px; height:18px;">
                            <span>✅ Aplicar política de liquidación</span>
                        </label>
                    </div>
                ` : ''}

                <div style="display:flex; gap:10px;">
                    <button onclick="procesarAbonoAvanzado('${folio}', ${original}, ${saldo}, ${aplicaPoliticaContado})" 
                            style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ Registrar Abono
                    </button>
                    <button onclick="this.closest('div').parentElement.remove();" 
                            style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function procesarAbonoAvanzado(folio, montoOriginal, saldoActual, aplicaPolitica) {
    const montoAbono = parseFloat(document.getElementById("montoAbono").value);
    const usarPolitica = document.getElementById("chkLiquidarContado")?.checked && aplicaPolitica;

    if (isNaN(montoAbono) || montoAbono <= 0) {
        alert("Ingresa un monto válido.");
        return;
    }

    if (montoAbono > saldoActual) {
        alert("El abono no puede ser mayor al saldo.");
        return;
    }

    let nuevoSaldo = saldoActual - montoAbono;

    if (usarPolitica && Math.abs(montoAbono - saldoActual) < 0.01) {
        if (!confirm(`⚠️ APLICAR POLÍTICA DE CONTADO\n\nMonto a pagar: ${dinero(montoAbono)}\nRespetado al valor: ${dinero(montoOriginal)}\n\n¿Confirmar?`)) {
            return;
        }
        nuevoSaldo = 0;
    }

    const cuentas = StorageService.get("cuentasPorCobrar", []);
    const idxCuenta = cuentas.findIndex(c => c.folio === folio);
    
    if (idxCuenta !== -1) {
        const cuenta = cuentas[idxCuenta];
        cuenta.abonos = cuenta.abonos || [];
        cuenta.abonos.push({
            fecha: new Date().toLocaleDateString('es-MX'),
            monto: montoAbono
        });
        cuenta.saldoActual = nuevoSaldo;
        
        if (nuevoSaldo === 0) {
            cuenta.estado = "Saldado";
        }

        cuentas[idxCuenta] = cuenta;
        if (!StorageService.set("cuentasPorCobrar", cuentas)) {
            console.error("❌ Error guardando abono");
            return;
        }

        let movimientos = StorageService.get("movimientosCaja", []);
        movimientos.push({
            fecha: new Date().toLocaleDateString('es-MX'),
            monto: montoAbono,
            tipo: "Ingreso",
            concepto: `Abono a ${cuenta.nombre} - ${folio}`
        });
        if (!StorageService.set("movimientosCaja", movimientos)) {
            console.error("❌ Error guardando movimiento de caja");
        }
    }

    alert("✅ Abono registrado exitosamente.");
    document.querySelector('div[style*="position:fixed"]').remove();
    renderCuentasXCobrar();
}

function abrirModalNuevoCliente() {
    const modalHTML = `
        <div style="position:fixed; inset:0; background:rgba(0,0,0,0.8); z-index:6000; display:flex; justify-content:center; align-items:center;">
            <div style="background:white; padding:30px; border-radius:15px; width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
                <h2 style="margin-top:0;">➕ Nuevo Cliente</h2>
                
                <div class="campo" style="margin-bottom:15px;">
                    <label>Nombre Completo *</label>
                    <input type="text" id="nuevoCliNombre" placeholder="Juan Pérez" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>

                <div class="campo" style="margin-bottom:15px;">
                    <label>Dirección</label>
                    <input type="text" id="nuevoCliDireccion" placeholder="Calle Principal 123, Apt 4" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>

                <div class="campo" style="margin-bottom:15px;">
                    <label>Teléfono</label>
                    <input type="tel" id="nuevoCliTelefono" placeholder="555-1234567" 
                           style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px;">
                </div>

                <div class="campo" style="margin-bottom:20px;">
                    <label>Referencia</label>
                    <textarea id="nuevoCliReferencia" placeholder="Ej: Cerca del parque, casa azul" 
                              style="width:100%; padding:10px; border:1px solid #ddd; border-radius:5px; height:60px;"></textarea>
                </div>

                <div style="display:flex; gap:10px;">
                    <button onclick="guardarClienteDesdeModal()" 
                            style="flex:1; padding:12px; background:#27ae60; color:white; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">
                        ✅ Guardar Cliente
                    </button>
                    <button onclick="this.closest('div').parentElement.remove();" 
                            style="flex:1; padding:12px; background:#e74c3c; color:white; border:none; border-radius:6px; cursor:pointer;">
                        ✕ Cancelar
                    </button>
                </div>
            </div>
        </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function guardarClienteDesdeModal() {
    const nombre = document.getElementById("nuevoCliNombre").value.trim();
    const direccion = document.getElementById("nuevoCliDireccion").value.trim();
    const telefono = document.getElementById("nuevoCliTelefono").value.trim();
    const referencia = document.getElementById("nuevoCliReferencia").value.trim();

    const validacion = ValidatorService.validarCliente({ nombre, telefono });
    if (!validacion.valid) {
        alert("⚠️ " + validacion.errores.join("\n"));
        return;
    }

    const nuevo = {
        id: Date.now(),
        nombre,
        direccion,
        telefono,
        referencia,
        fechaRegistro: new Date().toLocaleDateString('es-MX')
    };

    clientes.push(nuevo);
    if (!StorageService.set("clientes", clientes)) {
        alert("❌ Error guardando cliente");
        return;
    }
    alert("✅ Cliente agregado exitosamente.");
    document.querySelector('div[style*="position:fixed"]').remove();
    cargarClientesSelect();
}

// ===== LOGÍSTICA =====
function renderLogistica() {
    const pSal = document.getElementById("panel-salidas-pendientes");
    const pReq = document.getElementById("panel-requisiciones-venta");
    if (!pSal || !pReq) return;

    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    requisicionesCompra = StorageService.get("requisicionesCompra", []);

    const pendSalidas = salidasPendientesVenta.filter((s) => s.estatus === "Pendiente");

    if (pendSalidas.length === 0) {
        pSal.innerHTML =
            "<h3 style=\"color:#2c3e50;\">📤 Salidas pendientes de almacén</h3><p style=\"color:#718096;\">No hay ventas con salida diferida.</p>";
    } else {
        let tb = `
            <h3 style="color:#2c3e50;">📤 Salidas pendientes de almacén</h3>
            <table class="tabla-admin">
                <thead><tr>
                    <th>Folio venta</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th>Detalle</th>
                    <th style="text-align:center;">Acción</th>
                </tr></thead><tbody>`;
        pendSalidas.forEach((s) => {
            const det = (s.items || []).map((i) => `${i.nombre} ×${i.cantidad || 1}`).join("<br>");
            tb += `<tr>
                <td><strong>${s.folioVenta}</strong></td>
                <td>${s.fecha || "—"}</td>
                <td>${s.clienteNombre || "—"}</td>
                <td style="font-size:13px;">${det || "—"}</td>
                <td style="text-align:center;">
                    <button type="button" onclick="aplicarSalidaPendienteVentas(${s.id})" class="btn-primario" style="padding:8px 12px;">Aplicar</button>
                </td>
            </tr>`;
        });
        pSal.innerHTML = tb + "</tbody></table>";
    }

    const pendReq = requisicionesCompra.filter((r) => (r.estatus || "Pendiente") === "Pendiente");
    if (pendReq.length === 0) {
        pReq.innerHTML =
            "<h3 style=\"color:#2c3e50;\">🛒 Requisiciones de compra</h3><p style=\"color:#718096;\">No hay requisiciones pendientes.</p>";
    } else {
        let tr = `
            <h3 style="color:#2c3e50;">🛒 Requisiciones de compra (pendientes)</h3>
            <table class="tabla-admin">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Motivo / Folio</th><th style="text-align:center;">Acción</th></tr></thead><tbody>`;
        pendReq.forEach((r) => {
            const extra = [r.motivo, r.folioVenta].filter(Boolean).join(" · ");
            tr += `<tr>
                <td>${r.fecha || "—"}</td>
                <td><strong>${r.producto || "—"}</strong></td>
                <td><small>${extra || "—"}</small></td>
                <td style="text-align:center;">
                    <button type="button" onclick="marcarRequisicionAtendida(${r.id})" style="padding:6px 12px; background:#718096; color:white; border:none; border-radius:5px; cursor:pointer;">Atendida</button>
                </td>
            </tr>`;
        });
        pReq.innerHTML = tr + "</tbody></table>";
    }
}

function aplicarSalidaPendienteVentas(idSalida) {
    if (!confirm("¿Aplicar ahora la salida de almacén?")) return;

    salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
    const idxS = salidasPendientesVenta.findIndex((s) => s.id === idSalida);
    if (idxS === -1) return;

    const salida = salidasPendientesVenta[idxS];
    if (salida.estatus !== "Pendiente") return;

    const fechaHoy = new Date().toLocaleDateString("es-MX");
    requisicionesCompra = StorageService.get("requisicionesCompra", []);

    (salida.items || []).forEach((it) => {
        const cant = it.cantidad || 1;
        const pIdx = productos.findIndex((p) => p.id === it.productoId);
        if (pIdx === -1) return;
        const stockActual = productos[pIdx].stock || 0;
        const cantADescontar = Math.min(cant, stockActual);
        const cantFaltante = cant - cantADescontar;
        productos[pIdx].stock = stockActual - cantADescontar;
        if (cantADescontar > 0) {
            registrarMovimiento(it.productoId, `Salida venta (diferida) ${salida.folioVenta}`, cantADescontar, "salida");
        }
        if (cantFaltante > 0) {
            requisicionesCompra.push({
                id: Date.now(),
                fecha: fechaHoy,
                producto: it.nombre || productos[pIdx].nombre,
                folioVenta: salida.folioVenta,
                cantidad: cantFaltante,
                motivo: `Stock insuficiente al aplicar salida diferida (faltan ${cantFaltante})`,
                estatus: "Pendiente"
            });
        }
    });

    salida.estatus = "Aplicada";
    salida.fechaAplicacion = fechaHoy;
    salidasPendientesVenta[idxS] = salida;

    if (!StorageService.set("productos", productos)) {
        console.error("❌ Error guardando productos");
    }
    if (!StorageService.set("movimientosInventario", movimientosInventario)) {
        console.error("❌ Error guardando movimientos");
    }
    if (!StorageService.set("salidasPendientesVenta", salidasPendientesVenta)) {
        console.error("❌ Error guardando salidas");
    }
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) {
        console.error("❌ Error guardando requisiciones");
    }

    alert("Salida aplicada correctamente.");
    renderLogistica();
}

function marcarRequisicionAtendida(idReq) {
    requisicionesCompra = StorageService.get("requisicionesCompra", []);
    const r = requisicionesCompra.find((x) => x.id === idReq);
    if (!r) return;
    r.estatus = "Atendida";
    if (!StorageService.set("requisicionesCompra", requisicionesCompra)) {
        console.error("❌ Error guardando requisiciones");
    }
    renderLogistica();
}

// ===== IMPORTADOR DE PRODUCTOS (BATCH) =====
function abrirImportadorProductos() {
    const modal = document.getElementById("modalImportador");
    if (modal) {
        modal.classList.remove("oculto");
        modal.style.display = 'flex';
        document.getElementById("textAreaImportador").value = "";
    }
}

function cerrarImportador() {
    const modal = document.getElementById("modalImportador");
    if (modal) {
        modal.classList.add("oculto");
        modal.style.display = 'none';
    }
}

function procesarImportacion() {
    let texto = document.getElementById("textAreaImportador").value.trim();
    
    if (!texto) {
        const fileInput = document.getElementById("fileInputProductos");
        if (!fileInput.files || fileInput.files.length === 0) {
            alert("Por favor selecciona un archivo o pega datos para importar.");
            return;
        }

        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = (e) => {
            const contenido = e.target.result;
            procesarDatosImportacion(contenido);
        };
        
        reader.readAsText(file);
        return;
    }

    procesarDatosImportacion(texto);
}

function procesarDatosImportacion(texto) {
    let productosAImportar = [];

    try {
        const json = JSON.parse(texto);
        if (Array.isArray(json)) {
            productosAImportar = json.map((item, idx) => ({
                id: Date.now() + idx,
                nombre: item.nombre || `Producto ${idx}`,
                costo: parseFloat(item.costo) || 0,
                precio: parseFloat(item.precio) || 0,
                margen: item.margen || ((parseFloat(item.precio) - parseFloat(item.costo)) / parseFloat(item.precio) * 100),
                imagen: item.imagen || "",
                color: item.color || "",
                marca: item.marca || "",
                modelo: item.modelo || "",
                categoria: item.categoria || "Sin categoría",
                subcategoria: item.subcategoria || "Sin subcategoría",
                stock: parseInt(item.stock) || 0
            }));
        } else {
            throw new Error("No es un array JSON");
        }
    } catch (e) {
        const lineas = texto.split('\n').filter(l => l.trim());
        if (lineas.length < 2) {
            alert("El CSV debe tener encabezado + al menos 1 fila de datos.");
            return;
        }

        const encabezado = lineas[0].split(',').map(h => h.trim().toLowerCase());
        const idxNombre = encabezado.indexOf('nombre');
        const idxCategoria = encabezado.indexOf('categoría') !== -1 ? encabezado.indexOf('categoría') : encabezado.indexOf('categoria');
        const idxSubcategoria = encabezado.indexOf('subcategoría') !== -1 ? encabezado.indexOf('subcategoría') : encabezado.indexOf('subcategoria');
        const idxCosto = encabezado.indexOf('costo');
        const idxPrecio = encabezado.indexOf('precio');
        const idxImagen = encabezado.indexOf('imagen');
        const idxColor = encabezado.indexOf('color');
        const idxMarca = encabezado.indexOf('marca');
        const idxModelo = encabezado.indexOf('modelo');
        const idxStock = encabezado.indexOf('stock');

        if (idxNombre === -1 || idxCosto === -1 || idxPrecio === -1) {
            alert("CSV debe contener al menos: Nombre, Costo, Precio");
            return;
        }

        for (let i = 1; i < lineas.length; i++) {
            const valores = lineas[i].split(',').map(v => v.trim());
            if (valores.length < 3) continue;

            const nombre = valores[idxNombre] || `Producto ${i}`;
            const categoria = valores[idxCategoria] || "Sin categoría";
            const subcategoria = valores[idxSubcategoria] || "Sin subcategoría";
            const costo = parseFloat(valores[idxCosto]) || 0;
            const precio = parseFloat(valores[idxPrecio]) || 0;
            const imagen = valores[idxImagen] || "";
            const color = valores[idxColor] || "";
            const marca = valores[idxMarca] || "";
            const modelo = valores[idxModelo] || "";
            const stock = parseInt(valores[idxStock]) || 0;

            if (nombre && costo > 0 && precio > 0) {
                const margenCalculado = ((precio - costo) / precio * 100);
                productosAImportar.push({
                    id: Date.now() + Math.random() * 100000,
                    nombre,
                    costo,
                    precio,
                    margen: margenCalculado,
                    imagen,
                    color,
                    marca,
                    modelo,
                    categoria,
                    subcategoria,
                    stock
                });
            }
        }
    }

    if (productosAImportar.length === 0) {
        alert("No se encontraron productos válidos para importar.");
        return;
    }

    const mensaje = `Se van a importar ${productosAImportar.length} productos.\n\n¿Continuar?`;
    if (!confirm(mensaje)) return;

    productosAImportar = productosAImportar.map((p, idx) => ({
        ...p,
        id: Math.round((Date.now() + idx) * 1000 + Math.random() * 1000)
    }));

    productos = [...productos, ...productosAImportar];
    if (!StorageService.set("productos", productos)) {
        alert("❌ Error importando productos");
        return;
    }

    alert(`✅ ${productosAImportar.length} productos importados exitosamente.`);
    cerrarImportador();
    renderInventario();
    mostrarProductos();
}
// ===== INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Iniciando sistema POS Mueblería Mi Pueblito...");
    try {
        // ✅ Inicializar todos los datos con valores por defecto si están vacíos
        
        // Categorías
        if (!categoriasData || categoriasData.length === 0) {
            categoriasData = [
                { nombre: "Recámaras", subcategorias: [{ nombre: "Roperos", margen: 35 }, { nombre: "Bases", margen: 30 }] },
                { nombre: "Salas", subcategorias: [{ nombre: "Sofás", margen: 40 }] }
            ];
            StorageService.set("categoriasData", categoriasData);
        }
        
        // Tarjetas/Bancos
        if (!tarjetasConfig || tarjetasConfig.length === 0) {
            tarjetasConfig = [
                { banco: "BBVA", diaCorte: 15, diaLimite: 5 },
                { banco: "BANAMEX", diaCorte: 1, diaLimite: 20 }
            ];
            StorageService.set("tarjetasConfig", tarjetasConfig);
        }
        
        // Productos
        productos = StorageService.get("productos", []);
        
        // Clientes
        clientes = StorageService.get("clientes", []);
        
        // Carrito
        carrito = StorageService.get("carrito", []);
        
        // Cuentas por cobrar
        cuentasPorCobrar = StorageService.get("cuentasPorCobrar", []);
        
        // Pagarés
        pagaresSistema = StorageService.get("pagaresSistema", []);
        
        // Otros
        proveedores = StorageService.get("proveedores", []);
        movimientosInventario = StorageService.get("movimientosInventario", []);
        recepciones = StorageService.get("recepciones", []);
        compras = StorageService.get("compras", []);
        cuentasPorPagar = StorageService.get("cuentasPorPagar", []);
        deudasMSI = StorageService.get("deudasMSI", []);
        movimientosCaja = StorageService.get("movimientosCaja", []);
        requisicionesCompra = StorageService.get("requisicionesCompra", []);
        salidasPendientesVenta = StorageService.get("salidasPendientesVenta", []);
        
        // Migración de datos antiguos
        migrarStorageCuentasPorCobrar();
        
        // Navegar a inicio
        navA('inicio');
        actualizarContadorCarrito();
        
        console.log("✅ Sistema cargado correctamente.");
        console.log("📊 Estado actual:");
        console.log(`   • Categorías: ${categoriasData.length}`);
        console.log(`   • Bancos: ${tarjetasConfig.length}`);
        console.log(`   • Productos: ${productos.length}`);
        console.log(`   • Clientes: ${clientes.length}`);
        
    } catch (e) {
        console.warn("⚠️ Aviso en carga inicial:", e);
    }
});