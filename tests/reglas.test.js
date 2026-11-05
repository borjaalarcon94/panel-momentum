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
  { t: 'Capitalización > 300 M', ok: !fallan.includes('cap'), v: '120 M', entrada: true },
  { t: 'RSI > 55', ok: !fallan.includes('rsi'), v: '50' },
  { t: 'Ingresos +20 % o más', ok: !fallan.includes('ingresos'), v: '5 %' },
  { t: 'A menos del 20 % de su máximo', ok: !fallan.includes('max'), v: '-30 %' },
];
const evalua = (o) => REGLAS.evaluaPosicion({ requisitos: req(), dias: 10, ...o });
const codigos = r => r.motivos.map(m => m.codigo);

console.log('\nLÍMITE DE DEVOLUCIÓN SEGÚN LO GANADO');
comprueba('con +10 % no se aplica (manda el stop)', REGLAS.limiteDevolucion(10), null);
/* Desde el 05/11/2026 hay un escalon en +20 %: con +29 % SI hay limite. El motivo, en reglas.js:
   el primero estaba en +30 % y solo 1 de 39 entradas llegaba ahi, asi que el sistema habia cerrado
   15 operaciones, las 15 en perdida, y ninguna por devolucion. */
comprueba('con +19 % tampoco (sigue mandando el stop)', REGLAS.limiteDevolucion(19), null);
comprueba('pero con +20 % ya hay límite', REGLAS.limiteDevolucion(20), 50);
comprueba('y con +29 % también', REGLAS.limiteDevolucion(29), 50);
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
/* Hasta el 05/11/2026 esta comprobacion exigia 'mantener', y eso codificaba el SILENCIO: el sistema
   no vendia y tampoco decia nada, aunque la posicion llevase 13 puntos devueltos desde su maximo.
   Lo que importa sigue siendo que NO VENDE con una ganancia pequeña; que ademas avise es el arreglo,
   no una regresion. Se comprueban las dos cosas por separado. */
/* Antes esta comprobacion exigia que NO vendiera: era el agujero. Subir un 25 % y devolver la
   mitad son 12,5 puntos, casi tres dias de rango de estas acciones: no es ruido, es que se ha dado
   la vuelta. Desde el escalon del +20 % se vende, y es la primera toma de beneficio del sistema. */
{
  const ev25 = evalua({ datos: { precio: 112, ema50: 100, ema21: 108, rsi: 60 }, compra: 100, maxRegistrado: 125 });
  comprueba('subió 25 % y devolvió la mitad: AHORA SÍ vende', codigos(ev25).includes('devuelto'), true);
  comprueba('y lo hace en ganancia, no en pérdida', ev25.gan > 0, true);
  const ev19 = evalua({ datos: { precio: 109, ema50: 100, ema21: 108, rsi: 60 }, compra: 100, maxRegistrado: 119 });
  comprueba('pero con un pico de +19 % no vende: ahí la devolución sería ruido', codigos(ev19).includes('devuelto'), false);
}
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

/* max1m y max3m son maximos INTRADIA y el stop solo actua con cierres: medir la devolucion desde una
   mecha adelantaba la venta varios puntos. Con datos reales esa mecha esta un 6 % por encima de media
   y llega al 18 %. Cuando hay serie de cierres, manda ella. */
console.log('\nLA DEVOLUCIÓN SE MIDE EN CIERRES, NO EN MECHAS INTRADÍA');
const mecha = { precio: 100, max1m: 118, max3m: 118 };   // cerro a 110, pero hizo mecha a 118
comprueba('sin serie, la mecha intradía manda (no hay nada mejor)',
  REGLAS.maximoDesdeCompra(mecha, 80, 80, 20, null), 118);
comprueba('con serie de cierres, manda el cierre más alto',
  REGLAS.maximoDesdeCompra(mecha, 80, 80, 20, 110), 110);
comprueba('la serie no rebaja un máximo ya registrado en maxVisto',
  REGLAS.maximoDesdeCompra(mecha, 80, 125, 20, 110), 125);
// Lo que cambia para ti: con la mecha, la devolucion sale inflada y vendes antes.
const conMecha = REGLAS.evaluaPosicion({ datos: mecha, compra: 50, maxRegistrado: 50, stopPrevio: 0,
  dias: 20, requisitos: req(), maxSerie: null });
const conCierre = REGLAS.evaluaPosicion({ datos: mecha, compra: 50, maxRegistrado: 50, stopPrevio: 0,
  dias: 20, requisitos: req(), maxSerie: 110 });
comprueba('medido en mechas, la ganancia máxima sale inflada', Math.round(conMecha.ganMax), 136);
comprueba('medido en cierres, es la real', Math.round(conCierre.ganMax), 120);
conMecha.devuelto > conCierre.devuelto
  ? comprueba('y por tanto en mechas devuelves más y vendes antes', true, true)
  : comprueba('y por tanto en mechas devuelves más y vendes antes', false, true);

