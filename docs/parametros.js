/* Pestaña "Parámetros": todas las reglas que sigue el panel, en tablas. Aquí vive la letra pequeña
   que antes estaba repartida en párrafos al final de cada pestaña. */
function tabla(titulo, cabeceras, filas, nota) {
  SECCIONES.push({ titulo, cabeceras, filas, nota });
  const d = el('div', 'blk');
  d.appendChild(el('h2', 'ph', titulo));
  const t = el('table', 'tabla'), h = el('tr');
  cabeceras.forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  filas.forEach(f => {
    const tr = el('tr');
    f.forEach((c, i) => tr.appendChild(el('td', i === 0 ? 'left' : null, c)));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  if (nota) d.appendChild(el('p', 'nota', nota));
  return d;
}

/* Texto completo de los parámetros, para auditarlos fuera (PDF o pegado en otra IA).
   Se genera de las mismas tablas que se ven en pantalla: no puede quedarse desactualizado. */
function textoParametros() {
  const C = CRIT || {}, Rg = (window.REGLAS || {}).R || {};
  const lineas = [
    'PANEL "GROWTH CON MOMENTUM" · PARÁMETROS E INSTRUCCIONES',
    'Generado el ' + new Date().toLocaleString('es-ES') + ' · versión del código ' + (T.version || '') + ' · datos del ' + (T.actualizado || ''),
    '',
    'OBJETIVO DECLARADO DEL SISTEMA',
    'Encontrar empresas pequeñas y medianas de EE. UU. que crecen deprisa y están empezando a despegar en bolsa,',
    'para comprarlas pronto, aguantar la subida y salir cuando se agota el impulso. Horizonte de semanas a meses.',
    'No es una recomendación de compra ni asesoramiento financiero.',
    '',
  ];
  SECCIONES.forEach(sec => {
    lineas.push(sec.titulo.toUpperCase(), '');
    lineas.push(sec.cabeceras.join(' | '));
    lineas.push(sec.cabeceras.map(() => '---').join(' | '));
    sec.filas.forEach(f => lineas.push(f.join(' | ')));
    if (sec.nota) lineas.push('', 'Nota: ' + sec.nota);
    lineas.push('');
  });
  lineas.push('CONSTANTES EXACTAS DEL MOTOR (docs/reglas.js)');
  Object.entries(Rg).forEach(([k, v]) => lineas.push('  ' + k + ' = ' + JSON.stringify(v)));
  lineas.push('', 'UMBRALES DE ENTRADA (build.py, viajan en panel.json)');
  Object.entries(C).forEach(([k, v]) => lineas.push('  ' + k + ' = ' + v));
  lineas.push('', 'PREGUNTAS ÚTILES PARA UNA AUDITORÍA EXTERNA',
    '  1. ¿Algún umbral se contradice con otro o deja casos sin cubrir?',
    '  2. ¿Las reglas de venta protegen la ganancia sin cortar las subidas grandes?',
    '  3. ¿Falta algún criterio relevante para detectar crecimiento sostenible?',
    '  4. ¿Hay sesgos conocidos (supervivencia, mercado alcista) que invaliden la calibración?');
  return lineas.join('\n');
}

function descargarPdf() {
  const b = $('bpar-pdf'); b.disabled = true; b.textContent = 'Generando…';
  const cargar = src => new Promise((ok, ko) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = ko; document.head.appendChild(s) });
  (async () => {
    try {
      if (!window.jspdf) { await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'); await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'); }
      const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
      doc.setFontSize(16); doc.text('Growth con momentum · parámetros', 14, 18);
      doc.setFontSize(9); doc.setTextColor(110);
      doc.text('Versión del código ' + (T.version || '') + ' · datos del ' + (T.actualizado || '') + ' · generado el ' + new Date().toLocaleDateString('es-ES'), 14, 24);
      doc.text('Objetivo: empresas pequeñas y medianas de EE. UU. que crecen deprisa y empiezan a despegar, para comprar pronto, aguantar la subida y salir cuando se agota el impulso. No es una recomendación de compra.', 14, 29, { maxWidth: 182 });
      let y = 40;
      SECCIONES.forEach(sec => {
        doc.autoTable({ startY: y, head: [sec.cabeceras], body: sec.filas,
          styles: { fontSize: 8, cellPadding: 1.8 }, headStyles: { fillColor: [20, 23, 28] },
          columnStyles: { 0: { cellWidth: 52 } },
          didDrawPage: d => { y = d.cursor.y },
          willDrawPage: () => {}, margin: { left: 14, right: 14 },
          didParseCell: () => {},
          theme: 'striped', tableLineColor: [230, 230, 230],
          showHead: 'firstPage', pageBreak: 'auto',
          beforePageContent: () => {} });
        y = doc.lastAutoTable.finalY + 6;
        if (sec.nota) { doc.setFontSize(8); doc.setTextColor(110); doc.text(sec.nota, 14, y, { maxWidth: 182 }); y += 4 + Math.ceil(sec.nota.length / 120) * 4; }
        if (y > 250) { doc.addPage(); y = 18; }
      });
      const Rg = (window.REGLAS || {}).R || {};
      doc.addPage();
      doc.setFontSize(12); doc.setTextColor(0); doc.text('Constantes exactas del motor', 14, 18);
      doc.autoTable({ startY: 24, head: [['Constante', 'Valor']], body: Object.entries(Rg).map(([k, v]) => [k, JSON.stringify(v)]), styles: { fontSize: 8 }, headStyles: { fillColor: [20, 23, 28] } });
      doc.autoTable({ startY: doc.lastAutoTable.finalY + 8, head: [['Umbral de entrada', 'Valor']], body: Object.entries(CRIT || {}).map(([k, v]) => [k, String(v)]), styles: { fontSize: 8 }, headStyles: { fillColor: [20, 23, 28] } });
      doc.save('parametros-growth-momentum.pdf');
    } catch (e) { alert('No se pudo generar el PDF. Revisa la conexión e inténtalo de nuevo.'); }
    b.disabled = false; b.textContent = 'Descargar PDF';
  })();
}

