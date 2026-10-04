/* Pestana "Oportunidades del dia": banner de mercado, estadisticas y una tarjeta por accion. */
function stat(k,v){const s=el('div','stat',k);s.prepend(el('b',null,v));return s}
function mercado(v){const m=v.mercado||[],B=$('mercado');B.replaceChildren();if(!m.length){B.hidden=true;return}B.hidden=false;
const nom={SPY:'S&P 500',QQQ:'Nasdaq 100',IWM:'Russell 2000'};let a50=0;
const fila=el('div','mk');m.forEach(x=>{const s50=x.precio>x.ema50,s200=x.precio>x.sma200;if(s50)a50++;
const c=el('div','mki');c.appendChild(el('b',null,nom[x.ticker]||x.ticker));c.appendChild(el('span',x.cambio>=0?'up':'down',pc(x.cambio,2)+' hoy · '+pc(x.mes,1)+' mes'));
c.appendChild(el('span','m',(s50?'✓':'✗')+' media 50 d  '+(s200?'✓':'✗')+' media 200 d'));fila.appendChild(c)});
const bien=a50>=2;B.className='banner '+(bien?'okb':'warnb');
B.appendChild(el('div','bt',bien?'Mercado a favor: la mayoría de índices están por encima de su media de 50 días.':'Mercado flojo: la mayoría de índices están por debajo de su media de 50 días. Las estrategias de momentum suelen funcionar peor así: menos posiciones y más exigencia.'));
B.appendChild(fila)}

/* Que ha cambiado respecto al dia anterior: entradas, salidas y senales de salida en las vigiladas. */
function cambios(v){
  const C=$('cambios');C.replaceChildren();
  const f=S.dia,fprev=FH[FH.indexOf(f)+1];
  const hoy=((HIST[f]||{}).acciones||[]),ayer=((HIST[fprev]||{}).acciones||[]);
  if(!ayer.length||!hoy.some(x=>x.sc!=null)||!ayer.some(x=>x.sc!=null)){C.hidden=true;return}
  C.hidden=false;
  const antes=new Set(ayer.map(x=>x.t)),ahora=new Set(hoy.map(x=>x.t));
  const entran=hoy.filter(x=>!antes.has(x.t)).map(x=>x.t),salen=ayer.filter(x=>!ahora.has(x.t)).map(x=>x.t);
  const alertas=[];
  Object.entries(ACT).forEach(([sim,a])=>{const s=window.SALIDA(a);if(s.senales.length)alertas.push(a.ticker+': '+s.senales[0].toLowerCase())});
  const linea=(t,xs,cls)=>{if(!xs.length)return;const d=el('div','cl');d.appendChild(el('span','clt',t));
    d.appendChild(el('span',cls,xs.join(' · ')));C.appendChild(d)};
  C.appendChild(el('div','blt','Cambios respecto a '+fFecha(fprev)));
  linea('Entran al top',entran,'up');
  linea('Salen del top',salen,'down');
  linea('Señales de salida',alertas.slice(0,6),'down');
  if(!entran.length&&!salen.length&&!alertas.length)C.appendChild(el('div','m','Sin cambios: el top es el mismo y ninguna vigilada ha dado señal de salida.'));
}

/* Sectores con mas fuerza: mediana de rentabilidad a 3 meses de cada sector del mercado. */
function sectores(v){
  const S2=$('sectores');S2.replaceChildren();
  const ref=((T.referenciaHoy||{}).sectores)||{};
  const filas=Object.entries(ref).map(([k,x])=>({s:k,tres:x.tres,seis:x.seis})).filter(x=>x.tres!=null).sort((a,b)=>b.tres-a.tres);
  if(!filas.length){S2.hidden=true;return}
  S2.hidden=false;
  const enTop={};v.todas.forEach(a=>{enTop[a.sector]=(enTop[a.sector]||0)+1});
  S2.appendChild(el('div','blt','Sectores con más fuerza (mediana a 3 meses de todo el mercado)'));
  const g=el('div','secg');
  filas.slice(0,6).forEach(x=>{const d=el('div','sec');
    d.appendChild(el('b',x.tres>=0?'up':'down',pc(x.tres,1)));
    d.appendChild(el('span','m',x.s+(enTop[x.s]?' · '+enTop[x.s]+' en el top':'')));g.appendChild(d)});
  S2.appendChild(g);
}

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

