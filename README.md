# Growth con momentum

Panel diario que busca **empresas de EE. UU. que crecen deprisa y están empezando a despegar en bolsa**, para
estudiarlas una a una. No es una recomendación de compra.

Web: https://borjaalarcon94.github.io/panel-momentum/

## Cómo funciona

- `build.py` consulta el escáner de TradingView cada día laborable (GitHub Actions, `.github/workflows/panel.yml`),
  guarda los datos en bruto en `data/AAAA-MM-DD.json` e incrusta los últimos 90 días en `docs/index.html`.
- `docs/puntuacion.js` calcula la puntuación y las señales **en el navegador**, a partir de los datos guardados. Así,
  si cambian los criterios, los días anteriores se vuelven a puntuar solos, sin volver a descargar nada.
- `docs/app.js` (estado y filtros), `docs/hoy.js` (tarjetas), `docs/seguimiento.js` (resultados posteriores),
  `docs/export.js` (PDF y CSV).

## Requisitos obligatorios

Si falla uno, la empresa no aparece:

| Requisito | Valor |
|---|---|
| Precio | > 2 $ |
| Capitalización | > 300 M $ |
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

Después se aplica:

- **Penalización por sobreextensión, hasta −25**: RSI > 80, precio muy por encima de su EMA 50 (> 20 / 30 / 40 %) o de
  su media de 200 días, subida mensual excesiva (> 40 / 70 %). Busca empresas que empiezan a moverse, no las que ya se
  han disparado.
- **Bonus por arranque temprano, hasta +5**: cerca de máximos y subiendo este mes, sin estar extendida.

Cada tarjeta muestra por qué aparece, sus señales fundamentales y sus riesgos. Lo que no tiene dato no se inventa:
suma 0 y se avisa.

## Filtros de la web

Aceleración, crecimiento ≥ 25 %, a menos del 10 % del máximo, volumen ≥ 1,5x, sin sobreextensión, solo nuevas, sin
resultados próximos y sin cíclicas de materias primas (navieras, petroleras, mineras, químicas y utilities, cuyo
crecimiento suele venir del precio de una materia prima y no de ganar clientes).

## Desarrollo

```bash
python3 build.py && python3 -m http.server 8900 --directory docs
```
