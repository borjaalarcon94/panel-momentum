/* Pestana "Oportunidades del dia": banner de mercado, estadisticas y una tarjeta por accion. */
function stat(k,v){const s=el('div','stat',k);s.prepend(el('b',null,v));return s}
function mercado(){const m=((DD[S.dia]||{}).mercado)||[],B=$('mercado');B.replaceChildren();if(!m.length){B.hidden=true;return}B.hidden=false;
const nom={SPY:'S&P 500',QQQ:'Nasdaq 100',IWM:'Russell 2000'};let a50=0;
const fila=el('div','mk');m.forEach(x=>{const s50=x.precio>x.ema50,s200=x.precio>x.sma200;if(s50)a50++;
const c=el('div','mki');c.appendChild(el('b',null,nom[x.ticker]||x.ticker));c.appendChild(el('span',x.cambio>=0?'up':'down',pc(x.cambio,2)+' hoy · '+pc(x.mes,1)+' mes'));
c.appendChild(el('span','m',(s50?'✓':'✗')+' media 50 d  '+(s200?'✓':'✗')+' media 200 d'));fila.appendChild(c)});
const bien=a50>=2;B.className='banner '+(bien?'okb':'warnb');
B.appendChild(el('div','bt',bien?'Mercado a favor: la mayoría de índices están por encima de su media de 50 días.':'Mercado flojo: la mayoría de índices están por debajo de su media de 50 días. Las estrategias de momentum suelen funcionar peor así: menos posiciones y más exigencia.'));
B.appendChild(fila)}

function barras(pt){const w=el('div','bars');pt.partes.forEach(p=>{const b=el('div','bar');
b.appendChild(el('span','bl',p.label));const t=el('div','bt2'),f=el('div','bf');f.style.width=Math.max(2,p.p/p.max*100)+'%';
f.classList.add(p.p/p.max>=0.7?'bok':p.p/p.max>=0.4?'bmid':'blow');t.appendChild(f);b.appendChild(t);
b.appendChild(el('span','bv',n(p.p,0)+'/'+p.max));b.title=p.detalle.map(x=>(x.ok?'✓ ':'· ')+x.t).join('\n');w.appendChild(b)});return w}

function bloque(titulo,items,clase){if(!items.length)return null;const d=el('div','blk');
d.appendChild(el('div','blt',titulo));const u=el('ul','bll');items.forEach(t=>{const li=el('li',clase,t);u.appendChild(li)});d.appendChild(u);return d}

function detalle(a){const w=el('div','det');
const g=[['ADR',n(a.adr,1)+' %'],['RSI',n(a.rsi,0)],['Vol. rel.',n(a.volrel)],['Capitaliz.',cap(a.cap)],
['Ingresos',pc(a.g,0)],['Aceler.',a.acel==null?'-':ppt(a.acel,0)],['M. bruto',a.mbruto==null?'-':n(a.mbruto,0)+' %'],
['FCF',a.fcfm==null?'-':n(a.fcfm,0)+' %'],['Desde máx.',pc(a.dmax)],['Sobre EMA50',pc(a.ext,0)],
['Semana',pc(a.semana)],['Mes',pc(a.mes)],['3 meses',pc(a.tres)],['Racha',a.racha+(a.racha===1?' día':' días')],
['Resultados',a.resultados||'-']].map(([k,x])=>{const m=el('div','m',k);m.appendChild(el('span',null,x));return m});
const gr=el('div','grid');g.forEach(x=>gr.appendChild(x));w.appendChild(gr);return w}

