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
/* 16/10/2026: sin techo de capitalizacion entran empresas de billones. app.js y puntuacion.js ya
   tienen el tramo T; export.js tenia su propio formateador SIN el tramo, aunque estaba muerto. Si
   alguien escribe otro que divida por 1e9 sin cubrir 1e12, volveria a salir "1141,0 B". */
/* 16/10/2026, encontrado abriendo la web en un navegador de verdad: el subtitulo decia "Las 5
   empresas PEQUEÑAS Y MEDIANAS" justo encima de PLTR, 481,8 B. Y el texto del PDF que lee la
   auditoria externa decia lo mismo, o sea que describia un sistema que ya no es el que corre.
   Ninguna prueba sobre el DOM de juguete podia verlo: son cadenas estaticas. */
console.log('\nNINGÚN TEXTO PROMETE UN SISTEMA QUE YA NO ES');
{
  const plantilla = fs.readFileSync(path.join(__dirname, '..', 'plantilla.html'), 'utf8');
  const todos = { 'plantilla.html': plantilla, ...fuente };
  const viejos = [];
  for (const [f, src] of Object.entries(todos)) {
    if (/peque(ñ|n)as y medianas/i.test(src)) viejos.push(f + ': dice "pequeñas y medianas" y ya no hay techo');
    // el aviso de modo defensivo tenia el 5 escrito a mano y el top baja a 3 con el mercado en contra
    for (const m of src.matchAll(/se muestran solo (\d+) candidatas/g)) viejos.push(f + ': el aviso defensivo dice "' + m[1] + ' candidatas" a mano y el top varía');
    // un numero fijo de empresas en el titular: el top se reduce a 3 con el mercado en contra
    for (const m of src.matchAll(/Las (\d+) empresas/g)) viejos.push(f + ': promete un número fijo ("Las ' + m[1] + ' empresas") y el top varía con el régimen');
  }
  viejos.length === 0 ? ok('ni "pequeñas y medianas" ni un número fijo de empresas en los titulares')
    : mal('un texto describe un sistema que ya no es el que corre', viejos.join(' | '));
}

console.log('\nTODO FORMATEADOR DE CAPITALIZACIÓN CUBRE EL BILLÓN');
{
  const malos = [];
  for (const [f, src] of Object.entries(fuente)) {
    for (const m of src.matchAll(/[^\n]*\/\s*1e9[^\n]*/g)) {
      const linea = m[0];
      if (!/'\s*B'|" B"/.test(linea)) continue;          // solo las que formatean en "B"
      if (/1e12/.test(linea)) continue;                    // ya cubre el billon
      malos.push(f + ': ' + linea.trim().slice(0, 90));
    }
  }
  malos.length === 0 ? ok('ningún formateador en "B" se olvida del tramo T')
    : mal('un formateador mostraría 1141,0 B en vez de 1,14 T', malos.join(' | '));
}

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

console.log('\nLA SERIE DIARIA NO TIENE HUECOS');
/* El 21/10/2026 el panel estuvo dos dias sin publicar y la pestaña Resultados se quedo ciega
   justo donde importaba. La serie de cierres (docs/precios.json) es lo que alimenta los stops
   simulados: un hueco ahi no se ve a simple vista y falsea las salidas.
   Dos ausencias son legitimas y conocidas:
   - la PRIMERA sesion del historico, porque la serie diaria empezo a guardarse un dia despues;
   - dias que estan en precios.json pero no en el historico: son cierres recuperados de una
     sesion cuyo top no se pudo reconstruir, y añadir cierres nunca estorba. */
{
  const panel = JSON.parse(fs.readFileSync(path.join(dir, 'panel.json'), 'utf8'));
  const pre = JSON.parse(fs.readFileSync(path.join(dir, 'precios.json'), 'utf8'));
  const ses = Object.keys(panel.historico).sort();
  const dias = new Set(Object.keys(pre.dias)), emas = new Set(Object.keys(pre.emas || {}));
  const faltan = ses.slice(1).filter(f => !dias.has(f));
  faltan.length ? mal('faltan cierres de sesiones que sí tienen top', faltan.join(', '))
                : ok('todas las sesiones con top (menos la primera) tienen su cierre guardado');
  const sinEma = ses.slice(1).filter(f => !emas.has(f));
  sinEma.length ? mal('faltan EMA 50 de sesiones que sí tienen top', sinEma.join(', '))
                : ok('y su EMA 50, que es la que mueve el stop');
  const huecos = [...dias].sort().filter((f, i, a) => i && !ses.includes(f) && !ses.includes(a[i - 1]));
  huecos.length <= 2 ? ok('los días sueltos de la serie son recuperaciones puntuales, no un corte')
                     : mal('hay un tramo de la serie sin top: parece un corte de publicación', huecos.join(', '));
}

