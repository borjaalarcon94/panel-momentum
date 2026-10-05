/* "Mis posiciones": lo que el usuario ha comprado de verdad. Se guarda SOLO en su navegador
   (localStorage), no se envía a ningún sitio ni ocupa espacio en el repositorio.

   Protocolo de salida, pensado para aguantar la subida y no vender por un 5%:
     - Mientras la acción respete su EMA 50 al cierre, se mantiene, suba lo que suba.
     - Cuando la ganancia pasa del 20%, el stop sube al precio de compra: la operación ya no puede dar pérdidas.
     - Se vende si cierra bajo la EMA 50, si el RSI baja de 45, si devuelve más de la mitad de la ganancia máxima
       o si la empresa deja de cumplir los requisitos (crecimiento, tendencia, liquidez...). */
const CLAVE = 'posiciones-v1';
const GANANCIA_PROTEGER = 20;   // % a partir del cual el stop sube al precio de compra
const PERDIDA_MAXIMA = 15;      // % que no se deja perder nunca desde el precio de compra

function leerPos() { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch (e) { return [] } }
function guardarPos(p) { try { localStorage.setItem(CLAVE, JSON.stringify(p)) } catch (e) {} }
window.tengoPosicion = t => leerPos().some(p => p.ticker === t && !p.cerrada);

/* Formulario para corregir una compra: precio medio, fecha y, si quieres, nº de acciones. */
function editor(p, alCerrar) {
  const d = el('div', 'editor');
  const iP = document.createElement('input'); iP.type = 'number'; iP.step = 'any'; iP.min = '0'; iP.value = p.precio; iP.style.maxWidth = '120px';
  const iF = document.createElement('input'); iF.type = 'date'; iF.value = p.fecha; iF.style.maxWidth = '160px';
  const iN = document.createElement('input'); iN.type = 'number'; iN.step = 'any'; iN.min = '0'; iN.placeholder = 'nº acciones (opcional)'; iN.style.maxWidth = '150px';
  if (p.acciones) iN.value = p.acciones;
  const fila = el('div', 'row');
  fila.append(el('span', 'm', 'Precio medio'), iP, el('span', 'm', 'Fecha'), iF, iN);
  const guardar = el('button', 'chip', 'Guardar cambios');
  guardar.onclick = () => {
    const precio = Number(iP.value);
    if (!precio || precio <= 0) return alert('Precio no válido.');
    guardarPos(leerPos().map(x => (x.ticker === p.ticker && !x.cerrada
      ? { ...x, precio, fecha: iF.value || x.fecha, acciones: Number(iN.value) || undefined, maxVisto: Math.max(x.maxVisto || precio, precio) } : x)));
    alCerrar();
  };
  const borrar = el('button', 'chip', 'Eliminar posición');
  borrar.onclick = () => {
    if (!confirm('¿Eliminar ' + p.ticker + ' de tus posiciones? No queda registrada como venta.')) return;
    guardarPos(leerPos().filter(x => !(x.ticker === p.ticker && !x.cerrada)));
    alCerrar();
  };
  const cancelar = el('button', 'chip', 'Cancelar');
  cancelar.onclick = alCerrar;
  const fila2 = el('div', 'row'); fila2.append(guardar, cancelar, borrar);
  d.append(fila, fila2);
  return d;
}

/* Comprar mas de la misma: recalcula el precio medio ponderado por numero de acciones. */
window.ampliarCompra = function (p, alCerrar) {
  const precio = Number(String(prompt('¿A qué precio has comprado ahora ' + p.ticker + '?', '') || '').replace(',', '.'));
  if (!precio || precio <= 0) return;
  const nuevas = Number(String(prompt('¿Cuántas acciones has comprado ahora?', '') || '').replace(',', '.'));
  if (!nuevas || nuevas <= 0) return alert('Para calcular el precio medio necesito el número de acciones.');
  const previas = Number(p.acciones) || Number(String(prompt('¿Cuántas acciones tenías antes, a ' + n(p.precio) + ' $?', '') || '').replace(',', '.'));
  if (!previas || previas <= 0) return alert('Sin el número de acciones anterior no puedo calcular el precio medio.');
  const total = previas + nuevas, medio = (p.precio * previas + precio * nuevas) / total;
  guardarPos(leerPos().map(x => (x.ticker === p.ticker && !x.cerrada ? { ...x, precio: medio, acciones: total } : x)));
  alCerrar();
};

