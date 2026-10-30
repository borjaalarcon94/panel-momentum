/* Pestana "Oportunidades del dia": banner de mercado, estadisticas y una tarjeta por accion. */
/* El tercer argumento tiñe la cifra: 'up' verde, 'down' rojo, 'warn' ambar. Solo donde el color
   dice algo. Si se tiñe todo, el color deja de significar nada. */
function stat(k,v,cls){const s=el('div','stat',k);s.prepend(el('b',cls||null,v));return s}
const signo=v=>v==null?null:v>0?'up':v<0?'down':null;
function mercado(v){const m=v.mercado||[],B=$('mercado');B.replaceChildren();if(!m.length){B.hidden=true;return}B.hidden=false;
const nom={SPY:'S&P 500',QQQ:'Nasdaq 100',IWM:'Russell 2000'};
/* Habia aqui un contador a50 de indices sobre su media de 50 que no se usaba en ninguna parte: el
   regimen lo decide REGIMEN.favorable y cada indice ya lleva su propio ✓/✗. Fuera. */
const bien=REGIMEN.favorable;B.className='banner linea '+(bien?'okb':'warnb');
B.appendChild(el('span','bt',bien?'Mercado a favor':'Modo defensivo'));
m.forEach(x=>{const s2=el('span','mki2');s2.appendChild(el('b',null,nom[x.ticker]||x.ticker));
s2.appendChild(el('span',x.cambio>=0?'up':'down',' '+pc(x.cambio,2)));
s2.appendChild(el('span','m',' · '+(x.precio>x.ema50?'✓':'✗')+' media 50 d'));B.appendChild(s2)});
B.appendChild(el('span','m',bien?'El S&P está sobre su media de 200 días y la mayoría de índices sobre la de 50.':'El S&P ha perdido su media de 200 días. El momentum funciona mucho peor así: se muestran solo '+S.top+' candidatas y conviene reducir el tamaño de cada posición.'))}

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
  /* Entrar y salir del top SI son cambios respecto a ayer. Las señales de salida NO: son el estado
     de HOY, y una accion que lleva una semana con señal aparecia cada dia bajo "Cambios respecto
     a ayer", que se lee como novedad. No se pueden calcular las de ayer (de una accion fuera del
     top solo se guarda el precio, no sus indicadores), asi que se dice lo que son. */
  /* Las señales iban en un párrafo corrido de seis avisos seguidos: 281 px de texto rojo imposible
     de escanear. Una por línea, con el ticker destacado. */
  if(alertas.length){
    const d=el('div','cl');d.appendChild(el('span','clt','Con señal de salida hoy'));
    const u=el('ul','bll');
    alertas.slice(0,6).forEach(t=>{const i=t.indexOf(':'),li=el('li','risk');
      li.appendChild(el('b',null,t.slice(0,i)));li.appendChild(el('span',null,t.slice(i)));u.appendChild(li)});
    d.appendChild(u);C.appendChild(d);
    if(alertas.length>6)C.appendChild(el('div','m','y '+(alertas.length-6)+' más'));
  }
  if(!entran.length&&!salen.length&&!alertas.length)C.appendChild(el('div','m','Sin cambios: el top es el mismo y ninguna vigilada ha dado señal de salida.'));
  /* La línea plegada tiene que decir si merece la pena abrirla. */
  const res=$('scontexto');
  if(res){const p=[];
    if(entran.length)p.push(entran.length+(entran.length===1?' entra':' entran'));
    if(salen.length)p.push(salen.length+(salen.length===1?' sale':' salen'));
    if(alertas.length)p.push(alertas.length+(alertas.length===1?' con señal de salida':' con señal de salida'));
    res.textContent=p.length?'Cambios de hoy · '+p.join(', '):'Cambios de hoy · sin novedades';
  }
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
const top=v.filas;
/* La media contaba a.score||0, asi que una accion SIN nota entraba como un 0 y arrastraba la media.
   Si falla la referencia del dia, build.py deja todas las notas a null y la cabecera decia
   "puntuacion media 0", que se lee como "estas acciones valen 0" cuando lo cierto es que hoy no hay
   notas. Se promedia solo lo que existe y, si no existe nada, se dice. Encontrado el 31/10/2026. */
