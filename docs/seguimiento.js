window.seguimiento=function(){const P=T.precios||{},lim=+$('per').value,fechas=F.slice(0,lim),primero={};
const spy=f=>(((DD[f]||{}).mercado||[]).find(x=>x.ticker==='SPY')||{}).precio,spyHoy=spy(F[0]);
[...fechas].reverse().forEach(f=>DIAS[f].forEach(a=>{const k=a.simbolo||a.ticker;if(!primero[k])primero[k]={...a,entrada:f,veces:0};primero[k].veces++}));
const hoyL=new Set((DIAS[F[0]]||[]).map(a=>a.simbolo||a.ticker));
const r=Object.entries(primero).map(([k,a])=>{const s0=spy(a.entrada);return {...a,ahora:P[k],ret:P[k]!=null?(P[k]/a.precio-1)*100:null,sp:s0&&spyHoy?(spyHoy/s0-1)*100:null,sigue:hoyL.has(k)}}).filter(a=>a.entrada!==F[0]&&a.ret!=null).sort((x,y)=>y.ret-x.ret);
const R=$('rseg');R.replaceChildren();
if(!r.length){R.appendChild(el('div','empty','Aún no hay suficiente historial. Vuelve en unos días: aquí verás cómo evolucionan las acciones desde que entraron en la lista y si lo hacen mejor o peor que el S&P 500.'));return}
const pos=r.filter(a=>a.ret>0).length,med=r.reduce((s,a)=>s+a.ret,0)/r.length,mediana=[...r].sort((x,y)=>x.ret-y.ret)[Math.floor(r.length/2)].ret;
const cs=r.filter(a=>a.sp!=null),spMed=cs.length?cs.reduce((s,a)=>s+a.sp,0)/cs.length:null,gana=cs.filter(a=>a.ret>a.sp).length;
const st=el('div','stats');st.append(stat('acciones seguidas',r.length),stat('en positivo',Math.round(pos/r.length*100)+' %'),stat('media',pc(med)),stat('mediana',pc(mediana)));R.appendChild(st);
if(spMed!=null){const d=med-spMed,B=el('div','banner '+(d>=0?'okb':'warnb'));
B.appendChild(el('div','bt',(d>=0?'La lista va mejor que el mercado: ':'La lista va peor que el mercado: ')+'de media '+pc(med)+' frente a '+pc(spMed)+' del S&P 500 en los mismos días ('+(d>=0?'+':'')+n(d,1)+' puntos). '+gana+' de '+cs.length+' acciones ('+Math.round(gana/cs.length*100)+' %) lo han hecho mejor que el índice.'));R.appendChild(B)}
const t=el('table','tabla'),h=el('tr');['Acción','Entró','Precio entrada','Precio ahora','Resultado','S&P 500 mismo periodo','Diferencia','Días en lista'].forEach(x=>h.appendChild(el('th',null,x)));t.appendChild(h);
r.forEach(a=>{const tr=el('tr'),td=el('td');const l=el('a','tk2',a.ticker);l.href='https://www.tradingview.com/chart/?symbol='+encodeURIComponent(a.simbolo||a.ticker);l.target='_blank';l.rel='noopener';td.appendChild(l);if(a.sigue)td.appendChild(el('span','new','SIGUE'));tr.appendChild(td);
[fFecha(a.entrada),n(a.precio)+' $',n(a.ahora)+' $'].forEach(x=>tr.appendChild(el('td',null,x)));tr.appendChild(el('td',a.ret>=0?'up':'down',pc(a.ret)));
tr.appendChild(el('td',a.sp==null?null:a.sp>=0?'up':'down',pc(a.sp)));const df=a.sp==null?null:a.ret-a.sp;tr.appendChild(el('td',df==null?null:df>=0?'up':'down',df==null?'-':(df>=0?'+':'')+n(df,1)+' pt'));
tr.appendChild(el('td',null,a.veces));t.appendChild(tr)});
const w=el('div','tw');w.appendChild(t);R.appendChild(w)};
$('per').onchange=()=>window.seguimiento();
