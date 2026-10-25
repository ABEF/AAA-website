// Explicit native-V2 read/unsigned profile. No wallet, signing or broadcast.
const ZERO='0x'+'0'.repeat(40), ZERO_HASH='0x'+'0'.repeat(64);
const ADDRESS=/^0x[0-9a-f]{40}$/, HASH=/^0x[0-9a-f]{64}$/;
const fail=message=>{throw Error(message);};
const integer=(x,a,b)=>Number.isSafeInteger(x)&&x>=a&&x<=b;
const keys=(x,wanted)=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).sort().join()===wanted.slice().sort().join();
const code=x=>typeof x==='string'&&/^0x(?:[0-9a-f]{2})+$/.test(x)&&x.length<=100002;
const word=n=>BigInt(n).toString(16).padStart(64,'0'),addr=a=>a.slice(2).padStart(64,'0');
export const NATIVE_ROLES=['access','nft','vault','entry','claim_router','oracle','pools','budget','activation_assets','contribution_pricing'];
export const NATIVE_VERSIONS=['accounting_version','pricing_version','routing_version','review_policy_version'];
export function validateNativeManifest(m){
  if(m.accounting_version!==2||m.pricing_version!==2||m.routing_version!==2||m.review_policy_version!==1||
    !keys(m.contracts,NATIVE_ROLES)||!integer(m.limits?.maximum_contribution_loss_bps,0,1000))fail('Explicit reviewed native-V2 deployment policy is required');
  for(const a of m.input_assets){
    if(!keys(a,['symbol','address','decimals','valuation_asset','route_id','route_kind','enabled','runtime_code','price_policy_id','asset_policy_id'])||
      !['ETH','ZZZ','USDC','USDG'].includes(a.symbol)||!ADDRESS.test(a.address)||!integer(a.decimals,0,18)||
      a.valuation_asset!==a.address||!HASH.test(a.route_id)||typeof a.enabled!=='boolean'||
      !HASH.test(a.price_policy_id)||a.price_policy_id===ZERO_HASH||!HASH.test(a.asset_policy_id)||a.asset_policy_id===ZERO_HASH||
      !integer(a.route_kind,0,2)||((a.route_kind===0)!==(a.route_id===ZERO_HASH))||
      ((a.symbol==='ETH')!==(a.address===ZERO))||
      (a.address===ZERO?(a.decimals!==18||a.runtime_code!==null||(a.route_kind!==0&&a.route_kind!==2)):!code(a.runtime_code)))fail('Invalid reviewed native asset, price policy or typed route');
  }
}
const SELECTORS={
  'ACCOUNTING_VERSION()':'0xebbc42b6','PRICING_VERSION()':'0x5f9c8132','REVIEW_POLICY_VERSION()':'0x96b09228',
  'ENTRY_REVIEW_VERSION()':'0x49de0529','migrationBudget()':'0x7d13e4db','contributionPricing()':'0x2cf518cc',
  'oracle()':'0x7dc0d1d0','vault()':'0xfbfa77cf','access()':'0x71907f17','registry()':'0x7b103999',
  'activationEntry()':'0x5dbf78a2','activationAssets()':'0x5b703199','MAX_LOSS_BPS()':'0xc187241c',
  'contributionLossBps()':'0xa7b5810c','activePolicy(address)':'0x237a06fb','tokenDecimals(address)':'0x8ee573ac',
  'priceBounds(address)':'0x4cbb3d60','policies(bytes32)':'0xddbfd8ef','routeKind(bytes32)':'0x2e4c02f3',
  'routeEnabled(bytes32)':'0x2e59691a','active()':'0x02fb0c5e','module(bytes32)':'0xe8cffd1d','nft()':'0x47ccca02','claimRouter()':'0xbc1bc485'
};
export class NativeProfile {
  constructor(manifest,reader){this.m=manifest;this.reader=reader;this.verified=new Map();}
  async call(role,signature,argument='',block,count=1){
    const result=await this.reader.request({method:'eth_call',params:[{to:this.m.contracts[role].address,data:SELECTORS[signature]+argument},block]});
    if(typeof result!=='string'||!new RegExp('^0x[0-9a-fA-F]{'+count*64+'}$').test(result))fail('Native deployment returned malformed '+signature);
    return result.slice(2).toLowerCase().match(/.{64}/g);
  }
  async verify(block){
    if(!HASH.test(block?.blockHash)||block.requireCanonical!==true)fail('Native profile needs a confirmed canonical block');
    const key=block.blockHash;if(this.verified.has(key))return this.verified.get(key);
    const pending=this._verify(block);this.verified.set(key,pending);
    while(this.verified.size>4)this.verified.delete(this.verified.keys().next().value);
    try{await pending;}catch(error){this.verified.delete(key);throw error;}
  }
  async _verify(block){
    const m=this.m;
    await Promise.all(Object.values(m.contracts).map(async c=>{
      if(await this.reader.request({method:'eth_getCode',params:[c.address,block]})!==c.runtime_code)fail('A reviewed native contract implementation changed');
    }));
    const numbers=[['vault','ACCOUNTING_VERSION()',2],['oracle','PRICING_VERSION()',2],['entry','REVIEW_POLICY_VERSION()',1],
      ['contribution_pricing','ENTRY_REVIEW_VERSION()',1],['budget','MAX_LOSS_BPS()',1000],['contribution_pricing','active()',0]];
    const bindings=[['vault','migrationBudget()','budget'],['vault','access()','access'],['nft','access()','access'],
      ['nft','claimRouter()','claim_router'],['claim_router','access()','access'],['claim_router','nft()','nft'],
      ['budget','vault()','vault'],['budget','access()','access'],
      ['oracle','contributionPricing()','contribution_pricing'],['oracle','access()','access'],
      ['contribution_pricing','oracle()','oracle'],['contribution_pricing','access()','access'],
      ['entry','registry()','pools'],['entry','activationAssets()','activation_assets'],['entry','access()','access'],
      ['pools','activationEntry()','entry'],['pools','activationAssets()','activation_assets'],['pools','access()','access'],
      ['activation_assets','registry()','pools'],['activation_assets','access()','access']];
    const modules=[['vault','411f1fc1c0e7b1fef9670835d6b39dd39cdfaadfae26102258b61be58c80b968'],
      ['nft','86798dfd34b3cf289e7582d0460beda645ea24721422547e964271fa9bdb63e5'],
      ['oracle','bf820fa66fadba8f93ff177e73b8d9962881eaa782ee4924feadac7ed13eaf38'],
      ['pools','e172fc22ef4736794abb342530a7acc3f7d6bbf4f70bb0141fa0aa0eaa39a6a7']];
    await Promise.all([...numbers.map(async([role,method,wanted])=>{
      if(BigInt('0x'+(await this.call(role,method,'',block))[0])!==BigInt(wanted))fail('Native contract version/policy differs: '+method);
    }),...bindings.map(async([role,method,target])=>{
      if((await this.call(role,method,'',block))[0]!==addr(m.contracts[target].address))fail('Native contract parent binding differs: '+method);
    }),...modules.map(async([role,id])=>{
      if((await this.call('access','module(bytes32)',id,block))[0]!==addr(m.contracts[role].address))fail('Native controller module differs: '+role);
    })]);
  }
  async cap(block){
    await this.verify(block);const value=BigInt('0x'+(await this.call('budget','contributionLossBps()','',block))[0]);
    if(value>1000n||value>BigInt(this.m.limits.maximum_contribution_loss_bps))fail('Contribution loss policy exceeds this reviewed deployment ceiling');
    return Number(value);
  }
  async price(asset,block){
    await this.verify(block);
    if(asset.address!==ZERO){
      const [runtime,digits]=await Promise.all([
        this.reader.request({method:'eth_getCode',params:[asset.address,block]}),
        this.reader.request({method:'eth_call',params:[{to:asset.address,data:'0x313ce567'},block]})]);
      if(runtime!==asset.runtime_code||typeof digits!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(digits)||BigInt(digits)!==BigInt(asset.decimals))fail('Contribution token identity or decimals changed');
    }
    const [policy,admission,digits,bounds,record,kind]=await Promise.all([
      this.call('oracle','activePolicy(address)',addr(asset.address),block),
      this.call('activation_assets','activePolicy(address)',addr(asset.address),block),
      this.call('oracle','tokenDecimals(address)',addr(asset.address),block),
      this.call('oracle','priceBounds(address)',addr(asset.address),block,3),
      this.call('activation_assets','policies(bytes32)',asset.asset_policy_id.slice(2),block,6),
      this.call('entry','routeKind(bytes32)',asset.route_id.slice(2),block)]);
    if('0x'+policy[0]!==asset.price_policy_id||'0x'+admission[0]!==asset.asset_policy_id||BigInt('0x'+digits[0])!==BigInt(asset.decimals)||
      record[0]!==addr(asset.address)||BigInt('0x'+record[1])!==1n||record[2]==='0'.repeat(64)||record[3]==='0'.repeat(64)||
      BigInt('0x'+record[4])!==BigInt(asset.decimals)||BigInt('0x'+record[5])>1n||BigInt('0x'+kind[0])!==BigInt(asset.route_kind))fail('Contribution price/admission/route policy differs from its reviewed identity');
    if(asset.route_kind!==0&&BigInt('0x'+(await this.call('entry','routeEnabled(bytes32)',asset.route_id.slice(2),block))[0])!==1n)fail('Reviewed contribution route is disabled');
    const lower=BigInt('0x'+bounds[0]),upper=BigInt('0x'+bounds[1]),fingerprint='0x'+bounds[2];
    if(lower<=0n||upper<lower||upper>10n**36n||fingerprint===ZERO_HASH)fail('Dual-source price bounds are unavailable or invalid');
    return {lower,upper,fingerprint,policy_id:asset.price_policy_id,asset:asset.address};
  }
}