// Y lo que de verdad importa: que el veredicto cambie por ello.
const posicion = (maxSerie) => REGLAS.evaluaPosicion({
  datos: { precio: 150, ema50: 140, ema21: 145, rsi: 60, max1m: 160, max3m: 220 },
  compra: 100, maxRegistrado: 150, stopPrevio: 0, dias: 200, requisitos: req(), maxSerie });
comprueba('sin la serie, una posición que devolvió el 58 % dice mantener', posicion(null).estado, 'mantener');
comprueba('con la serie, la misma posición dice vender', posicion(220).estado, 'vender');
comprueba('y el motivo es la devolución',
  posicion(220).motivos.some(m => m.codigo === 'devuelto'), true);

/* 14/10/2026: al quitar el techo, el requisito de capitalizacion solo puede romperse por abajo.
   El aviso existia como 'crecida' ("ha superado el techo") y habria dado el mensaje al reves. */
console.log('\nCAPITALIZACIÓN ROTA EN UNA POSICIÓN ABIERTA');
const rc = evalua({ requisitos: req(['cap']), datos: { precio: 110, ema50: 100, ema21: 105, rsi: 60 }, compra: 100 });
comprueba('avisa, no vende', rc.motivos.map(m => m.codigo), []);
comprueba('el estado es vigilar', rc.estado, 'vigilar');
comprueba('el aviso es de capitalización y lleva el valor',
          rc.avisos.filter(a => a.codigo === 'capitalizacion'), [{ codigo: 'capitalizacion', valor: '120 M' }]);
comprueba('ya no existe el aviso antiguo "crecida"', rc.avisos.some(a => a.codigo === 'crecida'), false);
comprueba('romper solo la capitalización no cuenta como "un requisito roto" (es de entrada)',
          rc.avisos.some(a => a.codigo === 'un-requisito'), false);

/* 16/10/2026: con el precio por DEBAJO de su EMA 50, el stop de entrada sale por ENCIMA del precio.
   No es un stop: entrarias ya saltado. Pasaba con 7 de las 36 seguidas y la web mostraba
   "Stop del sistema: 9,28 $ (+5 %)", un porcentaje positivo que se lee como si fuera un stop normal. */
console.log('\nSTOP DE ENTRADA INVÁLIDO CUANDO EL PRECIO PIERDE LA EMA 50');
const sInv = REGLAS.stopDeEntrada({ precio: 8.88, ema50: 9.28, ema21: 9 });
comprueba('se marca como inválido', sInv.invalido, true);
comprueba('y la distancia sale positiva, que es la señal del problema', sInv.distancia > 0, true);
const sOk = REGLAS.stopDeEntrada({ precio: 200.5, ema50: 180, ema21: 190 });
comprueba('con el precio sobre la EMA 50 es válido', sOk.invalido, false);
comprueba('y la distancia es negativa', sOk.distancia < 0, true);
comprueba('justo en la EMA 50 también es inválido (stop = precio, margen cero)',
          REGLAS.stopDeEntrada({ precio: 100, ema50: 100 }).invalido, true);
comprueba('un céntimo por encima ya es válido',
          REGLAS.stopDeEntrada({ precio: 100.01, ema50: 100 }).invalido, false);
/* El tamaño de posición ya devolvía null con distancia positiva, así que el dinero nunca estuvo en
   juego. Se comprueba para que siga siendo así. */
comprueba('con el stop inválido no se puede calcular distancia negativa', sInv.distancia < 0, false);

/* "Compra arriesgada" salta cuando el precio esta a mas del 15 % de su EMA 50: ahi el tope muerde y
   el stop deja de ser un nivel tecnico. El precio al que deja de serlo no es una opinion, es
   EMA 50 x 1,15 exactamente. */
console.log('\nPRECIO AL QUE LA COMPRA DEJA DE SER ARRIESGADA');
const eArr = REGLAS.stopDeEntrada({ precio: 15.60, ema50: 13.00 });
comprueba('a 20 % sobre su EMA 50, el tope muerde', eArr.tope, true);
comprueba('y la entrada sin tope son 14,95 $ (13,00 x 1,15)', Math.round(eArr.precioSinTope * 100) / 100, 14.95);
comprueba('que es un 4,2 % por debajo del precio de hoy', Math.round(eArr.retrocesoNecesario * 10) / 10, -4.2);
const eOk = REGLAS.stopDeEntrada({ precio: 200.5, ema50: 180 });
comprueba('a 11,4 % el tope no muerde', eOk.tope, false);
comprueba('y la entrada sin tope queda POR ENCIMA del precio: ya estás dentro del rango',
          eOk.precioSinTope > 200.5, true);
comprueba('el umbral es exactamente la pérdida máxima declarada',
          Math.round(REGLAS.stopDeEntrada({ precio: 100, ema50: 100 }).precioSinTope * 100) / 100,
          Math.round(100 * (1 + R.perdidaMaxima / 100) * 100) / 100);
comprueba('sin EMA 50 no se inventa un precio', REGLAS.stopDeEntrada({ precio: 10 }).precioSinTope, null);

