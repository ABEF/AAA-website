import {freshKeccak,freshSelector} from './deployment-source9.js';
export {freshKeccak,freshSelector};
// Source10 is explicit Mint2/V10 read/unsigned authentication, never signing.
// Mutable phase, price, proof/payer/fee configuration and mint eligibility do not
// gate existing ownership, LP rewards, original-currency royalties or claims.
const ZERO='0x'+'0'.repeat(40),ZERO_HASH='0x'+'0'.repeat(64);
const ADDRESS=/^0x[0-9a-f]{40}$/,HASH=/^0x[0-9a-f]{64}$/;
const fail=message=>{throw Error(message);};
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v,wanted)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===wanted.slice().sort().join();
const canonicalBlock=block=>{if(!keys(block,['blockHash','requireCanonical'])||!HASH.test(block.blockHash)||block.requireCanonical!==true)fail('Source10 needs a pinned canonical block');return Object.freeze({blockHash:block.blockHash,requireCanonical:true});};
const code=v=>typeof v==='string'&&/^0x(?:[0-9a-f]{2})+$/.test(v)&&v.length<=100002;
const word=n=>BigInt(n).toString(16).padStart(64,'0'),addr=a=>a.slice(2).padStart(64,'0');
async function proofs(tasks){
  let cursor=0,failed=false;
  const results=await Promise.allSettled(Array.from({length:Math.min(6,tasks.length)},async()=>{for(;;){if(failed)return;const index=cursor++;if(index>=tasks.length)return;try{await tasks[index]();}catch(error){failed=true;throw error;}}}));
  const rejected=results.find(result=>result.status==='rejected');if(rejected)throw rejected.reason;
}

const utf8Hex=text=>'0x'+[...new TextEncoder().encode(text)].map(v=>v.toString(16).padStart(2,'0')).join('');

const labelHash=label=>freshKeccak(utf8Hex(label));
export const SOURCE10_CANONICAL_SCHEMA=labelHash('ZZZ_CANONICAL_SAME_CHAIN_EXACT_LP_SEADROP_V10');
export const SOURCE10_ROLES=Object.freeze(['access','nft','vault','rewards','royalties','claim_router','handoff','vault_canonical','principal_exit','rewards_canonical',
  'pools','liquidity','strategy','budget','portfolio_policy','rebalance_confirmation','balancing_router','lp_balance_math','lp_position_executor','protocol_policy','pool_manager','state_view','position_manager','permit2',
  'entry','oracle','activation_assets','contribution_pricing','fees','seadrop_mint','seadrop','metadata_renderer','nft_canonical']);
const VERSIONS=Object.freeze({source_profile:10,mint_integration_version:2,accounting_version:7,lp_allocation_version:1,custody_version:5,protocol_policy_version:1,royalty_settlement_version:4,royalty_reporting_schema:5,
  pricing_version:2,routing_version:3,review_policy_version:2,governance_version:2,fee_intake_version:1,portfolio_version:2,maintenance_policy_version:3,rebalance_confirmation_version:3,
  idle_compounding_version:4,lp_routing_version:2,execution_quality_version:1,residual_exit_version:1,residual_reinvest_version:1});
