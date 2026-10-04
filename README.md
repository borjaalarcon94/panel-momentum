# Growth con momentum

Panel diario que busca **empresas pequeñas y medianas de EE. UU. que crecen deprisa y están empezando a despegar en
bolsa**: candidatas a multiplicar en el corto-medio plazo, para estudiarlas una a una. No es una recomendación de
compra. Cada día se queda con el **top 10** y la segunda pestaña vigila si esas compras siguen siendo viables.

Web: https://borjaalarcon94.github.io/panel-momentum/

## Cómo funciona

- `build.py` consulta el escáner de TradingView cada día laborable (GitHub Actions, `.github/workflows/panel.yml`),
  puntúa a las candidatas y guarda **solo las 10 mejores** en `docs/datos/AAAA-MM-DD.json` (unos 16 KB al día).
- `docs/puntuacion.js` tiene la lógica de puntuación. Es la única copia: `build.py` la ejecuta con node
  (`puntuar.js`) para ordenar el día, y el navegador la usa para mostrar el detalle. Si cambian los criterios,
  los días guardados se vuelven a puntuar solos.
- Los datos **no se incrustan en el HTML**: `docs/index.html` es estático y la web descarga `docs/panel.json`
  (días disponibles, resumen de 60 días para el seguimiento, datos de hoy de las acciones vigiladas y los umbrales de
  los requisitos) y, solo del día que estás mirando, su `docs/datos/<fecha>.json`. Así el repositorio crece unos
  40 KB al día (~10 MB al año) en lugar de reescribir un HTML cada vez más gordo, y la página carga en 30 KB.
- Los umbrales viven en `build.py` y viajan dentro de `panel.json`: la web comprueba los requisitos con los mismos
  números con los que se filtró, sin duplicarlos.
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
| Aceleración del crecimiento | 25 | nivel de crecimiento, aceleración de ingresos (trimestre vs 12 meses), BPA y consistencia con el ejercicio completo |
| Calidad fundamental | 20 | margen bruto, flujo de caja libre, margen neto, caja frente a deuda y regla del 40 |
| Fuerza relativa | 15 | frente al S&P 500 a 3 y 6 meses y frente a la mediana de su sector |
| Volumen y ruptura | 15 | volumen relativo, cercanía al máximo de 52 semanas, ruptura de máximos de 1 y 3 meses |

Y dos bonus y una penalización:

- **Penalización, hasta −15**, solo para lo realmente extremo: RSI > 80 / 85; más de un 50 / 80 % sobre su EMA 50;
  más de un 150 % sobre su media de 200 días; más de un 70 % de subida en un mes; y **margen bruto bajo**
  (< 35 / 25 / 15 %, porque un negocio de volumen difícilmente multiplica).
- **Bonus por impulso, hasta +5**: entre un 20 y un 50 % sobre su EMA 50 (+3) y subida mensual de entre el 20 y el
  70 % (+2). Es la zona que históricamente más multiplica.

### De dónde salen estos umbrales

`herramientas/backtest.py` mide, con precios reales de 185 empresas del universo elegible entre 2024 y 2026
(17.934 observaciones semanales), qué pasó en los 3 meses siguientes a cada situación técnica:

| Distancia sobre la EMA 50 | Media a 3 meses | Subieron ≥ 50 % | Cayeron ≥ 35 % |
|---|---|---|---|
| 0-10 % | +3,4 % | 3,1 % | 2,3 % |
| 10-20 % | +5,8 % | 6,5 % | 4,0 % |
| 20-30 % | +13,4 % | 12,5 % | 8,4 % |
| 30-50 % | +25,0 % | 22,3 % | 7,1 % |
| > 50 % | +11,6 % | 14,7 % | 19,9 % |

Penalizar desde el 20 %, como se hacía antes, dejaba fuera justo a las que más multiplican. El estudio tiene sesgo
de supervivencia y cubre un periodo alcista, así que conviene leerlo como una guía de calibración, no como una
promesa: ver los límites al principio del script.
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

## Interfaz

La pestaña del día muestra una tarjeta compacta por acción: puesto, ticker, empresa, capitalización, precio,
puntuación y seis cifras clave (ingresos, aceleración, distancia al máximo, RSI, volumen relativo y ADR), más el
motivo principal por el que aparece. El botón «Ver análisis completo» despliega las cinco barras de la puntuación,
por qué aparece, señales fundamentales, riesgos, el stop técnico, quince métricas y el gráfico.

La tarjeta compacta incluye el **stop técnico** sin necesidad de desplegarla.

El seguimiento muestra por defecto solo **las que siguen siendo oportunidad** (viables, extendidas o flojeando),
ordenadas por cuál comprarías antes. Las que dejan de cumplir algún requisito desaparecen de la lista: se consultan eligiendo
«Solo las descartadas» en el desplegable, para que la vista principal solo tenga lo que merece la pena. El orden es: primero las que siguen cumpliendo y sin
señales de salida, después las extendidas, las que pierden fuerza y las que ya no cumplen; dentro de cada grupo, por
puntuación.

## Gestión de la posición

El panel no solo dice qué mirar, también dónde salir. Cada acción del top muestra un **stop técnico**
(cierre bajo la EMA 21, alternativa más holgada en la EMA 50 y una tercera por volatilidad, a dos veces su ATR) con
el precio y el porcentaje desde el nivel actual. En el seguimiento, cuando aparecen **señales de salida** (pierde la
EMA 21 o la EMA 50, RSI por debajo de 45, cae más de un 15 % desde su máximo del mes o devuelve más de la mitad de
lo que llegó a ganar) se muestran destacadas. Son referencias técnicas, no órdenes.

## Cambios del día y sectores

Bajo el banner de mercado: los **sectores con más fuerza** (mediana a 3 meses de todo el mercado, con cuántas del top
pertenecen a cada uno) y un bloque de **cambios respecto al día anterior**: quién entra al top, quién sale y qué
acciones vigiladas han dado señal de salida.

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
