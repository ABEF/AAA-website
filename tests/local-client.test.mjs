import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalClient,localMode,uint,units,usd,sum,balances,validateState,readyRewards,pendingConversion,hasClaim} from '../local-client.js';
const address='0x'+'11'.repeat(20),other='0x'+'22'.repeat(20),token='a'.repeat(64);
const state=()=>({mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,revision:0,accounts:[address,other],nfts:[],protocol:{lifecycle:{},provenance:{block_hash:'0x'+'ab'.repeat(32)}}});
const session={mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,token};
test('ETH settlement keeps source balances visible without treating them as ready ETH',()=>{
  const native='0x'+'0'.repeat(40);
  const source={asset:address,symbol:'ZZZ',decimals:18,raw:'1000000000000000000'};
  const eth={asset:native,symbol:'ETH',decimals:18,raw:'2000000000000000000'};
  const n={claimable:{default_settlement:'native_eth',lp:[source,eth],royalties:[{...eth,raw:'3000000000000000000'}]}};
  assert.equal(balances([...readyRewards(n,'lp'),...readyRewards(n,'royalties')]),'5 ETH');
  assert.deepEqual(pendingConversion(n),[source]);assert.equal(hasClaim(n),true);
  n.claimable.lp=[source];n.claimable.royalties=[];
  assert.equal(hasClaim(n),false);assert.deepEqual(readyRewards(n,'lp'),[]);
  delete n.claimable.default_settlement;
  assert.equal(hasClaim(n),true);assert.deepEqual(pendingConversion(n),[]);
});
function setup(handler){const entries=new Map(),calls=[];const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const c=new LocalClient({storage,random:()=> 'b'.repeat(32),fetcher:async(path,options)=>{calls.push([path,options]);const result=await handler(path,options);return {ok:true,json:async()=>result};}});return {c,storage,entries,calls};}
const ready=async handler=>{const env=setup(handler);await env.c.refresh();env.c.select(address);return env;};
const base=(path)=>path==='/session'?session:state();
const draft=c=>({draft_id:'c'.repeat(32),account:address,chain_id:31337,revision:0,expires_in_seconds:60,clientVersion:c.version,clientExpiry:Date.now()+60000,clientDeadline:performance.now()+60000});

