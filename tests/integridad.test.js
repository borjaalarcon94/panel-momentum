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

/* La pestaña Parametros es lo que se descarga en PDF para que lo audite una IA externa: si describe
   reglas que el codigo ya no aplica, esa auditoria parte de una descripcion falsa. Estas
   comprobaciones atan las tablas al codigo que de verdad se ejecuta. */
console.log('\nLAS TABLAS DE PARÁMETROS DESCRIBEN EL CÓDIGO REAL');
const par = fuente['parametros.js'], pun = fuente['puntuacion.js'], app = fuente['app.js'], reg = fuente['reglas.js'];

// Todo veredicto que devuelve app.js tiene que estar en la tabla 4
const veredictos = [...app.matchAll(/return \{ t: '([^']+)'/g)].map(m => m[1])
  .filter(t => t !== 'Sin datos de hoy');
const faltan = [...new Set(veredictos)].filter(t => !par.includes("['" + t + "'"));
faltan.length === 0 ? ok('los ' + new Set(veredictos).size + ' veredictos del código están en la tabla')
  : mal('veredictos que el código da y la tabla no explica', faltan.join(', '));

// El tope de penalizacion que anuncia la tabla tiene que ser el que aplica el codigo
const tope = (pun.match(/pen = Math\.min\(pen, (\d+)\)/) || [])[1];
tope && par.includes('limitada a −' + tope + ' puntos')
  ? ok('el tope de penalización de la tabla (−' + tope + ') es el del código')
  : mal('el tope de penalización no coincide', 'código: ' + tope);

// Los umbrales de venta de la tabla tienen que salir de reglas.js
const R = {};
for (const m of reg.matchAll(/(perdidaMaxima|gananciaProteger|rsiVenta|lejosDeMaximo):\s*(\d+)/g)) R[m[1]] = m[2];
par.includes('más de un ' + R.perdidaMaxima + ' % desde tu precio de compra')
  ? ok('el ' + R.perdidaMaxima + ' % de pérdida máxima coincide con reglas.js') : mal('la pérdida máxima de la tabla no es la de reglas.js');
par.includes('superado el ' + R.gananciaProteger + ' % de ganancia')
  ? ok('el ' + R.gananciaProteger + ' % de protección del coste coincide') : mal('la protección del coste no coincide');
par.includes('RSI por debajo de ' + R.rsiVenta)
  ? ok('el RSI de venta (' + R.rsiVenta + ') coincide') : mal('el RSI de venta no coincide');
par.includes('más de un ' + R.lejosDeMaximo + ' % de su máximo')
  ? ok('el ' + R.lejosDeMaximo + ' % de distancia al máximo coincide') : mal('la distancia al máximo no coincide');

// La hora que anuncia la tabla tiene que ser la del cron
const cron = fs.readFileSync(path.join(__dirname, '..', '.github', 'workflows', 'panel.yml'), 'utf8');
const hora = (cron.match(/cron: "(\d+) (\d+)/) || []);
hora[2] && par.includes('las ' + hora[2] + ':' + hora[1] + ' UTC')
  ? ok('la hora de actualización de la tabla es la del cron (' + hora[2] + ':' + hora[1] + ' UTC)')
  : mal('la hora de la tabla no es la del cron', hora.slice(1).join(':'));

/* El compromiso de cuando se puede tocar el sistema esta escrito antes de tener datos, para no poder
   moverlo despues. Si alguien lo borra o le baja el liston, que falle una prueba. */
console.log('\nEL COMPROMISO SOBRE CUÁNDO CAMBIAR EL SISTEMA SIGUE EN PIE');
const compromiso = fuente['parametros.js'];
/Cuándo se puede cambiar el sistema/.test(compromiso) ? ok('la sección de cuándo se puede cambiar existe')
  : mal('se ha borrado la sección de cuándo se puede cambiar');
/Reglas para no romper lo que funciona/.test(compromiso) ? ok('las reglas para no romperlo siguen')
  : mal('se han borrado las reglas para no romperlo');
/195 números ajustables/.test(compromiso) ? ok('se declara cuántos parámetros hay en juego')
  : mal('falta el recuento de parámetros ajustables');
/no se tocan/i.test(compromiso) && /114 umbrales/.test(compromiso)
  ? ok('los umbrales de puntuación siguen declarados como intocables')
  : mal('se ha levantado la prohibición de tocar los umbrales de puntuación');
const minimos = [...compromiso.matchAll(/(\d+) entradas maduras/g)].map(m => +m[1]);
minimos.length && Math.min(...minimos) >= 30
  ? ok('ninguna pregunta se responde con menos de 30 casos (mínimo declarado: ' + Math.min(...minimos) + ')')
  : mal('se ha rebajado el mínimo de casos', minimos.join(', '));
/8 de octubre de 2026, antes de tener una sola entrada madura/.test(compromiso)
  ? ok('consta la fecha en que se escribió, antes de haber datos')
  : mal('se ha quitado la fecha del compromiso');

/* Auditoria externa del 8 oct 2026: la tabla 1 declaraba la exclusion de sectores como requisito,
   pero window.REQUISITOS devuelve 9 elementos y ninguno es el sector (se aplica en build.py al
   elegir el universo). Se documento en vez de cambiar la logica. Que no se vuelva a desdibujar. */
console.log('\nLO QUE SE VIGILA A DIARIO Y LO QUE SOLO FILTRA AL ENTRAR');
const reqs = (fuente['app.js'].match(/window\.REQUISITOS[\s\S]*?^\};/m) || [''])[0];
const cuantos = (reqs.match(/\{ t: /g) || []).length;
cuantos === 9 ? ok('window.REQUISITOS comprueba 9 cosas')
  : mal('han cambiado los requisitos que se vigilan', cuantos);
!/sector|industria|REIT/i.test(reqs) ? ok('y ninguna es el sector, como está documentado')
  : mal('ahora sí comprueba el sector: hay que actualizar la tabla 1');
/Sectores excluidos \(solo al entrar\)/.test(fuente['parametros.js'])
  ? ok('la tabla lo declara como filtro de solo entrada')
  : mal('la tabla vuelve a presentarlo como requisito que se vigila');
/gana el primero que se cumple/.test(fuente['parametros.js'])
  ? ok('se documenta el orden de precedencia de los veredictos')
  : mal('falta el orden de precedencia');
/son de solo entrada/.test(fuente['parametros.js'])
  ? ok('«Ya no cumple» aclara qué requisitos no cuentan')
  : mal('«Ya no cumple» vuelve a ser ambiguo');

console.log('\nLAS REGLAS NO ESTÁN DUPLICADAS');
const sospechosos = [['perdidaMaxima', /\b15\b.*p[eé]rdida|p[eé]rdida.*\b15\b/i], ['rsi de venta', /rsi[^\n]*<\s*45/i], ['devolución', /devuelto\s*>=\s*\d+/]];
for (const [nombre, re] of sospechosos) {
  const donde = ficheros.filter(f => f !== 'reglas.js' && re.test(fuente[f]));
  donde.length ? mal('el umbral de ' + nombre + ' aparece fuera de reglas.js: ' + donde.join(', ')) : ok('el umbral de ' + nombre + ' solo vive en reglas.js');
}

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) { console.log(fallos + ' FALLOS'); process.exit(1) }