console.log('\nEL RECORRIDO VIVE EN UN SITIO Y TODO STOP MIRA EL MÁXIMO');
/* Dos fallos seguidos nacieron de tener el recorrido duplicado: el 24/10/2026 la misma accion salia
   a -15,7 % en una tabla y a -5,6 % en otra (una copia llamaba a stopDe sin ema50 y sin ganMax), y
   el 25/10 Seguimiento enseñaba de titular la media "sin vender nunca" en vez de la media con los
   stops. El bucle esta ahora en reglas.js (REGLAS.recorrido) y las pestañas lo usan a traves de
   recorridoConReglas(). */
{
  /recorridoConReglas/.test(fuente['app.js']) && /function recorrido\(/.test(fuente['reglas.js'])
    ? ok('el recorrido vive en reglas.js y app.js solo lo conecta con los datos')
    : mal('no se encuentra el recorrido en su sitio');
  const copias = ficheros.filter(f => !['reglas.js', 'app.js'].includes(f) && /stopPrevio\s*=/.test(fuente[f]));
  copias.length ? mal('alguien ha vuelto a copiar el bucle del recorrido', copias.join(', '))
                : ok('nadie más mantiene su propio trinquete de stop');

  /* Todo stopDe que hable de una posicion EXISTENTE tiene que pasar ganMax, el cuarto argumento:
     sin el mira la ganancia de hoy y no la maxima, y una posicion que subio y retrocedio pierde la
     proteccion del coste. La unica excepcion es stopDeEntrada, que calcula el stop de una compra
     que aun no existe y donde la ganancia es cero por definicion. */
  /* Se equilibran los parentesis a mano. Una expresion regular no vale: en
     stopDe({ precio: p, ema50: num(emaDe(f)) }, c, stopPrevio, ganMax) cortaba dentro de num(...)
     y contaba mal los argumentos, dando por mala una llamada correcta. */
  const argumentosDe = src => {
    const fuera = [];
    for (let i = src.indexOf('stopDe('); i >= 0; i = src.indexOf('stopDe(', i + 1)) {
      if (/[\w$]/.test(src[i - 1] || '')) continue;          // 'function stopDe(' y similares
      let prof = 0, comas = 0, j = i + 'stopDe'.length;
      for (; j < src.length; j++) {
        const ch = src[j];
        if ('({['.includes(ch)) prof++;
        else if (')}]'.includes(ch)) { prof--; if (!prof) break }
        else if (ch === ',' && prof === 1) comas++;
      }
      fuera.push({ args: src.slice(i, j + 1), n: comas + 1 });
    }
    return fuera;
  };
  const malas = [];
  for (const f of ficheros) {
    for (const ll of argumentosDe(fuente[f])) {
      if (/^stopDe\(\s*datos,\s*precio,\s*null\s*\)$/.test(ll.args)) continue;   // stopDeEntrada: aun no hay posicion
      if (/^function /.test(ll.args)) continue;
      if (ll.n < 4) malas.push(f + ': ' + ll.args.replace(/\s+/g, ' ').slice(0, 70));
    }
  }
  malas.length ? mal('hay llamadas a stopDe sin la ganancia máxima', malas.join(' | '))
               : ok('todas las llamadas a stopDe de una posición pasan la ganancia máxima');
}

console.log('\nLAS REGLAS NO ESTÁN DUPLICADAS');
const sospechosos = [['perdidaMaxima', /\b15\b.*p[eé]rdida|p[eé]rdida.*\b15\b/i], ['rsi de venta', /rsi[^\n]*<\s*45/i], ['devolución', /devuelto\s*>=\s*\d+/],
  /* El tope de concentracion estaba escrito a mano en app.js (Math.min(..., 25)) y descrito "como un
     cuarto de la cartera" en hoy.js. Al bajarlo del 25 al 12 habia que tocar tres sitios y acordarse
     de los tres: ahora vive en reglas.js y nadie mas puede poner un numero ahi. */
  ['tope de posición', /Math\.min\([^)]*\*\s*100,\s*\d+\)/]];
