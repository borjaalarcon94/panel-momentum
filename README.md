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
| Volumen medio 10 d | > 300.000 acciones y más de 2 M$ negociados al día |
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
| Aceleración del crecimiento | 25 | nivel de crecimiento, aceleración (trimestre vs 12 meses), BPA, consistencia con el ejercicio completo y **previsión de ingresos del próximo ejercicio** (estimación de analistas) |
| Calidad fundamental | 20 | margen bruto, flujo de caja libre, margen neto, caja frente a deuda y regla del 40 |
| Fuerza relativa | 15 | frente al S&P 500 a 3 y 6 meses y frente a la mediana de su sector |
| Volumen y ruptura | 15 | volumen relativo, cercanía al máximo de 52 semanas, ruptura de máximos de 1 y 3 meses |

Y dos bonus y una penalización:

- **Penalización, hasta −15**, solo para lo realmente extremo: RSI > 80 / 85; más de un 50 / 80 % sobre su EMA 50;
  más de un 150 % sobre su media de 200 días; más de un 70 % de subida en un mes; y **margen bruto bajo**
  (< 35 / 25 / 15 %, porque un negocio de volumen difícilmente multiplica).
- **Dilución**: cada día se guarda el número de acciones en circulación. Cuando hay al menos 20 días de serie propia,
  un ritmo de emisión superior al 15 % anual resta 4 puntos y entre el 8 y el 15 % aparece como riesgo. Es el agujero
  clásico de un multibagger: la empresa crece y el accionista no.
- **Modo defensivo**: si el S&P pierde su media de 200 días, la web lo avisa y muestra solo 5 candidatas en lugar de
  10. El momentum es la estrategia que peor se comporta en mercados bajistas.
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

La pestaña del día muestra las **5 mejores** (3 si el mercado está en contra), con un botón para desplegar las 10
guardadas. Se guardan 10 aunque se enseñen 5 por dos motivos: entre la quinta y la décima suele haber 4 puntos de
diferencia, con empates frecuentes, así que cortar en cinco sería arbitrario; y con el doble de entradas la pestaña
de Resultados tarda la mitad en poder decir algo. Cada tarjeta es compacta: puesto, ticker, empresa, capitalización, precio,
puntuación y seis cifras clave (ingresos, aceleración, distancia al máximo, RSI, volumen relativo y ADR), más el
motivo principal por el que aparece. El botón «Ver análisis completo» despliega las cinco barras de la puntuación,
por qué aparece, señales fundamentales, riesgos, el stop técnico, quince métricas y el gráfico.

La tarjeta compacta incluye el **stop técnico** sin necesidad de desplegarla.

El seguimiento muestra **las 5 mejores**, con un botón para ver todas las que siguen vivas. Nunca oculta dos tipos de
acción, aunque queden fuera de esas cinco: las que tienes compradas y las que han dado señal de salida. Son justo las
que hay que mirar cada día.

Por defecto solo aparecen **las que siguen siendo oportunidad** (viables, extendidas o flojeando),
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

## Veredicto de compra

Las dos pestañas usan la misma función (`window.VEREDICTO` en `docs/app.js`), de modo que una acción nunca puede
aparecer como compra en una vista y como espera en la otra. Es lo primero que se lee en cada tarjeta:

| Veredicto | Cuándo |
|---|---|
| **COMPRA** | cumple todo, no está estirada y el stop queda a menos de un 15 % |
| Compra arriesgada | cumple, pero el stop técnico queda más lejos del 15 % |
| Esperar | está a más de un 10 % de su máximo de 52 semanas |
| No comprar aquí | demasiado estirada (penalización ≥ 9) o ha dado una señal de salida |
| Vigilar | cumple, pero su puntuación ha caído más de 8 puntos |
| Ya no cumple | ha roto algún requisito obligatorio (solo en seguimiento) |

Siempre con el precio concreto del stop. Es orientativo y se calcula con el cierre: la decisión es tuya.

- **Sigue viable**: cumple los 9 requisitos, su puntuación aguanta y no está extendida.
- **Muy extendida**: los cumple, pero está lejos de sus medias. Puede seguir subiendo; entrar ahí suele salir caro.
- **Pierde fuerza**: los cumple, pero su puntuación ha caído más de 8 puntos desde su entrada.
- **Ya no cumple**: ha roto algún requisito, y se indica cuál y con qué valor.

Además: puntuación de hoy frente a la de entrada, días en el top, mejor puesto alcanzado, resultado desde la entrada,
máxima subida alcanzada, distancia a su mejor cierre y diferencia con el S&P 500. El desplegable muestra los 8
requisitos uno a uno y los riesgos actuales.

