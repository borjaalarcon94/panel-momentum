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


/* Cada seccion va en su propio bloque: tres veces ya he chocado nombres de variable entre
   secciones de este mismo fichero (cae, tres). Con el bloque, el error es imposible. */

{
  /* ---- simula(): delega en REGLAS.recorrido(), que se prueba en reglas.test.js ---- */
{
  console.log('\nSimulacion de salidas y drawdown');
  /* El bucle en si vive en docs/reglas.js (REGLAS.recorrido) y se prueba alli, puro. Aqui solo se
     comprueba que simula() lo usa y traslada bien sus campos, que es donde estuvo el fallo: habia
     una copia del bucle y llamaba a stopDe con dos argumentos de menos. */
  let visto = null;
  ctx.window.recorridoConReglas = (clave, entrada, compra) => {
    visto = { clave, entrada, compra };
    return { ret: -12.5, fecha: '2026-11-09', motivo: 'stop', peor: -20, peorCerrada: -12.5, vistos: 7 };
  };
  const r = ctx.simula([{ clave: 'NASDAQ:X', ticker: 'X', entrada: '2026-11-02', precio: 100,
                          sesiones: 10, ret: -30, retAlSalir: -8 }])[0];
  comprueba('simula pasa símbolo, fecha de entrada y precio de compra al recorrido',
    visto && visto.clave === 'NASDAQ:X' && visto.entrada === '2026-11-02' && visto.compra === 100,
    JSON.stringify(visto));
  comprueba('y usa la rentabilidad del recorrido, no la de hoy', r.conReglas === -12.5, 'conReglas = ' + r.conReglas);
  comprueba('traslada el motivo y la fecha de salida', r.motivo === 'stop' && r.fSalida === '2026-11-09');
  comprueba('traslada los dos peores momentos', r.peor === -20 && r.peorConReglas === -12.5);
  comprueba('la cobertura es sesiones con cierre entre sesiones transcurridas',
    Math.abs(r.cobertura - 0.7) < 1e-9, 'cobertura = ' + r.cobertura);

  /* Si el recorrido no encuentra salida, la operacion sigue abierta y vale lo de hoy. */
  ctx.window.recorridoConReglas = () => ({ ret: null, fecha: null, motivo: null, peor: -4, peorCerrada: -4, vistos: 3 });
  const abierta = ctx.simula([{ clave: 'A', ticker: 'A', entrada: 'x', precio: 10, sesiones: 3, ret: 6.5, retAlSalir: null }])[0];
  comprueba('sin salida, se queda con la rentabilidad de hoy', abierta.conReglas === 6.5);
  comprueba('y sin fecha ni motivo de venta', abierta.fSalida === null && abierta.motivo === null);
}

/* ---- carteraDelTop(): la rentabilidad del listado como UNA cartera ---- */
  console.log('\nLa cartera del top');

  /* Monta un escenario: tops por sesion y cierres por dia. */
  function escenario(tops, precios) {
    ctx.HIST = {}; Object.entries(tops).forEach(([f, ks]) =>
      ctx.HIST[f] = { acciones: ks.map(k => ({ t: k, s: k, p: 1 })), spy: 100 });
    ctx.FH = Object.keys(tops).sort().reverse();
    ctx.PRECIOS = precios;
    return ctx.carteraDelTop();
  }
  const d = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'];

  /* Retraso de un dia. A entra en el top la noche de d0, con cierre 100, y a la manana siguiente
     abre disparada: cierra d1 en 200. Ese hueco es lo que NO puedes cobrar, porque tu compras al
     cierre de d1 (200), no al de d0 (100). Despues se queda plana, asi que la cartera tiene que
     quedarse en cero. Sin el retraso cobraria el +100 %.
     (Un primer intento ponia el salto entre d1 y d2, que es un tramo que SI te llevas: la prueba
     fallaba por estar mal planteada, no por el codigo.) */
  const salto = escenario(
    { [d[0]]: ['A'], [d[1]]: ['A'], [d[2]]: ['A'], [d[3]]: ['A'] },
    { [d[0]]: { A: 100 }, [d[1]]: { A: 200 }, [d[2]]: { A: 200 }, [d[3]]: { A: 200 }, [d[4]]: { A: 200 } });
  comprueba('con el retraso de un día, el hueco de la noche en que se detecta NO se cobra',
    salto && Math.abs(salto.ret) < 1e-6, salto ? 'ret = ' + salto.ret : 'null');

  /* Sin supervivencia: A se desploma el dia 4 y sale del top el dia 4. La caida tiene que estar
     dentro de la curva, porque es lo que te habria pasado teniendola comprada. */
  const hundida = escenario(
    { [d[0]]: ['A'], [d[1]]: ['A'], [d[2]]: ['B'], [d[3]]: ['B'] },
    { [d[0]]: { A: 100, B: 100 }, [d[1]]: { A: 100, B: 100 },
      [d[2]]: { A: 50, B: 100 }, [d[3]]: { A: 50, B: 100 }, [d[4]]: { A: 50, B: 100 } });
  comprueba('una acción que se desploma y sale del top deja su caída dentro de la curva',
    hundida && hundida.ret < -40, hundida ? 'ret = ' + hundida.ret.toFixed(2) : 'null');
  comprueba('y esa caída queda registrada como peor caída de la cartera',
    hundida && hundida.caida < -40, hundida ? 'caida = ' + hundida.caida.toFixed(2) : 'null');

  /* Compone, no promedia: +10 % y luego +10 % son +21 %, no +20 %. */
  const comp = escenario(
    { [d[0]]: ['A'], [d[1]]: ['A'], [d[2]]: ['A'], [d[3]]: ['A'] },
    { [d[0]]: { A: 100 }, [d[1]]: { A: 100 }, [d[2]]: { A: 110 }, [d[3]]: { A: 121 }, [d[4]]: { A: 133.1 } });
  comprueba('encadena la rentabilidad en vez de promediarla',
    comp && Math.abs(comp.ret - 33.1) < 0.5, comp ? 'ret = ' + comp.ret.toFixed(2) : 'null');

  /* Equiponderada: dos acciones, una +20 % y otra -20 %, dejan la cartera plana. */
  const eq = escenario(
    { [d[0]]: ['A', 'B'], [d[1]]: ['A', 'B'], [d[2]]: ['A', 'B'], [d[3]]: ['A', 'B'] },
    { [d[0]]: { A: 100, B: 100 }, [d[1]]: { A: 100, B: 100 },
      [d[2]]: { A: 120, B: 80 }, [d[3]]: { A: 120, B: 80 }, [d[4]]: { A: 120, B: 80 } });
  comprueba('pesa las posiciones a partes iguales',
    eq && Math.abs(eq.ret) < 1e-6, eq ? 'ret = ' + eq.ret.toFixed(4) : 'null');

  /* Rotacion: si el top no cambia, no se mueve nada despues del primer dia. */
  const quieta = escenario(
    { [d[0]]: ['A'], [d[1]]: ['A'], [d[2]]: ['A'], [d[3]]: ['A'] },
    { [d[0]]: { A: 100 }, [d[1]]: { A: 100 }, [d[2]]: { A: 100 }, [d[3]]: { A: 100 }, [d[4]]: { A: 100 } });
  comprueba('mide la rotación: un top que no cambia apenas rota',
    quieta && quieta.rotacion < 60, quieta ? 'rotacion = ' + quieta.rotacion.toFixed(0) : 'null');

  const corta = escenario({ [d[0]]: ['A'] }, { [d[0]]: { A: 100 }, [d[1]]: { A: 100 } });
  comprueba('con menos de 3 días no devuelve curva', corta === null);
}

