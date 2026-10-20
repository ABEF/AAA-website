import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserClient,browserMode} from '../browser-client.js';
const A='0x'+'11'.repeat(20),B='0x'+'22'.repeat(20),ZERO='0x'+'0'.repeat(40);
const GENESIS='0x'+'44'.repeat(32),HASH='0x'+'55'.repeat(32),POOL='0x'+'66'.repeat(32);
const SESSION='a'.repeat(64),CODE='0x6000';
const roles={vault:'0x'+'31'.repeat(20),nft:'0x'+'32'.repeat(20),entry:'0x'+'33'.repeat(20),claim_router:'0x'+'34'.repeat(20)};
const clone=x=>JSON.parse(JSON.stringify(x));
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
const manifest=()=>({
  schema:1,mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,genesis_hash:GENESIS,accounts:[A,B],
  rpc_url:'http://127.0.0.1:60000',pool:POOL,native_eth_atomic:true,
  contracts:Object.fromEntries(Object.entries(roles).map(([name,address])=>[name,{address,runtime_code:CODE}])),
  input_assets:[
    {symbol:'ETH',address:ZERO,decimals:18,route_id:'0x'+'0'.repeat(64),enabled:true},
    {symbol:'ZZZ',address:'0x'+'41'.repeat(20),decimals:18,route_id:'0x'+'0'.repeat(64),enabled:true},
    {symbol:'USDG',address:'0x'+'42'.repeat(20),decimals:6,route_id:'0x'+'a'.repeat(64),enabled:true},
    {symbol:'USDC',address:'0x'+'43'.repeat(20),decimals:6,route_id:'0x'+'b'.repeat(64),enabled:true}
  ],mint_value_wei:'50000000000000000',confirmations:1,max_gas:1000000,max_gas_price_wei:'100',
  max_network_fee_wei:'100000000',
  policy:{chainId:'0x7a69',genesisHash:GENESIS,allowedTargets:Object.fromEntries(Object.values(roles).map(a=>[a,CODE])),
    maxGas:'0xf4240',maxGasPrice:'0x64',maxNetworkFee:'0x5f5e100',maxValue:'0xffffffffffffffff',confirmations:1}
});
const state=()=>({mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,revision:1,accounts:[A,B],nfts:[],uncertain:false,
  contracts:{...roles},pool:POOL,protocol:{lifecycle:{},provenance:{block_hash:HASH}}});
const mintDraft=()=>({draft_id:'d'.repeat(32),account:A,chain_id:31337,revision:1,action:'mint',requested_action:'mint',
  expires_at:Math.floor(Date.now()/1000)+55,transaction:{from:A,to:roles.vault,data:'0x21bf772d',value:'0xb1a2bc2ec50000',
    chainId:'0x7a69',gas:'0x7530',gasPrice:'0x2',nonce:'0x0'}});
const pending=()=>({status:'pending',hash:HASH,transaction:mintDraft().transaction,
  context:{draft_id:'d'.repeat(32),account:A,action:'mint',requested_action:'mint',session:SESSION}});
function setup({handler,send,recover,acknowledge,record=null,head}={}){
  const calls=[],signCalls=[],store=storage(),walletStore=storage();
  let saved=record;
  const signer={
    get pending(){return saved;},
    getPending:account=>saved?.transaction.from===account?saved:null,
    recover:async options=>{signCalls.push(['recover',options]);return recover?recover(options):{status:'confirmed',hash:HASH};},
    acknowledge:async hash=>{
      signCalls.push(['acknowledge',hash]);if(acknowledge)await acknowledge(hash);saved=null;
    },
    read:async(method,args)=>{
      signCalls.push(['read',method,args]);return head?head():{timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)};
    },
    review:async value=>{
      signCalls.push(['review',value]);if(!Number.isFinite(value.expiresAt)||value.expiresAt<=Date.now())throw Error('expired');
      return {reviewed:value};
    },
    send:async handle=>{
      signCalls.push(['send',handle]);
      if(send)return send(handle);
      saved=pending();saved.status='confirmed';return {status:'confirmed',hash:HASH};
    },
    assertConnection:async()=>{},
    close:()=>{}
  };
  const c=new BrowserClient({storage:store,walletStorage:walletStore,fetcher:async(path,options={})=>{
    const body=options.body?JSON.parse(options.body):undefined;calls.push({path,body});
    const custom=handler?await handler(path,body,c):undefined;
    const result=custom??(path==='/session'?{token:SESSION,mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,accounts:[A,B]}:
      path==='/browser/manifest'?manifest():path==='/state'?state():path==='/browser/prepare'?mintDraft():
      path==='/browser/confirm'?{status:'confirmed',uncertain:false,revision:2}:null);
    if(result===null)throw Error('Unexpected endpoint '+path);
    return {ok:true,json:async()=>clone(result)};
  }});
  c.signer=signer;c.wallet.state={address:A,chainId:'0x7a69',type:'browser',name:'Test extension'};
  const ready=()=>{c.manifest=manifest();c.session={token:SESSION};c.accounts=[A,B];c.account=A;c.connectionVerified=true;c.state=state();return c;};
  return {c,calls,signCalls,signer,ready,get saved(){return saved;},set saved(value){saved=value;}};
}
const submissions=e=>e.calls.filter(c=>c.path==='/action');

