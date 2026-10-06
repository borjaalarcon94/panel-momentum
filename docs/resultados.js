/* Pestana "Resultados": mide si la puntuacion sirve de algo. Se calcula con lo que ya hay guardado:
   cada entrada al top con su puntuacion de ese dia, su precio, y el precio de hoy. */
const TRAMOS = [[85, 'Puntuación 85 o más'], [75, 'Puntuación 75-85'], [65, 'Puntuación 65-75'], [0, 'Puntuación menor de 65']];

function entradas() {
  const P = T.precios || {}, hoyF = FH[0], spyHoy = (HIST[hoyF] || {}).spy;
  const reg = {};
  [...FH].reverse().forEach(f => ((HIST[f] || {}).acciones || []).forEach(a => {
    const k = a.s || a.t;
    if (!reg[k]) reg[k] = { ticker: a.t, entrada: f, precio: a.p, score: a.sc, spy: (HIST[f] || {}).spy, ultimo: f, precioUltimo: a.p };
    reg[k].ultimo = f; reg[k].precioUltimo = a.p;
  }));
  return Object.entries(reg).map(([k, r]) => {
    const ahora = (ACT[k] || {}).precio ?? P[k] ?? null;
    const fuera = r.ultimo !== hoyF;
    return { ...r, ahora, clave: k, ticker: r.ticker,
      ret: ahora != null && r.precio ? (ahora / r.precio - 1) * 100 : null,
      retAlSalir: r.precioUltimo && r.precio ? (r.precioUltimo / r.precio - 1) * 100 : null,
      sp: r.spy && spyHoy ? (spyHoy / r.spy - 1) * 100 : null, fuera,
      dias: Math.round((new Date(hoyF + 'T12:00:00Z') - new Date(r.entrada + 'T12:00:00Z')) / 864e5) };
  }).filter(a => a.ret != null && a.score != null && a.entrada !== hoyF);
}

