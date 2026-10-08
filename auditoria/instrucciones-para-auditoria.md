# Sistema "Growth con momentum" · instrucciones completas para auditoría externa

**Versión del código:** ac731c3d  ·  **Datos del cierre:** 2026-10-07T21:46Z
**Documento generado:** 08/10/2026

---

## Qué se te pide

Eres un auditor externo. Este documento contiene **todas** las reglas con las que un sistema
automático decide, sobre acciones de EE. UU.:

1. **qué comprar** (filtros de entrada y puntuación),
2. **dónde poner el stop**,
3. **cuándo vender** una posición abierta.

Lo usa una persona con dinero real, con horizonte de semanas a meses, buscando empresas pequeñas
y medianas que crecen deprisa y empiezan a despegar en bolsa.

**No necesitas ser amable.** Lo útil es que señales incoherencias, huecos y riesgos. Si crees que
el sistema es malo, dilo. Al final del documento hay preguntas concretas.

Dos avisos para que no pierdas el tiempo:

- **Ningún umbral está validado con los resultados de este sistema.** No tiene aún ni una sola
  operación con recorrido suficiente. Los números salen de criterio y de un backtest con sesgo
  documentado. No hace falta que lo descubras: ya se sabe.
- **Las secciones 7 y 8 son un compromiso escrito antes de tener datos**, para evitar sobreajuste.
  Júzgalo como método, no como resultado.

---

## PARTE 1 · Reglas declaradas

Esto es lo que el propio sistema publica como su documentación. Se genera de las mismas tablas que
ve el usuario en pantalla.

