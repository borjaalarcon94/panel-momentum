function cargar(src){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
const nn=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const capT=v=>v==null?'-':(v>=1e9?nn(v/1e9,1)+' B':nn(v/1e6,0)+' M');
function bajar(blob,nombre){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)}
async function pdf(){const b=document.getElementById('bpdf');b.disabled=true;b.textContent='Generando…';
try{if(!window.jspdf){await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');await cargar('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js')}
const v=window.vista(),doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
doc.setFontSize(16);doc.text('Growth con momentum - '+v.fechaTxt,14,16);
doc.setFontSize(9);doc.setTextColor(100);
doc.text('Orden: '+v.orden+(v.filtros.length?' | Filtros: '+v.filtros.join(', '):'')+' | '+v.filas.length+' acciones',14,22);
doc.text('Obligatorio: precio > 2 $, capitalización > 300 M $, volumen medio > 300.000, precio sobre media 200 d, EMA 9 > EMA 50, RSI > 55, ingresos +20 % interanual, a menos del 20 % de su máximo de 52 semanas. Puntuación 0-100 = momentum (25) + aceleración (25) + fundamentales (20) + fuerza relativa (15) + volumen y ruptura (15), menos penalización por sobreextensión. Datos de TradingView. Detección de oportunidades, no es una recomendación de compra.',14,27,{maxWidth:268});
doc.autoTable({startY:38,head:[['#','Ticker','Empresa','Punt.','Precio $','Ingresos %','Acel. pp','RSI','Vol. rel.','Desde máx. %','Por qué','Riesgos']],
body:v.filas.map((a,i)=>[i+1,a.ticker+(a.nueva?' (nueva)':''),a.empresa||'',a.score==null?'-':nn(a.score,0),nn(a.precio),nn(a.g,0),a.acel==null?'-':nn(a.acel,0),nn(a.rsi,0),nn(a.volrel),nn(a.dmax,1),(a.pt?a.pt.razones:[]).join(' · '),(a.pt?a.pt.riesgos:[]).join(' · ')]),
styles:{fontSize:7,cellPadding:1.5},headStyles:{fillColor:[20,23,28]},columnStyles:{2:{cellWidth:32},10:{cellWidth:72},11:{cellWidth:55}}});
doc.save('growth-momentum-'+v.fecha+'.pdf')}catch(e){alert('No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.')}
b.disabled=false;b.textContent='Descargar PDF'}
function csv(){const v=window.vista(),q=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
const cab=['Puesto','Ticker','Empresa','Puntuación','Momentum','Aceleración','Fundamental','Fuerza relativa','Volumen/ruptura','Penalización','Precio','Cambio %','Ingresos % anual','Ingresos % trim.','Aceleración pp','BPA % trim.','Margen bruto %','Margen neto %','FCF % ventas','Deuda/patrimonio','ADR %','RSI','Vol. relativo','Desde máx. 52s %','Sobre EMA50 %','3 meses %','Capitalización','Sector','Próx. resultados','Racha días','Nueva','Por qué','Riesgos'];
const b=(a,id)=>{const p=a.pt&&a.pt.partes.find(x=>x.id===id);return p?nn(p.p,1):''};
const filas=[cab].concat(v.filas.map((a,i)=>[i+1,a.ticker,a.empresa,a.score==null?'':nn(a.score,1),b(a,'tec'),b(a,'ace'),b(a,'fun'),b(a,'rel'),b(a,'vol'),a.pt?nn(a.pt.penal.total,0):'',nn(a.precio),nn(a.cambio),nn(a.ingresos),nn(a.ingresosq),nn(a.acel),nn(a.bpaq),nn(a.mbruto),nn(a.margen),nn(a.fcfm),nn(a.deudapat),nn(a.adr),nn(a.rsi),nn(a.volrel),nn(a.dmax),nn(a.ext),nn(a.tres),a.cap,a.sector,a.resultados,a.racha,a.nueva?'Sí':'No',(a.pt?a.pt.razones:[]).join(' · '),(a.pt?a.pt.riesgos:[]).join(' · ')]));
bajar(new Blob(['\ufeff'+filas.map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv;charset=utf-8'}),'growth-momentum-'+v.fecha+'.csv')}
document.getElementById('bpdf').onclick=pdf;document.getElementById('bcsv').onclick=csv;
