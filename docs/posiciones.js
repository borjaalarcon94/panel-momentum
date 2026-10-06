/* "Mis posiciones": lo que el usuario ha comprado de verdad. Se guarda SOLO en su navegador
   (localStorage), no se envía a ningún sitio ni ocupa espacio en el repositorio.

   Protocolo de salida, pensado para aguantar la subida y no vender por un 5%:
     - Mientras la acción respete su EMA 50 al cierre, se mantiene, suba lo que suba.
     - Cuando la ganancia pasa del 20%, el stop sube al precio de compra: la operación ya no puede dar pérdidas.
     - Se vende si cierra bajo la EMA 50, si el RSI baja de 45, si devuelve más de la mitad de la ganancia máxima
       o si la empresa deja de cumplir los requisitos (crecimiento, tendencia, liquidez...). */
const CLAVE = 'posiciones-v1';   // los umbrales viven en docs/reglas.js

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

/* Revisión diaria de una posición. Toda la lógica vive en docs/reglas.js: aquí solo se dan formato
   los resultados. Si quieres cambiar un umbral, se cambia allí y cambia en toda la web a la vez. */
function revision(p) {
  const a = ACT[p.simbolo] || ACT[p.ticker];
  const ahora = a ? a.precio : (T.precios || {})[p.simbolo] ?? null;
  if (ahora == null) return { p, ahora: null, estado: 'sindatos', t: 'Sin datos', d: 'el panel ya no sigue esta acción: compruébala tú mismo.', cls: 'qwarn', req: [] };
  const dias = Math.round((new Date(FH[0] + 'T12:00:00Z') - new Date(p.fecha + 'T12:00:00Z')) / 864e5);
  const req = window.REQUISITOS(a);
  const ev = window.REGLAS.evaluaPosicion({ datos: a, compra: p.precio, maxRegistrado: p.maxVisto, stopPrevio: p.stopMax,
    dias, requisitos: req, diasResultados: window.DIAS_RESULTADOS(a) });
  const motivos = ev.motivos.map(window.TEXTO_SENAL), avisos = ev.avisos.map(window.TEXTO_SENAL);
  return { p, a, ahora, req, dias, ...ev, motivos, avisos, maxVisto: ev.maxVisto,
    t: ev.estado === 'vender' ? 'VENDER' : ev.estado === 'vigilar' ? 'VIGILAR' : 'MANTENER',
    d: ev.estado === 'vender' ? '(ahora ' + pc(ev.gan) + ') ' + motivos.join(' · ')
      : ev.estado === 'vigilar' ? avisos.join(' · ')
      : 'la tendencia aguanta. Stop en ' + (ev.stop ? n(ev.stop) + ' $ (' + pc((ev.stop / ahora - 1) * 100, 0) + ')' : '—')
        + (ev.gan >= window.REGLAS.R.gananciaProteger ? ': ya protege tu precio de compra.' : '.'),
    cls: ev.estado === 'vender' ? 'qbad' : ev.estado === 'vigilar' ? 'qwarn' : 'qok' };
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
  d.appendChild(el('p', 'nota', 'Con esto se calcula cuánto comprar de cada acción. Se guarda en tu navegador.'));
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
  guardarPos(leerPos().map(p => {
    const r = revs.find(x => x.p.ticker === p.ticker && !p.cerrada);
    return r && !p.cerrada ? { ...p, maxVisto: Math.max(p.maxVisto || 0, r.maxVisto || 0), stopMax: Math.max(p.stopMax || 0, r.stop || 0) } : p;
  }));

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
    izq.appendChild(el('div', 'name', 'comprada el ' + fFecha(r.p.fecha) + (r.dias ? ' · ' + r.dias + (r.dias === 1 ? ' día' : ' días') : '')));
    const der = el('div', 'px');
    const g = el('div', 'ganancia ' + (r.gan >= 0 ? 'up' : 'down'));
    g.textContent = r.ahora == null ? '—' : pc(r.gan);
    der.appendChild(g);
    if (r.ahora != null) der.appendChild(el('div', 'm', n(r.p.precio) + ' $ → ' + n(r.ahora) + ' $'));
    top.append(izq, der); c.appendChild(top);
    const clase = r.cls === 'qok' ? 'v-mantener' : r.cls === 'qbad' ? 'v-vender' : 'v-espera';
    const q = el('div', 'veredicto ' + clase);
    q.appendChild(el('span', 'vt', r.t));
    q.appendChild(el('span', 'vd', r.d));
    c.appendChild(q);
    if (r.stop) { const sb = el('div', 'stopbox');
      sb.appendChild(el('span', 'et', 'Stop'));
      sb.appendChild(el('span', 'vl', n(r.stop) + ' $'));
      sb.appendChild(el('span', 'ds', pc((r.stop / r.ahora - 1) * 100, 0) + ' desde el precio actual'));
      if (r.gan >= window.REGLAS.R.gananciaProteger) sb.appendChild(el('span', 'ds', '· ya protege tu compra'));
      c.appendChild(sb); }
    if (r.ahora != null) {
      const g = el('div', 'grid');
      [['Stop', (r.stop ? n(r.stop) + ' $ (' + pc((r.stop / r.ahora - 1) * 100, 0) + ')' : '—')],
       ['Llegó a ganar', pc(r.ganMax)],
       ['Ha devuelto', r.ganMax > 0 ? n(r.devuelto, 0) + ' %' + (r.limite ? ' de ' + r.limite + ' %' : '') : '—'],
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
  
};
