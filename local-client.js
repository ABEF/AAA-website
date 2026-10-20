// Only the launcher's explicitly mounted loopback website may use this adapter.
export const localMode = location => location.hostname === '127.0.0.1' && location.pathname === '/app/' && location.protocol === 'http:';
export const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function uint(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,77})$/.test(value) || BigInt(value) >= 2n**256n) throw new Error('Invalid on-chain integer');
  return BigInt(value);
}
export function units(value, decimals = 18, precision = 6) {
  if (value == null) return 'Unavailable';
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error('Invalid currency precision');
  const raw=uint(value), base=10n**BigInt(decimals), places=Math.min(precision,decimals);
  const fraction=(raw%base).toString().padStart(decimals,'0').slice(0,places).replace(/0+$/,'');
  if(raw>0n && raw<10n**BigInt(decimals-places)) return '<0.'+'0'.repeat(places-1)+'1';
  return (raw/base).toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export function usd(value) {
  if (value == null) return 'Unavailable';
  const cents=(uint(value)+5n*10n**15n)/10n**16n;
  return '$'+(cents/100n).toLocaleString('en-US')+'.'+(cents%100n).toString().padStart(2,'0');
}
export function sum(values) { return values.some(v=>v==null) ? null : values.reduce((a,v)=>a+uint(v),0n).toString(); }
const nativeAsset='0x'+'0'.repeat(40);
export const readyRewards = (nft,scope) => nft.claimable[scope].filter(a=>nft.claimable.default_settlement!=='native_eth'||a.asset===nativeAsset);
export const pendingConversion = nft => nft.claimable.default_settlement==='native_eth'
  ? ['lp','royalties'].flatMap(scope=>nft.claimable[scope].filter(a=>a.asset!==nativeAsset&&uint(a.raw)>0n)) : [];
export const hasClaim = nft => ['lp','royalties'].some(scope=>readyRewards(nft,scope).some(a=>uint(a.raw)>0n));
export function balances(rows, field='raw') {
  const amounts=new Map();
  for (const a of rows) {
    uint(a[field]);
    const item=amounts.get(a.asset);
    if (item && (item.decimals!==a.decimals || item.symbol!==a.symbol)) throw new Error('Inconsistent currency metadata');
    amounts.set(a.asset,{...a,[field]:(BigInt(item?.[field]||'0')+BigInt(a[field])).toString()});
  }
  return [...amounts.values()].filter(a=>uint(a[field])>0n).map(a=>`${units(a[field],a.decimals)} ${a.symbol}`).join(' + ') || '0';
}
export function validateState(s) {
  if (s?.mode!=='LOCAL ANVIL TEST ONLY' || s.chain_id!==31337 || !Number.isSafeInteger(s.revision) || s.revision<0 || !Array.isArray(s.accounts) || s.accounts.length!==2 || s.accounts.some(a=>!/^0x[0-9a-f]{40}$/.test(a)) || new Set(s.accounts).size!==2 || !Array.isArray(s.nfts) || s.nfts.length>20) throw new Error('Unrecognized local deployment');
  const ids=new Set();
  for(const n of s.nfts) {
    if (uint(n.token_id)===0n || ids.has(n.token_id) || n.chain_id!==31337 || !/^0x[0-9a-f]{40}$/.test(n.owner)) throw new Error('Invalid NFT identity');
    ids.add(n.token_id);
    if(!Number.isSafeInteger(n.mint_ordinal)||n.mint_ordinal<1||typeof n.position?.activated!=='boolean'||typeof n.position.current_lp_value?.available!=='boolean')throw new Error('Malformed NFT position');
    if(n.traits_ready && (!['Commun','Rare','Legendary'].includes(n.traits?.rarity)||!Number.isInteger(n.traits.palette)||n.traits.palette<0||n.traits.palette>=58||!Number.isInteger(n.traits.pattern)||n.traits.pattern<0||n.traits.pattern>=4))throw new Error('Unknown revealed traits');
    if (n.position.current_lp_value.available) uint(n.position.current_lp_value.raw);
    for(const scope of ['lp','royalties']) balances(n.claimable[scope]);
    if(n.claimable.default_settlement!==undefined&&!['native_eth','source_assets'].includes(n.claimable.default_settlement))throw new Error('Unknown reward settlement policy');
  }
  if(!s.protocol?.provenance?.block_hash || !s.protocol?.lifecycle) throw new Error('Missing confirmed snapshot');
  return s;
}

const validAccounts=a=>Array.isArray(a)&&a.length===2&&a.every(v=>/^0x[0-9a-f]{40}$/.test(v))&&new Set(a).size===2;
const waitForRead=(milliseconds,signal)=>new Promise((resolve,reject)=>{
  if(signal.aborted)return reject(new Error('Local read timed out'));
  const aborted=()=>{clearTimeout(timer);reject(new Error('Local read timed out'));};
  const timer=setTimeout(()=>{signal.removeEventListener('abort',aborted);resolve();},milliseconds);
  signal.addEventListener('abort',aborted,{once:true});
});

export class LocalClient {
  constructor({fetcher=(...args)=>fetch(...args),storage=sessionStorage,random=()=>crypto.randomUUID().replaceAll('-',''),pause=waitForRead,onSession=()=>{},clock=()=>performance.now()}={}) {
    this.clock=clock;this.fetcher=fetcher;this.storage=storage;this.random=random;this.pause=pause;this.refreshing=null;this.accounts=[];this.onSession=onSession;this.walletKey='popl-local-website-wallet-v1';
    this.key='popl-local-website-pending-v1';this.session=null;this.state=null;this.account=null;this.busy=false;this.pending=null;this.version=0;
  }
  async request(path,body,isCurrent=()=>true,onAttempt=()=>{}) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
    try {
      for(let attempt=0;;attempt++) {
        if(controller.signal.aborted)throw new Error('Local request timed out');
        if(!isCurrent())throw new Error('Wallet or state changed. Prepare again');
        onAttempt();
        const response=await this.fetcher(path,{signal:controller.signal,cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':this.session.token},body:JSON.stringify(body)}:{})});
        const result=await response.json();
        if(!response.ok) {
          // /prepare only creates an unsigned confirmation. This exact 409 is
          // returned before preparation starts, so waiting cannot submit funds.
          // Never retry /action, lost responses, or validation/accounting errors.
          const safeBusyRetry=(!body&&path==='/state')||(body&&path==='/prepare');
          if(safeBusyRetry&&response.status===409&&result.error==='Local operation in progress; refresh shortly'&&attempt<29) {
            await this.pause(Math.min(500*2**attempt,3000),controller.signal);continue;
          }
          const error=new Error(result.error||'Local request failed');error.rejected=result.rejected===true;throw error;
        }
        return result;
      }
    } finally {clearTimeout(timer);}
  }
  refresh() {
    if(this.refreshing)return this.refreshing;
    this.refreshing=this.refreshState().finally(()=>{this.refreshing=null;});
    return this.refreshing;
  }
  async refreshState() {
    this.state=null;this.version++;
    const session=await this.request('/session');
    if(session.mode!=='LOCAL ANVIL TEST ONLY'||session.chain_id!==31337||!/^[a-f0-9]{64}$/.test(session.token)) throw new Error('This is not the disposable Anvil session');
    if(session.accounts!==undefined&&!validAccounts(session.accounts))throw new Error('Invalid local wallet inventory');
    if(this.session?.token!==session.token){this.account=null;this.accounts=[];}
    this.session=session;
    let wallet=null;
    try {const raw=this.storage.getItem(this.walletKey);if(raw&&raw.length<1024)wallet=JSON.parse(raw);}catch{ /* No cached wallet is assumed. */ }
    const cached=wallet?.session===session.token&&validAccounts(wallet.accounts);
    this.accounts=session.accounts||((cached&&wallet.accounts)||[]);
    if(this.account&&!this.accounts.includes(this.account))this.account=null;
    if(!this.account&&cached&&this.accounts.includes(wallet.account))this.account=wallet.account;
    let saved;
    try {saved=JSON.parse(this.storage.getItem(this.key)||'null');} catch {throw new Error('Pending-operation storage is unreadable; inspect the local session before continuing');}
    this.pending=saved?.session===session.token?saved:null;
    if(saved&&!this.pending)this.storage.removeItem(this.key);
    this.onSession();
    let recovered=null;
    if(this.pending) {
      // Recovery repeats only the identical operation ID, never a new intent.
      try {recovered=await this.request('/action',this.pending.envelope);}
      catch(error) {
        if(!error.rejected)throw error;
        this.storage.removeItem(this.key);this.pending=null;
        recovered={status:'rejected',uncertain:false};
      }
      if(!['confirmed','failed','rejected'].includes(recovered.status)||recovered.uncertain)throw new Error('Submission is unresolved. Inspect local records before restarting');
      this.storage.removeItem(this.key);this.pending=null;
    }
    const state=validateState(await this.request('/state'));
    if(session.accounts&&JSON.stringify(state.accounts)!==JSON.stringify(session.accounts))throw new Error('Local wallet inventory changed');
    this.state=state;this.accounts=state.accounts;
    if(this.account&&!this.accounts.includes(this.account))this.account=null;
    return recovered;
  }
  select(account) {
    if(this.busy||this.pending)throw new Error('Resolve the current transaction before changing wallets');
    if(account!==null&&!this.accounts.includes(account))throw new Error('Unknown local account');
    // Session storage survives reload/navigation but never selects on a new chain.
    try {this.storage.setItem(this.walletKey,JSON.stringify({session:this.session.token,accounts:this.accounts,account}));}
    catch {throw new Error('Wallet selection could not be saved in this browser');}
    this.account=account;this.version++;
  }
  async prepare(action, extras={}) {
    if(!this.state||!this.account||this.pending||this.state.uncertain)throw new Error('Refresh and select a local test wallet first');
    const account=this.account,session=this.session.token;
    let version=this.version;
    const current=()=>this.version===version&&this.account===account&&this.session.token===session&&!!this.state&&!this.pending&&!this.state.uncertain;
    // Another browser can advance the shared chain while this page is idle.
    // Reconcile real confirmed state, never merely overwrite its revision.
    for(let attempt=0;attempt<3;attempt++) {
      let started=this.clock(),wallStarted=Date.now();
      const draft=await this.request('/prepare',{...extras,action,account},current,()=>{started=this.clock();wallStarted=Date.now();});
      if(!current())throw new Error('Wallet or state changed. Prepare again');
      if(!draft||draft.chain_id!==31337||draft.account!==account||!Number.isSafeInteger(draft.revision)||draft.revision<this.state.revision||!/^[a-f0-9]{32}$/.test(draft.draft_id)||!Number.isInteger(draft.expires_in_seconds)||draft.expires_in_seconds<1||draft.expires_in_seconds>60)throw new Error('Invalid transaction confirmation');
      if(draft.revision>this.state.revision) {
        const state=validateState(await this.request('/state',undefined,current));
        if(!current())throw new Error('Wallet or state changed. Prepare again');
        if(JSON.stringify(state.accounts)!==JSON.stringify(this.accounts)||state.revision<draft.revision)throw new Error('Invalid confirmed state after another wallet transaction');
        if(state.uncertain)throw new Error('Submission state is uncertain. Refresh to inspect confirmed state');
        this.state=state;this.version++;version=this.version;
        // If another operation landed during the read, simulate again at that
        // newer revision. The previous unsigned draft is never submitted.
        if(state.revision!==draft.revision)continue;
      }
      const duration=draft.expires_in_seconds*1000;
      if(this.clock()-started>=duration||Date.now()-wallStarted>=duration)throw new Error('Confirmation expired while preparing. Prepare again');
      return {...draft,clientVersion:version,clientExpiry:wallStarted+duration,clientDeadline:started+duration};
    }
    throw new Error('Other wallet activity changed the state repeatedly. Wait briefly and review again; nothing was submitted');
  }

  async execute(draft) {
    if(!draft||!this.state||this.state.uncertain||this.pending||draft.chain_id!==31337||draft.revision!==this.state.revision||!/^[a-f0-9]{32}$/.test(draft.draft_id)||draft.clientVersion!==this.version||draft.account!==this.account||!Number.isFinite(draft.clientExpiry)||!Number.isFinite(draft.clientDeadline)||Date.now()>=draft.clientExpiry||this.clock()>=draft.clientDeadline||draft.clientDeadline-this.clock()>60000)throw new Error('Confirmation expired or wallet changed. Prepare again');
    const envelope={operation_id:this.random(),revision:draft.revision,payload:{action:'execute',account:this.account,draft_id:draft.draft_id}};
    this.pending={session:this.session.token,envelope};
    try {this.storage.setItem(this.key,JSON.stringify(this.pending));}
    catch {this.pending=null;throw new Error('Recovery storage is unavailable. Nothing was submitted');}
    let outcome;
    try {outcome=await this.request('/action',envelope);}
    catch(error) {
      if(error.rejected){this.storage.removeItem(this.key);this.pending=null;}
      throw error;
    }
    if(!['confirmed','failed'].includes(outcome.status)||outcome.uncertain)throw new Error('Submission unresolved. Refresh to inspect the saved outcome');
    this.storage.removeItem(this.key);this.pending=null;this.state=null;this.version++;
    return outcome;
  }
}
