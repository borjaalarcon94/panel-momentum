/* ¿UNA NOTA DE 80-83 RINDE PEOR QUE UNA DE 86-90+?

   Pregunta de Borja el 07/11/2026. Usa TODAS las apariciones en el top 10 (no solo las entradas),
   mide lo que hizo cada una 5, 10 y 15 sesiones después y lo compara con la media del top de ese
   mismo día (así se quita el mercado). Intervalos por bootstrap agrupando por acción, porque la
   misma acción sale muchos días seguidos.

   RESULTADO 07/11/2026 (240 apariciones, 24 días, 44 acciones):
     - No hay escalera. 78-79 rinde MEJOR que 80-82 a 10 y 15 sesiones; 89+ son 3 acciones.
     - ≥ 86 frente a 80-85: +4,5 a 5 sesiones [IC90 +0,3, +9,0], +4,7 a 10 [−1,7, +13,8],
       −2,0 a 15 [−9,5, +11,6]. Una pista a corto plazo que no aguanta al alargar, con 6-10 acciones.
     - Correlación nota↔resultado dentro de cada día: +0,02 / +0,14 / −0,03.
   NO SE TOCA NADA: ni pesos ni mínimo de nota. Repetir a finales de noviembre y en primavera de 2027.

   Uso:  node herramientas/analizar-nota.js        (desde la raiz del repositorio) */
