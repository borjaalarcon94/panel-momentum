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