function marcha(v){const D=$('marcha'),L=$('lmarcha');L.replaceChildren();
if(!v.enMarcha.length){D.hidden=true;return}D.hidden=false;
$('nmarcha').textContent='('+v.enMarcha.length+')';
v.enMarcha.forEach(a=>{const c=el('div','card mini'),top=el('div','top'),izq=el('div');
const tk=el('a','tk',a.ticker);tk.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);tk.target='_blank';tk.rel='noopener';
izq.appendChild(tk);izq.appendChild(el('div','name',(a.empresa||'')+' · '+cap(a.cap)));
const der=el('div','px');der.appendChild(el('b',null,n(a.precio)+' $'));
der.appendChild(el('div','m','puntuación '+n(a.score,0)+' · sin penalizar '+n((a.pt||{}).sinPenalizar,0)));
top.append(izq,der);c.appendChild(top);
const g=el('div','grid');[['Ingresos',pc(a.g,0)],['1 mes',pc(a.mes,0)],['6 meses',pc(a.seis,0)],['Sobre EMA50',pc(a.ext,0)],['RSI',n(a.rsi,0)]]
.forEach(([k,x])=>{const m=el('div','m',k);m.appendChild(el('span',null,x));g.appendChild(m)});c.appendChild(g);
if(a.pt&&a.pt.penal.motivos.length)c.appendChild(el('div','pen','Muy extendida: '+a.pt.penal.motivos.join(' · ')));
L.appendChild(c)})}

window.pinta=function(){const v=window.vista();mercado(v);sectores(v);cambios(v);const L=$('lista');L.replaceChildren();marcha(v);
const top=v.filas,medio=top.length?top.reduce((s,a)=>s+(a.score||0),0)/top.length:0;
$('stats').replaceChildren(stat('en el top mostrado',top.length),stat('puntuación media',n(medio,0)),
stat('nuevas hoy',top.filter(a=>a.nueva).length));
$('cuenta').textContent=(v.candidatas?v.candidatas+' empresas cumplían los requisitos · se guardan las '+v.todas.length+' mejores':'');
if(!top.length){L.appendChild(el('div','empty','Ese día ninguna acción cumplió los requisitos.'));return}
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
const sal=window.SALIDA(a);
if(sal.opciones.length)c.appendChild(el('div','stop','Si entras, stop técnico en '+n(sal.opciones[0].v)+' $ ('+pc(sal.opciones[0].d,0)+', cierre bajo la EMA 21)'+(sal.opciones[1]?' · más holgado: '+n(sal.opciones[1].v)+' $ ('+pc(sal.opciones[1].d,0)+')':'')));
const mas=el('button','chip','Ver datos y gráfico');mas.style.marginTop='10px';let abierto=null;
mas.onclick=()=>{if(abierto){abierto.remove();abierto=null;mas.textContent='Ver datos y gráfico';return}
abierto=el('div');abierto.appendChild(detalle(a));abierto.appendChild(grafico(a.simbolo||a.ticker,true));c.appendChild(abierto);mas.textContent='Ocultar datos'};
c.appendChild(mas);L.appendChild(c)})}

function grafico(sym,abrir){const w=el('div');const osc=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
const f=document.createElement('iframe');f.loading='lazy';f.title='Gráfico '+sym;f.style.cssText='width:100%;height:320px;border:0;border-radius:10px;margin-top:10px';
f.src='https://s.tradingview.com/widgetembed/?symbol='+encodeURIComponent(sym)+'&interval=D&style=1&theme='+osc+'&locale=es&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&symboledit=0&withdateranges=1&studies=[]';
if(abrir)w.appendChild(f);return w}

window.initHoy=function(){
$('dia').onchange=e=>window.cambiarDia(e.target.value);
$('orden').onchange=e=>{S.orden=e.target.value;window.pinta()};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===b));$('vhoy').hidden=b.dataset.v!=='hoy';$('vseg').hidden=b.dataset.v!=='seg';if(b.dataset.v==='seg'&&window.seguimiento)window.seguimiento()});
};
