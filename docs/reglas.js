/* ÚNICA FUENTE DE LAS REGLAS DE COMPRA, STOP Y VENTA.
   Todo lo que decida "compra", "mantener" o "vender" tiene que salir de aquí: antes estaba repetido en
   app.js, posiciones.js y resultados.js con umbrales distintos, y las pestañas se contradecían.
   Funciones puras, sin DOM ni formato: así se pueden probar (tests/reglas.test.js). */
(function (raiz) {
  const R = {
    perdidaMaxima: 15,      // % máximo que se arriesga desde el precio de compra
    gananciaProteger: 20,   // % de ganancia a partir del cual el stop sube al precio de compra
    rsiVenta: 45,           // por debajo de aquí, se acabaron los compradores
    // Cuánto se le permite devolver de la ganancia máxima, según lo que haya llegado a ganar
    devolucion: [{ desde: 100, limite: 40 }, { desde: 30, limite: 50 }],
    avisoDevolucion: 0.6,   // fracción del límite a la que se avisa (VIGILAR)
    stopLejos: 15,          // % de distancia al stop a partir del cual una compra se considera arriesgada
    lejosDeMaximo: 10,      // % por debajo del máximo de 52 semanas que convierte una compra en "esperar"
  };
  const num = v => (typeof v === 'number' && isFinite(v) ? v : null);
  /* Comparación con holgura: (120/100-1)*100 da 19,999999999999996 y un ">= 20" dejaba fuera
     justo el caso límite. Con esto, el umbral se cumple cuando debe. */
  const alMenos = (valor, umbral) => valor >= umbral - 1e-9;

  /* Límite de devolución permitido para una ganancia máxima dada. null = manda solo el stop. */
  function limiteDevolucion(ganMax) {
    if (ganMax == null) return null;
    const t = R.devolucion.find(x => alMenos(ganMax, x.desde));
    return t ? t.limite : null;
  }

  /* Stop del día para una posición. Nunca baja: se compara con el más alto alcanzado (stopPrevio).
     Si no hay precio de compra (una acción que solo vigilas), se calcula sobre el precio actual. */
  function stopDe(datos, compra, stopPrevio) {
    const ema50 = num(datos && datos.ema50), precio = num(datos && datos.precio);
    const ref = num(compra) || precio;
    if (ref == null) return null;
    const gan = num(compra) && precio ? (precio / compra - 1) * 100 : 0;
    const suelo = ref * (1 - R.perdidaMaxima / 100);
    const base = alMenos(gan, R.gananciaProteger) ? Math.max(ema50 || 0, ref) : Math.max(ema50 || 0, suelo);
    return Math.max(base, num(stopPrevio) || 0) || null;
  }

  /* Máximo alcanzado desde la compra: lo registrado más los máximos que publica el mercado. */
  function maximoDesdeCompra(datos, compra, maxRegistrado, dias) {
    const precio = num(datos && datos.precio);
    const c = [num(maxRegistrado) || num(compra) || 0, precio || 0];
    if (datos && num(datos.max1m) && dias != null && dias <= 30) c.push(datos.max1m);
    if (datos && num(datos.max3m) && dias != null && dias <= 90) c.push(datos.max3m);
    return Math.max(...c) || null;
  }

  /* Evaluación completa de una posición abierta. requisitos: lista de window.REQUISITOS(datos). */
  function evaluaPosicion({ datos, compra, maxRegistrado, stopPrevio, dias, requisitos, diasResultados }) {
    const precio = num(datos && datos.precio);
    if (precio == null || compra == null) return { estado: 'sindatos', motivos: [], avisos: [] };
    const gan = (precio / compra - 1) * 100;
    const maxVisto = maximoDesdeCompra(datos, compra, maxRegistrado, dias);
    const ganMax = maxVisto ? (maxVisto / compra - 1) * 100 : gan;
    const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
    const stop = stopDe(datos, compra, stopPrevio);
    const limite = limiteDevolucion(ganMax);
    const ema50 = num(datos.ema50), ema21 = num(datos.ema21), rsi = num(datos.rsi);
    const fallos = (requisitos || []).filter(x => !x.ok && !x.entrada);
    const crecida = (requisitos || []).find(x => !x.ok && x.entrada && /apitalizaci/.test(x.t));

    const motivos = [], avisos = [];
    if (stop != null && precio < stop) motivos.push({ codigo: 'stop', stop, ema50 });
    else if (ema50 != null && precio < ema50) motivos.push({ codigo: 'ema50', ema50 });
    if (rsi != null && rsi < R.rsiVenta) motivos.push({ codigo: 'rsi', rsi });
    if (limite != null && alMenos(devuelto, limite)) motivos.push({ codigo: 'devuelto', devuelto, ganMax, gan, limite });
    if (fallos.length >= 2) motivos.push({ codigo: 'requisitos', fallos });

    if (crecida) avisos.push({ codigo: 'crecida' });
    if (diasResultados != null && diasResultados >= 0 && diasResultados <= 10) avisos.push({ codigo: 'resultados', dias: diasResultados });
    if (!motivos.length) {
      if (fallos.length === 1) avisos.push({ codigo: 'un-requisito', fallo: fallos[0] });
      if (limite != null && alMenos(devuelto, limite * R.avisoDevolucion)) avisos.push({ codigo: 'devolviendo', devuelto, limite });
      if (ema21 != null && precio < ema21) avisos.push({ codigo: 'ema21', ema21 });
    }
    return { estado: motivos.length ? 'vender' : avisos.length ? 'vigilar' : 'mantener',
      motivos, avisos, stop, gan, ganMax, devuelto, limite, maxVisto };
  }

  /* Señales de deterioro para una acción que NO tienes comprada (seguimiento y top).
     Mismas reglas de mercado, sin las que dependen de tu precio de entrada. */
  function senalesDeMercado(datos) {
    const precio = num(datos && datos.precio), ema21 = num(datos && datos.ema21), ema50 = num(datos && datos.ema50), rsi = num(datos && datos.rsi);
    const s = [];
    if (precio != null && ema50 != null && precio < ema50) s.push({ codigo: 'ema50', ema50 });
    else if (precio != null && ema21 != null && precio < ema21) s.push({ codigo: 'ema21', ema21 });
    if (rsi != null && rsi < R.rsiVenta) s.push({ codigo: 'rsi', rsi });
    const max1m = num(datos && datos.max1m);
    const caida = max1m && precio ? (precio / max1m - 1) * 100 : null;
    if (caida != null && caida <= -R.perdidaMaxima + 1e-9) s.push({ codigo: 'caida-mes', caida });
    return s;
  }

  /* Stop que se ofrece al comprar: el MISMO que gestionará la posición si entras hoy. */
  function stopDeEntrada(datos) {
    const precio = num(datos && datos.precio);
    const stop = stopDe(datos, precio, null);
    return stop == null || precio == null ? null : { stop, distancia: (stop / precio - 1) * 100, ema21: num(datos.ema21), ema50: num(datos.ema50) };
  }

  raiz.REGLAS = { R, alMenos, limiteDevolucion, stopDe, maximoDesdeCompra, evaluaPosicion, senalesDeMercado, stopDeEntrada };
})(typeof window !== 'undefined' ? window : globalThis);
