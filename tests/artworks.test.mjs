import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ARTWORKS,PALETTES,COLORWAYS,PATTERNS,COLOR_STYLES,RARITIES,EVOLUTIONS,findArtwork,artworkForNft,royaltyWeight} from '../artworks.js';
import {buildInventory,isAllowedBicolor,isAllowedTricolor} from '../palette-system.js';
import {buildDemoCollection,activatePreview,increasePreview,mintPreview,claimPreview,distributeDailyFees,getMetrics} from '../domain.js';

test('public page omits repository links and source prompts',async () => {
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/github/i);
  assert.doesNotMatch(app,/github/i);
  assert.doesNotMatch(html,/View\s+source|Read\s+(?:the\s+protocol\s+)?source/i);
  assert.match(html,/<span class="demo-banner-copy"><strong>PROOF OF PERMANENT LIQUIDITY<\/strong> <span>\(Minting and claims are simulated; no real assets move\)<\/span><\/span><span class="demo-label">DEVELOPMENT PREVIEW<\/span>/);
  assert.match(html,/href="https:\/\/zzz\.protocol\.link\/"/);
  assert.match(html,/<button\b[^>]*id="footer-x-link"[^>]*aria-label="X"/);
  assert.match(html,/<button\b[^>]*id="footer-telegram-link"[^>]*aria-label="Telegram"/);
  const footer=html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)?.[1];
  assert.ok(footer);
  assert.deepEqual([...footer.matchAll(/\bhref="([^"]+)"/g)].map(match => match[1]).sort(),['#overview','https://zzz.protocol.link/']);
});

test('eight colors and 58 allowed colorways produce 2,784 independent pattern/rarity/evolution paths',() => {
  assert.equal(PALETTES.length,8); assert.equal(COLORWAYS.length,58); assert.equal(PATTERNS.length,4);
  assert.deepEqual(PATTERNS.map(pattern => [pattern.id,pattern.label]),[['arcs','Flowing arcs'],['panels','Segmented panels'],['orbits','Orbital rings'],['ribs','Vertical ribs']]);
  assert.equal(RARITIES.length,3); assert.equal(EVOLUTIONS.length,4);
  assert.equal(ARTWORKS.length,2784); assert.equal(new Set(ARTWORKS.map(art => art.src)).size,2784);
  assert.equal(new Set(ARTWORKS.map(art => art.metadata)).size,2784);
  for (const palette of COLORWAYS) assert.equal(ARTWORKS.filter(art => art.paletteId === palette.id).length,48);
  for (const rarity of RARITIES) assert.equal(ARTWORKS.filter(art => art.rarity === rarity.id).length,928);
  for (const state of EVOLUTIONS) assert.equal(ARTWORKS.filter(art => art.evolution === state.id).length,696);
  assert.equal(findArtwork('../../private'),undefined);
});

test('bicolor and tricolor sets enforce the accepted anchors with distinct colors and no order duplicates',() => {
  assert.deepEqual(COLOR_STYLES.map(style => [style.id,COLORWAYS.filter(palette => palette.colorStyle === style.id).length]),[['monochrome',8],['bicolor',22],['tricolor',28]]);
  for (const palette of COLORWAYS) {
    assert.equal(new Set(palette.colorIds).size,palette.colorIds.length);
    if (palette.colorStyle === 'bicolor') assert.ok(isAllowedBicolor(palette.colorIds));
    if (palette.colorStyle === 'tricolor') assert.ok(isAllowedTricolor(palette.colorIds));
  }
  assert.ok(COLORWAYS.some(palette => palette.id === 'cyan-ivory'));
  assert.ok(COLORWAYS.some(palette => palette.id === 'cyan-amber-ivory'));
  assert.equal(COLORWAYS.some(palette => palette.id === 'cyan-blue'),false);
  assert.equal(COLORWAYS.some(palette => palette.id === 'cyan-blue-crimson'),false);
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
  const prefix=`${start.paletteId}-${start.pattern}-${start.rarity}-`;
  assert.equal(artworkForNft(start).id,prefix+'dormant');
  collection=activatePreview(collection,{id:start.id,amount:100,pool:'ZZZ/WETH'}).collection;
  assert.equal(artworkForNft(collection.find(nft => nft.id === start.id)).id,prefix+'activated');
  collection=increasePreview(collection,{id:start.id,amount:900}).collection;
  assert.equal(artworkForNft(collection.find(nft => nft.id === start.id)).id,prefix+'enhanced');
  collection=increasePreview(collection,{id:start.id,amount:9000}).collection;
  const final=collection.find(nft => nft.id === start.id);
  assert.equal(artworkForNft(final).id,prefix+'singularity');
  for (const trait of ['inventoryId','rarity','color','paletteId','colorStyle','pattern']) assert.equal(final[trait],start[trait]);
  assert.deepEqual(final.colors,start.colors);
});

