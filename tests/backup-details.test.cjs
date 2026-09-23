const {test}=require('node:test'),assert=require('node:assert/strict');
const {filename,images}=require('../src/backup-details.js');
test('nombre de respaldo usa primera área cargada, ceros iniciales y fecha local',()=>{
 const date=new Date(2026,8,23,23,55);assert.equal(filename({loadedListings:[{areaId:'0604500'},{areaId:'1'}],inventory:[{areaOriginal:'1'}]},date),'0604500_2026-09-23.zip');
 assert.equal(filename({inventory:[{areaOriginal:'131100'}]},date),'131100_2026-09-23.zip');assert.equal(filename({},date),'Sin-area_2026-09-23.zip');
});
test('conteo distingue copias por bien, planos y archivos vacíos sin alterar datos',async()=>{
 const entries=[{store:'photos',key:'inventory-1',value:new Blob(['photo'])},{store:'photos',key:'inventory-2',value:new Blob(['photo'])},{store:'photos',key:'user-a',value:new Blob([])},{store:'layoutImages',key:'plan',value:new Blob(['plan'])}];
 const r=await images(entries);assert.equal(r.total,4);assert.equal(r.unique,2);assert.equal(r.duplicates,1);assert.equal(r.empty,1);assert.equal(r.types['Fotos de bienes'],2);assert.equal(r.types.Planos,1);assert.equal(entries.length,4);
});