/* 18/10/2026: se pintaba "Sobre su EMA 50" con (ema50/precio - 1) negado, que NO es lo mismo que
   (precio/ema50 - 1). Con PAYS daba 11,70 % cuando el real era 13,25 %: 1,55 puntos de menos, y ese
   numero es justo el que dice si la compra esta estirada. */
console.log('\nCUANTO ESTA EL PRECIO SOBRE SU EMA 50');
const sE = REGLAS.stopDeEntrada({ precio: 14.80, ema50: 13.0682 });
comprueba('se calcula precio/ema50, no al reves', Math.round(sE.sobreEma50 * 100) / 100, 13.25);
comprueba('y NO coincide con la distancia del stop, que es el otro sentido',
          Math.round(Math.abs(sE.distancia) * 100) / 100, 11.70);
comprueba('las dos difieren: no son intercambiables', sE.sobreEma50 > Math.abs(sE.distancia), true);
comprueba('con el precio justo en su EMA 50, cero',
          REGLAS.stopDeEntrada({ precio: 100, ema50: 100 }).sobreEma50, 0);
comprueba('con el precio por debajo, sale negativo',
          REGLAS.stopDeEntrada({ precio: 90, ema50: 100 }).sobreEma50 < 0, true);
comprueba('sin EMA 50 no se inventa', REGLAS.stopDeEntrada({ precio: 10 }).sobreEma50, null);
// el doble: 50 % sobre la EMA 50 son 50, no 33
comprueba('un precio al doble de su EMA 50 son +100 %, no +50 %',
          REGLAS.stopDeEntrada({ precio: 200, ema50: 100 }).sobreEma50, 100);

/* Rejilla sobre evaluaPosicion: el camino de las posiciones abiertas, donde esta el dinero de
   verdad. La auditoria del 16/10 hizo 216 simulaciones sobre datos reales; esto barre el espacio
   entero, incluidos los estados que los datos de hoy no producen. */
console.log('\nREJILLA SOBRE LAS POSICIONES ABIERTAS');
{
  const req = (rotos) => [
    { t: 'Capitalización > 300 M', ok: !rotos.includes('cap'), entrada: true, v: '120 M' },
    { t: 'Precio > 2 $', ok: true, entrada: true, v: '10,00 $' },
    { t: 'Precio sobre la media de 200 días', ok: !rotos.includes('sma'), v: '-' },
    { t: 'EMA 9 sobre EMA 50', ok: !rotos.includes('ema'), v: '-' },
    { t: 'RSI > 55', ok: !rotos.includes('rsi'), v: '50' },
    { t: 'A menos del 20 % de su máximo', ok: !rotos.includes('max'), v: '-30 %' }];
  const estados = {}, codigos = {}, malos = [];
  let n = 0;
  for (const fp of [0.70, 0.86, 0.95, 1.05, 1.25, 1.60, 2.20])        // precio / compra
    for (const fe of [0.70, 0.90, 0.99, 1.10])                        // ema50 / precio
      for (const rsiV of [30, 44, 46, 60, 80])
        for (const fmax of [1.0, 1.15, 1.8, 2.6])                     // maximo visto / compra
          for (const rotos of [[], ['cap'], ['rsi'], ['sma', 'ema']])
            for (const dres of [null, 5, 40]) {
              const compra = 100, precio = compra * fp, ema50 = precio * fe;
              const datos = { precio, ema50, ema21: ema50 * 1.03, rsi: rsiV,
                max1m: compra * fmax, max3m: compra * fmax };
              const ev = REGLAS.evaluaPosicion({ datos, compra, maxRegistrado: compra * fmax,
                dias: 40, requisitos: req(rotos), diasResultados: dres, maxSerie: compra * fmax });
              n++;
              estados[ev.estado] = (estados[ev.estado] || 0) + 1;
              [...ev.motivos, ...ev.avisos].forEach(m => { codigos[m.codigo] = (codigos[m.codigo] || 0) + 1 });
              const et = `p=${precio.toFixed(0)} ema=${ema50.toFixed(0)} rsi=${rsiV}`;
              // 1. estado y contenido no se contradicen
              if (ev.estado === 'vender' && !ev.motivos.length) malos.push(et + ': VENDER sin motivo');
              if (ev.estado === 'vigilar' && (ev.motivos.length || !ev.avisos.length)) malos.push(et + ': VIGILAR incoherente');
              if (ev.estado === 'mantener' && (ev.motivos.length || ev.avisos.length)) malos.push(et + ': MANTENER con motivos o avisos');
              // 2. por debajo del stop, siempre vender
              if (ev.stop != null && precio < ev.stop && ev.estado !== 'vender') malos.push(et + ': bajo el stop y no dice vender');
              // 3. el tope del 15 % se respeta
              if (ev.stop != null && ev.stop < compra * 0.85 - 1e-9) malos.push(et + ': stop por debajo del 15 % de la compra');
              // 4. con +20 % de ganancia el stop protege el coste
              if (ev.stop != null && (precio / compra - 1) * 100 >= 20 && ev.stop < compra - 1e-9) malos.push(et + ': ganando y el stop bajo la compra');
              // 5. el trinquete aguanta
              const ev2 = REGLAS.evaluaPosicion({ datos, compra, maxRegistrado: compra * fmax,
                stopPrevio: (ev.stop || 0) * 1.08, dias: 40, requisitos: req(rotos), diasResultados: dres, maxSerie: compra * fmax });
              if (ev.stop != null && ev2.stop != null && ev2.stop < ev.stop - 1e-9) malos.push(et + ': el stop BAJA con stopPrevio mayor');
              // 6. nada no finito
              if ([ev.stop, ev.gan, ev.ganMax, ev.devuelto].some(x => x != null && !isFinite(x))) malos.push(et + ': valor no finito');
              // 7. el limite de devolucion es el de la regla
              const esp = REGLAS.limiteDevolucion(ev.ganMax);
              if (ev.limite !== esp) malos.push(et + `: limite ${ev.limite} y deberia ser ${esp}`);
            }
  comprueba('combinaciones evaluadas (>= 4000)', n >= 4000, true);
  comprueba('los 4 estados son alcanzables',
            ['vender', 'vigilar', 'mantener'].every(e => estados[e] > 0), true);
  /* 'ema50' NO esta en esta lista a proposito: en una posicion abierta el stop siempre es >= EMA 50,
     asi que perderla ya es saltar el stop. La rejilla lo encontro muerto y se quito la rama. El
     codigo sigue vivo en senalesDeMercado, que se comprueba justo debajo. */
  comprueba('ningun motivo ni aviso de posicion abierta queda muerto',
            ['stop', 'rsi', 'devuelto', 'requisitos', 'un-requisito', 'devolviendo', 'ema21', 'resultados', 'capitalizacion']
              .filter(c => !codigos[c]), []);
  comprueba('y «ema50» ya no se emite desde una posicion abierta: seria inalcanzable',
            codigos['ema50'] || 0, 0);
  comprueba('pero sigue vivo para las que NO tienes',
            REGLAS.senalesDeMercado({ precio: 90, ema50: 100, ema21: 95, rsi: 60 }).map(x => x.codigo), ['ema50']);
  comprueba('las 7 invariantes se cumplen en todas', [...new Set(malos)].slice(0, 3), []);
  console.log('      estados: ' + Object.entries(estados).map(([k, v]) => k + ' ' + v).join(', '));
  console.log('      codigos: ' + Object.entries(codigos).map(([k, v]) => k + ' ' + v).join(', '));
}

