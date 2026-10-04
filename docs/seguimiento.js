/* Pestana "Seguimiento": que ha pasado con cada accion desde que entro en el top y si mantiene el momentum.
   Usa el resumen ligero (window.DIAS.historico): ticker, precio y puntuacion de cada dia. */
const CAIDA_SCORE = 8;   // puntos de caida que consideramos "pierde fuerza"

function historial(lim) {
  const P = T.precios || {}, fechas = FH.slice(0, lim), hoyF = FH[0];
  const spyHoy = (HIST[hoyF] || {}).spy;
  const reg = {};
  [...fechas].reverse().forEach(f => ((HIST[f] || {}).acciones || []).forEach((a, i) => {
    const k = a.s || a.t;
    if (!reg[k]) reg[k] = { ticker: a.t, empresa: a.n, entrada: f, precioEntrada: a.p, scoreEntrada: a.sc, spyEntrada: (HIST[f] || {}).spy, dias: 0, maxCierre: a.p || 0, mejorPuesto: 99, ultimo: f, scoreUltimo: null };
    const r = reg[k];
    r.dias++; r.ultimo = f; r.scoreUltimo = a.sc; r.maxCierre = Math.max(r.maxCierre, a.p || 0);
    r.mejorPuesto = Math.min(r.mejorPuesto, i + 1);
  }));
  return Object.entries(reg).map(([k, r]) => {
    const ahora = P[k] ?? null, viva = r.ultimo === hoyF;
    const dScore = r.scoreUltimo != null && r.scoreEntrada != null ? r.scoreUltimo - r.scoreEntrada : null;
    return { ...r, clave: k, ahora, viva,
      estado: !viva ? 'fuera' : dScore == null ? 'viva' : dScore >= -CAIDA_SCORE ? 'momentum' : 'flojea',
      dScore, score: r.scoreUltimo,
      ret: ahora != null && r.precioEntrada ? (ahora / r.precioEntrada - 1) * 100 : null,
      max: r.maxCierre && r.precioEntrada ? (r.maxCierre / r.precioEntrada - 1) * 100 : null,
      sp: r.spyEntrada && spyHoy ? (spyHoy / r.spyEntrada - 1) * 100 : null,
      diasFuera: viva ? 0 : Math.round((new Date(hoyF + 'T12:00:00Z') - new Date(r.ultimo + 'T12:00:00Z')) / 864e5) };
  }).filter(a => a.ret != null && a.entrada !== hoyF);   // las que entran hoy aun no tienen evolucion
}

const ETIQUETA = { momentum: ['Mantiene momentum', 'eok'], flojea: ['Pierde fuerza', 'ewarn'], viva: ['Sigue en el top', 'eok'], fuera: ['Fuera del top', 'eoff'] };

