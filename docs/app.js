/* Carga de datos y estado de la interfaz.
   panel.json: resumen ligero (dias disponibles, historico, estado de hoy de las seguidas, criterios).
   datos/<fecha>.json: el detalle de un dia, que se descarga solo cuando se mira ese dia. */
let T = {}, HIST = {}, FH = [], ACT = {}, CRIT = {}, MHOY = {}, REFHOY = {};
const CACHE = {};                       // ficheros de dia ya descargados
const S = { dia: null, orden: 'prioridad', top: 5 };   // se muestran 5; las 10 guardadas están a un clic
let REGIMEN = { favorable: true };
const $ = id => document.getElementById(id);
const n = (v, d = 2) => v == null ? '-' : Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (v, d = 1) => v == null ? '-' : (v >= 0 ? '+' : '') + n(v, d) + ' %';
const ppt = (v, d = 1) => v == null ? '-' : (v >= 0 ? '+' : '') + n(v, d) + ' pp';
/* Sin techo de capitalizacion entran empresas de billones: 1141,0 B no se lee, 1,14 T si. */
const cap = v => v == null ? '-' : v >= 1e12 ? n(v / 1e12, 2) + ' T' : v >= 1e9 ? n(v / 1e9, 1) + ' B' : n(v / 1e6, 0) + ' M';
/* Serie diaria de cierres de todo lo que ha pasado por el top, incluidos los dias en que ya no esta.
   Vive aparte y se descarga solo al abrir esta pestaña: panel.json se baja en cada visita y esto no
   le hace falta a nadie mas. */
let PRECIOS = null;
async function cargaPrecios() {
  if (PRECIOS) return PRECIOS;
  try { PRECIOS = (await (await fetch('precios.json', { cache: 'no-cache' })).json()).dias || {}; }
  catch (e) { PRECIOS = {}; }
  return PRECIOS;
}
/* Cierre de una accion un dia dado: primero la serie completa; si no, el registro del top, que solo
   la tiene los dias que estuvo dentro. */
function cierre(f, clave) {
  const p = (PRECIOS || {})[f];
  if (p && p[clave] != null) return p[clave];
  const fila = ((HIST[f] || {}).acciones || []).find(y => (y.s || y.t) === clave);
  return fila && fila.p != null ? fila.p : null;
}


/* Cierre mas alto de un valor desde una fecha. Sirve para saber cuanto llego a ganar una posicion sin
   depender de que abrieras la app ese dia: antes, pasados 90 dias, el maximo se quedaba congelado en
   el ultimo precio que la web hubiera visto, y la regla de devolucion dejaba de proteger justo en la
   multibagger de largo plazo, que es donde mas hace falta. */
function maximoEnSerie(clave, desde) {
  const dias = PRECIOS || {};
  let max = 0;
  for (const f of Object.keys(dias)) {
    if (f < desde) continue;
    const p = dias[f] && dias[f][clave];
    if (p > max) max = p;
  }
  return max || null;
}

/* Un push de codigo en fin de semana hacia que el proceso guardara un dia con el cierre del viernes
   repetido. Ya no ocurre (build.py lo corta), pero los que hay guardados no son sesiones de bolsa:
   ni cuentan como recorrido ni se enseñan con su fecha, porque su precio es el del viernes. */
