window.seguimiento=function(){const P=T.precios||{},lim=+$('per').value,fechas=F.slice(0,lim),primero={};
[...fechas].reverse().forEach(f=>DIAS[f].forEach(a=>{const k=a.simbolo||a.ticker;if(!primero[k])primero[k]={...a,entrada:f,veces:0};primero[k].veces++}));
const hoyL=new Set((DIAS[F[0]]||[]).map(a=>a.simbolo||a.ticker));
const r=Object.entries(primero).map(([k,a])=>({...a,ahora:P[k],ret:P[k]!=null?(P[k]/a.precio-1)*100:null,sigue:hoyL.has(k)})).filter(a=>a.entrada!==F[0]&&a.ret!=null).sort((x,y)=>y.ret-x.ret);
const R=$('rseg');R.replaceChildren();
if(!r.length){R.appendChild(el('div','empty','Aún no hay suficiente historial. Vuelve en unos días: aquí verás cómo evolucionan las acciones desde que entraron en la lista.'));return}
const pos=r.filter(a=>a.ret>0).length,med=r.reduce((s,a)=>s+a.ret,0)/r.length,mediana=[...r].sort((x,y)=>x.ret-y.ret)[Math.floor(r.length/2)].ret;
const st=el('div','stats');st.append(stat('acciones seguidas',r.length),stat('en positivo',Math.round(pos/r.length*100)+' %'),stat('media',pc(med)),stat('mediana',pc(mediana)));R.appendChild(st);
const t=el('table','tabla'),h=el('tr');['Acción','Entró','Precio entrada','Precio ahora','Resultado','Días en lista'].forEach(x=>h.appendChild(el('th',null,x)));t.appendChild(h);
r.forEach(a=>{const tr=el('tr'),td=el('td');const l=el('a','tk2',a.ticker);l.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);l.target='_blank';l.rel='noopener';td.appendChild(l);if(a.sigue)td.appendChild(el('span','new','SIGUE'));tr.appendChild(td);
[fFecha(a.entrada),n(a.precio)+' $',n(a.ahora)+' $'].forEach(x=>tr.appendChild(el('td',null,x)));tr.appendChild(el('td',a.ret>=0?'up':'down',pc(a.ret)));tr.appendChild(el('td',null,a.veces));t.appendChild(tr)});
const w=el('div','tw');w.appendChild(t);R.appendChild(w)};
$('per').onchange=()=>window.seguimiento();
