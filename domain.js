import {EVOLUTIONS,getEvolution} from './artworks.js';
import {buildInventory,COLOR_STYLES,RARITIES} from './palette-system.js';
export const MIN_ACTIVATION_USD = 100;
export const MIN_TOPUP_USD = 5;
export const MAX_SUPPLY = 1000;
export const RARITY_LIMITS = Object.freeze({commun:600,rare:300,legendary:100});
export const FUNDING_ASSETS = ['USDC','ZZZ','ETH','USDG'];
export const POOLS = ['ZZZ/WETH', 'ZZZ/USDC'];
export const LEVELS = EVOLUTIONS.map(level => level.label);
export const DEMO_ADDRESS = '0x4440000000000000000000000000000000000444';
export const STORAGE_KEY = 'zzz-popl-preview-v7';
export const COLLECTION_AGE_WEEKS = 10;
export const COLLECTION_AGE_DAYS = COLLECTION_AGE_WEEKS * 7;
export const BASE_PROTOCOL_LIQUIDITY_USD = 425000;
export const BASE_POOL_LIQUIDITY_USD = 1250000;
export const DEFAULT_VOLUME_USD = 848000;
export const DEFAULT_FEE_PERCENT = 0.3;
export const cents = value => Math.round(value * 100);
export const dollars = value => value / 100;

export function getLevel(lockedCents) { return getEvolution(lockedCents).label; }

export function getMintSupply(collection) {
  const counts = Object.fromEntries(Object.keys(RARITY_LIMITS).map(rarity => [rarity,0]));
  for (const nft of collection) if (Object.hasOwn(counts,nft.rarity)) counts[nft.rarity]++;
  return {minted:collection.length,cap:MAX_SUPPLY,remaining:Math.max(0,MAX_SUPPLY-collection.length),
    rarities:Object.fromEntries(Object.entries(RARITY_LIMITS).map(([rarity,limit]) => [rarity,{minted:counts[rarity],limit,remaining:limit-counts[rarity]}]))};
}

function drawPreviewRarity(remaining,seed) {
  const total = Object.values(remaining).reduce((sum,value) => sum+value,0);
  if (total <= 0 || Object.values(remaining).some(value => value < 0)) throw new Error('No valid example rarity allocation remains. Reset the demo.');
  let choice = seed % total;
  for (const [rarity,count] of Object.entries(remaining)) { if (choice < count) return rarity; choice -= count; }
}

const ART_INVENTORY = buildInventory();
const inventoryTraits = entry => ({inventoryId:entry.tokenId,rarity:entry.rarity,
  color:entry.colorIds[0],colors:[...entry.colorIds],colorIds:[...entry.colorIds],
  paletteId:entry.paletteId,colorStyle:entry.colorStyle,pattern:entry.pattern});

function seedArtworkEntries(ids) {
  // These are fixed inventory slots, not freely rerolled color/rarity combinations.
  const available = [...ART_INVENTORY], assigned = Array(ids.length).fill(null);
  const remaining = Object.fromEntries(COLOR_STYLES.flatMap(style => RARITIES.map(rarity =>
    [`${style.id}:${rarity.id}`,style.supply*rarity.supply/10000])));
  const fixed = new Map([[444,['cyan','commun','arcs']],[128,['blue','rare']],
    [91,['emerald','legendary']],[74,['violet','legendary']]]);
  const take = (index,entry) => {
    assigned[index] = inventoryTraits(entry);
    available.splice(available.indexOf(entry),1);
    remaining[`${entry.colorStyle}:${entry.rarity}`]--;
  };
  ids.forEach((id,index) => {
    if (!fixed.has(id)) return;
    const [paletteId,rarity,pattern] = fixed.get(id);
    take(index,available.find(entry => entry.paletteId === paletteId && entry.rarity === rarity && (!pattern || entry.pattern === pattern)));
  });
  let seed = 0x504f504c;
  for (let index=0;index<assigned.length;index++) if (!assigned[index]) {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
    let choice = seed % Object.values(remaining).reduce((sum,count) => sum+count,0);
    let selected;
    for (const [key,count] of Object.entries(remaining)) {
      if (choice < count) { selected = key; break; }
      choice -= count;
    }
    const candidates = available.filter(entry => `${entry.colorStyle}:${entry.rarity}` === selected);
    take(index,candidates[seed % candidates.length]);
  }
  return assigned;
}

