/* ¿TIENE SENTIDO QUE NO SE PROTEJA NADA HASTA EL +10 %?

   Esa cifra no se eligio: sale de la formula del trailing. El nivel (dos dias de rango por debajo
   del maximo) supera tu precio de compra cuando (1+g)(1-2*adr) > 1, que con ADR 4,6 % cae en
   +10,2 %. La pregunta legitima es si deberia protegerse ANTES, porque el pico mediano de una
   entrada es +5,6 % y asi dos tercios de las entradas no llegan nunca a estar protegidas.

   Esto prueba la alternativa clasica: un stop a break-even, o sea "si llegaste a ganar X, no
   pierdas dinero". Umbrales de +3, +5, +7, +10 y +15 %.

   RESULTADO (06/11/2026, 43 entradas): no compensa. Con el umbral en +3 % la media sale +0,11 por
   entrada, que es ruido, y a cambio cierra 21 en perdida en vez de 17 y deja 14 en verde en vez
   de 16. Acerto 5 veces (salvo 62,1 puntos) y fallo 7 (costo 57,5), con el mayor fallo en XERS,
   -27,5 puntos.

   Y EL DATO QUE LO DECIDE: ninguna de las 12 salidas por break-even salio a break-even. Salieron
   entre -0,1 % y -26 %. El stop estaba puesto en tu precio de compra, pero el stop solo paga lo
   que da el cierre, y el movimiento que rompe un nivel metido dentro del ruido suele ser mayor que
   el propio ruido. Proteger ahi no te devuelve tu dinero: te saca al precio que haya despues de un
   mal dia. Eso es lo que hace que el umbral del trailing no sea arbitrario.

   Uso:  node herramientas/probar-break-even.js        (desde la raiz del repositorio) */
const fs=require('fs');
const src=fs.readFileSync('docs/reglas.js','utf8');
const pr=JSON.parse(fs.readFileSync('docs/precios.json','utf8'));
const pa=JSON.parse(fs.readFileSync('docs/panel.json','utf8'));
const en=JSON.parse(fs.readFileSync('docs/entradas.json','utf8'));
const fechas=Object.keys(pr.dias).sort(), emas=pr.emas||{}, act=pa.actual;
const g={};new Function('window',src)(g);const R=g.REGLAS;
function corre(umbral){
  const out=[];
  for(const s of Object.keys(en)){
    const e=en[s];const i0=fechas.findIndex(f=>f>=e.f);if(i0<0)continue;
    const compra=(pr.dias[fechas[i0]]||{})[s];if(!compra)continue;
    const adr=(act[s]||{}).adr;
    let pico=compra,stop=0,salida=null,ult=compra,mot=null,fs_=null;
    for(let i=i0+1;i<fechas.length;i++){
      const f=fechas[i],p=(pr.dias[f]||{})[s];if(p==null)continue;ult=p;
      const gm=(pico/compra-1)*100;
      let st=R.stopDe({precio:p,ema50:(emas[f]||{})[s],adr},compra,stop,gm)||0;
      const esBE=umbral!=null&&gm>=umbral&&compra>st;
      if(esBE) st=compra;
      stop=Math.max(stop,st);
      if(p<=stop){salida=p;fs_=f;mot=Math.abs(stop-compra)<1e-9?'break-even':'stop';break;}
      const lim=R.limiteDevolucion(gm),dev=gm>0?(1-(p/compra-1)/gm)*100:0;
      if(lim!=null&&dev>=lim-1e-9){salida=p;fs_=f;mot='devolución';break;}
      if(p>pico)pico=p;
    }
    out.push({t:s.replace(/^[A-Z]+:/,''),compra,salida,mot,fs:fs_,
      hoy:((ult/compra-1)*100),r:((salida!=null?salida:ult)/compra-1)*100,k:s});
  }
  return out;
}
const hoy=corre(null), be=corre(3);
console.log('LAS QUE EL BREAK-EVEN EN +3 % CERRARÍA Y HOY NO SE CIERRAN');
console.log('  acción   sale a      el día      ¿y qué hizo después? (valor hoy)');
let mejor=0,peor=0;
for(const x of be){
  const h=hoy.find(y=>y.t===x.t);
  if(x.mot!=='break-even') continue;
  const ultimo=(()=>{let v=null;for(const f of fechas){const q=(pr.dias[f]||{})[x.k];if(q!=null)v=q;}return v})();
  const siAguanta=((ultimo/x.compra-1)*100);
  const dif=x.r-siAguanta;
  if(dif>0)mejor++;else peor++;
  console.log('  '+x.t.padEnd(7)+(x.r>=0?'+':'')+x.r.toFixed(1).padStart(6)+' %   '+x.fs+'   hoy valdría '+(siAguanta>=0?'+':'')+siAguanta.toFixed(1)+' %   '+(dif>0?'acertó +'+dif.toFixed(1):'se perdió '+(-dif).toFixed(1)));
}
console.log();
console.log('  acertó en '+mejor+' y se equivocó en '+peor);