/* Los tres objetivos que tiene que cumplir el sistema para merecer la pena. Si fallan, hay que cambiar criterios. */
function objetivos(xs) {
  const media = v => v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  const cs = xs.filter(a => a.sp != null);
  const vsSp = cs.length ? media(cs.map(a => a.ret - a.sp)) : null;
  const altas = xs.filter(a => a.score >= 75).map(a => a.ret), bajas = xs.filter(a => a.score < 75).map(a => a.ret);
  const difTramos = altas.length >= 10 && bajas.length >= 10 ? media(altas) - media(bajas) : null;
  const fuera = xs.filter(a => a.fuera && a.retAlSalir != null);
  const difSalida = fuera.length >= 10 ? media(fuera.map(a => a.retAlSalir)) - media(fuera.map(a => a.ret)) : null;
  const filas = [
    ['Batir al S&P 500', vsSp, cs.length, 30, 'de media, cada entrada frente al índice en los mismos días'],
    ['Que la puntuación discrimine', difTramos, Math.min(altas.length, bajas.length), 10, 'las de 75 o más deberían rendir más que las de menos de 75'],
    ['Que salir a tiempo compense', difSalida, fuera.length, 10, 'vender el día que salen del top frente a aguantarlas'],
  ];
  const d = el('div', 'blk');
  d.appendChild(el('div', 'blt', '¿Se están cumpliendo los objetivos?'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Objetivo', 'Resultado', 'Casos', 'Estado'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  filas.forEach(([nom, val, n0, min, ayuda]) => {
    const tr = el('tr');
    const td = el('td'); td.appendChild(el('b', null, nom)); td.appendChild(el('div', 'name', ayuda)); tr.appendChild(td);
    tr.appendChild(el('td', val == null ? null : val >= 0 ? 'up' : 'down', val == null ? '—' : (val >= 0 ? '+' : '') + n(val, 1) + ' pt'));
    tr.appendChild(el('td', null, n0 + (n0 < min ? ' de ' + min : '')));
    const est = el('td');
    est.appendChild(el('span', 'est ' + (n0 < min ? 'eoff' : val >= 0 ? 'eok' : 'ebad'),
      n0 < min ? 'sin datos suficientes' : val >= 0 ? 'se cumple' : 'no se cumple'));
    tr.appendChild(est);
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  
  return d;
}

/* Simula las reglas completas: comprar el dia que entra y vender cuando el protocolo lo dice,
   usando los cierres de los dias que tenemos (los que estuvo en el top) y el precio de hoy.
   Compara tres formas de operar la misma lista para ver si las reglas de salida aportan. */
function simula(xs) {
  const res = xs.map(x => {
    const dias = FH.filter(f => f >= x.entrada).sort();
    let maxVisto = x.precio, salida = null, motivo = null, stopPrevio = 0;
    for (const f of dias.slice(1)) {
      const fila = ((HIST[f] || {}).acciones || []).find(y => (y.s || y.t) === x.clave);
      if (!fila || !fila.p) continue;           // ese dia salio del top: no tenemos su cierre
      maxVisto = Math.max(maxVisto, fila.p);
      const gan = (fila.p / x.precio - 1) * 100;
      const ganMax = (maxVisto / x.precio - 1) * 100;
      // Mismas reglas que las posiciones reales (docs/reglas.js). Sin EMA 50 histórica, el stop usa
      // el suelo de pérdida máxima y la subida al coste; se indica en la nota de la tabla.
      stopPrevio = Math.max(stopPrevio, window.REGLAS.stopDe({ precio: fila.p }, x.precio, stopPrevio) || 0);
      if (fila.p < stopPrevio) { salida = fila.p; motivo = 'stop'; break }
      const limite = window.REGLAS.limiteDevolucion(ganMax);
      const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
      if (limite != null && devuelto >= limite) { salida = fila.p; motivo = 'devolvió el ' + Math.round(devuelto) + ' %'; break }
    }
    return { ...x, conReglas: salida != null ? (salida / x.precio - 1) * 100 : x.ret, motivo,
      alSalirDelTop: x.retAlSalir != null ? x.retAlSalir : x.ret };
  });
  return res;
}

function tablaSimulacion(xs) {
  const r = simula(xs);
  const med = v => v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  const filas = [
    ['Comprar y aguantar hasta hoy', r.map(x => x.ret), 'sin vender nunca'],
    ['Vender el día que sale del top', r.map(x => x.alSalirDelTop), 'disciplina máxima'],
    ['Con nuestras reglas de salida', r.map(x => x.conReglas), 'el stop y la devolución máxima de la pestaña Parámetros'],
  ];
  const d = el('div', 'blk');
  d.appendChild(el('div', 'blt', 'Las mismas entradas, tres formas de operarlas'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Forma de operar', 'Media', 'Mediana', 'En positivo', 'Peor caso'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  filas.forEach(([nom, v, ayuda]) => {
    const tr = el('tr'), ord = [...v].sort((a, b) => a - b);
    const td = el('td'); td.appendChild(el('b', null, nom)); td.appendChild(el('div', 'name', ayuda)); tr.appendChild(td);
    tr.appendChild(el('td', med(v) >= 0 ? 'up' : 'down', pc(med(v))));
    tr.appendChild(el('td', null, pc(ord[Math.floor(ord.length / 2)])));
    tr.appendChild(el('td', null, Math.round(100 * v.filter(x => x > 0).length / v.length) + ' %'));
    tr.appendChild(el('td', 'down', pc(ord[0])));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  const vendidas = r.filter(x => x.motivo);
  
  return d;
}

window.resultados = function () {
  const R = $('rres'); R.replaceChildren();
  const xs = entradas();
  if (xs.length < 3) {
    R.appendChild(el('div', 'empty', 'Todavía no hay historial. Cada acción que entra en el top queda anotada con su puntuación y su precio, y aquí se compara con lo que hizo después. Vuelve dentro de unas semanas.'));
    return;
  }
  const media = v => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
  const cs = xs.filter(a => a.sp != null);
  const vsSp = cs.length ? media(cs.map(a => a.ret - a.sp)) : null;
  const pos = xs.filter(a => a.ret > 0).length;

  // Tres preguntas, tres respuestas en lenguaje llano.
  const pregunta = (titulo, respuesta, detalle, casos, minimo, bien) => {
    const d = el('div', 'card');
    d.appendChild(el('div', 'pregunta', titulo));
    const suficiente = casos >= minimo;
    d.appendChild(el('div', 'respuesta ' + (!suficiente ? 'rgris' : bien ? 'rverde' : 'rrojo'),
      suficiente ? respuesta : 'Todavía no se puede saber'));
    d.appendChild(el('div', 'm', suficiente ? detalle : 'Hacen falta ' + minimo + ' casos y por ahora hay ' + casos + '. Con menos, cualquier conclusión sería casualidad.'));
    return d;
  };

  R.appendChild(pregunta(
    '¿Habrías ganado dinero siguiendo el panel?',
    (media(xs.map(a => a.ret)) >= 0 ? 'Sí, ' : 'No, ') + pc(media(xs.map(a => a.ret))) + ' de media por acción',
    'De las ' + xs.length + ' acciones anotadas, ' + pos + ' van en positivo (' + Math.round(pos / xs.length * 100) + ' %).',
    xs.length, 30, media(xs.map(a => a.ret)) >= 0));

  R.appendChild(pregunta(
    '¿Mejor que comprar el índice?',
    vsSp == null ? '—' : (vsSp >= 0 ? 'Sí, ' : 'No, ') + (vsSp >= 0 ? '+' : '') + n(vsSp, 1) + ' puntos frente al S&P 500',
    'Comparado con lo que habría hecho el S&P 500 en esos mismos días.',
    cs.length, 30, (vsSp || 0) >= 0));

  const altas = xs.filter(a => a.score >= 75).map(a => a.ret), bajas = xs.filter(a => a.score < 75).map(a => a.ret);
  const dif = altas.length >= 10 && bajas.length >= 10 ? media(altas) - media(bajas) : null;
  R.appendChild(pregunta(
    '¿Sirve de algo la puntuación?',
    dif == null ? '—' : (dif >= 0 ? 'Sí, las mejor puntuadas rinden ' : 'No, las mejor puntuadas rinden ') + (dif >= 0 ? '+' : '') + n(dif, 1) + ' puntos más',
    'Las de 75 o más: ' + pc(media(altas)) + ' (' + altas.length + ' casos). Las de menos de 75: ' + pc(media(bajas)) + ' (' + bajas.length + ' casos).',
    Math.min(altas.length, bajas.length), 10, (dif || 0) >= 0));

  R.appendChild(tablaSimulacion(xs));
  R.appendChild(el('p', 'nota', 'Cada acción se anota el primer día que entra en el top, a su precio de cierre, y se compara con el precio de hoy. Sin comisiones.'));
};
