// Synthetic identity/transport fixture. No deployed provider or market evidence.
import {readFile} from 'node:fs/promises';
import {FRESH_ROLES,FRESH_CANONICAL_SCHEMA,FreshProfile,freshSelector,freshKeccak} from '../../deployment-source9.js';
const dtoFixtures=JSON.parse(await readFile(new URL('../fixtures/source9-api-v3.json',import.meta.url),'utf8'));
export const source9Block=Object.freeze({blockHash:'0x'+'b'.repeat(64),requireCanonical:true});
export const testAddress=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
export const testWord=n=>BigInt(n).toString(16).padStart(64,'0');
const hash=n=>'0x'+testWord(n),utf8=v=>'0x'+[...new TextEncoder().encode(v)].map(n=>n.toString(16).padStart(2,'0')).join('');
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export function source9ProfileFixture({contractPins=null,assetRows=null}={}){
  const contracts=Object.fromEntries(FRESH_ROLES.map((role,i)=>[role,{address:contractPins?.[role]??testAddress((contractPins?30000:0)+i+1),runtime_code:'0x60006000'}]));
  const zero=testAddress(0),asset={symbol:'ETH',address:zero,decimals:18,valuation_asset:zero,enabled:true,runtime_code:null,price_policy_id:hash(300),asset_policy_id:hash(301)};
  const token={...asset,symbol:'ZZZ',address:assetRows?.find(a=>a.symbol==='ZZZ')?.address??testAddress(100),valuation_asset:assetRows?.find(a=>a.symbol==='ZZZ')?.address??testAddress(100),runtime_code:'0x60016000',price_policy_id:hash(302),asset_policy_id:hash(303)};
  const manifest={schema:4,source_profile:9,accounting_version:7,lp_allocation_version:1,custody_version:5,protocol_policy_version:1,royalty_settlement_version:4,royalty_reporting_schema:5,
    pricing_version:2,routing_version:3,review_policy_version:2,governance_version:2,fee_intake_version:1,canonical_schema:FRESH_CANONICAL_SCHEMA,portfolio_version:2,maintenance_policy_version:3,rebalance_confirmation_version:3,
    idle_compounding_version:4,lp_routing_version:2,execution_quality_version:1,residual_exit_version:1,residual_reinvest_version:1,transaction_policy_schema:1,chain_id:31337,contracts,input_assets:[asset,token],reward_assets:[{address:zero,symbol:'ETH',decimals:18},{address:token.address,symbol:'ZZZ',decimals:18}],limits:{maximum_contribution_loss_bps:200}};
  const getters=new Map(),calls=[],codes=new Map(Object.values(contracts).map(c=>[c.address,c.runtime_code]));codes.set(token.address,token.runtime_code);
  const set=(role,signature,values,argument='')=>getters.set(contracts[role].address+':'+freshSelector(signature)+argument,'0x'+values.map(v=>typeof v==='bigint'||typeof v==='number'?testWord(v):v.replace(/^0x/,'').padStart(64,'0')).join(''));
  const binding=(role,signature,target)=>set(role,signature,[contracts[target].address]);
  for(const role of ['nft','vault','rewards','claim_router','handoff','vault_canonical','principal_exit','rewards_canonical','pools','liquidity','strategy','budget','portfolio_policy','rebalance_confirmation','balancing_router','lp_position_executor','protocol_policy','entry','oracle','activation_assets','contribution_pricing','fees'])binding(role,'access()','access');
  for(const [role,label] of Object.entries({nft:'ZZZNFT',vault:'ZZZVault',rewards:'ZZZRewards',handoff:'ZZZCanonicalHandoff',vault_canonical:'ZZZVaultCanonical',principal_exit:'ZZZMigration',pools:'ZZZPoolRegistry',liquidity:'ZZZLiquidityManager',strategy:'ZZZStrategy',oracle:'ZZZOracle',fees:'ZZZFeeController'}))set('access','module(bytes32)',[contracts[role].address],freshKeccak(utf8(label)).slice(2));
  for(const [role,signature,target] of [
    ['nft','royaltyRewards()','royalties'],['royalties','nft()','nft'],['nft','claimRouter()','claim_router'],['claim_router','nft()','nft'],['claim_router','royalties()','royalties'],
    ['access','canonicalHandoff()','handoff'],['vault','canonicalModule()','vault_canonical'],['vault_canonical','vault()','vault'],['rewards','canonicalModule()','rewards_canonical'],['rewards_canonical','rewards()','rewards'],
    ['vault','migrationBudget()','budget'],['budget','vault()','vault'],['strategy','portfolioPolicy()','portfolio_policy'],['portfolio_policy','strategy()','strategy'],['strategy','rebalanceConfirmation()','rebalance_confirmation'],['rebalance_confirmation','strategy()','strategy'],
    ['liquidity','balancingRouter()','balancing_router'],['balancing_router','liquidityManager()','liquidity'],['balancing_router','balanceMath()','lp_balance_math'],['lp_balance_math','balancer()','balancing_router'],['balancing_router','poolManager()','pool_manager'],['balancing_router','stateView()','state_view'],
    ['liquidity','positionOperator()','lp_position_executor'],['lp_position_executor','liquidityManager()','liquidity'],['lp_position_executor','positionManager()','position_manager'],['lp_position_executor','stateView()','state_view'],['lp_position_executor','poolManager()','pool_manager'],['lp_position_executor','permit2()','permit2'],['lp_position_executor','balancingRouter()','balancing_router'],
    ['access','protocolPolicy()','protocol_policy'],['liquidity','positionManager()','position_manager'],['liquidity','stateView()','state_view'],['liquidity','poolManager()','pool_manager'],['liquidity','permit2()','permit2'],['state_view','poolManager()','pool_manager'],['position_manager','poolManager()','pool_manager'],['position_manager','permit2()','permit2'],
    ['pools','activationEntry()','entry'],['pools','activationAssets()','activation_assets'],['entry','registry()','pools'],['entry','activationAssets()','activation_assets'],['activation_assets','registry()','pools'],['oracle','contributionPricing()','contribution_pricing'],['contribution_pricing','oracle()','oracle']])binding(role,signature,target);
  const numeric={vault:{ACCOUNTING_VERSION:7,RESIDUAL_EXIT_VERSION:1,RESIDUAL_REINVEST_VERSION:1,canonicalChainId:31337},rewards:{LP_ALLOCATION_VERSION:1},access:{GOVERNANCE_VERSION:2,isSealed:1},principal_exit:{CUSTODY_VERSION:5,EMERGENCY_REBALANCE_VERSION:2,RESIDUAL_EXIT_VERSION:1,RESIDUAL_REINVEST_VERSION:1},royalties:{ROYALTY_SETTLEMENT_VERSION:4},fees:{FEE_INTAKE_VERSION:1},oracle:{PRICING_VERSION:2},entry:{ENTRY_ROUTING_VERSION:3,REVIEW_POLICY_VERSION:2},contribution_pricing:{ENTRY_REVIEW_VERSION:2,RESIDUAL_REINVEST_VERSION:1},activation_assets:{SOURCE_POLICY_VERSION:1},strategy:{MAINTENANCE_POLICY_VERSION:3,REBALANCE_CONFIRMATION_VERSION:3,PORTFOLIO_VERSION:2,EXECUTION_QUALITY_VERSION:1},rebalance_confirmation:{REBALANCE_CONFIRMATION_VERSION:3},budget:{IDLE_COMPOUNDING_VERSION:4,REBALANCE_CONFIRMATION_VERSION:3,EMERGENCY_REBALANCE_VERSION:2,RESIDUAL_REINVEST_VERSION:1,MAX_LOSS_BPS:1000,contributionLossBps:200},liquidity:{PORTFOLIO_VERSION:2,LP_ROUTING_VERSION:2,EXECUTION_QUALITY_VERSION:1,EMERGENCY_REBALANCE_VERSION:2,RESIDUAL_EXIT_VERSION:1},portfolio_policy:{PORTFOLIO_VERSION:2,RESIDUAL_REINVEST_VERSION:1},protocol_policy:{PROTOCOL_POLICY_VERSION:1},balancing_router:{LP_ROUTING_VERSION:2,EXECUTION_QUALITY_VERSION:1},lp_balance_math:{LP_BALANCE_MATH_VERSION:1},lp_position_executor:{LP_POSITION_EXECUTOR_VERSION:1,RESIDUAL_EXIT_VERSION:1}};
  for(const [role,values] of Object.entries(numeric))for(const [name,value] of Object.entries(values))set(role,name+'()',[value]);
  set('handoff','SCHEMA()',[FRESH_CANONICAL_SCHEMA]);set('handoff','moduleAt(uint8)',[contracts.rewards_canonical.address],testWord(3));set('access','governance()',[testAddress(200)]);set('activation_assets','zzz()',[token.address]);
  const policy=(domain,values)=>{set('protocol_policy',domain+'Policy()',values);set('protocol_policy',domain+'Fingerprint()',[freshKeccak('0x'+testWord(BigInt(contracts.protocol_policy.address))+values.map(testWord).join(''))]);};
  policy('entry',[100n*10n**18n,5n*10n**18n,500n,1n]);policy('metadata',[1000n*10n**18n,10000n*10n**18n,1n]);
  for(const a of manifest.input_assets){const argument=testWord(BigInt(a.address));set('oracle','activePolicy(address)',[a.price_policy_id],argument);set('activation_assets','activePolicy(address)',[a.asset_policy_id],argument);set('oracle','tokenDecimals(address)',[a.decimals],argument);set('oracle','priceBounds(address)',[10n**18n,101n*10n**16n,hash(400)],argument);set('activation_assets','isContributionAsset(address)',[1],argument);set('activation_assets','policies(bytes32)',[a.address,1,a.address===zero?freshKeccak(utf8('ZZZ_NATIVE_ETH_V1')):freshKeccak(a.runtime_code),hash(500),a.decimals,0],a.asset_policy_id.slice(2));}
  getters.set(token.address+':0x313ce567','0x'+testWord(18));
  const reader={async request(request){calls.push(request);if(request.method!=='eth_getCode'&&request.method!=='eth_call')throw Error('Non-read RPC in source9 fixture');if(JSON.stringify(request.params[1])!==JSON.stringify(source9Block))throw Error('Unpinned source9 read');const result=request.method==='eth_getCode'?codes.get(request.params[0]):getters.get(request.params[0].to+':'+request.params[0].data);if(result===undefined)throw Error('Unspecified synthetic source9 getter');return result;}};
  return {manifest,reader,calls,codes,getters,set,policy,profile:new FreshProfile(manifest,reader)};
}

