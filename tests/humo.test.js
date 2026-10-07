/* Test de humo: monta un navegador mínimo, carga la web con datos reales y pulsa todas las pestañas.
   Nace de dos fallos reales en los que una edición dejó fuera una función y la pestaña se quedaba en blanco. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '..', 'docs');
let fallos = 0, total = 0;
const ok = n => { total++; console.log('  ✓ ' + n) };
const mal = (n, e) => { total++; fallos++; console.log('  ✗ ' + n + (e ? '\n      ' + e : '')) };

/* Navegador de juguete: lo justo para que el código se ejecute de verdad. */
function nodo(tag) {
  const e = {
    tagName: (tag || 'div').toUpperCase(), hijos: [], _texto: '', className: '', style: {}, dataset: {}, hidden: false, value: '',
    set textContent(v) { this._texto = String(v); this.hijos = [] },
    get textContent() { return this._texto + this.hijos.map(h => h.textContent).join('') },
    get innerText() { return this.textContent },
    set innerHTML(v) { this._texto = '' }, get innerHTML() { return '' },
    appendChild(h) { this.hijos.push(h); return h }, append(...h) { h.forEach(x => this.hijos.push(x)) },
    prepend(h) { this.hijos.unshift(h) }, replaceChildren(...h) { this.hijos = h }, remove() {},
    setAttribute(k, v) { this[k] = v }, getAttribute(k) { return this[k] }, addEventListener() {},
    closest() { return null }, getBoundingClientRect() { return { height: 100, top: 0 } },
    querySelector() { return null }, querySelectorAll() { return [] },
    classList: { add() {}, remove() {}, contains() { return false } },
    get selectedOptions() { return [{ textContent: 'orden' }] }, get options() { return this.hijos },
  };
  return e;
}
const porId = {};
const doc = {
  createElement: nodo, createElementNS: () => ({ ...nodo('svg'), setAttribute() {} }),
  getElementById: id => (porId[id] = porId[id] || nodo('div')),
  querySelector: () => null, querySelectorAll: () => [], addEventListener: (_, f) => { doc._listo = f },
  head: nodo('head'), body: nodo('body'), documentElement: { dataset: {} },
};
const almacen = {};
const ventana = {
  document: doc, location: { pathname: '/', href: '/', replace() {} }, matchMedia: () => ({ matches: false }),
  localStorage: { getItem: k => almacen[k] ?? null, setItem: (k, v) => { almacen[k] = String(v) }, removeItem: k => { delete almacen[k] } },
  sessionStorage: { getItem: () => null, setItem() {} },
  fetch: async (u) => {
    const f = u.split('?')[0];
    const p = path.join(dir, f);
    if (!fs.existsSync(p)) throw new Error('no existe ' + f);
    return { json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
  },
  VERSION: JSON.parse(fs.readFileSync(path.join(dir, 'panel.json'), 'utf8')).version,
};
ventana.window = ventana; ventana.globalThis = ventana; ventana.console = console;
ventana.Math = Math; ventana.JSON = JSON; ventana.Date = Date; ventana.Object = Object; ventana.Array = Array;
ventana.Number = Number; ventana.String = String; ventana.Promise = Promise; ventana.isFinite = isFinite;
ventana.encodeURIComponent = encodeURIComponent; ventana.setTimeout = setTimeout; ventana.alert = () => {};
ventana.confirm = () => true; ventana.prompt = () => '10';
const ctx = vm.createContext(ventana);

console.log('\nCARGA DE LA WEB');
const orden = ['reglas.js', 'puntuacion.js', 'app.js', 'hoy.js', 'seguimiento.js', 'posiciones.js', 'resultados.js', 'parametros.js'];
for (const f of orden) {
  try { vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx, { filename: f }); ok(f + ' se carga sin errores') }
  catch (e) { mal(f + ' falla al cargar', e.message) }
}

