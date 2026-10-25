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

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) {
console.log(`${fallos} FALLOS`); process.exit(1); }

