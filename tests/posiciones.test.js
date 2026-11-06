/* Pruebas de la parte de Mis posiciones que toca DINERO: la aritmética de ventas parciales y
   promedios, y que lo guardado en el navegador no pueda tumbar la pestaña.
   Sin dependencias: node tests/posiciones.test.js */
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = path.join(__dirname, '../docs');

let fallos = 0, total = 0;
function comprueba(nombre, ok, detalle) {
  total++;
  if (ok) console.log(`  ✓ ${nombre}`);
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? '\n      ' + detalle : ''}`) }
}
const nodo = () => ({
  appendChild() {}, append() {}, prepend() {}, remove() {}, replaceChildren() {},
  style: {}, classList: { add() {}, remove() {}, toggle() {} }, hijos: [],
  set textContent(v) { this._t = v }, get textContent() { return this._t || '' },
  set innerHTML(v) {}, addEventListener() {},
});
function monta(guardado) {
  const ctx = { window: {}, console,
    document: { createElement: nodo, getElementById: () => nodo(), querySelector: () => null },
    localStorage: { _d: { 'posiciones-v1': guardado }, getItem(k) { return this._d[k] ?? null }, setItem(k, v) { this._d[k] = v } } };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'reglas.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8'), ctx);
  return ctx;
}

/* GUARDAR TIENE QUE SER VERIFICADO Y RUIDOSO AL FALLAR.
   Hasta el 06/11/2026 guardarPos era un setItem dentro de un try vacio: si el navegador rechazaba
   la escritura (modo privado, datos del sitio bloqueados, Safari purgando el almacenamiento), la
   app decia que habia guardado y no guardaba nada. El caso peor es restaurar una copia: crees que
   has recuperado tus posiciones justo cuando mas lo necesitas. */
console.log('\nSI EL NAVEGADOR NO DEJA GUARDAR, LA APP TIENE QUE DECIRLO');
{
  const avisos = [];
  const montaRoto = (modo) => {
    const ctx = { window: {}, console,
      document: { createElement: nodo, getElementById: () => nodo(), querySelector: () => null },
      prompt: (msg, txt) => { avisos.push({ msg, txt }); return null },
      localStorage: { _d: { 'posiciones-v1': '[]' },
        getItem(k) { return this._d[k] ?? null },
        setItem(k, v) {
          if (modo === 'excepcion') throw new Error('QuotaExceededError');
          if (modo === 'silencioso') return;          // acepta y no guarda: lo que hace Safari a veces
          this._d[k] = v;
        } } };
    ctx.globalThis = ctx; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(path.join(dir, 'reglas.js'), 'utf8'), ctx);
    vm.runInContext(fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8'), ctx);
    return ctx;
  };
  for (const modo of ['excepcion', 'silencioso']) {
    avisos.length = 0;
    const ctx = montaRoto(modo);
    const ok = vm.runInContext('guardarPos([{ticker:"X",precio:10,fecha:"2026-01-01"}])', ctx);
    comprueba('con el almacenamiento roto (' + modo + ') guardarPos devuelve false', ok === false, String(ok));
    comprueba('  y avisa al usuario en vez de callarse', avisos.length === 1, 'avisos: ' + avisos.length);
    comprueba('  el aviso dice que NO se ha guardado',
      avisos.length > 0 && /NO se ha guardado|NO ESTÁ GUARDANDO/.test(avisos[0].msg), true);
    comprueba('  y le da el texto para que pueda copiarlo',
      avisos.length > 0 && /"ticker":"X"/.test(avisos[0].txt || ''), true);
    /* Doce sitios llaman a guardarPos, algunos al repintar: una alerta por cada uno seria peor
       que el fallo. Se avisa una vez por sesion. */
    vm.runInContext('guardarPos([{ticker:"Y",precio:11,fecha:"2026-01-02"}])', ctx);
    vm.runInContext('guardarPos([{ticker:"Z",precio:12,fecha:"2026-01-03"}])', ctx);
    comprueba('  y NO repite el aviso en cada guardado', avisos.length === 1, 'avisos: ' + avisos.length);
  }
  /* Y cuando el almacenamiento funciona, ni devuelve false ni molesta. */
  avisos.length = 0;
  const bien = montaRoto('ok');
  comprueba('con el almacenamiento sano devuelve true',
    vm.runInContext('guardarPos([{ticker:"X",precio:10,fecha:"2026-01-01"}])', bien) === true);
  comprueba('  y no avisa de nada', avisos.length === 0, 'avisos: ' + avisos.length);
  comprueba('  y lo guardado se puede volver a leer',
    vm.runInContext('leerPos().length', bien) === 1);
}

console.log('\nARITMÉTICA DEL DINERO');
{
  const ctx = monta('[]'), W = ctx.window;
  /* Cuantas acciones salen de un importe. Se recorta al total: no puedes vender mas de las que tienes. */
  comprueba('1.000 $ a 25 $ son 40 acciones', W.ACCIONES_POR_IMPORTE(1000, 25, 100) === 40);
  comprueba('un importe mayor que la posición se recorta al total', W.ACCIONES_POR_IMPORTE(2600, 25, 100) === 100);
  comprueba('importe cero no vende nada', W.ACCIONES_POR_IMPORTE(0, 25, 100) === null);
  comprueba('precio cero no divide por cero', W.ACCIONES_POR_IMPORTE(1000, 0, 100) === null);

  /* Promediar: 100 a 10 mas 100 a 20 son 200 a 15, y 3.000 invertidos. */
  const np = W.NUEVO_PROMEDIO(100, 10, 100, 20);
  comprueba('promediar 100 a 10 + 100 a 20 da 200 a 15 (3.000 $)',
    np && np.acciones === 200 && np.precio === 15 && np.invertido === 3000, JSON.stringify(np));
  comprueba('añadir cero acciones no cambia nada', W.NUEVO_PROMEDIO(100, 10, 0, 20) === null);
  comprueba('añadir a precio cero no vale', W.NUEVO_PROMEDIO(100, 10, 50, 0) === null);
}

console.log('\nVENTAS PARCIALES');
{
  /* Compras 100 a 10 (1.000 $). Vendes 50 a 15 y 50 a 20: cobras 1.750 y ganas 750. */
  const ctx = monta(JSON.stringify([
    { ticker: 'X', fecha: '2026-01-01', acciones: 50, precio: 10, parcial: true, cerrada: true, precioSalida: 15 },
    { ticker: 'X', fecha: '2026-01-01', acciones: 50, precio: 10, parcial: true, cerrada: true, precioSalida: 20 },
  ]));
  const pv = vm.runInContext('partesVendidas({ticker:"X",fecha:"2026-01-01"})', ctx);
  comprueba('suma las acciones vendidas', pv.acciones === 100, String(pv.acciones));
  comprueba('suma lo cobrado (50×15 + 50×20 = 1.750 $)', pv.cobrado === 1750, String(pv.cobrado));
  comprueba('y el beneficio realizado (750 $)', pv.pyl === 750, String(pv.pyl));

  /* Cada venta guarda el precio medio de ESE momento: si despues promedias al alza, el beneficio
     de una venta ya hecha no puede recalcularse con el medio nuevo. */
  const ctx2 = monta(JSON.stringify([
    { ticker: 'Y', fecha: '2026-01-01', acciones: 50, precio: 10, parcial: true, cerrada: true, precioSalida: 15 },
  ]));
  const pv2 = vm.runInContext('partesVendidas({ticker:"Y",fecha:"2026-01-01"})', ctx2);
  comprueba('una venta ya hecha conserva su precio medio, no el de después', pv2.pyl === 250, String(pv2.pyl));

  /* Dos salidas de la misma posicion son UNA operacion: si contaran dos, el "aciertos X de Y" se infla. */
  const g = vm.runInContext('porPosicion([{ticker:"X",fecha:"a"},{ticker:"X",fecha:"a"},{ticker:"Z",fecha:"b"}])', ctx);
  comprueba('dos ventas de la misma posición cuentan como una operación', g.length === 2, String(g.length));
}

console.log('\nLO GUARDADO EN EL NAVEGADOR NO PUEDE TUMBAR LA PESTAÑA');
/* El try/catch solo cubria el JSON roto. Si el contenido era valido pero no un array, o traia
   huecos, los que llaman hacian .some/.filter sobre eso y la pestaña entera se caia: quedarte sin
   ver tus stops con dinero abierto. */
{
  const casos = [
    ['JSON corrupto', '{no es json', 0],
    ['no es un array', '{"a":1}', 0],
    ['null literal', 'null', 0],
    ['un número', '42', 0],
    ['array de números', '[1,2,3]', 0],
    ['array de textos', '["hola"]', 0],
    ['array con huecos', '[null,{"ticker":"X","acciones":10,"precio":5}]', 1],
    ['vacío', '[]', 0],
    ['correcto', '[{"ticker":"X","fecha":"2026-01-01","acciones":100,"precio":10}]', 1],
  ];
  let rotos = 0, malCont = [];
  for (const [nom, guardado, esperadas] of casos) {
    try {
      const ctx = monta(guardado);
      for (const e of ['leerPos()', 'window.tengoPosicion("X")',
                       'partesVendidas({ticker:"X",fecha:"2026-01-01"})', 'porPosicion(leerPos())'])
        vm.runInContext(e, ctx);
      const n = vm.runInContext('leerPos().length', ctx);
      if (n !== esperadas) malCont.push(`${nom}: ${n} en vez de ${esperadas}`);
    } catch (e) { rotos++; malCont.push(`${nom}: ${e.message}`) }
  }
  comprueba('ninguno de los ' + casos.length + ' escenarios corruptos rompe', rotos === 0, malCont.join(' | '));
  comprueba('y cada uno deja el número de posiciones correcto', malCont.length === 0, malCont.join(' | '));
  const src = fs.readFileSync(path.join(dir, 'posiciones.js'), 'utf8');
  /Array\.isArray\(v\)/.test(src) ? comprueba('leerPos comprueba que sea un array', true)
    : comprueba('leerPos comprueba que sea un array', false, 'sin Array.isArray, un objeto guardado tumba la pestaña');
}


console.log('\nSIMULACIÓN: ¿SALTÓ EL STOP, Y QUÉ DÍA?');
/* El panel solo mira el precio de HOY. Si el stop se rompió el martes y abres la app el viernes,
   el martes no existía: la venta se anotaba tres días tarde y a otro precio. SALTO_STOP recorre la
   serie diaria y devuelve el PRIMER cierre que lo rompió. */
{
  /* ACT existe siempre en el navegador (app.js lo declara en su primera linea) y SALTO_STOP lo
     necesita para sacar el ADR de la accion: sin ADR no hay trailing y la funcion calcularia el
     stop de antes del 05/11/2026, que es justo el fallo que se arreglo en esa fecha. Aqui se
     declara porque el test extrae la funcion suelta, sin el resto del fichero. */
  const ctx = { window: {}, console, PRECIOS: null, ACT: {} };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(dir, 'reglas.js'), 'utf8'), ctx);
  const src = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  const i = src.indexOf('window.SALTO_STOP = function'), j = src.indexOf('/* Modo simulación');
  i > 0 && j > i ? comprueba('SALTO_STOP está en app.js', true) : comprueba('SALTO_STOP está en app.js', false);
  /* Serie inventada: compra a 100 el día 1; baja a 96, 90, 80 y 70. */
  ctx.PRECIOS = { '2026-12-01': { X: 100 }, '2026-12-02': { X: 96 }, '2026-12-03': { X: 90 },
                  '2026-12-04': { X: 80 }, '2026-12-05': { X: 70 } };
  ctx.window.__EMAS__ = {};
  vm.runInContext(src.slice(i, j), ctx);
  const S = ctx.window.SALTO_STOP;
  const base = { ticker: 'X', simbolo: 'X', fecha: '2026-12-01', precio: 100 };

  /* Con el stop del sistema: suelo al -15 %, o sea 85. El primer cierre por debajo es 80, el día 4. */
  const sis = S(base);
  comprueba('sin stop propio usa el del sistema y da el día exacto en que se rompió',
    sis && sis.fecha === '2026-12-04' && sis.precio === 80 && sis.mio === false, JSON.stringify(sis));

  /* EL TRAILING TIENE QUE CONTAR AQUI. Serie que sube a 115 y luego cae: con ADR 4,6 el stop se
     queda en 104,42 (dos dias de rango por debajo de 115), asi que la salida real es el cierre de
     103, no el suelo del -15 %. Sin el ADR esta funcion devolvia "nunca saltó" y la simulacion no
     anotaba la venta: una ganancia del +4,4 % que se quedaba sin cobrar y se iba a perdida. */
  {
    ctx.PRECIOS = { '2026-12-01': { Y: 100 }, '2026-12-02': { Y: 110 }, '2026-12-03': { Y: 115 },
                    '2026-12-04': { Y: 103 }, '2026-12-05': { Y: 99 } };
    const posY = { ticker: 'Y', simbolo: 'Y', fecha: '2026-12-01', precio: 100 };
    ctx.ACT = {};
    const sinAdr = S(posY);
    comprueba('sin ADR en ACT no ve la salida del trailing (y por eso ACT importa)',
      sinAdr === null, JSON.stringify(sinAdr));
    ctx.ACT = { Y: { adr: 4.6 } };
    const conAdr = S(posY);
    comprueba('con su ADR sí la ve: sale el día 4 a 103, con la ganancia puesta',
      conAdr && conAdr.fecha === '2026-12-04' && conAdr.precio === 103, JSON.stringify(conAdr));
    comprueba('y el stop que da es el del trailing (104,42), no el suelo del −15 %',
      conAdr && Math.abs(conAdr.stop - 104.42) < 0.01, conAdr && conAdr.stop);
    ctx.PRECIOS = { '2026-12-01': { X: 100 }, '2026-12-02': { X: 96 }, '2026-12-03': { X: 90 },
                    '2026-12-04': { X: 80 }, '2026-12-05': { X: 70 } };
    ctx.ACT = {};
  }

  /* Con MI stop en 95 salta antes, el día 2, y a otro precio: eso es lo que cambia el resultado. */
  const mio = S({ ...base, stopPropio: 95 });
  comprueba('con mi stop en 95 sale antes (día 2 a 96→ no; a 90 el día 3)',
    mio && mio.fecha === '2026-12-03' && mio.precio === 90 && mio.mio === true, JSON.stringify(mio));

  /* Mi stop es FIJO: no sube solo aunque la acción suba. */
  ctx.PRECIOS = { '2026-12-01': { Y: 100 }, '2026-12-02': { Y: 150 }, '2026-12-03': { Y: 120 }, '2026-12-04': { Y: 96 } };
  const fijo = S({ ticker: 'Y', simbolo: 'Y', fecha: '2026-12-01', precio: 100, stopPropio: 97 });
  comprueba('mi stop no sube solo: con Y a 150 y luego a 96, salta en 96 y no antes',
    fijo && fijo.fecha === '2026-12-04' && fijo.precio === 96, JSON.stringify(fijo));
  /* Y el del sistema SÍ sube: con un máximo de +50 % protege el coste, así que sale a 120... */
  const conTrinquete = S({ ticker: 'Y', simbolo: 'Y', fecha: '2026-12-01', precio: 100 });
  comprueba('el del sistema sí sube: con un máximo de +50 % ya protege la compra',
    conTrinquete && conTrinquete.precio === 96 && conTrinquete.stop >= 100, JSON.stringify(conTrinquete));

  /* Si nunca se rompe, no hay venta que anotar. */
  ctx.PRECIOS = { '2026-12-01': { Z: 100 }, '2026-12-02': { Z: 110 }, '2026-12-03': { Z: 120 } };
  comprueba('si nunca salta, devuelve null', S({ ticker: 'Z', simbolo: 'Z', fecha: '2026-12-01', precio: 100 }) === null);

  /* El día de la compra no cuenta: ya estabas dentro. */
  ctx.PRECIOS = { '2026-12-01': { W: 50 }, '2026-12-02': { W: 100 } };
  comprueba('el día de la compra no dispara la venta',
    S({ ticker: 'W', simbolo: 'W', fecha: '2026-12-01', precio: 100, stopPropio: 90 }) === null);

  /* Datos imposibles no rompen ni inventan ventas. */
  const malos = [{ ticker: 'X' }, { ticker: 'X', fecha: '2026-12-01', precio: 0 },
                 { ticker: 'X', fecha: '2026-12-01', precio: -5 }, {}];
  let rotos = 0;
  for (const m of malos) { try { if (S(m) !== null) rotos++ } catch (e) { rotos++ } }
  comprueba('sin fecha o con precio inválido no inventa una venta ni revienta', rotos === 0, rotos + ' casos');
}

console.log('\nEL MODO SIMULACIÓN VIENE APAGADO');
{
  const ctx = { window: {}, console,
    localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null }, setItem(k, v) { this._d[k] = v } } };
  ctx.globalThis = ctx; vm.createContext(ctx);
  const src = fs.readFileSync(path.join(dir, 'app.js'), 'utf8');
  const i = src.indexOf('window.SIMULACION = {'), j = src.indexOf('window.TRINQUETE_EN_SERIE');
  vm.runInContext(src.slice(i, j), ctx);
  /* Cerrar posiciones sin preguntar sobre un registro de dinero real destruiría datos que no se
     pueden reproducir. Tiene que encenderlo el usuario. */
  comprueba('por defecto NO cierra posiciones solo', ctx.window.SIMULACION.leer().auto === false);
  ctx.window.SIMULACION.guardar({ auto: true });
  comprueba('y recuerda que lo has encendido', ctx.window.SIMULACION.leer().auto === true);
  ctx.localStorage._d['simulacion-v1'] = '{roto';
  comprueba('con el ajuste corrupto vuelve a apagado, no a encendido', ctx.window.SIMULACION.leer().auto === false);
}

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