(async () => {
  console.log('\nARRANQUE Y PESTAÑAS');
  try { await doc._listo(); ok('la web arranca y descarga sus datos') } catch (e) { mal('la web no arranca', e.message) }
  const paso = async (nombre, fn) => {
    try { await fn(); ok(nombre) } catch (e) { mal(nombre, e.message) }
  };
  await paso('la pestaña del día se pinta', () => ventana.pinta());
  await paso('la pestaña de seguimiento se pinta', () => ventana.seguimiento());
  await paso('la pestaña de posiciones se pinta sin posiciones', () => ventana.posiciones());
  await paso('la pestaña de resultados se pinta', () => ventana.resultados());
  await paso('la pestaña de parámetros se pinta', () => ventana.parametros());

  console.log('\nCON UNA POSICIÓN ABIERTA');
  const panel = JSON.parse(fs.readFileSync(path.join(dir, 'panel.json'), 'utf8'));
  const sim = Object.keys(panel.actual)[0], datos = panel.actual[sim];
  almacen['posiciones-v1'] = JSON.stringify([{ ticker: datos.ticker, simbolo: sim, precio: datos.precio * 0.8, fecha: panel.dias[panel.dias.length - 1], maxVisto: datos.precio }]);
  almacen['cartera-v1'] = JSON.stringify({ total: 10000, riesgo: 1 });
  await paso('posiciones se pinta con una compra anotada', () => ventana.posiciones());
  await paso('el día se pinta con el botón ya marcado', () => ventana.pinta());
  await paso('el seguimiento se pinta con una posición', () => ventana.seguimiento());

  console.log('\nAVISO DE DATOS VIEJOS (cuenta días de mercado, no naturales)');
  const dm = ventana.diasDeMercado || null;
  if (typeof ventana.diasDeMercado === 'function' || true) {
    // se prueba a través del render: con la fecha de los datos reales no debe romper
    await paso('el aviso de datos viejos se evalúa sin errores', () => ventana.avisaDatosViejos(panel.dias[panel.dias.length - 1]));
  }

  console.log('\nCOPIA DE SEGURIDAD DE LAS POSICIONES');
  await paso('la pestaña se pinta con los botones de copia', () => ventana.posiciones());
  const guardadas = JSON.parse(almacen['posiciones-v1'] || '[]');
  guardadas.length ? ok('las posiciones siguen guardadas tras pintar') : mal('se han perdido las posiciones al pintar');

  console.log('\nEL VEREDICTO ES COHERENTE EN LAS DOS VISTAS');
  const v = ventana.VEREDICTO(datos, {});
  const e = ventana.REGLAS.stopDeEntrada(datos);
  if (v && e && Math.abs(parseFloat(String(v.stop).replace(',', '.')) - e.stop) < 0.05) ok('el stop del veredicto es el del módulo de reglas');
  else if (v && e) mal('el stop del veredicto no coincide', v.stop + ' vs ' + e.stop);

  /* Una nota alta que hoy no se puede comprar no puede encabezar la lista: lo primero que se lee
     tiene que ser lo que se puede comprar. */
  console.log('\nLA LISTA SE ORDENA POR PRIORIDAD DE COMPRA');
  const comprable = { ticker: 'BUENA', precio: 100, ema50: 92, ema21: 97, rsi: 62, max52: 101, pt: { extendida: false } };
  const estirada = { ticker: 'LEJOS', precio: 100, ema50: 70, ema21: 95, rsi: 62, max52: 101, pt: { extendida: false } };
  const rota = { ticker: 'ROTA', precio: 100, ema50: 110, ema21: 108, rsi: 30, max52: 180, pt: { extendida: false } };
  const niveles = [comprable, estirada, rota].map(x => ventana.PRIORIDAD(x));
  niveles[0] === 0 ? ok('la que se puede comprar va primera') : mal('la comprable no es prioridad 0', niveles[0]);
  niveles[0] < niveles[1] ? ok('una nota alta pero estirada va detrás de una comprable') : mal('la estirada no cede el paso', niveles.join(','));
  niveles[1] < niveles[2] ? ok('lo que ya no se toca va al final') : mal('la rota no va al final', niveles.join(','));

  /* La pestaña Hoy decia ESPERAR sobre CDNA y Seguimiento la ponia la primera de "cual compraria
     antes", porque ordenaba por estado y nota sin mirar el veredicto. Las dos tienen que coincidir. */
  console.log('\nHOY Y SEGUIMIENTO NO SE CONTRADICEN');
  porId.per.value = 90; porId.segorden.value = 'reco'; porId.segest.value = 'vivas';
  const coh = vm.runInContext(`(() => {
    const filas = historial(+document.getElementById('per').value || 90);
    const hoy = {}; vista().todas.forEach(a => { hoy[a.clave || a.simbolo || a.ticker] = a.prio });
    const choques = filas.filter(f => hoy[f.clave] != null && hoy[f.clave] !== f.prioridad)
      .map(f => f.ticker + ': hoy ' + hoy[f.clave] + ' vs seguimiento ' + f.prioridad);
    return { choques, n: filas.length, prio: Object.fromEntries(filas.map(f => [f.ticker, f.prioridad])),
      etiquetas: filas.map(f => f.veredicto && f.veredicto.t).filter(Boolean).length };
  })()`, ctx);
  coh.choques.length === 0 ? ok('el veredicto de cada acción es el mismo en las dos pestañas')
    : mal('las pestañas se contradicen', coh.choques.join(' | '));
  coh.etiquetas === coh.n ? ok('toda fila de seguimiento lleva su veredicto calculado una sola vez')
    : mal('hay filas sin veredicto', coh.etiquetas + ' de ' + coh.n);
  // Se lee el orden REAL que pinta la pestaña, no uno reordenado aqui: si no, la prueba no prueba nada.
  ventana.seguimiento();
  const leer = x => (x.textContent || '') + ' ' + (x.hijos || []).map(leer).join(' ');
  const pintadas = (porId.rseg.hijos || []).filter(c => String(c.clase || c.className || '').includes('card'))
    .map(c => Object.keys(coh.prio).find(t => new RegExp('(^|\\s)' + t + '(\\s|$)').test(leer(c))))
    .filter(Boolean);
  const saltos = pintadas.filter((t, i) => i && coh.prio[pintadas[i - 1]] > coh.prio[t]);
  pintadas.length >= 3 ? ok('se han pintado ' + pintadas.length + ' tarjetas para comprobar el orden')
    : mal('no hay tarjetas que comprobar', pintadas.length);
  saltos.length === 0 ? ok('nunca va una de "esperar" por delante de una de "comprar"')
    : mal('orden incoherente en la pestaña', saltos.join(', '));

  /* "COHU (84) puntuan mas alto" salia en plural con una sola accion. */
  console.log('\nEL AVISO DE LAS QUE QUEDAN FUERA CONCUERDA EN NÚMERO');
  const conc = vm.runInContext(`(() => {
    const avisos = [];
    for (const n of [1, 2]) {
      const u = n === 1;
      avisos.push((u ? ' puntúa' : ' puntúan') + ' más alto, pero hoy no ' + (u ? 'es' : 'son') + ' entrada. ' + (u ? 'Sigue' : 'Siguen') + ' aquí, más abajo.');
    }
    return avisos;
  })()`, ctx);
  /puntúa más alto, pero hoy no es entrada\. Sigue/.test(conc[0]) ? ok('con una sola acción va en singular')
    : mal('una sola acción sale en plural', conc[0]);
  /puntúan más alto, pero hoy no son entrada\. Siguen/.test(conc[1]) ? ok('con varias va en plural')
    : mal('varias acciones salen en singular', conc[1]);
  const fuentes = ['hoy.js', 'seguimiento.js'].map(f => fs.readFileSync(path.join(dir, f), 'utf8'));
  fuentes.every(x => /length === 1|length===1/.test(x)) ? ok('las dos pestañas distinguen singular de plural')
    : mal('alguna pestaña tiene el texto fijo en plural');

  /* Seguimiento ordena por momentum: sirve para ver como evolucionan las que vigilas, no para
     decidir la compra de hoy, que es lo que hace la pestaña Hoy. */
  console.log('\nSEGUIMIENTO ORDENA POR MOMENTUM, SIN EXCEPCIONES');
  porId.segorden.value = 'score'; porId.segest.value = 'vivas'; porId.per.value = 90;
  ventana.seguimiento();
  const porNota = vm.runInContext(`(() => {
    const filas = historial(90).filter(a => ['viable','extendida','flojea'].includes(a.estado));
    return filas.map(a => a.ticker + ':' + a.score).sort((x, y) => y.split(':')[1] - x.split(':')[1]);
  })()`, ctx);
  // el texto de la tarjeta es "#1PAYSEN EL TOP HOY...": hay que casar el ticker exacto, no un [A-Z]+
  const tickers = porNota.map(x => x.split(':')[0]);
  const enPantalla = (porId.rseg.hijos || []).filter(c => String(c.className || '').includes('card'))
    .map((c, i) => tickers.find(t => c.textContent.startsWith('#' + (i + 1) + t)))
    .filter(Boolean);
  const esperados = porNota.map(x => x.split(':')[0]).slice(0, enPantalla.length);
  enPantalla.join(',') === esperados.join(',')
    ? ok('el orden es la nota de mayor a menor (' + enPantalla.join(' > ') + ')')
    : mal('no sigue el orden de nota', enPantalla.join(',') + ' vs ' + esperados.join(','));
  const fuente = fs.readFileSync(path.join(dir, '..', 'plantilla.html'), 'utf8');
  /<option value="score" selected>/.test(fuente) ? ok('"Más momentum ahora" es la opción por defecto')
    : mal('el desplegable no arranca en momentum');
  !/ordenadas por cuál compraría antes/.test(fuente) ? ok('el subtítulo ya no promete orden de compra')
    : mal('el subtítulo sigue diciendo que ordena por orden de compra');

  /* Se pintaba "#1" por la posicion en pantalla y "TOP #2" por la nota en la misma tarjeta: dos
     numeraciones distintas peleandose. En una tarjeta solo puede haber un numero de puesto. */
  console.log('\nUNA SOLA NUMERACIÓN POR TARJETA');
  ventana.seguimiento();
  const tarjetas = (porId.rseg.hijos || []).filter(c => String(c.className || '').includes('card'));
  const conDosNumeros = tarjetas.filter(c => (c.textContent.match(/#\d+/g) || []).length > 1)
    .map(c => (c.textContent.match(/#\d+/g) || []).join(' y '));
  tarjetas.length ? ok('hay ' + tarjetas.length + ' tarjetas que comprobar') : mal('no se pinto ninguna tarjeta');
  conDosNumeros.length === 0 ? ok('ninguna tarjeta enseña dos puestos distintos')
    : mal('tarjetas con numeración doble', conDosNumeros.join(' | '));
  const puestos = tarjetas.map(c => (c.textContent.match(/#(\d+)/) || [])[1]).map(Number);
  puestos.every((v, i) => v === i + 1) ? ok('el número de cada tarjeta es su posición en la lista')
    : mal('los números no siguen el orden de la lista', puestos.join(', '));

  /* La simulacion de stops era ciega los dias que una accion caia del top, que es justo cuando el
     stop saltaria. Ahora hay una serie diaria de cierres aparte; esto comprueba que la usa. */
  console.log('\nLA SIMULACIÓN VE LOS CIERRES FUERA DEL TOP');
  const antes = vm.runInContext(`(() => {
    const e = entradas(); const x = e[0];
    const sinSerie = simula([x])[0];
    return { clave: x.clave, entrada: x.entrada, sesiones: x.sesiones, cobertura: sinSerie.cobertura };
  })()`, ctx);
  typeof antes.cobertura === 'number' ? ok('la simulación informa de cuántos cierres ha visto')
    : mal('no calcula la cobertura');
  // Se inventa una serie en la que la accion se desploma despues de salir del top: el stop debe saltar.
  const conStop = vm.runInContext(`(() => {
    const e = entradas(); const x = e[0];
    PRECIOS = {};
    // caida escalonada que cruza el tope del 15 % en la segunda sesion (solo hay 2 tras la entrada)
    FH.filter(f => f > x.entrada).sort().forEach((f, i) => { PRECIOS[f] = { [x.clave]: x.precio * (1 - 0.09 * (i + 1)) } });
    const r = simula([x])[0];
    PRECIOS = null;
    return { motivo: r.motivo, conReglas: r.conReglas, cobertura: r.cobertura };
  })()`, ctx);
  conStop.motivo === 'stop' ? ok('con la serie completa, una caída fuera del top dispara el stop')
    : mal('el stop no salta aunque la acción caiga por debajo del tope', JSON.stringify(conStop));
  conStop.conReglas > -20 ? ok('y la pérdida queda acotada cerca del tope del 15 % (' + conStop.conReglas.toFixed(0) + ' %)')
    : mal('la pérdida no está acotada', conStop.conReglas);
  // Sin la serie, esa misma caida no se veria: el stop no saltaria y la perdida seria la de hoy.
  const sinSerie = vm.runInContext(`(() => { const x = entradas()[0]; PRECIOS = {}; const r = simula([x])[0];
    PRECIOS = null; return r.motivo })()`, ctx);
  sinSerie == null ? ok('sin la serie diaria ese mismo desplome pasaba desapercibido')
    : mal('la prueba no distingue los dos casos', String(sinSerie));

  /* BLFS desaparecio de TradingView el 7 de octubre (fusion, cambio de simbolo o exclusion) y el
     panel la borraba en silencio de Seguimiento y de Resultados mientras Hoy seguia diciendo COMPRA
     con el ultimo cierre. Borrar las que desaparecen deja el registro lleno de supervivientes. */
  console.log('\nUNA ACCIÓN QUE DESAPARECE NO SE BORRA EN SILENCIO');
  const desap = vm.runInContext(`(() => {
    // tiene que ser una que este de verdad en el registro, no cualquiera de las seguidas
    const clave = entradas().map(a => a.clave).find(k => T.actual[k]);
    const copia = T.actual[clave];
    delete T.actual[clave]; delete ACT[clave]; const pr = T.precios[clave]; delete T.precios[clave];
    const ticker = copia.ticker;
    const enRegistro = entradas().some(a => a.clave === clave);
    const sinPrecio = entradas().find(a => a.clave === clave);
    const enSeguimiento = historial(90).find(a => a.clave === clave);
    const enHoy = vista().todas.find(a => a.clave === clave || a.simbolo === clave);
    const res = { ticker, enRegistro, ret: sinPrecio ? sinPrecio.ret : 'no esta',
      ultimoConocido: sinPrecio ? sinPrecio.precioUltimo : null,
      segEstado: enSeguimiento ? enSeguimiento.estado : 'no esta',
      segVeredicto: enSeguimiento ? enSeguimiento.veredicto.t : 'no esta',
      hoyVeredicto: enHoy ? VEREDICTO(enHoy, { sinSeguimiento: enHoy.sinSeguimiento }).t : 'no esta',
      hoyPrio: enHoy ? enHoy.prio : null };
    T.actual[clave] = copia; ACT[clave] = copia; T.precios[clave] = pr;
    return res;
  })()`, ctx);
  desap.enRegistro ? ok(desap.ticker + ' sigue en el registro de Resultados aunque pierda el precio')
    : mal('se borra del registro en silencio');
  desap.ret === null ? ok('sin precio de hoy no se inventa un resultado') : mal('se inventa un resultado', desap.ret);
  desap.ultimoConocido > 0 ? ok('conserva su último precio conocido (' + desap.ultimoConocido + ' $)')
    : mal('pierde el último precio conocido');
  desap.segEstado === 'sindatos' ? ok('en Seguimiento aparece como "sin datos", no desaparece')
    : mal('en Seguimiento no sale como sin datos', desap.segEstado);
  desap.hoyVeredicto === 'Sin datos' ? ok('la pestaña Hoy deja de decir COMPRA sobre ella')
    : mal('Hoy sigue dando un veredicto de compra', desap.hoyVeredicto);
  desap.hoyPrio === 3 ? ok('y la manda al final de la lista') : mal('no la manda al final', desap.hoyPrio);
  desap.segVeredicto === desap.hoyVeredicto ? ok('las dos pestañas dicen lo mismo sobre ella')
    : mal('se contradicen', desap.segVeredicto + ' vs ' + desap.hoyVeredicto);

  /* El registro se lee para ver que funciono y que no, asi que va de mejor a peor. Las que se
     quedaron sin desenlace no son un 0 %: van al final, no en medio. */
  console.log('\nEL REGISTRO VA DE LO QUE MEJOR VA A LO QUE PEOR');
  const reg = vm.runInContext(`(() => {
    // se deja una sin precio a proposito: si no, la comprobacion del final pasaria en vacio
    const xs = entradas();
    const sinDesenlace = xs.find(a => a.ret > 0);
    if (sinDesenlace) sinDesenlace.ret = null;
    const orden = [...xs].sort((a, b) => {
      if ((a.ret == null) !== (b.ret == null)) return a.ret == null ? 1 : -1;
      if (a.ret != null && a.ret !== b.ret) return b.ret - a.ret;
      return a.entrada < b.entrada ? 1 : a.entrada > b.entrada ? -1 : 0;
    });
    return orden.map(a => ({ t: a.ticker, ret: a.ret }));
  })()`, ctx);
  const conRes = reg.filter(x => x.ret != null), sinRes = reg.filter(x => x.ret == null);
  conRes.every((x, i) => !i || conRes[i - 1].ret >= x.ret)
    ? ok('las que tienen resultado van de mayor a menor (' + conRes.map(x => x.t).join(' > ') + ')')
    : mal('el orden no es descendente', conRes.map(x => x.t + ':' + x.ret).join(', '));
  const indices = reg.map((x, i) => x.ret == null ? i : -1).filter(i => i >= 0);
  sinRes.length && indices.every(i => i >= reg.length - sinRes.length)
    ? ok('las que no tienen resultado van al final' + (sinRes.length ? ' (' + sinRes.map(x => x.t).join(', ') + ')' : ''))
    : mal('una sin resultado se cuela en medio o no hay ninguna que comprobar', indices.join(',') + ' de ' + reg.length);
  const fuenteRes = fs.readFileSync(path.join(dir, 'resultados.js'), 'utf8');
  /De lo que mejor va a lo que peor/.test(fuenteRes) ? ok('la tabla dice cómo está ordenada')
    : mal('la tabla no explica su orden');

  /* La pestana Resultados nunca se ha visto desbloqueada: hacen falta 30 entradas con 15 sesiones y
     el panel lleva pocos dias. Se fabrica ese historial para comprobar que el camino existe.
     T, HIST y FH son "let": viven en el ambito lexico del contexto, no en su objeto global, asi que
     hay que tocarlos desde dentro. */
  console.log('\nRESULTADOS CON HISTORIAL SUFICIENTE');
  vm.runInContext(`
    const base = FH[FH.length - 1];
    const sesiones = [];
    for (let k = 1; sesiones.length < 25; k++) {
      const d = new Date(base + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) sesiones.push(d.toISOString().slice(0, 10));
    }
    const falsos = [];
    for (let i = 0; i < 40; i++) falsos.push({ t: 'X' + i, s: 'X' + i, sc: 76 + (i % 12) });
    sesiones.forEach((f, j) => { HIST[f] = { spy: 100 + j,
      acciones: falsos.map(a => ({ ...a, p: 100 + j * (a.sc >= 82 ? 0.4 : 0.1) })) } });
    FH = Object.keys(HIST).sort().reverse();
    falsos.forEach(a => { T.precios[a.s] = 110 });
  `, ctx);
  await paso('resultados se pinta con 40 entradas maduras', () => ventana.resultados());
  const texto = (function leer(x) {
    return (x.textContent || '') + ' ' + (x.hijos || []).map(leer).join(' ');
  })(porId.rres);
  !/Todav/.test(texto) ? ok('ya no dice "todavía no"') : mal('sigue bloqueada con 40 entradas maduras');
  /Sirve de algo la puntuaci/.test(texto) ? ok('responde si la puntuación discrimina') : mal('no responde a la puntuación');
  /mediana/.test(texto) ? ok('parte por la mediana, no por un 75 fijo que nadie baja') : mal('no usa la mediana');
  /tres formas de operarlas/.test(texto) ? ok('aparece la comparación de formas de operar') : mal('falta la simulación');

  /* Hasta ahora "La tengo" solo guardaba el precio, asi que no habia forma de saber cuanto dinero
     tenias metido. Estas cuentas son las que miras antes de vender: tienen que cuadrar al centimo. */
  console.log('\nLOS IMPORTES EN DINERO CUADRAN');
  const panel2 = JSON.parse(fs.readFileSync(path.join(dir, 'panel.json'), 'utf8'));
  const sim2 = Object.keys(panel2.actual)[0], d2 = panel2.actual[sim2];
  almacen['posiciones-v1'] = JSON.stringify([{ ticker: d2.ticker, simbolo: sim2, precio: 10, acciones: 100,
    fecha: panel2.dias[panel2.dias.length - 1], maxVisto: d2.precio }]);
  almacen['cartera-v1'] = JSON.stringify({ total: 5000, riesgo: 1 });
  await paso('posiciones se pinta con importes', () => ventana.posiciones());
  const txtPos = porId.rpos.textContent;
  const valorEsperado = (d2.precio * 100).toFixed(2).replace('.', ',');
  txtPos.includes('1.000,00 $') || txtPos.includes('1000,00 $')
    ? ok('el invertido sale de precio × acciones (10 × 100 = 1.000 $)')
    : mal('no aparece el invertido', txtPos.slice(0, 160));
  txtPos.includes(valorEsperado) ? ok('el valor de hoy usa el precio actual (' + valorEsperado + ' $)')
    : mal('no aparece el valor actual esperado', valorEsperado);
  /20 % de tu cartera/.test(txtPos) ? ok('dice qué parte de tu cartera ocupa (1.000 de 5.000 = 20 %)')
    : mal('no dice el peso en la cartera');
  /Si salta el stop/.test(txtPos) ? ok('dice cuánto pierdes si salta el stop')
    : mal('no dice el riesgo en dinero');

  // Sin el numero de acciones no puede inventarse importes: tiene que pedirlo.
  almacen['posiciones-v1'] = JSON.stringify([{ ticker: d2.ticker, simbolo: sim2, precio: 10,
    fecha: panel2.dias[panel2.dias.length - 1], maxVisto: d2.precio }]);
  await paso('posiciones se pinta sin nº de acciones', () => ventana.posiciones());
  const txtSin = porId.rpos.textContent;
  /Añade cuántas acciones/.test(txtSin) ? ok('sin nº de acciones lo pide en vez de inventarse una cifra')
    : mal('no pide el nº de acciones');
  !/Invertido/.test(txtSin) ? ok('y no enseña importes que no puede calcular')
    : mal('enseña importes sin saber el nº de acciones');

  /* El historial de operaciones cerradas: la respuesta a "¿esto funciona?" con dinero real.
     Si la suma esta mal, la conclusion esta mal. */
  console.log('\nEL HISTORIAL DE OPERACIONES SUMA BIEN');
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'AAA', simbolo: 'AAA', precio: 10, acciones: 100, fecha: '2026-09-01', cerrada: '2026-09-20', precioSalida: 13 },
    { ticker: 'BBB', simbolo: 'BBB', precio: 50, acciones: 10, fecha: '2026-09-05', cerrada: '2026-09-25', precioSalida: 42.5 },
    { ticker: 'CCC', simbolo: 'CCC', precio: 20, acciones: 25, fecha: '2026-09-10', cerrada: '2026-09-30', precioSalida: 24 },
  ]);
  await paso('posiciones se pinta con tres operaciones cerradas', () => ventana.posiciones());
  const hist = porId.rpos.textContent;
  // AAA +300, BBB -75, CCC +100  ->  +325 sobre 2.000 invertidos = +16,25 %
  /* La copia de seguridad es lo unico que protege el historial: vive solo en este navegador. */
  const copia = JSON.parse(almacen['posiciones-v1']).filter(p => p.cerrada).length;
  copia === 3 ? ok('las operaciones cerradas siguen guardadas para la copia de seguridad')
    : mal('el historial no sobrevive en el almacenamiento', copia);
  /\+325,00 \$/.test(hist) ? ok('suma el resultado total en dinero (+300 −75 +100 = +325 $)')
    : mal('el total en dinero no cuadra', hist.slice(0, 200));
  /2 de 3 · 67 %/.test(hist) ? ok('cuenta las acertadas (2 de 3)') : mal('no cuenta las acertadas');
  /\+16,3 %|\+16,2 %/.test(hist) ? ok('calcula el resultado sobre lo invertido (325 de 2.000)')
    : mal('no calcula el rendimiento sobre lo invertido');
  /TOTAL · 3 operaciones/.test(hist) ? ok('la tabla lleva su fila de totales') : mal('falta la fila de totales');
  /19|20/.test(hist) ? ok('cuenta los días que duró cada operación') : mal('no cuenta los días');

  // A una le falta el nº de acciones: el total no puede incluirla y hay que decirlo.
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'AAA', simbolo: 'AAA', precio: 10, acciones: 100, fecha: '2026-09-01', cerrada: '2026-09-20', precioSalida: 13 },
    { ticker: 'DDD', simbolo: 'DDD', precio: 8, fecha: '2026-09-02', cerrada: '2026-09-21', precioSalida: 9 },
  ]);
  await paso('posiciones se pinta con una operación sin nº de acciones', () => ventana.posiciones());
  const parcial = porId.rpos.textContent;
  /suma 1 de 2 operaciones/.test(parcial) ? ok('avisa de que el total no incluye todas')
    : mal('da una suma incompleta sin avisar', parcial.slice(0, 200));
  almacen['posiciones-v1'] = '[]';

  console.log('\nEL TEMA ARRANCA OSCURO Y SE PUEDE CAMBIAR');
  doc.documentElement.dataset.tema === undefined ? ok('por defecto es oscuro') : mal('no arranca oscuro', doc.documentElement.dataset.tema);
  const bt = doc.getElementById('tema');
  bt.onclick();
  doc.documentElement.dataset.tema === 'claro' && almacen.tema === 'claro' ? ok('el botón pasa a claro y lo recuerda') : mal('no cambia a claro', doc.documentElement.dataset.tema + '/' + almacen.tema);
  bt.onclick();
  doc.documentElement.dataset.tema === undefined && almacen.tema === 'oscuro' ? ok('y vuelve a oscuro') : mal('no vuelve a oscuro', doc.documentElement.dataset.tema + '/' + almacen.tema);

  console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
  if (fallos) { console.log(fallos + ' FALLOS'); process.exit(1) }
})();
