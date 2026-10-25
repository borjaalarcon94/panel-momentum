# Registro de auditorías y cambios

La sección 8 de Parámetros obliga a anotar cada cambio con fecha y motivo. Aquí está.

---

## 8 de octubre de 2026 · Auditoría externa (ChatGPT)

**Material entregado:** reglas declaradas (8 tablas), código de `reglas.js`, limitaciones conocidas
y 9 preguntas. Dos addenda posteriores con el código de entrada (`build.py` + `puntuacion.js`),
el position sizing y `window.REQUISITOS` / `window.VEREDICTO`.

### Objeciones planteadas y cómo se resolvieron

| Objeción | Resultado |
|---|---|
| «El cálculo de devolución está mal» | **Retirada por el auditor.** Las dos definiciones que distinguía (% de la ganancia en puntos y % de la ganancia monetaria) son algebraicamente equivalentes: comprobado numéricamente, ambas dan 40,0000 % en el mismo caso. El código es correcto |
| «Falta position sizing» | **Retirada.** Existe en `window.TAMANO`: riesgo fijo por operación, tamaño derivado de la distancia al stop, tope del 25 % |
| «Parte 1 y Parte 2 no son equivalentes» | **Tenía razón, y el fallo era del documento**, no del sistema: solo se había entregado el motor de salida. Con el código de entrada, el auditor concluye que son «esencialmente coincidentes» |
| «El stop no escala con la volatilidad» | **Coincide con el diagnóstico propio.** No es un bug sino una hipótesis a validar con el A/B de la sección 7. Se mantiene como baseline |

### Hallazgo real

**La exclusión de sectores se declaraba como requisito pero no se comprueba al vigilar una
posición.** Se aplica en `build.py` al seleccionar el universo (`cumple(a) and not excluida(a)`),
pero `window.REQUISITOS` devuelve 9 elementos y ninguno es el sector. Por eso la app dice «cumple
los 9 requisitos» mientras la tabla 1 enumeraba 10 filas.

**Decisión: documentar, no cambiar la lógica.** Coinciden el auditor externo y el criterio propio.
Una reclasificación de sector es rara y cambiar la lógica sin evidencia va contra la sección 8.

### Cambios aplicados (solo documentación, ninguna regla tocada)

1. Tabla 1: la exclusión de sectores se marca como **solo al entrar**, y la nota aclara que nueve
   filas se vigilan a diario y una no.
2. Tabla 4: se documenta el **orden de precedencia** de los ocho veredictos, con el caso concreto
   de que «Esperar» gana a «Compra arriesgada».
3. Tabla 4: «Ya no cumple» aclara que la capitalización y el precio mínimo no cuentan.
4. Tabla 4: «Vigilar» aclara que solo aparece en la pestaña Seguimiento.

### Conclusión del auditor

> No veo ahora mismo un bug conceptual grave ni una contradicción importante entre las reglas
> declaradas y la implementación. (…) La siguiente auditoría interesante ya no es del código: es
> analizar si la combinación concreta de filtros + scoring + stop + salida tiene expectativa
> positiva, sin caer en overfitting.

Eso es exactamente lo que miden las cinco preguntas de la sección 7, y no se puede responder hasta
tener 30 entradas maduras.

---

## 11 de octubre de 2026 · Tramo del RSI inalcanzable

**Hallazgo.** En la cadena de ternarios que puntúa el RSI, el tramo `rsi > 78 ? 2` estaba **detrás**
de `rsi >= 55 ? 4`, que lo capturaba antes. Era código muerto: un RSI de 95 sacaba los mismos 4
puntos que uno sano de 58, cuando la escalera estaba escrita para bajar a 2.

**Por qué se toca pese a la sección 8.** No es cambiar un criterio: es que el código no hacía lo
que estaba escrito para hacer. Ese es el motivo conceptual que la sección 8 deja abierto. Decisión
consultada y aprobada por el usuario antes de aplicarla.

**Impacto medido.** 2 puntos sobre 100, y solo a 4 de las 72 acciones guardadas hasta la fecha
(5 %): XRPN el 2 oct, CDNA el 4 y el 5, RSKD el 9. Ninguna cambia de veredicto por ello. Las
penalizaciones de −3 y −6 por RSI alto ya funcionaban, así que el exceso estaba parcialmente
compensado por otra vía.

**Cambio.** Los tramos se reordenan de mayor a menor, sin solapes. Ocho pruebas nuevas, entre ellas
que la escalera sea monótona desde la zona ideal hacia arriba y que un RSI de 95 valga menos que
uno de 58. La tabla 2 documenta ahora los cuatro tramos, que antes solo mencionaba la zona ideal.

---

## 11 de octubre de 2026 · Nota: el A/B del stop sí es posible con lo que se guarda

Comprobado a raíz de una pregunta del usuario. La quinta pregunta de la sección 7 (stop actual
contra stop proporcional al ADR) necesita la **EMA 50 de cada día posterior a la entrada**, y esa
media solo se guarda en `docs/datos/<fecha>.json`, es decir, únicamente los días que la acción
estuvo en el top. Cuando se cae del top —que es cuando el stop importa— solo queda su cierre en
`docs/precios.json`.

**No es un bloqueo: la EMA 50 se puede reconstruir.** Es recursiva,
`EMA(hoy) = cierre × k + EMA(ayer) × (1 − k)` con `k = 2/51`. Teniendo la EMA 50 de cualquier día y
los cierres posteriores, se rueda hacia delante. Verificado contra los valores reales guardados:

```
PAYS   4 → 9 oct   real 12,5880   reconstruida 12,5880   error 0,000 %
CDNA   4 → 9 oct   real 53,0740   reconstruida 53,0741   error 0,000 %
ZETA   4 → 9 oct   real 29,2550   reconstruida 29,2551   error 0,000 %
HNGE   4 → 9 oct   real 90,7333   reconstruida 90,7334   error 0,000 %
```

**Pendiente de escribir** esa reconstrucción cuando haya entradas maduras que procesar. No se hace
antes para no calibrar sobre cuatro días.

**Condición que hay que respetar:** `precios.json` guarda 90 sesiones y solo de los símbolos que
siguen en seguimiento. Si pasan más de 90 sesiones sin abrir la app, ese tramo se pierde y con él
la posibilidad de reconstruir la EMA 50 de esas entradas.

---

## 14 de octubre de 2026 — se quita el techo de capitalización (10.000 M)

**Qué cambia.** `CAP_MAX` pasa de `10e9` a `None`. El filtro del escáner deja de acotar por arriba:
`market_cap_basic > 300e6`, sin límite superior. El suelo de 300 M no se toca.

**Lo que NO cambia, deliberadamente.** El bonus de tamaño de `docs/puntuacion.js`
(`pTam`: +5 por debajo de 1.000 M, +3,5 hasta 3.000 M, +2 hasta 6.000 M, +0,5 por encima) **se queda
exactamente igual**, y también el desempate por menor capitalización de `build.py`. El sesgo hacia lo
pequeño sigue vivo; lo que deja de existir es la **exclusión dura**. La sección 8 pide un cambio cada
vez, y además la simulación de abajo demuestra que el bonus no hace falta tocarlo para obtener el
efecto. Tampoco se tocan los 114 umbrales de puntuación ni los 53 puntos.

**Motivo 1 — la premisa no se sostuvo al medirla.** El techo se puso creyendo que "una gigante ya no
multiplica". Comparación histórica, mismo método en los dos grupos, condiciones técnicas del propio
panel (`cierre > SMA200 && EMA9 > EMA50 && RSI > 55 && cierre >= max52 × 0,8`), rentabilidad a 63
sesiones (≈ 3 meses):

```
                   obs    media  mediana   >+20%   >+50%   <-20%    peor
300 M – 10 B      1679     2,0 %   −2,0 %    17 %     5 %    15 %    −82 %
más de 10 B       2101     5,8 %   +1,1 %    16 %     4 %     5 %    −64 %

Por año (media / % de desastres):
                        2024              2025              2026
300 M – 10 B      −6,2 % / 25 %     +5,1 % / 13 %     +2,2 % / 15 %
más de 10 B       −2,0 % /  8 %     +8,0 % /  5 %     +6,7 % /  6 %
```

Las grandes van por delante en los tres años. Los grandes aciertos (>+20 %) son iguales (17 % frente
a 16 %): la diferencia no está en el techo de ganancia, está en los desastres (15 % frente a 5 %).

**Límites de esa medición, dichos antes de usarla.** Sesgo de supervivencia (castiga más a las
pequeñas, así que sus números ya salen favorecidos: el hallazgo es conservador), periodo alcista y
dominado por las grandes, y observaciones solapadas. Con esto se puede decir "el argumento del techo
no se sostiene"; **no** se puede decir "las grandes son mejores". Por eso no se toca `pTam`.

**Motivo 2 — estructural, y es el que de verdad decide.** El stop es la EMA 50 con tope del 15 %.
Cuando una acción cotiza a más del 15 % de su EMA 50, el tope muerde y el stop **deja de ser técnico**:
pasa a ser un −15 % arbitrario. Medido el 14 de octubre sobre candidatas reales:

```
         cap     ADR   sobre EMA50   margen en días de rango
PLTR   484 B    2,9 %      12,4 %    4,3  (stop = EMA 50 real)
SHOP   220 B    3,4 %      16,4 %    4,4
CORT    13 B    4,1 %       6,8 %    1,7  (stop = EMA 50 real)
IOVA     7 B    6,4 %      39,8 %    2,3  (manda el tope, stop arbitrario)
CDNA     3 B    6,0 %      20,6 %    2,5  (manda el tope, stop arbitrario)
```

Las grandes cotizan a 6–22 % de su EMA 50; las pequeñas a 20–40 %. Con las grandes el stop del sistema
es de verdad la media móvil, que es lo que el sistema pretende. Este motivo es **conceptual, no
estadístico**, que es lo que la sección 8 admite como razón para cambiar algo.

**Qué efecto tiene.** Simulado con el propio `build.py` y el propio `puntuacion.js`, sin tocar pesos:
el universo pasa de 32 candidatas a 54 (no a 500), y el top 10 queda **50/50**. Entran PLTR 87,5,
HALO 82,5, CORT 82,0, P 79,5 y SHOP 77,5; salen IOVA 76,5, CAI 76,0, SKWD 75,5, KNSA 75,0 y RSKD 74,5.
PLTR entra en segundo puesto **con los −4,5 puntos de handicap de `pTam` encima**, que es la prueba de
que el bonus no bloqueaba nada.

**Coste en llamadas y en repositorio: ninguno.** Sigue siendo la misma llamada al escáner con el
filtro más ancho, 4 al día. `GUARDAR = 10` es fijo, así que `panel.json` no crece.

**Fallo arreglado en el mismo commit — y era PREEXISTENTE, no lo introdujo este cambio.** El aviso
`crecida` de `docs/reglas.js` se disparaba cuando el requisito de capitalización fallaba en una posición
abierta, y el texto decía "ha superado el techo de capitalización". Pero ese requisito podía fallar
también **por abajo**, y entonces el mensaje decía lo contrario de lo que pasaba. No es hipotético:
el 14 de octubre, con el techo todavía puesto, SHMD cotizaba con 255 M de capitalización —por debajo
del suelo de 300 M— y el panel le decía "ha superado el techo de capitalización". Verificado ejecutando
el código anterior sobre los datos reales de ese día.

Quitar el techo lo convirtió en el único caso posible, que es lo que lo hizo visible. Renombrado a
`capitalizacion`, con el valor real en el mensaje. Sigue siendo aviso y no venta (`entrada: true`).

**Cómo se encontró.** Diferencial del algoritmo completo, código anterior contra el nuevo, sobre las 30
acciones en seguimiento: `REQUISITOS`, `VEREDICTO` y `evaluaPosicion`. Resultado: 0 veredictos
distintos, 0 stops distintos, y una única diferencia —SHMD— que es este mensaje. El resto del
algoritmo quedó idéntico, como debía: `puntuacion.js` y las cuatro vistas no se tocaron.

**Pruebas.** 329 comprobaciones en verde. Las 13 nuevas se verificaron contra el código anterior: 8
fallan con el techo puesto (5 en `filtros.test.py`, 3 en `humo.test.js`) y las otras son invariantes
que el cambio no debía romper (el suelo sigue filtrando, el requisito sigue siendo solo de entrada).

**Qué haría falta para revertirlo.** Si al llegar a 30 entradas maduras (≈ finales de noviembre) las de
más de 10.000 M salen sistemáticamente peor que las pequeñas en el registro propio, se vuelve a poner
el techo. `tests/filtros.test.py` tiene dos comprobaciones que impiden que alguien lo reponga sin
decidirlo.

---

## 14 de octubre de 2026 — el margen del stop y el tope del 25 % se hacen visibles

**No cambia ningún umbral, ninguna regla ni ningún peso.** Solo se muestra información que el panel ya
tenía y no decía. Se añade `window.MARGEN_STOP(distancia, adr)`, función pura.

**El hallazgo.** El tamaño de posición es `riesgo ÷ distancia al stop`, acotado al 25 % de la cartera.
Eso significa que **cuanto más pegado está el stop, más grande es la posición**. Pero un stop pegado no
es un stop más seguro si cae dentro del ruido diario de la acción: es una salida casi garantizada por
nada. La fórmula pone el máximo de dinero justo donde la salida es más aleatoria.

Medido el 14 de octubre sobre las 30 acciones en seguimiento, comparando la distancia al stop contra el
ADR (recorrido medio diario):

```
        stop    ADR   días de rango   % cartera
XRPN   10,3 %  41,1 %      0,25          9,7 %
ABSI    2,4 %   9,5 %      0,26         25,0 %   <- tope, y no se avisaba
BAND    3,6 %   7,4 %      0,49         25,0 %   <- tope, y no se avisaba
QMCO    6,6 %  12,3 %      0,54         15,2 %
PGEN    4,1 %   6,1 %      0,68         24,2 %
SHMD    8,4 %  12,2 %      0,69         11,9 %
YDES   15,0 %  21,1 %      0,71          6,7 %
FEIM    4,6 %   5,9 %      0,78         21,7 %
COHU    4,4 %   4,8 %      0,91         22,7 %
...
HNGE   12,7 %   3,5 %      3,61          7,9 %
```

**9 de 30 (30 %) tienen el stop dentro de un solo día de rango. 6 de esas se dimensionaban al 21-25 %
de la cartera.**

**El umbral no está calibrado, es una definición.** ADR es el recorrido medio de un día; un stop a menos
de 1 ADR lo cruza un día normal. No se ha ajustado a ningún resultado, así que no es sobreajuste.

**Qué se muestra ahora.** En la tarjeta de Hoy y en cada posición abierta: `· margen de X,X días de
rango`, y en ámbar `: un día normal lo cruza` cuando es menos de 1. Además, cuando el tope del 25 %
muerde se dice: antes el importe que se mostraba no era el que salía del riesgo, era el máximo por
concentración, y eso no se decía en ninguna parte.

**Lo que NO se hace, y por qué.** No se toca el stop ni la fórmula de tamaño. Eso es exactamente la
pregunta 5 de la sección 7 (A/B del stop proporcional al ADR) y necesita 30 entradas maduras con serie
diaria completa (≈ finales de noviembre de 2026). Cambiar hoy la fórmula sería calibrar sobre una
observación de un día. La medición queda registrada en la propia tabla de la sección 7 para que la
pregunta llegue ya enmarcada con números.

**Fallo de mi propio código, cazado antes de publicar.** La primera versión leía el ADR de `r.datos.adr`
en `posiciones.js`, y ese campo se llama `r.a`. El aviso no habría salido nunca en la pestaña Posiciones
y nadie lo habría notado, porque un aviso que no aparece se parece mucho a un aviso que no hace falta.
Hay una comprobación en `humo.test.js` que ata el nombre del campo.

**Pendiente, y hoy imposible.** El aviso `caida-mes` de `senalesDeMercado` mide la caída desde `max1m`,
que es un máximo **intradía** de TradingView. Es el mismo defecto que se corrigió en `maximoDesdeCompra`
el 11 de octubre (los máximos intradía quedan de media un 6,3 % por encima del cierre, hasta 18,5 %), y
hace que el aviso salte antes de lo que debería. Arreglarlo requiere un máximo mensual calculado sobre
cierres, o sea 22 sesiones en `docs/precios.json`. El 14 de octubre había **6**. Se puede hacer a
principios de noviembre de 2026; antes no, y por eso no se ha hecho.

