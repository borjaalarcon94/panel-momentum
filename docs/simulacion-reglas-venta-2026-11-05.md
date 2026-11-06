# ¿Hemos mejorado la aplicación cambiando las señales de venta?

Simulación del 5 de noviembre de 2026, **actualizada el 6 con la sesión del 5**. Rehace las entradas
del registro día a día con las reglas de venta de antes y con las de ahora, y compara.

> ## Lo que cambió en 24 horas
>
> La primera versión de este documento, con datos hasta el 4 de noviembre, concluía que el cambio
> medía **0,09 puntos peor** y que la única diferencia era CAI, que seguía abierta a +11,9 %.
> Decía literalmente: *«si CAI cae mañana, el signo se invierte»*.
>
> **El 5 de noviembre fue una sesión de caída y eso es exactamente lo que pasó.** Con 44 entradas y
> 23 sesiones:
>
> | | Antes | Ahora |
> |---|---|---|
> | Media por entrada | −2,73 % | **−2,08 %** |
> | Cerradas | 18 | 22 |
> | **Cerradas en ganancia** | **0** | **5** |
>
> De 0,09 puntos peor a **0,65 puntos mejor**, en un día. Y el sistema ha realizado sus primeras
> ganancias: hasta ayer llevaba 15 operaciones cerradas y las 15 en pérdida.
>
> Las dos entradas que mueven la cifra:
>
> - **CAI**: las reglas viejas la habrían sacado a **−12,4 %** el día 5; las nuevas la cerraron a
>   **+8,1 %** el día 2 por el escalón del +20 %. Llegó a +21,7 %, que con la regla vieja (primer
>   escalón en +30 %) no activaba nada. **20,5 puntos de diferencia.**
> - **TEAM**: el trailing la sacó a **−0,3 %** el 29 de octubre; sin él habría seguido hasta
>   **−8,6 %** el 2 de noviembre. **8,3 puntos.**
>
> Y cuatro más cerraron en verde con el cierre del día 5, todas por el trailing: CDNA **+19,7 %**
> (su stop con las reglas viejas estaba en +1,0 %), SLDE +7,3 %, RSKD +6,7 % y HALO +5,3 %.
>
> **Pero léelo con la misma desconfianza que la versión de ayer.** Que la cifra pase de −0,09 a
> +0,65 con una sola sesión es la demostración de lo inestable que es esto con 44 entradas. Las
> cuatro que cerraron ayer no tienen todavía ningún día por delante: si rebotan, aguantar habría
> sido mejor. Lo sabremos en una semana, no hoy.

---

## La versión original, con datos hasta el 4 de noviembre

Lo que sigue se deja tal cual se escribió, porque la comparación entre las dos lecturas enseña más
que cualquiera de las dos por separado.

Se puede repetir en cualquier momento:

```
node herramientas/ab-reglas-venta.js
```

---

## Qué se compara exactamente

| | Reglas de ANTES | Reglas de AHORA |
|---|---|---|
| Stop inicial | EMA 50, sin arriesgar más del 15 % | igual |
| Protección del coste | el stop sube a tu compra al +20 % | igual |
| Devolución de ganancias | primer escalón en el **+30 %** | primer escalón en el **+20 %** |
| Trailing por volatilidad | **no existía** | **2 días de rango (ADR) bajo el cierre más alto** |
| Pérdida de tendencia | RSI < 45 | igual |

El periodo es del **5 de octubre al 4 de noviembre de 2026**: 22 sesiones. El índice (SPY) hizo
**−1,04 %** en ese mes, así que es un mes de mercado flojo.

### Cómo está hecho

Las entradas se recorren con `REGLAS.recorrido()`, **la misma función que usan Resultados y
Seguimiento** en el panel. No hay una copia del bucle en la herramienta a propósito: el 24 de
octubre de 2026 había dos copias y la misma acción salía a −15,7 % en una tabla y a −5,6 % en otra.

Las reglas de antes se obtienen parcheando el código real, y la herramienta **verifica que el parche
ha mordido** antes de medir. Esto importa: la primera vez apagué el trailing poniendo su distancia a
0, y eso **no lo apaga** — lo pone a distancia cero, o sea el stop clavado en el máximo, que es un
trailing maximamente apretado. Ese falso baseline daba 35 operaciones cerradas y 22 en verde, y
parecía decir que el cambio empeoraba las cosas. No era un baseline, era otra regla.

---

## 1. Mirando hacia atrás: un pelo PEOR

| | Antes | Ahora |
|---|---|---|
| Media por entrada | +0,01 % | **−0,08 %** |
| Entradas en verde | 21 de 42 | 21 de 42 |
| Operaciones cerradas | 15 | 16 |
| **Cerradas en ganancia** | **0** | **1** |

