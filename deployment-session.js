// Address authorization for the read/prepare profile. No transaction, signature,
// token permission or network-change request is supported by this module.
const valid=a=>typeof a==='string'&&/^0x[0-9a-f]{40}$/.test(a)&&!/^0x0{40}$/.test(a);
const accounts=value=>{
  if(!Array.isArray(value)||value.length>64||value.some(a=>typeof a!=='string'||!valid(a.toLowerCase())))throw Error('Wallet returned invalid accounts');
  return [...new Set(value.map(a=>a.toLowerCase()))];
};
export class DeploymentSession {
  constructor({storage=globalThis.sessionStorage,key,onChange=()=>{},timeout=20000}){
    this.storage=storage;this.key=key;this.onChange=onChange;this.timeout=timeout;this.revision=0;this.account=null;this.options=[];this.provider=null;this.info=null;this.busy=false;this.listeners=[];this.restoreTried=false;
  }
  notify(){this.revision++;this.onChange();}
  forget(){try{this.storage?.removeItem(this.key);}catch{}}
  remember(){try{this.storage?.setItem(this.key,JSON.stringify({account:this.account,provider:this.info.id}));}catch{}}
  detach(){for(const [name,fn] of this.listeners)this.provider?.removeListener?.(name,fn);this.listeners=[];this.provider=null;this.info=null;}
  disconnect(){this.detach();this.account=null;this.options=[];this.busy=false;this.forget();this.notify();}
  async request(provider,method){
    if(!['eth_accounts','eth_requestAccounts'].includes(method))throw Error('Only account authorization is supported');
    let timer;try{return await Promise.race([provider.request({method}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Wallet did not respond. Check the extension before retrying.')),this.timeout);})]);}finally{clearTimeout(timer);}
  }
  async connect(info,{restore=false,selected=null}={}){
    if(this.busy)throw Error('A connection request is already open');
    this.detach();this.account=null;this.options=[];this.busy=true;this.notify();const revision=this.revision;
    try{
      const list=accounts(await this.request(info.provider,restore?'eth_accounts':'eth_requestAccounts'));
      if(revision!==this.revision)return;
      this.provider=info.provider;this.info=info;this.options=list;
      const changed=value=>{
        if(this.provider!==info.provider)return;
        try{this.options=accounts(value);}catch{this.disconnect();return;}
        // An account event invalidates the old review. Multiple addresses always
        // require a visible selection, never a guess at the extension popup.
        this.account=this.options.length===1?this.options[0]:null;
        if(this.account)this.remember();else this.forget();this.notify();
      };
      const disconnected=()=>{if(this.provider===info.provider)this.disconnect();};
      const chainChanged=()=>{if(this.provider===info.provider)this.notify();};
      this.listeners=[['accountsChanged',changed],['disconnect',disconnected],['chainChanged',chainChanged]];
      for(const [name,fn] of this.listeners)this.provider.on?.(name,fn);
      this.account=restore?(list.includes(selected)?selected:null):list.length===1?list[0]:null;
      if(this.account)this.remember();else this.forget();
    }catch(error){if(revision===this.revision){this.detach();this.forget();}throw error;}
    finally{if(revision===this.revision){this.busy=false;this.notify();}}
  }
  async select(value){
    if(this.busy||!valid(value)||!this.provider)throw Error('Select a currently authorized address');
    const revision=this.revision,provider=this.provider;
    const current=accounts(await this.request(provider,'eth_accounts'));
    if(revision!==this.revision||provider!==this.provider||!current.includes(value))throw Error('Account permission changed. Reconnect.');
    this.options=current;this.account=value;this.remember();this.notify();
  }
  async restore(providers){
    if(this.restoreTried||this.account||this.busy)return;let saved;
    try{saved=JSON.parse(this.storage?.getItem(this.key)||'null');}catch{return;}
    if(!saved||!valid(saved.account))return;
    const matches=providers.filter(p=>p.id===saved.provider);if(matches.length!==1)return;
    this.restoreTried=true;try{await this.connect(matches[0],{restore:true,selected:saved.account});}catch{/* Explicit reconnect remains available. */}
  }
  async verify(){
    const revision=this.revision,account=this.account,provider=this.provider;
    if(!account||!provider)throw Error('Choose an authorized wallet account');
    if(!accounts(await this.request(provider,'eth_accounts')).includes(account)||revision!==this.revision||account!==this.account)throw Error('Account permission changed. Reconnect before reviewing.');
    return {revision,account};
  }
}