export function buildDemoCollection() {
  let seed = 444;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const ids = [444, 128, 72, 801, 256, 91, 620, 333];
  for (let id = 1; ids.length < 100; id++) if (!ids.includes(id)) ids.push(id);
  const locked = [1432, 100500, 6500, 104800, 2800, 1200, 102400, 2600].map(cents);
  const fixedTotal = locked.reduce((a, b) => a + b, 0);
  const raw = Array.from({length:72}, () => 500 + random() * 42000);
  const remaining = cents(BASE_PROTOCOL_LIQUIDITY_USD) - fixedTotal;
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  locked.push(...raw.map(value => Math.floor(value / rawTotal * remaining)));
  locked[79] += cents(BASE_PROTOCOL_LIQUIDITY_USD) - locked.reduce((a, b) => a + b, 0);
  locked.push(...Array(20).fill(0));
  const ownedIds = new Set([444,128,91,74]);
  const assignedTraits = seedArtworkEntries(ids);
  const collection = ids.map((id, index) => {
    const lp = locked[index];
    const fees = Math.round(lp * (0.04 + random() * 0.13));
    const daily = Math.round(lp * (0.00015 + random() * 0.00055));
    const rewards = Math.round(fees * (0.06 + random() * 0.14));
    const individual = Math.round(rewards * 0.74);
    const traits = assignedTraits[index];
    const alreadyClaimed = id === 91;
    // A separately funded example royalty round: $12.50 per activated rarity unit.
    const royalties = lp ? 1250 * RARITIES.find(rarity => rarity.id === traits.rarity).royaltyMultiplier : 0;
    return {id,...traits,pool:lp ? (index % 3 === 1 ? POOLS[1] : POOLS[0]) : null, lockedCents:lp,
      feesAllTimeCents:index === 0 ? cents(1472) : fees,
      fees24hCents:daily,
      individualCents:alreadyClaimed ? 0 : index === 0 ? cents(142.32) : individual,
      collectiveCents:alreadyClaimed ? 0 : index === 0 ? cents(41.68) : rewards - individual,
      claimedCents:alreadyClaimed ? rewards : 0,
      royaltiesCents:alreadyClaimed ? 0 : royalties,
      royaltiesClaimedCents:alreadyClaimed ? royalties : 0,
      exampleOwned:ownedIds.has(id),
      owner:'0x' + (100000 + id).toString(16).padStart(40, '0'),
      createdOrder:index};
  });
  const estimate = estimatePoolFees({protocolLiquidityUSD:BASE_PROTOCOL_LIQUIDITY_USD,totalLiquidityUSD:BASE_POOL_LIQUIDITY_USD,volumeUSD:DEFAULT_VOLUME_USD,feePercent:DEFAULT_FEE_PERCENT});
  return distributeDailyFees(collection,estimate.collectionFeeCents).map(nft => ({...nft,feesAllTimeCents:nft.fees24hCents*COLLECTION_AGE_DAYS}));
}

export function estimatePoolFees({protocolLiquidityUSD,totalLiquidityUSD,volumeUSD,feePercent}) {
  if (![protocolLiquidityUSD,totalLiquidityUSD,volumeUSD,feePercent].every(Number.isFinite)) throw new Error('Enter valid numbers for the fee estimate.');
  if (protocolLiquidityUSD < 0 || totalLiquidityUSD <= 0 || protocolLiquidityUSD > totalLiquidityUSD || volumeUSD < 0 || volumeUSD > 1e12 || feePercent < 0 || feePercent > 100) throw new Error('Use valid liquidity, volume, and fee values.');
  const share = protocolLiquidityUSD / totalLiquidityUSD;
  const poolFeeCents = Math.round(volumeUSD * feePercent);
  return {share,poolFeeCents,collectionFeeCents:Math.round(volumeUSD * feePercent * share)};
}

