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
    return { ...r, ahora,
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
  d.appendChild(el('p', 'nota', 'Si pasadas unas semanas con casos suficientes algún objetivo no se cumple, toca cambiar los criterios: ese es el propósito de esta pestaña. Mientras ponga «sin datos suficientes», cualquier conclusión sería casualidad.'));
  return d;
}

window.resultados = function () {
  const R = $('rres'); R.replaceChildren();
  const xs = entradas();
  if (xs.length < 3) {
    R.appendChild(el('div', 'empty', 'Todavía no hay suficientes entradas registradas con los criterios actuales. Esta pestaña se irá llenando sola: cada acción que entra en el top queda anotada con su puntuación y su precio, y aquí se compara después con lo que hizo de verdad.'));
    return;
  }
  const media = v => v.reduce((s, x) => s + x, 0) / v.length;
  const st = el('div', 'stats');
  const pos = xs.filter(a => a.ret > 0).length;
  const cs = xs.filter(a => a.sp != null);
  st.append(stat('entradas medidas', xs.length), stat('en positivo', Math.round(pos / xs.length * 100) + ' %'),
    stat('media', pc(media(xs.map(a => a.ret)))),
    stat('vs S&P 500', cs.length ? pc(media(cs.map(a => a.ret - a.sp))) : '—'));
  R.appendChild(st);

  R.appendChild(el('div', 'blt', '¿Acierta la puntuación? Resultado medio según la nota que tenía al entrar'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Tramo', 'Entradas', 'Media', 'Mediana', 'En positivo', 'Mejor', 'Peor'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  TRAMOS.forEach(([min, nom], i) => {
    const max = i === 0 ? 999 : TRAMOS[i - 1][0];
    const g = xs.filter(a => a.score >= min && a.score < max);
    const tr = el('tr');
    tr.appendChild(el('td', null, nom));
    if (!g.length) { tr.appendChild(el('td', null, '0')); [1, 2, 3, 4, 5].forEach(() => tr.appendChild(el('td', null, '—'))); t.appendChild(tr); return }
    const v = g.map(a => a.ret).sort((a, b) => a - b), m = media(v);
    tr.appendChild(el('td', null, g.length));
    tr.appendChild(el('td', m >= 0 ? 'up' : 'down', pc(m)));
    tr.appendChild(el('td', null, pc(v[Math.floor(v.length / 2)])));
    tr.appendChild(el('td', null, Math.round(100 * g.filter(a => a.ret > 0).length / g.length) + ' %'));
    tr.appendChild(el('td', 'up', pc(v[v.length - 1])));
    tr.appendChild(el('td', 'down', pc(v[0])));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); R.appendChild(w);

  const fuera = xs.filter(a => a.fuera && a.retAlSalir != null);
  if (fuera.length >= 3) {
    const alSalir = media(fuera.map(a => a.retAlSalir)), hastaHoy = media(fuera.map(a => a.ret));
    const d = alSalir - hastaHoy;
    const B = el('div', 'banner ' + (d >= 0 ? 'okb' : 'warnb'));
    B.appendChild(el('div', 'bt', '¿Sirve salirse cuando dejan de cumplir? De las ' + fuera.length + ' que salieron del top, vender el día que salieron habría dado ' + pc(alSalir) + ' de media; aguantarlas hasta hoy, ' + pc(hastaHoy) + '. Diferencia: ' + (d >= 0 ? '+' : '') + n(d, 1) + ' puntos a favor de ' + (d >= 0 ? 'vender al salir' : 'aguantar') + '.'));
    R.appendChild(B);
  }
  R.appendChild(objetivos(xs));
  R.appendChild(el('p', 'nota', 'Cada acción se anota el primer día que entra en el top, al precio de cierre de ese día, con la puntuación que tenía. El resultado se mide contra el precio de hoy, sin comisiones ni dividendos. Con pocas entradas estos números no significan nada: hacen falta semanas y varias decenas de casos para sacar conclusiones.'));
};
