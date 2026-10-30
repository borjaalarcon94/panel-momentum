# Instrucciones para reproducir las señales del panel en otra aplicación

Documento para pasárselo a otra app (o a otra IA) y que genere **exactamente las mismas**
señales de comprar, vigilar, vender y los mismos stops que
<https://borjaalarcon94.github.io/panel-momentum/>.

No es un resumen divulgativo: es la especificación. Cada número y cada orden de evaluación está
copiado del código que corre en producción (`docs/reglas.js`, `docs/app.js`, `docs/puntuacion.js`).
Donde algo **no** se puede reproducir sin los datos que el panel descarga, lo digo en vez de
inventar un sustituto.

**No es asesoramiento financiero.** Es un sistema de detección para estudiar cada caso a mano.

---

## 0. Cómo usar este documento

Está en capas. Cada capa es independiente y se puede implementar sin la siguiente:

| Capa | Qué da | Datos que necesita |
|---|---|---|
| **1. Stop** | el precio exacto al que sale cada posición | precio, EMA 50, tu precio de compra |
| **2. Señales de una posición abierta** | vender / vigilar / mantener | lo anterior + EMA 21, RSI 14 |
| **3. Señales de una acción que no tienes** | si está rota o no | precio, EMA 21, EMA 50, RSI 14, máximo de 1 mes |
| **4. Veredicto de compra** | COMPRA / arriesgada / esperar / no comprar | lo anterior + los 9 requisitos |
| **5. Puntuación 0-100** | el orden del top | **no reproducible sin datos fundamentales** (ver §7) |

Si la otra app es un seguimiento de cartera, **las capas 1 y 2 son el 90 % de lo que te interesa**:
son las que deciden cuándo se vende lo que ya tienes. Y se implementan solo con el precio de cierre
y tres medias.

---

## 1. Datos de entrada

Todo se calcula sobre **cierres diarios**. No hay intradía en ningún punto del sistema.

| Nombre | Definición exacta |
|---|---|
| `precio` | último cierre |
| `ema9`, `ema21`, `ema50` | medias móviles **exponenciales** de 9, 21 y 50 sesiones |
| `sma200` | media móvil **simple** de 200 sesiones |
| `rsi` | RSI de 14 sesiones |
| `max52`, `min52` | máximo y mínimo de 52 semanas (intradía, como los publica el mercado) |
| `max1m`, `max3m` | máximo de 1 y 3 meses (intradía) |
| `adr` | recorrido medio diario en %, `media((high-low)/low)` de 20 sesiones |
| `atr` | rango verdadero medio, en dólares |
| `cap` | capitalización en dólares |
| `volmedio` | volumen medio diario en acciones |
| `ingresos` | crecimiento de ingresos a 12 meses, en % interanual |
| `ingresosq` | crecimiento de ingresos del **último trimestre**, en % interanual |
| `resultados` | fecha de la próxima publicación de resultados |

Convención de todo el documento: un valor que no existe es `null`, y **una comparación con `null`
nunca dispara una señal**. Si no sabes el RSI, no hay señal de RSI; no se asume que esté bien.

### Comparaciones con holgura

Todas las comparaciones «≥ umbral» usan una tolerancia de `1e-9`:

```
alMenos(valor, umbral)  =  valor >= umbral - 1e-9
```

**Esto no es cosmético.** En coma flotante `(120/100 - 1) * 100` da `19,999999999999996`, y un
`>= 20` pelado deja fuera justo el caso límite: una posición que ha ganado exactamente el 20 % no
recibiría la protección del coste. Si tu implementación no usa la holgura, divergirá del panel en
los casos frontera, que son precisamente los que importan.

---

## 2. Capa 1 · El stop

### La fórmula

```
stopDe(precio, ema50, compra, stopPrevio, ganMax):

    ref = compra  (si no hay precio de compra —es una acción que solo vigilas— ref = precio)
    si ref es null: no hay stop

    gan   = (precio / compra - 1) * 100        # 0 si no hay precio de compra
    pico  = max(ganMax, gan)                   # ganMax = la ganancia MÁXIMA alcanzada, no la de hoy
    suelo = ref * (1 - 15/100)                 # = ref * 0,85

    si alMenos(pico, 20):  base = max(ema50, ref)       # protección del coste
    si no:                 base = max(ema50, suelo)

    stop = max(base, stopPrevio)
```

Leído en palabras: **el stop es el mayor de cuatro candidatos.**

