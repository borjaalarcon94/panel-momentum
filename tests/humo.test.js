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
