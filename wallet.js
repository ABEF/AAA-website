export function validAddress(value) { return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value); }
export function walletError(error) {
  if (error?.code === 4001) return 'Connection cancelled. You can try again or use the demo wallet.';
  if (error?.code === -32002) return 'A wallet request is already open. Check your wallet extension.';
  return 'Could not connect to this wallet. Try again or use the demo wallet.';
}
const SESSION_KEY='popl-wallet-session-v1';
const session=()=>{try{return globalThis.sessionStorage;}catch{return null;}};
async function request(provider,method) {
  let timer;
  try {return await Promise.race([provider.request({method}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Wallet response timed out. Check the extension before retrying.')),20000);})]);}
  finally {clearTimeout(timer);}
}
export class WalletConnection {
  constructor(onChange,storage=session()) {
    this.onChange=onChange;this.storage=storage;this.provider=null;this.state=null;this.accounts=[];this.revision=0;this.restoreAttempted=false;this.requireAccountChoice=false;
    this.accountsHandler=null;this.chainHandler=null;this.disconnectHandler=null;
  }
  remember() {try {if(this.state&&!this.requireAccountChoice)this.storage?.setItem(SESSION_KEY,JSON.stringify(this.state));else this.storage?.removeItem(SESSION_KEY);}catch {/* Connection still works if tab storage is disabled. */}}
  changed(reason='state') {this.revision++;this.remember();this.onChange(this.state,reason);}
  attach(provider,accounts,chainId,name,providerId,selected=accounts[0]) {
    if(!Array.isArray(accounts)||!accounts.length||accounts.length>64||accounts.some(a=>!validAddress(a))||
       !validAddress(selected)||!accounts.some(a=>a.toLowerCase()===selected.toLowerCase()))throw new Error('Selected account is not authorized by this wallet.');
    this.clearListeners();this.provider=provider;this.accounts=[...accounts];
    this.state={address:accounts.find(a=>a.toLowerCase()===selected.toLowerCase()),name,providerId,chainId,type:'browser'};
    this.accountsHandler=list=>{
      if(this.provider!==provider)return;
      if(!Array.isArray(list)||!list.length||list.length>64||list.some(a=>!validAddress(a)))return this.disconnect();
      this.accounts=[...list];
      this.state={...this.state,address:list[0]};this.changed('accounts');
    };
    this.chainHandler=chain=>{if(this.provider===provider&&this.state){this.state={...this.state,chainId:chain};this.changed('chain');}};
    this.disconnectHandler=()=>{if(this.provider===provider)this.disconnect();};
    if(typeof provider.on==='function') {
      provider.on('accountsChanged',this.accountsHandler);provider.on('chainChanged',this.chainHandler);provider.on('disconnect',this.disconnectHandler);
    }
    this.changed();return this.state;
  }
  async connect(provider,name='Browser wallet',providerId=name) {
    if(!provider||typeof provider.request!=='function')throw new Error('A browser wallet is not available.');
    this.restoreAttempted=true;const attempt=++this.revision;
    const accounts=await request(provider,'eth_requestAccounts');
    if(!Array.isArray(accounts)||!validAddress(accounts[0]))throw new Error('No valid account returned by this wallet.');
    let chainId=null;try {chainId=await request(provider,'eth_chainId');}catch {/* Optional for this transaction-free preview only. */}
    if(attempt!==this.revision)throw new Error('Connection changed. Retry using the selected wallet.');
    this.requireAccountChoice=false;return this.attach(provider,accounts,chainId,name,providerId);
  }
  async restore(providers=[]) {
    if(this.state||this.restoreAttempted)return false;
    let saved;try {saved=JSON.parse(this.storage?.getItem(SESSION_KEY)||'null');}catch {return false;}
    if(!saved||!validAddress(saved.address))return false;
    if(saved.type==='demo'){this.connectDemo(saved.address);return true;}
    if(saved.type!=='browser'||!saved.providerId)return false;
    const matches=providers.filter(p=>p.id===saved.providerId);
    if(matches.length!==1)return false;
    this.restoreAttempted=true;const attempt=++this.revision,{provider,name,id}=matches[0];
    try {
      const accounts=await request(provider,'eth_accounts');
      if(!Array.isArray(accounts)||!validAddress(accounts[0]))return false;
      const chainId=await request(provider,'eth_chainId');
      if(attempt!==this.revision)return false;
      const selected=accounts.find(a=>validAddress(a)&&a.toLowerCase()===saved.address.toLowerCase())||accounts[0];
      this.attach(provider,accounts,chainId,name,id,selected);return true;
    }catch {return false;}
  }
  connectDemo(address) {
    if(!validAddress(address))throw new Error('Invalid demo address.');
    this.restoreAttempted=true;this.clearListeners();this.provider=null;this.accounts=[];this.requireAccountChoice=false;
    this.state={address,name:'Demo wallet',chainId:null,type:'demo'};this.changed();
  }
  clearListeners() {
    if(typeof this.provider?.removeListener==='function')for(const [event,handler] of [['accountsChanged',this.accountsHandler],['chainChanged',this.chainHandler],['disconnect',this.disconnectHandler]])if(handler)this.provider.removeListener(event,handler);
  }
  disconnect() {this.restoreAttempted=true;this.clearListeners();this.provider=null;this.state=null;this.accounts=[];this.requireAccountChoice=false;this.changed();}
}


// EIP-6963 providers take precedence over the shared legacy injection. Names
// and rdns are display/discovery hints, never proof of wallet authenticity.
export class WalletDiscovery {
  constructor(onChange=()=>{}){this.modern=[];this.fallback=[];this.onChange=onChange;}
  get items(){return this.modern.length?this.modern:this.fallback;}
  announce(detail){
    const {provider,info}=detail||{};
    if(!provider||typeof provider.request!=='function'||!info||
       typeof info.uuid!=='string'||!/^[0-9a-f-]{36}$/i.test(info.uuid)||
       typeof info.rdns!=='string'||!/^[a-z0-9.-]{1,128}$/i.test(info.rdns)||
       typeof info.name!=='string'||!info.name.trim()||info.name.length>80)return false;
    if(this.modern.some(p=>p.uuid===info.uuid||p.provider===provider)||this.modern.length>=16)return false;
    this.modern.push({provider,id:info.rdns,name:info.name,uuid:info.uuid,discovery:'eip6963'});
    this.onChange([...this.items]);return true;
  }
  legacy(injected){
    if(this.modern.length)return;
    const list=Array.isArray(injected?.providers)?injected.providers:[injected];
    this.fallback=[];
    for(const provider of list.slice(0,16)){
      if(!provider||typeof provider.request!=='function'||this.fallback.some(p=>p.provider===provider))continue;
      // The shared legacy slot may be a proxy. Do not label it MetaMask solely
      // because another wallet also advertises isMetaMask.
      this.fallback.push({provider,id:'legacy-'+this.fallback.length,name:'Browser wallet (legacy)',discovery:'legacy'});
    }
    this.onChange([...this.items]);
  }
}