// The core24 runtime graph and recorded replies below come from real Python
// Projection7 handlers with synthetic offline dependencies. Extra source roles
// and getters absent from that handler fixture are explicit synthetic additions,
// never claims of actual Entry3 execution or a deployed environment.
export function source9Setup(name='active_single'){
  const selected=dtoFixtures.cases[name];if(!selected)throw Error('Unknown source9 DTO fixture');
  const f=structuredClone(selected),base=dtoFixtures.cases.active_single;
  const reviewedPins=Object.fromEntries(Object.entries(f.read_configuration.contracts).map(([role,c])=>[role,c.address]));
  const s=source9ProfileFixture({contractPins:{...f.pins,...reviewedPins},assetRows:f.read_configuration.assets});
  const m=s.manifest,pins=Object.fromEntries(Object.entries(m.contracts).map(([role,c])=>[role,c.address]));
  for(const [role,c] of Object.entries(m.contracts)){if(f.codes[c.address])c.runtime_code=f.codes[c.address];s.codes.set(c.address,c.runtime_code);}
  for(const a of m.input_assets)if(a.address!==testAddress(0)&&f.codes[a.address]){a.runtime_code=f.codes[a.address];s.codes.set(a.address,a.runtime_code);}
  for(const a of m.input_assets)s.set('activation_assets','policies(bytes32)',[a.address,1,a.address===testAddress(0)?freshKeccak(utf8('ZZZ_NATIVE_ETH_V1')):freshKeccak(a.runtime_code),hash(500),a.decimals,0],a.asset_policy_id.slice(2));
  const protocol=f.outputs.protocol??base.outputs.protocol,nft=f.outputs.nft??Object.values(f.outputs.nfts??{})[0]??base.outputs.nft;
  const timestamp=(f.outputs.protocol??f.outputs.earnings??f.outputs.draft??protocol).provenance.block_timestamp;
  const blockHash=(f.outputs.protocol??f.outputs.earnings??f.outputs.draft??protocol).provenance.block_hash;
  const block={blockHash,requireCanonical:true},recorded=new Map(),calls=[];
  for(const row of f.rpc_responses){if(row.method==='eth_call')recorded.set(row.params[0].to+':'+row.params[0].data,row.result);}
  Object.assign(m,{mode:'read-and-prepare',environment:'rehearsal',id:'9'.repeat(64),chain_name:'Source9 offline fixture',genesis_hash:hash(12),deployment_block:f.read_configuration.deployment_block,deployment_block_hash:f.read_configuration.deployment_block_hash,
    confirmations:f.read_configuration.confirmations,max_age_seconds:f.read_configuration.max_block_age_seconds,api_prefix:'/api',rpc_url:'http://127.0.0.1:9999',projection_sha256:f.projection_identity,
    transaction_sha256:f.outputs.draft?.provenance.transaction_configuration_sha256??'1'.repeat(64),activation_sha256:'2'.repeat(64),transaction_fee_review:f.transaction_configuration?.fee_policy.review_hash??hash(9),activation_fee_review:hash(8),
    pool_id:nft.position.local_custody?.pool_id??'0x'+'f'.repeat(64),reward_assets:f.read_configuration.assets.map(({address,symbol,decimals})=>({address,symbol,decimals})),transaction_policy_schema:f.transaction_configuration?.schema??1});
  Object.assign(m.limits,{gas:Number(f.transaction_configuration?.fee_policy.max_gas_limit??12000000),gas_price_wei:'100000000000',network_fee_wei:'1000000000000000000',native_value_wei:'1000000000000000000000',contribution_usd_18:'1000000000000000000000'});
  const reader={async request({method,params=[]}){
    calls.push({method,params});
    if(/send|sign|anvil|trace/i.test(method))throw Error('Forbidden source9 fixture RPC');
    if(method==='eth_chainId')return '0x7a69';if(method==='eth_blockNumber')return '0x6e';
    if(method==='eth_getBlockByNumber'){
      if(params[0]==='0x0')return {hash:m.genesis_hash,number:'0x0',timestamp:'0x0'};
      if(params[0]==='0xa')return {hash:m.deployment_block_hash,number:'0xa',timestamp:'0xfa0'};
      const gasHeader=f.rpc_responses.find(row=>row.method==='eth_getBlockByHash'&&row.result?.hash===blockHash)?.result;
      return {hash:blockHash,number:'0x63',timestamp:'0x'+timestamp.toString(16),...(gasHeader?.gasLimit?{gasLimit:gasHeader.gasLimit}:{})};
    }
    if(method==='eth_getBlockByHash'){const original=f.rpc_responses.find(row=>row.method===method&&row.params[0]===params[0]);if(!original)throw Error('Missing recorded block gas policy');return structuredClone(original.result);}
    if(['eth_estimateGas','eth_getBalance','eth_gasPrice'].includes(method)){const original=f.rpc_responses.find(row=>row.method===method&&JSON.stringify(stable(row.params))===JSON.stringify(stable(params)));if(!original)throw Error('Missing exact recorded unsigned RPC '+method);return structuredClone(original.result);}
    if(JSON.stringify(params[1])!==JSON.stringify(block))throw Error('Source9 DTO read was not pinned');
    if(method==='eth_getCode'){const result=s.codes.get(params[0])??f.codes[params[0]];if(result===undefined)throw Error('Unspecified source9 DTO code');return result;}
    if(method==='eth_call'){const key=params[0].to+':'+params[0].data,result=recorded.has(key)?recorded.get(key):s.getters.get(key);if(result===undefined)throw Error('Unspecified source9 DTO getter '+params[0].data);return result;}
    throw Error('Unsupported source9 DTO read');
  }};
  const fetcher=async(url,options)=>{
    const path=new URL(url).pathname;calls.push({path,options});let result;
    if(path.endsWith('/protocol'))result=protocol;
    else if(path.endsWith('/claims/plan'))result=f.outputs.plan;
    else if(path.endsWith('/prepare'))result=f.outputs.draft;
    else if(path.endsWith('/earnings')){const id=path.match(/\/nfts\/([0-9]+)\/earnings$/)?.[1];result=id?(f.outputs.nft_earnings?.[id]??f.outputs.nft_earnings):f.outputs.earnings;}
    else if(path.includes('/wallets/')&&path.includes('/earnings/'))result=f.outputs.wallet_earnings;
    else if(path.includes('/wallets/')&&path.includes('/summary/'))result=f.outputs.wallet_summary;
    else if(path.includes('/wallets/')&&path.endsWith('/nfts'))result=f.outputs.inventory;
    else if(path.includes('/collection/'))result=f.outputs.collection;
    else if(path.includes('/nfts/')){const id=path.match(/\/nfts\/([0-9]+)$/)?.[1];result=f.outputs.nfts?.[id]??nft;}
    if(result===undefined)throw Error('Unspecified source9 DTO endpoint '+path);
    return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});
  };
  return {m,manifest:m,f:{...f,protocol,nft,draft:f.outputs.draft,plan:f.outputs.plan},pins,reader,fetcher,calls,now:timestamp*1000,block,profile:new FreshProfile(m,reader),rpc:recorded,synthetic:s.getters,
    set:(role,data,value)=>recorded.set(pins[role]+':'+data,value)};
}