test('browser signing is explicit and restricted to the exact local mount',()=>{
  const valid={protocol:'http:',hostname:'127.0.0.1',pathname:'/app/',search:'?wallet=browser'};
  assert.equal(browserMode(valid),true);
  for(const change of [{hostname:'localhost'},{hostname:'popldemo.0xwave.com'},{protocol:'https:'},{pathname:'/'},{search:''},{search:'?wallet=local'}])
    assert.equal(browserMode({...valid,...change}),false);
});
test('refresh reads confirmed data without entering the server signing endpoint',async()=>{
  const e=setup();await e.c.refresh();
  assert.equal(e.c.account,A);assert.equal(e.c.state.revision,1);
  assert.deepEqual(e.calls.map(c=>c.path),['/session','/browser/manifest','/state']);
  assert.equal(submissions(e).length,0);assert.equal(e.signCalls.filter(c=>c[0]==='send').length,0);
});
test('refresh rejects an inventory differing from the local deployment',async()=>{
  const e=setup({handler:path=>path==='/session'?{token:SESSION,mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,accounts:[B,A]}:undefined});
  await assert.rejects(e.c.refresh(),/inventory/);assert.equal(e.c.state,null);assert.equal(submissions(e).length,0);
});
test('refresh rejects a changed chain identity instead of dropping the pending journal',async()=>{
  const e=setup({record:pending(),handler:path=>path==='/browser/manifest'?{...manifest(),genesis_hash:'0x'+'88'.repeat(32)}:undefined});
  e.ready();await assert.rejects(e.c.refresh(),/deployment changed/);
  assert.equal(e.saved.hash,HASH);assert.equal(e.signCalls.length,0);assert.equal(submissions(e).length,0);
});
test('refresh reconciles the saved hash and context, acknowledges only after backend confirmation',async()=>{
  const e=setup({record:pending()});
  const result=await e.c.refresh();
  assert.equal(result.status,'confirmed');assert.equal(e.c.pending,null);assert.equal(e.saved,null);
  assert.deepEqual(e.calls.find(c=>c.path==='/browser/confirm').body,{
    draft_id:'d'.repeat(32),account:A,transaction_hash:HASH});
  assert.deepEqual(e.signCalls.map(c=>c[0]),['recover','acknowledge']);
  assert.equal(submissions(e).length,0);
});
test('manual recovery hash is forwarded once without submitting another transaction',async()=>{
  const e=setup({record:{...pending(),hash:null}});e.c.recoveryHash=HASH;
  await e.c.refresh();
  assert.deepEqual(e.signCalls[0],['recover',{account:A,hash:HASH}]);
  assert.equal(e.c.recoveryHash,null);assert.equal(submissions(e).length,0);
});
test('unresolved wallet recovery retains the journal and does not call backend confirm',async()=>{
  const e=setup({record:pending(),recover:async()=>({status:'pending',hash:HASH})});
  assert.equal((await e.c.refresh()).status,'pending');assert.equal(e.c.pending.hash,HASH);
  assert.equal(e.calls.some(c=>c.path==='/browser/confirm'),false);
  assert.equal(e.signCalls.some(c=>c[0]==='acknowledge'),false);assert.equal(submissions(e).length,0);
});
test('backend observer failure preserves the signed transaction for hash-only recovery',async()=>{
  const e=setup({record:pending(),handler:path=>{if(path==='/browser/confirm')throw Error('backend offline');}});
  await assert.rejects(e.c.refresh(),/offline/);
  assert.equal(e.saved.hash,HASH);assert.equal(e.c.pending.hash,HASH);assert.equal(e.c.state,null);
  assert.equal(e.signCalls.some(c=>c[0]==='acknowledge'),false);assert.equal(submissions(e).length,0);
});
test('a lost backend confirmation response is retried as observation, never as payment',async()=>{
  let confirmCalls=0;
  const e=setup({record:pending(),handler:path=>{if(path==='/browser/confirm'&&++confirmCalls===1)throw Error('lost response');}});
  await assert.rejects(e.c.refresh(),/lost response/);await e.c.refresh();
  const bodies=e.calls.filter(c=>c.path==='/browser/confirm').map(c=>c.body);
  assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);
  assert.equal(e.signCalls.filter(c=>c[0]==='send').length,0);assert.equal(submissions(e).length,0);
});
test('foreign saved session cannot be acknowledged against a new local backend',async()=>{
  const e=setup({record:{...pending(),context:{...pending().context,session:'b'.repeat(64)}}});
  await assert.rejects(e.c.refresh(),/another local session/);
  assert.equal(e.saved.hash,HASH);assert.equal(e.calls.some(c=>c.path==='/browser/confirm'),false);
});
test('backend still-pending observation does not clear the confirmed-wallet journal',async()=>{
  const e=setup({record:pending(),handler:path=>path==='/browser/confirm'?{status:'pending'}:undefined});
  await assert.rejects(e.c.refresh(),/still pending/);
  assert.equal(e.saved.hash,HASH);assert.equal(e.signCalls.some(c=>c[0]==='acknowledge'),false);
});
test('receipt acknowledgement failure keeps recovery intact',async()=>{
  const e=setup({record:pending(),acknowledge:async()=>{throw Error('receipt reorg');}});
  await assert.rejects(e.c.refresh(),/reorg/);assert.equal(e.saved.hash,HASH);assert.equal(e.c.pending.hash,HASH);
});
test('fresh state must match the pinned pool and core contracts',async()=>{
  const e=setup({handler:path=>path==='/state'?{...state(),contracts:{...roles,vault:B}}:undefined});
  await assert.rejects(e.c.refresh(),/does not match/);assert.equal(e.c.state,null);
});
test('mint preparation reconstructs typed fields and never asks the server to sign',async()=>{
  const e=setup();e.ready();const draft=await e.c.prepare('mint',{account:B,action:'transfer'});
  assert.ok(draft.browserHandle);assert.equal(draft.clientVersion,e.c.version);
  assert.deepEqual(e.calls[0],{path:'/browser/prepare',body:{account:A,action:'mint'}});
  const review=e.signCalls.find(c=>c[0]==='review')[1];
  assert.deepEqual(review.expectedTransaction,{from:A,to:roles.vault,data:'0x21bf772d',value:'0xb1a2bc2ec50000',chainId:'0x7a69'});
  assert.deepEqual(review.context,{draft_id:'d'.repeat(32),account:A,action:'mint',requested_action:'mint',session:SESSION});
  assert.equal(submissions(e).length,0);assert.equal(e.signCalls.some(c=>c[0]==='send'),false);
});
test('unsupported intent is rejected before any request',async()=>{
  const e=setup();e.ready();
  for(const action of ['transfer','fund','execute','approve'])await assert.rejects(e.c.prepare(action),/Unsupported/);
  assert.equal(e.calls.length,0);
});
test('changed backend calldata is rejected before creating a wallet review',async()=>{
  const e=setup({handler:path=>path==='/browser/prepare'?{...mintDraft(),transaction:{...mintDraft().transaction,value:'0x1'}}:undefined});
  e.ready();await assert.rejects(e.c.prepare('mint'),/does not match/);
  assert.equal(e.signCalls.some(c=>c[0]==='review'),false);assert.equal(submissions(e).length,0);
});
test('changed account while preparing discards the draft',async()=>{
  const e=setup({handler:(path,_body,c)=>{if(path==='/browser/prepare'){c.account=B;c.version++;}return undefined;}});
  e.ready();await assert.rejects(e.c.prepare('mint'),/wallet changed/);
  assert.equal(e.signCalls.length,0);assert.equal(e.calls.some(c=>c.path==='/state'),false);
});
test('wallet change during final chain read invalidates the prepared review',async()=>{
  let e;
  e=setup({head:()=>{e.c.version++;return {timestamp:'0x'+Math.floor(Date.now()/1000).toString(16)};}});
  e.ready();await assert.rejects(e.c.prepare('mint'),/wallet changed/);
  assert.equal(e.signCalls.some(c=>c[0]==='send'),false);
});
test('expired returned drafts cannot become usable browser reviews',async()=>{
  const e=setup({handler:path=>path==='/browser/prepare'?{...mintDraft(),expires_at:1}:undefined});
  e.ready();await assert.rejects(e.c.prepare('mint'),/expired/);assert.equal(submissions(e).length,0);
});
test('execute returns the normal confirmed UI outcome after backend observation and acknowledgement',async()=>{
  const e=setup();e.ready();const draft=await e.c.prepare('mint');
  const result=await e.c.execute(draft);
  assert.deepEqual(result,{status:'confirmed',uncertain:false,revision:2});
  assert.equal(e.c.pending,null);assert.equal(e.c.state,null);assert.equal(e.c.version,draft.clientVersion+1);
  assert.deepEqual(e.signCalls.filter(c=>['send','acknowledge'].includes(c[0])).map(c=>c[0]),['send','acknowledge']);
  assert.equal(submissions(e).length,0);
});
test('confirmed reverted transaction is reconciled and reported failed without repeat',async()=>{
  const e=setup({record:pending(),recover:async()=>({status:'failed',hash:HASH}),
    handler:path=>path==='/browser/confirm'?{status:'failed',uncertain:false,error:'reverted'}:undefined});
  assert.equal((await e.c.refresh()).status,'failed');assert.equal(e.saved,null);
  assert.equal(e.signCalls.some(c=>c[0]==='send'),false);assert.equal(submissions(e).length,0);
});
test('wallet rejection does not prepare or submit an Entry transaction automatically',async()=>{
  const e=setup({send:async()=>{throw Object.assign(Error('rejected'),{code:4001});}});
  e.ready();const draft=await e.c.prepare('mint');
  await assert.rejects(e.c.execute(draft),err=>err.rejected===true);
  assert.equal(e.c.pending,null);assert.equal(e.signCalls.filter(c=>c[0]==='send').length,1);
  assert.equal(e.calls.filter(c=>c.path==='/browser/prepare').length,1);assert.equal(e.calls.some(c=>c.path==='/browser/confirm'),false);
});
test('pending submission blocks UI continuation and preserves hash recovery',async()=>{
  let e;
  e=setup({send:async()=>{e.saved=pending();return {status:'pending',hash:HASH};}});
  e.ready();const draft=await e.c.prepare('mint');
  await assert.rejects(e.c.execute(draft),/unresolved/);
  assert.equal(e.c.pending.hash,HASH);
  await assert.rejects(e.c.prepare('mint'),/refresh/);
  assert.equal(e.signCalls.filter(c=>c[0]==='send').length,1);assert.equal(submissions(e).length,0);
});
test('post-sign observer error retains the exact pending record',async()=>{
  const e=setup({handler:path=>{if(path==='/browser/confirm')throw Error('read offline');}});
  e.ready();const draft=await e.c.prepare('mint');
  await assert.rejects(e.c.execute(draft),/offline/);assert.equal(e.c.pending.hash,HASH);
  assert.equal(e.signCalls.some(c=>c[0]==='acknowledge'),false);assert.equal(submissions(e).length,0);
});
test('changed UI review cannot invoke the signer',async()=>{
  const e=setup();e.ready();const draft=await e.c.prepare('mint');e.c.version++;
  await assert.rejects(e.c.execute(draft),/review changed/);
  assert.equal(e.signCalls.some(c=>c[0]==='send'),false);
});
test('pending recovery prevents disconnect and direct fixture-account selection',()=>{
  const e=setup();e.ready();e.c.pending=pending();
  assert.throws(()=>e.c.select(null),/Recover/);assert.throws(()=>e.c.select(B),/browser wallet/);
  assert.equal(e.c.account,A);
});
function connectionFixture({account=A,chain='0x7a69',genesis=GENESIS}={}) {
  const e=setup(),values={account,chain,genesis,permissionCount:0},listeners=new Map(),rpcCalls=[];
  const provider={
    on:(name,fn)=>listeners.set(name,[...(listeners.get(name)||[]),fn]),
    removeListener:(name,fn)=>listeners.set(name,(listeners.get(name)||[]).filter(item=>item!==fn)),
    request:async({method})=>{
      rpcCalls.push(method);
      if(method==='eth_requestAccounts'){
        values.permissionCount++;
        if(values.permissionCount>1)(listeners.get('accountsChanged')||[]).forEach(fn=>fn([values.account||A]));
        if(!values.account)values.account=A;
        return [values.account];
      }
      if(method==='eth_accounts')return values.account?[values.account]:[];
      if(method==='eth_chainId')return values.chain;
      if(method==='eth_getBlockByNumber')return {hash:values.genesis};
      throw Error('Unexpected read '+method);
    }
  };
  e.ready();e.c.wallet.disconnect();e.c.signer=null;
  e.c.signerOptions={storage:storage(),readProvider:provider};
  e.c.providers=[{provider,id:'metamask-test',name:'MetaMask'}];
  return {...e,values,rpcCalls,provider};
}
test('connection diagnostics distinguish a usual account and preserve its authorized address',async()=>{
  const unrelated='0x'+'99'.repeat(20),e=connectionFixture({account:unrelated});
  await assert.rejects(e.c.connect(0),/not Test wallet/);
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  assert.equal(e.c.wallet.state.address,unrelated);
  assert.match(e.c.connectionError,new RegExp(unrelated));
  assert.match(e.c.connectionError,/connected-account permissions/);
  assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('connection diagnostics distinguish wrong chain from wrong account',async()=>{
  const e=connectionFixture({chain:'0x1'});
  await assert.rejects(e.c.connect(0),/different network/);
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  assert.match(e.c.connectionError,/Switch to the local network/);
  assert.doesNotMatch(e.c.connectionError,/not Test wallet/);
});
test('connection diagnostics show exact RPC correction for matching chain ID with wrong genesis',async()=>{
  const e=connectionFixture({genesis:'0x'+'88'.repeat(32)});
  await assert.rejects(e.c.connect(0),/reviewed local deployment/);
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  assert.match(e.c.connectionError,/different local chain/);
  assert.ok(e.c.connectionError.includes(manifest().rpc_url));
});
test('repeated same-provider connection uses public reads rather than a competing permission request',async()=>{
  const e=connectionFixture();await e.c.connect(0);await e.c.connect(0);
  assert.equal(e.values.permissionCount,1);assert.equal(e.c.account,A);
  assert.equal(e.c.connectionError,null);assert.equal(e.c.connectionVerified,true);
  assert.ok(e.rpcCalls.filter(method=>method==='eth_accounts').length>=3);
  assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('selecting the authorized fixture account recovers a previous rejected usual-account connection',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});
  await assert.rejects(e.c.connect(0));
  e.values.account=A;await e.c.connect(0);
  assert.equal(e.c.account,A);assert.equal(e.c.connectionError,null);assert.equal(e.c.connectionVerified,true);
  assert.equal(e.values.permissionCount,1);
});
test('same-provider retry rechecks genesis and remains blocked until the exact local RPC is selected',async()=>{
  const e=connectionFixture({genesis:'0x'+'88'.repeat(32)});
  await assert.rejects(e.c.connect(0));await assert.rejects(e.c.connect(0));
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  e.values.genesis=GENESIS;await e.c.connect(0);
  assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
  assert.equal(e.values.permissionCount,1);
});
test('refresh does not restore readiness after failed genesis validation',async()=>{
  const e=connectionFixture({genesis:'0x'+'88'.repeat(32)});
  await assert.rejects(e.c.connect(0));await e.c.refresh();
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  assert.match(e.c.connectionError,/different local chain/);
  assert.equal(e.c.state.revision,1);assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('lost authorization requests permission once again without reusing stale wallet state',async()=>{
  const e=connectionFixture();await e.c.connect(0);e.values.account=null;
  await e.c.connect(0);
  assert.equal(e.values.permissionCount,2);assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
});
test('review display recomputes exact gas maximum from transaction integers, ignoring backend labels',async()=>{
  const gas=29999999n,price=9999999999n;
  const draft={...mintDraft(),transaction:{...mintDraft().transaction,gas:'0x'+gas.toString(16),gasPrice:'0x'+price.toString(16)},
    network_gas:{max_cost_wei:'1',gas_limit:'1',gas_price_wei:'1',unexpected:'do not display'}};
  const e=setup({handler:path=>path==='/browser/prepare'?draft:undefined});e.ready();
  e.c.manifest.max_gas=30000000;e.c.manifest.max_gas_price_wei='10000000000';e.c.manifest.max_network_fee_wei='300000000000000000';
  Object.assign(e.c.manifest.policy,{maxGas:'0x1c9c380',maxGasPrice:'0x2540be400',maxNetworkFee:'0x429d069189e0000'});
  const result=await e.c.prepare('mint');
  assert.deepEqual(result.network_gas,{gas_limit:gas.toString(),gas_price_wei:price.toString(),max_cost_wei:'299999989970000001'});
  assert.equal(submissions(e).length,0);assert.equal(e.signCalls.some(call=>call[0]==='send'),false);
});
test('review display derives activation and top-up 99 percent LP floors from typed mock-dollar input',async()=>{
  for(const [action,amount] of [['activate','100'],['increase','5']]){
    const active=action==='increase',source=manifest().input_assets.find(asset=>asset.symbol==='ZZZ');
    const word=n=>BigInt(n).toString(16).padStart(64,'0');
    const input=BigInt(amount)*10n**18n,deadline=BigInt(Math.floor(Date.now()/1000)+120);
    const data='0x35b13b87'+word(1)+POOL.slice(2)+source.address.slice(2).padStart(64,'0')+
      word(input)+source.route_id.slice(2)+word(0)+word(1)+word(deadline)+word(active?1:0);
    const fresh={...state(),nfts:[{token_id:'1',chain_id:31337,owner:A,mint_ordinal:1,traits_ready:false,
      position:{activated:active,current_lp_value:{available:true,raw:'0'}},claimable:{lp:[],royalties:[]}}]};
    const draft={...mintDraft(),action,requested_action:action,contribution:amount,contribution_asset:'ZZZ',
      minimum_lp_usd_18:'1',approval_raw:'10000000000000000000000000000000',approval_asset:'BAD',
      transaction:{...mintDraft().transaction,to:roles.entry,data,value:'0x0'}};
    const e=setup({handler:path=>path==='/state'?fresh:path==='/browser/prepare'?draft:undefined});e.ready();
    const result=await e.c.prepare(action,{id:'1',amount,asset:'ZZZ'});
    assert.equal(result.minimum_lp_usd_18,(input*99n/100n).toString());
    assert.equal(result.contribution,amount);assert.equal(result.contribution_asset,'ZZZ');
    assert.equal(result.approval_raw,null);assert.equal(result.approval_asset,null);
    assert.deepEqual(result.claims,[]);assert.equal(submissions(e).length,0);
  }
});
test('review display approval amount and currency are the exact selected token units',async()=>{
  const source=manifest().input_assets.find(asset=>asset.symbol==='USDC'),amount='100',raw=100000000n;
  const data='0x095ea7b3'+roles.entry.slice(2).padStart(64,'0')+raw.toString(16).padStart(64,'0');
  const fresh={...state(),nfts:[{token_id:'1',chain_id:31337,owner:A,mint_ordinal:1,traits_ready:false,
    position:{activated:false,current_lp_value:{available:true,raw:'0'}},claimable:{lp:[],royalties:[]}}]};
  const draft={...mintDraft(),action:'approve',requested_action:'activate',contribution:amount,contribution_asset:'USDC',
    approval_raw:raw.toString(),approval_asset:'USDC',minimum_lp_usd_18:'1',
    transaction:{...mintDraft().transaction,to:source.address,data,value:'0x0'}};
  const e=setup({handler:path=>path==='/state'?fresh:path==='/browser/prepare'?draft:undefined});e.ready();
  const result=await e.c.prepare('activate',{id:'1',amount,asset:'USDC'});
  assert.equal(result.approval_raw,'100000000');assert.equal(result.approval_asset,'USDC');
  assert.equal(result.minimum_lp_usd_18,'99000000000000000000');
  assert.equal(e.signCalls.some(call=>call[0]==='send'),false);
});
test('review display suppresses untyped LP, approval and claim information on mint',async()=>{
  const draft={...mintDraft(),contribution:'99999',contribution_asset:'ETH',minimum_lp_usd_18:'999999',
    approval_raw:'999999999',approval_asset:'BAD',claims:[{simulated_raw:'9999999999999999999',symbol:'ETH',decimals:18}]};
  const e=setup({handler:path=>path==='/browser/prepare'?draft:undefined});e.ready();
  const result=await e.c.prepare('mint');
  for(const key of ['contribution','contribution_asset','minimum_lp_usd_18','approval_raw','approval_asset'])assert.equal(result[key],null);
  assert.deepEqual(result.claims,[]);assert.equal(result.network_gas.max_cost_wei,'60000');
});

for (const path of ['/browser/manifest','/browser/prepare','/browser/confirm']) test(`bounded pre-handler busy recovery: ${path}`,async()=>{
  let attempts=0; const bodies=[];
  const c=new BrowserClient({storage:storage(),walletStorage:storage(),pause:async()=>{},fetcher:async(url,options)=>{
    attempts++;bodies.push(options.body);return {ok:attempts>1,status:attempts>1?200:409,json:async()=>attempts>1?{ok:true}:{error:'Local operation in progress; refresh shortly'}};
  }});
  c.session={token:SESSION}; const body=path.endsWith('manifest')?undefined:{draft_id:'d'.repeat(32),transaction_hash:HASH};
  assert.deepEqual(await c.request(path,body),{ok:true}); assert.equal(attempts,2);assert.equal(bodies[0],bodies[1]);
});

test('receipt wait reason reaches the UI while the original transaction stays saved',async()=>{
  let e;
  e=setup({send:async()=>{e.saved=pending();return {status:'pending',hash:HASH,error:'Waiting for the wallet RPC to return the transaction receipt.'};}});
  e.ready();const draft=await e.c.prepare('mint');
  await assert.rejects(e.c.execute(draft),/wallet RPC.*receipt/);
  assert.equal(e.c.pending.hash,HASH);
  assert.equal(e.signCalls.filter(c=>c[0]==='send').length,1);
  assert.equal(e.calls.some(c=>c.path==='/browser/confirm'),false);
});

test('explicit account chooser replaces an old permission through fresh account reads',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});
  await assert.rejects(e.c.connect(0));
  const original=e.provider.request;let prompts=0;
  e.provider.request=async request=>{
    if(request.method==='wallet_requestPermissions'){
      prompts++;assert.deepEqual(request.params,[{eth_accounts:{}}]);e.values.account=A;
      return [{parentCapability:'eth_accounts',caveats:[{value:['0x'+'99'.repeat(20)]}]}];
    }
    return original(request);
  };
  await e.c.connect(0,{chooseAccount:true});
  assert.equal(prompts,1);assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
  assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('expected accountsChanged during explicit chooser does not cancel final verification',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});await assert.rejects(e.c.connect(0));
  const original=e.provider.request;
  e.provider.request=async request=>{
    if(request.method==='wallet_requestPermissions'){
      e.values.account=A;e.c.wallet.accountsHandler([A]);return [];
    }
    return original(request);
  };
  await e.c.connect(0,{chooseAccount:true});
  assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
});
test('chooser cancellation and unsupported providers do not silently authorize the stale account',async()=>{
  for(const code of [4001,4200,-32601,-32002]){
    const e=connectionFixture({account:'0x'+'99'.repeat(20)});await assert.rejects(e.c.connect(0));
    const original=e.provider.request;
    e.provider.request=async request=>{
      if(request.method==='wallet_requestPermissions')throw Object.assign(Error('provider error'),{code});
      return original(request);
    };
    await assert.rejects(e.c.connect(0,{chooseAccount:true}));
    assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
    assert.equal(e.values.permissionCount,1);
  }
});
test('chooser is sent only to the selected provider and retains deployment verification',async()=>{
  const a=connectionFixture(),b=connectionFixture({chain:'0x1'});
  let aPrompts=0,bPrompts=0;
  for(const [e,count] of [[a,()=>aPrompts++],[b,()=>bPrompts++]]){
    const original=e.provider.request;
    e.provider.request=async request=>{
      if(request.method==='wallet_requestPermissions'){count();return [];}
      return original(request);
    };
  }
  a.c.providers.push({provider:b.provider,id:'second-provider',name:'Other wallet'});
  await assert.rejects(a.c.connect(1,{chooseAccount:true}),/different network/);
  assert.equal(aPrompts,0);assert.equal(bPrompts,1);assert.equal(a.c.connectionVerified,false);
});
test('pending transaction blocks an account permission request without losing its journal',async()=>{
  const e=connectionFixture();await e.c.connect(0);
  e.c.pending=pending();let prompts=0;
  const original=e.provider.request;
  e.provider.request=async request=>{if(request.method==='wallet_requestPermissions')prompts++;return original(request);};
  await assert.rejects(e.c.connect(0,{chooseAccount:true}),/Recover/);
  assert.equal(prompts,0);assert.equal(e.c.pending.hash,HASH);
});
test('permissions must expose a valid admitted account; response alone never selects one',async()=>{
  for(const accounts of [[],['invalid'],['0x'+'99'.repeat(20)]]){
    const e=connectionFixture(),original=e.provider.request;
    e.provider.request=async request=>{
      if(request.method==='wallet_requestPermissions')return [{parentCapability:'eth_accounts'}];
      if(request.method==='eth_accounts')return accounts;
      return original(request);
    };
    await assert.rejects(e.c.connect(0,{chooseAccount:true}));
    assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  }
});
test('the connection dialog wires an explicit account chooser separately from normal reconnect',async()=>{
  const {readFile}=await import('node:fs/promises');
  const source=await readFile(new URL('../local-view.js',import.meta.url),'utf8');
  assert.match(source,/data-browser-accounts=/);
  assert.match(source,/Choose a different account in/);
  assert.match(source,/browserConnect\(Number\(b\.dataset\.browserAccounts\),false,true\)/);
  assert.match(source,/c\.connect\(index,\{chooseAccount,fromPicker:true\}\)/);
});

