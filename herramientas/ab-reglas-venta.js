/* A/B DE LAS REGLAS DE VENTA: las de antes del 05/11/2026 contra las de ahora.

   Rehace las 42 entradas del registro dia a dia con REGLAS.recorrido(), que es la MISMA funcion que
   usan Resultados y Seguimiento en el panel. No hay una copia del bucle aqui a proposito: una copia
   es como el 24/10/2026 la misma accion salia a -15,7 % en una tabla y a -5,6 % en otra.

   Las reglas "de antes" se obtienen parcheando el fuente de reglas.js:
     - primer escalon de devolucion en el +30 % (se desactiva el del +20 %)
     - sin trailing
   OJO CON APAGAR EL TRAILING: poner diasTrailing a 0 NO lo apaga, lo pone a distancia cero, o sea
   el stop en el maximo mismo, que es un trailing maximamente apretado. Se apaga anulando el adr
   dentro de stopDe. Medido mal la primera vez, daba 35 cerradas y 22 en verde y parecia un baseline.

   Da DOS medidas, y las dos hacen falta:
     1. lo realizado: que habria pasado ya. Mide el pasado, y el trailing no lo toca.
     2. el suelo: que te llevarias si manaña todas las abiertas tocaran su stop. Mide la proteccion,
        que es para lo que se metio el trailing y lo unico que no puede verse en el pasado.

   Uso:  node herramientas/ab-reglas-venta.js        (desde la raiz del repositorio) */
const fs = require('fs');
const src = fs.readFileSync('docs/reglas.js', 'utf8');

function motor(modo) {
  let t = src;
  if (modo === 'antes') {
    t = t.replace('{ desde: 20, limite: 50 }', '{ desde: 999, limite: 50 }')
         .replace('const adr = num(datos && datos.adr);', 'const adr = null;');
  }
  const g = {}; new Function('window', t)(g);
  const R = g.REGLAS;
  /* Comprobar que el parche ha MORDIDO. Si reglas.js cambia de forma, estos replace fallan en
     silencio y el A/B compararia las reglas nuevas contra si mismas, dando "no cambia nada". */
  if (modo === 'antes') {
    if (R.limiteDevolucion(25) != null) throw new Error('el escalon del +20 % no se ha desactivado');
    if (R.stopDe({ precio: 115, ema50: 50, adr: 4.6 }, 100, null, 15) !== 85) throw new Error('el trailing no se ha apagado');
  } else {
    if (R.limiteDevolucion(25) == null) throw new Error('falta el escalon del +20 %');
    if (R.stopDe({ precio: 115, ema50: 50, adr: 4.6 }, 100, null, 15) <= 100) throw new Error('falta el trailing');
  }
  return R;
}

const pr = JSON.parse(fs.readFileSync('docs/precios.json', 'utf8'));
const pa = JSON.parse(fs.readFileSync('docs/panel.json', 'utf8'));
const en = JSON.parse(fs.readFileSync('docs/entradas.json', 'utf8'));
const dias = pr.dias, emas = pr.emas || {}, act = pa.actual, fechas = Object.keys(dias).sort();

function corre(modo) {
  const R = motor(modo), cerradas = [], abiertas = [];
  for (const s of Object.keys(en)) {
    const e = en[s];
    const i0 = fechas.findIndex(f => f >= e.f); if (i0 < 0) continue;
    const compra = (dias[fechas[i0]] || {})[s]; if (!compra) continue;
    const ses = fechas.filter(f => f > fechas[i0]);
    const adr = (act[s] || {}).adr;
    const x = R.recorrido(compra, ses, f => (dias[f] || {})[s], f => (emas[f] || {})[s], adr);
    const t = s.replace(/^[A-Z]+:/, '');
    if (x.ret != null) { cerradas.push({ t, ret: x.ret, motivo: x.motivo, fecha: x.fecha }); continue }
    let pico = compra, ult = compra;
    for (const f of ses) { const c = (dias[f] || {})[s]; if (c == null) continue; ult = c; if (c > pico) pico = c }
    const d = act[s] || {};
    const stop = R.stopDe({ precio: d.precio != null ? d.precio : ult, ema50: d.ema50, adr }, compra, 0, (pico / compra - 1) * 100);
    abiertas.push({ t, hoy: (ult / compra - 1) * 100, suelo: stop != null ? (stop / compra - 1) * 100 : -100 });
  }
  return { cerradas, abiertas };
}