1. **la EMA 50** — el nivel técnico; mientras no la pierda, la tendencia está intacta;
2. **tu precio de compra − 15 %** — el suelo de pérdida máxima, para no arriesgar más de eso
   aunque la EMA 50 esté lejísimos;
3. **tu precio de compra**, en cuanto la posición haya llegado a ganar un 20 % — a partir de ahí
   la operación no puede acabar en pérdida;
4. **el stop más alto que ya alcanzó** (`stopPrevio`) — **el stop nunca baja**, ni aunque la
   EMA 50 retroceda.

### Las tres trampas de esta fórmula

Son errores que ya se cometieron en el panel y hubo que arreglar. Si la otra app los repite, dará
números distintos y parecerá que una de las dos está mal.

**(a) `ganMax` es la ganancia máxima HISTÓRICA, no la de hoy.** La regla dice «*superado* el 20 %,
el stop sube a tu compra», y superado significa una vez, para siempre. El código del panel miraba
la ganancia de hoy: una posición que llegó a +25 % y cayó a +10 % **perdía la protección del
coste**. Solo se salvaba si `stopPrevio` había capturado el nivel aquel día, o sea, si la app
estaba abierta justo entonces. Eso ataba una regla del sistema a un hábito del usuario. Si tu app
calcula el stop desde cero cada vez que se abre, **tiene que recorrer el histórico** (§2.2) o
guardar `ganMax` y `stopPrevio` persistidos.

**(b) `ganMax` se mide en CIERRES, no en máximos intradía.** El stop solo actúa con cierres, así
que medir desde una mecha es medir desde un nivel al que el sistema nunca habría reaccionado. Con
datos reales esa mecha está de media un 6 % por encima del cierre y llega al 18 %, lo que
adelantaba la venta varios puntos de ganancia.

**(c) No se pueden omitir argumentos.** Sin `ema50` el stop se queda en el suelo del −15 %, mucho
más flojo que el de verdad. Esto causó que la misma acción saliera a **−15,7 %** en una tabla y a
**−5,6 %** en otra el 24/10/2026.

### 2.1 Validez del stop

Con el precio de compra = precio de hoy (es decir, «¿qué stop tendría si entro ahora?»):

```
distanciaStop   = (stop / precio - 1) * 100          # negativo = cuánto hay que caer
distanciaEma50  = (ema50 / precio - 1) * 100         # idem hasta la EMA 50
sobreEma50      = (precio / ema50 - 1) * 100         # cuánto está el precio POR ENCIMA

tope     = NO alMenos(distanciaEma50, -15)           # la EMA 50 está más lejos que el -15 %
invalido = stop >= precio
precioSinTope = ema50 * 1,15                         # ahí el stop vuelve a ser la EMA 50
```

- **`tope` = true** → el stop no es un nivel técnico sino una línea fija al −15 %, que el precio
  puede cruzar sin que nada se haya roto. Es lo que produce el veredicto **Compra arriesgada**.
- **`invalido` = true** → el precio ya cotiza por debajo de su EMA 50, así que el stop calculado
  sale **por encima** del precio: entrar ahí sería entrar ya saltado. No es un stop, es la prueba
  de que la tendencia está rota. **Nunca calcules tamaño de posición sobre un stop inválido**, y
  no lo muestres como «+5 % desde aquí», que no significa nada.

Ojo con `distanciaEma50` frente a `sobreEma50`: **no son el mismo número**. El primero es cuánto
hay que caer hasta la EMA 50; el segundo, cuánto está el precio por encima de ella, y siempre sale
mayor. Con un caso real: 11,70 % frente a 13,25 %.

### 2.2 Recorrido histórico de una posición

Para saber dónde está hoy el stop de una posición abierta hace semanas hay que **recorrer** sus
sesiones en orden, porque el stop depende de su propio pasado. Este bucle es la única fuente de
verdad del panel; tener dos copias fue el origen del fallo (c).

```
recorrido(compra, sesiones, cierreDe, ema50De):
    maxVisto = compra;  stopPrevio = 0;  cerrada = false

    para cada sesión f posterior a la compra, en orden:
        p = cierreDe(f)
        si p es null: continuar          # no tenemos su cierre ese día: NO se inventa
        maxVisto = max(maxVisto, p)
        si cerrada: continuar

        gan    = (p / compra - 1) * 100
        ganMax = (maxVisto / compra - 1) * 100

        stopPrevio = max(stopPrevio, stopDe(p, ema50De(f), compra, stopPrevio, ganMax))

        si p < stopPrevio:
            salida = p;  motivo = 'stop';  cerrada = true;  continuar

        limite   = limiteDevolucion(ganMax)                  # §3.1
        devuelto = si ganMax > 0: (1 - gan / ganMax) * 100, si no 0
        si limite != null y alMenos(devuelto, limite):
            salida = p;  motivo = 'devolución';  cerrada = true

    devolver salida (o null si nunca saltó)
```

