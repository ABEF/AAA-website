import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoCollection,getMetrics,getLevel,claimable,feeSplit,mintPreview,claimPreview,activatePreview,increasePreview,replayEvents,DEMO_ADDRESS,estimatePoolFees,distributeDailyFees} from '../domain.js';
import {WalletConnection,walletError} from '../wallet.js';

test('initial collection has exactly $425k liquidity, 100 NFTs, and 20% dormant',() => {
  const collection = buildDemoCollection(); const metrics = getMetrics(collection);
  assert.equal(collection.length,100); assert.equal(new Set(collection.map(nft => nft.id)).size,100);
  assert.equal(metrics.liquidity,42500000); assert.equal(metrics.active,80); assert.equal(metrics.dormant,20);
  assert.ok(collection.filter(nft => nft.lockedCents >= 10000000).length >= 3);
  assert.deepEqual(collection,buildDemoCollection());
});
test('dormant positions have no fees or rewards',() => {
  for (const nft of buildDemoCollection().filter(item => item.lockedCents === 0)) {
    assert.equal(nft.feesAllTimeCents,0); assert.equal(nft.fees24hCents,0); assert.equal(claimable(nft),0);
  }
});
test('featured NFT shows the updated $1,432 LP and preserves its $184 claim example',() => {
  const nft = buildDemoCollection().find(item => item.id === 444);
  assert.equal(nft.lockedCents,143200); assert.equal(claimable(nft),18400);
});
test('level boundaries match the supplied concept',() => {
  for (const [lp,level] of [[0,'Dormant'],[10000,'Activated'],[50000,'Activated'],[99999,'Activated'],[100000,'Enhanced'],[999999,'Enhanced'],[1000000,'Singularity'],[10000000,'Singularity']]) assert.equal(getLevel(lp),level);
});
test('fee illustration distributes whole dollar values 80/10/5/5',() => assert.deepEqual(feeSplit(1000),{owner:80000,collective:10000,compound:5000,buyback:5000}));
test('fee allocation conserves cents including small remainders',() => {
  for (const value of [0,.01,.07,1.99,49.13,1427.01,1000000]) assert.equal(Object.values(feeSplit(value)).reduce((a,b) => a+b,0),Math.round(value*100));
  for (const value of [-1,NaN,Infinity,1000001]) assert.throws(() => feeSplit(value));
});
test('mint creates a fresh dormant NFT and cannot increase LP',() => {
  const original = buildDemoCollection(); const {collection,nft} = mintPreview(original);
  assert.equal(original.length,100); assert.equal(collection.length,101); assert.equal(getMetrics(collection).liquidity,42500000);
  assert.equal(nft.id,1001); assert.equal(nft.lockedCents,0); assert.equal(nft.exampleOwned,true); assert.equal(claimable(nft),0); assert.equal(nft.pool,null);
});
test('dormant mint leaves LP and claim balances at zero',() => {
  const {collection,nft} = mintPreview(buildDemoCollection());
  assert.equal(getMetrics(collection).liquidity,42500000); assert.equal(nft.lockedCents,0); assert.equal(claimable(nft),0); assert.equal(getMetrics(collection).dormant,21);
});
test('repeated minting changes supply only and keeps identifiers unique',() => {
  let collection = buildDemoCollection();
  for (let i = 0; i < 10; i++) collection = mintPreview(collection).collection;
  assert.equal(collection.length,110); assert.equal(new Set(collection.map(nft => nft.id)).size,110);
  assert.equal(getMetrics(collection).liquidity,42500000); assert.equal(getMetrics(collection).dormant,30);
});
test('reward claim cannot redeem principal or change generated fees',() => {
  const original = buildDemoCollection(); const before = getMetrics(original);
  const {collection,amount} = claimPreview(original,[444]); const after = getMetrics(collection);
  assert.equal(amount,18400); assert.equal(after.liquidity,before.liquidity); assert.equal(after.feesAllTime,before.feesAllTime); assert.equal(after.fees24h,before.fees24h);
  assert.equal(before.claimable-after.claimable,18400); assert.equal(collection.find(nft => nft.id === 444).claimedCents,18400);
  assert.equal(claimable(original.find(nft => nft.id === 444)),18400);
  assert.throws(() => claimPreview(collection,[444]));
});
test('bulk claims deduplicate NFT identifiers and reject foreign ownership',() => {
  const original = buildDemoCollection(); const ids = original.filter(nft => nft.exampleOwned && claimable(nft)).map(nft => nft.id);
  const expected = original.filter(nft => ids.includes(nft.id)).reduce((sum,nft) => sum+claimable(nft),0);
  assert.equal(claimPreview(original,[...ids,...ids]).amount,expected);
  assert.throws(() => claimPreview(original,[72])); assert.throws(() => claimPreview(original,[])); assert.throws(() => claimPreview(original,[444,'128']));
});
test('dormant activation preserves identity and updates active collection totals',() => {
  const original = buildDemoCollection(); const id = original.find(nft => nft.exampleOwned && !nft.lockedCents).id;
  const {collection} = activatePreview(original,{id,amount:1000,pool:'ZZZ/WETH'});
  assert.equal(collection.length,100); assert.equal(getMetrics(collection).active,81); assert.equal(getMetrics(collection).liquidity,42600000);
  assert.equal(collection.find(nft => nft.id === id).lockedCents,100000); assert.throws(() => activatePreview(collection,{id,amount:1000,pool:'ZZZ/WETH'}));
});
test('activation requires at least $100 and supported contribution assets and pools',() => {
  const collection = mintPreview(buildDemoCollection()).collection; const id = 1001;
  for (const amount of [0,99.99,-1,NaN,Infinity,1000001]) assert.throws(() => activatePreview(collection,{id,amount,pool:'ZZZ/WETH'}));
  assert.throws(() => activatePreview(collection,{id,amount:500,pool:'invalid'}));
  for (const fundingAsset of ['USDC','ZZZ']) {
    const activated = activatePreview(collection,{id,amount:100,pool:'ZZZ/USDC',fundingAsset}).collection;
    const nft = activated.find(nft => nft.id === id);
    assert.equal(getMetrics(activated).liquidity,42510000); assert.equal(nft.pool,'ZZZ/USDC');
    assert.equal(nft.activationAsset,fundingAsset); assert.equal(nft.lockedCents,10000); assert.equal(nft.feesAllTimeCents,0);
  }
  assert.throws(() => activatePreview(collection,{id,amount:100,pool:'ZZZ/USDC',fundingAsset:'BAD'}));
});
test('permanent top-ups increase NFT and collection LP without changing rewards',() => {
  const original = buildDemoCollection(); const before = original.find(nft => nft.id === 444);
  const {collection} = increasePreview(original,{id:444,amount:250.75}); const after = collection.find(nft => nft.id === 444);
  assert.equal(after.lockedCents,before.lockedCents+25075); assert.equal(getMetrics(collection).liquidity,42525075);
  assert.equal(after.pool,before.pool); assert.equal(claimable(after),claimable(before));
  assert.equal(after.feesAllTimeCents,before.feesAllTimeCents); assert.equal(collection.length,100);
});
test('top-ups cannot bypass activation or target foreign NFTs',() => {
  const collection = buildDemoCollection(); const dormant = collection.find(nft => nft.exampleOwned && !nft.lockedCents);
  assert.throws(() => increasePreview(collection,{id:dormant.id,amount:500})); assert.throws(() => increasePreview(collection,{id:72,amount:1000}));
  for (const amount of [0,-1,NaN,Infinity,1000001]) assert.throws(() => increasePreview(collection,{id:444,amount}));
});
test('saved demo events replay and tolerate corrupt events',() => {
  const events = [{type:'claim',ids:[444]},{type:'mint'},{type:'activate',id:1001,amount:500,pool:'ZZZ/WETH'},{type:'increase',id:1001,amount:10000},{type:'claim',ids:[72]},{type:'activate',id:99999,amount:-1,pool:'bad'}];
  const collection = replayEvents(events);
  assert.equal(collection.length,101); assert.equal(getMetrics(collection).liquidity,43550000); assert.equal(claimable(collection.find(nft => nft.id === 444)),0);
  assert.equal(replayEvents(null).length,100);
});
test('wallet connection requests accounts and chain only; no signing or transactions',async () => {
  const methods = []; const listeners = new Map(); const updates = [];
  const provider = {request:async ({method}) => { methods.push(method); return method === 'eth_requestAccounts' ? [DEMO_ADDRESS] : '0x1'; },on:(name,handler) => listeners.set(name,handler),removeListener:name => listeners.delete(name)};
  const wallet = new WalletConnection(state => updates.push(state)); await wallet.connect(provider,'Test wallet');
  assert.deepEqual(methods,['eth_requestAccounts','eth_chainId']); assert.equal(wallet.state.address,DEMO_ADDRESS);
  listeners.get('accountsChanged')(['0x1111111111111111111111111111111111111111']); assert.equal(wallet.state.address,'0x1111111111111111111111111111111111111111');
  listeners.get('chainChanged')('0x2105'); assert.equal(wallet.state.chainId,'0x2105');
  listeners.get('accountsChanged')([]); assert.equal(wallet.state,null); assert.equal(listeners.size,0); assert.ok(updates.length >= 4);
});
test('browser wallet rejects malformed or empty returned accounts',async () => {
  for (const accounts of [[],['invalid'],null]) {
    const wallet = new WalletConnection(() => {});
    await assert.rejects(() => wallet.connect({request:async () => accounts})); assert.equal(wallet.state,null);
  }
});
test('demo wallet never calls a provider and disconnect is local',() => {
  const updates = []; const wallet = new WalletConnection(state => updates.push(state));
  wallet.connectDemo(DEMO_ADDRESS); assert.equal(wallet.state.type,'demo'); assert.equal(wallet.provider,null);
  wallet.disconnect(); assert.equal(wallet.state,null); assert.equal(updates.length,2);
});
test('wallet rejection and pending request errors have useful messages',() => {
  assert.match(walletError({code:4001}),/cancelled/); assert.match(walletError({code:-32002}),/already open/);
});