export const MINT_VERSIONS=Object.freeze([...Object.keys(VERSIONS),'canonical_schema','transaction_policy_schema','activation_policy_schema','execution_price_version']);
export function validateSource10Manifest(m){
  const execution=m.execution_price_version??0;
  if(!Number.isSafeInteger(execution)||![0,1].includes(execution))fail('Unsupported explicit source10 execution-price version');
  if(m.schema!==5||Object.entries(VERSIONS).some(([key,value])=>m[key]!==((key==='lp_routing_version'&&execution===1)?3:value))||![1,2].includes(m.transaction_policy_schema)||(m.activation_policy_schema!==undefined&&![1,2].includes(m.activation_policy_schema))||m.canonical_schema!==SOURCE10_CANONICAL_SCHEMA||!keys(m.contracts,SOURCE10_ROLES))fail('Explicit source10/accounting7 exact-LP deployment profile is required');
  const used=new Set();for(const role of SOURCE10_ROLES){const c=m.contracts[role];if(!keys(c,['address','runtime_code'])||!ADDRESS.test(c.address)||c.address===ZERO||used.has(c.address)||!code(c.runtime_code))fail('Invalid source10 contract runtime pin');used.add(c.address);}
  if(!integer(m.limits?.maximum_contribution_loss_bps,0,1000)||!Array.isArray(m.input_assets)||m.input_assets.length!==2)fail('Source10 requires reviewed ETH and fixed ZZZ contribution policy');
  const symbols=new Set(),assets=new Set();
  for(const a of m.input_assets){
    if(!keys(a,['symbol','address','decimals','valuation_asset','enabled','runtime_code','price_policy_id','asset_policy_id'])||!['ETH','ZZZ'].includes(a.symbol)||symbols.has(a.symbol)||!ADDRESS.test(a.address)||assets.has(a.address)||used.has(a.address)||
      !integer(a.decimals,0,18)||a.valuation_asset!==a.address||typeof a.enabled!=='boolean'||!HASH.test(a.price_policy_id)||a.price_policy_id===ZERO_HASH||!HASH.test(a.asset_policy_id)||a.asset_policy_id===ZERO_HASH||
      ((a.symbol==='ETH')!==(a.address===ZERO))||(a.address===ZERO?(a.decimals!==18||a.runtime_code!==null):!code(a.runtime_code)))fail('Invalid source10 direct contribution asset or policy');
    symbols.add(a.symbol);assets.add(a.address);
  }
  if(!Array.isArray(m.reward_assets)||!m.reward_assets.length||m.reward_assets.length>66)fail('Invalid source10 reward descriptor inventory');
  const rewards=new Set();for(const a of m.reward_assets){if(!keys(a,['address','symbol','decimals'])||!ADDRESS.test(a.address)||used.has(a.address)||rewards.has(a.address)||!integer(a.decimals,0,36)||typeof a.symbol!=='string'||!/^[A-Za-z0-9._-]{1,16}$/.test(a.symbol)||(a.address===ZERO&&(a.symbol!=='ETH'||a.decimals!==18)))fail('Invalid source10 reviewed reward descriptor');rewards.add(a.address);}
  for(const input of m.input_assets){const reward=m.reward_assets.find(a=>a.address===input.address);if(!reward||reward.symbol!==input.symbol||reward.decimals!==input.decimals)fail('Source10 LP reward ETH/ZZZ descriptors differ from contribution identities');}
}

const MODULES={nft:'ZZZNFT',vault:'ZZZVault',rewards:'ZZZRewards',handoff:'ZZZCanonicalHandoff',vault_canonical:'ZZZVaultCanonical',principal_exit:'ZZZMigration',
  nft_canonical:'ZZZNFTCanonical',pools:'ZZZPoolRegistry',liquidity:'ZZZLiquidityManager',strategy:'ZZZStrategy',oracle:'ZZZOracle',fees:'ZZZFeeController'};
const BINDINGS=[['nft','seaDropMint()','seadrop_mint'],['seadrop_mint','nft()','nft'],['seadrop_mint','seaDrop()','seadrop'],
  ['nft','metadataRenderer()','metadata_renderer'],['nft','canonicalModule()','nft_canonical'],['nft_canonical','nft()','nft'],['nft','royaltyRewards()','royalties'],['royalties','nft()','nft'],['nft','claimRouter()','claim_router'],['claim_router','nft()','nft'],['claim_router','royalties()','royalties'],
  ['access','canonicalHandoff()','handoff'],['vault','canonicalModule()','vault_canonical'],['vault_canonical','vault()','vault'],['rewards','canonicalModule()','rewards_canonical'],['rewards_canonical','rewards()','rewards'],
  ['vault','migrationBudget()','budget'],['budget','vault()','vault'],['strategy','portfolioPolicy()','portfolio_policy'],['portfolio_policy','strategy()','strategy'],
  ['strategy','rebalanceConfirmation()','rebalance_confirmation'],['rebalance_confirmation','strategy()','strategy'],['liquidity','balancingRouter()','balancing_router'],['balancing_router','liquidityManager()','liquidity'],
  ['balancing_router','balanceMath()','lp_balance_math'],['lp_balance_math','balancer()','balancing_router'],['balancing_router','poolManager()','pool_manager'],['balancing_router','stateView()','state_view'],
  ['liquidity','positionOperator()','lp_position_executor'],['lp_position_executor','liquidityManager()','liquidity'],['lp_position_executor','positionManager()','position_manager'],['lp_position_executor','stateView()','state_view'],
  ['lp_position_executor','poolManager()','pool_manager'],['lp_position_executor','permit2()','permit2'],['lp_position_executor','balancingRouter()','balancing_router'],
  ['access','protocolPolicy()','protocol_policy'],['liquidity','positionManager()','position_manager'],['liquidity','stateView()','state_view'],['liquidity','poolManager()','pool_manager'],['liquidity','permit2()','permit2'],
  ['state_view','poolManager()','pool_manager'],['position_manager','poolManager()','pool_manager'],['position_manager','permit2()','permit2'],['pools','activationEntry()','entry'],['pools','activationAssets()','activation_assets'],
  ['entry','registry()','pools'],['entry','activationAssets()','activation_assets'],['activation_assets','registry()','pools'],['oracle','contributionPricing()','contribution_pricing'],['contribution_pricing','oracle()','oracle']];
