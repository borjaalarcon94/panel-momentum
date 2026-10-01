const T=window.DIAS||{},DD=T.dias||{};
const DIAS=Object.fromEntries(Object.entries(DD).map(([k,v])=>[k,Array.isArray(v)?v:(v.acciones||[])]));
const F=Object.keys(DIAS).sort().reverse();
const $=id=>document.getElementById(id);
const n=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc=(v,d=1)=>v==null?'-':(v>=0?'+':'')+n(v,d)+' %';
const cap=v=>v==null?'-':(v>=1e9?n(v/1e9,1)+' B':n(v/1e6,0)+' M');
const fFecha=f=>new Date(f+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
const S={dia:F[0],q:'',orden:'cambio',pierde:false,nuevas:false,result:false,s200:false,max:false,chk:false};
function racha(t,f){let r=0;for(let i=F.indexOf(f);i<F.length;i++){if(DIAS[F[i]].some(x=>x.ticker===t))r++;else break}return r}
function enriquece(f){const prev=DIAS[F[F.indexOf(f)+1]];const antes=new Set((prev||[]).map(x=>x.ticker));
return (DIAS[f]||[]).map(a=>{const d=a.resultados?Math.round((new Date(a.resultados+'T12:00:00Z')-new Date(f+'T12:00:00Z'))/864e5):null;
const dmax=a.max52?(a.precio/a.max52-1)*100:null;
const ok=[['Rentable',a.margen>0],['Ingresos crecen',a.ingresos>0],['Sobre media 200 d',a.sma200!=null&&a.precio>a.sma200],['Cerca de máximos',dmax!=null&&dmax>=-15],['Volumen alto',a.volrel>=1.5]];
const av=[];if(a.margen!=null&&a.margen<0)av.push(['Pierde dinero','bad']);
if(a.ingresos!=null)av.push(['Ingresos '+pc(a.ingresos,0)+' anual',a.ingresos<0?'bad':'info']);
if(d!=null&&d>=0&&d<=14)av.push(['Resultados en '+d+' días','warn']);
return {...a,dmax,nueva:!!prev&&!antes.has(a.ticker),racha:racha(a.ticker,f),proximos:d!=null&&d>=0&&d<=14,pierde:a.margen!=null&&a.margen<0,
ok:ok.filter(x=>x[1]).map(x=>x[0]),checks:ok.filter(x=>x[1]).length,s200:ok[2][1],cmax:ok[3][1],avisos:av}})}
window.vista=function(){const q=S.q.trim().toLowerCase();
let r=enriquece(S.dia).filter(a=>(!q||(a.ticker+' '+(a.empresa||'')).toLowerCase().includes(q))&&!(S.pierde&&a.pierde)&&!(S.nuevas&&!a.nueva)&&!(S.result&&a.proximos)&&!(S.s200&&!a.s200)&&!(S.max&&!a.cmax)&&!(S.chk&&a.checks<3));
r.sort((x,y)=>(y[S.orden]??-1e18)-(x[S.orden]??-1e18));
const fl=[];if(S.q)fl.push('búsqueda "'+S.q+'"');[['pierde','sin las que pierden dinero'],['nuevas','solo nuevas'],['result','sin resultados próximos'],['s200','sobre media 200 d'],['max','cerca de máximos'],['chk','3+ checks']].forEach(([k,t])=>{if(S[k])fl.push(t)});
r.forEach(a=>{a.avisos=a.avisos.concat([['Checks '+a.checks+'/5'+(a.ok.length?': '+a.ok.join(', '):''),'chk']])});
return {fecha:S.dia,fechaTxt:S.dia?fFecha(S.dia):'',filas:r,filtros:fl,orden:$('orden').selectedOptions[0].textContent}};