Dos detalles: el stop se recalcula **antes** de comprobar si salta (el stop de hoy manda hoy), y
la regla de devolución se comprueba **después** del stop, así que si los dos se cumplen el mismo
día el motivo registrado es `stop`.

---

## 3. Capa 2 · Señales de una posición abierta

### 3.1 Devolución de ganancias

```
limiteDevolucion(ganMax):
    si alMenos(ganMax, 100):  devolver 40      # ha doblado: se le permite devolver el 40 %
    si alMenos(ganMax,  30):  devolver 50      # entre +30 % y +100 %: la mitad
    si no:                    devolver null    # por debajo de +30 % manda SOLO el stop
```

### 3.2 La ganancia máxima alcanzada

```
maximoDesdeCompra(precio, compra, maxRegistrado, dias, maxSerie):
    candidatos = [ maxRegistrado o compra,  precio,  maxSerie ]
    si maxSerie es null:                           # no tenemos serie diaria propia
        si max1m != null y dias <= 30: añadir max1m
        si max3m != null y dias <= 90: añadir max3m
    devolver max(candidatos)
```

`maxSerie` es el **cierre** más alto desde la compra según tu serie diaria guardada. Cuando existe,
manda y los intradía no se usan (razón en §2, trampa b). Sin serie se usan los intradía: más vale
un máximo algo alto que ninguno. **Un máximo ya registrado no se olvida nunca.**

### 3.3 Evaluación

```
evaluaPosicion(datos, compra, maxRegistrado, stopPrevio, dias, requisitos, diasResultados, maxSerie):

    si precio es null o compra es null: devolver estado 'sindatos'

    gan      = (precio / compra - 1) * 100
    maxVisto = maximoDesdeCompra(...)
    ganMax   = si maxVisto: (maxVisto / compra - 1) * 100, si no gan
    devuelto = si ganMax > 0: (1 - gan / ganMax) * 100, si no 0
    stop     = stopDe(precio, ema50, compra, stopPrevio, ganMax)
    limite   = limiteDevolucion(ganMax)
    fallos   = requisitos que NO cumplen y que NO son de solo-entrada        # §5.1

    MOTIVOS DE VENTA  (se acumulan todos los que apliquen, no es cascada)
      stop        si stop != null y precio < stop
      rsi         si rsi != null y rsi < 45
      devuelto    si limite != null y alMenos(devuelto, limite)
      requisitos  si fallos >= 2

    AVISOS  (siempre)
      capitalizacion  si el requisito de capitalización (solo-entrada) está roto
      resultados      si 0 <= diasResultados <= 10

    AVISOS  (solo si NO hay ningún motivo de venta)
      un-requisito    si fallos == 1
      devolviendo     si limite != null y alMenos(devuelto, limite * 0,6)
      ema21           si ema21 != null y precio < ema21

    estado = 'vender'   si hay motivos
             'vigilar'  si no, y hay avisos
             'mantener' si no
```

### 3.4 Por qué cada regla

| Regla | Umbral | Motivo |
|---|---|---|
| Stop perdido | `precio < stop` | el stop ES la EMA 50 con tope: perderlo es perder la tendencia |
| RSI | `< 45` | se acabaron los compradores |
| Devolución | 50 % entre +30 y +100; 40 % por encima de +100 | una subida grande que se devuelve a medias ya no es una subida |
| Deterioro del negocio | **2 o más** requisitos roto | uno solo es VIGILAR, no venta |
| Aviso de devolución | al **60 %** del límite | avisa antes de vender |
| Aviso de EMA 21 | `precio < ema21` | primera señal de debilidad |
| Aviso de resultados | **≤ 10 días** | puede abrir con un hueco que el stop no evita |

**Perder la EMA 50 no es una regla aparte.** El stop es `max(EMA 50, …)`, así que si el precio
pierde la EMA 50 ya está por debajo del stop y lo coge la primera rama. En el panel había una rama
`else if` para eso que **no se ejecutaba nunca**: 0 de 6.720 combinaciones en una rejilla
exhaustiva. No la implementes como regla separada en una posición abierta.

---

## 4. Capa 3 · Señales de una acción que NO tienes comprada

