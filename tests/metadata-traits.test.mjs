import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {ARTWORKS} from '../artworks.js';
import {metadataAttributes} from '../palette-system.js';
const root=new URL('../',import.meta.url);
const json=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
test('fixed royalty trait is 1/2/3 in all 2784 artwork references, including dormant',async()=>{
  assert.equal(ARTWORKS.length,2784);
  let dormant=0;
  for(const art of ARTWORKS){
    const data=await json(art.metadata);
    const weights=data.attributes.filter(x=>x.trait_type==='Royalty Weight');
    assert.equal(weights.length,1);assert.equal(weights[0].value,art.royaltyMultiplier,art.id);
    assert.equal(data.image,`../${art.id}.svg`);assert.equal(data.properties.example,true);
    assert.equal(data.properties.activation_required,true);
    assert.match(data.description,/sharing starts only after activation/);
    if(art.evolution==='dormant'){dormant++;assert.equal(art.royaltyWeight,0);}
  }
  assert.equal(dormant,696);
});
test('future generator metadata agrees with every stored reference without rendering',async()=>{
  const source=await readFile(new URL('generate-artworks.mjs',root),'utf8');
  const body=source.split('  const metadata=')[1]?.split(';\n  await writeFile')[0];
  assert.ok(body);
  const hue={cyan:0,blue:1,violet:1,emerald:1,amber:1,crimson:1};
  for(const art of ARTWORKS){
    const traits={paletteId:art.paletteId,colorIds:art.colors,colorStyle:art.colorStyle,pattern:art.pattern,rarity:art.rarity};
    const actual=JSON.parse(JSON.stringify(vm.runInNewContext(`(${body})`,{art,traits,metadataAttributes,hue})));
    assert.deepEqual(actual,await json(art.metadata),art.id);
  }
});
test('preview distinguishes fixed trait from dormant eligibility',async()=>{
  const source=await readFile(new URL('app.js',root),'utf8');
  assert.ok(!source.includes('Dormant: zero royalty weight'));
  assert.ok(source.includes('Royalty weight ×${art.royaltyMultiplier}.'));
  assert.ok(source.includes('Sharing starts only after activation.'));
});
