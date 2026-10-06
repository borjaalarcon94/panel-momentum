/* Comprueba que la web está completa: que no falte ninguna función y que nadie llame a algo inexistente.
   Este test nace de un fallo real: una edición dejó fuera window.VEREDICTO y la web se quedaba en blanco. */
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, '..', 'docs');
let fallos = 0, total = 0;
const ok = (n) => { total++; console.log('  ✓ ' + n) };
const mal = (n, d) => { total++; fallos++; console.log('  ✗ ' + n + (d ? '\n      ' + d : '')) };

const ficheros = ['reglas.js', 'puntuacion.js', 'app.js', 'hoy.js', 'seguimiento.js', 'posiciones.js', 'resultados.js', 'parametros.js', 'export.js'];
const fuente = Object.fromEntries(ficheros.map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
const todo = Object.values(fuente).join('\n');

console.log('\nLA WEB CARGA TODOS SUS FICHEROS');
const html = fs.readFileSync(path.join(__dirname, '..', 'plantilla.html'), 'utf8');
ficheros.forEach(f => html.includes(f + '?v=') ? ok('plantilla.html carga ' + f) : mal('plantilla.html NO carga ' + f));

console.log('\nNO FALTA NINGUNA FUNCIÓN GLOBAL');
const definidas = new Set([...todo.matchAll(/window\.([A-Za-zÁ-ú_]+)\s*=/g)].map(m => m[1]));
const usadas = new Set([...todo.matchAll(/window\.([A-Za-zÁ-ú_]+)\s*\(/g)].map(m => m[1]));
for (const u of usadas) definidas.has(u) ? ok('window.' + u + ' está definida') : mal('window.' + u + ' se usa pero NO existe');

console.log('\nLAS REGLAS NO ESTÁN DUPLICADAS');
const sospechosos = [['perdidaMaxima', /\b15\b.*p[eé]rdida|p[eé]rdida.*\b15\b/i], ['rsi de venta', /rsi[^\n]*<\s*45/i], ['devolución', /devuelto\s*>=\s*\d+/]];
for (const [nombre, re] of sospechosos) {
  const donde = ficheros.filter(f => f !== 'reglas.js' && re.test(fuente[f]));
  donde.length ? mal('el umbral de ' + nombre + ' aparece fuera de reglas.js: ' + donde.join(', ')) : ok('el umbral de ' + nombre + ' solo vive en reglas.js');
}

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) { console.log(fallos + ' FALLOS'); process.exit(1) }
