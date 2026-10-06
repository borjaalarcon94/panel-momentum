/* Pestaña "Parámetros": todas las reglas que sigue el panel, en tablas. Aquí vive la letra pequeña
   que antes estaba repartida en párrafos al final de cada pestaña. */
function tabla(titulo, cabeceras, filas, nota) {
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

window.parametros = function () {
  const R = $('rpar'); R.replaceChildren();
  const C = CRIT || {};
  const eur = v => cap(v);

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
    ], 'La penalización total está limitada a −15 puntos y la nota final se acota entre 0 y 100.'));

  R.appendChild(tabla('4 · Qué significa cada veredicto',
    ['Veredicto', 'Cuándo aparece'], [
      ['COMPRA', 'cumple todo, no está estirada y el stop queda a menos de un 15 %'],
      ['Compra arriesgada', 'cumple, pero el stop técnico queda más lejos del 15 %'],
      ['Esperar', 'está a más de un 10 % de su máximo de 52 semanas'],
      ['No comprar aquí', 'demasiado estirada: mejor esperar a que consolide'],
      ['Vigilar', 'cumple, pero su puntuación ha caído más de 8 puntos'],
      ['Ya no cumple', 'ha roto algún requisito obligatorio'],
    ]));

  R.appendChild(tabla('5 · Cuándo vender una posición abierta',
    ['Regla', 'Detalle'], [
      ['Stop inicial', 'la EMA 50, sin arriesgar nunca más de un 15 % desde tu precio de compra'],
      ['El stop nunca baja', 'se guarda el valor más alto que ha alcanzado, aunque la EMA 50 retroceda'],
      ['Protección del coste', 'superado el 20 % de ganancia, el stop sube a tu precio de compra'],
      ['Devolución de ganancias', 'con menos de un 30 % ganado manda solo el stop; entre 30 y 100 % se vende si devuelve la mitad; por encima del 100 %, si devuelve el 40 %'],
      ['Pérdida de tendencia', 'cierre por debajo de la EMA 50 o RSI por debajo de 45'],
      ['Deterioro del negocio', 'deja de cumplir dos o más requisitos'],
      ['Aviso previo', 'VIGILAR al perder la EMA 21, al acercarse a la devolución límite o si publica resultados en 10 días'],
    ], 'Que una ganadora supere el techo de capitalización no cuenta como motivo de venta.'));

  R.appendChild(tabla('6 · De dónde salen los datos y qué no cubre',
    ['Asunto', 'Detalle'], [
      ['Fuente', 'TradingView, al cierre de cada sesión'],
      ['Actualización', 'cada día laborable a las 23:30 (hora de España)'],
      ['Mercado', 'solo EE. UU.'],
      ['Frecuencia', 'una foto diaria: no hay precios intradía'],
      ['Tus posiciones', 'se guardan solo en este navegador, no en ningún servidor'],
      ['Lo que no ve', 'noticias, fraudes, resultados de ensayos clínicos, demandas o cambios regulatorios'],
      ['Calibración', 'los umbrales técnicos salen de medir 17.934 situaciones reales entre 2024 y 2026'],
    ], 'Esto es un sistema de detección de oportunidades para estudiarlas una a una, no una recomendación de compra.'));
};