test('malformed or unbounded draft lifetimes never reach confirmation',async()=>{
  for(const expires_in_seconds of [undefined,null,true,NaN,Infinity,-1,0,61,1.5,'60']) {
    const {c,calls}=await ready(path=>path==='/prepare'?{...draft({version:2}),expires_in_seconds}:base(path));
    await assert.rejects(c.prepare('mint'),/Invalid transaction confirmation/);
    assert.equal(calls.filter(([p])=>p==='/action').length,0);
  }
});
test('preparation time is part of expiry; slow drafts fail before confirmation',async()=>{
  let now=0;const {c}=await ready(path=>{if(path!=='/prepare')return base(path);now=60000;return draft(c);});
  c.clock=()=>now;await assert.rejects(c.prepare('mint'),/expired while preparing/);
});
test('nonfinite expiry, changed chain/revision and missing state never submit',async()=>{
  const {c,calls}=await ready(base);
  for(const change of [{clientExpiry:NaN},{clientDeadline:NaN},{clientDeadline:Infinity},{clientExpiry:undefined},{chain_id:1},{revision:1},{draft_id:'invalid'}])
    await assert.rejects(c.execute({...draft(c),...change}));
  c.state=null;await assert.rejects(c.execute(draft(c)));
  assert.equal(calls.filter(([p])=>p==='/action').length,0);
});
test('monotonic deadline still expires after wall clock moves backwards',async()=>{
  let now=10;const {c,calls}=await ready(path=>path==='/prepare'?draft(c):base(path));c.clock=()=>now;
  const prepared=await c.prepare('mint');now=60010;
  const real=Date.now;Date.now=()=>0;
  try{await assert.rejects(c.execute(prepared),/expired/);}finally{Date.now=real;}
  assert.equal(calls.filter(([p])=>p==='/action').length,0);
});
test('request extras cannot override the selected wallet or operation',async()=>{
  const {c,calls}=await ready(path=>path==='/prepare'?draft(c):base(path));
  await c.prepare('mint',{account:other,action:'transfer'});
  const body=JSON.parse(calls.find(([p])=>p==='/prepare')[1].body);
  assert.equal(body.account,address);assert.equal(body.action,'mint');
});
test('overlapping confirmations submit one operation; refresh invalidates old drafts',async()=>{
  let resolve;const {c,calls}=await ready(path=>path==='/action'?new Promise(r=>resolve=r):base(path));
  const confirmed=draft(c),first=c.execute(confirmed);
  await assert.rejects(c.execute(confirmed));assert.equal(calls.filter(([p])=>p==='/action').length,1);
  resolve({status:'confirmed',uncertain:false});await first;await c.refresh();
  await assert.rejects(c.execute(confirmed));assert.equal(calls.filter(([p])=>p==='/action').length,1);
});
test('local adapter requires exact loopback mount; never query or production hostname',()=>{
  assert.equal(localMode({hostname:'127.0.0.1',pathname:'/app/',protocol:'http:'}),true);
  for(const change of [{hostname:'popldemo.0xwave.com'},{pathname:'/'},{protocol:'https:'},{hostname:'localhost'},{hostname:'127.0.0.1.evil'}])assert.equal(localMode({hostname:'127.0.0.1',pathname:'/app/',protocol:'http:',...change}),false);
});
test('uint256 IDs remain exact, malformed and overflowing values rejected',()=>{
  assert.equal(uint((2n**256n-1n).toString()),2n**256n-1n);
  for(const v of [1,true,'01','-1','1e4','0x12','',null,(2n**256n).toString()])assert.throws(()=>uint(v));
});
test('prices are null-aware and large balances use bigint precision',()=>{
  assert.equal(usd(null),'Unavailable');assert.equal(usd('1432000000000000000000'),'$1,432.00');
  assert.equal(sum(['1',null]),null);assert.equal(sum([]),'0');assert.equal(units('10000000000000000'), '0.01');
});
test('claim currencies are summed by address, never assumed equal',()=>{
  const a={asset:address,symbol:'ETH',decimals:18,raw:'10000000000000000'};
  assert.equal(balances([a,a]),'0.02 ETH');assert.throws(()=>balances([a,{...a,decimals:6}]));
});
test('wrong chain, duplicate wallet and excessive collection fail closed',()=>{
  for(const s of [{...state(),chain_id:1},{...state(),accounts:[address,address]},{...state(),nfts:Array(21).fill({})}])assert.throws(()=>validateState(s));
});
test('refresh failure clears old balances instead of returning stale demo data',async()=>{
  let fail=false;const {c}=await ready(path=>{if(fail&&path==='/state')throw Error('offline');return base(path);});fail=true;
  await assert.rejects(c.refresh(),/offline/);assert.equal(c.state,null);
});
test('account change during preparation invalidates the result',async()=>{
  let resolve;const {c}=await ready(path=>path==='/prepare'?new Promise(r=>resolve=r):base(path));
  const preparing=c.prepare('mint');c.select(other);resolve(draft(c));await assert.rejects(preparing,/changed/);
});
test('expired and wrong-account confirmations never submit',async()=>{
  const {c,calls}=await ready(base);await assert.rejects(c.execute({...draft(c),clientExpiry:0}));
  await assert.rejects(c.execute({...draft(c),account:other}));assert.equal(calls.filter(([p])=>p==='/action').length,0);
});
test('storage failure blocks transaction submission',async()=>{
  const {c,calls,storage}=await ready(base);storage.setItem=()=>{throw Error('denied');};
  await assert.rejects(c.execute(draft(c)),/Nothing was submitted/);assert.equal(c.pending,null);assert.equal(calls.filter(([p])=>p==='/action').length,0);
});
test('lost response recovers the identical operation, then reads confirmed state',async()=>{
  let lost=true;const bodies=[];const {c}=await ready((path,options)=>{if(path!=='/action')return base(path);bodies.push(options.body);if(lost){lost=false;throw Error('response lost');}return {status:'confirmed',uncertain:false};});
  await assert.rejects(c.execute(draft(c)),/response lost/);assert.ok(c.pending);
  await c.refresh();assert.equal(bodies[0],bodies[1]);assert.equal(c.pending,null);assert.ok(c.state);
});
test('changed session drops old intent and wallet without replaying',async()=>{
  let current=session;const {c,storage,calls}=await ready(path=>path==='/session'?current:state());
  storage.setItem(c.key,JSON.stringify({session:token,envelope:{}}));current={...session,token:'d'.repeat(64)};
  await c.refresh();assert.equal(c.account,null);assert.equal(calls.filter(([p])=>p==='/action').length,0);
});
test('uncertain submission keeps recovery record and blocks a second intent',async()=>{
  const {c}=await ready(path=>path==='/action'?{status:'failed',uncertain:true}:base(path));
  await assert.rejects(c.execute(draft(c)),/unresolved/);assert.ok(c.pending);await assert.rejects(c.execute(draft(c)));
});
test('failed receipt result is terminal, not retried as a fresh transaction',async()=>{
  const {c,calls}=await ready(path=>path==='/action'?{status:'failed',uncertain:false,error:'revert'}:base(path));
  const result=await c.execute(draft(c));assert.equal(result.status,'failed');assert.equal(c.pending,null);await c.refresh();
  assert.equal(calls.filter(([p])=>p==='/action').length,1);
});


