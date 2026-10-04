/* Carga de datos y estado de la interfaz.
   panel.json: resumen ligero (dias disponibles, historico, estado de hoy de las seguidas, criterios).
   datos/<fecha>.json: el detalle de un dia, que se descarga solo cuando se mira ese dia. */
let T = {}, HIST = {}, FH = [], ACT = {}, CRIT = {}, MHOY = {}, REFHOY = {};
const CACHE = {};                       // ficheros de dia ya descargados
const S = { dia: null, orden: 'score', top: 10 };
let REGIMEN = { favorable: true };
const $ = id => document.getElementById(id);
const n = (v, d = 2) => v == null ? '-' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (v, d = 1) => v == null ? '-' : (v >= 0 ? '+' : '') + n(v, d) + ' %';
const ppt = (v, d = 1) => v == null ? '-' : (v >= 0 ? '+' : '') + n(v, d) + ' pp';
const cap = v => v == null ? '-' : (v >= 1e9 ? n(v / 1e9, 1) + ' B' : n(v / 1e6, 0) + ' M');
const fFecha = f => new Date(f + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
function el(t, c, x) { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e }

async function dia(f) {
  if (!CACHE[f]) CACHE[f] = await (await fetch('datos/' + f + '.json', { cache: 'no-cache' })).json();
  return CACHE[f];
}
function racha(t, f) { let r = 0; for (let i = FH.indexOf(f); i < FH.length; i++) { if (((HIST[FH[i]] || {}).acciones || []).some(x => x.t === t)) r++; else break } return r }

/* Requisitos obligatorios comprobados sobre los datos de hoy: dicen si la compra sigue siendo viable. */
window.REQUISITOS = function (a) {
  const C = CRIT, g = Math.max(a.ingresos ?? -1e9, a.ingresosq ?? -1e9);
  const dmax = a.precio && a.max52 ? (a.precio / a.max52 - 1) * 100 : null;
  return [
    { t: 'Precio > ' + C.precioMin + ' $', ok: a.precio > C.precioMin, v: n(a.precio) + ' $' },
    { t: 'Capitalización entre ' + cap(C.capMin) + ' y ' + cap(C.capMax), ok: a.cap > C.capMin && a.cap <= C.capMax, v: cap(a.cap) },
    { t: 'Volumen medio > ' + n(C.volumenMin / 1000, 0) + ' mil acciones', ok: a.volmedio > C.volumenMin, v: a.volmedio == null ? '-' : Math.round(a.volmedio / 1000) + ' mil' },
    { t: 'Se negocian > ' + n(C.liquidezMin / 1e6, 0) + ' M$ al día', ok: (a.volmedio || 0) * (a.precio || 0) > C.liquidezMin, v: a.volmedio == null ? '-' : n(a.volmedio * a.precio / 1e6, 1) + ' M$' },
    { t: 'Precio sobre la media de 200 días', ok: a.sma200 != null && a.precio > a.sma200, v: a.sma200 == null ? '-' : pc((a.precio / a.sma200 - 1) * 100, 0) },
    { t: 'EMA 9 sobre EMA 50', ok: a.ema9 != null && a.ema50 != null && a.ema9 > a.ema50, v: a.ema9 == null ? '-' : pc((a.ema9 / a.ema50 - 1) * 100, 1) },
    { t: 'RSI > ' + C.rsiMin, ok: a.rsi > C.rsiMin, v: n(a.rsi, 0) },
    { t: 'Ingresos +' + C.crecimientoMin + ' % o más', ok: g >= C.crecimientoMin, v: g < -1e8 ? 'sin dato' : pc(g, 0) },
    { t: 'A menos del ' + C.maxDesdeMaximo + ' % de su máximo', ok: dmax != null && dmax >= -C.maxDesdeMaximo, v: pc(dmax, 1) },
  ];
};

/* Gestion de la posicion: donde poner el stop y que senales dicen que toca salir.
   Todo sale de los datos de hoy; son referencias tecnicas, no ordenes. */
window.SALIDA = function (a, extra) {
  extra = extra || {};
  const p = a.precio, dist = x => x == null || !p ? null : (x / p - 1) * 100;
  const atr = a.atr && p ? p - 2 * a.atr : null;
  const opciones = [
    { t: 'Cierre bajo la EMA 21', v: a.ema21, d: dist(a.ema21), nota: 'stop corto, para capturar tramos rápidos' },
    { t: 'Cierre bajo la EMA 50', v: a.ema50, d: dist(a.ema50), nota: 'stop amplio, aguanta sustos normales' },
    { t: 'Dos veces su rango diario (ATR)', v: atr, d: dist(atr), nota: 'stop por volatilidad' },
  ].filter(x => x.v != null);
  const senales = [];
  if (p != null && a.ema21 != null && p < a.ema21) senales.push('Ha perdido la EMA 21 (' + n(a.ema21) + ' $): primera señal de salida');
  if (p != null && a.ema50 != null && p < a.ema50) senales.push('Ha perdido la EMA 50 (' + n(a.ema50) + ' $): la tendencia corta se ha roto');
  if (a.rsi != null && a.rsi < 45) senales.push('RSI ' + n(a.rsi, 0) + ': ha perdido la fuerza compradora');
  const caida = a.max1m && p ? (p / a.max1m - 1) * 100 : null;
  if (caida != null && caida <= -15) senales.push('Ha caído ' + n(Math.abs(caida), 0) + ' % desde su máximo del último mes');
  if (extra.devuelto != null && extra.devuelto >= 50 && extra.maxGanancia >= 10) senales.push('Ha devuelto el ' + n(extra.devuelto, 0) + ' % de lo que llegó a ganar (de ' + pc(extra.maxGanancia) + ' a ' + pc(extra.ganancia) + ')');
  return { opciones, senales, caidaMes: caida };
};

/* Acciones en circulacion mas antiguas que conozcamos de ese valor: base para medir la dilucion. */
function dilucionDe(ticker, hasta) {
  const fechas = FH.filter(f => f <= hasta).sort();
  for (const f of fechas) {
    const x = ((HIST[f] || {}).acciones || []).find(y => y.t === ticker);
    if (x && x.ac) return { acciones: x.ac, dias: Math.round((new Date(hasta + 'T12:00:00Z') - new Date(f + 'T12:00:00Z')) / 864e5) };
  }
  return null;
}
function ctxDia(f, a, d) {
  const m = ((d || {}).mercado || []).find(x => x.ticker === 'SPY') || {};
  return { fecha: f, spy: { tres: m.tres, seis: m.seis }, sector: (((d || {}).referencia || {}).sectores || {})[a.sector] || null,
    dilucion: dilucionDe(a.ticker, f) };
}
function puntua(f, d, lista, conNueva) {
  const fprev = FH[FH.indexOf(f) + 1], prev = (HIST[fprev] || {}).acciones;
  const comparable = !!prev && prev.some(x => x.sc != null), antes = new Set((prev || []).map(x => x.t));
  return (lista || []).map(a => {
    const p = window.PUNTUA ? window.PUNTUA(a, ctxDia(f, a, d)) : null;
    return { ...a, pt: p, score: p ? p.total : null, acel: p ? p.acel : null, g: p ? p.g : null,
      dmax: p ? p.dmax : null, ext: p ? p.extEma : null, racha: racha(a.ticker, f),
      nueva: conNueva && comparable && !antes.has(a.ticker) };
  });
}

window.vista = function () {
  const d = CACHE[S.dia] || {};
  const todas = puntua(S.dia, d, d.acciones, true).sort((x, y) => (y[S.orden] ?? -1e18) - (x[S.orden] ?? -1e18));
  return { fecha: S.dia, fechaTxt: S.dia ? fFecha(S.dia) : '', todas, filas: todas.slice(0, S.top),
    enMarcha: puntua(S.dia, d, d.enMarcha, false).sort((x, y) => ((y.pt || {}).sinPenalizar ?? 0) - ((x.pt || {}).sinPenalizar ?? 0)),
    orden: $('orden').selectedOptions[0].textContent, filtros: [],
    mercado: d.mercado || [], universo: d.universo || null, candidatas: d.candidatas || null };
};

async function iniciar() {
  try {
    T = await (await fetch('panel.json', { cache: 'no-cache' })).json();
  } catch (e) {
    $('lista').appendChild(el('div', 'empty', 'No se han podido cargar los datos. Recarga la página en unos minutos.'));
    return;
  }
  HIST = T.historico || {}; FH = Object.keys(HIST).sort().reverse(); ACT = T.actual || {}; CRIT = T.criterios || {};
  REGIMEN = T.regimen || { favorable: true };
  // Con el mercado en contra el momentum falla mucho mas: se muestran menos candidatas.
  if (!REGIMEN.favorable) S.top = 5;
  MHOY = (T.mercadoHoy || []).find(x => x.ticker === 'SPY') || {}; REFHOY = (T.referenciaHoy || {}).sectores || {};
  const fechas = (T.dias || []).slice().sort().reverse();
  S.dia = fechas[0];
  fechas.forEach(f => { const o = el('option', null, fFecha(f)); o.value = f; $('dia').appendChild(o) });
  if (T.actualizado) $('act').textContent = 'Última actualización: ' + new Date(T.actualizado.replace('Z', ':00Z')).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  if (!S.dia) { $('lista').appendChild(el('div', 'empty', 'Aún no hay datos.')); return }
  await dia(S.dia);
  window.initHoy();
  window.initSeguimiento();
  window.pinta();
}
window.cambiarDia = async f => {
  S.dia = f;
  if (!CACHE[f]) { $('lista').replaceChildren(el('div', 'cargando', 'Cargando ese día…')) }
  await dia(f);
  window.pinta();
};
document.addEventListener('DOMContentLoaded', iniciar);
