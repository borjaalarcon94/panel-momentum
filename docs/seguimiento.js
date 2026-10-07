/* Pestana "Seguimiento": de las que han pasado por el top 10, si la compra sigue siendo viable y como va.
   Usa el resumen ligero de cada dia (historico) y los datos de HOY de cada accion (actual). */
const CAIDA_SCORE = 8;   // caída de puntuación que marca 'pierde fuerza' (solo informativo)            // puntos de caida que consideramos "pierde fuerza"
let VER_TODAS = false;            // por defecto se muestran las 5 mejores

function estadoHoy(sim) {
  const a = ACT[sim];
  if (!a) return null;
  const req = window.REQUISITOS(a), fallos = req.filter(x => !x.ok && !x.entrada);
  const p = window.PUNTUA ? window.PUNTUA(a, { fecha: FH[0], spy: { tres: MHOY.tres, seis: MHOY.seis }, sector: REFHOY[a.sector] || null }) : null;
  return { a, req, fallos, score: p ? p.total : null, pt: p };
}

/* Mini gráfico con la puntuación de cada día que la acción estuvo en el top. */
function spark(serie) {
  if (serie.length < 2) return null;
  const an = 86, al = 22, min = Math.min(...serie, 40), max = Math.max(...serie, 90), r = max - min || 1;
  const pts = serie.map((v, i) => (i * an / (serie.length - 1)).toFixed(1) + ',' + (al - (v - min) / r * al).toFixed(1)).join(' ');
  const sube = serie[serie.length - 1] >= serie[0];
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', an); svg.setAttribute('height', al); svg.setAttribute('class', 'spark');
  svg.innerHTML = '<polyline fill="none" stroke="' + (sube ? 'var(--up)' : 'var(--down)') + '" stroke-width="1.6" points="' + pts + '"/>';
  svg.setAttribute('aria-label', 'Evolución de la puntuación: ' + serie.map(x => Math.round(x)).join(', '));
  return svg;
}

function historial(lim) {
  const P = T.precios || {}, fechas = FH.slice(0, lim), hoyF = FH[0];
  const spyHoy = (HIST[hoyF] || {}).spy;
  const puesto = f => { const m = {}; ((HIST[f] || {}).acciones || []).forEach((x, i) => { m[x.s || x.t] = i + 1 }); return m };
  const hoyPuesto = puesto(hoyF), ayerPuesto = puesto(FH[1]);
  const reg = {};
  [...fechas].reverse().forEach(f => ((HIST[f] || {}).acciones || []).forEach((a, i) => {
    const k = a.s || a.t;
    if (!reg[k]) reg[k] = { ticker: a.t, empresa: a.n, entrada: sesionDe(f), precioEntrada: a.p, scoreEntrada: a.sc, spyEntrada: (HIST[f] || {}).spy, dias: 0, maxCierre: a.p || 0, mejorPuesto: 99, ultimo: f, puestoHoy: null, serie: [] };
    const r = reg[k];
    if (esSesion(f)) r.dias++; r.ultimo = f; r.maxCierre = Math.max(r.maxCierre, a.p || 0); r.mejorPuesto = Math.min(r.mejorPuesto, i + 1);
    if (a.sc != null) r.serie.push(a.sc);   // puntuacion de cada dia que estuvo en el top
  }));
  return Object.entries(reg).map(([k, r]) => {
    const h = estadoHoy(k), ahora = (h ? h.a.precio : P[k]) ?? null;
    const dScore = h && h.score != null && r.scoreEntrada != null ? h.score - r.scoreEntrada : null;
    const dmax = h && h.a.precio && h.a.max52 ? (h.a.precio / h.a.max52 - 1) * 100 : null;
    const puestoHoy = hoyPuesto[k] || null, puestoAyer = ayerPuesto[k] || null, enTop = !!puestoHoy;
      const estado = !h ? 'sindatos' : h.fallos.length ? 'nocumple'
      : h.pt && h.pt.extendida ? 'extendida'
      : dScore != null && dScore < -CAIDA_SCORE ? 'flojea' : 'viable';
    const maxGan = r.maxCierre && r.precioEntrada ? (r.maxCierre / r.precioEntrada - 1) * 100 : null;
    const gan = ahora != null && r.precioEntrada ? (ahora / r.precioEntrada - 1) * 100 : null;
    const devuelto = maxGan != null && gan != null && maxGan > 0 ? (1 - gan / maxGan) * 100 : null;
    const salida = h ? window.SALIDA(h.a, { devuelto, maxGanancia: maxGan, ganancia: gan }) : null;
    /* El veredicto se calcula aqui, una sola vez, y es el que manda tanto en el orden como en la
       tarjeta. Antes la tarjeta lo calculaba al pintar y el orden miraba solo el estado y la nota:
       una accion con 87 puntos y veredicto ESPERAR salia la primera de "cual compraria antes". */
    const veredicto = h ? window.VEREDICTO(h.a, { extendida: estado === 'extendida', flojea: estado === 'flojea',
      fallos: h.fallos, devuelto, maxGanancia: maxGan, ganancia: gan })
      : window.VEREDICTO({ precio: r.precioUltimo }, { sinSeguimiento: true });
    return { ...r, clave: k, ahora, enTop, puestoHoy, puestoAyer, estado, dScore, veredicto,
      prioridad: estado === 'sindatos' ? 3 : ({ qok: 0, qwarn: 1, qbad: 2 }[veredicto.cls] ?? 2),
      score: h ? h.score : null, req: h ? h.req : null,
      fallos: h ? h.fallos : [], motivosExt: h && h.pt ? h.pt.penal.motivos : [], salida, devuelto, dmax,
      ret: ahora != null && r.precioEntrada ? (ahora / r.precioEntrada - 1) * 100 : null,
      max: r.maxCierre && r.precioEntrada ? (r.maxCierre / r.precioEntrada - 1) * 100 : null,
      desdeMax: ahora != null && r.maxCierre ? (ahora / r.maxCierre - 1) * 100 : null,
      sp: r.spyEntrada && spyHoy ? (spyHoy / r.spyEntrada - 1) * 100 : null };
    /* Se quedan las que han perdido el precio (fusion, cambio de simbolo, exclusion de bolsa): salen
       como "sin datos" entre las descartadas. Borrarlas sin mas haria desaparecer del panel una accion
       que quiza tienes comprada. */
  }).filter(a => a.entrada !== hoyF);   // las que entran hoy aun no tienen evolucion
}

