# Cambios en las señales de venta — 5 de noviembre de 2026

Para pasárselo a la otra aplicación. **Sustituye** lo que dice el documento principal
(`instrucciones-para-otra-app.md`) sobre la devolución de ganancias; todo lo demás sigue igual.

---

## Por qué se cambia

El sistema llevaba **42 entradas** y había cerrado **15 operaciones: las 15 en pérdida**. Cero
salidas por la regla de devolución. Nunca había realizado una ganancia, y tenía 197 puntos de
beneficio flotando en 19 posiciones abiertas.

La causa, medida: la devolución empezaba en el **+30 %**, y de 39 entradas con recorrido **solo 1
(el 3 %) llega ahí**. El pico mediano de una entrada es **+5,5 %**. Era una regla de beneficio
calibrada para ganancias que el sistema casi nunca produce.

---

## Cambio 1 — escalón nuevo en el +20 %

```
limiteDevolucion(ganMax):
    si alMenos(ganMax, 100):  devolver 40
    si alMenos(ganMax,  30):  devolver 50
    si alMenos(ganMax,  20):  devolver 50      # ← NUEVO
    si no:                    devolver null
```

En la práctica el resultado es: **a partir del +20 % de ganancia máxima, se vende si devuelve la
mitad de lo que llegó a ganar.** Por debajo del +20 %, manda solo el stop.

El resto del cálculo no cambia:

```
devuelto = (1 - gan / ganMax) * 100
vender si  limite != null  y  alMenos(devuelto, limite)
```

### Por qué +20 % y no +15 ni +10

Por debajo de ahí la regla **salta con el ruido**. Estas acciones se mueven un **4,6 % al día**
(ADR mediano), así que dos días de movimiento normal son 9,3 puntos:

| Escalón | Deja devolver | En días de rango | |
|---|---|---|---|
| pico +10 %, devuelve 50 % | 5,0 pt | 1,1 días | salta sola |
| pico +15 %, devuelve 50 % | 7,5 pt | 1,6 días | salta sola |
| **pico +20 %, devuelve 50 %** | **10,0 pt** | **2,2 días** | **válido** |
| pico +30 %, devuelve 50 % | 15,0 pt | 3,2 días | válido |

Es el mismo criterio con el que el panel juzga si un stop es un nivel o una moneda al aire.

Bajarlo a +15 % o +10 % «mejoraba» más la media en el histórico, pero esa mejora venía **de dos
acciones** (IOVA y TEAM): descontándolas, ninguna variante mejoraba nada.

---

## Cambio 2 — el stop sube solo: trailing a 2 días de rango

**Este es el cambio importante, y es el que contesta a «del 10 al 20 % ya debería protegerme».**

Hasta ahora el stop solo tenía tres candidatos: la EMA 50, el suelo del −15 % y tu precio de compra
(a partir del +20 %). Entre el 0 % y el +20 % de ganancia **no había nada**: una posición al +15 %
tenía el stop en la EMA 50, que suele estar por debajo de lo que pagaste. Podía devolver los 15
puntos enteros y seguir bajando hasta el −12 % sin que el sistema dijera una palabra.

Se añade un cuarto candidato:

```
nivel = cierreMasAltoDesdeTuCompra × (1 − 2 × ADR / 100)

stop = max(EMA 50, compra × 0,85, compra si ganMax ≥ 20 %, stop de ayer, nivel)

pero el nivel SOLO cuenta si nivel > tu precio de compra
```

Tres cosas que hay que respetar al implementarlo:

1. **La distancia se mide en días de rango de ESA acción (ADR), no en un porcentaje fijo.** Un 10 %
   es medio día en una acción que se mueve un 6 % diario y una semana en una que se mueve un 1,5 %.
   El mismo porcentaje fijo para las dos o salta solo o no protege nada.
2. **Se mide desde el CIERRE más alto**, no desde el máximo intradía. El stop solo actúa con
   cierres; medir desde una mecha adelantaría la venta sin motivo.
3. **Solo se aplica si el nivel queda por encima de tu precio de compra.** Es la condición que evita
   apretar un stop que todavía no asegura nada: si 2 ADR por debajo del máximo sigue estando en
   pérdida, manda la EMA 50 como siempre.

### Qué protege, con números

Acción de ADR 4,6 % (lo típico aquí), compras a 100 $:

