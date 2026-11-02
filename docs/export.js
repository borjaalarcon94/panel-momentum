function cargar(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
const nn=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
function bajar(blob,nombre){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
async function pdf(){const b=document.getElementById('bpdf');b.disabled=true;b.textContent='Generando…';
try{if(!window.jspdf){await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
const v=window.vista(),doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
doc.setFontSize(16);doc.text('Growth con momentum - '+v.fechaTxt,14,16);
doc.setFontSize(9);doc.setTextColor(100);
doc.text('Orden: '+v.orden+(v.filtros.length?' | Filtros: '+v.filtros.join(', '):'')+' | '+v.filas.length+' acciones',14,22);
doc.text(criteriosTexto(v),14,27,{maxWidth:268});
doc.autoTable({startY:38,head:[['#','Ticker','Empresa','Veredicto','Stop $','Punt.','Precio $','Ingresos %','RSI','Desde máx. %','Por qué','Riesgos']],
body:v.filas.map((a,i)=>{const ac=window.accionDe(a);return [i+1,a.ticker+(a.nueva?' (nueva)':''),a.empresa||'',ac.veredicto,ac.stop===''?'—':nn(ac.stop)+' ('+nn(ac.dist,0)+' %)',a.score==null?'-':nn(a.score,0),nn(a.precio),nn(a.g,0),nn(a.rsi,0),nn(a.dmax,1),(a.pt?a.pt.razones:[]).join(' · '),(a.pt?a.pt.riesgos:[]).join(' · ')]}),
styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[20,23,28]},columnStyles:{2:{cellWidth:28},3:{cellWidth:20},4:{cellWidth:22},10:{cellWidth:62},11:{cellWidth:48}}});
doc.save('growth-momentum-'+v.fecha+'.pdf')}catch(e){alert('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.')}
b.disabled=false;b.textContent='Descargar PDF'}
/* EL PARRAFO DE CRITERIOS SE GENERA, NO SE ESCRIBE.
   Estaba a mano: "precio > 2 $, ... RSI > 55, ingresos +20 % ...". Son los mismos numeros que viven
   en panel.json (CRIT) y en reglas.js, pero escritos aparte, asi que cambiar un umbral dejaba el PDF
   mintiendo. Y el PDF es justo lo que se descarga para enseñarselo a alguien o auditarlo con otra IA:
   un documento que describe un sistema que ya no es el que corre es peor que no tener documento.
   Los pesos de la puntuacion salen de las propias partes calculadas, no de una lista repetida.
   Encontrado el 02/11/2026: export.js era el unico fichero sin ninguna comprobacion de esto. */
/* CRIT y cap() se declaran con let/const en app.js, asi que NO estan en window: se usan por su
   nombre, igual que hacen parametros.js y hoy.js. Con window.CRIT salia "precio > undefined $". */
function criteriosTexto(v){const C=(typeof CRIT!=='undefined'&&CRIT)||{},R=(window.REGLAS||{}).R||{};
const pesos=((v.filas.find(a=>a.pt&&a.pt.partes)||{}).pt||{}).partes;
const mil=x=>x==null?'?':Number(x).toLocaleString('es-ES');
return 'Obligatorio: precio > '+C.precioMin+' $, capitalización > '+(typeof cap==='function'?cap(C.capMin):C.capMin)+
  ', volumen medio > '+mil(C.volumenMin)+', se negocian > '+mil(Math.round(C.liquidezMin/1e6))+' M$ al día, '+
  'precio sobre media 200 d, EMA 9 > EMA 50, RSI > '+C.rsiMin+', ingresos +'+C.crecimientoMin+' % interanual, '+
  'a menos del '+C.maxDesdeMaximo+' % de su máximo de 52 semanas.'+
  (pesos?' Puntuación 0-100 = '+pesos.map(p=>p.label.toLowerCase()+' ('+p.max+')').join(' + ')+
    ', menos penalización por sobreextensión.':'')+
  ' Stop: la EMA 50, sin arriesgar más del '+R.perdidaMaxima+' % desde tu compra; sube a tu precio de compra al superar el '+
  R.gananciaProteger+' % de ganancia y nunca baja. Se vende si lo pierde, si el RSI cae por debajo de '+R.rsiVenta+
  ', si devuelve demasiado de lo ganado o si deja de cumplir dos requisitos.'+
  ' Datos de TradingView. Detección de oportunidades, no es una recomendación de compra.'}

/* VEREDICTO Y STOP: lo que se hace con la fila.
   El CSV llevaba 33 columnas de datos y ni una de accion: ni el veredicto ni el stop, que son las
   dos unicas cosas que se usan para decidir. Lo mismo el PDF. Se sacan de la misma fuente que la
   web (VEREDICTO y SALIDA), no de un calculo aparte, para que no puedan discrepar. */
window.accionDe=function(a){
  const v=window.VEREDICTO?window.VEREDICTO(a,{extendida:a.pt?a.pt.extendida:false,sinSeguimiento:a.sinSeguimiento,flojea:!!a.flojea}):null;
  const s=window.SALIDA?window.SALIDA(a):null, o=s&&s.opciones[0];
  const inval=!!(s&&s.invalido);
  return {veredicto:v?v.t:'', stop:inval||!o?'':o.v, dist:inval||!o?'':o.d,
    nota:inval?'sin stop válido: el precio ya está bajo su EMA 50':(s&&s.tope?'stop en el tope del '+(((window.REGLAS||{}).R||{}).perdidaMaxima)+' %, no técnico':'')};
};

/* Las filas del CSV, separadas de la descarga para poder PROBARLAS. Añadir una columna a la
   cabecera y olvidarla en las filas desplaza en silencio todas las columnas siguientes, y el fichero
   sigue abriendo tan contento: cada dato bajo la etiqueta del de al lado. Pasa el dia que se añaden
   columnas, que es justo lo que se hizo el 02/11/2026 (veredicto y stop). */
window.FILAS_CSV=function(v){
const cab=['Puesto','Ticker','Empresa','Veredicto','Stop $','Dist. al stop %','Aviso del stop','Puntuación','Momentum','Aceleración','Fundamental','Fuerza relativa','Volumen/ruptura','Penalización','Precio','Cambio %','Ingresos % anual','Ingresos % trim.','Aceleración pp','BPA % trim.','Margen bruto %','Margen neto %','FCF % ventas','Deuda/patrimonio','ADR %','RSI','Vol. relativo','Desde máx. 52s %','Sobre EMA50 %','3 meses %','Capitalización','Sector','Próx. resultados','Racha días','Nueva','Por qué','Riesgos'];
const b=(a,id)=>{const p=a.pt&&a.pt.partes.find(x=>x.id===id);return p?nn(p.p,1):''};
const filas=[cab].concat(v.filas.map((a,i)=>{const ac=window.accionDe(a);return [i+1,a.ticker,a.empresa,ac.veredicto,ac.stop===''?'':nn(ac.stop),ac.dist===''?'':nn(ac.dist,1),ac.nota,a.score==null?'':nn(a.score,1),b(a,'tec'),b(a,'ace'),b(a,'fun'),b(a,'rel'),b(a,'vol'),a.pt?nn(a.pt.penal.total,0):'',nn(a.precio),nn(a.cambio),nn(a.ingresos),nn(a.ingresosq),nn(a.acel),nn(a.bpaq),nn(a.mbruto),nn(a.margen),nn(a.fcfm),nn(a.deudapat),nn(a.adr),nn(a.rsi),nn(a.volrel),nn(a.dmax),nn(a.ext),nn(a.tres),a.cap,a.sector,a.resultados,a.racha,a.nueva?'Sí':'No',(a.pt?a.pt.razones:[]).join(' · '),(a.pt?a.pt.riesgos:[]).join(' · ')]}));
return filas};

function csv(){const v=window.vista(),q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const filas=window.FILAS_CSV(v);
bajar(new Blob(['\ufeff'+filas.map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}),'growth-momentum-'+v.fecha+'.csv')}
document.getElementById('bpdf').onclick=pdf;document.getElementById('bcsv').onclick=csv;