test('only explicit busy state reads retry, with bounded backoff',async()=>{
  let reads=0;const pauses=[];
  const c=new LocalClient({storage:{getItem:()=>null},pause:async ms=>pauses.push(ms),fetcher:async path=>{
    const busy=path==='/state'&&++reads<3;
    return {ok:!busy,status:busy?409:200,json:async()=>busy?{error:'Local operation in progress; refresh shortly'}:base(path)};
  }});
  await c.refresh();assert.equal(reads,3);assert.deepEqual(pauses,[500,1000]);assert.ok(c.state);
});

test('persistent busy reads stop after 30 attempts and keep state unavailable',async()=>{
  let reads=0,waits=0;const c=new LocalClient({storage:{getItem:()=>null},pause:async()=>waits++,fetcher:async path=>{
    if(path==='/session')return {ok:true,json:async()=>session};reads++;
    return {ok:false,status:409,json:async()=>({error:'Local operation in progress; refresh shortly'})};
  }});
  await assert.rejects(c.refresh(),/operation in progress/);assert.equal(reads,30);assert.equal(waits,29);assert.equal(c.state,null);assert.equal(c.refreshing,null);
});

test('submissions and non-busy preparation/read errors are never automatically retried',async()=>{
  for(const [path,body,status,message] of [['/prepare',{},409,'State changed. Refresh before preparing a new action'],['/action',{},409,'Local operation in progress; refresh shortly'],['/state',null,503,'Accounting mismatch'],['/state',null,409,'Invalid confirmed state']]) {
    let calls=0;const c=new LocalClient({storage:{},pause:async()=>assert.fail('unexpected retry'),fetcher:async()=>{calls++;return {ok:false,status,json:async()=>({error:message})};}});c.session=session;
    await assert.rejects(c.request(path,body));assert.equal(calls,1);
  }
});

test('overlapping refresh requests share one confirmed read',async()=>{
  let resolve,reads=0;const {c}=setup(path=>path==='/session'?session:(reads++,new Promise(r=>resolve=r)));
  const first=c.refresh(),second=c.refresh();assert.equal(first,second);
  await new Promise(r=>setImmediate(r));resolve(state());await Promise.all([first,second]);assert.equal(reads,1);assert.equal(c.version,1);
});

test('confirmed action is not resubmitted when balance reads are busy',async()=>{
  let writes=0,reads=0;const entries=new Map();
  const c=new LocalClient({storage:{getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},random:()=> 'b'.repeat(32),pause:async()=>{},fetcher:async path=>{
    if(path==='/action'){writes++;return {ok:true,json:async()=>({status:'confirmed',uncertain:false})};}
    if(path==='/state'&&++reads===2)return {ok:false,status:409,json:async()=>({error:'Local operation in progress; refresh shortly'})};
    return {ok:true,json:async()=>base(path)};
  }});
  await c.refresh();c.select(address);await c.execute(draft(c));await c.refresh();assert.equal(writes,1);assert.equal(reads,3);assert.equal(c.pending,null);assert.ok(c.state);
});