const esSesion = f => { const d = new Date(f + 'T12:00:00Z').getUTCDay(); return d !== 0 && d !== 6 };
const sesionDe = f => { const d = new Date(f + 'T12:00:00Z');
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10) };
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
    /* Requisito SOLO de entrada: se marca con entrada:true y no cuenta como incumplimiento mientras la
       tengas. Desde el 14/10/2026 no hay techo (C.capMax es null); el suelo sigue siendo obligatorio. */
    { t: C.capMax ? 'Capitalización entre ' + cap(C.capMin) + ' y ' + cap(C.capMax) : 'Capitalización > ' + cap(C.capMin),
      ok: a.cap > C.capMin && (!C.capMax || a.cap <= C.capMax), v: cap(a.cap), entrada: true },
    { t: 'Precio > ' + C.precioMin + ' $', ok: a.precio > C.precioMin, v: n(a.precio) + ' $', entrada: true },
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
/* Textos de las señales de REGLAS, para no repetir literales por toda la web. */
window.TEXTO_SENAL = function (m) {
  switch (m.codigo) {
    case 'stop': return 'ha perdido el stop de ' + n(m.stop) + ' $' + (m.ema50 && Math.abs(m.stop - m.ema50) < 0.01 ? ' (su EMA 50)' : '');
    case 'ema50': return 'ha cerrado por debajo de su EMA 50 (' + n(m.ema50) + ' $): la tendencia se ha roto';
    case 'ema21': return 'ha perdido la EMA 21 (' + n(m.ema21) + ' $): primera señal de debilidad';
    case 'rsi': return 'RSI ' + n(m.rsi, 0) + ': sin fuerza compradora';
    case 'devuelto': return 'ha devuelto el ' + n(m.devuelto, 0) + ' % de lo que llegó a ganar (de ' + pc(m.ganMax) + ' a ' + pc(m.gan) + ')';
    case 'devolviendo': return 'ha devuelto el ' + n(m.devuelto, 0) + ' % de su ganancia máxima (vendería al ' + m.limite + ' %)';
    case 'requisitos': return 'ya no cumple ' + m.fallos.length + ' requisitos: ' + m.fallos.map(f => f.t.toLowerCase()).join(', ');
    case 'un-requisito': return 'ha dejado de cumplir: ' + m.fallo.t.toLowerCase() + ' (' + m.fallo.v + ')';
    case 'capitalizacion': return 'su capitalización (' + m.valor + ') ha caído por debajo del mínimo: ya no entraría como nueva, pero eso solo no es motivo de venta';
    case 'resultados': return 'publica resultados en ' + m.dias + ' día' + (m.dias === 1 ? '' : 's') + ': puede abrir con un hueco que el stop no evita';
    case 'caida-mes': return 'ha caído ' + n(Math.abs(m.caida), 0) + ' % desde su máximo del último mes';
    default: return m.codigo;
  }
};

/* Stop y señales de una acción que todavía no tienes: una sola fuente, REGLAS. */
window.SALIDA = function (a) {
  const e = window.REGLAS.stopDeEntrada(a) || {};
  const opciones = [];
  /* Con el precio por debajo de la EMA 50 el stop sale por encima del precio: no es un stop. Se
     etiqueta como tal en vez de mostrar una distancia positiva, que se lee como si fuese un stop. */
  if (e.stop != null) opciones.push({ t: e.invalido
      ? 'Sin stop válido: el precio ya está por debajo de su EMA 50'
      : 'Stop del sistema (EMA 50, con tope del ' + window.REGLAS.R.perdidaMaxima + ' %)',
    v: e.stop, d: e.distancia, invalido: !!e.invalido,
    nota: e.invalido ? 'la EMA 50 queda por encima del precio: entrar aquí sería entrar ya saltado' : 'es el que gestionará tu posición si entras' });
  if (e.ema21 != null && a.precio) opciones.push({ t: 'Cierre bajo la EMA 21', v: e.ema21, d: (e.ema21 / a.precio - 1) * 100, nota: 'referencia más ceñida si quieres apurar' });
  if (a.atr && a.precio) opciones.push({ t: 'Dos veces su rango diario (ATR)', v: a.precio - 2 * a.atr, d: ((a.precio - 2 * a.atr) / a.precio - 1) * 100, nota: 'referencia por volatilidad' });
  return { opciones, tope: !!e.tope, invalido: !!e.invalido, precioSinTope: e.precioSinTope, retrocesoNecesario: e.retrocesoNecesario, sobreEma50: e.sobreEma50,
    distanciaEma50: e.distanciaEma50 != null ? e.distanciaEma50 : null,
    senales: window.REGLAS.senalesDeMercado(a).map(window.TEXTO_SENAL) };
};