const conNota=top.filter(a=>a.score!=null);
const medio=conNota.length?conNota.reduce((s,a)=>s+a.score,0)/conNota.length:null;
const nuevas=top.filter(a=>a.nueva).length;
$('stats').replaceChildren(el('span',null,'Top '+top.length+
(medio==null?' · sin puntuaciones hoy':' · puntuación media '+n(medio,0)+(conNota.length<top.length?' ('+conNota.length+' de '+top.length+' con nota)':''))+
' · '+nuevas+(nuevas===1?' nueva hoy':' nuevas hoy')+
(v.candidatas?' · '+v.candidatas+' cumplían los requisitos de '+(v.universo||'?')+' analizadas':'')));
$('cuenta').textContent='';
/* Contador en la subpestaña: con Hoy dentro de Seguimiento hay que poder ver desde fuera si hoy
   hay algo que comprar, sin entrar. Cuenta los veredictos verdes (COMPRA) del top. */
const nc=$('nhoy');
if(nc){const compras=top.filter(a=>window.VEREDICTO(a,{extendida:a.pt?a.pt.extendida:false,sinSeguimiento:a.sinSeguimiento,flojea:!!a.flojea}).cls==='qok').length;
nc.textContent=compras||'';nc.hidden=!compras;}
if(!top.length){L.appendChild(el('div','empty','Ese día ninguna acción cumplió los requisitos.'));return}
/* CON PRESUPUESTO CORTO: cuales comprar. La lista YA venia ordenada por prioridad de compra, pero
   no lo decia en ninguna parte, asi que al ver varias tarjetas verdes no habia forma de saber que
   estaban priorizadas ni por que. Aqui se dice, y se dan los dos datos que de verdad las separan.
   No se cambia el orden: solo se explica el que ya habia. */
const compras=top.filter(a=>window.VEREDICTO(a,{extendida:a.pt?a.pt.extendida:false,sinSeguimiento:a.sinSeguimiento,flojea:!!a.flojea}).cls==='qok');
if(compras.length>1){
const g=el('div','margen');
g.appendChild(el('b',null,'Si no puedes comprarlas todas, van en orden: 1, 2, 3…'));
const c=el('div','m');
c.appendChild(el('div',null,'Hoy hay '+compras.length+' en COMPRA. Están ordenadas por prioridad: primero el veredicto, y entre las que empatan, la de mejor puntuación.'));
/* Honestidad sobre el orden: el filtro COMPRA/arriesgada si esta respaldado por reglas, pero el
   orden DENTRO va por la nota, y medido el 25/10/2026 su correlacion con el resultado es +0,01.
   Decirlo evita que el numerito se lea como una recomendacion fuerte. */
c.appendChild(el('div',null,'Ojo: lo que separa COMPRA de «arriesgada» son reglas, y ahí puedes fiarte. El orden entre las de COMPRA va por la puntuación, que todavía no ha demostrado que acierte: úsalo como desempate, no como verdad.'));
/* Los dos datos que si distinguen, con evidencia detras: cuanto aguanta el stop y si repites sector. */
const detalle=compras.map(a=>{const s=window.REGLAS.stopDeEntrada(a);
  const d=s&&!s.invalido?(s.stop/a.precio-1)*100:null;
  const m=d!=null?window.MARGEN_STOP(d,a.adr):null;
  return {t:a.ticker,sec:a.sector,dias:m?m.dias:null,ap:m?m.apretado:false}});
const conMargen=detalle.filter(x=>x.dias!=null);
if(conMargen.length){
c.appendChild(el('div',null,'Margen hasta el stop: '+conMargen.map(x=>x.t+' '+n(x.dias,1)+' días'+(x.ap?' (apretado)':'')).join(' · ')+
  '. Cuanto más margen, menos probable es que te saque un día normal.'));}
const sec={};detalle.forEach(x=>{if(x.sec)(sec[x.sec]=sec[x.sec]||[]).push(x.t)});
const rep=Object.entries(sec).filter(([,v2])=>v2.length>1);
if(rep.length)c.appendChild(el('div',null,'Mismo sector: '+rep.map(([s2,v2])=>v2.join(' y ')+' son '+s2).join('; ')+'. Si eliges esas dos, no diversificas.'));
g.appendChild(c);L.appendChild(g)}
top.forEach((a,i)=>L.appendChild(tarjeta(a,i)));
/* Con el orden por prioridad una nota alta puede caer fuera de las 5 visibles porque hoy no sea
   entrada. Sin decirlo, parece que la accion ha desaparecido del panel. */