/* 22/10/2026: la tabla 5 promete "SUPERADO el 20 % de ganancia, el stop sube a tu precio de compra",
   y superado es una vez para siempre. El codigo miraba la ganancia de HOY, asi que una que llego a
   +25 % y cayo a +10 % perdia la proteccion, salvandose solo si la app estuvo abierta aquel dia.
   Eso ataba una regla del sistema a un habito del usuario, y el build caido del 21 lo dejo a la vista. */
console.log('\nLA PROTECCIÓN DEL COSTE MIRA EL MÁXIMO, NO EL DÍA DE HOY');
const pcD = { precio: 110, ema50: 95 };
comprueba('llegó a +30 % y hoy va +10 %: el stop protege la compra',
          REGLAS.stopDe(pcD, 100, null, 30), 100);
comprueba('sin pasarle el máximo se comporta como antes (compatible)',
          REGLAS.stopDe(pcD, 100, null), 95);
comprueba('si nunca pasó de +20 %, manda el suelo del 15 %',
          REGLAS.stopDe(pcD, 100, null, 15), 95);
comprueba('justo en +20 % de máximo ya protege',
          REGLAS.stopDe(pcD, 100, null, 20), 100);
comprueba('el máximo nunca puede rebajar lo de hoy: con +40 % hoy y máximo 5, protege igual',
          REGLAS.stopDe({ precio: 140, ema50: 95 }, 100, null, 5), 100);
comprueba('y el trinquete sigue mandando por encima de todo',
          REGLAS.stopDe(pcD, 100, 103, 30), 103);
/* Y que evaluaPosicion lo use de verdad, no solo que la funcion lo acepte. */
const pcEv = REGLAS.evaluaPosicion({ datos: { precio: 110, ema50: 95, ema21: 108, rsi: 60 },
  compra: 100, maxRegistrado: 130, dias: 30, requisitos: req(), maxSerie: 130 });
comprueba('evaluaPosicion le pasa el máximo: el stop sale en la compra', pcEv.stop, 100);

