import test from 'node:test';
import assert from 'node:assert/strict';
import {currentSetup} from './helpers/deployment-current-fixture.mjs';
import {positionClaimEntries} from '../deployment-api.js';
import {nativeRewards,royaltyOpeningNote,renderPositionAmounts} from '../deployment-view.js';
function setup(schema=4,open=false){
 const s=currentSetup('claim_eth_both'),n=structuredClone(s.f.nft);
 n.provenance.block_timestamp=Math.max(10000,n.provenance.block_timestamp);const t=n.provenance.block_timestamp;
 n.royalty_reporting={schema,opening:{configured:true,mint_end:t-3600+(open?0:1),claims_open_at:t+(open?0:1),claims_open:open,activation_window_seconds:3600,status:open?'open':'locked'}};
 n.claimable.royalties.forEach(a=>{a.raw='0';a.available=true;});return {s,n};
}
test('royalty opening agrees with the same confirmed timestamp',()=>{
 const {s,n}=setup();assert.equal(s.api.validateNFT(n,n.token_id,n.owner),n);
 n.royalty_reporting.opening.claims_open=true;n.royalty_reporting.opening.status='open';
 assert.throws(()=>s.api.validateNFT(n,n.token_id,n.owner),/Royalty opening/);
 const a=setup(4,true);a.n.royalty_reporting.opening.claims_open=false;a.n.royalty_reporting.opening.status='locked';
 assert.throws(()=>a.s.api.validateNFT(a.n,a.n.token_id,a.n.owner),/Royalty opening/);
});
test('royalty opening rejects inconsistent interval, status and configured fields',()=>{
 for(const patch of [{activation_window_seconds:86400},{claims_open_at:1},{configured:1},{status:'open'},{mint_end:null}]){
  const {s,n}=setup();Object.assign(n.royalty_reporting.opening,patch);
  assert.throws(()=>s.api.validateNFT(n,n.token_id,n.owner),/Royalty opening/);
 }
});
test('locked royalty values cannot masquerade as immediately claimable funds',()=>{
 const {s,n}=setup();n.claimable.royalties[0].raw='1';
 assert.throws(()=>s.api.validateNFT(n,n.token_id,n.owner),/Locked royalty/);
});
test('unconfigured royalty opening remains distinct from a zero deadline',()=>{
 const {s,n}=setup();n.royalty_reporting.opening={configured:false,mint_end:null,claims_open_at:null,claims_open:false,activation_window_seconds:3600,status:'unconfigured'};
 assert.equal(s.api.validateNFT(n,n.token_id,n.owner),n);
 n.royalty_reporting.opening.claims_open=true;assert.throws(()=>s.api.validateNFT(n,n.token_id,n.owner),/Royalty opening/);
});
test('exact-unit reporting5 follows the same opening gate without changing old profiles',()=>{
 const {s,n}=setup(5);assert.equal(s.api.validateNFT(n,n.token_id,n.owner),n);
 assert.ok(positionClaimEntries(n).every(c=>!c.royalty));
 n.royalty_reporting.opening.claims_open=true;n.royalty_reporting.opening.status='open';n.royalty_reporting.opening.mint_end--;n.royalty_reporting.opening.claims_open_at--;
 n.claimable.royalties[0].raw='1';assert.ok(positionClaimEntries(n).some(c=>c.royalty));
 assert.equal(s.api.validateNFT(n,n.token_id,n.owner),n);
});
test('locked royalty display never inflates available LP rewards',()=>{
 const {n}=setup();const lp=nativeRewards(n,'lp');n.claimable.royalties[0].raw='999999999999999999';
 assert.equal(nativeRewards(n),lp);assert.equal(nativeRewards(n,'royalties'),null);
});
test('no royalty deadline appears on dormant cards for either opening profile',()=>{
 for(const schema of [4,5]){const {n}=setup(schema);n.position.activated=false;
  assert.equal(royaltyOpeningNote(n),'');assert.doesNotMatch(renderPositionAmounts(n),/Royalty claims open|<time|claims_open_at/);
 }
});