function pinta(){mercado();const v=window.vista(),todas=enriquece(S.dia),L=$('lista');L.replaceChildren();
const conA=todas.filter(a=>a.acel>0).length,medio=todas.length?todas.reduce((s,a)=>s+(a.score||0),0)/todas.length:0;
$('stats').replaceChildren(stat('oportunidades',todas.length),stat('puntuación media',n(medio,0)),
stat('con aceleración',conA),stat('nuevas hoy',todas.filter(a=>a.nueva).length));
$('cuenta').textContent=(v.filas.length===todas.length?'':'Mostrando '+v.filas.length+' de '+todas.length)+(v.universo?' · universo analizado: '+v.universo:'');
if(!v.filas.length){L.appendChild(el('div','empty',todas.length?'Ninguna acción cumple estos filtros.':'Ese día ninguna acción cumplió los requisitos.'));return}
v.filas.forEach((a,i)=>{const c=el('div','card'),top=el('div','top'),izq=el('div');
const tk=el('a','tk',a.ticker);tk.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);tk.target='_blank';tk.rel='noopener';
izq.appendChild(el('span','pos','#'+(i+1)));izq.appendChild(tk);if(a.nueva)izq.appendChild(el('span','new','NUEVA'));
izq.appendChild(el('div','name',(a.empresa||'')+(a.industria?' · '+a.industria:'')));
const der=el('div','px');der.appendChild(el('b',null,n(a.precio)+' $'));der.appendChild(el('div',a.cambio>=0?'up':'down',pc(a.cambio,2)));
if(a.score!=null){const sc=el('div','score'+(a.score>=75?' s3':a.score>=55?' s2':' s1'));sc.appendChild(el('b',null,n(a.score,0)));sc.appendChild(el('span',null,'/100'));der.appendChild(sc)}
top.append(izq,der);c.appendChild(top);
if(a.pt){c.appendChild(barras(a.pt));
const b1=bloque('Por qué aparece',a.pt.razones,'good2');if(b1)c.appendChild(b1);
const b2=bloque('Señales fundamentales',a.pt.fundamentales,'good2');if(b2)c.appendChild(b2);
const b3=bloque('Riesgos',a.pt.riesgos,'risk');if(b3)c.appendChild(b3);
if(a.pt.penal.total)c.appendChild(el('div','pen','Penalización por sobreextensión: −'+n(a.pt.penal.total,0)+' puntos'))}
const mas=el('button','chip','Ver datos y gráfico');mas.style.marginTop='10px';let abierto=null;
mas.onclick=()=>{if(abierto){abierto.remove();abierto=null;mas.textContent='Ver datos y gráfico';return}
abierto=el('div');abierto.appendChild(detalle(a));abierto.appendChild(grafico(a.simbolo||a.ticker,true));c.appendChild(abierto);mas.textContent='Ocultar datos'};
c.appendChild(mas);L.appendChild(c)})}

function grafico(sym,abrir){const w=el('div');const osc=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
const f=document.createElement('iframe');f.loading='lazy';f.title='Gráfico '+sym;f.style.cssText='width:100%;height:320px;border:0;border-radius:10px;margin-top:10px';
f.src='https://s.tradingview.com/widgetembed/?symbol='+encodeURIComponent(sym)+'&interval=D&style=1&theme='+osc+'&locale=es&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&symboledit=0&withdateranges=1&studies=[]';
if(abrir)w.appendChild(f);return w}

function chip(id,k){const b=$(id);if(!b)return;b.setAttribute('aria-pressed',!!S[k]);b.onclick=()=>{S[k]=!S[k];b.setAttribute('aria-pressed',S[k]);pinta()}}
F.forEach(f=>{const o=el('option',null,fFecha(f));o.value=f;$('dia').appendChild(o)});
$('dia').onchange=e=>{S.dia=e.target.value;pinta()};$('orden').onchange=e=>{S.orden=e.target.value;pinta()};$('q').oninput=e=>{S.q=e.target.value;pinta()};
[['c1','acel'],['c2','nuevas'],['c3','result'],['c4','g25'],['c5','cerca'],['c6','sinext'],['c7','vol'],['c8','cicl']].forEach(x=>chip(...x));
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===b));$('vhoy').hidden=b.dataset.v!=='hoy';$('vseg').hidden=b.dataset.v!=='seg';if(b.dataset.v==='seg'&&window.seguimiento)window.seguimiento()});
if(T.actualizado)$('act').textContent='Última actualización: '+new Date(T.actualizado.replace('Z',':00Z')).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
if(F.length)pinta();else $('lista').appendChild(el('div','empty','Aún no hay datos.'));