/* Prioridad de compra: primero lo que se puede comprar hoy, despues lo que hay que vigilar y al final
   lo que no se toca; dentro de cada grupo manda la nota. La nota mide lo buena que es la empresa, no si
   hoy es el dia de entrar: un 89 que no se puede comprar no es la primera idea del dia. */
const NIVEL = { qok: 0, qwarn: 1, qbad: 2 };
window.PRIORIDAD = function (a) {
  if (a.sinSeguimiento) return 3;   // sin datos de hoy no se compra: al final de todo
  const v = window.VEREDICTO(a, { extendida: a.pt ? a.pt.extendida : false });
  return NIVEL[v.cls] != null ? NIVEL[v.cls] : 2;
};

/* Tu cartera: cuanto dinero tienes y que porcentaje arriesgas por operacion. Solo en este navegador. */
window.CARTERA = { leer() { try { return JSON.parse(localStorage.getItem('cartera-v1') || 'null') } catch (e) { return null } },
  guardar(v) { try { localStorage.setItem('cartera-v1', JSON.stringify(v)) } catch (e) {} } };

/* Cuanto comprar: si arriesgas un % fijo de la cartera y el stop esta a X% del precio, la posicion sale sola. */
window.TAMANO = function (distanciaStop) {
  const c = window.CARTERA.leer();
  if (!c || !c.total || distanciaStop == null || distanciaStop >= 0) return null;
  const riesgo = c.riesgo || 1;
  const pctCartera = Math.min(riesgo / Math.abs(distanciaStop) * 100, 25);   // nunca más de un cuarto en una sola
  return { importe: c.total * pctCartera / 100, pct: pctCartera, riesgo, tope: pctCartera >= 25 };
};

/* Margen del stop medido en dias de rango de la accion (ADR = recorrido medio diario).
   No es un umbral calibrado, es una definicion: si el stop esta a menos de 1 ADR, un dia normal lo
   cruza. Importa porque el tamano de posicion es riesgo / distancia al stop, asi que un stop muy
   pegado produce la posicion MAS grande justo donde la salida es mas aleatoria. Medido el 14 de
   octubre de 2026 sobre las 30 en seguimiento: 9 tenian el stop dentro de un dia de rango, y 6 de
   esas se dimensionaban al 21-25 % de la cartera. Esto solo lo ensena; no cambia ni el stop ni el
   tamano. Cambiarlos es la pregunta 5 de la seccion 7 y necesita 30 entradas maduras. */
window.MARGEN_STOP = function (distanciaStop, adr) {
  const d = typeof distanciaStop === 'number' && isFinite(distanciaStop) ? Math.abs(distanciaStop) : null;
  const a = typeof adr === 'number' && isFinite(adr) && adr > 0 ? adr : null;
  if (d == null || a == null) return null;
  const dias = d / a;
  return { dias, apretado: dias < 1 };
};

/* Dias hasta la publicacion de resultados (hueco de precio: el stop no protege de un salto al abrir). */
window.DIAS_RESULTADOS = function (a, hoy) {
  if (!a || !a.resultados) return null;
  return Math.round((new Date(a.resultados + 'T12:00:00Z') - new Date((hoy || FH[0]) + 'T12:00:00Z')) / 864e5);
};

