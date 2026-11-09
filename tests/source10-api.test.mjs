import test from 'node:test';
import assert from 'node:assert/strict';
import {DeploymentAPI,ZERO} from '../deployment-api.js';
import {positionArtwork,renderPositionAmounts,earnedUSD} from '../deployment-view.js';
import {source10APISetup,source10DTOs} from './helpers/source10-api-fixture.mjs';
function setup(name){const s=source10APISetup(name);s.api=new DeploymentAPI(s.m,{origin:'http://127.0.0.1:4190',reader:s.reader,fetcher:s.fetcher,clock:()=>s.now});return s;}
const copyClaims=rows=>rows.map(({token_id,asset,royalty})=>({token_id,asset,royalty}));

for(const name of ['active_single','active_residual','price_unavailable','dormant','principal_allocated','principal_ready','principal_paid'])test('current V10 handler payload composes with the browser: '+name,async()=>{
  const s=setup(name),p=await s.api.protocol(),expected=s.f.outputs.nft,n=await s.api.nft(expected.token_id,expected.owner);
  assert.equal(p.minting.channel,'opensea');assert.equal(p.minting.available,null);assert.equal(p.minting.stage_eligibility,'unverified');
  assert.equal(n.owner,expected.owner);assert.deepEqual(n.position,expected.position);assert.deepEqual(n.claimable,expected.claimable);
  assert.ok(s.replySources.includes('produced'));assert.ok(s.calls.some(c=>c.method==='eth_getCode'));
  if(name==='active_residual'){assert.equal(n.position.local_custody.portfolio.physical_legs.length,2);assert.notEqual(n.position.local_custody.portfolio.secondary_lp_token_id,'0');}
  if(name==='principal_paid')assert.equal(n.principal_return.paid,true);
  if(n.position.evolution==='lp_exited')assert.equal(positionArtwork(n).evolution,'activated');
  if(name==='dormant')assert.doesNotMatch(renderPositionAmounts(n),/Rewards to claim/);
});

test('current DTOs preserve funded LP and original ETH/USDC royalties without adding ZZZ to ETH',async()=>{
  const s=setup('claim_policy1'),n=await s.api.nft(s.f.outputs.nft.token_id,s.f.outputs.nft.owner);
  assert.ok(n.claimable.lp.some(r=>r.asset===ZERO&&BigInt(r.raw)>0n));
  assert.ok(n.claimable.lp.some(r=>r.asset!==ZERO&&BigInt(r.raw)>0n));
  assert.ok(n.claimable.royalties.some(r=>r.asset!==ZERO&&BigInt(r.raw)>0n));
  assert.deepEqual(n.claimable.royalties.map(r=>r.symbol),['ETH','USDC']);
  assert.match(renderPositionAmounts(n),/Pending LP conversion/);assert.match(renderPositionAmounts(n),/original currency/);
});

for(const policy of [1,2])test('actual current claim producer matches exact unsigned calldata and complete plan, policy'+policy,async()=>{
  const s=setup('claim_policy'+policy),request=s.f.request;
  const r=await s.api.prepare({action:'claim',account:request.wallet,claims:copyClaims(request.claims)});
  assert.deepEqual(r.transaction,s.f.outputs.draft.transaction);assert.equal(r.claims.length,3);
  const planned=await s.api.prepare({action:'claim',account:request.wallet,claims:copyClaims(request.claims),plan:true});
  assert.deepEqual(planned.transaction,r.transaction);assert.equal(planned.claim_plan.entries.length,request.claims.length);
});

for(const name of ['activation_eth','activation_zzz','growth_eth','growth_zzz','activation_zzz_approval','growth_zzz_approval'])test('actual current Entry3 producer composes with unsigned browser review: '+name,async()=>{
  const s=setup(name),r=s.f.request,a=s.m.input_assets.find(a=>a.address===r.source_asset),amount=(BigInt(r.amount_in)/10n**BigInt(a.decimals)).toString();
  const reviewed=await s.api.prepare({action:r.action,account:r.wallet,id:r.token_id,asset:a.symbol,amount});
  assert.deepEqual(reviewed.transaction,s.f.outputs.draft.transaction);
  assert.equal(reviewed.requested_action,s.f.outputs.draft.action);
  if(name.endsWith('_approval')){assert.equal(reviewed.action,'approve');assert.equal(BigInt('0x'+reviewed.transaction.data.slice(-64)),BigInt(r.amount_in));assert.equal(reviewed.transaction.to,a.address);}
  else {assert.equal(reviewed.action,r.action);assert.equal(reviewed.execution_limit_bps,300);assert.equal(reviewed.minimum_deployed_usd_18,(BigInt(r.amount_in)*97n/100n).toString());}
  assert.equal(s.calls.some(c=>c.method&&/send|sign|nonce|trace|anvil/i.test(c.method)),false);
});

test('current checkpoint2 history, wallet and collection totals match actual current raw replay',async()=>{
  const s=setup('checkpoint2_earnings'),o=s.f.outputs;
  const report=await s.api.collectionEarnings({});
  assert.deepEqual(report.all_time,o.full_raw_earnings.all_time);assert.deepEqual(report.last_24h,o.full_raw_earnings.last_24h);
  assert.equal(report.claims_and_conversions_are_income,false);assert.notEqual(earnedUSD(report,'all_time',true),'0');
  const totals=await s.api.walletTotals(o.inventory),collection=await s.api.collectionPositions({}),wallet=await s.api.walletEarnings(o.inventory,{});
  assert.equal(totals.claimable_eth_wei,o.wallet_summary.claimable_eth_wei);assert.equal(collection.count,3);assert.equal(collection.activated,2);assert.equal(wallet.available,true);
});

test('profile, mint channel and helper drift are rejected instead of hiding unavailable data',async()=>{
  const a=setup('active_single');a.f.outputs.protocol.minting.available=true;await assert.rejects(a.api.protocol(),/OpenSea/);
  const b=setup('active_single');b.f.outputs.nft.contracts.seadrop=b.m.contracts.nft.address;await assert.rejects(b.api.nft(b.f.outputs.nft.token_id,b.f.outputs.nft.owner),/binding/);
  const c=setup('active_single');c.f.outputs.nft.provenance.accounting_version=6;await assert.rejects(c.api.nft(c.f.outputs.nft.token_id,c.f.outputs.nft.owner),/profile/);
  assert.equal(source10DTOs.profile.mint_integration_version,2);assert.match(source10DTOs.scope,/synthetic/i);
});

test('historical replay replies cannot be reused as current-block browser proofs',()=>{
  const s=setup('checkpoint2_earnings');let historical=0;
  const current=new Set(s.f.rpc_responses.filter(r=>r.method==='eth_call'&&JSON.stringify(r.params[1])===JSON.stringify(s.block)).map(r=>r.params[0].to+':'+r.params[0].data));
  for(const r of s.f.rpc_responses){if(r.method!=='eth_call'||JSON.stringify(r.params[1])===JSON.stringify(s.block))continue;historical++;const key=r.params[0].to+':'+r.params[0].data;if(!current.has(key))assert.equal(s.callGetters.has(key),false);}
  assert.ok(historical>0);
});

test('direct mint rejects before transport, consistent with the actual current mint2 producer',async()=>{
  const s=setup('active_single'),expected=source10DTOs.cases.mint_use_opensea.outputs.error;const before=s.calls.length;
  assert.equal(expected.type,'TransactionInputError');assert.match(expected.message,/Use OpenSea/);
  await assert.rejects(s.api.prepare({action:'mint',account:s.f.outputs.nft.owner}),/OpenSea.*unavailable/);
  assert.equal(s.calls.length,before);
});
