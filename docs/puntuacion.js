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
    // Crecimiento poco representativo: base de ingresos diminuta o salto puntual (hitos, licencias, una compra).
    const ingTot = num(a.ingresostot);
    const dudoso = (ingTot != null && ingTot < 25e6) || (g != null && g > 300);
    const gFy = num(a.ingresosfy);
    const pNivel = tramo(g, [[40, 7], [25, 5], [20, 3]]);
    let pAcel = acel == null ? 0 : acel >= 10 ? 8 : acel >= 3 ? 5.5 : acel > 0 ? 3 : 0;
    if (dudoso) pAcel = Math.min(pAcel, 3.5);
    const pBpa = eQ != null && eT != null && eQ > 0 && acelBpa > 0 ? 6 : eQ != null && eQ > 0 ? 4
      : eT != null && eT > 0 ? 2.5 : eQ == null && eT == null ? 1.5 : 0;
    // Consistencia: que no dependa de un solo trimestre. Mira el ejercicio completo y los 12 meses.
    const pCons = gFy == null ? 0 : gFy >= 25 && gT != null && gT >= 20 ? 4 : gFy >= 20 || (gT != null && gT >= 20) ? 2.5 : gFy >= 10 ? 1 : 0;
    t2.push(d('Ingresos ' + (g == null ? 'sin dato' : pc1(g)) + ' interanual', pNivel >= 4));
    t2.push(d((acel == null ? 'Aceleración de ingresos: sin dato trimestral' : 'Crecimiento ' + (acel > 0 ? 'acelerando' : 'desacelerando') + ' ' + pp(acel) + ' (trimestre vs 12 meses)') + (dudoso ? ' — poco representativo' : ''), pAcel >= 3));
    t2.push(d(eQ == null && eT == null ? 'Beneficio por acción: sin dato' : 'BPA ' + (eQ != null ? pc1(eQ) + ' trimestral' : pc1(eT) + ' TTM') + (acelBpa > 0 ? ', acelerando' : ''), pBpa >= 4));
    t2.push(d(gFy == null ? 'Crecimiento del último ejercicio: sin dato' : 'Crece también en el ejercicio completo: ' + pc1(gFy), pCons >= 2.5));
    partes.push({ id: 'ace', label: 'Aceleración del crecimiento', p: pNivel + pAcel + pBpa + pCons, max: 25, detalle: t2 });

    // ── 3. Calidad fundamental (20) ───────────────────────────────────────────
    const t3 = [];
    const mb = num(a.mbruto), fcfm = num(a.fcfm), mn = num(a.margen), dp = num(a.deudapat);
    const pMb = tramo(mb, [[70, 5], [50, 3.5], [35, 2]]);
    const pFcf = tramo(fcfm, [[10, 4], [0, 2.5], [-10, 1]]);
    const pMn = mn == null ? 0 : mn > 0 ? 3 : mn > -20 ? 1.5 : 0;
    const pDeuda = caja != null && deuda != null && caja > deuda ? 4 : dp == null ? 0 : dp < 1 ? 2.5 : dp < 2 ? 1 : 0;
    // Regla del 40: crecer rapido o ganar dinero; lo ideal es que la suma pase de 40.
    const r40 = gT != null && fcfm != null ? gT + fcfm : null;
    const pR40 = tramo(r40, [[60, 4], [40, 3], [25, 1.5]]);
    t3.push(d('Margen bruto ' + (mb == null ? 'sin dato' : mb.toFixed(0) + ' %'), pMb >= 4));
    t3.push(d('Flujo de caja libre ' + (fcfm == null ? 'sin dato' : fcfm.toFixed(0) + ' % de ventas'), pFcf >= 3));
    t3.push(d('Margen neto ' + (mn == null ? 'sin dato' : mn.toFixed(0) + ' %'), pMn >= 4));
    t3.push(d(caja != null && deuda != null ? (caja > deuda ? 'Más caja que deuda' : 'Deuda superior a la caja') + (dp != null ? ' · deuda/patrimonio ' + dp.toFixed(1) : '') : 'Deuda: sin dato', pDeuda >= 2.5));
    t3.push(d(r40 == null ? 'Regla del 40: sin dato' : 'Regla del 40: ' + r40.toFixed(0) + ' (crecimiento ' + pc1(gT) + ' + margen FCF ' + fcfm.toFixed(0) + ' %)', pR40 >= 3));
    partes.push({ id: 'fun', label: 'Calidad fundamental', p: pMb + pFcf + pMn + pDeuda + pR40, max: 20, detalle: t3 });

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
    const pVol = tramo(vr, [[2, 4], [1.5, 3], [1.2, 2], [1, 0.5]]);
    // ADR: cuanto se mueve al dia. Sin movimiento no hay recorrido que capturar a corto plazo.
    const pAdr = tramo(adr, [[7, 2.5], [5, 2], [3.5, 1], [2.5, 0.5]]);
    const pMax = dmax == null ? 0 : dmax >= -5 ? 4.5 : dmax >= -10 ? 3 : dmax >= -20 ? 1.5 : 0;
    const pRup = rupt === '3m' ? 4 : rupt === '1m' ? 2.5 : 0;
    t5.push(d('Volumen ' + (vr == null ? 'sin dato' : vr.toFixed(1).replace('.', ',') + 'x su media'), pVol >= 2));
    t5.push(d(adr == null ? 'ADR: sin dato' : 'Se mueve ' + adr.toFixed(1).replace('.', ',') + ' % al día de media (ADR)', pAdr >= 1));
    t5.push(d(dmax == null ? 'Distancia al máximo de 52 semanas: sin dato' : 'A ' + Math.abs(dmax).toFixed(1).replace('.', ',') + ' % de su máximo de 52 semanas', pMax >= 3));
    t5.push(d(rupt === '3m' ? 'Rompe máximos de 3 meses' : rupt === '1m' ? 'Rompe máximos de 1 mes' : 'Sin ruptura reciente de máximos', !!rupt));
    partes.push({ id: 'vol', label: 'Volumen y ruptura', p: pVol + pAdr + pMax + pRup, max: 15, detalle: t5 });

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
    // Negocio poco escalable: con margen bruto bajo, multiplicar por varias veces es muy difícil.
    if (mb != null && mb < 15) { pen += 8; motivos.push('Margen bruto ' + mb.toFixed(0) + ' %: negocio de volumen, muy difícil que multiplique'); }
    else if (mb != null && mb < 25) { pen += 5; motivos.push('Margen bruto ' + mb.toFixed(0) + ' %: negocio poco escalable'); }
    else if (mb != null && mb < 35) { pen += 2; motivos.push('Margen bruto ' + mb.toFixed(0) + ' %: margen ajustado'); }
    // Recorrido ya hecho desde mínimos: cuanto más lleva multiplicado, menos queda por delante.
    const min52 = num(a.min52), desdeMin = min52 && precio ? (precio / min52 - 1) * 100 : null;
    if (desdeMin != null && desdeMin > 500) { pen += 8; motivos.push('Ya multiplica por ' + (desdeMin / 100 + 1).toFixed(1) + ' desde su mínimo del año'); }
    else if (desdeMin != null && desdeMin > 300) { pen += 4; motivos.push('Ya sube ' + desdeMin.toFixed(0) + ' % desde su mínimo del año'); }
    pen = Math.min(pen, 25);

    // ── Bonus por tamano: cuanto mas pequena, mas recorrido tiene para multiplicar ────
    const cap = num(a.cap);
    const pTam = cap == null ? 0 : cap < 1e9 ? 5 : cap < 3e9 ? 3.5 : cap < 6e9 ? 2 : 0.5;
    const tamTxt = cap == null ? '' : 'Capitalización ' + (cap >= 1e9 ? (cap / 1e9).toFixed(1).replace('.', ',') + ' B' : Math.round(cap / 1e6) + ' M') + (cap < 3e9 ? ': tamaño pequeño, mucho recorrido si acierta' : cap < 6e9 ? ': tamaño medio' : ': ya es grande, menos recorrido');

    // ── Bonus por arranque temprano (no es una que ya se haya disparado) ──────
    let bon = 0, bonTxt = '';
    if (seis != null && mes != null && dmax != null && seis >= 0 && seis <= 50 && mes > 5 && dmax >= -15 && pen === 0) {
      bon = 5; bonTxt = 'Arranque temprano: cerca de máximos y subiendo este mes sin estar extendida (6 meses ' + pc1(seis) + ')';
    } else if (seis != null && seis <= 80 && pen <= 4 && dmax != null && dmax >= -15) {
      bon = 2.5; bonTxt = 'Tendencia aún no extendida';
    }

    const bruto = partes.reduce((s, x) => s + x.p, 0);
    const sinPenalizar = Math.max(0, Math.min(100, Math.round((bruto + bon + pTam) * 10) / 10));
    const total = Math.max(0, Math.min(100, Math.round((bruto - pen + bon + pTam) * 10) / 10));

    // ── Explicacion ───────────────────────────────────────────────────────────
    if (mb != null && mb >= 60 && (fcfm == null || fcfm > 0)) razones.push('Margen bruto ' + mb.toFixed(0) + ' %: negocio escalable, cada euro nuevo de ventas deja mucho');
    if (r40 != null && r40 >= 40) razones.push('Regla del 40 en ' + r40.toFixed(0) + ': crece y genera caja a la vez');
    if (g != null && g >= 20) razones.push('Ingresos ' + pc1(g) + ' interanual' + (acel != null && acel > 0 ? ' y acelerando (' + pp(acel) + ' en el último trimestre)' : ''));
    if (acel != null && acel >= 10) razones.push('Aceleración fuerte del crecimiento: el último trimestre crece ' + pp(acel) + ' más que los 12 meses');
    if (eQ != null && eQ > 0 && acelBpa > 0) razones.push('Beneficio por acción creciendo ' + pc1(eQ) + ' y acelerando');
    if (rupt) razones.push((rupt === '3m' ? 'Rompe máximos de 3 meses' : 'Rompe máximos de 1 mes') + (vr != null && vr >= 1.2 ? ' con volumen ' + vr.toFixed(1).replace('.', ',') + 'x' : ''));
    if (dmax != null && dmax >= -5) razones.push('A ' + Math.abs(dmax).toFixed(1).replace('.', ',') + ' % de su máximo de 52 semanas');
    if (r3 != null && r3 > 10) razones.push('Lo hace ' + pp(r3) + ' mejor que el S&P 500 en 3 meses');
    if (rs != null && rs > 10) razones.push('Mejor que su sector ' + pp(rs) + ' en 3 meses');
    if (bon === 5) razones.push(bonTxt);
    if (pTam >= 3.5) razones.push(tamTxt);
    if (cap != null && cap >= 6e9) riesgos.push(tamTxt);

    senales.push(...partes[0].detalle.filter(x => x.ok).map(x => x.t), ...partes[4].detalle.filter(x => x.ok).map(x => x.t));
    fundamentales.push(...partes[1].detalle.concat(partes[2].detalle).filter(x => x.ok).map(x => x.t));

    if (mn != null && mn < 0) riesgos.push('Pierde dinero (margen neto ' + mn.toFixed(0) + ' %)');
    if (fcfm != null && fcfm < 0) riesgos.push('Flujo de caja libre negativo (' + fcfm.toFixed(0) + ' % de ventas)');
    if (acel != null && acel < -3) riesgos.push('El crecimiento se está frenando (' + pp(acel) + ' en el último trimestre)');
    if (gT != null && gT < 10 && gQ != null && gQ >= 20) riesgos.push('En 12 meses los ingresos solo crecen ' + pc1(gT) + ': la tesis depende del último trimestre (' + pc1(gQ) + ')');
    if (gQ != null && gQ < 5 && gT != null && gT >= 20) riesgos.push('El último trimestre se ha frenado a ' + pc1(gQ) + ' pese al ' + pc1(gT) + ' de los 12 meses');
    if (caja != null && deuda != null && deuda > caja * 2) riesgos.push('Deuda muy superior a la caja');
    else if (dp != null && dp >= 2) riesgos.push('Deuda alta frente al patrimonio (' + dp.toFixed(1) + ')');
    motivos.forEach(m => riesgos.push(m));
    if (a.resultados) {
      const dd = Math.round((new Date(a.resultados + 'T12:00:00Z') - new Date((ctx.fecha || a.resultados) + 'T12:00:00Z')) / 864e5);
      if (dd >= 0 && dd <= 14) riesgos.push('Publica resultados en ' + dd + ' días: puede moverse mucho');
    }
    if (num(a.volmedio) != null && a.volmedio < 500000) riesgos.push('Volumen medio bajo (' + Math.round(a.volmedio / 1000) + ' mil acciones): menos liquidez');
    if (adr != null && adr > 12) riesgos.push('Muy volátil: se mueve ' + adr.toFixed(1).replace('.', ',') + ' % al día de media');
    if (adr != null && adr < 3) riesgos.push('Se mueve poco: ' + adr.toFixed(1).replace('.', ',') + ' % al día. Cuesta sacar partido en semanas');
    if (dudoso) riesgos.push(ingTot != null && ingTot < 25e6
      ? 'Crecimiento sobre una base de ingresos muy pequeña (' + Math.round(ingTot / 1e6) + ' M$): puede no repetirse'
      : 'Crecimiento de ' + Math.round(g) + ' %: probablemente un efecto puntual, no un ritmo sostenible');
    if (g == null) riesgos.push('Sin datos de crecimiento de ingresos');

    return { total, sinPenalizar, extendida: pen >= 10, partes, penal: { total: pen, motivos }, bonus: { total: bon, texto: bonTxt },
             tamano: { puntos: pTam, texto: tamTxt }, desdeMin,
             razones, senales, fundamentales, riesgos,
             g, acel, acelBpa, dmax, extEma, extSma, rupt, r3, rs };
  }

  window.PUNTUA = puntua;
})();
