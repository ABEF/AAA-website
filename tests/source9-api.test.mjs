import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DeploymentAPI,validateDeployment} from '../deployment-api.js';
import {integrationPolicy} from '../integration-app.js';
import {source9Setup} from './helpers/source9-profile-fixture.mjs';
import {positionArtwork} from '../deployment-view.js';
function setup(name){const s=source9Setup(name);s.api=new DeploymentAPI(s.m,{origin:'http://127.0.0.1:4190',reader:s.reader,fetcher:s.fetcher,clock:()=>s.now});return s;}
for(const name of ['active_single','active_residual','price_unavailable','dormant','principal_allocated','principal_ready','principal_paid'])test('full explicit API profile validates actual fresh handler: '+name,async()=>{
  const s=setup(name);await s.api.protocol();const n=await s.api.nft(s.f.nft.token_id,s.f.nft.owner);
  assert.equal(n.position.status,s.f.nft.position.status);
  assert.ok(s.calls.some(c=>c.method==='eth_call'));
});
test('source9 manifest requires all distinct profile versions and cannot be renamed current3',()=>{
  const {m}=setup();for(const mutate of [m=>m.schema=3,m=>m.accounting_version=6,m=>delete m.custody_version,m=>delete m.transaction_policy_schema,m=>m.routing_version=2,m=>m.canonical_schema='0x'+'1'.repeat(64)]){
    const copy=structuredClone(m);mutate(copy);assert.throws(()=>validateDeployment(copy,'http://127.0.0.1:4190'));
  }
});
test('poplint admits reviewed source9 locally without permitting a public rehearsal or demo host',()=>{
  const {m}=setup();assert.equal(integrationPolicy(m,'http://127.0.0.1:4190').manifest.source_profile,9);
  assert.throws(()=>integrationPolicy(m,'https://www.poplint.0xwave.com'));assert.throws(()=>integrationPolicy(m,'https://www.popldemo.0xwave.com'));
});
test('an old or changed response provenance is rejected before returning balances',async()=>{
  const s=setup();s.f.nft.provenance.accounting_version=6;
  await assert.rejects(s.api.nft(s.f.nft.token_id,s.f.nft.owner),/profile/);
});
test('fresh original currencies are bounded reviewed metadata, not a fixed symbol whitelist',()=>{
  const {m}=setup();m.reward_assets.push({address:'0x'+'8'.repeat(40),symbol:'TOKEN_NEW',decimals:9});
  assert.equal(validateDeployment(m,'http://127.0.0.1:4190').reward_assets.at(-1).symbol,'TOKEN_NEW');
  m.reward_assets.at(-1).symbol='<script>';assert.throws(()=>validateDeployment(m,'http://127.0.0.1:4190'));
});
test('source9 retains exact published signer and disabled build inputs',async()=>{
  const signer=await readFile(new URL('../browser-wallet.js',import.meta.url));
  const {createHash}=await import('node:crypto');assert.equal(createHash('sha256').update(signer).digest('hex'),'c8d9b9a96fb815be497e914e7f3054f3cd39bade73870396e36199495f07b106');
  const view=await readFile(new URL('../deployment-view.js',import.meta.url),'utf8');assert.match(view,/const localSigning=m\.schema!==4&&/);assert.match(view,/const ready=m\.schema!==4&&m\.environment==='rehearsal'/);
  const {DEPLOYMENT}=await import('../deployment-config.js'),{INTEGRATION_DEPLOYMENT}=await import('../integration-config.js');assert.equal(DEPLOYMENT,null);assert.equal(INTEGRATION_DEPLOYMENT,null);
});
test('terminal artwork matches on-chain activated fallback while the custody label remains exited',()=>{
  const {f}=setup('principal_ready');assert.equal(f.nft.position.evolution,'lp_exited');
  const art=positionArtwork(f.nft);assert.equal(art.evolution,'activated');assert.equal(f.nft.position.evolution,'lp_exited');
});
test('actual checkpoint2 handler composes complete collection and wallet totals without inventing USD',async()=>{
  const s=setup('checkpoint2_earnings'),inventory=s.f.outputs.inventory;
  const [collection,totals]=await Promise.all([s.api.collectionPositions({}),s.api.walletTotals(inventory)]);
  assert.equal(collection.count,3);assert.equal(collection.activated,2);assert.equal(totals.count,inventory.count);
  assert.equal(totals.claimable_eth_wei,s.f.outputs.wallet_summary.claimable_eth_wei);
});
test('actual checkpoint2 earnings preserve complete current-currency history and raw-window scope',async()=>{
  const s=setup('checkpoint2_earnings'),report=await s.api.collectionEarnings({});
  assert.equal(report.claims_and_conversions_are_income,false);
  assert.deepEqual(report.all_time,s.f.outputs.full_raw_earnings.all_time);
  assert.deepEqual(report.last_24h,s.f.outputs.full_raw_earnings.last_24h);
  const wallet=await s.api.walletEarnings(s.f.outputs.inventory,{});assert.equal(wallet.available,true);
});


test('activation gas2 requires explicit source9 opt-in while omitted policy remains gas1',()=>{
  const {m}=setup('active_single'),origin='http://127.0.0.1:4190';
  assert.equal(validateDeployment(m,origin).activation_policy_schema,undefined);
  for(const selected of [1,2]){const n=structuredClone(m);n.activation_policy_schema=selected;n.limits.gas=selected===2?16000000:12000000;assert.equal(validateDeployment(n,origin).activation_policy_schema,selected);}
  for(const value of [null,0,3,'2',true]){const n=structuredClone(m);n.activation_policy_schema=value;assert.throws(()=>validateDeployment(n,origin));}
  for(const value of [undefined,1]){const n=structuredClone(m);if(value!==undefined)n.activation_policy_schema=value;n.limits.gas=16000000;assert.throws(()=>validateDeployment(n,origin));}
  const oversized=structuredClone(m);oversized.activation_policy_schema=2;oversized.limits.gas=64000001;assert.throws(()=>validateDeployment(oversized,origin));
});