```
PANEL "GROWTH CON MOMENTUM" · PARÁMETROS E INSTRUCCIONES
Generado el 8/10/2026, 14:06:53 · versión del código ac731c3d · datos del 2026-10-07T21:46Z

OBJETIVO DECLARADO DEL SISTEMA
Encontrar empresas pequeñas y medianas de EE. UU. que crecen deprisa y están empezando a despegar en bolsa,
para comprarlas pronto, aguantar la subida y salir cuando se agota el impulso. Horizonte de semanas a meses.
No es una recomendación de compra ni asesoramiento financiero.

1 · QUÉ TIENE QUE CUMPLIR PARA ENTRAR EN EL TOP

Requisito | Umbral | Por qué
--- | --- | ---
Precio | > 2 $ | evita chicharros de céntimos
Capitalización | 300 M a 10,0 B | pequeñas y medianas: una gigante ya no multiplica
Volumen medio | > 300 mil acciones | que se negocie de verdad
Dinero negociado | > 2 M$ al día | poder salir sin mover el precio
Tendencia de fondo | precio sobre su media de 200 días | solo se compra lo que sube
Tendencia corta | EMA 9 por encima de EMA 50 | el impulso es reciente
RSI 14 | > 55 | hay compradores
Crecimiento de ingresos | ≥ 20 % interanual | el mayor entre 12 meses y último trimestre
Distancia al máximo | máximo 20 % por debajo del de 52 semanas | cerca de máximos, no rebotando de un suelo
Sectores excluidos | navieras, petroleras, mineras, químicas, utilities, REITs y gestoras | su crecimiento viene del precio de una materia prima

Nota: Si falla uno solo, la empresa no aparece. Se analizan unas 250 cada día y suelen pasar entre 40 y 50.

2 · CÓMO SE CALCULA LA PUNTUACIÓN DE 0 A 100

Bloque | Puntos | Qué mide
--- | --- | ---
Momentum técnico | 25 | orden de las medias, RSI en zona 60-72 y subida en 1 y 3 meses
Aceleración del crecimiento | 25 | nivel de crecimiento, aceleración del último trimestre, BPA, consistencia anual y previsión del próximo ejercicio
Calidad fundamental | 20 | margen bruto, flujo de caja libre, margen neto, caja frente a deuda y regla del 40
Fuerza relativa | 15 | frente al S&P 500 a 3 y 6 meses y frente a la mediana de su sector
Volumen y ruptura | 15 | volumen relativo, ADR, cercanía a máximos y ruptura confirmada por volumen

Nota: A igualdad de puntuación, primero la de menor capitalización.

3 · PENALIZACIONES Y BONUS

Concepto | Efecto | Motivo
--- | --- | ---
RSI por encima de 80 / 85 | −3 / −6 | sobrecomprada
Precio un 50 / 80 % sobre su EMA 50 | −5 / −10 | vertical: entrar ahí sale caro
Precio un 150 % sobre su media de 200 días | −4 | muy estirada
Sube más de un 70 % en un mes | −5 | movimiento parabólico
Margen bruto por debajo del 35 / 25 / 15 % | −2 / −5 / −8 | negocio poco escalable: difícil que multiplique
Emite acciones a más del 15 % anual | −4 | te diluye: la empresa crece y tú no
Impulso entre 20 y 50 % sobre su EMA 50 | +3 | la zona que históricamente más multiplica
Sube entre un 20 y un 70 % en el mes | +2 | impulso sano, no parabólico
Capitalización por debajo de 1.000 / 3.000 / 6.000 M | +5 / +3,5 / +2 | cuanto más pequeña, más recorrido
Capitalización de 6.000 M en adelante | +0,5 | el resto también suma algo, para que el bonus no sea todo o nada

Nota: La penalización total está limitada a −15 puntos y la nota final se acota entre 0 y 100.

4 · QUÉ SIGNIFICA CADA VEREDICTO

Veredicto | Cuándo aparece
--- | ---
COMPRA | cumple todo, no está estirada y su EMA 50 queda a menos de un 15 %
Sin datos | ha dejado de cotizar con ese símbolo o ha cambiado de nombre: la fuente ya no la devuelve
No comprar | ha dado una señal de salida: perdió la EMA 50 o la EMA 21, RSI por debajo de 45, o ha caído un 15 % o más desde su máximo del último mes
Compra arriesgada | cumple, pero la EMA 50 queda a más del 15 %: el stop es un tope fijo, no un nivel técnico
Esperar | está a más de un 10 % de su máximo de 52 semanas
No comprar aquí | demasiado estirada: mejor esperar a que consolide
Vigilar | cumple, pero su puntuación ha caído más de 8 puntos
Ya no cumple | ha roto algún requisito obligatorio

Nota: La pestaña Hoy se ordena por prioridad de compra: primero las que marcan COMPRA, después las de vigilar y al final las que no se tocan; dentro de cada grupo, por puntuación. La pestaña Seguimiento se ordena por puntuación a secas, porque sirve para ver cómo evolucionan, no para decidir la compra del día. La puntuación mide la calidad de la empresa, no si hoy es buen día para entrar.

5 · CUÁNDO VENDER UNA POSICIÓN ABIERTA

Regla | Detalle
--- | ---
Stop inicial | la EMA 50, sin arriesgar nunca más de un 15 % desde tu precio de compra
El stop nunca baja | se guarda el valor más alto que ha alcanzado, aunque la EMA 50 retroceda
Protección del coste | superado el 20 % de ganancia, el stop sube a tu precio de compra
Devolución de ganancias | con menos de un 30 % ganado manda solo el stop; entre 30 y 100 % se vende si devuelve la mitad; por encima del 100 %, si devuelve el 40 %
Cómo se mide lo que llegaste a ganar | el CIERRE más alto desde tu compra, según la serie diaria guardada (90 sesiones). No se usan los máximos intradía: el stop solo actúa con cierres, así que medir desde una mecha adelantaría la venta. Si no hay serie para ese valor se recurre a los máximos de 1 y 3 meses, que sí son intradía. Un máximo ya registrado no se olvida
Pérdida de tendencia | cierre por debajo de la EMA 50 o RSI por debajo de 45
Deterioro del negocio | deja de cumplir dos o más requisitos
Aviso previo | VIGILAR al perder la EMA 21, al acercarse al 60 % de la devolución límite o si publica resultados en 10 días
Un solo requisito roto | VIGILAR, no vender: hacen falta dos para que sea motivo de venta
Se le queda pequeño el techo | VIGILAR si supera los 10.000 M de capitalización, pero nunca es motivo de venta

Nota: Que una ganadora supere el techo de capitalización no cuenta como motivo de venta.

6 · DE DÓNDE SALEN LOS DATOS Y QUÉ NO CUBRE

Asunto | Detalle
--- | ---
Fuente | TradingView, al cierre de cada sesión
Actualización | cada día laborable a las 21:30 UTC: 23:30 en horario de verano y 22:30 en invierno (hora de España)
Mercado | solo EE. UU.
Frecuencia | una foto diaria: no hay precios intradía
Tus posiciones | se guardan solo en este navegador, no en ningún servidor
Lo que no ve | noticias, fraudes, resultados de ensayos clínicos, demandas o cambios regulatorios
Calibración | los umbrales técnicos salen de 17.934 observaciones semanales de 185 empresas entre 2024 y 2026. Se solapan entre sí y cubren un periodo alcista, así que valen mucho menos que 17.934 casos independientes

Nota: Esto es un sistema de detección de oportunidades para estudiarlas una a una, no una recomendación de compra.

7 · CUÁNDO SE PUEDE CAMBIAR EL SISTEMA, Y CUÁNDO NO

Pregunta | Hace falta | Qué se haría con la respuesta
--- | --- | ---
¿Gana dinero? | 30 entradas maduras | si la media es negativa con el índice en positivo, se revisan los criterios de ENTRADA. No se tocan los pesos de la puntuación
¿Bate al S&P 500? | 30 entradas maduras, dos revisiones seguidas | si pierde contra el índice dos trimestres seguidos, el sistema no justifica el trabajo y lo honesto es comprar el índice
¿La puntuación discrimina? | 60 maduras, al menos 30 por mitad | si la diferencia entre la mitad alta y la baja es menor que su margen de error, la nota sirve para ordenar pero no para decidir cuánto comprar
¿El protocolo de salida aporta? | 30 entradas maduras | comparación A/B de las mismas entradas: aguantar, vender al salir del top, o con nuestras reglas. Se adopta la que gane por más del margen de error
¿El stop debería ir con la volatilidad? | 30 maduras con serie diaria completa | A/B sobre el mismo historial: stop actual (EMA 50 con tope del 15 %) contra uno proporcional al ADR. Solo se cambia si gana claramente

Nota: El sistema tiene 195 números ajustables (114 umbrales de puntuación, 53 asignaciones de puntos, 22 filtros de entrada y 6 reglas de salida). Con tan pocas observaciones, buscar entre todos ellos el que mejora el pasado es garantía de empeorar el futuro.

8 · REGLAS PARA NO ROMPER LO QUE FUNCIONA

Regla | Por qué
--- | ---
Revisión cada tres meses, no continua | mirar los números cada semana lleva a reaccionar al ruido
Un cambio cada vez | si se tocan dos cosas a la vez, no se sabe cuál fue
Nunca se ajusta un umbral porque «habría funcionado» | con 195 parámetros siempre hay uno que habría funcionado
Los 114 umbrales de puntuación y los 53 puntos no se tocan | no habrá nunca datos suficientes para calibrarlos; solo se cambiarían por un motivo conceptual, no estadístico
Cada cambio se anota con fecha y motivo | para poder deshacerlo si empeora, y para que se vea si se está tocando demasiado
Si hace falta un cambio para que los números salgan bien, la respuesta es que no salen bien | el sistema se juzga con las reglas que tenía, no con las que se le pongan después

Nota: Esta sección no cambia lo que hace el panel: limita cuándo se le puede tocar. Escrita el 8 de octubre de 2026, antes de tener una sola entrada madura, precisamente para no poder moverla después.

CONSTANTES EXACTAS DEL MOTOR (docs/reglas.js)
  perdidaMaxima = 15
  gananciaProteger = 20
  rsiVenta = 45
  devolucion = [{"desde":100,"limite":40},{"desde":30,"limite":50}]
  avisoDevolucion = 0.6
  lejosDeMaximo = 10

UMBRALES DE ENTRADA (build.py, viajan en panel.json)
  precioMin = 2
  capMin = 300000000
  capMax = 10000000000
  volumenMin = 300000
  liquidezMin = 2000000
  rsiMin = 55
  crecimientoMin = 20
  maxDesdeMaximo = 20

PREGUNTAS ÚTILES PARA UNA AUDITORÍA EXTERNA
  1. ¿Algún umbral se contradice con otro o deja casos sin cubrir?
  2. ¿Las reglas de venta protegen la ganancia sin cortar las subidas grandes?
  3. ¿Falta algún criterio relevante para detectar crecimiento sostenible?
  4. ¿Hay sesgos conocidos (supervivencia, mercado alcista) que invaliden la calibración?
```