export function distributeDailyFees(collection,totalFeeCents) {
  const totalLP = collection.reduce((sum,nft) => sum+nft.lockedCents,0);
  if (!totalLP) return collection.map(nft => ({...nft,fees24hCents:0}));
  const allocations = collection.map((nft,index) => {
    const exact = totalFeeCents * nft.lockedCents / totalLP;
    return {index,value:Math.floor(exact),remainder:exact-Math.floor(exact)};
  });
  let remaining = totalFeeCents - allocations.reduce((sum,item) => sum+item.value,0);
  const ordered = [...allocations].sort((a,b) => b.remainder-a.remainder || a.index-b.index);
  for (const item of ordered) { if (remaining <= 0) break; item.value++; remaining--; }
  return collection.map((nft,index) => ({...nft,fees24hCents:allocations[index].value}));
}

export const lpClaimable = nft => nft.individualCents + nft.collectiveCents;
export const royaltyClaimable = nft => nft.royaltiesCents ?? 0;
export const claimable = nft => lpClaimable(nft) + royaltyClaimable(nft);
export const previouslyClaimed = nft => (nft.claimedCents ?? 0) + (nft.royaltiesClaimedCents ?? 0);
// Recorded demo credits survive claims. The old seed has no dated net receipts:
// do not derive a 24h holder total from gross fees or today's membership.
export function rewardHistory(nft) {
  return {allTime:claimable(nft)+previouslyClaimed(nft), last24h:nft.rewards24hCents ?? null};
}
export function getMetrics(collection) {
  return collection.reduce((metrics, nft) => {
    metrics.liquidity += nft.lockedCents;
    metrics.feesAllTime += nft.feesAllTimeCents;
    metrics.fees24h += nft.fees24hCents;
    metrics.claimable += claimable(nft);
    metrics.active += nft.lockedCents > 0 ? 1 : 0;
    metrics.dormant += nft.lockedCents === 0 ? 1 : 0;
    metrics.total++;
    return metrics;
  }, {liquidity:0, feesAllTime:0, fees24h:0, claimable:0, active:0, dormant:0, total:0});
}

export function feeSplit(value) {
  if (!Number.isFinite(value) || value < 0 || value > 1000000) throw new Error('Enter collected fees from $0 to $1,000,000.');
  const total = cents(value);
  const keys = ['owner','collective','compound','buyback'];
  const weights = [80,10,5,5];
  const parts = weights.map((weight,index) => ({index,value:Math.floor(total*weight/100),fraction:(total*weight)%100}));
  let remaining = total-parts.reduce((sum,part) => sum+part.value,0);
  for (const part of [...parts].sort((a,b) => b.fraction-a.fraction || a.index-b.index)) { if (!remaining) break; part.value++; remaining--; }
  return Object.fromEntries(keys.map((key,index) => [key,parts[index].value]));
}

export function mintPreview(collection) {
  const supply = getMintSupply(collection);
  if (!supply.remaining) throw new Error('The example collection is fully minted (1,000 NFTs).');
  const remaining = Object.fromEntries(Object.entries(supply.rarities).map(([rarity,quota]) => [rarity,quota.remaining]));
  const seed = (Math.imul(collection.length+1,1664525)+1013904223) >>> 0;
  const rarity = drawPreviewRarity(remaining,seed);
  const used = new Set(collection.map(nft => nft.inventoryId));
  const available = ART_INVENTORY.filter(entry => entry.rarity === rarity && !used.has(entry.tokenId));
  if (!available.length) throw new Error('No unused artwork inventory remains for this rarity. Reset the demo.');
  const traits = inventoryTraits(available[seed % available.length]);
  const id = Math.max(1000, ...collection.map(nft => nft.id)) + 1;
  const nft = {id,...traits,pool:null,lockedCents:0,feesAllTimeCents:0,fees24hCents:0,individualCents:0,collectiveCents:0,claimedCents:0,royaltiesCents:0,royaltiesClaimedCents:0,rewards24hCents:0,exampleOwned:true,owner:DEMO_ADDRESS,createdOrder:collection.length};
  return {collection:[...collection,nft], nft};
}