window.seguimiento = function () {
  const lim = +$('per').value, orden = $('segorden').value, filtro = $('segest').value;
  let r = historial(lim).filter(a => filtro === 'top10' ? a.mejorPuesto <= 10 : filtro === 'vivas' ? a.viva : filtro === 'fuera' ? !a.viva : true);
  const clave = { ret: a => a.ret, score: a => (a.viva ? a.score : -1e9), entrada: a => -FH.indexOf(a.entrada), max: a => a.max };
  r.sort((x, y) => (clave[orden](y) ?? -1e18) - (clave[orden](x) ?? -1e18));
  const R = $('rseg'); R.replaceChildren();
  if (!r.length) { R.appendChild(el('div', 'empty', 'Aún no hay historial. Según pasen los días, aquí verás cada acción desde que entró en el top y si mantiene el momentum.')); return }

  const pos = r.filter(a => a.ret > 0).length, med = r.reduce((s, a) => s + a.ret, 0) / r.length;
  const vivas = r.filter(a => a.viva).length, flojas = r.filter(a => a.estado === 'flojea').length;
  const st = el('div', 'stats');
  st.append(stat('en seguimiento', r.length), stat('en positivo', Math.round(pos / r.length * 100) + ' %'),
    stat('media', pc(med)), stat('siguen en el top', vivas + (flojas ? ' · ' + flojas + ' flojeando' : '')));
  R.appendChild(st);

  const cs = r.filter(a => a.sp != null), spMed = cs.length ? cs.reduce((s, a) => s + a.sp, 0) / cs.length : null, gana = cs.filter(a => a.ret > a.sp).length;
  if (spMed != null) { const d = med - spMed, B = el('div', 'banner ' + (d >= 0 ? 'okb' : 'warnb'));
    B.appendChild(el('div', 'bt', (d >= 0 ? 'El top va mejor que el mercado: ' : 'El top va peor que el mercado: ') + 'de media ' + pc(med) + ' frente a ' + pc(spMed) + ' del S&P 500 en los mismos días (' + (d >= 0 ? '+' : '') + n(d, 1) + ' puntos). ' + gana + ' de ' + cs.length + ' lo hacen mejor que el índice.'));
    R.appendChild(B) }

  const t = el('table', 'tabla'), h = el('tr');
  ['Acción', 'Estado', 'Entró', 'Días', 'Mejor puesto', 'Puntuación', 'Entrada', 'Ahora', 'Resultado', 'Máx. alcanzado', 'vs S&P 500'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  r.forEach(a => {
    const tr = el('tr'), td = el('td');
    const l = el('a', 'tk2', a.ticker); l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(a.clave); l.target = '_blank'; l.rel = 'noopener';
    td.appendChild(l); td.appendChild(el('div', 'name', (a.empresa || '').slice(0, 26))); tr.appendChild(td);
    const [txt, cls] = ETIQUETA[a.estado], tde = el('td');
    tde.appendChild(el('span', 'est ' + cls, txt));
    tde.appendChild(el('div', 'name', !a.viva ? 'salió hace ' + a.diasFuera + ' d' : a.dScore != null ? (a.dScore >= 0 ? '+' : '') + n(a.dScore, 0) + ' pts desde que entró' : 'entró con los criterios anteriores'));
    tr.appendChild(tde);
    tr.appendChild(el('td', null, fFecha(a.entrada)));
    tr.appendChild(el('td', null, a.dias));
    tr.appendChild(el('td', null, a.mejorPuesto === 99 ? '-' : '#' + a.mejorPuesto));
    tr.appendChild(el('td', a.score == null ? null : a.score >= 75 ? 'up' : a.score >= 55 ? null : 'down',
      a.score == null ? 'n/d' : n(a.score, 0) + (a.scoreEntrada != null ? ' (entró ' + n(a.scoreEntrada, 0) + ')' : '')));
    [n(a.precioEntrada) + ' $', n(a.ahora) + ' $'].forEach(x => tr.appendChild(el('td', null, x)));
    tr.appendChild(el('td', a.ret >= 0 ? 'up' : 'down', pc(a.ret)));
    tr.appendChild(el('td', a.max > 0 ? 'up' : null, pc(a.max)));
    const df = a.sp == null ? null : a.ret - a.sp;
    tr.appendChild(el('td', df == null ? null : df >= 0 ? 'up' : 'down', df == null ? '-' : (df >= 0 ? '+' : '') + n(df, 1) + ' pt'));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); R.appendChild(w);
  R.appendChild(el('p', 'nota', 'Entró = primer día en el top, a su precio de cierre. Mejor puesto = la posición más alta que ha ocupado. La puntuación se compara con la de su entrada: si cae más de ' + CAIDA_SCORE + ' puntos, «pierde fuerza». «Fuera del top» = ha dejado de cumplir algún requisito o ya no está entre las 25 mejores. Las que entran hoy aparecen mañana, cuando ya tienen evolución.'));
};
$('per').onchange = () => window.seguimiento();
$('segorden').onchange = () => window.seguimiento();
$('segest').onchange = () => window.seguimiento();
