function cargar(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
const nn=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const capT=v=>v==null?'-':(v>=1e9?nn(v/1e9,1)+' B':nn(v/1e6,0)+' M');
function bajar(blob,nombre){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
async function pdf(){const b=document.getElementById('bpdf');b.disabled=true;b.textContent='Generando…';
try{if(!window.jspdf){await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
const v=window.vista(),doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
doc.setFontSize(16);doc.text('Acciones con momentum - '+v.fechaTxt,14,16);
doc.setFontSize(9);doc.setTextColor(100);
doc.text('Orden: '+v.orden+(v.filtros.length?' | Filtros: '+v.filtros.join(', '):'')+' | '+v.filas.length+' acciones',14,22);
doc.text('Filtro base: precio > 3 $, sube en el día, capitalización > 300 M $, precio > EMA 9 y EMA 50, volumen medio 10 d > 500.000, ADR > 7 %, RSI 14 > 60. Datos de TradingView. Solo información, no es una recomendación.',14,27,{maxWidth:268});
doc.autoTable({startY:34,head:[['Ticker','Empresa','Precio $','Cambio %','ADR %','RSI','Vol. rel.','Capitaliz.','Racha','Próx. resultados','Avisos']],
body:v.filas.map(a=>[a.ticker+(a.nueva?' (nueva)':''),a.empresa||'',nn(a.precio),(a.cambio>=0?'+':'')+nn(a.cambio),nn(a.adr,1),nn(a.rsi,0),nn(a.volrel),capT(a.cap),a.racha+' d',a.resultados||'-',a.avisos.map(x=>x[0]).join(' · ')]),
styles:{fontSize:8,cellPadding:1.8},headStyles:{fillColor:[20,23,28]},columnStyles:{1:{cellWidth:45},10:{cellWidth:60}}});
doc.save('acciones-momentum-'+v.fecha+'.pdf')}catch(e){alert('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.')}
b.disabled=false;b.textContent='Descargar PDF'}
function csv(){const v=window.vista(),q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const filas=[['Ticker','Empresa','Precio','Cambio %','ADR %','RSI','Vol. relativo','Capitalización','Sector','Ingresos % anual','Margen neto %','Próx. resultados','Racha días','Nueva']].concat(v.filas.map(a=>[a.ticker,a.empresa,nn(a.precio),nn(a.cambio),nn(a.adr),nn(a.rsi),nn(a.volrel),a.cap,a.sector,nn(a.ingresos),nn(a.margen),a.resultados,a.racha,a.nueva?'Sí':'No']));
bajar(new Blob(['\ufeff'+filas.map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}),'acciones-momentum-'+v.fecha+'.csv')}
document.getElementById('bpdf').onclick=pdf;document.getElementById('bcsv').onclick=csv;