Las mismas reglas de mercado, sin las que dependen de tu precio de entrada. **Aquí la EMA 50 sí es
una regla propia**, porque no hay stop con el que confundirla.

```
senalesDeMercado(datos):
    señales = []
    si precio < ema50:        añadir 'ema50'      # la tendencia se ha roto
    si no, si precio < ema21: añadir 'ema21'      # primera señal de debilidad
    si rsi < 45:              añadir 'rsi'

    caida = (precio / max1m - 1) * 100
    si alMenos(-caida, 15):   añadir 'caida-mes'  # ha caído >= 15 % desde su máximo del mes
```

Nótese el `si no`: EMA 50 y EMA 21 son excluyentes (perder la 50 implica haber perdido la 21).

---

## 5. Capa 4 · Veredicto de compra

### 5.1 Los 9 requisitos

Se comprueban **todos los días sobre cada acción**. Si falla uno solo, la empresa no entra en el
top. Umbrales actuales (viajan en `panel.json → criterios`, no están escritos a mano en el código):

| # | Requisito | Umbral | Solo entrada |
|---|---|---|---|
| 1 | Capitalización | `> 300 M $` (sin techo desde el 14/10/2026) | **sí** |
| 2 | Precio | `> 2 $` | **sí** |
| 3 | Volumen medio | `> 300.000 acciones` | no |
| 4 | Dinero negociado | `volmedio × precio > 2 M$/día` | no |
| 5 | Tendencia de fondo | `precio > sma200` | no |
| 6 | Tendencia corta | `ema9 > ema50` | no |
| 7 | RSI 14 | `> 55` | no |
| 8 | Crecimiento de ingresos | `max(ingresos, ingresosq) >= 20 %` | no |
| 9 | Distancia al máximo | `(precio/max52 - 1)*100 >= -20 %` | no |

**«Solo entrada» es crítico.** La capitalización y el precio mínimo se exigen para entrar, pero si
una empresa que **ya tienes** deja de cumplirlos, es **aviso y no venta**. Un requisito de solo
entrada roto nunca cuenta en el `fallos >= 2` de la §3.3. Crecer o encogerse de tamaño no es motivo
de venta.

El requisito 8 usa el **mayor** de los dos crecimientos, el anual y el del último trimestre.

Además hay un **filtro de universo** que no es un requisito vigilado: se excluyen al elegir el top
las navieras, petroleras, mineras, químicas, utilities, REITs y gestoras, porque su crecimiento
viene del precio de una materia prima. No se vigila después: si una empresa que ya tienes se
reclasificara a un sector excluido, el panel no lo marcaría.

### 5.2 La cascada

**Gana el primero que se cumple.** El orden importa y es esta fuente de error: una acción a más
del 10 % de su máximo **y** con la EMA 50 lejos muestra «Esperar», no «Compra arriesgada».

```
1. sinSeguimiento              → "Sin datos"           la fuente ya no devuelve ese símbolo
2. algún requisito NO-solo-entrada roto
                               → "Ya no cumple"
3. senalesDeMercado() no vacía → "No comprar"          §4
4. extendida                   → "No comprar aquí"     §7.1 — muy estirada
5. flojea                      → "Vigilar"             la nota cayó > 8 puntos desde que entró
6. (precio/max52 - 1)*100 < -10
                               → "Esperar"             §5.3
7. tope                        → "Compra arriesgada"   §2.1
8. ninguno de los anteriores   → "COMPRA"
```

Distinción que conviene no perder: el requisito 9 exige estar a menos del **20 %** del máximo para
entrar en el top; el veredicto pasa a «Esperar» ya a más del **10 %**. Son dos umbrales distintos
a propósito: el primero decide si aparece, el segundo si hoy se compra.

Dos notas de implementación sobre los pasos 1, 2 y 5, que no se calculan dentro de la cascada sino
que se le pasan desde fuera:

- **`flojea`** (paso 5) compara la nota de hoy con la que tenía **el día que entró en el top**, y la
  racha se corta si falta un día: si la acción desapareció del listado y volvió, se cuenta desde la
  vuelta. Si la otra app no guarda la nota de entrada, este paso no puede existir y la acción
  seguirá como COMPRA mientras cumpla.
- **`fallos`** (paso 2) y **`sinSeguimiento`** (paso 1) los aporta quien llama. En el panel, el
  listado del día se construye con acciones que ya cumplen los 9 requisitos, así que el paso 2 solo
  se activa de hecho en la pestaña de Seguimiento, sobre lo que llevas anotado. **Para tus propias
  posiciones lo que manda no es esta cascada, sino §3.3**: la cascada dice si entrar, `evaluaPosicion`
  dice si salir.

