/* LAS AFIRMACIONES DEL DOCUMENTO docs/instrucciones-para-otra-app.md, VERIFICADAS CONTRA EL MOTOR.

   Ese documento es la especificacion que se le pasa a otra aplicacion para que genere las mismas
   señales que el panel. integridad.test.js ya comprueba que sus NUMEROS coinciden con reglas.js y
   panel.json; esto comprueba que su DESCRIPCION DEL COMPORTAMIENTO es cierta: que el stop es de
   verdad el mayor de los cuatro candidatos, que los motivos de venta se acumulan en vez de
   encadenarse, que un requisito de solo-entrada roto no vende, que ganMax se mide en cierres y no
   en mechas, y que las fronteras exactas (ganancia del 20 %, devolucion justo en el limite, EMA 50
   justo a -15 %) caen del lado que el documento promete.

   Cada comprobacion se ha visto fallar contra una mutacion antes de darla por buena. */
const fs=require('fs'), g={};
new Function('window', fs.readFileSync('docs/reglas.js','utf8'))(g);
const RG=g.REGLAS, R=RG.R;
let m=0,b=0; const t=(n,c)=>{ c?(m++,console.log('  ✓ '+n)):(b++,console.log('  ✗ '+n)) };

console.log('\n§2 el stop es el mayor de los cuatro candidatos');
// EMA 50 manda
t('EMA 50 por encima del suelo -> manda la EMA 50',
  RG.stopDe({precio:100,ema50:95},100,null,0)===95);
// suelo del 15 %
t('EMA 50 lejos -> manda compra*0,85',
  Math.abs(RG.stopDe({precio:100,ema50:50},100,null,0)-85)<1e-9);
// proteccion del coste a ganMax exactamente 20 (el caso del 19,999...)
t('ganMax = (120/100-1)*100 (19,99999...) activa la protección del coste',
  Math.abs(RG.stopDe({precio:120,ema50:50},100,null,(120/100-1)*100)-100)<1e-9);
t('ganMax 19 NO activa la protección del coste',
  Math.abs(RG.stopDe({precio:119,ema50:50},100,null,19)-85)<1e-9);
// ganMax historico, no la de hoy: llego a +25 y hoy esta a +10
t('llegó a +25 % y hoy a +10 %: el stop sigue en el precio de compra',
  Math.abs(RG.stopDe({precio:110,ema50:50},100,null,25)-100)<1e-9);
// el stop nunca baja
t('el stop nunca baja aunque la EMA 50 retroceda',
  RG.stopDe({precio:100,ema50:60},100,97,0)===97);
// sin compra, se calcula sobre el precio
t('sin precio de compra se calcula sobre el precio actual',
  Math.abs(RG.stopDe({precio:100,ema50:50},null,null,null)-85)<1e-9);

console.log('\n§2.1 validez del stop de entrada');
let e=RG.stopDeEntrada({precio:100,ema50:95});
t('EMA 50 a -5 %: no hay tope', e.tope===false && e.invalido===false);
e=RG.stopDeEntrada({precio:100,ema50:80});
t('EMA 50 a -20 %: tope activo y stop en 85', e.tope===true && Math.abs(e.stop-85)<1e-9);
t('precioSinTope = ema50*1,15', Math.abs(e.precioSinTope-80*1.15)<1e-9);
e=RG.stopDeEntrada({precio:100,ema50:105});
t('precio bajo su EMA 50 -> stop inválido', e.invalido===true);
e=RG.stopDeEntrada({precio:100,ema50:85});
t('EMA 50 justo a -15 %: NO hay tope (frontera)', e.tope===false);

console.log('\n§3.1 límites de devolución');
t('ganMax 150 -> 40 %', RG.limiteDevolucion(150)===40);
t('ganMax exactamente 100 -> 40 %', RG.limiteDevolucion(100)===40);
t('ganMax 99 -> 50 %', RG.limiteDevolucion(99)===50);
t('ganMax exactamente 30 -> 50 %', RG.limiteDevolucion(30)===50);
t('ganMax 29 -> null (manda solo el stop)', RG.limiteDevolucion(29)===null);

console.log('\n§3.3 motivos se ACUMULAN y los avisos se callan si hay motivos');
let ev=RG.evaluaPosicion({datos:{precio:60,ema50:70,ema21:65,rsi:30},compra:100,maxRegistrado:200,
  stopPrevio:0,dias:10,requisitos:[{ok:false,t:'a'},{ok:false,t:'b'}],maxSerie:200});
t('tres motivos a la vez (stop, rsi, devuelto) + requisitos = 4',
  ev.estado==='vender' && ev.motivos.length===4);
t('con motivos no se emite el aviso de ema21',
  !ev.avisos.some(a=>a.codigo==='ema21'));
ev=RG.evaluaPosicion({datos:{precio:100,ema50:90,ema21:105,rsi:60},compra:100,maxRegistrado:100,
  stopPrevio:0,dias:5,requisitos:[{ok:false,t:'a'}],maxSerie:100});
t('un solo requisito roto -> vigilar, no vender', ev.estado==='vigilar' && ev.motivos.length===0);
t('aviso de ema21 cuando el precio la pierde y no hay motivos',
  ev.avisos.some(a=>a.codigo==='ema21'));
// aviso de devolucion al 60 % del limite
// ganMax 50 -> limite 50. Devuelto = (1 - gan/50)*100. Con gan 22 sale 56 >= 50: VENDE.
ev=RG.evaluaPosicion({datos:{precio:122,ema50:50,ema21:50,rsi:60},compra:100,maxRegistrado:150,
  stopPrevio:0,dias:10,requisitos:[],maxSerie:150});
