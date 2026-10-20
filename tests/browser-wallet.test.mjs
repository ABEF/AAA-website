import test from 'node:test';
import assert from 'node:assert/strict';
import {BrowserWallet} from '../browser-wallet.js';
const A='0x'+'11'.repeat(20),B='0x'+'22'.repeat(20),TARGET='0x'+'33'.repeat(20);
const GENESIS='0x'+'44'.repeat(32),BLOCK='0x'+'55'.repeat(32),HASH='0x'+'66'.repeat(32),OTHER='0x'+'77'.repeat(32);
const CODE='0x6001600055';
const tx=()=>({from:A,to:TARGET,data:'0x12345678',value:'0x1',chainId:'0x7a69',gas:'0x7530',gasPrice:'0x2',nonce:'0x0'});
const expected=t=>Object.fromEntries(['from','to','data','value','chainId'].map(k=>[k,t[k]]));
const policy=()=>({chainId:'0x7a69',genesisHash:GENESIS,allowedTargets:{[TARGET]:CODE},maxGas:'0x100000',maxGasPrice:'0x100',maxNetworkFee:'0x10000000',maxValue:'0x100000',confirmations:1});
function storage(){
  const map=new Map();
  return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
}
function locks(){
  const held=new Set();
  return {request:async(name,_options,callback)=>{
    if(held.has(name))return callback(null);
    held.add(name);try{return await callback({name});}finally{held.delete(name);}
  }};
}
function setup(overrides={}){
  const state={now:100000,mono:1000,account:A,chain:'0x7a69',genesis:GENESIS,nonce:'0x0',balance:'0x1000000000',
    gasPrice:'0x1',estimate:'0x5208',code:CODE,receipt:null,transaction:null,head:'0x2',block:BLOCK,sendCount:0};
  const calls=[],listeners=new Map(),store=overrides.storage??storage(),mutex=overrides.locks??locks();
  const receipt=()=>({transactionHash:HASH,transactionIndex:'0x0',blockNumber:'0x2',blockHash:BLOCK,
    from:A,to:TARGET,status:'0x1',gasUsed:'0x5208',effectiveGasPrice:'0x2',logs:[]});
  const mined=t=>({...t,hash:HASH,input:t.data,blockNumber:'0x2',blockHash:BLOCK,transactionIndex:'0x0'});
  const provider={
    on:(event,fn)=>listeners.set(event,[...(listeners.get(event)??[]),fn]),
    removeListener:(event,fn)=>listeners.set(event,(listeners.get(event)??[]).filter(f=>f!==fn)),
    request:async({method,params=[]})=>{
      calls.push({method,params});
      if(overrides.handler){const answer=await overrides.handler(method,params,{state,provider});if(answer!==undefined)return answer;}
      if(method==='eth_accounts')return [state.account];
      if(method==='eth_chainId')return state.chain;
      if(method==='eth_getBlockByNumber')return {hash:params[0]==='0x0'?state.genesis:state.block,number:params[0]};
      if(method==='eth_getCode')return state.code;
      if(method==='eth_getTransactionCount')return state.nonce;
      if(method==='eth_getBalance')return state.balance;
      if(method==='eth_gasPrice')return state.gasPrice;
      if(method==='eth_estimateGas')return state.estimate;
      if(method==='eth_call')return '0x';
      if(method==='eth_blockNumber')return state.head;
      if(method==='eth_getTransactionReceipt')return state.receipt;
      if(method==='eth_getTransactionByHash')return state.transaction;
      if(method==='eth_sendTransaction'){
        state.sendCount++;
        if(overrides.send)return overrides.send(params[0],{state,receipt,mined});
        state.receipt=receipt();state.transaction=mined(params[0]);return HASH;
      }
      throw Error('Unexpected RPC '+method);
    }
  };
  const wallet=new BrowserWallet({provider,policy:overrides.policy??policy(),storage:store,locks:mutex,
    clock:()=>state.now,monotonic:()=>state.mono,pause:async()=>{},requestTimeoutMs:overrides.timeout??20,submissionTimeoutMs:overrides.timeout??20,
    receiptAttempts:1,random:()=> 'fixed-record-0001',...overrides.options});
  const review=(change={})=>{
    const transaction=tx();
    return wallet.review({transaction,expectedTransaction:expected(transaction),expiresAt:state.now+60000,
      context:{draft_id:'draft-1'},...change});
  };
  const emit=event=>(listeners.get(event)??[]).forEach(f=>f());
  return {wallet,state,calls,store,provider,review,emit,mutex,receipt,mined};
}
const sent=env=>env.calls.filter(c=>c.method==='eth_sendTransaction');