const fs=require('fs');
const pa=JSON.parse(fs.readFileSync('docs/panel.json','utf8'));
const pr=JSON.parse(fs.readFileSync('docs/precios.json','utf8'));
let ex={};try{ex=JSON.parse(fs.readFileSync('docs/extra.json','utf8'));}catch{}
const F=Object.keys(pr.dias).sort();
const precio=(s,f)=>pr.dias[f]?.[s];
const ses=Object.keys(pa.historico).sort();
const mean=v=>v.reduce((a,b)=>a+b,0)/Math.max(1,v.length);
const med=v=>{const x=[...v].sort((a,b)=>a-b);return x.length?x[Math.floor(x.length/2)]:NaN};
const obs=[];
for(const d of ses){
  const lista=pa.historico[d].acciones||[];
  const iF=F.indexOf(d);
  for(const [h,lab] of [[5,'h5'],[10,'h10'],[15,'h15']]){}
  lista.forEach((a,pos)=>{
    const p0=a.p; const o={d,s:a.s,t:a.t,sc:a.sc,pos:pos+1};
    for(const h of [5,10,15]){const f=F[F.indexOf(d)+h]; const p=f?precio(a.s,f):null; o['r'+h]=p&&p0?(p/p0-1)*100:null;}
    obs.push(o);
  });
}
console.log('observaciones',obs.length,'días',ses.length,'acciones distintas',new Set(obs.map(o=>o.s)).size);
// exceso sobre la media del top de ese mismo día (quita el mercado)
for(const h of [5,10,15]){
  const k='r'+h; const w=obs.filter(o=>o[k]!=null);
  const porDia={}; w.forEach(o=>(porDia[o.d]??=[]).push(o));
  w.forEach(o=>o['x'+h]=o[k]-mean(porDia[o.d].map(z=>z[k])));
  console.log(`\n== a ${h} sesiones: n=${w.length}, días=${Object.keys(porDia).length}, acciones=${new Set(w.map(o=>o.s)).size}`);
  const B=[[0,78],[78,80],[80,83],[83,86],[86,89],[89,101]];
  for(const [lo,hi] of B){const x=w.filter(o=>o.sc>=lo&&o.sc<hi); if(!x.length)continue;
    console.log(`  nota ${String(lo).padStart(2)}-${hi-1}: n=${String(x.length).padStart(3)} acciones=${String(new Set(x.map(o=>o.s)).size).padStart(2)}  media ${mean(x.map(o=>o[k])).toFixed(1).padStart(6)}  mediana ${med(x.map(o=>o[k])).toFixed(1).padStart(6)}  exceso vs top del día ${mean(x.map(o=>o['x'+h])).toFixed(1).padStart(6)}  suben ${(100*mean(x.map(o=>o[k]>0?1:0))).toFixed(0)}%`);}
  // correlación de rangos por día
  const rho=[];for(const d in porDia){const z=porDia[d];if(z.length<6)continue;const rk=v=>{const s=[...v].map((x,i)=>[x,i]).sort((a,b)=>a[0]-b[0]);const r=[];s.forEach((p,j)=>r[p[1]]=j);return r};const a=rk(z.map(o=>o.sc)),b=rk(z.map(o=>o[k]));const ma=mean(a),mb=mean(b);let n=0,da=0,db=0;a.forEach((_,i)=>{n+=(a[i]-ma)*(b[i]-mb);da+=(a[i]-ma)**2;db+=(b[i]-mb)**2});rho.push(n/Math.sqrt(da*db));}
  console.log(`  correlación nota↔resultado dentro de cada día (Spearman): media ${mean(rho).toFixed(2)} en ${rho.length} días; días positivos ${rho.filter(r=>r>0).length}`);
}
// escalera solo con la primera aparición de cada acción (independientes)
const prim={};obs.forEach(o=>{if(!prim[o.s])prim[o.s]=o});
const P=Object.values(prim).filter(o=>o.r10!=null);
console.log('\nPrimera aparición de cada acción, a 10 sesiones: n',P.length);
for(const [lo,hi] of [[0,80],[80,84],[84,101]]){const x=P.filter(o=>o.sc>=lo&&o.sc<hi);console.log(`  nota ${lo}-${hi-1}: n=${x.length} media ${mean(x.map(o=>o.r10)).toFixed(1)} mediana ${med(x.map(o=>o.r10)).toFixed(1)}`)}
console.log('\nreparto de notas:',[[0,78],[78,80],[80,83],[83,86],[86,89],[89,101]].map(([l,h])=>`${l}-${h-1}:${obs.filter(o=>o.sc>=l&&o.sc<h).length}`).join(' '));
// Bootstrap por acción (las observaciones de una misma acción van juntas)
console.log('\nDiferencia de exceso, nota ≥86 menos nota 80-85 (y 80-85 menos <80), IC90 bootstrap por acción:');
for(const h of [5,10,15]){
  const w=obs.filter(o=>o['x'+h]!=null); const acc=[...new Set(w.map(o=>o.s))];
  const dif=(ws,a,b)=>mean(ws.filter(o=>o.sc>=a[0]&&o.sc<a[1]).map(o=>o['x'+h]))-mean(ws.filter(o=>o.sc>=b[0]&&o.sc<b[1]).map(o=>o['x'+h]));
  const r1=[],r2=[];let seed=7;const rnd=()=>((seed=(seed*16807)%2147483647)/2147483647);
  for(let it=0;it<2000;it++){const m=[];for(let i=0;i<acc.length;i++){const s=acc[Math.floor(rnd()*acc.length)];m.push(...w.filter(o=>o.s===s))}
    const a=dif(m,[86,101],[80,86]),b=dif(m,[80,86],[0,80]);if(isFinite(a))r1.push(a);if(isFinite(b))r2.push(b);}
  const q=(v,p)=>v.sort((x,y)=>x-y)[Math.floor(v.length*p)];
  console.log(`  ${h} ses: ≥86−(80-85) ${dif(w,[86,101],[80,86]).toFixed(1)} [${q(r1,.05).toFixed(1)}, ${q(r1,.95).toFixed(1)}]   (80-85)−(<80) ${dif(w,[80,86],[0,80]).toFixed(1)} [${q(r2,.05).toFixed(1)}, ${q(r2,.95).toFixed(1)}]   acciones ≥86: ${new Set(w.filter(o=>o.sc>=86).map(o=>o.t)).size} (${[...new Set(w.filter(o=>o.sc>=86).map(o=>o.t))].join(',')})`);
}