test('Singularity artwork starts exactly at $10k LP, with unchanged identity at either boundary',() => {
  const nft={color:'crimson',rarity:'legendary',lockedCents:999999};
  assert.equal(artworkForNft(nft).id,'crimson-arcs-legendary-enhanced');
  assert.equal(artworkForNft({...nft,lockedCents:1000000}).id,'crimson-arcs-legendary-singularity');
});

test('rarity cannot change LP fee allocation or collection financial metrics',() => {
  const nft={lockedCents:100000};
  const sameLP=['commun','rare','legendary'].map((rarity,id) => ({...nft,id,rarity}));
  assert.deepEqual(distributeDailyFees(sameLP,900).map(nft => nft.fees24hCents),[300,300,300]);
  const original=buildDemoCollection();
  const changed=original.map(nft => ({...nft,rarity:'legendary',color:'amber',paletteId:'amber-crimson-onyx',colors:['amber','crimson','onyx'],colorStyle:'tricolor',pattern:'ribs'}));
  assert.deepEqual(getMetrics(changed),getMetrics(original));
});

test('claiming LP rewards preserves artwork, rarity and color',() => {
  const original=buildDemoCollection(); const before=original.find(nft => nft.id === 444);
  const after=claimPreview(original,[444]).collection.find(nft => nft.id === 444);
  assert.equal(artworkForNft(after).id,artworkForNft(before).id);
  for (const trait of ['inventoryId','rarity','color','paletteId','colorStyle','pattern']) assert.equal(after[trait],before[trait]);
  assert.deepEqual(after.colors,before.colors);
});

test('the 100-position preview consumes fixed inventory slots across all color styles and new mints start dormant',() => {
  const original=buildDemoCollection();
  assert.equal(original.length,100);
  assert.deepEqual(original.filter(nft => nft.exampleOwned).map(nft => artworkForNft(nft).evolution).sort(),['dormant','enhanced','enhanced','singularity']);
  assert.equal(new Set(original.map(nft => nft.inventoryId)).size,100);
  assert.deepEqual(COLOR_STYLES.map(style => original.filter(nft => nft.colorStyle === style.id).length),[20,50,30]);
  const mint=mintPreview(original).nft;
  assert.equal(artworkForNft(mint).evolution,'dormant');assert.equal(royaltyWeight(mint),0);
  assert.ok(!original.some(nft => nft.inventoryId === mint.inventoryId));
  const entry=buildInventory().find(entry => entry.tokenId === mint.inventoryId);
  assert.equal(mint.paletteId,entry.paletteId); assert.equal(mint.pattern,entry.pattern);
  assert.deepEqual(mint.colors,entry.colorIds);
  assert.ok(RARITIES.some(rarity => rarity.id === mint.rarity));
});

test('unrecognized trait strings cannot create arbitrary image or metadata paths',() => {
  const artwork=artworkForNft({color:'../../secret',rarity:'<script>',lockedCents:0});
  assert.equal(artwork.id,'cyan-arcs-commun-dormant');
  assert.equal(artwork.src,'./assets/nfts/cyan-arcs-commun-dormant.svg');
});

test('all 1,000 preview mints consume the finite inventory once and preserve duplication limits',() => {
  let collection=buildDemoCollection();
  for (let index=collection.length;index<1000;index++) collection=mintPreview(collection).collection;
  assert.equal(new Set(collection.map(nft => nft.inventoryId)).size,1000);
  assert.deepEqual(COLOR_STYLES.map(style => collection.filter(nft => nft.colorStyle === style.id).length),[200,500,300]);
  const copies=new Map();
  for (const nft of collection) {
    const key=`${nft.paletteId}-${nft.pattern}-${nft.rarity}`;
    copies.set(key,(copies.get(key)||0)+1);
  }
  assert.ok(Math.max(...copies.values())<=4);
  for (const nft of collection.filter(nft => nft.rarity === 'legendary')) assert.equal(copies.get(`${nft.paletteId}-${nft.pattern}-${nft.rarity}`),1);
  assert.equal(getMetrics(collection).liquidity,42500000);
});