### 5.3 La ventana de compra

Cuando una acción está a más del 10 % de su máximo, el sistema pide **dos cosas a la vez**:

```
suelo = max52 * (1 - 10/100)      # cerca de su máximo: el suelo pide FUERZA
techo = ema50 / (1 - 15/100)      # = ema50 / 0,85: el techo pide que el stop sea TÉCNICO
```

Decir solo «compra a partir del suelo» es mentir cuando el suelo queda **por encima** del techo:
en un caso real del 18/10/2026 la ventana medía −0,32 $, o sea que **no existía ningún precio de
compra limpia**, y aun así se anunciaba uno. Lo que hace falta entonces es que **suba la EMA 50**,
no que suba el precio.

Y una ventana más estrecha que un día de rango de la acción tampoco se puede aprovechar, porque el
precio la cruza entera en una sesión:

```
unDia = precio * adr / 100
si suelo > techo - unDia:  no hay ventana de compra
```

### 5.4 Tamaño de posición

```
TAMANO(distanciaStop, totalCartera, riesgoPct):
    si distanciaStop es null o >= 0: null       # stop inválido: NO se dimensiona
    pctCartera = min(riesgoPct / |distanciaStop| * 100, 25)
    importe    = totalCartera * pctCartera / 100
```

El tope del 25 % no es decorativo: el tamaño es *riesgo ÷ distancia al stop*, así que **un stop muy
pegado produce la posición más grande justo donde la salida es más aleatoria**.

### 5.5 Margen del stop en días de rango

```
MARGEN_STOP(distanciaStop, adr):
    dias = |distanciaStop| / adr
    apretado     = dias < 2
    muyApretado  = dias < 1
```

No es un umbral calibrado, es una definición: si el stop está a menos de un ADR, un día normal lo
cruza. Medido el 25/10/2026 sobre las 32 seguidas, la mediana era 2,0 días y quince estaban por
debajo de 2. **Esto solo avisa: no cambia ni el stop ni el tamaño.**

---

## 6. Gestión de la posición: parciales y promedios

Esta parte no está en `reglas.js` pero cambia los números que entran en él, así que la otra app
tiene que tratarla igual o divergirá.

**Venta parcial** — vendes una parte y dejas la posición abierta. El **precio medio de compra NO
cambia**: vender parte no abarata las que quedan. Por eso el protocolo sigue idéntico, ya que el
stop, la subida del stop al 20 % y la devolución se miden todos contra ese precio. Lo que cambia es
el nº de acciones, el capital que sigue dentro y la ganancia que pasa a dinero real.

**Añadir a una posición (promediar)** — el precio medio se recalcula **ponderado por nº de
acciones**, y **aquí sí** se mueve todo el protocolo: el stop, el nivel del 20 % y la regla de
devolución se miden contra el nuevo precio medio.

- *Promediar al alza* encoge la ganancia máxima medida, y si cae por debajo del +30 %
  **la regla de devolución deja de aplicarse**: te quedas solo con el stop.
- *Promediar a la baja* baja el precio medio y con él el stop, así que aguantas más caída antes de
  salir. Este sistema busca fuerza, no rebajas.

**Contabilidad** — cada salida es una fila del historial, pero una posición vendida en varias veces
cuenta como **UNA** operación en la tasa de acierto. Si contara varias, el «acertadas X de Y» se
infla, y ése es el número con el que se juzga la estrategia. El dinero sí suma todas las salidas.

---

## 7. Capa 5 · La puntuación de 0 a 100

**Aviso honesto: esto no se puede reproducir sin los datos que el panel descarga.** De los 100
puntos, **45 son fundamentales** (crecimiento trimestral, BPA, previsión del próximo ejercicio,
margen bruto, flujo de caja libre, margen neto, caja frente a deuda, regla del 40) y **15 son
fuerza relativa** contra el S&P 500 y contra la mediana del sector. Sin esas fuentes, cualquier
intento de calcular la nota dará un número parecido que ordena distinto.

Estructura, para que la otra app sepa qué es lo que no tiene:

