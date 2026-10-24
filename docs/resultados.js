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
    let maxVisto = x.precio, peor = x.precio, peorConReglas = x.precio;
    let salida = null, fSalida = null, motivo = null, stopPrevio = 0, vistos = 0, cerrada = false;
    for (const f of FH.filter(f => f > x.entrada && esSesion(f)).sort()) {
      const p = cierre(f, x.clave);
      if (p == null) continue;                  // no tenemos su cierre ese dia
      vistos++;
      maxVisto = Math.max(maxVisto, p);
      peor = Math.min(peor, p);                 // peor momento aguantando hasta hoy
      if (!cerrada) peorConReglas = Math.min(peorConReglas, p);
      const gan = (p / x.precio - 1) * 100, ganMax = (maxVisto / x.precio - 1) * 100;
      /* Mismas reglas que las posiciones reales (docs/reglas.js) y, sobre todo, las MISMAS QUE
         operandoElPanel(): esta llamada se quedo con dos argumentos de menos y daba otro stop.
         - Faltaba ema50. El comentario decia "sin EMA 50 historica", y era cierto cuando se
           escribio, pero la EMA 50 diaria se guarda en docs/precios.json desde el 07/10/2026.
           Sin ella el stop era solo el suelo del -15 %, mas flojo que el de verdad: FEIM salia
           aqui a -15,7 % y en la cartera a -5,6 %, la misma accion con dos stops distintos.
         - Faltaba ganMax, que es el cuarto argumento. Sin el, stopDe mira la ganancia de HOY y no
           la maxima alcanzada: exactamente el fallo que se corrigio en reglas.js este mes, colado
           otra vez por la puerta de atras en este punto de llamada.
         La leccion: tener las reglas en un solo fichero no basta si quien las llama se deja
         argumentos. La prueba de integridad vigilaba umbrales duplicados, no llamadas incompletas. */
      if (!cerrada) {
        const ema50 = ((window.__EMAS__ || {})[f] || {})[x.clave];
        stopPrevio = Math.max(stopPrevio, window.REGLAS.stopDe({ precio: p, ema50 }, x.precio, stopPrevio, ganMax) || 0);
        if (p < stopPrevio) { salida = p; fSalida = f; motivo = 'stop'; cerrada = true; continue }
        const limite = window.REGLAS.limiteDevolucion(ganMax);
        const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
        if (limite != null && devuelto >= limite) { salida = p; fSalida = f; motivo = 'devolución'; cerrada = true }
      }
    }
    /* Sesiones con cierre frente a sesiones transcurridas: si faltan muchas, la simulacion no ha
       podido aplicar las reglas y hay que decirlo en vez de dar la media por buena. */
    const pct = v => (v / x.precio - 1) * 100;
    return { ...x, conReglas: salida != null ? pct(salida) : x.ret, motivo, fSalida,
      vistos, cobertura: x.sesiones ? vistos / x.sesiones : 1,
      alSalirDelTop: x.retAlSalir != null ? x.retAlSalir : x.ret,
      /* Peor momento (drawdown): cuanto llego a estar en rojo antes de donde acabo. Es lo que de
         verdad tienes que aguantar, y no se veia por ningun lado: una entrada que acaba en +3 % pero
         paso por -18 % no es la misma operacion que una que subio recta. */
      peor: pct(peor), peorConReglas: pct(peorConReglas) };
  });
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
  ['Grupo', 'Cuántas', 'Media', 'Frente al S&P 500', 'Peor'].forEach(x => h.appendChild(el('th', null, x)));
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
  return { curva, ret: curva[curva.length - 1].v - 100, caida: caida * 100,
    cerradas, abiertas: abiertas.length, sesiones: curva.length };
}

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
  d.appendChild(el('div', 'blt', 'Si hubieras operado el panel: comprar cuando lo dice, vender con el stop'));
  const st = el('div', 'stats');
  st.append(stat('tu cartera', pc(r.ret), signo(r.ret)),
    stat('el S&P 500 en el mismo tramo', spyRet != null ? pc(spyRet) : '—', signo(spyRet || 0)),
    stat('lo peor que llegaste a estar', pc(r.caida), 'down'),
    stat('ventas cerradas', String(r.cerradas.length), ''));
  d.appendChild(st);
  if (spy.length >= 3) {
    const g = grafica(r.curva, spy);
    d.appendChild(g);
    d.appendChild(leyenda(g, 'tu cartera', r.ret, 'el S&P 500', spyRet != null ? spyRet : 0));
  }
  d.appendChild(el('div', 'm', 'Con ' + HUECOS + ' huecos de cartera a partes iguales, en ' + r.sesiones + ' sesiones. ' +
    'Cada posición lleva su propio stop, el de la pestaña Parámetros, y cuando salta el dinero vuelve a la caja y se reinvierte en lo siguiente que entra al top. ' +
    'Quedan ' + r.abiertas + ' posiciones abiertas al final, contadas a precio de hoy.'));

  /* Sensibilidad al numero de huecos. Se incluyen 1 y 2 porque "comprar lo que mas momentum tiene"
     tambien puede querer decir una sola accion, y es justo donde mas se dispara el resultado: con
     13 sesiones va de -2,7 % (3 huecos) a +4,8 % (2 huecos). Ese abanico es la mejor prueba de que
     la cifra de arriba todavia no mide nada, y esconderlo daria una precision que el dato no tiene. */
  const otras = [1, 2, 3, 8, 10].map(h => ({ h, r: operandoElPanel(h) })).filter(x => x.r);
  if (otras.length) {
    const todos = [...otras.map(x => x.r.ret), r.ret];
    const abanico = Math.max(...todos) - Math.min(...todos);
    const li = el('div', 'margen margen-cero');
    li.appendChild(el('b', null, 'Cambiando solo cuántas posiciones llevas, el resultado se mueve ' +
      n(abanico, 1) + ' puntos'));
    const det = el('div', 'm');
    det.appendChild(el('div', null, otras.concat([{ h: HUECOS, r }])
      .sort((a, b) => a.h - b.h)
      .map(x => x.h + (x.h === 1 ? ' posición ' : ' posiciones ') + pc(x.r.ret) + (x.h === HUECOS ? ' ←' : ''))
      .join(' · ')));
    det.appendChild(el('div', null, 'Con 1 posición compras solo la de más momentum en cada momento; con 10, el top entero. ' +
      'Que la diferencia entre unas y otras sea de ' + n(abanico, 1) + ' puntos, con tan pocas ventas cerradas, ' +
      'significa que esto es casualidad y no una pista de cuántas llevar.'));
    li.appendChild(det);
    d.appendChild(li);
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

  const av = el('div', 'margen margen-cero');
  av.appendChild(el('b', null, r.cerradas.length < 10
    ? 'Solo ' + r.cerradas.length + (r.cerradas.length === 1 ? ' venta cerrada' : ' ventas cerradas') + ': esto todavía no es una rentabilidad media'
    : 'Sin comisiones ni diferencial'));
  av.appendChild(el('div', 'm', 'Una rentabilidad media necesita decenas de operaciones completas, y aquí ' +
    (r.cerradas.length === 1 ? 'hay una' : 'hay ' + r.cerradas.length) + '. ' +
    'El resto son posiciones aún abiertas valoradas a precio de hoy, que puede cambiar mañana. ' +
    'No hay comisiones ni diferencial, y las compras se hacen al cierre del día siguiente, que es cuando tú verías la señal.'));
  d.appendChild(av);
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

function registro(xs) {
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
  orden.slice(0, VER).forEach(a => {
    const tr = el('tr');
    const td = el('td'); td.appendChild(el('b', null, a.ticker));
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
  if (orden.length > VER) d.appendChild(el('div', 'm', 'Se muestran las ' + VER + ' primeras de ' + orden.length + '. Cambia el desplegable de arriba a «Todas» para verlas todas.'));
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
    c.appendChild(el('div', 'blt', 'Comparado con el S&P 500'));
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

    c.appendChild(el('p', 'nota', 'Cada acción se compara con lo que hizo el índice desde el día que ella entró, no desde el principio.'));
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
function plegable(titulo, nodos) {
  const hijos = nodos.filter(Boolean);
  if (!hijos.length) return null;
  const d = document.createElement('details');
  d.className = 'plegable';
  d.open = true;
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
    const ret = media(maduras.map(a => a.ret)), pos = maduras.filter(a => a.ret > 0).length;
    R.appendChild(pregunta('¿Habrías ganado dinero siguiendo el panel?',
      (ret >= 0 ? 'Sí, ' : 'No, ') + pc(ret) + ' de media por acción',
      'De las ' + maduras.length + ' entradas con recorrido, ' + pos + ' van en positivo (' + Math.round(pos / maduras.length * 100) + ' %).', ret >= 0));

    const cs = maduras.filter(a => a.sp != null), vsSp = cs.length ? media(cs.map(a => a.ret - a.sp)) : null;
    /* Con el intervalo delante: una diferencia cuyo margen cruza el cero no responde "si", responde
       "no se sabe". Antes decia "Si, +1,7 puntos" aunque el margen fuese de -1,8 a +6,8. */
    if (vsSp != null) {
      const ic = intervalo(cs), cruza = ic && ic.lo < 0 && ic.hi > 0;
      R.appendChild(pregunta('¿Mejor que comprar el índice?',
        cruza ? 'Todavía no se puede decir' : (vsSp >= 0 ? 'Sí, ' : 'No, ') + (vsSp >= 0 ? '+' : '') + n(vsSp, 1) + ' puntos frente al S&P 500',
        (vsSp >= 0 ? '+' : '') + n(vsSp, 1) + ' puntos de media frente al S&P 500 en esos mismos días' +
        (ic ? ', con un margen de error de ' + (ic.lo >= 0 ? '+' : '') + n(ic.lo, 1) + ' a ' + (ic.hi >= 0 ? '+' : '') + n(ic.hi, 1) +
          ' pt (remuestreando por día de entrada, ' + ic.dias + ' días)' : '') + '.' +
        (cruza ? ' El margen incluye el cero: con este historial la ventaja no se distingue de la casualidad.' : ''),
        !cruza && vsSp >= 0));
    }

    const dis = discrimina(maduras);
    if (dis) R.appendChild(pregunta('¿Sirve de algo la puntuación?',
      (dis.dif >= 0 ? 'Sí, las mejor puntuadas rinden ' : 'No, las mejor puntuadas rinden ') + (dis.dif >= 0 ? '+' : '') + n(dis.dif, 1) + ' puntos más',
      'Partiendo por la mediana (' + n(dis.corte, 0) + '): de ' + n(dis.corte, 0) + ' para arriba, ' + pc(media(dis.altas.map(a => a.ret))) + ' en ' + dis.altas.length +
      ' casos; por debajo, ' + pc(media(dis.bajas.map(a => a.ret))) + ' en ' + dis.bajas.length + '.', dis.dif >= 0));

  }

  /* ARRIBA, lo que contesta la pregunta: que habria pasado operando el panel de verdad.
     El resto son otras formas de medir lo mismo y van plegadas: ver el comentario de plegable(). */
  const operando = bloqueOperando();
  if (operando) R.appendChild(operando);

  R.appendChild(registro(xs));

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