test('one-confirmation canonical receipt is not vetoed by a lagging head cache',async()=>{
  const e=setup();e.state.head='0x1';
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  await e.wallet.acknowledge(HASH);
  assert.equal(e.wallet.pending,null);assert.equal(sent(e).length,1);
  assert.equal(e.calls.filter(c=>c.method==='eth_blockNumber').length,0);
});
test('receipt appearing after three quick attempts confirms without manual recovery',async()=>{
  let reads=0,waits=0;
  const e=setup({options:{receiptAttempts:21,receiptIntervalMs:1500,pause:async ms=>{waits++;e.state.mono+=ms;}},
    handler:method=>method==='eth_getTransactionReceipt'&&++reads<6?null:undefined});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  assert.equal(waits,5);assert.equal(sent(e).length,1);
});
test('confirmation deadline bounds polling and preserves the same saved hash',async()=>{
  let waits=0;
  const e=setup({options:{confirmationTimeoutMs:3500,receiptAttempts:21,receiptIntervalMs:1500,
    pause:async ms=>{waits++;e.state.mono+=ms;}},
    handler:method=>method==='eth_getTransactionReceipt'?null:undefined});
  assert.equal((await e.wallet.send(e.review())).status,'pending');
  assert.equal(e.state.mono,4500);assert.equal(waits,3);
  assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
});
test('a hung receipt read is cut off by the remaining confirmation deadline',async()=>{
  const e=setup({options:{confirmationTimeoutMs:20,requestTimeoutMs:500,
    monotonic:()=>performance.now(),receiptAttempts:21},
    handler:method=>method==='eth_getTransactionReceipt'?new Promise(()=>{}):undefined});
  const start=performance.now();
  assert.equal((await e.wallet.send(e.review())).status,'unresolved');
  assert.ok(performance.now()-start<400);assert.equal(sent(e).length,1);
  assert.equal(e.wallet.pending.hash,HASH);
});
test('canonical block number must match receipt number even with matching hash',async()=>{
  const e=setup({handler:(method,params)=>method==='eth_getBlockByNumber'&&params[0]==='0x2'?{hash:BLOCK,number:'0x1'}:undefined});
  assert.equal((await e.wallet.send(e.review())).status,'pending');
  assert.equal(e.wallet.pending.hash,HASH);
});
test('confirmation window and attempt count have finite validated bounds',()=>{
  for(const confirmationTimeoutMs of [0,-1,60001,Infinity,1.5])assert.throws(()=>setup({options:{confirmationTimeoutMs}}),/bounds/);
  for(const receiptAttempts of [0,41,Infinity])assert.throws(()=>setup({options:{receiptAttempts}}),/bounds/);
});

test('wallet confirmation can outlast read timeout without sending twice',async()=>{
  const e=setup({timeout:5,options:{submissionTimeoutMs:100},send:async(t,{state,receipt,mined})=>{
    await new Promise(resolve=>setTimeout(resolve,25));
    state.receipt=receipt();state.transaction=mined(t);return HASH;
  }});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  assert.equal(sent(e).length,1);
  await e.wallet.acknowledge(HASH);assert.equal(e.wallet.pending,null);
});
test('transient receipt read failure is retried without a second submission',async()=>{
  let reads=0;
  const e=setup({options:{receiptAttempts:3},handler:method=>{
    if(method==='eth_getTransactionReceipt'&&++reads===1)throw Error('temporary RPC failure');
  }});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  assert.equal(reads,2);assert.equal(sent(e).length,1);
});
test('persistent receipt verification failure stays bounded and retains journal',async()=>{
  let reads=0;
  const e=setup({options:{receiptAttempts:3},handler:method=>{
    if(method==='eth_getTransactionReceipt'){reads++;throw Error('RPC unavailable');}
  }});
  assert.equal((await e.wallet.send(e.review())).status,'unresolved');
  assert.equal(reads,3);assert.equal(sent(e).length,1);assert.equal(e.wallet.pending.hash,HASH);
});
test('wallet confirmation wait has an independent finite bound',()=>{
  for(const value of [0,120001,Infinity,NaN,1.5])assert.throws(()=>setup({options:{submissionTimeoutMs:value}}),/bounds/);
  assert.equal(setup({options:{submissionTimeoutMs:90000}}).wallet.submissionTimeoutMs,90000);
});

