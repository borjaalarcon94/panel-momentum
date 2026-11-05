/* DONDE PONER EL PRIMER ESCALON DE LA DEVOLUCION DE GANANCIAS.

   Mueve el escalon por +10, +15, +20 y +30 % y rehace las 42 entradas con REGLAS.recorrido(), la
   misma funcion que usa el panel. Lo que importa no es la media: es CUANTAS entradas se mueven y
   cuanto aporta cada una. Con el escalon en +15 % la media sale mejor (+0,60 % contra -0,08 %),
   pero solo se mueven dos entradas y una de ellas RESTA: IOVA aporta +0,78 y RSKD quita 0,10, asi
   que toda la mejora es una sola accion. Eso no es una calibracion, es un ajuste a un caso.

   Se guarda porque el 05/11/2026 el documento para la otra app afirmaba que la mejora venia de dos
   acciones (IOVA y TEAM) y Parametros decia que de una sola. Medido: la razon la tenia Parametros,
   y TEAM solo se mueve con el escalon en +10 %. Con la herramienta aqui, la proxima vez se mide en
   vez de recordarse.

   Uso:  node herramientas/ab-escalon-devolucion.js        (desde la raiz del repositorio) */
const fs=require('fs');const src=fs.readFileSync('docs/reglas.js','utf8');
function motor(desde){const t=src.replace('{ desde: 20, limite: 50 }','{ desde: '+desde+', limite: 50 }');
 const g={};new Function('window',t)(g);
 if(g.REGLAS.limiteDevolucion(desde-0.1)!=null) throw new Error('escalon mal puesto para '+desde);
 return g.REGLAS;}
const pr=JSON.parse(fs.readFileSync('docs/precios.json','utf8'));
const pa=JSON.parse(fs.readFileSync('docs/panel.json','utf8'));
const en=JSON.parse(fs.readFileSync('docs/entradas.json','utf8'));
const dias=pr.dias,emas=pr.emas||{},act=pa.actual,fechas=Object.keys(dias).sort();
function corre(desde){const R=motor(desde),f=[];
 for(const s of Object.keys(en)){const e=en[s];const i0=fechas.findIndex(x=>x>=e.f);if(i0<0)continue;
  const compra=(dias[fechas[i0]]||{})[s];if(!compra)continue;
  const ses=fechas.filter(x=>x>fechas[i0]);
  const x=R.recorrido(compra,ses,q=>(dias[q]||{})[s],q=>(emas[q]||{})[s],(act[s]||{}).adr);
  let ult=compra;for(const q of ses){const c=(dias[q]||{})[s];if(c!=null)ult=c;}
  f.push({t:s.replace(/^[A-Z]+:/,''),ret:x.ret!=null?x.ret:(ult/compra-1)*100,cer:x.ret!=null,mot:x.motivo});}
 return f;}
const med=v=>v.reduce((s,x)=>s+x,0)/v.length;
const base=corre(20);
console.log('escalon   media    cerradas  en verde   cambia respecto al +20 %');
for(const d of [10,15,20,30]){
  const f=corre(d), m=med(f.map(x=>x.ret));
  const dif=f.filter(x=>{const b=base.find(y=>y.t===x.t);return Math.abs(b.ret-x.ret)>0.01;}).map(x=>x.t);
  console.log('  +'+String(d).padStart(3)+' %  '+(m>=0?'+':'')+m.toFixed(2).padStart(6)+' %'+String(f.filter(x=>x.cer).length).padStart(10)+String(f.filter(x=>x.ret>0).length).padStart(10)+'   '+(dif.length?dif.join(', '):'—'));
}
console.log('\nCON EL ESCALON EN +15 %: que entradas se mueven y cuanto aportan');
const f15=corre(15);
const cam=f15.filter(x=>{const b=base.find(y=>y.t===x.t);return Math.abs(b.ret-x.ret)>0.01;});
let total=0;
for(const x of cam){const b=base.find(y=>y.t===x.t);const ap=(x.ret-b.ret)/f15.length;total+=ap;
 console.log('  '+x.t.padEnd(6)+b.ret.toFixed(1).padStart(7)+' % -> '+x.ret.toFixed(1).padStart(6)+' %   aporta '+(ap>=0?'+':'')+ap.toFixed(3)+' a la media');}
console.log('  suma: '+(total>=0?'+':'')+total.toFixed(3)+' puntos de media');
