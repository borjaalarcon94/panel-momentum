/* Pestana "Oportunidades del dia": banner de mercado, estadisticas y una tarjeta por accion. */
function stat(k,v){const s=el('div','stat',k);s.prepend(el('b',null,v));return s}
function mercado(v){const m=v.mercado||[],B=$('mercado');B.replaceChildren();if(!m.length){B.hidden=true;return}B.hidden=false;
const nom={SPY:'S&P 500',QQQ:'Nasdaq 100',IWM:'Russell 2000'};let a50=0;
m.forEach(x=>{if(x.precio>x.ema50)a50++});
const bien=REGIMEN.favorable;B.className='banner linea '+(bien?'okb':'warnb');
B.appendChild(el('span','bt',bien?'Mercado a favor':'Modo defensivo'));
m.forEach(x=>{const s2=el('span','mki2');s2.appendChild(el('b',null,nom[x.ticker]||x.ticker));
s2.appendChild(el('span',x.cambio>=0?'up':'down',' '+pc(x.cambio,2)));
s2.appendChild(el('span','m',' · '+(x.precio>x.ema50?'✓':'✗')+' media 50 d'));B.appendChild(s2)});
B.appendChild(el('span','m',bien?'El S&P está sobre su media de 200 días y la mayoría de índices sobre la de 50.':'El S&P ha perdido su media de 200 días. El momentum funciona mucho peor así: se muestran solo 5 candidatas y conviene reducir el tamaño de cada posición.'))}

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
  if(!filas.length){S2.hidden=true;$('dsectores').hidden=true;return}
  $('dsectores').hidden=false;
  S2.hidden=false;
  const enTop={};v.todas.forEach(a=>{enTop[a.sector]=(enTop[a.sector]||0)+1});
  S2.appendChild(el('div','m','Mediana de rentabilidad a 3 meses de cada sector en todo el mercado.'));
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
$('stats').replaceChildren(el('span',null,'Top '+top.length+' · puntuación media '+n(medio,0)+' · '+top.filter(a=>a.nueva).length+' nuevas hoy'+
(v.candidatas?' · '+v.candidatas+' cumplían los requisitos de '+(v.universo||'?')+' analizadas':'')));
$('cuenta').textContent='';
if(!top.length){L.appendChild(el('div','empty','Ese día ninguna acción cumplió los requisitos.'));return}
top.forEach((a,i)=>L.appendChild(tarjeta(a,i)));
// Botón para ver el resto de las guardadas sin salir de la vista
if(v.todas.length>top.length||S.top>5){const b=el('button','chip ver-mas',S.top>5?'Ver solo las 5 mejores':'Ver las '+v.todas.length+' guardadas');
b.onclick=()=>{S.top=S.top>5?5:99;window.pinta()};L.appendChild(b)}};

/* Tarjeta compacta: lo justo para decidir si merece abrirla. El detalle va dentro del desplegable. */
function tarjeta(a,i){const nivel=a.score>=75?' n3':a.score>=55?' n2':' n1';
const c=el('div','card'+nivel+(i===0?' destacada':'')),top=el('div','top'),izq=el('div');
const tk=el('a','tk',a.ticker);tk.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);tk.target='_blank';tk.rel='noopener';
izq.appendChild(el('span','pos','#'+(i+1)));izq.appendChild(tk);if(a.nueva)izq.appendChild(el('span','new','NUEVA'));
izq.appendChild(el('div','name',(a.empresa||'')+' · '+(a.industria||'')+' · '+cap(a.cap)));
const der=el('div','px');der.appendChild(el('b',null,n(a.precio)+' $'));der.appendChild(el('div',a.cambio>=0?'up':'down',pc(a.cambio,2)));
if(a.score!=null){const sc=el('div','score'+(a.score>=75?' s3':a.score>=55?' s2':' s1'));sc.appendChild(el('b',null,n(a.score,0)));sc.appendChild(el('span',null,'/100'));der.appendChild(sc)}
top.append(izq,der);c.appendChild(top);

const r=el('div','resumen');
[['Ingresos',pc(a.g,0)],['Aceleración',a.acel==null?'-':ppt(a.acel,0)],['Desde máx.',pc(a.dmax,1)],
 ['RSI',n(a.rsi,0)],['Vol.',a.volrel==null?'-':n(a.volrel,1)+'x'],['ADR',a.adr==null?'-':n(a.adr,1)+' %']]
