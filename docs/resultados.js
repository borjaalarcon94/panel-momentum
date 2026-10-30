/* Pestana "Resultados": responde a una sola pregunta, "¿me puedo fiar ya de esto?", y mientras la
   respuesta sea no, lo dice claro y enseña el registro en bruto sin disfrazarlo de conclusion.
   Se calcula con lo que ya hay guardado: cada entrada al top con su nota de ese dia, su precio, y
   el precio de hoy. Cero llamadas a la red. */

/* Una entrada no cuenta hasta que ha vivido lo suficiente: medir lo que hizo una accion en dos dias
   y promediarlo con lo que hizo otra en dos meses no significa nada. */
const MADUREZ = 15;   // sesiones que tiene que vivir una entrada para contar
const MINIMO = 30;    // entradas maduras para poder concluir algo

function entradas() {
  const P = T.precios || {}, hoyF = FH[0], spyHoy = (HIST[hoyF] || {}).spy;
  const reg = {};
  [...FH].reverse().forEach(f => ((HIST[f] || {}).acciones || []).forEach(a => {
    const k = a.s || a.t;
    if (!reg[k]) reg[k] = { ticker: a.t, entrada: sesionDe(f), dia: f, precio: a.p, score: a.sc, beta: a.b, spy: (HIST[f] || {}).spy, ultimo: f, precioUltimo: a.p };
    reg[k].ultimo = f; reg[k].precioUltimo = a.p;
  }));
  return Object.entries(reg).map(([k, r]) => {
    const ahora = (ACT[k] || {}).precio ?? P[k] ?? null;
    return { ...r, ahora, clave: k,
      ret: ahora != null && r.precio ? (ahora / r.precio - 1) * 100 : null,
      retAlSalir: r.precioUltimo && r.precio ? (r.precioUltimo / r.precio - 1) * 100 : null,
      sp: r.spy && spyHoy ? (spyHoy / r.spy - 1) * 100 : null, fuera: r.ultimo !== hoyF,
      sesiones: FH.filter(f => f > r.entrada && esSesion(f)).length };   // sesiones nuestras, no dias de calendario
    /* Se quedan tambien las que han perdido el precio: una accion puede desaparecer de la fuente de
       datos por una fusion, un cambio de simbolo o una exclusion de bolsa. Descartarlas en silencio
       dejaria el registro lleno solo de supervivientes y la media saldria mejor de lo que fue, que es
       exactamente el sesgo que invalida la mayoria de los backtests. */
  }).filter(a => a.score != null && a.sesiones > 0);
}

const media = v => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);

/* El indice en el MISMO tramo que una posicion: de su entrada a SU salida, no a hoy. Comparar una
   posicion que cerro el 14/10 contra el indice hasta el 29/10 mide dos ventanas distintas y le
   atribuye al panel lo que hizo el mercado cuando el dinero ya estaba fuera. Si falta el dato de
   un dia concreto se coge el ultimo anterior que haya, que es lo que hace un cierre de verdad. */
function spEntre(dIni, dFin) {
  const spyDe = f => {
    if ((HIST[f] || {}).spy) return HIST[f].spy;
    const antes = FH.filter(x => x <= f).sort();
    for (let i = antes.length - 1; i >= 0; i--) if ((HIST[antes[i]] || {}).spy) return HIST[antes[i]].spy;
    return null;
  };
  const x = spyDe(dIni), y = spyDe(dFin);
  return x && y ? (y / x - 1) * 100 : null;
}

/* Cuantas semanas quedan: las entradas que ya hay tienen que madurar, y si aun no hay suficientes,
   se proyecta al ritmo al que estan apareciendo. Es una estimacion, y se dice que lo es. */
function cuandoEstara(xs) {
  const sesiones = FH.filter(esSesion).length;
  const faltanPorMadurar = [...xs].sort((a, b) => b.sesiones - a.sesiones)[MINIMO - 1];
  let sesionesQueFaltan;
  if (faltanPorMadurar) sesionesQueFaltan = Math.max(0, MADUREZ - faltanPorMadurar.sesiones);
  else {
    const ritmo = xs.length / Math.max(sesiones, 1);
    sesionesQueFaltan = Math.ceil((MINIMO - xs.length) / Math.max(ritmo, 0.2)) + MADUREZ;
  }
  if (sesionesQueFaltan <= 0) return null;
  const d = new Date(FH[0] + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.ceil(sesionesQueFaltan / 5) * 7);
  return { sesiones: sesionesQueFaltan, fecha: d.toISOString().slice(0, 10) };
}

/* Lo primero que se lee: si los numeros valen ya o no, y cuanto falta. Nada mas. */
function estado(xs, maduras) {
  const listo = maduras.length >= MINIMO;
  const d = el('div', 'card');
  d.appendChild(el('div', 'pregunta', '¿Me puedo fiar ya de estos números?'));
  d.appendChild(el('div', 'respuesta ' + (listo ? 'rverde' : 'rgris'),
    listo ? 'Sí, ya hay historial suficiente' : 'Todavía no'));
  if (listo) {
    d.appendChild(el('div', 'm', maduras.length + ' entradas con al menos ' + MADUREZ + ' sesiones de recorrido. Las respuestas de abajo ya se sostienen.'));
    return d;
  }
  const falta = cuandoEstara(xs);
  d.appendChild(el('div', 'm', 'El panel lleva ' + FH.filter(esSesion).length + ' ' + (FH.filter(esSesion).length === 1 ? 'sesión' : 'sesiones') + ' guardadas y hay ' +
    xs.length + ' ' + (xs.length === 1 ? 'acción anotada' : 'acciones anotadas') + ', pero ' +
    (maduras.length ? 'solo ' + maduras.length : 'ninguna') + ' con las ' + MADUREZ + ' sesiones de recorrido que hacen falta. ' +
    'Medir lo que ha hecho una acción en dos días no dice nada: sube o baja por ruido.'));
  const b = el('div', 'barra'); const r = el('i'); r.style.width = Math.min(100, Math.round(100 * maduras.length / MINIMO)) + '%';
  b.appendChild(r); d.appendChild(b);
  d.appendChild(el('div', 'm', maduras.length + ' de ' + MINIMO + ' entradas maduras' +
    (falta ? ' · estimo que estará listo hacia el ' + fFecha(falta.fecha) : '')));
  return d;
}

/* Una pregunta con su respuesta en una linea. Solo se pinta cuando hay con que responderla. */
function pregunta(titulo, respuesta, detalle, bien) {
  const d = el('div', 'card');
  d.appendChild(el('div', 'pregunta', titulo));
  d.appendChild(el('div', 'respuesta ' + (bien ? 'rverde' : 'rrojo'), respuesta));
  d.appendChild(el('div', 'm', detalle));
  return d;
}

/* El corte entre "buena nota" y "mala nota" es la mediana de lo anotado, no un 75 fijo: al top solo
   suben las mejores, asi que con un corte fijo el grupo de abajo se quedaba siempre vacio y la
   pregunta no se podia responder nunca por mucho que esperaramos. */
function discrimina(maduras) {
  const notas = maduras.map(a => a.score).sort((a, b) => a - b);
  const corte = notas[Math.floor(notas.length / 2)];
  const altas = maduras.filter(a => a.score >= corte), bajas = maduras.filter(a => a.score < corte);
  if (altas.length < 10 || bajas.length < 10) return null;
  return { corte, dif: media(altas.map(a => a.ret)) - media(bajas.map(a => a.ret)), altas, bajas };
}

/* Simula las reglas completas: comprar el dia que entra y vender cuando el protocolo lo dice. */
function simula(xs) {
  return xs.map(x => {
    /* El recorrido vive en app.js (recorridoConReglas) para que Seguimiento y Resultados no puedan
       contar historias distintas del mismo dia: aqui habia una copia del bucle y en la pestaña de
       al lado otra, y acabaron con stops diferentes. */
    const r = window.recorridoConReglas(x.clave, x.entrada, x.precio);
    return { ...x, conReglas: r.ret != null ? r.ret : x.ret, motivo: r.motivo, fSalida: r.fecha,
      vistos: r.vistos, cobertura: x.sesiones ? r.vistos / x.sesiones : 1,
      alSalirDelTop: x.retAlSalir != null ? x.retAlSalir : x.ret,
      /* Peor momento (drawdown): cuanto llego a estar en rojo antes de donde acabo. Una entrada que
         acaba en +3 % pero paso por -18 % no es la misma operacion que una que subio recta. */
      peor: r.peor, peorConReglas: r.peorCerrada };
  });
}

/* RESPUESTA A "¿HABRIAS GANADO DINERO SIGUIENDO EL PANEL?".

   Separada en su propia funcion porque la respuesta se daba mal y hacia falta poder probarla: usaba
   a.ret, que es aguantar sin vender nunca, cuando la pregunta dice "siguiendo el panel" y el panel
   vende en el stop. Con el registro del 30/10/2026 eran +2,3 % contra +1,5 %. Devuelve las dos
   cifras a proposito, para que la de arriba pueda decir cual es cual.

   contraIndice compara cada posicion con el indice EN SU TRAMO: de su entrada a su salida, no hasta
   hoy. Una cerrada el 14/10 contra el indice hasta el 29/10 son dos ventanas distintas. */
