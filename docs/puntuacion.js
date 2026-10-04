/* Puntuacion 0-100 de "growth despegando". Funcion pura: misma entrada, mismo resultado.
   Bloques: momentum tecnico 25 | aceleracion del crecimiento 25 | calidad fundamental 20 |
            fuerza relativa 15 | volumen y ruptura 15.  Despues: penalizacion por sobreextension
            (hasta -25) y bonus por arranque temprano (hasta +5). Resultado acotado a 0-100.
   Lo que falta no se inventa: el criterio sin dato suma 0 y se avisa como riesgo. */
(function () {
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  const pc1 = v => (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' %';
  const pp = v => (v >= 0 ? '+' : '') + v.toFixed(1).replace('.', ',') + ' pp';
  // tramos: [[umbral, puntos], ...] de mayor a menor; devuelve los puntos del primer umbral alcanzado
  const tramo = (v, t, sinDato = 0) => (v == null ? sinDato : (t.find(x => v >= x[0]) || [0, 0])[1]);

  function puntua(a, ctx) {
    ctx = ctx || {};
    const precio = num(a.precio), partes = [], riesgos = [], razones = [], fundamentales = [], senales = [];
    const d = (t, ok) => ({ t, ok: !!ok });

    // ── Datos derivados ───────────────────────────────────────────────────────
    const gT = num(a.ingresos), gQ = num(a.ingresosq);
    const g = gT == null && gQ == null ? null : Math.max(gT == null ? -1e9 : gT, gQ == null ? -1e9 : gQ);
    const acel = gQ != null && gT != null ? gQ - gT : null;          // aceleracion de ingresos (pp)
    const eT = num(a.bpa), eQ = num(a.bpaq);
    const acelBpa = eQ != null && eT != null ? eQ - eT : null;
    const dmax = precio && num(a.max52) ? (precio / a.max52 - 1) * 100 : null;   // % desde maximo 52s
    const extEma = precio && num(a.ema50) ? (precio / a.ema50 - 1) * 100 : null; // % sobre EMA50
    const extSma = precio && num(a.sma200) ? (precio / a.sma200 - 1) * 100 : null;
    const rsi = num(a.rsi), vr = num(a.volrel), adr = num(a.adr);
    const rupt = precio && num(a.max3m) && precio >= a.max3m * 0.995 ? '3m'
      : precio && num(a.max1m) && precio >= a.max1m * 0.995 ? '1m' : null;
    const caja = num(a.caja), deuda = num(a.deuda);

    // ── 1. Momentum tecnico (25) ──────────────────────────────────────────────
    const t1 = [];
    let p1 = 0;
    const stack = [['Precio sobre EMA 9', precio && num(a.ema9) && precio > a.ema9, 3],
                   ['EMA 9 sobre EMA 21', num(a.ema9) && num(a.ema21) && a.ema9 > a.ema21, 3],
                   ['EMA 21 sobre EMA 50', num(a.ema21) && num(a.ema50) && a.ema21 > a.ema50, 3],
                   ['Precio sobre media 200 d', precio && num(a.sma200) && precio > a.sma200, 3]];
    stack.forEach(([t, ok, pt]) => { if (ok) p1 += pt; t1.push(d(t, ok)); });
    const pRsi = rsi == null ? 0 : rsi >= 60 && rsi <= 72 ? 7 : rsi > 72 && rsi <= 78 ? 4.5 : rsi >= 55 ? 4 : rsi > 78 ? 2 : 0;
    p1 += pRsi;
    t1.push(d('RSI ' + (rsi == null ? 'sin dato' : rsi.toFixed(0)) + (rsi >= 60 && rsi <= 72 ? ' (zona ideal 60-72)' : ''), pRsi >= 4));
    const mes = num(a.mes), tres = num(a.tres);
    if (mes != null && mes > 0) { p1 += 3; }
    if (tres != null && tres > 0) { p1 += 3; }
    t1.push(d('Sube en el mes ' + (mes == null ? '' : pc1(mes)), mes > 0), d('Sube en 3 meses ' + (tres == null ? '' : pc1(tres)), tres > 0));
    partes.push({ id: 'tec', label: 'Momentum técnico', p: p1, max: 25, detalle: t1 });

    // ── 2. Aceleracion del crecimiento (25) ───────────────────────────────────
    const t2 = [];
    const pNivel = tramo(g, [[40, 8], [25, 6], [20, 4]]);
    const pAcel = acel == null ? 0 : acel >= 10 ? 9 : acel >= 3 ? 6 : acel > 0 ? 3 : 0;
    const pBpa = eQ != null && eT != null && eQ > 0 && acelBpa > 0 ? 8 : eQ != null && eQ > 0 ? 5
      : eT != null && eT > 0 ? 3 : eQ == null && eT == null ? 2 : 0;
    t2.push(d('Ingresos ' + (g == null ? 'sin dato' : pc1(g)) + ' interanual', pNivel >= 4));
    t2.push(d(acel == null ? 'Aceleración de ingresos: sin dato trimestral' : 'Crecimiento ' + (acel > 0 ? 'acelerando' : 'desacelerando') + ' ' + pp(acel) + ' (trimestre vs 12 meses)', pAcel >= 3));
    t2.push(d(eQ == null && eT == null ? 'Beneficio por acción: sin dato' : 'BPA ' + (eQ != null ? pc1(eQ) + ' trimestral' : pc1(eT) + ' TTM') + (acelBpa > 0 ? ', acelerando' : ''), pBpa >= 5));
    partes.push({ id: 'ace', label: 'Aceleración del crecimiento', p: pNivel + pAcel + pBpa, max: 25, detalle: t2 });

    // ── 3. Calidad fundamental (20) ───────────────────────────────────────────
    const t3 = [];
    const mb = num(a.mbruto), fcfm = num(a.fcfm), mn = num(a.margen), dp = num(a.deudapat);
    const pMb = tramo(mb, [[70, 6], [50, 4], [35, 2]]);
    const pFcf = tramo(fcfm, [[10, 5], [0, 3], [-10, 1]]);
    const pMn = mn == null ? 0 : mn > 0 ? 4 : mn > -20 ? 2 : 0;
    const pDeuda = caja != null && deuda != null && caja > deuda ? 5 : dp == null ? 0 : dp < 1 ? 3 : dp < 2 ? 1 : 0;
    t3.push(d('Margen bruto ' + (mb == null ? 'sin dato' : mb.toFixed(0) + ' %'), pMb >= 4));
    t3.push(d('Flujo de caja libre ' + (fcfm == null ? 'sin dato' : fcfm.toFixed(0) + ' % de ventas'), pFcf >= 3));
    t3.push(d('Margen neto ' + (mn == null ? 'sin dato' : mn.toFixed(0) + ' %'), pMn >= 4));
    t3.push(d(caja != null && deuda != null ? (caja > deuda ? 'Más caja que deuda' : 'Deuda superior a la caja') + (dp != null ? ' · deuda/patrimonio ' + dp.toFixed(1) : '') : 'Deuda: sin dato', pDeuda >= 3));
    partes.push({ id: 'fun', label: 'Calidad fundamental', p: pMb + pFcf + pMn + pDeuda, max: 20, detalle: t3 });

    // ── 4. Fuerza relativa (15) ───────────────────────────────────────────────
    const t4 = [];
    const spy = ctx.spy || {}, sec = ctx.sector || null;
    const r3 = tres != null && num(spy.tres) != null ? tres - spy.tres : null;
    const seis = num(a.seis), r6 = seis != null && num(spy.seis) != null ? seis - spy.seis : null;
    const rs = tres != null && sec && num(sec.tres) != null ? tres - sec.tres : null;
    const p3 = tramo(r3, [[20, 6], [10, 4], [0, 2]]);
    const p6 = tramo(r6, [[30, 4], [10, 3], [0, 1.5]]);
    const pSec = tramo(rs, [[15, 5], [5, 3], [0, 1.5]]);
    t4.push(d(r3 == null ? 'vs S&P 500 (3 meses): sin dato' : 'vs S&P 500 en 3 meses ' + pp(r3), p3 >= 4));
    t4.push(d(r6 == null ? 'vs S&P 500 (6 meses): sin dato' : 'vs S&P 500 en 6 meses ' + pp(r6), p6 >= 3));
    t4.push(d(rs == null ? 'vs su sector: sin dato' : 'vs su sector (' + (a.sector || '—') + ') ' + pp(rs), pSec >= 3));
    partes.push({ id: 'rel', label: 'Fuerza relativa', p: p3 + p6 + pSec, max: 15, detalle: t4 });

    // ── 5. Volumen y confirmacion de ruptura (15) ─────────────────────────────
    const t5 = [];
    const pVol = tramo(vr, [[2, 6], [1.5, 5], [1.2, 3], [1, 1]]);
    const pMax = dmax == null ? 0 : dmax >= -5 ? 5 : dmax >= -10 ? 3.5 : dmax >= -20 ? 2 : 0;
    const pRup = rupt === '3m' ? 4 : rupt === '1m' ? 2.5 : 0;
    t5.push(d('Volumen ' + (vr == null ? 'sin dato' : vr.toFixed(1).replace('.', ',') + 'x su media') + (adr != null ? ' · ADR ' + adr.toFixed(1) + ' %' : ''), pVol >= 3));
    t5.push(d(dmax == null ? 'Distancia al máximo de 52 semanas: sin dato' : 'A ' + Math.abs(dmax).toFixed(1).replace('.', ',') + ' % de su máximo de 52 semanas', pMax >= 3.5));
    t5.push(d(rupt === '3m' ? 'Rompe máximos de 3 meses' : rupt === '1m' ? 'Rompe máximos de 1 mes' : 'Sin ruptura reciente de máximos', !!rupt));
    partes.push({ id: 'vol', label: 'Volumen y ruptura', p: pVol + pMax + pRup, max: 15, detalle: t5 });

    // ── Penalizacion por sobreextension ───────────────────────────────────────
    const motivos = [];
    let pen = 0;
    if (rsi != null && rsi > 85) { pen += 10; motivos.push('RSI ' + rsi.toFixed(0) + ': muy sobrecomprada'); }
    else if (rsi != null && rsi > 80) { pen += 6; motivos.push('RSI ' + rsi.toFixed(0) + ': sobrecomprada'); }
    if (extEma != null && extEma > 40) { pen += 12; motivos.push('Precio ' + extEma.toFixed(0) + ' % por encima de la EMA 50'); }
    else if (extEma != null && extEma > 30) { pen += 8; motivos.push('Precio ' + extEma.toFixed(0) + ' % por encima de la EMA 50'); }
    else if (extEma != null && extEma > 20) { pen += 4; motivos.push('Precio ' + extEma.toFixed(0) + ' % por encima de la EMA 50'); }
    if (extSma != null && extSma > 120) { pen += 10; motivos.push('Precio más del doble de su media de 200 días'); }
    else if (extSma != null && extSma > 80) { pen += 6; motivos.push('Precio ' + extSma.toFixed(0) + ' % sobre su media de 200 días'); }
    if (mes != null && mes > 70) { pen += 8; motivos.push('Ya sube ' + pc1(mes) + ' en un mes'); }
    else if (mes != null && mes > 40) { pen += 4; motivos.push('Ya sube ' + pc1(mes) + ' en un mes'); }
    pen = Math.min(pen, 25);

    // ── Bonus por arranque temprano (no es una que ya se haya disparado) ──────
    let bon = 0, bonTxt = '';
    if (seis != null && mes != null && dmax != null && seis >= 0 && seis <= 50 && mes > 5 && dmax >= -15 && pen === 0) {
      bon = 5; bonTxt = 'Arranque temprano: cerca de máximos y subiendo este mes sin estar extendida (6 meses ' + pc1(seis) + ')';
    } else if (seis != null && seis <= 80 && pen <= 4 && dmax != null && dmax >= -15) {
      bon = 2.5; bonTxt = 'Tendencia aún no extendida';
    }

    const bruto = partes.reduce((s, x) => s + x.p, 0);
    const total = Math.max(0, Math.min(100, Math.round((bruto - pen + bon) * 10) / 10));

    // ── Explicacion ───────────────────────────────────────────────────────────
    if (g != null && g >= 20) razones.push('Ingresos ' + pc1(g) + ' interanual' + (acel != null && acel > 0 ? ' y acelerando (' + pp(acel) + ' en el último trimestre)' : ''));
    if (acel != null && acel >= 10) razones.push('Aceleración fuerte del crecimiento: el último trimestre crece ' + pp(acel) + ' más que los 12 meses');
    if (eQ != null && eQ > 0 && acelBpa > 0) razones.push('Beneficio por acción creciendo ' + pc1(eQ) + ' y acelerando');
    if (rupt) razones.push((rupt === '3m' ? 'Rompe máximos de 3 meses' : 'Rompe máximos de 1 mes') + (vr != null && vr >= 1.2 ? ' con volumen ' + vr.toFixed(1).replace('.', ',') + 'x' : ''));
    if (dmax != null && dmax >= -5) razones.push('A ' + Math.abs(dmax).toFixed(1).replace('.', ',') + ' % de su máximo de 52 semanas');
    if (r3 != null && r3 > 10) razones.push('Lo hace ' + pp(r3) + ' mejor que el S&P 500 en 3 meses');
    if (rs != null && rs > 10) razones.push('Mejor que su sector ' + pp(rs) + ' en 3 meses');
    if (bon === 5) razones.push(bonTxt);

    senales.push(...partes[0].detalle.filter(x => x.ok).map(x => x.t), ...partes[4].detalle.filter(x => x.ok).map(x => x.t));
    fundamentales.push(...partes[1].detalle.concat(partes[2].detalle).filter(x => x.ok).map(x => x.t));

    if (mn != null && mn < 0) riesgos.push('Pierde dinero (margen neto ' + mn.toFixed(0) + ' %)');
    if (fcfm != null && fcfm < 0) riesgos.push('Flujo de caja libre negativo (' + fcfm.toFixed(0) + ' % de ventas)');
    if (acel != null && acel < -3) riesgos.push('El crecimiento se está frenando (' + pp(acel) + ' en el último trimestre)');
    if (caja != null && deuda != null && deuda > caja * 2) riesgos.push('Deuda muy superior a la caja');
    else if (dp != null && dp >= 2) riesgos.push('Deuda alta frente al patrimonio (' + dp.toFixed(1) + ')');
    motivos.forEach(m => riesgos.push(m));
    if (a.resultados) {
      const dd = Math.round((new Date(a.resultados + 'T12:00:00Z') - new Date((ctx.fecha || a.resultados) + 'T12:00:00Z')) / 864e5);
      if (dd >= 0 && dd <= 14) riesgos.push('Publica resultados en ' + dd + ' días: puede moverse mucho');
    }
    if (num(a.volmedio) != null && a.volmedio < 500000) riesgos.push('Volumen medio bajo (' + Math.round(a.volmedio / 1000) + ' mil acciones): menos liquidez');
    if (adr != null && adr > 12) riesgos.push('Muy volátil: se mueve ' + adr.toFixed(1) + ' % al día de media');
    if (g == null) riesgos.push('Sin datos de crecimiento de ingresos');

    return { total, partes, penal: { total: pen, motivos }, bonus: { total: bon, texto: bonTxt },
             razones, senales, fundamentales, riesgos,
             g, acel, acelBpa, dmax, extEma, extSma, rupt, r3, rs };
  }

  window.PUNTUA = puntua;
})();