const A = corre('antes'), B = corre('ahora');
const med = v => v.reduce((s, x) => s + x, 0) / (v.length || 1);
const realizado = x => x.cerradas.map(q => q.ret).concat(x.abiertas.map(q => q.hoy));
const suelo = x => x.cerradas.map(q => q.ret).concat(x.abiertas.map(q => q.suelo));

console.log('ENTRADAS: ' + (A.cerradas.length + A.abiertas.length) + '   sesiones: ' + fechas.length);
console.log('\n1. LO REALIZADO (abiertas a precio de hoy)');
console.log('                     media   en verde   cerradas  cer. en verde');
for (const [n, x] of [['reglas de ANTES', A], ['reglas de AHORA', B]]) {
  const v = realizado(x), c = x.cerradas;
  console.log('  ' + n.padEnd(18) + (med(v) >= 0 ? '+' : '') + med(v).toFixed(2).padStart(6) + ' %' +
    String(v.filter(q => q > 0).length + '/' + v.length).padStart(10) + String(c.length).padStart(11) +
    String(c.filter(q => q.ret > 0).length).padStart(14));
}
console.log('  diferencia: ' + ((med(realizado(B)) - med(realizado(A))) >= 0 ? '+' : '') +
  (med(realizado(B)) - med(realizado(A))).toFixed(2) + ' puntos por entrada');

console.log('\n2. EL SUELO (si mañana todas las abiertas tocaran su stop)');
for (const [n, x] of [['reglas de ANTES', A], ['reglas de AHORA', B]]) {
  const v = suelo(x);
  console.log('  ' + n.padEnd(18) + (med(v) >= 0 ? '+' : '') + med(v).toFixed(2).padStart(6) + ' %' +
    String(v.filter(q => q > 0).length + '/' + v.length).padStart(10) + ' acabarían en verde');
}
console.log('  diferencia: ' + ((med(suelo(B)) - med(suelo(A))) >= 0 ? '+' : '') +
  (med(suelo(B)) - med(suelo(A))).toFixed(2) + ' puntos por entrada');

console.log('\n3. SALIDAS QUE CAMBIAN');
let n = 0;
for (const x of B.cerradas) {
  const v = A.cerradas.find(y => y.t === x.t);
  if (v && Math.abs(v.ret - x.ret) < 0.01) continue;
  n++;
  /* Si con las reglas viejas seguia abierta, se imprime lo que vale HOY. Es el numero que relativiza
     la comparacion: una ganancia cobrada contra una sin cobrar no son lo mismo, y si la posicion
     cerro hace dos sesiones el "habria sido mejor aguantar" lo decide el precio de dos dias. */
  const sigue = A.abiertas.find(y => y.t === x.t);
  console.log('  ' + x.t.padEnd(6) +
    (v ? v.ret.toFixed(1) + ' % (' + v.motivo + ')'
       : 'seguía abierta, hoy ' + (sigue ? (sigue.hoy >= 0 ? '+' : '') + sigue.hoy.toFixed(1) + ' %' : '?')).padEnd(32) +
    '->  ' + x.ret.toFixed(1) + ' % (' + x.motivo + ' el ' + x.fecha + ')' +
    (sigue ? '   [cobrado ' + (x.ret - sigue.hoy >= 0 ? '+' : '') + (x.ret - sigue.hoy).toFixed(1) + ' frente a aguantar]' : ''));
  const resto = fechas.filter(f => f > x.fecha).length;
  if (sigue) console.log('         ' + resto + ' sesiones desde ese cierre: con tan pocas, la comparación es débil');
}
if (!n) console.log('  ninguna');

console.log('\n4. ABIERTAS: suelo garantizado por cada regla');
console.log('          hoy      antes      ahora     gana');
for (const f of B.abiertas.sort((p, q) => q.hoy - p.hoy)) {
  const v = A.abiertas.find(z => z.t === f.t); if (!v) continue;
  const dif = f.suelo - v.suelo;
  console.log('  ' + f.t.padEnd(6) + (f.hoy >= 0 ? '+' : '') + f.hoy.toFixed(1).padStart(6) + ' %' +
    (v.suelo >= 0 ? '+' : '') + v.suelo.toFixed(1).padStart(9) + ' %' +
    (f.suelo >= 0 ? '+' : '') + f.suelo.toFixed(1).padStart(9) + ' %' +
    (dif > 0.05 ? '   +' + dif.toFixed(1) : '      —'));
}
