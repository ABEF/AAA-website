// Current backend DTOs come from the current exporter, never a relabeled V9 file.
// All RPC state is synthetic. Missing immutable-browser getters are separately
// identified graph fixtures, not EVM/provider evidence. Recorded replies win.
import {readFile} from 'node:fs/promises';
import {source10ProfileFixture,testAddress,testWord} from './source10-profile-fixture.mjs';
import {freshSelector,freshKeccak} from '../../deployment-source10.js';
export const source10DTOs=JSON.parse(await readFile(new URL('../fixtures/source10-api.json',import.meta.url)));
const stable=x=>Array.isArray(x)?x.map(stable):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])])):x;
const key=(method,params)=>method+':'+JSON.stringify(stable(params));
const hash=n=>'0x'+testWord(n);
const utf8=s=>'0x'+[...new TextEncoder().encode(s)].map(b=>b.toString(16).padStart(2,'0')).join('');
// Python's injected RPC uses integers internally. Serialize the standard wire
// quantities here, without relaxing the browser's hexadecimal RPC validator.
function wire(method,value){
  const quantity=x=>Number.isSafeInteger(x)&&x>=0?'0x'+BigInt(x).toString(16):x;
  if(['eth_chainId','eth_blockNumber','eth_gasPrice','eth_estimateGas','eth_getBalance'].includes(method))return quantity(value);
  if(['eth_getBlockByNumber','eth_getBlockByHash'].includes(method)&&value){const result=structuredClone(value);for(const k of ['number','timestamp','gasLimit','gasUsed','baseFeePerGas'])if(k in result)result[k]=quantity(result[k]);return result;}
  return structuredClone(value);
}
export function source10APISetup(name='active_single'){
  const f=structuredClone(source10DTOs.cases[name]);if(!f)throw Error('Unknown current V10 producer case');
  const protocol=f.outputs.protocol,nft=f.outputs.nft??Object.values(f.outputs.nfts??{})[0];
  const provenance=(protocol??f.outputs.draft??f.outputs.earnings).provenance,block={blockHash:provenance.block_hash,requireCanonical:true};
  const pins={...f.pins,...Object.fromEntries(Object.entries(f.read_configuration.contracts).map(([r,c])=>[r,c.address])),...f.browser_proof.pins};
  const s=source10ProfileFixture({contractPins:pins,assetRows:f.read_configuration.assets}),m=s.manifest;
  const producedCodes={...f.codes,...f.browser_proof.codes},codes={...Object.fromEntries(s.codes),...producedCodes};
  for(const c of Object.values(m.contracts)){if(!codes[c.address])throw Error('Missing synthetic browser runtime');c.runtime_code=codes[c.address];}
  for(const a of m.input_assets)if(a.address!==testAddress(0)){a.runtime_code=codes[a.address];if(!a.runtime_code)throw Error('Missing fixed ZZZ runtime');}
  const recorded=new Map(),callGetters=new Map(),calls=[],replySources=[];
  for(const r of [...f.rpc_responses,...f.browser_proof.rpc_responses]){recorded.set(key(r.method,r.params),r.result);if(r.method==='eth_call'&&JSON.stringify(r.params[1])===JSON.stringify(block))callGetters.set(r.params[0].to+':'+r.params[0].data,r.result);}
  s.set('seadrop_mint','seaDropCodeHash()',[freshKeccak(m.contracts.seadrop.runtime_code)]);
  for(const a of m.input_assets){
    const from=(role,signature)=>callGetters.get(m.contracts[role].address+':'+freshSelector(signature)+testWord(BigInt(a.address)));
    const price=from('oracle','activePolicy(address)'),admission=from('activation_assets','activePolicy(address)');
    if(price)a.price_policy_id='0x'+price.slice(-64);if(admission)a.asset_policy_id='0x'+admission.slice(-64);
    s.set('activation_assets','policies(bytes32)',[a.address,1,a.address===testAddress(0)?freshKeccak(utf8('ZZZ_NATIVE_ETH_V1')):freshKeccak(a.runtime_code),hash(500),a.decimals,0],a.asset_policy_id.slice(2));
  }
  Object.assign(m,{mode:'read-and-prepare',environment:'rehearsal',id:'a'.repeat(64),chain_name:'Synthetic V10 API fixture',genesis_hash:hash(12),deployment_block:f.read_configuration.deployment_block,deployment_block_hash:f.read_configuration.deployment_block_hash,confirmations:f.read_configuration.confirmations,max_age_seconds:f.read_configuration.max_block_age_seconds,api_prefix:'/api',rpc_url:'http://127.0.0.1:9999',projection_sha256:f.projection_identity,transaction_sha256:f.outputs.draft?.provenance.transaction_configuration_sha256??'1'.repeat(64),activation_sha256:f.outputs.draft?.provenance.activation_configuration_sha256??'2'.repeat(64),transaction_fee_review:f.transaction_configuration?.fee_policy.review_hash??hash(9),activation_fee_review:f.activation_configuration?.fee_policy.review_hash??hash(8),pool_id:f.request?.pool_id??nft?.position.local_custody?.pool_id??'0x'+'f'.repeat(64),reward_assets:f.read_configuration.assets.map(({address,symbol,decimals})=>({address,symbol,decimals})),transaction_policy_schema:f.transaction_configuration?.schema??1});
  if(f.activation_configuration?.schema===2)m.activation_policy_schema=2;
  Object.assign(m.limits,{gas:Number(f.transaction_configuration?.fee_policy.max_gas_limit??f.activation_configuration?.fee_policy.max_gas_limit??12000000),gas_price_wei:'100000000000',network_fee_wei:'1000000000000000000',native_value_wei:'1000000000000000000000',contribution_usd_18:'1000000000000000000000'});
  const reader={async request({method,params=[]}){
    calls.push({method,params});if(/send|sign|nonce|anvil|trace/i.test(method))throw Error('No signing, mutation or trace RPC in browser');
    const exact=key(method,params);if(recorded.has(exact)){replySources.push('produced');return wire(method,recorded.get(exact));}
    if(method==='eth_getBlockByNumber'&&params[0]==='0x0'){replySources.push('synthetic-genesis');return {hash:m.genesis_hash,number:'0x0',timestamp:'0x0'};}
    if(JSON.stringify(params[1])!==JSON.stringify(block))throw Error('Unpinned or missing produced read: '+method);
    if(method==='eth_getCode'&&codes[params[0]]){replySources.push(producedCodes[params[0]]?'produced-code':'synthetic-browser-code');return codes[params[0]];}
    if(method==='eth_call'){
      const k=params[0].to+':'+params[0].data;
      if(callGetters.has(k)){replySources.push('produced-getter');return structuredClone(callGetters.get(k));}
      if(s.getters.has(k)){replySources.push('synthetic-browser-getter');return s.getters.get(k);}
    }
    throw Error('No produced unsigned response: '+method+' '+JSON.stringify(params));
  }};
  const fetcher=async(url,options={})=>{
    const path=new URL(url).pathname.replace(/^\/api/,'');calls.push({path,body:options.body});
    const row=f.api_calls.find(r=>r.path===path&&r.method===(options.method??'GET'))??((options.method??'GET')==='GET'&&path==='/v1/protocol'&&protocol?{response_key:'protocol'}:(options.method??'GET')==='GET'&&nft&&path==='/v1/nfts/'+nft.token_id?{response_key:'nft'}:null);
    if(!row)throw Error('No produced API response: '+path);
    if(row.request&&options.body&&JSON.stringify(stable(row.request))!==JSON.stringify(stable(JSON.parse(options.body))))throw Error('Browser request differs from produced request: '+path);
    const output=row.response_key.split('.').reduce((value,part)=>value?.[part],f.outputs);
    if(output===undefined)throw Error('Missing produced payload: '+row.response_key);
    return new Response(JSON.stringify(output),{headers:{'Content-Type':'application/json'}});
  };
  return {m,f,pins,codes,reader,fetcher,calls,replySources,now:provenance.block_timestamp*1000,block,recorded,callGetters};
}
