const test=require('node:test'),assert=require('node:assert/strict'),P=require('../src/progress.js');
test('calcula avance por área con ubicados, pendientes y áreas vacías',()=>{
 const result=P.areas({areaNames:{'0604500':'Centro','0700000':'Archivo'},loadedListings:[{areaId:'0800000'}],inventory:[
  {areaOriginal:'0604500',UBICADO:'SI'},{areaOriginal:'0604500',UBICADO:'NO'},{areaOriginal:'0604500',UBICADO:'SI'},{areaOriginal:'0700000',UBICADO:'NO'}
 ]});
 assert.deepEqual(result,[
  {id:'0604500',name:'Centro',located:2,total:3,pending:1,percent:67},
  {id:'0700000',name:'Archivo',located:0,total:1,pending:1,percent:0},
  {id:'0800000',name:'',located:0,total:0,pending:0,percent:0}
 ]);
});
test('normaliza áreas y devuelve lista vacía sin datos',()=>{
 assert.deepEqual(P.areas({}),[]);
 assert.equal(P.areas({inventory:[{areaOriginal:' 9 ',UBICADO:'SI'}]})[0].id,'9');
});

test('nombres históricos y resguardantes no reaparecen como áreas cargadas en el avance',()=>{
 assert.deepEqual(P.areas({inventory:[],loadedListings:[],areas:['0604500'],areaNames:{'0604500':'Centro'},resguardantes:[{area:'0604500'}],additionalItems:[{usuario:'ANA'}]}),[]);
 const rows=P.areas({inventory:[],loadedListings:[{areaId:' 0604500 ',bookType:'C'}],areaNames:{'0604500':'Centro','0700000':'Histórica'}});
 assert.deepEqual(rows,[{id:'0604500',name:'Centro',located:0,total:0,pending:0,percent:0}]);
});

test('avance se recalcula al quitar un libro y desaparece al quitar el último del área',()=>{
 const L=require('../src/listings.js');
 const input={areaNames:{'0604500':'Centro','0700000':'Archivo'},inventory:[
  {areaOriginal:'0604500',listadoOriginal:'Cámara',UBICADO:'SI'},
  {areaOriginal:'0604500',listadoOriginal:'BM',UBICADO:'NO'},
  {areaOriginal:'0700000',listadoOriginal:'Cámara',UBICADO:'SI'}
 ],loadedListings:[{areaId:'0604500',bookType:'Cámara'},{areaId:'0604500',bookType:'BM'},{areaId:'0700000',bookType:'Cámara'}]};
 assert.equal(P.areas(input)[0].percent,50);
 const first=L.remove(input,'0604500','camara');
 assert.deepEqual(P.areas(first)[0],{id:'0604500',name:'Centro',located:0,total:1,pending:1,percent:0});
 const second=JSON.parse(JSON.stringify(L.remove(first,'0604500','BM')));
 assert.deepEqual(P.areas(second),[{id:'0700000',name:'Archivo',located:1,total:1,pending:0,percent:100}]);
 assert.equal(second.areaNames['0604500'],'Centro');
 assert.deepEqual(P.areas(L.remove(second,'0700000','Cámara')),[]);
});

