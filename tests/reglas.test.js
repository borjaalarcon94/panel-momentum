/* Pruebas de las reglas de compra, stop y venta. Sin dependencias: node tests/reglas.test.js
   El workflow las ejecuta antes de publicar: si algo falla, no se publica nada. */
require('../docs/reglas.js');
const { REGLAS } = globalThis;
const R = REGLAS.R;

let fallos = 0, total = 0;
function comprueba(nombre, real, esperado) {
  total++;
  const ok = JSON.stringify(real) === JSON.stringify(esperado);
  if (!ok) { fallos++; console.log(`  ✗ ${nombre}\n      esperado: ${JSON.stringify(esperado)}\n      obtenido: ${JSON.stringify(real)}`); }
  else console.log(`  ✓ ${nombre}`);
}
const req = (fallan = []) => [
  { t: 'Capitalización entre 300 M y 10,0 B', ok: !fallan.includes('cap'), entrada: true },
  { t: 'RSI > 55', ok: !fallan.includes('rsi'), v: '50' },
  { t: 'Ingresos +20 % o más', ok: !fallan.includes('ingresos'), v: '5 %' },
  { t: 'A menos del 20 % de su máximo', ok: !fallan.includes('max'), v: '-30 %' },
];
const evalua = (o) => REGLAS.evaluaPosicion({ requisitos: req(), dias: 10, ...o });
const codigos = r => r.motivos.map(m => m.codigo);

console.log('\nLÍMITE DE DEVOLUCIÓN SEGÚN LO GANADO');
comprueba('con +10 % no se aplica (manda el stop)', REGLAS.limiteDevolucion(10), null);
comprueba('con +29 % tampoco', REGLAS.limiteDevolucion(29), null);
comprueba('con +30 % se vende al devolver la mitad', REGLAS.limiteDevolucion(30), 50);
comprueba('con +99 %, la mitad', REGLAS.limiteDevolucion(99), 50);
comprueba('con +100 % se protege más: 40 %', REGLAS.limiteDevolucion(100), 40);
comprueba('con +500 %, también 40 %', REGLAS.limiteDevolucion(500), 40);

console.log('\nSTOP');
comprueba('recién comprada: la EMA 50 si está dentro del 15 %',
  REGLAS.stopDe({ precio: 100, ema50: 90 }, 100, null), 90);
comprueba('EMA 50 muy lejos: no se arriesga más del 15 %',
  REGLAS.stopDe({ precio: 100, ema50: 60 }, 100, null), 85);
comprueba('con +20 % ganado, el stop sube al precio de compra',
  REGLAS.stopDe({ precio: 120, ema50: 95 }, 100, null), 100);
comprueba('con +20 % y EMA 50 por encima del coste, manda la EMA 50',
  REGLAS.stopDe({ precio: 150, ema50: 130 }, 100, null), 130);
comprueba('el stop NUNCA baja aunque la EMA 50 se hunda',
  REGLAS.stopDe({ precio: 150, ema50: 60 }, 100, 128), 128);
comprueba('sin EMA 50, queda el suelo del 15 %',
  REGLAS.stopDe({ precio: 100 }, 100, null), 85);

console.log('\nCUÁNDO VENDER');
comprueba('sube un 4 % y todo bien: mantener',
  evalua({ datos: { precio: 104, ema50: 95, ema21: 100, rsi: 65 }, compra: 100 }).estado, 'mantener');
comprueba('pierde el stop: vender',
  codigos(evalua({ datos: { precio: 84, ema50: 95, rsi: 60 }, compra: 100 })), ['stop']);
comprueba('RSI por debajo de 45: vender',
  codigos(evalua({ datos: { precio: 110, ema50: 100, rsi: 40 }, compra: 100 })).includes('rsi'), true);
comprueba('subió 25 % y devolvió la mitad: NO vende (ganancia pequeña)',
  evalua({ datos: { precio: 112, ema50: 100, ema21: 108, rsi: 60 }, compra: 100, maxRegistrado: 125 }).estado, 'mantener');