test('cancelled read backoff fails closed without a further request',async()=>{
  let calls=0;const c=new LocalClient({storage:{},pause:async()=>{throw Error('Local read timed out');},fetcher:async()=>{calls++;return {ok:false,status:409,json:async()=>({error:'Local operation in progress; refresh shortly'})};}});
  await assert.rejects(c.request('/state'),/timed out/);assert.equal(calls,1);
});

import {positionRows,positionFinancialDetails,royaltyTrait,contributionError,sameContribution,rewardHistoryUSD,earningsSummary} from '../local-view.js';
const dormant=()=>({position:{activated:false,current_lp_value:{available:true,raw:'0'}}});
const active=()=>({position:{activated:true,evolution:'dormant',current_lp_value:{available:false,raw:null}},claimable:{lp:[],royalties:[]},previously_claimed:{available:false}});
test('dormant cards omit finances and dormant details never read reward payloads',()=>{
  assert.match(positionRows(dormant()),/LP attached/);
  assert.ok(!positionRows(dormant()).includes('Rewards to claim'));
  const detail=positionFinancialDetails(dormant());
  assert.match(detail,/LP attached/);
  for(const label of ['Rewards to claim','Previously claimed','Fees generated'])assert.ok(!detail.includes(label),label);
});
test('active cards combine only claimable amounts while detail retains unavailable history',()=>{
  const rows=positionRows(active()),detail=positionFinancialDetails(active());
  assert.match(rows,/Rewards to claim/);assert.match(rows,/<strong>0<\/strong>/);
  for(const label of ['Previously claimed'])assert.ok(!rows.includes(label),label);
  assert.match(detail,/Royalties/);assert.doesNotMatch(detail,/Previously claimed/);
  assert.match(detail,/Fees generated/);assert.match(detail,/Unavailable/);
});
test('claim total combines ETH exactly and keeps different currencies distinct',()=>{
  const n=active(),eth={asset:'0x'+'00'.repeat(20),symbol:'ETH',decimals:18};
  n.claimable.lp=[{...eth,raw:'10000000000000001'}];
  n.claimable.royalties=[{...eth,raw:'19999999999999999'}];
  assert.match(positionRows(n),/<strong>0.03 ETH<\/strong>/);
  n.claimable.royalties.push({asset:address,symbol:'USDG',decimals:6,raw:'2000000'});
  assert.match(positionRows(n),/0.03 ETH \+ 2 USDG/);
  n.previously_claimed={available:true,assets:[{...eth,total_raw:'900000000000000000'}]};
  assert.doesNotMatch(positionFinancialDetails(n),/0.9 ETH/); // Prior payouts are no longer a card frame.
  assert.ok(!positionRows(n).includes('0.9 ETH'));
});
test('royalty trait keeps revealed rarity weight while dormant, unknown draws stay unknown',()=>{
  for(const [rarity,weight] of [['Commun',1],['Rare',2],['Legendary',3]]) {
    const n={position:{activated:false},traits_ready:true,traits:{rarity}};
    assert.match(royaltyTrait(n),new RegExp('Royalty weight ×'+weight));
    assert.match(royaltyTrait(n),/is-dormant/);
    n.position.activated=true;assert.ok(!royaltyTrait(n).includes('is-dormant'));
  }
  assert.match(royaltyTrait({position:{activated:false},traits_ready:false}),/unrevealed/);
});