{
  /* ---- operandoElPanel(): comprar lo que dice y vender con el stop ---- */
  console.log('\nOperar el panel con el stop');

  function opEscenario(tops, precios, emas, huecos) {
    ctx.HIST = {}; Object.entries(tops).forEach(([f, ks]) =>
      ctx.HIST[f] = { acciones: ks.map((k, i) => ({ t: k, s: k, p: 1, sc: 90 - i })), spy: 100 });
    ctx.FH = Object.keys(tops).sort().reverse();
    ctx.PRECIOS = precios;
    ctx.window.__EMAS__ = emas || {};
    ctx.window.REGLAS = {
      R: { perdidaMaxima: 15, gananciaProteger: 20 },
      stopDe: (datos, compra, prev) => Math.max(datos.ema50 || 0, compra * 0.85, prev || 0),
      limiteDevolucion: () => null,
    };
    return ctx.operandoElPanel(huecos);
  }
  const e = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06'];
  const topFijo = { [e[0]]: ['A', 'B', 'C'], [e[1]]: ['A', 'B', 'C'], [e[2]]: ['A', 'B', 'C'],
                    [e[3]]: ['A', 'B', 'C'], [e[4]]: ['A', 'B', 'C'] };
  const plano = n2 => ({ A: n2, B: n2, C: n2 });

  /* Un hueco: solo compra la mejor puntuada (A, sc 90). */
  const uno = opEscenario(topFijo,
    { [e[0]]: plano(100), [e[1]]: plano(100), [e[2]]: { A: 110, B: 100, C: 100 },
      [e[3]]: { A: 110, B: 100, C: 100 }, [e[4]]: { A: 110, B: 100, C: 100 }, [e[5]]: { A: 110, B: 100, C: 100 } },
    null, 1);
  comprueba('con un hueco compra solo la mejor puntuada y recoge su subida',
    uno && Math.abs(uno.ret - 10) < 0.01, uno ? 'ret = ' + uno.ret.toFixed(2) : 'null');

  /* Tres huecos a partes iguales: solo sube una de tres -> un tercio del movimiento. */
  const tres = opEscenario(topFijo,
    { [e[0]]: plano(100), [e[1]]: plano(100), [e[2]]: { A: 130, B: 100, C: 100 },
      [e[3]]: { A: 130, B: 100, C: 100 }, [e[4]]: { A: 130, B: 100, C: 100 }, [e[5]]: { A: 130, B: 100, C: 100 } },
    null, 3);
  comprueba('reparte el dinero a partes iguales entre los huecos',
    tres && Math.abs(tres.ret - 10) < 0.01, tres ? 'ret = ' + tres.ret.toFixed(2) : 'null');

  /* El stop vende y el dinero vuelve a la caja: la perdida se limita al suelo, no sigue cayendo. */
  const stop = opEscenario(
    { [e[0]]: ['A'], [e[1]]: ['A'], [e[2]]: ['A'], [e[3]]: ['A'], [e[4]]: ['A'] },
    { [e[0]]: { A: 100 }, [e[1]]: { A: 100 }, [e[2]]: { A: 80 }, [e[3]]: { A: 40 },
      [e[4]]: { A: 20 }, [e[5]]: { A: 10 } }, null, 1);
  comprueba('el stop vende y corta la pérdida',
    stop && stop.cerradas.length === 1 && stop.cerradas[0].motivo === 'stop',
    stop ? JSON.stringify(stop.cerradas) : 'null');
  comprueba('tras vender, el desplome posterior ya no le afecta',
    stop && Math.abs(stop.ret - (-20)) < 0.01, stop ? 'ret = ' + stop.ret.toFixed(2) : 'null');

  /* El dinero liberado se reinvierte en lo siguiente que entra al top. */
  const reinv = opEscenario(
    { [e[0]]: ['A'], [e[1]]: ['A'], [e[2]]: ['A', 'B'], [e[3]]: ['B'], [e[4]]: ['B'] },
    { [e[0]]: { A: 100, B: 100 }, [e[1]]: { A: 100, B: 100 }, [e[2]]: { A: 80, B: 100 },
      [e[3]]: { A: 80, B: 100 }, [e[4]]: { A: 80, B: 200 }, [e[5]]: { A: 80, B: 200 } }, null, 1);
  comprueba('el dinero de una venta se reinvierte en la siguiente señal',
    reinv && reinv.ret > 50, reinv ? 'ret = ' + reinv.ret.toFixed(2) : 'null');

  /* No se recompra lo que acaba de saltar por el stop, aunque siga en el top. */
  const noVuelve = opEscenario(
    { [e[0]]: ['A'], [e[1]]: ['A'], [e[2]]: ['A'], [e[3]]: ['A'], [e[4]]: ['A'] },
    { [e[0]]: { A: 100 }, [e[1]]: { A: 100 }, [e[2]]: { A: 80 }, [e[3]]: { A: 200 },
      [e[4]]: { A: 300 }, [e[5]]: { A: 400 } }, null, 1);
  comprueba('no vuelve a entrar en una acción de la que ya salió',
    noVuelve && noVuelve.cerradas.length === 1 && noVuelve.abiertas === 0 && noVuelve.ret < 0,
    noVuelve ? `cerradas=${noVuelve.cerradas.length} abiertas=${noVuelve.abiertas} ret=${noVuelve.ret.toFixed(1)}` : 'null');

  /* La EMA 50 manda cuando queda por encima del suelo del 15 %. */
  const porEma = opEscenario(
    { [e[0]]: ['A'], [e[1]]: ['A'], [e[2]]: ['A'], [e[3]]: ['A'], [e[4]]: ['A'] },
    { [e[0]]: { A: 100 }, [e[1]]: { A: 100 }, [e[2]]: { A: 96 }, [e[3]]: { A: 96 },
      [e[4]]: { A: 96 }, [e[5]]: { A: 96 } },
    { [e[2]]: { A: 98 }, [e[3]]: { A: 98 }, [e[4]]: { A: 98 }, [e[5]]: { A: 98 } }, 1);
  comprueba('vende por la EMA 50 aunque no se haya perdido el 15 %',
    porEma && porEma.cerradas.length === 1 && Math.abs(porEma.cerradas[0].r - (-4)) < 0.01,
    porEma ? JSON.stringify(porEma.cerradas) : 'null');

  comprueba('registra lo peor que llegó a estar la cartera',
    stop && stop.caida <= -20 + 1e-9, stop ? 'caida = ' + stop.caida.toFixed(2) : 'null');

  const cortito = opEscenario({ [e[0]]: ['A'] }, { [e[0]]: { A: 100 }, [e[1]]: { A: 100 } }, null, 1);
  comprueba('con menos de 3 días no devuelve cartera', cortito === null);

  /* El dinero no se queda parado. A cae y la vende el stop: lo que vuelve a la caja ya no llega a
     un tercio de la cartera, porque B y C han subido. Con el "break" anterior ese hueco se quedaba
     vacio PARA SIEMPRE y el dinero sin invertir. Medido en el registro real: 10 de 13 sesiones con
     un hueco libre y un 16 % en caja. */
  const reparto = opEscenario(
    { [e[0]]: ['A', 'B', 'C'], [e[1]]: ['A', 'B', 'C', 'D'], [e[2]]: ['B', 'C', 'D'],
      [e[3]]: ['B', 'C', 'D'], [e[4]]: ['B', 'C', 'D'] },
    { [e[0]]: { A: 100, B: 100, C: 100, D: 100 }, [e[1]]: { A: 100, B: 100, C: 100, D: 100 },
      [e[2]]: { A: 100, B: 140, C: 140, D: 100 }, [e[3]]: { A: 70, B: 160, C: 160, D: 100 },
      [e[4]]: { A: 70, B: 160, C: 160, D: 100 }, [e[5]]: { A: 70, B: 160, C: 160, D: 100 } },
    null, 3);
  comprueba('el stop vende A y queda un hueco libre',
    reparto && reparto.cerradas.length === 1, reparto ? JSON.stringify(reparto.cerradas) : 'null');
  comprueba('y el hueco se vuelve a llenar aunque la caja no dé para una parte entera',
    reparto && reparto.abiertas === 3,
    reparto ? 'abiertas = ' + reparto.abiertas + ' (deberían ser 3)' : 'null');

  /* Pero no se abre una posicion con calderilla: si en caja queda menos del 1 % de la cartera,
     no se compra. Sin ese limite se abrian posiciones ridiculas que solo generan ruido. */
  const migajas = opEscenario(
    { [e[0]]: ['A'], [e[1]]: ['A', 'B'], [e[2]]: ['A', 'B'], [e[3]]: ['A', 'B'], [e[4]]: ['A', 'B'] },
    { [e[0]]: { A: 100, B: 100 }, [e[1]]: { A: 100, B: 100 }, [e[2]]: { A: 100, B: 100 },
      [e[3]]: { A: 100, B: 100 }, [e[4]]: { A: 100, B: 100 }, [e[5]]: { A: 100, B: 100 } },
    null, 1);
  comprueba('con un solo hueco ya lleno no se abre nada más',
    migajas && migajas.abiertas === 1, migajas ? 'abiertas = ' + migajas.abiertas : 'null');
}


