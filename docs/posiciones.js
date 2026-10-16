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

/* Comprar mas de la misma. Hasta el 16/10/2026 esto eran tres prompt() encadenados que recalculaban
   el precio medio y lo guardaban SIN DECIR que al hacerlo mueven el stop, el nivel del +20 % y la
   regla de devolucion, que se miden todos contra el precio medio. Ahora es formularioAnadir(), que
   ensena el stop de antes y el de despues antes de confirmar. La aritmetica es la misma, en
   window.NUEVO_PROMEDIO y probada aparte. */

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

/* ── Ventas parciales ────────────────────────────────────────────────────────
   Una venta parcial se guarda como una operacion CERRADA aparte (con parcial:true y el nº de
   acciones vendidas) y se le resta ese nº a la posicion abierta. Asi el historial, el beneficio
   mensual y la curva de la cuenta la cuentan solas, sin tocar nada de su codigo.

   EL PRECIO MEDIO DE COMPRA NO CAMBIA, y es lo que mas despista. Vender parte no abarata lo que
   te costaron las que te quedan: siguen costando lo mismo por accion. Lo que cambia es cuantas
   tienes, cuanto capital te queda dentro y cuanta ganancia has pasado a dinero real.
   Esto es importante para el sistema: el stop, la subida del stop al +20 % y la regla de devolucion
   se miden todas contra el precio de compra, asi que una venta parcial NO altera el protocolo. */
/* Cuantas acciones hay que vender para cobrar un importe dado. Funcion pura y expuesta para poder
   probarla: antes vivia dentro del manejador del campo y no habia forma de comprobar la aritmetica.
   Se topa en el total: pedir mas dinero del que vale la posicion vende la posicion entera, no mas. */
window.ACCIONES_POR_IMPORTE = function (importe, precio, total) {
  const c = Number(importe), v = Number(precio), t = Number(total);
  if (!isFinite(c) || !isFinite(v) || c <= 0 || v <= 0) return null;
  const nn = c / v;
  return isFinite(t) && t > 0 ? Math.min(nn, t) : nn;
};

/* Promedio ponderado al añadir a una posicion. Funcion pura y expuesta para poder probarla.
   AQUI SI CAMBIA EL PRECIO MEDIO, al contrario que en una venta parcial, y eso MUEVE EL PROTOCOLO:
   el stop (EMA 50 con tope del 15 % desde la compra), el nivel al que el stop sube a tu precio de
   compra (+20 %) y la regla de devolucion se miden todos contra el precio medio. Promediar al alza
   los sube; promediar a la baja los baja. Por eso el formulario ensena el stop de antes y de despues
   en vez de cambiarlo por la espalda. */
window.NUEVO_PROMEDIO = function (accA, precioA, accB, precioB) {
  const a = Number(accA), pa = Number(precioA), b = Number(accB), pb = Number(precioB);
  if (![a, pa, b, pb].every(x => isFinite(x)) || a < 0 || b <= 0 || pa <= 0 || pb <= 0) return null;
  const acciones = a + b;
  if (!(acciones > 0)) return null;
  const precio = (a * pa + b * pb) / acciones;
  return { acciones: Math.round(acciones * 1e6) / 1e6,
           precio: Math.round(precio * 1e6) / 1e6,
           invertido: Math.round((a * pa + b * pb) * 100) / 100 };
};

/* Nº de acciones: entero sin decimales, y hasta 4 cuando sale fraccionado (pasa al vender por
   importe: 400 $ a 16,30 $ son 24,5399 acciones). El numero que se ve es el que se guarda. */
const nAcc = v => v == null ? '-' : (Number(v) % 1 === 0 ? n(v, 0) : n(Math.round(v * 1e4) / 1e4, 4).replace(/0+$/, '').replace(/,$/, ''));

function partesVendidas(p) {
  const xs = leerPos().filter(x => x.parcial && x.cerrada && x.ticker === p.ticker && x.fecha === p.fecha);
  const acciones = xs.reduce((s, x) => s + (Number(x.acciones) || 0), 0);
  const cobrado = xs.reduce((s, x) => s + (Number(x.acciones) || 0) * (Number(x.precioSalida) || 0), 0);
  /* Con el precio medio DE ESA VENTA (x.precio), no con el actual: si despues promedias comprando
     mas, el precio medio sube y el beneficio de una venta ya hecha no puede recalcularse. Cada
     registro parcial guarda el suyo. */
  const pyl = xs.reduce((s, x) => s + (Number(x.acciones) || 0) * ((Number(x.precioSalida) || 0) - (Number(x.precio) || 0)), 0);
  return { n: xs.length, acciones, cobrado, pyl };
}

/* Agrupa las operaciones cerradas por POSICION (mismo ticker y misma fecha de compra). Una posicion
   de la que has vendido en dos veces es una sola operacion con dos salidas, no dos operaciones: si
   contara dos, el "acertadas X de Y" se infla y ese es el numero con el que juzgas la estrategia. */