## Interfaz, detalles

Dos columnas de tarjetas en pantallas anchas, borde de color según la puntuación (verde ≥ 75, azul 55-75, gris por
debajo), pestañas fijas al desplazar, rejilla fija de métricas en móvil, aviso mientras carga otro día, icono propio
y `manifest.json` para añadirla a la pantalla de inicio del móvil. En el seguimiento, un mini gráfico muestra la
evolución de la puntuación de cada acción día a día.

## Mis posiciones

Cuarta pestaña, para las acciones que has comprado de verdad. Se anotan con el botón «La tengo» de cada tarjeta y se
guardan **solo en el navegador** (`localStorage`): no viajan a ningún servidor, no ocupan espacio en el repositorio y
no generan llamadas. Si borras los datos del navegador o entras desde otro dispositivo, no estarán.

Protocolo de salida, pensado para aguantar la subida y no vender por un 5 %:

| Situación | Qué dice |
|---|---|
| La tendencia aguanta | **MANTENER**, con el stop del día |
| Primeras grietas (pierde la EMA 21, devuelve ≥ 30 % de la ganancia, falla un requisito) | **VIGILAR** |
| Cierra bajo la EMA 50, pierde el stop, RSI < 45, devuelve ≥ 50 % de lo ganado o rompe dos requisitos | **VENDER** |

En «Mis posiciones» puedes guardar el tamaño de tu cartera y el porcentaje que arriesgas por operación (1 % por
defecto). Con eso, cada tarjeta de compra indica **cuánto comprar**: si arriesgas el 1 % y el stop está a un 8 %, la
posición es un 12,5 % de la cartera, con un tope del 25 % para no concentrar. Y si una acción publica resultados en
los próximos 10 días, se avisa en la tarjeta: un hueco al abrir se salta cualquier stop.

El stop se recalcula cada día: manda la EMA 50, nunca se arriesga más de un 15 % desde tu precio de compra y, en
cuanto la ganancia pasa del 20 %, sube a tu precio de compra para que la operación no pueda acabar en pérdidas.
Cada posición tiene tres botones: **Marcar como vendida** (pregunta el precio de venta y la pasa al histórico
plegado, donde se puede borrar), **Editar compra** (corrige precio medio, fecha y número de acciones, o elimina la
posición si te equivocaste al anotarla) y **He comprado más** (pide precio y acciones de la nueva compra y recalcula
el precio medio ponderado).

## Resultados

Tercera pestaña: compara lo que decía el panel con lo que luego hicieron las acciones. Cada entrada al top queda
anotada con su puntuación y su precio de cierre, y se mide contra el precio actual. Muestra el resultado por tramo de
puntuación, la comparación con el S&P 500 y si vender el día que salen del top habría sido mejor que aguantarlas.

También simula **las mismas entradas operadas de tres formas** (aguantar sin vender, vender el día que salen del top y
aplicar nuestras reglas de stop y salida), para ver si las reglas de salida aportan o estorban. Usa los cierres de los
días que cada acción estuvo en el top y el precio actual: si una salió del top y siguió cayendo, esa caída no se ve.

Incluye un cuadro de **objetivos**, que es el criterio para decidir si hay que cambiar el sistema:

| Objetivo | Se considera cumplido si | Casos mínimos |
|---|---|---|
| Batir al S&P 500 | la media de las entradas supera al índice en los mismos días | 30 |
| Que la puntuación discrimine | las de 75 o más rinden más que las de menos de 75 | 10 por grupo |
| Que salir a tiempo compense | vender al salir del top gana a aguantar | 10 |

Hasta llegar a esos mínimos, cada objetivo aparece como «sin datos suficientes»: con menos casos, cualquier
conclusión sería casualidad. No usa espacio extra: se calcula con lo ya guardado. Hacen falta varias semanas y
decenas de entradas para que signifique algo.

## Si la fuente falla

`comprueba()` valida antes de publicar: un mínimo de valores en el universo y de candidatas, precios y medias de cada
acción guardada, datos del S&P y medianas de sector. Si algo no cuadra, el proceso aborta sin escribir nada: GitHub
marca el trabajo en rojo, avisa por correo y la web se queda con los datos del día anterior en lugar de mostrar basura.

## Qué se probó y se descartó

`herramientas/backtest.py` también midió si romper máximos desde una base estrecha (volatilidad contraída) rinde más
que subir en vertical: con 1.042 observaciones, las diferencias quedaron dentro del ruido (medianas incluso peores en
las bases estrechas). No se implementó, para no añadir 40 llamadas diarias y complejidad sin provecho.

## Desarrollo

```bash
python3 build.py && python3 -m http.server 8900 --directory docs
```
