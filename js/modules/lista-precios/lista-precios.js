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

window.renderListaPrecios = renderListaPrecios;
window.agruparProductosPorCategoria = agruparProductosPorCategoria;
window.imprimirListaPrecios = imprimirListaPrecios;
window.exportarListaPreciosPDF = exportarListaPreciosPDF;
window.exportarListaPreciosCSV = exportarListaPreciosCSV;