.forEach(([k,x])=>{const m=el('span','rz');m.appendChild(el('i',null,k));m.appendChild(el('b',null,x));r.appendChild(m)});
c.appendChild(r);
// Veredicto de compra, lo primero que se lee
const v=window.VEREDICTO(a,{extendida:a.pt?a.pt.extendida:false});
const vd=el('div','quehacer '+v.cls);vd.appendChild(el('b',null,v.t));vd.appendChild(el('span',null,' · '+v.d));
const dR=window.DIAS_RESULTADOS(a,S.dia);
if(dR!=null&&dR>=0&&dR<=10)vd.appendChild(el('span','m',' Publica resultados en '+dR+' día'+(dR===1?'':'s')+': el stop no protege de un hueco al abrir.'));
c.appendChild(vd);
if(a.pt&&a.pt.razones.length)c.appendChild(el('div','clave','➜ '+a.pt.razones[0]));
const sal=window.SALIDA(a);
const o=sal.opciones[0];
if(o){const sb=el('div','stopbox'+(sal.tope?' lejos':''));
sb.appendChild(el('span','et','Stop'));
sb.appendChild(el('span','vl',n(o.v)+' $'));
sb.appendChild(el('span','ds',pc(o.d,0)+' desde aquí'));
const tam=window.TAMANO(o.d);
if(tam&&v.cls==='qok'){sb.appendChild(el('span','et','Comprar'));sb.appendChild(el('span','vl',n(tam.importe,0)));sb.appendChild(el('span','ds',n(tam.pct,1)+' % de tu cartera'))}
if(sal.tope)sb.appendChild(el('span','ds','· media posición o esperar un retroceso'));
c.appendChild(sb)}
const nr=a.pt?a.pt.riesgos.length:0;

const bc=el('button','chip',window.tengoPosicion(a.ticker)?'✓ La tienes':'La tengo');bc.style.marginTop='10px';bc.style.marginRight='6px';
bc.onclick=()=>window.anotarCompra(a,()=>{bc.textContent='✓ La tienes'});
c.appendChild(bc);
const b=el('button','chip','Ver análisis completo'+(nr?' · '+nr+(nr===1?' riesgo':' riesgos'):''));b.style.marginTop='10px';
let abierto=null;
b.onclick=()=>{if(abierto){abierto.remove();abierto=null;b.textContent='Ver análisis completo'+(nr?' · '+nr+(nr===1?' riesgo':' riesgos'):'');return}
abierto=el('div','detalle');
if(a.pt){abierto.appendChild(barras(a.pt));
const b1=bloque('Por qué aparece',a.pt.razones,'good2');if(b1)abierto.appendChild(b1);
const b2=bloque('Señales fundamentales',a.pt.fundamentales,'good2');if(b2)abierto.appendChild(b2);
const b3=bloque('Riesgos',a.pt.riesgos,'risk');if(b3)abierto.appendChild(b3);
if(a.pt.penal.total)abierto.appendChild(el('div','pen','Penalización por sobreextensión: −'+n(a.pt.penal.total,0)+' puntos'))}
if(sal.opciones.length){const u=el('ul','bll');
sal.opciones.forEach(o=>u.appendChild(el('li',null,o.t+': '+n(o.v)+' $ ('+pc(o.d,0)+') — '+o.nota)));
abierto.appendChild(el('div','blt','Dónde poner el stop'));abierto.appendChild(u)}
abierto.appendChild(detalle(a));abierto.appendChild(grafico(a.simbolo||a.ticker,true));
c.appendChild(abierto);b.textContent='Ocultar análisis'};
c.appendChild(b);return c}

function grafico(sym,abrir){const w=el('div');const osc=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
const f=document.createElement('iframe');f.loading='lazy';f.title='Gráfico '+sym;f.style.cssText='width:100%;height:320px;border:0;border-radius:10px;margin-top:10px';
f.src='https://s.tradingview.com/widgetembed/?symbol='+encodeURIComponent(sym)+'&interval=D&style=1&theme='+osc+'&locale=es&hidesidetoolbar=1&hidetoptoolbar=1&saveimage=0&symboledit=0&withdateranges=1&studies=[]';
if(abrir)w.appendChild(f);return w}

window.initHoy=function(){
$('dia').onchange=e=>window.cambiarDia(e.target.value);
$('orden').onchange=e=>{S.orden=e.target.value;window.pinta()};
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{const v=b.dataset.v;
document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===b));
$('vhoy').hidden=v!=='hoy';$('vseg').hidden=v!=='seg';$('vres').hidden=v!=='res';$('vpos').hidden=v!=='pos';$('vpar').hidden=v!=='par';
if(v==='seg'&&window.seguimiento)window.seguimiento();
if(v==='pos'&&window.posiciones)window.posiciones();
if(v==='res'&&window.resultados)window.resultados();
if(v==='par'&&window.parametros)window.parametros()});
};