window.anotarCompra = function (a, alGuardar) {
  const precio = prompt('¿A qué precio compraste ' + a.ticker + '?', n(a.precio).replace('.', ','));
  if (precio === null) return;
  const v = Number(String(precio).replace(',', '.').replace(/[^\d.]/g, ''));
  if (!v || v <= 0) return alert('Precio no válido.');
  const pos = leerPos();
  pos.push({ ticker: a.ticker, simbolo: a.simbolo || a.ticker, precio: v, fecha: FH[0], maxVisto: Math.max(v, a.precio || v) });
  guardarPos(pos);
  if (alGuardar) alGuardar();
};

/* Qué hacer con una posición abierta, con los datos de hoy. */
function revision(p) {
  const a = ACT[p.simbolo] || ACT[p.ticker];
  const ahora = a ? a.precio : (T.precios || {})[p.simbolo] ?? null;
  if (ahora == null) return { p, ahora: null, estado: 'sindatos', t: 'Sin datos', d: 'el panel ya no sigue esta acción: compruébala tú mismo.', cls: 'qwarn' };
  const gan = (ahora / p.precio - 1) * 100;
  const maxVisto = Math.max(p.maxVisto || p.precio, ahora);
  const ganMax = (maxVisto / p.precio - 1) * 100;
  const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
  /* Stop: la EMA 50 manda mientras la posición madura, pero nunca se arriesga más de PERDIDA_MAXIMA desde
     la compra; y en cuanto la ganancia pasa de GANANCIA_PROTEGER, el stop sube al precio de compra. */
  const base = a && a.ema50 ? a.ema50 : null;
  const suelo = p.precio * (1 - PERDIDA_MAXIMA / 100);
  const stop = gan >= GANANCIA_PROTEGER ? Math.max(base || 0, p.precio) : Math.max(base || 0, suelo);
  const req = a ? window.REQUISITOS(a) : [];
  // Los requisitos de entrada (tamaño, precio mínimo) no son motivo de venta: si crece y supera el techo, mejor.
  const fallos = req.filter(x => !x.ok && !x.entrada);
  const crecida = req.find(x => !x.ok && x.entrada && /Capitalización/.test(x.t));
  const motivos = [];
  if (base && ahora < base) motivos.push('ha cerrado por debajo de su EMA 50 (' + n(base) + ' $): la tendencia se ha roto');
  if (stop && ahora < stop) motivos.push('ha perdido el stop (' + n(stop) + ' $)');
  if (a && a.rsi != null && a.rsi < 45) motivos.push('RSI ' + n(a.rsi, 0) + ': sin fuerza compradora');
  if (devuelto >= 50 && ganMax >= 15) motivos.push('ha devuelto el ' + n(devuelto, 0) + ' % de lo que llegó a ganar (de ' + pc(ganMax) + ' a ' + pc(gan) + ')');
  if (fallos.length >= 2) motivos.push('ya no cumple ' + fallos.length + ' requisitos: ' + fallos.map(f => f.t.toLowerCase()).join(', '));
  const avisos = [];
  if (crecida) avisos.push('ha superado el techo de ' + cap(window.CRITERIOS_CAPMAX || 10e9) + ': ya no entraría como nueva, pero eso no es motivo para vender');
  if (!motivos.length) {
    if (fallos.length === 1) avisos.push('ha dejado de cumplir: ' + fallos[0].t.toLowerCase() + ' (' + fallos[0].v + ')');
    if (devuelto >= 30 && ganMax >= 15) avisos.push('ha devuelto el ' + n(devuelto, 0) + ' % de su ganancia máxima');
    if (a && a.ema21 && ahora < a.ema21) avisos.push('ha perdido la EMA 21 (' + n(a.ema21) + ' $): primera señal de debilidad');
  }
  const dR = window.DIAS_RESULTADOS(a);
  if (dR != null && dR >= 0 && dR <= 10) avisos.unshift('publica resultados en ' + dR + ' día' + (dR === 1 ? '' : 's') + ': puede abrir con un hueco que el stop no evita');
  const estado = motivos.length ? 'vender' : avisos.length ? 'vigilar' : 'mantener';
  return { p, a, ahora, gan, ganMax, devuelto, stop, maxVisto, req, fallos, motivos, avisos, estado,
    t: estado === 'vender' ? 'VENDER' : estado === 'vigilar' ? 'VIGILAR' : 'MANTENER',
    d: estado === 'vender' ? '(ahora ' + pc(gan) + ') ' + motivos.join(' · ') : estado === 'vigilar' ? avisos.join(' · ')
      : 'la tendencia aguanta: dejarla correr con el stop en ' + (stop ? n(stop) + ' $ (' + pc((stop / ahora - 1) * 100, 0) + ')' : '—')
        + (gan >= GANANCIA_PROTEGER ? '. El stop ya protege tu precio de compra: la operación no puede acabar en pérdidas.'
          : stop && base && stop > base ? '. Es tu pérdida máxima del ' + PERDIDA_MAXIMA + ' %; la EMA 50 está más abajo.' : '.'),
    cls: estado === 'vender' ? 'qbad' : estado === 'vigilar' ? 'qwarn' : 'qok' };
}