**0,09 puntos peor por entrada. Y toda la diferencia es una sola acción.**

| | Antes | Ahora |
|---|---|---|
| CAI | seguía abierta, hoy va +11,9 % | **cerrada el 2/11 a +8,1 %** por devolución |

Tres cosas que relativizan ese −0,09, y hay que decirlas las tres:

- **CAI cerró hace dos sesiones.** Se está comparando una ganancia cobrada contra una sin cobrar,
  juzgada por lo que ha hecho el precio en dos días. Si CAI cae, el signo se invierte.
- **La cuenta no da crédito al dinero liberado.** Cobrar +8,1 % te deja efectivo para la siguiente
  entrada; medir entrada por entrada ignora eso, y eso penaliza sistemáticamente a la regla que
  cierra antes.
- **El trailing no aporta nada a este número.** Los −0,09 son enteros del escalón del +20 %. El
  trailing deja las 42 entradas exactamente igual, y es idéntico con 2, 2,5, 3, 4 o 5 días de rango:
  las 15 cerradas en pérdida nunca tuvieron ganancia suficiente para activarlo.

---

## 2. Mirando hacia delante: bastante MEJOR

Esta es la pregunta que el cambio contesta de verdad. Si mañana todas las posiciones abiertas se
dieran la vuelta y tocaran su stop:

| | Antes | Ahora |
|---|---|---|
| Media por entrada | −9,05 % | **−6,62 %** |
| Entradas que acabarían en verde | **4 de 42** | **10 de 42** |

**2,43 puntos mejor por entrada, y seis entradas más acabando en ganancia en vez de en pérdida.**

| | Va hoy | Antes aseguraba | Ahora asegura | Gana |
|---|---|---|---|---|
| FIGS | +46,5 % | +13,5 % | **+33,8 %** | +20,3 |
| CDNA | +34,6 % | 0,0 % | **+23,2 %** | +23,2 |
| HNGE | +22,9 % | +3,1 % | **+12,5 %** | +9,4 |
| SLDE | +10,8 % | +2,8 % | **+10,0 %** | +7,2 |
| RSKD | +13,1 % | −0,5 % | **+8,2 %** | +8,8 |
| HALO | +11,6 % | −1,6 % | **+7,2 %** | +8,8 |
| FLYW | +10,8 % | −6,2 % | **+2,8 %** | +9,0 |
| SEPN | +15,7 % | −3,9 % | **+2,9 %** | +6,8 |
| OABI | +19,1 % | +4,3 % | **+4,7 %** | +0,4 |

Las otras 17 abiertas no cambian: todavía no tienen ganancia suficiente para que el trailing se
active, así que su stop sigue siendo la EMA 50 o el suelo del −15 %.

---

## 3. Conclusión, sin adornos

**No hemos empeorado la aplicación, pero el histórico no demuestra que la hayamos mejorado.**

Lo que ha cambiado no es lo que ya pasó: es lo que te llevas si las cosas se dan la vuelta. En un mes
con el índice en negativo, la cartera acabó plana con las reglas viejas y plana con las nuevas. La
diferencia está en que ahora hay un suelo debajo de cada ganadora y antes no lo había.

**Ninguno de los dos números es prueba de nada.** Son 42 entradas, un mes y un solo régimen de
mercado. El −0,09 es una acción y el +2,43 es un escenario hipotético en el que todo se gira a la
vez. Lo que sí es sólido no es estadístico, es estructural: **un stop por encima de tu precio de
compra no puede acabar en pérdida**, y antes del 5 de noviembre nueve de las posiciones abiertas no
lo tenían.

### Cuándo volver a medir, y qué mirar

- **Hacia el 13 de noviembre de 2026**, al llegar a 30 entradas maduras, se desbloquean las tres
  preguntas de Resultados en el panel.
- **En diciembre**, repetir esta misma simulación. Lo que hay que mirar no es la media, es **cuántas
  de las cerradas lo fueron en verde y por qué motivo**. Si el trailing empieza a aparecer como
  motivo de cierre con ganancia, el cambio habrá demostrado algo. Si no aparece nunca, habrá que
  preguntarse si la distancia de 2 días de rango es la correcta.
- **No tocar la distancia del trailing mientras tanto.** Se probó toda la curva: apretarla a 1 día
  cierra 7 posiciones más y empeora la media un punto entero. Cualquier valor entre 2 y 5 días da
  exactamente lo mismo sobre estas 42 entradas, así que esta muestra **no puede** decir cuál es el
  óptimo. Mover ese número ahora sería ajustar a dos acciones.