let SECCIONES = [];

window.parametros = function () {
  const R = $('rpar'); R.replaceChildren();
  SECCIONES = [];
  const C = CRIT || {};
  const eur = v => cap(v);

  const barra = el('div', 'row');
  const bp = el('button', 'main', 'Descargar PDF'); bp.id = 'bpar-pdf'; bp.onclick = descargarPdf;
  const bc = el('button', 'chip', 'Copiar como texto');
  bc.onclick = async () => {
    try { await navigator.clipboard.writeText(textoParametros()); bc.textContent = '✓ Copiado'; setTimeout(() => { bc.textContent = 'Copiar como texto' }, 2000); }
    catch (e) { alert('No se pudo copiar. Usa el PDF.'); }
  };
  barra.append(bp, bc);
  R.appendChild(barra);
  R.appendChild(el('p', 'nota', 'Para auditar las instrucciones por tu cuenta o con otra IA.'));

  R.appendChild(tabla('1 · Qué tiene que cumplir para entrar en el top',
    ['Requisito', 'Umbral', 'Por qué'], [
      ['Precio', '> ' + C.precioMin + ' $', 'evita chicharros de céntimos'],
      ['Capitalización', eur(C.capMin) + ' a ' + eur(C.capMax), 'pequeñas y medianas: una gigante ya no multiplica'],
      ['Volumen medio', '> ' + n(C.volumenMin / 1000, 0) + ' mil acciones', 'que se negocie de verdad'],
      ['Dinero negociado', '> ' + n(C.liquidezMin / 1e6, 0) + ' M$ al día', 'poder salir sin mover el precio'],
      ['Tendencia de fondo', 'precio sobre su media de 200 días', 'solo se compra lo que sube'],
      ['Tendencia corta', 'EMA 9 por encima de EMA 50', 'el impulso es reciente'],
      ['RSI 14', '> ' + C.rsiMin, 'hay compradores'],
      ['Crecimiento de ingresos', '≥ ' + C.crecimientoMin + ' % interanual', 'el mayor entre 12 meses y último trimestre'],
      ['Distancia al máximo', 'máximo ' + C.maxDesdeMaximo + ' % por debajo del de 52 semanas', 'cerca de máximos, no rebotando de un suelo'],
      ['Sectores excluidos', 'navieras, petroleras, mineras, químicas, utilities, REITs y gestoras', 'su crecimiento viene del precio de una materia prima'],
    ], 'Si falla uno solo, la empresa no aparece. Se analizan unas 250 cada día y suelen pasar entre 40 y 50.'));

  R.appendChild(tabla('2 · Cómo se calcula la puntuación de 0 a 100',
    ['Bloque', 'Puntos', 'Qué mide'], [
      ['Momentum técnico', '25', 'orden de las medias, RSI en zona 60-72 y subida en 1 y 3 meses'],
      ['Aceleración del crecimiento', '25', 'nivel de crecimiento, aceleración del último trimestre, BPA, consistencia anual y previsión del próximo ejercicio'],
      ['Calidad fundamental', '20', 'margen bruto, flujo de caja libre, margen neto, caja frente a deuda y regla del 40'],
      ['Fuerza relativa', '15', 'frente al S&P 500 a 3 y 6 meses y frente a la mediana de su sector'],
      ['Volumen y ruptura', '15', 'volumen relativo, ADR, cercanía a máximos y ruptura confirmada por volumen'],
    ], 'A igualdad de puntuación, primero la de menor capitalización.'));

  R.appendChild(tabla('3 · Penalizaciones y bonus',
    ['Concepto', 'Efecto', 'Motivo'], [
      ['RSI por encima de 80 / 85', '−3 / −6', 'sobrecomprada'],
      ['Precio un 50 / 80 % sobre su EMA 50', '−5 / −10', 'vertical: entrar ahí sale caro'],
      ['Precio un 150 % sobre su media de 200 días', '−4', 'muy estirada'],
      ['Sube más de un 70 % en un mes', '−5', 'movimiento parabólico'],
      ['Margen bruto por debajo del 35 / 25 / 15 %', '−2 / −5 / −8', 'negocio poco escalable: difícil que multiplique'],
      ['Emite acciones a más del 15 % anual', '−4', 'te diluye: la empresa crece y tú no'],
      ['Impulso entre 20 y 50 % sobre su EMA 50', '+3', 'la zona que históricamente más multiplica'],
      ['Sube entre un 20 y un 70 % en el mes', '+2', 'impulso sano, no parabólico'],
      ['Capitalización por debajo de 1.000 / 3.000 / 6.000 M', '+5 / +3,5 / +2', 'cuanto más pequeña, más recorrido'],
      ['Capitalización de 6.000 M en adelante', '+0,5', 'el resto también suma algo, para que el bonus no sea todo o nada'],
    ], 'La penalización total está limitada a −15 puntos y la nota final se acota entre 0 y 100.'));

  R.appendChild(tabla('4 · Qué significa cada veredicto',
    ['Veredicto', 'Cuándo aparece'], [
      ['COMPRA', 'cumple todo, no está estirada y su EMA 50 queda a menos de un 15 %'],
      ['Sin datos', 'ha dejado de cotizar con ese símbolo o ha cambiado de nombre: la fuente ya no la devuelve'],
      ['No comprar', 'ha dado una señal de salida: perdió la EMA 50 o la EMA 21, RSI por debajo de 45, o ha caído un 15 % o más desde su máximo del último mes'],
      ['Compra arriesgada', 'cumple, pero la EMA 50 queda a más del 15 %: el stop es un tope fijo, no un nivel técnico'],
      ['Esperar', 'está a más de un 10 % de su máximo de 52 semanas'],
      ['No comprar aquí', 'demasiado estirada: mejor esperar a que consolide'],
      ['Vigilar', 'cumple, pero su puntuación ha caído más de 8 puntos'],
      ['Ya no cumple', 'ha roto algún requisito obligatorio'],
    ], 'La pestaña Hoy se ordena por prioridad de compra: primero las que marcan COMPRA, después las de vigilar y al final las que no se tocan; dentro de cada grupo, por puntuación. La pestaña Seguimiento se ordena por puntuación a secas, porque sirve para ver cómo evolucionan, no para decidir la compra del día. La puntuación mide la calidad de la empresa, no si hoy es buen día para entrar.'));

  R.appendChild(tabla('5 · Cuándo vender una posición abierta',
    ['Regla', 'Detalle'], [
      ['Stop inicial', 'la EMA 50, sin arriesgar nunca más de un 15 % desde tu precio de compra'],
      ['El stop nunca baja', 'se guarda el valor más alto que ha alcanzado, aunque la EMA 50 retroceda'],
      ['Protección del coste', 'superado el 20 % de ganancia, el stop sube a tu precio de compra'],
      ['Devolución de ganancias', 'con menos de un 30 % ganado manda solo el stop; entre 30 y 100 % se vende si devuelve la mitad; por encima del 100 %, si devuelve el 40 %'],
      ['Pérdida de tendencia', 'cierre por debajo de la EMA 50 o RSI por debajo de 45'],
      ['Deterioro del negocio', 'deja de cumplir dos o más requisitos'],
      ['Aviso previo', 'VIGILAR al perder la EMA 21, al acercarse al 60 % de la devolución límite o si publica resultados en 10 días'],
      ['Un solo requisito roto', 'VIGILAR, no vender: hacen falta dos para que sea motivo de venta'],
      ['Se le queda pequeño el techo', 'VIGILAR si supera los 10.000 M de capitalización, pero nunca es motivo de venta'],
    ], 'Que una ganadora supere el techo de capitalización no cuenta como motivo de venta.'));

  R.appendChild(tabla('6 · De dónde salen los datos y qué no cubre',
    ['Asunto', 'Detalle'], [
      ['Fuente', 'TradingView, al cierre de cada sesión'],
      ['Actualización', 'cada día laborable a las 21:30 UTC: 23:30 en horario de verano y 22:30 en invierno (hora de España)'],
      ['Mercado', 'solo EE. UU.'],
      ['Frecuencia', 'una foto diaria: no hay precios intradía'],
      ['Tus posiciones', 'se guardan solo en este navegador, no en ningún servidor'],
      ['Lo que no ve', 'noticias, fraudes, resultados de ensayos clínicos, demandas o cambios regulatorios'],
      ['Calibración', 'los umbrales técnicos salen de 17.934 observaciones semanales de 185 empresas entre 2024 y 2026. Se solapan entre sí y cubren un periodo alcista, así que valen mucho menos que 17.934 casos independientes'],
    ], 'Esto es un sistema de detección de oportunidades para estudiarlas una a una, no una recomendación de compra.'));
};
