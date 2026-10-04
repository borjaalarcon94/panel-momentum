/* Pestana "Seguimiento": de las que han pasado por el top 10, si la compra sigue siendo viable y como va.
   Usa el resumen ligero de cada dia (historico) y los datos de HOY de cada accion (actual). */
const CAIDA_SCORE = 8;            // puntos de caida que consideramos "pierde fuerza"
const ACT = T.actual || {};       // datos de hoy de las acciones seguidas
const MHOY = (T.mercadoHoy || []).find(x => x.ticker === 'SPY') || {};
const REFHOY = (T.referenciaHoy || {}).sectores || {};

function estadoHoy(sim) {
  const a = ACT[sim];
  if (!a) return null;
  const req = window.REQUISITOS(a), fallos = req.filter(x => !x.ok);
  const p = window.PUNTUA ? window.PUNTUA(a, { fecha: FH[0], spy: { tres: MHOY.tres, seis: MHOY.seis }, sector: REFHOY[a.sector] || null }) : null;
  return { a, req, fallos, score: p ? p.total : null, pt: p };
}

function historial(lim) {
  const P = T.precios || {}, fechas = FH.slice(0, lim), hoyF = FH[0];
  const spyHoy = (HIST[hoyF] || {}).spy, enTopHoy = new Set(((HIST[hoyF] || {}).acciones || []).map(x => x.s || x.t));
  const reg = {};
  [...fechas].reverse().forEach(f => ((HIST[f] || {}).acciones || []).forEach((a, i) => {
    const k = a.s || a.t;
    if (!reg[k]) reg[k] = { ticker: a.t, empresa: a.n, entrada: f, precioEntrada: a.p, scoreEntrada: a.sc, spyEntrada: (HIST[f] || {}).spy, dias: 0, maxCierre: a.p || 0, mejorPuesto: 99, ultimo: f, puestoHoy: null };
    const r = reg[k];
    r.dias++; r.ultimo = f; r.maxCierre = Math.max(r.maxCierre, a.p || 0); r.mejorPuesto = Math.min(r.mejorPuesto, i + 1);
    if (f === hoyF) r.puestoHoy = i + 1;
  }));
  return Object.entries(reg).map(([k, r]) => {
    const h = estadoHoy(k), ahora = (h ? h.a.precio : P[k]) ?? null;
    const dScore = h && h.score != null && r.scoreEntrada != null ? h.score - r.scoreEntrada : null;
    const enTop = enTopHoy.has(k);
      const estado = !h ? 'sindatos' : h.fallos.length ? 'nocumple'
      : h.pt && h.pt.extendida ? 'extendida'
      : dScore != null && dScore < -CAIDA_SCORE ? 'flojea' : 'viable';
    return { ...r, clave: k, ahora, enTop, estado, dScore, score: h ? h.score : null, req: h ? h.req : null,
      fallos: h ? h.fallos : [], motivosExt: h && h.pt ? h.pt.penal.motivos : [],
      ret: ahora != null && r.precioEntrada ? (ahora / r.precioEntrada - 1) * 100 : null,
      max: r.maxCierre && r.precioEntrada ? (r.maxCierre / r.precioEntrada - 1) * 100 : null,
      desdeMax: ahora != null && r.maxCierre ? (ahora / r.maxCierre - 1) * 100 : null,
      sp: r.spyEntrada && spyHoy ? (spyHoy / r.spyEntrada - 1) * 100 : null };
  }).filter(a => a.ret != null && a.entrada !== hoyF);   // las que entran hoy aun no tienen evolucion
}

const ETIQUETA = {
  viable: ['Sigue viable', 'eok'], extendida: ['Muy extendida', 'ewarn'], flojea: ['Pierde fuerza', 'ewarn'],
  nocumple: ['Ya no cumple', 'ebad'], sindatos: ['Sin datos de hoy', 'eoff'],
};

