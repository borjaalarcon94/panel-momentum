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
  /* ---- simula(): salida por stop, fecha de salida y peor momento (drawdown) ---- */
  console.log('\nSimulacion de salidas y drawdown');

  /* Entorno minimo: la funcion usa FH (sesiones), esSesion, cierre() y window.REGLAS. */
  function conSerie(serie, compra) {
    const fechas = serie.map((_, i) => '2026-11-' + String(i + 2).padStart(2, '0'));
    ctx.FH = ['2026-11-01', ...fechas];
    ctx.esSesion = () => true;
    ctx.cierre = (f) => { const i = fechas.indexOf(f); return i < 0 ? null : serie[i] };
    ctx.window.REGLAS = {
      /* Mismo contrato que docs/reglas.js: suelo al -15 %, sube al coste superado el +20 %, nunca baja. */
      stopDe: (datos, c, prev) => Math.max(c * 0.85, prev || 0),
      limiteDevolucion: () => null,
    };
    return ctx.simula([{ clave: 'X', ticker: 'X', entrada: '2026-11-01', precio: compra,
                         sesiones: serie.length, ret: (serie[serie.length - 1] / compra - 1) * 100,
                         retAlSalir: null }])[0];
  }

  const sube = conSerie([105, 110, 120], 100);
  comprueba('sin tocar el stop no hay salida', sube.fSalida === null && sube.motivo === null,
    JSON.stringify({ f: sube.fSalida, m: sube.motivo }));
  comprueba('si nunca baja del precio de compra, el peor momento es 0',
    Math.abs(sube.peor) < 1e-9, 'peor = ' + sube.peor);

  const cae = conSerie([95, 90, 80, 70], 100);
  comprueba('el stop corta cuando el cierre pierde el suelo del 15 %',
    cae.motivo === 'stop' && cae.fSalida === '2026-11-04', JSON.stringify({ m: cae.motivo, f: cae.fSalida }));
  comprueba('la rentabilidad con reglas es la del dia en que cortó, no la de hoy',
    Math.abs(cae.conReglas - (-20)) < 1e-9 && Math.abs(cae.ret - (-30)) < 1e-9,
    `conReglas=${cae.conReglas} ret=${cae.ret}`);

  /* El punto fino: tras cortar, "peor momento con reglas" se CONGELA, pero el de aguantar sigue.
     Si se usara un break, los dos se quedarian congelados y el drawdown de aguantar saldria falso. */
  comprueba('tras la salida, el peor momento con reglas se congela',
    Math.abs(cae.peorConReglas - (-20)) < 1e-9, 'peorConReglas = ' + cae.peorConReglas);
  comprueba('pero el peor momento aguantando sigue bajando despues de la salida',
    Math.abs(cae.peor - (-30)) < 1e-9, 'peor = ' + cae.peor);

  /* Recuperacion: acaba en verde pero paso por rojo. El drawdown tiene que recordarlo. */
  const vuelve = conSerie([88, 92, 103], 100);
  comprueba('una entrada que acaba en verde recuerda lo que llegó a estar en rojo',
    Math.abs(vuelve.peor - (-12)) < 1e-9 && vuelve.ret > 0, `peor=${vuelve.peor} ret=${vuelve.ret}`);
  comprueba('el peor momento nunca es mejor que el resultado final',
    vuelve.peor <= vuelve.ret + 1e-9 && cae.peor <= cae.ret + 1e-9);

  const sinCierres = conSerie([], 100);
  comprueba('sin cierres guardados no se inventa una salida',
    sinCierres.fSalida === null && sinCierres.vistos === 0);
}

{
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

console.log(`\n${total - fallos}/${total} comprobaciones`);
process.exit(fallos ? 1 : 0);