t('devuelto el 56 % con límite 50 -> vende por devolución',
  ev.estado==='vender' && ev.motivos.some(x=>x.codigo==='devuelto'));
// Con gan 25 el devuelto es exactamente 50: la frontera tambien vende (alMenos).
ev=RG.evaluaPosicion({datos:{precio:125,ema50:50,ema21:50,rsi:60},compra:100,maxRegistrado:150,
  stopPrevio:0,dias:10,requisitos:[],maxSerie:150});
t('devuelto exactamente el límite (50 %) -> vende (frontera)',
  ev.estado==='vender' && ev.motivos.some(x=>x.codigo==='devuelto'));
ev=RG.evaluaPosicion({datos:{precio:135,ema50:50,ema21:50,rsi:60},compra:100,maxRegistrado:150,
  stopPrevio:0,dias:10,requisitos:[],maxSerie:150});
// ganMax 50, gan 35, devuelto = (1-35/50)*100 = 30 = 60% de 50 -> aviso exacto
t('devuelto exactamente el 60 % del límite -> aviso, no venta',
  ev.estado==='vigilar' && ev.avisos.some(a=>a.codigo==='devolviendo'));
// requisito de solo entrada roto: aviso, nunca venta
ev=RG.evaluaPosicion({datos:{precio:100,ema50:90,ema21:50,rsi:60},compra:100,maxRegistrado:100,
  stopPrevio:0,dias:5,requisitos:[{ok:false,entrada:true,t:'Capitalización > 300 M',v:'200 M'},
                                  {ok:false,entrada:true,t:'Precio > 2 $',v:'1 $'}],maxSerie:100});
t('dos requisitos de SOLO ENTRADA roto: no es venta', ev.estado!=='vender');
t('y emite el aviso de capitalización', ev.avisos.some(a=>a.codigo==='capitalizacion'));
// aviso de resultados
ev=RG.evaluaPosicion({datos:{precio:100,ema50:90,ema21:50,rsi:60},compra:100,maxRegistrado:100,
  stopPrevio:0,dias:5,requisitos:[],diasResultados:10,maxSerie:100});
t('resultados en 10 días -> aviso', ev.avisos.some(a=>a.codigo==='resultados'));
ev=RG.evaluaPosicion({datos:{precio:100,ema50:90,ema21:50,rsi:60},compra:100,maxRegistrado:100,
  stopPrevio:0,dias:5,requisitos:[],diasResultados:11,maxSerie:100});
t('resultados en 11 días -> sin aviso', !ev.avisos.some(a=>a.codigo==='resultados'));

console.log('\n§3.2 ganMax se mide en cierres; los intradía solo sin serie');
let mx=RG.maximoDesdeCompra({precio:100,max1m:150},100,100,10,120);
t('con serie (120) manda la serie y se ignora max1m (150)', mx===120);
mx=RG.maximoDesdeCompra({precio:100,max1m:150},100,100,10,null);
t('sin serie se usa max1m si dias<=30', mx===150);
mx=RG.maximoDesdeCompra({precio:100,max1m:150},100,100,40,null);
t('sin serie y 40 días: max1m ya no vale', mx===100);
mx=RG.maximoDesdeCompra({precio:100,max3m:180},100,100,40,null);
t('sin serie y 40 días: max3m sí vale', mx===180);
mx=RG.maximoDesdeCompra({precio:100},100,130,10,110);
t('un máximo ya registrado no se olvida', mx===130);

console.log('\n§4 señales de mercado: EMA 50 y EMA 21 excluyentes');
let s=RG.senalesDeMercado({precio:90,ema50:100,ema21:95,rsi:60}).map(x=>x.codigo);
t('pierde las dos -> solo se emite ema50', s.length===1 && s[0]==='ema50');
s=RG.senalesDeMercado({precio:97,ema50:95,ema21:99,rsi:60}).map(x=>x.codigo);
t('pierde solo la 21 -> ema21', s.length===1 && s[0]==='ema21');
s=RG.senalesDeMercado({precio:100,ema50:95,ema21:98,rsi:44}).map(x=>x.codigo);
t('RSI 44 -> señal de rsi', s.includes('rsi'));
s=RG.senalesDeMercado({precio:85,ema50:80,ema21:82,max1m:100,rsi:60}).map(x=>x.codigo);
t('caída del 15 % desde el máximo del mes -> caida-mes (frontera exacta)', s.includes('caida-mes'));
s=RG.senalesDeMercado({precio:86,ema50:80,ema21:82,max1m:100,rsi:60}).map(x=>x.codigo);
t('caída del 14 % -> sin señal', !s.includes('caida-mes'));
t('null no dispara ninguna señal', RG.senalesDeMercado({precio:100}).length===0);

console.log('\n§2.2 el recorrido sale por stop antes que por devolución');
const cierres={ '1':110, '2':130, '3':95 };
let r=RG.recorrido(100,['1','2','3'],f=>cierres[f],()=>null);
// ganMax 30 -> limite 50. stop: ganMax>=20 -> max(0,100)=100. En '3' el precio 95 < 100 -> stop
t('mismo día stop y devolución -> el motivo registrado es stop', r.motivo==='stop');
t('y el retorno es el del cierre de salida', Math.abs(r.ret-(-5))<1e-9);
r=RG.recorrido(100,['1','2'],f=>cierres[f],()=>null);
t('sin saltar, ret = null', r.ret===null);

console.log('\n'+m+' de '+(m+b)+' afirmaciones del documento verificadas contra el código');
if(b) process.exit(1);