const ocultas=v.todas.slice(top.length),peorVisible=Math.min(...top.map(a=>a.score??0));
const altasFuera=ocultas.filter(a=>(a.score??0)>peorVisible);
if(altasFuera.length){const t=el('div','m');
t.appendChild(el('b',null,altasFuera.slice(0,3).map(a=>a.ticker+' ('+n(a.score,0)+')').join(', ')+(altasFuera.length>3?' y '+(altasFuera.length-3)+' más':'')));
const u=altasFuera.length===1;
t.appendChild(el('span',null,(u?' puntúa':' puntúan')+' más alto que alguna de arriba, pero hoy no '+(u?'es':'son')+' entrada. '+(u?'Sigue':'Siguen')+' en el panel, más abajo.'));
L.appendChild(t)}
// Botón para ver el resto de las guardadas sin salir de la vista
if(v.todas.length>top.length||S.top>5){const b=el('button','chip ver-mas',S.top>5?'Ver solo las 5 mejores':'Ver las '+v.todas.length+' guardadas');
b.onclick=()=>{S.top=S.top>5?5:99;window.pinta()};L.appendChild(b)}};

/* Tarjeta compacta: lo justo para decidir si merece abrirla. El detalle va dentro del desplegable. */
/* El acento de la tarjeta lo marca el VEREDICTO, no el tramo de puntuacion: al top solo suben las
   mejores, asi que con el corte en 75 nueve de cada diez tarjetas salian con el mismo color y la
   lista entera parecia homogenea. El veredicto si cambia de una a otra, que es lo que hay que ver. */