export function activatePreview(collection, {id, amount, pool, fundingAsset = 'USDC'}) {
  const nft = collection.find(item => item.id === id);
  if (!nft || !nft.exampleOwned) throw new Error('This NFT is not in your example portfolio.');
  if (nft.lockedCents > 0) throw new Error('This NFT is already active.');
  if (!Number.isFinite(amount) || amount < MIN_ACTIVATION_USD || amount > 1000000) throw new Error('Enter an activation value from $100 to $1,000,000.');
  if (!FUNDING_ASSETS.includes(fundingAsset)) throw new Error('Choose USDC, ZZZ, ETH or USDG for the example contribution.');
  if (!POOLS.includes(pool)) throw new Error('Choose a supported example pool.');
  return {collection:collection.map(item => item.id === id ? {...item,pool,activationAsset:fundingAsset,lockedCents:cents(amount),rewards24hCents:0} : item), id};
}

export function increasePreview(collection, contribution) {
  return applyIncrease(collection, contribution, MIN_TOPUP_USD);
}
function applyIncrease(collection, {id, amount, fundingAsset = 'USDC'}, minimum) {
  const nft = collection.find(item => item.id === id);
  if (!nft || !nft.exampleOwned) throw new Error('This NFT is not in your example portfolio.');
  if (!nft.lockedCents) throw new Error('Activate this dormant NFT with at least $100 in value first.');
  if (!FUNDING_ASSETS.includes(fundingAsset)) throw new Error('Choose USDC, ZZZ, ETH or USDG for the example contribution.');
  if (!Number.isFinite(amount) || amount < minimum || amount > 1000000) throw new Error(`Enter an LP top-up value from $${minimum} to $1,000,000.`);
  return {collection:collection.map(item => item.id === id ? {...item,lockedCents:item.lockedCents+cents(amount)} : item), id};
}

export function claimPreview(collection, ids, {scope = 'all'} = {}) {
  if (scope !== 'all' && scope !== 'lp') throw new Error('Choose a supported example claim scope.');
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id))) throw new Error('Choose an example NFT to claim.');
  const unique = new Set(ids);
  let lpAmount = 0, royaltiesAmount = 0;
  for (const id of unique) {
    const nft = collection.find(item => item.id === id);
    if (!nft || !nft.exampleOwned) throw new Error('You can only claim your example NFTs.');
    lpAmount += lpClaimable(nft);
    if (scope === 'all') royaltiesAmount += royaltyClaimable(nft);
  }
  const amount = lpAmount + royaltiesAmount;
  if (!amount) throw new Error('No example rewards are ready to claim.');
  const updated = collection.map(nft => {
    if (!unique.has(nft.id)) return nft;
    const lpClaimed = {...nft,individualCents:0,collectiveCents:0,claimedCents:(nft.claimedCents ?? 0) + lpClaimable(nft)};
    return scope === 'all' ? {...lpClaimed,royaltiesCents:0,royaltiesClaimedCents:(nft.royaltiesClaimedCents ?? 0) + royaltyClaimable(nft)} : lpClaimed;
  });
  return {collection:updated, amount, lpAmount, royaltiesAmount};
}

export function replayEvents(events) {
  let collection = buildDemoCollection();
  if (!Array.isArray(events)) return collection;
  for (const event of events.slice(0,1000)) {
    try {
      if (event.type === 'mint') collection = mintPreview(collection,event).collection;
      // Existing v7 claim events predate royalties and must retain their LP-only meaning.
      if (event.type === 'claim') collection = claimPreview(collection,event.ids,{scope:event.scope === undefined ? 'lp' : event.scope}).collection;
      if (event.type === 'activate') collection = activatePreview(collection,event).collection;
      // Retain old v7 contributions; new writes must pass the current $5 floor.
      if (event.type === 'increase') collection = applyIncrease(collection,event,0.01).collection;
    } catch { /* Invalid or obsolete local demo events do not affect the source model. */ }
  }
  return collection;
}