function ganaDinero(maduras) {
  const sim = simula(maduras);
  const ret = media(sim.map(a => a.conReglas));
  return { sim, ret,
    pos: sim.filter(a => a.conReglas > 0).length,
    cerradas: sim.filter(a => a.fSalida).length,
    aguantando: media(maduras.map(a => a.ret)),
    contraIndice: sim.map(a => ({ ...a, spTramo: spEntre(a.dia, a.fSalida || FH[0]) }))
      .filter(a => a.spTramo != null)
      .map(a => ({ ...a, ret: a.conReglas, sp: a.spTramo })) };
}

/* Como va cada grupo. Nace de una sugerencia razonable ("saca la rentabilidad de solo las que siguen
   en el top") que, aplicada como filtro, mentiria: una accion sale del top JUSTO cuando se debilita,
   asi que quedarse con las de dentro es quedarse con las ganadoras por construccion. Medido con el
   registro del 24/10/2026: todas +0,1 %, las que siguen dentro +10,9 %, las que salieron -5,6 %.
   Once puntos de diferencia que no son merito de nada. Por eso se muestran LOS DOS GRUPOS A LA VEZ,
   y nunca uno solo. */
function porGrupo(xs) {
  const dentro = xs.filter(a => !a.fuera), fuera = xs.filter(a => a.fuera);
  if (!dentro.length || !fuera.length) return null;
  const d = el('div', 'blk');
  d.appendChild(el('div', 'blt', 'Las que siguen en el top y las que ya salieron'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Grupo', 'Cuántas', 'Media aguantando', 'Frente al S&P 500', 'Peor'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  [['Siguen en el top', dentro], ['Ya salieron del top', fuera], ['Todas', xs]].forEach(([nom, v]) => {
    const tr = el('tr'), m = media(v.map(a => a.ret));
    const conSp = v.filter(a => a.sp != null);
    const peor = [...v].sort((a, b) => a.ret - b.ret)[0];
    tr.appendChild(el('td', null, nom));
    tr.appendChild(el('td', null, String(v.length)));
    tr.appendChild(el('td', m >= 0 ? 'up' : 'down', pc(m)));
    tr.appendChild(el('td', null, conSp.length ? (media(conSp.map(a => a.ret - a.sp)) >= 0 ? '+' : '') + n(media(conSp.map(a => a.ret - a.sp)), 1) + ' pt' : '—'));
    tr.appendChild(el('td', 'down', pc(peor.ret) + ' (' + peor.ticker + ')'));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  const dif = media(dentro.map(a => a.ret)) - media(xs.map(a => a.ret));
  const aviso = el('div', 'margen margen-cero');
  aviso.appendChild(el('b', null, 'Mirar solo la primera fila infla el resultado ' + n(Math.abs(dif), 1) + ' puntos'));
  aviso.appendChild(el('div', 'm', 'Una acción sale del top justo cuando se debilita, así que las que siguen dentro son las que van bien por definición. ' +
    'La fila de arriba no es «cómo va el sistema»: es «cómo van las que todavía no han fallado». Las tres filas juntas sí lo cuentan.'));
  d.appendChild(aviso);
  return d;
}

/* Las mismas entradas, tres formas de operarlas.

   Estaba escondida tras el umbral de 30 entradas maduras, asi que nunca se habia visto. Eso dejaba
   como unica cifra visible el "+0,1 %", que es "comprar y no vender nunca": la PEOR de las tres y,
   sobre todo, la que NO corresponde al sistema, porque el sistema vende. La pregunta razonable
   "me parece muy poca rentabilidad" no tenia donde responderse.

   Se muestra siempre, igual que el registro en bruto, porque es aritmetica sobre lo ya ocurrido y
   no una inferencia: no dice "esto es lo que ganaras", dice "esto es lo que habria pasado con las
   entradas que hay". El aviso de madurez sigue arriba del todo. */
function tablaSimulacion(xs, maduro) {
  const r = simula(xs);
  const filas = [
    ['Comprar y aguantar hasta hoy', r.map(x => x.ret), r.map(x => x.peor),
      'sin vender nunca — es la cifra grande de arriba'],
    ['Vender el día que sale del top', r.map(x => x.alSalirDelTop), r.map(x => x.peor),
      'disciplina máxima'],
    ['Con nuestras reglas de salida', r.map(x => x.conReglas), r.map(x => x.peorConReglas),
      'el stop y la devolución máxima de la pestaña Parámetros'],
  ];
  const d = el('div', 'blk');
  /* El titulo decia "Las mismas entradas, tres formas de operarlas" y la columna, "Media". Las dos
     cosas son ciertas y aun asi el conjunto se leia como si fuera una cartera, y chocaba con el
     +2,2 % de arriba: "me dice 2,2 % y aqui 1 % con lo mismo". No es lo mismo. Aqui cada entrada va
     por su cuenta y luego se promedia; arriba hay UNA cartera que compone y reinvierte. */
  d.appendChild(el('div', 'blt', 'Cada entrada por separado, operada de tres formas'));
  d.appendChild(el('div', 'm', 'Esto no es una cartera: cada una de las ' + r.length +
    ' entradas se mide por su cuenta, desde el día que entró al top, y después se promedian. ' +
    'No hay dinero que se reparta ni que se reinvierta.'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Forma de operar', 'Media por entrada', 'Mediana', 'En positivo', 'Peor caso', 'Peor momento'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  filas.forEach(([nom, v, dd, ayuda]) => {
    const tr = el('tr'), ord = [...v].sort((a, b) => a - b);
    const td = el('td'); td.appendChild(el('b', null, nom)); td.appendChild(el('div', 'name', ayuda)); tr.appendChild(td);
    tr.appendChild(el('td', media(v) >= 0 ? 'up' : 'down', pc(media(v))));
    tr.appendChild(el('td', null, pc(ord[Math.floor(ord.length / 2)])));
    tr.appendChild(el('td', null, Math.round(100 * v.filter(x => x > 0).length / v.length) + ' %'));
    tr.appendChild(el('td', 'down', pc(ord[0])));
    tr.appendChild(el('td', 'down', pc(media(dd))));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  d.appendChild(el('div', 'm', '«Peor momento» es lo que llegaste a estar en rojo por el camino, de media, aunque acabaras en verde. ' +
    'Es lo que hay que aguantar para llegar al número de la izquierda.'));

  /* Que vendio el stop y cuando. Sin esto, "con nuestras reglas de salida" es un numero sin cara:
     no se ve si el stop corto a tiempo o si corto de mas. */
  const vendidas = r.filter(x => x.fSalida).sort((a, b) => a.conReglas - b.conReglas);
  if (vendidas.length) {
    const s = el('div', 'blk');
    s.appendChild(el('div', 'blt', 'Lo que el stop habría vendido, entrada por entrada'));
    const tv = el('table', 'tabla'), hv = el('tr');
    ['Acción', 'Entró', 'Habría vendido', 'Por qué', 'Con el stop', 'Aguantando hasta hoy'].forEach(x => hv.appendChild(el('th', null, x)));
    tv.appendChild(hv);
    vendidas.forEach(x => {
      const tr = el('tr');
      tr.appendChild(el('td', null, x.ticker));
      tr.appendChild(el('td', null, fFecha(x.entrada)));
      tr.appendChild(el('td', null, fFecha(x.fSalida)));
      tr.appendChild(el('td', null, x.motivo));
      tr.appendChild(el('td', x.conReglas >= 0 ? 'up' : 'down', pc(x.conReglas)));
      tr.appendChild(el('td', x.ret >= 0 ? 'up' : 'down', pc(x.ret)));
      tv.appendChild(tr);
    });
    const wv = el('div', 'tw'); wv.appendChild(tv); s.appendChild(wv);
    const ahorro = media(vendidas.map(x => x.conReglas - x.ret));
    s.appendChild(el('div', 'm', vendidas.length === 1
      ? 'En esa entrada el stop habría salido ' + n(Math.abs(ahorro), 1) + ' puntos ' + (ahorro >= 0 ? 'mejor' : 'peor') + ' que aguantar.'
      : 'En esas ' + vendidas.length + ' entradas el stop habría salido ' + n(Math.abs(ahorro), 1) + ' puntos ' +
        (ahorro >= 0 ? 'mejor' : 'peor') + ' que aguantar, de media. ' +
        'Ojo: el stop actúa sobre cierres, así que un hueco a la baja al abrir lo salta y la pérdida real puede pasar del ' +
        window.REGLAS.R.perdidaMaxima + ' % declarado.'));
    d.appendChild(s);
  }

  /* Puente explicito entre los dos numeros. Sin esto, arriba pone +2,2 % "vendiendo con el stop" y
     aqui +1,2 % "con nuestras reglas de salida", y parece una contradiccion. Son tres diferencias
     concretas y conviene decirlas, no esconderlas. */
  const conReglas = media(r.map(x => x.conReglas));
  const cartera = operandoElPanel(5);
  if (cartera) {
    const puente = el('div', 'margen');
    puente.appendChild(el('b', null, '¿Por qué ' + pc(conReglas) + ' aquí y ' + pc(cartera.ret) + ' en la cartera de arriba?'));
    const ul = el('div', 'm');
    ul.appendChild(el('div', null, '· Arriba hay una cartera de 5 posiciones; aquí están las ' + r.length + ' entradas, también las que la cartera nunca llegó a comprar por no haber hueco.'));
    ul.appendChild(el('div', null, '· Arriba el dinero se compone y se reinvierte al vender; aquí se suman porcentajes sueltos y se dividen.'));
    ul.appendChild(el('div', null, '· Arriba se compra al cierre del día siguiente, que es cuando tú ves la señal; aquí, al cierre del día que entró al top, que es como está anotado el registro.'));
    ul.appendChild(el('div', null, 'El stop es el mismo en los dos sitios: EMA 50, suelo del ' +
      window.REGLAS.R.perdidaMaxima + ' %, subida al coste y devolución máxima.'));
    puente.appendChild(ul);
    d.appendChild(puente);
  }

  const cob = media(r.map(x => x.cobertura)) * 100;
  if (cob < 90) d.appendChild(el('div', 'm', 'Aviso: solo tenemos el cierre del ' + n(cob, 0) +
    ' % de las sesiones de estas entradas, así que las reglas de salida no se han podido aplicar en el resto. ' +
    'La serie diaria se guarda desde el 7 de octubre de 2026; las entradas anteriores van incompletas.'));
  if (!maduro) d.appendChild(el('div', 'm', 'Esto es el registro de lo que ha pasado con las entradas que hay, no una previsión. ' +
    'Hasta que no haya entradas con recorrido suficiente (el contador de arriba), no se puede concluir de aquí que el sistema funcione.'));
  return d;
}

/* OPERAR EL PANEL: comprar cuando lo dice, vender cuando salta el stop, y reinvertir.

   Es la pregunta de verdad, y ninguna de las cifras anteriores la contestaba. La media por entrada
   trata cada posicion por separado y en plazos distintos. La cartera del listado reequilibra a diario
   en el top entero, que no es lo que nadie hace. Esto es el protocolo tal cual: un numero de huecos
   de cartera, se llenan con lo mejor puntuado del top segun va apareciendo, cada posicion lleva SU
   stop (EMA 50 incluida, que desde el 07/10/2026 se guarda a diario) y al vender el dinero vuelve a
   la caja y se reinvierte.

   Reglas del reparto, que cambian el resultado y se dicen en la pestana:
   - Retraso de un dia, igual que en el resto: lo del top de esta noche se compra manana al cierre.
   - Huecos iguales: cada compra se lleva el total entre el numero de huecos.
   - No se vuelve a entrar en una accion de la que ya se salio. Sin esta regla, una que te acaba de
     saltar el stop se recompraria al dia siguiente por seguir en el top, que es justo lo que nadie
     hace y ademas infla las operaciones. */
function operandoElPanel(huecos) {
  const dias = Object.keys(PRECIOS || {}).sort();
  const emas = window.__EMAS__ || {};
  const ses = [...FH].sort();
  if (dias.length < 3) return null;
  let caja = 100, abiertas = [], cerradas = [], pico = 100, caida = 0;
  /* La curva arranca el primer dia de la serie, aunque ese dia aun estes en liquidez: la cartera
     existe desde ahi. Sin este punto la cartera operada empezaba UN DIA despues que la del listado
     y las dos comparaban con un tramo distinto del S&P, asi que la pestaña enseñaba "-2,2 %" y
     "-2,5 %" bajo la MISMA etiqueta "el S&P 500 en el mismo tramo". Lo cazo la auditoria. */
  const curva = [{ f: dias[0], v: 100, n: 0 }];
  for (let i = 1; i < dias.length; i++) {
    const hoy = dias[i], ayer = dias[i - 1];
    if (!PRECIOS[hoy]) continue;
    for (const pos of [...abiertas]) {
      const c = PRECIOS[hoy][pos.k];
      if (c == null) continue;
      pos.maxc = Math.max(pos.maxc, c);
      const ganMax = (pos.maxc / pos.compra - 1) * 100, gan = (c / pos.compra - 1) * 100;
      pos.stop = Math.max(pos.stop, window.REGLAS.stopDe(
        { precio: c, ema50: (emas[hoy] || {})[pos.k] }, pos.compra, pos.stop, ganMax) || 0);
      const limite = window.REGLAS.limiteDevolucion(ganMax);
      const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
      const motivo = c < pos.stop ? 'stop'
        : (limite != null && devuelto >= limite - 1e-9) ? 'devolución' : null;
      if (motivo) {
        caja += pos.acc * c;
        abiertas = abiertas.filter(x => x !== pos);
        cerradas.push({ ticker: pos.ticker, entrada: pos.f, salida: hoy, motivo,
          r: (c / pos.compra - 1) * 100 });
      }
    }
    /* El top que se compra HOY es el ultimo publicado antes de hoy: cierra la sesion de ayer, el
       panel lo publica esa noche y tu compras al cierre de hoy. Aqui habia 's < ayer', que es el top
       de ANTEAYER: un dia de retraso de mas, y con el las senales se cogian tarde. Lo encontraron las
       pruebas nuevas. Ojo, en carteraDelTop() 's < ayer' SI es lo correcto, porque alli la posicion
       ya estaba abierta al cierre de ayer y lo que se mide es lo que renta de ayer a hoy. */
    const pub = ses.filter(s => s < hoy).pop();
    if (pub) {
      const tengo = new Set(abiertas.map(x => x.k)), hechas = new Set(cerradas.map(x => x.ticker));
      const cand = (((HIST[pub] || {}).acciones) || [])
        .filter(a => !tengo.has(a.s || a.t) && !hechas.has(a.t) && PRECIOS[hoy][a.s || a.t] != null)
        .sort((a, b) => (b.sc || 0) - (a.sc || 0));
      for (const a of cand) {
        if (abiertas.length >= huecos) break;
        const k = a.s || a.t, c = PRECIOS[hoy][k];
        const total = caja + abiertas.reduce((s, x) => s + x.acc * (PRECIOS[hoy][x.k] || x.compra), 0);
        /* Se invierte lo que haya en caja cuando no llega al hueco entero. Antes esto era
           "if (importe > caja) break", y dejaba el dinero parado PARA SIEMPRE: al salir de una
           posicion con perdida, lo que vuelve a la caja ya no da para un quinto de la cartera, y
           como las que siguen abiertas suben, el objetivo se aleja cada dia. En el registro real
           eso dejaba 10 de 13 sesiones con un hueco vacio y un 16 % sin invertir. Nadie opera asi:
           si te queda menos de lo que querias, compras con lo que tienes. */
        const importe = Math.min(total / huecos, caja);
        if (importe <= total * 0.01) break;   // calderilla: no se abre posicion por migajas
        caja -= importe;
        abiertas.push({ k, ticker: a.t, f: hoy, compra: c, acc: importe / c, maxc: c, stop: 0 });
      }
    }
    const valor = caja + abiertas.reduce((s, x) => s + x.acc * (PRECIOS[hoy][x.k] || x.compra), 0);
    pico = Math.max(pico, valor); caida = Math.min(caida, valor / pico - 1);
    curva.push({ f: hoy, v: valor, n: abiertas.length });
  }
  if (curva.length < 3) return null;
  /* 'cartera' son las posiciones que quedan vivas, con nombre: "5 posiciones" no dice CUALES, y
     esa era la duda. 'abiertas' sigue siendo el numero para no romper a quien ya lo usa. */
  const ultimo = dias[dias.length - 1];
  /* Se devuelven tambien el valor de cada posicion y la caja: sin ellos no se puede comprobar la
     identidad contable (valor final = caja + suma de las posiciones), que es lo unico que garantiza
     que la cifra de cabecera y la tabla de posiciones no se separen nunca. */
  return { curva, ret: curva[curva.length - 1].v - 100, caida: caida * 100,
    cerradas, abiertas: abiertas.length, sesiones: curva.length, caja,
    cartera: abiertas.map(x => {
      const ah = (PRECIOS[ultimo] || {})[x.k];
      return { ticker: x.ticker, desde: x.f, compra: x.compra, ahora: ah, acciones: x.acc,
        valor: x.acc * (ah != null ? ah : x.compra),
        ret: ah != null ? (ah / x.compra - 1) * 100 : null };
    }).sort((a, b) => (b.ret ?? -1e9) - (a.ret ?? -1e9)) };
}

/* Expuesta para que Seguimiento pueda citar la cifra de la cartera sin recalcularla por su cuenta:
   las dos pestañas enseñaban un numero distinto ("1,2 % aqui y 2,4 % alli") sin decir que miden
   cosas diferentes, y eso confunde mas que no poner nada. */
window.operandoElPanel = operandoElPanel;

function bloqueOperando() {
  const HUECOS = 5;
  const r = operandoElPanel(HUECOS);
  if (!r) return null;
  const ses = [...FH].sort();
  const spyDe = f => { const s = ses.filter(x => x <= f).pop(); return s ? (HIST[s] || {}).spy : null };
  const s0 = spyDe(r.curva[0].f);
  const spy = s0 ? r.curva.map(x => ({ f: x.f, v: spyDe(x.f) ? 100 * spyDe(x.f) / s0 : null })).filter(x => x.v != null) : [];
  const spyRet = spy.length ? spy[spy.length - 1].v - 100 : null;

  const d = el('div', 'blk');
  /* Cuantas posiciones lleva la cartera va ANTES de las cifras. Estaba solo en el parrafo de debajo
     de la grafica, que es donde no se mira: "pero operando el panel cogiendo hasta donde? las 10
     primeras, las 5 primeras? no lo pone". Un +2,4 % sin saber sobre cuantas posiciones no se puede
     interpretar, y mas cuando cambiar ese numero mueve el resultado 5 puntos. */
  d.appendChild(el('div', 'blt', 'Si hubieras operado el panel con ' + HUECOS + ' posiciones: comprar cuando lo dice, vender con el stop'));
  d.appendChild(el('div', 'm', 'Llevas como mucho ' + HUECOS + ' acciones a la vez, a partes iguales: las ' + HUECOS +
    ' mejor puntuadas que hubiera disponibles el día que compras. Una vez dentro, ahí se queda hasta que le salta el stop — ' +
    'no se cambia por otra que suba de puesto. Al vender, ese hueco lo ocupa la mejor puntuada que no hayas tenido ya. ' +
    'Más abajo tienes lo que habría salido con otro número de posiciones.'));
  /* La tercera casilla enseña la DIFERENCIA con el indice, no el peor momento: es la pregunta
     ("¿le gano al S&P o no?") y hace falta restar dos numeros a mano para saberla. El peor momento
     no se pierde, baja a la linea de texto. */
  const dif = spyRet != null ? r.ret - spyRet : null;
  const st = el('div', 'stats');
  st.append(stat('tu cartera', pc(r.ret), signo(r.ret)),
    stat('el S&P 500 en el mismo tramo', spyRet != null ? pc(spyRet) : '—', signo(spyRet || 0)),
    stat('de diferencia', dif != null ? (dif >= 0 ? '+' : '') + n(dif, 1) + ' pt' : '—', signo(dif || 0)),
    stat('ventas cerradas', String(r.cerradas.length), ''));
  d.appendChild(st);
  if (spy.length >= 3) {
    const g = grafica(r.curva, spy);
    d.appendChild(g);
    d.appendChild(leyenda(g, 'tu cartera', r.ret, 'el S&P 500', spyRet != null ? spyRet : 0));
  }
  d.appendChild(el('div', 'm', 'En ' + r.sesiones + ' sesiones. Por el camino llegó a estar en ' + pc(r.caida) +
    ', que es lo que habrías tenido que aguantar. Cada posición lleva su propio stop, el de la pestaña Parámetros.'));

  /* Cuales son, con nombre y apellidos. Sin esto "5 posiciones" es un numero abstracto. */
  if (r.cartera && r.cartera.length) {
    const s = el('div', 'blk');
    /* Sin clase 'blt': es una tabla DENTRO de este bloque, no una seccion nueva. La prueba de humo
       cuenta los titulos sin plegar y salta si la pestaña vuelve a llenarse de secciones, que es
       justo lo que la hizo ilegible ayer. */
    const cab = el('div', 'm'); cab.appendChild(el('b', null, 'Las ' + r.cartera.length + ' que tendrías ahora mismo'));
    s.appendChild(cab);
    /* Las columnas "le tocaron" y "valen" son las que hacen entendible el total. Sin ellas la
       pestaña enseñaba cinco posiciones al +14, +11, +10, +3 y -0,2 % y un total de +2,4 %, y eso
       parece imposible: "si solo hay una en negativo". La clave es que NO todas partieron de lo
       mismo. Las que entraron tras una venta en perdida recibieron lo que quedo de ella: SLDE
       empezo con 16,46 de cada 100, no con 20, porque es lo que sobrevivio de COHU. */
    const tv = el('table', 'tabla'), hv = el('tr');
    ['Acción', 'Le tocaron', 'Valen hoy', 'Va'].forEach(x => hv.appendChild(el('th', null, x)));
    tv.appendChild(hv);
    r.cartera.forEach(x => {
      const coste = x.ret != null ? x.valor / (1 + x.ret / 100) : x.valor;
      const tr = el('tr');
      const td = el('td'); td.appendChild(el('b', null, x.ticker));
      td.appendChild(el('div', 'name', fFecha(x.desde) + ' · ' + n(x.compra) + ' $'));
      tr.appendChild(td);
      tr.appendChild(el('td', null, n(coste, 2) + ' €'));
      tr.appendChild(el('td', null, n(x.valor, 2) + ' €'));
      tr.appendChild(el('td', x.ret == null ? 'm' : x.ret >= 0 ? 'up' : 'down', x.ret == null ? '—' : pc(x.ret)));
      tv.appendChild(tr);
    });
    const w = el('div', 'tw'); w.appendChild(tv); s.appendChild(w);
    /* La fecha de compra NO es la de entrada al top, y verlas distintas en la misma pestaña
       despista: SLDE entro al top el 7 pero no se pudo comprar hasta el 14, cuando se vendio COHU
       y quedo hueco. En el registro de mas abajo sale con su fecha de entrada al top y otra
       rentabilidad, y las dos son correctas: miden cosas distintas. */
    d._cartera = r.cartera.map(x => x.ticker);
    /* La fecha de compra NO es la de entrada al top, y verlas distintas en la misma pestaña
       despista: SLDE entro al top el 7 pero no se pudo comprar hasta el 14, cuando se vendio COHU
       y quedo hueco. Se dice la regla y no se nombran los casos, porque le pasa practicamente a
       todas y la lista era puro ruido. */
    /* La reconciliacion, que es lo que de verdad contesta "no tiene sentido el 2,4 %". */
    const coste = r.cartera.reduce((s2, x) => s2 + (x.ret != null ? x.valor / (1 + x.ret / 100) : x.valor), 0);
    const valor = r.cartera.reduce((s2, x) => s2 + x.valor, 0);
    const media = r.cartera.reduce((s2, x) => s2 + (x.ret || 0), 0) / r.cartera.length;
    const cuadre = el('div', 'margen');
    cuadre.appendChild(el('b', null, '¿Por qué ' + pc(r.ret) + ' si las cinco van a ' + pc(media) + ' de media?'));
    const cc = el('div', 'm');
    cc.appendChild(el('div', null, '100,00 € para empezar.'));
    cc.appendChild(el('div', null, n(coste - 100, 2) + ' € se perdieron en las ' + r.cerradas.length +
      ' ventas cerradas (' + r.cerradas.map(x => x.ticker).join(', ') + '), así que solo quedaron ' +
      n(coste, 2) + ' € invertidos.'));
    cc.appendChild(el('div', null, '+' + n(valor - coste, 2) + ' € han ganado las ' + r.cartera.length +
      ' vivas, pero sobre esos ' + n(coste, 2) + ' €, no sobre 100.'));
    cc.appendChild(el('div', null, 'Total ' + n(valor + r.caja, 2) + ' € → ' + pc(r.ret) + '.'));
    const tarde2 = r.cartera.filter(x => x.ret != null && Math.abs(x.valor / (1 + x.ret / 100) - 100 / r.cartera.length) > 0.01);
    if (tarde2.length) cc.appendChild(el('div', null, 'Fíjate en la columna «le tocaron»: ' +
      tarde2.map(x => x.ticker).join(' y ') + ' no empeza' + (tarde2.length === 1 ? 'ron' : 'ron') +
      ' con ' + n(100 / r.cartera.length, 2) + ' € como las demás, sino con lo que quedó de la posición que se vendió antes. ' +
      'Por eso un +11 % suyo pesa menos que un +11 % de las otras.'));
    cuadre.appendChild(cc);
    /* El cuadre y la nota de fechas no se pintan aqui: se guardan y bajan al plegable del final,
       porque son respuesta a una duda concreta y no hay que releerlas cada vez. */
    d._cuadre = cuadre;
    d._fechas = el('div', 'm', 'La fecha de compra es la del día en que hubo hueco, no la de su entrada al top: ' +
      'solo se compra cuando una venta libera sitio. Por eso en el registro de más abajo estas mismas acciones ' +
      'aparecen con otra fecha y otra rentabilidad, medida desde que entraron al top. Las dos son correctas.');
    d.appendChild(s);
  }

  if (r.cerradas.length) {
    const tv = el('table', 'tabla'), hv = el('tr');
    ['Vendida', 'Entró', 'Salió', 'Por qué', 'Resultado'].forEach(x => hv.appendChild(el('th', null, x)));
    tv.appendChild(hv);
    [...r.cerradas].sort((a, b) => a.r - b.r).forEach(c => {
      const tr = el('tr');
      tr.appendChild(el('td', null, c.ticker));
      tr.appendChild(el('td', null, fFecha(c.entrada)));
      tr.appendChild(el('td', null, fFecha(c.salida)));
      tr.appendChild(el('td', null, c.motivo));
      tr.appendChild(el('td', c.r >= 0 ? 'up' : 'down', pc(c.r)));
      tv.appendChild(tr);
    });
    const w = el('div', 'tw'); w.appendChild(tv); d.appendChild(w);
  }

  /* UN solo aviso con las dos razones por las que esta cifra no es una rentabilidad: pocas ventas
     cerradas y una sensibilidad enorme a una decision arbitraria. Antes eran dos recuadros
     separados diciendo lo mismo, y la pestaña se llenaba de prosa. */
  const otras = [1, 2, 3, 8, 10].map(h => ({ h, r: operandoElPanel(h) })).filter(x => x.r);
  const todos = otras.length ? [...otras.map(x => x.r.ret), r.ret] : [r.ret];
  const abanico = Math.max(...todos) - Math.min(...todos);
  const av = el('div', 'margen margen-cero');
  av.appendChild(el('b', null, 'Esto todavía no es una rentabilidad'));
  const ac = el('div', 'm');
  ac.appendChild(el('div', null, 'Solo ' + r.cerradas.length +
    (r.cerradas.length === 1 ? ' venta cerrada' : ' ventas cerradas') +
    '; el resto son posiciones abiertas valoradas a precio de hoy, que puede cambiar mañana. ' +
    'Una rentabilidad media necesita decenas de operaciones completas.'));
  if (otras.length) ac.appendChild(el('div', null, 'Y cambiar solo cuántas posiciones llevas mueve el resultado ' +
    n(abanico, 1) + ' puntos. Si una decisión arbitraria mueve más que el resultado, el resultado no dice nada.'));
  ac.appendChild(el('div', null, 'Sin comisiones ni diferencial. Las compras, al cierre del día siguiente, que es cuando verías la señal.'));
  av.appendChild(ac);
  d.appendChild(av);

  /* El detalle, plegado y CERRADO: el cuadre de por que sale esa cifra, la nota de las fechas y lo
     que habria salido con otro numero de posiciones. Son respuesta a una duda concreta, no algo que
     haya que leer cada vez que abres la pestaña. */
  const detalle = plegable('Ver el detalle: de dónde sale esa cifra',
    [d._cuadre, d._fechas, (function () {
      if (!otras.length) return null;
      const x = el('div', 'm');
      x.appendChild(el('b', null, 'Con otro número de posiciones'));
      x.appendChild(el('div', null, otras.concat([{ h: HUECOS, r }])
        .sort((a, b) => a.h - b.h)
        .map(y => y.h + (y.h === 1 ? ' posición ' : ' posiciones ') + pc(y.r.ret) + (y.h === HUECOS ? ' ←' : ''))
        .join(' · ')));
      x.appendChild(el('div', null, 'Con 1 posición compras solo la de más momentum en cada momento; con 10, el top entero.'));
      return x;
    })()], false);
  if (detalle) d.appendChild(detalle);
  return d;
}

/* LA CARTERA: que habria hecho el listado ENTERO, como una sola cosa.

   Responde a "¿la rentabilidad es conjunta?". No lo era: la cifra de arriba es la media simple de
   cada entrada por separado, cada una medida en un plazo distinto (una lleva 13 sesiones y otra 1),
   y pesan igual. Eso no es la rentabilidad de una cartera, es el promedio de apuestas sueltas.

   Aqui se compone de verdad: compras el top a partes iguales, lo reequilibras cada sesion y la
   rentabilidad se encadena. Dos decisiones que cambian el numero y conviene saber:

   1. El top publicado la noche de t se compra al cierre de t+1, no al de t. El precio de la noche
      en que el panel detecta una accion no es un precio al que pudieras comprar: la ves a la manana
      siguiente. Sin este retraso la cartera cobraria gratis el hueco de la noche.
   2. No hay supervivencia escondida: una accion que cae y sale del top deja su caida dentro de la
      curva hasta el dia que sale, que es lo que te habria pasado. */
function carteraDelTop() {
  const dias = Object.keys(PRECIOS || {}).sort();
  const ses = [...FH].sort();
  if (dias.length < 3) return null;
  let v = 100, pesos = {}, pico = 100, caida = 0;
  const serie = [{ f: dias[0], v: 100 }], rot = [];
  for (let i = 1; i < dias.length; i++) {
    const hoy = dias[i], ayer = dias[i - 1];
    const pub = ses.filter(s => s < ayer).pop();      // el retraso de un dia
    if (!pub) continue;
    const m = ((HIST[pub] || {}).acciones || []).map(a => a.s || a.t)
      .filter(k => PRECIOS[ayer] && PRECIOS[hoy] && PRECIOS[ayer][k] != null && PRECIOS[hoy][k] != null);
    if (!m.length) continue;
    const objetivo = {};
    m.forEach(k => objetivo[k] = 1 / m.length);
    let giro = 0;
    new Set([...Object.keys(pesos), ...Object.keys(objetivo)])
      .forEach(k => giro += Math.abs((objetivo[k] || 0) - (pesos[k] || 0)));
    rot.push(giro / 2);
    const r = m.reduce((s, k) => s + (PRECIOS[hoy][k] / PRECIOS[ayer][k] - 1), 0) / m.length;
    v *= 1 + r;
    pico = Math.max(pico, v); caida = Math.min(caida, v / pico - 1);
    serie.push({ f: hoy, v });
    const bruto = {}; let suma = 0;
    m.forEach(k => { const w = (1 / m.length) * (PRECIOS[hoy][k] / PRECIOS[ayer][k]); bruto[k] = w; suma += w });
    pesos = {}; m.forEach(k => pesos[k] = bruto[k] / suma);
  }
  if (serie.length < 3) return null;
  /* El indice, en el mismo tramo y con el mismo arranque, para que las dos curvas sean comparables. */
  const spyDe = f => { const s = ses.filter(x => x <= f).pop(); return s ? (HIST[s] || {}).spy : null };
  const s0 = spyDe(serie[0].f);
  const spy = s0 ? serie.map(x => ({ f: x.f, v: spyDe(x.f) ? 100 * spyDe(x.f) / s0 : null })).filter(x => x.v != null) : [];
  return { serie, spy, ret: v - 100, caida: caida * 100,
    spyRet: spy.length ? spy[spy.length - 1].v - 100 : null,
    rotacion: rot.length ? 100 * rot.reduce((s, x) => s + x, 0) / rot.length : null,
    sesiones: serie.length - 1 };
}

/* Dos curvas en un SVG pequeno. Sin libreria: son 15 puntos. */
/* Dos curvas y una leyenda. Antes eran dos lineas sueltas de 70 px sin nada mas: sabias que habia
   dos pero no cual era cual sin leer el parrafo de debajo, y no se veia donde estaba el cero.

   Lo que se anade sin crecer apenas (70 -> 76 px de dibujo, mas una linea de leyenda de 16):
   - Linea de referencia en el punto de partida: arriba de ella ganas, abajo pierdes.
   - La cartera va rellena y solida; el indice, discontinuo y gris. Se distinguen tambien en blanco
     y negro y para quien no separa bien el rojo del verde, que con dos lineas de color no pasaba.
   - Leyenda con el resultado final de cada una pegado a su muestra de linea, en HTML y no dentro
     del SVG: el SVG se estira para llenar el ancho (preserveAspectRatio="none") y cualquier texto
     dentro saldria deformado.
   - vector-effect="non-scaling-stroke" para que ese estirado no engorde los trazos ni deforme los
     guiones del indice. */
function muestraLinea(clase) {
  const s = document.createElement('span');
  s.className = 'muestra ' + clase;
  return s;
}

/* Etiquetas del eje de fechas, adaptadas a cuantos puntos haya. El panel publica hasta 90 sesiones
   (DIAS en build.py), asi que esto tiene que aguantar desde 3 puntos hasta 90 sin amontonarse:
   - hasta 45 sesiones: cinco fechas repartidas, con dia y mes ("7 oct").
   - de 45 en adelante: la primera sesion de cada mes ("nov"), que es lo unico que cabe y ademas es
     lo que se quiere leer a esa escala. Si aun asi salieran mas de 7, se dejan una de cada dos.
   Siempre entran la primera y la ultima, que son las que enmarcan el tramo. */
function etiquetasFecha(serie) {
  const n = serie.length, mes = f => new Date(f + 'T12:00:00Z').toLocaleDateString('es-ES', { month: 'short' });
  const dia = f => new Date(f + 'T12:00:00Z').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  if (n < 2) return [];
  if (n <= 45) {
    const cuantas = Math.min(5, n);
    const idx = [...new Set(Array.from({ length: cuantas }, (_, i) => Math.round(i * (n - 1) / (cuantas - 1))))];
    return idx.map(i => ({ i, txt: dia(serie[i].f) }));
  }
  let marcas = [{ i: 0, txt: dia(serie[0].f) }];
  for (let i = 1; i < n; i++) if (serie[i].f.slice(0, 7) !== serie[i - 1].f.slice(0, 7)) marcas.push({ i, txt: mes(serie[i].f) });
  /* La ultima fecha solo se añade si queda lejos de la marca anterior. Sin esto, a 90 sesiones
     salia "feb | 5 feb" pegadas, y a 130 "abr | 2 abr": la misma informacion dos veces y encimadas. */
  if (n - 1 - marcas[marcas.length - 1].i > n * 0.08) marcas.push({ i: n - 1, txt: dia(serie[n - 1].f) });
  /* El adelgazado va DESPUES de añadir la ultima, no antes: hacerlo antes dejaba 8 etiquetas. */
  while (marcas.length > 7) marcas = marcas.filter((_, j) => j % 2 === 0 || j === marcas.length - 1);
  return marcas;
}

function grafica(a, b, nombreA, nombreB) {
  const W = 320, A = 76, base = a[0].v;
  const todo = [...a.map(x => x.v), ...b.map(x => x.v), base];
  const lo = Math.min(...todo), hi = Math.max(...todo), rango = (hi - lo) || 1;
  const px = (xs, i) => 1 + i * (W - 2) / Math.max(xs.length - 1, 1);
  const py = v => A - 5 - (v - lo) / rango * (A - 10);
  const d = xs => xs.map((p, i) => (i ? 'L' : 'M') + px(xs, i).toFixed(1) + ' ' + py(p.v).toFixed(1)).join(' ');
  const gana = a[a.length - 1].v >= base;
  const color = gana ? 'var(--up)' : 'var(--down)';
  const yBase = py(base).toFixed(1);
  const area = d(a) + ` L ${px(a, a.length - 1).toFixed(1)} ${yBase} L ${px(a, 0).toFixed(1)} ${yBase} Z`;

  const env = document.createElement('div');
  env.className = 'grafica';
  const lienzo = document.createElement('div');
  lienzo.className = 'lienzo';
  lienzo.innerHTML =
    `<svg viewBox="0 0 ${W} ${A}" preserveAspectRatio="none" role="img" aria-label="Curva de la cartera frente al S&P 500">` +
    `<path d="${area}" fill="${color}" opacity="0.13" stroke="none"/>` +
    /* var(--line) es casi el color de la tarjeta: la referencia quedaba invisible. */
    `<line x1="1" y1="${yBase}" x2="${W - 1}" y2="${yBase}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="1 4" opacity="0.5" vector-effect="non-scaling-stroke"/>` +
    `<path d="${d(b)}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-dasharray="4 3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>` +
    `<path d="${d(a)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>` +
    '</svg>';
  /* Marca vertical y puntos del dia señalado. Van en HTML y no en el SVG porque el SVG se estira
     (preserveAspectRatio="none") y un circulo saldria ovalado. */
  const marca = el('div', 'marca'); marca.style.display = 'none';
  /* La fecha del dia señalado va FLOTANDO dentro de la grafica, no en la leyenda. En el movil la
     leyenda pasaba de 25 a 57 px al aparecer la fecha y todo lo de abajo daba un salto mientras
     arrastrabas el dedo. Aqui no mueve nada. */
  const etiq = el('div', 'etiqdia'); etiq.style.display = 'none';
  const ptA = el('div', 'punto pA'); const ptB = el('div', 'punto pB');
  ptA.style.display = ptB.style.display = 'none';
  ptA.style.background = color;
  lienzo.append(marca, ptA, ptB, etiq);
  env.appendChild(lienzo);

  const eje = el('div', 'eje');
  etiquetasFecha(a).forEach(m => {
    const s = el('span', null, m.txt);
    s.style.left = (100 * m.i / (a.length - 1)) + '%';
    /* Las de los extremos se pegan al borde para que no se salgan de la caja. */
    if (m.i === 0) s.style.transform = 'none';
    else if (m.i === a.length - 1) s.style.transform = 'translateX(-100%)';
    eje.appendChild(s);
  });
  env.appendChild(eje);

  /* Leer un dia concreto: al pasar el dedo o el raton, la leyenda de abajo cambia y enseña la fecha
     y lo que valia la cartera y el indice ESE dia. Con 90 sesiones no caben 90 etiquetas, asi que
     esta es la forma de "saber que rentabilidad ha tenido cada dia" sin llenar la pantalla. */
  env._leer = null;
  const mover = ev => {
    const r = lienzo.getBoundingClientRect();
    /* Ancho cero: la pestaña esta oculta o aun no se ha maquetado. Dividir por el daba NaN, el
       indice se salia del array y el manejador reventaba con "Cannot read properties of undefined".
       Lo encontro la auditoria del 25/10/2026 recorriendo las pestañas por codigo. No se puede
       provocar tocando (no se ve), pero un manejador no debe poder romperse. */
    if (!r.width) return;
    const frac = (ev.clientX - r.left) / r.width;
    /* Math.min/Math.max PROPAGAN NaN, asi que recortar no basta: con una coordenada no numerica el
       indice salia NaN igual y a[NaN] es undefined. Hay que descartarlo antes. */
    if (!Number.isFinite(frac)) return;
    const i = Math.max(0, Math.min(a.length - 1, Math.round(Math.min(1, Math.max(0, frac)) * (a.length - 1))));
    const pos = 100 * i / (a.length - 1);
    marca.style.display = ''; marca.style.left = pos + '%';
    ptA.style.display = ''; ptA.style.left = pos + '%'; ptA.style.top = (100 * py(a[i].v) / A) + '%';
    const j = Math.min(i, b.length - 1);
    ptB.style.display = ''; ptB.style.left = (100 * j / Math.max(b.length - 1, 1)) + '%';
    ptB.style.top = (100 * py(b[j].v) / A) + '%';
    etiq.style.display = ''; etiq.textContent = fFecha(a[i].f);
    /* Se cambia de lado al pasar de la mitad para que no se salga de la caja. */
    etiq.classList.toggle('dcha', pos > 55);
    if (env._leer) env._leer(a[i], b[j]);
  };
  const salir = () => {
    marca.style.display = ptA.style.display = ptB.style.display = etiq.style.display = 'none';
    if (env._leer) env._leer(null, null);
  };
  lienzo.addEventListener('pointermove', mover);
  lienzo.addEventListener('pointerdown', mover);
  lienzo.addEventListener('pointerleave', salir);
  lienzo.addEventListener('pointercancel', salir);
  return env;
}

/* La leyenda va aparte para poder nombrar cada linea con su resultado: es lo que convierte dos
   trazos en dos cosas distinguibles de un vistazo. Y es tambien donde se lee el dia señalado: al
   pasar el dedo por la grafica, las cifras finales se sustituyen por las de ESE dia y la fecha.
   Asi se puede mirar dia a dia sin gastar ni un pixel mas de alto. */
function leyenda(g, nombreA, retA, nombreB, retB) {
  const l = el('div', 'leyenda');
  const item = (clase, nombre, ret) => {
    const s = el('span', 'leyitem');
    s.appendChild(muestraLinea(clase));
    const b = el('b', ret >= 0 ? 'up' : 'down', pc(ret));
    const nm = el('span', null, ' ' + nombre);
    s.append(b, nm);
    return { s, b };
  };
  const iA = item(retA >= 0 ? 'mA' : 'mA mBaja', nombreA, retA);
  const iB = item('mB', nombreB, retB);
  l.append(iA.s, iB.s);
  if (g) g._leer = (pa, pb) => {
    if (!pa) {
      iA.b.textContent = pc(retA); iA.b.className = retA >= 0 ? 'up' : 'down';
      iB.b.textContent = pc(retB); iB.b.className = retB >= 0 ? 'up' : 'down';
      return;
    }
    /* Las curvas arrancan en 100, asi que el valor menos 100 es la rentabilidad acumulada ese dia. */
    const ra = pa.v - 100, rb = pb ? pb.v - 100 : 0;
    iA.b.textContent = pc(ra); iA.b.className = ra >= 0 ? 'up' : 'down';
    iB.b.textContent = pc(rb); iB.b.className = rb >= 0 ? 'up' : 'down';
  };
  return l;
}

function bloqueCartera() {
  const c = carteraDelTop();
  if (!c) return null;
  const cuantas = ((HIST[FH[0]] || {}).acciones || []).length || 10;
  const d = el('div', 'blk');
  /* El titulo era "Si hubieras comprado el listado entero, como una sola cartera" y se leia como
     "comprar y no vender nunca". Es justo lo contrario: esta cartera VENDE, y vende mucho. Lo que
     no usa es el stop: la señal de salida es caerse del listado. Sin decir eso, la cifra choca de
     frente con la de arriba y no hay forma de entenderla. */
  d.appendChild(el('div', 'blt', 'Si siguieras el listado a rajatabla: fuera lo que sale, dentro lo que entra'));
  d.appendChild(el('div', 'm', 'Cada sesión te quedas exactamente con las ' + cuantas + ' del top: vendes la que se ha caído del listado ' +
    'y compras la que ha entrado, a partes iguales. Aquí no hay stop — la única señal de venta es salirse del top.'));
  const st = el('div', 'stats');
  st.append(stat('siguiendo el listado', pc(c.ret), signo(c.ret)),
    stat('el S&P 500 en el mismo tramo', c.spyRet != null ? pc(c.spyRet) : '—', signo(c.spyRet || 0)),
    stat('su peor caída', pc(c.caida), 'down'));
  d.appendChild(st);
  if (c.spy.length >= 3) {
    const g = grafica(c.serie, c.spy);
    d.appendChild(g);
    d.appendChild(leyenda(g, 'siguiendo el listado', c.ret, 'el S&P 500', c.spyRet != null ? c.spyRet : 0));
  }

  /* Puente con la cifra de arriba, que es la primera pregunta que salta al ver las dos juntas. */
  const operada = operandoElPanel(5);
  if (operada) {
    const puente = el('div', 'margen');
    puente.appendChild(el('b', null, '¿Por qué ' + pc(c.ret) + ' aquí y ' + pc(operada.ret) + ' más arriba?'));
    const ul = el('div', 'm');
    ul.appendChild(el('div', null, '· Arriba vendes cuando lo dice el stop, aunque la acción siga en el top. Aquí vendes el día que se cae del listado, aunque el stop no haya saltado.'));
    ul.appendChild(el('div', null, '· Arriba llevas 5 posiciones; aquí, las ' + cuantas + ' del top.'));
    ul.appendChild(el('div', null, 'Son dos formas distintas de salir, no dos cuentas del mismo sistema. La de arriba es la tuya.'));
    puente.appendChild(ul);
    d.appendChild(puente);
  }

  const av = el('div', 'margen margen-cero');
  av.appendChild(el('b', null, 'Y no es para copiarlo'));
  av.appendChild(el('div', 'm', 'Seguir el listado así mueve el ' + (c.rotacion != null ? n(c.rotacion, 0) : '25') +
    ' % de la cartera cada sesión. Con esa rotación las comisiones y el diferencial se llevan una parte, ' +
    'y además te quedarías sin stop: una acción puede desplomarse sin salir del top y aquí la aguantas. ' +
    'Sirve para saber si el listado acierta, no para operarlo. Con ' + c.sesiones + ' sesiones no demuestra nada.'));
  d.appendChild(av);
  d.appendChild(el('div', 'm', 'El top de cada noche se compra al cierre del día siguiente, que es cuando tú lo verías. ' +
    'Sin ese retraso la cartera se apuntaría gratis el salto de la noche. ' +
    'La rentabilidad se encadena, no se promedia.'));
  return d;
}

/* El registro en bruto. Esto no concluye nada, pero se entiende sin saber estadistica: cada accion que
   ha entrado, con que nota, a que precio y que ha hecho desde entonces. */
/* Las que han dejado de cotizar no tienen resultado: van siempre al final, ordene como ordene.
   Con el rendimiento a nulo se colarian en medio como si fueran un 0 %, y no es lo que son. */
const ORDENES = {
  momentum: { t: 'por la nota que tenían al entrar, de mayor a menor', f: (a, b) => (b.score ?? -1e9) - (a.score ?? -1e9) },
  mejor:    { t: 'de lo que mejor va a lo que peor', f: (a, b) => b.ret - a.ret },
  peor:     { t: 'de lo que peor va a lo que mejor', f: (a, b) => a.ret - b.ret },
  reciente: { t: 'de la entrada más reciente a la más antigua', f: (a, b) => (a.entrada < b.entrada ? 1 : a.entrada > b.entrada ? -1 : 0) },
  antigua:  { t: 'de la entrada más antigua a la más reciente', f: (a, b) => (a.entrada > b.entrada ? 1 : a.entrada < b.entrada ? -1 : 0) },
  recorrido:{ t: 'por sesiones de recorrido, de más a menos', f: (a, b) => b.sesiones - a.sesiones },
  indice:   { t: 'por lo que le sacan al S&P 500 en sus mismos días', f: (a, b) => ((b.ret - b.sp) || -1e9) - ((a.ret - a.sp) || -1e9) },
};

function registro(xs, enCartera) {
  const sel = $('resorden'), clave = (sel && sel.value) || 'momentum';
  const modo = ORDENES[clave] || ORDENES.momentum;
  const verSel = $('resver');
  const VER = verSel && verSel.value === '0' ? 1e9 : 15;
  const orden = [...xs].sort((a, b) => {
    if ((a.ret == null) !== (b.ret == null)) return a.ret == null ? 1 : -1;   // sin desenlace, al final
    return modo.f(a, b) || (a.entrada < b.entrada ? 1 : a.entrada > b.entrada ? -1 : 0);
  });
  const d = el('div', 'blk');
  d.appendChild(el('div', 'blt', 'Lo que llevamos anotado'));
  d.appendChild(el('div', 'm', 'Ordenado ' + modo.t + '. Ojo al comparar: la columna «Sesiones» dice cuánto recorrido lleva cada una, y un +5 % en dos sesiones no es lo mismo que un +5 % en quince.'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Acción', 'Entró', 'Nota al entrar', 'Precio al entrar', 'Precio ahora', 'Cambio', 'S&P 500', 'Sesiones'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  /* Las que la cartera simulada tiene compradas no se esconden nunca, aunque su nota las deje por
     debajo del corte. SLDE entro con nota 77 y quedaba en el puesto 21: la pestaña la enseñaba
     arriba, en la cartera, y abajo parecia que no estaba ("por que SLDE no sale en Resultados?").
     Es la misma regla que ya usa Seguimiento con las que tienes de verdad. */
  const tiene = new Set(enCartera || []);
  const visibles = orden.filter((a, i) => i < VER || tiene.has(a.ticker));
  const coladas = visibles.length - Math.min(VER, orden.length);
  visibles.forEach(a => {
    const tr = el('tr');
    const td = el('td'); td.appendChild(el('b', null, a.ticker));
    if (tiene.has(a.ticker)) td.appendChild(el('div', 'name', 'en la cartera simulada'));
    /* Una que ha dejado de cotizar no tiene resultado, y la fila tiene que leerse asi: no como una
       fila a medio rellenar. Se queda por el sesgo de supervivencia, pero se explica sola. */
    if (a.ret == null) td.appendChild(el('div', 'name', 'dejó de cotizar el ' + fFecha(a.ultimo)));
    else if (a.fuera) td.appendChild(el('div', 'name', 'ya no está en el top'));
    tr.appendChild(td);
    tr.appendChild(el('td', null, fFecha(a.entrada)));
    tr.appendChild(el('td', null, n(a.score, 0)));
    tr.appendChild(el('td', null, n(a.precio) + ' $'));
    tr.appendChild(el('td', a.ahora == null ? 'm' : null, a.ahora == null ? '—' : n(a.ahora) + ' $'));
    tr.appendChild(el('td', a.ret == null ? 'm' : a.ret >= 0 ? 'up' : 'down', a.ret == null ? '—' : pc(a.ret)));
    /* Lo que hizo el indice en la ventana de ESA entrada, no desde el principio: cada accion entro un
       dia distinto. El dato ya se guarda cada dia en el historico, asi que no cuesta ninguna llamada. */
    tr.appendChild(el('td', 'm', a.sp == null ? '—' : pc(a.sp)));
    const s = el('td');
    s.appendChild(a.ret == null
      ? el('span', 'est ebad', 'sin desenlace')
      : el('span', 'est ' + (a.sesiones >= MADUREZ ? 'eok' : 'eoff'),
          a.sesiones + (a.sesiones >= MADUREZ ? '' : ' de ' + MADUREZ)));
    tr.appendChild(s);
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  if (orden.length > VER) d.appendChild(el('div', 'm', 'Se muestran las ' + Math.min(VER, orden.length) + ' primeras de ' + orden.length +
    (coladas > 0 ? ', más ' + coladas + ' que están en la cartera simulada de arriba y por eso no se ocultan' : '') +
    '. Cambia el desplegable de arriba a «Todas» para verlas todas.'));
  return d;
}

/* Comparacion con el indice, en su propio bloque: estaba dentro del registro en bruto y eso
   obligaba a enseñar los dos juntos. Ahora el registro queda limpio y esto va al plegable. */
function comparaIndice(xs) {
  /* Comparacion con el indice. Tres cosas que antes faltaban y hacian que un numero en verde se
     leyera como un logro cuando no lo era:
     1. La barra de error. Decir "esto es ruido" en texto pequeno debajo de un "+1,7 pt" en verde
        grande no funciona: se lee el numero. Ahora el intervalo va al lado del numero.
     2. Las entradas no son independientes. El 05/10/2026 entraron NUEVE acciones a la vez; si el
        mercado se mueve ese dia, se mueven las nueve, asi que no son nueve observaciones sino una.
        El remuestreo se hace por DIA de entrada, no por accion. (Esto no siempre ensancha el
        intervalo: con estos 12 dias sale algo mas estrecho que el ingenuo. Se hace porque es el
        metodo valido para datos agrupados, no porque de un numero mayor.)
     3. La beta. Las anotadas se mueven del orden de 1,6 veces lo que el indice: cuando el mercado
        sube, superarlo es lo que toca, y cuando baja, perder menos tambien. Comparar sin descontar
        eso atribuye al panel lo que es solo volatilidad. */
  const conSp = xs.filter(a => a.sp != null && a.ret != null);
  if (conSp.length) {
    const mAcc = media(conSp.map(a => a.ret)), mSp = media(conSp.map(a => a.sp)), dif = mAcc - mSp;
    const c = el('div', 'blk'); c.style.marginTop = '10px';
    c.appendChild(el('div', 'blt', 'Comparado con el S&P 500, aguantando sin vender'));
    const st = el('div', 'stats');
    st.append(stat('las anotadas', pc(mAcc), signo(mAcc)), stat('el S&P 500 esos mismos días', pc(mSp), signo(mSp)),
      stat('diferencia', (dif >= 0 ? '+' : '') + n(dif, 1) + ' pt', signo(dif)));
    c.appendChild(st);

    const ic = intervalo(conSp);
    if (ic) {
      const cruza = ic.lo < 0 && ic.hi > 0;
      const li = el('div', 'margen' + (cruza ? ' margen-cero' : ''));
      li.appendChild(el('b', null, 'Margen de error: de ' + (ic.lo >= 0 ? '+' : '') + n(ic.lo, 1) +
        ' a ' + (ic.hi >= 0 ? '+' : '') + n(ic.hi, 1) + ' pt'));
      li.appendChild(el('div', 'm', cruza
        ? 'El margen incluye el cero, así que esta diferencia no se distingue de la casualidad. ' +
          'Son ' + conSp.length + ' entradas, pero repartidas en solo ' + ic.dias + ' días: las que entran el mismo día suben y bajan juntas y no cuentan por separado.'
        : 'El margen no incluye el cero. Son ' + conSp.length + ' entradas en ' + ic.dias + ' días distintos.'));
      c.appendChild(li);
    }

    const cb = conSp.filter(a => a.beta != null);
    if (cb.length >= Math.max(5, conSp.length / 2)) {
      const mB = media(cb.map(a => a.beta)), mSpB = media(cb.map(a => a.sp)), mAccB = media(cb.map(a => a.ret));
      const exceso = mAccB - mB * mSpB;
      const li = el('div', 'margen');
      li.appendChild(el('b', null, 'Descontando que se mueven más: ' + (exceso >= 0 ? '+' : '') + n(exceso, 1) + ' pt'));
      li.appendChild(el('div', 'm', 'Las anotadas tienen una beta media de ' + n(mB, 2) + ': se mueven ' + n(mB, 2) +
        ' veces lo que el índice, para bien y para mal. Con el S&P 500 en ' + pc(mSpB) + ', una cesta así debería haber hecho ' +
        pc(mB * mSpB) + ' sin ningún mérito. Hizo ' + pc(mAccB) + '. La diferencia de arriba no descuenta esto.'));
      c.appendChild(li);
    }

    c.appendChild(el('p', 'nota', 'Cada acción se compara con lo que hizo el índice desde el día que ella entró, no desde el principio. ' +
      'Y se mide AGUANTANDO SIN VENDER NUNCA, hasta el precio de hoy: esto responde a si el panel sabe ELEGIR, sin mezclarlo con cuándo sale. ' +
      'Con los stops puestos la media sale distinta, y es la que da la pestaña Seguimiento y la que contesta «¿habrías ganado dinero siguiendo el panel?» aquí arriba.'));
    return c;
  }
  return null;
}

/* Intervalo de confianza del 95 % de la diferencia media contra el indice, remuestreando por DIA de
   entrada (no por accion): las que entran el mismo dia comparten el movimiento del mercado de ese dia.
   Generador con semilla fija para que el numero no baile cada vez que se repinta la pestana. */
function intervalo(filas) {
  const porDia = {};
  filas.forEach(a => (porDia[a.dia || a.entrada] ||= []).push(a.ret - a.sp));
  const dias = Object.keys(porDia);
  if (dias.length < 3) return null;
  let s = 20261024;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const muestras = [];
  for (let i = 0; i < 4000; i++) {
    let suma = 0, cuenta = 0;
    for (let j = 0; j < dias.length; j++) {
      const v = porDia[dias[Math.floor(rnd() * dias.length)]];
      for (let k = 0; k < v.length; k++) { suma += v[k]; cuenta++ }
    }
    muestras.push(suma / cuenta);
  }
  muestras.sort((a, b) => a - b);
  return { lo: muestras[Math.floor(4000 * 0.025)], hi: muestras[Math.floor(4000 * 0.975)], dias: dias.length };
}

/* Un plegable, ABIERTO de entrada. La pestana tenia siete bloques para contestar una sola pregunta
   y se hacia lioso, asi que lo que responde quedo arriba —si te puedes fiar, que habria pasado
   operando el panel y el registro en bruto— y las otras maneras de medir lo mismo bajaron aqui.
   Lo que resolvio el lio fue el ORDEN, no esconderlas: Borja pidio verlas desplegadas y tiene
   sentido, porque llegar a ellas costaba un clic que no siempre se da. Sigue siendo una seccion
   aparte y se puede cerrar; simplemente no arranca cerrada. */
function plegable(titulo, nodos, abierto) {
  const hijos = nodos.filter(Boolean);
  if (!hijos.length) return null;
  const d = document.createElement('details');
  d.className = 'plegable';
  d.open = abierto !== false;
  const s = document.createElement('summary');
  s.textContent = titulo;
  d.appendChild(s);
  hijos.forEach(x => d.appendChild(x));
  return d;
}

window.initResultados = function () {
  const r = $('resorden'), v = $('resver');
  if (r) r.onchange = () => window.resultados();
  if (v) v.onchange = () => window.resultados();
};

window.resultados = async function () {
  const R = $('rres'); R.replaceChildren();
  await cargaPrecios();
  const xs = entradas();
  if (!xs.length) {
    R.appendChild(el('div', 'empty', 'Todavía no hay historial. Cada acción que entra en el top queda anotada con su puntuación y su precio, y aquí se compara con lo que hizo después. Vuelve dentro de unas semanas.'));
    return;
  }
  const medibles = xs.filter(a => a.ret != null), perdidas = xs.filter(a => a.ret == null);
  const maduras = medibles.filter(a => a.sesiones >= MADUREZ);
  R.appendChild(estado(xs, maduras));
  if (perdidas.length) R.appendChild(el('div', 'm', perdidas.map(a => a.ticker).join(', ') +
    (perdidas.length === 1 ? ' ha dejado' : ' han dejado') + ' de cotizar o ha cambiado de símbolo: ' +
    'se queda' + (perdidas.length === 1 ? '' : 'n') + ' en el registro con su último precio conocido, pero sin precio de hoy ' +
    'no se puede' + (perdidas.length === 1 ? '' : 'n') + ' incluir en las medias. Compruébalo en tu bróker.'));

  /* Las respuestas solo aparecen cuando se sostienen. Antes salian en gris diciendo "no se puede
     saber" y justo debajo una tabla con numeros al decimal: se contradecian solas. */
  if (maduras.length >= MINIMO) {
    /* La pregunta dice "SIGUIENDO EL PANEL", asi que se responde con el protocolo del panel: con los
       stops puestos. Antes se respondia con a.ret, que es aguantar sin vender nunca, o sea
       justo lo que el sistema NO hace. Con el registro del 30/10/2026 eran +2,3 % contra +1,5 %: la
       respuesta se daba medio punto mejor de lo que el panel consigue de verdad. Y el indice se
       comparaba siempre hasta hoy, aunque la posicion hubiese cerrado dos semanas antes.
       Encontrado el 30/10/2026 con las preguntas todavia ocultas (13 de 30 maduras), asi que nunca
       llego a enseñar un numero equivocado: se activaban hacia el 19 de noviembre. */
    const g = ganaDinero(maduras);
    const sim = g.sim, ret = g.ret;
    R.appendChild(pregunta('¿Habrías ganado dinero siguiendo el panel?',
      (ret >= 0 ? 'Sí, ' : 'No, ') + pc(ret) + ' de media por acción',
      'De las ' + sim.length + ' entradas con recorrido, ' + g.pos + ' van en positivo (' + Math.round(g.pos / sim.length * 100) + ' %). ' +
      'Con los stops del sistema puestos: ' + g.cerradas + ' ya cerraron y ' + (sim.length - g.cerradas) + ' siguen abiertas. ' +
      'Aguantando sin vender nunca saldría ' + pc(g.aguantando) + ', que no es lo que hace el panel.', ret >= 0));

    const cs = g.contraIndice;
    const vsSp = cs.length ? media(cs.map(a => a.ret - a.sp)) : null;
    /* Con el intervalo delante: una diferencia cuyo margen cruza el cero no responde "si", responde
       "no se sabe". Antes decia "Si, +1,7 puntos" aunque el margen fuese de -1,8 a +6,8. */
    if (vsSp != null) {
      const ic = intervalo(cs), cruza = ic && ic.lo < 0 && ic.hi > 0;
      R.appendChild(pregunta('¿Mejor que comprar el índice?',
        cruza ? 'Todavía no se puede decir' : (vsSp >= 0 ? 'Sí, ' : 'No, ') + (vsSp >= 0 ? '+' : '') + n(vsSp, 1) + ' puntos frente al S&P 500',
        (vsSp >= 0 ? '+' : '') + n(vsSp, 1) + ' puntos de media frente al S&P 500 en el tramo exacto de cada posición (de su entrada a su salida, no hasta hoy)' +
        (ic ? ', con un margen de error de ' + (ic.lo >= 0 ? '+' : '') + n(ic.lo, 1) + ' a ' + (ic.hi >= 0 ? '+' : '') + n(ic.hi, 1) +
          ' pt (remuestreando por día de entrada, ' + ic.dias + ' días)' : '') + '.' +
        (cruza ? ' El margen incluye el cero: con este historial la ventaja no se distingue de la casualidad.' : ''),
        !cruza && vsSp >= 0));
    }

    /* Esta SI se mide aguantando sin vender, y a proposito: la pregunta es si la nota sabe elegir, y
       mezclarla con las reglas de salida mide las dos cosas a la vez. Se dice en el texto. */
    const dis = discrimina(maduras);
    if (dis) R.appendChild(pregunta('¿Sirve de algo la puntuación?',
      (dis.dif >= 0 ? 'Sí, las mejor puntuadas rinden ' : 'No, las mejor puntuadas rinden ') + (dis.dif >= 0 ? '+' : '') + n(dis.dif, 1) + ' puntos más',
      'Partiendo por la mediana (' + n(dis.corte, 0) + '): de ' + n(dis.corte, 0) + ' para arriba, ' + pc(media(dis.altas.map(a => a.ret))) + ' en ' + dis.altas.length +
      ' casos; por debajo, ' + pc(media(dis.bajas.map(a => a.ret))) + ' en ' + dis.bajas.length + '. ' +
      'Medido aguantando sin vender, a propósito: la pregunta es si la nota sabe elegir, y aplicarle los stops mediría las dos cosas mezcladas.', dis.dif >= 0));

  }

  /* ARRIBA, lo que contesta la pregunta: que habria pasado operando el panel de verdad.
     El resto son otras formas de medir lo mismo y van plegadas: ver el comentario de plegable(). */
  const operando = bloqueOperando();
  if (operando) R.appendChild(operando);
  /* El registro necesita saber cuales tiene la cartera para no esconderlas. */

  R.appendChild(registro(xs, (operando && operando._cartera) || []));

  const otras = plegable('Otras formas de medirlo', [
    bloqueCartera(),
    porGrupo(medibles),
    medibles.length ? tablaSimulacion(medibles, maduras.length >= MINIMO) : null,
    comparaIndice(medibles),
  ]);
  if (otras) R.appendChild(otras);
  R.appendChild(el('p', 'nota', 'Cada acción se anota el primer día que entra en el top, al precio de cierre de ese día, y se compara con el precio de hoy. ' +
    'Ojo: ese cierre es de la noche en que el panel la detecta, así que no es un precio al que tú pudieras comprar; tú la ves a la mañana siguiente. ' +
    'En las entradas guardadas hasta ahora el hueco de una noche a otra ha sido de −0,6 % de media, pero va de +6 % a −12 % según el caso, así que una fila concreta puede estar desviada varios puntos. ' +
    'Sin comisiones. Una sesión es un día de los que este panel tiene guardados.'));
};
