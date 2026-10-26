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

console.log('ARITMÉTICA DEL DINERO');
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

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
process.exit(fallos ? 1 : 0);
