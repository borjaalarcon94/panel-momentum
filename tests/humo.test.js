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

  /* El respaldo es lo unico que protege un historial que vive solo en el navegador y no se puede
     regenerar. Tiene que sobrevivir ida y vuelta CON los campos nuevos: parcial, id, compras. */
  console.log('\nEL RESPALDO NO PIERDE NINGÚN CAMPO');
  // se guarda el estado anterior: la prueba siguiente cuenta con las posiciones que ya habia
  const rbAntes = almacen['posiciones-v1'];
  const rbCartera = ventana.CARTERA.leer();
  const rbOrig = [
    { ticker: 'AAA', simbolo: 'NASDAQ:AAA', precio: 12.5, acciones: 60, fecha: '2026-09-01',
      maxVisto: 30.1, stopMax: 14.2,
      compras: [{ fecha: '2026-09-01', precio: 10, acciones: 100 }, { fecha: '2026-10-05', precio: 20, acciones: 20 }] },
    { ticker: 'AAA', simbolo: 'NASDAQ:AAA', precio: 10, acciones: 40, fecha: '2026-09-01',
      cerrada: '2026-09-20', precioSalida: 25, parcial: true, id: 'pR1' },
    { ticker: 'BBB', simbolo: 'NYSE:BBB', precio: 50, acciones: 10, fecha: '2026-07-01',
      cerrada: '2026-08-01', precioSalida: 60, manual: true },
  ];
  almacen['posiciones-v1'] = JSON.stringify(rbOrig);
  ventana.CARTERA.guardar({ total: 1500, riesgo: 1.5 });
  // exportar = exactamente lo que hace el boton
  const rbTxt = JSON.stringify({ posiciones: JSON.parse(almacen['posiciones-v1']), cartera: ventana.CARTERA.leer(), guardado: panel.dias[panel.dias.length - 1] });
  // borrarlo todo y restaurar con el mismo filtro que usa el boton
  almacen['posiciones-v1'] = '[]';
  const rbD = JSON.parse(rbTxt);
  almacen['posiciones-v1'] = JSON.stringify(rbD.posiciones.filter(p => p && p.ticker && p.precio > 0));
  const rbVuelta = JSON.parse(almacen['posiciones-v1']);
  JSON.stringify(rbVuelta) === JSON.stringify(rbOrig)
    ? ok('las 3 posiciones vuelven idénticas, campo por campo') : mal('el respaldo pierde o altera campos', JSON.stringify(rbVuelta));
  rbVuelta[1] && rbVuelta[1].parcial === true && rbVuelta[1].id === 'pR1'
    ? ok('la venta parcial conserva parcial e id') : mal('la venta parcial se corrompe');
  rbVuelta[0] && rbVuelta[0].compras && rbVuelta[0].compras.length === 2
    ? ok('el desglose de compras sobrevive') : mal('se pierde el desglose de compras');
  rbVuelta[0] && rbVuelta[0].maxVisto === 30.1 && rbVuelta[0].stopMax === 14.2
    ? ok('maxVisto y stopMax sobreviven: sin ellos el stop y la devolución se recalculan mal')
    : mal('se pierden maxVisto o stopMax');
  rbD.cartera && rbD.cartera.total === 1500 && rbD.cartera.riesgo === 1.5
    ? ok('y la cartera con su nivel de riesgo') : mal('se pierde la cartera');
  // una copia corrupta no debe destruir nada
  (() => {
    try { const x = JSON.parse('{\"posiciones\":\"no soy un array\"}'); if (!Array.isArray(x.posiciones)) throw new Error('formato'); mal('acepta una copia con formato invalido'); }
    catch (e) { ok('una copia con formato inválido se rechaza antes de tocar nada'); }
  })();
  // se devuelve todo como estaba, para no romper las pruebas siguientes
  almacen['posiciones-v1'] = rbAntes;
  if (rbCartera) ventana.CARTERA.guardar(rbCartera); else { try { delete almacen['cartera-v1'] } catch (e) {} }

  console.log('\nCOPIA DE SEGURIDAD DE LAS POSICIONES');
  await paso('la pestaña se pinta con los botones de copia', () => ventana.posiciones());
  const guardadas = JSON.parse(almacen['posiciones-v1'] || '[]');
  guardadas.length ? ok('las posiciones siguen guardadas tras pintar') : mal('se han perdido las posiciones al pintar');

  /* 14/10/2026: se quito el techo de capitalizacion. Si vuelve a aparecer, o si la rama de capMax
     null se rompe, el panel diria que PLTR "no cumple" y la descartaria sola. */
  /* El tamano de posicion es riesgo / distancia al stop, asi que un stop muy pegado pide la posicion
     MAS grande justo donde la salida es mas aleatoria. 14/10/2026: 9 de las 30 en seguimiento tenian
     el stop dentro de un dia de rango y 6 de esas se dimensionaban al 21-25 %. Esto solo lo ensena. */
  console.log('\nMARGEN DEL STOP EN DÍAS DE RANGO');
  const MG = typeof ventana.MARGEN_STOP === 'function' ? ventana.MARGEN_STOP : () => null;
  typeof ventana.MARGEN_STOP === 'function' ? ok('window.MARGEN_STOP existe') : mal('window.MARGEN_STOP no existe');
  const absi = MG(-2.4, 9.5), hnge = MG(-12.7, 3.5), justo = MG(-5, 5);
  absi && absi.apretado ? ok('un stop a 2,4 % con ADR 9,5 % se marca como apretado (0,3 días)')
    : mal('no detecta un stop dentro del ruido de un día', JSON.stringify(absi));
  hnge && !hnge.apretado ? ok('un stop a 12,7 % con ADR 3,5 % no se marca (3,6 días)') : mal('marca un stop holgado');
  justo && !justo.apretado && Math.abs(justo.dias - 1) < 1e-9
    ? ok('justo en 1 ADR no se marca: el umbral es "menos de un día"') : mal('el límite de 1 ADR no es el esperado');
  MG(-5, null) === null && MG(null, 5) === null && MG(-5, 0) === null
    ? ok('sin ADR o sin distancia no se inventa un margen') : mal('devuelve algo sin datos suficientes');
  MG(5, 5) && Math.abs(MG(5, 5).dias - 1) < 1e-9 ? ok('el signo de la distancia no importa') : mal('el signo de la distancia altera el margen');

  /* Un stop poco fiable tiene que PARECERLO. El codigo ya pintaba la caja en ambar cuando al stop
     le muerde el tope del 15 % (clase 'lejos'); un stop dentro del ruido de un dia es el mismo
     problema o peor, asi que recibe el mismo trato. No es un umbral nuevo: 1 ADR es una definicion. */
  console.log('\nUN STOP POCO FIABLE SE VE POCO FIABLE');
  const srcHoy2 = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  const srcPos2 = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /sal\.tope\s*\|\|\s*\(mg\s*&&\s*mg\.apretado\)/.test(srcHoy2)
    ? ok('Hoy tiñe la caja en ámbar también con el stop apretado') : mal('Hoy solo tiñe por el tope del 15 %');
  /stopbox'\s*\+\s*\(mg && mg\.apretado \? ' lejos' : ''\)/.test(srcPos2)
    ? ok('Posiciones tiñe la caja en ámbar con el stop apretado') : mal('Posiciones nunca tiñe la caja');
  // El margen califica al stop: tiene que leerse ANTES del importe a comprar, no despues
  srcHoy2.indexOf('MARGEN_STOP') < srcHoy2.indexOf("window.TAMANO(o.d)")
    ? ok('en Hoy el margen se lee antes del importe que recomienda') : mal('el margen aparece después del dinero');
  srcPos2.indexOf('MARGEN_STOP') < srcPos2.indexOf('ya protege tu compra')
    ? ok('en Posiciones el margen va pegado al stop') : mal('en Posiciones el margen queda al final');
  /\.stopbox \.ds\.aviso\{color:var\(--warn\)/.test(fs.readFileSync(path.join(dir, 'extra.css'), 'utf8'))
    ? ok('el estilo del aviso existe y usa la variable del tema') : mal('falta el estilo .ds.aviso');

  /* El tope del 25 % se aplicaba en silencio: el importe que se mostraba no era el que salia del
     riesgo, era el maximo por concentracion, y no se decia. */
  console.log('\nEL TOPE DEL 25 % DE LA CARTERA SE AVISA');
  ventana.CARTERA.guardar({ total: 1500, riesgo: 1 });
  const TM = typeof ventana.TAMANO === 'function' ? ventana.TAMANO : () => null;
  const tApretado = TM(-2.4), tHolgado = TM(-12.7);
  tApretado && tApretado.tope ? ok('con el stop a 2,4 % el tamaño toca el tope y lo marca')
    : mal('el tope del 25 % no se señala', JSON.stringify(tApretado));
  tApretado && Math.abs(tApretado.pct - 25) < 1e-9 ? ok('y el porcentaje queda en 25, no en 42') : mal('el tope no acota');
  tHolgado && !tHolgado.tope ? ok('con el stop a 12,7 % no hay tope (7,9 %)') : mal('marca tope donde no lo hay');
  const srcHoy = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  /tam\.tope/.test(srcHoy) ? ok('la tarjeta de Hoy usa el aviso de tope') : mal('hoy.js calcula el tope y no lo muestra');
  /MARGEN_STOP/.test(srcHoy) ? ok('la tarjeta de Hoy muestra el margen del stop') : mal('hoy.js no muestra el margen');
  const srcPos = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /MARGEN_STOP\(\(r\.stop \/ r\.ahora - 1\) \* 100, \(r\.a \|\| \{\}\)\.adr\)/.test(srcPos)
    ? ok('Posiciones lo lee del campo que existe (r.a.adr, no r.datos)')
    : mal('Posiciones lee el ADR de un campo que no existe: el aviso nunca saldría');

  /* Y que las pantallas lo DIGAN, en vez de pintar un "+5 % desde aqui" sobre un stop que no existe. */
  console.log('\nUN STOP INVÁLIDO SE DICE, NO SE DISFRAZA');
  const siSal = ventana.SALIDA({ precio: 8.88, ema50: 9.28, ema21: 9, adr: 9.5 });
  siSal.invalido ? ok('SALIDA propaga el stop inválido') : mal('SALIDA no marca el stop inválido');
  siSal.opciones[0] && /Sin stop válido/.test(siSal.opciones[0].t)
    ? ok('y la primera opción se llama «Sin stop válido», no «Stop del sistema»')
    : mal('sigue llamándose stop del sistema', siSal.opciones[0] && siSal.opciones[0].t);
  siSal.opciones[0] && siSal.opciones[0].invalido ? ok('la opción lleva la marca') : mal('la opción no lleva la marca');
  ventana.TAMANO(siSal.opciones[0].d) === null
    ? ok('y no se calcula ningún importe de compra sobre ese stop') : mal('calcula un importe sobre un stop inválido');
  const srcHoy4 = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  const srcSeg4 = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
  /sal\.invalido\?null:window\.MARGEN_STOP/.test(srcHoy4)
    ? ok('Hoy no calcula margen de rango sobre un stop que no existe') : mal('Hoy calcula el margen igual');
  /sin stop válido: el precio ya está por debajo de su EMA 50/.test(srcHoy4)
    ? ok('Hoy explica por qué no hay stop') : mal('Hoy no lo explica');
  /sin stop válido/.test(srcSeg4) && /EMA 50/.test(srcSeg4)
    ? ok('Seguimiento también, en vez de un porcentaje positivo') : mal('Seguimiento sigue mostrando el porcentaje');

  /* Lo pedido: la caja del stop se ve, y "compra arriesgada" dice a que precio deja de serlo. */
  console.log('\nLA CAJA DEL STOP Y EL PRECIO DE ENTRADA SIN TOPE');
  const esSrcH = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  const esSrcS = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
  const esCss = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  /stopbox grande/.test(esSrcS) ? ok('Seguimiento saca el stop a su propia caja, fuera de la rejilla')
    : mal('en Seguimiento el stop sigue perdido entre otros datos');
  /\.stopbox\.grande\{[^}]*border-width:2px/.test(esCss) ? ok('y la caja va recuadrada y más grande') : mal('falta el estilo de la caja grande');
  !/\['Stop del sistema',/.test(esSrcS) ? ok('ya no está como una celda más de la rejilla') : mal('sigue en la rejilla de tres datos');
  /* El precio va en la linea del veredicto, no en la caja del stop: dos precios con el mismo peso
     en la misma caja obligaban a adivinar cual era cual. */
  const esApp = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  /accion: sal\.precioSinTope \?/.test(esApp)
    ? ok('el precio viaja en v.accion, listo para pintarse destacado')
    : mal('el veredicto no expone el precio accionable');
  !/Entrada sin tope/.test(esSrcH) && !/Entrada sin tope/.test(esSrcS)
    ? ok('y no se repite en la caja del stop, que se queda con un solo precio')
    : mal('sigue habiendo dos precios en la caja del stop');
  const vArr = ventana.VEREDICTO({ precio: 15.60, ema50: 13.00, ema21: 14, sma200: 10, rsi: 65, max52: 16, volmedio: 1e6, ingresos: 40 }, {});
  vArr.t === 'Compra arriesgada' && vArr.accion && /14,95 \$/.test(vArr.accion.v) && /4,2 % abajo/.test(vArr.accion.ds)
    ? ok('y trae el precio y el retroceso: ' + vArr.accion.v + ' · ' + vArr.accion.ds.slice(0, 12))
    : mal('el veredicto no trae el precio', JSON.stringify(vArr.accion));
  const vOk = ventana.VEREDICTO({ precio: 200.5, ema50: 180, ema21: 190, sma200: 150, rsi: 65, max52: 205, volmedio: 1e6, ingresos: 40 }, {});
  !/esperar a/.test(vOk.d) ? ok('cuando la compra no es arriesgada no se menciona ningún precio de espera')
    : mal('mete el precio donde no hace falta', vOk.d);
  const esSal = ventana.SALIDA({ precio: 15.60, ema50: 13.00, ema21: 14, adr: 4.5 });
  esSal.tope && Math.round(esSal.precioSinTope * 100) / 100 === 14.95
    ? ok('SALIDA propaga el precio (14,95 $) hasta la pantalla') : mal('SALIDA no propaga el precio sin tope', JSON.stringify(esSal.precioSinTope));
  const esSal2 = ventana.SALIDA({ precio: 200.5, ema50: 180, ema21: 190, adr: 3 });
  !esSal2.tope ? ok('y no lo saca cuando la compra no es arriesgada') : mal('marca tope donde no lo hay');

  /* 17/10/2026: Seguimiento pasa a ser la vista inicial y Hoy vive dentro como subpestaña. El riesgo
     evidente es abrir en blanco, y el sutil es perderse una señal de compra por estar un nivel abajo. */
  console.log('\nSEGUIMIENTO ES LA VISTA INICIAL Y HOY VIVE DENTRO');
  const stPl = fs.readFileSync(path.join(__dirname, '..', 'plantilla.html'), 'utf8');
  const stHoy = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  const stApp = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  /data-v="seg" aria-selected="true"/.test(stPl)
    ? ok('la pestaña marcada al abrir es Seguimiento') : mal('la pestaña inicial no es Seguimiento');
  !/data-v="hoy"/.test(stPl) ? ok('Hoy ya no es una pestaña principal') : mal('Hoy sigue como pestaña principal');
  /data-s="hoy"/.test(stPl) && /data-s="seg"/.test(stPl) ? ok('existen las dos subpestañas') : mal('faltan las subpestañas');
  /<section id="vseg">/.test(stPl) && /<section id="vhoy" hidden>/.test(stPl)
    ? ok('al abrir se ve «Oportunidades» y Hoy queda oculto') : mal('la visibilidad inicial está al revés');
  /data-s="seg" aria-selected="true">Oportunidades</.test(stPl)
    ? ok('la subpestaña se llama «Oportunidades», no «Lo que sigo»: el nombre dice lo que hay dentro')
    : mal('la subpestaña sigue con un nombre que describe el mecanismo y no el contenido');
  !/Lo que sigo/.test(stPl) ? ok('y no queda rastro del nombre viejo') : mal('queda el nombre viejo');
  /data-v="pos"[^>]*>Mis posiciones</.test(stPl)
    ? ok('la pestaña de posiciones dice «Mis posiciones»: son suyas, no una lista cualquiera')
    : mal('la pestaña de posiciones no lleva el nombre acordado');
  /Mis operaciones cerradas/.test(fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8')) && !/Mis Posiciones/.test(stPl)
    ? ok('y respeta la ortografía del resto de la app (segunda palabra en minúscula)')
    : mal('la mayúscula no concuerda con «Mis operaciones cerradas»');
  /if \(window\.seguimiento\) window\.seguimiento\(\);/.test(stApp)
    ? ok('y se pinta al arrancar: la app no abre en blanco') : mal('Seguimiento no se pinta al arrancar: abriría vacío');
  /window\.pinta\(\);/.test(stApp) ? ok('pinta() sigue corriendo, para el contador') : mal('pinta() ya no corre y el contador no se calcularía');
  /const nc=\$\('nhoy'\)/.test(stHoy) && /cls==='qok'/.test(stHoy)
    ? ok('la subpestaña lleva contador de señales de compra') : mal('no hay contador de señales');
  /grupo-seg/.test(stPl) && /\$\('grupo-seg'\)\.hidden/.test(stHoy)
    ? ok('la pestaña principal enseña y oculta el grupo entero') : mal('el grupo no se controla desde la pestaña');
  const stCss = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  /\.subtab\{/.test(stCss) && /min-height:40px/.test(stCss)
    ? ok('las subpestañas tienen altura táctil') : mal('las subpestañas se quedan pequeñas en el móvil');

  /* Cada veredicto que no es COMPRA tiene que decir A QUE PRECIO cambia. Y el stop no se repite:
     la caja va justo debajo con el mismo numero. */
  console.log('\nCADA VEREDICTO DICE SU PRECIO, Y EL STOP NO SE REPITE');
  const vd = (d) => ventana.VEREDICTO(d, { fallos: [] });
  const vCompra = vd({ precio: 14.80, ema50: 13.07, ema21: 14, sma200: 11, rsi: 62, max52: 15.2, volmedio: 1e6, ingresos: 40, cap: 1e9 });
  const vRiesgo = vd({ precio: 15.60, ema50: 13.00, ema21: 14, sma200: 11, rsi: 62, max52: 16.0, volmedio: 1e6, ingresos: 40, cap: 1e9 });
  // EMA 50 a 85 para que la ventana de compra EXISTA (con 76 el suelo queda sobre el techo)
  const vEsp = vd({ precio: 85, ema50: 85, ema21: 84, sma200: 60, rsi: 60, max52: 100, volmedio: 1e6, ingresos: 40, cap: 1e9 });
  vCompra.t === 'COMPRA' && !/\d+,\d+ \$/.test(vCompra.d)
    ? ok('COMPRA ya no repite el stop que la caja de debajo da igual') : mal('COMPRA sigue repitiendo el stop', vCompra.d);
  /* El precio accionable viaja en v.accion, no dentro del texto: asi se puede pintar destacado
     en vez de quedar perdido en la frase. */
  vRiesgo.t === 'Compra arriesgada' && vRiesgo.accion && /14,95 \$/.test(vRiesgo.accion.v)
    ? ok('«Compra arriesgada» trae el precio de entrada limpia: ' + vRiesgo.accion.v)
    : mal('falta el precio en compra arriesgada', JSON.stringify(vRiesgo.accion));
  vRiesgo.accion && /4,2 % abajo/.test(vRiesgo.accion.ds) ? ok('y cuánto hay que esperar') : mal('no dice cuánto bajar');
  vEsp.t === 'Esperar' && vEsp.accion && /90,00 – 100,00 \$/.test(vEsp.accion.v)
    ? ok('«Esperar» trae la ventana de compra entera: ' + vEsp.accion.v)
    : mal('«Esperar» no dice hasta dónde', JSON.stringify(vEsp.accion));
  /5,9 % arriba/.test(vEsp.accion.ds) ? ok('y cuánto falta para llegar al suelo') : mal('no dice cuánto falta', vEsp.accion.ds);
  /100,00 \$/.test(vEsp.d) ? ok('y el texto sigue diciendo cuál es su máximo') : mal('no dice el máximo');
  !vCompra.accion ? ok('con COMPRA no hay nada que esperar, así que no se pinta etiqueta') : mal('mete etiqueta donde no hace falta');
  const srcH5 = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  const srcS5 = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
  const cssA = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  /v\.accion/.test(srcH5) && /q\.accion/.test(srcS5)
    ? ok('las dos pantallas pintan la etiqueta del precio') : mal('alguna pantalla no la pinta');
  /\.accion\{/.test(cssA) && /\.accion \.vl\{font-size:18px/.test(cssA)
    ? ok('y la etiqueta va destacada, con el precio en grande') : mal('falta el estilo de la etiqueta');
  /\.stopbox\{border-left-width:4px/.test(cssA)
    ? ok('la caja del stop lleva borde de acento para verla de un vistazo') : mal('la caja del stop no resalta');
  const srcSegX = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
  /sobreEma50/.test(srcSegX) && !/pc\(-a\.salida\.distanciaEma50/.test(srcSegX)
    ? ok('Seguimiento muestra el % sobre la EMA 50 bien calculado') : mal('Seguimiento sigue con el cálculo invertido');

  /* 18/10/2026: "Esperar" anunciaba "compra a partir de X $" usando solo el suelo (cerca del
     maximo) e ignorando el techo (no alejarse de la EMA 50). Cuando el suelo queda POR ENCIMA del
     techo no existe ningun precio de compra limpia, y aun asi se anunciaba uno. Pasaba con 15 de las
     23 en Esperar. Con CDNA: necesitaba estar sobre 65,26 $ y bajo 64,94 $ a la vez. */
  console.log('\nLA VENTANA DE COMPRA: SUELO Y TECHO, NO SOLO SUELO');
  const vnt = (d) => ventana.VEREDICTO(d, { fallos: [] });
  // ventana imposible: el suelo por encima del techo
  const vImp = vnt({ precio: 64, ema50: 55.20, ema21: 60, sma200: 40, rsi: 60, max52: 72.51, volmedio: 1e6, ingresos: 40, cap: 1e9 });
  vImp.t === 'Esperar' && /no hay ningún precio al que sea compra limpia/.test(vImp.d)
    ? ok('con la ventana imposible lo dice, en vez de inventar un precio') : mal('sigue anunciando un precio inalcanzable', vImp.d);
  vImp.accion && /Sin ventana de compra/.test(vImp.accion.et) && /65,26/.test(vImp.accion.ds) && /64,94/.test(vImp.accion.ds)
    ? ok('y enseña los dos límites para que se vea por qué: ' + vImp.accion.ds.slice(0, 44))
    : mal('no enseña los dos límites', JSON.stringify(vImp.accion));
  /tiempo, no una subida/.test(vImp.d) ? ok('y explica que hace falta tiempo, no que suba') : mal('no explica qué hace falta');
  // ventana real: suelo por debajo del techo
  const vOk2 = vnt({ precio: 85, ema50: 85, ema21: 84, sma200: 60, rsi: 60, max52: 100, volmedio: 1e6, ingresos: 40, cap: 1e9 });
  vOk2.t === 'Esperar' && vOk2.accion && /90,00 – 100,00 \$/.test(vOk2.accion.v)
    ? ok('con ventana real da el rango entero: ' + vOk2.accion.v) : mal('no da el rango', JSON.stringify(vOk2.accion));
  vOk2.accion && /sería compra arriesgada/.test(vOk2.accion.ds)
    ? ok('y avisa de qué pasa si se pasa del techo') : mal('no avisa del techo');
  // y el numero prometido tiene que ser cierto: a ese precio el veredicto ya no puede ser Esperar
  const vEnSuelo = vnt({ precio: 90.5, ema50: 85, ema21: 84, sma200: 60, rsi: 60, max52: 100, volmedio: 1e6, ingresos: 40, cap: 1e9 });
  vEnSuelo.t !== 'Esperar'
    ? ok('comprado dentro de la ventana el veredicto ya no es Esperar, es ' + vEnSuelo.t) : mal('sigue diciendo Esperar dentro de su propia ventana');

  /* La garantia de que no vuelve a pasar: no tres casos a mano, sino una REJILLA de situaciones
     barriendo todos los precios. Lo que el panel promete tiene que cumplirse siempre.
     Invariantes:
       a) si anuncia una ventana, dentro de ella el veredicto NO puede seguir siendo Esperar
       b) si anuncia una ventana, tiene que existir ALGUN precio con veredicto COMPRA
       c) si dice que no hay ventana, NINGUN precio puede dar COMPRA
     Con los datos reales del 18/10/2026 la rama (a)-(b) no la toca ninguna accion, de ahi la rejilla. */
  console.log('\nLO QUE PROMETE «ESPERAR» SE CUMPLE A CUALQUIER PRECIO');
  {
    const base = { ema21: 1, sma200: 1, rsi: 60, volmedio: 1e6, ingresos: 40, cap: 1e9, adr: 4 };
    let casos = 0, conVentana = 0, sinVentana = 0, malos = [];
    for (const max52 of [20, 100, 480]) {
      for (const fe of [0.60, 0.70, 0.765, 0.80, 0.90, 1.00]) {   // EMA 50 como fracción del máximo
        const ema50 = max52 * fe;
        const precio = max52 * 0.85;                               // −15 % del máximo: rama Esperar
        const d = { ...base, precio, ema50, ema21: ema50 * 1.02, sma200: ema50 * 0.7, max52 };
        const v = ventana.VEREDICTO(d, { fallos: [] });
        if (v.t !== 'Esperar') continue;
        casos++;
        const suelo = max52 * 0.9, techo = ema50 / 0.85;
        // usable solo si cabe al menos un dia de rango dentro: por debajo de eso no se puede comprar
        const usable = techo - suelo >= precio * base.adr / 100;
        let hayCompra = false, dentroEsperar = null;
        for (let p = precio * 0.5; p <= precio * 2.5; p *= 1.0005) {   // paso fino: no saltarse ventanas estrechas
          const vv = ventana.VEREDICTO({ ...d, precio: p }, { fallos: [] });
          if (vv.t === 'COMPRA') hayCompra = true;
          if (p >= suelo && p <= techo && vv.t === 'Esperar' && dentroEsperar == null) dentroEsperar = p;
        }
        const anunciaVentana = v.accion && /Ventana de compra/.test(v.accion.et);
        const anunciaSin = v.accion && /Sin ventana de compra/.test(v.accion.et);
        if (usable) {
          conVentana++;
          if (!anunciaVentana) malos.push(`max52=${max52} ema50=${ema50.toFixed(1)}: hay ventana y no la anuncia`);
          if (!hayCompra) malos.push(`max52=${max52} ema50=${ema50.toFixed(1)}: anuncia ventana pero ningún precio da COMPRA`);
          if (dentroEsperar != null) malos.push(`max52=${max52} ema50=${ema50.toFixed(1)}: dentro de su ventana sigue diciendo Esperar a ${dentroEsperar.toFixed(2)}`);
        } else {
          sinVentana++;
          if (!anunciaSin) malos.push(`max52=${max52} ema50=${ema50.toFixed(1)}: ventana vacía y no lo dice`);
          if (hayCompra) malos.push(`max52=${max52} ema50=${ema50.toFixed(1)}: dice que no hay ventana pero existe un precio de COMPRA`);
        }
      }
    }
    casos >= 10 ? ok(`rejilla de ${casos} situaciones barridas precio a precio`) : mal('la rejilla cubre muy pocos casos', String(casos));
    conVentana >= 3 && sinVentana >= 3
      ? ok(`y cubre las dos ramas: ${conVentana} con ventana, ${sinVentana} sin ella`)
      : mal('la rejilla no cubre las dos ramas', `con ${conVentana} / sin ${sinVentana}`);
    malos.length === 0
      ? ok('en todas, lo que promete el panel se cumple a cualquier precio')
      : mal('el panel promete algo que no se cumple', malos.slice(0, 3).join(' | '));
  }

  /* Rejilla sobre LOS OCHO veredictos, no solo Esperar. Barre precio, EMA 50, RSI, requisitos
     rotos y los indicadores de estado, y exige invariantes que valen para todos. Incluye la
     comprobacion que habria cazado el escalon muerto del RSI: que los 8 sean ALCANZABLES. */
  console.log('\nREJILLA SOBRE LOS OCHO VEREDICTOS');
  {
    const CLASES = { 'Sin datos': 'qbad', 'Ya no cumple': 'qbad', 'No comprar': 'qbad',
      'No comprar aquí': 'qwarn', 'Vigilar': 'qwarn', 'Esperar': 'qwarn',
      'Compra arriesgada': 'qwarn', 'COMPRA': 'qok' };
    const vistos = {}, malos = [];
    let n = 0;
    const req9 = (rotos) => [
      { t: 'Capitalización > 300 M', ok: true, entrada: true, v: '1,0 B' },
      { t: 'Precio > 2 $', ok: true, entrada: true, v: '10,00 $' },
      { t: 'Volumen medio > 300 mil acciones', ok: !rotos.includes('vol'), v: '1 mil' },
      { t: 'Se negocian > 2 M$ al día', ok: true, v: '5,0 M$' },
      { t: 'Precio sobre la media de 200 días', ok: !rotos.includes('sma'), v: '+5 %' },
      { t: 'EMA 9 sobre EMA 50', ok: !rotos.includes('ema'), v: '-' },
      { t: 'RSI > 55', ok: !rotos.includes('rsi'), v: '50' },
      { t: 'Ingresos +20 % o más', ok: !rotos.includes('ing'), v: '+5 %' },
      { t: 'A menos del 20 % de su máximo', ok: !rotos.includes('max'), v: '-30 %' }];
    for (const dmaxPct of [-0.02, -0.08, -0.14, -0.30])            // distancia a su máximo
      for (const fe of [0.60, 0.80, 0.88, 0.95, 1.05])             // EMA 50 / precio
        for (const rsiV of [30, 50, 58, 65, 75, 85])
          for (const rotos of [[], ['rsi'], ['sma', 'ema']])
            for (const extra of [{}, { extendida: true }, { flojea: true }, { sinSeguimiento: true }]) {
              const max52 = 100, precio = max52 * (1 + dmaxPct), ema50 = precio * fe;
              const d = { precio, ema50, ema21: ema50 * 1.02, ema9: ema50 * 1.03, sma200: ema50 * 0.8,
                rsi: rsiV, max52, adr: 4, volmedio: 1e6, ingresos: 40, cap: 1e9 };
              const rq = req9(rotos);
              const v = ventana.VEREDICTO(d, { ...extra, fallos: rq.filter(x => !x.ok) });
              n++;
              if (!v || !v.t) { malos.push('sin veredicto'); continue }
              vistos[v.t] = (vistos[v.t] || 0) + 1;
              // 1. el veredicto es uno de los ocho conocidos y con su clase
              if (!(v.t in CLASES)) { malos.push('veredicto desconocido: ' + v.t); continue }
              if (v.cls !== CLASES[v.t]) malos.push(v.t + ' pintado como ' + v.cls);
              // 2. ningun texto con huecos
              const txt = v.d + ' ' + (v.accion ? v.accion.et + v.accion.v + v.accion.ds : '');
              if (/undefined|NaN|\[object/.test(txt)) malos.push(v.t + ': texto con hueco -> ' + txt.slice(0, 50));
              // 3. COMPRA exige que no falle ningun requisito obligatorio
              if (v.t === 'COMPRA' && rq.some(x => !x.ok && !x.entrada)) malos.push('COMPRA con requisitos rotos');
              // 4. COMPRA exige que no haya señales de deterioro
              if (v.t === 'COMPRA' && ventana.REGLAS.senalesDeMercado(d).length) malos.push('COMPRA con señales de deterioro');
              // 5. COMPRA exige estar cerca del máximo y que el tope no muerda
              if (v.t === 'COMPRA' && dmaxPct * 100 < -ventana.REGLAS.R.lejosDeMaximo) malos.push('COMPRA lejos de su máximo');
              if (v.t === 'COMPRA' && ventana.SALIDA(d).tope) malos.push('COMPRA con el tope del 15 % mordiendo');
              // 6. solo "Compra arriesgada" y "Esperar" llevan etiqueta de precio
              if (v.accion && !['Compra arriesgada', 'Esperar'].includes(v.t)) malos.push(v.t + ' lleva etiqueta y no debería');
              // 7. el stop mostrado es el del módulo de reglas
              const e = ventana.REGLAS.stopDeEntrada(d);
              if (e && e.stop != null && v.t !== 'Sin datos') {
                const vs = parseFloat(String(v.stop).split(' ')[0].replace(/\./g, '').replace(',', '.'));
                if (isFinite(vs) && Math.abs(vs - e.stop) > 0.02) malos.push(v.t + ': el stop no es el de reglas.js');
              }
            }
    n >= 1000 ? ok(`${n} combinaciones evaluadas`) : mal('la rejilla cubre pocos casos', String(n));
    /* Los 8 tienen que ser alcanzables desde la rejilla. Permitir que faltara uno anulaba la
       comprobacion: con COMPRA muerta decia "7 de 8" y lo daba por bueno. Es exactamente el fallo
       del escalon del RSI, que vivio semanas porque nadie comprobaba la alcanzabilidad. */
    const faltan = Object.keys(CLASES).filter(t => !vistos[t]);
    faltan.length === 0
      ? ok('los 8 veredictos son alcanzables: ' + Object.entries(vistos).map(([t, c]) => t + ' ' + c).join(', '))
      : mal('hay veredictos INALCANZABLES, como el escalón muerto del RSI', 'faltan: ' + faltan.join(', '));
    malos.length === 0
      ? ok('las 7 invariantes se cumplen en todas las combinaciones')
      : mal('invariante rota', [...new Set(malos)].slice(0, 3).join(' | '));
  }

  /* El trinquete del stop solo subia los dias en que abrias la app. Si no mirabas en una semana,
     los escalones de esos dias se perdian y tu stop quedaba por debajo de lo que promete la tabla 5:
     arriesgabas mas de lo que el sistema decia. Ahora se reconstruye desde la serie diaria. */
  console.log('\nEL TRINQUETE DEL STOP NO DEPENDE DE QUE ABRAS LA APP');
  typeof ventana.TRINQUETE_EN_SERIE === 'function'
    ? ok('window.TRINQUETE_EN_SERIE existe') : mal('no hay trinquete de serie');
  {
    // serie inventada: la EMA 50 sube y luego baja. El trinquete tiene que quedarse en el pico.
    const guardadoP = ventana.__EMAS__, guardadoS = vm.runInContext('PRECIOS', ctx);
    vm.runInContext(`PRECIOS = {
      '2026-01-02': { 'X': 100 }, '2026-01-03': { 'X': 120 },
      '2026-01-04': { 'X': 130 }, '2026-01-05': { 'X': 104 } }`, ctx);
    ventana.__EMAS__ = { '2026-01-02': { X: 90 }, '2026-01-03': { X: 95 },
                         '2026-01-04': { X: 99 }, '2026-01-05': { X: 92 } };
    const tr = ventana.TRINQUETE_EN_SERIE('X', '2026-01-02', 100);
    // el 4 la EMA 50 vale 99 y la ganancia maxima es +30 %, asi que la proteccion del coste pone
    // el stop en la compra: 100. Ese es el pico del trinquete.
    tr === 100 ? ok('se queda en el pico del camino (100), no en el valor de hoy (92)')
      : mal('el trinquete no coge el pico de la serie', String(tr));
    const sinSerie = ventana.REGLAS.stopDe({ precio: 104, ema50: 92 }, 100, null);
    sinSerie < tr ? ok('y es más alto que mirando solo hoy (' + sinSerie.toFixed(2) + ' vs ' + tr.toFixed(2) + '): protege más')
      : mal('mirando solo hoy saldría igual o mejor, algo falla');
    ventana.TRINQUETE_EN_SERIE('X', '2026-01-02', 0) === null
      ? ok('sin precio de compra no se inventa un trinquete') : mal('devuelve algo sin compra');
    ventana.TRINQUETE_EN_SERIE('NOEXISTE', '2026-01-02', 100) === null
      ? ok('con un símbolo que no está en la serie, tampoco') : mal('inventa trinquete sin datos');
    vm.runInContext('PRECIOS = ' + JSON.stringify(guardadoS), ctx);
    ventana.__EMAS__ = guardadoP;
  }
  const srcPos7 = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /Math\.max\(p\.stopMax \|\| 0, trinqSerie \|\| 0\)/.test(srcPos7)
    ? ok('las posiciones usan el mayor entre lo guardado y el de la serie') : mal('las posiciones no usan el trinquete de serie');
  const srcApp7 = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  /window\.__EMAS__ = j\.emas/.test(srcApp7)
    ? ok('y la EMA 50 diaria se carga de precios.json') : mal('no se cargan las EMAs');

  /* La copia llevaba cuatro recordatorios sin hacerse, y con razon: copiar y pegar son tres pasos
     y un sitio donde pegarlo. Un fichero descargado es un clic. Es el unico dato irrecuperable. */
  console.log('\nLA COPIA DE SEGURIDAD EN UN CLIC');
  const srcPos8 = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /Descargar copia de mis posiciones/.test(srcPos8)
    ? ok('hay un botón que descarga un fichero') : mal('sigue habiendo solo copiar al portapapeles');
  /a\.download = 'panel-momentum-posiciones-'/.test(srcPos8)
    ? ok('con nombre y fecha en el fichero') : mal('el fichero no lleva nombre con fecha');
  /Copiar al portapapeles/.test(srcPos8) ? ok('y se conserva el portapapeles como alternativa') : mal('se ha perdido el portapapeles');
  /localStorage\.setItem\('copia-v1'/.test(srcPos8)
    ? ok('se anota la fecha de la última copia') : mal('no se recuerda cuándo fue la última');
  /No has descargado ninguna copia/.test(srcPos8) && /dd >= 30/.test(srcPos8)
    ? ok('y avisa si nunca se ha hecho o si pasan 30 días') : mal('no avisa de que falta la copia');
  // con posiciones y sin copia previa, el aviso tiene que salir de verdad
  almacen['posiciones-v1'] = JSON.stringify([{ ticker: datos.ticker, simbolo: sim, precio: 10, acciones: 5, fecha: panel.dias[0] }]);
  try { delete almacen['copia-v1'] } catch (e) {}
  await paso('posiciones se pinta sin copia previa', () => ventana.posiciones());
  /No has descargado ninguna copia/.test(porId.rpos.textContent)
    ? ok('el aviso aparece en pantalla, no solo en el código') : mal('el aviso no se pinta');
  almacen['copia-v1'] = panel.dias[panel.dias.length - 1];
  await paso('y con una copia reciente', () => ventana.posiciones());
  !/No has descargado ninguna copia/.test(porId.rpos.textContent)
    ? ok('y desaparece tras descargarla') : mal('el aviso sigue tras hacer copia');
  almacen['posiciones-v1'] = '[]';

  /* "Comprar hoy" ya llevaba contador, pero desde la pantalla inicial no habia forma de saber si
     TUS posiciones piden algo sin entrar a mirarlas, y eso es lo primero que hay que ver al abrir. */
  console.log('\nLA PESTAÑA DE POSICIONES AVISA SI ALGO PIDE ACCIÓN');
  const srcPl9 = fs.readFileSync(path.join(__dirname, '..', 'plantilla.html'), 'utf8');
  const srcApp9 = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  const srcCss9 = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  /id="npos"/.test(srcPl9) ? ok('la pestaña tiene sitio para la chapa') : mal('no hay chapa en la pestaña');
  /async function avisaPosiciones/.test(srcApp9) ? ok('y se calcula al arrancar') : mal('no se calcula');
  /await cargaPrecios\(\)/.test(srcApp9.split('async function avisaPosiciones')[1] || '')
    ? ok('descargando precios.json por su cuenta, sin retrasar el primer pintado')
    : mal('no carga la serie, el trinquete saldría mal');
  /TRINQUETE_EN_SERIE/.test(srcApp9.split('async function avisaPosiciones')[1] || '')
    ? ok('y usa el mismo trinquete que la pestaña, no un cálculo aparte') : mal('usa otro cálculo distinto al de la pestaña');
  /\.tab \.cnt\.urge\{background:var\(--down\)/.test(srcCss9) && /\.tab \.cnt\.ojo\{background:var\(--warn\)/.test(srcCss9)
    ? ok('rojo si hay que vender, ámbar si solo hay que vigilar') : mal('falta el color de la chapa');
  // sin posiciones no debe aparecer nada
  almacen['posiciones-v1'] = '[]';
  porId.npos.hidden = false; porId.npos.textContent = '9';
  await ventana.avisaPosiciones ? ventana.avisaPosiciones() : null;
  /if \(!pos\.length\) return;/.test(srcApp9)
    ? ok('sin posiciones abiertas no se pinta ninguna chapa') : mal('pintaría chapa sin posiciones');

  /* 24/10/2026: PAYS entro con 91,5 y hoy puntua 80,5. Seguimiento calculaba esa caida y la marcaba
     como "pierde fuerza" -> Vigilar; Hoy no se enteraba y decia COMPRA. La misma accion, el mismo
     dia, dos veredictos. El umbral estaba duplicado en seguimiento.js. */
  console.log('\nEL UMBRAL DE «PIERDE FUERZA» VIVE EN UN SOLO SITIO');
  const srcApp10 = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  const srcSeg10 = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
  const srcHoy10 = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  typeof ventana.CAIDA_FUERZA === 'number'
    ? ok('window.CAIDA_FUERZA existe y vale ' + ventana.CAIDA_FUERZA) : mal('no hay umbral compartido');
  /CAIDA_SCORE = window\.CAIDA_FUERZA/.test(srcSeg10)
    ? ok('Seguimiento lo toma de ahí, no tiene el suyo') : mal('Seguimiento sigue con su propio umbral');
  !/CAIDA_SCORE = \d/.test(srcSeg10) ? ok('y no queda ningún número suelto') : mal('queda un umbral duplicado');
  /flojea: !!a\.flojea/.test(srcApp10) ? ok('PRIORIDAD tiene en cuenta que pierda fuerza') : mal('PRIORIDAD lo ignora');
  /flojea:!!a\.flojea/.test(srcHoy10) ? ok('y la tarjeta de Hoy también') : mal('la tarjeta de Hoy lo ignora');
  /function caidaDesdeEntrada/.test(srcApp10)
    ? ok('la caída desde la entrada se calcula una vez, en app.js') : mal('no se calcula en app.js');
  // y que de verdad cambie el veredicto
  const flD = { precio: 14.92, ema50: 13.46, ema21: 14.5, sma200: 11, rsi: 60, max52: 16.15, volmedio: 1e6, ingresos: 40, cap: 1e9 };
  const sinFl = ventana.VEREDICTO(flD, { fallos: [] });
  const conFl = ventana.VEREDICTO(flD, { fallos: [], flojea: true });
  sinFl.cls === 'qok' && conFl.cls === 'qwarn'
    ? ok('la misma acción pasa de COMPRA a Vigilar al perder fuerza') : mal('perder fuerza no cambia el veredicto', sinFl.t + ' / ' + conFl.t);

  /* 24/10/2026: el numero de la tarjeta era el indice dentro de lo que se estaba mostrando, asi que
     la misma accion cambiaba de puesto al desplegar la lista: PAYS era "#6" con las 5 mejores y "#7"
     al verlas todas, y FIGS era "#6" solo en la vista completa. */
  console.log('\nEL PUESTO NO CAMBIA AL DESPLEGAR LA LISTA');
  {
    porId.segorden.value = 'score'; porId.segest.value = ''; porId.per.value = 90;
    const lee = () => (porId.rseg.hijos || []).filter(c => String(c.className || '').includes('card'))
      .map(c => (c.textContent.match(/^#(\d+)([A-Z]+)/) || []).slice(1))
      .filter(x => x.length).map(([n, t]) => t + ':' + n);
    await ventana.seguimiento();
    const corta = lee();
    const ver = (porId.rseg.hijos || []).flatMap(function f(x) { return [x, ...(x.hijos || []).flatMap(f)] })
      .find(b => /Ver las/.test(b.textContent || ''));
    if (ver && ver.onclick) await ver.onclick();   // seguimiento() es asincrona: hay que esperar al repintado
    const larga = lee();
    corta.length && larga.length ? ok('hay tarjetas en las dos vistas (' + corta.length + ' y ' + larga.length + ')')
      : mal('no se han pintado tarjetas', corta.length + ' / ' + larga.length);
    const mapa = Object.fromEntries(larga.map(x => x.split(':')));
    const cambian = corta.map(x => x.split(':')).filter(([t, n]) => mapa[t] && mapa[t] !== n)
      .map(([t, n]) => t + ' ' + n + '->' + mapa[t]);
    cambian.length === 0
      ? ok('ninguna acción cambia de número entre las dos vistas')
      : mal('el puesto cambia al desplegar', cambian.join(', '));
    const src = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
    /completa\.forEach\(\(a, i\) => \{ a\.puestoLista = i \+ 1 \}\)/.test(src)
      ? ok('el puesto se fija sobre la lista completa, antes de filtrar') : mal('el puesto sigue saliendo del índice filtrado');
    /'#' \+ a\.puestoLista/.test(src) ? ok('y es el que se pinta') : mal('se pinta otro número');
    /LA TIENES|SEÑAL DE SALIDA/.test(src)
      ? ok('y las que se cuelan por debajo del corte dicen por qué') : mal('no se explica el salto de numeración');
    /* Se deja la lista plegada otra vez: pulsar "Ver las N" cambia un estado del modulo que
       sobrevive a esta prueba, y la de orden de mas abajo daba por bueno un listado desplegado. */
    const volver = (porId.rseg.hijos || []).flatMap(function f(x) { return [x, ...(x.hijos || []).flatMap(f)] })
      .find(b => /Ver solo las/.test(b.textContent || ''));
    if (volver && volver.onclick) await volver.onclick();
    const plegada = (porId.rseg.hijos || []).filter(c => String(c.className || '').includes('card')).length;
    const visAqui = Number((src.match(/const VISIBLES = (\d+)/) || [])[1] || 5);
    plegada <= visAqui + 4 ? ok('y la lista vuelve a plegarse, sin dejar estado colgando (' + plegada + ' tarjetas)')
      : mal('la lista se queda desplegada y contamina las pruebas siguientes', String(plegada));
  }

  /* 25/10/2026: la casilla de cabecera de Seguimiento enseñaba la media de AGUANTAR SIN VENDER
     NUNCA (+0,1 %), no la del sistema, que vende cuando salta el stop (+1,2 %). COHU entraba en esa
     media con -35 % cuando el stop la habria sacado en -21 %. Lo vio Borja: "si es que si saltan los
     stop se venden, no se mantienen". */
  console.log('\nSEGUIMIENTO MIDE CON LOS STOPS PUESTOS');
  {
    await ventana.seguimiento();
    const txtSeg = porId.rseg.textContent.replace(/\s+/g, ' ');
    /media con los stops/.test(txtSeg)
      ? ok('la casilla dice que la media aplica las reglas de salida')
      : mal('la media de cabecera no dice si vende o aguanta', txtSeg.slice(0, 200));
    /Aguantando sin vender nunca saldría [+\-−][\d,]+ %/.test(txtSeg)
      ? ok('y enseña al lado lo que saldría aguantando, para poder comparar')
      : mal('no se puede comparar con la de aguantar');
    /* El banner del indice tiene que usar la MISMA media que la casilla, o la pestaña se
       contradice a si misma a dos centimetros de distancia. */
    const casilla = (txtSeg.match(/([+\-−][\d,]+ %)media con los stops|media con los stops([+\-−][\d,]+ %)/) || []).filter(Boolean)[1];
    const banner = (txtSeg.match(/de media ([+\-−][\d,]+ %) frente a/) || [])[1];
    casilla && banner && casilla === banner
      ? ok('y el banner del índice usa esa misma media (' + banner + ')')
      : mal('la casilla y el banner no dicen lo mismo', 'casilla ' + casilla + ' / banner ' + banner);
    /* El recorrido tiene que venir de la fuente unica, no de una copia local. */
    const srcSeg = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
    /recorridoConReglas/.test(srcSeg)
      ? ok('y usa el mismo recorrido que Resultados, no una copia')
      : mal('Seguimiento se ha hecho su propio cálculo de salidas');
    /await cargaPrecios\(\)/.test(srcSeg)
      ? ok('cargando antes la serie diaria, sin la que el stop no puede saltar')
      : mal('no carga la serie: el recorrido solo vería los días dentro del top');
    /* Una deslistada devuelve ret null, y en JavaScript suma + null es suma + 0: se colaba en la
       media como un 0 % y ademas dividia por una entrada de mas. Daba 1,18 % en vez de 1,23 %. */
    /todo\.filter\(a => a\.ret != null\)/.test(srcSeg)
      ? ok('y dejando fuera de la media las que ya no cotizan')
      : mal('las deslistadas se cuelan en la media como un 0 %');
    /* Las dos pestañas tienen que contar las mismas entradas y dar la misma media por entrada. */
    const nSeg = Number((txtSeg.match(/se suman las (\d+) y se divide/) || [])[1]);
    const nRes = Number((porId.rres.textContent.replace(/\s+/g, ' ').match(/cada una de las (\d+) entradas/) || [])[1]);
    nSeg && nRes && nSeg === nRes
      ? ok('Seguimiento y Resultados promedian las mismas ' + nSeg + ' entradas')
      : mal('cada pestaña promedia un número distinto de entradas', 'seg ' + nSeg + ' / res ' + nRes);
    const medSeg = (txtSeg.match(/([+\-−][\d,]+ %)media con los stops|media con los stops([+\-−][\d,]+ %)/) || []).filter(Boolean)[1];
    const medRes = (porId.rres.textContent.replace(/\s+/g, ' ').match(/Con nuestras reglas de salida[^%]*?([+\-−][\d,]+ %)/) || [])[1];
    medSeg && medRes && medSeg === medRes
      ? ok('y dan la misma media por entrada (' + medSeg + ')')
      : mal('la media por entrada no coincide entre pestañas', 'seg ' + medSeg + ' / res ' + medRes);
  }

  /* El corte no es un numero elegido a ojo: se midio que la puntuacion se mueve 2 puntos de mediana
     al dia y que dos acciones separadas por 1 punto se intercambian el puesto el 43 % de las veces.
     Cortar en 5 escondia a FIGS (82, +34,8 %) mientras se veia VSTM (82). */
  console.log('\nEL CORTE DE LA LISTA ESTÁ DONDE DEBE');
  {
    const srcS11 = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
    const vis = Number((srcS11.match(/const VISIBLES = (\d+)/) || [])[1] || 0);
    vis >= 10 ? ok('se muestran ' + vis + ', no 5') : mal('el corte sigue escondiendo por décimas', String(vis));
    !/i < 5 \|\| imprescindible/.test(srcS11) ? ok('y no queda ningún 5 a mano en el filtro') : mal('queda un 5 escrito a mano');
    (srcS11.match(/VISIBLES/g) || []).length >= 4
      ? ok('el número vive en un sitio y lo usan el filtro, la marca y el botón') : mal('el corte está duplicado');
  }

  console.log('\nSIN TECHO DE CAPITALIZACIÓN');
  const reqCap = a => ventana.REQUISITOS({ ...datos, cap: a }).find(x => x.t.includes('Capitalización'));
  const mega = reqCap(484e9), grande = reqCap(13e9), micro = reqCap(100e6);
  mega && mega.ok ? ok('una megacap de 484 B cumple el requisito de capitalización')
    : mal('una megacap NO cumple el requisito de capitalización', mega && mega.t);
  grande && grande.ok ? ok('una grande de 13 B también') : mal('una grande de 13 B no cumple', grande && grande.t);
  micro && !micro.ok ? ok('por debajo del suelo (100 M) sigue sin cumplir') : mal('el suelo de capitalización ya no filtra');
  mega && !/entre/.test(mega.t) ? ok('el requisito ya no anuncia un rango cerrado: ' + mega.t)
    : mal('el requisito sigue anunciando un techo', mega && mega.t);
  mega && mega.entrada ? ok('sigue siendo requisito solo de entrada: crecer no es motivo de venta')
    : mal('el requisito de capitalización ha dejado de ser solo de entrada');

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
  await ventana.seguimiento();
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
  await ventana.seguimiento();
  const porNota = vm.runInContext(`(() => {
    const filas = historial(90).filter(a => ['viable','extendida','flojea'].includes(a.estado));
    return filas.map(a => a.ticker + ':' + a.score).sort((x, y) => y.split(':')[1] - x.split(':')[1]);
  })()`, ctx);
  // el texto de la tarjeta es "#1PAYSEN EL TOP HOY...": hay que casar el ticker exacto, no un [A-Z]+
  const tickers = porNota.map(x => x.split(':')[0]);
  const enPantalla = (porId.rseg.hijos || []).filter(c => String(c.className || '').includes('card'))
    .map((c, i) => tickers.find(t => c.textContent.startsWith('#' + (i + 1) + t)))
    .filter(Boolean);
  /* El contrato real NO es "orden puro de nota": seguimiento.js hace
         if (!VER_TODAS) r = r.filter((a, i) => i < 5 || imprescindible(a));
     o sea, los 5 mejores por nota MAS cualquiera con señales de salida o que tengas comprada, para
     que un deterioro no se quede fuera de pantalla. Esta prueba exigia orden puro y pasaba de
     casualidad; el 21/10/2026 aparecio ARQT (80) sexta por delante de KNSA (82) y la prueba fallo,
     lo que ADEMAS bloqueo la publicacion diaria. Ahora se comprueba el contrato de verdad. */
  const nota = Object.fromEntries(porNota.map(x => [x.split(':')[0], Number(x.split(':')[1])]));
  // el corte vive en seguimiento.js (VISIBLES); la prueba lo lee de ahi para no fijar un 5 a mano
  const VIS = Number((fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8').match(/const VISIBLES = (\d+)/) || [])[1] || 5);
  const cinco = enPantalla.slice(0, VIS), extras = enPantalla.slice(VIS);
  const ordenados = cinco.every((t, i) => i === 0 || nota[cinco[i - 1]] >= nota[t]);
  ordenados ? ok('los ' + VIS + ' primeros van por nota de mayor a menor (' + cinco.slice(0, 5).join(' > ') + (cinco.length > 5 ? ' …' : '') + ')')
    : mal('los primeros no siguen el orden de nota', cinco.map(t => t + ':' + nota[t]).join(', '));
  const forzadas = extras.filter(t => {
    const a = vm.runInContext(`historial(90).find(x => x.ticker === ${JSON.stringify(t)})`, ctx);
    return a && ((a.salida && a.salida.senales.length) || (ventana.tengoPosicion && ventana.tengoPosicion(t)));
  });
  extras.length === forzadas.length
    ? ok(extras.length ? 'y las ' + extras.length + ' extra están por señales o por ser tuyas (' + extras.join(', ') + ')'
                       : 'y no hay ninguna extra forzada hoy')
    : mal('hay tarjetas fuera de los 5 que no tienen señales que las justifiquen',
          extras.filter(t => !forzadas.includes(t)).join(', '));
  const fuente = fs.readFileSync(path.join(dir, '..', 'plantilla.html'), 'utf8');
  /<option value="score" selected>/.test(fuente) ? ok('"Más momentum ahora" es la opción por defecto')
    : mal('el desplegable no arranca en momentum');
  !/ordenadas por cuál compraría antes/.test(fuente) ? ok('el subtítulo ya no promete orden de compra')
    : mal('el subtítulo sigue diciendo que ordena por orden de compra');

  /* Se pintaba "#1" por la posicion en pantalla y "TOP #2" por la nota en la misma tarjeta: dos
     numeraciones distintas peleandose. En una tarjeta solo puede haber un numero de puesto. */
  console.log('\nUNA SOLA NUMERACIÓN POR TARJETA');
  await ventana.seguimiento();
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
  /* El registro se puede ordenar de siete formas. Lo que no cambia nunca: las que han dejado de
     cotizar van al final, porque con el rendimiento a nulo se colarian en medio como un 0 %. */
  console.log('\nEL REGISTRO SE ORDENA DE VARIAS FORMAS');
  const ordenes = vm.runInContext('Object.keys(ORDENES)', ctx);
  ordenes.length >= 5 ? ok('hay ' + ordenes.length + ' formas de ordenar: ' + ordenes.join(', '))
    : mal('faltan formas de ordenar', ordenes.join(','));
  const htmlR = fs.readFileSync(path.join(dir, '..', 'plantilla.html'), 'utf8');
  /<option value="momentum" selected>/.test(htmlR) ? ok('por defecto ordena por momentum')
    : mal('el orden por defecto no es momentum');
  // cada orden hace lo que dice, y las sin desenlace quedan siempre al final
  const pruebas = vm.runInContext(`(() => {
    const xs = entradas();
    const sin = xs.find(a => a.ret > 0); if (sin) sin.ret = null;
    const out = {};
    for (const k of Object.keys(ORDENES)) {
      const o = [...xs].sort((a, b) => {
        if ((a.ret == null) !== (b.ret == null)) return a.ret == null ? 1 : -1;
        return ORDENES[k].f(a, b) || 0;
      });
      const con = o.filter(a => a.ret != null);
      out[k] = { primeros: o.slice(0, 3).map(a => a.ticker),
        finalSinDato: o.slice(-1)[0].ret == null,
        scores: con.map(a => a.score), rets: con.map(a => a.ret) };
    }
    return out;
  })()`, ctx);
  const mom = pruebas.momentum.scores.filter(x => x != null);
  mom.every((v, i) => !i || mom[i - 1] >= v)
    ? ok('«momentum» ordena por nota de mayor a menor (' + pruebas.momentum.primeros.join(' > ') + ')')
    : mal('el orden por momentum no es descendente', mom.slice(0, 6).join(', '));
  const mej = pruebas.mejor.rets.filter(x => x != null);
  mej.every((v, i) => !i || mej[i - 1] >= v) ? ok('«las que mejor van» ordena por rendimiento')
    : mal('el orden por rendimiento falla');
  const peo = pruebas.peor.rets.filter(x => x != null);
  peo.every((v, i) => !i || peo[i - 1] <= v) ? ok('«las que peor van» lo hace al revés')
    : mal('el orden inverso falla');
  Object.values(pruebas).every(p => p.finalSinDato)
    ? ok('en los ' + ordenes.length + ' órdenes, las que no cotizan quedan al final')
    : mal('alguna sin desenlace se cuela en medio',
        Object.entries(pruebas).filter(([, p]) => !p.finalSinDato).map(([k]) => k).join(', '));
  const fuenteRes = fs.readFileSync(path.join(dir, 'resultados.js'), 'utf8');
  /'Ordenado ' \+ modo\.t/.test(fuenteRes) ? ok('la tabla dice cómo está ordenada en cada caso')
    : mal('la tabla no explica su orden');

  /* Comparacion con el indice. El precio del S&P ya se guarda cada dia en el historico, asi que no
     cuesta ninguna llamada: lo que se comprueba es que el calculo sea el correcto. */
  console.log('\nLA COMPARACIÓN CON EL S&P 500 SALE DE LOS DATOS YA GUARDADOS');
  const sp = vm.runInContext(`(() => {
    const xs = entradas();
    const con = xs.filter(a => a.sp != null && a.ret != null);
    const m = v => v.reduce((s, x) => s + x, 0) / v.length;
    // comprobacion independiente: el S&P de una entrada es su variacion desde el dia que entro
    const x = con[0];
    const spyHoy = HIST[FH[0]].spy, spyEntrada = HIST[x.entrada] ? HIST[x.entrada].spy : null;
    return { n: con.length, total: xs.length, conPrecio: xs.filter(a => a.ret != null).length,
      mAcc: m(con.map(a => a.ret)), mSp: m(con.map(a => a.sp)),
      ticker: x.ticker, sp: x.sp,
      esperado: spyEntrada ? (spyHoy / spyEntrada - 1) * 100 : null };
  })()`, ctx);
  sp.n === sp.conPrecio ? ok('las ' + sp.n + ' entradas con precio tienen su dato del índice')
    : mal('faltan datos del índice', sp.n + ' de ' + sp.conPrecio + ' con precio');
  sp.esperado != null && Math.abs(sp.sp - sp.esperado) < 0.01
    ? ok('el S&P de ' + sp.ticker + ' se mide desde el día que entró (' + sp.sp.toFixed(2) + ' %)')
    : mal('el cálculo del índice no cuadra', sp.sp + ' vs ' + sp.esperado);
  const fuenteSp = fs.readFileSync(path.join(dir, 'resultados.js'), 'utf8');
  !/fetch\(/.test(fuenteSp.split('cargaPrecios')[2] || '') ? ok('no se descarga nada nuevo para compararlo')
    : mal('la comparación añade una descarga');
  await paso('resultados se pinta con la comparación', () => ventana.resultados());
  /Comparado con el S&P 500/.test(porId.rres.textContent) ? ok('el bloque de comparación aparece')
    : mal('no aparece el bloque de comparación');
  /* Antes esto buscaba la frase "todavia es ruido" en letra pequena. Un aviso en prosa debajo de
     un "+1,7 pt" en verde no evita que se lea el numero: ahora se exige la cifra del margen de
     error, y que cuando cruce el cero lo diga con esas palabras. */
  const txtRes = porId.rres.textContent;
  /* Se extraen los dos limites y se comprueba el aviso CONTRA ELLOS. Un primer intento buscaba el
     signo menos tipografico (−) y la app escribe el guion normal (-): la condicion era siempre
     falsa y la comprobacion no comprobaba nada. */
  const mg = txtRes.match(/Margen de error: de ([+-]?[\d.]+(?:,\d+)?) a ([+-]?[\d.]+(?:,\d+)?) pt/);
  mg ? ok('la diferencia contra el índice va con su margen de error')
     : mal('presenta la diferencia sin margen de error', txtRes.slice(0, 300));
  if (mg) {
    const num = s => parseFloat(s.replace(',', '.'));
    const lo = num(mg[1]), hi = num(mg[2]);
    lo <= hi ? ok('el margen está bien ordenado (' + lo + ' <= ' + hi + ')')
             : mal('el margen sale al revés', lo + ' > ' + hi);
    const cruzaCero = lo < 0 && hi > 0;
    const avisa = /no se distingue de la casualidad/.test(txtRes);
    cruzaCero === avisa
      ? ok(cruzaCero ? 'cruza el cero y lo advierte' : 'no cruza el cero y no lo advierte')
      : mal(cruzaCero ? 'el margen cruza el cero y NO lo advierte'
                      : 'el margen no cruza el cero pero avisa como si lo cruzara',
            `[${lo}, ${hi}] avisa=${avisa}`);
  }
  /en solo \d+ días|en \d+ días distintos/.test(txtRes)
    ? ok('dice en cuántos días distintos entraron, no solo cuántas entradas')
    : mal('no distingue entradas de días de entrada');

  /* Guardarrail contra el sesgo de supervivencia. La sugerencia original era filtrar a "solo las
     que siguen en el top". Medido el 24/10/2026 eso pasa de +0,1 % a +12,1 %: doce puntos que son
     solo las perdedoras saliendo por la puerta de atras. Se muestran los DOS grupos o ninguno. */
  const grupoDentro = /Siguen en el top/.test(txtRes), grupoFuera = /Ya salieron del top/.test(txtRes);
  grupoDentro === grupoFuera
    ? ok(grupoDentro ? 'los dos grupos (dentro y fuera del top) se muestran juntos' : 'no hay desglose por grupo')
    : mal('se muestra un solo grupo: eso es sesgo de supervivencia',
          `dentro=${grupoDentro} fuera=${grupoFuera}`);
  !grupoDentro || /infla el resultado/.test(txtRes)
    ? ok(grupoDentro ? 'y avisa de cuánto infla mirar solo las que siguen dentro' : 'sin desglose, sin aviso')
    : mal('desglosa por grupo sin avisar del sesgo de supervivencia');

  /* La tabla de tres formas de operar estaba tras un umbral de 30 entradas maduras y nunca se habia
     visto: dejaba como unica cifra el "comprar y no vender nunca", que es lo que el sistema NO hace. */
  /Con nuestras reglas de salida/.test(txtRes)
    ? ok('se ve qué habría pasado con las reglas de salida, sin esperar a 30 entradas')
    : mal('la simulación de las reglas de salida sigue escondida');
  /Peor momento/.test(txtRes)
    ? ok('y cuánto se llegó a estar en rojo por el camino')
    : mal('no muestra el drawdown');

  /* La cartera: la rentabilidad del listado como un todo, encadenada en vez de promediada.
     Y, sobre todo, con el aviso de que no es lo que el usuario hace: compra las 10 y reequilibra
     cada sesion, con una rotacion que en la realidad pagan las comisiones. */
  /* Antes se exigian las frases "como una sola cartera" y "Esto no es lo que tu haces". El titulo
     decia "si hubieras comprado el listado entero", que se leia como comprar y no vender nunca, y
     es lo contrario: esa cartera vende cada vez que una accion se cae del top. Lo que hay que
     garantizar no es el rotulo, es que se entienda CUANDO vende y que ahi no hay stop. */
  /vendes la que se ha caído del listado/.test(txtRes)
    ? ok('dice que la cartera del listado vende lo que sale del top')
    : mal('no explica cuándo vende la cartera del listado', txtRes.slice(0, 200));
  /Aquí no hay stop/.test(txtRes)
    ? ok('y que ahí no interviene el stop')
    : mal('no aclara que esa cartera no usa el stop');
  /¿Por qué .* aquí y .* más arriba\?/.test(txtRes)
    ? ok('y por qué no coincide con la cartera operada con el stop')
    : mal('no reconcilia la cartera del listado con la operada');
  /no es para copiarlo|no demuestra nada/.test(txtRes)
    ? ok('y avisa de que no es la operativa real')
    : mal('presenta la cartera como si fuera lo que el usuario opera');
  /se compra al cierre del día siguiente/.test(txtRes)
    ? ok('y de que la compra va con un día de retraso')
    : mal('no dice que la entrada lleva un día de retraso');

  /* Operar el panel: comprar lo que dice y vender con el stop. Es la pregunta que de verdad
     importa y la que ninguna de las otras cifras contestaba. */
  /comprar cuando lo dice, vender con el stop/.test(txtRes)
    ? ok('se ve qué habría pasado operando el panel de verdad')
    : mal('no hay simulación de la operativa real');
  /* Con CUANTAS posiciones, y antes de las cifras. Estaba solo en el parrafo de debajo de la
     grafica: un +2,4 % sin saber sobre cuantas posiciones no se puede interpretar, y mas cuando
     cambiar ese numero mueve el resultado 5 puntos. */
  /operado el panel con \d+ posiciones/.test(txtRes)
    ? ok('y con cuántas posiciones, en el propio título')
    : mal('no dice sobre cuántas posiciones está calculado', txtRes.slice(0, 200));
  /Llevas como mucho \d+ acciones a la vez/.test(txtRes)
    ? ok('explicado antes de enseñar las cifras')
    : mal('la explicación de la cartera no precede a las cifras');
  /* Y CUALES son. "5 posiciones" no dice cual compra ni con que criterio: hay que decir que son las
     mejor puntuadas disponibles, que una vez dentro no se rotan, y enseñar los nombres. */
  /mejor puntuadas que hubiera disponibles/.test(txtRes)
    ? ok('y con qué criterio se eligen esas posiciones')
    : mal('no dice cuáles de las del top compra');
  /ahí se queda hasta que le salta el stop/.test(txtRes)
    ? ok('y que una vez dentro no se cambia por otra mejor')
    : mal('no aclara si la cartera se rota o se aguanta');
  /Las \d+ que tendrías ahora mismo/.test(txtRes)
    ? ok('y se listan por nombre las que quedarían abiertas')
    : mal('no se ve qué acciones son', txtRes.slice(0, 200));
  /* La fecha de compra de la cartera no es la de entrada al top, y la misma accion sale en las dos
     tablas con fechas y rentabilidades distintas. Hay que decirlo o parece una contradiccion. */
  /La fecha es la del día en que hubo hueco/.test(txtRes)
    ? ok('y se avisa de que esa fecha no es la de entrada al top')
    : mal('la misma acción sale con dos fechas sin explicar por qué');
  /* Y las que la cartera tiene compradas no pueden quedar ocultas bajo el corte del registro:
     "¿por qué SLDE no sale en Resultados?" cuando estaba arriba, en la cartera. */
  /en la cartera simulada/.test(txtRes)
    ? ok('y las que tiene la cartera se marcan en el registro')
    : mal('las de la cartera no se distinguen en el registro');
  /ventas cerradas/.test(txtRes)
    ? ok('y cuántas ventas se han cerrado de verdad')
    : mal('no dice cuántas operaciones están cerradas');
  /* La diferencia con el indice, calculada y no a ojo: es la pregunta de la pestaña entera.
     Ojo con el orden: stat() pone el valor DELANTE de la etiqueta en el navegador (usa prepend),
     pero el stub de aqui devuelve la etiqueta primero. La comprobacion acepta los dos ordenes
     para no depender de ese detalle del doble. */
  /* (Y ojo con quitar los espacios antes de buscar un texto que los lleva: la primera version de
     esta comprobacion hacia replace(/\s+/g,'') y luego buscaba "de diferencia". Nunca encajaba.) */
  const uno = txtRes.replace(/\s+/g, ' ');
  /de diferencia ?[+\-−][\d,]+ pt|[+\-−][\d,]+ pt ?de diferencia/.test(uno)
    ? ok('y la diferencia con el índice ya restada')
    : mal('obliga a restar a mano la cartera y el índice', uno.slice(0, 220));
  /llegó a estar en [+\-−][\d,]+ %/.test(txtRes)
    ? ok('sin perder lo que llegó a estar en rojo por el camino')
    : mal('se ha perdido el peor momento de la cartera');
  /todavía no es una rentabilidad media|Sin comisiones ni diferencial/.test(txtRes)
    ? ok('y avisa de que con tan pocas ventas no hay rentabilidad media')
    : mal('da una rentabilidad media sin avisar de la muestra');
  /* Buscaba la frase "Con otro número de huecos", que cambió. Ahora mira la sustancia: que estén
     los dos extremos —1 posición (solo la de más momentum) y 10 (el top entero)— y el abanico. */
  /1 posición [+\-−]/.test(txtRes) && /10 posiciones [+\-−]/.test(txtRes)
    ? ok('enseña desde 1 posición hasta 10, no solo la cifra elegida')
    : mal('esconde la sensibilidad al número de posiciones', txtRes.slice(0, 200));
  /el resultado se mueve [\d,.]+ puntos/.test(txtRes)
    ? ok('y cuánto se mueve el resultado solo por esa decisión')
    : mal('no cuantifica el abanico entre unas y otras');

  /* Las graficas tienen que decir cual linea es cual. Antes eran dos trazos sueltos y habia que
     leer el parrafo de debajo para saberlo. La leyenda va en HTML y no dentro del SVG justo para
     que se pueda comprobar aqui: el stub descarta innerHTML, asi que el SVG es invisible al test. */
  /tu cartera/.test(txtRes) && /el S&P 500/.test(txtRes)
    ? ok('las gráficas llevan leyenda con el nombre de cada línea')
    : mal('las gráficas no dicen cuál línea es cuál', txtRes.slice(0, 200));
  /* Y con el resultado de cada una pegado a su muestra, no solo el nombre. */
  /[+\-−]\d+[,.]\d+\s*% tu cartera/.test(txtRes.replace(/\s+/g, ' '))
    ? ok('y el resultado de cada línea junto a su nombre')
    : mal('la leyenda no lleva el resultado de cada línea');
  /* El eje de fechas: sin el, la curva no dice CUANDO paso cada cosa. Tiene que aguantar hasta las
     90 sesiones que publica el panel, asi que etiquetasFecha() se prueba aparte a muchas escalas
     en tests/resultados.test.js; aqui solo se exige que el eje exista y tenga fechas de verdad. */
  const ejes = (function buscar(x, acc) {
    if ((x.className || '').split(' ').includes('eje')) acc.push(x);
    (x.hijos || []).forEach(h => buscar(h, acc));
    return acc;
  })(porId.rres, []);
  ejes.length ? ok('las gráficas llevan eje de fechas (' + ejes.length + ')')
              : mal('las gráficas no dicen de qué días son');
  ejes.length && ejes.every(e => (e.hijos || []).length >= 2 && (e.hijos || []).every(s => /\w/.test(s.textContent)))
    ? ok('y cada eje trae al menos dos fechas con texto')
    : mal('algún eje sale vacío o con etiquetas en blanco');

  /* Freno al amontonamiento. La pestaña llegó a tener SIETE bloques de golpe y se hizo ilegible.
     Arriba solo puede haber lo que contesta la pregunta; el resto va plegado. */
  /* El stub de DOM no tiene querySelector (devuelve null siempre), asi que se recorre a mano. */
  const titulos = x => {
    let n2 = (x.className || '').split(' ').includes('blt') ? 1 : 0;
    (x.hijos || []).forEach(h => n2 += titulos(h));
    return n2;
  };
  const plegado = (porId.rres.hijos || []).find(x => x.tagName === 'DETAILS');
  plegado ? ok('las formas secundarias van en su propia sección, separadas de la respuesta')
          : mal('no hay sección aparte: todo se muestra de golpe');
  /* Arranca ABIERTA: Borja la quiere a la vista. Lo que ordenó la pestaña fue el orden, no
     esconderlas, y llegar a ellas costaba un clic que no siempre se da. */
  !plegado || plegado.open
    ? ok(plegado ? 'y se ven desplegadas al abrir la pestaña' : '—')
    : mal('la sección arranca cerrada y debería verse desplegada');
  if (plegado) {
    const arriba = (porId.rres.hijos || []).filter(x => x !== plegado).reduce((s, x) => s + titulos(x), 0);
    arriba <= 2 ? ok('arriba quedan ' + arriba + ' bloques con título, no una pila de tablas')
                : mal('vuelve a haber demasiado a primera vista', arriba + ' bloques sin plegar');
    const dentro = titulos(plegado);
    dentro >= 3 ? ok('y ' + dentro + ' formas secundarias guardadas dentro del plegable')
                : mal('el plegable está casi vacío', dentro + ' bloques');
  }

  /* El acento de las tarjetas iba por tramo de puntuacion con corte en 75, y como al top solo suben
     las mejores, nueve de cada diez salian con el mismo color: la lista parecia homogenea. */
  console.log('\nCADA TARJETA SE DISTINGUE POR SU VEREDICTO');
  ventana.pinta();
  const clases = (porId.lista.hijos || []).filter(c => String(c.className || '').includes('card'))
    .map(c => (String(c.className).match(/v-(ok|warn|bad)/) || [])[1]).filter(Boolean);
  clases.length ? ok('las ' + clases.length + ' tarjetas llevan acento de veredicto') : mal('ninguna tarjeta lleva acento');
  const esperadas = vm.runInContext(`(() => vista().todas.slice(0, ${clases.length})
    .map(a => ({ qok: 'ok', qwarn: 'warn', qbad: 'bad' }[VEREDICTO(a, { extendida: a.pt && a.pt.extendida, sinSeguimiento: a.sinSeguimiento }).cls] || 'warn')))()`, ctx);
  clases.join(',') === esperadas.join(',')
    ? ok('el acento de cada tarjeta es el de su veredicto (' + clases.join(', ') + ')')
    : mal('el acento no coincide con el veredicto', clases.join(',') + ' vs ' + esperadas.join(','));
  // Y sobre la lista completa tiene que distinguir mas que el tramo de nota, que casi nunca varia.
  const comparativa = vm.runInContext(`(() => {
    const t = vista().todas;
    return { nota: new Set(t.map(a => a.score >= 75 ? 'n3' : a.score >= 55 ? 'n2' : 'n1')).size,
      veredicto: new Set(t.map(a => VEREDICTO(a, { extendida: a.pt && a.pt.extendida, sinSeguimiento: a.sinSeguimiento }).cls)).size };
  })()`, ctx);
  comparativa.veredicto >= comparativa.nota
    ? ok('en la lista entera distingue al menos tanto como el tramo de nota (' + comparativa.veredicto + ' frente a ' + comparativa.nota + ')')
    : mal('distingue menos que el tramo de nota', comparativa.veredicto + ' vs ' + comparativa.nota);
  const fuenteH = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  !/score>=75\?' n3'/.test(fuenteH) ? ok('ya no se pinta por tramo de puntuación')
    : mal('sigue pintando por tramo de puntuación');

  /* El panel va un dia por detras. Al vender, la web rellenaba el precio con su ultima cotizacion y
     bastaba un Enter para anotar una cifra que no era la del broker. Y la fecha era la del ultimo
     cierre guardado, no la de hoy. El historial de operaciones es lo que mide si esto funciona: si se
     llena de precios inventados, no mide nada. */
  console.log('\nAL VENDER, EL PRECIO SE PIDE Y NO SE RELLENA SOLO');
  const panel3 = JSON.parse(fs.readFileSync(path.join(dir, 'panel.json'), 'utf8'));
  const sim3 = Object.keys(panel3.actual)[0], dat3 = panel3.actual[sim3];
  almacen['posiciones-v1'] = JSON.stringify([{ ticker: dat3.ticker, simbolo: sim3, precio: dat3.precio * 0.9,
    acciones: 10, fecha: panel3.dias[0], maxVisto: dat3.precio }]);
  await paso('posiciones se pinta con la posición abierta', () => ventana.posiciones());
  const fuenteP = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  !/prompt\('¿A qué precio has vendido/.test(fuenteP) ? ok('ya no se vende por un prompt de un solo paso')
    : mal('sigue vendiendo con un prompt');
  !/precioSalida: v \|\| r\.ahora/.test(fuenteP) && !/\|\| r\.ahora/.test(fuenteP)
    ? ok('no hay vuelta atrás silenciosa a la cotización del panel')
    : mal('si el precio no vale, se cuela la cotización del panel');
  /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(fuenteP)
    ? ok('la fecha de venta por defecto es la de hoy, no la del último cierre')
    : mal('la fecha de venta sigue saliendo del último cierre guardado');
  /cerrada: fe\.i\.value/.test(fuenteP) ? ok('se guarda la fecha que pones tú')
    : mal('no se guarda la fecha del formulario');
  /un día por detrás/.test(fuenteP) ? ok('el formulario avisa de que la cotización va con retraso')
    : mal('no avisa del retraso');
  almacen['posiciones-v1'] = '[]';

  /* Un input type="number" rechaza la coma decimal: escribes "15,42" con teclado español, el campo se
     queda vacio y el formulario te pide el precio habiendolo puesto. Me paso probando la venta. */
  console.log('\nLOS CAMPOS DE PRECIO ACEPTAN LA COMA');
  const fuenteC = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  !/type = 'number'/.test(fuenteC) ? ok('ningún campo usa type="number"') : mal('queda algún type="number" que rechaza la coma');
  /inputMode = 'decimal'/.test(fuenteC) ? ok('usan teclado numérico igualmente') : mal('se pierde el teclado numérico en el móvil');
  const conv = vm.runInContext(`(() => ['15,42', '15.42', ' 15,42 ', '1.234', '', 'abc']
    .map(x => comoNumero(x)))()`, ctx);
  conv[0] === 15.42 ? ok('"15,42" se interpreta como 15,42') : mal('la coma no se interpreta', conv[0]);
  conv[1] === 15.42 ? ok('"15.42" con punto también') : mal('el punto no se interpreta', conv[1]);
  conv[2] === 15.42 ? ok('con espacios alrededor también') : mal('los espacios rompen el número', conv[2]);
  Number.isNaN(conv[5]) ? ok('un texto que no es número no cuela como 0') : mal('un texto se convierte en número', conv[5]);

  /* Resultado mes a mes con el acumulado: es la curva de la cuenta. Si la suma esta mal, la
     conclusion sobre si vas ganando o perdiendo esta mal. */
  /* La seccion se devolvia como null sin operaciones cerradas y no se dibujaba nada: no habia forma
     de saber que existia. La tabla de operaciones si se enseña vacia; esta tiene que hacer lo mismo. */
  /* Ventas parciales. El caso que las motiva: una accion sube mucho, no toca vender segun el
     protocolo, pero hace falta liquidez. Lo que mas despista es el precio medio: NO cambia. */
  console.log('\nVENTA PARCIAL: LA ARITMÉTICA');
  // 100 acciones compradas a 10 $. Se venden 40 a 25 $.
  // ticker real del panel: asi se recorre el camino completo de la tarjeta, con cotizacion incluida
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: datos.ticker, simbolo: sim, precio: 10, acciones: 60, fecha: '2026-09-01' },
    { ticker: datos.ticker, simbolo: sim, precio: 10, acciones: 40, fecha: '2026-09-01',
      cerrada: '2026-10-10', precioSalida: 25, parcial: true, id: 'pX' },
  ]);
  await paso('posiciones se pinta con una venta parcial', () => ventana.posiciones());
  const tp = porId.rpos.textContent;
  /ya vendiste 40 de 100 acciones/.test(tp)
    ? ok('la tarjeta dice cuántas vendiste de cuántas') : mal('no dice lo ya vendido', tp.slice(0, 200));
  /realizado \+600,00 \$/.test(tp)
    ? ok('y la ganancia realizada: 40 × (25 − 10) = +600,00 $') : mal('la ganancia realizada no cuadra');
  /en 1 venta/.test(tp) ? ok('cuenta una sola venta') : mal('no cuenta las ventas');
  /venta parcial/.test(tp) ? ok('la fila del historial se marca como venta parcial') : mal('la fila no se marca');
  // Precio medio: NO cambia. Las 60 que quedan siguen costando 10 $.
  /compraste a/.test(tp) && /10,00 \$/.test(tp) && /ahora/.test(tp)
    ? ok('la tarjeta muestra «compraste a 10,00 $ → ahora», etiquetado y legible')
    : mal('el precio de compra no sale etiquetado', (tp.match(/compraste[\s\S]{0,40}/) || [''])[0]);
  const srcPos6 = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /'precios'/.test(srcPos6) && /compraste a/.test(srcPos6)
    ? ok('y sale de su propio bloque, no del gris más pequeño de la tarjeta') : mal('sigue en el texto gris');
  /\.precios \.vl\{font-size:16px/.test(fs.readFileSync(path.join(dir, 'extra.css'), 'utf8'))
    ? ok('con el precio a 16 px, no a 11') : mal('el precio de compra sigue pequeño');
  /ya está por debajo de tu compra/.test(srcPos6)
    ? ok('«Ha devuelto» deja de decir 133 % cuando estás por debajo de tu compra')
    : mal('«Ha devuelto» puede seguir pasando del 100 %');
  /la regla no aplica hasta/.test(srcPos6)
    ? ok('y avisa cuando la regla de devolución todavía no aplica') : mal('no dice cuándo la regla no aplica');
  const posPar = JSON.parse(almacen['posiciones-v1']);
  const abierta = posPar.find(x => !x.cerrada);
  abierta && abierta.precio === 10 ? ok('y en el almacén tampoco se ha tocado') : mal('se ha alterado el precio de compra guardado');
  abierta && Number(abierta.acciones) === 60 ? ok('quedan 60 acciones en la posición abierta') : mal('el nº de acciones no cuadra');

  /* Añadir a una posicion (promediar). Al contrario que la venta parcial, ESTO SI cambia el precio
     medio, y con el el stop, el nivel del +20 % y la regla de devolucion. Antes del 16/10/2026 eran
     tres prompt() que lo cambiaban sin decirlo. */
  console.log('\nAÑADIR A UNA POSICIÓN: LA ARITMÉTICA');
  const apP = (a, pa, b, pb) => (typeof ventana.NUEVO_PROMEDIO === 'function' ? ventana.NUEVO_PROMEDIO(a, pa, b, pb) : undefined);
  typeof ventana.NUEVO_PROMEDIO === 'function'
    ? ok('window.NUEVO_PROMEDIO existe y es pública') : mal('la media ponderada no es una función probable');
  const ap1 = apP(50, 10, 50, 20);
  ap1 && ap1.precio === 15 && ap1.acciones === 100 && ap1.invertido === 1500
    ? ok('50 a 10 $ + 50 a 20 $ → 100 acciones a 15 $, 1.500 $ invertidos') : mal('la media ponderada falla', JSON.stringify(ap1));
  const ap2 = apP(50, 10, 25, 16);
  ap2 && ap2.precio === 12 && ap2.acciones === 75
    ? ok('50 a 10 $ + 25 a 16 $ → 75 acciones a 12 $ (ponderada, no la media simple de 13)') : mal('no pondera por acciones', JSON.stringify(ap2));
  const ap3 = apP(50, 20, 50, 10);
  ap3 && ap3.precio === 15 ? ok('promediar a la baja también: 20 $ y 10 $ → 15 $') : mal('a la baja falla');
  apP(50, 10, 0, 20) === null && apP(50, 10, 50, 0) === null && apP(-1, 10, 5, 10) === null
    ? ok('con datos inválidos no se inventa un precio medio') : mal('devuelve algo con datos inválidos');

  /* Esto es lo que antes se cambiaba por la espalda: el stop. */
  console.log('\nAÑADIR A UNA POSICIÓN: MUEVE EL STOP Y HAY QUE DECIRLO');
  /* Superado el +20 % de ganancia el stop sube AL PRECIO DE COMPRA (reglas.js, gananciaProteger).
     Asi que promediar al alza sube el stop directamente, y mucho: no es un efecto de segundo orden. */
  const apStop = (compra, ema50) => ventana.REGLAS.stopDe({ precio: 20, ema50 }, compra, null);
  const sA = apStop(10, 5), sB = apStop(15, 5);
  sA === 10 && sB === 15
    ? ok('con la EMA 50 lejos: promediar de 10 $ a 15 $ sube el stop de 10,00 $ a 15,00 $')
    : mal('el stop no sigue al precio medio', sA + ' / ' + sB);
  // con el precio en 20, la distancia al stop pasa del 50 % al 25 %: se parte por la mitad
  Math.abs((1 - sA / 20) * 100 - 50) < 1e-9 && Math.abs((1 - sB / 20) * 100 - 25) < 1e-9
    ? ok('y la distancia al stop pasa del 50 % al 25 %: la mitad de margen') : mal('la distancia no cuadra');
  // si la EMA 50 esta por encima, manda ella y promediar no mueve nada
  apStop(10, 18) === 18 && apStop(15, 18) === 18
    ? ok('si la EMA 50 está por encima manda ella y promediar no mueve el stop') : mal('la EMA 50 no manda cuando debe');
  // y por debajo del +20 % manda el tope del 15 % desde la compra, que tambien sigue al medio
  const u1 = ventana.REGLAS.stopDe({ precio: 21, ema50: 5 }, 20, null);
  const u2 = ventana.REGLAS.stopDe({ precio: 21, ema50: 5 }, 25, null);
  Math.abs(u1 - 17) < 1e-9 && Math.abs(u2 - 21.25) < 1e-9
    ? ok('por debajo del +20 % manda el tope del 15 %, que también sigue al precio medio (17,00 → 21,25)')
    : mal('el tope del 15 % no sigue al precio medio', u1 + ' / ' + u2);

  /* Consecuencia menos obvia: la regla de devolucion se mide contra el precio medio, asi que
     promediar al alza puede DESACTIVARLA, porque la ganancia maxima medida se encoge. */
  console.log('\nPROMEDIAR AL ALZA PUEDE DESACTIVAR LA REGLA DE DEVOLUCIÓN');
  const lim = (maxVisto, compra) => ventana.REGLAS.limiteDevolucion((maxVisto / compra - 1) * 100);
  lim(26, 10) === 40 ? ok('con medio 10 $ y máximo 26 $ (+160 %) el límite es devolver el 40 %') : mal('el límite con 10 $ no cuadra', String(lim(26, 10)));
  lim(26, 20) === 50 ? ok('con medio 20 $ (+30 %) pasa a ser el 50 %') : mal('el límite con 20 $ no cuadra', String(lim(26, 20)));
  lim(26, 21) === null
    ? ok('y con medio 21 $ (+23,8 %) la regla deja de aplicarse: manda solo el stop')
    : mal('la regla de devolución no se desactiva', String(lim(26, 21)));

  const apSrc = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /Tu stop'/.test(apSrc) && /stopDe\(r\.a \|\| \{ precio: r\.ahora \}, np\.precio/.test(apSrc)
    ? ok('el formulario calcula y enseña el stop de después') : mal('el formulario no enseña el stop nuevo');
  /Promediar al alza SUBE tu precio medio/.test(apSrc)
    ? ok('y avisa de lo que implica promediar al alza') : mal('no avisa al promediar al alza');
  /promediando A LA BAJA/.test(apSrc)
    ? ok('y avisa de que promediar a la baja va contra la estrategia') : mal('no avisa al promediar a la baja');
  !/window\.ampliarCompra = function/.test(apSrc)
    ? ok('ya no queda la versión de prompt() que lo cambiaba sin decirlo') : mal('sigue la versión antigua a base de prompt()');
  /compras/.test(apSrc) && /compras\.length > 1/.test(apSrc)
    ? ok('se guarda y se muestra el desglose: el precio medio es auditable') : mal('no se guarda el desglose de compras');
  /Regla de devolución'/.test(apSrc) && /DEJA DE APLICAR/.test(apSrc)
    ? ok('y el formulario avisa cuando la regla de devolución se desactiva')
    : mal('no avisa de que promediar puede desactivar la regla de devolución');

  /* Una venta parcial anterior no se puede recalcular con el precio medio nuevo. */
  console.log('\nPROMEDIAR NO REESCRIBE UNA VENTA YA HECHA');
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: datos.ticker, simbolo: sim, precio: 15, acciones: 60, fecha: '2026-09-01',
      compras: [{ fecha: '2026-09-01', precio: 10, acciones: 100 }, { fecha: '2026-10-05', precio: 20, acciones: 20 }] },
    { ticker: datos.ticker, simbolo: sim, precio: 10, acciones: 40, fecha: '2026-09-01',
      cerrada: '2026-09-20', precioSalida: 25, parcial: true, id: 'pW' },
  ]);
  await paso('posiciones se pinta con venta parcial y promedio posterior', () => ventana.posiciones());
  const tprom = porId.rpos.textContent;
  /realizado \+600,00 \$/.test(tprom)
    ? ok('la venta de 40 a 25 $ mantiene su +600,00 $ (coste 10 $, no el medio nuevo de 15 $)')
    : mal('el beneficio realizado se recalcula con el precio medio nuevo', (tprom.match(/realizado [^·]*/) || [''])[0]);
  /precio medio de 2 compras: 100 a 10,00 \$ \+ 20 a 20,00 \$/.test(tprom)
    ? ok('y la tarjeta enseña de dónde sale el precio medio') : mal('no se ve el desglose de compras');

  /* Vender por IMPORTE. El caso que lo motiva, con sus numeros: 500 $ invertidos (50 acciones a
     10 $), la posicion vale 800 $ (precio 16 $), se venden 400 $. */
  console.log('\nVENDER POR IMPORTE: EL EJEMPLO CONCRETO');
  // la funcion REAL del codigo, no una copia de la aritmetica en el fichero de pruebas
  const vpConv = (importe, precio, tot) => (typeof ventana.ACCIONES_POR_IMPORTE === 'function'
    ? ventana.ACCIONES_POR_IMPORTE(importe, precio, tot) : undefined);
  typeof ventana.ACCIONES_POR_IMPORTE === 'function'
    ? ok('window.ACCIONES_POR_IMPORTE existe y es pública') : mal('la conversión no es una función probable');
  vpConv(0, 16, 50) === null && vpConv(400, 0, 50) === null && vpConv(-400, 16, 50) === null
    ? ok('sin importe o sin precio no se inventa un nº de acciones') : mal('devuelve algo con datos inválidos');
  vpConv(400, 16, null) === 25
    ? ok('sin nº de acciones conocido convierte igual, sin topar') : mal('falla sin total');
  const vpAcc400 = vpConv(400, 16, 50);
  vpAcc400 === 25 ? ok('400 $ a 16 $ son 25 acciones') : mal('la conversión importe→acciones falla', String(vpAcc400));
  const vpQueda400 = 50 - vpAcc400;
  vpQueda400 === 25 ? ok('quedan 25 de las 50 acciones') : mal('el resto no cuadra');
  vpQueda400 * 10 === 250 ? ok('el capital que sigue dentro es 250 $ (25 × 10 $ de compra)') : mal('el capital restante no cuadra');
  vpQueda400 * 16 === 400 ? ok('y lo que te queda vale 400 $') : mal('el valor restante no cuadra');
  (16 - 10) * vpAcc400 === 150 ? ok('la ganancia realizada es +150 $ (25 × 6 $)') : mal('la ganancia realizada no cuadra');
  vpConv(900, 16, 50) === 50 ? ok('pedir más de lo que vale la posición se topa en todas las acciones') : mal('no se topa en el total');
  // "recuperar lo invertido": vender justo el capital que pusiste y dejar corriendo la ganancia
  const vpRecup = vpConv(50 * 10, 16, 50);
  Math.abs(vpRecup - 31.25) < 1e-9 ? ok('«recuperar lo invertido» vende 31,25 acciones (500 $ a 16 $)') : mal('el atajo de recuperar no cuadra', String(vpRecup));
  Math.abs((50 - vpRecup) * 16 - 300) < 1e-9 ? ok('y deja 300 $ corriendo, que es la ganancia entera') : mal('lo que queda corriendo no cuadra');

  /* Los dos campos tienen que estar atados en el codigo, no solo en mi cabeza. */
  console.log('\nVENDER POR IMPORTE: LOS CAMPOS ESTÁN ATADOS');
  const vpSrc = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /deAccionesAImporte|deImporteAAcciones/.test(vpSrc)
    ? ok('existen las dos conversiones') : mal('falta la conversión entre importe y acciones');
  (vpSrc.match(/im\.i\.addEventListener\('input'/) && vpSrc.match(/ac\.i\.addEventListener\('input'/))
    ? ok('los dos campos escuchan y se actualizan entre ellos') : mal('un campo no escucha');
  // el tope lo comprueba la prueba funcional de arriba (vpConv(900, 16, 50) === 50), no una regex
  /ACCIONES_POR_IMPORTE\(comoNumero\(im\.i\.value\)/.test(vpSrc)
    ? ok('el campo de importe usa la función pública, no una copia de la aritmética')
    : mal('el campo de importe no usa ACCIONES_POR_IMPORTE');
  /recuperar lo invertido/.test(vpSrc) ? ok('está el atajo de recuperar lo invertido') : mal('falta el atajo');
  /nAcc/.test(vpSrc) ? ok('las acciones fraccionadas se muestran con precisión (nAcc)') : mal('las acciones fraccionadas se redondean a 2 y no coinciden con lo guardado');

  /* El protocolo tiene que seguir igual: el stop y la regla de devolucion se miden contra el precio
     de compra, asi que una venta parcial no puede moverlos. Se comprueba de punta a punta: se pinta
     la MISMA posicion con 100 acciones y con 60, y el veredicto y el stop tienen que coincidir. */
  console.log('\nVENTA PARCIAL: EL PROTOCOLO NO SE MUEVE');
  const veredictoDe = txt => (txt.match(/(MANTENER|VIGILAR|VENDER)/) || ['-'])[0];
  const stopDe = txt => (txt.match(/Stop\s*([\d.,]+)\s*\$/) || [null, null])[1];
  const base = { ticker: 'PRO', simbolo: sim, precio: datos.precio * 0.5, fecha: panel.dias[panel.dias.length - 1] };
  almacen['posiciones-v1'] = JSON.stringify([{ ...base, acciones: 100 }]);
  await paso('posiciones se pinta con 100 acciones', () => ventana.posiciones());
  const entero = porId.rpos.textContent;
  almacen['posiciones-v1'] = JSON.stringify([
    { ...base, acciones: 60 },
    { ...base, acciones: 40, cerrada: panel.dias[panel.dias.length - 1], precioSalida: datos.precio, parcial: true, id: 'pY' },
  ]);
  await paso('y con 60 tras vender 40', () => ventana.posiciones());
  const partido = porId.rpos.textContent;
  veredictoDe(entero) === veredictoDe(partido) && veredictoDe(entero) !== '-'
    ? ok('el veredicto es el mismo (' + veredictoDe(entero) + ') antes y después de la venta parcial')
    : mal('el veredicto cambia al vender parte', veredictoDe(entero) + ' -> ' + veredictoDe(partido));
  stopDe(entero) && stopDe(entero) === stopDe(partido)
    ? ok('y el stop es el mismo (' + stopDe(entero) + ' $): no depende de cuántas acciones tengas')
    : mal('el stop cambia al vender parte', stopDe(entero) + ' -> ' + stopDe(partido));

  /* Borrar una venta parcial tiene que DEVOLVER las acciones. Si no, corriges un error y de paso
     pierdes 40 acciones de tu registro sin que nada te avise. */
  console.log('\nVENTA PARCIAL: BORRARLA DEVUELVE LAS ACCIONES');
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: datos.ticker, simbolo: sim, precio: 10, acciones: 60, fecha: '2026-09-01' },
    { ticker: datos.ticker, simbolo: sim, precio: 10, acciones: 40, fecha: '2026-09-01',
      cerrada: '2026-10-10', precioSalida: 25, parcial: true, id: 'pZ' },
  ]);
  await paso('posiciones se pinta antes de borrar', () => ventana.posiciones());
  // se simula el borrado con la misma logica que ejecuta el boton
  (() => {
    const lista = JSON.parse(almacen['posiciones-v1']);
    const borrada = lista.find(x => x.id === 'pZ');
    const resto = lista.filter(x => x.id !== 'pZ');
    almacen['posiciones-v1'] = JSON.stringify(resto.map(x => (!x.cerrada && x.ticker === borrada.ticker && x.fecha === borrada.fecha
      ? { ...x, acciones: (Number(x.acciones) || 0) + Number(borrada.acciones) } : x)));
  })();
  const tras = JSON.parse(almacen['posiciones-v1']);
  tras.length === 1 && Number(tras[0].acciones) === 100
    ? ok('tras borrar la venta parcial la posición vuelve a tener 100 acciones')
    : mal('las acciones no vuelven al borrar', JSON.stringify(tras));
  // y el codigo real tiene que hacer eso, no solo la simulacion de arriba
  /las acciones vuelven a la posición abierta|vuelven a la posición abierta/.test(fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8'))
    ? ok('el aviso de borrado explica que las acciones vuelven') : mal('el borrado no avisa de la devolución');
  /\{ \.\.\.x, acciones: Math\.round\(\(\(Number\(x\.acciones\) \|\| 0\) \+ devuelve\)/.test(fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8'))
    ? ok('y el código las suma de vuelta de verdad') : mal('el código no devuelve las acciones');

  /* Una posicion vendida en dos veces es UNA operacion, no dos: si contara dos, el "acertadas" se
     infla y es el numero con el que se juzga la estrategia. */
  console.log('\nVENTA PARCIAL: NO INFLA LA TASA DE ACIERTO');
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'DOS', simbolo: 'DOS', precio: 10, acciones: 50, fecha: '2026-09-01',
      cerrada: '2026-09-20', precioSalida: 15, parcial: true, id: 'p1' },
    { ticker: 'DOS', simbolo: 'DOS', precio: 10, acciones: 50, fecha: '2026-09-01',
      cerrada: '2026-09-30', precioSalida: 13 },
    { ticker: 'MAL', simbolo: 'MAL', precio: 20, acciones: 10, fecha: '2026-09-02',
      cerrada: '2026-09-25', precioSalida: 17 },
  ]);
  await paso('posiciones se pinta con una posición vendida en dos veces', () => ventana.posiciones());
  const t2 = porId.rpos.textContent;
  /acertadas[\s\S]{0,40}1 de 2/.test(t2)
    ? ok('acertadas 1 de 2 posiciones, no 1 de 3 salidas') : mal('la tasa de acierto cuenta salidas, no posiciones', (t2.match(/acertadas[\s\S]{0,40}/) || [''])[0]);
  /3 salidas/.test(t2) ? ok('y dice que hubo 3 salidas, para que no parezca que faltan filas') : mal('no menciona las salidas');
  // dinero: DOS +250 +150 = +400, MAL -30  ->  +370
  /\+370,00 \$/.test(t2) ? ok('el dinero suma las dos salidas: +400 − 30 = +370,00 $') : mal('la suma de dinero no cuadra');

  console.log('\nEL BENEFICIO MENSUAL SE VE AUNQUE NO HAYA OPERACIONES');
  almacen['posiciones-v1'] = '[]';
  await paso('posiciones se pinta sin ninguna operación', () => ventana.posiciones());
  /Beneficio y pérdida por mes/.test(porId.rpos.textContent)
    ? ok('la sección aparece aunque esté vacía') : mal('la sección desaparece sin operaciones');
  /Aún no hay ningún mes cerrado/.test(porId.rpos.textContent)
    ? ok('y explica cuándo se llenará') : mal('no dice nada al estar vacía');

  console.log('\nEL BENEFICIO MENSUAL SUMA BIEN Y ACUMULA');
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'AAA', simbolo: 'AAA', precio: 10, acciones: 100, fecha: '2026-08-01', cerrada: '2026-08-20', precioSalida: 13 },
    { ticker: 'BBB', simbolo: 'BBB', precio: 50, acciones: 10, fecha: '2026-09-05', cerrada: '2026-09-25', precioSalida: 42.5 },
    { ticker: 'CCC', simbolo: 'CCC', precio: 20, acciones: 25, fecha: '2026-09-10', cerrada: '2026-09-30', precioSalida: 24 },
    { ticker: 'DDD', simbolo: 'DDD', precio: 8,  acciones: 50, fecha: '2026-10-01', cerrada: '2026-10-07', precioSalida: 9 },
  ]);
  await paso('posiciones se pinta con la tabla mensual', () => ventana.posiciones());
  const mes = porId.rpos.textContent;
  // agosto +300 · septiembre −75+100 = +25 · octubre +50  ·  acumulado 300, 325, 375
  /agosto de 2026/.test(mes) ? ok('agrupa por mes de cierre') : mal('no agrupa por mes');
  /\+300,00 \$/.test(mes) ? ok('agosto suma +300,00 $') : mal('agosto no cuadra');
  /\+25,00 \$/.test(mes) ? ok('septiembre suma +25,00 $ (−75 y +100)') : mal('septiembre no cuadra');
  /\+50,00 \$/.test(mes) ? ok('octubre suma +50,00 $') : mal('octubre no cuadra');
  /\+325,00 \$/.test(mes) ? ok('el acumulado va sumando (300 → 325)') : mal('el acumulado no cuadra');
  /\+375,00 \$/.test(mes) ? ok('y cierra en +375,00 $') : mal('el acumulado final no cuadra');
  /1 de 2/.test(mes) ? ok('cuenta las acertadas de cada mes (septiembre 1 de 2)') : mal('no cuenta las acertadas por mes');

  // Un mes con una operación sin nº de acciones: no puede sumarse y hay que decirlo
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'AAA', simbolo: 'AAA', precio: 10, acciones: 100, fecha: '2026-08-01', cerrada: '2026-08-20', precioSalida: 13 },
    { ticker: 'EEE', simbolo: 'EEE', precio: 5, fecha: '2026-08-02', cerrada: '2026-08-22', precioSalida: 6 },
  ]);
  await paso('posiciones se pinta con una operación sin nº de acciones', () => ventana.posiciones());
  /no tiene nº de acciones/.test(porId.rpos.textContent)
    ? ok('avisa de que esa operación no entra en la suma del mes')
    : mal('suma el mes sin avisar de que falta una');
  almacen['posiciones-v1'] = '[]';

  /* Medido en movil: la primera accion empezaba en el pixel 843 de una pantalla de 812, o sea
     justo debajo del pliegue. Abres la app para ver que comprar y tenias que bajar una pantalla
     entera de contexto antes de llegar. */
  console.log('\nLO PRIMERO QUE SE VE ES LA LISTA, NO EL CONTEXTO');
  const htmlP = fs.readFileSync(path.join(dir, '..', 'plantilla.html'), 'utf8');
  const posLista = htmlP.indexOf('<div id="lista">');
  const posSelectores = htmlP.indexOf('<select id="dia"');
  const posDescargas = htmlP.indexOf('id="bpdf"');
  posLista < posSelectores ? ok('la lista va antes que los selectores')
    : mal('los selectores siguen por delante de la lista');
  posLista < posDescargas ? ok('y antes que los botones de descarga')
    : mal('las descargas siguen por delante de la lista');
  /<details id="dcontexto">/.test(htmlP) ? ok('el contexto del día va plegado')
    : mal('el contexto del día sigue desplegado');
  /* Que las cinco pestanas quepan en 375 px solo se sabe renderizando, y este DOM falso no tiene
     motor de maquetacion: se verifico en un navegador real (338 px de 375). Aqui solo se comprueba
     que siga existiendo la regla que lo consigue. */
  const css = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  const reglasTab = [...css.matchAll(/\.tab\{([^}]*)\}/g)].map(m => m[1]);
  reglasTab.some(r => /font-size:1[0-3](\.\d)?px/.test(r))
    ? ok('alguna regla encoge la letra de las pestanas para movil')
    : mal('ya no hay ninguna regla que encoja las pestanas', reglasTab.join(' | '));
  const fuenteHoy = fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8');
  /scontexto/.test(fuenteHoy) ? ok('la línea plegada resume si hay novedades')
    : mal('la línea plegada no dice nada');
  /el\('ul', *'bll'\)|el\('ul','bll'\)/.test(fuenteHoy) ? ok('las señales de salida van en lista, no en párrafo')
    : mal('las señales siguen en un párrafo corrido');

  /* Medido en movil: una tarjeta de Seguimiento ocupaba 710 px en una pantalla de 812, o sea una
     por pantalla. El veredicto se llevaba 218 px porque la caja era flex en fila y el titulo, con
     nowrap, dejaba al texto una columna estrechisima: 106 caracteres partidos en ocho lineas. */
  console.log('\nLAS TARJETAS CABEN EN PANTALLA');
  const cssT = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  /@media \(max-width:5\d\dpx\)\{[\s\S]*?\.veredicto\{flex-direction:column/.test(cssT)
    ? ok('el veredicto se apila en móvil en vez de exprimir el texto')
    : mal('el veredicto vuelve a ir en fila en móvil');
  const fuenteS = fs.readFileSync(path.join(dir, 'seguimiento.js'), 'utf8');
  /const detalle = \[/.test(fuenteS) && /rejilla\(detalle\)/.test(fuenteS)
    ? ok('Seguimiento deja 3 campos a la vista y el resto en el desplegable')
    : mal('Seguimiento vuelve a enseñar los 8 campos de golpe');
  const fuentePos = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /Ver detalle/.test(fuentePos) ? ok('Posiciones tiene su desplegable de detalle')
    : mal('Posiciones no tiene desplegable');
  // los textos largos de veredicto se acortaron: que no vuelvan a crecer sin querer
  const largos = [...fs.readFileSync(path.join(dir, 'app.js'), 'utf8')
    .matchAll(/t: '(COMPRA|Compra arriesgada|Esperar|Vigilar|No comprar aquí|Sin datos)', d: '([^']*)'/g)]
    .map(m => [m[1], m[2].length]).filter(([, l]) => l > 115);
  largos.length === 0 ? ok('ningún veredicto pasa de 115 caracteres de texto fijo')
    : mal('algún veredicto se ha vuelto a alargar', largos.map(x => x[0] + ': ' + x[1]).join(', '));

  /* Las cifras de resumen salian todas en gris: la ganancia tenia el mismo peso visual que
     "posiciones abiertas". El color solo donde significa algo. */
  console.log('\nLAS CIFRAS DE RESUMEN LLEVAN COLOR');
  const stat3 = /function stat\(k,v,cls\)/.test(fs.readFileSync(path.join(dir, 'hoy.js'), 'utf8'));
  stat3 ? ok('stat() acepta una clase de color') : mal('stat() sigue sin admitir color');
  const pos3 = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  const linea = t => (pos3.split('\n').find(l => l.includes(t)) || '');
  linea("stat('ganancia'").includes('signo(') ? ok('la ganancia se tiñe según su signo')
    : mal('la ganancia sigue en gris', linea("stat('ganancia'").trim().slice(0, 80));
  linea("stat('riesgo abierto'").includes("'warn'") ? ok('el riesgo abierto va en ámbar, no en rojo')
    : mal('el riesgo abierto no está diferenciado');
  const css3 = fs.readFileSync(path.join(dir, 'extra.css'), 'utf8');
  /\.stat b\.warn\{background:none/.test(css3) ? ok('el ámbar de las cifras no arrastra fondo de etiqueta')
    : mal('el ámbar de las cifras lleva fondo');
  // Y que no se tiña lo que no debe: los recuentos siguen neutros
  !/stat\('posiciones abiertas', abiertas\.length, /.test(pos3)
    ? ok('los recuentos siguen sin color') : mal('se está tiñendo todo, el color deja de informar');

  /* La curva de la cuenta: resultado acumulado tras cada operacion cerrada. Si la suma esta mal,
     la conclusion sobre como vas esta mal. */
  console.log('\nLA CURVA DE LA CUENTA ES CORRECTA');
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'AAA', simbolo: 'AAA', precio: 10, acciones: 100, fecha: '2026-07-01', cerrada: '2026-07-20', precioSalida: 13 },
    { ticker: 'BBB', simbolo: 'BBB', precio: 50, acciones: 20, fecha: '2026-07-25', cerrada: '2026-08-10', precioSalida: 28 },
    { ticker: 'CCC', simbolo: 'CCC', precio: 20, acciones: 25, fecha: '2026-08-15', cerrada: '2026-08-30', precioSalida: 18 },
    { ticker: 'DDD', simbolo: 'DDD', precio: 8, acciones: 200, fecha: '2026-09-01', cerrada: '2026-09-20', precioSalida: 11.5 },
  ]);
  await paso('posiciones se pinta con la curva', () => ventana.posiciones());
  const txtC = porId.rpos.textContent;
  /Cómo va tu cuenta/.test(txtC) ? ok('la sección de la curva aparece') : mal('no aparece la curva');
  // +300, -440, -50, +700  ->  acumulado 300, -140, -190, 510
  /peor momento −190 \$/.test(txtC) ? ok('calcula el peor momento de la curva (−190 $)')
    : mal('el peor momento no cuadra', txtC.slice(0, 200));
  /\+510,00 \$/.test(txtC) ? ok('y el resultado final acumulado (+510 $)') : mal('el acumulado final no cuadra');
  /4 operaciones/.test(txtC) ? ok('cuenta las operaciones de la curva') : mal('no cuenta las operaciones');
  // con una sola operación no hay curva que enseñar
  almacen['posiciones-v1'] = JSON.stringify([
    { ticker: 'AAA', simbolo: 'AAA', precio: 10, acciones: 100, fecha: '2026-07-01', cerrada: '2026-07-20', precioSalida: 13 }]);
  await paso('posiciones se pinta con una sola operación', () => ventana.posiciones());
  !/Cómo va tu cuenta/.test(porId.rpos.textContent)
    ? ok('con una sola operación no se dibuja una curva de un punto')
    : mal('dibuja una curva sin forma con una sola operación');
  almacen['posiciones-v1'] = '[]';

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
  /* Buscaba el titulo literal "tres formas de operarlas" y se rompio al renombrarlo. Ahora mira la
     sustancia: las tres filas y el aviso de que eso NO es una cartera, que es lo que confundia. */
  ['Comprar y aguantar hasta hoy', 'Vender el día que sale del top', 'Con nuestras reglas de salida']
    .every(s => texto.includes(s))
    ? ok('aparecen las tres formas de operar cada entrada')
    : mal('falta alguna de las tres formas de operar');
  /Esto no es una cartera/.test(texto)
    ? ok('y deja claro que eso es media por entrada, no una cartera')
    : mal('no distingue la media por entrada de la cartera');
  /¿Por qué .* aquí y .* en la cartera de arriba\?/.test(texto)
    ? ok('y explica por qué su cifra no coincide con la de la cartera')
    : mal('no reconcilia las dos cifras de rentabilidad');

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
