const test=require('node:test'),assert=require('node:assert/strict');
const official=require('../src/official-descriptions.js');
const demo=entry=>Object.fromEntries(entry.fields.map(field=>[field.key,field.defaultValue??(field.kind==='quantity'?'2':field.kind==='measure'?'150 x 60':'NEGRO')]));
test('el catálogo cubre las 50 filas fuente sin repetir la misma plantilla',()=>{
  assert.equal(official.catalog.length,49);
  assert.equal(new Set(official.catalog.map(item=>item.id)).size,49);
  assert.equal(official.catalog.flatMap(item=>item.sourceRows).length,50);
  assert.deepEqual(official.catalog.find(item=>item.id==='official-row-83').sourceRows,[83,85]);
  assert.equal(official.source.sheet,'Hoja1');
  assert.equal(official.source.fileName,'DESCRPCIONES DE MOBILIARIO (1).xlsx');
  assert.equal(official.catalog.find(item=>item.id==='official-row-76').label,'SOFÁ TRES PLAZAS');
});
test('todas las plantillas producen descripciones completas sin marcadores ni cantidades en cifras',()=>{
  for(const entry of official.catalog){
    const input=demo(entry),before=structuredClone(input),rendered=official.render(entry.id,input);
    assert.ok(rendered.length>10,entry.id);
    assert.equal(rendered,rendered.toLocaleUpperCase('es'));
    assert.doesNotMatch(rendered,/\bXX+\b|[{}\[\]]/,entry.id);
    assert.doesNotMatch(rendered,/\d\s+(CAJONES?|GAVETAS?|ENTREPAÑOS?|PUERTAS?|CHAROLAS?|PERSONAS?|PLAZAS?|CUBIERTAS?)\b/,entry.id);
    assert.deepEqual(input,before,entry.id+' no debe modificar los datos de entrada');
  }
});
test('cantidades usan letras, singular, apócope y género correctos',()=>{
  const values={color:'café',medidas:'150x60',cajones:'1',gavetas:'1'};
  assert.equal(official.render('official-row-6',values),'CREDENZA DE MADERA COLOR CAFÉ DE 150 × 60 CM CON UN CAJÓN Y UNA GAVETA');
  assert.match(official.render('official-row-6',{...values,cajones:21,gavetas:21}),/VEINTIÚN CAJONES Y VEINTIUNA GAVETAS$/);
  assert.match(official.render('official-row-6',{...values,cajones:0,gavetas:231}),/CERO CAJONES Y DOSCIENTAS TREINTA Y UNA GAVETAS$/);
  for(const [value,expected] of [[16,'DIECISÉIS'],[22,'VEINTIDÓS'],[26,'VEINTISÉIS'],[31,'TREINTA Y UN'],[100,'CIEN'],[101,'CIENTO UN'],[500,'QUINIENTOS'],[700,'SETECIENTOS'],[999,'NOVECIENTOS NOVENTA Y NUEVE']])assert.equal(official.quantityToWords(value),expected);
  assert.equal(official.quantityToWords(501,'f'),'QUINIENTAS UNA');
});
test('medidas conservan números y siempre interpretan los datos ingresados como centímetros',()=>{
  assert.equal(official.formatMeasure('150 x 60'),'150 × 60 CM');
  assert.equal(official.formatMeasure('150,5 * 60,25 × 75 cm'),'150.5 × 60.25 × 75 CM');
  assert.equal(official.formatMeasure('1.50x.60'),'1.5 × 0.6 CM');
  assert.equal(official.formatMeasure('.5'),'0.5 CM');
  assert.equal(official.formatMeasure('150'),'150 CM');
});
test('solo los ejemplos con metros inequívocos tienen su valor predeterminado convertido',()=>{
  for(const [id,expected] of [['official-row-6','150 × 60 CM'],['official-row-77','180 × 90 CM'],['official-row-79','180 × 90 CM']]){
    const entry=official.catalog.find(item=>item.id===id),input=demo(entry);delete input.medidas;
    assert.ok(official.render(id,input).includes(expected));
  }
  for(const id of ['official-row-81','official-row-83']){
    const entry=official.catalog.find(item=>item.id===id),input=demo(entry);delete input.medidas;
    assert.equal(entry.fields.find(item=>item.key==='medidas').defaultValue,undefined);
    assert.throws(()=>official.render(id,input),/Medidas en centímetros/);
  }
});
test('cada campo obligatorio valida ausencias y cada tipo rechaza valores inválidos',()=>{
  for(const entry of official.catalog)for(const field of entry.fields.filter(item=>item.required)){
    const input=demo(entry);input[field.key]='';assert.throws(()=>official.render(entry.id,input),/Completa el campo/,entry.id+' '+field.key);
  }
  for(const invalid of ['-1','1.5','1,5','1000','2e2','uno',Infinity,NaN])assert.throws(()=>official.quantityToWords(invalid),/cantidad entera/);
  for(const invalid of ['','0','-5','1e2','150 m','150xx60','150x60x70x80','1,000.5','Infinity','1000001'])assert.throws(()=>official.formatMeasure(invalid),/medida/);
  assert.throws(()=>official.render('missing',{}),/No se encontró/);
  assert.throws(()=>official.render('official-row-2',{color:'XXXX',entrepanos:2}),/marcadores/);
  assert.throws(()=>official.render('official-row-2',{color:25,entrepanos:2}),/texto/);
});
test('detalles opcionales vacíos no dejan marcadores y no se mutan el catálogo ni valores extra',()=>{
  const input={color:'rojo',entrepanos:'1',puertas:'2',unrelated:{value:true}},before=structuredClone(input);
  assert.equal(official.render('official-row-4',input),'LIBRERO DE MADERA COLOR ROJO CON UN ENTREPAÑO, DOS PUERTAS');
  assert.deepEqual(input,before);
  assert.ok(Object.isFrozen(official.catalog));assert.ok(Object.isFrozen(official.catalog[0].fields[0]));
});
