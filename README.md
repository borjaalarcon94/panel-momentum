# Growth con momentum

Panel diario que busca **empresas pequeñas y medianas de EE. UU. que crecen deprisa y están empezando a despegar en
bolsa**: candidatas a multiplicar en el corto-medio plazo, para estudiarlas una a una. No es una recomendación de
compra. Cada día se queda con el **top 10** y la segunda pestaña vigila si esas compras siguen siendo viables.

Web: https://borjaalarcon94.github.io/panel-momentum/

## Cómo funciona

- `build.py` consulta el escáner de TradingView cada día laborable (GitHub Actions, `.github/workflows/panel.yml`),
  puntúa a las candidatas y guarda **solo las 10 mejores** en `data/AAAA-MM-DD.json` (unos 12 KB al día).
- `docs/puntuacion.js` tiene la lógica de puntuación. Es la única copia: `build.py` la ejecuta con node
  (`puntuar.js`) para ordenar el día, y el navegador la usa para mostrar el detalle. Si cambian los criterios,
  los días guardados se vuelven a puntuar solos.
- `docs/index.html` lleva incrustados los **10 últimos días completos**, un resumen ligero (ticker, precio y
  puntuación) de los 90 últimos y los **datos de hoy** de todas las acciones que han pasado por el top en los últimos
  30 días, para comprobar en el seguimiento si siguen cumpliendo los requisitos.
- `docs/app.js` (estado y filtros), `docs/hoy.js` (tarjetas), `docs/seguimiento.js` (resultados posteriores),
  `docs/export.js` (PDF y CSV).

## Requisitos obligatorios

Si falla uno, la empresa no aparece:

| Requisito | Valor |
|---|---|
| Precio | > 2 $ |
| Capitalización | entre 300 M y 10.000 M $ (buscamos empresas que puedan multiplicar, no gigantes) |
| Volumen medio 10 d | > 300.000 acciones |
| Tendencia | precio por encima de la media de 200 días |
| Tendencia | EMA 9 por encima de EMA 50 |
| RSI 14 | > 55 |
| Ingresos | +20 % interanual o más (el mayor entre los últimos 12 meses y el último trimestre) |
| Distancia al máximo de 52 semanas | como máximo un 20 % por debajo |

No se exige rentabilidad: entra *growth* en fase inicial y las pérdidas se muestran como riesgo.

## Puntuación (0 a 100)

| Bloque | Máx. | Qué mide |
|---|---|---|
| Momentum técnico | 25 | orden precio > EMA 9 > EMA 21 > EMA 50 > media 200 d, RSI en zona 60-72, subida en 1 y 3 meses |
| Aceleración del crecimiento | 25 | nivel de crecimiento, aceleración de ingresos (trimestre vs 12 meses) y del BPA |
| Calidad fundamental | 20 | margen bruto, flujo de caja libre, margen neto, caja frente a deuda |
| Fuerza relativa | 15 | frente al S&P 500 a 3 y 6 meses y frente a la mediana de su sector |
| Volumen y ruptura | 15 | volumen relativo, cercanía al máximo de 52 semanas, ruptura de máximos de 1 y 3 meses |

Y dos bonus y una penalización:

- **Penalización por sobreextensión, hasta −25**: RSI > 80, precio muy por encima de su EMA 50 (> 20 / 30 / 40 %) o de
  su media de 200 días, subida mensual excesiva (> 40 / 70 %). Busca empresas que empiezan a moverse, no las que ya se
  han disparado.
- **Bonus por arranque temprano, hasta +5**: cerca de máximos y subiendo este mes, sin estar extendida.
- **Bonus por tamaño, hasta +5**: por debajo de 1.000 M suma 5; hasta 3.000 M, 3,5; hasta 6.000 M, 2. Cuanto más
  pequeña, más recorrido tiene para multiplicar.

Cada tarjeta muestra por qué aparece, sus señales fundamentales y sus riesgos. Lo que no tiene dato no se inventa:
suma 0 y se avisa.

Se excluyen antes de puntuar: navieras, petroleras, mineras, químicas, utilities, REITs y gestoras de fondos. Su
crecimiento viene del precio de una materia prima o de los mercados, no de ganar clientes.

## «Ya en marcha»

Debajo del top, plegada, una lista corta (5) con las que cumplen todos los requisitos pero están muy extendidas
(penalización ≥ 10 puntos): ya se han disparado. Pueden seguir subiendo, pero comprarlas tan lejos de sus medias
suele salir caro; lo habitual es que consoliden y vuelvan a arrancar desde una base, y entonces reaparecen en el top.
Se guardan en `enMarcha` dentro del fichero del día y también se les hace seguimiento.

## Seguimiento

Sigue a todas las acciones que han pasado por el top 10 y responde a si la compra sigue siendo viable. Cada día
recomprueba los 8 requisitos obligatorios con los datos de hoy, aunque la acción ya no esté en el top:

- **Sigue viable**: cumple los 8 requisitos, su puntuación aguanta y no está extendida.
- **Muy extendida**: los cumple, pero está lejos de sus medias. Puede seguir subiendo; entrar ahí suele salir caro.
- **Pierde fuerza**: los cumple, pero su puntuación ha caído más de 8 puntos desde su entrada.
- **Ya no cumple**: ha roto algún requisito, y se indica cuál y con qué valor.

Además: puntuación de hoy frente a la de entrada, días en el top, mejor puesto alcanzado, resultado desde la entrada,
máxima subida alcanzada, distancia a su mejor cierre y diferencia con el S&P 500. El desplegable muestra los 8
requisitos uno a uno y los riesgos actuales.

## Desarrollo

```bash
python3 build.py && python3 -m http.server 8900 --directory docs
```