/* ---- REGLAS.recorrido(): el recorrido de una entrada con las reglas de salida ---- */
console.log('\nRECORRIDO DE UNA ENTRADA');
{
  const corre = (compra, precios, emas) => {
    const f = Object.keys(precios);
    return REGLAS.recorrido(compra, f, d => precios[d], d => (emas || {})[d]);
  };
  const r1 = corre(100, { a: 95, b: 90, c: 80, d: 70 });
  comprueba('el stop corta al perder el suelo de pérdida máxima',
    [r1.motivo, r1.fecha, Math.round(r1.ret)], ['stop', 'c', -20]);
  comprueba('tras cortar, el peor momento con reglas se congela y el de aguantar sigue',
    [Math.round(r1.peorCerrada), Math.round(r1.peor)], [-20, -30]);

  const r2 = corre(100, { a: 105, b: 110, c: 120 });
  comprueba('si nunca salta, no hay salida', [r2.ret, r2.fecha, r2.motivo], [null, null, null]);
  comprueba('y el peor momento es 0 si nunca bajó de la compra', Math.round(r2.peor), 0);

  /* La EMA 50 manda cuando queda por encima del suelo: sin pasarla, el stop seria mas flojo. */
  const r3 = corre(100, { a: 96, b: 96 }, { a: 98, b: 98 });
  comprueba('vende por la EMA 50 aunque no se haya perdido el 15 %',
    [r3.motivo, Math.round(r3.ret)], ['stop', -4]);
  const r4 = corre(100, { a: 96, b: 96 });
  comprueba('y sin EMA 50 esa misma entrada aguanta', r4.motivo, null);

  /* ganMax: superado el umbral de proteccion, el stop sube al coste y ya no baja. */
  const R2 = REGLAS.R;
  const sube = {}, pico = Math.round(100 * (1 + (R2.gananciaProteger + 5) / 100));
  sube.a = pico; sube.b = 99;
  const r5 = corre(100, sube);
  comprueba('superada la ganancia de protección, el stop sube al precio de compra',
    [r5.motivo, Math.round(r5.ret)], ['stop', -1]);

  /* La devolucion maxima corta con ganancia, no con perdida. */
  const alto = Math.round(100 * (1 + 60 / 100));
  const r6 = corre(100, { a: alto, b: 110 });
  comprueba('la devolución máxima corta cuando se devuelve demasiado de lo ganado',
    [r6.motivo, Math.round(r6.ret)], ['devolución', 10]);

  const r7 = corre(100, { a: null, b: null });
  comprueba('los días sin cierre no cuentan ni rompen', [r7.vistos, r7.ret], [0, null]);
  const r8 = corre(0, { a: 50 });
  comprueba('un precio de compra inválido no revienta', [r8.ret, r8.vistos], [null, 0]);
  const r9 = REGLAS.recorrido(100, null, () => 50, () => null);
  comprueba('sin sesiones tampoco', [r9.ret, r9.vistos], [null, 0]);
}

/* AVISO DE GANANCIA MAS PEQUEÑA QUE EL RUIDO.

   Con el escalon del +20 % ya no hay hueco entre la proteccion del coste y la del beneficio. Lo que
   queda por debajo es otra cosa, y es el hallazgo del 05/11/2026: estas acciones se mueven un 4,6 %
   al dia y el pico mediano de una entrada es +5,5 %, o sea 1,2 dias de movimiento. Una ganancia asi
   NO SE PUEDE proteger: por debajo de dos dias de rango cualquier regla salta sola, y por encima la
   devuelve entera antes de dispararse. El aviso lo dice; no vende ni mueve el stop. */
