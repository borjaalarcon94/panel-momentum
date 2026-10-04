/* Pestana "Seguimiento": que ha pasado con cada accion desde que entro en la lista y si mantiene el momentum.
   Momentum = sigue cumpliendo el filtro (aparece en la lista de hoy) y su puntuacion aguanta frente a la de entrada. */
const CAIDA_SCORE = 8;   // puntos de caida que consideramos "perdiendo fuerza"

function historial(lim) {
  const P = T.precios || {}, fechas = F.slice(0, lim), hoyF = F[0];
  const spy = f => (((DD[f] || {}).mercado || []).find(x => x.ticker === 'SPY') || {}).precio, spyHoy = spy(hoyF);
  // Solo se puede puntuar un dia generado con los criterios actuales (lleva referencia de sector).
  const puntuable = f => !!(DD[f] || {}).referencia;
  const reg = {};
  [...fechas].reverse().forEach(f => (DIAS[f] || []).forEach(a => {
    const k = a.simbolo || a.ticker;
    const p = puntuable(f) ? window.puntuaDia(f, a.ticker) : null;
    if (!reg[k]) reg[k] = { ...a, entrada: f, precioEntrada: a.precio, scoreEntrada: p ? p.total : null, dias: 0, maxCierre: a.precio, ultimo: f, scoreUltimo: null, serie: [] };
    const r = reg[k];
    r.dias++; r.ultimo = f; r.ultimoDato = a; r.scoreUltimo = p ? p.total : r.scoreUltimo;
    r.maxCierre = Math.max(r.maxCierre, a.precio || 0);
    r.serie.push({ f, precio: a.precio, score: p ? p.total : null });
  }));
  return Object.entries(reg).map(([k, r]) => {
    const ahora = P[k] ?? null, s0 = spy(r.entrada);
    const viva = r.ultimo === hoyF;
    const dScore = r.scoreUltimo != null && r.scoreEntrada != null ? r.scoreUltimo - r.scoreEntrada : null;
    const estado = !viva ? 'fuera' : dScore == null ? 'viva' : dScore >= -CAIDA_SCORE ? 'momentum' : 'flojea';
    return { ...r, clave: k, ahora,
      ret: ahora != null && r.precioEntrada ? (ahora / r.precioEntrada - 1) * 100 : null,
      max: r.maxCierre && r.precioEntrada ? (r.maxCierre / r.precioEntrada - 1) * 100 : null,
      desdeMax: ahora != null && r.maxCierre ? (ahora / r.maxCierre - 1) * 100 : null,
      sp: s0 && spyHoy ? (spyHoy / s0 - 1) * 100 : null,
      score: r.scoreUltimo, dScore, viva, estado,
      diasFuera: viva ? 0 : Math.round((new Date(hoyF + 'T12:00:00Z') - new Date(r.ultimo + 'T12:00:00Z')) / 864e5) };
  }).filter(a => a.ret != null && a.entrada !== hoyF);   // las que entran hoy aun no tienen evolucion
}

const ETIQUETA = { momentum: ['Mantiene momentum', 'eok'], flojea: ['Pierde fuerza', 'ewarn'], viva: ['Sigue en la lista', 'eok'], fuera: ['Fuera de la lista', 'eoff'] };

