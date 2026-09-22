const {test}=require('node:test'),assert=require('node:assert/strict');
const {area}=require('../src/asset-status.js');
test('alerta compara área del bien ubicado con resguardante y normaliza números',()=>{
 assert.equal(area({UBICADO:'SI',areaOriginal:'01'},{area:1}).mismatch,false);
 assert.equal(area({UBICADO:'SI',areaOriginal:'1'},{area:'2'}).mismatch,true);
 assert.equal(area({UBICADO:'NO',areaOriginal:'1'},{area:'2'}).mismatch,false);
 assert.equal(area({UBICADO:'SI',areaOriginal:'1',areaIncorrecta:true},null).mismatch,false);
 assert.equal(area({UBICADO:'SI',areaOriginal:'Sin Área'},{area:'2'}).mismatch,false);
});