window.VEREDICTO = function (a, extra) {
  extra = extra || {};
  const sal = window.SALIDA(a), o = sal.opciones[0];
  const stop = o ? n(o.v) + ' $ (' + pc(o.d, 0) + ')' : '—';
  const dmax = a.precio && a.max52 ? (a.precio / a.max52 - 1) * 100 : null;
  const extendida = extra.extendida != null ? extra.extendida : false;
  /* Si la accion ha desaparecido de la fuente de datos (fusion, cambio de simbolo, exclusion), lo
     ultimo que se puede hacer es seguir diciendo COMPRA con el precio del ultimo cierre conocido. */
  if (extra.sinSeguimiento) return { t: 'Sin datos', d: 'ha dejado de cotizar con este símbolo: compruébala en tu bróker.', cls: 'qbad', stop };
  const fallosReales = (extra.fallos || []).filter(f => !f.entrada);
  if (fallosReales.length) return { t: 'Ya no cumple', d: fallosReales.map(f => f.t.toLowerCase() + ' (' + f.v + ')').join(', '), cls: 'qbad', stop };
  if (sal.senales.length) return { t: 'No comprar', d: sal.senales[0].toLowerCase() + '.', cls: 'qbad', stop };
  if (extendida) return { t: 'No comprar aquí', d: 'muy estirada: esperar a que consolide. Si ya la tienes, déjala correr.', cls: 'qwarn', stop };
  if (extra.flojea) return { t: 'Vigilar', d: 'cumple, pero ha perdido fuerza. Mantener.', cls: 'qwarn', stop };
  /* "Esperar a que lo recupere" sin decir hasta donde no sirve. El punto exacto es el maximo de 52
     semanas menos el margen permitido: por encima de ahi deja de ser "Esperar". */
  /* El sistema pide DOS cosas a la vez y hasta ahora solo se decia una:
       suelo = cerca de su maximo          -> precio por ENCIMA de max52 x 0,90
       techo = stop tecnico, no un tope    -> precio por DEBAJO de EMA 50 / 0,85
     Decir solo "compra a partir del suelo" era mentir cuando el suelo queda por encima del techo:
     con CDNA el 18/10/2026 la ventana medía -0,32 $, o sea que NO EXISTIA ningun precio de compra
     limpia, y aun asi se anunciaba uno. Ahora se calcula la ventana entera y se dice la verdad. */
  if (dmax != null && dmax < -window.REGLAS.R.lejosDeMaximo) {
    const suelo = a.max52 ? a.max52 * (1 - window.REGLAS.R.lejosDeMaximo / 100) : null;
    const techo = a.ema50 ? a.ema50 / (1 - window.REGLAS.R.perdidaMaxima / 100) : null;
    const base = 'está a ' + pc(dmax, 0) + ' de su máximo (' + n(a.max52) + ' $)';
    if (!suelo) return { t: 'Esperar', d: base + ': mejor esperar a que lo recupere.', cls: 'qwarn', stop };
    const arriba = n((suelo / a.precio - 1) * 100, 1) + ' % arriba';
    if (techo && suelo > techo) return { t: 'Esperar',
      d: base + ': hoy no hay ningún precio al que sea compra limpia. Para acercarse a su máximo tendría que alejarse demasiado de su EMA 50 (' + n(a.ema50) + ' $). Lo que hace falta es tiempo, no una subida.',
      accion: { et: 'Sin ventana de compra', v: 'hasta que suba su EMA 50', ds: 'necesitaría estar sobre ' + n(suelo) + ' $ y bajo ' + n(techo) + ' $ a la vez' },
      cls: 'qwarn', stop };
    if (techo) return { t: 'Esperar', d: base + ': todavía no es entrada.',
      accion: { et: 'Ventana de compra', v: n(suelo) + ' – ' + n(techo) + ' $', ds: arriba + ' · por encima de ' + n(techo) + ' $ sería compra arriesgada' },
      cls: 'qwarn', stop };
    return { t: 'Esperar', d: base + ': todavía no es entrada.',
      accion: { et: 'Comprar a partir de', v: n(suelo) + ' $', ds: arriba }, cls: 'qwarn', stop };
  }
  /* El precio al que deja de ser arriesgada va AQUI, no en la caja del stop: alli competia con la
     cifra del stop, dos precios con el mismo peso en el mismo sitio, y habia que adivinar cual era
     cual. Aqui va justo detras del problema que lo motiva. */
  if (sal.tope) return { t: 'Compra arriesgada',
    d: 'un ' + n(sal.sobreEma50, 0) + ' % sobre su EMA 50: el stop es un tope fijo, no un nivel técnico. Media posición, o esperar.',
    accion: sal.precioSinTope ? { et: 'Entrada limpia a', v: n(sal.precioSinTope) + ' $',
      ds: n(Math.abs(sal.retrocesoNecesario), 1) + ' % abajo · ahí el stop vuelve a ser la EMA 50' } : null,
    cls: 'qwarn', stop };
  /* No se repite el stop: la caja que va justo debajo ya lo da con su distancia y su margen en
     dias de rango. Dos veces el mismo numero pegados obliga a comprobar si son el mismo. */
  return { t: 'COMPRA', d: 'buen punto de entrada: el stop es la EMA 50, no un tope fijo.', cls: 'qok', stop };
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
      sinSeguimiento: f === FH[0] && !!a.simbolo && !ACT[a.simbolo],
      nueva: conNueva && comparable && !antes.has(a.ticker) };
  }).map(x => ({ ...x, prio: window.PRIORIDAD(x) }));
}

