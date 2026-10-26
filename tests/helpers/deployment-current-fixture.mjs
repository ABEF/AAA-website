import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DeploymentAPI,ZERO} from '../../deployment-api.js';
import {CURRENT_ROLES,CURRENT_CANONICAL_SCHEMA} from '../../deployment-native.js';
const fixtures=JSON.parse(await readFile(new URL('../fixtures/deployment-current-api.json',import.meta.url)));
export const currentFixtureNames=Object.freeze(Object.keys(fixtures));
const hash=c=>'0x'+c.repeat(64),word=n=>BigInt(n).toString(16).padStart(64,'0'),aw=a=>a.slice(2).padStart(64,'0');
const block={blockHash:hash('b'),requireCanonical:true};
export function currentSetup(name='activate_eth',mutate=()=>{}){
  const f=structuredClone(fixtures[name]),pins=f.pins,rpc=new Map();
  for(const row of f.rpc_responses){const key=row.target+':'+row.data;assert.ok(!rpc.has(key)||rpc.get(key)===row.result);rpc.set(key,row.result);}
  // Source-bound browser-only immutable getters, explicitly absent from the
  // Python request fixture. No wildcard getter or all-purpose zero response.
  const ensure=(role,data,value)=>{const key=pins[role]+':'+data;if(!rpc.has(key))rpc.set(key,value);};
  for(const [role,data,target] of [['vault','0x71907f17','access'],['nft','0x71907f17','access'],['nft','0xbc1bc485','claim_router'],['claim_router','0x71907f17','access'],['claim_router','0x47ccca02','nft'],['access','0x2e0ea955','handoff']])ensure(role,data,'0x'+aw(pins[target]));
  for(const [role,id] of [['vault','411f1fc1c0e7b1fef9670835d6b39dd39cdfaadfae26102258b61be58c80b968'],['nft','86798dfd34b3cf289e7582d0460beda645ea24721422547e964271fa9bdb63e5'],['oracle','bf820fa66fadba8f93ff177e73b8d9962881eaa782ee4924feadac7ed13eaf38'],['pools','e172fc22ef4736794abb342530a7acc3f7d6bbf4f70bb0141fa0aa0eaa39a6a7'],['fees','a93341f4bc02ec5f35c323a55f9fd5355df1a75bdfec48a3279200374d036b04'],['handoff','8793ebf778da79e95ce07a99a87738bb03de82612fccea3b04b4a321177b66b7']])ensure('access','0xe8cffd1d'+id,'0x'+aw(pins[role]));
  ensure('fees','0x5b9715f3','0x'+word(1));
  for(const asset of f.inputs){ensure('oracle','0x8ee573ac'+aw(asset.address),'0x'+word(asset.decimals));ensure('entry','0x2e4c02f3'+asset.route_id.slice(2),'0x'+word(asset.route_kind));}
  const m={schema:3,mode:'read-and-prepare',environment:'rehearsal',id:'d'.repeat(64),accounting_version:3,governance_version:2,fee_intake_version:1,canonical_schema:CURRENT_CANONICAL_SCHEMA,pricing_version:2,routing_version:2,review_policy_version:1,chain_id:31337,chain_name:'Current3 API rehearsal',genesis_hash:hash('c'),deployment_block:10,deployment_block_hash:hash('a'),confirmations:12,max_age_seconds:120,api_prefix:'/api',rpc_url:'http://127.0.0.1:9999',projection_sha256:f.projection_identity,transaction_sha256:f.draft.provenance.transaction_configuration_sha256||'1'.repeat(64),activation_sha256:f.draft.provenance.activation_configuration_sha256||'2'.repeat(64),transaction_fee_review:hash('9'),activation_fee_review:f.draft.network_gas.fee_policy_review_hash,contracts:Object.fromEntries(CURRENT_ROLES.map(k=>[k,{address:pins[k],runtime_code:f.codes[pins[k]]}])),pool_id:f.draft.pool_id||f.nft.position.local_custody?.pool_id,input_assets:f.inputs,reward_assets:[...new Map([...f.nft.claimable.lp,...f.nft.claimable.royalties].map(a=>[a.asset,{address:a.asset,symbol:a.symbol,decimals:a.decimals}])).values()],limits:{gas:12000000,gas_price_wei:'100000000000',network_fee_wei:'1000000000000000000',native_value_wei:'1000000000000000000000',contribution_usd_18:'1000000000000000000000',maximum_contribution_loss_bps:200}};
  const s={f,m,pins,rpc,calls:[],now:1000000};
  s.intent=name==='claim_eth_both'?{action:'claim',account:f.nft.owner,ids:[f.nft.token_id]}:{action:f.draft.action,account:f.nft.owner,id:f.nft.token_id,asset:name.includes('zzz')?'ZZZ':'ETH',amount:'100'};
  s.set=(role,data,value)=>rpc.set(pins[role]+':'+data,value);
  s.reader={request:async({method,params=[]})=>{
    s.calls.push({method,params});assert.ok(!/send|sign|anvil/i.test(method));
    if(method==='eth_chainId')return '0x7a69';if(method==='eth_blockNumber')return '0x6e';
    if(method==='eth_getBlockByNumber')return params[0]==='0x0'?{hash:m.genesis_hash}:params[0]==='0xa'?{hash:m.deployment_block_hash}:{hash:hash('b'),number:'0x63',timestamp:'0x3de'};
    if(method==='eth_getCode'){assert.deepEqual(params[1],block);assert.notEqual(params[0],ZERO);return f.codes[params[0]];}
    if(method==='eth_call'){assert.deepEqual(params[1],block);const v=rpc.get(params[0].to+':'+params[0].data);if(v===undefined)throw Error('Unspecified current getter '+params[0].data);return v;}
    throw Error('Unexpected method '+method);
  }};
  s.fetcher=async(url,options)=>{
    const path=new URL(url).pathname;s.calls.push({path,options});
    const result=path.endsWith('/protocol')?f.protocol:path.endsWith('/prepare')?f.draft:path.includes('/nfts/')?f.nft:null;
    assert.ok(result,'Unexpected endpoint '+path);return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
  };
  mutate(s);s.api=new DeploymentAPI(m,{origin:'http://127.0.0.1:4190',reader:s.reader,fetcher:s.fetcher,clock:()=>s.now});return s;
}