test('normal provider click after rejected account opens chooser instead of repeating old permission',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});
  await assert.rejects(e.c.connect(0),/not Test wallet/);
  let prompts=0;const original=e.provider.request;
  e.provider.request=async request=>{
    if(request.method==='wallet_requestPermissions'){prompts++;e.values.account=A;e.c.wallet.accountsHandler([A]);return [];}
    return original(request);
  };
  await e.c.connect(0);
  assert.equal(prompts,1);assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
  assert.equal(e.values.permissionCount,1);
  assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('normal provider click after restored wrong account opens the selected wallet chooser',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});
  e.c.wallet.attach(e.provider,[e.values.account],e.values.chain,'MetaMask','metamask-test');
  e.c.attachSigner();
  let prompts=0;const original=e.provider.request;
  e.provider.request=async request=>{
    if(request.method==='wallet_requestPermissions'){prompts++;e.values.account=A;return [];}
    return original(request);
  };
  await e.c.connect(0);
  assert.equal(prompts,1);assert.equal(e.values.permissionCount,0);
  assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
});
test('normal retry after cancelled chooser stays retryable and never loops prompts',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});
  await assert.rejects(e.c.connect(0));
  let prompts=0;const original=e.provider.request;
  e.provider.request=async request=>{
    if(request.method==='wallet_requestPermissions'){
      prompts++;if(prompts===1)throw Object.assign(Error('cancel'),{code:4001});
      e.values.account=A;return [];
    }
    return original(request);
  };
  await assert.rejects(e.c.connect(0),/cancelled/);
  assert.equal(prompts,1);assert.equal(e.c.busy,false);assert.equal(e.c.connectionVerified,false);
  await e.c.connect(0);
  assert.equal(prompts,2);assert.equal(e.c.account,A);
});
test('normal retry does not prompt when the wallet already corrected its exposed account',async()=>{
  const e=connectionFixture({account:'0x'+'99'.repeat(20)});
  await assert.rejects(e.c.connect(0));e.values.account=A;
  const original=e.provider.request;
  e.provider.request=async request=>{
    assert.notEqual(request.method,'wallet_requestPermissions');
    return original(request);
  };
  await e.c.connect(0);assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
});

