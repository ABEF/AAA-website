import test from 'node:test';
import assert from 'node:assert/strict';
import {ARTWORKS,PALETTES,RARITIES,EVOLUTIONS,findArtwork,artworkForNft,royaltyWeight,traitsForPosition} from '../artworks.js';
import {buildDemoCollection,activatePreview,increasePreview,mintPreview,claimPreview,distributeDailyFees,getMetrics} from '../domain.js';

test('six palettes, three rarities and four evolutions produce 72 independent asset paths',() => {
  assert.equal(PALETTES.length,6); assert.equal(RARITIES.length,3); assert.equal(EVOLUTIONS.length,4);
  assert.equal(ARTWORKS.length,72); assert.equal(new Set(ARTWORKS.map(art => art.src)).size,72);
  assert.equal(new Set(ARTWORKS.map(art => art.metadata)).size,72);
  for (const color of PALETTES) assert.equal(ARTWORKS.filter(art => art.color === color.id).length,12);
  for (const rarity of RARITIES) assert.equal(ARTWORKS.filter(art => art.rarity === rarity.id).length,24);
  for (const state of EVOLUTIONS) assert.equal(ARTWORKS.filter(art => art.evolution === state.id).length,18);
  assert.equal(findArtwork('../../private'),undefined);
});

test('dormant Legendary has zero royalty weight; activated rarities use 1/2/3 independent of LP size',() => {
  assert.equal(royaltyWeight({rarity:'legendary',lockedCents:0}),0);
  for (const [rarity,expected] of [['commun',1],['rare',2],['legendary',3]]) {
    assert.equal(royaltyWeight({rarity,lockedCents:50000}),expected);
    assert.equal(royaltyWeight({rarity,lockedCents:10000000}),expected);
  }
  for (const art of ARTWORKS) assert.equal(art.royaltyWeight,art.evolution === 'dormant' ? 0 : art.royaltyMultiplier);
});

test('activation and permanent LP additions change artwork while preserving NFT rarity and color',() => {
  let collection=buildDemoCollection();
  const start=collection.find(nft => nft.exampleOwned && !nft.lockedCents);
  const prefix=`${start.color}-${start.rarity}-`;
  assert.equal(artworkForNft(start).id,prefix+'dormant');
  collection=activatePreview(collection,{id:start.id,amount:100,pool:'ZZZ/WETH'}).collection;
  assert.equal(artworkForNft(collection.find(nft => nft.id === start.id)).id,prefix+'activated');
  collection=increasePreview(collection,{id:start.id,amount:900}).collection;
  assert.equal(artworkForNft(collection.find(nft => nft.id === start.id)).id,prefix+'enhanced');
  collection=increasePreview(collection,{id:start.id,amount:9000}).collection;
  const final=collection.find(nft => nft.id === start.id);
  assert.equal(artworkForNft(final).id,prefix+'singularity');
  assert.equal(final.rarity,start.rarity);assert.equal(final.color,start.color);
});

test('Singularity artwork starts exactly at $10k LP, with unchanged identity at either boundary',() => {
  const nft={color:'crimson',rarity:'legendary',lockedCents:999999};
  assert.equal(artworkForNft(nft).id,'crimson-legendary-enhanced');
  assert.equal(artworkForNft({...nft,lockedCents:1000000}).id,'crimson-legendary-singularity');
});

test('rarity cannot change LP fee allocation or collection financial metrics',() => {
  const nft={lockedCents:100000};
  const sameLP=['commun','rare','legendary'].map((rarity,id) => ({...nft,id,rarity}));
  assert.deepEqual(distributeDailyFees(sameLP,900).map(nft => nft.fees24hCents),[300,300,300]);
  const original=buildDemoCollection();
  const changed=original.map(nft => ({...nft,rarity:'legendary',color:'amber'}));
  assert.deepEqual(getMetrics(changed),getMetrics(original));
});

test('claiming LP rewards preserves artwork, rarity and color',() => {
  const original=buildDemoCollection(); const before=original.find(nft => nft.id === 444);
  const after=claimPreview(original,[444]).collection.find(nft => nft.id === 444);
  assert.equal(artworkForNft(after).id,artworkForNft(before).id);
  assert.equal(after.rarity,before.rarity);assert.equal(after.color,before.color);
});

test('the 100-position preview covers all 18 immutable palette/rarity pairs and new mints start dormant',() => {
  const original=buildDemoCollection();
  assert.equal(original.length,100);
  assert.deepEqual(original.filter(nft => nft.exampleOwned).map(nft => artworkForNft(nft).evolution).sort(),['dormant','enhanced','enhanced','singularity']);
  assert.equal(new Set(original.map(nft => `${nft.color}-${nft.rarity}`)).size,18);
  const mint=mintPreview(original).nft;
  assert.equal(artworkForNft(mint).evolution,'dormant');assert.equal(royaltyWeight(mint),0);
  assert.equal(mint.color,traitsForPosition(100).color);
  assert.ok(RARITIES.some(rarity => rarity.id === mint.rarity));
});

test('unrecognized trait strings cannot create arbitrary image or metadata paths',() => {
  const artwork=artworkForNft({color:'../../secret',rarity:'<script>',lockedCents:0});
  assert.equal(artwork.id,'cyan-commun-dormant');
  assert.equal(artwork.src,'./assets/nfts/cyan-commun-dormant.png');
});