/* ---- etiquetasFecha(): el eje de la grafica a cualquier escala ---- */
{
  console.log('\nEje de fechas de la grafica');
  const serie = n2 => {
    const o = []; let d = new Date('2026-10-05T12:00:00Z');
    while (o.length < n2) { if (d.getUTCDay() > 0 && d.getUTCDay() < 6) o.push({ f: d.toISOString().slice(0, 10), v: 100 }); d = new Date(d.getTime() + 86400000) }
    return o;
  };
  /* El panel publica hasta 90 sesiones (DIAS en build.py) pero se prueba muy por encima: si algun
     dia se sube ese tope, el eje no puede amontonarse. */
  const escalas = [2, 3, 5, 13, 20, 45, 46, 60, 75, 90, 110, 130, 180, 250, 400];
  let apretadas = 0, muchas = 0, desordenadas = 0;
  for (const n2 of escalas) {
    const s = serie(n2), e = ctx.etiquetasFecha(s);
    if (e.length > 7) muchas++;
    const sep = e.length > 1 ? Math.min(...e.slice(1).map((x, i) => x.i - e[i].i)) : n2;
    if (sep <= n2 * 0.07) apretadas++;
    if (e.some((x, i) => i && x.i <= e[i - 1].i)) desordenadas++;
  }
  comprueba('ninguna escala pasa de 7 etiquetas (probadas ' + escalas.length + ', hasta 400 sesiones)', muchas === 0, muchas + ' escalas con demasiadas');
  comprueba('ninguna escala amontona etiquetas', apretadas === 0, apretadas + ' escalas apretadas');
  comprueba('las etiquetas van siempre en orden', desordenadas === 0);

  const corta = ctx.etiquetasFecha(serie(13));
  comprueba('con pocas sesiones pone día y mes', /^\d+ \w+/.test(corta[0].txt), corta[0].txt);
  comprueba('y empieza en la primera sesión', corta[0].i === 0);
  comprueba('y acaba en la última', corta[corta.length - 1].i === 12);

  const larga = ctx.etiquetasFecha(serie(90));
  comprueba('a 90 sesiones cambia a meses', larga.slice(1).every(x => !/\d/.test(x.txt)),
    larga.map(x => x.txt).join(' | '));
  comprueba('y no repite el último mes dos veces',
    new Set(larga.map(x => x.txt)).size === larga.length, larga.map(x => x.txt).join(' | '));

  comprueba('con una sola sesión no dibuja eje', ctx.etiquetasFecha(serie(1)).length === 0);
}