test('fast session enables wallet selection before slow portfolio completes',async()=>{
  const env=setup(path=>path==='/session'?{...session,accounts:[address,other]}:new Promise(r=>resolve=r));let resolve,ready=false;
  env.c.onSession=()=>{ready=true;env.c.select(address);};const loading=env.c.refresh();
  await new Promise(r=>setImmediate(r));assert.equal(ready,true);assert.equal(env.c.account,address);assert.equal(env.c.state,null);
  resolve(state());await loading;assert.equal(env.c.account,address);
});
test('wallet selection survives reload, explicit disconnect persists, new session resets it',async()=>{
  const {c,storage}=await ready(path=>path==='/session'?{...session,accounts:[address,other]}:state());
  const reload=new LocalClient({storage,fetcher:async path=>({ok:true,json:async()=>path==='/session'?{...session,accounts:[address,other]}:state()})});
  await reload.refresh();assert.equal(reload.account,address);reload.select(null);await c.refresh();assert.equal(c.account,address);
  // A reloaded tab respects the explicit disconnected record.
  const fresh=new LocalClient({storage,fetcher:reload.fetcher});await fresh.refresh();assert.equal(fresh.account,null);
  reload.select(address);reload.fetcher=async path=>({ok:true,json:async()=>path==='/session'?{...session,token:'e'.repeat(64),accounts:[address,other]}:state()});
  await reload.refresh();assert.equal(reload.account,null);
});
test('malformed cached selections and changed session account inventory never authorize a wallet',async()=>{
  const env=setup(path=>path==='/session'?{...session,accounts:[address,other]}:state());
  env.storage.setItem(env.c.walletKey,JSON.stringify({session:token,accounts:[address,address],account:address}));await env.c.refresh();assert.equal(env.c.account,null);
  env.c.fetcher=async path=>({ok:true,json:async()=>path==='/session'?{...session,accounts:[address,other]}:{...state(),accounts:[other,address]}});
  await assert.rejects(env.c.refresh(),/inventory changed/);assert.equal(env.c.state,null);
});

test('pending identity cards never read financial payloads or render cached balances',()=>{
  assert.match(positionRows({position:{activated:false}},'Updating…'),/LP attached/);
  assert.ok(!positionRows({position:{activated:false}},'Updating…').includes('Rewards to claim'));
  const html=positionRows({position:{activated:true}},'Updating…');
  assert.match(html,/Rewards to claim/);assert.match(html,/Updating…/);assert.ok(!html.includes('$'));
});

test('contribution review exposes invalid amounts and missing acknowledgement',()=>{
  for(const amount of ['', '99', '100000', '-100', '100.5', '1e3', ' 100', '0100', '100\n', null, 100])assert.match(contributionError(amount,true),/whole amount/);
  for(const amount of ['100','11111','99999']){assert.equal(contributionError(amount,true),null);assert.match(contributionError(amount,false),/checkbox/);}
});
test('approval acknowledgement stays bound to the exact deployment wallet NFT and amount',()=>{
  const a={session:'a',account:address,id:'123',amount:'100'};
  assert.equal(sameContribution(a,{...a}),true);assert.equal(sameContribution(null,a),false);
  for(const key of Object.keys(a))assert.equal(sameContribution(a,{...a,[key]:'changed'}),false);
});

test('top-up review accepts five test dollars but activation still needs one hundred',()=>{
  for(const amount of ['5','6','99','100','99999'])assert.equal(contributionError(amount,true,'increase'),null);
  for(const amount of ['0','4','4.99','05','5.0','1e1',' 5','5\n',5,null])assert.ok(contributionError(amount,true,'increase'));
  assert.ok(contributionError('5',true,'activate'));assert.ok(contributionError('5',false,'increase'));
});
test('NFT income totals sum net individual collective and royalty USD at the same snapshot',()=>{
  const n={token_id:'1',chain_id:31337,provenance:{block_hash:'0x'+'a'.repeat(64)},earnings:{available:true,scope:'nft',token_id:'1',chain_id:31337,
    provenance:{block_hash:'0x'+'a'.repeat(64)},last_24h_usd_at_current_price_18:{lp_individual:'8000000000000000000',lp_collective:'2000000000000000000',royalties:'3000000000000000000',lp_processed:'999999999999999999999'}}};
  assert.equal(rewardHistoryUSD(n,'last_24h'),'13000000000000000000');
  assert.match(earningsSummary(n),/\$13.00/);assert.match(earningsSummary(n),/Unavailable/);
  n.earnings.last_24h_usd_at_current_price_18.royalties=null;assert.equal(rewardHistoryUSD(n,'last_24h'),null);
  n.earnings.last_24h_usd_at_current_price_18.royalties='-1';assert.equal(rewardHistoryUSD(n,'last_24h'),null);
  n.earnings.last_24h_usd_at_current_price_18.royalties='0';n.earnings.token_id='2';assert.equal(rewardHistoryUSD(n,'last_24h'),null);
  n.earnings.token_id='1';n.earnings.provenance.block_hash='0x'+'b'.repeat(64);assert.equal(rewardHistoryUSD(n,'last_24h'),null);
  assert.match(earningsSummary({get earnings(){throw new Error('stale financial access');}},'Updating…'),/Updating/);
});