function porPosicion(cerradas) {
  const g = new Map();
  cerradas.forEach(p => {
    const k = p.ticker + '|' + p.fecha;
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(p);
  });
  return [...g.values()];
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

/* Grafica de la curva de la cuenta: resultado acumulado tras cada operacion cerrada. Es la forma
   mas honesta de ver como vas, porque enseña el CAMINO y no solo el destino: dos historiales que
   acaban en +500 $ no son iguales si uno subio recto y el otro paso por -800 $ a mitad. */
function graficaCurva(cerradas) {
  const ops = cerradas.filter(p => p.cerrada && p.precioSalida && Number(p.acciones) > 0)
    .map(p => ({ f: p.cerrada, t: p.ticker, pyl: (p.precioSalida - p.precio) * Number(p.acciones) }))
    .sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  if (ops.length < 2) return null;   // con un solo punto no hay curva que enseñar

  let acc = 0;
  const puntos = [{ f: ops[0].f, v: 0, t: 'inicio' }];
  ops.forEach(o => { acc += o.pyl; puntos.push({ f: o.f, v: acc, t: o.t }); });
  const vs = puntos.map(p => p.v);
  const max = Math.max(...vs, 0), min = Math.min(...vs, 0);
  const rango = (max - min) || 1;
  const AN = 100, AL = 42, M = 3;                 // viewBox; el SVG escala al ancho disponible
  const x = i => M + i * (AN - 2 * M) / (puntos.length - 1);
  const y = v => M + (AL - 2 * M) - (v - min) / rango * (AL - 2 * M);

  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${AN} ${AL}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'curva');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Resultado acumulado: ' + puntos.map(p => Math.round(p.v) + ' $').join(', '));
  const sube = acc >= 0;
  const color = sube ? 'var(--up)' : 'var(--down)';
  const linea = puntos.map((p, i) => `${x(i).toFixed(2)},${y(p.v).toFixed(2)}`).join(' ');
  /* El relleno va hasta la linea del cero, no hasta el borde: asi se ve de un vistazo cuanto tiempo
     estuviste por debajo de donde empezaste. */
  const cero = y(0);
  svg.innerHTML =
    `<line x1="0" y1="${cero.toFixed(2)}" x2="${AN}" y2="${cero.toFixed(2)}" stroke="var(--line)" stroke-width="0.5" vector-effect="non-scaling-stroke"/>` +
    `<polygon points="${x(0).toFixed(2)},${cero.toFixed(2)} ${linea} ${x(puntos.length - 1).toFixed(2)},${cero.toFixed(2)}" fill="${color}" opacity="0.14"/>` +
    `<polyline points="${linea}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>` +
    puntos.slice(1).map((p, i) => `<circle cx="${x(i + 1).toFixed(2)}" cy="${y(p.v).toFixed(2)}" r="2.2" fill="${color}" vector-effect="non-scaling-stroke"/>`).join('');

  const d = el('div'); d.style.marginTop = '18px';
  d.appendChild(el('h2', 'blt', 'Cómo va tu cuenta'));
  d.appendChild(el('p', 'nota', 'Resultado acumulado después de cada operación cerrada. La línea gris es tu punto de partida.'));
  const caja = el('div', 'curvacaja'); caja.appendChild(svg); d.appendChild(caja);
  const pie = el('div', 'curvapie');
  const peor = Math.min(...vs);
  pie.append(
    el('span', null, puntos[0].f ? fFecha(puntos[0].f) : ''),
    el('span', 'm', ops.length + ' operaciones · peor momento ' + (peor >= 0 ? '+' : '−') + n(Math.abs(peor), 0) + ' $'),
    el('span', acc >= 0 ? 'up' : 'down', (acc >= 0 ? '+' : '−') + n(Math.abs(acc), 2) + ' $'));
  d.appendChild(pie);
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
  const d = el('div'); d.style.marginTop = '18px';
  d.appendChild(el('h2', 'blt', 'Beneficio y pérdida por mes'));
  d.appendChild(el('p', 'nota', 'Lo que ganaste o perdiste cada mes, contando las operaciones el día que las cerraste. El acumulado es tu curva: lo que llevas desde que empezaste.'));
  /* Sin operaciones cerradas la seccion se devolvia como null y no se dibujaba NADA, asi que no
     habia forma de saber que existe. La de arriba si se enseña vacia: aqui igual. */
  if (!porMes.size) {
    d.appendChild(el('div', 'empty', 'Aún no hay ningún mes cerrado. En cuanto vendas tu primera posición aparecerá aquí el resultado de ese mes, y debajo el acumulado de todos.'));
    return d;
  }
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
    const totalPyl = conDinero.reduce((s, o) => s + o.pyl, 0);
    const totalInv = conDinero.reduce((s, o) => s + o.invertido, 0);
    /* Una posicion vendida en dos veces es UNA operacion con dos salidas. Contarla como dos infla
       el "acertadas X de Y", que es justo el numero con el que se juzga la estrategia. Sin ventas
       parciales cada grupo tiene una sola salida y estas cifras son las de siempre. */
    const grupos = porPosicion(cerradas);
    const ganadoras = grupos.filter(g => {
      const inv = g.reduce((s, x) => s + (Number(x.acciones) || 1) * x.precio, 0);
      const sal = g.reduce((s, x) => s + (Number(x.acciones) || 1) * (x.precioSalida || 0), 0);
      return inv > 0 && sal > inv;
    }).length;
    const parciales = cerradas.filter(x => x.parcial).length;
    const st = el('div', 'stats');
    st.append(stat('operaciones', grupos.length + (parciales ? ' · ' + ops.length + ' salidas' : '')),
      stat('acertadas', ganadoras + ' de ' + grupos.length + ' · ' + Math.round(ganadoras / grupos.length * 100) + ' %'));
    if (conDinero.length) {
      st.append(stat('resultado total', (totalPyl >= 0 ? '+' : '−') + n(Math.abs(totalPyl), 2) + ' $', signo(totalPyl)),
        stat('sobre lo invertido', pc(totalInv ? totalPyl / totalInv * 100 : 0), signo(totalPyl)));
    } else {
      st.append(stat('resultado medio', pc(ops.reduce((s, o) => s + (o.ret || 0), 0) / ops.length), signo(ops.reduce((s, o) => s + (o.ret || 0), 0))));
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
    if (p.parcial) td0.appendChild(el('div', 'name', 'venta parcial'));
    if (p.manual) td0.appendChild(el('div', 'name', 'añadida a mano'));
    tr.appendChild(td0);
    [fFecha(p.fecha), fFecha(p.cerrada), o.dias == null ? '—' : String(o.dias),
     n(p.precio) + ' $', p.precioSalida ? n(p.precioSalida) + ' $' : '—',
     o.acc == null ? '—' : nAcc(o.acc)].forEach(x => tr.appendChild(el('td', null, x)));
    tr.appendChild(el('td', o.ret == null ? null : o.ret >= 0 ? 'up' : 'down', o.ret == null ? '—' : pc(o.ret)));
    tr.appendChild(el('td', o.pyl == null ? null : o.pyl >= 0 ? 'up' : 'down',
      o.pyl == null ? '—' : (o.pyl >= 0 ? '+' : '−') + n(Math.abs(o.pyl), 2) + ' $'));
    const tb = el('td'), bb = el('button', 'chip', 'Borrar');
    bb.onclick = () => {
      /* Al borrar una venta parcial hay que DEVOLVER las acciones a la posicion abierta. Si no, las
         acciones desaparecen: la posicion se quedaria con 60 cuando compraste 100, y eso es corromper
         tu registro en silencio justo cuando estas corrigiendo un error. */
      const abierta = p.parcial && Number(p.acciones) > 0
        ? leerPos().find(x => !x.cerrada && x.ticker === p.ticker && x.fecha === p.fecha) : null;
      const devuelve = abierta ? Number(p.acciones) : 0;
      if (!confirm('¿Borrar ' + (p.parcial ? 'la venta parcial' : 'la operación') + ' de ' + p.ticker +
          ' del ' + fFecha(p.cerrada) + '?' +
          (devuelve ? ' Las ' + nAcc(devuelve) + ' acciones vuelven a la posición abierta, que pasará a tener ' +
            nAcc((Number(abierta.acciones) || 0) + devuelve) + '.' : '') +
          ' No se puede deshacer.')) return;
      /* Dos ventas parciales del mismo ticker el mismo dia coinciden en ticker+fecha+cerrada y se
         borrarian las dos. Las parciales llevan id propio, asi que se borra por id cuando existe. */
      const resto = p.id ? leerPos().filter(x => x.id !== p.id)
        : leerPos().filter(x => !(x.ticker === p.ticker && x.cerrada === p.cerrada && x.fecha === p.fecha && !x.id));
      guardarPos(devuelve
        ? resto.map(x => (!x.cerrada && x.ticker === p.ticker && x.fecha === p.fecha
            ? { ...x, acciones: Math.round(((Number(x.acciones) || 0) + devuelve) * 1e6) / 1e6 } : x))
        : resto);
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
    const nGr = porPosicion(cerradas).length;
    const td = el('td'); td.setAttribute('colspan', '7');
    td.appendChild(el('b', null, 'TOTAL · ' + nGr + (nGr === 1 ? ' operación' : ' operaciones') +
      (ops.length !== nGr ? ' en ' + ops.length + ' salidas' : '')));
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
  const total = Number(r.p.acciones) > 0 ? Number(r.p.acciones) : null;
  const pr = campo('¿A qué precio has vendido?', 'number', null);
  const fe = campo('¿Qué día la vendiste?', 'date', hoyReal);
  const ac = campo(total ? '¿Cuántas acciones? (tienes ' + nAcc(total) + ')' : 'Nº de acciones', 'number', total);
  /* Vender por IMPORTE, no por acciones: "necesito 400 $" es como se piensa de verdad cuando lo que
     hace falta es liquidez. Los dos campos estan atados: escribes en uno y el otro se recalcula. */
  const im = campo('…o ¿cuánto quieres cobrar?', 'number', null);
  const rej = el('div', 'formop'); rej.append(pr.w, ac.w, im.w, fe.w);
  d.appendChild(rej);

  /* Las acciones a 4 decimales (pueden ser fraccionadas) y el dinero a 2: si no, al ir y volver
     entre los dos campos sale "6000,0026" en un campo que es euros. */
  const pon = (campoI, x, dec) => { campoI.value = x == null ? '' : String(Math.round(x * Math.pow(10, dec)) / Math.pow(10, dec)).replace('.', ','); };
  const ponAcc = (campoI, x) => pon(campoI, x, 4);
  const ponEur = (campoI, x) => pon(campoI, x, 2);
  /* Un campo actualiza al otro. Asignar .value por codigo no dispara 'input', asi que no hay bucle. */
  const deAccionesAImporte = () => {
    const v = comoNumero(pr.i.value), nn = comoNumero(ac.i.value);
    ponEur(im.i, v > 0 && nn > 0 ? nn * v : null);
  };
  const deImporteAAcciones = () => {
    ponAcc(ac.i, window.ACCIONES_POR_IMPORTE(comoNumero(im.i.value), comoNumero(pr.i.value), total));
  };

  /* Atajos: lo normal al necesitar liquidez es soltar la mitad o un tercio, no una cifra exacta. */
  if (total) {
    const fr = el('div', 'row'); fr.style.marginTop = '2px';
    fr.appendChild(el('span', 'm', 'Vender'));
    [['la mitad', 2], ['un tercio', 3], ['dos tercios', 1.5], ['todo', 1]].forEach(([t, div]) => {
      const b = el('button', 'chip', t);
      b.onclick = () => { ponAcc(ac.i, total / div); deAccionesAImporte(); pinta(); };
      fr.appendChild(b);
    });
    /* El caso mas natural con una que sube mucho: sacar el capital que pusiste y dejar corriendo
       solo la ganancia. A partir de ahi la posicion no puede devolverte menos de lo que invertiste. */
    const recup = el('button', 'chip', 'recuperar lo invertido');
    recup.onclick = () => {
      const v = comoNumero(pr.i.value);
      if (!(v > 0)) return alert('Pon primero el precio al que has vendido: hace falta para saber cuántas acciones son.');
      const inv = total * r.p.precio;
      if (v * total <= inv) return alert('A ' + n(v) + ' $ la posición entera vale ' + n(v * total, 2) + ' $ y pusiste ' + n(inv, 2) + ' $: no hay ganancia que dejar corriendo. Tendrías que vender todo y aun así no recuperarías lo invertido.');
      ponAcc(ac.i, window.ACCIONES_POR_IMPORTE(inv, v, total)); deAccionesAImporte(); pinta();
    };
    fr.appendChild(recup);
    d.appendChild(fr);
  }

  /* Previsualizacion en vivo: lo que de verdad hace falta saber antes de confirmar. */
  const vista = el('div', 'previo');
  const pinta = () => {
    vista.replaceChildren();
    const v = comoNumero(pr.i.value), nn = comoNumero(ac.i.value);
    if (!total) {
      vista.appendChild(el('div', 'm', 'Esta posición no tiene nº de acciones anotado. Añádelo con «Corregir la compra» y podrás vender solo una parte.'));
      return;
    }
    if (!(v > 0) || !(nn > 0)) { vista.appendChild(el('div', 'm', 'Pon el precio y el nº de acciones para ver cómo te quedaría.')); return; }
    const vende = Math.min(nn, total), queda = Math.max(0, total - vende);
    const cobras = vende * v, pylV = (v - r.p.precio) * vende;
    const fila = (et, val, cls) => { const f = el('div', 'pf'); f.appendChild(el('span', 'et', et)); f.appendChild(el('span', 'vl' + (cls ? ' ' + cls : ''), val)); vista.appendChild(f); };
    if (queda === 0) {
      fila('Vendes', nAcc(vende) + ' acciones · TODA la posición');
      fila('Cobras', n(cobras, 2) + ' $');
      fila('Resultado', (pylV >= 0 ? '+' : '−') + n(Math.abs(pylV), 2) + ' $ · ' + pc((v / r.p.precio - 1) * 100), pylV >= 0 ? 'up' : 'down');
      vista.appendChild(el('div', 'm', 'La posición se cierra y pasa a tu historial.'));
    } else {
      const previas = partesVendidas(r.p);
      fila('Vendes ahora', nAcc(vende) + ' de ' + nAcc(total) + ' acciones · ' + n(vende / total * 100, 0) + ' %');
      fila('Cobras', n(cobras, 2) + ' $');
      fila('Ganancia que realizas', (pylV >= 0 ? '+' : '−') + n(Math.abs(pylV), 2) + ' $', pylV >= 0 ? 'up' : 'down');
      fila('Te quedan', nAcc(queda) + ' acciones');
      fila('Precio medio de compra', n(r.p.precio) + ' $ · NO cambia');
      fila('Capital que sigue dentro', n(queda * r.p.precio, 2) + ' $');
      if (r.ahora != null) fila('Valor de lo que te queda', n(queda * r.ahora, 2) + ' $', null);
      if (previas.acciones > 0) fila('Ya habías vendido', nAcc(previas.acciones) + ' acciones · realizado ' + (previas.pyl >= 0 ? '+' : '−') + n(Math.abs(previas.pyl), 2) + ' $', previas.pyl >= 0 ? 'up' : 'down');
      vista.appendChild(el('div', 'm', 'El precio medio no cambia: vender parte no abarata las que te quedan, siguen costando ' + n(r.p.precio) + ' $ cada una. Y el protocolo sigue igual, porque el stop y la regla de devolución se miden contra ese precio de compra.'));
    }
  };
  ac.i.addEventListener('input', () => { deAccionesAImporte(); pinta(); });
  im.i.addEventListener('input', () => { deImporteAAcciones(); pinta(); });
  pr.i.addEventListener('input', () => { deAccionesAImporte(); pinta(); });
  d.appendChild(vista);
  pinta();

  d.appendChild(el('p', 'nota', r.ahora != null
    ? 'De referencia, su último cierre guardado fue ' + n(r.ahora) + ' $ (del ' + fFecha(FH[0]) + '). Pon el precio real al que has vendido en tu bróker: el panel va un día por detrás y esa cifra casi nunca es la tuya.'
    : 'Pon el precio real al que has vendido en tu bróker.'));
  const ok = el('button', 'chip main', 'Confirmar la venta');
  ok.onclick = () => {
    const v = comoNumero(pr.i.value);
    if (!v || v <= 0) return alert('Pon el precio al que has vendido. No lo relleno yo con la cotización del panel porque va con un día de retraso.');
    if (!fe.i.value) return alert('Pon la fecha de la venta.');
    if (fe.i.value < r.p.fecha) return alert('La venta no puede ser anterior a la compra (' + fFecha(r.p.fecha) + ').');
    const nn = comoNumero(ac.i.value);
    const parcial = total && nn > 0 && nn < total;
    if (total && !(nn > 0)) return alert('Pon cuántas acciones vendes. Si vendes todas, pulsa «todo».');
    if (total && nn > total) return alert('No puedes vender ' + nAcc(nn) + ' acciones: solo tienes ' + nAcc(total) + '.');
    if (parcial && !confirm('Vas a vender ' + nAcc(nn) + ' de ' + nAcc(total) +
        ' acciones de ' + r.p.ticker + ' a ' + n(v) + ' $. La posición sigue abierta con ' +
        nAcc(total - nn) + ' acciones. ¿Confirmas?')) return;
    if (!parcial) {
      guardarPos(leerPos().map(p => (p.ticker === r.p.ticker && !p.cerrada
        ? { ...p, cerrada: fe.i.value, precioSalida: v } : p)));
    } else {
      /* La venta parcial no toca el precio de compra, ni maxVisto, ni stopMax: el protocolo continua
         exactamente igual sobre las acciones que quedan. Solo baja el nº de acciones. */
      const lista = leerPos().map(p => (p.ticker === r.p.ticker && !p.cerrada
        ? { ...p, acciones: Math.round((total - nn) * 1e6) / 1e6 } : p));
      lista.push({ ...r.p, id: 'p' + Date.now() + Math.random().toString(36).slice(2, 7),
        acciones: nn, cerrada: fe.i.value, precioSalida: v, parcial: true,
        maxVisto: undefined, stopMax: undefined });
      guardarPos(lista);
    }
    alCerrar();
  };
  const no = el('button', 'chip', 'Cancelar');
  no.onclick = alCerrar;
  const fila = el('div', 'row'); fila.append(ok, no);
  d.appendChild(fila);
  return d;
}

/* Añadir a una posicion (promediar). A diferencia de la venta parcial, ESTO CAMBIA EL PRECIO MEDIO
   y por tanto mueve el stop, el nivel del +20 % y la regla de devolucion. El formulario ensena las
   dos versiones, antes y despues, porque cambiar el stop de alguien sin decirlo es inaceptable. */
function formularioAnadir(r, alCerrar) {
  const d = el('div', 'blk'); d.style.marginTop = '10px';
  d.appendChild(el('div', 'blt', 'Añadir a tu posición de ' + r.p.ticker));
  const campo = (etiqueta, tipo, valor) => {
    const i = tipo === 'number' ? campoNumero('0,00', valor) : document.createElement('input');
    if (tipo !== 'number') { i.type = tipo; if (valor != null) i.value = valor; }
    const w = el('div', 'campo'); w.appendChild(el('span', 'm', etiqueta)); w.appendChild(i);
    return { i, w };
  };
  const hoyReal = new Date().toISOString().slice(0, 10);
  const tiene = Number(r.p.acciones) > 0 ? Number(r.p.acciones) : null;
  const pr = campo('¿A qué precio has comprado?', 'number', r.ahora != null ? r.ahora : null);
  const ac = campo('¿Cuántas acciones añades?', 'number', null);
  const im = campo('…o ¿cuánto has invertido?', 'number', null);
  const fe = campo('¿Qué día compraste?', 'date', hoyReal);
  const rej = el('div', 'formop'); rej.append(pr.w, ac.w, im.w, fe.w);
  d.appendChild(rej);

  // acciones a 4 decimales, dinero a 2: si no, al ir y volver entre los campos sale "6000,0026"
  const ponN = (c, x, d) => { c.value = x == null ? '' : String(Math.round(x * Math.pow(10, d)) / Math.pow(10, d)).replace('.', ','); };
  const pon = (c, x) => ponN(c, x, 4);
  const ponEur = (c, x) => ponN(c, x, 2);
  ac.i.addEventListener('input', () => {
    const v = comoNumero(pr.i.value), nn = comoNumero(ac.i.value);
    ponEur(im.i, v > 0 && nn > 0 ? nn * v : null); pinta();
  });
  im.i.addEventListener('input', () => {
    pon(ac.i, window.ACCIONES_POR_IMPORTE(comoNumero(im.i.value), comoNumero(pr.i.value), null)); pinta();
  });
  pr.i.addEventListener('input', () => {
    const v = comoNumero(pr.i.value), nn = comoNumero(ac.i.value);
    ponEur(im.i, v > 0 && nn > 0 ? nn * v : null); pinta();
  });

  const vista = el('div', 'previo');
  const pinta = () => {
    vista.replaceChildren();
    if (!tiene) {
      vista.appendChild(el('div', 'm', 'Esta posición no tiene nº de acciones anotado. Añádelo con «Corregir la compra»: sin saber cuántas tienes no se puede calcular el precio medio.'));
      return;
    }
    const v = comoNumero(pr.i.value), nn = comoNumero(ac.i.value);
    const np = window.NUEVO_PROMEDIO(tiene, r.p.precio, nn, v);
    if (!np) { vista.appendChild(el('div', 'm', 'Pon el precio y las acciones (o el importe) para ver cómo te quedaría.')); return; }
    const fila = (et, val, cls) => { const f = el('div', 'pf'); f.appendChild(el('span', 'et', et)); f.appendChild(el('span', 'vl' + (cls ? ' ' + cls : ''), val)); vista.appendChild(f); };
    const sube = np.precio > r.p.precio;
    fila('Añades', nAcc(nn) + ' acciones a ' + n(v) + ' $ · ' + n(nn * v, 2) + ' $');
    fila('Pasas a tener', nAcc(np.acciones) + ' acciones');
    fila('Precio medio', n(r.p.precio) + ' $ → ' + n(np.precio) + ' $',  sube ? 'down' : 'up');
    fila('Capital invertido', n(tiene * r.p.precio, 2) + ' $ → ' + n(np.invertido, 2) + ' $');
    if (r.ahora != null) {
      fila('Valor a precio de hoy', n(np.acciones * r.ahora, 2) + ' $');
      const ganN = (r.ahora / np.precio - 1) * 100;
      fila('Ganancia', pc(r.gan) + ' → ' + pc(ganN), ganN >= 0 ? 'up' : 'down');
    }
    /* El dato que de verdad hay que ver: como queda el stop. Se recalcula con las MISMAS reglas. */
    const antes = window.REGLAS.stopDe(r.a || { precio: r.ahora }, r.p.precio, r.p.stopMax);
    const desp = window.REGLAS.stopDe(r.a || { precio: r.ahora }, np.precio, r.p.stopMax);
    if (antes != null && desp != null) {
      fila('Tu stop', n(antes) + ' $ → ' + n(desp) + ' $' + (Math.abs(desp - antes) < 0.005 ? ' (igual)' : desp > antes ? ' (sube)' : ' (baja)'),
        Math.abs(desp - antes) < 0.005 ? null : desp > antes ? 'down' : null);
      if (r.ahora != null) fila('Riesgo abierto', n(Math.max(0, (r.ahora - antes) * tiene), 2) + ' $ → ' + n(Math.max(0, (r.ahora - desp) * np.acciones), 2) + ' $', 'down');
    }
    /* La regla de devolucion se mide contra el precio medio: si el medio sube, la ganancia maxima
       medida se encoge, y por debajo del +30 % la regla DEJA DE APLICARSE. Eso es perder una
       proteccion sin enterarse, asi que se dice con los numeros delante. */
    const mv = Number(r.p.maxVisto) || Number(r.maxVisto) || null;
    if (mv) {
      const lA = window.REGLAS.limiteDevolucion((mv / r.p.precio - 1) * 100);
      const lB = window.REGLAS.limiteDevolucion((mv / np.precio - 1) * 100);
      if (lA !== lB) fila('Regla de devolución',
        (lA == null ? 'no aplica' : 'vender al devolver el ' + lA + ' %') + ' → ' +
        (lB == null ? 'DEJA DE APLICAR' : 'vender al devolver el ' + lB + ' %'), lB == null ? 'down' : null);
    }
    if (sube) vista.appendChild(el('div', 'm', 'Promediar al alza SUBE tu precio medio, y con él el stop y el nivel del +20 %. Tu ganancia en % baja aunque no hayas perdido nada: es la misma acción sobre un coste mayor. Y ojo con la regla de devolución: se mide contra el precio medio, así que subirlo encoge la ganancia máxima medida y por debajo del +30 % la regla deja de aplicarse, con lo que te quedas solo con el stop. Revisa las dos líneas de arriba antes de confirmar.'));
    else vista.appendChild(el('div', 'm', 'Estás promediando A LA BAJA: añadir a una que ha caído. Este panel busca fuerza, no rebajas, y bajar el precio medio también BAJA tu stop, así que aguantas más caída antes de salir. Si la acción está en VIGILAR o VENDER, lo que dice el sistema es lo contrario de añadir.'));
    const vend = partesVendidas(r.p);
    if (vend.acciones > 0) vista.appendChild(el('div', 'm', 'Ojo: ya vendiste ' + nAcc(vend.acciones) + ' acciones de esta posición. Esa venta mantiene su propio resultado (' + (vend.pyl >= 0 ? '+' : '−') + n(Math.abs(vend.pyl), 2) + ' $) y no se recalcula con el nuevo precio medio.'));
  };
  d.appendChild(vista); pinta();

  const ok = el('button', 'chip main', 'Confirmar la compra');
  ok.onclick = () => {
    const v = comoNumero(pr.i.value), nn = comoNumero(ac.i.value);
    if (!tiene) return alert('Primero anota cuántas acciones tienes, con «Corregir la compra».');
    if (!(v > 0)) return alert('Pon el precio al que has comprado.');
    if (!(nn > 0)) return alert('Pon cuántas acciones añades, o el importe invertido.');
    if (!fe.i.value) return alert('Pon la fecha de la compra.');
    const np = window.NUEVO_PROMEDIO(tiene, r.p.precio, nn, v);
    if (!np) return alert('No he podido calcular el precio medio con esos datos.');
    if (!confirm('Añades ' + nAcc(nn) + ' acciones a ' + n(v) + ' $.\n\n' +
        'Pasas de ' + nAcc(tiene) + ' a ' + nAcc(np.acciones) + ' acciones.\n' +
        'Tu precio medio pasa de ' + n(r.p.precio) + ' $ a ' + n(np.precio) + ' $.\n\n' +
        'Eso mueve tu stop y la cuenta de la devolución, porque se miden contra el precio medio. ¿Confirmas?')) return;
    guardarPos(leerPos().map(p => {
      if (!(p.ticker === r.p.ticker && !p.cerrada)) return p;
      /* Se guarda el desglose de compras para que el precio medio sea auditable y no un numero
         que aparecio sin mas. La fecha de la posicion NO cambia: sigue siendo cuando la abriste. */
      const compras = (p.compras && p.compras.length ? p.compras
        : [{ fecha: p.fecha, precio: p.precio, acciones: tiene }]).concat([{ fecha: fe.i.value, precio: v, acciones: nn }]);
      return { ...p, precio: np.precio, acciones: np.acciones, compras };
    }));
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
      stat('a vender', revs.filter(r => r.estado === 'vender').length, revs.some(r => r.estado === 'vender') ? 'down' : null));
    if (con.length === vivos.length && con.length) {
      /* Con el dinero de todas se puede dar la foto real. La media simple de porcentajes engaña
         cuando no has metido lo mismo en cada una: 1000 $ al +2 % y 100 $ al +40 % no es un +21 %. */
      const inv = suma(con, x => x.d.invertido), val = suma(con, x => x.d.valor), rie = suma(con, x => x.d.riesgo || 0);
      const c = window.CARTERA.leer() || {};
      st.append(stat('invertido', n(inv, 0) + ' $' + (c.total ? ' · ' + n(inv / c.total * 100, 0) + ' % de tu cartera' : '')),
        stat('vale ahora', n(val, 0) + ' $', signo(val - inv)),
        stat('ganancia', (val - inv >= 0 ? '+' : '−') + n(Math.abs(val - inv), 0) + ' $ · ' + pc((val / inv - 1) * 100), signo(val - inv)),
        stat('riesgo abierto', n(rie, 0) + ' $' + (c.total ? ' · ' + n(rie / c.total * 100, 1) + ' % de tu cartera' : ''), 'warn'));
    } else {
      const med = vivos.length ? suma(vivos, r => r.gan) / vivos.length : null;
      st.append(stat('resultado medio', med == null ? '—' : pc(med), signo(med)));
      if (con.length) st.append(stat('sin nº de acciones', vivos.length - con.length + ' de ' + vivos.length, 'warn'));
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
    /* Si ya has soltado parte, hay que verlo aqui: el % de ganancia de la tarjeta es solo de lo que
       te queda, y sin esta linea parece que la operacion va peor de lo que va. */
    /* Si has promediado, el precio medio es un numero calculado: hay que poder ver de donde sale. */
    if (r.p.compras && r.p.compras.length > 1) {
      izq.appendChild(el('div', 'name', 'precio medio de ' + r.p.compras.length + ' compras: ' +
        r.p.compras.map(x => nAcc(x.acciones) + ' a ' + n(x.precio) + ' $').join(' + ')));
    }
    const vend = partesVendidas(r.p);
    if (vend.acciones > 0) {
      const tot = vend.acciones + (Number(r.p.acciones) || 0);
      izq.appendChild(el('div', 'name', 'ya vendiste ' + nAcc(vend.acciones) + ' de ' +
        nAcc(tot) + ' acciones en ' + vend.n + (vend.n === 1 ? ' venta' : ' ventas') +
        ' · realizado ' + (vend.pyl >= 0 ? '+' : '−') + n(Math.abs(vend.pyl), 2) + ' $'));
    }
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
    if (r.stop) {
      /* Con la posicion ya abierta, saber si el stop esta dentro del ruido diario cambia lo que haces:
         un stop a menos de un dia de rango salta por nada, no porque la tendencia se haya roto. Tiñe
         la caja en ambar, igual que en la pestaña Hoy: un stop poco fiable tiene que parecerlo. */
      const mg = window.MARGEN_STOP((r.stop / r.ahora - 1) * 100, (r.a || {}).adr);
      const sb = el('div', 'stopbox' + (mg && mg.apretado ? ' lejos' : ''));
      sb.appendChild(el('span', 'et', 'Stop'));
      sb.appendChild(el('span', 'vl', n(r.stop) + ' $'));
      sb.appendChild(el('span', 'ds', pc((r.stop / r.ahora - 1) * 100, 0) + ' desde el precio actual'));
      if (mg) sb.appendChild(el('span', 'ds' + (mg.apretado ? ' aviso' : ''),
        '· margen de ' + n(mg.dias, 1) + ' días de rango' + (mg.apretado ? ': un día normal lo cruza' : '')));
      if (r.gan >= window.REGLAS.R.gananciaProteger) sb.appendChild(el('span', 'ds', '· ya protege tu compra'));
      c.appendChild(sb); }
    if (r.ahora != null) {
      const g = el('div', 'grid');
      /* El stop ya se ve grande justo encima, en su caja. Aqui van los cuatro numeros que miras
         para decidir; los demas bajan al desplegable para que la tarjeta quepa en pantalla. */
      const filas = [];
      if (din) filas.push(
        ['Invertido', n(din.invertido, 2) + ' $' + (din.pctCartera != null ? ' · ' + n(din.pctCartera, 1) + ' %' : '')],
        ['Valor ahora', n(din.valor, 2) + ' $'],
        /* "Si salta el stop: −1.024,84 $" se lee como una perdida, y con el stop por encima del
           precio de compra saltar el stop es GANAR. Se dice con cuanto te quedas, y entre
           parentesis lo que devuelves desde el valor de ahora, que es lo que esa cifra media. */
        ['Si salta el stop', din.riesgo == null || r.stop == null ? '—'
          : ((x) => (x >= 0 ? '+' : '−') + n(Math.abs(x), 2) + ' $' + (din.riesgo > 0 ? ' (−' + n(din.riesgo, 2) + ' desde ahora)' : ''))
            ((r.stop - r.p.precio) * din.acciones)]);
      filas.push(['Ha devuelto', r.ganMax > 0 ? n(r.devuelto, 0) + ' %' + (r.limite ? ' de ' + r.limite + ' %' : '') : '—']);
      const detalle = [['Llegó a ganar', pc(r.ganMax)],
        ['Requisitos', r.req.length ? r.req.filter(x => x.ok).length + '/' + r.req.length : '—']];
      if (din) detalle.push(['Acciones', nAcc(din.acciones)]);
      filas.forEach(([k, v]) => { const m = el('div', 'm', k); m.appendChild(el('span', null, v)); g.appendChild(m) });
      c.appendChild(g);
      const verMas = el('button', 'chip', 'Ver detalle'); verMas.style.marginTop = '8px';
      let abiertoD = null;
      verMas.onclick = () => {
        if (abiertoD) { abiertoD.remove(); abiertoD = null; verMas.textContent = 'Ver detalle'; return }
        abiertoD = el('div', 'grid');
        detalle.forEach(([k, v]) => { const m = el('div', 'm', k); m.appendChild(el('span', null, v)); abiertoD.appendChild(m) });
        c.insertBefore(abiertoD, verMas.nextSibling); verMas.textContent = 'Ocultar detalle';
      };
      c.appendChild(verMas);
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
    let anade = null;
    ba.onclick = () => {
      if (anade) { anade.remove(); anade = null; ba.textContent = 'He comprado más'; return }
      anade = formularioAnadir(r, () => { anade = null; window.posiciones() });
      c.appendChild(anade); ba.textContent = 'Cancelar la compra';
    };
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
  R.appendChild(beneficioMensual(cerradas));
  const curva = graficaCurva(cerradas);
  if (curva) R.appendChild(curva);
  R.appendChild(copiaSeguridad());
  R.appendChild(el('p', 'nota', 'Tus posiciones se guardan solo en este navegador: haz una copia si cambias de dispositivo.'));
};