/* ---- las dos carteras tienen que cubrir el MISMO tramo ---- */
{
  console.log('\nLas dos carteras comparten tramo');
  /* La pestaña enseña dos curvas y debajo de cada una pone "el S&P 500 en el mismo tramo". Si
     arrancan en dias distintos, ese rotulo es mentira en una de las dos: pasó, y la auditoria del
     25/10/2026 lo cazo con -2,2 % en una y -2,5 % en la otra. */
  const d2 = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05'];
  ctx.HIST = {}; d2.slice(0, 4).forEach((f, i) =>
    ctx.HIST[f] = { acciones: [{ t: 'A', s: 'A', p: 10, sc: 90 }, { t: 'B', s: 'B', p: 10, sc: 80 }], spy: 100 + i });
  ctx.FH = d2.slice(0, 4).sort().reverse();
  ctx.PRECIOS = {}; d2.forEach((f, i) => ctx.PRECIOS[f] = { A: 10 + i, B: 10 });
  ctx.window.__EMAS__ = {};
  ctx.window.REGLAS = { R: { perdidaMaxima: 15, gananciaProteger: 20 },
    stopDe: (datos, c, prev) => Math.max(datos.ema50 || 0, c * 0.85, prev || 0),
    limiteDevolucion: () => null };
  const op = ctx.operandoElPanel(2), lis = ctx.carteraDelTop();
  comprueba('las dos carteras existen con los mismos datos', !!op && !!lis);
  comprueba('y arrancan el mismo día',
    op && lis && op.curva[0].f === lis.serie[0].f,
    op && lis ? `operada ${op.curva[0].f} vs listado ${lis.serie[0].f}` : 'alguna es null');
  comprueba('y acaban el mismo día',
    op && lis && op.curva[op.curva.length - 1].f === lis.serie[lis.serie.length - 1].f);
  comprueba('las dos arrancan valiendo 100',
    op && lis && op.curva[0].v === 100 && lis.serie[0].v === 100);
  comprueba('el primer día la cartera operada está en liquidez, sin posiciones',
    op && op.curva[0].n === 0, op ? 'n = ' + op.curva[0].n : 'null');
}


