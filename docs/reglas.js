/* ÚNICA FUENTE DE LAS REGLAS DE COMPRA, STOP Y VENTA.
   Todo lo que decida "compra", "mantener" o "vender" tiene que salir de aquí: antes estaba repetido en
   app.js, posiciones.js y resultados.js con umbrales distintos, y las pestañas se contradecían.
   Funciones puras, sin DOM ni formato: así se pueden probar (tests/reglas.test.js). */
(function (raiz) {
  const R = {
    perdidaMaxima: 15,      // % máximo que se arriesga desde el precio de compra
    gananciaProteger: 20,   // % de ganancia a partir del cual el stop sube al precio de compra
    rsiVenta: 45,           // por debajo de aquí, se acabaron los compradores
    /* Cuanto se le permite devolver de la ganancia maxima, segun lo que haya llegado a ganar.
       ESCALON DE +20 % AÑADIDO EL 05/11/2026. Motivo medido, y no es un ajuste al pasado:

       En 42 entradas el sistema habia cerrado 15 operaciones, LAS 15 EN PERDIDA, y cero por
       devolucion. Nunca habia realizado una ganancia. La causa: el primer escalon estaba en +30 %
       y solo 1 de 39 entradas (3 %) llega ahi. El pico mediano es +5,5 %. Era una regla de beneficio
       calibrada para ganancias que este sistema casi nunca produce.

       Por que +20 % y no +10 % o +15 %, que "mejoraban" mas la media: porque por debajo de ahi la
       regla salta con el RUIDO. Estas acciones se mueven un 4,6 % al dia (ADR mediano), asi que dos
       dias de movimiento normal son 9,3 puntos. Devolver el 50 % de un pico del +20 % son 10 puntos:
       2,2 dias de rango, justo por encima del ruido. Con el pico en +15 % serian 7,5 puntos (1,6
       dias) y con +10 %, 5 puntos (1,1 dias): saltaria sola sin que nada se hubiera roto. Es la
       misma vara con la que el panel juzga si un stop es un nivel o una moneda al aire.

       Y las que "mejoraban" mas la media lo hacian por DOS acciones (IOVA y TEAM): descontandolas,
       ninguna mejoraba. Esta no se elige por el resultado, se elige porque es el escalon mas bajo
       que no es ruido y porque cierra el hueco que habia entre la proteccion del coste (+20 %) y la
       primera proteccion de beneficio (+30 %).
       Efecto medido: CAI pasa de seguir abierta devolviendo 9,8 puntos a cerrarse en +8,1 %, la
       primera ganancia realizada del sistema. No toca a FIGS (+46,5 %), CDNA ni HNGE. */
    devolucion: [{ desde: 100, limite: 40 }, { desde: 30, limite: 50 }, { desde: 20, limite: 50 }],
    avisoDevolucion: 0.6,   // fracción del límite a la que se avisa (VIGILAR)
    /* TRAILING DE BENEFICIO, en dias de rango de la propia accion. Añadido el 05/11/2026.

       Resuelve el tramo del que se quejaba Borja: entre que la ganancia deja de ser ruido y el
       primer escalon de devolucion (+20 %) no habia NADA, asi que una posicion al +15 % podia
       volver a cero sin que el sistema dijera una palabra.

       En vez de un porcentaje fijo del pico, se mide en DIAS DE RANGO (ADR) de esa accion, que es
       la vara que usa el resto del panel: por debajo de dos dias cualquier nivel es ruido. Con eso
       el umbral se adapta solo: en una accion que se mueve un 4,6 % al dia empieza a proteger desde
       el +10 %, y en una tranquila de ADR 1,5 desde el +3,2 %.

       SOLO SE APLICA SI EL NIVEL QUEDA POR ENCIMA DE TU PRECIO DE COMPRA. Sin esa condicion el
       "trailing de beneficio" seria un trailing de perdida: con un pico del +5 % y dos dias de
       rango de 9 puntos, el nivel caeria a -4 % y te sacaria en rojo. Fue el error de mi primera
       medicion, que dio cero ganancias realizadas y casi me hace descartar la idea entera.

       Medido sobre las 42 entradas: NO CAMBIA NI UN NUMERO del historico (misma media, misma
       mediana, mismas cerradas, mismo peor caso). Eso es lo que lo hace seguro: no puede estar
       ajustado al pasado porque en el pasado no se ha disparado ni una vez. Cierra un agujero
       estructural sin tocar nada de lo medido. */
    /* Por que 2 y no 3 o 4: porque "2 dias de rango" ES el estandar del panel para que un nivel
       no sea ruido (MARGEN_STOP marca "apretado" por debajo de 2). Y por el trinquete, este
       trailing equivale exactamente a "2 dias por debajo del precio, sin bajar nunca": en el
       momento en que se fija esta justo en el estandar.
       Dudé al ver que hoy deja 5 de 31 posiciones con el stop a menos de UN dia de margen (SLDE a
       0,2 dias, CAI a 0,6). Pero eso no es que vayan a saltar al azar: es que ya han devuelto casi
       toda su subida. CAI llego al +21,7 % y esta en +11,9 %. Estar a un dia de la salida ahi es
       exactamente lo que se busca, que es no devolver el resto.
       Con K=3 o K=4 el historico sale IDENTICO (no se puede elegir por resultado), pero la
       proteccion empezaria en el +16 % o el +22 % en vez de en el +10 %, que es justo el tramo que
       Borja pidio cubrir. */
    diasTrailing: 2,
    lejosDeMaximo: 10,      // % por debajo del máximo de 52 semanas que convierte una compra en "esperar"
    /* Tope de concentracion: % maximo de la cartera en una sola posicion. Era 25 hasta el
       30/10/2026. El cambio no es una opinion sobre rentabilidad, es sobre la COLA: el tamaño se
       calcula como riesgo / distancia al stop, asi que un stop MUY PEGADO produce la posicion MAS
       GRANDE justo donde la salida es mas aleatoria. El 30/10/2026, de 32 seguidas con stop valido,
       11 tenian el stop a menos de 2 dias de rango y 3 de esas llegaban al tope del 25 %, con el
       stop a 0,3-1,3 dias de rango.
       El numero sale de la cola, no del centro: sobre 512 movimientos diarios de las seguidas el
       peor fue -35,4 % (IOVA el 29/10/2026, por noticia, con resultados todavia a 7 dias) y un
       0,59 % de los dias cayeron mas del 15 %. Con un tope del 12 % un hueco asi cuesta -4,25 % de
       la cartera; con el 25 % costaba -8,85 %, varios meses de la ganancia acumulada de golpe. El
       stop NO protege de un hueco: abre por debajo y ya esta.
       Se ancla en el peor dia observado y NO en el p1 (-12,6 %) a proposito: para una pregunta de
       riesgo de cola el p1 es el percentil equivocado, error que ya se cometio el 24/10/2026 con el
       p5 y hubo que retirar. Aviso honesto: la cola esta estimada sobre UN solo caso, asi que 12 es
       un juicio anclado en la unica cola que hemos visto, no una calibracion. */
    topePosicion: 12,
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
  /* ganMax: la ganancia MAXIMA alcanzada, no la de hoy. La tabla 5 promete "SUPERADO el 20 % de
     ganancia, el stop sube a tu precio de compra", y superado significa una vez, para siempre. El
     codigo miraba la ganancia de HOY, asi que una posicion que llego a +25 % y cayo a +10 % perdia
     la proteccion del coste, y solo se salvaba si stopPrevio la habia capturado: es decir, si la app
     estuvo abierta justo aquel dia. Eso ata una regla del sistema a un habito del usuario.
     Con ganMax la regla se cumple aunque no abras la app en una semana o falle un build, que es lo
     que paso el 21/10/2026. Encontrado al revisar el hueco de ese dia; estaba latente, no activo. */
  function stopDe(datos, compra, stopPrevio, ganMax) {
    const ema50 = num(datos && datos.ema50), precio = num(datos && datos.precio);
    const ref = num(compra) || precio;
    if (ref == null) return null;
    const gan = num(compra) && precio ? (precio / compra - 1) * 100 : 0;
    const pico = num(ganMax) != null ? Math.max(num(ganMax), gan) : gan;
    const suelo = ref * (1 - R.perdidaMaxima / 100);
    let base = alMenos(pico, R.gananciaProteger) ? Math.max(ema50 || 0, ref) : Math.max(ema50 || 0, suelo);
    /* Trailing de beneficio: K dias de rango por debajo del maximo alcanzado, y solo si ese nivel
       asegura ganancia. maxPrecio se deduce del pico: no hace falta pasarlo aparte. */
    const adr = num(datos && datos.adr);
    if (adr && num(ganMax) != null && ganMax > 0) {
        const maxPrecio = ref * (1 + ganMax / 100);
        const nivel = maxPrecio * (1 - R.diasTrailing * adr / 100);
        if (nivel > ref) base = Math.max(base, nivel);
    }
    return Math.max(base, num(stopPrevio) || 0) || null;
  }

  /* Máximo alcanzado desde la compra: lo registrado más los máximos que publica el mercado. */
  /* Cuanto llego a ganar una posicion, medido EN CIERRES.
     maxSerie es el cierre mas alto desde la compra segun la serie diaria guardada. Cuando existe,
     manda: max1m y max3m son maximos INTRADIA (High.1M de TradingView), y el stop solo actua con
     cierres, asi que medir la devolucion desde una mecha es medir desde un nivel al que el sistema
     nunca habria reaccionado. Con datos reales esa mecha esta de media un 6 % por encima del cierre
     y llega al 18 %, lo que adelantaba la venta varios puntos de ganancia.
     Sin serie se siguen usando los intradia: mas vale un maximo algo alto que ninguno. */
  function maximoDesdeCompra(datos, compra, maxRegistrado, dias, maxSerie) {
    const precio = num(datos && datos.precio), serie = num(maxSerie);
    const c = [num(maxRegistrado) || num(compra) || 0, precio || 0, serie || 0];
    if (serie == null) {
      if (datos && num(datos.max1m) && dias != null && dias <= 30) c.push(datos.max1m);
      if (datos && num(datos.max3m) && dias != null && dias <= 90) c.push(datos.max3m);
    }
    return Math.max(...c) || null;
  }

  /* Evaluación completa de una posición abierta. requisitos: lista de window.REQUISITOS(datos). */
  function evaluaPosicion({ datos, compra, maxRegistrado, stopPrevio, dias, requisitos, diasResultados, maxSerie }) {
    const precio = num(datos && datos.precio);
    if (precio == null || compra == null) return { estado: 'sindatos', motivos: [], avisos: [] };
    const gan = (precio / compra - 1) * 100;
    const maxVisto = maximoDesdeCompra(datos, compra, maxRegistrado, dias, maxSerie);
    const ganMax = maxVisto ? (maxVisto / compra - 1) * 100 : gan;
    const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
    const stop = stopDe(datos, compra, stopPrevio, ganMax);
    const limite = limiteDevolucion(ganMax);
    const ema50 = num(datos.ema50), ema21 = num(datos.ema21), rsi = num(datos.rsi);
    const fallos = (requisitos || []).filter(x => !x.ok && !x.entrada);
    /* Requisito de capitalizacion roto en una posicion abierta. Hasta el 14/10/2026 esto solo podia
       pasar por arriba (superar el techo de 10 B) y el aviso se llamaba 'crecida'. Sin techo solo puede
       pasar por abajo: la empresa se ha hundido por debajo del suelo. Sigue siendo aviso, no venta. */
    const capRota = (requisitos || []).find(x => !x.ok && x.entrada && /apitalizaci/.test(x.t));

    const motivos = [], avisos = [];
    /* El stop es siempre max(EMA 50, ...), asi que si el precio pierde la EMA 50 ya esta por debajo
       del stop y lo coge la primera rama. Aqui habia un 'else if' para el codigo 'ema50' que no se
       ejecutaba NUNCA: lo encontro la rejilla del 18/10/2026, 0 de 6.720 combinaciones. No cambiaba
       nada (el mensaje de 'stop' ya dice que ha perdido la EMA 50 cuando el stop es la EMA 50), pero
       la tabla de Parametros lo describia como una regla aparte. El codigo 'ema50' sigue vivo en
       senalesDeMercado, que es otro camino y si lo emite. */
    if (stop != null && precio < stop) motivos.push({ codigo: 'stop', stop, ema50 });
    if (rsi != null && rsi < R.rsiVenta) motivos.push({ codigo: 'rsi', rsi });
    if (limite != null && alMenos(devuelto, limite)) motivos.push({ codigo: 'devuelto', devuelto, ganMax, gan, limite });
    if (fallos.length >= 2) motivos.push({ codigo: 'requisitos', fallos });

    if (capRota) avisos.push({ codigo: 'capitalizacion', valor: capRota.v });
    if (diasResultados != null && diasResultados >= 0 && diasResultados <= 10) avisos.push({ codigo: 'resultados', dias: diasResultados });
    if (!motivos.length) {
      if (fallos.length === 1) avisos.push({ codigo: 'un-requisito', fallo: fallos[0] });
      if (limite != null && alMenos(devuelto, limite * R.avisoDevolucion)) avisos.push({ codigo: 'devolviendo', devuelto, limite });
      /* EL TRAMO SIN RED: entre gananciaProteger (+20 %) y el primer escalon de devolucion (+30 %)
         NO HAY NINGUNA REGLA que asegure ganancia. El stop ya solo protege el COSTE -sube a tu
         precio de compra- y la devolucion todavia no existe, asi que una posicion que llego a +29 %
         puede volver a 0 % sin que el sistema diga una palabra.
         Esto NO es una regla nueva: no vende, no cambia el stop, no toca la nota. Es decir en voz
         alta algo que el sistema hacia en silencio, porque la decision en ese tramo es del usuario y
         hasta ahora ni siquiera sabia que le tocaba a el.
         Medido el 05/11/2026: 3 de las 4 entradas que han pasado del +20 % estan en este tramo
         (CDNA, HNGE y CAI), y CAI ya habia devuelto 9,8 puntos sin que nada avisara.
         Por que no se arregla cambiando el umbral: bajar la devolucion al +20 % no mejora nada
         (-1,06 % -> -1,16 %) y bajarla al +15 % parece mejorar (-0,43 %) pero TODA la mejora es una
         sola accion, IOVA. Con 4 entradas por encima del +20 % no hay forma de calibrarlo. */
      /* GANANCIA MAS PEQUEÑA QUE EL RUIDO. Con el escalon del +20 % ya no queda hueco entre la
         proteccion del coste y la del beneficio, asi que este aviso cambia de sentido: ahora dice
         lo que de verdad pasa por debajo de ese nivel. Una ganancia de +8 % en una accion que se
         mueve un 4,6 % al dia son menos de dos dias de rango, y NO HAY regla capaz de protegerla:
         por debajo de dos dias cualquier regla salta con el movimiento normal, y por encima
         devuelve la ganancia entera antes de dispararse. No es un fallo del panel, es el tamaño de
         la ganancia frente a su volatilidad, y conviene saberlo antes de contar ese dinero. */
      /* El aviso cubre TODA la banda sin regla, no solo la parte de abajo. En la primera version
         solo saltaba con ganMax < 2*ADR, y eso dejaba un hueco mudo entre ~9 % y 20 % para una
         accion de ADR 4,6: ni regla de devolucion ni aviso. Lo encontro Borja el 05/11/2026
         preguntando "¿y una que llevo un 15 %, como la protejo?". No la protegia nada y el panel
         no lo decia.
         Son dos situaciones distintas y el texto lo distingue:
           - por debajo de 2 dias de rango: NO SE PUEDE proteger, cualquier regla seria ruido;
           - de ahi al primer escalon: todavia no hay regla, y falta X para tenerla. */
      /* AVISO SOLO CUANDO HAY ALGO QUE PROTEGER. La primera version avisaba con cualquier ganancia
         por encima de cero, y con eso una posicion al +4 % salia como VIGILAR: todas las que van
         en verde marcadas, que es ruido puro en pantalla.
         La linea es la misma que usa el resto del panel: DOS DIAS DE RANGO de esa accion. Por
         debajo de ahi la ganancia no es un movimiento, es el vaiven de un dia, y no hay nada que
         proteger ni nada que decir. Por encima, la ganancia es real y el usuario tiene que saber
         que todavia no hay regla que la cubra y cuanto le falta.
         Ojo: esto hace el aviso PROPORCIONAL A LA VOLATILIDAD de cada accion. En una que se mueve
         un 4,6 % al dia salta a partir del +9,2 %; en una tranquila de ADR 1,5, a partir del +3 %.
         Es lo correcto: en la tranquila, un +8 % si es una ganancia que se puede perder. */
      /* TIENES GANANCIA Y TU SALIDA SIGUE POR DEBAJO DE TU COMPRA.
         La condicion ya no es un umbral: es el hecho. Con el trailing de beneficio puesto, el stop
         sube por encima de la compra en cuanto la ganancia supera unos dias de rango, asi que la
         pregunta "¿esta protegido?" se responde mirando el stop, no comparando porcentajes.
         Antes esto era un umbral fijo y se desincronizo en cuanto cambio el trailing: avisaba desde
         el +9,2 % cuando la proteccion empezaba en el +10,2 %, y seguia avisando por encima, donde
         ya estaba protegido. Preguntarle al stop no se puede desincronizar. */
      /* Con el trailing puesto, esto casi no salta nunca, y esta bien que sea asi: la banda que
         antes describia ahora esta PROTEGIDA. Queda para dos casos de verdad:
           - el sliver entre que la ganancia deja de ser ruido y el trailing llega a cubrirla;
           - una accion SIN dato de ADR, donde el trailing no puede activarse y el usuario tendria
             una ganancia desprotegida sin enterarse.
         Sin el filtro del ruido volveria a marcar como VIGILAR cualquier posicion al +2 %, que es
         justo lo que se arreglo hace un rato. */
      const adrPos = num(datos.adr);
      /* Se EXIGE el ADR. Sin el no se puede saber si esa ganancia es un movimiento o el vaiven de
         un dia, y avisar "por si acaso" marcaba como VIGILAR cualquier posicion al +2 %: el mismo
         ruido que ya se quito una vez. En la practica lo tienen las 42 seguidas. */
      if (ganMax > 0 && stop != null && stop < compra
          && adrPos && alMenos(ganMax, R.diasTrailing * adrPos)) {
        const adr = adrPos;
        avisos.push({ codigo: 'ganancia-corta', ganMax, gan, adr, stop,
                      dias: adr ? ganMax / adr : null,
                      falta: adr ? Math.max(0, R.diasTrailing * adr - ganMax) : null });
      }
      if (ema21 != null && precio < ema21) avisos.push({ codigo: 'ema21', ema21 });
    }
    return { estado: motivos.length ? 'vender' : avisos.length ? 'vigilar' : 'mantener',
      motivos, avisos, stop, gan, ganMax, devuelto, limite, maxVisto };
  }

  /* RECORRIDO DE UNA ENTRADA CON LAS REGLAS DE SALIDA. Fuente unica para toda la web.

     Nace de dos fallos reales. El 24/10/2026 la misma accion salia a -15,7 % en una tabla de
     Resultados y a -5,6 % en otra, porque habia DOS copias de este bucle y una llamaba a stopDe con
     dos argumentos de menos. Al dia siguiente aparecio que Seguimiento enseñaba de titular la media
     "aguantando sin vender nunca" (+0,1 %) en vez de la media con los stops puestos (+1,2 %), que
     es lo que el sistema hace de verdad. Con el bucle aqui, las pestañas no pueden divergir.

     Recibe los datos en vez de ir a buscarlos, para que esta funcion siga siendo pura:
       compra     precio de entrada
       sesiones   fechas posteriores a la entrada, en orden
       precioDe   f -> cierre de ese dia, o null si no se tiene
       emaDe      f -> EMA 50 de ese dia, o undefined

     Devuelve { ret, fecha, motivo, peor, peorCerrada, vistos }. ret es null si nunca salto: quien
     llama decide si eso significa "sigue abierta" o "vale lo de hoy". */
  function recorrido(compra, sesiones, precioDe, emaDe) {
    const c = num(compra);
    if (c == null || c <= 0) return { ret: null, fecha: null, motivo: null, peor: 0, peorCerrada: 0, vistos: 0 };
    let maxVisto = c, peor = c, peorCerrada = c;
    let salida = null, fSalida = null, motivo = null, stopPrevio = 0, vistos = 0, cerrada = false;
    for (const f of sesiones || []) {
      const p = num(precioDe(f));
      if (p == null) continue;                 // no tenemos su cierre ese dia
      vistos++;
      maxVisto = Math.max(maxVisto, p);
      peor = Math.min(peor, p);
      if (cerrada) continue;
      peorCerrada = Math.min(peorCerrada, p);
      const gan = (p / c - 1) * 100, ganMax = (maxVisto / c - 1) * 100;
      /* Los CUATRO argumentos de stopDe. Sin ema50 el stop se queda en el suelo de perdida maxima,
         mas flojo que el de verdad; sin ganMax vuelve a mirar la ganancia de hoy en vez de la
         maxima, que es el fallo que se corrigio aqui mismo este mes. */
      stopPrevio = Math.max(stopPrevio, stopDe({ precio: p, ema50: num(emaDe(f)) }, c, stopPrevio, ganMax) || 0);
      if (p < stopPrevio) { salida = p; fSalida = f; motivo = 'stop'; cerrada = true; continue }
      const limite = limiteDevolucion(ganMax);
      const devuelto = ganMax > 0 ? (1 - gan / ganMax) * 100 : 0;
      if (limite != null && alMenos(devuelto, limite)) { salida = p; fSalida = f; motivo = 'devolución'; cerrada = true }
    }
    const pct = v => (v / c - 1) * 100;
    return { ret: salida != null ? pct(salida) : null, fecha: fSalida, motivo,
      peor: pct(peor), peorCerrada: pct(peorCerrada), vistos };
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
  /* Stop si entrases hoy. "tope" avisa de que la EMA 50 queda mas lejos que la perdida maxima: el stop
     entonces no es un nivel tecnico sino una linea fija al -15 %, que el precio puede cruzar sin que
     nada se haya roto. Antes esto se detectaba comparando la distancia con 15, pero como el stop ya
     viene recortado a 15 esa comparacion solo era cierta por el redondeo del flotante. */
  function stopDeEntrada(datos) {
    const precio = num(datos && datos.precio), ema50 = num(datos && datos.ema50);
    const stop = stopDe(datos, precio, null);
    if (stop == null || precio == null) return null;
    const distanciaEma50 = ema50 ? (ema50 / precio - 1) * 100 : null;
    const tope = distanciaEma50 != null && !alMenos(distanciaEma50, -R.perdidaMaxima);
    /* Si el precio ya cotiza por DEBAJO de su EMA 50, el stop calculado sale por ENCIMA del precio:
       entrarias ya saltado. No es un stop, es la prueba de que la tendencia esta rota. Se marca como
       invalido para que la web diga eso en vez de un "+5 % desde aqui", que no significa nada.
       Pasaba con 7 de las 36 seguidas el 16/10/2026 (ABSI, AXTI, BAND, COHU, FEIM, QMCO, SHMD); todas
       daban ya "Ya no cumple" y el tamaño de posicion era null, asi que el dinero nunca estuvo en
       juego: era un numero sin sentido en pantalla. */
    const invalido = stop >= precio;
    /* Precio al que la compra dejaria de ser "arriesgada". No es una opinion: es exactamente el
       punto donde el tope del 15 % deja de morder y el stop vuelve a ser la EMA 50, es decir
       EMA 50 x 1,15. Por encima de ahi el stop es un numero fijo y no un nivel tecnico. */
    const precioSinTope = ema50 ? ema50 * (1 + R.perdidaMaxima / 100) : null;
    /* OJO: distanciaEma50 es (ema50/precio - 1), o sea cuanto HAY QUE CAER hasta la EMA 50, y eso
       coincide con la distancia del stop. NO es lo mismo que cuanto esta el precio POR ENCIMA de la
       EMA 50, que es (precio/ema50 - 1) y siempre sale mayor. Con PAYS: 11,70 % frente a 13,25 %.
       Se expone el segundo aparte porque es el que se enseña y el que se lee como "esta estirada". */
    const sobreEma50 = ema50 ? (precio / ema50 - 1) * 100 : null;
    const retrocesoNecesario = precioSinTope && precio ? (precioSinTope / precio - 1) * 100 : null;
    return { stop, distancia: (stop / precio - 1) * 100, ema21: num(datos.ema21), ema50, distanciaEma50,
             tope, invalido, precioSinTope, retrocesoNecesario, sobreEma50 };
  }

  raiz.REGLAS = { R, alMenos, limiteDevolucion, stopDe, maximoDesdeCompra, evaluaPosicion, senalesDeMercado, stopDeEntrada, recorrido };
})(typeof window !== 'undefined' ? window : globalThis);
