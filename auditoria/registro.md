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
