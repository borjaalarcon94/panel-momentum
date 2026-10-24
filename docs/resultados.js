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
    let maxVisto = x.precio, salida = null, motivo = null, stopPrevio = 0, vistos = 0;
    for (const f of FH.filter(f => f > x.entrada && esSesion(f)).sort()) {
      const p = cierre(f, x.clave);
      if (p == null) continue;                  // no tenemos su cierre ese dia
      const fila = { p };
      vistos++;
      maxVisto = Math.max(maxVisto, fila.p);
      const gan = (fila.p / x.precio - 1) * 100, ganMax = (maxVisto / x.precio - 1) * 100;
      // Mismas reglas que las posiciones reales (docs/reglas.js). Sin EMA 50 historica, el stop usa
      // el suelo de perdida maxima y la subida al coste; se indica en la nota de la tabla.
      stopPrevio = Math.max(stopPrevio, window.REGLAS.stopDe({ precio: fila.p }, x.precio, stopPrevio) || 0);
      if (fila.p < stopPrevio) { salida = fila.p; motivo = 'stop'; break }
      const limite = window.REGLAS.limiteDevolucion(ganMax);
      const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
      if (limite != null && devuelto >= limite) { salida = fila.p; motivo = 'devolución'; break }
    }
    /* Sesiones con cierre frente a sesiones transcurridas: si faltan muchas, la simulacion no ha
       podido aplicar las reglas y hay que decirlo en vez de dar la media por buena. */
    return { ...x, conReglas: salida != null ? (salida / x.precio - 1) * 100 : x.ret, motivo,
      vistos, cobertura: x.sesiones ? vistos / x.sesiones : 1,
      alSalirDelTop: x.retAlSalir != null ? x.retAlSalir : x.ret };
  });
}

function tablaSimulacion(maduras) {
  const r = simula(maduras);
  const filas = [
    ['Comprar y aguantar hasta hoy', r.map(x => x.ret), 'sin vender nunca'],
    ['Vender el día que sale del top', r.map(x => x.alSalirDelTop), 'disciplina máxima'],
    ['Con nuestras reglas de salida', r.map(x => x.conReglas), 'el stop y la devolución máxima de la pestaña Parámetros'],
  ];
  const d = el('div', 'blk');
  d.appendChild(el('div', 'blt', 'Las mismas entradas, tres formas de operarlas'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Forma de operar', 'Media', 'Mediana', 'En positivo', 'Peor caso'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  filas.forEach(([nom, v, ayuda]) => {
    const tr = el('tr'), ord = [...v].sort((a, b) => a - b);
    const td = el('td'); td.appendChild(el('b', null, nom)); td.appendChild(el('div', 'name', ayuda)); tr.appendChild(td);
    tr.appendChild(el('td', media(v) >= 0 ? 'up' : 'down', pc(media(v))));
    tr.appendChild(el('td', null, pc(ord[Math.floor(ord.length / 2)])));
    tr.appendChild(el('td', null, Math.round(100 * v.filter(x => x > 0).length / v.length) + ' %'));
    tr.appendChild(el('td', 'down', pc(ord[0])));
    t.appendChild(tr);
  });
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  const cob = media(r.map(x => x.cobertura)) * 100;
  if (cob < 90) d.appendChild(el('div', 'm', 'Aviso: solo tenemos el cierre del ' + n(cob, 0) +
    ' % de las sesiones de estas entradas, así que las reglas de salida no se han podido aplicar en el resto. ' +
    'La serie diaria se guarda desde el 7 de octubre de 2026; las entradas anteriores van incompletas.'));
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
    d.appendChild(c);
  }
  return d;
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

    R.appendChild(tablaSimulacion(maduras));
  }

  R.appendChild(registro(xs));
  R.appendChild(el('p', 'nota', 'Cada acción se anota el primer día que entra en el top, al precio de cierre de ese día, y se compara con el precio de hoy. ' +
    'Ojo: ese cierre es de la noche en que el panel la detecta, así que no es un precio al que tú pudieras comprar; tú la ves a la mañana siguiente. ' +
    'En las entradas guardadas hasta ahora el hueco de una noche a otra ha sido de −0,6 % de media, pero va de +6 % a −12 % según el caso, así que una fila concreta puede estar desviada varios puntos. ' +
    'Sin comisiones. Una sesión es un día de los que este panel tiene guardados.'));
};