| Llegó a | Stop antes | Stop ahora | Qué te asegura |
|---|---|---|---|
| +10 % | 85,00 $ | 85,00 $ | nada: 2 ADR por debajo de 110 es 99,88 $, aún por debajo de tu compra |
| +12 % | 85,00 $ | **101,70 $** | +1,7 % |
| +15 % | 85,00 $ | **104,42 $** | **+4,4 %** |
| +20 % | 100,00 $ | **108,96 $** | +9,0 % |
| +29 % | 100,00 $ | **117,13 $** | +17,1 % |
| +40 % | 100,00 $ | **127,12 $** | +27,1 % |

El punto de activación sale de la propia fórmula: el trailing empieza a mandar cuando
`(1 + g) × (1 − 2·ADR) > 1`, que con ADR 4,6 % es **a partir del +10,2 %**. En una acción tranquila
de ADR 1,5 % entra ya en el **+3,1 %**. Es automático, no hay un umbral que configurar.

### Por encima del +20 % manda él, no la devolución

En el caso del +40 % las dos reglas opinan, y **el trailing es más apretado**: la devolución dejaría
caer hasta 120 $ (devolver la mitad del pico) y el trailing saca a 127,12 $. **Siete puntos más en
el bolsillo.** Las dos se quedan vivas porque protegen en escenarios distintos: si el ADR de la
acción se desploma, el trailing calculado sobre un ADR diminuto se pegaría demasiado al precio y es
la devolución la que pone el límite sensato.

---

## Cambio 3 — el aviso de ganancia más pequeña que el ruido

No vende, no mueve el stop. Solo informa.

```
ganancia-corta:  si limite == null  y  adr > 0  y  ganMax ≥ 2 × adr  y  stop < compra

paraTrailing = (2 × adr) / (1 − 2 × adr / 100)     ← la ganancia en que el stop empieza a subir
falta        = max(0, paraTrailing − ganMax)        ← lo que se le dice al usuario
```

**Dos trampas que hay que evitar al implementarlo**, las dos encontradas en el panel el mismo día:

- **`adr > 0`, no solo `adr`.** Un ADR negativo invierte la resta del trailing y coloca el stop por
  encima del máximo alcanzado y del precio de hoy: una venta forzada a un precio que no existe.
- **`falta` no se mide contra el umbral del propio aviso (2 × adr).** Es la misma línea que lo
  dispara, así que vale 0 siempre y la frase que lo imprime nunca se ve. Se mide contra
  `paraTrailing`, que es la ganancia en la que el stop sube de verdad.

Significa: *tienes una ganancia real y todavía no hay ninguna regla que la proteja.*

**Con el trailing esta franja se ha quedado muy estrecha, y eso es exactamente lo que se quería.**
Las dos líneas salen del mismo número (2 ADR), así que el aviso solo cubre el punto o dos en los que
la ganancia ya es real pero el nivel del trailing todavía no alcanza tu precio de compra:

| ADR de la acción | Avisa entre |
|---|---|
| 1,5 % al día | solo en el +3,0 % |
| 4,6 % al día (lo típico) | +9,2 % y +10,1 % |
| 8 % al día | +16,0 % y +19,0 % |

Por debajo de 2 ADR no se avisa, y es deliberado: esa «ganancia» es el vaivén de un día, no hay nada
que proteger. Si se avisara con cualquier ganancia, **todas** las posiciones en verde saldrían
marcadas y el aviso no significaría nada. **Exige el ADR**: sin ese dato no se puede saber si la
ganancia es un movimiento o ruido, y avisar por si acaso marca como VIGILAR cualquier posición
al +2 %.

Texto sugerido: *«ha llegado a +9,5 % (2,1 días de su movimiento normal) pero tu salida sigue en
85,00 $, por DEBAJO de tu precio de compra: si se da la vuelta ahora, no te llevas nada de esa
ganancia. Con 0,6 puntos más (+10,1 %) el stop sube solo a terreno de beneficio.»*

---

## Lo que NO ha cambiado

- El stop de entrada y el suelo del −15 %. Iguales: lo que cambia es cómo SUBE después.
- Las otras tres señales de venta (stop perdido, RSI < 45, dos requisitos rotos). Iguales.
- El escalón del +100 % → devolver 40 %. Igual.
- Todos los avisos anteriores (EMA 21, resultados en ≤10 días, un requisito roto, devolviendo al
  60 % del límite). Iguales.

---

---

## Los dos casos concretos que preguntaste

**Compras a 100 $ y sube a 115 $ (+15 %), acción de ADR 4,6 %:**