for (const [nombre, re] of sospechosos) {
  const donde = ficheros.filter(f => f !== 'reglas.js' && re.test(fuente[f]));
  donde.length ? mal('el umbral de ' + nombre + ' aparece fuera de reglas.js: ' + donde.join(', ')) : ok('el umbral de ' + nombre + ' solo vive en reglas.js');
}

/* EL DOCUMENTO PARA LA OTRA APP DICE LOS MISMOS NUMEROS QUE EL MOTOR.
   docs/instrucciones-para-otra-app.md es la especificacion que se le pasa a otra aplicacion (o a
   otra IA) para que genere las mismas señales. Es texto escrito a mano: si alguien cambia un umbral
   en reglas.js o en panel.json y no lo cambia ahi, la otra app operara con reglas distintas a las
   del panel y las dos se contradiran sin que nada lo avise. Esto lo ata. */
console.log('\nEL DOCUMENTO PARA LA OTRA APP CUADRA CON EL CÓDIGO');
{
  const doc = fs.readFileSync(path.join(dir, 'instrucciones-para-otra-app.md'), 'utf8');
  const R = (() => { const g = {}; new Function('window', fuente['reglas.js'])(g); return g.REGLAS.R })();
  const C = JSON.parse(fs.readFileSync(path.join(dir, 'panel.json'), 'utf8')).criterios;

  /* Cada umbral con los sitios del documento donde tiene que aparecer. Se buscan literales que solo
     pueden salir del valor correcto, no un "15" suelto que acertaria por casualidad. */
  const esperadas = [
    ['perdidaMaxima', R.perdidaMaxima, [`(1 - ${R.perdidaMaxima}/100)`, `ema50 / (1 - ${R.perdidaMaxima}/100)`, `del −${R.perdidaMaxima} %`]],
    ['gananciaProteger', R.gananciaProteger, [`alMenos(pico, ${R.gananciaProteger})`, `ganar un ${R.gananciaProteger} %`]],
    ['rsiVenta', R.rsiVenta, [`rsi < ${R.rsiVenta}`, `\`< ${R.rsiVenta}\``]],
    ['avisoDevolucion', R.avisoDevolucion, [`limite * ${String(R.avisoDevolucion).replace('.', ',')}`]],
    ['lejosDeMaximo', R.lejosDeMaximo, [`(1 - ${R.lejosDeMaximo}/100)`, `- 1)*100 < -${R.lejosDeMaximo}`]],
    ['topePosicion', R.topePosicion, [`* 100, ${R.topePosicion})`, `del **${R.topePosicion} %**`, `un tope del ${R.topePosicion} %`]],
    ['devolución 100→40', R.devolucion[0], [`alMenos(ganMax, ${R.devolucion[0].desde}):  devolver ${R.devolucion[0].limite}`]],
    ['devolución 30→50', R.devolucion[1], [`alMenos(ganMax,  ${R.devolucion[1].desde}):  devolver ${R.devolucion[1].limite}`]],
    ['precioMin', C.precioMin, [`> ${C.precioMin} $`]],
    ['volumenMin', C.volumenMin, [`> ${(C.volumenMin / 1000).toLocaleString('de-DE')}.000 acciones`]],
    ['rsiMin', C.rsiMin, [`> ${C.rsiMin}`]],
    ['crecimientoMin', C.crecimientoMin, [`>= ${C.crecimientoMin} %`]],
    ['maxDesdeMaximo', C.maxDesdeMaximo, [`>= -${C.maxDesdeMaximo} %`]],
  ];
  for (const [nombre, , textos] of esperadas) {
    const faltan = textos.filter(t => !doc.includes(t));
    faltan.length ? mal('el documento no refleja ' + nombre, 'falta: ' + faltan.join(' | '))
                  : ok('el documento refleja ' + nombre);
  }

  /* El techo de capitalizacion: si algun dia vuelve, el documento no puede seguir diciendo "sin techo". */
  C.capMax == null
    ? (doc.includes('sin techo') ? ok('el documento dice que no hay techo de capitalización') : mal('no hay techo pero el documento no lo dice'))
    : (doc.includes('sin techo') ? mal('hay techo de capitalización y el documento dice que no') : ok('el documento no niega el techo'));

  /* El suelo de capitalizacion y la liquidez, en las unidades en que estan escritos en la tabla. */
  doc.includes('> ' + Math.round(C.capMin / 1e6) + ' M $') ? ok('el documento refleja capMin') : mal('el documento no refleja capMin (' + C.capMin + ')');
  doc.includes('> ' + Math.round(C.liquidezMin / 1e6) + ' M$/día') ? ok('el documento refleja liquidezMin') : mal('el documento no refleja liquidezMin (' + C.liquidezMin + ')');

  /* La caida de nota que marca "pierde fuerza" y el tope de penalizacion que marca "extendida". */
  const caida = (fuente['app.js'].match(/window\.CAIDA_FUERZA\s*=\s*(\d+)/) || [])[1];
  doc.includes('cayó > ' + caida + ' puntos') ? ok('el documento refleja CAIDA_FUERZA') : mal('el documento no refleja CAIDA_FUERZA (' + caida + ')');
  const ext = (fuente['puntuacion.js'].match(/extendida:\s*pen\s*>=\s*(\d+)/) || [])[1];
  doc.includes('extendida = (pen >= ' + ext + ')') ? ok('el documento refleja el umbral de extendida') : mal('el documento no refleja el umbral de extendida (' + ext + ')');

  /* El orden de la cascada de veredictos: es la fuente de error mas facil de reproducir mal, porque
     cada paso por separado parece correcto y solo el orden decide el resultado. */
  const orden = [...fuente['app.js'].matchAll(/return \{ t: '([^']+)'/g)].map(m => m[1]);
  const vistos = [], i = {};
  for (const t of orden) if (!(t in i)) { i[t] = vistos.length; vistos.push(t) }
  const enDoc = vistos.filter(t => doc.includes('"' + t + '"'));
  const pos = enDoc.map(t => doc.indexOf('"' + t + '"'));
  const ordenado = pos.every((v, k) => k === 0 || v > pos[k - 1]);
  /* No basta con que los que estan vayan en orden: faltando uno, los demas siguen ordenados y la
     comprobacion pasaria. Tienen que estar TODOS, porque un veredicto ausente del documento es un
     caso que la otra app no cubrira y que fallara en silencio. */
  const ausentes = vistos.filter(t => !doc.includes('"' + t + '"'));
  ausentes.length ? mal('el documento no describe ' + ausentes.length + ' veredicto(s) de app.js', ausentes.join(', '))
    : ordenado ? ok('la cascada del documento describe los ' + enDoc.length + ' veredictos en el orden de app.js')
    : mal('la cascada del documento no va en el orden de app.js', 'código: ' + vistos.join(' > ') + ' | documento: ' + enDoc.join(' > '));

  /* La plantilla no carga este .md (es un documento, no codigo), pero tiene que existir y no quedarse
     en un esqueleto: si alguien lo vacia, los tests de arriba pasarian por no encontrar nada que falle. */
  doc.length > 15000 ? ok('el documento tiene cuerpo (' + Math.round(doc.length / 1024) + ' KB)') : mal('el documento está demasiado corto: ' + doc.length + ' caracteres');
}

console.log(`\n${total - fallos} de ${total} comprobaciones correctas`);
if (fallos) { console.log(fallos + ' FALLOS'); process.exit(1) }