window.seguimiento = function () {
  const lim = +$('per').value, orden = ($('segorden') || {}).value || 'ret', filtro = ($('segest') || {}).value || '';
  let r = historial(lim).filter(a => !filtro || (filtro === 'vivas' ? a.viva : filtro === 'momentum' ? a.estado === 'momentum' : !a.viva));
  const clave = { ret: a => a.ret, score: a => (a.viva ? a.score : -1e9), dscore: a => a.dScore ?? -1e9, entrada: a => F.indexOf(a.entrada) * -1, max: a => a.max };
  r.sort((x, y) => (clave[orden](y) ?? -1e18) - (clave[orden](x) ?? -1e18));
  const R = $('rseg'); R.replaceChildren();
  if (!r.length) { R.appendChild(el('div', 'empty', 'Aún no hay historial suficiente. Según pasen los días, aquí verás cada acción desde que entró en la lista y si mantiene el momentum.')); return }

  const pos = r.filter(a => a.ret > 0).length, med = r.reduce((s, a) => s + a.ret, 0) / r.length;
  const mediana = [...r].sort((x, y) => x.ret - y.ret)[Math.floor(r.length / 2)].ret;
  const vivas = r.filter(a => a.viva).length, flojas = r.filter(a => a.estado === 'flojea').length;
  const st = el('div', 'stats');
  st.append(stat('en seguimiento', r.length), stat('en positivo', Math.round(pos / r.length * 100) + ' %'), stat('media', pc(med)),
    stat('siguen en la lista', vivas + (flojas ? ' · ' + flojas + ' flojeando' : '')));
  R.appendChild(st);

  const cs = r.filter(a => a.sp != null), spMed = cs.length ? cs.reduce((s, a) => s + a.sp, 0) / cs.length : null, gana = cs.filter(a => a.ret > a.sp).length;
  if (spMed != null) { const d = med - spMed, B = el('div', 'banner ' + (d >= 0 ? 'okb' : 'warnb'));
    B.appendChild(el('div', 'bt', (d >= 0 ? 'La lista va mejor que el mercado: ' : 'La lista va peor que el mercado: ') + 'de media ' + pc(med) + ' frente a ' + pc(spMed) + ' del S&P 500 en los mismos días (' + (d >= 0 ? '+' : '') + n(d, 1) + ' puntos). ' + gana + ' de ' + cs.length + ' (' + Math.round(gana / cs.length * 100) + ' %) lo hacen mejor que el índice.'));
    R.appendChild(B) }

  const t = el('table', 'tabla'), h = el('tr');
  ['Acción', 'Estado', 'Entró', 'Días', 'Puntuación', 'Precio entrada', 'Precio ahora', 'Resultado', 'Máx. alcanzado', 'Desde su máximo', 'S&P 500', 'Diferencia'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  r.forEach(a => {
    const tr = el('tr'), td = el('td');
    const l = el('a', 'tk2', a.ticker); l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(a.clave); l.target = '_blank'; l.rel = 'noopener';
    td.appendChild(l); td.appendChild(el('div', 'name', (a.empresa || '').slice(0, 28))); tr.appendChild(td);
    const [txt, cls] = ETIQUETA[a.estado];
    const tde = el('td'); tde.appendChild(el('span', 'est ' + cls, txt));
    if (!a.viva) tde.appendChild(el('div', 'name', 'salió hace ' + a.diasFuera + ' d'));
    else if (a.dScore != null) tde.appendChild(el('div', 'name', (a.dScore >= 0 ? '+' : '') + n(a.dScore, 0) + ' pts desde que entró'));
    tr.appendChild(tde);
    tr.appendChild(el('td', null, fFecha(a.entrada)));
    tr.appendChild(el('td', null, a.dias));
    const tds = el('td'); tds.appendChild(el('span', a.score == null ? null : a.score >= 75 ? 'up' : a.score >= 55 ? null : 'down', a.score == null ? 'n/d' : n(a.score, 0) + (a.scoreEntrada != null ? ' (entró con ' + n(a.scoreEntrada, 0) + ')' : '')));
    tr.appendChild(tds);
    [n(a.precioEntrada) + ' $', n(a.ahora) + ' $'].forEach(x => tr.appendChild(el('td', null, x)));
    tr.appendChild(el('td', a.ret >= 0 ? 'up' : 'down', pc(a.ret)));
    tr.appendChild(el('td', a.max > 0 ? 'up' : null, pc(a.max)));
    tr.appendChild(el('td', a.desdeMax < -10 ? 'down' : null, pc(a.desdeMax)));
    tr.appendChild(el('td', a.sp == null ? null : a.sp >= 0 ? 'up' : 'down', pc(a.sp)));
    const df = a.sp == null ? null : a.ret - a.sp;
    tr.appendChild(el('td', df == null ? null : df >= 0 ? 'up' : 'down', df == null ? '-' : (df >= 0 ? '+' : '') + n(df, 1) + ' pt'));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); R.appendChild(w);
  R.appendChild(el('p', 'nota', 'Entró = primer día que apareció en la lista, a su precio de cierre. Días = veces que ha aparecido. Puntuación = la de su último día en la lista, comparada con la de su entrada: si cae más de ' + CAIDA_SCORE + ' puntos se marca «pierde fuerza». «Fuera de la lista» significa que ha dejado de cumplir algún requisito obligatorio (tendencia, RSI, crecimiento o distancia al máximo). Máx. alcanzado = mayor cierre registrado mientras estaba en la lista.'));
};
$('per').onchange = () => window.seguimiento();
if ($('segorden')) $('segorden').onchange = () => window.seguimiento();
if ($('segest')) $('segest').onchange = () => window.seguimiento();