**Pruebas.** 342 comprobaciones en verde. De las 12 nuevas, 8 fallan contra el código anterior
(verificado revirtiendo solo el código y dejando las pruebas, porque un `git stash` revertía también el
fichero de pruebas y el chequeo no valía nada).

---

## 14 de octubre de 2026 — un stop poco fiable ahora lo parece, y las megacaps se leen

Dos arreglos de presentación. **Ningún umbral, ninguna regla y ningún peso cambian.** El segundo toca
`puntuacion.js`, pero solo la cadena de texto: los puntos de tamaño no se tocan, y hay una prueba que
lo ata (`los puntos de tamaño no cambian con el formato`).

**1. Incoherencia que introduje yo mismo esta misma tarde.** Dije que el margen del stop en días de
rango "pesa más que la puntuación", y lo pinté como un texto gris diminuto al final de la caja,
mientras la nota va en un círculo grande. La interfaz contradecía el consejo.

El código ya tenía el patrón resuelto: cuando al stop le muerde el tope del 15 %, la caja entera se
tiñe de ámbar (clase `lejos`) y se añade "· media posición o esperar un retroceso". Un stop dentro del
ruido de un día es **el mismo problema o peor** —con el tope al menos el stop está a un 15 %, que es
espacio de sobra en términos absolutos— así que recibe el mismo trato. No es un patrón nuevo ni un
umbral nuevo: 1 ADR es una definición, y el tratamiento ya existía en el propio código.

Además el margen se ha movido: ahora va **pegado al stop y antes del importe a comprar**. Califica al
stop, y si el stop no es fiable el dinero que viene detrás tampoco lo es. Antes se leía después.
Aplicado igual en Hoy y en Posiciones.

**2. Legibilidad con el techo quitado.** `cap()` mostraba 1,14 billones como "1141,0 B", que no se lee.
Se añade el tramo T por encima de 1e12, en `app.js` y en el texto de tamaño de `puntuacion.js`, con los
mismos tramos en los dos sitios. No es hipotético: LLY está en el escaneo de hoy con 1.141 B y 50 % de
crecimiento de ingresos.

**Dos pruebas mías que no servían para nada, cazadas antes de publicar.** Son del mismo tipo que las
otras dos de hoy y conviene tenerlas apuntadas:
- Un bloque de 6 comprobaciones quedó insertado **dentro del `if (fallos) { ... }`** de
  `puntuacion.test.js`, así que solo se habría ejecutado cuando ya hubiera fallos: nunca. El contador
  seguía diciendo 31 de 31 y todo parecía correcto.
- Las comprobaciones nuevas de `humo.test.js` reventaban la suite con un `TypeError` en vez de dar un
  `✗`, porque llamaban a `MARGEN_STOP` sin comprobar que existiera. Hacían fallar el build, que es lo
  importante, pero ocultaban las comprobaciones siguientes.

**Renderizado con megacaps, que nadie había probado.** Se inyectaron PLTR (484 B), LLY (1.141 B) y SHOP
(220 B) en `panel.json` y se pintaron las cinco pestañas: sin errores. Es el estado en el que quedará
el panel con el build de esta noche.

**Pruebas.** 353 comprobaciones en verde (de 329 esta mañana). De las 11 nuevas, 6 fallan contra el
código de hace un rato, verificado revirtiendo solo el código.

---

## 14 de octubre de 2026 (noche) — se rehace el estudio del techo y SE RETIRA su justificación principal

No cambia una línea de código. Corrige el registro: **la entrada de esta mañana justifica el cambio con
unos números que no se sostienen.** Se dejan ahí para que quede constancia del error, con este aviso.

**Qué estaba mal.** El primer estudio tomaba una observación cada 5 sesiones con horizonte de 63, así
que cada rentabilidad se solapaba con una docena de vecinas. Se citaron medias sin margen de error.
Al calcularlo, el IC95 ingenuo de la diferencia (+3,79 pp) era [+2,02, +5,56], pero bastaba un factor
de inflación de 2,1 para incluir el cero y el típico en ese diseño es de 3 a 8. **La diferencia de
rentabilidad media que justificó el cambio no era significativa.**

**Estudio rehecho.** 31.350 observaciones de 276 tickers (frente a 3.780), guardando fecha y ticker.
Tres correcciones: submuestra sin solapamiento (una cada 63 sesiones por ticker), bootstrap por bloques
de trimestre, y comparación emparejada por trimestre.

**Resultado con rentabilidad CRUDA a 63 sesiones:**

```
                  n    media  mediana   >+20%   <-20%    peor
300 M - 10 B    476    5,24%   +0,33%     22%     14%    -65%
mas de 10 B     692    5,75%   +1,85%     17%      7%    -52%

diferencia grandes - pequenas, bootstrap por trimestre:
  rentabilidad media            +0,51 pp   IC95 [-2,05, +3,02]   NO significativa
  desastres   (<-20 %)          -7,26 pp   IC95 [-10,78, -4,46]  SI
  grandes aciertos (>+20 %)     -5,54 pp   IC95 [-9,31, -2,57]   SI
emparejado por trimestre: las grandes ganan 4 de 8, +0,16 pp, IC95 [-2,85, +3,17]
```

**La tabla por años de esta mañana no se replica.** Decía que las grandes iban por delante en 2024,
2025 y 2026. Hecho bien, por trimestres, ganan en 4 de 8. Era un artefacto del solapamiento.

**Y se retira también el "los grandes aciertos son iguales (17 % frente a 16 %)".** Con la muestra buena
las grandes tienen un 40 % menos de grandes aciertos, y la diferencia es significativa. El cuadro real
es: **menos varianza en las dos direcciones**, no una ventaja.

**Resultado aplicando EL PROTOCOLO DE SALIDA DEL PANEL** (stop EMA 50 con tope del 15 %, subida a la
compra al llegar a +20 %, venta por RSI < 45, venta al devolver 50 %/40 % de la ganancia máxima),
simulado día a día sobre cierres. Esta es la comparación que debió hacerse desde el principio: comparar
rentabilidades crudas era medir una estrategia que no se opera.

```
                  n    media  mediana   >+20%   <-20%    peor
300 M - 10 B    476    1,45%   -3,26%     12%      1%    -45%
mas de 10 B     692    2,40%   -2,35%      9%      0%    -38%

diferencia grandes - pequenas:
  rentabilidad media            +0,92 pp   IC95 [-0,56, +2,16]   NO significativa
  desastres   (<-20 %)          -0,85 pp   IC95 [-1,99, +0,16]   NO significativa
  grandes aciertos (>+20 %)     -3,10 pp   IC95 [-5,23, -1,84]   SI
emparejado por trimestre: las grandes ganan 5 de 8, +0,38 pp, IC95 [-1,60, +2,37]
```

**El stop se come la ventaja de las grandes.** Los desastres pasan de 14 % frente a 7 % en crudo a 1 %
frente a 0 % con el protocolo: la protección de las grandes era redundante, el stop ya la daba. Lo que
sobrevive es que las grandes tienen menos pelotazos. Pero la rentabilidad neta no sufre, porque las
pequeñas también pierden más en las operaciones normales.

**Conclusión sobre el cambio de hoy: la evidencia de rentabilidad NO lo apoya, y tampoco lo
contradice.** No hay diferencia medible. Lo que queda en pie son dos argumentos que no dependen de
estas cifras: el doble de candidatas para que elija la puntuación (32 a 53, sin medir si eso mejora
algo), y la calidad del stop (en el top simulado del 14 de octubre, 3,72 días de rango de margen las
grandes contra 2,85 las pequeñas). **No se revierte**, porque nada indica que las pequeñas sean
mejores con este protocolo.

**Disparador de vigilancia, concreto:** el estudio compara cestas enteras, pero el panel elige el top 10
de una bolsa mezclada que sale 50/50, así que conserva la cola derecha de las pequeñas. **Si algún día
el top 10 trae 8 o más de más de 10 B, se está regalando esa cola derecha y hay que reponer el techo.**
El 14 de octubre salían 5.

**Límites del estudio, dichos antes de usarlo.** (1) Mide el protocolo sobre TODAS las acciones que
cumplen las condiciones técnicas, no sobre las 10 que elige la puntuación: esas pueden comportarse
distinto y eso no está medido. (2) Solo cierres: sin huecos de apertura, así que el stop sale mejor
parado de lo que saldría en real. (3) Sesgo de supervivencia: el escáner solo devuelve lo que sigue
cotizando, y eso favorece a las pequeñas, así que sus números ya están embellecidos. (4) No incluye la
regla de venta por dos requisitos roto ni la lógica de VIGILAR. (5) 8 trimestres son pocos bloques para
un bootstrap; los IC son anchos y hay que tomárselos como anchos.

**Dato sobrio que conviene no perder de vista.** Con el protocolo, la mediana es **negativa** en los dos
tramos (−3,26 % y −2,35 %). La operación típica pierde dinero; el beneficio sale del 9-12 % que son
pelotazos. Es normal en momentum, pero es lo que hay que tener en la cabeza al fijar expectativas.

---

## 14 de octubre de 2026 (noche, 2) — también se cae el argumento del stop. Lo que queda es la cobertura sectorial

No cambia una línea de código. Tercera rectificación del mismo día sobre el mismo cambio.

**El margen del stop NO predice la rentabilidad.** Era el único argumento cuantitativo que quedaba en
pie tras retirar el de la rentabilidad. Probado sobre las mismas 32.455 observaciones, 1.239 sin
solapamiento, partiendo por cuartiles de margen (distancia al stop ÷ volatilidad media de 20 sesiones,
proxy cierre-a-cierre del ADR) y midiendo el resultado CON el protocolo del panel:

```
  margen                n    media  mediana   >+20%   <-20%
  Q1 0,8-2,7 dias     309   +1,21%   -2,35%      6%      2%
  Q2 2,7-4,0 dias     309   -0,01%   -3,11%      7%      0%
  Q3 4,0-5,5 dias     309   +1,95%   -2,89%      8%      0%
  Q4 5,5-29,9 dias    312   +0,54%   -2,84%      7%      0%

  Q4 - Q1: -0,78 pp   IC95 [-4,49, +1,61]   NO excluye el cero
  dentro de las pequenas, mas margen salio -2,27 pp PEOR (direccion contraria)
```

No hay patrón monótono y el signo va en contra. **El argumento estructural con el que defendí el cambio
—"con las grandes el stop es de verdad la media móvil"— no se traduce en mejor resultado.**

Limitación del proxy: la volatilidad cierre-a-cierre es menor que el ADR (que usa máximos y mínimos),
así que los márgenes de esta tabla están inflados en torno a 1,5x. La zona de verdad peligrosa (menos
de 1 ADR) es solo una parte de Q1, así que la prueba es algo gruesa. Pero no hay nada que apunte en la
dirección que yo defendía, y eso es lo que cuenta.

**Lo que SÍ queda, medido con rigor.** No es un argumento de rentabilidad, así que no le afectan las
tres rectificaciones:

```
candidatas: 54 (35 pequenas, 19 grandes)
industrias cubiertas por las pequenas:          18
industrias que aportan SOLO las grandes:         8   -> +44 % de cobertura
grandes en industrias que las pequenas no cubren: 9 de 19

las 8 industrias: Computer Peripherals (x2), Internet Software/Services, Semiconductors,
Information Technology Services, Beverages: Non-Alcoholic, Electronics/Appliances,
Air Freight/Couriers, Investment Banks/Brokers
```

El techo producía un **sesgo sectorial involuntario**: excluía sectores enteros cuyas empresas con
crecimiento son casi todas grandes. Borja lo detectó antes que nadie al preguntar *"¿es raro que no
haya ninguna acción de semiconductores con momentum?"*, y entonces se le dio una explicación sectorial
equivocada. La explicación real era el techo. Y "Computer Peripherals" es la industria de SanDisk, la
empresa concreta que originó toda esta conversación.

**Estado honesto del cambio del techo, al cierre del 14 de octubre:**
- Rentabilidad: **sin diferencia medible** con el protocolo real (5 de 8 trimestres, IC con el cero dentro).
- Calidad del stop: **no predice**. Argumento retirado.
- Grandes aciertos: las grandes tienen significativamente menos (−3,10 pp). **Coste real**, compensado
  en la media porque las pequeñas también pierden más en las operaciones normales.
- Cobertura sectorial: **+44 %**, medido. Único beneficio que sobrevive.
- Supuesto eliminado: el techo nunca estuvo justificado. Quitarlo es correcto por principio aunque la
  rentabilidad no se mueva.

**Por qué no se revierte esta noche.** Se dijo explícitamente que si las pequeñas salían por delante
con el protocolo real, se revertía antes del build. No salieron por delante: salió empate. Revertir
ahora, sobre una medición recién hecha y débil, sería repetir el error de esta mañana en la dirección
contraria — y es exactamente lo que la sección 8 existe para evitar. La decisión la toman las 30
entradas maduras de finales de noviembre, partidas por tramo de capitalización, con los datos que ya se
están guardando en `docs/datos/*.json`.

**Lección de proceso, porque el patrón se repitió tres veces el mismo día.** Las tres equivocaciones
fueron en la misma dirección: a favor de la conclusión ya adoptada. La evidencia se buscó DESPUÉS de
que surgiera la idea (la pregunta por SanDisk), y el argumento conceptual se encontró DESPUÉS del
estadístico, no antes. Ese orden es el que la sección 8 prohíbe, y no se señaló al proponer el cambio.

---

## 15 de octubre de 2026 — verificación: la predicción contra el listado real

No cambia código. Queda registrado porque sirve para saber cuánto fiarse de las simulaciones futuras.

**Predicción hecha el 14/10 a las 19:38 UTC** (22 min antes del cierre, con precios de media sesión)
**contra el top real del build de las 21:59 UTC** con el cierre del 14:

```
  #   predicho            real
  1.  CDNA  88,5          PAYS  87,0
  2.  PAYS  87,0          PLTR  87,0  *
  3.  PLTR  86,5          HALO  85,0  *
  4.  HALO  84,0          CDNA  84,0
  5.  SLDE  83,0          SLDE  83,0   =
  6.  HNGE  80,5          HNGE  80,5   =
  7.  P     79,5          P     80,0   = *
  8.  FIGS  77,5          FIGS  78,0   =
  9.  SHOP  77,5          SHOP  78,0   = *
 10.  TEAM  77,0          TEAM  77,0   = *

composicion: 10 de 10 (ni una fuera, ni una de mas)
puesto exacto: 6 de 10 (el top 4 se reordeno)
grandes: 5 de 5 acertadas -> PLTR, HALO, P, SHOP, TEAM
```

**Qué se aprende para la próxima.** Una simulación a 22 minutos del cierre es fiable para la
composición y para contar cuántas grandes entran, y poco fiable para el orden de los primeros puestos,
donde unas décimas de puntuación bailan el ranking. Conviene no presentar el orden como predicción.

**Disparador de vigilancia: NO se activa.** 5 de 10 por encima de 10 B; el umbral está en 8.

**Los cambios del 14 funcionan sobre datos reales.** 353 comprobaciones en verde con megacaps dentro.
El aviso ámbar sale en 10 de las 35 en seguimiento y en 0 del top 10. El mensaje de SHMD (231 M, por
debajo del suelo) dice ahora "ha caído por debajo del mínimo" y no "ha superado el techo".

**Margen del stop en el top 10 real:** grandes 3,70 días de rango, pequeñas 3,01. Ninguna por debajo de
1 día: el mejor top en calidad de stop registrado hasta la fecha. (Sigue sin ser un argumento de
rentabilidad: el 14 de octubre se midió que el margen NO predice el resultado.)

**Y empeora el problema de la fórmula de tamaño.** De las 10 con aviso ámbar, **7 tocan el tope del
25 %**, frente a 2 de 9 el día anterior:

