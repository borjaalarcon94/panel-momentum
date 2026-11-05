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

## Cambio 2 — aviso nuevo: ganancia más pequeña que el ruido

No vende, no mueve el stop. Solo informa.

```
ganancia-corta:  si limite == null  y  hay adr  y  alMenos(ganMax, 2 * adr)
```

Significa: *tienes una ganancia real y todavía no hay ninguna regla que la proteja.* Cubre toda la
banda entre «la ganancia deja de ser ruido» y el primer escalón de devolución (+20 %).

**El umbral es proporcional a la volatilidad de cada acción**, no un porcentaje fijo:

| ADR de la acción | Avisa a partir de |
|---|---|
| 4,6 % al día (lo típico aquí) | +9,2 % |
| 1,5 % al día (una tranquila) | +3,0 % |

Por debajo de dos días de rango no se avisa, y es deliberado: esa «ganancia» es el vaivén de un día,
no hay nada que proteger. Si se avisara con cualquier ganancia, **todas** las posiciones en verde
saldrían marcadas y el aviso no significaría nada.

Texto sugerido: *«ha llegado a +15,0 % (3,3 días de su movimiento normal) y todavía NO hay regla que
proteja ese beneficio: la devolución entra a partir del 20 %, le faltan 5,0 puntos. Hasta entonces
solo está el stop, que todavía está por debajo de tu precio de compra.»*

---

## Lo que NO ha cambiado

- El stop: `max(EMA 50, compra × 0,85, compra si ganMax ≥ 20 %, stop de ayer)`. Igual.
- Las otras tres señales de venta (stop perdido, RSI < 45, dos requisitos rotos). Iguales.
- El escalón del +100 % → devolver 40 %. Igual.
- Todos los avisos anteriores (EMA 21, resultados en ≤10 días, un requisito roto, devolviendo al
  60 % del límite). Iguales.

---

---

## Los dos casos concretos, con números

**Compras a 100 $ y sube a 115 $ (+15 %), acción de ADR 4,6 %:**

| | |
|---|---|
| Stop | 88,00 $ (−12 % sobre tu compra) — la EMA 50 o el suelo del −15 % |
| Regla de beneficio | **ninguna todavía** |
| El panel avisa | *«+15 %, faltan 5,0 puntos para que entre la devolución»* |

**Compras a 100 $ y sube a 140 $ (+40 %):**

| | |
|---|---|
| Stop | **100,00 $** — ya protege tu precio de compra (superó el +20 %) |
| Avisa si cae a | 128,00 $ (todavía +28 %) |
| **Vende si cae a** | **120,00 $ → te quedas con +20 %** |

Es decir: de un pico del +40 % se asegura la mitad. Y mientras siga subiendo, no vende nada.

---

## Efecto medido sobre las 42 entradas

| | Antes | Después |
|---|---|---|
| Operaciones cerradas | 15 | 16 |
| **Cerradas en verde** | **0** | **1** |
| Por devolución | 0 | 1 |
| Media por entrada | −1,06 % | −1,16 % |

El cambio es **CAI**: pasa de seguir abierta habiendo devuelto 9,8 puntos, a cerrarse en **+8,1 %**.
No toca a FIGS (+46,5 %), CDNA ni HNGE.

**Dicho con claridad: esto no mejora la rentabilidad medida.** Hace que el sistema realice ganancias
en vez de solo pérdidas, al coste de 0,1 puntos de media. Con 39 entradas no se puede demostrar más
que eso, y cualquiera que diga lo contrario está ajustando a dos acciones.