const ACCESS_ROLES=['nft','vault','rewards','claim_router','handoff','vault_canonical','principal_exit','rewards_canonical','pools','liquidity','strategy','budget','portfolio_policy','rebalance_confirmation','balancing_router','lp_position_executor','protocol_policy','entry','oracle','activation_assets','contribution_pricing','fees','seadrop_mint','metadata_renderer','nft_canonical'];
const CAPABILITIES=[['seadrop_mint','MINT_INTEGRATION_VERSION()',1],['vault','ACCOUNTING_VERSION()',7],['rewards','LP_ALLOCATION_VERSION()',1],['access','GOVERNANCE_VERSION()',2],['access','isSealed()',1],['principal_exit','CUSTODY_VERSION()',5],['royalties','ROYALTY_SETTLEMENT_VERSION()',4],['fees','FEE_INTAKE_VERSION()',1],
  ['oracle','PRICING_VERSION()',2],['entry','ENTRY_ROUTING_VERSION()',3],['entry','REVIEW_POLICY_VERSION()',2],['contribution_pricing','ENTRY_REVIEW_VERSION()',2],['activation_assets','SOURCE_POLICY_VERSION()',1],
  ['strategy','MAINTENANCE_POLICY_VERSION()',3],['strategy','REBALANCE_CONFIRMATION_VERSION()',3],['rebalance_confirmation','REBALANCE_CONFIRMATION_VERSION()',3],['budget','IDLE_COMPOUNDING_VERSION()',4],['budget','REBALANCE_CONFIRMATION_VERSION()',3],
  ...['budget','principal_exit','liquidity'].map(role=>[role,'EMERGENCY_REBALANCE_VERSION()',2]),...['liquidity','strategy','portfolio_policy'].map(role=>[role,'PORTFOLIO_VERSION()',2]),['protocol_policy','PROTOCOL_POLICY_VERSION()',1],
  ...['liquidity','balancing_router'].map(role=>[role,'LP_ROUTING_VERSION()',2]),...['liquidity','balancing_router','strategy'].map(role=>[role,'EXECUTION_QUALITY_VERSION()',1]),['lp_balance_math','LP_BALANCE_MATH_VERSION()',1],['lp_position_executor','LP_POSITION_EXECUTOR_VERSION()',1],['budget','MAX_LOSS_BPS()',1000],
  ...['vault','principal_exit','liquidity','lp_position_executor'].map(role=>[role,'RESIDUAL_EXIT_VERSION()',1]),...['vault','principal_exit','budget','portfolio_policy','contribution_pricing'].map(role=>[role,'RESIDUAL_REINVEST_VERSION()',1])];