```
        stop    ADR  margen   % cartera
XRPN   3,0 %  45,2 %   0,07     25,0 %  tope
ELMT   1,0 %   8,4 %   0,13     25,0 %  tope
QMCO   3,7 %  12,3 %   0,30     25,0 %  tope
FWDI   2,3 %   7,2 %   0,32     25,0 %  tope
XMTR   2,2 %   5,9 %   0,37     25,0 %  tope
PGEN   2,4 %   6,1 %   0,39     25,0 %  tope
COHU   2,9 %   5,5 %   0,53     25,0 %  tope
```

ELMT tiene el stop a **un 1,0 %** con un ADR del 8,4 %. Hoy ninguna de esas 10 está en el top 10, así
que el panel no muestra importe de compra para ellas (solo aparece con veredicto COMPRA) y los dos
conjuntos son disjuntos. **El día que una entre al top con señal de compra, el panel pedirá un cuarto
de la cartera con un stop de ruido.** Es lo primero que hay que resolver cuando lleguen las 30 entradas
maduras (pregunta 5 de la sección 7).

---

## 16 de octubre de 2026 — ventas parciales

**Petición:** poder vender solo una parte de una posición, típicamente para sacar liquidez de una que
sube mucho pero a la que no le toca venderse según el protocolo.

**Decisión de diseño: el precio medio de compra NO cambia.** Es lo que más despista y conviene dejarlo
escrito. Vender parte no abarata las acciones que quedan: siguen costando lo mismo por acción. Lo que
cambia es cuántas tienes, cuánto capital sigue dentro y cuánta ganancia ha pasado a dinero real.

Esto **no es un detalle cosmético, es lo que mantiene intacto el protocolo**: el stop, la subida del
stop al +20 % y la regla de devolución se miden todos contra el precio de compra. Si una venta parcial
lo moviera, el stop de la parte que te quedas se desplazaría sin que nada lo justifique. `evaluaPosicion`
no recibe el nº de acciones, así que estructuralmente no puede verse afectada; se comprueba igualmente
de punta a punta pintando la misma posición con 100 acciones y con 60 y exigiendo el mismo veredicto y
el mismo stop.

**Cómo se guarda.** Una venta parcial crea una operación CERRADA aparte (`parcial: true`, con su `id` y
el nº de acciones vendidas) y resta ese número a la posición abierta. Así el historial, el beneficio
mensual y la curva de la cuenta la cuentan solas, sin tocar una línea de su código. Compatible con el
formato anterior: los registros existentes no llevan `parcial` ni `id` y se comportan igual que antes.

**Tasa de acierto: cuenta posiciones, no salidas.** Una posición vendida en dos veces es UNA operación
con dos salidas. Si contara dos, el «acertadas X de Y» se infla, y ése es justo el número con el que se
juzga la estrategia. Cada salida sigue siendo su propia fila y el dinero suma todas. Sin ventas
parciales, cada grupo tiene una sola salida y las cifras son idénticas a las de siempre.

**Riesgo de pérdida de datos, encontrado y arreglado antes de publicar.** Al borrar una venta parcial del
historial, las acciones vendidas no volvían a la posición abierta: corregías un error de anotación y de
paso perdías 40 acciones de tu registro sin que nada avisara. Ahora vuelven, y el diálogo de borrado
dice con cuántas se queda la posición. Dado que ese historial vive solo en el navegador y no se puede
regenerar, era el fallo más grave de este cambio.

**Lo que muestra el formulario antes de confirmar:** acciones que vendes y porcentaje, lo que cobras, la
ganancia que realizas, cuántas quedan, el precio medio con un «NO cambia» explícito, el capital que
sigue dentro, el valor de lo que queda y lo ya vendido en ventas anteriores. Atajos de ½, ⅓, ⅔ y todo.
Si la posición no tiene nº de acciones anotado, se dice que hay que añadirlo primero en vez de aceptar
una venta parcial que no se puede calcular.

**Pruebas.** 373 comprobaciones en verde (de 353). De las 20 nuevas, 6 fallan contra el código anterior;
el resto son invariantes que el cambio no debía romper (el precio de compra, el stop, el veredicto, la
suma de dinero, la compatibilidad con el formato viejo).

**Dos pruebas mías inútiles, cazadas antes de publicar.** Una comparaba dos llamadas idénticas a
`evaluaPosicion` y por tanto no medía nada; se rehízo pintando la posición entera y la partida y
comparando veredicto y stop. La otra buscaba el precio medio en la tarjeta de un ticker inventado que no
tiene cotización en `panel.json`, así que esa línea no se pintaba nunca y el fallo era de la prueba, no
del código.

---

## 16 de octubre de 2026 (2) — vender por importe, no solo por nº de acciones

**Petición, con sus números:** "tengo 500 € invertidos, la posición llega a 800 y vendo 400". Es como se
piensa de verdad cuando lo que hace falta es liquidez: por dinero, no por acciones.

**Qué se añade.** Un segundo campo, «…o ¿cuánto quieres cobrar?», atado al de acciones: escribes en uno
y el otro se recalcula con el precio de venta. La conversión se topa en el total, así que pedir más
dinero del que vale la posición vende la posición entera y no más.

El ejemplo, resuelto: 50 acciones a 10 $ (500 $ invertidos), precio 16 $ (vale 800 $), vendes 400 $ →
25 acciones, quedan 25, capital dentro 250 $, lo que queda vale 400 $, ganancia realizada +150 $.

**Atajo añadido, que no se pidió pero es el caso natural: «recuperar lo invertido».** Vende justo el
capital que pusiste y deja corriendo solo la ganancia. En el ejemplo: 31,25 acciones a 16 $ = 500 $, y
quedan 300 $ corriendo. A partir de ahí la posición ya no puede devolverte menos de lo que invertiste.
Si no hay ganancia, lo dice en vez de calcular un número sin sentido.

**Precisión de las acciones.** Vender por importe produce fracciones (400 $ a 16,30 $ son 24,5399
acciones). Se añade `nAcc`: entero sin decimales y hasta 4 cuando sale fraccionado, usado en todos los
sitios donde antes se redondeaba a 2. **El número que se ve es el que se guarda**; antes habrían
discrepado.

**La aritmética se extrajo a `window.ACCIONES_POR_IMPORTE(importe, precio, total)`, función pura.** No
es cosmética: vivía dentro del manejador del campo, y el DOM de juguete de las pruebas no despacha
eventos (`addEventListener` es un no-op), así que no había forma de probarla. La primera versión de las
pruebas comprobaba la aritmética **con una copia de la fórmula escrita en el propio fichero de
pruebas**, lo cual no prueba nada del código: 8 de 13 comprobaciones pasaban igual con el código
anterior. Con la función extraída, las 15 fallan sin el cambio.

**Una prueba frágil propia, borrada en vez de parcheada.** Había una que verificaba por regex la línea
exacta `pon(ac.i, c > 0 ? (total ? Math.min(c / v, total) : c / v) : null)`. Al extraer la función esa
regex dejó de encajar y la prueba se puso roja sin que hubiera ningún fallo: probaba un detalle de
implementación, no una conducta. El tope lo cubre ahora la prueba funcional `vpConv(900, 16, 50) === 50`.
Es el cuarto caso de regex sobre código fuente que se rompe en este proyecto; conviene no escribirlas.

**Y el mismo error de ayer repetido:** las comprobaciones nuevas reventaban la suite con un `TypeError`
cuando la función no existía, en vez de dar `✗` y seguir. Corregido con la misma guarda de `typeof` que
se puso para `MARGEN_STOP`.

**Pruebas.** 390 comprobaciones en verde (de 373). Las 15 nuevas fallan contra el código anterior.

---

## 16 de octubre de 2026 (3) — añadir a una posición: ya existía, y cambiaba el stop sin decirlo

**Corrección de algo que dije mal.** Afirmé que "añadir a una posición" no existía y que era lo único
que faltaba. **Existía desde antes**, en `window.ampliarCompra`: tres `prompt()` encadenados que
recalculaban el precio medio ponderado y lo guardaban. La aritmética era correcta.

**Lo que estaba mal era lo que no decía.** Cambiar el precio medio **mueve el protocolo**, porque el
stop, el nivel del +20 % al que el stop sube al precio de compra y la regla de devolución se miden
todos contra ese precio. La versión de `prompt()` lo cambiaba sin avisar de nada.

**Cuánto lo mueve, medido.** Con precio 20 $ y la EMA 50 lejos, promediar de 10 $ a 15 $:

```
stop            10,00 $  ->  15,00 $
distancia       50 %     ->  25 %      (la mitad de margen)
```

No es un efecto de segundo orden: superado el +20 % de ganancia el stop sube **al precio de compra**
(`gananciaProteger`), así que promediar al alza lo arrastra directamente. Por debajo del +20 % manda el
tope del 15 % desde la compra, que también sigue al medio (17,00 → 21,25 en el caso probado).

**Y una consecuencia que no había visto nadie: promediar al alza puede DESACTIVAR la regla de
devolución.** Se mide contra el precio medio, así que subirlo encoge la ganancia máxima medida, y por
debajo del +30 % la regla deja de aplicarse. Con un máximo visto de 26 $:

```
precio medio 10 $  (+160 %)  ->  vender al devolver el 40 %
precio medio 20 $  (+30 %)   ->  vender al devolver el 50 %
precio medio 21 $  (+23,8 %) ->  NO APLICA: solo queda el stop
```

Perder una protección sin enterarse es peor que no tenerla. El formulario ahora enseña esa línea con
los dos números cuando el límite cambia.

**Qué se ha hecho.** `window.ampliarCompra` (prompt) se retira y se sustituye por `formularioAnadir()`,
en línea como el de venta: precio, nº de acciones **o importe invertido** (atados por
`ACCIONES_POR_IMPORTE`), fecha, y previsualización en vivo con acciones nuevas y totales, precio medio
antes → después, capital invertido, valor a precio de hoy, ganancia en % antes → después, **stop antes →
después**, riesgo abierto antes → después y la línea de la regla de devolución. La aritmética se extrae
a `window.NUEVO_PROMEDIO`, pura y probada.

Se avisa en los dos sentidos: al alza, de lo que sube el stop y de la devolución; a la baja, de que
bajar el precio medio **baja el stop** y de que este panel busca fuerza y no rebajas, así que añadir a
una que está en VIGILAR o VENDER es lo contrario de lo que dice el sistema. **Se avisa, no se bloquea.**