/* Desempate siempre por capitalizacion menor: a igualdad, la pequena tiene mas recorrido. */
function compara(x, y) {
  if (S.orden === 'prioridad') {
    const d = (x.prio ?? 2) - (y.prio ?? 2);
    if (d) return d;
    return ((y.score ?? -1e18) - (x.score ?? -1e18)) || ((x.cap ?? 0) - (y.cap ?? 0));
  }
  return ((y[S.orden] ?? -1e18) - (x[S.orden] ?? -1e18)) || ((x.cap ?? 0) - (y.cap ?? 0));
}

window.vista = function () {
  const d = CACHE[S.dia] || {};
  const todas = puntua(S.dia, d, d.acciones, true).sort(compara);
  return { fecha: S.dia, fechaTxt: S.dia ? fFecha(S.dia) : '', todas, filas: todas.slice(0, S.top),
    enMarcha: puntua(S.dia, d, d.enMarcha, false).sort((x, y) => ((y.pt || {}).sinPenalizar ?? 0) - ((x.pt || {}).sinPenalizar ?? 0)),
    orden: $('orden').selectedOptions[0].textContent, filtros: [],
    mercado: d.mercado || [], universo: d.universo || null, candidatas: d.candidatas || null };
};

/* Si el proceso diario falla varios días, los stops que se muestran son viejos: hay que decirlo fuerte.
   Se cuentan días de mercado, así que un fin de semana normal no dispara el aviso. */
function diasDeMercado(desde, hasta) {
  let n = 0;
  const d = new Date(desde + 'T12:00:00Z'), fin = new Date(hasta + 'T12:00:00Z');
  while (d < fin) { d.setUTCDate(d.getUTCDate() + 1); const s = d.getUTCDay(); if (s !== 0 && s !== 6) n++; }
  return n;
}
function avisaDatosViejos(ultimo) {
  const caja = $('viejo');
  if (!caja || !ultimo) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const dias = diasDeMercado(ultimo, hoy);
  if (dias < 2) { caja.hidden = true; return; }
  caja.hidden = false;
  caja.className = 'aviso-viejo';
  caja.replaceChildren(
    el('b', null, 'Datos de hace ' + dias + ' días de mercado'),
    el('span', null, ' · el último cierre guardado es el de ' + fFecha(ultimo) + '. Los precios, los stops y los veredictos no están actualizados: compruébalos en tu bróker antes de operar.'));
}

/* Tema: oscuro salvo que se pida claro. Se guarda en este navegador, igual que las posiciones.
   El valor ya se ha aplicado en el <head> antes de pintar; aqui solo se cablea el boton. */