---

## PARTE 2 · Código que se ejecuta de verdad

Todas las decisiones de compra, stop y venta salen de este único fichero. No hay lógica de decisión
en ningún otro sitio: el resto de la aplicación solo da formato a lo que devuelve esto.

Si encuentras una diferencia entre la PARTE 1 y la PARTE 2, es un fallo y quiero saberlo.

```javascript
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
    return { stop, distancia: (stop / precio - 1) * 100, ema21: num(datos.ema21), ema50, distanciaEma50, tope };
  }

  raiz.REGLAS = { R, alMenos, limiteDevolucion, stopDe, maximoDesdeCompra, evaluaPosicion, senalesDeMercado, stopDeEntrada };
})(typeof window !== 'undefined' ? window : globalThis);

```

---

## PARTE 3 · Limitaciones conocidas

Se declaran para que no gastes esfuerzo en encontrarlas, y para que juzgues si invalidan el sistema.

| Limitación | Detalle |
|---|---|
| Sin validación propia | cero operaciones con recorrido suficiente. Nada de lo que sigue está probado con resultados reales de este sistema |
| Calibración sesgada | 17.934 observaciones **semanales solapadas** de 185 empresas (2024-2026), en un periodo alcista. Equivalen a muchos menos casos independientes |
| Sesgo de supervivencia | el universo se consulta hoy: las empresas excluidas o quebradas no aparecen en la calibración |
| Stop no proporcional a la volatilidad | el stop es la EMA 50 con tope del 15 %, igual para una acción con ADR 2 % que con ADR 6 %. Medido: deja entre 2,4 y 3,6 rangos diarios medios de margen, y da **menos** colchón a las más volátiles |
| Solo cierres diarios | no ve precios intradía. No protege de huecos de apertura: si abre un 30 % abajo, se sale ahí, no en el stop |
| Filtro de régimen tosco | "S&P 500 sobre su media de 200 días". Va con retraso y no detecta un cambio de régimen rápido |
| No ve noticias | fraudes, ensayos clínicos, demandas, cambios regulatorios, opas |
| Una sola fuente de datos | TradingView. Si deja de devolver un símbolo, el sistema solo sabe que ha desaparecido, no por qué |
| 195 números ajustables | contra un máximo realista de ~100 observaciones. Riesgo estructural de sobreajuste |