comprueba('subió 60 % y devolvió la mitad: vender',
  codigos(evalua({ datos: { precio: 130, ema50: 105, rsi: 60 }, compra: 100, maxRegistrado: 160 })).includes('devuelto'), true);
comprueba('subió 120 % y devolvió el 45 %: vender',
  codigos(evalua({ datos: { precio: 166, ema50: 150, rsi: 60 }, compra: 100, maxRegistrado: 220, dias: 200 })).includes('devuelto'), true);
comprueba('subió 120 % y solo ha devuelto el 20 %: mantener',
  evalua({ datos: { precio: 196, ema50: 150, ema21: 190, rsi: 60 }, compra: 100, maxRegistrado: 220, dias: 200 }).estado, 'mantener');
comprueba('exactamente +20 %: la protección del coste se activa (decimales)',
  REGLAS.stopDe({ precio: 120, ema50: 95 }, 100, null), 100);
comprueba('exactamente el límite de devolución: vende',
  codigos(evalua({ datos: { precio: 125, ema50: 110, rsi: 60 }, compra: 100, maxRegistrado: 150, dias: 40 })).includes('devuelto'), true);
comprueba('rompe dos requisitos: vender',
  codigos(REGLAS.evaluaPosicion({ datos: { precio: 110, ema50: 100, rsi: 60 }, compra: 100, dias: 5, requisitos: req(['rsi', 'ingresos']) })).includes('requisitos'), true);
comprueba('rompe uno solo: aviso, no venta',
  REGLAS.evaluaPosicion({ datos: { precio: 110, ema50: 100, ema21: 105, rsi: 60 }, compra: 100, dias: 5, requisitos: req(['ingresos']) }).estado, 'vigilar');
comprueba('crecer por encima del techo NO es motivo de venta',
  REGLAS.evaluaPosicion({ datos: { precio: 300, ema50: 200, ema21: 280, rsi: 65 }, compra: 100, dias: 5, requisitos: req(['cap']) }).estado, 'vigilar');

console.log('\nMÁXIMO ALCANZADO (aunque no abras la web)');
comprueba('usa el máximo de 1 mes del mercado si la compra es reciente',
  REGLAS.maximoDesdeCompra({ precio: 100, max1m: 150 }, 80, 100, 20), 150);
comprueba('no usa el de 1 mes si la compra es más antigua',
  REGLAS.maximoDesdeCompra({ precio: 100, max1m: 150 }, 80, 100, 60), 100);
comprueba('usa el de 3 meses dentro de los 90 días',
  REGLAS.maximoDesdeCompra({ precio: 100, max3m: 170 }, 80, 100, 60), 170);

console.log('\nSEÑALES SIN POSICIÓN (seguimiento y top)');
comprueba('por debajo de la EMA 50',
  REGLAS.senalesDeMercado({ precio: 90, ema50: 100, ema21: 95, rsi: 60 }).map(x => x.codigo), ['ema50']);
comprueba('tendencia sana: ninguna señal',
  REGLAS.senalesDeMercado({ precio: 110, ema50: 100, ema21: 105, rsi: 60 }).length, 0);
comprueba('caída fuerte desde el máximo del mes',
  REGLAS.senalesDeMercado({ precio: 80, ema50: 70, ema21: 75, rsi: 60, max1m: 100 }).map(x => x.codigo), ['caida-mes']);

console.log('\nCOHERENCIA ENTRE PESTAÑAS');
const datos = { precio: 100, ema50: 92, ema21: 97, rsi: 60, max1m: 103 };
comprueba('el stop que se ofrece al comprar es el mismo que gestionará la posición',
  REGLAS.stopDeEntrada(datos).stop, REGLAS.stopDe(datos, 100, null));
comprueba('una acción sana no tiene señales de salida en ninguna vista',
  REGLAS.senalesDeMercado(datos).length + REGLAS.evaluaPosicion({ datos, compra: 100, dias: 1, requisitos: req() }).motivos.length, 0);

