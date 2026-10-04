/* Puntua una lista de acciones usando docs/puntuacion.js (unica fuente de la logica de puntuacion).
   Lo invoca build.py:  node puntuar.js < entrada.json  ->  [{ticker, total}, ...] */
const fs = require('fs');
global.window = {};
require('./docs/puntuacion.js');
const { acciones, ctx } = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(acciones.map(a => ({
  ticker: a.ticker,
  simbolo: a.simbolo,
  total: window.PUNTUA(a, { fecha: ctx.fecha, spy: ctx.spy, sector: (ctx.sectores || {})[a.sector] || null }).total,
}))));
