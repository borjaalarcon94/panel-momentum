/* ¿EL PROBLEMA ESTA EN LAS COMPRAS, O ES QUE EL MES FUE MALO?

   Pregunta de Borja el 06/11/2026, con una hipotesis: octubre fue un mes desastroso de mercado.
   Esto la contrasta. Mide cada entrada contra el INDICE EN SU PROPIO PERIODO DE TENENCIA, que es
   la comparacion justa (no contra el indice de punta a punta, que castiga a las entradas tardias),
   en bruto y ajustado por la beta de cada accion.

   RESULTADO (44 entradas, 23 sesiones):
     - La hipotesis se sostiene. El SPY hizo -5,40 % con una caida del -5,92 %, y las entradas
       hicieron -4,11 %: BATEN al indice, +0,29 en bruto y +2,38 ajustado por beta (mediana 1,15).
     - Pero la puntuacion NO discrimina. La mitad con menos puntos lo hizo MEJOR (+4,06 contra
       -3,47). Aguanta al podar extremos (-7,20) y con medianas (-3,58), pero los tercios NO son
       monotonos (-0,39 / -2,02 / +2,91), asi que la lectura honesta es "no hay señal", no "la
       señal esta invertida".
     - Razon estructural probable: el 80 % de las entradas cae en 10,5 puntos de puntuacion
       (75 a 85,5). El panel ordena acciones casi empatadas, y ya se midio que dos separadas por un
       punto se intercambian el puesto el 43 % de las veces al dia siguiente.

   NO SE TOCA LA PUNTUACION CON ESTO. Son 44 entradas y un solo regimen de mercado; cambiar el
   sistema de seleccion con esta base es el error de libro. La pregunta necesita 150-200 entradas.

   Uso:  node herramientas/analizar-entradas.js        (desde la raiz del repositorio) */
const fs=require('fs');
const pa=JSON.parse(fs.readFileSync('docs/panel.json','utf8'));
const pr=JSON.parse(fs.readFileSync('docs/precios.json','utf8'));
const en=JSON.parse(fs.readFileSync('docs/entradas.json','utf8'));
const fechas=Object.keys(pr.dias).sort();
const hist=pa.historico, ses=Object.keys(hist).sort();
const spy=f=>{let m=null;for(const s of ses){if(s<=f&&hist[s].spy!=null)m=hist[s].spy;}return m;};
console.log('EL MERCADO EN EL PERIODO');
const s0=hist[ses[0]].spy, s1=hist[ses[ses.length-1]].spy;
let pico=0,caida=0;
for(const s of ses){const v=hist[s].spy;if(v==null)continue;if(v>pico)pico=v;const c=(v/pico-1)*100;if(c<caida)caida=c;}
console.log('  SPY '+ses[0]+' = '+s0+'   ->   '+ses[ses.length-1]+' = '+s1+'   ('+((s1/s0-1)*100).toFixed(2)+' %)');
console.log('  peor caída del índice por el camino: '+caida.toFixed(2)+' %');
console.log();
const betas=[];
const filas=[];
for(const s of Object.keys(en)){
  const e=en[s];
  const i0=fechas.findIndex(f=>f>=e.f); if(i0<0) continue;
  const compra=(pr.dias[fechas[i0]]||{})[s]; if(!compra) continue;
  let ult=compra, fUlt=fechas[i0];
  for(let i=i0+1;i<fechas.length;i++){const c=(pr.dias[fechas[i]]||{})[s];if(c!=null){ult=c;fUlt=fechas[i];}}
  const r=(ult/compra-1)*100;
  const sa=spy(fechas[i0]), sb=spy(fUlt);
  const rs=sa&&sb?(sb/sa-1)*100:null;
  const b=e.b!=null?e.b:null; if(b!=null)betas.push(b);
  filas.push({t:s.replace(/^[A-Z]+:/,''),f:e.f,r,rs,b,exc:rs!=null?r-rs:null,
              excB:(rs!=null&&b!=null)?r-rs*b:null, sc:e.sc});
}
const med=v=>v.reduce((a,b)=>a+b,0)/(v.length||1);
const mediana=v=>{const x=[...v].sort((a,b)=>a-b);return x[Math.floor(x.length/2)];};
betas.sort((a,b)=>a-b);
console.log('TUS '+filas.length+' ENTRADAS');
console.log('  rentabilidad media ................... '+med(filas.map(f=>f.r)).toFixed(2)+' %');
console.log('  mediana .............................. '+mediana(filas.map(f=>f.r)).toFixed(2)+' %');
console.log('  el índice en los MISMOS periodos ..... '+med(filas.filter(f=>f.rs!=null).map(f=>f.rs)).toFixed(2)+' %');
console.log('  diferencia (exceso bruto) ............ '+(med(filas.filter(f=>f.exc!=null).map(f=>f.exc))>=0?'+':'')+med(filas.filter(f=>f.exc!=null).map(f=>f.exc)).toFixed(2)+' puntos');
console.log('  beta mediana de las entradas ......... '+mediana(betas).toFixed(2));
console.log('  exceso AJUSTADO por beta ............. '+(med(filas.filter(f=>f.excB!=null).map(f=>f.excB))>=0?'+':'')+med(filas.filter(f=>f.excB!=null).map(f=>f.excB)).toFixed(2)+' puntos');
console.log('  cuántas baten al índice .............. '+filas.filter(f=>f.exc>0).length+' de '+filas.filter(f=>f.exc!=null).length);