/* ---- la grafica no puede romperse ---- */
{
  console.log('\nLa grafica aguanta que la señalen mal');
  /* Un DOM minimo con eventos, suficiente para ejecutar el manejador del puntero. */
  function nodo(tag) {
    const e = {
      tagName: (tag || 'div').toUpperCase(), hijos: [], _t: '', className: '', style: {}, _ev: {},
      set textContent(v) { this._t = String(v) }, get textContent() { return this._t },
      set innerHTML(v) { }, get innerHTML() { return '' },
      appendChild(h) { this.hijos.push(h); return h }, append(...h) { h.forEach(x => this.hijos.push(x)) },
      classList: { toggle() {}, add() {}, remove() {} },
      addEventListener(n2, f) { this._ev[n2] = f },
      getBoundingClientRect() { return this._rect || { left: 0, width: 0 } },
    };
    return e;
  }
  const antes = ctx.document, antesEl = ctx.el, antesF = ctx.fFecha;
  ctx.document = { createElement: nodo };
  /* grafica() usa los ayudantes globales de app.js: aqui se sustituyen por lo minimo. */
  ctx.el = (tag, clase, txt) => { const e = nodo(tag); if (clase) e.className = clase; if (txt != null) e.textContent = txt; return e };
  ctx.fFecha = f => f;
  const serie = ['2026-12-01', '2026-12-02', '2026-12-03'].map((f, i) => ({ f, v: 100 + i }));
  const g = ctx.grafica(serie, serie);
  const lienzo = g.hijos.find(x => x.className === 'lienzo');
  const disparar = (rect, x) => {
    lienzo._rect = rect;
    try { lienzo._ev.pointermove({ clientX: x }); return null } catch (e) { return e.message }
  };
  /* El caso que reventaba de verdad es 0/0 -> NaN: ancho cero Y el puntero justo en el borde
     izquierdo, que es lo que pasa cuando la pestaña esta oculta y left vale 0. Con clientX > left
     la division da Infinity, que se recorta a 1 y no rompe: por eso un primer intento de esta
     prueba pasaba igual con el codigo roto y hubo que afinarla. */
  comprueba('con la pestaña oculta (ancho 0, puntero en el borde) no revienta',
    disparar({ left: 0, width: 0 }, 0) === null, disparar({ left: 0, width: 0 }, 0));
  comprueba('ni con ancho 0 y el puntero a la derecha',
    disparar({ left: 0, width: 0 }, 50) === null, disparar({ left: 0, width: 0 }, 50));
  comprueba('ni con coordenada no numérica',
    disparar({ left: 0, width: 300 }, NaN) === null, disparar({ left: 0, width: 300 }, NaN));
  comprueba('señalando a la izquierda del todo tampoco',
    disparar({ left: 0, width: 300 }, -500) === null, disparar({ left: 0, width: 300 }, -500));
  comprueba('ni muy a la derecha',
    disparar({ left: 0, width: 300 }, 99999) === null, disparar({ left: 0, width: 300 }, 99999));
  comprueba('y al soltar se limpia sin error',
    (() => { try { lienzo._ev.pointerleave(); return true } catch (e) { return false } })());
  ctx.document = antes; ctx.el = antesEl; ctx.fFecha = antesF;
}

console.log(`\n${total - fallos}/${total} comprobaciones`);
process.exit(fallos ? 1 : 0);
