/* Datos del dia, estado de la interfaz y vista filtrada/ordenada. La puntuacion vive en puntuacion.js. */
const T=window.DIAS||{},DD=T.dias||{};
const DIAS=Object.fromEntries(Object.entries(DD).map(([k,v])=>[k,Array.isArray(v)?v:(v.acciones||[])]));
const F=Object.keys(DIAS).sort().reverse();
const $=id=>document.getElementById(id);
const n=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc=(v,d=1)=>v==null?'-':(v>=0?'+':'')+n(v,d)+' %';
const ppt=(v,d=1)=>v==null?'-':(v>=0?'+':'')+n(v,d)+' pp';
const cap=v=>v==null?'-':(v>=1e9?n(v/1e9,1)+' B':n(v/1e6,0)+' M');
const fFecha=f=>new Date(f+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
const S={dia:F[0],q:'',orden:'score',acel:false,nuevas:false,result:false,g25:false,cerca:false,sinext:false,vol:false,cicl:true};
// Negocios cuyo "crecimiento" suele venir del precio de una materia prima o de los fletes, no de mas clientes.
const CICLICAS=['Energy Minerals','Non-Energy Minerals','Process Industries','Utilities'];
const esCiclica=a=>CICLICAS.includes(a.sector)||/Marine Shipping|Oil|Gas|Coal|Steel|Mining|Metals|Chemicals/i.test(a.industria||'');

function racha(t,f){let r=0;for(let i=F.indexOf(f);i<F.length;i++){if(DIAS[F[i]].some(x=>x.ticker===t))r++;else break}return r}
function ctxDia(f,a){const d=DD[f]||{},m=(d.mercado||[]).find(x=>x.ticker==='SPY')||{};
return {fecha:f,spy:{tres:m.tres,seis:m.seis},sector:((d.referencia||{}).sectores||{})[a.sector]||null}}

function enriquece(f){const fprev=F[F.indexOf(f)+1],prev=DIAS[fprev];
// "Nueva" solo tiene sentido si el dia anterior se genero con los mismos criterios (lleva referencia de sector).
const comparable=!!prev&&!!(DD[fprev]||{}).referencia===!!(DD[f]||{}).referencia;
const antes=new Set((prev||[]).map(x=>x.ticker));
return (DIAS[f]||[]).map(a=>{const p=window.PUNTUA?window.PUNTUA(a,ctxDia(f,a)):null;
const d=a.resultados?Math.round((new Date(a.resultados+'T12:00:00Z')-new Date(f+'T12:00:00Z'))/864e5):null;
return {...a,pt:p,score:p?p.total:null,acel:p?p.acel:null,g:p?p.g:null,dmax:p?p.dmax:null,ext:p?p.extEma:null,
nueva:comparable&&!antes.has(a.ticker),racha:racha(a.ticker,f),proximos:d!=null&&d>=0&&d<=14,
pierde:a.margen!=null&&a.margen<0,sinext:p?p.penal.total===0:true}})}

window.puntuaDia=function(f,ticker){const a=(DIAS[f]||[]).find(x=>x.ticker===ticker||x.simbolo===ticker);
return a&&window.PUNTUA?window.PUNTUA(a,ctxDia(f,a)):null};
window.esCiclica=esCiclica;

window.vista=function(){const q=S.q.trim().toLowerCase();
let r=enriquece(S.dia).filter(a=>(!q||(a.ticker+' '+(a.empresa||'')).toLowerCase().includes(q))
&&!(S.acel&&!(a.acel>0))&&!(S.nuevas&&!a.nueva)&&!(S.result&&a.proximos)&&!(S.g25&&!(a.g>=25))
&&!(S.cerca&&!(a.dmax!=null&&a.dmax>=-10))&&!(S.cicl&&esCiclica(a))&&!(S.sinext&&!a.sinext)&&!(S.vol&&!(a.volrel>=1.5)));
r.sort((x,y)=>(y[S.orden]??-1e18)-(x[S.orden]??-1e18));
const fl=[];if(S.q)fl.push('búsqueda "'+S.q+'"');
[['acel','solo con aceleración'],['nuevas','solo nuevas'],['result','sin resultados próximos'],['g25','crecimiento ≥ 25 %'],['cerca','a menos del 10 % del máximo'],['sinext','sin sobreextensión'],['vol','volumen ≥ 1,5x'],['cicl','sin cíclicas de materias primas']].forEach(([k,t])=>{if(S[k])fl.push(t)});
return {fecha:S.dia,fechaTxt:S.dia?fFecha(S.dia):'',filas:r,filtros:fl,orden:$('orden').selectedOptions[0].textContent,
universo:(DD[S.dia]||{}).universo||null}};