| | Antes | Ahora |
|---|---|---|
| Stop | 88,00 $ (−12 % sobre tu compra) | **104,42 $ (+4,4 %)** |
| Regla de beneficio | ninguna | ninguna (entra en el +20 %) |
| Podía acabar en pérdida | **sí** | **no** |

La protege el trailing: 2 días de rango por debajo de 115 son 104,42 $, y eso está por encima de los
100 $ que pagaste. Si a partir de ahí no vuelve a subir, te vas con +4,4 %. Si sigue subiendo, el
stop sube con ella.

**Compras a 100 $ y sube a 140 $ (+40 %):**

| | Antes | Ahora |
|---|---|---|
| Stop | 100,00 $ (tu precio de compra) | **127,12 $ (+27,1 %)** |
| Vende si cae a | 120,00 $ → +20 % | **127,12 $ → +27,1 %** |

Manda el trailing porque es más apretado que la devolución. De un pico del +40 % te llevas 27 puntos
en vez de 20.

**Y el caso que preguntaste al final: sube un 20 o un 30 % en un día y luego corrige.** Ese salto es
lo que pone el nivel en su sitio. Un +25 % de golpe en una acción de ADR 4,6 % deja el stop en
113,50 $ al cierre de ese mismo día: si al día siguiente corrige hasta ahí, sales con +13,5 %. Lo
que el sistema **no** hace es venderte en el máximo — nadie puede — ni venderte por una corrección
de un día normal, que es precisamente lo que se evita midiendo la distancia en días de rango.

---

## Efecto medido sobre las 42 entradas

**El trailing no cambia NI UNA de las salidas del registro.** Rehaciendo las 42 entradas día a día,
el resultado es idéntico con el trailing apagado y con 2, 2,5, 3, 4 o 5 días de rango:

| | Sin trailing | Con trailing (2 ADR) |
|---|---|---|
| Operaciones cerradas | 16 | 16 |
| Cerradas en verde | 1 (CAI, +8,1 %) | 1 (CAI, +8,1 %) |
| Media sobre las 42 | −0,08 % | −0,08 % |

El motivo es el que ya sabíamos: las 15 cerradas en pérdida nunca tuvieron ganancia suficiente para
activarlo. **Hay que decirlo claro: esto no es una mejora demostrada en el histórico.** Es una red
para los ganadores que todavía están abiertos, y ahí el efecto es grande — diez de las abiertas
pasan de tener el stop por debajo de lo que se pagó a tenerlo en ganancia:

| | Ganancia hoy | Pico | Stop asegura |
|---|---|---|---|
| FIGS | +46,5 % | +46,5 % | **+33,8 %** |
| CDNA | +34,6 % | +38,7 % | **+23,2 %** |
| HNGE | +22,9 % | +22,9 % | **+12,5 %** |
| SLDE | +10,8 % | +18,1 % | **+10,0 %** |
| RSKD | +13,1 % | +18,4 % | **+8,2 %** |
| CAI | +11,9 % | +21,7 % | **+7,7 %** |
| HALO | +11,6 % | +12,3 % | **+7,2 %** |
| OABI | +19,1 % | +21,4 % | **+4,7 %** |
| SEPN | +15,7 % | +15,7 % | **+2,9 %** |
| FLYW | +10,8 % | +10,8 % | **+2,8 %** |

### Por qué 2 días de rango y no menos

Se probó toda la curva sobre las 42 entradas. Apretarlo sí mueve el histórico, y **no lo mejora**:

| Distancia | Cerradas | En verde | Media sobre las 42 |
|---|---|---|---|
| 0,5 ADR | 30 | 16 | −0,46 % |
| 1 ADR | 23 | 6 | −1,20 % |
| 1,5 ADR | 19 | 3 | −0,10 % |
| **2 ADR** | **16** | **1** | **−0,08 %** |
| 3 ADR o más | 16 | 1 | −0,08 % |

2 ADR es el primer valor que **no toca** el histórico, y es el mismo número que usa el resto del
sistema para decidir si un nivel es un nivel o una moneda al aire. Por debajo se vende más y en
peores sitios: con 1 ADR se cierran 7 posiciones más y la media empeora un punto entero.

Una advertencia honesta sobre esta tabla: son 42 entradas y un solo régimen de mercado. Dice que
apretar no ayuda, lo cual es suficiente para no apretar. **No** dice que 2 sea el óptimo; con esta
muestra no se puede saber, y cualquier valor entre 2 y 5 da exactamente lo mismo aquí.
