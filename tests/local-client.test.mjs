import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalClient,localMode,uint,units,usd,sum,balances,validateState} from '../local-client.js';
const address='0x'+'11'.repeat(20),other='0x'+'22'.repeat(20),token='a'.repeat(64);
const state=()=>({mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,revision:0,accounts:[address,other],nfts:[],protocol:{lifecycle:{},provenance:{block_hash:'0x'+'ab'.repeat(32)}}});
const session={mode:'LOCAL ANVIL TEST ONLY',chain_id:31337,token};
function setup(handler){const entries=new Map(),calls=[];const storage={getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const c=new LocalClient({storage,random:()=> 'b'.repeat(32),fetcher:async(path,options)=>{calls.push([path,options]);const result=await handler(path,options);return {ok:true,json:async()=>result};}});return {c,storage,entries,calls};}
const ready=async handler=>{const env=setup(handler);await env.c.refresh();env.c.select(address);return env;};
const base=(path)=>path==='/session'?session:state();
const draft=c=>({draft_id:'c'.repeat(32),account:address,chain_id:31337,revision:0,expires_in_seconds:60,clientVersion:c.version,clientExpiry:Date.now()+60000});
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