| Bloque | Puntos | Qué mide |
|---|---|---|
| Momentum técnico | 25 | orden de las medias, RSI (7 puntos en la zona ideal 60-72; 4,5 entre 72 y 78; 4 entre 55 y 60; 2 por encima de 78) y subida a 1 y 3 meses |
| Aceleración del crecimiento | 25 | nivel de crecimiento, aceleración del último trimestre, BPA, consistencia anual, previsión |
| Calidad fundamental | 20 | margen bruto, flujo de caja libre, margen neto, caja frente a deuda, regla del 40 |
| Fuerza relativa | 15 | frente al S&P 500 a 3 y 6 meses, y frente a la mediana de su sector |
| Volumen y ruptura | 15 | volumen relativo, ADR, cercanía a máximos, ruptura confirmada por volumen |

A igualdad de puntuación, primero la de menor capitalización.

### 7.1 Penalizaciones — esto SÍ se puede reproducir casi entero

Importa porque `extendida` (el paso 4 de la cascada, «No comprar aquí») sale **solo de aquí**:

```
extEma = (precio / ema50  - 1) * 100
extSma = (precio / sma200 - 1) * 100
mes    = subida en el último mes, en %

pen = 0
si rsi > 85:                      pen += 6      # muy sobrecomprada
si no, si rsi > 80:               pen += 3      # sobrecomprada
si extEma > 80:                   pen += 10     # vertical
si no, si extEma > 50:            pen += 5      # muy estirada
si extSma > 150:                  pen += 4      # muy estirada sobre la media de 200
si mes > 70:                      pen += 5      # movimiento parabólico
si dilucionAnual > 15:            pen += 4      # emite acciones: te diluye       [necesita nº de acciones]
si margenBruto < 15:              pen += 8      # negocio de volumen              [necesita fundamentales]
si no, si margenBruto < 25:       pen += 5
si no, si margenBruto < 35:       pen += 2

pen = min(pen, 15)                # la penalización total está limitada a -15
extendida = (pen >= 9)
```

Seis de las nueve penalizaciones **solo necesitan precio, medias y RSI**. Si la otra app no tiene
margen bruto ni acciones en circulación, puede calcular `pen` con las seis que sí tiene: será
igual salvo en empresas de margen bajo o que diluyen mucho, y nunca dará un `extendida` falso
(solo puede quedarse corto).

### 7.2 Bonus

```
bon = 0
si 20 <= extEma <= 50:  bon += 3      # la zona que históricamente más multiplica
si 20 <= mes    <= 70:  bon += 2      # impulso sano, no parabólico

# bonus por tamaño: cuanto más pequeña, más recorrido
cap < 1.000 M → +5      cap < 3.000 M → +3,5      cap < 6.000 M → +2      resto → +0,5
```

La nota final se acota entre 0 y 100.

**De dónde salen estos umbrales, y cuánto valen:** de 17.934 observaciones semanales de 185
empresas entre 2024 y 2026. Se solapan entre sí y cubren un periodo alcista, así que valen mucho
menos que 17.934 casos independientes. La zona de 20-50 % sobre la EMA 50 y las subidas mensuales
de 20-70 % son las que más multiplican; solo a partir de ahí la mediana se vuelve negativa y las
caídas fuertes se disparan.

---

## 8. Resumen operativo

Para una acción que **ya tienes**, cada día:

1. recorre sus sesiones desde la compra y saca `stopPrevio` y `ganMax` (§2.2);
2. calcula el stop de hoy (§2);
3. evalúa motivos y avisos (§3.3);
4. `vender` / `vigilar` / `mantener`.

Para una acción que **no tienes**:

1. comprueba los 9 requisitos (§5.1);
2. saca las señales de mercado (§4);
3. recorre la cascada de veredictos (§5.2);
4. si es COMPRA o Compra arriesgada, calcula el stop de entrada y el tamaño (§2.1, §5.4).

---

## 9. Lo que el sistema NO ve

Noticias, fraudes, resultados de ensayos clínicos, demandas, cambios regulatorios. Una foto diaria
al cierre: no hay precios intradía, así que un hueco de apertura se salta el stop sin que el
sistema pueda hacer nada. Solo mercado de EE. UU.

Y lo más importante para quien implemente esto: **el panel lleva pocas semanas con dinero real y
sus umbrales no están validados con operaciones propias.** Están calibrados sobre un periodo
alcista y solapado. No se tocan los pesos de la puntuación ni las reglas de salida hasta tener
150-200 entradas maduras. Reproducir las señales no las valida: las reproduce.

---

*Generado desde el código de `panel-momentum`. Los números de este documento se comprueban
automáticamente contra `docs/reglas.js` y `docs/panel.json` en `tests/integridad.test.js`: si
alguien cambia un umbral en el código y no aquí, los tests fallan.*
