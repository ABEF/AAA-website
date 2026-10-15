import {EVOLUTIONS,getEvolution,traitsForPosition} from './artworks.js';
export const MIN_ACTIVATION_USD = 100;
export const FUNDING_ASSETS = ['USDC','ZZZ'];
export const POOLS = ['ZZZ/WETH', 'ZZZ/USDC'];
export const LEVELS = EVOLUTIONS.map(level => level.label);
export const DEMO_ADDRESS = '0x4440000000000000000000000000000000000444';
export const STORAGE_KEY = 'zzz-popl-preview-v5';
export const COLLECTION_AGE_WEEKS = 10;
export const COLLECTION_AGE_DAYS = COLLECTION_AGE_WEEKS * 7;
export const BASE_PROTOCOL_LIQUIDITY_USD = 425000;
export const BASE_POOL_LIQUIDITY_USD = 1250000;
export const DEFAULT_VOLUME_USD = 848000;
export const DEFAULT_FEE_PERCENT = 0.3;
export const cents = value => Math.round(value * 100);
export const dollars = value => value / 100;

export function getLevel(lockedCents) { return getEvolution(lockedCents).label; }

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
  const ownedColors = new Map([[444,'cyan'],[128,'blue'],[91,'emerald'],[74,'violet']]);
  const collection = ids.map((id, index) => {
    const lp = locked[index];
    const fees = Math.round(lp * (0.04 + random() * 0.13));
    const daily = Math.round(lp * (0.00015 + random() * 0.00055));
    const rewards = Math.round(fees * (0.06 + random() * 0.14));
    const individual = Math.round(rewards * 0.74);
    const traits = traitsForPosition(index);
    const alreadyClaimed = id === 91;
    return {id,...traits,color:ownedColors.get(id) || traits.color, pool:lp ? (index % 3 === 1 ? POOLS[1] : POOLS[0]) : null, lockedCents:lp,
      feesAllTimeCents:index === 0 ? cents(1472) : fees,
      fees24hCents:daily,
      individualCents:alreadyClaimed ? 0 : index === 0 ? cents(142.32) : individual,
      collectiveCents:alreadyClaimed ? 0 : index === 0 ? cents(41.68) : rewards - individual,
      claimedCents:alreadyClaimed ? rewards : 0,
      exampleOwned:ownedColors.has(id),
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

export const claimable = nft => nft.individualCents + nft.collectiveCents;
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
  const id = Math.max(1000, ...collection.map(nft => nft.id)) + 1;
  const nft = {id,...traitsForPosition(collection.length),pool:null,lockedCents:0,feesAllTimeCents:0,fees24hCents:0,individualCents:0,collectiveCents:0,claimedCents:0,exampleOwned:true,owner:DEMO_ADDRESS,createdOrder:collection.length};
  return {collection:[...collection,nft], nft};
}

export function activatePreview(collection, {id, amount, pool, fundingAsset = 'USDC'}) {
  const nft = collection.find(item => item.id === id);
  if (!nft || !nft.exampleOwned) throw new Error('This NFT is not in your example portfolio.');
  if (nft.lockedCents > 0) throw new Error('This NFT is already active.');
  if (!Number.isFinite(amount) || amount < MIN_ACTIVATION_USD || amount > 1000000) throw new Error('Enter an activation value from $100 to $1,000,000.');
  if (!FUNDING_ASSETS.includes(fundingAsset)) throw new Error('Choose ZZZ or USDC for the example contribution.');
  if (!POOLS.includes(pool)) throw new Error('Choose a supported example pool.');
  return {collection:collection.map(item => item.id === id ? {...item,pool,activationAsset:fundingAsset,lockedCents:cents(amount)} : item), id};
}

export function increasePreview(collection, {id, amount, fundingAsset = 'USDC'}) {
  const nft = collection.find(item => item.id === id);
  if (!nft || !nft.exampleOwned) throw new Error('This NFT is not in your example portfolio.');
  if (!nft.lockedCents) throw new Error('Activate this dormant NFT with at least $100 in ZZZ or USDC first.');
  if (!FUNDING_ASSETS.includes(fundingAsset)) throw new Error('Choose ZZZ or USDC for the example contribution.');
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 1000000) throw new Error('Enter a positive liquidity value, up to $1,000,000.');
  return {collection:collection.map(item => item.id === id ? {...item,lockedCents:item.lockedCents+cents(amount)} : item), id};
}

export function claimPreview(collection, ids) {
  if (!Array.isArray(ids) || !ids.length || ids.some(id => !Number.isSafeInteger(id))) throw new Error('Choose an example NFT to claim.');
  const unique = new Set(ids);
  let amount = 0;
  for (const id of unique) {
    const nft = collection.find(item => item.id === id);
    if (!nft || !nft.exampleOwned) throw new Error('You can only claim your example NFTs.');
    amount += claimable(nft);
  }
  if (!amount) throw new Error('No example rewards are ready to claim.');
  const updated = collection.map(nft => unique.has(nft.id) ? {...nft,individualCents:0,collectiveCents:0,claimedCents:nft.claimedCents + claimable(nft)} : nft);
  return {collection:updated, amount};
}

export function replayEvents(events) {
  let collection = buildDemoCollection();
  if (!Array.isArray(events)) return collection;
  for (const event of events.slice(0,1000)) {
    try {
      if (event.type === 'mint') collection = mintPreview(collection,event).collection;
      if (event.type === 'claim') collection = claimPreview(collection,event.ids).collection;
      if (event.type === 'activate') collection = activatePreview(collection,event).collection;
      if (event.type === 'increase') collection = increasePreview(collection,event).collection;
    } catch { /* Invalid or obsolete local demo events do not affect the source model. */ }
  }
  return collection;
}