test('user scenario produces 34% share, $2,544 pool fees and $864.96 collection fees',() => {
  const result = estimatePoolFees({protocolLiquidityUSD:425000,totalLiquidityUSD:1250000,volumeUSD:848000,feePercent:.3});
  assert.equal(result.share,.34); assert.equal(result.poolFeeCents,254400); assert.equal(result.collectionFeeCents,86496);
  assert.equal(getMetrics(buildDemoCollection()).fees24h,86496);
  assert.equal(getMetrics(buildDemoCollection()).feesAllTime,6054720);
});
test('fee rate is configurable and $720.80 follows a 0.25% LP fee scenario',() => {
  const estimate = feePercent => estimatePoolFees({protocolLiquidityUSD:425000,totalLiquidityUSD:1250000,volumeUSD:848000,feePercent});
  assert.equal(estimate(.25).collectionFeeCents,72080); assert.equal(estimate(.05).collectionFeeCents,14416); assert.equal(estimate(0).collectionFeeCents,0);
});
test('fee model rejects invalid pool shares and unsafe numbers',() => {
  const input = {protocolLiquidityUSD:425000,totalLiquidityUSD:1250000,volumeUSD:848000,feePercent:.3};
  for (const bad of [{totalLiquidityUSD:0},{protocolLiquidityUSD:1250001},{volumeUSD:-1},{volumeUSD:NaN},{feePercent:-1},{feePercent:101}]) assert.throws(() => estimatePoolFees({...input,...bad}));
});
test('daily fee apportionment conserves cents and leaves dormant NFTs at zero',() => {
  const collection = buildDemoCollection();
  for (const total of [0,1,19,86496,14416]) {
    const distributed = distributeDailyFees(collection,total);
    assert.equal(getMetrics(distributed).fees24h,total);
    for (const nft of distributed.filter(nft => !nft.lockedCents)) assert.equal(nft.fees24hCents,0);
  }
});
test('24-hour and 10-week displayed allocations preserve the fee budget',() => {
  assert.deepEqual(feeSplit(864.96),{owner:69197,collective:8649,compound:4325,buyback:4325});
  assert.deepEqual(feeSplit(60547.20),{owner:4843776,collective:605472,compound:302736,buyback:302736});
});