// A proof cache cannot be retargeted by later mutation of its caller's manifest.
const freezeData=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeData(child);Object.freeze(value);}return value;};
export class Source10Profile {
  constructor(manifest,reader){validateSource10Manifest(manifest);if(typeof reader?.request!=='function')fail('Source10 requires a read-only chain reader');this.m=freezeData(structuredClone(manifest));this.reader=reader;this.verified=new Map();}
  async call(role,signature,argument='',block,count=1){
    block=canonicalBlock(block);
    const result=await this.reader.request({method:'eth_call',params:[{to:this.m.contracts[role].address,data:freshSelector(signature)+argument},block]});
    if(typeof result!=='string'||!new RegExp('^0x[0-9a-fA-F]{'+count*64+'}$').test(result))fail('Source10 returned malformed '+signature);
    return result.slice(2).toLowerCase().match(/.{64}/g);
  }
  async verify(block){
    block=canonicalBlock(block);
    const key=block.blockHash;if(this.verified.has(key))return this.verified.get(key);
    const pending=this._verify(block);this.verified.set(key,pending);while(this.verified.size>4)this.verified.delete(this.verified.keys().next().value);
    try{await pending;}catch(error){this.verified.delete(key);throw error;}
  }
  async _verify(block){
    const m=this.m;
    await proofs(SOURCE10_ROLES.map(role=>async()=>{const c=m.contracts[role];if(await this.reader.request({method:'eth_getCode',params:[c.address,block]})!==c.runtime_code)fail('A reviewed source10 runtime changed: '+role);}));
    const bind=async(role,method,target,arg='')=>{if((await this.call(role,method,arg,block))[0]!==addr(m.contracts[target].address))fail('Source10 parent/module binding differs: '+role+'.'+method);};
    await proofs([...ACCESS_ROLES.map(role=>()=>bind(role,'access()','access')),...BINDINGS.map(([role,method,target])=>()=>bind(role,method,target)),
      ...Object.entries(MODULES).map(([role,label])=>()=>bind('access','module(bytes32)',role,labelHash(label).slice(2))),
      ...CAPABILITIES.map(([role,method,wanted])=>async()=>{const expected=(m.execution_price_version===1&&method==='LP_ROUTING_VERSION()')?3:wanted;if(BigInt('0x'+(await this.call(role,method,'',block))[0])!==BigInt(expected))fail('Source10 capability differs: '+role+'.'+method);}),
      ...(m.execution_price_version===1?[...['oracle','contribution_pricing','liquidity','balancing_router','lp_position_executor','strategy','lp_balance_math'].map(role=>async()=>{if(BigInt('0x'+(await this.call(role,'EXECUTION_PRICE_VERSION()','',block))[0])!==1n)fail('Source10 execution-price capability differs: '+role);}),()=>bind('liquidity','executionStrategy()','lp_balance_math')]:[]),
      ()=>bind('handoff','moduleAt(uint8)','rewards_canonical',word(3)),
      ()=>bind('handoff','moduleAt(uint8)','nft_canonical',word(0)),
      async()=>{const pinned='0x'+(await this.call('seadrop_mint','seaDropCodeHash()','',block))[0];if(pinned!==freshKeccak(m.contracts.seadrop.runtime_code))fail('Source10 SeaDrop runtime hash binding differs');},
      async()=>{if('0x'+(await this.call('handoff','SCHEMA()','',block))[0]!==SOURCE10_CANONICAL_SCHEMA)fail('Source10 canonical V10 schema differs');
        if(BigInt('0x'+(await this.call('vault','canonicalChainId()','',block))[0])!==BigInt(m.chain_id))fail('Source10 canonical chain differs');
        const governor=(await this.call('access','governance()','',block))[0];if(!/^0{24}[0-9a-f]{40}$/.test(governor)||governor==='0'.repeat(64)||governor===addr(m.contracts.access.address))fail('Invalid source10 governance identity');
        const zzz=m.input_assets.find(a=>a.symbol==='ZZZ').address;if((await this.call('activation_assets','zzz()','',block))[0]!==addr(zzz))fail('Source10 fixed ZZZ identity differs');}]);
  }
  async executionPolicy(block){
    block=canonicalBlock(block);await this.verify(block);
    if(this.m.execution_price_version!==1)fail('Execution context requires explicit source10 capability1');
    // Mutable financial controls do not gate holdings, claims or liveness.
    const [active,revision]=await Promise.all([this.call('oracle','executionActive()','',block),this.call('oracle','executionSourceRevision()','',block)]);
    const sourceRevision=BigInt('0x'+revision[0]);
    if(BigInt('0x'+active[0])!==0n||sourceRevision>=1n<<64n)fail('Source10 execution context is active or its source revision is invalid');
    return {source_revision:sourceRevision,context_active:false};
  }
  async cap(block){block=canonicalBlock(block);await this.verify(block);const cap=BigInt('0x'+(await this.call('budget','contributionLossBps()','',block))[0]);if(cap>1000n||cap>BigInt(this.m.limits.maximum_contribution_loss_bps))fail('Contribution loss policy exceeds the source10 reviewed ceiling');return Number(cap);}
  async price(asset,block){
    block=canonicalBlock(block);
    await this.verify(block);if(!this.m.input_assets.some(a=>a===asset||JSON.stringify(a)===JSON.stringify(asset)))fail('Unreviewed source10 contribution asset');
    if(asset.address!==ZERO){const [runtime,digits]=await Promise.all([this.reader.request({method:'eth_getCode',params:[asset.address,block]}),this.reader.request({method:'eth_call',params:[{to:asset.address,data:freshSelector('decimals()')},block]})]);
      if(runtime!==asset.runtime_code||typeof digits!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(digits)||BigInt(digits)!==BigInt(asset.decimals))fail('Source10 contribution token identity or decimals changed');}
    const [policy,admission,digits,bounds,record,admitted]=await Promise.all([this.call('oracle','activePolicy(address)',addr(asset.address),block),this.call('activation_assets','activePolicy(address)',addr(asset.address),block),
      this.call('oracle','tokenDecimals(address)',addr(asset.address),block),this.call('oracle','priceBounds(address)',addr(asset.address),block,3),this.call('activation_assets','policies(bytes32)',asset.asset_policy_id.slice(2),block,6),this.call('activation_assets','isContributionAsset(address)',addr(asset.address),block)]);
    const expectedCode=asset.address===ZERO?labelHash('ZZZ_NATIVE_ETH_V1'):freshKeccak(asset.runtime_code);
    if('0x'+policy[0]!==asset.price_policy_id||'0x'+admission[0]!==asset.asset_policy_id||BigInt('0x'+digits[0])!==BigInt(asset.decimals)||record[0]!==addr(asset.address)||BigInt('0x'+record[1])!==1n||'0x'+record[2]!==expectedCode||record[3]==='0'.repeat(64)||BigInt('0x'+record[4])!==BigInt(asset.decimals)||BigInt('0x'+record[5])>1n||BigInt('0x'+admitted[0])!==1n)fail('Source10 contribution price/admission policy differs');
    const lower=BigInt('0x'+bounds[0]),upper=BigInt('0x'+bounds[1]),fingerprint='0x'+bounds[2];if(lower<=0n||upper<lower||upper>10n**36n||fingerprint===ZERO_HASH)fail('Source10 dual-source price bounds are unavailable');
    return {lower,upper,fingerprint,policy_id:asset.price_policy_id,asset:asset.address};
  }
  async _policy(domain,block){
    block=canonicalBlock(block);
    await this.verify(block);
    // Policy values are deliberately re-read. Only immutable graph proofs are
    // cached at an exact block; no policy is reused across monetary snapshots.
    const metadata=domain==='metadata',count=metadata?3:4;
    const [values,fingerprint]=await Promise.all([this.call('protocol_policy',metadata?'metadataPolicy()':'entryPolicy()','',block,count),this.call('protocol_policy',metadata?'metadataFingerprint()':'entryFingerprint()','',block)]);
    const nums=values.map(v=>BigInt('0x'+v)),widths=metadata?[128n,128n,64n]:[128n,128n,16n,64n];
    if(nums.some((v,i)=>v>=1n<<widths[i])||nums.at(-1)===0n||(metadata?!(0n<nums[0]&&nums[0]<nums[1]):nums[0]<10n**18n||nums[1]<10n**18n||nums[1]>nums[0]||nums[2]>4000n))fail('Source10 '+domain+' policy exceeds approved bounds');
    const actual='0x'+fingerprint[0],expected=freshKeccak('0x'+addr(this.m.contracts.protocol_policy.address)+values.join(''));if(actual!==expected)fail('Source10 '+domain+' scoped policy fingerprint differs');
    return {version:1,domain,policy:this.m.contracts.protocol_policy.address,fingerprint:actual,...(metadata?{enhanced_usd_18:nums[0],singularity_usd_18:nums[1],revision:nums[2]}:{minimum_activation_usd_18:nums[0],minimum_growth_usd_18:nums[1],maximum_idle_bps:Number(nums[2]),revision:nums[3]})};
  }
  entryPolicy(block){return this._policy('entry',block);}
  metadataPolicy(block){return this._policy('metadata',block);}
}