---

## PARTE 4 · Preguntas concretas

Responde a estas. Si solo puedes a algunas, prioriza las tres primeras.

**Sobre coherencia interna**

1. ¿Hay algún umbral que se contradiga con otro, o algún caso que ninguna regla cubra?
2. ¿Coincide la PARTE 1 con lo que hace el código de la PARTE 2? Señala cualquier diferencia.
3. El stop es `max(EMA 50, precio de compra × 0,85)` y nunca baja. La regla de devolución permite
   dar atrás un 50 % de la ganancia máxima (entre +30 % y +100 %) o un 40 % (por encima de +100 %).
   ¿Se solapan mal? ¿Hay escenarios donde una anule a la otra de forma indeseada?

**Sobre la estrategia**

4. ¿Las reglas de venta protegen la ganancia sin cortar las subidas grandes? El objetivo explícito
   es que una ganadora grande pague las muchas que salen mal.
5. ¿Falta algún criterio relevante para detectar crecimiento sostenible, o sobra alguno?
6. El sistema exige estar a menos del 20 % del máximo de 52 semanas y con RSI > 55. ¿Compra
   demasiado tarde? ¿Demasiado pronto?

**Sobre el método**

7. ¿Las secciones 7 y 8 son suficientes para evitar el sobreajuste, o se quedan cortas?
8. Con 195 parámetros ajustables y ~100 observaciones previstas, ¿qué podría concluirse
   legítimamente y qué no?

**La pregunta incómoda**

9. Con lo que has leído, ¿recomendarías a esta persona usar este sistema con dinero real, o
   comprar un índice y ahorrarse el trabajo? Razónalo.
