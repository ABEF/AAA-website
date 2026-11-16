import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

// The optional root permits an external audit harness; normal maintained runs
// resolve the installed website source without modifying a build or service.
const root=process.env.POPL_SIGNING_AUDIT_ROOT?pathToFileURL(process.env.POPL_SIGNING_AUDIT_ROOT.replace(/\\/g,'/').replace(/\/?$/,'/')):new URL('../',import.meta.url);
const {DeploymentTransactions}=await import(new URL('deployment-transactions.js',root));
const {validateDeployment}=await import(new URL('deployment-api.js',root));
const {source9ProfileFixture}=await import(new URL('tests/helpers/source9-profile-fixture.mjs',root));
const {source10ProfileFixture}=await import(new URL('tests/helpers/source10-profile-fixture.mjs',root));
const origin='http://127.0.0.1:4190',account='0x'+'7'.repeat(40);
const complete=manifest=>({...manifest,mode:'read-and-prepare',environment:'rehearsal',id:'1'.repeat(64),chain_name:'Synthetic unsigned-profile fixture',genesis_hash:'0x'+'1'.repeat(64),deployment_block:1,deployment_block_hash:'0x'+'2'.repeat(64),confirmations:1,max_age_seconds:120,api_prefix:'/api',rpc_url:origin+'/rpc',projection_sha256:'2'.repeat(64),transaction_sha256:'3'.repeat(64),activation_sha256:'4'.repeat(64),transaction_fee_review:'0x'+'3'.repeat(64),activation_fee_review:'0x'+'4'.repeat(64),pool_id:'0x'+'5'.repeat(64),limits:{...manifest.limits,gas:12000000,gas_price_wei:'100000000000',network_fee_wei:'10000000000000000',native_value_wei:'1000000000000000000',contribution_usd_18:'1000000000000000000000'}});

for(const [label,fixture] of [['source9',source9ProfileFixture],['source10',source10ProfileFixture]])test(label+' unsigned profile rejects direct coordinator construction before wallet or RPC access',()=>{
  const manifest=validateDeployment(complete(fixture().manifest),origin);let calls=0;
  const provider={request(){calls++;throw Error('No wallet request permitted');},on(){calls++;throw Error('No signer listener permitted');}};
  const session={account,provider,revision:0,verify(){calls++;throw Error('No wallet verification permitted');}};
  const api={manifest,origin,reader:{request(){calls++;throw Error('No RPC permitted');}},prepare(){calls++;throw Error('No transaction preparation permitted');}};
  assert.throws(()=>new DeploymentTransactions(api,session),/restricted/);
  assert.equal(calls,0);
});

test('unknown, omitted and incorrectly typed schemas cannot inherit local signing',()=>{
  const base=complete(source9ProfileFixture().manifest);
  for(const schema of [0,6,undefined,null,'3',true])assert.throws(()=>new DeploymentTransactions({origin,manifest:{...base,schema}},{}),/restricted/);
});

test('the three admitted historical local schemas retain actual signer construction without sending',()=>{
  const target='0x'+'8'.repeat(40),listeners=[];
  for(const schema of [1,2,3]){
    const manifest={schema,environment:'rehearsal',chain_id:31337,rpc_url:origin+'/rpc',genesis_hash:'0x'+'1'.repeat(64),confirmations:1,contracts:{vault:{address:target,runtime_code:'0x60006000'}},input_assets:[],limits:{gas:12000000,gas_price_wei:'10',network_fee_wei:'120000000',native_value_wei:'1000000000000000000'}};
    const provider={request(){throw Error('No wallet request expected');},on(event){listeners.push(event);},removeListener(){}};
    const api={manifest,origin,reader:{request(){throw Error('No RPC expected');}}};
    const flow=new DeploymentTransactions(api,{account,provider});
    assert.equal(flow.canSend(),true);assert.equal(flow.wallet.constructor.name,'BrowserWallet');flow.wallet.close();
  }
  assert.equal(listeners.length,9);
});

test('existing nonlocal restrictions remain independent of the schema capability',()=>{
  const base=complete(source9ProfileFixture().manifest);
  for(const change of [{environment:'production'},{chain_id:4663},{rpc_url:'https://rpc.example.test'},{rpc_url:'http://localhost:8545'}])assert.throws(()=>new DeploymentTransactions({origin,manifest:{...base,schema:3,...change}},{}),/restricted/);
  assert.throws(()=>new DeploymentTransactions({origin:'https://www.poplint.0xwave.com',manifest:{...base,schema:3}},{}),/restricted/);
});