console.log();
console.log('¿DEPENDE DE CUÁNDO ENTRÓ? (las entradas agrupadas por semana)');
const sem={};
for(const f of filas){const d=new Date(f.f+'T12:00:00Z');const lun=new Date(d);lun.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));
  const k=lun.toISOString().slice(0,10);(sem[k]=sem[k]||[]).push(f);}
console.log('  semana del    n    su rentabilidad   el índice     exceso');
for(const k of Object.keys(sem).sort()){
  const g=sem[k], e=g.filter(x=>x.exc!=null);
  console.log('  '+k+'   '+String(g.length).padStart(2)+'      '+(med(g.map(x=>x.r))>=0?'+':'')+med(g.map(x=>x.r)).toFixed(1).padStart(6)+' %'+
    ('   '+(med(e.map(x=>x.rs))>=0?'+':'')+med(e.map(x=>x.rs)).toFixed(1)+' %').padStart(13)+
    ('   '+(med(e.map(x=>x.exc))>=0?'+':'')+med(e.map(x=>x.exc)).toFixed(1)).padStart(11));
}
console.log();
console.log('¿LA PUNTUACIÓN DISCRIMINA? (entradas partidas por su puntuación de entrada)');
const conSc=filas.filter(f=>f.sc!=null&&f.exc!=null).sort((a,b)=>b.sc-a.sc);
const mitad=Math.floor(conSc.length/2);
const alto=conSc.slice(0,mitad), bajo=conSc.slice(-mitad);
console.log('  mitad con MÁS puntos ('+alto.length+'):  puntuación media '+med(alto.map(f=>f.sc)).toFixed(1)+
  '   exceso sobre el índice '+(med(alto.map(f=>f.exc))>=0?'+':'')+med(alto.map(f=>f.exc)).toFixed(2));
console.log('  mitad con MENOS puntos ('+bajo.length+'): puntuación media '+med(bajo.map(f=>f.sc)).toFixed(1)+
  '   exceso sobre el índice '+(med(bajo.map(f=>f.exc))>=0?'+':'')+med(bajo.map(f=>f.exc)).toFixed(2));
console.log('  diferencia entre las dos mitades: '+(med(alto.map(f=>f.exc))-med(bajo.map(f=>f.exc))).toFixed(2)+' puntos');

console.log();
console.log('¿AGUANTA ESE RESULTADO? pruebas de robustez');
const med2=v=>v.reduce((a,b)=>a+b,0)/(v.length||1);
const mdn=v=>{const x=[...v].sort((a,b)=>a-b);return x.length%2?x[(x.length-1)/2]:(x[x.length/2-1]+x[x.length/2])/2;};
console.log('  con MEDIANA en vez de media:  alto '+mdn(alto.map(f=>f.exc)).toFixed(2)+'   bajo '+mdn(bajo.map(f=>f.exc)).toFixed(2)+
  '   diferencia '+(mdn(alto.map(f=>f.exc))-mdn(bajo.map(f=>f.exc))).toFixed(2));
// quitando los dos extremos de cada lado
const pod=g=>{const x=[...g].sort((a,b)=>a.exc-b.exc);return x.slice(2,-2);};
console.log('  quitando los 2 mejores y 2 peores de cada mitad: alto '+med2(pod(alto).map(f=>f.exc)).toFixed(2)+
  '   bajo '+med2(pod(bajo).map(f=>f.exc)).toFixed(2)+'   diferencia '+(med2(pod(alto).map(f=>f.exc))-med2(pod(bajo).map(f=>f.exc))).toFixed(2));
console.log();
console.log('  por tercios, para ver si hay escalera:');
const t=Math.floor(conSc.length/3);
for(const [n,g] of [['más puntos ',conSc.slice(0,t)],['medio      ',conSc.slice(t,2*t)],['menos puntos',conSc.slice(2*t)]])
  console.log('    '+n+'  n='+String(g.length).padStart(2)+'  puntuación '+med2(g.map(f=>f.sc)).toFixed(1)+'  exceso medio '+(med2(g.map(f=>f.exc))>=0?'+':'')+med2(g.map(f=>f.exc)).toFixed(2)+'   mediana '+mdn(g.map(f=>f.exc)).toFixed(2));
console.log();
console.log('  ¿está confundido con la semana de entrada? puntuación media por semana:');
for(const k of Object.keys(sem).sort()){
  const g=sem[k].filter(x=>x.sc!=null);
  console.log('    '+k+'  n='+String(g.length).padStart(2)+'  puntuación media '+med2(g.map(f=>f.sc)).toFixed(1));
}
console.log();
console.log('  las 5 que más pesan en cada mitad:');
for(const [n,g] of [['ALTO',alto],['BAJO',bajo]]){
  const x=[...g].sort((a,b)=>Math.abs(b.exc)-Math.abs(a.exc)).slice(0,5);
  console.log('    '+n+': '+x.map(f=>f.t+' '+(f.exc>=0?'+':'')+f.exc.toFixed(0)).join(', '));
}
