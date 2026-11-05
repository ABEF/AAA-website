import test from 'node:test';
import assert from 'node:assert/strict';
import {contributionPolicyText,reviewedContributionPolicy} from '../deployment-view.js';

test('legacy contribution presentation retains its original one-percent policy',()=>{
  assert.equal(contributionPolicyText({schema:1}),'At least 99% must become added LP; network gas is separate.');
  assert.equal(reviewedContributionPolicy({minimum_deployed_usd_18:'99000000000000000000'}),'');
});
test('native form describes an approved ceiling without claiming it is the captured limit',()=>{
  const text=contributionPolicyText({schema:2,limits:{maximum_contribution_loss_bps:200}});
  assert.match(text,/up to 2% execution loss or undeployed value/);
  assert.match(text,/review verifies the current limit and added LP/);
  assert.match(text,/network gas is separate/);
  assert.match(contributionPolicyText({schema:2,limits:{maximum_contribution_loss_bps:0}}),/up to 0%/);
});
test('native review displays captured policy and the verified marginal LP floor, with no fixed 99 percent',()=>{
  const html=reviewedContributionPolicy({execution_limit_bps:200,reviewed_maximum_loss_bps:200,minimum_deployed_usd_18:'98000000000000000000'});
  assert.match(html,/2%/);assert.match(html,/Minimum added LP/);assert.match(html,/\$98\.00/);
  const tighter=reviewedContributionPolicy({execution_limit_bps:100,reviewed_maximum_loss_bps:100,minimum_deployed_usd_18:'99000000000000000000'});
  assert.match(tighter,/1%/);assert.match(tighter,/\$99\.00/);
});
test('missing, mismatched or injected native policy is never rendered as an approved review',()=>{
  for(const cap of [undefined,-1,1001,true,'200'])assert.throws(()=>contributionPolicyText({schema:2,limits:{maximum_contribution_loss_bps:cap}}));
  for(const patch of [{execution_limit_bps:-1},{reviewed_maximum_loss_bps:201},{minimum_deployed_usd_18:'1e20'},{minimum_deployed_usd_18:'<script>'}]){
    assert.throws(()=>reviewedContributionPolicy({execution_limit_bps:200,reviewed_maximum_loss_bps:200,minimum_deployed_usd_18:'98000000000000000000',...patch}));
  }
});

import {positionClaimEntries,ZERO} from '../deployment-api.js';
import {renderPositionAmounts} from '../deployment-view.js';
const rawRoyalties=()=>({token_id:'123',position:{activated:true,current_lp_value:{raw:'100000000000000000000'}},
  royalty_reporting:{schema:3},claimable:{lp:[{asset:ZERO,raw:'1',available:true},{asset:'0x'+'1'.repeat(40),raw:'99',available:true}],
  royalties:[{asset:ZERO,raw:'2',available:true},{asset:'0x'+'2'.repeat(40),raw:'1234567',available:true,decimals:6,symbol:'USDC'}]}});
test('original royalties are included alongside ETH LP without converting pending LP tokens',()=>{
  const n=rawRoyalties(),c=positionClaimEntries(n);assert.equal(c.length,3);
  assert.deepEqual(c.map(x=>[x.asset,x.royalty]),[[ZERO,false],[ZERO,true],['0x'+'2'.repeat(40),true]]);
  assert.ok(c.every(x=>x.token_id==='123'));
});
test('historical profiles retain ETH-only review and failed currencies are not guessed zero',()=>{
  const n=rawRoyalties();n.royalty_reporting.schema=2;assert.equal(positionClaimEntries(n).length,2);
  n.royalty_reporting.schema=3;n.claimable.royalties[1].raw=null;n.claimable.royalties[1].available=false;
  assert.equal(positionClaimEntries(n).length,2);assert.match(renderPositionAmounts(n),/Other royalties to claim: Unavailable USDC/);
});
test('original royalty quantities render exactly and never become pending ETH',()=>{
  const n=rawRoyalties();n.claimable.lp=n.claimable.lp.slice(0,1);const html=renderPositionAmounts(n);
  assert.match(html,/1.234567 USDC/);assert.match(html,/Paid in their original currency/);
  assert.doesNotMatch(html,/await conversion/);n.claimable.royalties[1].raw='1e6';assert.throws(()=>positionClaimEntries(n));
});

import {reviewedClaimPayouts} from '../deployment-view.js';
test('claim review shows each exact simulated currency and escapes token names',()=>{
  const html=reviewedClaimPayouts({action:'claim',claims:[{token_id:'123',royalty:true,decimals:6,simulated_raw:'25000001',symbol:'USDC<script>'}]});
  assert.match(html,/25.000001 USDC&lt;script&gt;/);assert.match(html,/Royalties/);
  assert.equal(reviewedClaimPayouts({action:'mint'}),'');assert.throws(()=>reviewedClaimPayouts({action:'claim',claims:[]}));
});

import {hasClaimableRewards,claimCurrencyButtons} from '../deployment-view.js';
test('non-ETH-only royalties enable claiming and healthy currencies have separate choices',()=>{
  const n=rawRoyalties();n.claimable.lp=n.claimable.lp.slice(0,1);n.claimable.lp[0].raw='0';n.claimable.royalties[0].raw='0';
  assert.equal(hasClaimableRewards(n),true);n.claimable.royalties[0].raw='1';
  const html=claimCurrencyButtons(n);assert.match(html,/data-deployment-claim-asset/);assert.match(html,/Claim USDC/);assert.match(html,/Claim ETH/);
});