const ETIQUETA = {
  viable: ['Sigue viable', 'eok'], extendida: ['Muy extendida', 'ewarn'], flojea: ['Pierde fuerza', 'ewarn'],
  nocumple: ['Ya no cumple', 'ebad'], sindatos: ['Sin datos de hoy', 'eoff'],
};

window.seguimiento = function () {
  const lim = +$('per').value, orden = $('segorden').value || 'score', filtro = $('segest').value;
  const todo = historial(lim);
  const viva = a => a.estado === 'viable' || a.estado === 'extendida' || a.estado === 'flojea';
  const descartadas = todo.filter(a => !viva(a));
  let r = filtro === 'todas' ? todo : filtro === 'top' ? todo.filter(a => a.enTop) : filtro === 'fuera' ? descartadas : todo.filter(viva);
  /* Por defecto manda el momentum: esta pestaña sirve para seguir como evolucionan las que vigilas,
     y la nota es estable mientras que el veredicto salta con cualquier movimiento del dia (PAYS paso
     de la 1 a la 4 con un +2,9 %). El orden de compra vive en la pestaña Hoy, que para eso esta.
     "Las mas recomendables ahora" sigue disponible en el desplegable, con el criterio de Hoy. */
  const clave = {
    reco: a => -(a.prioridad * 1000 + (a.salida && a.salida.senales.length ? 300 : 0) - (a.score ?? 0)),
    score: a => a.score ?? -1e9, ret: a => a.ret, entrada: a => -FH.indexOf(a.entrada), max: a => a.max };
  r.sort((x, y) => (clave[orden](y) ?? -1e18) - (clave[orden](x) ?? -1e18));
  /* Se muestran 5, pero nunca se ocultan las que tienes compradas ni las que han dado señal de salida:
     justo esas son las que hay que mirar todos los días. */
  const imprescindible = a => (window.tengoPosicion && window.tengoPosicion(a.ticker)) || (a.salida && a.salida.senales.length);
  const completa = r;
  if (!VER_TODAS) r = r.filter((a, i) => i < 5 || imprescindible(a));
  const ocultas = completa.length - r.length;
  const R = $('rseg'); R.replaceChildren();
  if (!r.length) {
    R.appendChild(el('div', 'empty', todo.length
      ? 'Ninguna de las seguidas sigue cumpliendo los requisitos. Mira el top del día para buscar nuevas oportunidades.'
      : 'Aún no hay historial. Las acciones aparecen aquí al día siguiente de entrar en el top 10.'));
    return;
  }

  // Las dos primeras hablan de la lista viva; las dos ultimas miden como ha ido la estrategia con todas.
  const med = todo.reduce((s, a) => s + a.ret, 0) / todo.length, pos = todo.filter(a => a.ret > 0).length;
  const st = el('div', 'stats');
  st.append(stat('siguen siendo oportunidad', todo.filter(viva).length), stat('descartadas', descartadas.length),
    stat('en positivo', Math.round(pos / todo.length * 100) + ' %'), stat('media de todas', pc(med)));
  R.appendChild(st);

  const cs = todo.filter(a => a.sp != null), spMed = cs.length ? cs.reduce((s, a) => s + a.sp, 0) / cs.length : null, gana = cs.filter(a => a.ret > a.sp).length;
  if (spMed != null) { const d = med - spMed, B = el('div', 'banner ' + (d >= 0 ? 'okb' : 'warnb'));
    B.appendChild(el('div', 'bt', (d >= 0 ? 'El top va mejor que el mercado: ' : 'El top va peor que el mercado: ') + 'de media ' + pc(med) + ' frente a ' + pc(spMed) + ' del S&P 500 en los mismos días (' + (d >= 0 ? '+' : '') + n(d, 1) + ' puntos). ' + gana + ' de ' + cs.length + ' lo hacen mejor que el índice.'));
    R.appendChild(B) }

  r.forEach((a, i) => {
    const c = el('div', 'card seg'), top = el('div', 'top'), izq = el('div');
    izq.appendChild(el('span', 'pos', '#' + (i + 1)));
    const l = el('a', 'tk', a.ticker); l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(a.clave); l.target = '_blank'; l.rel = 'noopener';
    izq.appendChild(l);
    if (a.enTop) izq.appendChild(el('span', 'new', 'EN EL TOP HOY'));
    else if (a.ultimo !== FH[0]) izq.appendChild(el('span', 'm', 'fuera del top desde ' + fFecha(a.ultimo)));
    izq.appendChild(el('div', 'name', (a.empresa || '') + ' · entró ' + fFecha(a.entrada) + ' · ' + a.dias + (a.dias === 1 ? ' día' : ' días') + ' en el top'));
    const der = el('div', 'px');
    der.appendChild(el('b', a.ret >= 0 ? 'up' : 'down', pc(a.ret)));
    der.appendChild(el('div', 'm', n(a.precioEntrada) + ' $ → ' + n(a.ahora) + ' $'));
    if (a.score != null) {
      const sc = el('div', 'score' + (a.score >= 75 ? ' s3' : a.score >= 55 ? ' s2' : ' s1'));
      sc.appendChild(el('b', null, n(a.score, 0)));
      sc.appendChild(el('span', null, '/100 momentum' + (a.dScore != null ? ' · ' + (a.dScore >= 0 ? '+' : '') + n(a.dScore, 0) : '')));
      der.appendChild(sc);
    }
    top.append(izq, der); c.appendChild(top);

    const [txt, cls] = ETIQUETA[a.estado], fila = el('div', 'segfila');
    fila.appendChild(el('span', 'est ' + cls, txt));
    if (a.estado === 'nocumple') fila.appendChild(el('span', 'm', 'ya no cumple: ' + a.fallos.map(f => f.t.toLowerCase() + ' (' + f.v + ')').join(', ')));
    else if (a.estado === 'extendida') fila.appendChild(el('span', 'm', 'cumple los 9 requisitos, pero comprar aquí es caro: ' + a.motivosExt.join(' · ') + '. Esperar a que consolide.'));
    else if (a.estado === 'flojea') fila.appendChild(el('span', 'm', 'cumple los requisitos, pero su puntuación ha caído ' + n(Math.abs(a.dScore), 0) + ' puntos desde que entró'));
    else if (a.estado === 'viable') fila.appendChild(el('span', 'm', 'cumple los 9 requisitos' + (a.dScore != null ? ' · puntuación ' + (a.dScore >= 0 ? '+' : '') + n(a.dScore, 0) + ' desde su entrada' : '')));
    c.appendChild(fila);

    // Linea accionable: el mismo veredicto que ha decidido el orden, no uno recalculado aparte.
    const q = a.veredicto;
    const clase = q.cls === 'qok' ? 'v-compra' : q.cls === 'qbad' ? 'v-vender' : 'v-espera';
    const qd = el('div', 'veredicto ' + clase);
    qd.appendChild(el('span', 'vt', q.t.toUpperCase()));
    if (q.d) qd.appendChild(el('span', 'vd', q.d));
    c.appendChild(qd);
    if (a.salida && a.salida.senales.length) {
      const v = el('div', 'venta');
      v.appendChild(el('div', 'blt', 'Señales de salida'));
      const u = el('ul', 'bll');
      a.salida.senales.forEach(t => u.appendChild(el('li', 'risk', t)));
      v.appendChild(u);
      c.appendChild(v);
    }
    const g = el('div', 'grid');
    [['Puntuación hoy', a.score == null ? '-' : n(a.score, 0) + (a.scoreEntrada != null ? ' (entró ' + n(a.scoreEntrada, 0) + ')' : '')],
     ['Puntuación día a día', ''],
     ['Requisitos', a.req ? a.req.filter(x => x.ok).length + '/9' : '-'],
     ['Máx. alcanzado', pc(a.max)], ['Frente a su mejor cierre', pc(a.desdeMax)],
     ['vs S&P 500', a.sp == null ? '-' : (a.ret - a.sp >= 0 ? '+' : '') + n(a.ret - a.sp, 1) + ' pt'],
     ['Stop del sistema', a.salida && a.salida.opciones[0] ? n(a.salida.opciones[0].v) + ' $ (' + pc(a.salida.opciones[0].d, 0) + ')' : '-'],
     ['Devuelto del máximo', a.devuelto == null || a.devuelto <= 0 ? '—' : a.ret <= 0 ? 'todo · por debajo de su entrada' : n(a.devuelto, 0) + ' %']]
      .forEach(([k, v]) => {
        const m = el('div', 'm', k);
        if (k === 'Puntuación día a día') { const sp = spark((a.serie || []).concat(a.score != null ? [a.score] : [])); m.appendChild(sp || el('span', null, '—')) }
        else m.appendChild(el('span', null, v));
        g.appendChild(m);
      });
    c.appendChild(g);

    if (a.req) {
      const b = el('button', 'chip', 'Ver requisitos y señales'); b.style.marginTop = '10px';
      let abierto = null;
      b.onclick = () => {
        if (abierto) { abierto.remove(); abierto = null; b.textContent = 'Ver requisitos y señales'; return }
        abierto = el('div', 'blk');
        const u = el('ul', 'bll');
        a.req.forEach(x => u.appendChild(el('li', x.ok ? 'good2' : 'risk', (x.ok ? '✓ ' : '✗ ') + x.t + ': ' + x.v)));
        abierto.appendChild(el('div', 'blt', 'Requisitos obligatorios hoy')); abierto.appendChild(u);
        if (a.salida && a.salida.opciones.length) {
          const s2 = el('ul', 'bll');
          a.salida.opciones.forEach(o => s2.appendChild(el('li', null, o.t + ': ' + n(o.v) + ' $ (' + pc(o.d, 0) + ') — ' + o.nota)));
          abierto.appendChild(el('div', 'blt', 'Dónde poner el stop')); abierto.appendChild(s2);
        }
        if (a.pt || true) { const p = estadoHoy(a.clave);
          if (p && p.pt) { const r2 = el('ul', 'bll'); p.pt.riesgos.slice(0, 4).forEach(t => r2.appendChild(el('li', 'risk', t)));
            if (p.pt.riesgos.length) { abierto.appendChild(el('div', 'blt', 'Riesgos ahora')); abierto.appendChild(r2) } } }
        c.appendChild(abierto); b.textContent = 'Ocultar';
      };
      c.appendChild(b);
    }
    R.appendChild(c);
  });
  if (ocultas > 0) {
    const peor = Math.min(...r.map(a => a.score ?? 0));
    const altas = completa.slice(r.length).filter(a => (a.score ?? 0) > peor);
    if (altas.length) { const t = el('div', 'm');
      t.appendChild(el('b', null, altas.slice(0, 3).map(a => a.ticker + ' (' + n(a.score, 0) + ')').join(', ') + (altas.length > 3 ? ' y ' + (altas.length - 3) + ' más' : '')));
      const u = altas.length === 1;
      t.appendChild(el('span', null, (u ? ' puntúa' : ' puntúan') + ' más alto, pero hoy no ' + (u ? 'es' : 'son') + ' entrada. ' + (u ? 'Sigue' : 'Siguen') + ' aquí, más abajo.'));
      R.appendChild(t) }
  }
  if (ocultas > 0 || VER_TODAS) {
    const b = el('button', 'chip', VER_TODAS ? 'Ver solo las 5 mejores' : 'Ver las ' + completa.length + ' que siguen vivas');
    b.style.margin = '6px 0';
    b.onclick = () => { VER_TODAS = !VER_TODAS; window.seguimiento() };
    R.appendChild(b);
  }
  
};
window.initSeguimiento = function () {
  $('per').onchange = () => window.seguimiento();
  $('segorden').onchange = () => window.seguimiento();
  $('segest').onchange = () => window.seguimiento();
};
