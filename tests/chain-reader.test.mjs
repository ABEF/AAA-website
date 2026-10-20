import test from 'node:test';
import assert from 'node:assert/strict';
import {createChainReader} from '../browser-wallet.js';
const reply=(options,result)=>new Response(JSON.stringify({jsonrpc:'2.0',id:JSON.parse(options.body).id,result}));
test('read transport is HTTPS or loopback, credential-free, redirect-free and read-only',async()=>{
 for(const url of ['http://example.com','file:///tmp/x','https://user:pass@example.com','https://example.com/#x'])assert.throws(()=>createChainReader(url));
 const calls=[];const reader=createChainReader('https://rpc.example.org/chain',{fetcher:async(url,options)=>{calls.push({url,options});return reply(options,'0x1');}});
 assert.equal(await reader.request({method:'eth_chainId'}),'0x1');
 assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.redirect,'error');assert.equal(calls[0].options.cache,'no-store');
 for(const method of ['eth_sendTransaction','eth_sendRawTransaction','eth_accounts','wallet_requestPermissions','debug_traceCall','anvil_mine'])await assert.rejects(reader.request({method}),/only node reads/);
 assert.equal(calls.length,1);
});
test('read transport rejects malformed or ambiguous envelopes, raw RPC errors and oversized responses',async()=>{
 for(const result of [null,[],{jsonrpc:'2.0',id:2,result:'0x1'}, {jsonrpc:'1.0',id:1,result:'0x1'},
  {jsonrpc:'2.0',id:1,result:'0x1',error:{}},{jsonrpc:'2.0',id:1}, {jsonrpc:'2.0',id:1,error:{message:'PRIVATE URL/TOKEN'}}]){
  const r=createChainReader('http://127.0.0.1:1234',{fetcher:async()=>new Response(JSON.stringify(result))});
  await assert.rejects(r.request({method:'eth_chainId'}),error=>!error.message.includes('PRIVATE'));
 }
 for(const headers of [{},{'content-length':'300'},{'content-length':'bad'}]){
  const r=createChainReader('https://rpc.example.org',{maxBytes:256,fetcher:async()=>new Response('x'.repeat(300),{headers})});
  await assert.rejects(r.request({method:'eth_chainId'}),/size limit/);
 }
});
test('stream size is bounded even when the server advertises a smaller length',async()=>{
 const r=createChainReader('https://rpc.example.org',{maxBytes:256,fetcher:async()=>new Response('x'.repeat(300),{headers:{'content-length':'1'}})});
 await assert.rejects(r.request({method:'eth_chainId'}),/size limit/);
});
test('transport cancels on timeout or caller cancellation without retries',async()=>{
 for(const external of [false,true]){
  let calls=0,aborted=false;const control=new AbortController();
  const r=createChainReader('https://rpc.example.org',{timeoutMs:10,fetcher:async(_url,{signal})=>{
   calls++;return new Promise((_,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));},{once:true}));
  }});
  const request=r.request({method:'eth_chainId',signal:control.signal});if(external)control.abort();
  await assert.rejects(request);assert.equal(calls,1);assert.equal(aborted,true);
 }
});
test('malformed JSON, HTTP errors and redirects never become successful reads',async()=>{
 for(const response of [new Response('not-json'),new Response('oops',{status:503}),{ok:true,redirected:true}]){
  const r=createChainReader('https://rpc.example.org',{fetcher:async()=>response});await assert.rejects(r.request({method:'eth_chainId'}));
 }
});
