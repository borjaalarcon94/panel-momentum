/* "Mis posiciones": lo que el usuario ha comprado de verdad. Se guarda SOLO en su navegador
   (localStorage), no se envía a ningún sitio ni ocupa espacio en el repositorio.

   Protocolo de salida, pensado para aguantar la subida y no vender por un 5%:
     - Mientras la acción respete su EMA 50 al cierre, se mantiene, suba lo que suba.
     - Cuando la ganancia pasa del 20%, el stop sube al precio de compra: la operación ya no puede dar pérdidas.
     - Se vende si cierra bajo la EMA 50, si el RSI baja de 45, si devuelve más de la mitad de la ganancia máxima
       o si la empresa deja de cumplir los requisitos (crecimiento, tendencia, liquidez...). */
const CLAVE = 'posiciones-v1';   // los umbrales viven en docs/reglas.js

/* Un input type="number" rechaza la coma decimal: si escribes "15,42" el navegador deja el campo
   vacio y el formulario te dice que pongas el precio, habiendolo puesto. Con teclado español eso
   pasa siempre. Se usa texto con teclado numerico y se interpreta la coma a mano. */
function campoNumero(ph, valor) {
  const i = document.createElement('input');
  i.type = 'text'; i.inputMode = 'decimal'; i.autocomplete = 'off';
  if (ph) i.placeholder = ph;
  if (valor != null && valor !== '') i.value = String(valor).replace('.', ',');
  return i;
}
const comoNumero = v => {
  const x = Number(String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.'));
  return isFinite(x) ? x : NaN;
};

function leerPos() { try { return JSON.parse(localStorage.getItem(CLAVE) || '[]') } catch (e) { return [] } }
function guardarPos(p) { try { localStorage.setItem(CLAVE, JSON.stringify(p)) } catch (e) {} }
window.tengoPosicion = t => leerPos().some(p => p.ticker === t && !p.cerrada);

/* Formulario para corregir una compra: precio medio, fecha y, si quieres, nº de acciones. */
function editor(p, alCerrar) {
  const d = el('div', 'editor');
  const iP = campoNumero('0,00', p.precio); iP.style.maxWidth = '120px';
  const iF = document.createElement('input'); iF.type = 'date'; iF.value = p.fecha; iF.style.maxWidth = '160px';
  const iN = campoNumero('nº acciones (opcional)'); iN.style.maxWidth = '150px';
  if (p.acciones) iN.value = p.acciones;
  const fila = el('div', 'row');
  fila.append(el('span', 'm', 'Precio medio'), iP, el('span', 'm', 'Fecha'), iF, iN);
  const guardar = el('button', 'chip', 'Guardar cambios');
  guardar.onclick = () => {
    const precio = comoNumero(iP.value);
    if (!precio || precio <= 0) return alert('Precio no válido.');
    guardarPos(leerPos().map(x => (x.ticker === p.ticker && !x.cerrada
      ? { ...x, precio, fecha: iF.value || x.fecha, acciones: comoNumero(iN.value) || undefined, maxVisto: Math.max(x.maxVisto || precio, precio) } : x)));
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
  const acc = Number(String(prompt('¿Cuántas acciones de ' + a.ticker + '? (puedes dejarlo en blanco, pero sin esto no puedo decirte cuánto dinero tienes metido)', '') || '').replace(',', '.'));
  const pos = leerPos();
  pos.push({ ticker: a.ticker, simbolo: a.simbolo || a.ticker, precio: v, fecha: FH[0],
    acciones: acc > 0 ? acc : undefined, maxVisto: Math.max(v, a.precio || v) });
  guardarPos(pos);
  if (alGuardar) alGuardar();
};

/* Todo lo que va en dinero. Sin el numero de acciones no se puede calcular nada: se devuelve null
   y la tarjeta lo pide en vez de inventarse una cifra. Los precios son en dolares. */
function dinero(p, ahora, stop) {
  const acc = Number(p.acciones);
  if (!acc || !(acc > 0) || ahora == null) return null;
  const invertido = p.precio * acc, valor = ahora * acc;
  const c = window.CARTERA.leer() || {};
  return { acciones: acc, invertido, valor, pyl: valor - invertido,
    riesgo: stop ? Math.max(0, (ahora - stop) * acc) : null,
    pctCartera: c.total ? invertido / c.total * 100 : null };
}

/* Revisión diaria de una posición. Toda la lógica vive en docs/reglas.js: aquí solo se dan formato
   los resultados. Si quieres cambiar un umbral, se cambia allí y cambia en toda la web a la vez. */
function revision(p) {
  const a = ACT[p.simbolo] || ACT[p.ticker];
  const ahora = a ? a.precio : (T.precios || {})[p.simbolo] ?? null;
  if (ahora == null) return { p, ahora: null, estado: 'sindatos', t: 'Sin datos', d: 'el panel ya no sigue esta acción: compruébala tú mismo.', cls: 'qwarn', req: [] };
  const dias = Math.round((new Date(FH[0] + 'T12:00:00Z') - new Date(p.fecha + 'T12:00:00Z')) / 864e5);
  const req = window.REQUISITOS(a);
  const ev = window.REGLAS.evaluaPosicion({ datos: a, compra: p.precio, maxRegistrado: p.maxVisto, stopPrevio: p.stopMax,
    dias, requisitos: req, diasResultados: window.DIAS_RESULTADOS(a),
    maxSerie: maximoEnSerie(p.simbolo || p.ticker, p.fecha) });
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
  const i1 = campoNumero('Tamaño de tu cartera', c.total || ''); i1.style.maxWidth = '200px';
  const i2 = campoNumero('1,5', c.riesgo || 1); i2.style.maxWidth = '140px';
  const b = el('button', 'chip', 'Guardar');
  b.onclick = () => { window.CARTERA.guardar({ total: comoNumero(i1.value) || 0, riesgo: comoNumero(i2.value) || 1 }); window.posiciones() };
  fila.append(el('span', 'm', 'Cartera ($)'), i1, el('span', 'm', '% que arriesgas por operación'), i2, b);
  d.appendChild(fila);
  d.appendChild(el('p', 'nota', 'Con esto se calcula cuánto comprar de cada acción y qué parte de tu cartera ocupa cada posición. Los precios del panel son en dólares: pon aquí tu cartera en dólares para que los porcentajes cuadren. Se guarda en tu navegador.'));
  return d;
}

/* Copia de seguridad: las posiciones viven solo en este navegador, así que hay que poder llevárselas.
   Se exportan e importan como texto, sin servidor. */
function copiaSeguridad() {
  const d = el('div', 'row'); d.style.marginTop = '14px';
  const exportar = el('button', 'chip', 'Copiar mis posiciones');
  exportar.onclick = async () => {
    const datos = JSON.stringify({ posiciones: leerPos(), cartera: window.CARTERA.leer(), guardado: FH[0] });
    try { await navigator.clipboard.writeText(datos); exportar.textContent = '✓ Copiado: pégalo donde quieras guardarlo'; setTimeout(() => { exportar.textContent = 'Copiar mis posiciones' }, 3000); }
    catch (e) { prompt('Copia este texto y guárdalo:', datos); }
  };
  const importar = el('button', 'chip', 'Restaurar desde una copia');
  importar.onclick = () => {
    const txt = prompt('Pega aquí la copia que guardaste:');
    if (!txt) return;
    try {
      const d2 = JSON.parse(txt);
      if (!Array.isArray(d2.posiciones)) throw new Error('formato');
      const abiertas = d2.posiciones.filter(p => p && p.ticker && p.precio > 0);
      if (!confirm('Vas a sustituir tus ' + leerPos().length + ' posiciones por las ' + abiertas.length + ' de la copia. ¿Seguro?')) return;
      guardarPos(abiertas);
      if (d2.cartera) window.CARTERA.guardar(d2.cartera);
      window.posiciones();
    } catch (e) { alert('Esa copia no se entiende. Pega el texto completo tal cual lo copiaste.'); }
  };
  d.append(exportar, importar);
  return d;
}

/* Alta manual de una operacion ya cerrada: para las de antes de usar el panel o las que no quedaron
   bien grabadas. Son seis campos, demasiados para encadenar prompts. */
function formularioOperacion(alGuardar) {
  const d = el('div', 'blk');
  d.appendChild(el('div', 'blt', 'Añadir una operación cerrada'));
  const campo = (etiqueta, tipo, ph) => {
    const i = tipo === 'number' ? campoNumero(ph || '0,00') : document.createElement('input');
    if (tipo !== 'number') { i.type = tipo; if (ph) i.placeholder = ph; }
    const w = el('div', 'campo'); w.appendChild(el('span', 'm', etiqueta)); w.appendChild(i);
    return { i, w };
  };
  const tk = campo('Acción', 'text', 'p. ej. PAYS');
  const f1 = campo('Comprada el', 'date'), p1 = campo('Precio de compra', 'number', '0,00');
  const f2 = campo('Vendida el', 'date'), p2 = campo('Precio de venta', 'number', '0,00');
  const ac = campo('Nº de acciones', 'number', 'opcional');
  const rejilla = el('div', 'formop');
  rejilla.append(tk.w, ac.w, f1.w, p1.w, f2.w, p2.w);
  d.appendChild(rejilla);
  const guardar = el('button', 'chip main', 'Guardar operación');
  guardar.onclick = () => {
    const ticker = String(tk.i.value || '').trim().toUpperCase();
    const compra = comoNumero(p1.i.value), venta = comoNumero(p2.i.value);
    if (!ticker) return alert('Pon el símbolo de la acción.');
    if (!compra || compra <= 0 || !venta || venta <= 0) return alert('Los dos precios tienen que ser mayores que cero.');
    if (!f1.i.value || !f2.i.value) return alert('Pon las dos fechas.');
    if (f2.i.value < f1.i.value) return alert('La venta no puede ser anterior a la compra.');
    const pos = leerPos();
    pos.push({ ticker, simbolo: ticker, precio: compra, fecha: f1.i.value, acciones: comoNumero(ac.i.value) || undefined,
      cerrada: f2.i.value, precioSalida: venta, manual: true, maxVisto: Math.max(compra, venta) });
    guardarPos(pos);
    alGuardar();
  };
  const cancelar = el('button', 'chip', 'Cancelar');
  cancelar.onclick = alGuardar;
  const fila = el('div', 'row'); fila.append(guardar, cancelar);
  d.appendChild(fila);
  return d;
}

/* El historial: cada operacion cerrada con su resultado y, abajo, la suma. Es la respuesta a
   "¿esto esta funcionando?" con tu dinero, no con el backtest. */
/* Resultado mes a mes, con el acumulado al lado: es la curva de tu cuenta. Una media global esconde
   que ganaste mucho un mes y perdiste despacio los otros cinco; aqui se ve. Solo salen los meses en
   los que cerraste algo. */
function beneficioMensual(cerradas) {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const porMes = new Map();
  cerradas.forEach(p => {
    if (!p.cerrada) return;
    const clave = p.cerrada.slice(0, 7);
    const m = porMes.get(clave) || { ops: 0, ganadoras: 0, pyl: 0, sinAcciones: 0 };
    const ret = p.precioSalida ? (p.precioSalida / p.precio - 1) * 100 : null;
    const acc = Number(p.acciones) > 0 ? Number(p.acciones) : null;
    m.ops++;
    if (ret > 0) m.ganadoras++;
    if (acc && p.precioSalida) m.pyl += (p.precioSalida - p.precio) * acc; else m.sinAcciones++;
    porMes.set(clave, m);
  });
  if (!porMes.size) return null;

  const d = el('div'); d.style.marginTop = '18px';
  d.appendChild(el('h2', 'blt', 'Beneficio y pérdida por mes'));
  d.appendChild(el('p', 'nota', 'Lo que ganaste o perdiste cada mes, contando las operaciones el día que las cerraste. El acumulado es tu curva: lo que llevas desde que empezaste.'));
  const t = el('table', 'tabla'), h = el('tr');
  ['Mes', 'Operaciones', 'Acertadas', 'Resultado', 'Acumulado'].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  let acumulado = 0, totalOps = 0, totalGan = 0, faltan = 0;
  [...porMes.entries()].sort().forEach(([clave, m]) => {
    acumulado += m.pyl; totalOps += m.ops; totalGan += m.ganadoras; faltan += m.sinAcciones;
    const [anio, mes] = clave.split('-');
    const tr = el('tr');
    tr.appendChild(el('td', 'left', MESES[+mes - 1] + ' de ' + anio));
    tr.appendChild(el('td', null, String(m.ops)));
    tr.appendChild(el('td', null, m.ganadoras + ' de ' + m.ops));
    tr.appendChild(el('td', m.sinAcciones === m.ops ? 'm' : m.pyl >= 0 ? 'up' : 'down',
      m.sinAcciones === m.ops ? '—' : (m.pyl >= 0 ? '+' : '−') + n(Math.abs(m.pyl), 2) + ' $'));
    tr.appendChild(el('td', acumulado >= 0 ? 'up' : 'down',
      (acumulado >= 0 ? '+' : '−') + n(Math.abs(acumulado), 2) + ' $'));
    t.appendChild(tr);
  });
  const tr = el('tr', 'total');
  tr.appendChild(el('td', 'left', el('b', null, 'TOTAL').textContent));
  tr.appendChild(el('td', null, String(totalOps)));
  tr.appendChild(el('td', null, totalGan + ' de ' + totalOps));
  tr.appendChild(el('td', acumulado >= 0 ? 'up' : 'down',
    (acumulado >= 0 ? '+' : '−') + n(Math.abs(acumulado), 2) + ' $'));
  tr.appendChild(el('td'));
  t.appendChild(tr);
  const w = el('div', 'tw'); w.appendChild(t); d.appendChild(w);
  /* Si a alguna operacion le falta el nº de acciones, su resultado en dinero no se puede sumar y el
     mes sale corto. Se dice, en vez de dar una cifra incompleta por buena. */
  if (faltan) d.appendChild(el('div', 'm', faltan === 1
    ? 'Una operación no tiene nº de acciones, así que no entra en las sumas. Añádelo en su mes para que la cuenta cuadre.'
    : faltan + ' operaciones no tienen nº de acciones, así que no entran en las sumas. Añádelo para que la cuenta cuadre.'));
  return d;
}

function historialOperaciones(cerradas) {
  const R = el('div'); R.style.marginTop = '18px';
  R.appendChild(el('h2', 'blt', 'Mis operaciones cerradas'));
  R.appendChild(el('p', 'nota', 'Todo lo que has comprado y vendido, con lo que ganaste o perdiste en cada una. Es tu historial real: lo que de verdad dice si la estrategia funciona.'));

  const ops = cerradas.map(p => {
    const ret = p.precioSalida ? (p.precioSalida / p.precio - 1) * 100 : null;
    const acc = Number(p.acciones) > 0 ? Number(p.acciones) : null;
    return { p, ret, acc, invertido: acc ? p.precio * acc : null,
      pyl: acc && p.precioSalida ? (p.precioSalida - p.precio) * acc : null,
      dias: p.cerrada && p.fecha ? Math.round((new Date(p.cerrada + 'T12:00:00Z') - new Date(p.fecha + 'T12:00:00Z')) / 864e5) : null };
  }).sort((a, b) => (a.p.cerrada < b.p.cerrada ? 1 : -1));

  if (ops.length) {
    const conDinero = ops.filter(o => o.pyl != null);
    const ganadoras = ops.filter(o => o.ret > 0).length;
    const totalPyl = conDinero.reduce((s, o) => s + o.pyl, 0);
    const totalInv = conDinero.reduce((s, o) => s + o.invertido, 0);
    const st = el('div', 'stats');
    st.append(stat('operaciones', ops.length),
      stat('acertadas', ganadoras + ' de ' + ops.length + ' · ' + Math.round(ganadoras / ops.length * 100) + ' %'));
    if (conDinero.length) {
      st.append(stat('resultado total', (totalPyl >= 0 ? '+' : '−') + n(Math.abs(totalPyl), 2) + ' $'),
        stat('sobre lo invertido', pc(totalInv ? totalPyl / totalInv * 100 : 0)));
    } else {
      st.append(stat('resultado medio', pc(ops.reduce((s, o) => s + (o.ret || 0), 0) / ops.length)));
    }
    R.appendChild(st);
    /* Si a alguna le falta el nº de acciones, el total no incluye esa operacion: se dice, en vez de
       dar una suma incompleta como si fuera la buena. */
    if (conDinero.length && conDinero.length < ops.length)
      R.appendChild(el('div', 'm', 'El total suma ' + conDinero.length + ' de ' + ops.length +
        ' operaciones: a las otras les falta el nº de acciones. Añádelo para que la cuenta salga completa.'));
  }

  const t = el('table', 'tabla'), h = el('tr');
  ['Acción', 'Comprada', 'Vendida', 'Días', 'Compra', 'Venta', 'Acciones', 'Resultado', 'En dinero', ''].forEach(x => h.appendChild(el('th', null, x)));
  t.appendChild(h);
  ops.forEach(o => {
    const p = o.p, tr = el('tr');
    const td0 = el('td'); td0.appendChild(el('b', null, p.ticker));
    if (p.manual) td0.appendChild(el('div', 'name', 'añadida a mano'));
    tr.appendChild(td0);
    [fFecha(p.fecha), fFecha(p.cerrada), o.dias == null ? '—' : String(o.dias),
     n(p.precio) + ' $', p.precioSalida ? n(p.precioSalida) + ' $' : '—',
     o.acc == null ? '—' : n(o.acc, o.acc % 1 ? 2 : 0)].forEach(x => tr.appendChild(el('td', null, x)));
    tr.appendChild(el('td', o.ret == null ? null : o.ret >= 0 ? 'up' : 'down', o.ret == null ? '—' : pc(o.ret)));
    tr.appendChild(el('td', o.pyl == null ? null : o.pyl >= 0 ? 'up' : 'down',
      o.pyl == null ? '—' : (o.pyl >= 0 ? '+' : '−') + n(Math.abs(o.pyl), 2) + ' $'));
    const tb = el('td'), bb = el('button', 'chip', 'Borrar');
    bb.onclick = () => {
      if (!confirm('¿Borrar la operación de ' + p.ticker + ' del ' + fFecha(p.cerrada) + '? No se puede deshacer.')) return;
      guardarPos(leerPos().filter(x => !(x.ticker === p.ticker && x.cerrada === p.cerrada && x.fecha === p.fecha)));
      window.posiciones();
    };
    tb.appendChild(bb); tr.appendChild(tb);
    t.appendChild(tr);
  });
  if (!ops.length) {
    const tr = el('tr'), td = el('td', 'name', 'Todavía no has cerrado ninguna operación. Cuando vendas, aparecerá aquí.');
    td.setAttribute('colspan', '10'); tr.appendChild(td); t.appendChild(tr);
  } else {
    // Fila de totales dentro de la propia tabla: la suma se lee junto a lo que la compone.
    const conDinero = ops.filter(o => o.pyl != null);
    const tr = el('tr', 'total');
    const td = el('td'); td.setAttribute('colspan', '7'); td.appendChild(el('b', null, 'TOTAL · ' + ops.length + ' operaciones'));
    tr.appendChild(td);
    const medio = ops.reduce((s, o) => s + (o.ret || 0), 0) / ops.length;
    tr.appendChild(el('td', medio >= 0 ? 'up' : 'down', pc(medio)));
    const suma = conDinero.reduce((s, o) => s + o.pyl, 0);
    tr.appendChild(el('td', !conDinero.length ? null : suma >= 0 ? 'up' : 'down',
      !conDinero.length ? '—' : (suma >= 0 ? '+' : '−') + n(Math.abs(suma), 2) + ' $'));
    tr.appendChild(el('td'));
    t.appendChild(tr);
  }
  const w = el('div', 'tw'); w.appendChild(t); R.appendChild(w);

  const b = el('button', 'chip', 'Añadir una operación a mano');
  b.style.marginTop = '10px';
  let form = null;
  b.onclick = () => {
    if (form) { form.remove(); form = null; b.textContent = 'Añadir una operación a mano'; return }
    form = formularioOperacion(window.posiciones);
    R.appendChild(form); b.textContent = 'Ocultar el formulario';
  };
  R.appendChild(b);
  return R;
}

/* El panel va un dia por detras: su precio es el del ultimo cierre guardado, no el de ahora. Vender
   al precio que ensena la web seria anotar una cifra que no es la tuya, y el historial de operaciones
   es justo lo que mide si esto funciona. Asi que el precio se pide siempre, en blanco, y la fecha
   por defecto es la de HOY de verdad, no la del ultimo cierre guardado. */
function formularioVenta(r, alCerrar) {
  const d = el('div', 'blk'); d.style.marginTop = '10px';
  d.appendChild(el('div', 'blt', 'Vender ' + r.p.ticker));
  const campo = (etiqueta, tipo, valor) => {
    const i = tipo === 'number' ? campoNumero('0,00', valor) : document.createElement('input');
    if (tipo !== 'number') { i.type = tipo; if (valor != null) i.value = valor; }
    const w = el('div', 'campo'); w.appendChild(el('span', 'm', etiqueta)); w.appendChild(i);
    return { i, w };
  };
  const hoyReal = new Date().toISOString().slice(0, 10);
  const pr = campo('¿A qué precio has vendido?', 'number', null);
  const fe = campo('¿Qué día la vendiste?', 'date', hoyReal);
  const rej = el('div', 'formop'); rej.append(pr.w, fe.w);
  d.appendChild(rej);
  d.appendChild(el('p', 'nota', r.ahora != null
    ? 'De referencia, su último cierre guardado fue ' + n(r.ahora) + ' $ (del ' + fFecha(FH[0]) + '). Pon el precio real al que has vendido en tu bróker: el panel va un día por detrás y esa cifra casi nunca es la tuya.'
    : 'Pon el precio real al que has vendido en tu bróker.'));
  const ok = el('button', 'chip main', 'Confirmar la venta');
  ok.onclick = () => {
    const v = comoNumero(pr.i.value);
    if (!v || v <= 0) return alert('Pon el precio al que has vendido. No lo relleno yo con la cotización del panel porque va con un día de retraso.');
    if (!fe.i.value) return alert('Pon la fecha de la venta.');
    if (fe.i.value < r.p.fecha) return alert('La venta no puede ser anterior a la compra (' + fFecha(r.p.fecha) + ').');
    guardarPos(leerPos().map(p => (p.ticker === r.p.ticker && !p.cerrada
      ? { ...p, cerrada: fe.i.value, precioSalida: v } : p)));
    alCerrar();
  };
  const no = el('button', 'chip', 'Cancelar');
  no.onclick = alCerrar;
  const fila = el('div', 'row'); fila.append(ok, no);
  d.appendChild(fila);
  return d;
}

window.posiciones = async function () {
  const R = $('rpos'); R.replaceChildren();
  await cargaPrecios();   // el maximo alcanzado sale de la serie diaria, no de cuando abriste la app
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
    const vivos = revs.filter(r => r.ahora != null);
    const con = vivos.map(r => ({ r, d: dinero(r.p, r.ahora, r.stop) })).filter(x => x.d);
    const suma = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
    const st = el('div', 'stats');
    st.append(stat('posiciones abiertas', abiertas.length),
      stat('a vender', revs.filter(r => r.estado === 'vender').length));
    if (con.length === vivos.length && con.length) {
      /* Con el dinero de todas se puede dar la foto real. La media simple de porcentajes engaña
         cuando no has metido lo mismo en cada una: 1000 $ al +2 % y 100 $ al +40 % no es un +21 %. */
      const inv = suma(con, x => x.d.invertido), val = suma(con, x => x.d.valor), rie = suma(con, x => x.d.riesgo || 0);
      const c = window.CARTERA.leer() || {};
      st.append(stat('invertido', n(inv, 0) + ' $' + (c.total ? ' · ' + n(inv / c.total * 100, 0) + ' % de tu cartera' : '')),
        stat('vale ahora', n(val, 0) + ' $'),
        stat('ganancia', (val - inv >= 0 ? '+' : '−') + n(Math.abs(val - inv), 0) + ' $ · ' + pc((val / inv - 1) * 100)),
        stat('riesgo abierto', n(rie, 0) + ' $' + (c.total ? ' · ' + n(rie / c.total * 100, 1) + ' % de tu cartera' : '')));
    } else {
      const med = vivos.length ? suma(vivos, r => r.gan) / vivos.length : null;
      st.append(stat('resultado medio', med == null ? '—' : pc(med)));
      if (con.length) st.append(stat('sin nº de acciones', vivos.length - con.length + ' de ' + vivos.length));
    }
    st.append(stat('cerradas', cerradas.length));
    R.appendChild(st);
  }

  revs.sort((a, b) => ({ vender: 0, vigilar: 1, mantener: 2, sindatos: 3 })[a.estado] - ({ vender: 0, vigilar: 1, mantener: 2, sindatos: 3 })[b.estado]);
  revs.forEach(r => {
    // MANTENER verde, VIGILAR ambar, VENDER rojo: el mismo codigo que en el resto de la web
    const c = el('div', 'card v-' + ({ qok: 'ok', qwarn: 'warn', qbad: 'bad' }[r.cls] || 'warn')), top = el('div', 'top'), izq = el('div');
    const l = el('a', 'tk', r.p.ticker);
    l.href = 'https://www.tradingview.com/chart/?symbol=' + encodeURIComponent(r.p.simbolo); l.target = '_blank'; l.rel = 'noopener';
    izq.appendChild(l);
    izq.appendChild(el('div', 'name', 'comprada el ' + fFecha(r.p.fecha) + (r.dias ? ' · ' + r.dias + (r.dias === 1 ? ' día' : ' días') : '')));
    const der = el('div', 'px');
    const g = el('div', 'ganancia ' + (r.gan >= 0 ? 'up' : 'down'));
    g.textContent = r.ahora == null ? '—' : pc(r.gan);
    der.appendChild(g);
    const din = dinero(r.p, r.ahora, r.stop);
    if (din) der.appendChild(el('div', 'ganancia-eur ' + (din.pyl >= 0 ? 'up' : 'down'),
      (din.pyl >= 0 ? '+' : '−') + n(Math.abs(din.pyl), 2) + ' $'));
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
      const filas = [['Stop', (r.stop ? n(r.stop) + ' $ (' + pc((r.stop / r.ahora - 1) * 100, 0) + ')' : '—')],
       ['Llegó a ganar', pc(r.ganMax)],
       ['Ha devuelto', r.ganMax > 0 ? n(r.devuelto, 0) + ' %' + (r.limite ? ' de ' + r.limite + ' %' : '') : '—'],
       ['Requisitos', r.req.length ? r.req.filter(x => x.ok).length + '/' + r.req.length : '—']];
      if (din) filas.push(
        ['Acciones', n(din.acciones, din.acciones % 1 ? 2 : 0)],
        ['Invertido', n(din.invertido, 2) + ' $' + (din.pctCartera != null ? ' · ' + n(din.pctCartera, 1) + ' % de tu cartera' : '')],
        ['Valor ahora', n(din.valor, 2) + ' $'],
        ['Si salta el stop', din.riesgo == null ? '—' : 'pierdes ' + n(din.riesgo, 2) + ' $ desde aquí']);
      filas.forEach(([k, v]) => { const m = el('div', 'm', k); m.appendChild(el('span', null, v)); g.appendChild(m) });
      c.appendChild(g);
      /* Sin el numero de acciones no hay importes: se pide, no se deja el hueco en blanco. */
      if (!din) c.appendChild(el('div', 'm', 'Añade cuántas acciones tienes en «Editar compra» y te diré el dinero invertido, lo que vale ahora y cuánto arriesgas.'));
    }
    const acciones = el('div', 'row'); acciones.style.marginTop = '10px';
    const bv = el('button', 'chip', 'Marcar como vendida');
    let venta = null;
    bv.onclick = () => {
      if (venta) { venta.remove(); venta = null; bv.textContent = 'Marcar como vendida'; return }
      venta = formularioVenta(r, () => { venta = null; window.posiciones() });
      c.appendChild(venta); bv.textContent = 'Cancelar la venta';
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

  R.appendChild(historialOperaciones(cerradas));
  const mensual = beneficioMensual(cerradas);
  if (mensual) R.appendChild(mensual);
  R.appendChild(copiaSeguridad());
  R.appendChild(el('p', 'nota', 'Tus posiciones se guardan solo en este navegador: haz una copia si cambias de dispositivo.'));
};