window.seguimiento = function () {
  const lim = +$('per').value, orden = $('segorden').value, filtro = $('segest').value;
  let r = historial(lim).filter(a => filtro === 'viables' ? a.estado === 'viable' : filtro === 'top' ? a.enTop : filtro === 'fuera' ? a.estado === 'nocumple' : true);
  const clave = { ret: a => a.ret, score: a => a.score ?? -1e9, entrada: a => -FH.indexOf(a.entrada), max: a => a.max };
  r.sort((x, y) => (clave[orden](y) ?? -1e18) - (clave[orden](x) ?? -1e18));
  const R = $('rseg'); R.replaceChildren();
  if (!r.length) { R.appendChild(el('div', 'empty', 'Aún no hay historial. Las acciones aparecen aquí al día siguiente de entrar en el top 10.')); return }

  const viables = r.filter(a => a.estado === 'viable').length, med = r.reduce((s, a) => s + a.ret, 0) / r.length;
  const pos = r.filter(a => a.ret > 0).length;
  const st = el('div', 'stats');
  st.append(stat('en seguimiento', r.length), stat('siguen viables', viables), stat('en positivo', Math.round(pos / r.length * 100) + ' %'), stat('media', pc(med)));
  R.appendChild(st);

  const cs = r.filter(a => a.sp != null), spMed = cs.length ? cs.reduce((s, a) => s + a.sp, 0) / cs.length : null, gana = cs.filter(a => a.ret > a.sp).length;
  if (spMed != null) { const d = med - spMed, B = el('div', 'banner ' + (d >= 0 ? 'okb' : 'warnb'));
    B.appendChild(el('div', 'bt', (d >= 0 ? 'El top va mejor que el mercado: ' : 'El top va peor que el mercado: ') + 'de media ' + pc(med) + ' frente a ' + pc(spMed) + ' del S&P 500 en los mismos días (' + (d >= 0 ? '+' : '') + n(d, 1) + ' puntos). ' + gana + ' de ' + cs.length + ' lo hacen mejor que el índice.'));
    R.appendChild(B) }

  r.forEach(a => {
    const c = el('div', 'card seg'), top = el('div', 'top'), izq = el('div');
    const l = el('a', 'tk', a.ticker); l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(a.clave); l.target = '_blank'; l.rel = 'noopener';
    izq.appendChild(l);
    if (a.enTop) izq.appendChild(el('span', 'new', 'HOY #' + a.puestoHoy));
    izq.appendChild(el('div', 'name', (a.empresa || '') + ' · entró ' + fFecha(a.entrada) + ' · ' + a.dias + (a.dias === 1 ? ' día' : ' días') + ' en el top · mejor puesto #' + a.mejorPuesto));
    const der = el('div', 'px');
    der.appendChild(el('b', a.ret >= 0 ? 'up' : 'down', pc(a.ret)));
    der.appendChild(el('div', 'm', n(a.precioEntrada) + ' $ → ' + n(a.ahora) + ' $'));
    top.append(izq, der); c.appendChild(top);

    const [txt, cls] = ETIQUETA[a.estado], fila = el('div', 'segfila');
    fila.appendChild(el('span', 'est ' + cls, txt));
    if (a.estado === 'nocumple') fila.appendChild(el('span', 'm', 'ya no cumple: ' + a.fallos.map(f => f.t.toLowerCase() + ' (' + f.v + ')').join(', ')));
    else if (a.estado === 'extendida') fila.appendChild(el('span', 'm', 'cumple los 8 requisitos, pero comprar aquí es caro: ' + a.motivosExt.join(' · ') + '. Esperar a que consolide.'));
    else if (a.estado === 'flojea') fila.appendChild(el('span', 'm', 'cumple los requisitos, pero su puntuación ha caído ' + n(Math.abs(a.dScore), 0) + ' puntos desde que entró'));
    else if (a.estado === 'viable') fila.appendChild(el('span', 'm', 'cumple los 8 requisitos' + (a.dScore != null ? ' · puntuación ' + (a.dScore >= 0 ? '+' : '') + n(a.dScore, 0) + ' desde su entrada' : '')));
    c.appendChild(fila);

    const g = el('div', 'grid');
    [['Puntuación hoy', a.score == null ? '-' : n(a.score, 0) + (a.scoreEntrada != null ? ' (entró ' + n(a.scoreEntrada, 0) + ')' : '')],
     ['Requisitos', a.req ? a.req.filter(x => x.ok).length + '/8' : '-'],
     ['Máx. alcanzado', pc(a.max)], ['Frente a su mejor cierre', pc(a.desdeMax)],
     ['vs S&P 500', a.sp == null ? '-' : (a.ret - a.sp >= 0 ? '+' : '') + n(a.ret - a.sp, 1) + ' pt']]
      .forEach(([k, v]) => { const m = el('div', 'm', k); m.appendChild(el('span', null, v)); g.appendChild(m) });
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
        if (a.pt || true) { const p = estadoHoy(a.clave);
          if (p && p.pt) { const r2 = el('ul', 'bll'); p.pt.riesgos.slice(0, 4).forEach(t => r2.appendChild(el('li', 'risk', t)));
            if (p.pt.riesgos.length) { abierto.appendChild(el('div', 'blt', 'Riesgos ahora')); abierto.appendChild(r2) } } }
        c.appendChild(abierto); b.textContent = 'Ocultar';
      };
      c.appendChild(b);
    }
    R.appendChild(c);
  });
  R.appendChild(el('p', 'nota', '«Sigue viable» = hoy cumple los 8 requisitos obligatorios, mantiene su puntuación y no está extendida. «Muy extendida» = los cumple, pero está demasiado lejos de sus medias: puede seguir subiendo, aunque entrar ahí suele salir caro; mejor esperar a que consolide. «Pierde fuerza» = los cumple, pero su puntuación ha caído más de ' + CAIDA_SCORE + ' puntos. «Ya no cumple» = ha roto algún requisito (se indica cuál). Entró = primer día en el top 10, a su precio de cierre. Máx. alcanzado = mayor cierre mientras estaba en el top. Las que entran hoy aparecen mañana.'));
};
$('per').onchange = () => window.seguimiento();
$('segorden').onchange = () => window.seguimiento();
$('segest').onchange = () => window.seguimiento();
