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
export const hasClaim = nft => ['lp','royalties'].some(scope=>nft.claimable[scope].some(a=>uint(a.raw)>0n));
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
  }
  if(!s.protocol?.provenance?.block_hash || !s.protocol?.lifecycle) throw new Error('Missing confirmed snapshot');
  return s;
}

export class LocalClient {
  constructor({fetcher=(...args)=>fetch(...args),storage=sessionStorage,random=()=>crypto.randomUUID().replaceAll('-','')}={}) {
    this.fetcher=fetcher;this.storage=storage;this.random=random;
    this.key='popl-local-website-pending-v1';this.session=null;this.state=null;this.account=null;this.busy=false;this.pending=null;this.version=0;
  }
  async request(path,body) {
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),90000);
    try {
      const response=await this.fetcher(path,{signal:controller.signal,cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-Local-Token':this.session.token},body:JSON.stringify(body)}:{})});
      const result=await response.json();
      if (!response.ok) {const error=new Error(result.error||'Local request failed');error.rejected=result.rejected===true;throw error;}
      return result;
    } finally {clearTimeout(timer);}
  }
  async refresh() {
    this.state=null;this.version++;
    const session=await this.request('/session');
    if(session.mode!=='LOCAL ANVIL TEST ONLY'||session.chain_id!==31337||!/^[a-f0-9]{64}$/.test(session.token)) throw new Error('This is not the disposable Anvil session');
    if(this.session?.token!==session.token) this.account=null;
    this.session=session;
    let saved;
    try {saved=JSON.parse(this.storage.getItem(this.key)||'null');} catch {throw new Error('Pending-operation storage is unreadable; inspect the local session before continuing');}
    this.pending=saved?.session===session.token?saved:null;
    if(saved&&!this.pending)this.storage.removeItem(this.key);
    let recovered=null;
    if(this.pending) {
      // Recovery repeats only the identical operation ID, never a new intent.
      recovered=await this.request('/action',this.pending.envelope);
      if(!['confirmed','failed'].includes(recovered.status)||recovered.uncertain)throw new Error('Submission is unresolved. Inspect local records before restarting');
      this.storage.removeItem(this.key);this.pending=null;
    }
    this.state=validateState(await this.request('/state'));
    if(this.account&&!this.state.accounts.includes(this.account))this.account=null;
    return recovered;
  }
  select(account) {
    if(this.busy||this.pending)throw new Error('Resolve the current transaction before changing wallets');
    if(account!==null&&!this.state?.accounts.includes(account))throw new Error('Unknown local account');
    this.account=account;this.version++;
  }
  async prepare(action, extras={}) {
    if(!this.state||!this.account||this.pending||this.state.uncertain)throw new Error('Refresh and select a local test wallet first');
    const version=this.version,account=this.account;
    const draft=await this.request('/prepare',{action,account,...extras});
    if(this.version!==version||this.account!==account)throw new Error('Wallet or state changed. Prepare again');
    if(draft.chain_id!==31337||draft.account!==account||draft.revision!==this.state.revision||!/^[a-f0-9]{32}$/.test(draft.draft_id))throw new Error('Invalid transaction confirmation');
    return {...draft,clientVersion:version,clientExpiry:Date.now()+draft.expires_in_seconds*1000};
  }
  async execute(draft) {
    if(this.pending||draft.clientVersion!==this.version||draft.account!==this.account||Date.now()>=draft.clientExpiry)throw new Error('Confirmation expired or wallet changed. Prepare again');
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
