import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateDeployment,DeploymentAPI,isAccounting7Profile} from '../deployment-api.js';
import {integrationPolicy} from '../integration-app.js';
import {integrationProfileIdentity} from '../build-integration.mjs';
import {supportsLocalSigning,contributionPolicyText} from '../deployment-view.js';
import {source10ProfileFixture} from './helpers/source10-profile-fixture.mjs';
import {source9ProfileFixture} from './helpers/source9-profile-fixture.mjs';
const origin='http://127.0.0.1:4190';
function complete(manifest){return {...manifest,mode:'read-and-prepare',environment:'rehearsal',id:'1'.repeat(64),chain_name:'Synthetic V10 fixture',genesis_hash:'0x'+'1'.repeat(64),deployment_block:1,deployment_block_hash:'0x'+'2'.repeat(64),confirmations:1,max_age_seconds:120,api_prefix:'/api',rpc_url:origin+'/rpc',projection_sha256:'2'.repeat(64),transaction_sha256:'3'.repeat(64),activation_sha256:'4'.repeat(64),transaction_fee_review:'0x'+'3'.repeat(64),activation_fee_review:'0x'+'4'.repeat(64),pool_id:'0x'+'5'.repeat(64),limits:{...manifest.limits,gas:12000000,gas_price_wei:'100000000000',network_fee_wei:'10000000000000000',native_value_wei:'1000000000000000000',contribution_usd_18:'1000000000000000000000'}};}

test('exact V10 manifest selects the new unsigned profile and its identity without rewriting V9',()=>{
  const input=complete(source10ProfileFixture().manifest),before=structuredClone(input);
  const m=validateDeployment(input,origin),p=integrationPolicy(m,origin);
  assert.deepEqual(input,before);assert.equal(p.manifest.schema,5);assert.equal(isAccounting7Profile(m),true);
  assert.equal(new DeploymentAPI(m,{origin,reader:{request(){throw Error('Unexpected RPC');}}}).native.constructor.name,'Source10Profile');
  assert.equal(integrationProfileIdentity(m).canonical,'ZZZ_CANONICAL_SAME_CHAIN_EXACT_LP_SEADROP_V10');
  assert.equal(integrationProfileIdentity(m).mint_integration_version,2);
  assert.equal(m.limits.maximum_contribution_loss_bps,300);assert.match(contributionPolicyText(m),/3%/);
  const old=complete(source9ProfileFixture().manifest);assert.equal(validateDeployment(old,origin).schema,4);
  assert.equal(integrationProfileIdentity(old).canonical,'ZZZ_CANONICAL_SAME_CHAIN_EXACT_LP_V9');
  assert.equal(integrationProfileIdentity(old).mint_integration_version,undefined);
  assert.equal(old.limits.maximum_contribution_loss_bps,200);assert.equal(integrationProfileIdentity(null),null);
});

test('cross-profile relabeling, omitted mint channel and unexpected settings fail closed',()=>{
  const original=complete(source10ProfileFixture().manifest);
  for(const mutate of [m=>m.schema=4,m=>m.source_profile=9,m=>delete m.mint_integration_version,m=>m.mint_integration_version=1,m=>m.mint_integration_version=true,m=>m.accounting_version=10,m=>m.canonical_schema='0x'+'1'.repeat(64),m=>m.enable_signing=true,m=>m.contracts.seadrop_mint=m.contracts.nft]){
    const m=structuredClone(original);mutate(m);assert.throws(()=>validateDeployment(m,origin));
  }
  assert.throws(()=>integrationPolicy(original,'https://www.poplint.0xwave.com'));
  assert.throws(()=>integrationPolicy(original,'https://www.popldemo.0xwave.com'));
});

test('local signing is an explicit legacy capability, never inherited by new or unknown schemas',()=>{
  const base={environment:'rehearsal',chain_id:31337,rpc_url:'http://127.0.0.1:8545'};
  for(const schema of [1,2,3])assert.equal(supportsLocalSigning({...base,schema}),true);
  for(const schema of [4,5,6,0,undefined,'3',true])assert.equal(supportsLocalSigning({...base,schema}),false);
  for(const change of [{environment:'production'},{chain_id:1},{rpc_url:'https://127.0.0.1:8545'},{rpc_url:'http://localhost:8545'},{rpc_url:'https://rpc.example.test'}])assert.equal(supportsLocalSigning({...base,schema:3,...change}),false);
});

test('mint and readiness are rejected before fetching or probing anything for V10',async()=>{
  const m=complete(source10ProfileFixture().manifest);let calls=0;
  const api=new DeploymentAPI(m,{origin,reader:{request(){calls++;throw Error('No RPC allowed');}},fetcher(){calls++;throw Error('No HTTP allowed');}});
  await assert.rejects(api.prepare({action:'mint',account:'0x'+'7'.repeat(40)}),/OpenSea/);
  await assert.rejects(api.readiness(),/OpenSea/);assert.equal(calls,0);
});

test('source10 keeps shared signing and both public build configurations unchanged',async()=>{
  const signer=await readFile(new URL('../browser-wallet.js',import.meta.url));
  assert.equal(createHash('sha256').update(signer).digest('hex'),'c8d9b9a96fb815be497e914e7f3054f3cd39bade73870396e36199495f07b106');
  const source=await readFile(new URL('../deployment-view.js',import.meta.url),'utf8');
  assert.match(source,/const localSigning=supportsLocalSigning\(m\)/);assert.match(source,/if\(localSigning\)transactions=new DeploymentTransactions/);
  const {DEPLOYMENT}=await import('../deployment-config.js'),{INTEGRATION_DEPLOYMENT}=await import('../integration-config.js');
  assert.equal(DEPLOYMENT,null);assert.equal(INTEGRATION_DEPLOYMENT,null);
});
