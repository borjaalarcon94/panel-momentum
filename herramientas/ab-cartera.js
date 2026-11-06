/* LA CARTERA SIMULADA ENTERA, con las reglas de antes y con las de ahora.

   A diferencia de ab-reglas-venta.js, que mide entrada por entrada, esto llama a operandoElPanel(5)
   —la funcion real que pinta la pestaña Resultados— y simula el protocolo completo: 5 huecos, una
   compra al dia siguiente de entrar al top, y el dinero de cada venta se reinvierte en la siguiente.
   Esa reinversion es lo que la medida entrada-por-entrada NO cuenta, y es lo que de verdad pasa.

   Las reglas "de antes" se obtienen parcheando el fuente; se verifica que el parche ha mordido.
   OJO: diasTrailing a 0 NO apaga el trailing, lo pone a distancia cero. Se apaga anulando el adr.

   Uso:  node herramientas/ab-cartera.js        (desde la raiz del repositorio) */
const fs = require('fs'), vm = require('vm');
const pa = JSON.parse(fs.readFileSync('docs/panel.json', 'utf8'));
const pr = JSON.parse(fs.readFileSync('docs/precios.json', 'utf8'));

function corre(modo, huecos) {
  let reglas = fs.readFileSync('docs/reglas.js', 'utf8');
  if (modo === 'antes') reglas = reglas
    .replace('{ desde: 20, limite: 50 }', '{ desde: 999, limite: 50 }')
    .replace('const adr = num(datos && datos.adr);', 'const adr = null;');
  const ctx = { window: {}, document: {}, console, ACT: {} };
  ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(reglas, ctx);
  const R = ctx.window.REGLAS;
  if (modo === 'antes') {
    if (R.limiteDevolucion(25) != null) throw new Error('el escalon del +20 % no se desactivo');
    if (R.stopDe({ precio: 115, ema50: 50, adr: 4.6 }, 100, null, 15) !== 85) throw new Error('el trailing no se apago');
  } else if (R.stopDe({ precio: 115, ema50: 50, adr: 4.6 }, 100, null, 15) <= 100) throw new Error('falta el trailing');
  vm.runInContext(fs.readFileSync('docs/resultados.js', 'utf8'), ctx);
  ctx.HIST = pa.historico; ctx.FH = Object.keys(pa.historico).sort().reverse();
  ctx.ACT = pa.actual; ctx.PRECIOS = pr.dias; ctx.window.__EMAS__ = pr.emas || {};
  return vm.runInContext('operandoElPanel(' + huecos + ')', ctx);
}

const pc = x => (x == null ? '—' : (x >= 0 ? '+' : '') + x.toFixed(2) + ' %');
/* El campo de la rentabilidad de una venta cerrada se llama 'r', no 'ret'. Usar 'ret' daba
   undefined y "0 en ganancia" en una tabla donde habia dos: un numero mal es peor que ninguno. */
const rv = v => (v.r != null ? v.r : v.ret);
const verdes = c => (c.cerradas || []).filter(v => rv(v) > 0).length;

/* El indice en el mismo tramo, para no juzgar la cartera contra el vacio. */
const ses = Object.keys(pa.historico).sort();
const spy0 = (pa.historico[ses[0]] || {}).spy, spy1 = (pa.historico[ses[ses.length - 1]] || {}).spy;
const spy = spy0 && spy1 ? (spy1 / spy0 - 1) * 100 : null;

console.log('CARTERA SIMULADA DE 5 HUECOS, del ' + ses[0] + ' al ' + ses[ses.length - 1] +
            '   (' + ses.length + ' sesiones)');
console.log('el S&P 500 en el mismo tramo: ' + pc(spy));
console.log();
const A = corre('antes', 5), B = corre('ahora', 5);
console.log('                        SIN cambios     CON cambios     diferencia');
const fila = (n, a, b, f) => console.log('  ' + n.padEnd(22) + String(f(a)).padStart(11) + String(f(b)).padStart(16) +
  String(typeof f(a) === 'string' ? '' : '').padStart(0) + '      ' +
  (typeof a === 'object' ? '' : ''));
console.log('  rentabilidad final    ' + pc(A.ret).padStart(11) + pc(B.ret).padStart(16) +
  ('   ' + ((B.ret - A.ret) >= 0 ? '+' : '') + (B.ret - A.ret).toFixed(2) + ' pt'));
