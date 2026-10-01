const DIAS=window.DIAS||{};
const F=Object.keys(DIAS).sort().reverse();
const $=id=>document.getElementById(id);
const n=(v,d=2)=>v==null?'-':Number(v).toLocaleString('es-ES',{minimumFractionDigits:d,maximumFractionDigits:d});
const cap=v=>v==null?'-':(v>=1e9?n(v/1e9,1)+' B':n(v/1e6,0)+' M');
const fFecha=f=>new Date(f+'T12:00:00Z').toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
function el(t,c,x){const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
const S={dia:F[0],q:'',orden:'cambio',pierde:false,nuevas:false,result:false};
function racha(t,f){let r=0;for(let i=F.indexOf(f);i<F.length;i++){if((DIAS[F[i]]||[]).some(x=>x.ticker===t))r++;else break}return r}
function diasRes(a,f){if(!a.resultados)return null;return Math.round((new Date(a.resultados+'T12:00:00Z')-new Date(f+'T12:00:00Z'))/864e5)}
function enriquece(f){const prev=DIAS[F[F.indexOf(f)+1]];const antes=new Set((prev||[]).map(x=>x.ticker));
return (DIAS[f]||[]).map(a=>{const d=diasRes(a,f);const av=[];
if(a.margen!=null&&a.margen<0)av.push(['Pierde dinero','bad']);
if(a.ingresos!=null)av.push(['Ingresos '+(a.ingresos>=0?'+':'')+n(a.ingresos,0)+' % anual',a.ingresos<0?'bad':'info']);
if(d!=null&&d>=0&&d<=14)av.push(['Resultados en '+d+' días','warn']);
if(a.volrel>=1.5)av.push(['Volumen alto','info']);
return {...a,nueva:!!prev&&!antes.has(a.ticker),racha:racha(a.ticker,f),proximos:d!=null&&d>=0&&d<=14,pierde:a.margen!=null&&a.margen<0,avisos:av}})}
window.vista=function(){const q=S.q.trim().toLowerCase();
let r=enriquece(S.dia).filter(a=>(!q||(a.ticker+' '+(a.empresa||'')).toLowerCase().includes(q))&&!(S.pierde&&a.pierde)&&!(S.nuevas&&!a.nueva)&&!(S.result&&a.proximos));
r.sort((x,y)=>(y[S.orden]??-1e18)-(x[S.orden]??-1e18));
const fl=[];if(S.q)fl.push('búsqueda "'+S.q+'"');if(S.pierde)fl.push('sin las que pierden dinero');if(S.nuevas)fl.push('solo nuevas');if(S.result)fl.push('sin resultados próximos');
return {fecha:S.dia,fechaTxt:S.dia?fFecha(S.dia):'',filas:r,filtros:fl,orden:$('orden').selectedOptions[0].textContent}};
function stat(k,v){const s=el('div','stat',k);s.prepend(el('b',null,v));return s}
function pinta(){const v=window.vista(),todas=enriquece(S.dia),L=$('lista');L.replaceChildren();
$('stats').replaceChildren(stat('acciones',todas.length),stat('nuevas',todas.filter(a=>a.nueva).length),stat('pierden dinero',todas.filter(a=>a.pierde).length),stat('resultados ≤14 d',todas.filter(a=>a.proximos).length));
$('cuenta').textContent=v.filas.length===todas.length?'':'Mostrando '+v.filas.length+' de '+todas.length;
if(!v.filas.length){L.appendChild(el('div','empty',todas.length?'Ninguna acción cumple estos filtros.':'Ese día ninguna acción cumplió el filtro.'));return}
v.filas.forEach(a=>{const c=el('div','card'),top=el('div','top'),izq=el('div');
const tk=el('a','tk',a.ticker);tk.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);tk.target='_blank';tk.rel='noopener';
izq.appendChild(tk);if(a.nueva)izq.appendChild(el('span','new','NUEVA'));izq.appendChild(el('div','name',a.empresa||''));
const der=el('div','px');der.appendChild(el('b',null,n(a.precio)+' $'));der.appendChild(el('div',a.cambio>=0?'up':'down',(a.cambio>=0?'+':'')+n(a.cambio)+' %'));
top.append(izq,der);c.appendChild(top);const g=el('div','grid');
[['ADR',n(a.adr,1)+' %'],['RSI',n(a.rsi,0)],['Vol. rel.',n(a.volrel)],['Capitaliz.',cap(a.cap)],['Racha',a.racha+(a.racha===1?' día':' días')]].forEach(([k,x])=>{const m=el('div','m',k);m.appendChild(el('span',null,x));g.appendChild(m)});
c.appendChild(g);const tg=el('div','tags');a.avisos.forEach(([t,k])=>tg.appendChild(el('span','tag '+k,t)));if(a.sector)tg.appendChild(el('span','tag info',a.sector));
c.appendChild(tg);L.appendChild(c)})}
function chip(id,k){const b=$(id);b.onclick=()=>{S[k]=!S[k];b.setAttribute('aria-pressed',S[k]);pinta()}}
F.forEach(f=>{const o=el('option',null,fFecha(f));o.value=f;$('dia').appendChild(o)});
$('dia').onchange=e=>{S.dia=e.target.value;pinta()};
$('orden').onchange=e=>{S.orden=e.target.value;pinta()};
$('q').oninput=e=>{S.q=e.target.value;pinta()};
chip('c1','pierde');chip('c2','nuevas');chip('c3','result');
if(F.length)pinta();else $('lista').appendChild(el('div','empty','Aún no hay datos.'));
