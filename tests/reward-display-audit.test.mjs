import test from 'node:test';
import assert from 'node:assert/strict';
import {buildDemoCollection,claimPreview,increasePreview,claimable,previouslyClaimed,rewardHistory} from '../domain.js';
import {rewardHistoryUSD,earningsSummary,positionRows} from '../local-view.js';
const W=10n**18n;
const snapshot=values=>({token_id:'444',chain_id:31337,position:{activated:true,current_lp_value:{available:true,raw:String(1432n*W)}},
  provenance:{block_hash:'0x'+'a'.repeat(64)},claimable:{lp:[],royalties:[]},
  earnings:{available:true,scope:'nft',token_id:'444',chain_id:31337,provenance:{block_hash:'0x'+'a'.repeat(64)},
  all_time_usd_at_current_price_18:values,last_24h_usd_at_current_price_18:values}});
test('demo 444 total is exactly individual plus collective plus royalties, paid once',()=>{
  const before=buildDemoCollection(),n=before.find(x=>x.id===444);
  assert.equal(n.individualCents,14232);assert.equal(n.collectiveCents,4168);assert.equal(n.royaltiesCents,1250);
  assert.equal(rewardHistory(n).allTime,19650);assert.equal(claimable(n),19650);
  const lp=claimPreview(before,[444],{scope:'lp'}).collection;
  assert.equal(claimable(lp.find(x=>x.id===444)),1250);assert.equal(rewardHistory(lp.find(x=>x.id===444)).allTime,19650);
  const all=claimPreview(lp,[444]).collection,paid=all.find(x=>x.id===444);
  assert.equal(claimable(paid),0);assert.equal(previouslyClaimed(paid),19650);assert.equal(rewardHistory(paid).allTime,19650);
  assert.throws(()=>claimPreview(all,[444]),/No example rewards/);
});
test('top-up and gross display figures cannot increase NFT earned history',()=>{
  const initial=buildDemoCollection(),n=initial.find(x=>x.id===444),before=rewardHistory(n);
  const after=increasePreview(initial,{id:444,amount:5,fundingAsset:'ETH'}).collection.find(x=>x.id===444);
  assert.deepEqual(rewardHistory(after),before);
  assert.deepEqual(rewardHistory({...after,fees24hCents:999999,feesAllTimeCents:999999999,lockedCents:999999999}),before);
  assert.equal(before.last24h,null);
});
test('NFT total uses its equal collective allocation, not 90 percent of its own gross share',()=>{
  // $100 LP fees, 90%/10% LP shares, two active NFTs, and $40 royalties at weights 1/3.
  const a=snapshot({lp_individual:String(72n*W),lp_collective:String(5n*W),royalties:String(10n*W)});
  const b=snapshot({lp_individual:String(8n*W),lp_collective:String(5n*W),royalties:String(30n*W)});
  assert.equal(rewardHistoryUSD(a,'all_time'),String(87n*W));assert.equal(rewardHistoryUSD(b,'all_time'),String(43n*W));
  assert.equal(BigInt(rewardHistoryUSD(a,'all_time'))+BigInt(rewardHistoryUSD(b,'all_time')),130n*W);
});
test('conversion credits, principal, reserves and past payouts are not added to earned totals',()=>{
  const n=snapshot({lp_individual:String(8n*W),lp_collective:String(W),royalties:String(3n*W),
    lp_processed:String(1000n*W),lp_compounding:String(500n*W),lp_buyback:String(500n*W)});
  n.previously_claimed={available:true,assets:[{asset:'0x'+'0'.repeat(40),symbol:'ETH',decimals:18,total_raw:String(W)}]};
  n.royalty_conversions={total_eth_credited_raw:String(500n*W)};
  assert.equal(rewardHistoryUSD(n,'all_time'),String(12n*W));
  assert.match(positionRows(n),/Rewards to claim<\/span><strong>0<\/strong>/);
  assert.match(earningsSummary(n),/\$12.00/);
});
test('sum current-price components exactly before display rounding',()=>{
  const n=snapshot({lp_individual:'4000000000000000',lp_collective:'4000000000000000',royalties:'4000000000000000'});
  assert.equal(rewardHistoryUSD(n,'last_24h'),'12000000000000000');assert.match(earningsSummary(n),/\$0.01/);
});
test('missing price and aggregate integer overflow produce unavailable, never partial totals or a render crash',()=>{
  const n=snapshot({lp_individual:String(W),lp_collective:String(W),royalties:null});
  assert.equal(rewardHistoryUSD(n,'all_time'),null);assert.match(earningsSummary(n),/Unavailable/);
  n.earnings.all_time_usd_at_current_price_18={lp_individual:String(2n**256n-1n),lp_collective:'1',royalties:'0'};
  assert.equal(rewardHistoryUSD(n,'all_time'),null);assert.doesNotThrow(()=>earningsSummary(n));
});