test('busy activation preparation retries identical inputs without submitting',async()=>{
  const {c}=await ready(base);let reads=0;const bodies=[],pauses=[];
  c.pause=async ms=>pauses.push(ms);
  c.fetcher=async(path,options)=>{
    assert.equal(path,'/prepare');bodies.push(options.body);const busy=++reads<3;
    return {ok:!busy,status:busy?409:200,json:async()=>busy?{error:'Local operation in progress; refresh shortly'}:draft(c)};
  };
  const result=await c.prepare('activate',{id:'444',amount:'100',asset:'ZZZ'});
  assert.equal(result.account,address);assert.equal(c.pending,null);
  assert.equal(reads,3);assert.equal(new Set(bodies).size,1);
  assert.deepEqual(JSON.parse(bodies[0]),{id:'444',amount:'100',asset:'ZZZ',action:'activate',account:address});
  assert.deepEqual(pauses,[500,1000]);
});

test('account or refresh change cancels queued preparation before another request',async()=>{
  for(const change of [c=>c.select(other),c=>{c.version++;c.state=null;},c=>{c.pending={};}]) {
    const {c}=await ready(base);let requests=0;c.pause=async()=>change(c);
    c.fetcher=async()=>{requests++;return {ok:false,status:409,json:async()=>({error:'Local operation in progress; refresh shortly'})};};
    await assert.rejects(c.prepare('increase',{id:'444',amount:'5',asset:'ZZZ'}),/Wallet or state changed/);
    assert.equal(requests,1);
  }
});

test('persistent busy preparation is bounded and does not create a pending transaction',async()=>{
  const {c}=await ready(base);let requests=0;c.pause=async()=>{};
  c.fetcher=async()=>{requests++;return {ok:false,status:409,json:async()=>({error:'Local operation in progress; refresh shortly'})};};
  await assert.rejects(c.prepare('activate',{id:'444',amount:'100'}),/operation in progress/);
  assert.equal(requests,30);assert.equal(c.pending,null);
});

test('lost preparation responses never retry; busy waiting does not age a nonexistent draft',async()=>{
  const {c}=await ready(base);let requests=0;
  c.fetcher=async()=>{requests++;throw Error('Connection lost');};
  await assert.rejects(c.prepare('mint'),/Connection lost/);assert.equal(requests,1);
  let now=0;c.clock=()=>now;c.pause=async()=>{now=60001;};requests=0;
  c.fetcher=async()=>{const busy=++requests===1;return {ok:!busy,status:busy?409:200,json:async()=>busy?{error:'Local operation in progress; refresh shortly'}:draft(c)};};
  const prepared=await c.prepare('mint');assert.equal(prepared.clientDeadline,120001);
  now=120001;await assert.rejects(c.execute(prepared),/expired/);assert.equal(c.pending,null);
});

test('slow final preparation attempt still expires after a busy wait',async()=>{
  const {c}=await ready(base);let now=0,requests=0;c.clock=()=>now;c.pause=async()=>{now=30000;};
  c.fetcher=async()=>{const busy=++requests===1;if(!busy)now+=60001;return {ok:!busy,status:busy?409:200,json:async()=>busy?{error:'Local operation in progress; refresh shortly'}:draft(c)};};
  await assert.rejects(c.prepare('mint'),/expired while preparing/);assert.equal(c.pending,null);
});