function tema() {
  const b = $('tema');
  if (!b) return;
  const pinta = () => { const claro = document.documentElement.dataset.tema === 'claro';
    b.textContent = claro ? 'Oscuro' : 'Claro';
    const m = document.querySelector('meta[name=theme-color]');
    if (m) m.content = claro ? '#f6f7f9' : '#0f1115'; };
  b.onclick = () => {
    const claro = document.documentElement.dataset.tema === 'claro';
    if (claro) delete document.documentElement.dataset.tema;
    else document.documentElement.dataset.tema = 'claro';
    try { localStorage.setItem('tema', claro ? 'oscuro' : 'claro') } catch (e) {}
    pinta();
  };
  pinta();
}

async function iniciar() {
  tema();
  try {
    T = await (await fetch('panel.json', { cache: 'no-cache' })).json();
  } catch (e) {
    $('lista').appendChild(el('div', 'empty', 'No se han podido cargar los datos. Recarga la página en unos minutos.'));
    return;
  }
  /* GitHub sirve el HTML con 10 minutos de caché: si el navegador tiene una versión antigua del código,
     los datos vienen de una versión y los scripts de otra. Al detectarlo, se recarga una sola vez. */
  if (T.version && window.VERSION && T.version !== window.VERSION && !sessionStorage.getItem('refrescado-' + T.version)) {
    try { sessionStorage.setItem('refrescado-' + T.version, '1') } catch (e) {}
    location.replace(location.pathname + '?v=' + T.version);
    return;
  }
  HIST = T.historico || {}; FH = Object.keys(HIST).sort().reverse(); ACT = T.actual || {}; CRIT = T.criterios || {};
  REGIMEN = T.regimen || { favorable: true };
  // Con el mercado en contra el momentum falla mucho mas: se muestran menos candidatas.
  if (!REGIMEN.favorable) S.top = 3;   // con el mercado en contra, aún menos
  MHOY = (T.mercadoHoy || []).find(x => x.ticker === 'SPY') || {}; REFHOY = (T.referenciaHoy || {}).sectores || {};
  /* Si tienes posiciones abiertas de acciones que llevan más de un mes fuera del top, sus datos de hoy
     están en extra.json. Solo se descarga en ese caso: a casi nadie le hace falta. */
  try {
    const pos = JSON.parse(localStorage.getItem('posiciones-v1') || '[]').filter(p => !p.cerrada);
    if (pos.some(p => !ACT[p.simbolo])) {
      const ex = await (await fetch('extra.json', { cache: 'no-cache' })).json();
      Object.assign(ACT, ex.actual || {});
    }
  } catch (e) {}
  const fechas = (T.dias || []).slice().sort().reverse();
  S.dia = fechas[0];
  fechas.forEach(f => { const o = el('option', null, fFecha(f)); o.value = f; $('dia').appendChild(o) });
  if (T.actualizado) $('act').textContent = 'Última actualización: ' + new Date(T.actualizado.replace('Z', ':00Z')).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  avisaDatosViejos(fechas[0]);
  if (!S.dia) { $('lista').appendChild(el('div', 'empty', 'Aún no hay datos.')); return }
  await dia(S.dia);
  window.initHoy();
  window.initSeguimiento();
  if (window.initResultados) window.initResultados();
  /* pinta() sigue corriendo aunque Hoy ya no sea la vista inicial: llena la subpestaña y, sobre todo,
     calcula el contador de señales de compra que se ve desde Seguimiento sin entrar. */
  window.pinta();
  /* Desde el 17/10/2026 la vista inicial es Seguimiento. Sin esta llamada la app abriria en blanco. */
  if (window.seguimiento) window.seguimiento();
}
window.cambiarDia = async f => {
  S.dia = f;
  if (!CACHE[f]) { $('lista').replaceChildren(el('div', 'cargando', 'Cargando ese día…')) }
  await dia(f);
  window.pinta();
};
document.addEventListener('DOMContentLoaded', iniciar);