function cajaCartera() {
  const c = window.CARTERA.leer() || {};
  const d = el('div', 'blk');
  const fila = el('div', 'row');
  const i1 = document.createElement('input'); i1.type = 'number'; i1.min = '0'; i1.placeholder = 'Tamaño de tu cartera'; i1.style.maxWidth = '200px';
  if (c.total) i1.value = c.total;
  const i2 = document.createElement('input'); i2.type = 'number'; i2.min = '0.1'; i2.max = '5'; i2.step = '0.1'; i2.style.maxWidth = '140px';
  i2.value = c.riesgo || 1;
  const b = el('button', 'chip', 'Guardar');
  b.onclick = () => { window.CARTERA.guardar({ total: Number(i1.value) || 0, riesgo: Number(i2.value) || 1 }); window.posiciones() };
  fila.append(el('span', 'm', 'Cartera'), i1, el('span', 'm', '% que arriesgas por operación'), i2, b);
  d.appendChild(fila);
  d.appendChild(el('p', 'nota', 'Con estos dos datos el panel calcula cuánto comprar de cada acción: si arriesgas el ' + (c.riesgo || 1) + ' % y el stop está a un 8 %, la posición es un ' + ((c.riesgo || 1) / 8 * 100).toFixed(0) + ' % de la cartera. Nunca sugiere más de un 25 % en una sola. Se guarda en tu navegador.'));
  return d;
}