/* LOS DOS CASOS QUE PREGUNTO BORJA, con sus numeros, para que no se puedan mover sin querer. */
console.log('\nUNA AL +15 % Y UNA AL +40 %: QUE HACE EL SISTEMA');
{
  const caso = (pico, ema50) => REGLAS.evaluaPosicion({
    datos: { precio: 100 * (1 + pico / 100), ema50, ema21: ema50, rsi: 60, adr: 4.6 },
    compra: 100, maxRegistrado: 100 * (1 + pico / 100), stopPrevio: 0, dias: 20, requisitos: [],
    maxSerie: 100 * (1 + pico / 100) });
  /* AL +15 %: no hay regla de beneficio (empieza en +20), pero el trailing SI protege. Dos dias de
     rango por debajo de 115 son 104,42, y eso esta por encima de los 100 que pagaste: el stop se
     va ahi y la posicion ya no puede acabar en perdida. Es el cambio del 05/11/2026; antes de el
     esta misma posicion tenia el stop en 88 y podia devolver los 15 puntos enteros mas un 12 %. */
  const q = caso(15, 88);
  comprueba('al +15 % NO hay regla de beneficio', REGLAS.limiteDevolucion(15), null);
  comprueba('pero el trailing deja el stop EN GANANCIA, no en los 88 $ de la EMA', q.stop > 100, true);
  comprueba('y lo deja a dos días de rango del máximo (104,42 $)',
    Math.abs(q.stop - 104.42) < 0.01, true);
  comprueba('ya no avisa de ganancia sin proteger: está protegida',
    q.avisos.some(a => a.codigo === 'ganancia-corta'), false);

  /* AL +40 % manda el trailing, que es MAS APRETADO que la regla de beneficio: esta dejaria caer
     hasta 120 $ (devolver la mitad) y el trailing saca a 127,12 $. Siete puntos mas en el bolsillo.
     Las dos siguen vivas porque la de beneficio protege cuando el ADR se desploma y el trailing,
     calculado sobre un ADR ya pequeño, se pegaria demasiado al precio. */
  const c = caso(40, 95);
  comprueba('al +40 % el stop queda muy por encima de tu compra', c.stop > 100, true);
  comprueba('y manda el trailing (127,12 $), no la EMA ni el suelo',
    Math.abs(c.stop - 127.12) < 0.01, true);
  comprueba('y la regla de beneficio deja devolver la mitad', REGLAS.limiteDevolucion(40), 50);
  comprueba('el trailing es el MAS APRETADO de los dos: 127,12 $ contra los 120 $ de la regla',
    c.stop > 120, true);
  /* Las dos reglas mandan vender a 119,9 $; la de beneficio sola habria esperado hasta ahi. */
  const vende = REGLAS.evaluaPosicion({ datos: { precio: 119.9, ema50: 95, ema21: 95, rsi: 60, adr: 4.6 },
    compra: 100, maxRegistrado: 140, stopPrevio: 0, dias: 20, requisitos: [], maxSerie: 140 });
  comprueba('a 119,9 $ (+19,9 %) manda vender', codigos(vende).includes('devuelto'), true);
  comprueba('y te vas con ganancia, no con pérdida', vende.gan > 0, true);
  /* A 125 $ la regla de beneficio todavia aguantaria, y el trailing ya no: sale con +25 % en vez
     de esperar a que devuelva otros cinco puntos. Esto es exactamente lo que se gano el 05/11. */
  const aguanta = REGLAS.evaluaPosicion({ datos: { precio: 125, ema50: 95, ema21: 95, rsi: 60, adr: 4.6 },
    compra: 100, maxRegistrado: 140, stopPrevio: 0, dias: 20, requisitos: [], maxSerie: 140 });
  comprueba('a 125 $ (+25 %) la regla de beneficio aún no vendería',
    codigos(aguanta).includes('devuelto'), false);
  comprueba('pero el trailing SÍ vende, y se va con +25 % en mano',
    codigos(aguanta).includes('stop'), true);
  comprueba('y la posición queda cerrada, no en vigilar', aguanta.estado, 'vender');
  /* Por encima del stop sigue mandando el aviso de que esta devolviendo. */
  const vigila = REGLAS.evaluaPosicion({ datos: { precio: 127.5, ema50: 95, ema21: 95, rsi: 60, adr: 4.6 },
    compra: 100, maxRegistrado: 140, stopPrevio: 0, dias: 20, requisitos: [], maxSerie: 140 });
  comprueba('a 127,5 $, justo encima del stop, avisa de que está devolviendo',
    vigila.avisos.some(a => a.codigo === 'devolviendo'), true);
  comprueba('y todavía no vende', vigila.motivos.length, 0);
}

/* QUIEN GESTIONA LA POSICION: EL TRAILING O LA REGLA DE DEVOLUCION.
   Esto se fija porque el 05/11/2026 lo escribi al reves en tres sitios (Parametros y los dos
   documentos para la otra app): dije que la devolucion protegia cuando el ADR se desploma. Es lo
   contrario. Un ADR GRANDE aleja el trailing del maximo, asi que es ahi donde el limite de
   devolucion llega antes; con un ADR pequeño el trailing se pega al maximo y manda siempre el.
   El cruce sale de igualar los dos precios de salida:
     devolucion  = maxP - pico * limite / 100       (sobre compra = 100)
     trailing    = maxP * (1 - 2 * adr / 100)
     la devolucion manda si   adr > pico * limite / (2 * (100 + pico))
   Si alguien toca diasTrailing o los escalones, esta tabla cambia y hay que reescribir los tres
   textos. Para eso esta aqui. */
console.log('\nEL REPARTO ENTRE EL TRAILING Y LA DEVOLUCIÓN');
{
  const quien = (pico, adr) => {
    const maxP = 100 + pico, lim = REGLAS.limiteDevolucion(pico);
    if (lim == null) return 'sin regla';
    const dev = maxP - pico * lim / 100;
    const tr = REGLAS.stopDe({ precio: maxP, ema50: 50, adr }, 100, null, pico);
    return dev > tr ? 'devolución' : 'trailing';
  };
  const cruce = pico => pico * REGLAS.limiteDevolucion(pico) / (2 * (100 + pico));
  comprueba('con el ADR típico de aquí (4,6) la devolución gobierna el escalón del +20 %',
    quien(20, 4.6), 'devolución');
  comprueba('y el trailing todo lo de arriba (+30, +40, +60, +100)',
    [30, 40, 60, 100].map(p => quien(p, 4.6)).join(','), 'trailing,trailing,trailing,trailing');
  comprueba('en una acción tranquila (ADR 1,5) manda el trailing incluso al +150 %',
    quien(150, 1.5), 'trailing');
  comprueba('en una muy volátil (ADR 12) manda la devolución desde el +20 %',
    [20, 40, 100].map(p => quien(p, 12)).join(','), 'devolución,devolución,devolución');
  /* Los tres numeros que se imprimen en Parametros y en los documentos. */
  comprueba('el cruce del +20 % está en ADR 4,2 %', Math.abs(cruce(20) - 4.1667) < 0.001, true);
  comprueba('el del +40 %, en 7,1 %', Math.abs(cruce(40) - 7.1429) < 0.001, true);
  comprueba('el del +100 %, en 10,0 %', Math.abs(cruce(100) - 10) < 0.001, true);
  /* Y la formula del cruce es de verdad el punto donde cambia quien manda, no una aproximacion. */
  const exacto = [20, 40, 60, 100, 150].every(p => {
    const c = cruce(p);
    return quien(p, c * 0.99) === 'trailing' && quien(p, c * 1.01) === 'devolución';
  });
  comprueba('la fórmula del cruce es exacta en los cinco picos', exacto, true);
  /* NINGUNA de las dos sobra: cada una gana en alguna parte del espacio real. */
  const picos = [20, 25, 30, 40, 60, 100, 150], adrs = [1, 1.5, 3, 4.6, 8, 12, 20];
  const todos = [];
  for (const p of picos) for (const a of adrs) todos.push(quien(p, a));
  comprueba('el trailing gana en parte del espacio', todos.includes('trailing'), true);
  comprueba('y la devolución en otra: ninguna regla sobra', todos.includes('devolución'), true);
}