test('local-only profile rejects public chain and malformed spending policy',()=>{
  for(const change of [{chainId:'0x1'},{chainId:'0x0'},{confirmations:0},{confirmations:33},{maxGas:'0x1'},{maxGasPrice:'0x0'},{maxNetworkFee:'0x0'},{maxValue:'0x0'},{allowedTargets:{}},{genesisHash:'bad'}])
    assert.throws(()=>setup({policy:{...policy(),...change}}));
});
test('strict transaction fields reject hidden RPC transaction options',()=>{
  const e=setup();
  for(const change of [{accessList:[]},{authorizationList:[]},{maxFeePerGas:'0x1'},{gas:undefined},{data:'0x12'},{nonce:'0x00'}])
    assert.throws(()=>e.review({transaction:{...tx(),...change}}));
  assert.equal(sent(e).length,0);
});
test('independently typed calldata, amount, sender, target and chain must match',()=>{
  const e=setup();
  for(const change of [{from:B},{to:B},{data:'0x12345679'},{value:'0x2'},{chainId:'0x1'}])
    assert.throws(()=>e.review({expectedTransaction:{...expected(tx()),...change}}),/differs/);
  assert.equal(sent(e).length,0);
});
test('economic comparison excludes backend gas and nonce, which are independently bounded',()=>{
  const e=setup();
  assert.throws(()=>e.review({expectedTransaction:{...expected(tx()),gas:'0x7530'}}),/five/);
  for(const change of [{gas:'0x100001'},{gasPrice:'0x101'},{gasPrice:'0x0'},{value:'0x100001'}]){
    const transaction={...tx(),...change};
    assert.throws(()=>e.review({transaction,expectedTransaction:expected(transaction)}),/policy/);
  }
});
test('review lifetime is bounded and both wall and monotonic clocks enforce expiry',async()=>{
  for(const expiresAt of [NaN,Infinity,100000,99999,160001])assert.throws(()=>setup().review({expiresAt}),/lifetime|expired/);
  const e=setup(),r=e.review();e.state.mono+=60000;e.state.now-=10000;
  await assert.rejects(e.wallet.send(r),/expired/);assert.equal(sent(e).length,0);
});
test('account, chain and genesis mismatches fail before submission',async()=>{
  for(const change of [{account:B},{chain:'0x1'},{genesis:OTHER}]){
    const e=setup(),r=e.review();Object.assign(e.state,change);
    await assert.rejects(e.wallet.send(r));assert.equal(sent(e).length,0);
  }
});
test('account/network/disconnect events invalidate reviewed handles',async()=>{
  for(const event of ['accountsChanged','chainChanged','disconnect']){
    const e=setup(),r=e.review();e.emit(event);
    await assert.rejects(e.wallet.send(r),/changed/);assert.equal(sent(e).length,0);
  }
});
test('account change during RPC validation cannot reach wallet confirmation',async()=>{
  const e=setup({handler:(method,_args,{state})=>{if(method==='eth_getCode')state.account=B;}});
  await assert.rejects(e.wallet.send(e.review()),/account changed/);assert.equal(sent(e).length,0);
});
test('nonce, code, balance and gas regressions require a fresh review',async()=>{
  for(const change of [{nonce:'0x1'},{code:'0x6002'},{balance:'0x1'},{gasPrice:'0x3'},{estimate:'0x7531'},{estimate:'0x1'}]){
    const e=setup(),r=e.review();Object.assign(e.state,change);
    await assert.rejects(e.wallet.send(r));assert.equal(sent(e).length,0);
  }
});
test('fresh full eth_call revert prevents signing',async()=>{
  const e=setup({handler:method=>{if(method==='eth_call')throw Error('execution reverted');}});
  await assert.rejects(e.wallet.send(e.review()),/reverted/);assert.equal(sent(e).length,0);
});
test('only explicit read RPC methods are exposed by the client',()=>{
  const e=setup();
  for(const method of ['eth_sendTransaction','eth_sendRawTransaction','personal_sign','wallet_addEthereumChain'])
    assert.throws(()=>e.wallet.read(method),/reads/);
});
test('recovery storage and cross-tab locks are mandatory before signing',async()=>{
  const e=setup({options:{locks:null}});
  await assert.rejects(e.wallet.send(e.review()),/tabs/);assert.equal(sent(e).length,0);
  const broken=setup({storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}}});
  await assert.rejects(broken.wallet.send(broken.review()),/saved/);assert.equal(sent(broken).length,0);
});
test('silent failed storage write is detected before wallet request',async()=>{
  const e=setup({storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  await assert.rejects(e.wallet.send(e.review()),/saved/);assert.equal(sent(e).length,0);
});
test('journal exists before the single request to the wallet and survives confirmation',async()=>{
  let e;
  e=setup({send:(transaction,{state,receipt,mined})=>{
    assert.equal(e.wallet.pending.status,'submitting');
    assert.deepEqual(e.wallet.pending.transaction,transaction);
    state.receipt=receipt();state.transaction=mined(transaction);return HASH;
  }});
  const result=await e.wallet.send(e.review());
  assert.equal(result.status,'confirmed');assert.equal(sent(e).length,1);
  assert.equal(e.wallet.pending.hash,HASH);assert.equal(e.wallet.pending.status,'confirmed');
  assert.deepEqual(e.wallet.pending.context,{draft_id:'draft-1'});
  await e.wallet.acknowledge(HASH);assert.equal(e.wallet.pending,null);
});
test('double-click and resubmission of a consumed review cannot send twice',async()=>{
  let release;const waiting=new Promise(r=>release=r);
  const e=setup({send:async(transaction,{state,receipt,mined})=>{
    await waiting;state.receipt=receipt();state.transaction=mined(transaction);return HASH;
  }}),r=e.review();
  const sending=e.wallet.send(r);
  await assert.rejects(e.wallet.send(r),/progress/);
  release();await sending;
  await assert.rejects(e.wallet.send(r),/Recover/);
  await e.wallet.acknowledge(HASH);
  await assert.rejects(e.wallet.send(r),/already submitted/);
  assert.equal(sent(e).length,1);
});
test('shared account lock prevents simultaneous requests from two tabs',async()=>{
  let release;const waiting=new Promise(r=>release=r),store=storage(),mutex=locks();
  const a=setup({storage:store,locks:mutex,send:async()=>{await waiting;return HASH;}}),
    b=setup({storage:store,locks:mutex});
  const first=a.wallet.send(a.review());
  await assert.rejects(b.wallet.send(b.review()),/another tab/);
  release();await first;
  assert.equal(sent(a).length,1);assert.equal(sent(b).length,0);
});
test('a saved pending transaction blocks another tab after its lock is released',async()=>{
  const store=storage(),mutex=locks(),a=setup({storage:store,locks:mutex,send:()=>HASH}),b=setup({storage:store,locks:mutex});
  assert.equal((await a.wallet.send(a.review())).status,'pending');
  await assert.rejects(b.wallet.send(b.review()),/Recover/);assert.equal(sent(b).length,0);
});
test('explicit wallet rejection clears intent but other provider errors retain it',async()=>{
  const a=setup({send:()=>{throw Object.assign(Error('No'),{code:4001});}});
  await assert.rejects(a.wallet.send(a.review()),e=>e.rejected===true);
  assert.equal(a.wallet.pending,null);
  for(const code of [-32000,-32603,-32002,undefined]){
    const b=setup({send:()=>{throw Object.assign(Error('RPC failure'),{code});}});
    assert.equal((await b.wallet.send(b.review())).status,'unresolved');
    assert.equal(b.wallet.pending.status,'submitting');
    assert.equal((await b.wallet.recover()).status,'unresolved');assert.equal(sent(b).length,1);
  }
});
test('wallet timeout keeps recovery and a late hash is recorded without resubmission',async()=>{
  let release;
  const e=setup({timeout:5,send:()=>new Promise(r=>release=r)});
  const result=await e.wallet.send(e.review());
  assert.equal(result.status,'unresolved');assert.equal(e.wallet.pending.hash,null);
  release(HASH);await new Promise(r=>setTimeout(r,0));
  assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
  await e.wallet.recover();assert.equal(sent(e).length,1);
});
test('malformed wallet hash remains unresolved with original intent',async()=>{
  const e=setup({send:()=>'0xbad'});
  assert.equal((await e.wallet.send(e.review())).status,'unresolved');
  assert.equal(e.wallet.pending.hash,null);assert.equal(sent(e).length,1);
});
test('refresh can recover a confirmed transaction using durable state',async()=>{
  const store=storage(),first=setup({storage:store});
  await first.wallet.send(first.review());
  const second=setup({storage:store});
  second.state.receipt=second.receipt();second.state.transaction=second.mined(tx());
  const recovered=await second.wallet.recover({account:A});
  assert.equal(recovered.status,'confirmed');assert.equal(second.wallet.pending.context.draft_id,'draft-1');
  assert.equal(sent(second).length,0);
});
test('account changes after send do not lose the original account recovery',async()=>{
  const e=setup();await e.wallet.send(e.review());e.state.account=B;e.emit('accountsChanged');
  assert.equal(e.wallet.pending.transaction.from,A);
  assert.equal((await e.wallet.recover({account:A})).status,'confirmed');
  assert.equal(sent(e).length,1);
});
test('wrong network on recovery preserves journal and never broadcasts',async()=>{
  const e=setup();await e.wallet.send(e.review());e.state.chain='0x1';
  assert.equal((await e.wallet.recover()).status,'unresolved');
  assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
});
test('unknown submission hash can only be attached to the exact reviewed transaction',async()=>{
  const e=setup({send:()=>{throw Error('lost response');}});
  await e.wallet.send(e.review());
  e.state.transaction=e.mined({...tx(),value:'0x2'});
  await assert.rejects(e.wallet.recover({hash:HASH}),/differs/);
  assert.equal(e.wallet.pending.hash,null);
  e.state.transaction=e.mined(tx());e.state.receipt=e.receipt();
  assert.equal((await e.wallet.recover({hash:HASH})).status,'confirmed');
  assert.equal(sent(e).length,1);
});
test('a different recovery hash cannot replace the original tracked hash',async()=>{
  const e=setup();await e.wallet.send(e.review());
  await assert.rejects(e.wallet.recover({hash:OTHER}),/different/);
  assert.equal(e.wallet.pending.hash,HASH);
});
test('canonical revert is a failed transaction, not permission to resubmit',async()=>{
  const e=setup({send:(transaction,{state,receipt,mined})=>{
    state.transaction=mined(transaction);state.receipt={...receipt(),status:'0x0'};return HASH;
  }});
  assert.equal((await e.wallet.send(e.review())).status,'failed');assert.equal(e.wallet.pending.status,'failed');
  await e.wallet.acknowledge(HASH);assert.equal(e.wallet.pending,null);assert.equal(sent(e).length,1);
});
test('mismatched signed transaction fails closed after submission',async()=>{
  for(const change of [{from:B},{to:B},{input:'0xdeadbeef'},{value:'0x2'},{nonce:'0x1'},{chainId:'0x1'},{gas:'0x100001'},{gasPrice:'0x3'}]){
    const e=setup({send:(transaction,{state,receipt,mined})=>{
      state.receipt=receipt();state.transaction={...mined(transaction),...change};return HASH;
    }});
    assert.equal((await e.wallet.send(e.review())).status,'unresolved');
    assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
    await assert.rejects(e.wallet.acknowledge(HASH),/reconciled/);
  }
});
test('wallet gas padding accepts a canonical approval with 25 percent headroom and original reviewed costs',async()=>{
  const approve={...tx(),value:'0x0',data:'0x095ea7b3'+A.slice(2).padStart(64,'0')+(10000n).toString(16).padStart(64,'0')};
  const e=setup({send:(transaction,{state,receipt,mined})=>{
    state.receipt=receipt();
    state.transaction=mined({...transaction,gas:'0x927c'}); // 37,500 versus reviewed 30,000.
    return HASH;
  }});
  const result=await e.wallet.send(e.review({transaction:approve,expectedTransaction:expected(approve)}));
  assert.equal(result.status,'confirmed');assert.equal(e.wallet.pending.transaction.gas,'0x7530');
  assert.equal(e.wallet.pending.transaction.data,approve.data);assert.equal(e.wallet.pending.transaction.value,'0x0');
  await e.wallet.acknowledge(HASH);assert.equal(e.wallet.pending,null);assert.equal(sent(e).length,1);
});
test('wallet gas padding outside operator gas limit or total envelope remains unresolved',async()=>{
  for(const [change,selectedPolicy] of [
    [{gas:'0x5207'},policy()],
    [{gas:'0x100001'},policy()],
    [{gas:'0xea60'},{...policy(),maxNetworkFee:'0x186a0'}] // 60,000*2 > 100,000 policy ceiling.
  ]){
    const e=setup({policy:selectedPolicy,send:(transaction,{state,receipt,mined})=>{
      state.receipt=receipt();state.transaction=mined({...transaction,...change});return HASH;
    }});
    assert.equal((await e.wallet.send(e.review())).status,'unresolved');
    assert.equal(e.wallet.pending.status,'pending');assert.equal(e.wallet.pending.transaction.gas,'0x7530');
    assert.equal(sent(e).length,1);
  }
});
test('wallet gas padding never permits a higher reviewed gas price or actual paid amount',async()=>{
  for(const [changedTransaction,changedReceipt] of [
    [{gas:'0x927c',gasPrice:'0x3'},{}],
    [{gas:'0x927c'},{gasUsed:'0x7531'}],
    [{gas:'0x927c'},{effectiveGasPrice:'0x3'}]
  ]){
    const e=setup({send:(transaction,{state,receipt,mined})=>{
      state.transaction=mined({...transaction,...changedTransaction});
      state.receipt={...receipt(),...changedReceipt};return HASH;
    }});
    assert.equal((await e.wallet.send(e.review())).status,'unresolved');
    assert.equal(e.wallet.pending.transaction.gasPrice,'0x2');assert.equal(sent(e).length,1);
  }
});
test('wallet gas padding requires receipt usage and price within the actual transaction too',async()=>{
  for(const [changedTransaction,changedReceipt] of [
    [{gas:'0x61a8'},{gasUsed:'0x61a9'}], // 25,001 used, actual limit 25,000, reviewed 30,000.
    [{gas:'0x927c',gasPrice:'0x1'},{effectiveGasPrice:'0x2'}]
  ]){
    const e=setup({send:(transaction,{state,receipt,mined})=>{
      state.transaction=mined({...transaction,...changedTransaction});
      state.receipt={...receipt(),...changedReceipt};return HASH;
    }});
    assert.equal((await e.wallet.send(e.review())).status,'unresolved');
    assert.equal(e.wallet.pending.status,'pending');
  }
});
test('wallet gas padding cannot authorize altered calldata, target, value or sender nonce',async()=>{
  for(const changed of [{input:'0xdeadbeef'},{to:B},{from:B},{value:'0x2'},{nonce:'0x1'},{chainId:'0x1'}]){
    const e=setup({send:(transaction,{state,receipt,mined})=>{
      state.transaction={...mined({...transaction,gas:'0x927c'}),...changed};state.receipt=receipt();return HASH;
    }});
    assert.equal((await e.wallet.send(e.review())).status,'unresolved');
    assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
  }
});
test('wallet gas padding without a canonical receipt stays pending and is never resubmitted',async()=>{
  const e=setup({send:(transaction,{state,mined})=>{
    state.transaction=mined({...transaction,gas:'0x927c'});return HASH;
  }});
  assert.equal((await e.wallet.send(e.review())).status,'pending');
  assert.equal((await e.wallet.recover()).status,'pending');
  assert.equal(e.wallet.pending.transaction.gas,'0x7530');assert.equal(sent(e).length,1);
});
test('wallet gas padding allows a smaller bounded gas envelope only after a matching receipt',async()=>{
  const e=setup({send:(transaction,{state,receipt,mined})=>{
    state.transaction=mined({...transaction,gas:'0x61a8'});state.receipt=receipt();return HASH;
  }});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  assert.equal(e.wallet.pending.transaction.gas,'0x7530');assert.equal(sent(e).length,1);
});
test('mismatched receipt identity and execution costs never confirm',async()=>{
  for(const change of [{transactionHash:OTHER},{from:B},{to:B},{status:'0x2'},{gasUsed:'0x7531'},{effectiveGasPrice:'0x3'},{transactionIndex:'0x1'}]){
    const e=setup({send:(transaction,{state,receipt,mined})=>{
      state.transaction=mined(transaction);state.receipt={...receipt(),...change};return HASH;
    }});
    assert.equal((await e.wallet.send(e.review())).status,'unresolved');
    assert.equal(e.wallet.pending.status,'pending');
  }
});
test('reorg and insufficient confirmations preserve pending receipt recovery',async()=>{
  const a=setup();a.state.block=OTHER;
  assert.equal((await a.wallet.send(a.review())).status,'pending');
  assert.equal(a.wallet.pending.status,'pending');
  const b=setup({policy:{...policy(),confirmations:2}});
  assert.equal((await b.wallet.send(b.review())).status,'pending');
  b.state.head='0x3';assert.equal((await b.wallet.recover()).status,'confirmed');
});
test('reorg after prior confirmation prevents acknowledgement',async()=>{
  const e=setup();await e.wallet.send(e.review());e.state.block=OTHER;
  await assert.rejects(e.wallet.acknowledge(HASH),/no longer confirmed/);
  assert.ok(e.wallet.pending);
});
test('a changed canonical inclusion must be reconciled again before acknowledgement',async()=>{
  for(const status of ['0x0','0x1']){
    const e=setup();await e.wallet.send(e.review());
    e.state.block=OTHER;e.state.receipt={...e.state.receipt,blockHash:OTHER,status};
    e.state.transaction={...e.state.transaction,blockHash:OTHER};
    await assert.rejects(e.wallet.acknowledge(HASH),/inclusion changed/);
    assert.equal(e.wallet.pending.receipt.blockHash,OTHER);
    await e.wallet.recover();await e.wallet.acknowledge(HASH);
    assert.equal(e.wallet.pending,null);assert.equal(sent(e).length,1);
  }
});
test('another tab cannot replace the receipt that this tab reconciled',async()=>{
  const store=storage(),mutex=locks(),a=setup({storage:store,locks:mutex}),b=setup({storage:store,locks:mutex});
  await a.wallet.send(a.review());
  for(const e of [a,b]){
    e.state.block=OTHER;e.state.receipt={...e.receipt(),blockHash:OTHER};
    e.state.transaction={...e.mined(tx()),blockHash:OTHER};
  }
  await b.wallet.recover({account:A});
  await assert.rejects(a.wallet.acknowledge(HASH),/inclusion changed/);
  assert.equal(a.wallet.pending.receipt.blockHash,OTHER);
});
test('reload requires recovery before it can acknowledge a terminal journal',async()=>{
  const store=storage(),a=setup({storage:store}),b=setup({storage:store});
  await a.wallet.send(a.review());
  await assert.rejects(b.wallet.acknowledge(HASH,{account:A}),/Recover and reconcile/);
  assert.ok(a.wallet.pending);
});
test('large receipt logs do not enlarge durable transaction journal',async()=>{
  const e=setup({send:(transaction,{state,receipt,mined})=>{
    state.transaction=mined(transaction);state.receipt={...receipt(),logs:[{data:'a'.repeat(100000)}]};return HASH;
  }});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  assert.equal(e.wallet.pending.receipt.logs,undefined);assert.ok([...e.store.map.values()][0].length<40000);
});
test('malformed persisted recovery data blocks new payment rather than disappearing',async()=>{
  const e=setup();e.store.setItem(e.wallet.key(A),'not json');
  await assert.rejects(e.wallet.send(e.review()),/record is invalid/);assert.equal(sent(e).length,0);
});
test('closing wallet removes listeners and prevents signing old handles',async()=>{
  const e=setup(),r=e.review();e.wallet.close();const version=e.wallet.changeVersion;
  e.emit('accountsChanged');assert.equal(e.wallet.changeVersion,version);
  await assert.rejects(e.wallet.send(r),/closed/);assert.equal(sent(e).length,0);
});
test('arbitrary handles and mutation of visible review cannot change signed values',async()=>{
  const e=setup(),r=e.review();
  assert.throws(()=>{r.transaction.value='0x2';},TypeError);
  await assert.rejects(e.wallet.send({...r}),/validated/);
  assert.equal((await e.wallet.send(r)).status,'confirmed');
  assert.equal(sent(e)[0].params[0].value,'0x1');
});

test('authorized second account signs only the explicitly reviewed sender',async()=>{
  const e=setup({handler:method=>method==='eth_accounts'?[B,A]:undefined});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  assert.equal(sent(e).length,1);assert.equal(sent(e)[0].params[0].from,A);
});
test('authorized second account revoked before submission cannot sign',async()=>{
  let accounts=[B,A];
  const e=setup({handler:method=>method==='eth_accounts'?accounts:undefined});
  const review=e.review();accounts=[B];
  await assert.rejects(e.wallet.send(review),/account changed/);
  assert.equal(sent(e).length,0);
});
test('authorized accounts with malformed entries never pass signer checks',async()=>{
  const e=setup({handler:method=>method==='eth_accounts'?[A,'bad-address']:undefined});
  await assert.rejects(e.wallet.send(e.review()),/account changed/);
  assert.equal(sent(e).length,0);
});


test('wallet RPC padded hex confirms and acknowledges without relaxing reviewed transaction encoding',async()=>{
  const numeric=new Set(['value','nonce','chainId','gas','gasPrice','transactionIndex','blockNumber','gasUsed','effectiveGasPrice','number']);
  const pad=x=>'0x00'+x.slice(2);
  const e=setup();const original=e.provider.request;
  e.provider.request=async req=>{
    const result=await original(req);
    if(['eth_chainId','eth_getTransactionCount','eth_getBalance','eth_gasPrice','eth_estimateGas','eth_blockNumber'].includes(req.method))return pad(result);
    if(['eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber'].includes(req.method)&&result){
      return Object.fromEntries(Object.entries(result).map(([k,v])=>[k,numeric.has(k)&&typeof v==='string'?pad(v):v]));
    }
    return result;
  };
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');
  await e.wallet.acknowledge(HASH);
  assert.equal(e.wallet.pending,null);assert.equal(sent(e).length,1);
  const bad={...tx(),nonce:'0x00'};
  assert.throws(()=>e.review({transaction:bad}),/Invalid transaction quantity/);
});
test('invalid wallet preflight quantity identifies method and proves no submission',async()=>{
  for(const invalid of [null,1.25,'100','0x','0x-1','0x1.5','0x'+'f'.repeat(65)]){
    const e=setup({handler:method=>method==='eth_estimateGas'?invalid:undefined});
    await assert.rejects(e.wallet.send(e.review()),error=>error.notSubmitted===true&&error.code==='INVALID_RPC_QUANTITY'&&error.message.includes('eth_estimateGas'));
    assert.equal(sent(e).length,0);assert.equal(e.wallet.pending,null);
  }
});
test('missing confirmed transaction quantity preserves same hash and reports exact field',async()=>{
  const e=setup({send:(t,{state,receipt,mined})=>{
    state.transaction=mined(t);delete state.transaction.chainId;state.receipt=receipt();return HASH;
  }});
  const result=await e.wallet.send(e.review());
  assert.equal(result.status,'unresolved');assert.match(result.error,/no verifiable signed chain ID/);
  assert.equal(e.wallet.pending.hash,HASH);
  e.state.transaction.chainId='0x007a69';
  assert.equal((await e.wallet.recover({account:A})).status,'confirmed');
  await e.wallet.acknowledge(HASH);assert.equal(sent(e).length,1);
});
test('invalid receipt quantity does not confirm or discard pending journal',async()=>{
  const e=setup({send:(t,{state,receipt,mined})=>{
    state.transaction=mined(t);state.receipt={...receipt(),gasUsed:Number.MAX_SAFE_INTEGER+1};return HASH;
  }});
  const result=await e.wallet.send(e.review());
  assert.equal(result.status,'unresolved');assert.match(result.error,/receipt.gasUsed.*number/);
  assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
});


test('transaction progress stages follow one send and cannot be changed by UI exceptions',async()=>{
 const stages=[];const e=setup({options:{onProgress:event=>{stages.push(event.stage);if(event.stage==='wallet')throw Error('UI failed');}}});
 assert.equal((await e.wallet.send(e.review())).status,'confirmed');
 assert.deepEqual(stages,['checking','wallet','submitted','confirming','confirmed']);assert.equal(sent(e).length,1);
});
test('failed preflight never announces wallet confirmation or submission stages',async()=>{
 const stages=[];const e=setup({options:{onProgress:event=>stages.push(event.stage)}});e.state.balance='0x0';
 await assert.rejects(e.wallet.send(e.review()),/Insufficient/);assert.deepEqual(stages,['checking']);assert.equal(sent(e).length,0);
});


test('safe numeric wallet nonce is normalized while submitted nonce stays canonical hex',async()=>{
 const e=setup();e.state.nonce=35;
 const transaction={...tx(),nonce:'0x23'};
 const result=await e.wallet.send(e.review({transaction}));
 assert.equal(result.status,'confirmed');assert.equal(sent(e).length,1);
 assert.equal(sent(e)[0].params[0].nonce,'0x23');
 await e.wallet.acknowledge(HASH);assert.equal(e.wallet.pending,null);
});


test('safe numeric RPC and mined transaction quantities retain exact receipt and gas checks',async()=>{
 const numeric=new Set(['value','nonce','chainId','gas','gasPrice','transactionIndex','blockNumber','gasUsed','effectiveGasPrice','number']);
 const e=setup();const original=e.provider.request;
 e.provider.request=async req=>{
  const result=await original(req);
  if(['eth_chainId','eth_getTransactionCount','eth_getBalance','eth_gasPrice','eth_estimateGas','eth_blockNumber'].includes(req.method))return Number(BigInt(result));
  if(['eth_getTransactionByHash','eth_getTransactionReceipt','eth_getBlockByNumber'].includes(req.method)&&result)
   return Object.fromEntries(Object.entries(result).map(([k,v])=>[k,numeric.has(k)&&typeof v==='string'?Number(BigInt(v)):v]));
  return result;
 };
 assert.equal((await e.wallet.send(e.review())).status,'confirmed');
 await e.wallet.acknowledge(HASH);assert.equal(sent(e).length,1);assert.equal(e.wallet.pending,null);
 for(const key of ['nonce','value','chainId','gas','gasPrice'])assert.match(sent(e)[0].params[0][key],/^0x(?:0|[1-9a-f][0-9a-f]*)$/);
});

test('unsafe or ambiguous numeric nonce never reaches wallet submission',async()=>{
 for(const nonce of [-1,-0,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1,'35',true,{},null]){
  const e=setup();e.state.nonce=nonce;
  await assert.rejects(e.wallet.send(e.review()),error=>error.notSubmitted&&error.code==='INVALID_RPC_QUANTITY'&&error.message.includes('eth_getTransactionCount'));
  assert.equal(sent(e).length,0);assert.equal(e.wallet.pending,null);assert.equal(e.store.map.size,0);
 }
});

test('safe numeric nonce is still compared exactly and numeric prepared transactions remain invalid',async()=>{
 const e=setup();e.state.nonce=1;
 await assert.rejects(e.wallet.send(e.review()),/sent another transaction/);assert.equal(sent(e).length,0);
 for(const key of ['nonce','value','chainId','gas','gasPrice'])assert.throws(()=>e.review({transaction:{...tx(),[key]:0}}),/Invalid transaction quantity/);
 const maximum={...tx(),nonce:'0x1fffffffffffff'};
 e.state.nonce=Number.MAX_SAFE_INTEGER;
 assert.equal((await e.wallet.send(e.review({transaction:maximum}))).status,'confirmed');
 assert.equal(sent(e)[0].params[0].nonce,maximum.nonce);
});

test('unsafe numeric financial responses fail before send and over-limit safe numbers still fail guards',async()=>{
 for(const field of ['balance','estimate','gasPrice']){
  const e=setup();e.state[field]=Number.MAX_SAFE_INTEGER+1;
  await assert.rejects(e.wallet.send(e.review()),error=>error.notSubmitted&&error.code==='INVALID_RPC_QUANTITY');assert.equal(sent(e).length,0);
 }
 const e=setup();e.state.estimate=30001;
 await assert.rejects(e.wallet.send(e.review()),/Gas requirement changed/);assert.equal(sent(e).length,0);
});


test('EIP1559 paid fee derives from signed cap and canonical base even with uncapped RPC convenience fields',async()=>{
 const e=setup({handler:(method,params)=>method==='eth_getBlockByNumber'?{hash:params[0]==='0x0'?GENESIS:BLOCK,number:params[0],baseFeePerGas:'0x1'}:undefined,
 send:(t,{state,receipt,mined})=>{state.transaction={...mined(t),type:'0x2',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x2',gasPrice:'0x3'};state.receipt={...receipt(),effectiveGasPrice:'0x3'};return HASH;}});
 const result=await e.wallet.send(e.review());assert.equal(result.status,'confirmed');assert.equal(result.receipt.effectiveGasPrice,'0x2');assert.equal(result.receipt.reportedEffectiveGasPrice,'0x3');
 await e.wallet.acknowledge(HASH);assert.equal(sent(e).length,1);
});

test('dynamic fee caps, priority, base and paid gas cannot bypass review limits',async()=>{
 for(const change of [{maxFeePerGas:'0x3'},{maxPriorityFeePerGas:'0x3'},{baseFeePerGas:'0x3'},{gasUsed:'0x7531'},{type:'0x3'},{maxFeePerGas:null}]){
  const e=setup({options:{receiptAttempts:21},handler:(m,p)=>m==='eth_getBlockByNumber'?{hash:p[0]==='0x0'?GENESIS:BLOCK,number:p[0],baseFeePerGas:change.baseFeePerGas||'0x1'}:undefined,
   send:(t,{state,receipt,mined})=>{state.transaction={...mined(t),type:'0x2',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x1',...change};state.receipt={...receipt(),gasUsed:change.gasUsed||'0x5208'};return HASH;}});
  const result=await e.wallet.send(e.review());assert.equal(result.status,'unresolved');assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
  assert.equal(e.calls.filter(c=>c.method==='eth_getTransactionReceipt').length,1);
 }
});

test('dynamic effective fee below cap is exact and unknown canonical base fails closed',async()=>{
 for(const base of ['0x0',null]){
  const e=setup({handler:(m,p)=>m==='eth_getBlockByNumber'?{hash:p[0]==='0x0'?GENESIS:BLOCK,number:p[0],baseFeePerGas:base}:undefined,
   send:(t,{state,receipt,mined})=>{state.transaction={...mined(t),type:'0x2',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x1'};state.receipt=receipt();return HASH;}});
  const result=await e.wallet.send(e.review());assert.equal(result.status,base===null?'unresolved':'confirmed');if(base!==null)assert.equal(result.receipt.effectiveGasPrice,'0x1');
 }
});

test('legacy omission resolves the signed EIP155 chain, typed omission never uses parity',async()=>{
 for(const change of [{type:'0x0',chainId:null,v:'0xf4f5'},{type:'0x0',chainId:null,v:'0xf4f6'}]){
  const e=setup({send:(t,{state,receipt,mined})=>{state.transaction={...mined(t),...change};state.receipt=receipt();return HASH;}});
  assert.equal((await e.wallet.send(e.review())).status,'confirmed');await e.wallet.acknowledge(HASH);
 }
 for(const change of [{chainId:null,v:'0x25'},{v:'0x25'},{chainId:null,v:'0x1b'},
  {type:'0x2',chainId:null,v:'0xf4f5',maxFeePerGas:'0x2',maxPriorityFeePerGas:'0x1'}]){
  const e=setup({send:(t,{state,receipt,mined})=>{state.transaction={...mined(t),...change};state.receipt=receipt();return HASH;}});
  assert.equal((await e.wallet.send(e.review())).status,'unresolved');assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
 }
});

for(const action of ['mint','approve','activate','increase','claim'])test(`${action}: signed once, node confirms despite missing wallet chainId and failing wallet receipt methods`,async()=>{
 const e=setup(),nodeCalls=[],original=e.provider.request;
 e.wallet.readProvider={request:async request=>{nodeCalls.push(request.method);return original(request);}};
 e.provider.request=async request=>{
  if(request.method==='eth_getTransactionByHash')return {...e.state.transaction,chainId:undefined};
  if(request.method==='eth_getTransactionReceipt')throw Error('Extension formatted response is unusable');
  return original(request);
 };
 const result=await e.wallet.send(e.review({context:{action}}));
 assert.equal(result.status,'confirmed');assert.equal(e.wallet.pending.context.action,action);
 await e.wallet.acknowledge(HASH);assert.equal(e.wallet.pending,null);
 assert.ok(nodeCalls.includes('eth_getTransactionReceipt'));assert.equal(sent(e).length,1);
 assert.equal(nodeCalls.includes('eth_sendTransaction'),false);assert.equal(nodeCalls.includes('eth_accounts'),false);
});

test('independent reader validates chain and genesis before any signature',async()=>{
 for(const mismatch of ['chain','genesis']){
  const e=setup();
  e.wallet.readProvider={request:request=>request.method==='eth_chainId'&&mismatch==='chain'?'0x1':
   request.method==='eth_getBlockByNumber'&&request.params[0]==='0x0'&&mismatch==='genesis'?{hash:OTHER}:e.provider.request(request)};
  await assert.rejects(e.wallet.send(e.review()),error=>error.notSubmitted===true);
  assert.equal(sent(e).length,0);assert.equal(e.wallet.pending,null);
 }
});

test('pending transaction recovers through original chain reader after extension changes networks',async()=>{
 const e=setup({send:()=>HASH}),original=e.provider.request;
 e.wallet.readProvider={request:original};
 assert.equal((await e.wallet.send(e.review())).status,'pending');
 e.provider.request=request=>request.method==='eth_chainId'?'0x1':original(request);e.emit('chainChanged');
 e.state.transaction=e.mined(tx());e.state.receipt=e.receipt();
 assert.equal((await e.wallet.recover({account:A})).status,'confirmed');await e.wallet.acknowledge(HASH);
 assert.equal(sent(e).length,1);
});

test('failed node read retains original hash and never falls back to inconsistent extension data',async()=>{
 const e=setup(),original=e.provider.request;let unavailable=true;
 e.wallet.readProvider={request:request=>{
  if(request.method==='eth_getTransactionReceipt'&&unavailable)throw Error('reader offline');return original(request);
 }};
 assert.equal((await e.wallet.send(e.review())).status,'unresolved');assert.equal(e.wallet.pending.hash,HASH);
 unavailable=false;assert.equal((await e.wallet.recover({account:A})).status,'confirmed');assert.equal(sent(e).length,1);
});

test('receipt visible before transaction details is temporary pending, not another submission',async()=>{
 let reads=0;const e=setup({options:{receiptAttempts:3},handler:method=>method==='eth_getTransactionByHash'&&++reads===1?null:undefined});
 assert.equal((await e.wallet.send(e.review())).status,'confirmed');assert.equal(reads,2);assert.equal(sent(e).length,1);
});

test('approval success cannot automatically sign Entry, and reverted Entry is never confirmed',async()=>{
 const e=setup(),t={...tx(),value:'0x0',data:'0x095ea7b3'+'0'.repeat(64)+'0'.repeat(60)+'2710'};
 assert.equal((await e.wallet.send(e.review({transaction:t,expectedTransaction:expected(t),context:{action:'approve'}}))).status,'confirmed');
 assert.equal(sent(e).length,1);await e.wallet.acknowledge(HASH);assert.equal(sent(e).length,1);
 e.state.nonce='0x1';const entry={...tx(),nonce:'0x1',data:'0x35b13b87'};
 const original=e.provider.request;e.provider.request=async request=>{const result=await original(request);if(request.method==='eth_getTransactionReceipt')return {...result,status:'0x0'};return result;};
 // The default reader is this same provider; the second signature is explicit.
 assert.equal((await e.wallet.send(e.review({transaction:entry,expectedTransaction:expected(entry),context:{action:'activate'}}))).status,'failed');
 assert.equal(sent(e).length,2);assert.equal(e.wallet.pending.status,'failed');
});


test('chain reader changing networks during receipt reads cannot finalize or discard the transaction',async()=>{
 const e=setup(),original=e.provider.request;let changed=false;
 e.wallet.readProvider={request:request=>{
  if(request.method==='eth_chainId'&&changed)return '0x1';
  if(request.method==='eth_getTransactionReceipt')changed=true;
  return original(request);
 }};
 const result=await e.wallet.send(e.review());assert.equal(result.status,'unresolved');
 assert.match(result.error,/Configured RPC/);assert.equal(e.wallet.pending.hash,HASH);assert.equal(sent(e).length,1);
});