window.posiciones = function () {
  const R = $('rpos'); R.replaceChildren();
  R.appendChild(cajaCartera());
  const abiertas = leerPos().filter(p => !p.cerrada), cerradas = leerPos().filter(p => p.cerrada);
  if (!abiertas.length) {
    R.appendChild(el('div', 'empty', 'Aún no has anotado ninguna compra. En cada acción del top o del seguimiento tienes el botón «La tengo»: anota el precio al que compraste y aquí te diré si mantener o vender, con el stop actualizado cada día.'));
  }
  const revs = abiertas.map(revision);
  // Actualiza el máximo visto de cada posición (para medir cuánto devuelve desde su mejor momento).
  guardarPos(leerPos().map(p => { const r = revs.find(x => x.p.ticker === p.ticker && !p.cerrada); return r && r.maxVisto ? { ...p, maxVisto: r.maxVisto } : p }));

  if (revs.length) {
    const st = el('div', 'stats');
    const vivos = revs.filter(r => r.ahora != null);
    const med = vivos.length ? vivos.reduce((s, r) => s + r.gan, 0) / vivos.length : null;
    st.append(stat('posiciones abiertas', abiertas.length),
      stat('a vender', revs.filter(r => r.estado === 'vender').length),
      stat('resultado medio', med == null ? '—' : pc(med)),
      stat('cerradas', cerradas.length));
    R.appendChild(st);
  }

  revs.sort((a, b) => ({ vender: 0, vigilar: 1, mantener: 2, sindatos: 3 })[a.estado] - ({ vender: 0, vigilar: 1, mantener: 2, sindatos: 3 })[b.estado]);
  revs.forEach(r => {
    const c = el('div', 'card'), top = el('div', 'top'), izq = el('div');
    const l = el('a', 'tk', r.p.ticker);
    l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(r.p.simbolo); l.target = '_blank'; l.rel = 'noopener';
    izq.appendChild(l);
    izq.appendChild(el('div', 'name', 'comprada el ' + fFecha(r.p.fecha) + ' a ' + n(r.p.precio) + ' $'));
    const der = el('div', 'px');
    der.appendChild(el('b', r.gan >= 0 ? 'up' : 'down', r.ahora == null ? '—' : pc(r.gan)));
    if (r.ahora != null) der.appendChild(el('div', 'm', n(r.ahora) + ' $ ahora'));
    top.append(izq, der); c.appendChild(top);
    const q = el('div', 'quehacer ' + r.cls); q.appendChild(el('b', null, r.t)); q.appendChild(el('span', null, ' · ' + r.d));
    c.appendChild(q);
    if (r.ahora != null) {
      const g = el('div', 'grid');
      [['Stop actual', r.stop ? n(r.stop) + ' $' : '—'], ['Distancia al stop', r.stop ? pc((r.stop / r.ahora - 1) * 100, 0) : '—'],
       ['Máximo alcanzado', pc(r.ganMax)], ['Devuelto', r.ganMax > 0 ? n(r.devuelto, 0) + ' %' : '—'],
       ['Requisitos', r.req.length ? r.req.filter(x => x.ok).length + '/' + r.req.length : '—']]
        .forEach(([k, v]) => { const m = el('div', 'm', k); m.appendChild(el('span', null, v)); g.appendChild(m) });
      c.appendChild(g);
    }
    const acciones = el('div', 'row'); acciones.style.marginTop = '10px';
    const bv = el('button', 'chip', 'Marcar como vendida');
    bv.onclick = () => {
      const precio = prompt('¿A qué precio has vendido ' + r.p.ticker + '?', r.ahora != null ? n(r.ahora).replace('.', ',') : '');
      if (precio === null) return;
      const v = Number(String(precio).replace(',', '.').replace(/[^\d.]/g, '')) || r.ahora;
      guardarPos(leerPos().map(p => (p.ticker === r.p.ticker && !p.cerrada ? { ...p, cerrada: FH[0], precioSalida: v } : p)));
      window.posiciones();
    };
    const be = el('button', 'chip', 'Editar compra');
    const ba = el('button', 'chip', 'He comprado más');
    ba.onclick = () => window.ampliarCompra(r.p, window.posiciones);
    let abierto = null;
    be.onclick = () => {
      if (abierto) { abierto.remove(); abierto = null; return }
      abierto = editor(r.p, window.posiciones);
      c.appendChild(abierto);
    };
    acciones.append(bv, be, ba);
    c.appendChild(acciones);
    R.appendChild(c);
  });

  if (cerradas.length) {
    const d = document.createElement('details');
    d.appendChild(Object.assign(document.createElement('summary'), { textContent: 'Posiciones cerradas (' + cerradas.length + ')' }));
    const t = el('table', 'tabla'), h = el('tr');
    ['Acción', 'Comprada', 'Precio compra', 'Vendida', 'Precio venta', 'Resultado', ''].forEach(x => h.appendChild(el('th', null, x)));
    t.appendChild(h);
    cerradas.forEach(p => {
      const ret = p.precioSalida ? (p.precioSalida / p.precio - 1) * 100 : null;
      const tr = el('tr');
      [p.ticker, fFecha(p.fecha), n(p.precio) + ' $', fFecha(p.cerrada), p.precioSalida ? n(p.precioSalida) + ' $' : '—'].forEach(x => tr.appendChild(el('td', null, x)));
      tr.appendChild(el('td', ret == null ? null : ret >= 0 ? 'up' : 'down', ret == null ? '—' : pc(ret)));
      const tb = el('td'); const bb = el('button', 'chip', 'Borrar');
      bb.onclick = () => { if (confirm('¿Borrar ' + p.ticker + ' del histórico?')) { guardarPos(leerPos().filter(x => !(x.ticker === p.ticker && x.cerrada === p.cerrada))); window.posiciones() } };
      tb.appendChild(bb); tr.appendChild(tb);
      t.appendChild(tr);
    });
    const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
    R.appendChild(d);
  }
  R.appendChild(el('p', 'nota', 'Puedes corregir el precio medio o la fecha con «Editar compra», promediar con «He comprado más» y registrar la venta con «Marcar como vendida», que la pasa al histórico de abajo. Tus posiciones se guardan solo en este navegador: no viajan a ningún servidor ni se comparten. Si borras los datos del navegador o entras desde otro dispositivo, no estarán. Mantener mientras respete su EMA 50, sin arriesgar nunca más de un ' + PERDIDA_MAXIMA + ' % desde tu precio de compra; cuando la ganancia pasa del ' + GANANCIA_PROTEGER + ' %, el stop sube a tu precio de compra para que la operación no pueda dar pérdidas. Son referencias técnicas, no recomendaciones: la decisión es tuya.'));
};