console.log('\nAVISO: TIENES GANANCIA Y TODAVÍA NO HAY REGLA QUE LA PROTEJA');
{
  const ev = (compra, hoy, max, adr) => REGLAS.evaluaPosicion({
    datos: { precio: hoy, ema50: compra * 0.8, ema21: compra * 0.8, rsi: 60, adr },
    compra, maxRegistrado: max, stopPrevio: 0, dias: 20, requisitos: [], maxSerie: max });
  const tiene = x => x.avisos.map(a => a.codigo).includes('ganancia-corta');

  /* La linea es DOS DIAS DE RANGO de esa accion, la misma vara que usa el resto del panel. Por
     debajo, la "ganancia" es el vaiven de un dia: no hay nada que proteger ni que decir. La primera
     version avisaba con cualquier ganancia > 0 y dejaba TODAS las posiciones en verde marcadas como
     VIGILAR, que es ruido en pantalla. */
  comprueba('al +4 % con ADR 4,6 no avisa: son menos de dos días de rango', tiene(ev(100, 104, 104, 4.6)), false);
  comprueba('y la posición sigue en MANTENER', ev(100, 104, 104, 4.6).estado, 'mantener');
  comprueba('al +10 % (2,2 días) sí avisa', tiene(ev(100, 110, 110, 4.6)), true);

  /* EL NUMERO DEL AVISO TIENE QUE ESTAR VIVO. Hasta el 05/11/2026 "falta" media los puntos que
     quedaban para que saltase EL AVISO, que es la misma linea que lo dispara: valia exactamente 0
     en los 42 casos en que se emite, la rama que lo imprimia era codigo muerto y el texto caia
     siempre en "el stop subira en cuanto lo haga su EMA 50", que con el trailing es falso. Ahora
     mide los puntos que faltan para que el TRAILING pase tu precio de compra. */
  {
    const avi = (gm, adr) => ev(100, 100 * (1 + gm / 100), 100 * (1 + gm / 100), adr)
      .avisos.find(a => a.codigo === 'ganancia-corta');
    comprueba('el aviso dice en qué ganancia entra el trailing (ADR 4,6 -> +10,13 %)',
      Math.abs(avi(9.5, 4.6).paraTrailing - 10.1321586) < 0.001, true);
    comprueba('y cuántos puntos faltan para eso, que NO es cero',
      Math.abs(avi(9.5, 4.6).falta - 0.6321586) < 0.001, true);
    comprueba('en una tranquila (ADR 1,5) el trailing entra en +3,09 %',
      Math.abs(avi(3.0, 1.5).paraTrailing - 3.0921) < 0.001, true);
    comprueba('en una muy volátil (ADR 8) le faltan 3 puntos enteros',
      Math.abs(avi(16, 8).falta - 3.0476) < 0.001, true);
    /* La linea que calcula paraTrailing es la misma que decide si el stop sube: tienen que cuadrar. */
    const cuadra = [1.5, 3, 4.6, 8, 12].every(adr => {
      const u = (R.diasTrailing * adr) / (1 - R.diasTrailing * adr / 100);
      const justoAntes = REGLAS.stopDe({ precio: 100 * (1 + (u - 0.05) / 100), ema50: 50, adr }, 100, null, u - 0.05);
      const justoDespues = REGLAS.stopDe({ precio: 100 * (1 + (u + 0.05) / 100), ema50: 50, adr }, 100, null, u + 0.05);
      return justoAntes <= 100 && justoDespues > 100;
    });
    comprueba('el umbral que anuncia el aviso es EXACTAMENTE donde el stop empieza a subir', cuadra, true);
  }
  comprueba('y no vende', ev(100, 110, 110, 4.6).motivos.length, 0);

  /* LA FRANJA DEL AVISO ES ESTRECHA A PROPOSITO, y desde el trailing lo es mucho mas. El aviso dice
     una cosa concreta: "tienes una ganancia de verdad (dos dias de rango) y NADA la protege". En
     cuanto el trailing puede subir el stop por encima de tu compra deja de ser cierto, y el aviso
     calla. Las dos lineas salen del mismo numero, 2 ADR, asi que la franja es de un punto o dos.
     No es codigo muerto: es el borde exacto, y si alguien mueve una de las dos lineas sin la otra
     estas comprobaciones lo cazan. */
  comprueba('al +15 % ya NO avisa, porque el trailing lo protege', tiene(ev(100, 115, 115, 4.6)), false);
  comprueba('y el stop de ese +15 % está en ganancia', ev(100, 115, 115, 4.6).stop > 100, true);

  /* Es PROPORCIONAL a la volatilidad: en una accion tranquila un +4 % ya es una ganancia real, y
     ahi el trailing llega antes todavia, asi que la protege sin pasar por el aviso. */
  comprueba('en una acción tranquila (ADR 1,5) el +4 % ya está protegido',
    ev(100, 104, 104, 1.5).stop > 100, true);
  comprueba('y el +2 % ni avisa ni se protege: es ruido', tiene(ev(100, 102, 102, 1.5)), false);
  comprueba('ese +2 % deja el stop donde estaba', ev(100, 102, 102, 1.5).stop, 85);

  comprueba('por encima del primer escalón no avisa: ahí ya hay regla', tiene(ev(100, 120, 122, 4.6)), false);
  /* Caso que distingue las dos condiciones del codigo: accion tan volatil que un pico del +22 %
     sigue siendo poco rango... pero que YA tiene regla. Sin esto, quitar el "limite == null" pasaba. */
  comprueba('ni en una tan volátil que el +22 % sean 1,8 días: ahí ya hay regla', tiene(ev(100, 120, 122, 12)), false);
  comprueba('sin ADR no se inventa el aviso', tiene(ev(100, 115, 115, null)), false);

  /* DATOS CORRUPTOS. Un ADR negativo invertia la resta del trailing y dejaba el stop POR ENCIMA del
     maximo y del precio de hoy: venta forzada a un precio que no existe. TradingView no deberia
     mandarlo, y por eso mismo pasaba desapercibido. */
  comprueba('un ADR negativo NO sube el stop por encima del máximo',
    REGLAS.stopDe({ precio: 115, ema50: 50, adr: -5 }, 100, null, 15), 85);
  comprueba('ni un ADR de −0,1', REGLAS.stopDe({ precio: 115, ema50: 50, adr: -0.1 }, 100, null, 15), 85);
  comprueba('un ADR tan grande que el nivel saldría negativo se ignora',
    REGLAS.stopDe({ precio: 115, ema50: 50, adr: 60 }, 100, null, 15), 85);
  comprueba('un ADR que no es número tampoco mueve el stop',
    REGLAS.stopDe({ precio: 115, ema50: 50, adr: 'x' }, 100, null, 15), 85);
  comprueba('y con cualquier ADR válido el stop nunca pasa del máximo alcanzado',
    [0.5, 1, 4.6, 12, 30].every(a => REGLAS.stopDe({ precio: 115, ema50: 50, adr: a }, 100, null, 15) <= 115), true);
  comprueba('y sin ganancia tampoco', tiene(ev(100, 98, 100, 4.6)), false);

  /* NINGUNA BANDA DESPROTEGIDA entre dos dias de rango y el primer escalon: ese hueco (de ~9 % a
     20 % con ADR 4,6) existio unas horas el 05/11/2026 y lo encontro Borja preguntando por una al
     +15 %. Una ganancia real esta ATENDIDA si pasa cualquiera de estas tres cosas: hay regla de
     beneficio, el stop esta por encima de lo que pagaste, o el panel avisa de que no hay ninguna
     de las dos. Lo que no puede pasar nunca es ninguna de las tres. */
  {
    const mudas = [];
    for (let gm = 1; gm < 60; gm++) {
      const x = ev(100, 100 * (1 + gm / 100), 100 * (1 + gm / 100), 4.6);
      const atendida = REGLAS.limiteDevolucion(gm) != null || x.stop > 100 || tiene(x);
      if (gm >= 2 * 4.6 && !atendida) mudas.push(gm);
    }
    comprueba('ninguna ganancia real se queda sin regla, sin stop Y sin aviso', mudas, []);
    /* Y la mitad del hueco que antes solo se avisaba ahora se PROTEGE de verdad. */
    const protegidas = [];
    for (let gm = 10; gm <= 19; gm++) {
      const x = ev(100, 100 * (1 + gm / 100), 100 * (1 + gm / 100), 4.6);
      if (x.stop > 100) protegidas.push(gm);
    }
    comprueba('del +11 % al +19 % el stop ya está en ganancia, no solo avisado',
      protegidas, [11, 12, 13, 14, 15, 16, 17, 18, 19]);
  }
}

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) {
console.log(`${fallos} FALLOS`); process.exit(1); }