**Se guarda el desglose `compras: [{fecha, precio, acciones}]`** y la tarjeta lo muestra ("precio medio
de 2 compras: 100 a 10,00 $ + 20 a 20,00 $"). Un precio medio calculado tiene que ser auditable. La
fecha de la posición NO cambia: sigue siendo la de apertura.

**Fallo latente arreglado antes de que el promedio lo activara.** `partesVendidas` calculaba la ganancia
realizada de las ventas parciales con el precio medio **actual** (`p.precio`) en vez de con el de esa
venta (`x.precio`). Hoy daban el mismo número porque el precio medio no cambiaba nunca; en cuanto se
puede promediar, el beneficio de una venta ya hecha se habría reescrito solo. Comprobado con una
posición que vendió 40 a 25 $ con coste 10 $ y luego promedió a 15 $: mantiene su +600 $.

**Pruebas.** 411 comprobaciones en verde (de 390). De las 21 nuevas, 13 fallan contra el código
anterior; el resto son invariantes.

**Dos aserciones mías equivocadas, corregidas.** Esperaba que el stop fuera `compra × 0,85` (8,50 y
12,75) y la realidad era 10,00 y 15,00, porque con la ganancia por encima del +20 % manda la protección
del coste y no el tope del 15 %. Y esperaba que el stop cambiara con la EMA 50 por encima del tope,
donde manda la EMA 50 y no cambia nada. El código estaba bien; mis expectativas, mal. El efecto real
resultó ser **más grande** que el que había supuesto.

---

## 16 de octubre de 2026 (4) — auditoría de stops y señales. Un stop sin sentido en pantalla

Petición: revisar que los stops y las señales de MANTENER / COMPRAR / VENDER estén bien.

**Método: invariantes sobre los datos reales, no lectura del código.** Se montan `reglas.js`,
`puntuacion.js`, `app.js` y `posiciones.js` en un contexto y se comprueba que no se contradicen.

**1. Stops y veredictos de entrada — 36 acciones, 6 invariantes cada una.** Encontró un fallo:

```
ABSI: stop de entrada 9,28 $ POR ENCIMA del precio 8,88 $
AXTI: 70,50 sobre 57,91    BAND: 54,18 sobre 49,60    COHU: 59,75 sobre 54,90
FEIM: 75,02 sobre 69,98    QMCO: 24,62 sobre 21,61    SHMD:  4,08 sobre  3,01
```

7 de 36. La causa: `stopDeEntrada` llama a `stopDe(datos, precio, null)`, que devuelve
`max(EMA 50, precio × 0,85)`. Si el precio ya cotiza **por debajo** de su EMA 50, ese máximo es la
EMA 50 y queda por encima del precio. No es un stop: entrar ahí sería entrar ya saltado.

**El dinero nunca estuvo en juego**, y conviene decirlo con precisión: las 7 daban ya "Ya no cumple",
y `TAMANO` devuelve null con una distancia positiva, así que el panel no proponía ningún importe. Era
un **número sin sentido en pantalla**: Seguimiento mostraba "Stop del sistema: 9,28 $ (+5 %)", un
porcentaje positivo que se lee exactamente igual que un stop normal.

**Arreglado en el origen.** `stopDeEntrada` devuelve `invalido: stop >= precio`, `SALIDA` lo propaga, y
las pantallas lo dicen: en Hoy el valor es «—» con «sin stop válido: el precio ya está por debajo de su
EMA 50 (9,28 $)» en ámbar, y en Seguimiento «sin stop válido (bajo la EMA 50)». Con el stop inválido no
se calcula ni margen en días de rango ni importe de compra, porque las dos cosas se calculaban sobre un
stop que no existe.

**2. Posiciones abiertas — 216 simulaciones (36 acciones × 6 precios de compra), 6 invariantes cada
una: sin ninguna contradicción.** Lo comprobado:
- `vender` siempre trae al menos un motivo; `vigilar` trae avisos y ningún motivo; `mantener` no trae ni
  motivos ni avisos.
- Si el precio está por debajo del stop, el estado es `vender`. Sin excepciones.
- El stop nunca queda por debajo del 85 % del precio de compra (el tope del 15 % declarado).
- Con ganancia ≥ 20 %, el stop nunca queda por debajo del precio de compra (protección del coste).
- El trinquete aguanta: con un `stopPrevio` más alto, el stop nunca baja.
- Todo motivo y todo aviso tiene texto legible; ninguno se mostraría con el código crudo.

**3. Coherencia del color con el texto:** los 8 veredictos posibles se pintan con la clase que les
corresponde. Sin fallos.

**4. Ciclo de venta parcial — conservación del dinero.** Cuatro ciclos completos (compra, promedio,
una o dos ventas parciales, resto abierto) comprobando que **realizado + latente = dinero que entra −
dinero que sale**, al céntimo. Cuadra en los cuatro, incluidos los que pierden.

**Pruebas.** 425 comprobaciones en verde (de 411). De las 14 nuevas, 10 fallan contra el código
anterior; las otras 4 son invariantes que ya se cumplían y ahora quedan fijadas.

**Alcance de esta auditoría, dicho con precisión.** Se han revisado la **cadena del stop**
(`stopDe`, `stopDeEntrada`, el trinquete, el tope del 15 %, la protección del coste), la **cascada de
veredictos** y la **aritmética de las ventas parciales y el promedio**. NO se ha revisado la puntuación
(114 umbrales, intactos), ni la pestaña Resultados más allá de que se pinta, ni el régimen de mercado.

---

## 16 de octubre de 2026 (5) — auditoría de lo que faltaba: puntuación, Resultados, régimen, datos, respaldo

Se auditan con el método de invariantes las áreas que la auditoría anterior dejó fuera.
**Dos hallazgos, uno de ellos corrompía la medición pendiente de noviembre.**

### Hallazgo 1 (el importante): un día fantasma guardado, el domingo 2026-10-04

**Prueba:** el precio del SPY de ese día (769,64) es **idéntico** al del viernes anterior. El escáner
devolvió los cierres del viernes con fecha de domingo. Es anterior a `sin_cierre_nuevo()`, que se añadió
el 7 de octubre y lo habría impedido; el día ya guardado nunca se retiró.

**Por qué importa.** Cuenta como sesión. La pestaña Resultados mide la madurez de cada entrada en
sesiones (15 para madurar, 30 maduras para concluir), así que **todas las entradas anteriores al 5 de
octubre parecían una sesión más maduras de lo que eran.** Es exactamente la medición que hay que hacer
en noviembre para decidir sobre el techo de capitalización y sobre el stop proporcional al ADR.

**Qué se ha hecho.** El fichero se ha **movido** a `auditoria/dias-retirados/2026-10-04.json`, no
borrado: es parte del registro y no se destruye. Se ha quitado de `dias` y de `historico` en
`panel.json`. `precios.json` empieza el 6 de octubre, así que no le afectaba. Los días pasan de 12 a 11.

**Tres guardas nuevas en `filtros.test.py`** para que no vuelva a entrar ninguno sin que nadie lo note:
ningún fichero en fin de semana, ningún par de días consecutivos con el mismo precio del SPY, y ningún
día vacío. Verificadas devolviendo el domingo a su sitio: fallan dos de las tres.

Barrido de los 12 días: **solo había uno**. Los días 1 y 2 de octubre tienen 3 y 9 acciones en vez de
10, pero su SPY es distinto: era el arranque del sistema con pocas candidatas, no un fantasma.

### Hallazgo 2 (menor): un formateador muerto que mostraría "1141,0 B"

`docs/export.js` tenía su propio `capT` sin el tramo T que se añadió ayer a `app.js` y `puntuacion.js`.
Estaba **muerto** (definido y nunca usado), así que nunca mostró nada mal. Retirado, y añadida una
comprobación en `integridad.test.js` que recorre los cinco ficheros buscando cualquier formateador que
divida por 1e9 y acabe en "B" sin cubrir 1e12.

### Lo auditado sin encontrar nada

**Puntuación — las 15 escaleras.** Las 10 escritas con `tramo()`: umbrales estrictamente decrecientes y
puntos estrictamente decrecientes, así que ningún escalón es inalcanzable y ninguno premia menos por
más. Las 5 escritas como ternarios encadenados (`pRsi`, `pCons`, `pMn`, `pMax`, `pTam`) barridas
numéricamente sobre su dominio: todos los escalones declarados son alcanzables y no aparece ninguno sin
declarar. Es la prueba que habría cazado el fallo del RSI del 11 de octubre.

**Puntuación — 10 invariantes sobre las 36 acciones reales:** total y `sinPenalizar` acotados a 0-100;
`sinPenalizar` nunca menor que `total`; cada uno de los 5 bloques dentro de su máximo declarado
(25/25/20/15/15); penalización acotada a 15; bonus a 5 y tamaño a 5; **el total declarado es la suma
real de las partes** menos penalización más bonus; ningún valor no finito en toda la salida (recorrido
recursivo); `extendida` concuerda con penalización ≥ 9; sin dato de crecimiento se avisa como riesgo; y
ningún texto contiene "undefined", "NaN" ni "null".

**Régimen de mercado.** Recalculado desde los datos: SPY 771,79 sobre su SMA 200 de 724,63, y solo 1 de
los 3 índices sobre su EMA 50 → **desfavorable**, que es lo que el panel declara. `spySobre200` e
`indicesSobre50` guardados coinciden con el recálculo. Con el mercado en contra el panel reduce el top
a 3, y la regla está en el código.

**Resultados.** 35 entradas distintas, ninguna contada dos veces, ninguna con más sesiones que días
guardados. 0 maduras de las 30 que hacen falta: la más antigua (YDES) lleva 11 sesiones de las 15.

**Integridad de los datos.** 11 días, sin duplicados, en orden cronológico, ninguno vacío, ninguno con
una acción sin precio válido, ninguno sin el precio del SPY. Todos los símbolos del top tienen datos de
hoy y formato válido para el enlace a TradingView.

**Coherencia de la documentación.** `REQUISITOS` devuelve 9 y Parámetros habla de 9; los de solo entrada
son 2 (capitalización y precio mínimo), como dice la tabla; y los umbrales publicados coinciden con los
criterios reales (RSI 55, crecimiento 20 %, 20 % desde el máximo, sin techo).

**Respaldo de posiciones — ida y vuelta.** Tres posiciones con todos los campos nuevos (`parcial`, `id`,
`compras`, `maxVisto`, `stopMax`) exportadas y restauradas: **idénticas campo por campo**. `maxVisto` y
`stopMax` importan especialmente, porque sin ellos el stop y la regla de devolución se recalculan mal.
Una copia con formato inválido se rechaza antes de tocar nada.

### Pruebas

436 comprobaciones en verde (de 425).

**Fallo propio: rompí una prueba existente.** Mi bloque del respaldo vaciaba `posiciones-v1` al acabar y
la prueba siguiente contaba con encontrar las posiciones que ya había. Mutar estado compartido entre
bloques. Arreglado guardando y restaurando el estado anterior.

### Lo que sigue SIN auditar, y lo digo porque me lo han pedido "todo"

- **El valor de los 114 umbrales.** Se ha comprobado que son *coherentes* (alcanzables, ordenados,
  acotados). **No** que sean *los correctos*: eso necesita 150-200 entradas maduras, primavera de 2027.
- **La pestaña Resultados en funcionamiento.** Se ha auditado el conteo de madurez, no las conclusiones
  que dará cuando se desbloquee, porque todavía no hay ninguna entrada madura.
- **El comportamiento real del navegador.** Todo esto corre sobre un DOM de juguete. No he abierto la
  web en un navegador de verdad ni comprobado el diseño en un móvil físico.
- **Los datos de TradingView.** Se comprueba que llegan y son coherentes, no que sean correctos.

---

## 16 de octubre de 2026 (6) — abierta en un navegador de verdad

Última capa que las pruebas no tocan: todas corren sobre un DOM de juguete. Se abre la web publicada,
se recorren las cinco pestañas, se crea una posición de prueba y se usan los formularios.

**Cuatro defectos que ninguna prueba podía cazar**, los tres primeros porque son cadenas estáticas y
el cuarto porque solo se ve con una posición ganadora delante:

**1. El titular describía un sistema que ya no existe.** «Las 5 empresas **pequeñas y medianas** de
EE. UU. con más momentum», justo encima de PLTR con 481,8 B. En cuatro sitios: la meta descripción
(que además decía "Las 10"), el subtítulo visible, el objetivo de Parámetros y **el texto del PDF que
lee la auditoría externa**. Ese último es el peor: una auditoría externa partiría de una descripción
falsa del sistema.

**2. El aviso de modo defensivo decía "se muestran solo 5 candidatas"** con el 5 escrito a mano, y con
el mercado en contra el top baja a 3. En pantalla se leía «solo 5 candidatas» y debajo «Top 3».
Atado a `S.top`.

**3. "Si salta el stop: −1.024,84 $"** en una posición comprada a 120 con el stop en 180. Si salta ese
stop se **ganan 3.000 $**. La cifra era lo que devuelves desde el valor actual, pero con el signo menos
delante se lee como una pérdida, en la pantalla donde está el dinero. Ahora dice con cuánto te quedas y,
entre paréntesis, lo que devuelves desde ahora.

**4. "6000,0026"** en el campo de importe al ir y volver entre acciones e importe: los dos se
redondeaban a 4 decimales. Acciones a 4 (pueden ser fraccionadas), dinero a 2.

**Guardas nuevas** en `integridad.test.js`: ningún fichero puede decir «pequeñas y medianas», ni «Las N
empresas», ni «se muestran solo N candidatas» con el número escrito a mano.

### Corrección de algo que afirmé sin comprobar

Dije que el stop inválido **se veía** en Seguimiento como «Stop del sistema: 9,28 $ (+5 %)».
**Comprobado en el navegador: esas 7 acciones no aparecen en ninguna pestaña**, solo se cuentan como
«16 descartadas». Lo deduje del código sin comprobar si esas fichas llegan a pintarse. El arreglo sigue
siendo correcto, pero es **defensivo**: no corregía nada que estuviera viéndose.

### Lo verificado funcionando

- Cero errores de consola en las cinco pestañas.
- Tema oscuro por defecto; las cinco pestañas pintan.
- Las 18 fichas vivas de Seguimiento: todos los stops con porcentaje **negativo**, ninguno positivo.
- Resultados dice «11 sesiones guardadas» y «ninguna con las 15 de recorrido»: el día fantasma retirado
  se refleja, y no promete conclusiones que no tiene.
- **Venta parcial por importe, en vivo:** 4.000 $ a 200,50 $ = 19,9501 acciones (40 %), realizado
  +1.605,98 $, quedan 30,0499, precio medio intacto en 120,00 $, capital dentro 3.605,99 $. Al céntimo.
- **«Recuperar lo invertido»:** 29,9252 acciones, cobras exactamente los 6.000 $ invertidos y quedan
  20,0748 acciones (4.025 $), que es la ganancia entera corriendo.
- **Móvil (375 px):** sin desbordamiento horizontal, tarjetas apiladas, pestañas con scroll y altura
  táctil suficiente.

**Pruebas.** 437 comprobaciones en verde.

**Sigue sin comprobarse:** un móvil físico (esto es emulación), navegadores que no sean Chromium, y el
valor de los 114 umbrales, que necesita las entradas maduras de la primavera de 2027.

---

## 17 de octubre de 2026 — los días 1 y 2 de octubre eligieron el top por capitalización, no por puntuación

Nace de una observación suya: «el listado de seguimiento cambia muchísimo, solo PAYS y CDNA se
mantienen». Medido, resultó ser medio cierto y por un motivo que no era la rotación.

**El fallo.** Los ficheros del 1 y el 2 de octubre tienen `referencia.sectores` **vacío**. Sin medianas
de sector no hay fuerza relativa, así que `puntua()` devolvió 0 para todas, y el desempate de `main()`
—`sorted(key=lambda a: (-nota(a), a.get("cap") or 0))`, "a igualdad, la de menor capitalización"—
**eligió el top entero**. Esos dos días el panel no enseñó las mejores: enseñó **las 10 más pequeñas**.

Se ve en los datos: `sc` es `null` para las 12 entradas de esos dos días, y la capitalización mediana
fue 1.257 M y 674 M, frente a 3.300-13.000 M del resto de días.

**La guarda que lo impide ya existe** (`comprueba()` aborta con menos de 5 sectores en la referencia),
pero se añadió el **4 de octubre**, después. Esos dos días se colaron antes de que existiera.

**Qué ensuciaba.** 10 tickers existen **solo** por esos dos días: YDES, BAND, QMCO, XRPN, SVIA, ELMT,
AXTI, FWDI, ABSI, SHMD. Son los mismos que llenaban Seguimiento de stops apretados y avisos ámbar.
Contaban como entradas en la pestaña Resultados, que es la medición de noviembre.

**La rotación real, una vez quitados:**

```
                                  con los 2 dias malos    sin ellos
permanencia de un dia al siguiente       63 %               76 %
entradas de un solo dia                  34 %               16 %
dias medios en el top                     2,9                3,6
```

Y no son dos las que aguantan, son seis: PAYS 9/9, CDNA 9/9, RSKD 8/9, HNGE 8/9, ZETA 7/9, SLDE 7/9.
PLTR lleva 2 de 2 desde que entró el 14, no fue un día suelto.

**Qué se ha hecho.** Los dos ficheros se **mueven** a `auditoria/dias-retirados/`, no se borran, junto
al domingo fantasma del 4. Quitados de `dias` y `historico`. Quedan **9 sesiones y 25 tickers, todos
con puntuación real**. Cuesta dos sesiones de madurez, y vale la pena: la alternativa es medir en
noviembre con 12 entradas que el sistema nunca eligió.

**Tres guardas nuevas en `filtros.test.py`**, que miran los datos YA guardados —que es lo que
`comprueba()` no hace, porque solo valida el día que se está generando—: ningún día con menos de 5
sectores en la referencia, ningún día del histórico entero sin puntuación, y los días de `panel.json`
tienen que ser exactamente los ficheros guardados. Verificadas devolviendo un día malo: fallan dos.

**Respuesta a la pregunta.** Sí había rotación anormal, pero no era rotación: eran dos días de datos
mal seleccionados. La rotación de verdad —76 % de permanencia diaria, 3,6 días de media— es la normal
de un sistema de momentum con un corte duro en el puesto 10: una acción en el puesto 10 u 11 entra y
sale con décimas de puntuación. Eso no es un fallo, es el corte.

**Pruebas.** 456 comprobaciones en verde (de 453).

---

## 17 de octubre de 2026 (2) — el festivo se caza por el S&P 500, no por los tickers

Observación suya: «hay fines de semana y festivos a lo largo del año y esos días la cotización no se
mueve». Correcto, y la guarda tenía un agujero concreto.

**El agujero.** `sin_cierre_nuevo()` detectaba el festivo comparando precio a precio con el día
anterior, pero exigía **3 tickers en común**. El domingo fantasma del 4 de octubre no compartía
**ninguno** con el día anterior, así que esa comparación no tenía nada que comparar y no podía
dispararse. Lo salvó el `weekday() >= 5`, que solo cubre sábados y domingos. **Un festivo entre semana
con el top rotado del todo se habría colado igual.**

**El arreglo.** Se compara el cierre del **S&P 500** con el de la sesión anterior. El SPY siempre está
y no depende de que el top se parezca al de ayer: es la prueba que identificó el domingo fantasma
(769,64 idéntico al viernes).

**Y con una salvaguarda, porque el SPY puede cerrar igual dos días seguidos por azar.** No es
despreciable: con el SPY en torno a 770 y céntimos, pasa cada pocos años. Si el SPY coincide **pero
alguna acción sí se ha movido**, hubo sesión y el día se guarda. Solo bloquea cuando no se mueve nada.

**Los siete escenarios del calendario, comprobados:**

```
sabado                                         NO se guarda  (fin de semana)
domingo                                        NO se guarda  (fin de semana)
festivo entre semana                           NO se guarda  (SPY identico)
festivo con el top cambiado entero             NO se guarda  (SPY identico)   <- el agujero
el Action corre a las 8 de la manana           NO se guarda  (antes del cierre)
sesion normal                                  SE GUARDA
SPY igual por azar pero las acciones se mueven SE GUARDA                      <- la salvaguarda
```

**Dirección del fallo.** Si alguna vez se equivoca, se equivoca saltándose un día real, no inventando
uno. Es la dirección correcta: un día que falta es un hueco; un día inventado corrompe la medición.

**Pruebas.** 464 comprobaciones en verde (de 456). Las 8 nuevas fallan contra el código anterior
—revienta con `TypeError` al cambiar la firma, que hace fallar el build igual—, y una de ellas
documenta explícitamente el caso que se colaba.

---

## 18 de octubre de 2026 — rejilla sobre los ocho veredictos

Extensión de la verificación de «Esperar» a toda la cascada. No cambia código: añade pruebas.

**Por qué hacía falta.** El arreglo de la ventana de compra se verificó con una rejilla y apareció un
caso que no se había considerado (ventana de anchura cero). Si una rejilla encontró eso en un solo
veredicto, los otros siete no tenían ninguna.

**Qué cubre.** 1.440 combinaciones: distancia al máximo (4 valores) × posición de la EMA 50 (5) ×
RSI (6) × requisitos rotos (3 conjuntos) × estado (4: normal, extendida, flojea, sin seguimiento).

**Siete invariantes, en todas:**
1. El veredicto es uno de los ocho conocidos.
2. Su color es el que le corresponde.
3. Ningún texto contiene `undefined`, `NaN` ni `[object`.
4. COMPRA nunca con un requisito obligatorio roto.
5. COMPRA nunca con señales de deterioro.
6. COMPRA nunca lejos de su máximo ni con el tope del 15 % mordiendo.
7. El stop mostrado es siempre el de `reglas.js`, y solo «Compra arriesgada» y «Esperar» llevan
   etiqueta de precio.

**Y la que habría cazado el escalón muerto del RSI: los 8 veredictos tienen que ser ALCANZABLES.**
Reparto real: Ya no cumple 720, Sin datos 360, No comprar 120, No comprar aquí 80, Vigilar 80,
Esperar 40, Compra arriesgada 20, COMPRA 20.

**Verificado inyectando tres fallos distintos:**
- un veredicto con el color cambiado → cazado por la invariante 2
- un texto con un campo inexistente → cazado por la 3, con el `undefined $` en el mensaje
- COMPRA inalcanzable → cazado por la comprobación de alcanzabilidad

**Fallo propio en la propia prueba, corregido.** La comprobación de alcanzabilidad permitía que
faltara un veredicto (`faltan.length <= 1`), así que con COMPRA muerta decía «7 de 8» y lo daba por
bueno: la prueba no probaba nada. Es exactamente el modo en que el escalón del RSI vivió semanas. Se
exige ahora que estén los 8.

**Pruebas.** 513 comprobaciones en verde (de 507).

**Lo que esto NO cubre, dicho con precisión.** Verifica la coherencia interna de la cascada de
veredictos, no que los umbrales sean los correctos. Y no cubre `evaluaPosicion` (las posiciones
abiertas), que tiene su propia auditoría de 216 simulaciones del 16 de octubre pero no una rejilla
de este tipo.

---

## 18 de octubre de 2026 (2) — rejilla sobre las posiciones abiertas. Una rama muerta

Extensión de la rejilla al camino de `evaluaPosicion`, que es donde está el dinero. **6.720
combinaciones**: precio/compra (7) × EMA 50 (4) × RSI (5) × máximo visto (4) × requisitos rotos (4) ×
días hasta resultados (3).

### El hallazgo: el motivo `ema50` estaba muerto

0 de 6.720. Y es demostrable, no estadístico: el stop es siempre `max(EMA 50, …)`, así que si el
precio pierde la EMA 50 ya está por debajo del stop y lo coge la rama anterior. El `else if` del
código `ema50` **no podía ejecutarse nunca**.

```js
if (stop != null && precio < stop) motivos.push({ codigo: 'stop', stop, ema50 });
else if (ema50 != null && precio < ema50) motivos.push({ codigo: 'ema50', ema50 });   // <- muerta
```

**No cambiaba nada en pantalla**: el mensaje de `stop` ya dice lo correcto, porque en ese caso el stop
*es* la EMA 50. Lo que sí estaba mal es que **la tabla 5 de Parámetros lo describía como una regla
aparte** («Pérdida de tendencia: cierre por debajo de la EMA 50 o RSI por debajo de 45»), y esa tabla
es la que lee una auditoría externa. Corregida: perder la EMA 50 no es una regla aparte, es saltar el
stop.

**El código `ema50` sigue vivo** en `senalesDeMercado`, que es el camino de las acciones que NO tienes
y donde no hay stop de por medio. Solo se quitó la rama de `evaluaPosicion`, con una prueba que ata
las dos cosas: que no se emita desde una posición abierta y que sí se emita desde el seguimiento.

### Siete invariantes, en las 6.720

1. `vender` siempre con motivo; `vigilar` con avisos y sin motivos; `mantener` sin nada.
2. Por debajo del stop, el estado es siempre `vender`.
3. El stop nunca cae por debajo del 85 % del precio de compra.
4. Con ganancia ≥ 20 %, el stop nunca queda por debajo del precio de compra.
5. El trinquete aguanta: con un `stopPrevio` mayor, el stop no baja.
6. Ningún valor no finito en `stop`, `gan`, `ganMax` ni `devuelto`.
7. El límite de devolución es exactamente el que devuelve `limiteDevolucion(ganMax)`.

Reparto de estados: vender 5.505, vigilar 1.047, mantener 168. Y de los 9 códigos vivos de posición
abierta no queda ninguno sin emitir.

### Verificado inyectando tres fallos en el protocolo

- trinquete desactivado → cazado
- protección del coste al +20 % desactivada → cazado por dos pruebas
- tope del 15 % aflojado al 40 % → cazado por dos pruebas

### Cobertura, al cierre del día

Las dos cascadas que deciden con dinero tienen ya rejilla exhaustiva: **1.440 combinaciones** para los
8 veredictos de compra y **6.720** para el protocolo de salida. Lo que sigue sin rejilla: la
puntuación (tiene el barrido de las 15 escaleras del 16/10), la pestaña Resultados y la aritmética de
posiciones (cubierta por pruebas concretas, no exhaustivas).

**Pruebas.** 519 comprobaciones en verde (de 513).

---

## 22 de octubre de 2026 — el panel se quedó dos días sin actualizar. Causa y arreglo

Lo detectó él: el aviso rojo decía «Datos de hace 2 días de mercado». **El aviso funcionó. Lo que
falló fue todo lo demás.**

### Qué pasó

El build del **21 de octubre no publicó nada**. La causa: `humo.test.js` falla, y el workflow lo
ejecutaba **antes** de `build.py` como condición para publicar. Sin test verde, no hay datos.

La aserción que falló llevaba días siendo frágil. Comprobaba que el orden de las tarjetas de
Seguimiento fuera **exactamente** el orden de nota, y eso **es falso por diseño**:

```js
if (!VER_TODAS) r = r.filter((a, i) => i < 5 || imprescindible(a));
```

Seguimiento enseña los 5 mejores por nota **más cualquiera con señales de salida o que tengas
comprada**, para que un deterioro no se quede fuera de pantalla. El 21 apareció ARQT (nota 80) en
sexto lugar por delante de KNSA (82) porque ARQT tenía señales. La prueba lo llamó fallo. **La app
tenía razón y la prueba estaba mal**, y pasaba de casualidad porque hasta entonces no se había dado
el caso.

**No fue la guarda del SPY** que se añadió el 17: el SPY cerró en 769,05 el 20 y en 773,09 el 21, así
que no se disparó. Comprobado antes de tocar nada.

### Los tres arreglos

**1. La prueba comprueba ahora el contrato real**: que los 5 primeros van por nota de mayor a menor, y
que cualquier extra está ahí por señales de salida o por ser una posición abierta. Hoy pasa, y de paso
confirma el diseño: «las 1 extra están por señales de salida, no por nota (ARQT)».

**2. El test de humo deja de bloquear la publicación diaria.** El razonamiento: en la ejecución del
cron **el código no ha cambiado**, así que un fallo del humo solo puede venir de los datos del día — y
congelar los datos no arregla nada, deja el panel viejo, que es peor que un posible fallo de
renderizado. Las pruebas de **lógica pura** (reglas, puntuación, integridad, filtros) **siguen
bloqueando**, porque esas sí indican que el código está mal. Cuando el disparador es un push de
código, el humo vuelve a bloquear.

Y si el humo falla en el diario, los datos se publican **y después** el trabajo acaba en rojo, para que
llegue el correo de GitHub en vez de un fallo silencioso.

**3. El escaneo reintenta 3 veces** con espera creciente. Un fallo puntual de red tenía el mismo efecto
que el de ayer, y una sesión perdida **no se recupera nunca**: TradingView solo sirve el dato del
momento.

### Fallo propio en el propio arreglo, cazado antes de publicar

La primera versión del reintento llamaba a `time.sleep` **sin importar `time`**. Habría lanzado
`NameError` justo en el momento en que hiciera falta, o sea que el arreglo contra las caídas se habría
caído con la primera caída. Lo encontró una prueba que recorre el camino del reintento de verdad, no
solo su firma.

### Lo que no se recupera

**La sesión del 21 de octubre está perdida.** Los 46 campos por acción solo existen en el momento del
escaneo. Queda un hueco de una sesión en el registro, igual que los días retirados. No afecta a
precios ni a stops; sí resta una sesión al contador de madurez de Resultados.

**Pruebas.** 525 comprobaciones en verde, 6 nuevas sobre esta resiliencia.

---

## 22 de octubre de 2026 (2) — recuperada la serie de cierres del 21

**Qué se ha recuperado y qué no**, porque la distinción importa:

- **`docs/precios.json` (cierres diarios): RECUPERADO.** 40 de los 41 símbolos seguidos. Es un hecho
  verificable y está en fuentes históricas. Es lo que hace posible la simulación de stops de la
  pestaña Resultados, que es justamente la medición de noviembre.
- **`docs/datos/2026-10-21.json` (el top del día): NO se reconstruye, y no se reconstruirá.** Necesita
  46 columnas en vivo —fundamentales, medias y RSI del momento— que ya no existen. Inventar un top que
  nunca se eligió sería falsear el registro, igual que los días fantasma que se retiraron el 17.

**Verificación antes de escribir nada.** Se pidieron a nasdaq.com también los cierres del **20**, que
ya estaban guardados desde TradingView: **29 de 29 coinciden al céntimo**. Con las dos fuentes de
acuerdo en el día anterior, el dato del 21 es fiable. Sin esa comprobación habría estado metiendo
números de una fuente que nadie había contrastado.

El único símbolo sin dato es `NASDAQ:BLFS`, que no tiene cierre ese día en la fuente.

**La serie queda sin huecos**: 12 sesiones, del 6 al 21 de octubre, en orden y sin ningún día de
mercado ausente.

**Guarda nueva en `filtros.test.py`**: ningún día de mercado puede faltar entre el primero y el último
de la serie, las fechas van en orden, ningún día vacío y ninguno en fin de semana. Verificada quitando
un miércoles de en medio: falla y nombra la fecha.

**Limitación declarada**: un hueco al *final* de la serie no lo detecta esta prueba, porque no hay un
«día siguiente» con el que comparar. Ese caso lo cubre el aviso rojo de la app («Datos de hace N días
de mercado»), que es precisamente el que funcionó ayer.

**Pruebas.** 529 comprobaciones en verde.

---

## 22 de octubre de 2026 (3) — el trinquete deja de depender de que abras la app

Nace del hueco del 21: al revisar qué le pasó a una posición abierta apareció que **el trinquete del
stop solo subía los días en que el usuario abría la app.**

`stopMax` se guarda en el navegador y se actualiza en `window.posiciones()`: `max(guardado, stop de
hoy)`. Los días que no abres, esos escalones no existen. La tabla 5 promete «el stop nunca baja: se
guarda el valor más alto que ha alcanzado», y el valor más alto que ha alcanzado **no es** el de los
días que miraste. **Ataba una regla del sistema a un hábito del usuario, y hacia el lado peligroso:
el stop quedaba más bajo de lo prometido, o sea arriesgando más de lo que el panel decía.**

Medido con PAYS, comprada el 6 a 15,00 $: el trinquete real subió **ocho veces**, de 12,75 a 13,33 $.

```
06 oct 14,36  EMA 12,268  stop 12,75  <- sube     15 oct 15,60  EMA 12,998  stop 13,00  <- sube
13 oct 15,48  EMA 12,799  stop 12,80  <- sube     16 oct 14,80  EMA 13,068  stop 13,07  <- sube
14 oct 15,16  EMA 12,891  stop 12,89  <- sube     19 oct 15,34  EMA 13,157  stop 13,16  <- sube
                                                  20 oct 15,21  EMA 13,238  stop 13,24  <- sube
                                                  21 oct 15,62  EMA 13,331  stop 13,33  <- sube
```

**El arreglo.** `build.py` guarda también la **EMA 50 de cada día** en `precios.json`, en un bloque
`emas` aparte para no tocar el formato existente. El dato ya se descargaba —está en
`CAMPOS_SEGUIMIENTO`— solo que no se guardaba. `window.TRINQUETE_EN_SERIE` recorre la serie entera
desde tu fecha de compra y devuelve el máximo; las posiciones usan el mayor entre ese y el guardado.

Coste: `precios.json` pasa de 7,3 KB a 12,5 KB, y solo se descarga en dos pestañas. **Cero llamadas
nuevas.**

**Relleno de los 12 días ya guardados**: la EMA 50 real de los ficheros diarios sirve de ancla y se
rueda hacia delante con la fórmula recursiva verificada al 0,000 %. 30 símbolos con ancla real.

### Copia de seguridad en un clic

Cuatro recordatorios sin hacerse. Y con razón: copiar al portapapeles son tres pasos y hace falta un
sitio donde pegarlo. Ahora hay un botón que **descarga un fichero** con fecha en el nombre, se anota
cuándo fue la última, y si nunca se ha hecho —o pasan 30 días— aparece un aviso en ámbar diciendo
exactamente lo que está en juego. El portapapeles se conserva como alternativa.

No es una manía: el historial de posiciones es **lo único de todo el panel que no se puede
reconstruir desde ningún sitio**.

**Pruebas.** 557 comprobaciones en verde (de 543).

## 2026-10-24 — Medición: el stop del panel contra el trailing clásico

Pregunta: *"¿este stop es mejor que el trailing normal?"* No había medición. Se hizo.

**Método.** 766 tickers (muestra aleatoria con semilla del universo nasdaq con cap ≥ 300 M),
706.175 cierres diarios 2023-01 → 2026-10. Entrada **idéntica para todas las variantes** y
fijada antes de simular (cierre a ≤ 10 % del máximo de 52 semanas, por encima de la EMA 50,
RSI ≥ 45, una entrada por ticker cada 60 sesiones): 4.913 entradas. Lo único que cambia entre
variantes es la regla de salida. IC 95 % por bootstrap de bloques trimestrales.

Una primera pasada dio al `trail15` una ventaja significativa que desapareció al añadir variantes:
la secuencia de entradas dependía de cuánto aguantaba la variante más lenta. Queda anulada; los
números de abajo son de la versión con entradas independientes de la variante.

| salida | media/op | acierto | días | p5 | dif vs panel (IC 95 %) |
|---|---|---|---|---|---|
| panel (actual) | +0,75 % | 30,8 % | 14 | −13,6 % | referencia |
| solo EMA 50 | +1,43 % | 31,1 % | 16 | −14,0 % | **+0,69 [+0,29, +1,12]** |
| trailing 15 % | +2,47 % | 41,0 % | 66 | −16,7 % | +1,71 [−0,17, +3,52] |
| trailing 20 % | +4,90 % | 43,4 % | 106 | −21,2 % | **+4,16 [+1,36, +7,03]** |
| trailing 25 % | +6,68 % | 45,2 % | 140 | −26,0 % | **+5,96 [+2,61, +9,36]** |
| 6 × ADR | +3,62 % | 40,0 % | 56 | −21,7 % | **+2,86 [+0,79, +5,12]** |
| 8 × ADR | +5,11 % | 41,7 % | 81 | −25,4 % | **+4,36 [+1,70, +7,21]** |

**Lo que sale, y lo que no.**

1. El stop del panel **no es mejor**: es el más estrecho y el que menos renta por operación en
   esta muestra. Corta a los 14 días de mediana contra 66-140 del trailing.
2. **Las capas que hay encima de la EMA 50 restan.** Quitar el suelo del 15 %, el escalón de
   breakeven, la devolución y el RSI deja +0,69 pp [+0,29, +1,12], significativo. La EMA 50 sola
   funciona mejor que la EMA 50 con los cuatro añadidos.
3. **A igual anchura media, el adaptativo gana al fijo.** El ADR mediano es 2,50 % del precio,
   así que 6 × ADR ≈ 15 %: misma anchura que `trail15`, y +1,14 pp [+0,05, +2,31]. Esto resuelve
   la medición pendiente desde el 7 de octubre, y en el sentido que se sospechaba.
4. **No es dinero gratis.** El p5 pasa de −13,6 % (panel) a −26,0 % (trailing 25 %). La ventaja
   se paga con pérdidas individuales el doble de grandes. Por unidad de riesgo (media / |p5|) la
   escala sigue favoreciendo al trailing ancho (0,26 contra 0,06), pero con 15 % de pérdida
   máxima declarada como límite, un trailing del 25 % es otro sistema, no un ajuste.
5. **Depende del régimen.** La ventaja del stop ancho viene de 2024T1, 2025T2 y 2025T3. En 2026
   (n = 1.418) todas las variantes están entre −0,26 % y +0,36 %: la diferencia desaparece.

**No se cambia nada.** Sigue en pie el acuerdo del 7 de octubre: las reglas de salida no se tocan
sin decisión explícita. Esto es evidencia para decidir, no una implementación.

### 2026-10-24 (mismo día, corrección) — desglose por capa: la recomendación anterior queda retirada

Al cerrar la entrada de arriba recomendé *"quitar las capas sobre la EMA 50, que mejora sin aumentar
la pérdida máxima"*. **Es falso y lo retiro.** Al medir capa por capa, con las mismas 4.913 entradas:

| variante | media/op | p5 | p1 | peor | dif vs panel (IC 95 %) |
|---|---|---|---|---|---|
| panel | +0,75 % | −13,6 % | −19,8 % | −54,4 % | referencia |
| −RSI | +1,04 % | −14,4 % | −20,1 % | −54,4 % | +0,29 [−0,08, +0,76] |
| −devolución | +0,91 % | −13,6 % | −19,9 % | −54,4 % | +0,16 [−0,06, +0,45] |
| −RSI −devolución | +1,22 % | −14,5 % | −20,1 % | −54,4 % | +0,47 [+0,07, +0,99] |
| −breakeven | +0,76 % | −13,6 % | −19,8 % | −54,4 % | +0,01 [−0,01, +0,03] |
| −suelo 15 % | +0,88 % | −13,0 % | **−24,1 %** | **−55,3 %** | +0,12 [+0,01, +0,24] |
| todo fuera | +1,43 % | −14,0 % | **−25,0 %** | **−55,3 %** | +0,68 [+0,28, +1,13] |

Tres errores en lo que dije:

1. **Sí aumenta la pérdida.** El p5 agregado apenas se movía (−13,6 → −14,0 %) y me quedé ahí. En
   el p1 pasa de −19,8 % a −25,0 %: quitar el suelo del 15 % ensancha la cola, que es justo donde
   importa. El p5 era el percentil equivocado para esta pregunta.
2. **Ninguna capa individual aguanta sola.** −RSI y −devolución no son significativas por separado;
   juntas quedan en +0,47 [+0,07, +0,99], pegadas al cero. El +0,68 de "todo fuera" se consigue
   sobre todo quitando el suelo, que es la capa que no se puede quitar sin cambiar el riesgo.
3. **En 2026 se invierte.** Panel −0,13 %, −RSI −0,23 %, −RSI −devolución −0,28 %, todo fuera
   −0,21 % (n = 1.418). Todas las retiradas empeoran en el régimen actual.

**Comparaciones múltiples.** En este estudio se corrieron ~20 contrastes con IC del 95 %: cabe
esperar uno falso positivo. Los tres marginales (−suelo 15 % con +0,12, −RSI −devolución con +0,47,
y ADR6 contra trail15 con [+0,05, +2,31]) son exactamente los candidatos a serlo. Solo los efectos
grandes —trailing del 20-25 % y 8 × ADR, todos de +4 pp arriba— sobreviven a esa corrección, y todos
exigen ensanchar el stop al 20-25 %, que rompe el límite declarado del 15 % y dobla la cola.

**Decisión: no se cambia nada en las reglas de salida.** El dato que queda en pie de la entrada de
arriba es descriptivo, no accionable: el stop del panel es estrecho, corta a los 14 días de mediana,
y en 2023-2025 eso costó rentabilidad frente a un stop ancho. En 2026 no se distingue de nada.

Para contexto, de las 4.913 salidas del panel: 70,4 % por stop (media −2,49 %), 24,6 % por RSI
(media +6,55 %, mediana +1,15 %) y 2,4 % por devolución (media +26,49 %). La regla de devolución
dispara poco pero es la única que corta con ganancia grande de verdad.

## 2026-10-24 — Pestaña Resultados: la comparación con el S&P 500 no era honesta

Alguien con criterio hizo preguntas sobre la rentabilidad mostrada. Al revisar el cálculo aparecen
tres defectos reales en la presentación (el cálculo en sí estaba bien) y uno de despliegue.

**Lo que ya estaba bien y no se toca:** la supervivencia está resuelta (las deslistadas se quedan en
el registro con su último precio conocido y se avisa, en vez de desaparecer y dejar solo supervivientes);
la tabla "tres formas de operar" sí aplica las reglas de salida; el contador de madurez bloquea las
conclusiones hasta 30 entradas.

**1. Un número sin barra de error.** Se mostraba `+1,8 pt` en verde grande y debajo, en gris pequeño,
"todavía es ruido". Se lee el número. Ahora va el intervalo al lado: **[−1,7, +7,4] pt**, que cruza el
cero, y el texto lo dice con esas palabras. La pregunta "¿mejor que comprar el índice?" responde
"todavía no se puede decir" en lugar de "Sí, +1,8 puntos" cuando el margen cruza el cero.

**2. Las entradas no eran observaciones independientes.** El 05/10/2026 entraron **nueve acciones a
la vez**; si el mercado se mueve ese día, se mueven las nueve. El remuestreo se hace ahora por día de
entrada: son **28 entradas en 11 días**, y el texto lo dice así. Nota: en estos datos agrupar sale
algo *más estrecho* que el método ingenuo (8,6 pt contra 9,6), no más ancho. Se hace por ser el
método válido para datos agrupados, no porque dé un número mayor. Un comentario del código afirmaba
lo contrario y se corrigió antes de publicar.

**3. No se descontaba la beta.** Las anotadas tienen beta media **1,63** y un ADR mediano de 4,5 %
diario contra 0,81 % del SPY: se mueven 5,5 veces más. Con el S&P en −1,7 %, una cesta así debería
haber hecho −2,7 % sin mérito ninguno. Hizo +0,1 %, así que el exceso real es **+2,8 pt**, no +1,8.
Hoy la beta juega a favor porque el mercado cayó; con el mercado subiendo, el mismo panel habría
mostrado como acierto lo que sería solo volatilidad. Se muestra en línea aparte.

**4. El precio de entrada es uno que no se pudo pagar.** Se anota el cierre de la noche en que el
panel detecta la acción, pero él la ve a la mañana siguiente. Medido sobre las 29 entradas reales, el
hueco de una noche a otra es **−0,64 % de media** (mediana −0,05 %, 11 de 29 en positivo): va *en
contra* del panel, no a favor, al revés de lo que cabía esperar. Pero la dispersión va de **+6,1 %
(TEAM) a −11,6 % (OABI)**, así que una fila concreta puede estar desviada varios puntos. Se dice en
la nota del pie.

**5. Defecto de despliegue, el más grave de los cinco.** El `paths:` del workflow solo incluía
`docs/puntuacion.js` y `docs/reglas.js`: **un arreglo en `resultados.js` o en un CSS se subía sin
republicar**, la versión no se movía y el navegador seguía sirviendo el fichero viejo de su caché.
Y el trigger por push ejecutaba un build completo, que escanea: desplegar un cambio de interfaz
costaba llamadas del presupuesto de 4/día o había que esperar a la noche.

Arreglado con **`build.py --rehacer`**: republica desde los datos ya guardados con **cero llamadas**.
Rehace lo derivado (histórico, con los campos nuevos rellenados también hacia atrás, y el hash de
versión) y conserva intacto lo que solo se sabe preguntando al mercado (precios, actual, mercadoHoy,
referenciaHoy, régimen, actualizado) y `docs/precios.json`. Verificado bloqueando el socket: si
tocara la red, revienta. El `paths:` pasa a incluir `docs/*.js` y `docs/*.css`, todos los ficheros
que entran en el hash.

**Pruebas.** `tests/resultados.test.js`, 11 comprobaciones, verificadas contra una mutación que
remuestrea por acción en vez de por día (caza 3 de 11). Total: **320 en verde**.

**Error propio detectado durante el trabajo:** la comprobación de humo que escribí para esto buscaba
el signo menos tipográfico (−) y la app escribe el guion normal (-), así que la condición era siempre
falsa y no comprobaba nada. Reescrita para extraer los dos límites y contrastar el aviso contra
ellos; verificada con una mutación que suprime el aviso.

### 2026-10-24 — Sugerencia externa sobre la rentabilidad del listado: qué se aplica y qué no

Sugerencia recibida: *"las que siguen en el top, o en compra, y de las que salieron de la cartera y
cuándo salieron (con el drawdown posible según stop)"*, motivada por *"la rentabilidad es conjunta, o
desde cuándo dio venta o cómo, es que me parece muy poca"*.

**La queja de fondo era correcta y tenía respuesta escondida.** El `+0,1 %` de cabecera es "comprar y
no vender nunca": la peor de las tres formas de operar y, sobre todo, **la que el sistema no hace**.
La tabla que lo contesta (`tablaSimulacion`) existía desde hacía semanas pero estaba tras el umbral de
30 entradas maduras, y hay 0. Nunca se había visto. Con las mismas 28 entradas:

| forma de operar | media | mediana | en positivo | peor caso | peor momento |
|---|---|---|---|---|---|
| comprar y aguantar hasta hoy | +0,1 % | −0,9 % | 46 % | −35,0 % | −6,5 % |
| vender el día que sale del top | +4,2 % | +1,0 % | 57 % | −7,3 % | −6,5 % |
| con nuestras reglas de salida | +1,0 % | −0,9 % | 46 % | −21,0 % | −5,4 % |

Se saca del umbral y se muestra siempre, marcada como registro y no como previsión, igual que la tabla
en bruto: es aritmética sobre lo ocurrido, no una inferencia.

**La parte del filtro NO se aplica tal cual, porque mentiría.** Medido:

| grupo | n | media | vs S&P |
|---|---|---|---|
| todas | 28 | +0,1 % | +1,8 pt |
| siguen en el top | 9 | **+12,1 %** | +13,8 pt |
| ya salieron del top | 19 | −5,6 % | −3,9 pt |

Una acción sale del top **justo cuando se debilita**: filtrar a las de dentro es quedarse con las
ganadoras por construcción. Doce puntos de diferencia que no son mérito de nada. Es el mismo sesgo que
el código ya evitaba a conciencia con las deslistadas. Se muestran **los tres grupos juntos**, con el
aviso de cuánto infla mirar solo el primero, y una comprobación de humo falla si alguien los reduce a
uno.

**Lo demás de la sugerencia sí se implementa:**
- Columna **"peor momento"** (máxima excursión adversa): lo que se llegó a estar en rojo por el camino,
  aunque la operación acabara en verde. −6,5 % de media aguantando, −5,4 % con las reglas.
- Tabla **"lo que el stop habría vendido, y cuándo"**: COHU el 14/10 a −21,0 % (aguantando hasta hoy,
  −35,0 %), XMTR el 16/10 a −17,8 % (−19,7 %), FEIM el 13/10 a −15,7 % (−24,9 %). El stop salió **8,3
  puntos mejor** que aguantar, de media. Nótese que dos de los tres cortaron **por debajo del 15 %
  declarado**: el stop actúa sobre cierres y un hueco a la baja lo salta. Se avisa en la tabla.

**Fallo propio corregido durante el trabajo:** al añadir el drawdown dejé el `break` original en
`simula()`, lo que congelaba *los dos* peores momentos en la salida del stop y falseaba el de aguantar.
Ahora el bucle sigue con una bandera `cerrada`. Probado con una mutación que reintroduce el `break`
(caza 2 de 20). También se escribió un "15 %" literal en un aviso: lo cazó la prueba de integridad de
umbrales duplicados y ahora se toma de `reglas.js`.

**324 comprobaciones en verde.** Versión `0da3c7ce`, en línea.

### 2026-10-24 — La rentabilidad del listado, ahora sí, como una cartera

Última pieza de la sugerencia externa: *"¿la rentabilidad es conjunta?"*. **No lo era.** El `+0,1 %`
es la media simple de 28 entradas medidas en plazos distintos —PAYS lleva 13 sesiones y CRON 1, y
pesan igual—: el promedio de apuestas sueltas, no el resultado de una cartera.

Ahora se encadena. Se compra el top a partes iguales, se reequilibra cada sesión y la rentabilidad
compone:

| | |
|---|---|
| la cartera | **+4,9 %** |
| el S&P 500 en el mismo tramo | −2,5 % |
| peor caída de la cartera | −3,8 % |

en 13 sesiones, con curva de las dos líneas (SVG de 15 puntos, sin librería).

**Dos decisiones que cambian el número, ambas explicadas en la propia pestaña:**

1. **Retraso de un día.** El top publicado la noche de *t* se compra al cierre de *t+1*. El precio de
   la noche en que el panel detecta una acción no es uno al que se pudiera comprar: se ve a la mañana
   siguiente. Sin el retraso la cartera cobraría gratis el hueco de la noche. Esto cierra el defecto 4
   de la entrada anterior, que se había señalado pero no corregido.
2. **Sin supervivencia.** Una acción que se hunde y sale del top deja su caída dentro de la curva
   hasta el día que sale, que es lo que habría pasado teniéndola comprada. Es lo contrario del filtro
   que se descartó esta misma mañana.

**Por qué no es un número para copiar, y se dice en la pestaña:** rota el **26 % de la cartera cada
sesión**. Medido el efecto del coste: +4,86 % bruto → +4,51 % a 0,05 % por lado → **+4,15 % a 0,10 %**
→ +2,39 % a 0,35 %. Sobrevive, pero la operativa real de Borja es otra (compra unas pocas y las suelta
con el stop). Sirve para saber si el listado acierta, no para replicarlo. Y 13 sesiones no demuestran
nada: no se extrapola ni se anualiza en ningún sitio.

**Pruebas:** 7 nuevas, verificadas contra dos mutaciones — quitar el retraso de un día (caza 1) y
filtrar a las que siguen en el top (caza 2) — más tres guardarraíles en el humo que exigen el bloque,
el aviso de que no es la operativa real y la mención del retraso. **327 en verde.**

**Dos fallos propios durante el trabajo:** una prueba nueva estaba mal planteada (ponía el salto de
precio en un tramo que sí se cobra, así que fallaba por el escenario y no por el código: se corrigió
la prueba, no el código), y un choque de nombres de variable entre dos bloques del mismo fichero de
pruebas. Ambos del mismo tipo que ya había cometido antes en este proyecto.

Versión `c48ebed1`, en línea.

### 2026-10-24 — Operar el panel de verdad: comprar la señal y vender con el stop

Aclaración de lo que pedía la sugerencia: *"¿qué rentabilidad tendría si fuera comprando cuando la
app me lo dice y vendiendo los stops?"*. **Ninguna cifra de la pestaña contestaba eso.** La media por
entrada trata cada posición suelta y en plazos distintos; la cartera del listado reequilibra a diario
en el top entero, que no es la operativa de nadie.

Se simula el protocolo tal cual: **5 huecos de cartera a partes iguales**, se llenan con lo mejor
puntuado del top según aparece, cada posición lleva **su** stop —con la EMA 50 real, que se guarda a
diario desde el 07/10/2026—, y al vender el dinero vuelve a la caja y se reinvierte.

| | |
|---|---|
| la cartera | **+2,2 %** |
| el S&P 500 en el mismo tramo | −2,2 % |
| lo peor que llegó a estar | −3,2 % |
| ventas cerradas | **2** |

Las dos ventas: FEIM 07/10 → 08/10, **−5,6 %**, cortada por la EMA 50 (no por el suelo del 15 %);
COHU 07/10 → 14/10, **−17,7 %**, por stop, con hueco de por medio.

**Se muestra a propósito la sensibilidad al número de huecos**: 3 huecos dan **−2,7 %**, 5 dan +2,2 %,
8 dan +2,9 %, 10 dan +2,6 %. Un abanico de cinco puntos y medio según cuántas posiciones lleves, con
dos ventas cerradas, es la demostración de que esto **todavía no es una rentabilidad media**. Esconder
esa sensibilidad habría dado al +2,2 % una precisión que no tiene. La pestaña lo dice con esas
palabras.

**Error real encontrado por las pruebas nuevas, no por revisión a ojo:** la compra usaba el top
publicado antes de *ayer*, o sea con **un día de retraso de más**. Se compra al cierre de hoy, luego
el top que toca es el último publicado antes de hoy. En `carteraDelTop()` el `s < ayer` **sí** es
correcto y se queda: allí la posición ya estaba abierta al cierre de ayer y lo que se mide es lo que
renta de ayer a hoy. Antes del arreglo salía +1,6 %; después, +2,2 %.

También se eliminó una línea muerta (`const R` sin usar) que escribí en el mismo bloque.

**Pruebas:** 9 nuevas, verificadas contra dos mutaciones —reponer el retraso equivocado (caza 5) y no
reinvertir el dinero de las ventas (caza 2)— más 4 guardarraíles en el humo. **331 en verde.**

**Arreglo de método:** las tres secciones de `tests/resultados.test.js` van ahora en bloques con
ámbito propio. Habían chocado nombres de variable entre secciones **tres veces** en la misma jornada
(`cae`, `tres`). Con el bloque, ese error deja de ser posible.

Versión `d7570450`, en línea.

### 2026-10-24 — La pestaña Resultados se había vuelto ilegible

Al terminar la jornada la pestaña tenía **siete bloques** para contestar una sola pregunta. El propio
usuario lo dijo: *"ahora hay muchas tablas y datos, es un poco lioso"*. Tenía razón, y la causa es
clara: hoy se fueron añadiendo bloques de uno en uno sin mirar nunca el resultado completo. Cada
añadido estaba justificado por separado; el conjunto, no.

**Arriba queda solo lo que responde:**
1. ¿Me puedo fiar ya de estos números? → el contador de madurez
2. Si hubieras operado el panel → **la respuesta**
3. Lo que llevamos anotado → el registro en bruto

**Y en un plegable «Otras formas de medirlo», cerrado por defecto:** el listado entero como una sola
cartera, el desglose dentro/fuera del top, las tres formas de operarlas con lo que habría vendido el
stop, y la comparación con el S&P 500 con su margen de error y la beta.

No se borra nada. Cada uno de esos bloques existe por una razón medida esta misma mañana, pero son
**segunda lectura**, no lo primero que hay que ver al abrir.

Cambio de estructura necesario: la comparación con el índice estaba **dentro** de la función del
registro en bruto, lo que obligaba a enseñar los dos juntos. Extraída a `comparaIndice()`.

**Freno para que no se repita:** prueba de humo que exige que exista el plegable, que arriba queden
como mucho 2 bloques con título y que dentro haya 3 o más. Verificada con una mutación que vuelve a
mostrarlo todo de golpe. Es la misma clase de guardarraíl que ya se puso contra el sesgo de
supervivencia: la decisión queda escrita en una prueba, no solo en el registro.

**334 comprobaciones en verde.** Versión `e91dd4b5`, en línea.

**Lección para el método:** cuando se añaden varias cosas seguidas a una misma pantalla, hay que
mirar la pantalla entera antes de dar por bueno el conjunto. Hoy se publicó cuatro veces sobre la
misma pestaña sin hacerlo ni una sola vez.

### 2026-10-24 — Las gráficas no decían cuál línea era cuál

Eran dos trazos de 70 px sin leyenda, sin línea de referencia y sin nombres: se veía que había dos
líneas, pero para saber cuál era la cartera y cuál el índice había que leer el párrafo de debajo.

**Cambios, por 21 px más de alto (92 → 113 px de huella):**

- **Leyenda** de una línea con la muestra de cada trazo y su resultado al lado:
  «— +2,2 % tu cartera · ---- −2,2 % el S&P 500». Va en **HTML y no dentro del SVG** por dos razones:
  el SVG se estira con `preserveAspectRatio="none"` y cualquier texto dentro saldría deformado; y
  además así la prueba de humo puede comprobarla, porque el stub de DOM descarta `innerHTML` y todo
  lo que vaya dentro del SVG le resulta invisible.
- **Línea de referencia en el punto de partida**: por encima se gana, por debajo se pierde. No
  existía. Primero la puse con `var(--line)`, que es casi el color de la tarjeta y no se veía nada;
  corregida a `var(--muted)` al 50 % tras mirarla ampliada.
- **La cartera sólida y rellena; el índice discontinuo y gris.** Se distinguen también en blanco y
  negro y sin depender de separar el rojo del verde, cosa que con dos líneas de color no pasaba.
- `vector-effect="non-scaling-stroke"` para que el estirado horizontal no engorde los trazos ni
  deforme los guiones del índice.

Se quita la frase «la línea gruesa es la cartera; la gris, el índice»: con la leyenda sobra.

Comprobado en **móvil (375 px, sin desbordamiento horizontal)** y en **tema claro** (tarjeta blanca,
verde oscuro, discontinua gris, referencia visible).

2 pruebas nuevas en el humo, verificadas con una mutación que quita la leyenda. **336 en verde.**
Versión `f58eab6f`, en línea.

### 2026-10-24 — Dos simulaciones del mismo stop daban resultados distintos

Borja: *"arriba me pone 2,2 % comprando cuando toca y vendiendo en el stop, y abajo 1 % con lo
mismo"*. Tenía razón en desconfiar. Había **una incoherencia real**, no solo un problema de
redacción.

**El fallo.** `simula()` llamaba a `stopDe` con **dos argumentos de menos**:

```
stopDe(datos, compra, stopPrevio, ganMax)
simula():           stopDe({ precio },        compra, stopPrevio)          ← sin ema50, sin ganMax
operandoElPanel():  stopDe({ precio, ema50 }, compra, stop, ganMax)        ← correcto
```

- **Sin `ema50`** el stop era solo el suelo del −15 %, más flojo que el de verdad. El comentario
  decía *«sin EMA 50 histórica»* y era cierto cuando se escribió, pero la EMA 50 diaria está en
  `docs/precios.json` desde el 07/10/2026. Nadie volvió a mirar el comentario.
- **Sin `ganMax`**, `stopDe` mira la ganancia de HOY y no la máxima alcanzada: **exactamente el fallo
  que se corrigió en `reglas.js` este mismo mes**, colado otra vez por el punto de llamada.

Síntoma visible: **FEIM salía a −15,7 % en una tabla y a −5,6 % en otra**, la misma acción.

Corregido: el stop dispara ahora 4 veces en vez de 3, FEIM sale el 8/10 a −12,6 % por EMA 50, y la
media con reglas de salida pasa de +1,0 % a **+1,2 %**.

**Los conceptos tampoco estaban dichos.** Las dos cifras miden cosas distintas y nada lo explicaba:
- Título y columna: «Cada entrada por separado, operada de tres formas» y «Media por entrada», con
  un aviso de que **eso no es una cartera**.
- Bloque nuevo que **reconcilia las dos cifras**: *«¿Por qué +1,2 % aquí y +2,2 % en la cartera de
  arriba?»*, con las tres diferencias —5 posiciones contra las 28 entradas; componer y reinvertir
  contra promediar porcentajes sueltos; comprar al cierre del día siguiente contra al del día que
  entró al top— y la aclaración de que **el stop sí es el mismo**.
- «Lo que el stop habría vendido, **entrada por entrada**», para no confundirla con la tabla de
  ventas de la cartera.

**Prueba nueva de integridad:** lee los puntos de llamada a `stopDe` en `resultados.js` y exige que
todos pasen `ema50` y los cuatro argumentos. Verificada con dos mutaciones, una por omisión.

**La lección, que es la importante:** tener las reglas en un solo fichero **no basta si quien las
llama se deja argumentos**. La prueba de integridad vigilaba umbrales duplicados; las llamadas
incompletas pasaban por debajo. Y un comentario que describe una limitación («sin EMA 50 histórica»)
envejece: cuando la limitación desaparece, el comentario sigue ahí justificando el código viejo.

**338 comprobaciones en verde.** Versión `20e3f47d`, en línea.

### 2026-10-24 — Auditoría completa de todas las cifras de la pestaña Resultados

Tras el fallo del stop, pregunta razonable: *"¿has comprobado el resto de tablas y rentabilidades?"*.
No lo había hecho. Se hace ahora, **recalculando todo en Python por un camino de código distinto** y
comparando contra lo que pinta la web en producción.

**Todo cuadra. 0 fallos nuevos.**

| bloque | web | recálculo independiente |
|---|---|---|
| contador de estado | 14 sesiones · 29 anotadas · 0 maduras · vie 20 nov | 14 · 29 · 0 · 2026-11-20 ✓ |
| cartera operada (5 huecos) | +2,2 % · −2,2 % S&P · −3,2 % · 2 ventas | +2,24 · −2,22 · −3,23 · 2 ✓ |
| sensibilidad | 3 → −2,7 · 8 → +2,9 · 10 → +2,6 | −2,71 · +2,89 · +2,56 ✓ |
| ventas de la cartera | COHU −17,7 · FEIM −5,6 | −17,72 · −5,60 ✓ |
| grupos | 9 / 19 / 28 · +12,1 / −5,6 / +0,1 | idéntico ✓ |
| tres formas | +0,1 / +4,2 / +1,2 y sus medianas, % positivos, peores | idéntico ✓ |
| stop por entrada | COHU −21,0 · XMTR −14,0 · FEIM −12,6 · OSCR −6,4 | idéntico ✓ |
| comparado con el S&P | +0,1 / −1,7 / +1,8 pt | idéntico ✓ |
| beta | 1,63 → exceso +2,8 pt | idéntico ✓ |
| margen de error | [−1,7, +7,4] pt | [−1,87, +7,14] con otra semilla ✓ |
| **registro, 28 filas × 6 campos** | nota, precio de entrada, precio de hoy, cambio, S&P de su ventana, sesiones | **168 celdas, todas correctas** ✓ |

**Dos discrepancias aparecieron y las dos eran de mi verificador, no de la app:**
1. Contaba 29 entradas donde la web cuenta 28. La web excluye con razón **RBRK** (debutó en la
   última sesión, cero recorrido) y **BLFS** (deslistada, sin precio de hoy). A mi script le faltaban
   esos dos filtros.
2. Cuatro notas diferían en 1 punto (ELF, CAI, SLDE, GCT). Las cuatro valen exactamente `x,5` y
   Python redondea al par con `round()`, mientras la web redondea hacia arriba. Convención distinta,
   no error.

El único fallo real del día en esta pestaña sigue siendo el del stop con argumentos de menos, ya
corregido y con prueba de integridad que lo vigila.

**Alcance de esta auditoría:** las cifras de la pestaña Resultados, contrastadas contra `panel.json`
y `precios.json`. **No cubre** si esos dos ficheros reflejan bien el mercado (eso depende de
TradingView y del build), ni las pestañas Seguimiento, Mis posiciones y Parámetros.

### 2026-10-24 — «¿Cuánto si compro lo que más momentum tiene y vendo en los stops?»

La respuesta depende muchísimo de **cuántas posiciones lleves a la vez**, y la pestaña solo enseñaba
3, 8 y 10: se saltaba precisamente los dos casos más concentrados, que es lo que la pregunta sugiere.
Medido sobre las 13 sesiones, con el S&P 500 en **−2,2 %**:

| posiciones | rentabilidad | ventas cerradas |
|---|---|---|
| 1 (solo la de más momentum) | **−0,2 %** | 0 — compró PAYS el 7/10 y nunca llegó a vender |
| 2 | **+4,8 %** | 0 |
| 3 | **−2,7 %** | 1 |
| 5 (la cifra de cabecera) | **+2,2 %** | 2 |
| 8 | **+2,9 %** | 2 |
| 10 (el top entero) | **+2,6 %** | 3 |

**7,5 puntos de abanico por una sola decisión.** Eso es lo que hay que leer, no el +2,2 %. La pestaña
lo muestra ahora de 1 a 10, marca cuál es la de cabecera y **calcula el abanico sola**, con el texto
diciendo que con tan pocas ventas cerradas eso es casualidad y no una pista de cuántas llevar.

Verificado contra un recálculo independiente en Python: las seis cifras coinciden exactamente.

Comprobación de humo reescrita: buscaba la frase «Con otro número de huecos», que cambió. Ahora
exige los dos extremos (1 y 10) y la cifra del abanico. **340 en verde.** Versión `be7451f0`.

### 2026-10-24 — El dinero de las ventas se quedaba parado

Al imprimir el **diario de operaciones** de la cartera para contestar *«¿comprando las 5 primeras y
vendiendo en el stop sería 2,2 %?»*, salta a la vista: vende FEIM el 8/10 y **no vuelve a comprar
hasta el 14/10**. Seis sesiones con un hueco vacío.

**El fallo:**
```js
const importe = total / huecos;
if (importe > caja + 1e-9) break;
```
Al salir de una posición **con pérdida**, lo que vuelve a la caja ya no da para un quinto de la
cartera. Y como las posiciones que siguen abiertas suben, el objetivo se aleja cada día: **el hueco
no se volvía a llenar nunca**. En el registro real eso dejaba **10 de 13 sesiones con un hueco libre
y un 16 % del dinero sin invertir**. Nadie opera así: si te queda menos de lo que querías, compras
con lo que tienes.

Corregido con `Math.min(total / huecos, caja)` y un límite para no abrir posición con calderilla
(menos del 1 % de la cartera).

| huecos | antes | ahora |
|---|---|---|
| 1 | −0,20 % | −0,20 % |
| 2 | +4,79 % | +4,79 % |
| 3 | **−2,71 %** | **+0,37 %** |
| 5 (cabecera) | +2,24 % | **+2,44 %** |
| 8 | +2,89 % | +3,90 % |
| 10 | +2,56 % | +3,01 % |

El abanico baja de 7,5 a **5,0 puntos**, que sigue siendo enorme para 2 ventas cerradas.

**Cómo apareció, que es lo relevante:** no lo encontró ninguna prueba ni la auditoría de cifras de
esta misma tarde, que verificó que los números eran los que el código calculaba —y lo eran—. Lo
encontró **imprimir el diario de operaciones y leerlo**. Una comprobación de coherencia no detecta
una regla de negocio equivocada: para eso hay que mirar lo que el sistema hace, operación a
operación.

3 pruebas nuevas, verificadas con una mutación que repone el `break`. **343 en verde.**
Versión `24ed019c`, en línea: cabecera +2,4 %, 5 posiciones abiertas, abanico 5,0 puntos.

## 2026-10-24 — Qué pasará con Resultados según pasen los meses (y un defecto con fecha)

Pregunta de Borja. Medido en vez de supuesto, con un histórico sintético de 14, 90 y 250 sesiones.

**Rendimiento: no es un problema.** Todo el cálculo de la pestaña (7 carteras, el listado, `simula`
sobre todas las entradas y el bootstrap del intervalo) tarda:

| sesiones | símbolos | entradas | cálculo total | panel.historico | precios.json |
|---|---|---|---|---|---|
| 14 (hoy) | 25 | 24 | ~23 ms | 10 KB | 6 KB |
| 90 (tope) | 116 | 99 | ~43 ms | 66 KB | 134 KB |
| 250 (si no hubiera tope) | 308 | 195 | ~103 ms | 185 KB | **970 KB** |

Como `DIAS = 90`, el estado estacionario es la fila del medio: **panel.json ~150-200 KB y
precios.json ~130-180 KB**, que se descargan en cada visita. Aceptable, y ya acotado.

**El defecto, que sí importa y tiene fecha: 19 de enero de 2027.**

`entradas()` reconstruye la primera aparición de cada acción **leyendo la ventana de 90 sesiones**.
Cuando una acción lleve más de 90 sesiones y su primera aparición salga de la ventana, el panel la
re-fechará a la sesión más antigua que le quede dentro, **con el precio de ese día**. El registro se
reescribiría solo. Simulado quitando 5 sesiones del principio, 10 de 28 acciones cambian:

| acción | entrada real | cambio real | entrada vista | cambio visto |
|---|---|---|---|---|
| FIGS | 08/10 a 14,98 $ | **+34,8 %** | 12/10 a 17,74 $ | **+13,9 %** |
| CDNA | 05/10 a 69,85 $ | **−0,9 %** | 12/10 a 63,12 $ | **+9,6 %** |
| RSKD | 05/10 a 7,81 $ | +17,2 % | 12/10 a 8,57 $ | +6,8 % |
| HNGE | 05/10 a 98,35 $ | +13,4 % | 12/10 a 104,82 $ | +6,4 % |

Una posición ganadora puede pasar a parecer perdedora y al revés, **sin que nadie toque nada**.

**No hay pérdida de datos.** `docs/datos/*.json` no se recorta nunca: el original está entero y la
corrección se puede aplicar en cualquier momento con fidelidad total. Por eso esto no es urgente
esta noche, pero sí **antes de enero**.

**Plan, por orden de fecha:**

1. **Finales de noviembre de 2026** — al llegar a 30 entradas maduras se desbloquean solas tres
   tarjetas más arriba del todo (¿habrías ganado dinero?, ¿mejor que el índice?, ¿sirve la
   puntuación?). La pestaña vuelve a crecer **sin que nadie lo decida**. Hay que colocarlas dentro
   del orden actual, no encima.
2. **Antes del 19 de enero de 2027** — `docs/entradas.json`: registro permanente y solo-añadir de
   la primera aparición de cada acción (fecha, precio, nota, beta), independiente de la ventana de
   90 sesiones. Es el arreglo del defecto de arriba. Tamaño estimado: ~25 KB al año.
3. **Cuando el registro pase de ~60 filas** — la tabla «Lo que llevamos anotado» con «Todas» ya no
   se lee. Habrá que paginar de verdad o filtrar por estado.
4. **Permanente** — las simulaciones del stop y de la cartera seguirán cubriendo solo las últimas 90
   sesiones, porque dependen de la serie diaria de cierres. El aviso de cobertura ya existe; cuando
   empiece a disparar, habrá que decirlo más claro.

`docs/datos` crece ~14 KB por sesión: unos 3,5 MB al año. No es problema de espacio.

### 2026-10-24 — Eje de fechas y lectura día a día en las gráficas

Petición: ver la gráfica más completa, con los días apuntados, para saber qué llevaba la cartera cada
día. Y que **no se vuelva loca** cuando haya meses de histórico.

**Eje de fechas adaptado a la escala.** `etiquetasFecha()` cambia de modo según cuántos puntos haya:
- hasta 45 sesiones: cinco fechas repartidas con día y mes («12 oct»)
- de 46 en adelante: la primera sesión de cada mes («nov», «dic»), que es lo único que cabe y además
  lo que se quiere leer a esa escala
- si aun así pasaran de 7, se adelgaza dejando una de cada dos

Probado de **2 a 400 sesiones**: nunca pasa de 7 etiquetas ni las amontona. (El tope real es 90, pero
si algún día se sube `DIAS` el eje ya aguanta.)

Dos defectos corregidos al probarlo, ninguno visible todavía con 13 puntos:
- A 90 sesiones salía «feb | 5 feb» pegadas. La última fecha ya no se añade si queda a menos del 8 %
  del final.
- A 130 salían 8 etiquetas pese al límite de 7: el adelgazado iba **antes** de añadir la última.

**Lectura día a día.** Con 90 puntos no caben 90 etiquetas, así que al pasar el dedo o el ratón por
la curva aparece una marca vertical, un punto sobre cada línea, la fecha flotando dentro de la
gráfica, y **la leyenda cambia a las cifras de ese día**. Al soltar vuelve a los totales. No ocupa ni
un píxel más de alto.

La fecha va **dentro** de la gráfica y no en la leyenda a propósito: metida en la leyenda, en el
móvil la hacía pasar de 25 a 57 px y todo lo de abajo saltaba mientras arrastrabas el dedo.
Comprobado: 25 px en reposo y 25 al tocar.

Marca, puntos y fecha van en HTML y no dentro del SVG, porque el SVG se estira con
`preserveAspectRatio="none"` y un círculo saldría ovalado.

9 pruebas nuevas de `etiquetasFecha` a 15 escalas, más 2 de humo verificadas con una mutación que
quita el eje. Comprobado en móvil con `pointerdown` táctil. **342 en verde.** Versión `78dd3cb0`.

### 2026-10-24 — El bloque del listado decía justo lo contrario de lo que hacía

Borja, leyendo los dos bloques juntos: *«¿pero cómo que el listado entero? ¿Que si no hubiera
vendido nada? Pero si hay acciones que han salido de ese listado. No entiendo nada de esto.»*

**Tenía razón: el título mentía.** «Si hubieras comprado el listado entero, como una sola cartera»
se lee como comprar y no vender nunca. Es **lo contrario**: esa cartera vende, y vende mucho. Vende
el día que una acción se cae del top, compra la que entra, cada sesión, **moviendo el 26 % de la
cartera cada día**. Y lo que **no** usa es el stop.

Nada de eso estaba escrito, así que el +4,9 % chocaba de frente con el +2,4 % de arriba sin ninguna
forma de entender la diferencia. Dos cifras contradictorias en la misma pantalla es peor que no
enseñar ninguna.

**Cambios:**
- Título: «**Si siguieras el listado a rajatabla: fuera lo que sale, dentro lo que entra**».
- Debajo, en una línea: cada sesión te quedas con las 10 del top, vendes la que se cae y compras la
  que entra. **Aquí no hay stop**: la única señal de venta es salirse del top.
- Puente con la cifra de arriba, igual que el que ya existe en la tabla por entrada:
  *«¿Por qué +4,9 % aquí y +2,4 % más arriba?»* → arriba vendes con el stop aunque siga en el top;
  aquí vendes al caerse del top aunque el stop no haya saltado; arriba 5 posiciones, aquí 10.
  **Son dos formas distintas de salir, no dos cuentas del mismo sistema.**
- El aviso de «no es para copiarlo» añade lo importante: ahí te quedarías **sin stop**, y una acción
  puede desplomarse sin salir del top.
- La etiqueta de la cifra pasa de «la cartera» a «siguiendo el listado».

Dos comprobaciones de humo apuntaban a los rótulos viejos y se rompieron. Reapuntadas a la
sustancia: que diga **cuándo** vende, que diga que **no hay stop**, que reconcilie con la cifra de
arriba y que avise de que no es la operativa real.

**Patrón que se repite hoy por tercera vez:** el cálculo estaba bien y el rótulo estaba mal. Pasó
con «Las mismas entradas, tres formas de operarlas» (parecía una cartera), con «Lo que el stop habría
vendido» (dos tablas casi iguales) y ahora con esto. Cuando una pantalla enseña varias cifras del
mismo sistema, **cada una tiene que decir de qué es y por qué no coincide con la de al lado**.

**344 en verde.** Versión `6182996c`, en línea.

## 2026-10-25 — Auditoría a fondo de toda la aplicación

Alcance: estado del repositorio, las 6 suites de pruebas, sintaxis de todo el código, integridad de
los datos, los tres caminos de `build.py`, resistencia a datos degenerados, **recálculo independiente
en Python de las 62 cifras de Resultados** contrastadas contra producción, y las cuatro pestañas en
vivo en escritorio y móvil.

**Resultado: 2 fallos reales encontrados y corregidos, 1 falsa alarma, 1 comprobación vacía propia.**

### Fallo 1 — las dos carteras comparaban con tramos distintos del S&P 500

De las 62 cifras contrastadas, 61 cuadraban exactamente y una no:

| | etiqueta | valor |
|---|---|---|
| bloque «operando el panel» | el S&P 500 en el mismo tramo | **−2,2 %** |
| bloque «siguiendo el listado» | el S&P 500 en el mismo tramo | **−2,5 %** |

La misma etiqueta con dos números. La cartera del listado arrancaba el primer día de la serie
(06/10, ya invertida), y la operada el segundo (07/10, su primera compra). Cada una comparaba con el
S&P de *su* tramo. Corregido: la curva de la operada arranca también el 06/10, valiendo 100 y en
liquidez. Las dos cubren ahora 06/10 → 23/10 y las dos dicen −2,5 %. **Ninguna rentabilidad cambia.**

### Fallo 2 — el manejador de la gráfica podía reventar

Recorriendo las pestañas por código: `Uncaught TypeError: Cannot read properties of undefined`. Con
la pestaña oculta el lienzo mide 0 de ancho y el puntero cae en el borde, así que
`(clientX − left) / width` es `0/0 = NaN`, el índice sale `NaN` y `a[NaN]` es `undefined`. No se
puede provocar tocando, porque no se ve, pero un manejador no debe poder romperse. Dos guardas:
ancho cero y fracción no finita. **La segunda hizo falta porque `Math.min` y `Math.max` propagan
`NaN`**: recortar el índice no servía de nada.

### Falsa alarma — los dos días que faltan en la serie

La primera pasada marcó que `precios.json` no cubre el 05/10 y que tiene un 21/10 que el histórico
no tiene. **Las dos son deliberadas y están documentadas**: la serie diaria empezó a guardarse el
06/10, y del 21/10 se recuperaron los cierres pero no se inventó un top que nunca existió. La
comprobación era ingenua. Convertida en invariante útil: toda sesión con top (menos la primera) debe
tener su cierre y su EMA 50, y los días sueltos sin top no pueden formar un tramo. Verificada
borrando un día de `precios.json`.

### Comprobación vacía propia — la tercera en dos días

La primera versión de la prueba del ancho cero **pasaba igual con el código roto**: con `clientX`
mayor que `left` la división da `Infinity`, que se recorta a 1 y no rompe. Solo falla con
`clientX == left`. Al afinarla, encontró además el agujero del `NaN` que mi propio arreglo no cubría.

**Norma a partir de ahora: ninguna prueba cuenta hasta haberla visto fallar contra la mutación.**
Hoy se ha aplicado a las 20 pruebas nuevas.

### Lo verificado que sí estaba bien

- 6 suites: **350 comprobaciones en verde**. Sintaxis correcta en los 11 ficheros de código.
- Integridad: histórico y `docs/datos` coinciden (14 días), ninguna sesión en fin de semana, sin
  tickers repetidos, SPY en todos los días, beta en las 140 filas, los 433 cierres son positivos, el
  precio del top coincide con la serie diaria, la versión es el hash real y `index.html` la apunta.
- Los tres caminos de `build.py`: `--rehacer` con el socket bloqueado (cero llamadas, `precios.json`
  intacto), el build completo de un lunes simulado (15 días, beta 150/150, serie y EMA al día) y el
  de fin de semana.
- 10 escenarios degenerados × 5 funciones: ninguno rompe.
- Producción: los 11 ficheros servidos **byte a byte idénticos** al repositorio.
- Las cuatro pestañas, dos vueltas completas, en escritorio y móvil: **cero errores de JavaScript**,
  sin desbordamiento horizontal, la leyenda no salta al arrastrar y la lectura día a día responde.

**Fuera de alcance:** que `panel.json` y `precios.json` reflejen bien el mercado, que depende de
TradingView y del build; y la lógica de Seguimiento, Mis posiciones y Parámetros, que no se ha
reauditado. El próximo build real es el **lunes 26 a las 21:30 UTC**.

### 2026-10-25 — Seguimiento medía con «no vender nunca»

Borja, mirando la pestaña Seguimiento: *«¿seguro que esto está bien? ¿solo un 0,1 %? Si es que si
saltan los stop se venden, no se mantienen.»* Tenía razón. **Es el mismo fallo que se corrigió ayer
en Resultados**, en una pestaña que yo mismo había declarado fuera del alcance de la auditoría.

La casilla de cabecera y el banner del índice usaban `a.ret`, que es «comprar y no vender nunca».
COHU entraba en esa media con **−35 %** cuando el stop la habría sacado en **−21 %**.

| | |
|---|---|
| lo que enseñaba | +0,1 % |
| la media del sistema, con los stops | **+1,2 %** |

### El arreglo es de fondo, no un parche

El bucle que recorre una entrada aplicando las reglas estaba **duplicado**: una copia en
`resultados.js` y ninguna en `seguimiento.js`. Ahora hay una sola:

```
reglas.js   REGLAS.recorrido(compra, sesiones, precioDe, emaDe)   ← la lógica, pura y testeable
app.js      recorridoConReglas(clave, entrada, compra)            ← le conecta los datos
            resultados.js y seguimiento.js lo usan
```

Esto cierra el patrón que ha costado dos fallos en dos días: ayer la misma acción salía a −15,7 % en
una tabla y a −5,6 % en otra porque había dos copias del bucle y una llamaba a `stopDe` con dos
argumentos de menos.

**Seguimiento pasa a ser asíncrono** para cargar la serie diaria antes de pintar. Sin ella `PRECIOS`
vale `null`, `cierre()` cae al precio del top y el recorrido solo ve los días en que la acción
estaba **dentro** del top: con COHU veía 3 sesiones y no le saltaba el stop.

### Otro fallo encontrado de camino, en `posiciones.js`

El previsualizador de «si añades a esta posición, tu stop queda en…» llamaba a `stopDe` **sin
`ganMax`**. Comprada a 100, máximo 125, hoy a 110: la tarjeta decía stop **100** y esa vista, **85**.
Misma familia. Corregido.

### Pruebas

- **11 nuevas** en `reglas.test.js` para `REGLAS.recorrido`, puras y sin navegador.
- Las de `simula()` pasan a comprobar que **delega** bien, no a reimplementar el bucle.
- Integridad: nadie más puede mantener su propio trinquete, y **toda** llamada a `stopDe` de una
  posición existente tiene que pasar los cuatro argumentos. Con un escáner que equilibra paréntesis,
  porque la expresión regular cortaba dentro de `num(emaDe(f))`.
- 5 de humo para Seguimiento, verificadas con dos mutaciones.

### Dos fallos propios en las pruebas

1. **`[+-−]` en 10 sitios**: no son tres símbolos, es un **rango** de `+` a `−`, o sea casi todo el
   ASCII. Casaba con letras («o45 %») y hacía esas comprobaciones mucho más laxas de lo que
   parecían. Escapado a `[+\-−]`.
2. Metí las 11 pruebas nuevas **dentro del `if (fallos)`** del final del fichero: solo se habrían
   ejecutado si algo fallaba. Es la segunda vez que cometo ese error exacto en este proyecto. Se vio
   porque el total seguía en 95.

**351 comprobaciones en verde.** Versión `6daadd8a`, verificada en producción: casilla +1,2 % «media
con los stops», aclaración con el +0,1 % de aguantar al lado, banner coherente (+2,9 pt), cero
errores de JavaScript.

### 2026-10-25 — PENDIENTE PARA NOVIEMBRE: ¿discrimina la puntuación?

Pregunta de Borja: *«¿no tendría sentido hacer la media con el top 10 en vez de con todas?»*.
Respuesta medida: **ya está hecha con el top 10**, porque toda acción anotada llegó al registro
*por* entrar en el top 10. «Las que entraron en el puesto 1-10» y «todas» son el mismo conjunto de
28, con la misma media de +1,23 %. La única variante que cambiaría el número es «las que **siguen
hoy** en el top» (+12,07 %), que es el sesgo de supervivencia ya documentado.

**Lo que sí hay que mirar en noviembre.** Al comprobarlo salió un desorden que conviene no olvidar.
Media por entrada con los stops aplicados, según el puesto que ocupaban **al entrar**:

| puesto al entrar | n | con stops |
|---|---|---|
| 1-2 | 4 | **−4,17 %** |
| 1-3 | 7 | −0,18 % |
| 1-5 | 9 | **+5,64 %** |
| 1-10 (todas) | 28 | +1,23 % |

Y por tramos de nota al entrar:

| nota | n | con stops |
|---|---|---|
| 85 o más | 5 | +2,44 % |
| 80-84 | 7 | **−4,14 %** |
| 75-79 | 12 | **+4,86 %** |
| menos de 75 | 4 | −1,80 % |

**Las dos series están desordenadas.** Si la puntuación midiera algo, el rendimiento bajaría según
baja la nota, y no lo hace: el tramo 80-84 es el peor de los cuatro y el 75-79 el mejor. Con n entre
4 y 12 esto **es ruido y no significa nada todavía** — quedarse con el +5,64 % del puesto 1-5 sería
elegir el número bonito. Pero es la primera señal que tenemos sobre si la nota discrimina.

**Qué hacer y cuándo.** A **finales de noviembre de 2026** se alcanzan las 30 entradas maduras y la
pestaña Resultados desbloquea sola la tarjeta «¿sirve de algo la puntuación?», que parte por la
mediana. Entonces:

1. Repetir esta tabla con las entradas maduras. Si sigue igual de desordenada, hay que hablarlo.
2. **No tocar los pesos aun así.** El acuerdo del 7 de octubre sigue en pie: hacen falta 150-200
   entradas para distinguir diferencias de 5-6 puntos, y 30 solo detectan diferencias de 14 pp.
   Treinta entradas sirven para **sospechar**, no para **ajustar**.
3. Lo que sí se puede decidir con 30: si la nota no ordena nada en absoluto, la pestaña no debería
   presentar el orden como «más momentum» sin matizarlo.

Ver también la entrada del 24/10/2026 sobre las tres tarjetas que se desbloquean solas a finales de
noviembre y hay que colocar dentro del orden actual, no encima.