console.log('\nCASOS LÍMITE');
comprueba('sin datos de precio no se inventa nada',
  REGLAS.evaluaPosicion({ datos: null, compra: 100, dias: 1, requisitos: req() }).estado, 'sindatos');
comprueba('sin precio de compra tampoco',
  REGLAS.evaluaPosicion({ datos: { precio: 100 }, compra: null, dias: 1, requisitos: req() }).estado, 'sindatos');
comprueba('stop de entrada sin datos devuelve nulo', REGLAS.stopDeEntrada({}), null);

/* El stop ya viene recortado al 15 %, asi que comparar su distancia con 15 solo era cierto por el
   redondeo del flotante y marcaba "compra arriesgada" a casi todo. El aviso tiene que mirar la EMA 50. */
console.log('\nAVISO DE STOP SIN NIVEL TECNICO (TOPE)');
const tope = (precio, ema50) => REGLAS.stopDeEntrada({ precio, ema50, ema21: 0 });
comprueba('la EMA 50 dentro del 15 %: el stop es tecnico', tope(100, 90).tope, false);
comprueba('la EMA 50 justo al 15 %: todavia es tecnico, no lo decide el redondeo', tope(100, 85).tope, false);
comprueba('la EMA 50 mas lejos del 15 %: el stop es un tope fijo', tope(100, 79).tope, true);
comprueba('con el tope, el stop se queda exactamente en la perdida maxima',
  Math.round(tope(100, 79).stop * 1e6) / 1e6, 85);
comprueba('sin EMA 50 no se inventa el aviso', tope(100, null).tope, false);
comprueba('la distancia a la EMA 50 se publica para poder explicarlo',
  Math.round(tope(100, 79).distanciaEma50 * 10) / 10, -21);

/* Pasados 90 dias, el maximo alcanzado solo salia de lo que la web hubiera visto al abrirse: en una
   posicion larga con mucha ganancia la regla de devolucion se quedaba ciega, que es justo donde mas
   falta hace. Ahora entra tambien el cierre mas alto de la serie diaria guardada. */
console.log('\nEL MÁXIMO ALCANZADO NO DEPENDE DE CUÁNDO ABRISTE LA APP');
const lejos = { precio: 150, max1m: 160, max3m: 220 };
comprueba('a los 89 días el máximo de 3 meses aún cuenta',
  REGLAS.maximoDesdeCompra(lejos, 100, 150, 89), 220);
comprueba('a los 91 días, sin serie, se queda con lo último visto',
  REGLAS.maximoDesdeCompra(lejos, 100, 150, 91), 150);
comprueba('a los 91 días, con la serie, recupera el pico real',
  REGLAS.maximoDesdeCompra(lejos, 100, 150, 91, 220), 220);
comprueba('a los 200 días también',
  REGLAS.maximoDesdeCompra(lejos, 100, 150, 200, 220), 220);
comprueba('la serie nunca rebaja un máximo ya guardado',
  REGLAS.maximoDesdeCompra(lejos, 100, 240, 200, 180), 240);
comprueba('sin serie no se rompe nada', REGLAS.maximoDesdeCompra(lejos, 100, 150, 200, null), 150);

// Y lo que de verdad importa: que el veredicto cambie por ello.
const posicion = (maxSerie) => REGLAS.evaluaPosicion({
  datos: { precio: 150, ema50: 140, ema21: 145, rsi: 60, max1m: 160, max3m: 220 },
  compra: 100, maxRegistrado: 150, stopPrevio: 0, dias: 200, requisitos: req(), maxSerie });
comprueba('sin la serie, una posición que devolvió el 58 % dice mantener', posicion(null).estado, 'mantener');
comprueba('con la serie, la misma posición dice vender', posicion(220).estado, 'vender');
comprueba('y el motivo es la devolución',
  posicion(220).motivos.some(m => m.codigo === 'devuelto'), true);

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) { console.log(`${fallos} FALLOS`); process.exit(1); }