console.log('  peor caída por el camino' + pc(-Math.abs(A.caida)).padStart(9) + pc(-Math.abs(B.caida)).padStart(16) +
  ('   ' + ((Math.abs(A.caida) - Math.abs(B.caida)) >= 0 ? '+' : '') + (Math.abs(A.caida) - Math.abs(B.caida)).toFixed(2) + ' pt'));
console.log('  ventas cerradas       ' + String(A.cerradas.length).padStart(11) + String(B.cerradas.length).padStart(16));
console.log('  de ellas en ganancia  ' + String(verdes(A)).padStart(11) + String(verdes(B)).padStart(16));
console.log('  efectivo sin invertir ' + pc(A.caja).padStart(11) + pc(B.caja).padStart(16));
console.log();
for (const [n, c] of [['SIN cambios', A], ['CON cambios', B]]) {
  console.log(n + ':');
  console.log('  vendió: ' + (c.cerradas.length ? c.cerradas.map(v => v.ticker + ' ' + pc(rv(v))).join(', ') : '—'));
  console.log('  lleva:  ' + c.cartera.map(x => x.ticker + ' ' + pc(x.ret)).join(', '));
}

/* EL SUELO DE CADA CARTERA. Hace falta porque cuando una venta cae en la ULTIMA sesion disponible
   las dos carteras valen lo mismo por construccion: vendiste a X y recompraste a X el mismo dia, y
   el valor a cierre es identico. La diferencia no existe todavia, nace mañana y depende de lo que
   haga el precio. Lo que SI se puede medir hoy es cuanto arriesga cada una desde aqui: que valdria
   la cartera si cada posicion abierta tocase su stop. */
function suelo(modo, c) {
  let reglas = fs.readFileSync('docs/reglas.js', 'utf8');
  if (modo === 'antes') reglas = reglas
    .replace('{ desde: 20, limite: 50 }', '{ desde: 999, limite: 50 }')
    .replace('const adr = num(datos && datos.adr);', 'const adr = null;');
  const g = {}; new Function('window', reglas)(g); const R = g.REGLAS;
  const fechas = Object.keys(pr.dias).sort();
  const sim = t => Object.keys(pa.actual).find(k => pa.actual[k].ticker === t);
  let v = c.caja;
  for (const x of c.cartera) {
    const k = sim(x.ticker), d = pa.actual[k] || {};
    const compra = x.ret != null ? x.valor / (1 + x.ret / 100) : x.valor;
    const acc = x.acciones;
    let pico = compra / acc;
    for (const f of fechas) { if (f < x.desde) continue; const q = (pr.dias[f] || {})[k]; if (q > pico) pico = q }
    const st = R.stopDe({ precio: x.ahora, ema50: d.ema50, adr: d.adr }, compra / acc, 0, (pico / (compra / acc) - 1) * 100);
    v += (st != null ? st : 0) * acc;
  }
  return v;
}
const sA = suelo('antes', A), sB = suelo('ahora', B);
console.log('SI MAÑANA CADA POSICIÓN ABIERTA TOCASE SU STOP');
console.log('  SIN cambios: la cartera quedaría en ' + sA.toFixed(2) + ' de 100  (' + pc(sA - 100) + ')');
console.log('  CON cambios: la cartera quedaría en ' + sB.toFixed(2) + ' de 100  (' + pc(sB - 100) + ')');
console.log('  diferencia: ' + ((sB - sA) >= 0 ? '+' : '') + (sB - sA).toFixed(2) + ' puntos de cartera');
console.log();
/* Sensibilidad al numero de huecos: si la conclusion solo vale con 5, no vale. */
console.log('¿DEPENDE DEL NÚMERO DE HUECOS?');
console.log('  huecos   SIN cambios   CON cambios   diferencia');
for (const h of [3, 5, 8, 10]) {
  const a = corre('antes', h), b = corre('ahora', h);
  console.log('  ' + String(h).padStart(5) + pc(a.ret).padStart(14) + pc(b.ret).padStart(14) +
    ('   ' + ((b.ret - a.ret) >= 0 ? '+' : '') + (b.ret - a.ret).toFixed(2) + ' pt').padStart(14));
}
