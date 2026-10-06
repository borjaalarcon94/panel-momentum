/* Pruebas de la puntuación y de los requisitos de entrada: node tests/puntuacion.test.js */
global.window = {};
require('../docs/puntuacion.js');
const PUNTUA = window.PUNTUA;

let fallos = 0, total = 0;
function comprueba(nombre, real, esperado) {
  total++;
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { fallos++; console.log(`  ✗ ${nombre}\n      esperado: ${JSON.stringify(esperado)}\n      obtenido: ${JSON.stringify(real)}`); }
  else console.log(`  ✓ ${nombre}`);
}
function entre(nombre, valor, min, max) {
  total++;
  if (valor >= min && valor <= max) console.log(`  ✓ ${nombre} (${valor})`);
  else { fallos++; console.log(`  ✗ ${nombre}: ${valor} fuera de [${min}, ${max}]`); }
}
// Empresa sana de referencia
const base = {
  ticker: 'TEST', precio: 100, cap: 1e9, volmedio: 1e6, volrel: 1.6, adr: 5, rsi: 65,
  sma200: 70, ema9: 97, ema21: 95, ema50: 85, max52: 101, min52: 50, max1m: 101, max3m: 101,
  ingresos: 40, ingresosq: 50, ingresosfy: 35, ingresostot: 500e6, bpa: 30, bpaq: 60,
  mbruto: 70, margen: 10, fcfm: 15, deudapat: 0.3, caja: 200e6, deuda: 50e6,
  semana: 3, mes: 25, tres: 40, seis: 60, sector: 'Technology Services', ingresosprev: 650e6, acciones: 50e6,
};
const ctx = { fecha: '2026-10-06', spy: { tres: 5, seis: 10 }, sector: { tres: 8, seis: 15 } };
const p = (cambios = {}) => PUNTUA({ ...base, ...cambios }, ctx);

console.log('\nRANGOS Y COHERENCIA');
entre('una empresa excelente puntúa alto', p().total, 80, 100);
entre('la puntuación nunca pasa de 100', p({ ingresos: 300, ingresosq: 400, mbruto: 95, fcfm: 60, tres: 200, seis: 300 }).total, 0, 100);
entre('la puntuación nunca baja de 0', p({ rsi: 90, mes: 200, mbruto: 5, margen: -90, fcfm: -80, ingresos: 20, ingresosq: 20, tres: -50, seis: -60 }).total, 0, 100);
comprueba('los cinco bloques suman 100 como máximo',
  p().partes.reduce((s, x) => s + x.max, 0), 100);
comprueba('ningún bloque supera su máximo',
  p().partes.filter(x => x.p > x.max + 1e-9).length, 0);
comprueba('ningún bloque es negativo',
  p().partes.filter(x => x.p < 0).length, 0);

console.log('\nLA PUNTUACIÓN RESPONDE A LO QUE DEBE');
comprueba('más margen bruto puntúa más', p({ mbruto: 80 }).total > p({ mbruto: 20 }).total, true);
comprueba('crecimiento acelerando puntúa más que desacelerando',
  p({ ingresos: 40, ingresosq: 60 }).total > p({ ingresos: 40, ingresosq: 10 }).total, true);
comprueba('una empresa más pequeña puntúa más', p({ cap: 0.5e9 }).total > p({ cap: 9e9 }).total, true);
comprueba('mejor fuerza relativa puntúa más', p({ tres: 80 }).total > p({ tres: 6 }).total, true);

console.log('\nPENALIZACIONES');
comprueba('estar un 60 % sobre la EMA 50 penaliza', p({ ema50: 62 }).penal.total > 0, true);
comprueba('estar un 30 % sobre la EMA 50 NO penaliza (zona buena)', p({ ema50: 77 }).penal.total, 0);
comprueba('RSI 83 penaliza', p({ rsi: 83 }).penal.total >= 3, true);
comprueba('margen bruto del 10 % penaliza fuerte', p({ mbruto: 10 }).penal.total >= 8, true);
comprueba('la penalización total nunca pasa de 15',
  p({ rsi: 95, ema50: 40, sma200: 30, mes: 300, mbruto: 5 }).penal.total <= 15, true);

console.log('\nRUPTURA CONFIRMADA POR VOLUMEN');
const rup = { max3m: 99.5, max1m: 99.5 };   // el precio (100) rompe máximos
comprueba('ruptura con volumen alto puntúa más que sin volumen',
  p({ ...rup, volrel: 2 }).partes[4].p > p({ ...rup, volrel: 0.5 }).partes[4].p, true);
comprueba('ruptura sin volumen avisa como riesgo',
  p({ ...rup, volrel: 0.5 }).riesgos.some(r => /sin volumen|volumen/.test(r)), true);

console.log('\nDATOS QUE FALTAN: NO SE INVENTA NADA');
const vacio = PUNTUA({ ticker: 'X', precio: 10 }, {});
entre('sin datos, la puntuación es baja pero válida', vacio.total, 0, 40);
comprueba('sin datos no aparecen razones falsas', vacio.razones.length, 0);
comprueba('sin crecimiento se avisa', vacio.riesgos.some(r => /crecimiento/.test(r)), true);
comprueba('con ingresos diminutos, la aceleración no puntúa de más',
  p({ ingresostot: 5e6, ingresos: 400, ingresosq: 900 }).partes[1].p <= p({ ingresos: 40, ingresosq: 50 }).partes[1].p, true);

console.log('\nMISMA ENTRADA, MISMO RESULTADO');
comprueba('la puntuación es determinista', p().total, p().total);
comprueba('no depende del orden de las claves',
  PUNTUA(Object.fromEntries(Object.entries(base).reverse()), ctx).total, p().total);

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) { console.log(`${fallos} FALLOS`); process.exit(1); }
