import test from 'node:test';
import assert from 'node:assert/strict';
import {WalletDiscovery,WalletConnection} from '../wallet.js';
import {walletStage,walletFailureState,mintButtonLabel} from '../local-view.js';
const A='0x'+'11'.repeat(20);
const provider=()=>({request:async({method})=>method==='eth_chainId'?'0x7a69':[A]});
const detail=(p,n=1)=>({provider:p,info:{uuid:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,rdns:n===1?'io.metamask':'io.rabby',name:n===1?'MetaMask':'Rabby'}});
test('modern discovery suppresses competing legacy injection and binds exact providers',()=>{
 const d=new WalletDiscovery(),mm=provider(),rabby=provider(),proxy={...provider(),isMetaMask:true};
 d.announce(detail(mm));d.announce(detail(rabby,2));d.legacy(proxy);
 assert.equal(d.items.length,2);assert.equal(d.items[0].provider,mm);assert.equal(d.items[1].provider,rabby);
});
test('late EIP6963 announcement replaces fallback without sending any provider request',()=>{
 let reads=0;const p={request:()=>{reads++;}},d=new WalletDiscovery();
 d.legacy(p);assert.equal(d.items[0].name,'Browser wallet (legacy)');
 d.announce(detail(p));assert.equal(d.items.length,1);assert.equal(d.items[0].id,'io.metamask');assert.equal(reads,0);
});
test('duplicate, conflicting identity and malformed discovery announcements cannot multiply choices',()=>{
 const d=new WalletDiscovery(),p=provider();d.announce(detail(p));
 assert.equal(d.announce(detail(p,2)),false);assert.equal(d.announce(detail(provider())),false);
 for(const item of [null,{},detail(null),{...detail(provider(),2),info:{name:'MetaMask'}}])assert.equal(d.announce(item),false);
 assert.equal(d.items.length,1);
});
test('cancelled account-choice state is cleared by disconnect and a different provider connection',async()=>{
 const w=new WalletConnection(()=>{},null);w.requireAccountChoice=true;w.disconnect();assert.equal(w.requireAccountChoice,false);
 w.requireAccountChoice=true;await w.connect(provider(),'Rabby','io.rabby');assert.equal(w.requireAccountChoice,false);assert.equal(w.state.address,A);
});
test('transaction stage copy distinguishes preflight, wallet approval, receipt and reconciliation',()=>{
 assert.match(walletStage('checking')[1],/No transaction sent/);
 assert.match(walletStage('wallet')[1],/approve or reject/);
 assert.match(walletStage('submitted')[1],/hash is saved/);
 assert.match(walletStage('confirming')[1],/No new transaction/);
 assert.match(walletStage('syncing')[1],/receipt is confirmed/);
 assert.equal(walletStage('unexpected'),null);
});

test('failure copy never calls a saved submission unsent or a confirmed receipt unconfirmed',()=>{
 assert.equal(walletFailureState({pending:true,notSubmitted:true})[0],'Check transaction status');
 assert.equal(walletFailureState({confirmed:true})[0],'Transaction confirmed');
 assert.equal(walletFailureState({notSubmitted:true})[0],'Transaction not sent');
 assert.equal(walletFailureState({rejected:true})[0],'Cancelled in wallet');
 assert.equal(walletFailureState({failed:true})[0],'Transaction reverted');
});


test('mint button distinguishes first load and refresh from an actual mint',()=>{
 assert.equal(mintButtonLabel({activity:{kind:'read',initial:true},stale:true}),'Loading mint details…');
 assert.equal(mintButtonLabel({activity:{kind:'read',initial:false},account:true}),'Refreshing mint details…');
 assert.equal(mintButtonLabel({activity:{kind:'prepare',action:'mint'}}),'Preparing mint review…');
 assert.equal(mintButtonLabel({activity:{kind:'submit',action:'mint',stage:'wallet'}}),'Confirm mint in wallet…');
 assert.equal(mintButtonLabel({activity:{kind:'submit',action:'mint',stage:'confirming'}}),'Waiting for mint confirmation…');
 assert.equal(mintButtonLabel({activity:{kind:'submit',action:'mint',stage:'syncing'}}),'Updating minted NFT…');
});

test('other NFT operations never label the mint button as a mint in progress',()=>{
 for(const action of ['claim','claim_all','approve','activate','increase'])
  assert.equal(mintButtonLabel({activity:{kind:'submit',action},account:true}),'Review mint ↗');
 assert.equal(mintButtonLabel({pending:true,account:true}),'Check saved transaction status');
 assert.equal(mintButtonLabel({activity:{kind:'read'},pending:true}),'Checking transaction status…');
 assert.equal(mintButtonLabel({stale:true,account:true}),'Refresh mint details');
 assert.equal(mintButtonLabel({account:true}),'Review mint ↗');
});
