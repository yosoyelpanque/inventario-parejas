(function(root){
  'use strict';
  const source=Object.freeze({fileName:'DESCRPCIONES DE MOBILIARIO (1).xlsx',sheet:'Hoja1'});
  const text=(key,label,required=true)=>({key,label,kind:'text',required});
  const quantity=(key,label,singular,plural,gender='m',defaultValue)=>({key,label,kind:'quantity',required:true,singular,plural,gender,...(defaultValue===undefined?{}:{defaultValue})});
  const measure=(key='medidas',label='Medidas en centímetros',defaultValue)=>({key,label,kind:'measure',required:true,...(defaultValue===undefined?{}:{defaultValue})});
  const color=()=>text('color','Color');
  const drawers=()=>quantity('cajones','Cantidad de cajones','CAJÓN','CAJONES');
  const trays=()=>quantity('gavetas','Cantidad de gavetas','GAVETA','GAVETAS','f');
  const shelves=()=>quantity('entrepanos','Cantidad de entrepaños','ENTREPAÑO','ENTREPAÑOS');
  const doors=()=>quantity('puertas','Cantidad de puertas','PUERTA','PUERTAS','f');
  const normalize=value=>String(value??'').normalize('NFC').trim().replace(/\s+/g,' ').toLocaleUpperCase('es');
  const catalog=[];
  function add(row,label,template,fields,otherRows=[]){
    const preview=template.replace(/\{(\w+)\}/g,(_,key)=>{
      const field=fields.find(item=>item.key===key);
      return '['+field.label.toLocaleLowerCase('es')+']';
    });
    catalog.push(Object.freeze({id:'official-row-'+row,label,preview,sourceRows:Object.freeze([row,...otherRows]),fields:Object.freeze(fields.map(field=>Object.freeze(field))),template}));
  }
  add(2,'LIBRERO DE MADERA','LIBRERO DE MADERA COLOR {color} CON {entrepanos}',[color(),shelves()]);
  add(4,'LIBRERO DE MADERA CON PUERTAS','LIBRERO DE MADERA COLOR {color} CON {entrepanos}, {puertas} {detalles}',[color(),shelves(),doors(),text('detalles','Detalles adicionales',false)]);
  add(6,'CREDENZA DE MADERA','CREDENZA DE MADERA COLOR {color} DE {medidas} CON {cajones} Y {gavetas}',[color(),measure('medidas','Medidas en centímetros','150 × 60'),drawers(),trays()]);
  add(9,'CREDENZA DE MADERA CON LIBRERO COPETE','CREDENZA DE MADERA CON LIBRERO COPETE COLOR {color} CON {entrepanos} Y {puertas}',[color(),shelves(),doors()]);
  add(11,'ARCHIVERO DE MADERA','ARCHIVERO DE MADERA COLOR {color} CON {gavetas}',[color(),trays()]);
  add(13,'ARCHIVERO METÁLICO CON FRENTE DE MADERA','ARCHIVERO METÁLICO CON {gavetas} FRENTE DE MADERA COLOR {color}',[trays(),color()]);
  add(15,'GABINETE METÁLICO CON FRENTE DE MADERA','GABINETE METÁLICO CON {cajones} Y {gavetas} FRENTE DE MADERA COLOR {color}',[drawers(),trays(),color()]);
  add(17,'GABINETE DE MADERA','GABINETE DE MADERA COLOR {color} CON {cajones} Y {gavetas}',[color(),drawers(),trays()]);
  add(19,'GABINETE SUSPENDIDO','GABINETE DE METAL/MADERA SUSPENDIDO COLOR {color} CON PUERTA RETRÁCTIL',[color()]);
  add(21,'GABINETE UNIVERSAL','GABINETE UNIVERSAL DE {material} COLOR {color} CON {puertas}',[text('material','Material'),color(),doors()]);
  add(22,'MÓDULO SECRETARIAL','MÓDULO SECRETARIAL DE MADERA COLOR {color} CON {cubiertas} DE {detalleCubiertas} LATERAL {lateral}, GABINETE PEDESTAL {cajones} Y {gavetas}',[color(),quantity('cubiertas','Cantidad de cubiertas','CUBIERTA','CUBIERTAS','f'),text('detalleCubiertas','Material o detalles de cubiertas'),text('lateral','Detalles del lateral'),drawers(),trays()]);
  add(24,'MÓDULO EN L','MÓDULO EN "L" DE MADERA COLOR {color} CON {detalles}',[color(),text('detalles','Características del módulo')]);
  add(26,'MÓDULO EJECUTIVO','MÓDULO EJECUTIVO DE MADERA COLOR {color} CON GABINETE PEDESTAL {cajones} Y {gavetas}',[color(),drawers(),trays()]);
  add(28,'CUBIERTA PARA MÓDULO','CUBIERTA PARA MÓDULO DE MADERA TIPO {tipo} COLOR {color} DE {medidas} CON {detalles}',[text('tipo','Tipo de cubierta'),color(),measure(),text('detalles','Características de la cubierta')]);
  add(30,'MÓDULO DE RECEPCIÓN','MÓDULO RECEPCIÓN DE MADERA COLOR {color}',[color()]);
  add(32,'MESA DE MADERA PARA COMPUTADORA','MESA DE MADERA PARA COMPUTADORA COLOR {color} CON {entrepanos}',[color(),shelves()]);
  add(34,'MESA PARA COMPUTADORA HIGH TECH','MESA PARA COMPUTADORA HIGH TECH ESTRUCTURA TUBULAR COLOR {color} CON {entrepanos}',[color(),shelves()]);
  add(36,'MESA DE CENTRO DE MADERA','MESA CENTRO DE MADERA COLOR {color} DE {medidas}',[color(),measure()]);
  add(38,'MESA ESQUINERA DE MADERA','MESA ESQUINERA DE MADERA COLOR {color} DE {medidas}',[color(),measure()]);
  add(40,'MESA DE JUNTAS DE MADERA','MESA DE JUNTAS DE MADERA COLOR {color} DE {medidas}, PARA {personas}',[color(),measure(),quantity('personas','Cantidad de personas','PERSONA','PERSONAS','f')]);
  add(42,'MESA MULTIUSOS DE MADERA','MESA MULTIUSOS DE MADERA COLOR {color} DE {medidas}',[color(),measure()]);
  add(44,'MESA DE TRABAJO DE MADERA','MESA DE TRABAJO DE MADERA COLOR {color} DE {medidas}',[color(),measure()]);
  add(46,'MESA DE MADERA TIPO ANALISTA','MESA DE MADERA TIPO ANALISTA COLOR {color} DE {medidas}',[color(),measure()]);
  add(48,'MESA DE TRABAJO EN ACERO INOXIDABLE','MESA DE TRABAJO EN ACERO INOXIDABLE DE {medidas} CON {detalles}',[measure(),text('detalles','Características de la mesa')]);
  add(50,'SILLA SECRETARIAL CON RESPALDO DE MALLA','SILLA SECRETARIAL RESPALDO MALLA TAPIZADA EN TELA {color}',[color()]);
  add(52,'BANCO TIPO CAJERO/PERIQUERA','BANCO {material} TIPO CAJERO/PERIQUERA TAPIZADA EN TELA {color}',[text('material','Material del banco'),color()]);
  add(54,'SILLA SECRETARIAL','SILLA SECRETARIAL TAPIZADA EN TELA COLOR {color}',[color()]);
  add(56,'SILLA TUBULAR','SILLA TUBULAR TAPIZADA EN TELA COLOR {color}',[color()]);
  add(58,'SILLA TUBULAR TIPO TRINEO','SILLA TUBULAR TIPO TRINEO TAPIZADA EN TELA COLOR {color}',[color()]);
  add(60,'SILLA TUBULAR DE PLÁSTICO','SILLA TUBULAR DE PLÁSTICO PARA EXTERIOR COLOR {color}',[color()]);
  add(62,'SILLA FIJA DE MADERA','SILLA FIJA DE MADERA TAPIZADA EN TELA COLOR {color}',[color()]);
  add(64,'SILLÓN EJECUTIVO CON CABECERA','SILLÓN EJECUTIVO RESPALDO MALLA CON CABECERA TAPIZADO EN TELA COLOR {color}',[color()]);
  add(66,'SILLÓN SEMIEJECUTIVO','SILLÓN SEMIEJECUTIVO RESPALDO MEDIO TAPIZADO EN TELA COLOR {color}',[color()]);
  add(68,'SILLÓN EJECUTIVO CON RESPALDO ALTO','SILLÓN EJECUTIVO RESPALDO ALTO TAPIZADO EN {material} COLOR {color}',[text('material','Material del tapizado'),color()]);
  add(70,'SILLÓN EJECUTIVO FIJO TIPO TRINEO','SILLÓN EJECUTIVO FIJO TIPO TRINEO TAPIZADO EN TELA COLOR {color}',[color()]);
  add(72,'SILLÓN EJECUTIVO FIJO DE MADERA','SILLÓN EJECUTIVO FIJO DE MADERA TAPIZADO EN TELA COLOR {color}',[color()]);
  for(const [row,count,name] of [[74,'1','UNA PLAZA'],[75,'2','DOS PLAZAS'],[76,'3','TRES PLAZAS']])add(row,'SOFÁ '+name,'SOFÁ {plazas} TAPIZADO EN TELA {color}',[quantity('plazas','Cantidad de plazas','PLAZA','PLAZAS','f',count),color()]);
  add(77,'ESCRITORIO EJECUTIVO DE MADERA','ESCRITORIO EJECUTIVO DE MADERA COLOR {color} DE {medidas} CON {cajones} Y {gavetas}',[color(),measure('medidas','Medidas en centímetros','180 × 90'),drawers(),trays()]);
  add(79,'ESCRITORIO EJECUTIVO DE MADERA TLM','ESCRITORIO EJECUTIVO DE MADERA TLM COLOR {color} DE {medidas} CON {cajones} Y {gavetas}',[color(),measure('medidas','Medidas en centímetros','180 × 90'),drawers(),trays()]);
  // Las filas 81, 83 y 85 mezclan «1.50*90»: no se presume la unidad de cada eje.
  add(81,'ESCRITORIO SECRETARIAL DE MADERA TLM','ESCRITORIO SECRETARIAL DE MADERA TLM COLOR {color} DE {medidas} CON {cajones} Y {gavetas}',[color(),measure(),drawers(),trays()]);
  add(83,'ESCRITORIO SECRETARIAL CON ESTRUCTURA METÁLICA','ESCRITORIO SECRETARIAL DE MADERA COLOR {color} DE {medidas} CON {cajones} Y {gavetas} CON ESTRUCTURA METÁLICA',[color(),measure(),drawers(),trays()],[85]);
  add(87,'ANAQUEL METÁLICO','ANAQUEL METÁLICO COLOR {color} CON {charolas} DE {material} DE {medidas}',[color(),quantity('charolas','Cantidad de charolas','CHAROLA','CHAROLAS','f'),text('material','Material de las charolas'),measure()]);
  add(89,'LOKER METÁLICO','LOKER METÁLICO COLOR {color} CON {puertas}',[color(),doors()]);
  add(90,'LOKER DE MADERA','LOKER DE MADERA COLOR {color} CON {puertas}',[color(),doors()]);
  add(91,'PUPITRE DE MADERA','PUPITRE DE MADERA COLOR {color}',[color()]);
  add(92,'DIABLO DE CARGA METÁLICO','DIABLO DE CARGA METÁLICO COLOR {color}',[color()]);
  add(93,'DIABLO DE CARGA CONVERTIBLE DE ALUMINIO','DIABLO DE CARGA CONVERTIBLE DE ALUMINIO COLOR {color}',[color()]);
  Object.freeze(catalog);

  function quantityToWords(value,gender='m'){
    const digits=String(value??'').trim();
    if(!/^\d{1,3}$/.test(digits))throw new Error('Escribe una cantidad entera de 0 a 999.');
    const number=Number(digits),female=gender==='f';
    const small=['CERO',female?'UNA':'UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE','VEINTE',female?'VEINTIUNA':'VEINTIÚN','VEINTIDÓS','VEINTITRÉS','VEINTICUATRO','VEINTICINCO','VEINTISÉIS','VEINTISIETE','VEINTIOCHO','VEINTINUEVE'];
    const tens=['','','','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
    const hundreds=female?['','CIENTO','DOSCIENTAS','TRESCIENTAS','CUATROCIENTAS','QUINIENTAS','SEISCIENTAS','SETECIENTAS','OCHOCIENTAS','NOVECIENTAS']:['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
    if(number<30)return small[number];
    if(number<100)return tens[Math.floor(number/10)]+(number%10?' Y '+small[number%10]:'');
    if(number===100)return 'CIEN';
    return hundreds[Math.floor(number/100)]+(number%100?' '+quantityToWords(number%100,gender):'');
  }
  function formatMeasure(value){
    const input=String(value??'').trim().replace(/\s*cm\s*$/i,'').trim();
    const components=input.split(/\s*[x×*]\s*/i);
    if(components.length<1||components.length>3||components.some(part=>! /^(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(part)))throw new Error('Escribe de una a tres medidas en centímetros, por ejemplo: 150 × 60.');
    const values=components.map(part=>Number(part.replace(',','.')));
    if(values.some(part=>!Number.isFinite(part)||part<=0||part>1000000))throw new Error('Cada medida debe ser mayor que cero y estar expresada en centímetros.');
    return values.join(' × ')+' CM';
  }
  function render(id,values={}){
    const entry=catalog.find(item=>item.id===id);
    if(!entry)throw new Error('No se encontró esa descripción oficial.');
    if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Completa los datos de la descripción.');
    const result={};
    for(const field of entry.fields){
      const raw=Object.prototype.hasOwnProperty.call(values,field.key)?values[field.key]:field.defaultValue;
      if(raw===undefined||raw===null||String(raw).trim()===''){
        if(field.required)throw new Error('Completa el campo «'+field.label+'».');
        result[field.key]='';continue;
      }
      try{
        if(field.kind==='quantity')result[field.key]=quantityToWords(raw,field.gender)+' '+(Number(raw)===1?field.singular:field.plural);
        else if(field.kind==='measure')result[field.key]=formatMeasure(raw);
        else{
          if(typeof raw!=='string'||raw.length>500)throw new Error('Escribe un texto de hasta 500 caracteres.');
          const clean=normalize(raw);
          if(/\bX{2,}\b|[{}\[\]]/.test(clean))throw new Error('Sustituye los marcadores por los datos reales del bien.');
          result[field.key]=clean;
        }
      }catch(error){throw new Error(field.label+': '+error.message);}
    }
    return entry.template.replace(/\{(\w+)\}/g,(_,key)=>result[key]).trim().replace(/\s+/g,' ');
  }
  const api=Object.freeze({catalog,source,render,quantityToWords,formatMeasure});
  root.InventoryOfficialDescriptions=api;
  if(typeof module!=='undefined')module.exports=api;
})(globalThis);
