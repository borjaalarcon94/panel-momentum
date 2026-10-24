/* Pruebas del intervalo de confianza de la pestana Resultados: node tests/resultados.test.js
   Lo que se prueba es que la cifra que acompana a "+X pt frente al S&P 500" sea honesta:
   que agrupe por dia de entrada, que no baile entre repintados y que contenga la media. */
const fs = require('fs'), path = require('path'), vm = require('vm');

const ctx = { window: {}, document: { }, console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../docs/resultados.js'), 'utf8'), ctx);
const intervalo = ctx.intervalo;

let fallos = 0, total = 0;
function comprueba(nombre, ok, detalle) {
  total++;
  if (ok) console.log(`  ✓ ${nombre}`);
  else { fallos++; console.log(`  ✗ ${nombre}${detalle ? '\n      ' + detalle : ''}`) }
}
const fila = (dia, dif) => ({ dia, ret: dif, sp: 0 });

console.log('Intervalo de confianza contra el indice');

comprueba('existe la funcion', typeof intervalo === 'function');

comprueba('con menos de 3 dias devuelve null (no se puede remuestrear)',
  intervalo([fila('d1', 5), fila('d1', 3), fila('d2', 1)]) === null);

const tres = [fila('d1', 5), fila('d2', 3), fila('d3', 1)];
comprueba('con 3 dias ya devuelve intervalo', intervalo(tres) !== null);

const a = intervalo(tres), b = intervalo(tres);
comprueba('es determinista: dos llamadas dan lo mismo',
  a.lo === b.lo && a.hi === b.hi, `${JSON.stringify(a)} vs ${JSON.stringify(b)}`);

const iguales = intervalo([fila('d1', 4), fila('d2', 4), fila('d3', 4), fila('d4', 4)]);
comprueba('si todas las diferencias son iguales, el intervalo colapsa en ese valor',
  Math.abs(iguales.lo - 4) < 1e-9 && Math.abs(iguales.hi - 4) < 1e-9, JSON.stringify(iguales));

const med = v => v.reduce((s, x) => s + x, 0) / v.length;
const datos = [fila('d1', 8), fila('d1', -2), fila('d2', 5), fila('d3', -4), fila('d4', 1), fila('d5', 3)];
const ic = intervalo(datos), m = med(datos.map(x => x.ret));
comprueba('el intervalo contiene la media de la muestra',
  ic.lo <= m && m <= ic.hi, `media ${m.toFixed(2)} fuera de [${ic.lo.toFixed(2)}, ${ic.hi.toFixed(2)}]`);
comprueba('lo <= hi siempre', ic.lo <= ic.hi);

/* El nucleo del arreglo: nueve entradas del mismo dia son UN dia, no nueve observaciones.
   Si se remuestreara por accion, 'dias' valdria 9. */
const mismoDia = Array.from({ length: 9 }, (_, i) => fila('2026-10-05', i));
const otros = [fila('2026-10-06', 2), fila('2026-10-07', 3), fila('2026-10-08', 4)];
const agr = intervalo([...mismoDia, ...otros]);
comprueba('cuenta DIAS de entrada, no acciones: 12 entradas en 4 dias -> dias = 4',
  agr.dias === 4, `dias = ${agr.dias}`);

/* Con todo el peso en un solo dia el intervalo tiene que notar esa concentracion: remuestreando
   4 dias, hay un 1/4 de probabilidad por sorteo de no coger el dia que aporta 9 de las 12 filas. */
const concentrado = intervalo([...Array.from({ length: 9 }, () => fila('dA', 20)),
                               fila('dB', 0), fila('dC', 0), fila('dD', 0)]);
comprueba('un dia que domina la muestra ensancha el intervalo',
  concentrado.hi - concentrado.lo > 10, `ancho ${(concentrado.hi - concentrado.lo).toFixed(1)} pt`);

/* Acepta la clave antigua 'entrada' si falta 'dia': las filas viejas no tienen el campo nuevo. */
const viejo = intervalo([{ entrada: 1, ret: 5, sp: 0 }, { entrada: 2, ret: 3, sp: 0 },
                         { entrada: 3, ret: 1, sp: 0 }]);
comprueba('funciona con filas sin el campo "dia" (histórico antiguo)', viejo !== null && viejo.dias === 3);

/* La diferencia que se remuestrea es ret - sp, no ret a secas. */
const conSp = intervalo([{ dia: 'a', ret: 10, sp: 10 }, { dia: 'b', ret: 10, sp: 10 },
                         { dia: 'c', ret: 10, sp: 10 }]);
comprueba('resta el indice: si la accion y el S&P hacen lo mismo, la diferencia es 0',
  Math.abs(conSp.lo) < 1e-9 && Math.abs(conSp.hi) < 1e-9, JSON.stringify(conSp));

console.log(`\n${total - fallos}/${total} comprobaciones`);
process.exit(fallos ? 1 : 0);
