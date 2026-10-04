/* Datos del dia, estado de la interfaz y vista ordenada. La puntuacion vive en puntuacion.js. */
const T=window.DIAS||{},DD=T.dias||{},HIST=T.historico||{};
const DIAS=Object.fromEntries(Object.entries(DD).map(([k,v])=>[k,Array.isArray(v)?v:(v.acciones||[])]));
const F=Object.keys(DIAS).sort().reverse();
const FH=Object.keys(HIST).sort().reverse();
const $=id=>document.getElementById(id);
const n=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const pc=(v,d=1)=>v==null?'-':(v>=0?'+':'')+n(v,d)+' %';
const ppt=(v,d=1)=>v==null?'-':(v>=0?'+':'')+n(v,d)+' pp';
const cap=v=>v==null?'-':(v>=1e9?n(v/1e9,1)+' B':n(v/1e6,0)+' M');
const fFecha=f=>new Date(f+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
const S={dia:F[0],orden:'score',top:10};

function racha(t,f){let r=0;for(let i=FH.indexOf(f);i<FH.length;i++){if((HIST[FH[i]].acciones||[]).some(x=>x.t===t))r++;else break}return r}
function ctxDia(f,a){const d=DD[f]||{},m=(d.mercado||[]).find(x=>x.ticker==='SPY')||{};
return {fecha:f,spy:{tres:m.tres,seis:m.seis},sector:((d.referencia||{}).sectores||{})[a.sector]||null}}

function enriquece(f){const fprev=FH[FH.indexOf(f)+1],prev=(HIST[fprev]||{}).acciones;
// "Nueva" solo tiene sentido si el dia anterior se genero con los mismos criterios (lleva puntuacion).
const comparable=!!prev&&prev.some(x=>x.sc!=null);
const antes=new Set((prev||[]).map(x=>x.t));
return (DIAS[f]||[]).map(a=>{const p=window.PUNTUA?window.PUNTUA(a,ctxDia(f,a)):null;
const d=a.resultados?Math.round((new Date(a.resultados+'T12:00:00Z')-new Date(f+'T12:00:00Z'))/864e5):null;
return {...a,pt:p,score:p?p.total:null,acel:p?p.acel:null,g:p?p.g:null,dmax:p?p.dmax:null,ext:p?p.extEma:null,
nueva:comparable&&!antes.has(a.ticker),racha:racha(a.ticker,f),proximos:d!=null&&d>=0&&d<=14}})}

/* Requisitos obligatorios comprobados sobre los datos de hoy: dicen si la compra sigue siendo viable. */
const CAP_MAX=10e9;
window.REQUISITOS=function(a){const g=Math.max(a.ingresos??-1e9,a.ingresosq??-1e9);
const dmax=a.precio&&a.max52?(a.precio/a.max52-1)*100:null;
return [
 {t:'Precio > 2 $',ok:a.precio>2,v:n(a.precio)+' $'},
 {t:'Capitalización entre 300 M y 10 B',ok:a.cap>300e6&&a.cap<=CAP_MAX,v:cap(a.cap)},
 {t:'Volumen medio > 300.000',ok:a.volmedio>3e5,v:a.volmedio==null?'-':Math.round(a.volmedio/1000)+' mil'},
 {t:'Precio sobre la media de 200 días',ok:a.sma200!=null&&a.precio>a.sma200,v:a.sma200==null?'-':pc((a.precio/a.sma200-1)*100,0)},
 {t:'EMA 9 sobre EMA 50',ok:a.ema9!=null&&a.ema50!=null&&a.ema9>a.ema50,v:a.ema9==null?'-':pc((a.ema9/a.ema50-1)*100,1)},
 {t:'RSI > 55',ok:a.rsi>55,v:n(a.rsi,0)},
 {t:'Ingresos +20 % o más',ok:g>=20,v:g<-1e8?'sin dato':pc(g,0)},
 {t:'A menos del 20 % de su máximo',ok:dmax!=null&&dmax>=-20,v:pc(dmax,1)},
]};

function conPuntuacion(f,lista){return (lista||[]).map(a=>{const p=window.PUNTUA?window.PUNTUA(a,ctxDia(f,a)):null;
return {...a,pt:p,score:p?p.total:null,acel:p?p.acel:null,g:p?p.g:null,dmax:p?p.dmax:null,ext:p?p.extEma:null,racha:racha(a.ticker,f)}})}

window.vista=function(){const todas=enriquece(S.dia).sort((x,y)=>(y[S.orden]??-1e18)-(x[S.orden]??-1e18));
return {fecha:S.dia,fechaTxt:S.dia?fFecha(S.dia):'',todas,filas:todas.slice(0,S.top),
orden:$('orden').selectedOptions[0].textContent,filtros:[],
enMarcha:conPuntuacion(S.dia,(DD[S.dia]||{}).enMarcha).sort((x,y)=>((y.pt||{}).sinPenalizar??0)-((x.pt||{}).sinPenalizar??0)),
universo:(DD[S.dia]||{}).universo||null,candidatas:(DD[S.dia]||{}).candidatas||null}};