function tarjeta(a,i){const v=window.VEREDICTO(a,{extendida:a.pt?a.pt.extendida:false,sinSeguimiento:a.sinSeguimiento,flojea:!!a.flojea});
const nivel=' v-'+({qok:'ok',qwarn:'warn',qbad:'bad'}[v.cls]||'warn');
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
const vd=el('div','quehacer '+v.cls);vd.appendChild(el('b',null,v.t));vd.appendChild(el('span',null,' · '+v.d));
/* El precio accionable, destacado: es lo unico que se puede hacer hoy con esta accion. */
if(v.accion){const ac=el('span','accion');
ac.appendChild(el('span','et',v.accion.et));ac.appendChild(el('span','vl',v.accion.v));
if(v.accion.ds)ac.appendChild(el('span','ds',v.accion.ds));vd.appendChild(ac)}
const dR=window.DIAS_RESULTADOS(a,S.dia);
if(dR!=null&&dR>=0&&dR<=10)vd.appendChild(el('span','m',' Publica resultados en '+dR+' día'+(dR===1?'':'s')+': el stop no protege de un hueco al abrir.'));
c.appendChild(vd);
if(a.pt&&a.pt.razones.length)c.appendChild(el('div','clave','➜ '+a.pt.razones[0]));
const sal=window.SALIDA(a);
const o=sal.opciones[0];
if(o){
/* Margen del stop en dias de rango, calculado antes de pintar porque decide el color de la caja.
   Un stop dentro del ruido de un dia es un stop poco fiable, igual que uno al que le muerde el tope
   del 15 %: el codigo ya trataba ese caso en ambar, y este es el mismo problema o peor. */
/* Con el precio por debajo de la EMA 50 el stop sale por encima: no hay stop valido y no se
   pinta ni distancia ni margen ni importe, porque todo eso se calcula sobre un stop que no existe. */
const mg=sal.invalido?null:window.MARGEN_STOP(o.d,a.adr);
const dudoso=sal.invalido||sal.tope||(mg&&mg.apretado);
const sb=el('div','stopbox'+(dudoso?' lejos':''));
sb.appendChild(el('span','et','Stop'));
sb.appendChild(el('span','vl',sal.invalido?'—':n(o.v)+' $'));
sb.appendChild(el('span','ds'+(sal.invalido?' aviso':''),sal.invalido
  ?'sin stop válido: el precio ya está por debajo de su EMA 50 ('+n(a.ema50)+' $)'
  :pc(o.d,0)+' desde aquí'));
/* Va pegado al stop y antes del dinero: califica al stop, y si el stop no es fiable el importe
   que viene detras tampoco lo es. */
if(mg)sb.appendChild(el('span','ds'+(mg.apretado?' aviso':''),'· margen de '+n(mg.dias,1)+' días de rango'+(mg.muyApretado?': un día normal lo cruza':mg.apretado?': menos de dos días de rango':'')));
const tam=window.TAMANO(o.d);
if(tam&&v.cls==='qok'){sb.appendChild(el('span','et','Comprar'));sb.appendChild(el('span','vl',n(tam.importe,0)));sb.appendChild(el('span','ds',n(tam.pct,1)+' % de tu cartera'));
/* El tope del 25 % se aplicaba en silencio: el numero que veias no era el que salia de tu riesgo,
   era el maximo por concentracion. Ahora se dice. */
if(tam.tope)sb.appendChild(el('span','ds','· tope de concentración: no más del '+tam.max+' % en una sola'))}
/* "Esperar un retroceso" sin decir hasta donde no sirve de nada. El punto exacto es EMA 50 x 1,15:
   ahi el tope del 15 % deja de morder y el stop vuelve a ser un nivel tecnico. */
/* El precio de entrada sin tope lo dice el veredicto, arriba: en esta caja competia con la cifra
   del stop y habia que adivinar cual era cual. Aqui solo va el stop. */
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
/* Seguimiento es la pestaña por defecto y Hoy vive dentro, como subpestaña: es la vista que se usa
   a diario. El riesgo de enterrar Hoy un nivel es perderse una senal de compra, asi que la
   subpestaña lleva un contador con cuantas hay hoy. */
document.querySelectorAll('.subtab').forEach(b=>b.onclick=()=>{const s2=b.dataset.s;
document.querySelectorAll('.subtab').forEach(x=>x.setAttribute('aria-selected',x===b));
$('vhoy').hidden=s2!=='hoy';$('vseg').hidden=s2!=='seg';
if(s2==='seg'&&window.seguimiento)window.seguimiento()});
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{const v=b.dataset.v;
document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected',x===b));
$('grupo-seg').hidden=v!=='seg';$('vres').hidden=v!=='res';$('vpos').hidden=v!=='pos';$('vpar').hidden=v!=='par';
if(v==='seg'&&window.seguimiento&&!$('vseg').hidden)window.seguimiento();
if(v==='pos'&&window.posiciones)window.posiciones();
if(v==='res'&&window.resultados)window.resultados();
if(v==='par'&&window.parametros)window.parametros();
/* La barra desplaza en horizontal y en el movil no caben las cinco: si la pulsada queda fuera, se
   centra. Va al final y en requestAnimationFrame: hacerlo antes de repintar la seccion no surtia
   efecto, el cambio de contenido cancelaba el desplazamiento. */
const centra=()=>{const barra=b.parentElement;
  if(barra.scrollWidth<=barra.clientWidth)return;
  const dx=b.getBoundingClientRect().left-barra.getBoundingClientRect().left;
  barra.scrollLeft=Math.max(0,barra.scrollLeft+dx-(barra.clientWidth-b.offsetWidth)/2)};
requestAnimationFrame(centra);setTimeout(centra,60)});
};
