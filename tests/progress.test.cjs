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

