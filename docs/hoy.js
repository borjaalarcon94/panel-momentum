function stat(k,v){const s=el('div','stat',k);s.prepend(el('b',null,v));return s}
function mercado(){const m=((DD[S.dia]||{}).mercado)||[],B=$('mercado');B.replaceChildren();if(!m.length){B.hidden=true;return}B.hidden=false;
const nom={SPY:'S&P 500',QQQ:'Nasdaq 100',IWM:'Russell 2000'};let a50=0;
const fila=el('div','mk');m.forEach(x=>{const s50=x.precio>x.ema50,s200=x.precio>x.sma200;if(s50)a50++;
const c=el('div','mki');c.appendChild(el('b',null,nom[x.ticker]||x.ticker));c.appendChild(el('span',x.cambio>=0?'up':'down',pc(x.cambio,2)+' hoy · '+pc(x.mes,1)+' mes'));
c.appendChild(el('span','m',(s50?'✓':'✗')+' media 50 d  '+(s200?'✓':'✗')+' media 200 d'));fila.appendChild(c)});
const bien=a50>=2;B.className='banner '+(bien?'okb':'warnb');B.appendChild(el('div','bt',bien?'Mercado a favor: la mayoría de índices están por encima de su media de 50 días.':'Mercado flojo: la mayoría de índices están por debajo de su media de 50 días. Las estrategias de momentum suelen funcionar peor así.'));B.appendChild(fila)}
function pinta(){mercado();const v=window.vista(),todas=enriquece(S.dia),L=$('lista');L.replaceChildren();
$('stats').replaceChildren(stat('acciones',todas.length),stat('nuevas',todas.filter(a=>a.nueva).length),stat('pierden dinero',todas.filter(a=>a.pierde).length),stat('con 3+ checks',todas.filter(a=>a.checks>=3).length));
$('cuenta').textContent=v.filas.length===todas.length?'':'Mostrando '+v.filas.length+' de '+todas.length;
if(!v.filas.length){L.appendChild(el('div','empty',todas.length?'Ninguna acción cumple estos filtros.':'Ese día ninguna acción cumplió el filtro.'));return}
v.filas.forEach(a=>{const c=el('div','card'),top=el('div','top'),izq=el('div');
const tk=el('a','tk',a.ticker);tk.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);tk.target='_blank';tk.rel='noopener';
izq.appendChild(tk);if(a.nueva)izq.appendChild(el('span','new','NUEVA'));izq.appendChild(el('div','name',(a.empresa||'')+(a.industria?' · '+a.industria:'')));
const der=el('div','px');der.appendChild(el('b',null,n(a.precio)+' $'));der.appendChild(el('div',a.cambio>=0?'up':'down',pc(a.cambio,2)));
top.append(izq,der);c.appendChild(top);const g=el('div','grid');
[['ADR',n(a.adr,1)+' %'],['RSI',n(a.rsi,0)],['Vol. rel.',n(a.volrel)],['Capitaliz.',cap(a.cap)],['Racha',a.racha+(a.racha===1?' día':' días')],['Semana',pc(a.semana)],['Mes',pc(a.mes)],['Desde máx. 52s',pc(a.dmax)],['Checks',a.checks+'/5']].forEach(([k,x])=>{const m=el('div','m',k);m.appendChild(el('span',null,x));g.appendChild(m)});
c.appendChild(g);const tg=el('div','tags');a.ok.forEach(t=>tg.appendChild(el('span','tag good','✓ '+t)));a.avisos.filter(x=>x[1]!=='chk').forEach(([t,k])=>tg.appendChild(el('span','tag '+k,t)));
c.appendChild(tg);c.appendChild(grafico(a.simbolo||a.ticker));L.appendChild(c)})}
function grafico(sym){const w=el('div'),b=el('button','chip','Ver gráfico');b.style.marginTop='10px';let f=null;
b.onclick=()=>{if(f){f.remove();f=null;b.textContent='Ver gráfico';return}
const osc=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
f=document.createElement('iframe');f.loading='lazy';f.title='Gráfico '+sym;f.style.cssText='width:100%;height:320px;border:0;border-radius:10px;margin-top:10px';
f.src='https://s.tradingview.com/widgetembed/?symbol='+encodeURIComponent(sym)+'&interval=D&style=1&theme='+osc+'&locale=es&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&symboledit=0&withdateranges=1&studies=[]';
w.appendChild(f);b.textContent='Ocultar gráfico'};w.appendChild(b);return w}
function chip(id,k){const b=$(id);b.onclick=()=>{S[k]=!S[k];b.setAttribute('aria-pressed',S[k]);pinta()}}
F.forEach(f=>{const o=el('option',null,fFecha(f));o.value=f;$('dia').appendChild(o)});
$('dia').onchange=e=>{S.dia=e.target.value;pinta()};$('orden').onchange=e=>{S.orden=e.target.value;pinta()};$('q').oninput=e=>{S.q=e.target.value;pinta()};
[['c1','pierde'],['c2','nuevas'],['c3','result'],['c4','s200'],['c5','max'],['c6','chk']].forEach(x=>chip(...x));
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===b));$('vhoy').hidden=b.dataset.v!=='hoy';$('vseg').hidden=b.dataset.v!=='seg';if(b.dataset.v==='seg'&&window.seguimiento)window.seguimiento()});
if(T.actualizado)$('act').textContent='Última actualización: '+new Date(T.actualizado.replace('Z',':00Z')).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'});
if(F.length)pinta();else $('lista').appendChild(el('div','empty','Aún no hay datos.'));