test('authorized account selection uses Wallet A even when old address is first',async()=>{
  const old='0x'+'99'.repeat(20),e=connectionFixture({account:old});
  const original=e.provider.request;
  e.provider.request=async request=>['eth_accounts','eth_requestAccounts'].includes(request.method)?[old,A]:original(request);
  await e.c.connect(0);
  assert.equal(e.c.account,null);assert.equal(e.c.connectionError,null);
  assert.deepEqual(e.c.wallet.accounts,[old,A]);
  await e.c.chooseAuthorizedAccount(A);
  assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
  await e.c.connect(0);
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  await e.c.chooseAuthorizedAccount(A);
  assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
  assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('authorized account selection rejects removed permission or wrong network',async()=>{
  for(const mode of ['revoked','wrong_chain']){
    const e=connectionFixture();await e.c.connect(0);
    const original=e.provider.request;
    e.provider.request=async request=>{
      if(mode==='revoked'&&request.method==='eth_accounts')return [B];
      if(mode==='wrong_chain'&&request.method==='eth_chainId')return '0x1';
      return original(request);
    };
    await assert.rejects(e.c.chooseAuthorizedAccount(A));
    assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  }
});
test('authorized account selection preserves and blocks pending operations',async()=>{
  const e=connectionFixture();await e.c.connect(0);e.c.pending=pending();
  const before=e.rpcCalls.length;
  await assert.rejects(e.c.chooseAuthorizedAccount(B),/Recover/);
  assert.equal(e.rpcCalls.length,before);assert.equal(e.c.pending.hash,HASH);
});
test('authorized account selection verifies the exact original local genesis',async()=>{
  const e=connectionFixture();await e.c.connect(0);e.values.genesis='0x'+'88'.repeat(32);
  await assert.rejects(e.c.chooseAuthorizedAccount(A),/deployment/);
  assert.equal(e.c.connectionVerified,false);
});


test('fresh MetaMask picker requests selection even when previous account is allowed',async()=>{
  const e=connectionFixture();await e.c.connect(0);
  let prompts=0;const original=e.provider.request;
  e.provider.request=async req=>{
    if(req.method==='wallet_requestPermissions'){prompts++;e.values.account=B;return [];}
    return original(req);
  };
  await e.c.connect(0,{fromPicker:true});
  assert.equal(prompts,1);assert.equal(e.c.account,B);assert.equal(e.c.connectionVerified,true);
  assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('fresh MetaMask picker requires explicit account when permissions still include old account',async()=>{
  const e=connectionFixture();await e.c.connect(0);const original=e.provider.request;
  e.provider.request=async req=>{
    if(req.method==='wallet_requestPermissions')return [];
    if(req.method==='eth_accounts')return [A,B];
    return original(req);
  };
  await e.c.connect(0,{fromPicker:true});
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
  e.c.walletChanged();
  assert.equal(e.c.account,null);assert.equal(e.c.wallet.storage.getItem("popl-wallet-session-v1"),null);
  await e.c.chooseAuthorizedAccount(B);
  assert.equal(e.c.account,B);assert.equal(e.c.connectionVerified,true);
});
test('fresh MetaMask picker cancellation never reconnects the previous admitted account',async()=>{
  const e=connectionFixture();await e.c.connect(0);const original=e.provider.request;
  e.provider.request=async req=>{
    if(req.method==='wallet_requestPermissions')throw Object.assign(Error('cancel'),{code:4001});
    return original(req);
  };
  await assert.rejects(e.c.connect(0,{fromPicker:true}),/cancelled/);
  assert.equal(e.c.account,null);assert.equal(e.c.connectionVerified,false);
});
test('fresh reconnect uses current provider response rather than saved admitted sender',async()=>{
  const e=connectionFixture();await e.c.connect(0);const original=e.provider.request;
  e.provider.request=async req=>req.method==='eth_accounts'?[B,A]:original(req);
  await e.c.connect(0);
  assert.equal(e.c.account,B);assert.equal(e.c.connectionVerified,true);
});
test('fresh MetaMask picker leaves pending journal intact without prompting',async()=>{
  const e=connectionFixture();await e.c.connect(0);e.c.pending=pending();
  const before=e.rpcCalls.length;
  await assert.rejects(e.c.connect(0,{fromPicker:true}),/Recover/);
  assert.equal(e.rpcCalls.length,before);assert.equal(e.c.pending.hash,HASH);
});


test('network addition is followed by switching when wallet does not switch automatically',async()=>{
 const e=connectionFixture({chain:'0x1'});await assert.rejects(e.c.connect(0));
 const original=e.provider.request;let switches=0,adds=0;
 e.provider.request=async req=>{
  if(req.method==='wallet_switchEthereumChain'){if(++switches===1)throw Object.assign(Error('unknown chain'),{code:4902});e.values.chain='0x7a69';return null;}
  if(req.method==='wallet_addEthereumChain'){adds++;return null;}
  return original(req);
 };
 await e.c.setupNetwork();assert.equal(adds,1);assert.equal(switches,2);assert.equal(e.c.connectionVerified,true);
});
test('network setup preserves selected authorized sender and rejects wrong genesis',async()=>{
 const e=connectionFixture();await e.c.connect(0);e.values.genesis='0x'+'ab'.repeat(32);
 const original=e.provider.request;e.provider.request=async req=>req.method==='wallet_switchEthereumChain'?null:original(req);
 await assert.rejects(e.c.setupNetwork(),/deployment/);assert.equal(e.c.connectionVerified,false);assert.equal(e.c.busy,false);
});
test('pending transaction blocks network prompts before any wallet request',async()=>{
 const e=connectionFixture();await e.c.connect(0);e.c.pending=pending();const before=e.rpcCalls.length;
 await assert.rejects(e.c.setupNetwork(),/Recover/);assert.equal(e.rpcCalls.length,before);assert.equal(e.c.pending.hash,HASH);
});
test('network prompt cannot complete against a provider disconnected during approval',async()=>{
 const e=connectionFixture();await e.c.connect(0);const original=e.provider.request;
 e.provider.request=async req=>{if(req.method==='wallet_switchEthereumChain'){e.c.wallet.disconnect();return null;}return original(req);};
 await assert.rejects(e.c.setupNetwork(),/wallet changed/);assert.equal(e.c.connectionVerified,false);
});
test('unverified account cannot prepare a transaction even if UI is bypassed',async()=>{
 const e=setup();e.ready();e.c.connectionVerified=false;
 await assert.rejects(e.c.prepare('mint'),/Connect/);assert.equal(e.calls.length,0);
});
test('account event automatically revalidates a newly authorized sender',async()=>{
 const e=connectionFixture();await e.c.connect(0);e.values.account=B;
 e.c.wallet.accountsHandler([B]);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(e.c.account,B);assert.equal(e.c.connectionVerified,true);assert.equal(e.rpcCalls.includes('eth_sendTransaction'),false);
});
test('late event verification cannot reenable a changed account review',async()=>{
 const e=setup();e.ready();e.c.wallet.provider={};e.c.signer.provider=e.c.wallet.provider;e.c.signerRpc=manifest().rpc_url;
 let finish;e.c.signer.assertConnection=()=>new Promise(resolve=>{finish=resolve;});
 e.c.connectionVerified=false;const checking=e.c.verifyWalletEvent();
 e.c.wallet.state={...e.c.wallet.state,address:B};e.c.walletChanged();finish();await checking;
 assert.equal(e.c.account,B);assert.equal(e.c.connectionVerified,false);
});
test('cancelled MetaMask choice cannot poison a subsequent Rabby connection',async()=>{
 const e=connectionFixture();await e.c.connect(0);const original=e.provider.request;
 e.provider.request=async req=>{if(req.method==='wallet_requestPermissions')throw Object.assign(Error('cancel'),{code:4001});return original(req);};
 await assert.rejects(e.c.connect(0,{fromPicker:true}));
 const other=connectionFixture();e.c.providers.push({provider:other.provider,id:'io.rabby',name:'Rabby'});
 await e.c.connect(1);assert.equal(e.c.account,A);assert.equal(e.c.connectionVerified,true);
});

test('late provider restoration verifies the account before enabling actions without a prompt',async()=>{
 const e=setup();e.ready();e.c.connectionVerified=false;const provider={request:async()=>{throw Error('No permission prompt expected');}};
 e.c.wallet.provider=provider;e.signer.provider=provider;e.c.signerRpc=manifest().rpc_url;let checked=0;
 e.signer.assertConnection=async account=>{assert.equal(account,A);checked++;};
 e.c.wallet.restore=async()=>true;
 await e.c.restore();assert.equal(checked,1);assert.equal(e.c.connectionVerified,true);
 assert.equal(e.signCalls.filter(c=>c[0]==='send').length,0);
 });


test('real client wires node reads to pinned HTTP and never asks extension for nonce or receipts',async()=>{
 const e=connectionFixture(),nodeCalls=[];delete e.c.signerOptions.readProvider;
 const base=e.c.fetcher;e.c.fetcher=async(url,options)=>{
  if(url===manifest().rpc_url+'/'){
   const request=JSON.parse(options.body);nodeCalls.push(request.method);
   const result=request.method==='eth_chainId'?'0x7a69':request.method==='eth_getBlockByNumber'?{hash:GENESIS}:request.method==='eth_getTransactionCount'?'0x3':null;
   return new Response(JSON.stringify({jsonrpc:'2.0',id:request.id,result}));
  }
  return base(url,options);
 };
 await e.c.connect(0);assert.equal(e.c.connectionVerified,true);
 assert.notEqual(e.c.signer.readProvider,e.provider);
 assert.equal(await e.c.signer.read('eth_getTransactionCount',[A,'pending']),'0x3');
 assert.equal(await e.c.signer.read('eth_getTransactionReceipt',[HASH]),null);
 assert.ok(nodeCalls.includes('eth_getTransactionReceipt'));assert.equal(e.rpcCalls.includes('eth_getTransactionReceipt'),false);
});

test('refresh cannot silently change the pinned read RPC for an existing session',async()=>{
 const e=setup({handler:path=>path==='/browser/manifest'?{...manifest(),rpc_url:'http://127.0.0.1:60001'}:undefined});
 e.ready();await assert.rejects(e.c.refreshState(),/deployment changed/);assert.equal(e.c.manifest.rpc_url,manifest().rpc_url);
});
