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

**Fallo que introdujo este cambio y se arregló en el mismo commit.** El aviso `crecida` de
`docs/reglas.js` se disparaba cuando el requisito de capitalización fallaba en una posición abierta, y
el texto decía "ha superado el techo de capitalización". Sin techo, ese requisito solo puede fallar
**por abajo**, así que a una acción hundida por debajo de 300 M el panel le habría dicho lo contrario de
lo que pasaba. Renombrado a `capitalizacion`, con el valor real en el mensaje. Sigue siendo aviso y no
venta (`entrada: true`).

**Pruebas.** 329 comprobaciones en verde. Las 13 nuevas se verificaron contra el código anterior: 8
fallan con el techo puesto (5 en `filtros.test.py`, 3 en `humo.test.js`) y las otras son invariantes
que el cambio no debía romper (el suelo sigue filtrando, el requisito sigue siendo solo de entrada).

**Qué haría falta para revertirlo.** Si al llegar a 30 entradas maduras (≈ finales de noviembre) las de
más de 10.000 M salen sistemáticamente peor que las pequeñas en el registro propio, se vuelve a poner
el techo. `tests/filtros.test.py` tiene dos comprobaciones que impiden que alguien lo reponga sin
decidirlo.
